// frontend/src/core/services/api/call.service.ts

import { apiClient } from './client.service';

export interface CallRecord {
  id: string;
  initiatorId: string;
  participantId: string;
  duration: number;
  status: 'completed' | 'missed' | 'rejected';
  createdAt: string;
}

export interface ActiveCall {
  id: string;
  initiatorId: string;
  participantId: string;
  startedAt: string;
  duration: number;
}

export interface InitiateCallData {
  recipientId: string;
  type: 'audio' | 'video';
}

export interface RecordCallData {
  callId: string;
  duration: number;
}

export interface CallStats {
  totalCalls: number;
  totalDuration: number;
  missedCalls: number;
}

export const callAPI = {
  /**
   * Initier un appel
   */
  async initiateCall(data: InitiateCallData): Promise<{ success: boolean; callId: string }> {
    const response = await apiClient.post('/calls/initiate', data);
    return response.data;
  },

  /**
   * Obtenir les appels actifs
   */
  async getActiveCalls(): Promise<{ success: boolean; calls: ActiveCall[] }> {
    const response = await apiClient.get('/calls/active');
    return response.data;
  },

  /**
   * Enregistrer un appel
   */
  async recordCall(data: RecordCallData): Promise<{ success: boolean }> {
    const response = await apiClient.post('/calls/record', data);
    return response.data;
  },

  /**
   * Obtenir les statistiques d'appels
   */
  async getCallStats(): Promise<{ success: boolean; stats: CallStats }> {
    const response = await apiClient.get('/calls/stats');
    return response.data;
  },

  /**
   * Obtenir l'historique des appels
   */
  async getCallHistory(limit: number = 50, offset: number = 0): Promise<{ 
    success: boolean; 
    calls: CallRecord[]; 
    total: number 
  }> {
    const response = await apiClient.get('/calls/history', {
      params: { limit, offset },
    });
    return response.data;
  },
};
