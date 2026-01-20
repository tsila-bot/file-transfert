// frontend/src/core/services/api/chat.service.ts

import { apiClient } from './client.service';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isRead: boolean;
  readAt?: string;
}

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageData {
  conversationId: string;
  content: string;
}

export interface CreateConversationData {
  userId: string;
}

export interface UpdateMessageData {
  content: string;
}

export interface TypingIndicatorData {
  conversationId: string;
  isTyping: boolean;
}

export const chatAPI = {
  /**
   * Récupérer les messages d'une conversation
   */
  async getMessages(
    conversationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ messages: ChatMessage[]; total: number }> {
    const response = await apiClient.get(`/api/chat/conversations/${conversationId}/messages`, {
      params: { limit, offset },
    });
    return response.data;
  },

  /**
   * Envoyer un message
   */
  async sendMessage(data: SendMessageData): Promise<{ message: ChatMessage }> {
    const response = await apiClient.post('/api/chat/messages', data);
    return response.data;
  },

  /**
   * Supprimer un message
   */
  async deleteMessage(messageId: string): Promise<{ message: string }> {
    const response = await apiClient.delete(`/api/chat/messages/${messageId}`);
    return response.data;
  },

  /**
   * Modifier un message
   */
  async updateMessage(
    messageId: string,
    data: UpdateMessageData
  ): Promise<{ message: ChatMessage }> {
    const response = await apiClient.patch(`/api/chat/messages/${messageId}`, data);
    return response.data;
  },

  /**
   * Récupérer toutes les conversations
   */
  async getConversations(
    limit: number = 20,
    offset: number = 0
  ): Promise<{ conversations: Conversation[]; total: number }> {
    const response = await apiClient.get('/api/chat/conversations', {
      params: { limit, offset },
    });
    return response.data;
  },

  /**
   * Créer une nouvelle conversation
   */
  async createConversation(data: CreateConversationData): Promise<{ conversation: Conversation }> {
    const response = await apiClient.post('/api/chat/conversations', data);
    return response.data;
  },

  /**
   * Supprimer une conversation
   */
  async deleteConversation(conversationId: string): Promise<{ message: string }> {
    const response = await apiClient.delete(`/api/chat/conversations/${conversationId}`);
    return response.data;
  },

  /**
   * Marquer les messages comme lus
   */
  async markAsRead(conversationId: string): Promise<{ message: string }> {
    const response = await apiClient.patch(
      `/api/chat/conversations/${conversationId}/mark-read`
    );
    return response.data;
  },

  /**
   * Envoyer une indication de saisie
   */
  async sendTypingIndicator(data: TypingIndicatorData): Promise<void> {
    await apiClient.post('/api/chat/typing-indicator', data);
  },

  /**
   * Récupérer les utilisateurs actuellement en train de taper
   */
  async getTypingUsers(conversationId: string): Promise<{ users: string[] }> {
    const response = await apiClient.get(`/api/chat/conversations/${conversationId}/typing-users`);
    return response.data;
  },
};
