// frontend/src/core/services/api/transferLink.service.ts

import { apiClient } from './client.service';

export interface TransferLink {
  id: string;
  shortCode: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileMimeType: string;
  password?: string;
  expiresAt?: string;
  maxDownloads?: number;
  downloads: number;
  createdById: string;
  createdAt: string;
  shareUrl: string;
}

export interface CreateTransferLinkData {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileMimeType: string;
  password?: string;
  expiresAt?: string; // ISO datetime string
  maxDownloads?: number;
}

export interface UpdateTransferLinkData {
  password?: string;
  expiresAt?: string;
  maxDownloads?: number;
}

export interface PublicTransferData {
  shortCode: string;
  isProtected: boolean;
}

export const transferLinkAPI = {
  /**
   * Créer un lien public pour un transfert
   */
  async createTransferLink(data: CreateTransferLinkData): Promise<TransferLink> {
    const response = await apiClient.post('/api/public-links', data);
    return response.data.data || response.data;
  },

  /**
   * Récupérer les informations d'un lien public (sans auth)
   */
  async getPublicTransferInfo(shortCode: string): Promise<TransferLink> {
    const response = await apiClient.get(`/api/public-links/${shortCode}`);
    return response.data.data || response.data;
  },

  /**
   * Vérifier le mot de passe d'un lien protégé (sans auth)
   */
  async verifyTransferPassword(shortCode: string, password: string): Promise<boolean> {
    const response = await apiClient.post(`/api/public-links/${shortCode}/verify`, {
      password,
    });
    return response.data.data?.isValid || false;
  },

  /**
   * Obtenir tous les liens publiques de l'utilisateur
   */
  async getUserTransferLinks(skip: number = 0, take: number = 50): Promise<{
    links: TransferLink[];
    total: number;
  }> {
    const response = await apiClient.get('/api/public-links/user/all', {
      params: { skip, take },
    });
    return response.data.data || response.data;
  },

  /**
   * Mettre à jour un lien public
   */
  async updateTransferLink(linkId: string, data: UpdateTransferLinkData): Promise<TransferLink> {
    const response = await apiClient.put(`/api/public-links/${linkId}`, data);
    return response.data.data || response.data;
  },

  /**
   * Supprimer un lien public
   */
  async deleteTransferLink(linkId: string): Promise<void> {
    await apiClient.delete(`/api/public-links/${linkId}`);
  },

  /**
   * Incrémenter le compteur de téléchargement
   */
  async incrementDownloadCount(shortCode: string): Promise<TransferLink> {
    const response = await apiClient.patch(`/api/public-links/${shortCode}/download`);
    return response.data.data || response.data;
  },

  /**
   * Valider un lien public
   */
  async validateTransferLink(shortCode: string): Promise<boolean> {
    try {
      const response = await apiClient.get(`/api/public-links/${shortCode}/validate`);
      return response.data.success || response.data.isValid || false;
    } catch (error) {
      return false;
    }
  },
};

export default transferLinkAPI;
