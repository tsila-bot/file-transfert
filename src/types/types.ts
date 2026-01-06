export type ConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

export interface PeerConnectionOptions {
  peerId: string;
  peerName: string;
  isInitiator: boolean;
  onStateChange?: (state: ConnectionState) => void;
  onDataChannelOpen?: () => void;
  onDataChannelClose?: () => void;
  onData?: (data: any) => void;
  onError?: (error: Error) => void;
  connectionTimeout?: number; // override default connection timeout (ms)
  maxRetries?: number; // number of automatic reconnect attempts on timeout/failure
}

export interface ConnectionStats {
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  currentRoundTripTime?: number;
  availableOutgoingBitrate?: number;
}

export interface SignalData {
  type: 'offer' | 'answer';
  sdp: string;
}

export type MessageType =
  | 'chat'            // Message de chat
  | 'metadata'        // Métadonnées de fichier
  | 'chunk'           // Morceau de fichier
  | 'ack'             // Accusé de réception général
  | 'heartbeat'       // Ping pour vérifier la connexion
  | 'heartbeat_ack'   // Réponse au heartbeat
  | 'transfer_sync'   // Synchronisation de transfert
  | 'resume_request'  // Demande de reprise
  | 'resume_ack';     // Accusé de reprise

export interface Message {
  type: MessageType;
  data: any;
  timestamp?: number;    // Optionnel : timestamp du message
  sequence?: number;     // Optionnel : numéro de séquence
  transferId?: string;   // Optionnel : ID du transfert concerné
}

// Interfaces supplémentaires pour une meilleure typage des données
export interface ChatData {
  text: string;
  sender: string;
  timestamp: number;
}

export interface FileMetadata {
  fileName: string;
  fileSize: number;
  fileType: string;
  fileId: string;
  totalChunks: number;
  chunkSize: number;
}

export interface ChunkData {
  chunkIndex: number;
  totalChunks: number;
  data: ArrayBuffer | string;
  transferId: string;
  fileId: string;
}

export interface AckData {
  messageId?: string;
  chunkIndex?: number;
  transferId?: string;
  status: 'received' | 'error' | 'complete';
}

export interface HeartbeatData {
  timestamp: number;
  connectionId: string;
}

export interface TransferSyncData {
  transferId: string;
  progress: number;
  currentChunk: number;
  totalChunks: number;
}

export interface ResumeRequestData {
  transferId: string;
  fromChunk: number;
}

export interface ResumeAckData {
  transferId: string;
  accepted: boolean;
  resumeFrom?: number;
  reason?: string;
}