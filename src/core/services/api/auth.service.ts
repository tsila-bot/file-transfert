// lib/api/auth.ts

import { apiClient } from './client.service';

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: 'USER' | 'ADMIN' | 'SYSTEM_ADMIN';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export const authAPI = {
  /**
   * Inscription
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await apiClient.post('/api/auth/register', data);
    return response.data;
  },

  /**
   * Connexion
   */
  async login(data: LoginData): Promise<AuthResponse> {
    const response = await apiClient.post('/api/auth/login', data);
    return response.data;
  },

  /**
   * Rafraîchir le token
   */
  async refresh(): Promise<{ accessToken: string }> {
    const response = await apiClient.post('/api/auth/refresh');
    return response.data;
  },

  /**
   * Déconnexion
   */
  async logout(): Promise<void> {
    await apiClient.post('/api/auth/logout');
  },

  /**
   * Récupérer les informations de l'utilisateur connecté
   */
  async me(): Promise<{ user: User }> {
    const response = await apiClient.get('/api/auth/me');
    return response.data;
  },
};