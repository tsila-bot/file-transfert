// lib/config/env.ts

export const ENV = {
  // API
  API_URL: 'https://appwebp2pbackend.onrender.com',
  WS_URL: 'https://appwebp2pbackend.onrender.com',

  // WebRTC
  STUN_SERVERS: (process.env.NEXT_PUBLIC_STUN_SERVERS ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) => ({ urls: url })),

  TURN_SERVER: process.env.NEXT_PUBLIC_TURN_URL
    ? {
        urls: process.env.NEXT_PUBLIC_TURN_URL,
        username: process.env.NEXT_PUBLIC_TURN_USERNAME,
        credential: process.env.NEXT_PUBLIC_TURN_PASSWORD,
      }
    : null,

  // Feature Flags
  FEATURES: {
    cloudIntegrations: process.env.NEXT_PUBLIC_ENABLE_CLOUD_INTEGRATIONS === 'true',
    videoCall: process.env.NEXT_PUBLIC_ENABLE_VIDEO_CALL === 'true',
    multiSourceTransfer: process.env.NEXT_PUBLIC_ENABLE_MULTI_SOURCE_TRANSFER === 'true',
    publicLinks: process.env.NEXT_PUBLIC_ENABLE_PUBLIC_LINKS === 'true',
  },

  // App Config
  APP: {
    name: process.env.NEXT_PUBLIC_APP_NAME ?? 'APPWEBP2P',
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0',
    maxFileSize: Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE ?? '5368709120'), // 5 GB
    chunkSize: Number(process.env.NEXT_PUBLIC_CHUNK_SIZE ?? '1048576'), // 1 MB
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

/**
 * Validation RUNTIME UNIQUEMENT (client)
 * JAMAIS au build / SSR
 */
export function validateEnvClient() {
  if (!ENV.API_URL || !ENV.WS_URL) {
    console.error('Missing runtime env vars: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL');
  }
}
