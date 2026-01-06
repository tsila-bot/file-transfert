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
  saveResumeTransferState,
  getMissingChunks,
  markTransferAsResuming,
  listIncompleteTransfers,
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
  private activeSends: Set<string> = new Set();
  // Buffer for chunks received before metadata/transfer is initialized
  private pendingChunkBuffer: Map<string, any[]> = new Map();

  // Configuration
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_TIMEOUT = 5000;
  private readonly MAX_CONCURRENT_CHUNKS = 5;
  private readonly CHUNK_SEND_INTERVAL = 50;
  private readonly MAX_CONCURRENT_TRANSFERS = 3;

  // Propriétés pour la reprise
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: number = Date.now();
  private autoSaveCounter: number = 0;
  private isConnectionHealthy: boolean = true;

  // Configuration de la reprise
  private readonly HEARTBEAT_INTERVAL = 5000;
  private readonly HEARTBEAT_TIMEOUT = 15000;
  private readonly AUTO_SAVE_EVERY = 10;
  private readonly MAX_RESUME_ATTEMPTS = 3;

  // État des transferts en cours de reprise
  private resumingTransfers: Set<string> = new Set();

  private startTime: number = 0;
  private bytesTransferred: number = 0;
  private retryIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(connection: PeerConnection) {
    this.connection = connection;
    this.setupHandlers();
    this.startHeartbeatMonitoring();
    this.setupConnectionMonitoring();
  }

  /**
   * Démarrer la surveillance du heartbeat
   */
  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL);

    setInterval(() => {
      this.checkHeartbeatTimeout();
    }, 1000);
  }

  /**
   * Configurer la surveillance de la connexion
   */
  private setupConnectionMonitoring(): void {
    this.connection.on('statechange', (state: ConnectionState) => {
      if (state === 'connected') {
        this.handleConnectionRestored();
      } else if (state === 'disconnected' || state === 'failed') {
        this.handleConnectionLoss();
      }
    });

    window.addEventListener('beforeunload', () => {
      this.handlePageUnload();
    });

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Envoyer un heartbeat au pair
   */
  private sendHeartbeat(): void {
    if (!this.connection.isConnected()) return;

    this.connection.sendMessage({
      type: 'heartbeat',
      data: {
        timestamp: Date.now(),
        transferIds: Array.from(this.transfers.keys()).filter((id) =>
          ['active', 'pending'].includes(this.transfers.get(id)?.status || '')
        ),
      },
    });

    this.lastHeartbeat = Date.now();
  }

  /**
   * Vérifier si le heartbeat a timeout
   */
  private checkHeartbeatTimeout(): void {
    const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;

    if (timeSinceLastHeartbeat > this.HEARTBEAT_TIMEOUT && this.isConnectionHealthy) {
      console.warn('⚠️ Heartbeat timeout detected, connection may be lost');
      this.isConnectionHealthy = false;
      this.handleConnectionLoss();
    }
  }

  /**
   * Gérer la réception d'un heartbeat
   */
  private handleHeartbeat(data: any): void {
    this.lastHeartbeat = Date.now();

    if (!this.isConnectionHealthy) {
      this.isConnectionHealthy = true;
      console.log('✅ Connection restored');
    }

    this.connection.sendMessage({
      type: 'heartbeat_ack',
      data: {
        timestamp: data.timestamp,
        received: true,
      },
    });

    if (data.transferIds && Array.isArray(data.transferIds)) {
      this.syncTransferStates(data.transferIds);
    }
  }

  /**
   * Synchroniser les états des transferts avec le pair
   */
  private async syncTransferStates(peerTransferIds: string[]): Promise<void> {
    for (const transferId of peerTransferIds) {
      const ourState = await getTransferState(transferId);
      if (ourState && ourState.transfer.status === 'active') {
        this.connection.sendMessage({
          type: 'transfer_sync',
          data: {
            transferId,
            receivedChunks: ourState.receivedChunks,
            progress: ourState.transfer.progress.percentage,
          },
        });
      }
    }
  }

  /**
   * Gérer la perte de connexion
   */
  private async handleConnectionLoss(): Promise<void> {
    console.warn('🔌 Connection loss detected, saving transfer states...');

    await this.saveAllActiveTransfers();

    window.dispatchEvent(new CustomEvent('connection:lost'));

    for (const [transferId, transfer] of this.transfers) {
      if (transfer.status === 'active') {
        transfer.status = 'paused';
        this.emitTransferUpdate(transfer);
      }
    }
  }

  /**
   * Gérer la restauration de la connexion
   */
  private async handleConnectionRestored(): Promise<void> {
    console.log('🔄 Connection restored, checking for incomplete transfers...');

    const peerId = this.connection['peerId'];
    const incompleteTransfers = await this.getIncompleteTransfersForPeer(peerId);

    if (incompleteTransfers.length > 0) {
      console.log(`📋 Found ${incompleteTransfers.length} incomplete transfers for ${peerId}`);

      window.dispatchEvent(
        new CustomEvent('transfers:resume:available', {
          detail: {
            peerId,
            peerName: this.connection['peerName'],
            transfers: incompleteTransfers,
          },
        })
      );
    }
  }

  /**
   * Gérer la fermeture de la page
   */
  private async handlePageUnload(): Promise<void> {
    for (const [transferId, transfer] of this.transfers) {
      if (transfer.status === 'active') {
        await this.saveTransferProgress(transferId);
      }
    }

    console.log('💾 Transfer states saved before page unload');
  }

  /**
   * Gérer le changement de visibilité
   */
  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      console.log('📱 App going to background, saving states...');
      this.saveAllActiveTransfers().catch(console.error);
    }
  };

  /**
   * Sauvegarder tous les transferts actifs
   */
  private async saveAllActiveTransfers(): Promise<void> {
    const savePromises: Promise<void>[] = [];

    for (const [transferId, transfer] of this.transfers) {
      if (transfer.status === 'active') {
        savePromises.push(this.saveTransferProgress(transferId));
      }
    }

    await Promise.allSettled(savePromises);
    console.log(`💾 Saved ${savePromises.length} active transfers`);
  }

  /**
   * Sauvegarder la progression d'un transfert spécifique
   */
  private async saveTransferProgress(fileId: string): Promise<void> {
    const transfer = this.transfers.get(fileId);
    const chunkManager = this.chunkManagers.get(fileId);

    if (!transfer || !chunkManager) return;

    try {
      const receivedChunks: number[] = [];
      const bitmap = chunkManager['bitmap'] || [];

      for (let i = 0; i < bitmap.length; i++) {
        if (bitmap[i]) {
          receivedChunks.push(i);
        }
      }

      const metadata = {
        ...transfer,
        savedAt: Date.now(),
        connectionInfo: {
          peerId: this.connection['peerId'],
          peerName: this.connection['peerName'],
        },
        chunkManagerState: {
          totalChunks: bitmap.length,
          receivedCount: receivedChunks.length,
        },
      };

      await saveResumeTransferState(fileId, {
        transfer,
        receivedChunks,
        lastUpdated: Date.now(),
        connectionInfo: {
          peerId: this.connection['peerId'],
          peerName: this.connection['peerName'],
        },
        metadata,
      });

      console.log(`💾 Progress saved for ${fileId}: ${receivedChunks.length}/${bitmap.length} chunks`);
    } catch (error) {
      console.error(`Failed to save progress for ${fileId}:`, error);
    }
  }

  /**
   * Incrémenter le compteur de sauvegarde automatique
   */
  private incrementAutoSave(fileId: string): void {
    this.autoSaveCounter++;

    if (this.autoSaveCounter >= this.AUTO_SAVE_EVERY) {
      this.autoSaveCounter = 0;
      this.saveTransferProgress(fileId).catch(console.error);
    }
  }

  /**
   * Obtenir les transferts incomplets pour un pair spécifique
   */
  private async getIncompleteTransfersForPeer(peerId: string): Promise<any[]> {
    const incompleteStates = await listIncompleteTransfers();

    return incompleteStates
      .filter((state) => state.transfer.peerId === peerId)
      .map((state) => ({
        id: state.transfer.id,
        fileName: state.transfer.fileName,
        fileSize: state.transfer.fileSize,
        progress: {
          received: state.receivedChunks.length,
          total: state.transfer.progress.chunksTotal || 0,
          percentage: state.transfer.progress.percentage,
        },
        lastUpdated: state.lastUpdated,
      }));
  }

  /**
   * Reprendre un transfert depuis un état sauvegardé
   */
  async resumeTransfer(fileId: string): Promise<boolean> {
    try {
      console.log(`🔄 Attempting to resume transfer: ${fileId}`);

      if (this.transfers.has(fileId) || this.resumingTransfers.has(fileId)) {
        console.warn(`Transfer ${fileId} is already active or resuming`);
        return false;
      }

      this.resumingTransfers.add(fileId);
      await markTransferAsResuming(fileId);

      const savedState = await getTransferState(fileId);
      if (!savedState) {
        throw new Error(`No saved state found for transfer: ${fileId}`);
      }

      const { transfer, receivedChunks } = savedState;

      if (transfer.peerId !== this.connection['peerId']) {
        throw new Error(
          `Peer mismatch: saved peer ${transfer.peerId}, current peer ${this.connection['peerId']}`
        );
      }

      const chunkManager = new ChunkManager();

      const metadata = chunkManager['metadata'];
      if (metadata) {
        chunkManager.setMetadata(metadata);
      }

      const bitmap = chunkManager['bitmap'] || [];
      for (const chunkIndex of receivedChunks) {
        if (chunkIndex < bitmap.length) {
          bitmap[chunkIndex] = true;
        }
      }

      this.chunkManagers.set(fileId, chunkManager);

      const resumedTransfer: Transfer = {
        ...transfer,
        status: 'active' as const,
      };

      // Incrémenter le compteur de reprise dans les métadonnées

      if (!resumedTransfer.resumeMetadata) {
        resumedTransfer.resumeMetadata = {};
      }
      resumedTransfer.resumeMetadata.resumedAt = new Date();
      resumedTransfer.resumeMetadata.resumeCount = (transfer.resumeMetadata?.resumeCount || 0) + 1;

      this.transfers.set(fileId, resumedTransfer);

      if (transfer.direction === 'send') {
        await this.resumeSending(fileId, receivedChunks);
      }

      if (transfer.direction === 'receive') {
        await this.requestMissingChunks(fileId, receivedChunks);
      }

      window.dispatchEvent(
        new CustomEvent('transfer:resumed', {
          detail: { fileId, transfer: resumedTransfer },
        })
      );

      console.log(`✅ Transfer resumed: ${fileId}`);
      return true;
    } catch (error) {
      console.error(`Failed to resume transfer ${fileId}:`, error);
      this.resumingTransfers.delete(fileId);
      return false;
    }
  }

  /**
   * Reprendre l'envoi depuis un point donné
   */
  private async resumeSending(fileId: string, alreadySentChunks: number[]): Promise<void> {
    const queue = this.sendQueues.get(fileId);
    if (!queue) return;

    const chunksToSend = queue.filter(
      (chunk) => !alreadySentChunks.includes(chunk.chunk.index)
    );

    this.sendQueues.set(fileId, chunksToSend);
    this.pendingAcks.set(fileId, new Set());

    this.startSending(fileId);
  }

  /**
   * Demander les chunks manquants au pair
   */
  private async requestMissingChunks(
    fileId: string,
    receivedChunks: number[]
  ): Promise<void> {
    const transfer = this.transfers.get(fileId);
    if (!transfer) return;

    const totalChunks = transfer.progress.chunksTotal || 0;
    const missingChunks: number[] = [];

    for (let i = 0; i < totalChunks; i++) {
      if (!receivedChunks.includes(i)) {
        missingChunks.push(i);
      }
    }

    if (missingChunks.length === 0) {
      console.log(`✅ All chunks already received for ${fileId}`);
      return;
    }

    console.log(`📋 Requesting ${missingChunks.length} missing chunks for ${fileId}`);

    this.connection.sendMessage({
      type: 'resume_request',
      data: {
        fileId,
        missingChunks,
        receivedChunks,
      },
    });
  }

  /**
   * Gérer une demande de reprise
   */
  private async handleResumeRequest(data: any): Promise<void> {
    const { fileId, missingChunks, receivedChunks } = data;

    console.log(`📥 Resume request for ${fileId}, missing ${missingChunks.length} chunks`);

    const transfer = this.transfers.get(fileId);
    const chunkManager = this.chunkManagers.get(fileId);

    if (!transfer || !chunkManager) {
      console.warn(`Cannot resume ${fileId}: transfer not found`);
      return;
    }

    const bitmap = chunkManager['bitmap'] || [];
    for (let i = 0; i < bitmap.length; i++) {
      bitmap[i] = receivedChunks.includes(i);
    }

    if (transfer.direction === 'send') {
      await this.resumeSending(fileId, receivedChunks);
    }

    this.connection.sendMessage({
      type: 'resume_ack',
      data: { fileId, accepted: true },
    });
  }

  /**
   * Gérer la synchronisation des transferts
   */
  private handleTransferSync(data: any): void {
    const { transferId, receivedChunks, progress } = data;

    console.log(`🔄 Transfer sync received for ${transferId}: ${progress}% complete`);

    const chunkManager = this.chunkManagers.get(transferId);
    if (chunkManager && Array.isArray(receivedChunks)) {
      const bitmap = chunkManager['bitmap'] || [];
      receivedChunks.forEach((chunkIndex: number) => {
        if (chunkIndex < bitmap.length) {
          bitmap[chunkIndex] = true;
        }
      });
    }
  }

  /**
   * Gérer l'ack de reprise
   */
  private handleResumeAck(data: any): void {
    const { fileId, accepted } = data;

    if (accepted) {
      console.log(`✅ Resume accepted for ${fileId}`);
      this.resumingTransfers.delete(fileId);
    } else {
      console.warn(`❌ Resume rejected for ${fileId}`);
      this.resumingTransfers.delete(fileId);

      const transfer = this.transfers.get(fileId);
      if (transfer) {
        transfer.status = 'failed';
        transfer.error = 'Resume rejected by peer';
        this.emitTransferUpdate(transfer);
      }
    }
  }

  /**
   * Initier un transfert de fichier
   */
  async sendFile(
    file: File,
    options?: { encrypt?: boolean; password?: string }
  ): Promise<string> {
    console.log(`📤 Starting file transfer: ${file.name}`);

    const activeCount = this.getActiveTransfersCount();
    if (activeCount >= this.MAX_CONCURRENT_TRANSFERS) {
      throw new Error(
        `Maximum concurrent transfers (${this.MAX_CONCURRENT_TRANSFERS}) reached. Please wait for one to complete.`
      );
    }

    const chunkManager = new ChunkManager();
    const { chunks, metadata } = await chunkManager.splitFile(file, options);

    this.chunkManagers.set(metadata.fileId, chunkManager);

    const chunkQueue: ChunkToSend[] = chunks.map((chunk) => ({
      chunk,
      retries: 0,
      lastSentAt: 0,
    }));
    this.sendQueues.set(metadata.fileId, chunkQueue);
    this.pendingAcks.set(metadata.fileId, new Set());

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

    this.connection.on('chunk', (data: any) => {
      this.handleChunk(data);
    });

    this.connection.on('ack', (data: ChunkAck) => {
      this.handleAck(data);
    });

    this.connection.on('binarydata', (data: ArrayBuffer) => {
      this.handleBinaryData(data);
    });

    this.connection.on('heartbeat', (data: any) => {
      this.handleHeartbeat(data);
    });

    this.connection.on('heartbeat_ack', (data: any) => {
      this.lastHeartbeat = Date.now();
    });

    this.connection.on('transfer_sync', (data: any) => {
      this.handleTransferSync(data);
    });

    this.connection.on('resume_request', (data: any) => {
      this.handleResumeRequest(data);
    });

    this.connection.on('resume_ack', (data: any) => {
      this.handleResumeAck(data);
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
      const arrayBuffer =
        typeof chunkData === 'string'
          ? this.base64ToArrayBuffer(chunkData)
          : chunkData;

      try {
        const view = new Uint8Array(arrayBuffer);
        const snippet = Array.from(view.subarray(0, Math.min(8, view.length))).
          map((b) => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`📥 handleChunk ${fileId}#${index}: ${view.byteLength} bytes, first8: ${snippet} (base64=${typeof chunkData === 'string'})`);
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

      this.incrementAutoSave(fileId);
      this.updateProgress(fileId);

      if (chunkManager.isComplete()) {
        await this.completeTransfer(fileId);
      }
    } catch (error) {
      console.error(`Failed to receive chunk ${index}:`, error);
      this.saveTransferProgress(fileId).catch(console.error);

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
    if (pendingAcks) {
      pendingAcks.delete(index);
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

      this.incrementAutoSave(fileId);
      this.updateSendProgress(fileId, index);
      this.sendNextChunks(fileId);
    } else {
      console.warn(`❌ Chunk ${index} NACK received, scheduling retry...`);
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
    const canSend = this.MAX_CONCURRENT_CHUNKS - inFlight;

    if (canSend <= 0) {
      return;
    }

    const chunksToSend = queue
      .filter((item) => !pendingAcks.has(item.chunk.index))
      .slice(0, canSend);

    if (chunksToSend.length === 0) {
      if (pendingAcks.size === 0) {
        await this.completeTransfer(fileId);
      }
      return;
    }

    for (let i = 0; i < chunksToSend.length; i++) {
      const chunkToSend = chunksToSend[i];

      if (i > 0) {
        await this.sleep(this.CHUNK_SEND_INTERVAL);
      }

      this.sendChunk(fileId, chunkToSend);
    }
  }

  /**
   * Envoyer un chunk spécifique
   */
  private sendChunk(fileId: string, chunkToSend: ChunkToSend): void {
    const { chunk, retries } = chunkToSend;
    const pendingAcks = this.pendingAcks.get(fileId);

    if (!pendingAcks) return;

    try {
      console.log(
        `📦 Sending chunk ${chunk.index}/${this.transfers.get(fileId)?.progress.chunksTotal} (retry: ${retries})`
      );

      // Throttle if data channel buffer is too high to avoid SCTP send failures
      try {
        const buffered = (this.connection as any).getBufferedAmount?.();
        const BUFFER_LIMIT = 2 * 1024 * 1024; // 2 MB
        if (typeof buffered === 'number' && buffered > BUFFER_LIMIT) {
          console.warn(`⚠️ Data channel bufferedAmount ${buffered} > ${BUFFER_LIMIT}, delaying send`);
          setTimeout(() => this.sendChunk(fileId, chunkToSend), 200);
          return;
        }
      } catch (err) {
        // ignore if feature not available
      }

      try {
        const view = new Uint8Array(chunk.data);
        const snippet = Array.from(view.subarray(0, Math.min(8, view.length))).
          map((b) => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`📤 sendChunk ${fileId}#${chunk.index}: ${view.byteLength} bytes, first8: ${snippet}`);
      } catch (e) {
        console.log(`📤 sendChunk ${fileId}#${chunk.index}`);
      }

      const base64Data = this.arrayBufferToBase64(chunk.data);

      this.connection.sendMessage({
        type: 'chunk',
        data: {
          fileId,
          index: chunk.index,
          hash: chunk.hash,
          data: base64Data,
          encryptionMetadata: chunk.encryptionMetadata,
        },
      });

      pendingAcks.add(chunk.index);
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
    this.sendQueues.delete(fileId);
    this.pendingAcks.delete(fileId);
    this.activeSends.delete(fileId);
    this.chunkManagers.delete(fileId);
    this.decryptionKeys.delete(fileId);
    this.clearRetryInterval(fileId);
  }

  /**
   * Détruire l'engine
   */
  destroy(): void {
    console.log('🔥 Destroying TransferEngine with resume support');

    this.saveAllActiveTransfers().catch(console.error);

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    window.removeEventListener('beforeunload', this.handlePageUnload);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

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