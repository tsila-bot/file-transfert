// frontend/src/core/services/api/publicLink.service.ts

import { apiClient } from './client.service';

export interface PublicLink {
  id: string;
  code: string;
  teamId: string;
  createdById: string;
  expiresAt?: string;
  maxDownloads?: number;
  downloads: number;
  isActive: boolean;
  createdAt: string;
}

export interface PublicLinkStats {
  totalLinks: number;
  activeLinks: number;
  totalDownloads: number;
}

export interface CreateLinkData {
  teamId: string;
  expiresAt?: string;
  maxDownloads?: number;
}

export interface UpdateLinkData {
  isActive?: boolean;
  expiresAt?: string;
  maxDownloads?: number;
}

export interface DownloadLinkData {
  code: string;
}

export const publicLinkAPI = {
  /**
   * Créer un lien public
   */
  async createLink(data: CreateLinkData): Promise<{ success: boolean; link: PublicLink }> {
    const response = await apiClient.post('/public-links', data);
    return response.data;
  },

  /**
   * Obtenir tous les liens publics
   */
  async getLinks(limit: number = 50, offset: number = 0): Promise<{
    success: boolean;
    links: PublicLink[];
    total: number;
  }> {
    const response = await apiClient.get('/public-links', {
      params: { limit, offset },
    });
    return response.data;
  },

  /**
   * Mettre à jour un lien public
   */
  async updateLink(linkId: string, data: UpdateLinkData): Promise<{ success: boolean; link: PublicLink }> {
    const response = await apiClient.patch(`/public-links/${linkId}`, data);
    return response.data;
  },

  /**
   * Supprimer un lien public
   */
  async deleteLink(linkId: string): Promise<{ success: boolean }> {
    const response = await apiClient.delete(`/public-links/${linkId}`);
    return response.data;
  },

  /**
   * Accéder à un lien public par code
   */
  async accessLink(code: string): Promise<{ success: boolean; team: any }> {
    const response = await apiClient.get(`/public-links/access/${code}`);
    return response.data;
  },

  /**
   * Télécharger via lien public
   */
  async downloadViaLink(data: DownloadLinkData): Promise<{ success: boolean; downloadUrl: string }> {
    const response = await apiClient.post('/public-links/download', data);
    return response.data;
  },

  /**
   * Obtenir les statistiques des liens publics
   */
  async getLinkStats(): Promise<{ success: boolean; stats: PublicLinkStats }> {
    const response = await apiClient.get('/public-links/stats');
    return response.data;
  },
};
