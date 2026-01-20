// frontend/src/core/services/api/team.service.ts

import { apiClient } from './client.service';
import { User } from './auth.service';

export interface Team {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  creatorId: string;
  creatorName: string;
  membersCount: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'member';
  joinedAt: string;
  status: 'active' | 'inactive';
}

export interface CreateTeamData {
  name: string;
  description?: string;
  isPublic?: boolean;
  avatar?: string;
}

export interface UpdateTeamData {
  name?: string;
  description?: string;
  isPublic?: boolean;
  avatar?: string;
}

export interface AddMemberData {
  userId: string;
  role?: 'admin' | 'member';
}

export const teamAPI = {
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
   * Accepter une invitation à rejoindre une équipe
   */
  async acceptTeamInvitation(teamId: string, invitationToken: string): Promise<{ team: Team }> {
    const response = await apiClient.post(`/api/teams/${teamId}/accept-invitation`, {
      token: invitationToken,
    });
    return response.data;
  },
};
