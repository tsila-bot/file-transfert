/**
 * Socket.IO Error Codes Handler
 * ✅ Codes d'erreur structurés reçus du backend
 */

export enum SOCKET_ERROR_CODES {
  // P2P Errors
  USER_OFFLINE = 'USER_OFFLINE',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  OFFER_DUPLICATE = 'OFFER_DUPLICATE',

  // Auth Errors
  AUTH_FAILED = 'AUTH_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Conversation Errors
  CONVERSATION_NOT_FOUND = 'CONVERSATION_NOT_FOUND',
  CONVERSATION_CREATE_FAILED = 'CONVERSATION_CREATE_FAILED',
  MESSAGE_SEND_FAILED = 'MESSAGE_SEND_FAILED',

  // Call Errors
  CALL_NOT_FOUND = 'CALL_NOT_FOUND',
  CALL_FAILED = 'CALL_FAILED',
  CALL_ALREADY_ACTIVE = 'CALL_ALREADY_ACTIVE',

  // Generic Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INVALID_DATA = 'INVALID_DATA',
}

export interface StructuredError {
  code: SOCKET_ERROR_CODES;
  message: string;
  [key: string]: any; // Additional context
}

/**
 * User-friendly error messages (French)
 */
export const ERROR_MESSAGES: Record<SOCKET_ERROR_CODES, string> = {
  [SOCKET_ERROR_CODES.USER_OFFLINE]: "L'utilisateur est hors ligne",
  [SOCKET_ERROR_CODES.USER_NOT_FOUND]: "Utilisateur introuvable",
  [SOCKET_ERROR_CODES.CONNECTION_FAILED]: "Échec de la connexion P2P",
  [SOCKET_ERROR_CODES.OFFER_DUPLICATE]: "Offre dupliquée ignorée",
  
  [SOCKET_ERROR_CODES.AUTH_FAILED]: "Authentification échouée",
  [SOCKET_ERROR_CODES.TOKEN_EXPIRED]: "Votre session a expiré",
  
  [SOCKET_ERROR_CODES.CONVERSATION_NOT_FOUND]: "Conversation introuvable",
  [SOCKET_ERROR_CODES.CONVERSATION_CREATE_FAILED]: "Impossible de créer la conversation",
  [SOCKET_ERROR_CODES.MESSAGE_SEND_FAILED]: "Impossible d'envoyer le message",
  
  [SOCKET_ERROR_CODES.CALL_NOT_FOUND]: "Appel introuvable",
  [SOCKET_ERROR_CODES.CALL_FAILED]: "Échec de l'appel",
  [SOCKET_ERROR_CODES.CALL_ALREADY_ACTIVE]: "Un appel est déjà actif",
  
  [SOCKET_ERROR_CODES.INTERNAL_ERROR]: "Erreur serveur",
  [SOCKET_ERROR_CODES.INVALID_DATA]: "Données invalides",
};

/**
 * Check if error has a structured code
 */
export function isStructuredError(error: any): error is StructuredError {
  return error && typeof error === 'object' && 'code' in error && error.code in SOCKET_ERROR_CODES;
}

/**
 * Get user-friendly message for error code
 */
export function getErrorMessage(code: SOCKET_ERROR_CODES): string {
  return ERROR_MESSAGES[code] || 'Une erreur est survenue';
}

/**
 * Handle structured error with logging and user feedback
 */
export function handleStructuredError(error: StructuredError): void {
  console.error(`❌ [${error.code}] ${error.message}`, error);
  
  // Route-specific handling could be added here
  switch (error.code) {
    case SOCKET_ERROR_CODES.USER_OFFLINE:
      console.warn(`⚠️ Peer is offline: ${error.targetUserId}`);
      break;
    case SOCKET_ERROR_CODES.TOKEN_EXPIRED:
      console.warn('⚠️ Token expired, user needs to re-authenticate');
      break;
    case SOCKET_ERROR_CODES.CONNECTION_FAILED:
      console.warn('⚠️ P2P connection failed');
      break;
    default:
      break;
  }
}
