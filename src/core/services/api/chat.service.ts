// frontend/src/core/services/api/chat.service.ts

import { apiClient } from './client.service';
import type { GroupMessage } from '@/types/types';

export interface ChatMessage {
  id: string;
  userId: string;
  message: string;
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  isEdited?: boolean;
}

export interface Conversation {
  id: string;
  userId: string;
  userName: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
}

export interface SendMessageData {
  message: string;
  receiverId?: string;
  messageType?: string;
}

export interface CreateConversationData {
  userId: string;
}

export interface UpdateMessageData {
  message: string;
}

export interface TypingIndicatorData {
  conversationId: string;
  isTyping: boolean;
}

export const chatAPI = {
  /**
   * Envoyer un message de groupe
   */
  async sendGroupMessage(
    teamId: string,
    message: string,
    messageType: string = 'TEXT'
  ): Promise<{ success: boolean; data: GroupMessage }> {
    const response = await apiClient.post(`/api/chat/teams/${teamId}/messages`, {
      message,
      messageType,
    });
    return response.data;
  },

  /**
   * Récupérer les messages de groupe
   */
  async getGroupMessages(
    teamId: string,
    skip: number = 0,
    take: number = 50
  ): Promise<{ success: boolean; data: { messages: GroupMessage[]; total: number } }> {
    const response = await apiClient.get(`/api/chat/teams/${teamId}/messages`, {
      params: { skip, take },
    });
    return response.data;
  },

  /**
   * Envoyer un message direct
   */
  async sendDirectMessage(data: SendMessageData): Promise<{ success: boolean; data: ChatMessage }> {
    const response = await apiClient.post('/api/chat/messages', data);
    return response.data;
  },

  /**
   * Récupérer l'historique de messages
   */
  async getConversationMessages(
    conversationId: string,
    skip: number = 0,
    take: number = 50
  ): Promise<{ success: boolean; data: { messages: ChatMessage[]; total: number } }> {
    const response = await apiClient.get(`/api/chat/conversations/${conversationId}/messages`, {
      params: { skip, take },
    });
    return response.data;
  },

  /**
   * Éditer un message
   */
  async editMessage(messageId: string, data: UpdateMessageData): Promise<{ success: boolean; data: ChatMessage }> {
    const response = await apiClient.put(`/api/chat/messages/${messageId}`, data);
    return response.data;
  },

  /**
   * Supprimer un message
   */
  async deleteMessage(messageId: string): Promise<{ success: boolean }> {
    const response = await apiClient.delete(`/api/chat/messages/${messageId}`);
    return response.data;
  },

  /**
   * Récupérer les conversations de l'utilisateur
   */
  async getConversations(
    skip: number = 0,
    take: number = 50
  ): Promise<{ success: boolean; data: { conversations: Conversation[]; total: number } }> {
    const response = await apiClient.get('/api/chat/conversations', {
      params: { skip, take },
    });
    return response.data;
  },
};
