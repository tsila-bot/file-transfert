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
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_TIMEOUT = 5000;
  private readonly MAX_CONCURRENT_CHUNKS = 4;
  private readonly CHUNK_SEND_INTERVAL = 0;
  private readonly MAX_CONCURRENT_TRANSFERS = 3;

  // État des transferts
  private chunkProducersFinished: Set<string> = new Set();

  private startTime: number = 0;
  private bytesTransferred: number = 0;
  private retryIntervals: Map<string, NodeJS.Timeout> = new Map();

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
        const MAX_QUEUE_SIZE = 100; // Limit queued chunks to prevent memory issues
        while (queue.length >= MAX_QUEUE_SIZE) {
          await new Promise(resolve => setTimeout(resolve, 10)); // Wait 10ms
        }

        queue.push({
          chunk,
          retries: 0,
          lastSentAt: 0,
        });

        // Trigger sending as soon as we have chunks available
        this.sendNextChunks(fileId);
      }
    } catch (error) {
      console.error(`❌ Error in chunk producer for ${fileId}:`, error);
      const transfer = this.transfers.get(fileId);
      if (transfer) {
        transfer.status = 'failed';
        this.emitTransferUpdate(transfer);
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
  rejectTransfer(fileId: string, reason?: string): void {
    console.log(`❌ Rejecting transfer: ${fileId}`);

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
      }
      this.cleanupTransfer(data.fileId);
    } else if (data.cancelled === true) {
      console.log(`🛑 Transfer cancelled by peer: ${data.fileId}`);
      const transfer = this.transfers.get(data.fileId);
      if (transfer) {
        transfer.status = 'cancelled';
        this.emitTransferUpdate(transfer);
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
    const { fileId, index, hash, data: chunkData, encryptionMetadata } = data;

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

      try {
        const view = new Uint8Array(arrayBuffer);
        const snippet = Array.from(view.subarray(0, Math.min(8, view.length))).
          map((b) => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`📥 handleChunk ${fileId}#${index}: ${view.byteLength} bytes, first8: ${snippet}`);
      } catch (e) {
        console.log(`📥 handleChunk ${fileId}#${index}: received ${arrayBuffer.byteLength} bytes`);
      }

      await chunkManager.receiveChunk({
        index,
        data: arrayBuffer,
        hash,
        size: arrayBuffer.byteLength,
        encryptionMetadata,
      });

      this.connection.sendMessage({
        type: 'ack',
        data: { fileId, index, received: true, hash },
      });

      this.updateProgress(fileId);

      if (chunkManager.isComplete()) {
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
    
    if (pendingAcks) {
      pendingAcks.delete(index);
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
        }
      }

      this.updateSendProgress(fileId, index);
      this.sendNextChunks(fileId);
    } else {
      console.warn(`❌ Chunk ${index} NACK received, scheduling retry...`);
      // Remove from in-flight so it can be retried
      if (inFlight) {
        inFlight.delete(index);
      }
      this.retryChunk(fileId, index);
    }
  }

  /**
   * Retry d'un chunk qui a échoué
   */
  private retryChunk(fileId: string, chunkIndex: number): void {
    const queue = this.sendQueues.get(fileId);
    if (!queue) return;

    const chunkToRetry = queue.find((item) => item.chunk.index === chunkIndex);

    if (!chunkToRetry) {
      console.error(`Chunk ${chunkIndex} not found in queue`);
      return;
    }

    if (chunkToRetry.retries >= this.MAX_RETRIES) {
      console.error(`Chunk ${chunkIndex} failed after ${this.MAX_RETRIES} retries`);

      const transfer = this.transfers.get(fileId);
      if (transfer) {
        transfer.status = 'failed';
        transfer.error = `Chunk ${chunkIndex} failed after ${this.MAX_RETRIES} retries`;
        this.emitTransferUpdate(transfer);
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

    // schedule sends with small stagger to avoid bursts
    chunksToSend.forEach((chunkToSend, idx) => {
      setTimeout(() => this.sendChunk(fileId, chunkToSend), idx * this.CHUNK_SEND_INTERVAL);
    });
  }

  /**
   * Envoyer un chunk spécifique
   */
  private sendChunk(fileId: string, chunkToSend: ChunkToSend): void {
    const { chunk, retries } = chunkToSend;
    const pendingAcks = this.pendingAcks.get(fileId);
    const inFlight = this.chunksInFlight.get(fileId);

    if (!pendingAcks || !inFlight) return;

    // Prevent sending duplicate chunks
    if (inFlight.has(chunk.index)) {
      console.warn(`⚠️ Chunk ${chunk.index} already in flight, skipping duplicate send`);
      return;
    }

    try {
      console.log(
        `📦 Sending chunk ${chunk.index}/${this.transfers.get(fileId)?.progress.chunksTotal} (retry: ${retries})`
      );

      // Validate chunk data integrity before sending
      if (!chunk.data || chunk.data.byteLength === 0) {
        console.error(`❌ Invalid chunk data for chunk ${chunk.index}`);
        this.retryChunk(fileId, chunk.index);
        return;
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
      } catch (e) {
        console.log(`📤 sendChunk ${fileId}#${chunk.index}: hash: ${chunk.hash}`);
      }

      const transfer = this.transfers.get(fileId);
      const totalChunks = transfer?.progress.chunksTotal || 0;

      this.connection.sendChunk(
        {
          fileId,
          index: chunk.index,
          totalChunks,
          hash: chunk.hash,
          encryptionMetadata: chunk.encryptionMetadata,
        },
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

  /**
   * Surveiller les chunks qui timeout
   */
  private startRetryMonitoring(fileId: string): void {
    this.clearRetryInterval(fileId);

    const interval = setInterval(() => {
      const pendingAcks = this.pendingAcks.get(fileId);
      const queue = this.sendQueues.get(fileId);
      const transfer = this.transfers.get(fileId);

      if (!pendingAcks || !queue || !transfer || transfer.status !== 'active') {
        this.clearRetryInterval(fileId);
        return;
      }

      const now = Date.now();

      pendingAcks.forEach((chunkIndex) => {
        const chunkToSend = queue.find((item) => item.chunk.index === chunkIndex);

        if (chunkToSend && now - chunkToSend.lastSentAt > this.RETRY_TIMEOUT) {
          console.warn(`⏱️ Chunk ${chunkIndex} timeout, retrying...`);
          pendingAcks.delete(chunkIndex);
          const inFlight = this.chunksInFlight.get(fileId);
          if (inFlight) {
            inFlight.delete(chunkIndex);
          }
          this.retryChunk(fileId, chunkIndex);
        }
      });
    }, this.RETRY_TIMEOUT);

    this.retryIntervals.set(fileId, interval);
  }

  /**
   * Nettoyer l'interval de retry
   */
  private clearRetryInterval(fileId: string): void {
    const interval = this.retryIntervals.get(fileId);
    if (interval) {
      clearInterval(interval);
      this.retryIntervals.delete(fileId);
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

        this.emitTransferComplete(fileId, blob);
      }

      transfer.status = 'completed';
      transfer.completedAt = new Date();
      transfer.progress.percentage = 100;

      this.emitTransferUpdate(transfer);
      this.cleanupTransfer(fileId);
    } catch (error) {
      console.error('Failed to complete transfer:', error);
      transfer.status = 'failed';
      transfer.error = (error as Error).message;
      this.emitTransferUpdate(transfer);
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
    this.clearRetryInterval(fileId);
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