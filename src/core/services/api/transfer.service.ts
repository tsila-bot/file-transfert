// frontend/src/core/services/api/transfer.service.ts

import { apiClient } from './client.service';

export interface FileTransfer {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed' | 'failed';
  progress: number; // 0-100
  startedAt: string;
  completedAt?: string;
  expiresAt?: string;
}

export interface TransferOffer {
  id: string;
  senderId: string;
  senderName: string;
  fileName: string;
  fileSize: number;
  message?: string;
  expiresIn: number; // en secondes
  createdAt: string;
}

export interface InitiateTransferData {
  receiverId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  message?: string;
  expiresIn?: number;
}

export interface AcceptTransferData {
  transferId: string;
}

export interface RejectTransferData {
  transferId: string;
  reason?: string;
}

export interface TransferStats {
  totalTransfers: number;
  totalBytes: number;
  completedTransfers: number;
  failedTransfers: number;
  averageSpeed: number; // bytes/second
  successRate: number; // pourcentage
}

export const transferAPI = {
  /**
   * Récupérer les transferts de l'utilisateur
   */
  async getTransfers(
    status?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ transfers: FileTransfer[]; total: number }> {
    const response = await apiClient.get('/api/transfers', {
      params: { status, limit, offset },
    });
    return response.data;
  },

  /**
   * Initier un transfert de fichier
   */
  async initiateTransfer(data: InitiateTransferData): Promise<{ transfer: FileTransfer }> {
    const response = await apiClient.post('/api/transfers/initiate', data);
    return response.data;
  },

  /**
   * Accepter un transfert
   */
  async acceptTransfer(transferId: string): Promise<{ transfer: FileTransfer }> {
    const response = await apiClient.post(`/api/transfers/${transferId}/accept`);
    return response.data;
  },

  /**
   * Rejeter un transfert
   */
  async rejectTransfer(
    transferId: string,
    data?: RejectTransferData
  ): Promise<{ message: string }> {
    const response = await apiClient.post(`/api/transfers/${transferId}/reject`, data || {});
    return response.data;
  },

  /**
   * Annuler un transfert
   */
  async cancelTransfer(transferId: string): Promise<{ message: string }> {
    const response = await apiClient.post(`/api/transfers/${transferId}/cancel`);
    return response.data;
  },

  /**
   * Récupérer l'historique des transferts
   */
  async getTransferHistory(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ transfers: FileTransfer[]; total: number }> {
    const response = await apiClient.get('/api/transfers/history', {
      params: { limit, offset },
    });
    return response.data;
  },

  /**
   * Obtenir les statistiques de transfert
   */
  async getStats(): Promise<{ stats: TransferStats }> {
    const response = await apiClient.get('/api/transfers/stats');
    return response.data;
  },

  /**
   * Récupérer les offres de transfert en attente
   */
  async getPendingOffers(): Promise<{ offers: TransferOffer[] }> {
    const response = await apiClient.get('/api/transfers/pending-offers');
    return response.data;
  },

  /**
   * Récupérer un transfert spécifique
   */
  async getTransfer(transferId: string): Promise<{ transfer: FileTransfer }> {
    const response = await apiClient.get(`/api/transfers/${transferId}`);
    return response.data;
  },
};
