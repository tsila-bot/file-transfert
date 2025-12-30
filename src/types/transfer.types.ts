// types/transfer.types.ts

import { EncryptionMetadata } from '@/core/crypto/encryption';

/**
 * Représente un chunk de fichier
 */
export interface Chunk {
  index: number;
  data: ArrayBuffer;
  hash: string;
  size: number;
  compressed?: boolean;
  encrypted?: boolean;
  encryptionMetadata?: EncryptionMetadata; // ✅ Métadonnées de chiffrement (IV, salt, etc.)
}

/**
 * Métadonnées d'un fichier à transférer
 */
export interface ChunkMetadata {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  totalChunks: number;
  chunkSize: number;
  mimeType: string;
  encrypted: boolean;
  passwordProtected: boolean;
  encryptionKey?: string;  // ✅ Clé de chiffrement exportée en base64
  encryptionSalt?: string; // ✅ Salt pour dérivation de clé depuis mot de passe
  timestamp: number;
}

/**
 * Métadonnées de reprise d'un transfert
 */
export interface TransferResumeMetadata {
  resumedAt?: Date;
  resumeCount?: number;
  lastSavedAt?: Date;
}

/**
 * Accusé de réception d'un chunk
 */
export interface ChunkAck {
  fileId: string;        // Nécessaire pour identifier le transfert
  index: number;
  received: boolean;
  hash?: string;         // Optionnel car pas toujours envoyé en cas de NACK
}

/**
 * Progression d'un transfert
 */
export interface TransferProgress {
  fileId: string;
  chunksReceived: number;
  chunksTotal: number;
  bytesReceived: number;
  bytesTotal: number;
  percentage: number;
  speed: number;         // bytes/sec
  eta: number;           // seconds
}

/**
 * Statuts possibles d'un transfert
 */
export type TransferStatus =
  | 'pending'      // En attente d'acceptation
  | 'active'       // Transfert en cours
  | 'paused'       // Transfert en pause
  | 'completed'    // Transfert terminé avec succès
  | 'failed'       // Transfert échoué
  | 'cancelled';   // Transfert annulé

/**
 * Représente un transfert de fichier complet
 */
export interface Transfer {
  id: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  mimeType: string;
  direction: 'send' | 'receive';
  peerId: string;
  peerName: string;
  status: TransferStatus;
  progress: TransferProgress;
  startedAt: Date;
  completedAt?: Date;
  error?: string;

  // ✅ Métadonnées du fichier transféré (chiffrement, compression, etc.)
  metadata?: ChunkMetadata;

  // ✅ Métadonnées de reprise du transfert (compteur de reprises, dates)
  resumeMetadata?: TransferResumeMetadata;
}

/**
 * Options pour créer un transfert
 */
export interface TransferOptions {
  compress?: boolean;
  encrypt?: boolean;
  password?: string;
  chunkSize?: number;
}

/**
 * Statistiques d'un transfert
 */
export interface TransferStats {
  transferId: string;
  duration: number;           // ms
  averageSpeed: number;       // bytes/sec
  peakSpeed: number;          // bytes/sec
  retries: number;
  chunksLost: number;
  compressionRatio?: number;  // Si compression activée
}