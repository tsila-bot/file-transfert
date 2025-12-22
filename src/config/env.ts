// lib/config/env.ts

export const ENV = {
  // API
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000',

  // WebRTC
  STUN_SERVERS: (process.env.NEXT_PUBLIC_STUN_SERVERS || '')
    .split(',')
    .map((url) => ({ urls: url.trim() })),
  TURN_SERVER: {
    urls: process.env.NEXT_PUBLIC_TURN_URL || 'turn:localhost:3478',
    username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'webdevin',
    credential: process.env.NEXT_PUBLIC_TURN_PASSWORD || 'password',
  },


  // Feature Flags
  FEATURES: {
    cloudIntegrations:
      process.env.NEXT_PUBLIC_ENABLE_CLOUD_INTEGRATIONS === 'true',
    videoCall: process.env.NEXT_PUBLIC_ENABLE_VIDEO_CALL === 'true',
    multiSourceTransfer:
      process.env.NEXT_PUBLIC_ENABLE_MULTI_SOURCE_TRANSFER === 'true',
    publicLinks: process.env.NEXT_PUBLIC_ENABLE_PUBLIC_LINKS === 'true',
  },

  // App Config
  APP: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'APPWEBP2P',
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    maxFileSize: parseInt(
      process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '5368709120'
    ), // 5 GB
    chunkSize: parseInt(process.env.NEXT_PUBLIC_CHUNK_SIZE || '1048576'), // 1 MB
  },

  // Analytics
  ANALYTICS: {
    id: process.env.NEXT_PUBLIC_ANALYTICS_ID,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },

  // Environment
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};

// Validation des variables d'environnement requises
export function validateEnv() {
  const required = ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_WS_URL'];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

// Appeler au démarrage de l'application
if (typeof window === 'undefined') {
  validateEnv();
}