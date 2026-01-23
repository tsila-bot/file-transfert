// frontend/src/core/services/api/index.ts
// Centralized export of all API services for easy imports

export { apiClient } from './client.service';
export { authAPI } from './auth.service';
export { usersAPI } from './users.service';
export { chatAPI } from './chat.service';
export { callAPI } from './call.service';
export { teamService } from './team.service';
export { transferAPI } from './transfer.service';
export { publicLinkAPI } from './publicLink.service';

// Re-export types
export type { User, AuthResponse, LoginData, RegisterData } from './auth.service';
export type {
  UpdateProfileData,
  ChangePasswordData,
  UserPreferences,
  UserStats,
} from './users.service';
export type {
  ChatMessage,
  Conversation,
  SendMessageData,
  CreateConversationData,
  UpdateMessageData,
  TypingIndicatorData,
} from './chat.service';
export type {
  CallRecord,
  ActiveCall,
  InitiateCallData,
  RecordCallData,
  CallStats,
} from './call.service';
export type {
  CreateTeamData,
  UpdateTeamData,
  AddMemberData,
} from './team.service';
export type { Team, TeamMember } from '@/types/types';
export type { GroupMessage } from '@/types/types';
export type {
  FileTransfer,
  TransferOffer,
  InitiateTransferData,
  AcceptTransferData,
  RejectTransferData,
  TransferStats,
} from './transfer.service';
export type {
  PublicLink,
  PublicLinkStats,
  CreateLinkData,
  UpdateLinkData,
  DownloadLinkData,
} from './publicLink.service';
