// lib/storage/indexeddb.ts

import { Transfer } from '@/types/transfer.types';

const DB_NAME = 'P2PTransferDB';
const DB_VERSION = 3;
const STORE_NAME = 'transfers';
const CHUNKS_STORE_NAME = 'chunks';

/**
 * État d'un transfert sauvegardé
 */
export interface TransferState {
  transfer: Transfer;
  receivedChunks: number[];
  lastUpdated: number;
  metadata?: any;
}

/**
 * État détaillé d'un transfert pour la reprise
 */
export interface ResumeTransferState extends TransferState {
  chunkData?: Map<number, ArrayBuffer>;
  connectionInfo: {
    peerId: string;
    peerName: string;
    peerAddress?: string;
  };
  encryptionInfo?: {
    isEncrypted: boolean;
    keyId?: string;
    algorithm?: string;
  };
}

/**
 * Statistiques des transferts
 */
export interface TransferStats {
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
  inProgress: number;
  paused: number;
  totalBytes: number;
  completedBytes: number;
}

/**
 * Options de nettoyage
 */
export interface CleanupOptions {
  daysOld?: number;
  includeCompleted?: boolean;
  includeFailed?: boolean;
  includeCancelled?: boolean;
}

/**
 * Classe pour gérer IndexedDB
 */
class IndexedDBStorage {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initialiser la base de données
   */
  async initDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      const handleUpgrade = (event: any) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        console.log(`🔄 Upgrading IndexedDB from v${oldVersion} to v${DB_VERSION}`);

        if (oldVersion < 1) {
          this.createStoresV1(db);
        }

        if (oldVersion < 2) {
          this.migrateToV2(db);
        }

        if (oldVersion < 3) {
          this.migrateToV3(db);
        }
      };

      request.onupgradeneeded = handleUpgrade;

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB opened successfully');
        resolve(this.db);
      };

      request.onerror = () => {
        const msg = request.error?.message || '';
        const name = request.error?.name || '';
        const error = new Error(
          `Failed to open IndexedDB: ${msg || 'Unknown error'}`
        );
        console.error('❌', error);

        // If the requested version is less than the existing version, open without specifying version.
        if (name === 'VersionError' || /less than the existing version/i.test(msg)) {
          console.warn('⚠️ IndexedDB version mismatch — opening existing DB without upgrade');
          const fallback = indexedDB.open(DB_NAME);

          fallback.onsuccess = () => {
            this.db = fallback.result;
            console.log('✅ IndexedDB opened (fallback) successfully');
            resolve(this.db);
          };

          fallback.onerror = () => {
            const ferr = new Error(
              `Failed to open fallback IndexedDB: ${fallback.error?.message || 'Unknown error'}`
            );
            console.error('❌', ferr);
            reject(ferr);
          };

          fallback.onupgradeneeded = (ev) => {
            // No-op: we are intentionally not upgrading when opening fallback
            console.log('ℹ️ Fallback open: skipping upgrade');
          };

          return;
        }

        reject(error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Migration vers version 3: ajouter le store `received_files` pour stocker les fichiers reçus entiers
   */
  private migrateToV3(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains('received_files')) {
      const store = db.createObjectStore('received_files', { keyPath: 'id' });
      store.createIndex('transferId', 'transferId', { unique: false });
      console.log('✅ received_files store created (v3)');
    }
  }

  /**
   * Créer les stores version 1
   */
  private createStoresV1(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      const transferStore = db.createObjectStore(STORE_NAME, {
        keyPath: 'transfer.id',
      });

      transferStore.createIndex('status', 'transfer.status', {
        unique: false,
      });

      transferStore.createIndex('peerId', 'transfer.peerId', {
        unique: false,
      });

      transferStore.createIndex('lastUpdated', 'lastUpdated', {
        unique: false,
      });

      console.log('✅ Transfer store created (v1)');
    }

    if (!db.objectStoreNames.contains(CHUNKS_STORE_NAME)) {
      const chunkStore = db.createObjectStore(CHUNKS_STORE_NAME, {
        keyPath: ['transferId', 'chunkIndex'],
      });

      chunkStore.createIndex('transferId', 'transferId', {
        unique: false,
      });

      console.log('✅ Chunks store created (v1)');
    }
  }

  /**
   * Migration vers version 2
   */
  private migrateToV2(db: IDBDatabase): void {
    const transaction = (db as any).transaction;
    if (transaction && db.objectStoreNames.contains(STORE_NAME)) {
      console.log('✅ Migrated to v2 (no structural changes)');
    }
  }

  /**
   * Valider un objet Transfer
   */
  private validateTransfer(transfer: Transfer): void {
    if (!transfer) {
      throw new Error('Transfer object is required');
    }
    if (!transfer.id || typeof transfer.id !== 'string') {
      throw new Error('Transfer ID is required and must be a string');
    }
    if (!transfer.fileName || typeof transfer.fileName !== 'string') {
      throw new Error('Transfer fileName is required');
    }
    if (typeof transfer.fileSize !== 'number' || transfer.fileSize < 0) {
      throw new Error('Transfer fileSize must be a positive number');
    }
  }

  /**
   * Dédupliquer et trier les chunks
   */
  private normalizeChunks(chunks: number[]): number[] {
    return [...new Set(chunks)].sort((a, b) => a - b);
  }

  /**
   * Sauvegarder l'état d'un transfert
   */
  async saveTransferState(
    transfer: Transfer,
    receivedChunks: number[] = [],
    metadata?: any
  ): Promise<void> {
    this.validateTransfer(transfer);
    const normalizedChunks = this.normalizeChunks(receivedChunks);
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const transferState: TransferState = {
          transfer,
          receivedChunks: normalizedChunks,
          lastUpdated: Date.now(),
          metadata,
        };

        const request = store.put(transferState);

        request.onsuccess = () => {
          console.log(
            `💾 Transfer saved: ${transfer.id} (${normalizedChunks.length} chunks)`
          );
          resolve();
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to save transfer: ${request.error?.message || 'Unknown error'}`
          );
          console.error('❌', error);
          reject(error);
        };
      } catch (error) {
        console.error('❌ Transaction error:', error);
        reject(error);
      }
    });
  }

  /**
   * Sauvegarder l'état complet d'un transfert pour reprise
   */
  async saveResumeTransferState(
    transferId: string,
    state: ResumeTransferState
  ): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Convertir Map en tableau pour IndexedDB
      const serializableState = {
        ...state,
        chunkData: state.chunkData
          ? Array.from(state.chunkData.entries())
          : undefined,
      };

      const request = store.put(serializableState);

      request.onsuccess = () => {
        console.log(`💾 Resume state saved for: ${transferId}`);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupérer l'état d'un transfert
   */
  async getTransferState(transferId: string): Promise<TransferState | null> {
    if (!transferId || typeof transferId !== 'string') {
      throw new Error('Valid transfer ID is required');
    }

    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(transferId);

        request.onsuccess = () => {
          const result = request.result as TransferState | undefined;
          if (result) {
            console.log(`📥 Transfer loaded: ${transferId}`);
          }
          resolve(result || null);
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to get transfer: ${request.error?.message || 'Unknown error'}`
          );
          console.error('❌', error);
          reject(error);
        };
      } catch (error) {
        console.error('❌ Transaction error:', error);
        reject(error);
      }
    });
  }

  /**
   * Obtenir les chunks manquants d'un transfert
   */
  async getMissingChunks(transferId: string): Promise<number[]> {
    const state = await this.getTransferState(transferId);
    if (!state) return [];

    const totalChunks = state.transfer.progress.chunksTotal || 0;
    const received = state.receivedChunks || [];

    const missing: number[] = [];
    for (let i = 0; i < totalChunks; i++) {
      if (!received.includes(i)) {
        missing.push(i);
      }
    }

    return missing;
  }

  /**
   * Obtenir le pourcentage de complétion d'un transfert
   */
  async getTransferCompletion(transferId: string): Promise<number> {
    const state = await this.getTransferState(transferId);
    if (!state) return 0;

    const totalChunks = state.transfer.progress.chunksTotal || 0;
    const received = state.receivedChunks?.length || 0;

    if (totalChunks === 0) return 0;
    return Math.round((received / totalChunks) * 100);
  }

  /**
   * Marquer un transfert comme reprise en cours
   */
  async markTransferAsResuming(transferId: string): Promise<void> {
    const state = await this.getTransferState(transferId);
    if (!state) return;

    state.metadata = {
      ...state.metadata,
      resuming: true,
      resumeAttempts: (state.metadata?.resumeAttempts || 0) + 1,
      lastResumeAttempt: Date.now(),
    };

    await this.saveTransferState(
      state.transfer,
      state.receivedChunks,
      state.metadata
    );
  }

  /**
   * Nettoyer les transferts abandonnés
   */
  async cleanupAbandonedTransfers(maxAgeHours: number = 24): Promise<number> {
    const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000;
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('lastUpdated');
      const range = IDBKeyRange.upperBound(cutoffTime);

      let deletedCount = 0;
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const state = cursor.value as TransferState;
          const status = state.transfer.status;

          if (
            status !== 'completed' &&
            status !== 'failed' &&
            status !== 'cancelled'
          ) {
            cursor.delete();
            deletedCount++;
            console.log(`🧹 Cleaned up abandoned transfer: ${state.transfer.id}`);
          }

          cursor.continue();
        } else {
          console.log(`✅ Cleaned ${deletedCount} abandoned transfers`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Supprimer l'état d'un transfert
   */
  async deleteTransferState(transferId: string): Promise<void> {
    if (!transferId || typeof transferId !== 'string') {
      throw new Error('Valid transfer ID is required');
    }

    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(transferId);

        request.onsuccess = () => {
          console.log(`🗑️ Transfer deleted: ${transferId}`);
          resolve();
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to delete transfer: ${request.error?.message || 'Unknown error'}`
          );
          console.error('❌', error);
          reject(error);
        };
      } catch (error) {
        console.error('❌ Transaction error:', error);
        reject(error);
      }
    });
  }

  /**
   * Lister tous les transferts incomplets
   */
  async listIncompleteTransfers(): Promise<TransferState[]> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          const allStates = request.result as TransferState[];

          const incompleteStates = allStates.filter((state) => {
            const status = state.transfer.status;
            return (
              status === 'active' ||
              status === 'paused' ||
              status === 'pending'
            );
          });

          console.log(`📋 Found ${incompleteStates.length} incomplete transfers`);
          resolve(incompleteStates);
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to list incomplete transfers: ${request.error?.message || 'Unknown error'}`
          );
          console.error('❌', error);
          reject(error);
        };
      } catch (error) {
        console.error('❌ Transaction error:', error);
        reject(error);
      }
    });
  }

  /**
   * Lister tous les transferts
   */
  async listAllTransfers(): Promise<TransferState[]> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          const allStates = request.result as TransferState[];
          console.log(`📋 Found ${allStates.length} total transfers`);
          resolve(allStates);
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to list all transfers: ${request.error?.message || 'Unknown error'}`
          );
          console.error('❌', error);
          reject(error);
        };
      } catch (error) {
        console.error('❌ Transaction error:', error);
        reject(error);
      }
    });
  }

  /**
   * Obtenir des statistiques sur les transferts
   */
  async getTransferStats(): Promise<TransferStats> {
    const allTransfers = await this.listAllTransfers();

    const stats: TransferStats = {
      total: allTransfers.length,
      completed: 0,
      failed: 0,
      cancelled: 0,
      inProgress: 0,
      paused: 0,
      totalBytes: 0,
      completedBytes: 0,
    };

    allTransfers.forEach((state) => {
      const transfer = state.transfer;
      const fileSize = transfer.fileSize || 0;
      const progress = transfer.progress;
      const bytesReceived = progress?.bytesReceived || 0;

      stats.totalBytes += fileSize;

      switch (transfer.status) {
        case 'completed':
          stats.completed++;
          stats.completedBytes += fileSize;
          break;
        case 'failed':
          stats.failed++;
          stats.completedBytes += bytesReceived;
          break;
        case 'cancelled':
          stats.cancelled++;
          stats.completedBytes += bytesReceived;
          break;
        case 'active':
          stats.inProgress++;
          stats.completedBytes += bytesReceived;
          break;
        case 'paused':
          stats.paused++;
          stats.completedBytes += bytesReceived;
          break;
      }
    });

    console.log('📊 Transfer stats:', stats);
    return stats;
  }

  /**
   * Rechercher des transferts par statut
   */
  async getTransfersByStatus(
    status: Transfer['status']
  ): Promise<TransferState[]> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('status');
        const request = index.getAll(status);

        request.onsuccess = () => {
          const states = request.result as TransferState[];
          console.log(`🔍 Found ${states.length} transfers with status: ${status}`);
          resolve(states);
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to get transfers by status: ${request.error?.message || 'Unknown error'}`
          );
          console.error('❌', error);
          reject(error);
        };
      } catch (error) {
        console.error('❌ Transaction error:', error);
        reject(error);
      }
    });
  }

  /**
   * Rechercher des transferts par peer
   */
  async getTransfersByPeer(peerId: string): Promise<TransferState[]> {
    if (!peerId || typeof peerId !== 'string') {
      throw new Error('Valid peer ID is required');
    }

    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('peerId');
        const request = index.getAll(peerId);

        request.onsuccess = () => {
          const states = request.result as TransferState[];
          console.log(`🔍 Found ${states.length} transfers for peer: ${peerId}`);
          resolve(states);
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to get transfers by peer: ${request.error?.message || 'Unknown error'}`
          );
          console.error('❌', error);
          reject(error);
        };
      } catch (error) {
        console.error('❌ Transaction error:', error);
        reject(error);
      }
    });
  }

  /**
   * Sauvegarder un chunk reçu
   */
  async saveChunk(
    transferId: string,
    chunkIndex: number,
    chunkData: ArrayBuffer
  ): Promise<void> {
    if (!transferId || typeof transferId !== 'string') {
      throw new Error('Valid transfer ID is required');
    }
    if (typeof chunkIndex !== 'number' || chunkIndex < 0) {
      throw new Error('Valid chunk index is required');
    }
    if (!(chunkData instanceof ArrayBuffer)) {
      throw new Error('Chunk data must be an ArrayBuffer');
    }

    if (chunkData.byteLength > 5 * 1024 * 1024) {
      console.warn('⚠️ Large chunk detected. Consider using memory storage instead.');
    }

    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([CHUNKS_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CHUNKS_STORE_NAME);

        const chunk = {
          transferId,
          chunkIndex,
          data: chunkData,
          timestamp: Date.now(),
        };

        const request = store.put(chunk);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to save chunk: ${request.error?.message || 'Unknown error'}`
          );
          console.error('❌', error);
          reject(error);
        };
      } catch (error) {
        console.error('❌ Transaction error:', error);
        reject(error);
      }
    });
  }

  /**
   * Récupérer un chunk
   */
  async getChunk(
    transferId: string,
    chunkIndex: number
  ): Promise<ArrayBuffer | null> {
    if (!transferId || typeof transferId !== 'string') {
      throw new Error('Valid transfer ID is required');
    }
    if (typeof chunkIndex !== 'number' || chunkIndex < 0) {
      throw new Error('Valid chunk index is required');
    }

    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([CHUNKS_STORE_NAME], 'readonly');
        const store = transaction.objectStore(CHUNKS_STORE_NAME);
        const request = store.get([transferId, chunkIndex]);

        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result.data : null);
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to get chunk: ${request.error?.message || 'Unknown error'}`
          );
          console.error('❌', error);
          reject(error);
        };
      } catch (error) {
        console.error('❌ Transaction error:', error);
        reject(error);
      }
    });
  }

  /**
   * Supprimer tous les chunks d'un transfert
   */
  async deleteChunks(transferId: string): Promise<number> {
    if (!transferId || typeof transferId !== 'string') {
      throw new Error('Valid transfer ID is required');
    }

    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([CHUNKS_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CHUNKS_STORE_NAME);
        const index = store.index('transferId');
        const range = IDBKeyRange.only(transferId);

        let deletedCount = 0;
        const request = index.openCursor(range);

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            console.log(`🗑️ Deleted ${deletedCount} chunks for transfer: ${transferId}`);
            resolve(deletedCount);
          }
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to delete chunks: ${request.error?.message || 'Unknown error'}`
          );
          console.error('❌', error);
          reject(error);
        };
      } catch (error) {
        console.error('❌ Transaction error:', error);
        reject(error);
      }
    });
  }

  /**
   * Nettoyer les vieux transferts
   */
  async cleanupOldTransfers(options: CleanupOptions = {}): Promise<number> {
    const {
      daysOld = 7,
      includeCompleted = true,
      includeFailed = true,
      includeCancelled = true,
    } = options;

    const db = await this.initDB();
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();

        let deletedCount = 0;

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const state = cursor.value as TransferState;
            const { status } = state.transfer;
            const isOld = state.lastUpdated < cutoffTime;

            const shouldDelete =
              isOld &&
              ((status === 'completed' && includeCompleted) ||
                (status === 'failed' && includeFailed) ||
                (status === 'cancelled' && includeCancelled));

            if (shouldDelete) {
              cursor.delete();
              deletedCount++;
            }

            cursor.continue();
          } else {
            console.log(`🧹 Cleaned up ${deletedCount} old transfers (${daysOld} days)`);
            resolve(deletedCount);
          }
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to cleanup old transfers: ${request.error?.message || 'Unknown error'}`
          );
          console.error('❌', error);
          reject(error);
        };
      } catch (error) {
        console.error('❌ Transaction error:', error);
        reject(error);
      }
    });
  }

  /**
   * Obtenir la taille de stockage utilisée
   */
  async getStorageSize(): Promise<{ usage: number; quota: number }> {
    if (!navigator.storage || !navigator.storage.estimate) {
      return { usage: 0, quota: 0 };
    }

    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;

      console.log(
        `💾 Storage: ${(usage / 1024 / 1024).toFixed(2)} MB / ${(quota / 1024 / 1024).toFixed(2)} MB`
      );

      return { usage, quota };
    } catch (error) {
      console.error('❌ Failed to estimate storage:', error);
      return { usage: 0, quota: 0 };
    }
  }

  /**
   * Sauvegarder un fichier reçu complet dans IndexedDB
   */
  async saveReceivedFile(
    transferId: string,
    fileName: string,
    blob: Blob
  ): Promise<void> {
    if (!transferId || typeof transferId !== 'string') {
      throw new Error('Valid transfer ID is required');
    }
    if (!fileName || typeof fileName !== 'string') {
      throw new Error('Valid fileName is required');
    }
    if (!(blob instanceof Blob)) {
      throw new Error('Blob is required');
    }

    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(['received_files'], 'readwrite');
        const store = transaction.objectStore('received_files');

        const id = transferId; // use transferId as id to simplify lookup
        const entry = {
          id,
          transferId,
          fileName,
          blob,
          savedAt: Date.now(),
        };

        const request = store.put(entry);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Récupérer un fichier reçu par transferId
   */
  async getReceivedFile(transferId: string): Promise<{ fileName: string; blob: Blob } | null> {
    if (!transferId || typeof transferId !== 'string') {
      throw new Error('Valid transfer ID is required');
    }

    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(['received_files'], 'readonly');
        const store = transaction.objectStore('received_files');
        const request = store.get(transferId);

        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            resolve({ fileName: result.fileName, blob: result.blob });
          } else {
            resolve(null);
          }
        };

        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Export des données
   */
  async exportData(): Promise<string> {
    const allTransfers = await this.listAllTransfers();
    const exportData = {
      version: DB_VERSION,
      exportDate: new Date().toISOString(),
      transfers: allTransfers,
    };

    console.log(`📤 Exported ${allTransfers.length} transfers`);
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import des données
   */
  async importData(jsonData: string): Promise<number> {
    try {
      const data = JSON.parse(jsonData);

      if (!data.transfers || !Array.isArray(data.transfers)) {
        throw new Error('Invalid import data format');
      }

      let importedCount = 0;

      for (const state of data.transfers) {
        try {
          await this.saveTransferState(
            state.transfer,
            state.receivedChunks,
            state.metadata
          );
          importedCount++;
        } catch (error) {
          console.warn(`⚠️ Failed to import transfer ${state.transfer?.id}:`, error);
        }
      }

      console.log(`📥 Imported ${importedCount} transfers`);
      return importedCount;
    } catch (error) {
      console.error('❌ Failed to import data:', error);
      throw new Error(`Import failed: ${error}`);
    }
  }

  /**
   * Vider complètement la base de données
   */
  async clearAll(): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(
          [STORE_NAME, CHUNKS_STORE_NAME],
          'readwrite'
        );

        const transferStore = transaction.objectStore(STORE_NAME);
        const chunkStore = transaction.objectStore(CHUNKS_STORE_NAME);

        transferStore.clear();
        chunkStore.clear();

        transaction.oncomplete = () => {
          console.log('🧹 IndexedDB cleared completely');
          resolve();
        };

        transaction.onerror = () => {
          const error = new Error(
            `Failed to clear IndexedDB: ${transaction.error?.message || 'Unknown error'}`
          );
          console.error('❌', error);
          reject(error);
        };
      } catch (error) {
        console.error('❌ Transaction error:', error);
        reject(error);
      }
    });
  }

  /**
   * Fermer la connexion
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.dbPromise = null;
      console.log('🔌 IndexedDB closed');
    }
  }

  /**
   * Vérifier l'intégrité
   */
  async healthCheck(): Promise<{
    isHealthy: boolean;
    stats: TransferStats;
    storage: { usage: number; quota: number };
  }> {
    try {
      const stats = await this.getTransferStats();
      const storage = await this.getStorageSize();

      const isHealthy = this.db !== null && storage.usage < storage.quota * 0.9;

      console.log(
        isHealthy ? '✅ Database is healthy' : '⚠️ Database needs attention'
      );

      return { isHealthy, stats, storage };
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return {
        isHealthy: false,
        stats: {
          total: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          inProgress: 0,
          paused: 0,
          totalBytes: 0,
          completedBytes: 0,
        },
        storage: { usage: 0, quota: 0 },
      };
    }
  }
}

// Export d'une instance singleton
export const indexedDBStorage = new IndexedDBStorage();

// Export des fonctions principales pour la reprise
export const saveTransferState = (
  transfer: Transfer,
  receivedChunks: number[] = [],
  metadata?: any
) => indexedDBStorage.saveTransferState(transfer, receivedChunks, metadata);

export const saveResumeTransferState = (
  transferId: string,
  state: ResumeTransferState
) => indexedDBStorage.saveResumeTransferState(transferId, state);

export const getTransferState = (transferId: string) =>
  indexedDBStorage.getTransferState(transferId);

export const getMissingChunks = (transferId: string) =>
  indexedDBStorage.getMissingChunks(transferId);

export const getTransferCompletion = (transferId: string) =>
  indexedDBStorage.getTransferCompletion(transferId);

export const markTransferAsResuming = (transferId: string) =>
  indexedDBStorage.markTransferAsResuming(transferId);

export const cleanupAbandonedTransfers = (maxAgeHours?: number) =>
  indexedDBStorage.cleanupAbandonedTransfers(maxAgeHours);

export const deleteTransferState = (transferId: string) =>
  indexedDBStorage.deleteTransferState(transferId);

export const listIncompleteTransfers = () =>
  indexedDBStorage.listIncompleteTransfers();

export const saveReceivedFile = (
  transferId: string,
  fileName: string,
  blob: Blob
) => indexedDBStorage.saveReceivedFile(transferId, fileName, blob);

export const getReceivedFile = (transferId: string) =>
  indexedDBStorage.getReceivedFile(transferId);

export const listAllTransfers = () =>
  indexedDBStorage.listAllTransfers();

export const getTransferStats = () => indexedDBStorage.getTransferStats();

export const getTransfersByStatus = (status: Transfer['status']) =>
  indexedDBStorage.getTransfersByStatus(status);

export const getTransfersByPeer = (peerId: string) =>
  indexedDBStorage.getTransfersByPeer(peerId);

export const saveChunk = (
  transferId: string,
  chunkIndex: number,
  chunkData: ArrayBuffer
) => indexedDBStorage.saveChunk(transferId, chunkIndex, chunkData);

export const getChunk = (transferId: string, chunkIndex: number) =>
  indexedDBStorage.getChunk(transferId, chunkIndex);

export const deleteChunks = (transferId: string) =>
  indexedDBStorage.deleteChunks(transferId);

export const cleanupOldTransfers = (options?: CleanupOptions) =>
  indexedDBStorage.cleanupOldTransfers(options);

export const getStorageSize = () => indexedDBStorage.getStorageSize();

export const exportData = () => indexedDBStorage.exportData();

export const importData = (jsonData: string) =>
  indexedDBStorage.importData(jsonData);

export const clearAll = () => indexedDBStorage.clearAll();

export const healthCheck = () => indexedDBStorage.healthCheck();

/**
 * Lister tous les transferts incomplets pour un peer
 */
export async function listIncompleteTransfersForPeer(
  peerId: string
): Promise<TransferState[]> {
  const db = await indexedDBStorage.initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const allStates: TransferState[] = request.result;
      const incomplete = allStates.filter(state => 
        state.transfer?.peerId === peerId && 
        state.transfer?.status !== 'completed' &&
        state.transfer?.status !== 'failed'
      );
      
      console.log(`📋 Found ${incomplete.length} incomplete transfers for ${peerId}`);
      resolve(incomplete);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Nettoyer les transferts plus vieux que X jours
 */
export async function cleanupOldTransfersCustom(daysOld: number = 7): Promise<number> {
  const db = await indexedDBStorage.initDB();
  const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const allStates: TransferState[] = request.result;
      let deletedCount = 0;

      for (const state of allStates) {
        if (state.lastUpdated < cutoffTime) {
          store.delete(state.transfer.id);
          deletedCount++;
        }
      }

      console.log(`🧹 Cleaned up ${deletedCount} old transfers`);
      resolve(deletedCount);
    };

    request.onerror = () => reject(request.error);
  });
}

// Export de l'instance pour les fonctions avancées
export default indexedDBStorage;