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

export interface TransferHistoryItem {
  id: string;
  senderId: string;
  receiverId: string;
  senderName?: string;
  receiverName?: string;
  fileHash: string;
  fileName?: string;
  fileSizeBytes: number
  mimeType: string;
  transferType: 'P2P_DIRECT' | 'P2P_MULTI_SOURCE' | 'PUBLIC_LINK' | 'GROUP_TRANSFER';
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'CANCELLED';
  duration?: number;
  avgSpeed?: number;
  errorCode?: string;
  teamId?: string;
  createdAt: string;
  updatedAt?: string;
  // Calculé par le backend
  direction?: 'SENT' | 'RECEIVED';
  peerName?: string;
}

export interface TransferStats {
  totalTransfers: number;
  totalSize: number;
  sentTransfers: number;
  sentSize: number;
  receivedTransfers: number;
  receivedSize: number;
  successfulTransfers: number;
  failedTransfers: number;
  partialTransfers: number;
  cancelledTransfers: number;
  p2pTransfers: number;
  groupTransfers: number;
  publicLinkTransfers: number;
  averageSpeed?: number;
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
  async getUserTransferHistory(skip: number = 0, take: number = 50): Promise<{
    transfers: TransferHistoryItem[];
    total: number;
  }> {
    const response = await apiClient.get('/api/transfers/history', {
      params: { skip, take },
    });
    return response.data.data || response.data;
  },

  /**
   * Obtenir les statistiques de transfert
   */
  async getUserTransferStats(): Promise<TransferStats> {
    const response = await apiClient.get('/api/transfers/stats');
    return response.data.data || response.data;
  },

  /**
   * Enregistrer un transfert complété
   */
  async logTransfer(data: {
    receiverId: string;
    senderName?: string;
    receiverName?: string;
    fileHash: string;
    fileName?: string;
    fileSizeBytes: number;
    mimeType: string;
    transferType: 'P2P_DIRECT' | 'P2P_MULTI_SOURCE' | 'PUBLIC_LINK' | 'GROUP_TRANSFER';
    status: 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'CANCELLED';
    duration: number; // en secondes
    avgSpeed: number; // en Mbps
    errorCode?: string;
    teamId?: string;
  }): Promise<{ success: boolean; data?: any }> {
    const response = await apiClient.post('/api/transfers/log', data);
    return response.data;
  },
};
