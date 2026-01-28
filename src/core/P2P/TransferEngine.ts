// lib/p2p/TransferEngine.ts

import { PeerConnection } from './PeerConnection';
import { ChunkManager } from './ChunkManager';
import {
  Transfer,
  TransferStatus,
  TransferProgress,
  Chunk,
  ChunkMetadata,
  ChunkAck,
} from '@/types/transfer.types';
import { EncryptionManager } from '@/core/crypto/encryption';
import {
  saveTransferState,
  getTransferState,
  deleteTransferState,
} from '@/core/storage/indexeddb';
import { ConnectionState } from '@/types/types';
import { transferAPI } from '@/core/services/api/transfer.service';
import { useAuthStore } from '@/stores/authStore';

interface ChunkToSend {
  chunk: Chunk;
  retries: number;
  lastSentAt: number;
}

export class TransferEngine {
  private transfers: Map<string, Transfer> = new Map();
  private chunkManagers: Map<string, ChunkManager> = new Map();
  private connection: PeerConnection;
  private decryptionKeys: Map<string, CryptoKey> = new Map();

  // Gestion des chunks à envoyer par fichier
  private sendQueues: Map<string, ChunkToSend[]> = new Map();
  private pendingAcks: Map<string, Set<number>> = new Map();
  private chunksInFlight: Map<string, Set<number>> = new Map(); // Track chunks currently being sent to prevent duplicates
  private activeSends: Set<string> = new Set();
  // Buffer for chunks received before metadata/transfer is initialized
  private pendingChunkBuffer: Map<string, any[]> = new Map();

  // Configuration
  private readonly MAX_RETRIES = 3; // Initial strict retries
  private readonly MAX_RETRIES_WITH_HEARTBEAT = 8; // Extended retries if connection is alive (heartbeat_ack received)
  private readonly RETRY_TIMEOUT = 10000; // ⚡ CRITICAL FIX: Reduced from 20s to 10s for faster retry detection
  private readonly EXTENDED_RETRY_TIMEOUT = 25000; // ⚡ CRITICAL FIX: Reduced from 45s to 25s (maintains 2.5x multiplier)
  private readonly HEARTBEAT_TIMEOUT_THRESHOLD = 8000; // ⚡ CRITICAL FIX: Reduced from 10s to 8s for faster dead connection detection
  private readonly MAX_CONCURRENT_CHUNKS = 20; // ⚡ Increased for faster parallelism
  private readonly CHUNK_SEND_INTERVAL = 0;
  private readonly MAX_CONCURRENT_TRANSFERS = 3;
  private readonly FLOW_CONTROL_MODE = true; // ⚡ ENABLED: Wait for ACK before sending next chunk to prevent receiver overflow
  private readonly STATUS_UPDATE_INTERVAL = 5000; // Receiver sends status every 5 seconds

  // État des transferts
  private chunkProducersFinished: Set<string> = new Set();
  private activeRetryMonitoring: Set<string> = new Set(); // ⚡ FIXED: Track which fileIds already have retry monitoring
  private lastHeartbeatAck: Map<string, number> = new Map(); // Track last heartbeat_ack time per file
  private receivedChunks: Map<string, Set<number>> = new Map(); // Track which chunks receiver has
  private statusUpdateIntervals: Map<string, NodeJS.Timeout> = new Map();

  private startTime: number = 0;
  private bytesTransferred: number = 0;
  private retryIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  // ✅ Circuit Breaker: Prevent infinite retry loops
  private circuitBreaker: Map<string, { failures: number; state: 'closed' | 'open' | 'half-open'; lastFailure: number }> = new Map();
  private readonly CIRCUIT_BREAKER_THRESHOLD = 10; // Open after 10 consecutive failures
  private readonly CIRCUIT_BREAKER_RESET_TIME = 30000; // Try again after 30s
  
  // ✅ Problematic chunks: Track and skip chunks that fail repeatedly
  private problematicChunks: Map<string, Set<number>> = new Map();
  private readonly MAX_PROBLEMATIC_BEFORE_FAIL = 5; // Fail if >5 chunks problematic

  // ✅ CRITICAL FIX #3: Track original totalChunks per transfer to detect changes
  private readonly originalTotalChunks: Map<string, number> = new Map();

  constructor(connection: PeerConnection) {
    this.connection = connection;
    this.setupHandlers();
    this.setupConnectionMonitoring();
  }



  /**
   * Démarrer le producteur de chunks en streaming
   */
  private async startChunkProducer(fileId: string, chunkGenerator: AsyncGenerator<Chunk, void, unknown>): Promise<void> {
    const queue = this.sendQueues.get(fileId);
    if (!queue) return;

    // ✅ START: Launch retry monitoring immediately
    this.startRetryMonitoring(fileId);

    try {
      // ✅ BUG #3 FIX: Poll for sending when queue fills up
      // This ensures we keep sending when producer adds chunks faster than the polling can detect
      const sendPollingInterval = setInterval(() => {
        const q = this.sendQueues.get(fileId);
        if (q && q.length > 0) {
          this.sendNextChunks(fileId);
        }
      }, 10); // ⚡ Reduced from 50ms to 10ms for faster response

      try {
        for await (const chunk of chunkGenerator) {
          if (chunk.index === -1 && (chunk as any).metadata) {
            // Special completion signal with final metadata
            const finalMetadata = (chunk as any).metadata;
            this.connection.sendMessage({
              type: 'metadata_update',
              data: { fileId, fileHash: finalMetadata.fileHash },
            });
            console.log(`📤 Sent metadata update with fileHash for ${fileId}`);
            this.chunkProducersFinished.add(fileId);
            console.log(`✅ Chunk producer finished for ${fileId}`);
            break; // End of chunks
          }

          // Wait if queue is too full to prevent memory explosion
          const MAX_QUEUE_SIZE = 1000; // Réduit de 1300 pour synchroniser mieux
          while (queue.length >= MAX_QUEUE_SIZE) {
            await new Promise(resolve => setTimeout(resolve, 2)); // ⚡ Réduit à 2ms pour réactivité maximale
          }

          queue.push({
            chunk,
            retries: 0,
            lastSentAt: 0,
          });

          // Trigger sending as soon as we have chunks available
          this.sendNextChunks(fileId);
        }
      } finally {
        clearInterval(sendPollingInterval);
      }
    } catch (error) {
      console.error(`❌ Error in chunk producer for ${fileId}:`, error);
      const transfer = this.transfers.get(fileId);
      if (transfer) {
        transfer.status = 'failed';
        transfer.error = (error as Error).message;
        this.emitTransferUpdate(transfer);
        
        // ✅ Log the failed transfer (only if sender)
        if (transfer.direction === 'send') {
          const duration = Math.round((Date.now() - transfer.startedAt.getTime()) / 1000);
          try {
            const currentUser = useAuthStore.getState().user;
            const senderName = currentUser?.name || 'Unknown';
            const receiverName = this.connection['peerName'] || 'Unknown';

            await transferAPI.logTransfer({
              receiverId: transfer.peerId,
              senderName,
              receiverName,
              fileHash: transfer.fileHash || 'unknown',
              fileName: transfer.fileName || 'unknown',
              fileSizeBytes: transfer.fileSize,
              mimeType: transfer.mimeType || 'application/octet-stream',
              transferType: 'P2P_DIRECT',
              status: 'FAILED',
              duration,
              avgSpeed: 0,
              errorCode: (error as Error).message,
              teamId: undefined,
            });
          } catch (logError) {
            console.error('Failed to log failed transfer:', logError);
          }
        }
      }
    }
  }

  /**
   * Configurer la surveillance de la connexion
   */
  private setupConnectionMonitoring(): void {
    // Connexion monitoring removed - no auto-save functionality
  }

  /**
   * Initier un transfert de fichier
   */
  async sendFile(
    file: File,
    options?: { encrypt?: boolean; password?: string }
  ): Promise<string> {
    console.log(`📤 Starting file transfer: ${file.name}`);

    // Check if connection is ready
    if (!this.connection.isConnected()) {
      throw new Error('Peer connection is not established. Please wait for the connection to be fully established.');
    }

    // Check if data channels are ready
    if (!this.connection.areDataChannelsReady()) {
      throw new Error('Data channels are not ready. Please wait for the connection to be fully established.');
    }

    const activeCount = this.getActiveTransfersCount();
    if (activeCount >= this.MAX_CONCURRENT_TRANSFERS) {
      throw new Error(
        `Maximum concurrent transfers (${this.MAX_CONCURRENT_TRANSFERS}) reached. Please wait for one to complete.`
      );
    }

    const chunkManager = new ChunkManager();
    const { metadata, chunkGenerator } = await chunkManager.splitFile(file, options);

    this.chunkManagers.set(metadata.fileId, chunkManager);

    // Initialize empty queue - chunks will be added as they are produced
    const chunkQueue: ChunkToSend[] = [];
    this.sendQueues.set(metadata.fileId, chunkQueue);
    this.pendingAcks.set(metadata.fileId, new Set());
    this.chunksInFlight.set(metadata.fileId, new Set());

    const transfer: Transfer = {
      id: metadata.fileId,
      fileName: metadata.fileName,
      fileSize: metadata.fileSize,
      fileHash: metadata.fileHash,
      mimeType: metadata.mimeType,
      direction: 'send',
      peerId: this.connection['peerId'],
      peerName: this.connection['peerName'],
      status: 'pending',
      progress: {
        fileId: metadata.fileId,
        chunksReceived: 0,
        chunksTotal: metadata.totalChunks,
        bytesReceived: 0,
        bytesTotal: metadata.fileSize,
        percentage: 0,
        speed: 0,
        eta: 0,
      },
      startedAt: new Date(),
    };

    this.transfers.set(metadata.fileId, transfer);

    // Start the streaming chunk producer
    this.startChunkProducer(metadata.fileId, chunkGenerator);

    this.connection.sendMessage({
      type: 'metadata',
      data: metadata,
    });

    console.log('⏳ Waiting for peer to accept...');

    return metadata.fileId;
  }

  /**
   * Accepter un transfert entrant
   */
  acceptTransfer(fileId: string): void {
    console.log(`✅ Accepting transfer: ${fileId}`);

    this.connection.sendMessage({
      type: 'metadata',
      data: { accepted: true, fileId },
    });

    const transfer = this.transfers.get(fileId);
    if (transfer) {
      transfer.status = 'active';
      this.emitTransferUpdate(transfer);
    }
  }

  /**
   * Accepter un transfert avec mot de passe
   */
  async acceptTransferWithPassword(fileId: string, password: string): Promise<void> {
    const transfer = this.transfers.get(fileId);
    const chunkManager = this.chunkManagers.get(fileId);

    if (!transfer || !chunkManager) {
      throw new Error('Transfer not found');
    }

    const metadata = chunkManager['metadata'] as ChunkMetadata;

    if (!metadata) {
      throw new Error('Metadata not found');
    }

    if (!metadata.passwordProtected) {
      throw new Error('Transfer is not password protected');
    }

    if (!metadata.encryptionSalt) {
      throw new Error('Encryption salt missing');
    }

    const salt = this.base64ToArrayBuffer(metadata.encryptionSalt);
    const { key } = await EncryptionManager.deriveKeyFromPassword(
      password,
      new Uint8Array(salt)
    );

    this.decryptionKeys.set(fileId, key);

    this.acceptTransfer(fileId);
  }

  /**
   * Refuser un transfert entrant
   */
  async rejectTransfer(fileId: string, reason?: string): Promise<void> {
    console.log(`❌ Rejecting transfer: ${fileId}`);

    const transfer = this.transfers.get(fileId);
    if (transfer) {
      // Update local status
      transfer.status = 'failed';
      transfer.error = reason || 'Transfer rejected';
      this.emitTransferUpdate(transfer);
      
      // ✅ Log the rejection (only for receiver since it received the offer)
      if (transfer.direction === 'receive') {
        const duration = Math.round((Date.now() - transfer.startedAt.getTime()) / 1000);
        try {
          const currentUser = useAuthStore.getState().user;
          const receiverName = currentUser?.name || 'Unknown';
          const senderName = this.connection['peerName'] || 'Unknown';

          await transferAPI.logTransfer({
            receiverId: transfer.peerId,
            senderName,
            receiverName,
            fileHash: transfer.fileHash || 'unknown',
            fileName: transfer.fileName || 'unknown',
            fileSizeBytes: transfer.fileSize,
            mimeType: transfer.mimeType || 'application/octet-stream',
            transferType: 'P2P_DIRECT',
            status: 'REJECTED',
            duration,
            avgSpeed: 0,
            errorCode: reason || 'Rejected by receiver',
            teamId: undefined,
          });
        } catch (logError) {
          console.error('Failed to log rejected transfer:', logError);
        }
      }
    }

    // Send rejection to peer
    this.connection.sendMessage({
      type: 'metadata',
      data: { accepted: false, fileId, reason },
    });

    this.cleanupTransfer(fileId);
  }

  /**
   * Mettre en pause un transfert
   */
  pauseTransfer(fileId: string): void {
    const transfer = this.transfers.get(fileId);
    if (transfer && transfer.status === 'active') {
      transfer.status = 'paused';
      this.activeSends.delete(fileId);
      this.clearRetryInterval(fileId);
      this.emitTransferUpdate(transfer);
    }
  }

  /**
   * Annuler un transfert
   */
  cancelTransfer(fileId: string): void {
    console.log(`🛑 Cancelling transfer: ${fileId}`);

    const transfer = this.transfers.get(fileId);
    if (transfer) {
      transfer.status = 'cancelled';
      this.emitTransferUpdate(transfer);

      // ✅ Log the cancelled transfer when sender cancels
      if (transfer.direction === 'send') {
        const duration = Math.round((Date.now() - transfer.startedAt.getTime()) / 1000);
        try {
          const currentUser = useAuthStore.getState().user;
          const senderName = currentUser?.name || 'Unknown';
          const receiverName = this.connection['peerName'] || 'Unknown';

          transferAPI.logTransfer({
            receiverId: transfer.peerId,
            senderName,
            receiverName,
            fileHash: transfer.fileHash || 'unknown',
            fileName: transfer.fileName || 'unknown',
            fileSizeBytes: transfer.fileSize,
            mimeType: transfer.mimeType || 'application/octet-stream',
            transferType: 'P2P_DIRECT',
            status: 'CANCELLED',
            duration,
            avgSpeed: 0,
            errorCode: 'Cancelled by sender',
            teamId: undefined,
          }).catch((logError) => {
            console.error('Failed to log cancelled transfer:', logError);
          });
        } catch (err) {
          console.error('Error logging cancelled transfer:', err);
        }
      }
    }

    this.connection.sendMessage({
      type: 'metadata',
      data: { cancelled: true, fileId },
    });

    this.cleanupTransfer(fileId);
  }

  /**
   * Obtenir un transfert
   */
  getTransfer(fileId: string): Transfer | undefined {
    return this.transfers.get(fileId);
  }

  /**
   * Obtenir tous les transferts de ce peer
   */
  getAllTransfers(): Transfer[] {
    return Array.from(this.transfers.values());
  }

  /**
   * Obtenir le nombre de transferts actifs
   */
  getActiveTransfersCount(): number {
    return Array.from(this.transfers.values()).filter((t) => t.status === 'active')
      .length;
  }

  /**
   * Configurer les handlers
   */
  private setupHandlers(): void {
    this.connection.on('metadata', (data: any) => {
      this.handleMetadata(data);
    });

    this.connection.on('metadata_update', (data: any) => {
      this.handleMetadataUpdate(data);
    });

    this.connection.on('chunk', (data: any) => {
      this.handleChunk(data);
    });

    this.connection.on('ack', (data: ChunkAck) => {
      this.handleAck(data);
    });

    this.connection.on('binarydata', (data: ArrayBuffer) => {
      this.handleBinaryData(data);
    });

    // ✅ NEW: Track heartbeat_ack to know connection is alive
    this.connection.on('heartbeat_ack', (data: any) => {
      const fileId = Object.keys(this.transfers).find(id => {
        const transfer = this.transfers.get(id);
        return transfer && transfer.status === 'active';
      });
      
      if (fileId) {
        const lastHB = this.lastHeartbeatAck.get(fileId) || 0;
        this.lastHeartbeatAck.set(fileId, Date.now());
        console.log(`💓 Heartbeat ACK received for ${fileId} (was ${Date.now() - lastHB}ms ago)`);
      }
    });

    // ✅ NEW: Handle receiver status updates
    this.connection.on('transfer_status', (data: any) => {
      const { fileId, receivedChunks, lastReceivedChunk, receivedCount } = data;
      if (fileId) {
        this.receivedChunks.set(fileId, new Set(receivedChunks));
        console.log(`📊 Receiver status: ${fileId} has received ${receivedCount} chunks (last: ${lastReceivedChunk})`);
      }
    });

    // Resume sending when peer signals bufferedamountlow (backpressure relieved)
    this.connection.on('bufferedamountlow', () => {
      try {
        for (const fileId of this.activeSends) {
          this.sendNextChunks(fileId);
        }
      } catch (err) {
        console.warn('Error while handling bufferedamountlow event', err);
      }
    });
  }

  /**
   * Gérer les métadonnées
   */
  private async handleMetadata(data: any): Promise<void> {
    if (data.fileName) {
      const metadata: ChunkMetadata = data;

      console.log(`📥 Received file metadata: ${metadata.fileName}`);

      // ✅ CRITICAL FIX #8: Check if this metadata is for an EXISTING transfer
      // If it is, DON'T overwrite unless direction is different
      const existingTransfer = this.transfers.get(metadata.fileId);
      if (existingTransfer) {
        // We already have a transfer for this fileId
        if (existingTransfer.direction === 'send') {
          // This is OUR transfer (we're sending), but we received metadata for it
          // This shouldn't happen - it's likely a loopback message
          console.warn(
            `⚠️ WARNING: Received metadata for a transfer WE are SENDING! ` +
            `fileId: ${metadata.fileId}. ` +
            `Expected direction: 'send', incoming direction: 'receive'. ` +
            `Ignoring to prevent transfer object corruption.`
          );
          return;
        } else if (existingTransfer.direction === 'receive' && existingTransfer.status !== 'pending') {
          // We already have an active receive transfer, don't overwrite it
          console.warn(
            `⚠️ WARNING: Received duplicate metadata for already-active transfer ${metadata.fileId}. ` +
            `Status: ${existingTransfer.status}. ` +
            `Ignoring to prevent corruption.`
          );
          return;
        }
      }

      if (metadata.encrypted && metadata.encryptionKey && !metadata.passwordProtected) {
        try {
          const key = await EncryptionManager.importKey(metadata.encryptionKey);
          this.decryptionKeys.set(metadata.fileId, key);
        } catch (error) {
          console.error('Failed to import encryption key:', error);
        }
      }

      const chunkManager = new ChunkManager();
      chunkManager.setMetadata(metadata);
      this.chunkManagers.set(metadata.fileId, chunkManager);

      // If we received chunks earlier for this fileId before metadata arrived,
      // process them now from the pending buffer.
      const buffered = this.pendingChunkBuffer.get(metadata.fileId);
      if (buffered && buffered.length > 0) {
        console.log(`📥 Processing ${buffered.length} buffered chunks for ${metadata.fileId}`);
        for (const chunk of buffered) {
          try {
            await this.handleChunk(chunk);
          } catch (err) {
            console.error('Failed to process buffered chunk:', err);
          }
        }
        this.pendingChunkBuffer.delete(metadata.fileId);
      }

      const transfer: Transfer = {
        id: metadata.fileId,
        fileName: metadata.fileName,
        fileSize: metadata.fileSize,
        fileHash: metadata.fileHash,
        mimeType: metadata.mimeType,
        direction: 'receive',
        peerId: this.connection['peerId'],
        peerName: this.connection['peerName'],
        status: 'pending',
        progress: {
          fileId: metadata.fileId,
          chunksReceived: 0,
          chunksTotal: metadata.totalChunks,
          bytesReceived: 0,
          bytesTotal: metadata.fileSize,
          percentage: 0,
          speed: 0,
          eta: 0,
        },
        startedAt: new Date(),
        metadata: metadata,
      };

      this.transfers.set(metadata.fileId, transfer);
      this.emitTransferUpdate(transfer);
      this.emitTransferOffer(transfer);
    } else if (data.accepted === true) {
      console.log(`✅ Transfer accepted: ${data.fileId}`);
      this.startSending(data.fileId);
    } else if (data.accepted === false) {
      console.log(`❌ Transfer rejected: ${data.fileId}`);
      const transfer = this.transfers.get(data.fileId);
      if (transfer) {
        transfer.status = 'failed';
        transfer.error = data.reason || 'Transfer rejected by peer';
        this.emitTransferUpdate(transfer);
        
        // ✅ Log the rejected transfer (only if sender to avoid double-logging)
        if (transfer.direction === 'send') {
          const duration = Math.round((Date.now() - transfer.startedAt.getTime()) / 1000);
          try {
            const currentUser = useAuthStore.getState().user;
            const senderName = currentUser?.name || 'Unknown';
            const receiverName = this.connection['peerName'] || 'Unknown';

            await transferAPI.logTransfer({
              receiverId: transfer.peerId,
              senderName,
              receiverName,
              fileHash: transfer.fileHash || 'unknown',
              fileName: transfer.fileName || 'unknown',
              fileSizeBytes: transfer.fileSize,
              mimeType: transfer.mimeType || 'application/octet-stream',
              transferType: 'P2P_DIRECT',
              status: 'REJECTED',
              duration,
              avgSpeed: 0,
              errorCode: data.reason || 'Rejected by peer',
              teamId: undefined,
            });
          } catch (logError) {
            console.error('Failed to log rejected transfer:', logError);
          }
        }
      }
      this.cleanupTransfer(data.fileId);
    } else if (data.cancelled === true) {
      console.log(`🛑 Transfer cancelled by peer: ${data.fileId}`);
      const transfer = this.transfers.get(data.fileId);
      if (transfer) {
        transfer.status = 'cancelled';
        this.emitTransferUpdate(transfer);
        
        // ✅ Log the cancelled transfer (only if sender to avoid double-logging)
        if (transfer.direction === 'send') {
          const duration = Math.round((Date.now() - transfer.startedAt.getTime()) / 1000);
          try {
            const currentUser = useAuthStore.getState().user;
            const senderName = currentUser?.name || 'Unknown';
            const receiverName = this.connection['peerName'] || 'Unknown';

            await transferAPI.logTransfer({
              receiverId: transfer.peerId,
              senderName,
              receiverName,
              fileHash: transfer.fileHash || 'unknown',
              fileName: transfer.fileName || 'unknown',
              fileSizeBytes: transfer.fileSize,
              mimeType: transfer.mimeType || 'application/octet-stream',
              transferType: 'P2P_DIRECT',
              status: 'CANCELLED',
              duration,
              avgSpeed: 0,
              errorCode: 'Cancelled by peer',
              teamId: undefined,
            });
          } catch (logError) {
            console.error('Failed to log cancelled transfer:', logError);
          }
        }
      }
      this.cleanupTransfer(data.fileId);
    }
  }

  /**
   * Gérer les mises à jour de métadonnées
   */
  private handleMetadataUpdate(data: any): void {
    const { fileId, fileHash } = data;
    const chunkManager = this.chunkManagers.get(fileId);
    const transfer = this.transfers.get(fileId);

    if (chunkManager && transfer) {
      // Update the metadata with the final fileHash
      const metadata = chunkManager['metadata'];
      if (metadata) {
        metadata.fileHash = fileHash;
        transfer.fileHash = fileHash;
        console.log(`📥 Updated metadata with fileHash for ${fileId}`);
      }
    }
  }

  /**
   * Gérer un chunk reçu
   */
  private async handleChunk(data: any): Promise<void> {
    const { fileId, index, hash, data: chunkData, encryptionMetadata, compressed } = data;

    const chunkManager = this.chunkManagers.get(fileId);
    const transfer = this.transfers.get(fileId);

    if (!chunkManager || !transfer) {
      // Buffer the chunk briefly in case metadata is still being processed.
      console.warn(`Unknown transfer: ${fileId} — buffering chunk until metadata available`);
      const buf = this.pendingChunkBuffer.get(fileId) || [];
      // Limit buffered items to avoid memory explosion
      if (buf.length < 100) {
        buf.push(data);
        this.pendingChunkBuffer.set(fileId, buf);
      } else {
        console.error(`Pending buffer full for ${fileId}, dropping chunk ${index}`);
      }

      // Set a timer to clean the buffer if metadata never arrives
      setTimeout(() => {
        if (this.pendingChunkBuffer.has(fileId)) {
          console.warn(`Buffered chunks for ${fileId} expired (no metadata received)`);
          this.pendingChunkBuffer.delete(fileId);
        }
      }, 5000);

      return;
    }

    try {
      const arrayBuffer = chunkData as ArrayBuffer;

      // 🔍 ONLY log for first/last chunks to avoid performance overhead
      if (index < 5 || index === (this.transfers.get(fileId)?.progress.chunksTotal || 0) - 1) {
        const view = new Uint8Array(arrayBuffer);
        console.log(`📥 Chunk received: ${fileId}#${index} (${view.byteLength} bytes)`);
      }
      
      // ⚠️ Verify chunk size is reasonable (at least 1 byte for last chunk, 1KB+ for others)
      const transfer = this.transfers.get(fileId);
      const totalChunks = transfer?.progress.chunksTotal || 0;
      if (index !== totalChunks - 1 && arrayBuffer.byteLength < 1024) {
        console.warn(`⚠️ WARNING: Non-last chunk ${index}/${totalChunks} is only ${arrayBuffer.byteLength} bytes! Possible truncation detected.`);
      }

      await chunkManager.receiveChunk({
        index,
        data: arrayBuffer,
        hash,
        size: arrayBuffer.byteLength,
        encryptionMetadata,
        compressed,
      });

      // ✅ Track received chunks for status updates
      if (!this.receivedChunks.has(fileId)) {
        this.receivedChunks.set(fileId, new Set());
      }
      this.receivedChunks.get(fileId)!.add(index);

      // ✅ CRITICAL FIX: Send ACK immediately with retry logic (no excessive logging)
      try {
        // Try to send ACK - use sendMessage which is the official method
        this.connection.sendMessage({
          type: 'ack',
          data: { fileId, index, received: true, hash },
        });
      } catch (ackError) {
        console.error(`❌ Failed to send ACK for chunk ${index}:`, ackError);
        // Retry once after a tiny delay
        setTimeout(() => {
          try {
            this.connection.sendMessage({
              type: 'ack',
              data: { fileId, index, received: true, hash },
            });
          } catch (retryError) {
            console.error(`❌ ACK retry failed for chunk ${index}:`, retryError);
          }
        }, 10);
      }

      // Update progress asynchronously so ACK is sent quickly
      // Use Promise.resolve() instead of setImmediate() for cross-platform compatibility
      Promise.resolve().then(() => {
        this.updateProgress(fileId);
      });

      if (chunkManager.isComplete()) {
        // ⚠️ CRITICAL: Wait for fileHash to be set before assembly
        // The sender sends metadata_update with fileHash after all chunks
        // Give it a moment to arrive (max 1 second)
        const MAX_WAIT = 1000;
        const POLL_INTERVAL = 10;
        let waited = 0;
        
        while (waited < MAX_WAIT) {
          const metadata = chunkManager['metadata'] as any;
          if (metadata && metadata.fileHash) {
            console.log(`✅ FileHash received: ${metadata.fileHash.substring(0, 16)}...`);
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
          waited += POLL_INTERVAL;
        }
        
        const metadata = chunkManager['metadata'] as any;
        if (!metadata || !metadata.fileHash) {
          console.warn(`⚠️ FileHash not received after ${MAX_WAIT}ms, proceeding anyway (may cause assembly error)`);
        }
        
        await this.completeTransfer(fileId);
      }
    } catch (error) {
      console.error(`Failed to receive chunk ${index}:`, error);

      this.connection.sendMessage({
        type: 'ack',
        data: { fileId, index, received: false },
      });
    }
  }

  /**
   * Gérer un ACK
   */
  private handleAck(ack: ChunkAck): void {
    const { fileId, index, received } = ack;

    const pendingAcks = this.pendingAcks.get(fileId);
    const inFlight = this.chunksInFlight.get(fileId);
    
    // ✅ DIAGNOSTIC: Log all ACK received
    console.log(`📥 ACK received for chunk ${index} of ${fileId} (status: ${received ? 'success' : 'fail'}, pending before removal: ${pendingAcks?.size ?? 0})`);
    
    if (pendingAcks) {
      const wasInPending = pendingAcks.has(index);
      pendingAcks.delete(index);
      
      if (wasInPending) {
        console.log(`✅ Removed chunk ${index} from pendingAcks (${pendingAcks.size} remaining)`);
      } else {
        console.warn(`⚠️ ACK for chunk ${index} but it wasn't in pendingAcks (already removed?)`);
      }
    } else {
      console.warn(`⚠️ No pendingAcks map for ${fileId} when receiving ACK for chunk ${index}`);
    }
    
    if (inFlight) {
      inFlight.delete(index);
    }

    if (received) {
      console.log(`✅ Chunk ${index} acknowledged for ${fileId}`);
      // Remove the chunk from the send queue so it won't be resent
      const queue = this.sendQueues.get(fileId);
      if (queue) {
        const idx = queue.findIndex((item) => item.chunk.index === index);
        if (idx !== -1) {
          queue.splice(idx, 1);
          this.sendQueues.set(fileId, queue);
          console.log(`📦 Removed acknowledged chunk ${index} from send queue (${queue.length} chunks remaining)`);
        } else {
          console.warn(`⚠️ Chunk ${index} acknowledged but not found in send queue`);
        }
      }

      this.updateSendProgress(fileId, index);
      // ✅ CRITICAL: Continue sending next chunks after ACK
      this.sendNextChunks(fileId);
    } else {
      console.warn(`❌ Chunk ${index} NACK received, scheduling retry...`);
      // Remove from in-flight so it can be retried
      if (inFlight) {
        inFlight.delete(index);
      }
      this.retryChunk(fileId, index).catch(err => console.error('Retry failed:', err));
    }
  }

  /**
   * Retry d'un chunk qui a échoué
   */
  private async retryChunk(fileId: string, chunkIndex: number): Promise<void> {
    const queue = this.sendQueues.get(fileId);
    if (!queue) return;

    const chunkToRetry = queue.find((item) => item.chunk.index === chunkIndex);

    if (!chunkToRetry) {
      console.error(`❌ Chunk ${chunkIndex} not found in queue, cannot retry!`);
      
      // ✅ CRITICAL FIX: Try to remove from inFlight anyway to prevent stuck state
      const inFlight = this.chunksInFlight.get(fileId);
      const pendingAcks = this.pendingAcks.get(fileId);
      
      if (inFlight && inFlight.has(chunkIndex)) {
        inFlight.delete(chunkIndex);
        console.warn(`⚠️ Recovered: Removed chunk ${chunkIndex} from inFlight`);
      }
      if (pendingAcks && pendingAcks.has(chunkIndex)) {
        pendingAcks.delete(chunkIndex);
        console.warn(`⚠️ Recovered: Removed chunk ${chunkIndex} from pendingAcks`);
      }
      return;
    }

    // ✅ Check if connection is alive via heartbeat_ack
    const lastHeartbeat = this.lastHeartbeatAck.get(fileId) || 0;
    const timeSinceLastHeartbeat = Date.now() - lastHeartbeat;
    const isConnectionAlive = timeSinceLastHeartbeat < this.HEARTBEAT_TIMEOUT_THRESHOLD;
    const maxRetriesAllowed = isConnectionAlive ? this.MAX_RETRIES_WITH_HEARTBEAT : this.MAX_RETRIES;

    // ✅ CIRCUIT BREAKER: Prevent infinite retry loops
    if (!this.canSendViaCircuitBreaker(fileId)) {
      console.error(`🔴 CIRCUIT BREAKER OPEN for ${fileId} - too many failures, pausing retries`);
      const transfer = this.transfers.get(fileId);
      if (transfer && transfer.status === 'active') {
        transfer.status = 'failed';
        transfer.error = 'Too many consecutive failures - circuit breaker activated';
        this.emitTransferUpdate(transfer);
      }
      this.cleanupTransfer(fileId);
      return;
    }

    // ✅ CRITICAL FIX: Remove from inFlight before retrying to prevent duplicates
    const inFlight = this.chunksInFlight.get(fileId);
    if (inFlight && inFlight.has(chunkIndex)) {
      inFlight.delete(chunkIndex);
      console.log(`✅ Removed chunk ${chunkIndex} from inFlight before retry`);
    }
    
    // ✅ CRITICAL FIX: Remove from pendingAcks if it's still there (timeout case)
    const pendingAcks = this.pendingAcks.get(fileId);
    if (pendingAcks && pendingAcks.has(chunkIndex)) {
      pendingAcks.delete(chunkIndex);
      console.log(`✅ Removed chunk ${chunkIndex} from pendingAcks before retry`);
    }

    // ✅ PROBLEMATIC CHUNKS: If connection alive but chunk keeps failing, mark as problematic and skip
    if (isConnectionAlive && chunkToRetry.retries >= 5) {
      console.warn(`⚠️ Chunk ${chunkIndex} is problematic (${chunkToRetry.retries} retries with healthy connection), marking for skipping`);
      
      if (!this.problematicChunks.has(fileId)) {
        this.problematicChunks.set(fileId, new Set());
      }
      this.problematicChunks.get(fileId)!.add(chunkIndex);
      
      // If too many problematic chunks, fail the transfer
      if (this.problematicChunks.get(fileId)!.size > this.MAX_PROBLEMATIC_BEFORE_FAIL) {
        console.error(`❌ Too many problematic chunks (${this.problematicChunks.get(fileId)!.size}), failing transfer`);
        const transfer = this.transfers.get(fileId);
        if (transfer) {
          transfer.status = 'failed';
          transfer.error = `Too many problematic chunks: ${Array.from(this.problematicChunks.get(fileId)!).join(', ')}`;
          this.emitTransferUpdate(transfer);
        }
        this.cleanupTransfer(fileId);
        return;
      }
      
      // Skip this chunk and move to next
      this.emitChunkSkipped(fileId, chunkIndex);
      this.sendNextChunks(fileId);
      return;
    }

    if (chunkToRetry.retries >= maxRetriesAllowed) {
      console.error(`❌ Chunk ${chunkIndex} failed after ${chunkToRetry.retries} retries (max: ${maxRetriesAllowed}, connection alive: ${isConnectionAlive}, last HB: ${timeSinceLastHeartbeat}ms ago)`);

      // Record failure for circuit breaker
      this.recordCircuitBreakerFailure(fileId);

      const transfer = this.transfers.get(fileId);
      if (transfer) {
        transfer.status = 'failed';
        transfer.error = `Chunk ${chunkIndex} failed after ${chunkToRetry.retries} retries (connection: ${isConnectionAlive ? 'alive' : 'dead'})`;
        this.emitTransferUpdate(transfer);
        
        // ✅ Log the failed transfer (only if sender)
        if (transfer.direction === 'send') {
          const duration = Math.round((Date.now() - transfer.startedAt.getTime()) / 1000);
          try {
            const currentUser = useAuthStore.getState().user;
            const senderName = currentUser?.name || 'Unknown';
            const receiverName = this.connection['peerName'] || 'Unknown';

            await transferAPI.logTransfer({
              receiverId: transfer.peerId,
              senderName,
              receiverName,
              fileHash: transfer.fileHash || 'unknown',
              fileName: transfer.fileName || 'unknown',
              fileSizeBytes: transfer.fileSize,
              mimeType: transfer.mimeType || 'application/octet-stream',
              transferType: 'P2P_DIRECT',
              status: 'FAILED',
              duration,
              avgSpeed: 0,
              errorCode: `Chunk ${chunkIndex} failed after ${this.MAX_RETRIES} retries`,
              teamId: undefined,
            });
          } catch (logError) {
            console.error('Failed to log failed transfer:', logError);
          }
        }
      }

      this.cleanupTransfer(fileId);
      return;
    }

    chunkToRetry.retries++;

    console.log(
      `🔄 Retrying chunk ${chunkIndex} (attempt ${chunkToRetry.retries}/${this.MAX_RETRIES})`
    );

    setTimeout(() => {
      this.sendChunk(fileId, chunkToRetry);
    }, this.RETRY_TIMEOUT);
  }

  /**
   * Gérer des données binaires
   */
  private handleBinaryData(data: ArrayBuffer): void {
    console.log('Received binary data:', data.byteLength);
  }

  /**
   * Démarrer l'envoi des chunks
   */
  private async startSending(fileId: string): Promise<void> {
    console.log(`📤 Starting to send chunks: ${fileId}`);

    const transfer = this.transfers.get(fileId);
    if (!transfer) return;

    transfer.status = 'active';
    this.startTime = Date.now();
    this.bytesTransferred = 0;

    this.activeSends.add(fileId);
    this.emitTransferUpdate(transfer);

    this.sendNextChunks(fileId);
    this.startRetryMonitoring(fileId);
  }

  /**
   * Envoyer les prochains chunks disponibles
   */
  private async sendNextChunks(fileId: string): Promise<void> {
    const transfer = this.transfers.get(fileId);
    const queue = this.sendQueues.get(fileId);
    const pendingAcks = this.pendingAcks.get(fileId);

    if (!transfer || !queue || !pendingAcks) return;
    if (transfer.status !== 'active') return;
    if (!this.activeSends.has(fileId)) return;

    const inFlight = pendingAcks.size;
    // adapt concurrency based on chunkManager worker availability when possible
    const cm = this.chunkManagers.get(fileId);
    const workerAvailable = cm ? (cm.getStats().workerPool?.available ?? this.MAX_CONCURRENT_CHUNKS) : this.MAX_CONCURRENT_CHUNKS;
    
    // Reduce concurrency for large files to prevent memory explosion
    const fileSizeGB = transfer.fileSize / (1024 * 1024 * 1024);
    let maxConcurrent = this.MAX_CONCURRENT_CHUNKS;
    if (fileSizeGB > 1) {
      maxConcurrent = Math.max(1, Math.floor(this.MAX_CONCURRENT_CHUNKS / 2)); // Half for files > 1GB
    }
    if (fileSizeGB > 5) {
      maxConcurrent = Math.max(1, Math.floor(this.MAX_CONCURRENT_CHUNKS / 4)); // Quarter for files > 5GB
    }
    
    const dynamicLimit = Math.max(1, Math.min(maxConcurrent, workerAvailable));
    const canSend = dynamicLimit - inFlight;

    if (canSend <= 0) {
      return;
    }

    const chunksToSend = queue
      .filter((item) => !pendingAcks.has(item.chunk.index))
      .slice(0, canSend);

    if (chunksToSend.length === 0) {
      if (pendingAcks.size === 0 && this.chunkProducersFinished.has(fileId)) {
        console.log(`🎯 All chunks sent and acknowledged, completing transfer ${fileId}`);
        await this.completeTransfer(fileId);
      } else if (pendingAcks.size === 0 && !this.chunkProducersFinished.has(fileId)) {
        console.log(`⏳ Waiting for chunk producer to finish for ${fileId} (${pendingAcks.size} pending ACKs)`);
      }
      return;
    }

    // ⚡ Send with FLOW CONTROL: 
    // If FLOW_CONTROL_MODE is enabled, send only 1 chunk at a time
    // Otherwise, send all chunks to maximize throughput
    if (this.FLOW_CONTROL_MODE && chunksToSend.length > 1) {
      // Flow control mode: send only first chunk, wait for ACK before next
      // This prevents receiver buffer overflow
      this.sendChunk(fileId, chunksToSend[0]);
      console.log(`📤 [Flow Control] Sent 1 chunk, waiting for ACK (${pendingAcks.size + 1}/${this.MAX_CONCURRENT_CHUNKS} pending)`);
    } else {
      // Send all chunks immediately (default behavior)
      chunksToSend.forEach((chunkToSend) => {
        this.sendChunk(fileId, chunkToSend);
      });
    }
  }

  /**
   * Envoyer un chunk spécifique
   */
  private sendChunk(fileId: string, chunkToSend: ChunkToSend): void {
    const { chunk, retries } = chunkToSend;
    const pendingAcks = this.pendingAcks.get(fileId);
    const inFlight = this.chunksInFlight.get(fileId);
    const queue = this.sendQueues.get(fileId);

    if (!pendingAcks || !inFlight) {
      // ✅ CRITICAL FIX: If queue doesn't exist, log for debugging
      if (!queue && !this.sendQueues.has(fileId)) {
        console.warn(`⚠️ Queue doesn't exist for ${fileId}:${chunk.index}, transfer may have been cleaned up`);
      }
      return;
    }

    // ✅ CRITICAL FIX #3: Validate totalChunks immutability
    const transfer = this.transfers.get(fileId);
    if (transfer) {
      const currentTotal = transfer.progress.chunksTotal;
      const originalTotal = this.originalTotalChunks.get(fileId);
      
      if (!originalTotal) {
        // First chunk: store the totalChunks value
        if (currentTotal > 0) {
          this.originalTotalChunks.set(fileId, currentTotal);
          console.log(`✅ Stored original totalChunks=${currentTotal} for ${fileId}`);
        }
      } else if (currentTotal !== originalTotal && currentTotal > 0) {
        // ❌ FATAL: totalChunks has changed!
        console.error(`❌ CRITICAL: totalChunks changed during transfer!`);
        console.error(`   File: ${fileId}`);
        console.error(`   Original: ${originalTotal}, Current: ${currentTotal}`);
        console.error(`   Chunk being sent: ${chunk.index}`);
        throw new Error(`FATAL: totalChunks changed from ${originalTotal} to ${currentTotal}`);
      }
    }

    // Prevent sending duplicate chunks
    if (inFlight.has(chunk.index)) {
      console.warn(`⚠️ Chunk ${chunk.index} already in flight, skipping duplicate send`);
      return;
    }
    
    // ✅ CRITICAL FIX: Ensure chunk is still in queue or was recently removed
    const chunkStillInQueue = queue && queue.some(c => c.chunk.index === chunk.index);
    if (!chunkStillInQueue && !inFlight.has(chunk.index)) {
      console.error(`⚠️ Chunk ${chunk.index} not found in queue and not in flight! This may cause 'Chunk not found in queue' error.`);
      console.error(`   Queue size: ${queue?.length ?? 0}, InFlight size: ${inFlight.size}`);
      // Still proceed - the chunk might have been removed legitimately
    }

    try {
      const transfer = this.transfers.get(fileId);
      const totalChunks = transfer?.progress.chunksTotal || 0;
      
      // ✅ CRITICAL FIX: Validate totalChunks is correct BEFORE sending
      // If transfer hasn't been initialized yet, don't send!
      if (!transfer || totalChunks === 0) {
        console.error(`❌ CRITICAL: Transfer not found or totalChunks=0 for ${fileId}! Cannot send chunk ${chunk.index}`);
        return;
      }

      // ✅ CRITICAL FIX #7: Verify totalChunks never changes during transfer
      // This catches if a second metadata overwrites the transfer object
      const chunkManager = this.chunkManagers.get(fileId);
      if (chunkManager && (chunkManager as any)['metadata']) {
        const originalTotalChunks = (chunkManager as any)['metadata'].totalChunks;
        if (originalTotalChunks !== totalChunks) {
          console.error(
            `❌ CRITICAL: totalChunks MISMATCH for ${fileId}! ` +
            `ChunkManager has ${originalTotalChunks} but Transfer object has ${totalChunks}. ` +
            `Transfer object was likely OVERWRITTEN by incoming metadata!`
          );
          console.error(`   Chunk index: ${chunk.index}, ChunkManager: ${originalTotalChunks}, Transfer: ${totalChunks}`);
          // RESTORE the original value from ChunkManager
          transfer.progress.chunksTotal = originalTotalChunks;
          console.log(`   ✅ RESTORED totalChunks from ChunkManager to ${originalTotalChunks}`);
        }
      }

      console.log(
        `📦 Sending chunk ${chunk.index}/${totalChunks} (retry: ${retries})`
      );

      // Validate chunk data integrity before sending
      if (!chunk.data || chunk.data.byteLength === 0) {
        console.error(`❌ Invalid chunk data for chunk ${chunk.index}`);
        this.retryChunk(fileId, chunk.index).catch(err => console.error('Retry failed:', err));
        return;
      }
      
      // 🔍 DEBUG: Detect 177-byte chunks at send time
      if (chunk.data.byteLength === 177 && chunk.index !== totalChunks - 1) {
        console.error(`🚨 CRITICAL: About to send 177-byte chunk ${chunk.index}! This is a DETERMINISTIC BUG.`);
        console.error(`   Chunk index: ${chunk.index}/${totalChunks}`);
        console.error(`   Data size: ${chunk.data.byteLength}`);
        console.error(`   Compression: ${chunk.compressed}`);
        console.error(`   Hash: ${chunk.hash}`);
      }

      // Check if data channel buffer is too high - if so, wait for bufferedamountlow event
      try {
        const buffered = (this.connection as any).getBufferedAmount?.();
        const BUFFER_LIMIT = 4 * 1024 * 1024; // 4 MB - match bufferedAmountLowThreshold
        if (typeof buffered === 'number' && buffered > BUFFER_LIMIT) {
          console.warn(`⚠️ Data channel bufferedAmount ${buffered} > ${BUFFER_LIMIT}, waiting for buffer relief`);
          // Don't send this chunk now - wait for bufferedamountlow event to resume
          return;
        }
      } catch (err) {
        // ignore if feature not available
      }

      try {
        const view = new Uint8Array(chunk.data);
        const snippet = Array.from(view.subarray(0, Math.min(8, view.length))).
          map((b) => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`📤 sendChunk ${fileId}#${chunk.index}: ${view.byteLength} bytes, hash: ${chunk.hash}, first8: ${snippet}`);
        
        // 📊 Log compressed sizes to detect truncation
        if (chunk.index < 5 || chunk.index === totalChunks - 1) {
          console.log(`   └─ Compressed size: ${view.byteLength} bytes`);
        }
        
        // ⚠️ WARN if chunk is suspiciously small (less than 1KB for non-last chunks)
        if (chunk.index !== totalChunks - 1 && view.byteLength < 1024) {
          console.warn(`⚠️ WARNING: Non-last chunk ${chunk.index}/${totalChunks} is only ${view.byteLength} bytes!`);
          // ✅ CRITICAL FIX: For chunks that are too small, this is an ERROR not a warning
          // If we're sending duplicates of small chunks, that's a sign of deeper problems
          if (view.byteLength < 200) {
            console.error(`❌ CRITICAL: Chunk ${chunk.index} is suspiciously small (${view.byteLength} bytes) - possible data duplication!`);
          }
        }
      } catch (e) {
        console.log(`📤 sendChunk ${fileId}#${chunk.index}: hash: ${chunk.hash}`);
      }

      // ✅ CRITICAL: Log metadata being sent to verify totalChunks is correct
      const metadataToSend = {
        fileId,
        index: chunk.index,
        totalChunks,
        hash: chunk.hash,
        compressed: chunk.compressed,
        encryptionMetadata: chunk.encryptionMetadata,
      };
      
      // 🔍 DEBUG: For chunks with suspicious patterns, log the metadata being sent
      if (chunk.index === 68 || chunk.index === 69 || chunk.index === 70 || 
          chunk.index === 71 || chunk.index === 72 || chunk.index === 73) {
        console.log(`🔍 DEBUG CHUNK ${chunk.index}: Sending metadata:`, metadataToSend);
      }

      this.connection.sendChunk(
        metadataToSend,
        chunk.data
      );

      pendingAcks.add(chunk.index);
      inFlight.add(chunk.index);
      chunkToSend.lastSentAt = Date.now();
    } catch (error) {
      console.error(`Failed to send chunk ${chunk.index}:`, error);

      if (retries < this.MAX_RETRIES) {
        setTimeout(() => {
          chunkToSend.retries++;
          this.sendChunk(fileId, chunkToSend);
        }, this.RETRY_TIMEOUT);
      }
    }
  }

  // ✅ Circuit Breaker Methods
  private canSendViaCircuitBreaker(fileId: string): boolean {
    const breaker = this.circuitBreaker.get(fileId);
    if (!breaker) return true; // First time
    
    if (breaker.state === 'open') {
      // Check if we can transition to half-open
      const timeSinceLastFailure = Date.now() - breaker.lastFailure;
      if (timeSinceLastFailure > this.CIRCUIT_BREAKER_RESET_TIME) {
        console.log(`🟡 Circuit breaker for ${fileId} transitioning to HALF-OPEN`);
        breaker.state = 'half-open';
        breaker.failures = 0;
        return true; // Try again
      }
      return false; // Still open, wait
    }
    
    return true; // Closed or half-open, can send
  }

  private recordCircuitBreakerFailure(fileId: string): void {
    let breaker = this.circuitBreaker.get(fileId);
    if (!breaker) {
      breaker = { failures: 0, state: 'closed', lastFailure: Date.now() };
      this.circuitBreaker.set(fileId, breaker);
    }
    
    breaker.failures++;
    breaker.lastFailure = Date.now();
    
    if (breaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      console.log(`🔴 Circuit breaker for ${fileId} OPENING (${breaker.failures} failures)`);
      breaker.state = 'open';
    }
  }

  private recordCircuitBreakerSuccess(fileId: string): void {
    const breaker = this.circuitBreaker.get(fileId);
    if (breaker && breaker.state === 'half-open') {
      console.log(`🟢 Circuit breaker for ${fileId} CLOSED (success after recovery)`);
      breaker.state = 'closed';
      breaker.failures = 0;
    }
  }

  private emitChunkSkipped(fileId: string, chunkIndex: number): void {
    console.log(`⏭️ Skipping problematic chunk ${chunkIndex}`);
    // Could emit event if needed
  }

  /**
   * Surveiller les chunks qui timeout avec support pour les connexions vivantes
   */
  private startRetryMonitoring(fileId: string): void {
    // ⚡ FIXED: Only create ONE interval per fileId, not multiple
    if (this.activeRetryMonitoring.has(fileId)) {
      console.log(`ℹ️ Retry monitoring already active for ${fileId}`);
      return;
    }

    this.activeRetryMonitoring.add(fileId);
    this.lastHeartbeatAck.set(fileId, Date.now()); // Initialize heartbeat timestamp
    console.log(`🔄 Started retry monitoring for ${fileId}`);

    // ✅ Start sending receiver status updates
    this.startReceiversStatusUpdates(fileId);

    const interval = setInterval(() => {
      const pendingAcks = this.pendingAcks.get(fileId);
      const queue = this.sendQueues.get(fileId);
      const transfer = this.transfers.get(fileId);

      if (!pendingAcks || !queue || !transfer || transfer.status !== 'active') {
        this.clearRetryInterval(fileId);
        return;
      }

      const now = Date.now();
      const lastHeartbeat = this.lastHeartbeatAck.get(fileId) || 0;
      const timeSinceLastHeartbeat = now - lastHeartbeat;
      const isConnectionAlive = timeSinceLastHeartbeat < this.HEARTBEAT_TIMEOUT_THRESHOLD;
      const effectiveTimeout = isConnectionAlive ? this.EXTENDED_RETRY_TIMEOUT : this.RETRY_TIMEOUT;

      pendingAcks.forEach((chunkIndex) => {
        const chunkToSend = queue.find((item) => item.chunk.index === chunkIndex);
        if (!chunkToSend) return;
        
        const timeSinceSent = now - chunkToSend.lastSentAt;

        if (timeSinceSent > effectiveTimeout) {
          // ✅ EXPONENTIAL BACKOFF: Apply backoff delay based on retry count
          const backoffMs = Math.min(60000, 1000 * Math.pow(2, chunkToSend.retries)); // Max 60s
          console.warn(`⏱️ Chunk ${chunkIndex} timeout after ${timeSinceSent}ms (threshold: ${effectiveTimeout}ms, connection: ${isConnectionAlive ? 'alive' : 'dead'}), scheduling retry with ${backoffMs}ms backoff (retry #${chunkToSend.retries})...`);
          
          pendingAcks.delete(chunkIndex);
          const inFlight = this.chunksInFlight.get(fileId);
          if (inFlight) {
            inFlight.delete(chunkIndex);
          }
          
          // Schedule retry with backoff
          setTimeout(() => {
            this.retryChunk(fileId, chunkIndex);
          }, backoffMs);
        }
      });
    }, Math.min(1000, this.RETRY_TIMEOUT / 10)); // Check every 1s or RETRY_TIMEOUT/10, whichever is smaller

    this.retryIntervals.set(fileId, interval);
  }

  /**
   * ✅ Send periodic status updates to receiver
   */
  private startReceiversStatusUpdates(fileId: string): void {
    const interval = setInterval(() => {
      const receivedChunks = this.receivedChunks.get(fileId);
      if (!receivedChunks) return;

      // Convert set to sorted array for compact representation
      const chunksArray = Array.from(receivedChunks).sort((a: number, b: number) => a - b);
      
      this.connection.sendMessage({
        type: 'transfer_status',
        data: {
          fileId,
          receivedCount: chunksArray.length,
          lastReceivedChunk: chunksArray[chunksArray.length - 1] ?? -1,
          receivedChunks: chunksArray, // Full list for verification
        },
      });
    }, this.STATUS_UPDATE_INTERVAL);

    this.statusUpdateIntervals.set(fileId, interval);
  }

  /**
   * Nettoyer l'interval de retry
   */
  private clearRetryInterval(fileId: string): void {
    const interval = this.retryIntervals.get(fileId);
    if (interval) {
      clearInterval(interval);
      this.retryIntervals.delete(fileId);
      this.activeRetryMonitoring.delete(fileId); // ⚡ FIXED: Clear the flag too
    }
  }

  /**
   * Mettre à jour la progression d'envoi
   */
  private updateSendProgress(fileId: string, chunkIndex: number): void {
    const transfer = this.transfers.get(fileId);
    const queue = this.sendQueues.get(fileId);

    if (!transfer || !queue) return;

    const chunksSent = queue.filter((item) => {
      const pendingAcks = this.pendingAcks.get(fileId);
      return !pendingAcks || !pendingAcks.has(item.chunk.index);
    }).length;

    const percentage = (chunksSent / transfer.progress.chunksTotal) * 100;
    const bytesReceived = Math.floor((percentage / 100) * transfer.fileSize);

    const elapsed = (Date.now() - transfer.startedAt.getTime()) / 1000;
    const speed = elapsed > 0 ? bytesReceived / elapsed : 0;
    const bytesRemaining = transfer.fileSize - bytesReceived;
    const eta = speed > 0 ? bytesRemaining / speed : 0;

    transfer.progress = {
      fileId,
      chunksReceived: chunksSent,
      chunksTotal: transfer.progress.chunksTotal,
      bytesReceived,
      bytesTotal: transfer.fileSize,
      percentage: Math.round(percentage * 100) / 100,
      speed: Math.round(speed),
      eta: Math.round(eta),
    };

    this.emitTransferUpdate(transfer);
  }

  /**
   * Compléter un transfert
   */
  private async completeTransfer(fileId: string): Promise<void> {
    console.log(`✅ Transfer completed: ${fileId}`);

    const transfer = this.transfers.get(fileId);
    const chunkManager = this.chunkManagers.get(fileId);

    if (!transfer || !chunkManager) return;

    try {
      if (transfer.direction === 'receive') {
        const decryptionKey = this.decryptionKeys.get(fileId);
        const blob = await chunkManager.assembleFile(decryptionKey);

        // 🔹 CRITICAL FIX #4: Verify final blob size matches expected size
        console.log(`📊 Received blob size: ${blob.size} bytes (expected: ${transfer.fileSize})`);
        if (blob.size !== transfer.fileSize) {
          console.error(`⚠️ SIZE MISMATCH! Received ${blob.size} bytes but expected ${transfer.fileSize} bytes (difference: ${transfer.fileSize - blob.size} bytes)`);
        }

        this.emitTransferComplete(fileId, blob);
      }

      transfer.status = 'completed';
      transfer.completedAt = new Date();
      transfer.progress.percentage = 100;

      this.emitTransferUpdate(transfer);
      
      // Log the transfer completion
      const duration = Math.round((Date.now() - transfer.startedAt.getTime()) / 1000);
      const avgSpeed = transfer.fileSize > 0 ? (transfer.fileSize / (1024 * 1024) / duration) : 0; // Mbps
      
      // Only log if this is the SENDER (to avoid double-logging from both peers)
      if (transfer.direction === 'send') {
        try {
          const currentUser = useAuthStore.getState().user;
          const senderName = currentUser?.name || 'Unknown';
          const receiverName = this.connection['peerName'] || 'Unknown';

          await transferAPI.logTransfer({
            receiverId: transfer.peerId,
            senderName,
            receiverName,
            fileHash: transfer.fileHash || 'unknown',
            fileName: transfer.fileName || 'unknown',
            fileSizeBytes: transfer.fileSize,
            mimeType: transfer.mimeType || 'application/octet-stream',
            transferType: 'P2P_DIRECT',
            status: 'SUCCESS',
            duration,
            avgSpeed: Math.round(avgSpeed * 100) / 100,
            teamId: undefined,
          });
        } catch (logError) {
          console.error('Failed to log transfer:', logError);
          // Continue anyway - logging should not block transfer
        }
      }
      
      this.cleanupTransfer(fileId);
    } catch (error) {
      console.error('Failed to complete transfer:', error);
      transfer.status = 'failed';
      transfer.error = (error as Error).message;
      this.emitTransferUpdate(transfer);
      
      // Log the failed transfer (only if sender to avoid double-logging)
      if (transfer.direction === 'send') {
        const duration = Math.round((Date.now() - transfer.startedAt.getTime()) / 1000);
        try {
          const currentUser = useAuthStore.getState().user;
          const senderName = currentUser?.name || 'Unknown';
          const receiverName = this.connection['peerName'] || 'Unknown';

          await transferAPI.logTransfer({
            receiverId: transfer.peerId,
            senderName,
            receiverName,
            fileHash: transfer.fileHash || 'unknown',
            fileName: transfer.fileName || 'unknown',
            fileSizeBytes: transfer.fileSize,
            mimeType: transfer.mimeType || 'application/octet-stream',
            transferType: 'P2P_DIRECT',
            status: 'FAILED',
            duration,
            avgSpeed: 0,
            errorCode: (error as Error).message,
            teamId: undefined,
          });
        } catch (logError) {
          console.error('Failed to log failed transfer:', logError);
        }
      }
    }
  }

  /**
   * Mettre à jour la progression
   */
  private updateProgress(fileId: string): void {
    const transfer = this.transfers.get(fileId);
    const chunkManager = this.chunkManagers.get(fileId);

    if (!transfer || !chunkManager) return;

    const chunksReceived = chunkManager.getReceivedChunks();
    const percentage = chunkManager.getProgress();
    const bytesReceived = Math.floor((percentage / 100) * transfer.fileSize);

    const elapsed = (Date.now() - transfer.startedAt.getTime()) / 1000;
    const speed = elapsed > 0 ? bytesReceived / elapsed : 0;
    const bytesRemaining = transfer.fileSize - bytesReceived;
    const eta = speed > 0 ? bytesRemaining / speed : 0;

    transfer.progress = {
      fileId,
      chunksReceived,
      chunksTotal: transfer.progress.chunksTotal,
      bytesReceived,
      bytesTotal: transfer.fileSize,
      percentage: Math.round(percentage * 100) / 100,
      speed: Math.round(speed),
      eta: Math.round(eta),
    };

    this.emitTransferUpdate(transfer);
  }

  /**
   * Nettoyer un transfert
   */
  private cleanupTransfer(fileId: string): void {
    const chunkManager = this.chunkManagers.get(fileId);
    if (chunkManager) {
      chunkManager.destroy().catch(console.error);
    }

    this.sendQueues.delete(fileId);
    this.pendingAcks.delete(fileId);
    this.chunksInFlight.delete(fileId);
    this.activeSends.delete(fileId);
    this.chunkManagers.delete(fileId);
    this.transfers.delete(fileId);
    this.decryptionKeys.delete(fileId);
    this.chunkProducersFinished.delete(fileId);
    this.lastHeartbeatAck.delete(fileId);
    this.receivedChunks.delete(fileId);
    this.circuitBreaker.delete(fileId);
    this.problematicChunks.delete(fileId);
    this.originalTotalChunks.delete(fileId); // ✅ CRITICAL FIX #3: Cleanup totalChunks tracking
    this.clearRetryInterval(fileId);
    
    // ✅ Clean up status update interval
    const statusInterval = this.statusUpdateIntervals.get(fileId);
    if (statusInterval) {
      clearInterval(statusInterval);
      this.statusUpdateIntervals.delete(fileId);
    }
  }

  /**
   * Détruire l'engine
   */
  destroy(): void {
    console.log('🔥 Destroying TransferEngine');

    for (const [fileId, transfer] of this.transfers) {
      if (transfer.status === 'active' || transfer.status === 'pending') {
        transfer.status = 'cancelled';
        transfer.error = 'Connection closed';
        this.emitTransferUpdate(transfer);
      }
      this.cleanupTransfer(fileId);
    }

    this.transfers.clear();
    this.chunkManagers.clear();
    this.sendQueues.clear();
    this.pendingAcks.clear();
    this.activeSends.clear();
    this.decryptionKeys.clear();
    this.chunkProducersFinished.clear();

    for (const [fileId, _] of this.retryIntervals) {
      this.clearRetryInterval(fileId);
    }
  }

  /**
   * Utilitaires
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * ✅ NEW: Diagnostic function to trace ACK issues
   */
  getDiagnostics(fileId?: string): any {
    if (fileId) {
      const transfer = this.transfers.get(fileId);
      const pendingAcks = this.pendingAcks.get(fileId);
      const inFlight = this.chunksInFlight.get(fileId);
      const queue = this.sendQueues.get(fileId);
      const receivedChunks = this.receivedChunks.get(fileId);
      
      return {
        fileId,
        transfer: transfer ? {
          status: transfer.status,
          direction: transfer.direction,
          progress: transfer.progress,
        } : null,
        pendingAcksCount: pendingAcks?.size ?? 0,
        pendingAcksIndices: Array.from(pendingAcks ?? new Set()),
        inFlightCount: inFlight?.size ?? 0,
        inFlightIndices: Array.from(inFlight ?? new Set()),
        queueLength: queue?.length ?? 0,
        receivedChunksCount: receivedChunks?.size ?? 0,
        receivedChunksIndices: (Array.from(receivedChunks ?? new Set()) as number[]).sort((a, b) => a - b),
      };
    } else {
      // Return overall diagnostics
      return {
        activeTransfers: this.transfers.size,
        pendingAcksPerFile: Array.from(this.pendingAcks.entries()).map(([fileId, acksSet]) => ({
          fileId,
          count: acksSet.size,
        })),
        inFlightPerFile: Array.from(this.chunksInFlight.entries()).map(([fileId, set]) => ({
          fileId,
          count: set.size,
        })),
      };
    }
  }

  /**
   * ✅ NEW: Log current state for debugging
   */
  logTransferState(fileId: string): void {
    const diag = this.getDiagnostics(fileId);
    console.log('=== TRANSFER STATE DIAGNOSTIC ===');
    console.log(JSON.stringify(diag, null, 2));
    console.log('=== END DIAGNOSTIC ===');
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private emitTransferUpdate(transfer: Transfer): void {
    window.dispatchEvent(new CustomEvent('transfer:update', { detail: transfer }));
  }

  private emitTransferOffer(transfer: Transfer): void {
    window.dispatchEvent(new CustomEvent('transfer:offer', { detail: transfer }));
  }

  private emitTransferComplete(fileId: string, blob: Blob): void {
    window.dispatchEvent(
      new CustomEvent('transfer:complete', { detail: { fileId, blob } })
    );
  }
}