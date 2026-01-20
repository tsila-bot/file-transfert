// frontend/src/core/services/api/publicLink.service.ts

import { apiClient } from './client.service';

export interface PublicLink {
  id: string;
  linkCode: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  creatorId: string;
  creatorName: string;
  description?: string;
  downloadCount: number;
  maxDownloads?: number;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicLinkStats {
  totalDownloads: number;
  lastDownloadAt?: string;
  downloaders: Array<{
    ip: string;
    downloadedAt: string;
    userAgent?: string;
  }>;
}

export interface CreateLinkData {
  fileName: string;
  fileSize: number;
  mimeType: string;
  description?: string;
  maxDownloads?: number;
  expiresIn?: number; // en secondes
}

export interface UpdateLinkData {
  description?: string;
  maxDownloads?: number;
  isActive?: boolean;
}

export interface DownloadLinkData {
  password?: string;
}

export const publicLinkAPI = {
  /**
   * Récupérer tous les liens publics de l'utilisateur
   */
  async listLinks(
    limit: number = 20,
    offset: number = 0
  ): Promise<{ links: PublicLink[]; total: number }> {
    const response = await apiClient.get('/api/public-links', {
      params: { limit, offset },
    });
    return response.data;
  },

  /**
   * Créer un nouveau lien public
   */
  async createLink(data: CreateLinkData): Promise<{ link: PublicLink }> {
    const response = await apiClient.post('/api/public-links', data);
    return response.data;
  },

  /**
   * Récupérer les détails d'un lien public
   */
  async getLink(linkCode: string): Promise<{ link: PublicLink }> {
    const response = await apiClient.get(`/api/public-links/${linkCode}`);
    return response.data;
  },

  /**
   * Mettre à jour un lien public
   */
  async updateLink(linkId: string, data: UpdateLinkData): Promise<{ link: PublicLink }> {
    const response = await apiClient.patch(`/api/public-links/${linkId}`, data);
    return response.data;
  },

  /**
   * Supprimer un lien public
   */
  async deleteLink(linkId: string): Promise<{ message: string }> {
    const response = await apiClient.delete(`/api/public-links/${linkId}`);
    return response.data;
  },

  /**
   * Télécharger un fichier via un lien public
   */
  async downloadFile(
    linkCode: string,
    data?: DownloadLinkData
  ): Promise<{ downloadUrl: string; expiresIn: number }> {
    const response = await apiClient.post(`/api/public-links/${linkCode}/download`, data || {});
    return response.data;
  },

  /**
   * Récupérer les statistiques d'un lien public
   */
  async getLinkStats(linkId: string): Promise<{ stats: PublicLinkStats }> {
    const response = await apiClient.get(`/api/public-links/${linkId}/stats`);
    return response.data;
  },

  /**
   * Expirer un lien public (le rendre inactif)
   */
  async expireLink(linkId: string): Promise<{ message: string }> {
    const response = await apiClient.post(`/api/public-links/${linkId}/expire`);
    return response.data;
  },

  /**
   * Vérifier si un lien est valide
   */
  async validateLink(linkCode: string): Promise<{ isValid: boolean; link?: PublicLink }> {
    const response = await apiClient.get(`/api/public-links/${linkCode}/validate`);
    return response.data;
  },
};
