// frontend/src/core/services/api/call.service.ts

import { apiClient } from './client.service';

export interface CallRecord {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar?: string;
  duration: number; // en secondes
  startedAt: string;
  endedAt: string;
  status: 'completed' | 'missed' | 'rejected' | 'cancelled';
  type: 'audio' | 'video';
}

export interface ActiveCall {
  id: string;
  callerId: string;
  receiverId: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'answered' | 'ongoing';
  startedAt: string;
  duration: number;
}

export interface InitiateCallData {
  receiverId: string;
  type: 'audio' | 'video';
}

export interface RecordCallData {
  callId: string;
}

export interface CallStats {
  totalCalls: number;
  totalDuration: number;
  missedCalls: number;
  averageDuration: number;
}

export const callAPI = {
  /**
   * Récupérer l'historique des appels
   */
  async getCallHistory(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ calls: CallRecord[]; total: number }> {
    const response = await apiClient.get('/api/calls/history', {
      params: { limit, offset },
    });
    return response.data;
  },

  /**
   * Initier un appel
   */
  async initiateCall(data: InitiateCallData): Promise<{ call: ActiveCall }> {
    const response = await apiClient.post('/api/calls/initiate', data);
    return response.data;
  },

  /**
   * Terminer un appel
   */
  async endCall(callId: string): Promise<{ message: string }> {
    const response = await apiClient.post(`/api/calls/${callId}/end`);
    return response.data;
  },

  /**
   * Rejeter un appel
   */
  async rejectCall(callId: string): Promise<{ message: string }> {
    const response = await apiClient.post(`/api/calls/${callId}/reject`);
    return response.data;
  },

  /**
   * Accepter un appel
   */
  async acceptCall(callId: string): Promise<{ call: ActiveCall }> {
    const response = await apiClient.post(`/api/calls/${callId}/accept`);
    return response.data;
  },

  /**
   * Enregistrer un appel
   */
  async recordCall(data: RecordCallData): Promise<{ message: string; recordingId: string }> {
    const response = await apiClient.post('/api/calls/record', data);
    return response.data;
  },

  /**
   * Récupérer les appels enregistrés
   */
  async getRecordedCalls(
    limit: number = 20,
    offset: number = 0
  ): Promise<{ recordings: any[]; total: number }> {
    const response = await apiClient.get('/api/calls/recordings', {
      params: { limit, offset },
    });
    return response.data;
  },

  /**
   * Supprimer un enregistrement d'appel
   */
  async deleteCallRecord(recordingId: string): Promise<{ message: string }> {
    const response = await apiClient.delete(`/api/calls/recordings/${recordingId}`);
    return response.data;
  },

  /**
   * Récupérer les appels actuels
   */
  async getCalls(): Promise<{ calls: ActiveCall[] }> {
    const response = await apiClient.get('/api/calls/active');
    return response.data;
  },

  /**
   * Récupérer les statistiques d'appels
   */
  async getStats(): Promise<{ stats: CallStats }> {
    const response = await apiClient.get('/api/calls/stats');
    return response.data;
  },
};
