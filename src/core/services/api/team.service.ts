// frontend/src/core/services/api/team.service.ts

import { apiClient } from './client.service';
import type { Team, TeamMember } from '@/types/types';

export interface CreateTeamData {
  name: string;
  description?: string;
  avatar?: string;
}

export interface UpdateTeamData {
  name?: string;
  description?: string;
  avatar?: string;
}

export interface AddMemberData {
  userId: string;
  role?: 'ADMIN' | 'MEMBER' | 'GUEST';
}

export const teamService = {
  /**
   * Récupérer toutes les équipes de l'utilisateur
   */
  async listTeams(
    limit: number = 20,
    offset: number = 0
  ): Promise<{ teams: Team[]; total: number }> {
    const response = await apiClient.get('/api/teams', {
      params: { limit, offset },
    });
    return response.data;
  },

  /**
   * Créer une nouvelle équipe
   */
  async createTeam(data: CreateTeamData): Promise<{ team: Team }> {
    const response = await apiClient.post('/api/teams', data);
    return response.data;
  },

  /**
   * Récupérer les détails d'une équipe
   */
  async getTeam(teamId: string): Promise<{ team: Team }> {
    const response = await apiClient.get(`/api/teams/${teamId}`);
    return response.data;
  },

  /**
   * Mettre à jour une équipe
   */
  async updateTeam(teamId: string, data: UpdateTeamData): Promise<{ team: Team }> {
    const response = await apiClient.patch(`/api/teams/${teamId}`, data);
    return response.data;
  },

  /**
   * Supprimer une équipe
   */
  async deleteTeam(teamId: string): Promise<{ message: string }> {
    const response = await apiClient.delete(`/api/teams/${teamId}`);
    return response.data;
  },

  /**
   * Récupérer les membres d'une équipe
   */
  async getTeamMembers(
    teamId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ members: TeamMember[]; total: number }> {
    const response = await apiClient.get(`/api/teams/${teamId}/members`, {
      params: { limit, offset },
    });
    return response.data;
  },

  /**
   * Ajouter un membre à une équipe
   */
  async addMember(teamId: string, data: AddMemberData): Promise<{ member: TeamMember }> {
    const response = await apiClient.post(`/api/teams/${teamId}/members`, data);
    return response.data;
  },

  /**
   * Supprimer un membre d'une équipe
   */
  async removeMember(teamId: string, userId: string): Promise<{ message: string }> {
    const response = await apiClient.delete(`/api/teams/${teamId}/members/${userId}`);
    return response.data;
  },

  /**
   * Rechercher des équipes publiques
   */
  async searchTeams(
    query: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ teams: Team[]; total: number }> {
    const response = await apiClient.get('/api/teams/search', {
      params: { query, limit, offset },
    });
    return response.data;
  },

  /**
   * Quitter une équipe
   */
  async leaveTeam(teamId: string): Promise<{ message: string }> {
    const response = await apiClient.post(`/api/teams/${teamId}/leave`);
    return response.data;
  },

  /**
   * Rejoindre une équipe par code d'invitation
   */
  async joinTeamByCode(inviteCode: string): Promise<{ member: TeamMember; team: Team }> {
    const response = await apiClient.post('/api/teams/join', {
      inviteCode,
    });
    return response.data;
  },
};
