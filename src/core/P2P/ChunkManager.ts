// lib/p2p/ChunkManagerUltra.ts

import { Chunk, ChunkMetadata } from '@/types/transfer.types';
import { EncryptionManager, EncryptedData, EncryptionMetadata } from '@/core/crypto/encryption';
import { WorkerPool } from './WorkerPool';
import { LRUCache } from './LRUCache';
import { ChunkStorageOPFS } from './ChunkStorageOPFS';

interface ChunkManagerOptions {
  chunkSize?: number;
  useStorage?: boolean;
  workerPoolSize?: number;
  cacheSize?: number;
  autoEnableStorage?: boolean;
  autoStorageThreshold?: number;
}

export class ChunkManager {
  private chunkSize: number;
  private bitmap: boolean[];
  private chunks: Map<number, ArrayBuffer>;
  private metadata: ChunkMetadata | null = null;
  private chunkEncryptionMetadata: Map<number, EncryptionMetadata> = new Map();

  private storage: ChunkStorageOPFS;
  private useStorage: boolean;
  private autoEnableStorage: boolean;
  private autoStorageThreshold: number;

  private workerPool: WorkerPool | null = null;
  private decompressedCache: LRUCache<number, Uint8Array>;

  private isDestroyed = false;

  constructor(options: ChunkManagerOptions = {}) {
    this.chunkSize = options.chunkSize ?? 128 * 1024;
    this.bitmap = [];
    this.chunks = new Map();

    this.useStorage = options.useStorage ?? false;
    this.autoEnableStorage = options.autoEnableStorage ?? true;
    this.autoStorageThreshold = options.autoStorageThreshold ?? 500 * 1024 * 1024;

    this.storage = new ChunkStorageOPFS();
    this.decompressedCache = new LRUCache<number, Uint8Array>(options.cacheSize ?? 50);

    try {
      this.workerPool = new WorkerPool(options.workerPoolSize);
    } catch (error) {
      console.warn('⚠️ Failed to initialize WorkerPool, falling back to main thread:', error);
      this.workerPool = null;
    }
  }

  async splitFile(
    file: File,
    options?: { encrypt?: boolean; password?: string; encryptionKey?: CryptoKey }
  ): Promise<{
    chunks: Chunk[];
    metadata: ChunkMetadata;
  }> {
    if (this.isDestroyed) {
      throw new Error('chunkManager has been destroyed');
    }

    console.log(`📦 Splitting file: ${file.name} (${file.size} bytes)`);

    const totalChunks = Math.ceil(file.size / this.chunkSize);
    const fileId = this.generateFileId();

    if (this.autoEnableStorage && file.size > this.autoStorageThreshold && !this.useStorage) {
      console.log('⚠️ Large file detected, enabling OPFS storage');
      this.useStorage = true;
      if (this.storage.isSupported()) {
        try {
          await this.storage.init();
        } catch (error) {
          console.warn('⚠️ OPFS init failed, using memory:', error);
          this.useStorage = false;
        }
      } else {
        console.warn('⚠️ OPFS not supported, using memory');
        this.useStorage = false;
      }
    }

    let encryptionKey: CryptoKey | null = null;
    let encryptionSalt: Uint8Array | null = null;
    let exportedKey: string | undefined;

    if (options?.encrypt) {
      if (options.password) {
        const result = await EncryptionManager.deriveKeyFromPassword(options.password);
        encryptionKey = result.key;
        encryptionSalt = result.salt;
      } else if (options.encryptionKey) {
        encryptionKey = options.encryptionKey;
      } else {
        encryptionKey = await EncryptionManager.generateKey();
        exportedKey = await EncryptionManager.exportKey(encryptionKey);
      }
    }

    const chunks: Chunk[] = [];
    const chunkHashes: string[] = [];

    const BATCH_SIZE = this.workerPool ? this.workerPool.size * 2 : 10;

    for (let batchStart = 0; batchStart < totalChunks; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalChunks);

      const batchPromises: Promise<{ chunk: Chunk }>[] = [];
      for (let i = batchStart; i < batchEnd; i++) {
        batchPromises.push(this.processChunkOptimized(file, i, encryptionKey));
      }

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        chunks.push(result.chunk);
        chunkHashes.push(result.chunk.hash);
      }

      const progress = Math.round((batchEnd / totalChunks) * 100);
      if (batchEnd % 500 === 0 || batchEnd === totalChunks) {
        console.log(`Split progress: ${batchEnd}/${totalChunks} (${progress}%)`);
      }
    }

    const fileHash = await this.hashData(new TextEncoder().encode(chunkHashes.join('')));

    const metadata: ChunkMetadata = {
      fileId,
      fileName: file.name,
      fileSize: file.size,
      fileHash,
      totalChunks,
      chunkSize: this.chunkSize,
      mimeType: file.type || 'application/octet-stream',
      encrypted: !!encryptionKey,
      passwordProtected: !!options?.password,
      encryptionKey: exportedKey,
      encryptionSalt: encryptionSalt ? this.arrayBufferToBase64(encryptionSalt.buffer) : undefined,
      timestamp: Date.now(),
    };

    console.log(`✅ File split complete: ${totalChunks} chunks (${Math.round(file.size / 1024 / 1024)}MB)`);

    return { chunks, metadata };
  }

  private async processChunkOptimized(
    file: File,
    index: number,
    encryptionKey: CryptoKey | null
  ): Promise<{ chunk: Chunk }> {
    const start = index * this.chunkSize;
    const end = Math.min(start + this.chunkSize, file.size);
    const blob = file.slice(start, end);
    const arrayBuffer = await blob.arrayBuffer();

    let compressed: ArrayBuffer;
    if (this.workerPool) {
      try {
        compressed = await this.workerPool.compress(arrayBuffer);
      } catch (error) {
        console.warn(`⚠️ Worker compression failed for chunk ${index}, using fallback:`, error);
        compressed = await this.compressChunkFallback(new Uint8Array(arrayBuffer));
      }
    } else {
      compressed = await this.compressChunkFallback(new Uint8Array(arrayBuffer));
    }

    let finalData = compressed;
    let encryptionMetadata: EncryptionMetadata | undefined;

    if (encryptionKey) {
      const encrypted: EncryptedData = await EncryptionManager.encryptChunk(finalData, encryptionKey);
      finalData = encrypted.data;
      encryptionMetadata = encrypted.metadata;
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', this.toArrayBuffer(finalData));
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      chunk: {
        index,
        data: finalData,
        hash,
        size: finalData.byteLength,
        compressed: true,
        encrypted: !!encryptionKey,
        encryptionMetadata,
      },
    };
  }

  setMetadata(metadata: ChunkMetadata): void {
    this.metadata = metadata;
    this.bitmap = new Array(metadata.totalChunks).fill(false);
    this.chunks.clear();
    this.chunkEncryptionMetadata.clear();
    this.decompressedCache.clear();
  }

  async receiveChunk(chunk: Chunk): Promise<boolean> {
    if (!this.metadata) {
      throw new Error('Metadata not set');
    }

    if (chunk.index < 0 || chunk.index >= this.metadata.totalChunks) {
      throw new Error(`Invalid chunk index: ${chunk.index}`);
    }

    const chunkData = this.toArrayBuffer(chunk.data);

    const calculatedHash = await this.hashData(new Uint8Array(chunkData));
    if (calculatedHash !== chunk.hash) {
      throw new Error(`Chunk ${chunk.index} hash mismatch`);
    }

    // Ignore duplicate chunks if already received
    if (this.bitmap[chunk.index]) {
      console.warn(`Duplicate chunk ${chunk.index} ignored`);
      return true;
    }

    if (chunk.encryptionMetadata) {
      this.chunkEncryptionMetadata.set(chunk.index, chunk.encryptionMetadata);
    }

    if (this.useStorage) {
      try {
        await this.storage.writeChunk(chunk.index, chunkData);
      } catch (error) {
        console.warn(`⚠️ Failed to write chunk ${chunk.index} to storage, using memory:`, error);
        this.chunks.set(chunk.index, chunkData);
      }
    } else {
      this.chunks.set(chunk.index, chunkData);
    }

    this.bitmap[chunk.index] = true;

    return true;
  }

  async assembleFile(decryptionKey?: CryptoKey): Promise<Blob> {
    if (this.isDestroyed) {
      throw new Error('chunkManager has been destroyed');
    }

    if (!this.metadata) {
      throw new Error('Metadata not set');
    }

    if (!this.isComplete()) {
      throw new Error('Not all chunks received');
    }

    console.log('🔧 Assembling file...');

    const BATCH_SIZE = this.workerPool ? this.workerPool.size * 2 : 10;
    const parts: ArrayBuffer[] = new Array(this.metadata.totalChunks);
    const chunkHashes: string[] = [];

    for (let batchStart = 0; batchStart < this.metadata.totalChunks; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, this.metadata.totalChunks);

      const batchPromises: Promise<{ decompressed: Uint8Array; hash: string }>[] = [];
      for (let i = batchStart; i < batchEnd; i++) {
        batchPromises.push(this.processChunkForAssemblyOptimized(i, decryptionKey));
      }

      const batchResults = await Promise.all(batchPromises);

      for (let j = 0; j < batchResults.length; j++) {
        const index = batchStart + j;
        const result = batchResults[j];

        parts[index] = new Uint8Array(result.decompressed).buffer;
        chunkHashes.push(result.hash);

        if (this.useStorage) {
          try {
            await this.storage.deleteChunk(index);
          } catch (error) {
            console.warn(`⚠️ Failed to delete chunk ${index}:`, error);
          }
        }
      }

      const progress = Math.round((batchEnd / this.metadata.totalChunks) * 100);
      if (batchEnd % 500 === 0 || batchEnd === this.metadata.totalChunks) {
        console.log(`Assemble progress: ${batchEnd}/${this.metadata.totalChunks} (${progress}%)`);
      }
    }

    const finalHash = await this.hashData(new TextEncoder().encode(chunkHashes.join('')));

    if (finalHash !== this.metadata.fileHash) {
      throw new Error('Final file hash mismatch');
    }

    console.log('✅ File assembled successfully');

    return new Blob(parts.map(part => new Uint8Array(part)), { type: this.metadata.mimeType });
  }

  private async processChunkForAssemblyOptimized(
    index: number,
    decryptionKey?: CryptoKey
  ): Promise<{ decompressed: Uint8Array; hash: string }> {
    const cached = this.decompressedCache.get(index);
    if (cached) {
      const hash = await this.hashData(cached);
      return { decompressed: cached, hash };
    }

    let chunkData: ArrayBuffer;
    if (this.useStorage) {
      chunkData = await this.storage.readChunk(index);
    } else {
      const chunk = this.chunks.get(index);
      if (!chunk) {
        throw new Error(`Chunk ${index} missing`);
      }
      chunkData = chunk;
    }

    // compute hash on the stored chunk bytes (compressed/encrypted)
    const originalHash = await this.hashData(new Uint8Array(chunkData));

    if (this.metadata!.encrypted && decryptionKey) {
      const chunkMetadata = this.chunkEncryptionMetadata.get(index);
      if (!chunkMetadata) {
        throw new Error(`Encryption metadata missing for chunk ${index}`);
      }
      chunkData = await EncryptionManager.decryptChunk(chunkData, decryptionKey, chunkMetadata);
    }

    let decompressed: Uint8Array;
    if (this.workerPool) {
      try {
        const result = await this.workerPool.decompress(chunkData);
        decompressed = new Uint8Array(result);
      } catch (error) {
        console.warn(`⚠️ Worker decompression failed for chunk ${index}, using fallback:`, error);
        decompressed = await this.decompressChunkFallback(chunkData);
      }
    } else {
      decompressed = await this.decompressChunkFallback(chunkData);
    }

    this.decompressedCache.set(index, decompressed);

    // Use the hash of the original stored chunk (matches sender-side hash)
    return { decompressed, hash: originalHash };
  }

  private async compressChunkFallback(data: Uint8Array): Promise<ArrayBuffer> {
    const { compress } = await import('fflate');
    return new Promise<ArrayBuffer>((resolve, reject) => {
      compress(data, { level: 6 }, (err, compressed) => {
        if (err) reject(err);
        else resolve((compressed as Uint8Array).buffer as ArrayBuffer);
      });
    });
  }

  private async decompressChunkFallback(data: ArrayBuffer | ArrayBufferView): Promise<Uint8Array> {
    const { decompress } = await import('fflate');
    const input: Uint8Array = ArrayBuffer.isView(data)
      ? new Uint8Array((data as ArrayBufferView).buffer, (data as ArrayBufferView).byteOffset, (data as ArrayBufferView).byteLength)
      : new Uint8Array(data as ArrayBuffer);
    return new Promise<Uint8Array>((resolve, reject) => {
      decompress(input, (err, decompressed) => {
        if (err) return reject(err);
        if (decompressed instanceof Uint8Array) return resolve(decompressed);
        resolve(new Uint8Array(decompressed as unknown as ArrayBuffer));
      });
    });
  }

  private async hashData(data: ArrayBuffer | ArrayBufferView): Promise<string> {
    const bufferArg = ArrayBuffer.isView(data) ? (data as ArrayBufferView).buffer : (data as ArrayBuffer);
    const buffer = this.toArrayBuffer(bufferArg);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private toArrayBuffer(buffer: ArrayBuffer | ArrayBufferLike): ArrayBuffer {
    if (buffer instanceof ArrayBuffer) {
      return buffer;
    }

    const sourceView = new Uint8Array(buffer);
    const arrayBuffer = new ArrayBuffer(sourceView.byteLength);
    const targetView = new Uint8Array(arrayBuffer);
    targetView.set(sourceView);
    return arrayBuffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferLike): string {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  private generateFileId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  getProgress(): number {
    if (!this.metadata) return 0;
    const received = this.bitmap.filter(Boolean).length;
    return (received / this.metadata.totalChunks) * 100;
  }

  isComplete(): boolean {
    if (!this.metadata) return false;
    return this.bitmap.every((received) => received);
  }

  getMissingChunks(): number[] {
    return this.bitmap.map((received, index) => (received ? -1 : index)).filter((index) => index !== -1);
  }

  getReceivedChunks(): number {
    return this.bitmap.filter(Boolean).length;
  }

  getStats() {
    return {
      workerPool: this.workerPool ? {
        size: this.workerPool.size,
        available: this.workerPool.availableCount,
        queueLength: this.workerPool.queueLength,
      } : null,
      cache: this.decompressedCache.getStats(),
      storage: {
        enabled: this.useStorage,
        supported: this.storage.isSupported(),
      },
      metadata: this.metadata,
      progress: this.getProgress(),
      received: this.getReceivedChunks(),
      total: this.metadata?.totalChunks ?? 0,
    };
  }

  reset(): void {
    this.bitmap = [];
    this.chunks.clear();
    this.metadata = null;
    this.chunkEncryptionMetadata.clear();
    this.decompressedCache.clear();
  }

  async destroy(): Promise<void> {
    if (this.isDestroyed) return;

    this.isDestroyed = true;

    if (this.workerPool) {
      this.workerPool.terminate();
      this.workerPool = null;
    }

    this.decompressedCache.clear();

    if (this.useStorage) {
      await this.storage.cleanup();
    }

    this.reset();

    console.log('✅ chunkManager destroyed');
  }
}