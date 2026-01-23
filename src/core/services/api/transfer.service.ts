// frontend/src/core/services/api/transfer.service.ts

import { apiClient } from './client.service';

export interface FileTransfer {
  id: string;
  senderId: string;
  recipientId: string;
  fileName: string;
  fileSize: number;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'failed';
  createdAt: string;
}

export interface TransferOffer {
  id: string;
  transferId: string;
  fileName: string;
  fileSize: number;
  senderId: string;
}

export interface InitiateTransferData {
  recipientId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
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
  totalSize: number;
  completedTransfers: number;
  failedTransfers: number;
}

export const transferAPI = {
  /**
   * Initier un transfert de fichier
   */
  async initiateTransfer(data: InitiateTransferData): Promise<{ success: boolean; transferId: string }> {
    const response = await apiClient.post('/transfers/initiate', data);
    return response.data;
  },

  /**
   * Accepter un transfert
   */
  async acceptTransfer(data: AcceptTransferData): Promise<{ success: boolean }> {
    const response = await apiClient.post('/transfers/accept', data);
    return response.data;
  },

  /**
   * Rejeter un transfert
   */
  async rejectTransfer(data: RejectTransferData): Promise<{ success: boolean }> {
    const response = await apiClient.post('/transfers/reject', data);
    return response.data;
  },

  /**
   * Obtenir les transferts en attente
   */
  async getPendingTransfers(): Promise<{ success: boolean; transfers: FileTransfer[] }> {
    const response = await apiClient.get('/transfers/pending');
    return response.data;
  },

  /**
   * Obtenir l'historique des transferts
   */
  async getTransferHistory(limit: number = 50, offset: number = 0): Promise<{
    success: boolean;
    transfers: FileTransfer[];
    total: number;
  }> {
    const response = await apiClient.get('/transfers/history', {
      params: { limit, offset },
    });
    return response.data;
  },

  /**
   * Obtenir les statistiques de transfert
   */
  async getTransferStats(): Promise<{ success: boolean; stats: TransferStats }> {
    const response = await apiClient.get('/transfers/stats');
    return response.data;
  },
};
