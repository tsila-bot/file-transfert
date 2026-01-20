// lib/config/webrtc.ts

import { ENV } from './env';

export interface ICEServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export const ICE_SERVERS: ICEServer[] = [
  // Serveurs STUN publics de Google
  ...ENV.STUN_SERVERS,
  // Serveurs STUN alternatifs (fallback si les premiers échouent)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.l.google.com:19301' },
  { urls: 'stun:stun.services.mozilla.com:3478' },
  { urls: 'stun:stun1.services.mozilla.com:3478' },
  // Serveur TURN (pour NAT traversal) si configuré
  ...(ENV.TURN_SERVER ? [ENV.TURN_SERVER] : []),
];

export const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceTransportPolicy: 'all', // Essayer tous les chemins (direct, STUN, TURN)
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

// Configuration du Data Channel
export const DATA_CHANNEL_CONFIG: RTCDataChannelInit = {
  ordered: true, // Assurer l'ordre des messages pour l'intégrité des données
  maxRetransmits: 5, // Plus de retransmissions pour la fiabilité
};

// Constantes
// Increase default connection timeout to 10 minutes (ms)
export const CONNECTION_TIMEOUT = 600000; // 10 minutes
export const HEARTBEAT_INTERVAL = 5000; // 5 secondes
export const MAX_RECONNECT_ATTEMPTS = 3;