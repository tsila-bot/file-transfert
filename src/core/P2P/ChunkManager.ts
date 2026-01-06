// lib/p2p/ChunkManager.ts

import { compress, decompress } from 'fflate';
import { Chunk, ChunkMetadata } from '@/types/transfer.types';
import { EncryptionManager, EncryptedData, EncryptionMetadata } from '@/core/crypto/encryption';

export class ChunkManager {
  private chunkSize: number;
  private bitmap: boolean[];
  private chunks: Map<number, ArrayBuffer>;
  private metadata: ChunkMetadata | null = null;
  private chunkEncryptionMetadata: Map<number, EncryptionMetadata> = new Map();

  // Default chunk size lowered to 128 KB to reduce per-message size over SCTP
  constructor(chunkSize: number = 128 * 1024) {
    this.chunkSize = chunkSize;
    this.bitmap = [];
    this.chunks = new Map();
  }

  /**
   * Découper un fichier en chunks (avec chiffrement optionnel)
   */
  async splitFile(
    file: File,
    options?: { encrypt?: boolean; password?: string; encryptionKey?: CryptoKey }
  ): Promise<{
    chunks: Chunk[];
    metadata: ChunkMetadata;
  }> {
    console.log(`📦 Splitting file: ${file.name} (${file.size} bytes)`);

    const totalChunks = Math.ceil(file.size / this.chunkSize);
    const chunks: Chunk[] = [];
    const fileId = this.generateFileId();

    // Calculer le hash du fichier complet
    const fileBuffer = await file.arrayBuffer();
    const fileHash = await this.hashData(new Uint8Array(fileBuffer));

    // ✅ Générer ou utiliser une clé de chiffrement
    let encryptionKey: CryptoKey | null = null;
    let encryptionSalt: Uint8Array | null = null;
    let exportedKey: string | undefined;

    if (options?.encrypt) {
      if (options.password) {
        // Dériver une clé depuis le mot de passe
        const result = await EncryptionManager.deriveKeyFromPassword(options.password);
        encryptionKey = result.key;
        encryptionSalt = result.salt;
      } else if (options.encryptionKey) {
        // Utiliser la clé fournie
        encryptionKey = options.encryptionKey;
      } else {
        // Générer une clé aléatoire
        encryptionKey = await EncryptionManager.generateKey();
        exportedKey = await EncryptionManager.exportKey(encryptionKey);
      }
    }

    // Découper en chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, file.size);
      const blob = file.slice(start, end);
      let arrayBuffer = await blob.arrayBuffer();

      // Compresser le chunk
      const compressed = await this.compressChunk(new Uint8Array(arrayBuffer));
      let finalData = this.toArrayBuffer(compressed.buffer);
      let encryptionMetadata: EncryptionMetadata | undefined;

      // ✅ Chiffrer le chunk si demandé
      if (encryptionKey) {
        const encrypted: EncryptedData = await EncryptionManager.encryptChunk(
          finalData,
          encryptionKey
        );
        finalData = encrypted.data;
        encryptionMetadata = encrypted.metadata;
      }

      // Calculer le hash du chunk final (compressé et chiffré)
      const hash = await this.hashData(new Uint8Array(finalData));

      chunks.push({
        index: i,
        data: finalData,
        hash,
        size: finalData.byteLength,
        compressed: true,
        encrypted: !!encryptionKey,
        encryptionMetadata,
      });

      // Afficher progression
      if ((i + 1) % 100 === 0 || i === totalChunks - 1) {
        console.log(`Split progress: ${i + 1}/${totalChunks}`);
      }
    }

    // Créer les métadonnées
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

    console.log(`✅ File split complete: ${totalChunks} chunks (encrypted: ${metadata.encrypted})`);

    return { chunks, metadata };
  }

  /**
   * Initialiser le manager avec des métadonnées
   */
  setMetadata(metadata: ChunkMetadata): void {
    this.metadata = metadata;
    this.bitmap = new Array(metadata.totalChunks).fill(false);
    this.chunks.clear();
    this.chunkEncryptionMetadata.clear();
  }

  /**
   * Recevoir un chunk (avec métadonnées de chiffrement)
   */
  async receiveChunk(chunk: Chunk): Promise<boolean> {
    if (!this.metadata) {
      throw new Error('Metadata not set');
    }

    // Vérifier l'index
    if (chunk.index < 0 || chunk.index >= this.metadata.totalChunks) {
      throw new Error(`Invalid chunk index: ${chunk.index}`);
    }

    const chunkData = this.toArrayBuffer(chunk.data);

    // Vérifier le hash
    const calculatedHash = await this.hashData(new Uint8Array(chunkData));
    if (calculatedHash !== chunk.hash) {
      throw new Error(`Chunk ${chunk.index} hash mismatch`);
    }

    // ✅ Stocker les métadonnées de chiffrement
    if (chunk.encryptionMetadata) {
      this.chunkEncryptionMetadata.set(chunk.index, chunk.encryptionMetadata);
    }

    // Stocker le chunk
    this.chunks.set(chunk.index, chunkData);
    this.bitmap[chunk.index] = true;

    try {
      const view = new Uint8Array(chunkData);
      const snippet = Array.from(view.subarray(0, Math.min(8, view.length))).
        map((b) => b.toString(16).padStart(2, '0')).join(' ');
      console.log(`📥 Received chunk ${chunk.index}: ${view.byteLength} bytes, first8: ${snippet}`);
    } catch (e) {
      console.log(`📥 Received chunk ${chunk.index}: ${chunkData.byteLength} bytes`);
    }

    return true;
  }

  /**
   * Assembler le fichier complet (avec déchiffrement)
   */
  async assembleFile(decryptionKey?: CryptoKey): Promise<Blob> {
    if (!this.metadata) {
      throw new Error('Metadata not set');
    }

    if (!this.isComplete()) {
      throw new Error('Not all chunks received');
    }

    console.log('🔧 Assembling file...');

    const decompressedChunks: Uint8Array[] = [];

    // Décompresser et déchiffrer tous les chunks dans l'ordre
    for (let i = 0; i < this.metadata.totalChunks; i++) {
      let chunkData = this.chunks.get(i);
      if (!chunkData) {
        throw new Error(`Chunk ${i} missing`);
      }

      // ✅ Déchiffrer si nécessaire
      if (this.metadata.encrypted && decryptionKey) {
        const chunkMetadata = this.getChunkEncryptionMetadata(i);

        if (!chunkMetadata) {
          throw new Error(`Encryption metadata missing for chunk ${i}`);
        }

        chunkData = await EncryptionManager.decryptChunk(
          chunkData,
          decryptionKey,
          chunkMetadata
        );
      }

      // Debug: log chunk before decompression
      try {
        const view = new Uint8Array(chunkData);
        const snippet = Array.from(view.subarray(0, Math.min(8, view.length))).
          map((b) => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`🔧 Decompressing chunk ${i}: ${view.byteLength} bytes, first8: ${snippet}, decrypted=${!!decryptionKey}`);
      } catch (e) {
        console.log(`🔧 Decompressing chunk ${i}`);
      }

      try {
        const decompressed = await this.decompressChunk(new Uint8Array(chunkData));
        decompressedChunks.push(decompressed);
      } catch (err) {
        try {
          const view = new Uint8Array(chunkData);
          const snippet = Array.from(view.subarray(0, Math.min(8, view.length))).
            map((b) => b.toString(16).padStart(2, '0')).join(' ');
          console.error(`❌ Decompression failed for chunk ${i}:`, err, 'first8:', snippet);
        } catch (e) {
          console.error(`❌ Decompression failed for chunk ${i}:`, err);
        }
        throw err;
      }

      // Afficher progression
      if ((i + 1) % 100 === 0 || i === this.metadata.totalChunks - 1) {
        console.log(`Assemble progress: ${i + 1}/${this.metadata.totalChunks}`);
      }
    }

    // Calculer la taille totale
    const totalSize = decompressedChunks.reduce(
      (sum, chunk) => sum + chunk.length,
      0
    );

    // Créer un buffer unique
    const fileData = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of decompressedChunks) {
      fileData.set(chunk, offset);
      offset += chunk.length;
    }

    // Vérifier le hash final
    const finalHash = await this.hashData(fileData);
    if (finalHash !== this.metadata.fileHash) {
      throw new Error('Final file hash mismatch');
    }

    console.log('✅ File assembled successfully');

    return new Blob([fileData], { type: this.metadata.mimeType });
  }

  /**
   * Obtenir la progression
   */
  getProgress(): number {
    if (!this.metadata) return 0;

    const received = this.bitmap.filter(Boolean).length;
    return (received / this.metadata.totalChunks) * 100;
  }

  /**
   * Vérifier si le transfert est complet
   */
  isComplete(): boolean {
    if (!this.metadata) return false;
    return this.bitmap.every((received) => received);
  }

  /**
   * Obtenir les chunks manquants
   */
  getMissingChunks(): number[] {
    return this.bitmap
      .map((received, index) => (received ? -1 : index))
      .filter((index) => index !== -1);
  }

  /**
   * Obtenir le nombre de chunks reçus
   */
  getReceivedChunks(): number {
    return this.bitmap.filter(Boolean).length;
  }

  /**
   * ✅ Obtenir les métadonnées de chiffrement d'un chunk
   */
  private getChunkEncryptionMetadata(index: number): EncryptionMetadata | undefined {
    return this.chunkEncryptionMetadata.get(index);
  }

  /**
   * Compresser un chunk
   */
  private async compressChunk(data: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      compress(data, { level: 6 }, (err, compressed) => {
        if (err) reject(err);
        else resolve(compressed);
      });
    });
  }

  /**
   * Décompresser un chunk
   */
  private async decompressChunk(data: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      decompress(data, (err, decompressed) => {
        if (err) reject(err);
        else resolve(decompressed);
      });
    });
  }

  /**
   * ✅ CORRECTION : Calculer le hash SHA-256 de données
   * Convertit en ArrayBuffer natif pour compatibilité TypeScript stricte
   */
  private async hashData(data: Uint8Array): Promise<string> {
    // Créer un nouveau ArrayBuffer natif pour éviter les problèmes de type
    const buffer = new Uint8Array(data).buffer;
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Convertir ArrayBufferLike en ArrayBuffer
   */
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

  /**
   * ✅ Convertir ArrayBuffer en base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferLike): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Générer un ID de fichier unique
   */
  private generateFileId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Réinitialiser le manager
   */
  reset(): void {
    this.bitmap = [];
    this.chunks.clear();
    this.metadata = null;
    this.chunkEncryptionMetadata.clear();
  }
}