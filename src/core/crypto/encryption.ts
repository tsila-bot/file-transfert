// lib/crypto/encryption.ts

/**
 * Module de chiffrement pour les transferts P2P
 * Utilise l'API Web Crypto (AES-GCM + PBKDF2)
 */

export interface EncryptionMetadata {
  iv: string; // Initialization Vector (base64)
  salt?: string; // Salt pour PBKDF2 (base64)
  algorithm: string; // "AES-GCM"
  keySize: number; // 256
}

export interface EncryptedData {
  data: ArrayBuffer;
  metadata: EncryptionMetadata;
}

export class EncryptionManager {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_SIZE = 256;
  private static readonly IV_LENGTH = 12; // 96 bits recommandé pour AES-GCM
  private static readonly SALT_LENGTH = 16; // 128 bits
  private static readonly PBKDF2_ITERATIONS = 100000; // Sécurisé mais pas trop lent

  /**
   * Générer une clé AES aléatoire
   */
  static async generateKey(): Promise<CryptoKey> {
    console.log('🔑 Generating random AES key...');

    const key = await crypto.subtle.generateKey(
      {
        name: this.ALGORITHM,
        length: this.KEY_SIZE,
      },
      true, // extractable (pour l'exporter si nécessaire)
      ['encrypt', 'decrypt']
    );

    return key;
  }

  /**
   * Dériver une clé depuis un mot de passe (PBKDF2)
   */
  static async deriveKeyFromPassword(
    password: string,
    salt?: Uint8Array
  ): Promise<{ key: CryptoKey; salt: Uint8Array }> {
    console.log('🔐 Deriving key from password...');

    // Générer un salt aléatoire si non fourni
    const actualSalt = salt || crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));

    // Créer un nouveau Uint8Array pour garantir le bon type ArrayBuffer
    const normalizedSalt = new Uint8Array(actualSalt);

    // Encoder le mot de passe
    const passwordBuffer = new TextEncoder().encode(password);

    // Importer le mot de passe comme clé de base
    const baseKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Dériver la clé AES avec PBKDF2
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: normalizedSalt, // ✅ CORRECTION: Utiliser le salt normalisé
        iterations: this.PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      baseKey,
      {
        name: this.ALGORITHM,
        length: this.KEY_SIZE,
      },
      false, // non-extractable pour plus de sécurité
      ['encrypt', 'decrypt']
    );

    return { key: derivedKey, salt: actualSalt };
  }

  /**
   * Chiffrer des données
   */
  static async encrypt(
    data: ArrayBuffer,
    key: CryptoKey,
    existingMetadata?: EncryptionMetadata  // 🔐 CRITICAL: Accept pre-defined IV for retries
  ): Promise<EncryptedData> {
    // Suppress verbose logging during bulk operations
    // console.log(`🔒 Encrypting ${data.byteLength} bytes...`);

    // 🔐 If we have existing metadata (retry), use same IV instead of generating new one
    let iv: Uint8Array;
    let isRetry = false;
    if (existingMetadata) {
      isRetry = true;
      // console.log(`🔄 Using existing IV from metadata (retry)`);
      // ✅ FIX: Create a fresh ArrayBuffer and type it explicitly
      const decoded = this.base64ToArrayBuffer(existingMetadata.iv);
      const freshBuffer = new ArrayBuffer(decoded.byteLength);
      new Uint8Array(freshBuffer).set(new Uint8Array(decoded));
      iv = new Uint8Array(freshBuffer as ArrayBuffer);
    } else {
      // Générer un IV aléatoire
      iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    }

    // Chiffrer
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: this.ALGORITHM,
        iv: new Uint8Array(iv) as Uint8Array<ArrayBuffer>,
      },
      key,
      data
    );

    // ✅ CRITICAL FIX: Always create NEW metadata with encrypted buffer
    // 🔴 BUG FIX: When reusing IV from existingMetadata, we MUST NOT reuse metadata object
    // because it only contains IV, algorithm, keySize - it does NOT contain the encrypted data!
    // Reusing it causes the encryptedBuffer to be lost
    
    // Créer les métadonnées (toujours NEUF, jamais réutilisé)
    // ✅ FIX: Ensure iv.buffer is an ArrayBuffer, not ArrayBufferLike
    const ivBuffer = iv.buffer as ArrayBuffer;
    const metadata: EncryptionMetadata = {
      iv: this.arrayBufferToBase64(ivBuffer),
      algorithm: this.ALGORITHM,
      keySize: this.KEY_SIZE,
    };

    // Suppress verbose logging
    // console.log(`✅ Encrypted successfully (${encryptedBuffer.byteLength} bytes)`);

    return {
      data: encryptedBuffer,
      metadata,
    };
  }

  /**
   * Déchiffrer des données
   */
  static async decrypt(
    encryptedData: ArrayBuffer,
    key: CryptoKey,
    metadata: EncryptionMetadata
  ): Promise<ArrayBuffer> {
    // Suppress verbose logging during bulk operations
    // console.log(`🔓 Decrypting ${encryptedData.byteLength} bytes...`);

    // Décoder l'IV
    const iv = this.base64ToArrayBuffer(metadata.iv);

    // Déchiffrer
    try {
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: metadata.algorithm,
          iv: new Uint8Array(iv),
        },
        key,
        encryptedData
      );

      // Suppress verbose logging
      // console.log(`✅ Decrypted successfully (${decryptedBuffer.byteLength} bytes)`);

      return decryptedBuffer;
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      throw new Error('Decryption failed. Wrong key or corrupted data.');
    }
  }

  /**
   * Chiffrer un chunk avec une clé
   */
  static async encryptChunk(
    chunkData: ArrayBuffer,
    key: CryptoKey,
    existingMetadata?: EncryptionMetadata  // 🔐 For retries with same IV
  ): Promise<EncryptedData> {
    return this.encrypt(chunkData, key, existingMetadata);
  }

  /**
   * Déchiffrer un chunk avec une clé
   */
  static async decryptChunk(
    encryptedChunk: ArrayBuffer,
    key: CryptoKey,
    metadata: EncryptionMetadata
  ): Promise<ArrayBuffer> {
    return this.decrypt(encryptedChunk, key, metadata);
  }

  /**
   * Exporter une clé pour la stocker ou la partager
   */
  static async exportKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('raw', key);
    return this.arrayBufferToBase64(exported);
  }

  /**
   * Importer une clé depuis une string base64
   */
  static async importKey(keyBase64: string): Promise<CryptoKey> {
    const keyBuffer = this.base64ToArrayBuffer(keyBase64);

    return crypto.subtle.importKey(
      'raw',
      keyBuffer,
      {
        name: this.ALGORITHM,
        length: this.KEY_SIZE,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Générer un hash SHA-256 d'une clé (pour vérification)
   */
  static async hashKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('raw', key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', exported);
    return this.arrayBufferToBase64(hashBuffer);
  }

  /**
   * Utilitaires de conversion
   */
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    // ✅ FIX: Ensure we return a proper ArrayBuffer, not ArrayBufferLike
    return bytes.buffer as ArrayBuffer;
  }
}

// Export des fonctions standalone pour simplicité
export const generateKey = () => EncryptionManager.generateKey();
export const deriveKeyFromPassword = (password: string, salt?: Uint8Array) =>
  EncryptionManager.deriveKeyFromPassword(password, salt);
export const encrypt = (data: ArrayBuffer, key: CryptoKey) =>
  EncryptionManager.encrypt(data, key);
export const decrypt = (
  encryptedData: ArrayBuffer,
  key: CryptoKey,
  metadata: EncryptionMetadata
) => EncryptionManager.decrypt(encryptedData, key, metadata);
export const exportKey = (key: CryptoKey) => EncryptionManager.exportKey(key);
export const importKey = (keyBase64: string) => EncryptionManager.importKey(keyBase64);
export const hashKey = (key: CryptoKey) => EncryptionManager.hashKey(key);