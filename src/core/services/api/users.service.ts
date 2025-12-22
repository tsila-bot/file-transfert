// lib/api/users.ts

import { apiClient } from './client.service';
import { User } from './auth.service';

export interface UpdateProfileData {
  name?: string;
  avatar?: string | null;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface UserPreferences {
  language: 'fr' | 'en' | 'es' | 'de';
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    push: boolean;
    transferComplete: boolean;
    newConnection: boolean;
    groupInvite: boolean;
  };
}

export interface UserStats {
  totalTransfers: number;
  totalVolumeBytes: string;
  averageSpeed: number;
  successRate: number;
  groupsCount: number;
  publicLinksCount: number;
}

export const usersAPI = {
  /**
   * Récupérer le profil de l'utilisateur connecté
   */
  async getMe(): Promise<{ user: User }> {
    const response = await apiClient.get('/api/users/me');
    return response.data;
  },

  /**
   * Récupérer un utilisateur par ID
   */
  async getUserById(id: string): Promise<{ user: Partial<User> }> {
    const response = await apiClient.get(`/api/users/${id}`);
    return response.data;
  },

  /**
   * Mettre à jour le profil
   */
  async updateProfile(data: UpdateProfileData): Promise<{ user: User }> {
    const response = await apiClient.patch('/api/users/me', data);
    return response.data;
  },

  /**
   * Changer le mot de passe
   */
  async changePassword(data: ChangePasswordData): Promise<{ message: string }> {
    const response = await apiClient.post('/api/users/change-password', data);
    return response.data;
  },

  /**
   * Récupérer les préférences
   */
  async getPreferences(): Promise<{ preferences: UserPreferences }> {
    const response = await apiClient.get('/api/users/preferences');
    return response.data;
  },

  /**
   * Mettre à jour les préférences
   */
  async updatePreferences(
    data: Partial<UserPreferences>
  ): Promise<{ preferences: UserPreferences }> {
    const response = await apiClient.patch('/api/users/preferences', data);
    return response.data;
  },

  /**
   * Rechercher des utilisateurs
   */
  async searchUsers(
    query: string,
    limit: number = 10
  ): Promise<{ users: Partial<User>[] }> {
    const response = await apiClient.get('/api/users/search', {
      params: { query, limit },
    });
    return response.data;
  },

  /**
   * Récupérer les statistiques
   */
  async getStats(): Promise<{ stats: UserStats }> {
    const response = await apiClient.get('/api/users/stats');
    return response.data;
  },

  /**
   * Désactiver le compte
   */
  async deactivateAccount(): Promise<{ message: string }> {
    const response = await apiClient.post('/api/users/deactivate');
    return response.data;
  },

  /**
   * Supprimer le compte
   */
  async deleteAccount(): Promise<void> {
    await apiClient.delete('/api/users/me');
  },
};