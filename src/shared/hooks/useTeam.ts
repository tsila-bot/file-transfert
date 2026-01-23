import { useCallback, useEffect } from 'react';
import { teamService } from '@/core/services/api/team.service';
import { useTeamStore } from '@/stores/teamStore';
import { useAuthStore } from '@/stores/authStore';
import type { Team } from '@/types/types';

export interface CreateTeamData {
  name: string;
  description?: string;
  avatar?: string;
}

export const useTeam = () => {
  const {
    teams,
    currentTeam,
    members,
    loading,
    error,
    setTeams,
    setCurrentTeam,
    setMembers,
    setLoading,
    setError,
    addTeam,
    removeTeam,
    updateTeamInfo,
    addMember,
    removeMember,
    updateMemberRole,
  } = useTeamStore();

  const { user } = useAuthStore();

  /**
   * Charger toutes les équipes de l'utilisateur
   */
  const loadTeams = useCallback(async () => {
    if (!user) {
      console.warn('⚠️ Pas d\'utilisateur connecté');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('📡 Chargement des équipes...');
      const response = await teamService.listTeams(100, 0);
      console.log('✅ Réponse API:', response);
      const teamsData = response.teams || [];
      console.log('✅ Équipes chargées:', teamsData.length, teamsData);
      setTeams(teamsData);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur lors du chargement des équipes';
      setError(errorMsg);
      console.error('❌ Error loading teams:', err);
    } finally {
      setLoading(false);
    }
  }, [user, setTeams, setLoading, setError]);

  /**
   * Créer une nouvelle équipe
   */
  const createTeam = useCallback(
    async (data: CreateTeamData) => {
      if (!user) throw new Error('Utilisateur non authentifié');

      try {
        setLoading(true);
        setError(null);
        const response = await teamService.createTeam(data);
        const team = response.team;
        addTeam(team);
        return team;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur lors de la création';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [user, addTeam, setLoading, setError]
  );

  /**
   * Charger une équipe spécifique
   */
  const loadTeam = useCallback(
    async (teamId: string) => {
      try {
        setLoading(true);
        setError(null);
        const response = await teamService.getTeam(teamId);
        const team = response.team;
        setCurrentTeam(team);
        return team;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur lors du chargement';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setCurrentTeam, setLoading, setError]
  );

  /**
   * Mettre à jour les infos d'une équipe
   */
  const updateTeam = useCallback(
    async (teamId: string, data: Partial<CreateTeamData>) => {
      try {
        setLoading(true);
        setError(null);
        const response = await teamService.updateTeam(teamId, data);
        const team = response.team;
        updateTeamInfo(teamId, team);
        return team;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur lors de la mise à jour';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [updateTeamInfo, setLoading, setError]
  );

  /**
   * Supprimer une équipe
   */
  const deleteTeam = useCallback(
    async (teamId: string) => {
      try {
        setLoading(true);
        setError(null);
        await teamService.deleteTeam(teamId);
        removeTeam(teamId);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur lors de la suppression';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [removeTeam, setLoading, setError]
  );

  /**
   * Charger les membres d'une équipe
   */
  const loadMembers = useCallback(
    async (teamId: string) => {
      try {
        setLoading(true);
        setError(null);
        const response = await teamService.getTeamMembers(teamId, 100, 0);
        const members = response.members || [];
        setMembers(members);
        return members;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur lors du chargement des membres';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setMembers, setLoading, setError]
  );

  /**
   * Ajouter un membre à une équipe
   */
  const addTeamMember = useCallback(
    async (teamId: string, userId: string, role: 'ADMIN' | 'MEMBER' | 'GUEST' = 'MEMBER') => {
      try {
        setLoading(true);
        setError(null);
        const response = await teamService.addMember(teamId, { userId, role });
        addMember(response.member);
        return response.member;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur lors de l\'ajout du membre';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [addMember, setLoading, setError]
  );

  /**
   * Retirer un membre d'une équipe
   */
  const removeTeamMember = useCallback(
    async (teamId: string, userId: string) => {
      try {
        setLoading(true);
        setError(null);
        await teamService.removeMember(teamId, userId);
        removeMember(userId);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur lors de la suppression du membre';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [removeMember, setLoading, setError]
  );

  /**
   * Mettre à jour le rôle d'un membre
   */
  const changeUserRole = useCallback(
    async (teamId: string, userId: string, role: 'ADMIN' | 'MEMBER' | 'GUEST') => {
      try {
        setLoading(true);
        setError(null);
        await teamService.getTeam(teamId); // Valider team
        updateMemberRole(userId, role);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur lors de la mise à jour du rôle';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [updateMemberRole, setLoading, setError]
  );

  /**
   * Rejoindre une équipe par code d'invitation
   */
  const joinTeamByCode = useCallback(
    async (inviteCode: string) => {
      if (!user) throw new Error('Utilisateur non authentifié');

      try {
        setLoading(true);
        setError(null);
        const response = await teamService.joinTeamByCode(inviteCode);
        console.log('📡 Join response:', response);
        // Handle response structure: {team, member}
        const team = response.team;
        console.log('✅ Team extracted:', team);
        if (team && team.id && team.name) {
          addTeam(team);
          return team;
        } else {
          throw new Error('Invalid team data received');
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Code d\'invitation invalide';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [user, addTeam, setLoading, setError]
  );

  /**
   * Quitter une équipe
   */
  const leaveTeam = useCallback(
    async (teamId: string) => {
      try {
        setLoading(true);
        setError(null);
        await teamService.leaveTeam(teamId);
        removeTeam(teamId);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur lors de la tentative de départ';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [removeTeam, setLoading, setError]
  );

  /**
   * Chercher des équipes publiques
   */
  const searchTeams = useCallback(
    async (query: string) => {
      try {
        setLoading(true);
        setError(null);
        const response = await teamService.searchTeams(query, 20, 0);
        return response.teams;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur lors de la recherche';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  return {
    // State
    teams,
    currentTeam,
    members,
    loading,
    error,

    // Actions
    loadTeams,
    createTeam,
    loadTeam,
    updateTeam,
    deleteTeam,
    loadMembers,
    addTeamMember,
    removeTeamMember,
    changeUserRole,
    joinTeamByCode,
    leaveTeam,
    searchTeams,
  };
};
