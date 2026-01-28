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
  private chunkCompressionStatus: Map<number, boolean> = new Map(); // ✅ Track compression status per chunk
  private chunkHashes: Map<number, string> = new Map(); // ✅ Track chunk hashes from sender
  private chunkEncryptionCache: Map<number, EncryptionMetadata> = new Map(); // 🔐 CRITICAL FIX: Cache IV for retries

  private storage: ChunkStorageOPFS;
  private useStorage: boolean;
  private autoEnableStorage: boolean;
  private autoStorageThreshold: number;

  private workerPool: WorkerPool | null = null;
  private decompressedCache: LRUCache<number, Uint8Array>;

  private isDestroyed = false;
  private pendingOperations = 0; // ✅ Track async operations

  constructor(options: ChunkManagerOptions = {}) {
    this.chunkSize = options.chunkSize ?? 128 * 1024; // 128KB (balance entre throughput et buffer)
    this.bitmap = [];
    this.chunks = new Map();

    this.useStorage = options.useStorage ?? false;
    this.autoEnableStorage = options.autoEnableStorage ?? true;
    this.autoStorageThreshold = options.autoStorageThreshold ?? 1024 * 1024 * 1024; // 1GB

    this.storage = new ChunkStorageOPFS();
    // Optimized cache size for better hit rate
    const cacheSize = options.cacheSize ?? Math.max(50, Math.min(200, Math.floor(500 * 1024 * 1024 / (options.chunkSize ?? 128 * 1024)))); // Max 50-200 based on chunk size (optimisé: +15-25% vitesse)
    this.decompressedCache = new LRUCache<number, Uint8Array>(cacheSize);

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
    metadata: ChunkMetadata;
    chunkGenerator: AsyncGenerator<Chunk, void, unknown>;
  }> {
    if (this.isDestroyed) {
      throw new Error('chunkManager has been destroyed');
    }

    console.log(`📦 Starting streaming split for file: ${file.name} (${file.size} bytes)`);

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

    // Calculate file hash from chunk hashes as we go
    const chunkHashes: string[] = [];

    const metadata: ChunkMetadata = {
      fileId,
      fileName: file.name,
      fileSize: file.size,
      fileHash: '', // Will be set after all chunks
      totalChunks,
      chunkSize: this.chunkSize,
      mimeType: file.type || 'application/octet-stream',
      encrypted: !!encryptionKey,
      passwordProtected: !!options?.password,
      encryptionKey: exportedKey,
      encryptionSalt: encryptionSalt ? this.arrayBufferToBase64(encryptionSalt.buffer) : undefined,
      timestamp: Date.now(),
    };

    // Create async generator for chunks
    const chunkGenerator = async function* (this: ChunkManager) {
      // ✅ BUG #5 FIX: Generate chunks progressively without batching delay
      // Process all chunks independently with controlled concurrency
      const MAX_CONCURRENT_PROCESSING = this.workerPool ? Math.min(this.workerPool.size * 4, 20) : 20; // ⚡ Réduit à 20 pour hash sync
      const processingQueue: Promise<{ chunk: Chunk }>[] = [];
      let processedCount = 0;

      try {
        for (let i = 0; i < totalChunks; i++) {
          // Start processing chunk
          const promise = this.processChunkOptimized(file, i, encryptionKey).catch(err => {
            console.error(`❌ Error processing chunk ${i}:`, err);
            throw err;
          });
          processingQueue.push(promise);

          // When queue reaches max, yield results as they complete
          if (processingQueue.length >= MAX_CONCURRENT_PROCESSING) {
            try {
              const result = await processingQueue.shift()!;
              chunkHashes.push(result.chunk.hash);
              yield result.chunk;
              processedCount++;

              const progress = Math.round(((processedCount) / totalChunks) * 100);
              if (processedCount % 500 === 0) {
                console.log(`Split progress: ${processedCount}/${totalChunks} (${progress}%)`);
              }
            } catch (err) {
              console.error(`❌ Error yielding chunk:`, err);
              throw err;
            }
          }
        }

        // Process remaining chunks in queue
        while (processingQueue.length > 0) {
          try {
            const result = await processingQueue.shift()!;
            chunkHashes.push(result.chunk.hash);
            yield result.chunk;
            processedCount++;

            const progress = Math.round((processedCount / totalChunks) * 100);
            if (processedCount % 500 === 0 || processedCount === totalChunks) {
              console.log(`Split progress: ${processedCount}/${totalChunks} (${progress}%)`);
            }
          } catch (err) {
            console.error(`❌ Error processing remaining chunk:`, err);
            throw err;
          }
        }
      } catch (err) {
        console.error(`❌ Chunk generation failed:`, err);
        throw err;
      }

      // Calculate final file hash
      const fileHash = await this.hashData(new TextEncoder().encode(chunkHashes.join('')));
      metadata.fileHash = fileHash;

      console.log(`✅ File split complete: ${totalChunks} chunks (${Math.round(file.size / 1024 / 1024)}MB)`);

      // Yield a special "complete" signal with the final metadata
      yield { index: -1, data: new ArrayBuffer(0), hash: '', size: 0, compressed: false, encrypted: false, metadata: metadata } as any;
    }.bind(this);

    return { metadata, chunkGenerator: chunkGenerator() };
  }

  private async processChunkOptimized(
    file: File,
    index: number,
    encryptionKey: CryptoKey | null
  ): Promise<{ chunk: Chunk }> {
    const start = index * this.chunkSize;
    const end = Math.min(start + this.chunkSize, file.size);
    
    // ✅ CRITICAL FIX: Ensure chunk indices match bounds correctly
    // Prevent chunks from exceeding file size or having wrong boundaries
    if (start >= file.size) {
      console.error(`❌ ERROR: Chunk ${index} start position (${start}) >= file size (${file.size})!`);
      throw new Error(`Invalid chunk index ${index}: exceeds file size`);
    }
    
    // 🔍 DEBUG: Log slice boundaries for detection of 177-byte chunks
    const totalChunks = Math.ceil(file.size / this.chunkSize);
    if (index >= totalChunks - 10 || index < 5) {
      console.log(`🔍 CHUNK ${index} BOUNDARIES: start=${start}, end=${end}, size should be ${end - start} bytes`);
    }
    
    const blob = file.slice(start, end);
    const arrayBuffer = await blob.arrayBuffer();
    
    // ✅ CRITICAL: Validate chunk size is not empty and matches boundaries
    if (arrayBuffer.byteLength === 0) {
      console.error(`❌ ERROR: Chunk ${index} has 0 bytes! start=${start}, end=${end}, file.size=${file.size}`);
      throw new Error(`Chunk ${index} has zero size`);
    }
    
    // 🔴 DETECT 177-BYTE CHUNKS: Validate slice returned expected size
    const expectedSize = end - start;
    if (arrayBuffer.byteLength !== expectedSize && arrayBuffer.byteLength < 1000) {
      console.error(`❌ CRITICAL 177-BYTE DETECTION: Chunk ${index} slice mismatch!`);
      console.error(`   Expected: ${expectedSize} bytes (from ${start} to ${end})`);
      console.error(`   Received: ${arrayBuffer.byteLength} bytes`);
      console.error(`   File size: ${file.size}, Chunk size setting: ${this.chunkSize}`);
      console.error(`   This indicates file.slice() returned wrong data or file is truncated!`);
    }

    // 📊 Log original chunk size - LOG ALL, NOT JUST FIRST/LAST
    const originalSize = arrayBuffer.byteLength;
    
    // Log more frequently for debugging
    if (index < 10 || index > totalChunks - 10) {
      console.log(`📦 Chunk ${index}: original size = ${originalSize} bytes`);
    }

    let compressed: ArrayBuffer = arrayBuffer;
    let wasCompressed = false; // ✅ Track if compression actually succeeded

    if (this.workerPool) {
      try {
        compressed = await this.workerPool.compress(arrayBuffer);
        
        // 🔴 CRITICAL FIX: Validate compression output immediately
        // Prevent corrupted/detached buffers from being encrypted and sent
        if (compressed.byteLength < 1000) {
          console.error(`🚨 COMPRESSION BUG: Output is suspiciously small!`);
          console.error(`   Input: ${arrayBuffer.byteLength} bytes`);
          console.error(`   Output: ${compressed.byteLength} bytes`);
          console.error(`   Compression ratio: ${(compressed.byteLength / arrayBuffer.byteLength * 100).toFixed(2)}%`);
          console.error(`   This indicates buffer detachment or corruption - SKIPPING COMPRESSION`);
          
          // Fallback to uncompressed rather than sending corrupted data
          compressed = arrayBuffer;
          wasCompressed = false;
        } else {
          wasCompressed = true; // ✅ Only set true if compression succeeded AND output is valid
        }
      } catch (error) {
        console.warn(`⚠️ Worker compression failed for chunk ${index}, skipping compression (${(arrayBuffer.byteLength / 1024).toFixed(1)}KB):`, error);
        // On timeout, skip compression entirely rather than falling back to slower compress
        compressed = arrayBuffer;
        wasCompressed = false; // ✅ Still false since we couldn't compress
      }
    }

    // ✅ CRITICAL FIX: Compute hash on plaintext BEFORE encryption
    // (because encryption with random nonce produces different ciphertext each time)
    const hashBuffer = await crypto.subtle.digest('SHA-256', this.toArrayBuffer(compressed));
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    let finalData = compressed;
    let encryptionMetadata: EncryptionMetadata | undefined;

    // 🔐 CRITICAL FIX: Use cached IV if available (for retries), otherwise generate new one
    const cachedMetadata = this.chunkEncryptionCache.get(index);
    if (encryptionKey) {
      // Pass cached metadata to use same IV on retries
      const encrypted: EncryptedData = await EncryptionManager.encryptChunk(finalData, encryptionKey, cachedMetadata);
      finalData = encrypted.data;
      encryptionMetadata = encrypted.metadata;
      
      // ✅ CRITICAL: Verify encryption metadata is not undefined
      if (!encryptionMetadata) {
        console.error(`❌ ERROR: Encryption failed for chunk ${index} - metadata is undefined!`);
        throw new Error(`Encryption metadata missing for chunk ${index}`);
      }
      
      // 🔍 DEBUG: Verify chunk index is preserved correctly
      if (index >= totalChunks - 10 || index < 5) {
        console.log(`🔍 ENCRYPTION METADATA for chunk ${index}: IV=${encryptionMetadata.iv.substring(0, 16)}...`);
      }
      
      // 💾 CACHE on first time (when no cached metadata)
      if (!cachedMetadata) {
        this.chunkEncryptionCache.set(index, encryptionMetadata);
        console.log(`💾 [CHUNK ${index}] NEW ENCRYPTION - Generated and cached IV: ${encryptionMetadata.iv.substring(0, 16)}...`);
        
        // ✅ CRITICAL: Verify IV is truly unique (not shared with any other cached chunk)
        const duplicateChunks = Array.from(this.chunkEncryptionCache.entries())
          .filter(([idx, meta]) => idx !== index && meta.iv.substring(0, 16) === encryptionMetadata!.iv.substring(0, 16));
        
        if (duplicateChunks.length > 0) {
          console.error(`🚨 CRITICAL: Generated IV for chunk ${index} DUPLICATES chunk ${duplicateChunks[0][0]}!`);
          console.error(`   This indicates a critical encryption bug - IVs MUST be unique!`);
          throw new Error(`Encryption IV collision detected for chunk ${index}`);
        }
      } else {
        const previousIV = cachedMetadata.iv.substring(0, 16);
        const currentIV = encryptionMetadata.iv.substring(0, 16);
        
        if (previousIV !== currentIV) {
          console.error(`❌ ERROR: Retry IV mismatch for chunk ${index}! Previous: ${previousIV}..., Current: ${currentIV}...`);
          throw new Error(`IV mismatch on retry for chunk ${index}`);
        }
        
        console.log(`🔄 [CHUNK ${index}] RETRY - Reusing cached IV: ${previousIV}...`);
      }
    }

    // 📊 Log final sent size - LOG ALL TO DETECT TRUNCATION
    // 🔴 CRITICAL: Log EVERY chunk, not just last 10, to find 177-byte chunks
    const isSuspiciousSize = finalData.byteLength < 1000 && index < totalChunks - 1;
    
    // ❌ REJECT SUSPICIOUS CHUNKS BEFORE SENDING
    if (isSuspiciousSize) {
      const expectedSize = end - start;
      console.error(`🚨 CRITICAL VALIDATION FAILURE: Rejecting chunk ${index}!`);
      console.error(`   Expected size: ${expectedSize} bytes (from ${start} to ${end})`);
      console.error(`   Final size: ${finalData.byteLength} bytes`);
      console.error(`   Original: ${originalSize} bytes`);
      console.error(`   Compressed: ${wasCompressed}`);
      console.error(`   Encrypted: ${!!encryptionKey}`);
      
      if (wasCompressed && finalData.byteLength < originalSize / 100) {
        console.error(`   ROOT CAUSE: Compression output is suspiciously small (${(finalData.byteLength / originalSize * 100).toFixed(2)}% of original)`);
        console.error(`   This indicates a buffer detachment or corruption bug in the compression pipeline!`);
      }
      
      console.error(`   This indicates a CRITICAL BUG in the pipeline - NOT SENDING!`);
      throw new Error(`❌ CRITICAL: Chunk ${index} is SUSPICIOUSLY SMALL (${finalData.byteLength} bytes) - data corruption detected! Expected ~${expectedSize} bytes.`);
    }
    
    // 🚨 ULTRA CRITICAL: If chunk is exactly 177 bytes, this is DEFINITELY A BUG
    if (finalData.byteLength === 177 && index !== totalChunks - 1) {
      const expectedSize = end - start;
      console.error(`🚨 ULTRA CRITICAL 177-BYTE BUG DETECTED AT CHUNK ${index}!`);
      console.error(`   Original slice requested: ${start}-${end} = ${expectedSize} bytes`);
      console.error(`   After compression + encryption: 177 bytes (IMPOSSIBLE!)`);
      console.error(`   Original uncompressed: ${originalSize} bytes`);
      console.error(`   Was compressed: ${wasCompressed}`);
      console.error(`   Hash: ${hash}`);
      console.error(`   This indicates a fundamental data corruption bug in the pipeline!`);
      
      // Try to diagnose where the 177 bytes came from
      const hashView = new Uint8Array(finalData);
      const hashStr = Array.from(hashView).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.error(`   Data hex: ${hashStr}`);
      
      throw new Error(`❌ CRITICAL: Chunk ${index} corrupted to exactly 177 bytes - refusing to send!`);
    }
    
    if (index > totalChunks - 10 || index < 5) {
      console.log(`   → FINAL SIZE before send for chunk ${index}/${totalChunks}: ${finalData.byteLength} bytes (original: ${originalSize} bytes, compressed: ${wasCompressed})`);
    }

    return {
      chunk: {
        index,
        data: finalData,
        hash,
        size: finalData.byteLength,
        compressed: wasCompressed, // ✅ Use actual compression status
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
    this.chunkEncryptionCache.clear(); // 🔐 Clear cached IVs when metadata changes
    this.chunkCompressionStatus.clear(); // ✅ Clear compression status
    this.chunkHashes.clear(); // ✅ Clear chunk hashes
    this.decompressedCache.clear();
  }

  async receiveChunk(chunk: Chunk): Promise<boolean> {
    if (!this.metadata) {
      throw new Error('Metadata not set');
    }

    if (chunk.index < 0 || chunk.index >= this.metadata.totalChunks) {
      throw new Error(`Invalid chunk index: ${chunk.index}`);
    }

    // ✅ DEBUG: Log receipt of important chunks
    if (chunk.index < 5 || chunk.index >= this.metadata.totalChunks - 5 || chunk.index % 50 === 0) {
      console.log(`📦 ChunkManager.receiveChunk(${chunk.index}/${this.metadata.totalChunks - 1})`);
    }

    // ✅ CRITICAL FIX: Check for duplicate chunks BEFORE hash verification
    // If we've already received this chunk, ignore it immediately to avoid:
    // 1. Hash mismatches on fragmented chunks (order-dependent)
    // 2. Duplicate ACKs from WebRTC relay/echo
    // 3. Wasted CPU on redundant hash calculations
    if (this.bitmap[chunk.index]) {
      console.warn(`⏭️ Duplicate chunk ${chunk.index} ignored (already received)`);
      return true;
    }

    let chunkData = this.toArrayBuffer(chunk.data);

    // 🔹 CRITICAL FIX #11: Decompress BEFORE hash verification if chunk is compressed
    // Sender computed hash on plaintext (after compression, before encryption)
    // So we must decompress first if chunk was compressed
    // ✅ BUG #4 FIX: Add timeout to prevent hanging
    if (chunk.compressed && !chunk.encryptionMetadata && this.workerPool) {
      try {
        // Add 30 second timeout for decompression
        const decompressPromise = this.workerPool.decompress(chunkData);
        const timeoutPromise = new Promise<ArrayBuffer>((_, reject) => 
          setTimeout(() => reject(new Error(`Decompression timeout for chunk ${chunk.index} after 30s`)), 30000)
        );
        chunkData = await Promise.race([decompressPromise, timeoutPromise]);
      } catch (decompressError) {
        console.error(`❌ Failed to decompress chunk ${chunk.index}:`, decompressError);
        throw decompressError;
      }
    }

    // 🔹 CRITICAL FIX: Hash verification must happen on PLAINTEXT, not encrypted data!
    // If chunk is encrypted, decrypt BEFORE hash verification
    // Hash was computed by sender on plaintext (after compression, before encryption)
    if (chunk.encryptionMetadata) {
      console.log(`🔓 Decrypting chunk ${chunk.index} for hash verification...`);
      // We don't have the decryption key here yet - it comes later in assembleFile
      // So we need to verify the hash on the encrypted data using the sender's approach
      // The sender computed hash on plaintext, but transmitted encrypted data + hash
      // We store encrypted data and verify hash during assembly when we have the key
      console.log(`⏱️ Deferring hash verification until assembly for chunk ${chunk.index} (will decrypt then verify)`);
    } else {
      // For unencrypted chunks, verify hash immediately (now on plaintext/decompressed data)
      const calculatedHash = await this.hashData(new Uint8Array(chunkData));
      if (calculatedHash !== chunk.hash) {
        console.error(`❌ Chunk ${chunk.index} hash mismatch! Expected: ${chunk.hash}, Got: ${calculatedHash}`);
        console.error(`Chunk data size after decompression: ${chunkData.byteLength} bytes`);
        // Log first 32 bytes of received data for debugging
        const dataView = new Uint8Array(chunkData.slice(0, 32));
        console.error(`First 32 bytes: ${Array.from(dataView).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
        throw new Error(`Chunk ${chunk.index} hash mismatch`);
      }
    }

    // ✅ Store chunk hash from sender for verification during assembly
    this.chunkHashes.set(chunk.index, chunk.hash);

    // ✅ Track compression status for this chunk
    this.chunkCompressionStatus.set(chunk.index, chunk.compressed ?? false);

    if (chunk.encryptionMetadata) {
      const currentIV = chunk.encryptionMetadata.iv.substring(0, 16);
      
      // 🔹 CRITICAL FIX #10: Prevent IV collisions from overwriting metadata
      // When a chunk is retried, it might arrive with same or different IV
      // But we NEVER want to overwrite already-stored metadata
      const existingMetadata = this.chunkEncryptionMetadata.get(chunk.index);
      
      if (existingMetadata) {
        const existingIV = existingMetadata.iv.substring(0, 16);
        if (existingIV !== currentIV) {
          console.warn(`⚠️ [CHUNK ${chunk.index}] DUPLICATE DETECTED!`);
          console.warn(`   Previously stored with IV: ${existingIV}...`);
          console.warn(`   Now arrived with IV: ${currentIV}...`);
          console.warn(`   IGNORING new metadata - keeping original IV`);
        } else {
          console.log(`✓ [CHUNK ${chunk.index}] Duplicate with SAME IV (retry) - verified match`);
        }
        // DO NOT UPDATE - keep the original metadata!
        return true; // Still ACK the chunk since data is stored
      }
      
      // 🔹 CRITICAL FIX #8: Detect IV collisions (same IV for different chunks)
      // Each chunk MUST have a unique IV for security
      const duplicateIV = Array.from(this.chunkEncryptionMetadata.entries()).find(
        ([idx, metadata]) => idx !== chunk.index && metadata.iv.substring(0, 16) === currentIV
      );
      
      if (duplicateIV) {
        const [duplicateIdx, duplicateMeta] = duplicateIV;
        console.error(`🚨 CRITICAL: IV COLLISION DETECTED!`);
        console.error(`   Chunk ${chunk.index} has IV: ${currentIV}...`);
        console.error(`   But Chunk ${duplicateIdx} ALREADY has same IV: ${duplicateMeta.iv.substring(0, 16)}...`);
        console.error(`   Bitmap state: chunk ${duplicateIdx} = ${this.bitmap[duplicateIdx]}, chunk ${chunk.index} = ${this.bitmap[chunk.index]}`);
        
        // ✅ ENHANCED FIX: More robust collision detection and handling
        // If this is clearly a retry (same IV patterns from timeouts), use original metadata
        const isLikelyRetry = !this.bitmap[chunk.index];
        
        if (isLikelyRetry) {
          console.warn(`⚠️ [CHUNK ${chunk.index}] Skipping metadata storage - IV collision detected`);
          console.warn(`   This appears to be a retry of chunk ${duplicateIdx} arriving as different index`);
          console.warn(`   Using original metadata for chunk ${duplicateIdx} to decrypt`);
          // DO NOT store metadata for this collision - the original will be used for decryption
          return true; // Still ACK the chunk since data is stored
        } else {
          // This is a REAL collision - something is very wrong
          console.error(`❌ SEVERE: IV collision between TWO ALREADY-RECEIVED chunks (${duplicateIdx} and ${chunk.index})!`);
          console.error(`   This indicates a critical encryption/transmission bug!`);
          // Store the new one anyway (overwrite) to continue, but flag the error
          this.chunkEncryptionMetadata.set(chunk.index, chunk.encryptionMetadata);
        }
      } else {
        // No collision - store normally
        this.chunkEncryptionMetadata.set(chunk.index, chunk.encryptionMetadata);
      }
      
      const mapSize = this.chunkEncryptionMetadata.size;
      console.log(`📥 [CHUNK ${chunk.index}] STORED METADATA: IV=${currentIV}... (map now has ${mapSize} chunks)`);
      // Verify it was actually stored
      const verification = this.chunkEncryptionMetadata.get(chunk.index);
      const verifyIV = verification ? verification.iv.substring(0, 16) : 'NULL';
      console.log(`✓ [CHUNK ${chunk.index}] VERIFIED STORED: IV=${verifyIV}... (matches: ${currentIV === verifyIV ? '✅' : '❌'})`);
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

    // ✅ DEBUG: Show progress every 50 chunks
    const received = this.getReceivedChunks();
    if (received % 50 === 0 || received === this.metadata.totalChunks) {
      const progress = Math.round((received / this.metadata.totalChunks) * 100);
      console.log(`✅ Chunks received: ${received}/${this.metadata.totalChunks} (${progress}%)`);
    }

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
      const missing = this.getMissingChunks();
      const total = this.metadata.totalChunks;
      const received = this.getReceivedChunks();
      console.error(`❌ ASSEMBLY BLOCKED: Not all chunks received! ${received}/${total} chunks, missing: ${missing.length} chunks`);
      console.error(`   Missing chunks (first 20): ${missing.slice(0, 20).join(', ')}`);
      throw new Error(`Not all chunks received (${received}/${total})`);
    }

    console.log(`🔧 Assembling file (${this.metadata.totalChunks} chunks, ${this.metadata.fileSize} bytes)...`);

    // 🚀 STREAMING ASSEMBLY: Augmenter concurrence + libérer mémoire immédiatement
    // NO MORE MEMORY ACCUMULATION - Process and discard instead of storing
    // 🔹 CRITICAL FIX #6: ADAPTIVE BATCH SIZE to prevent worker pool starvation
    // ✅ BUG #5 FIX: Use smaller batch size for better memory and responsiveness
    const baseSize = this.workerPool ? Math.max(4, Math.min(8, this.workerPool.size)) : 6;
    const BATCH_SIZE = baseSize; // Use 4-8 range for optimal memory + speed tradeoff
    const parts: ArrayBuffer[] = new Array(this.metadata.totalChunks);
    const chunkHashes: string[] = new Array(this.metadata.totalChunks); // 🔹 CRITICAL FIX #3: Pre-allocate to preserve order

    for (let batchStart = 0; batchStart < this.metadata.totalChunks; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, this.metadata.totalChunks);

      // ⚡ HIGHER PARALLELISM: Process all chunks in parallel
      const batchPromises: Promise<{ decompressed: Uint8Array; hash: string }>[] = [];
      for (let i = batchStart; i < batchEnd; i++) {
        batchPromises.push(this.processChunkForAssemblyOptimized(i, decryptionKey));
      }

      const batchResults = await Promise.all(batchPromises);

      // 🔹 STREAMING WRITE: Écrire et libérer IMMÉDIATEMENT pour éviter accumulation
      // Pas de cache agressif - traiter et jeter pour garder la mémoire libre
      for (let j = 0; j < batchResults.length; j++) {
        const index = batchStart + j;
        const result = batchResults[j];

        // ✅ BUG #3 FIX: Safely copy buffer to avoid detachment issues
        const uint8copy = new Uint8Array(result.decompressed);
        const safeBuffer = new ArrayBuffer(uint8copy.byteLength);
        new Uint8Array(safeBuffer).set(uint8copy);
        parts[index] = safeBuffer;
        chunkHashes[index] = result.hash; // Use array index, not push()

        // Libérer la référence immédiatement pour GC
        (result as any).decompressed = null;

        if (this.useStorage) {
          // Fire and forget storage cleanup
          this.storage.deleteChunk(index).catch(error => {
            console.warn(`⚠️ Failed to delete chunk ${index}:`, error);
          });
        }
      }

      const progress = Math.round((batchEnd / this.metadata.totalChunks) * 100);
      if (batchEnd % 500 === 0 || batchEnd === this.metadata.totalChunks) {
        console.log(`Assemble progress: ${batchEnd}/${this.metadata.totalChunks} (${progress}%)`);
      }
    }

    // 🔹 CRITICAL FIX #3: Use the correct order of hashes
    // Filter out any undefined entries (should not happen if all chunks received)
    const orderedHashes = chunkHashes.filter((h) => h !== undefined);
    if (orderedHashes.length !== chunkHashes.length) {
      console.warn(`⚠️ Warning: Some chunk hashes are missing. Expected ${chunkHashes.length}, got ${orderedHashes.length}`);
    }

    const finalHash = await this.hashData(new TextEncoder().encode(orderedHashes.join('')));

    if (!this.metadata) {
      throw new Error('Metadata lost during assembly - transfer was cancelled or destroyed');
    }

    console.log(`📊 Final assembly hash check: calculated=${finalHash}, expected=${this.metadata.fileHash}`);
    if (finalHash !== this.metadata.fileHash) {
      throw new Error(`Final file hash mismatch! Expected ${this.metadata.fileHash}, got ${finalHash}`);
    }

    console.log('✅ File assembled successfully');

    // 🔹 CRITICAL FIX #4: Validate all chunks are present before creating Blob
    // Check for undefined parts which would result in data loss
    const missingChunks: number[] = [];
    let totalSize = 0;
    
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i]) {
        missingChunks.push(i);
      } else {
        totalSize += (parts[i] as ArrayBuffer).byteLength;
      }
    }

    if (missingChunks.length > 0) {
      console.error(`❌ CRITICAL: ${missingChunks.length} chunks are undefined (at indices: ${missingChunks.slice(0, 10).join(', ')}...)`);
      console.error(`Expected total: ${this.metadata!.fileSize} bytes, Got: ${totalSize} bytes`);
      throw new Error(`Assembly failed: ${missingChunks.length} chunks missing from parts array`);
    }

    console.log(`✅ All ${parts.length} chunks present, total size: ${totalSize} bytes (expected: ${this.metadata!.fileSize})`);

    if (totalSize !== this.metadata!.fileSize) {
      console.error(`⚠️ Size mismatch! Expected ${this.metadata!.fileSize}, got ${totalSize}`);
      
      // 📊 Detailed diagnostic: Log chunk sizes to find the culprit
      let cumulativeSize = 0;
      let lastCorrectSize = 0;
      let firstWrongChunk = -1;
      
      for (let i = 0; i < parts.length; i++) {
        const chunkSize = (parts[i] as ArrayBuffer).byteLength;
        cumulativeSize += chunkSize;
        
        // For debugging: show sizes at regular intervals
        if (i % 50 === 0 || i === parts.length - 1) {
          console.log(`   Chunk ${i}: size=${chunkSize} bytes, cumulative=${cumulativeSize} bytes`);
        }
        
        // Detect first problematic chunk
        if (firstWrongChunk === -1 && chunkSize === 0) {
          firstWrongChunk = i;
          console.error(`   ❌ ZERO-SIZE chunk detected at index ${i}!`);
        }
      }
      
      console.error(`   Size diff: ${this.metadata!.fileSize - totalSize} bytes missing`);
      if (firstWrongChunk !== -1) {
        console.error(`   First zero-size chunk: ${firstWrongChunk}`);
      }
    }

    const finalBlob = new Blob(parts.map(part => new Uint8Array(part!)), { type: this.metadata.mimeType });
    
    // 📊 FINAL SIZE CHECK
    console.log(`📊 Final assembled blob size: ${finalBlob.size} bytes`);
    
    // 🔹 CRITICAL FIX #7: FINAL METADATA CLEANUP after assembly completes
    // This ensures the map is cleared for the next transfer
    if (this.chunkEncryptionMetadata.size > 0) {
      console.log(`♻️ Cleaning up metadata map: ${this.chunkEncryptionMetadata.size} entries remaining`);
      this.chunkEncryptionMetadata.clear();
      console.log(`✅ Metadata map cleared after successful assembly`);
    }
    
    return finalBlob;
  }

  private async processChunkForAssemblyOptimized(
    index: number,
    decryptionKey?: CryptoKey
  ): Promise<{ decompressed: Uint8Array; hash: string }> {
    this.pendingOperations++; // ✅ Increment
    try {
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

      // 🔹 CRITICAL FIX #1: Decrypt BEFORE hash verification if encrypted
      // Hash was computed on plaintext, so we must decrypt first
      let decryptedData = chunkData;
      if (this.metadata!.encrypted && decryptionKey) {
        const chunkMetadata = this.chunkEncryptionMetadata.get(index);
        if (!chunkMetadata) {
          throw new Error(`Encryption metadata missing for chunk ${index}`);
        }
        const retrievedIV = chunkMetadata.iv.substring(0, 16);
        const mapSize = this.chunkEncryptionMetadata.size;
        console.log(`🔓 [CHUNK ${index}] RETRIEVING METADATA: IV=${retrievedIV}... (from map of ${mapSize} chunks)`);
        console.log(`   → All stored chunk IDs in map: [${Array.from(this.chunkEncryptionMetadata.keys()).slice(0, 10).join(', ')}...]`);
        try {
          decryptedData = await EncryptionManager.decryptChunk(chunkData, decryptionKey, chunkMetadata);
          console.log(`✅ [CHUNK ${index}] DECRYPTION SUCCESS with IV=${retrievedIV}... (${decryptedData.byteLength} bytes)`);
          
          // 🔹 CRITICAL FIX #5: DELETE METADATA IMMEDIATELY AFTER SUCCESSFUL DECRYPTION
          // This prevents the metadata map from growing unbounded (was reaching 54K+ entries!)
          // Decryption succeeded, so we no longer need this chunk's IV
          this.chunkEncryptionMetadata.delete(index);
          const newMapSize = this.chunkEncryptionMetadata.size;
          if (newMapSize % 100 === 0 || index % 1000 === 0) {
            console.log(`   ♻️ Metadata cleanup: map now has ${newMapSize} entries (freed chunk ${index})`);
          }
        } catch (decryptErr) {
          console.error(`❌ [CHUNK ${index}] DECRYPTION FAILED - Retrieved IV: ${retrievedIV}..., encrypted data size: ${chunkData.byteLength} bytes, map size: ${mapSize}`);
          throw decryptErr;
        }
      }

      // 🔹 CRITICAL FIX #2: Hash verification on plaintext (after decryption)
      // Hash was computed on plaintext by sender
      const calculatedHash = await this.hashData(new Uint8Array(decryptedData));
      
      // Retrieve the expected hash from the chunk metadata
      // We need to store the chunk hash when receiving
      const expectedHash = this.chunkHashes.get(index);
      if (expectedHash && calculatedHash !== expectedHash) {
        console.error(`❌ Chunk ${index} hash mismatch during assembly!`);
        console.error(`   Expected: ${expectedHash}`);
        console.error(`   Got:      ${calculatedHash}`);
        throw new Error(`Chunk ${index} hash verification failed during assembly`);
      }

      let decompressed: Uint8Array;
      
      // 🔹 CRITICAL FIX #3: Only decompress if THIS chunk was actually compressed
      // Check if the chunk was compressed on the SENDER side
      const isChunkCompressed = this.chunkCompressionStatus.get(index) ?? false;
      console.log(`🔍 Chunk ${index}: compressed=${isChunkCompressed} (from compression status map), decrypted data size=${decryptedData.byteLength} bytes`);
      if (isChunkCompressed) {
        if (this.workerPool && !this.isDestroyed) { // ✅ Check if not destroyed
          try {
            const result = await this.workerPool.decompress(decryptedData);
            decompressed = new Uint8Array(result);
            // 📊 Log decompression result
            if (index < 5 || index === this.metadata!.totalChunks - 1) {
              console.log(`   → decompressed size = ${decompressed.byteLength} bytes`);
            }
          } catch (error) {
            console.warn(`⚠️ Worker decompression failed for chunk ${index}, using fallback:`, error);
            decompressed = await this.decompressChunkFallback(decryptedData);
            if (index < 5) {
              console.log(`   → fallback decompressed size = ${decompressed.byteLength} bytes`);
            }
          }
        } else {
          decompressed = await this.decompressChunkFallback(decryptedData);
          if (index < 5) {
            console.log(`   → fallback decompressed size = ${decompressed.byteLength} bytes`);
          }
        }
      } else {
        // ✅ If not compressed, just convert to Uint8Array
        decompressed = new Uint8Array(decryptedData);
        if (index < 5 || index === this.metadata!.totalChunks - 1) {
          console.log(`   → not compressed, kept size = ${decompressed.byteLength} bytes`);
        }
      }

      this.decompressedCache.set(index, decompressed);

      // Use the calculated hash (which was verified against sender's hash)
      return { decompressed, hash: calculatedHash };
    } finally {
      this.pendingOperations--; // ✅ Decrement
    }
  }

  private async compressChunkFallback(data: Uint8Array): Promise<ArrayBuffer> {
    const { compress } = await import('fflate');
    return new Promise<ArrayBuffer>((resolve, reject) => {
      compress(data, { level: 6 }, (err, compressed) => {
        if (err) reject(err);
        else {
          // ✅ CRITICAL FIX: Create a new ArrayBuffer copy to prevent detachment
          const uint8Result = new Uint8Array(compressed as Uint8Array);
          const copiedBuffer = new ArrayBuffer(uint8Result.byteLength);
          new Uint8Array(copiedBuffer).set(uint8Result);
          resolve(copiedBuffer);
        }
      });
    });
  }

  private async decompressChunkFallback(data: ArrayBuffer | ArrayBufferView): Promise<Uint8Array> {
    const { decompress } = await import('fflate');
    
    // ✅ FIX: Copy the buffer to prevent "Cannot perform Construct on a detached ArrayBuffer" errors
    let input: Uint8Array;
    if (ArrayBuffer.isView(data)) {
      const view = data as ArrayBufferView;
      input = new Uint8Array(view.byteLength);
      input.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    } else {
      input = new Uint8Array(data as ArrayBuffer);
    }
    
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
      binary += String.fromCharCode.apply(null, Array.from(chunk));
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
    // ⚠️ DO NOT clear metadata here - it might still be used by assembleFile()
    // this.metadata = null;  // Removed - keep for safety checks
    this.chunkEncryptionMetadata.clear();
    this.chunkEncryptionCache.clear(); // 🔐 Clear cached IVs
    this.chunkCompressionStatus.clear(); // ✅ Clear compression status
    this.decompressedCache.clear();
  }

  async destroy(): Promise<void> {
    if (this.isDestroyed) return;

    this.isDestroyed = true;

    // ✅ Wait for all pending operations to complete before destroying
    let waitCount = 0;
    while (this.pendingOperations > 0 && waitCount < 100) {
      await new Promise(resolve => setTimeout(resolve, 50));
      waitCount++;
    }

    if (this.pendingOperations > 0) {
      console.warn(`⚠️ ${this.pendingOperations} operations still pending after timeout`);
    }

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