import { create } from 'zustand';
import { Team, TeamMember } from '@/types/types';

export interface TeamState {
  teams: Team[];
  currentTeam: Team | null;
  members: TeamMember[];
  loading: boolean;
  error: string | null;

  // Actions
  setTeams: (teams: Team[]) => void;
  setCurrentTeam: (team: Team | null) => void;
  setMembers: (members: TeamMember[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Team Management
  addTeam: (team: Team) => void;
  removeTeam: (teamId: string) => void;
  updateTeamInfo: (teamId: string, updates: Partial<Team>) => void;

  // Member Management
  addMember: (member: TeamMember) => void;
  removeMember: (userId: string) => void;
  updateMemberRole: (userId: string, role: 'ADMIN' | 'MEMBER' | 'GUEST') => void;

  // Clear state
  reset: () => void;
}

export const useTeamStore = create<TeamState>((set) => ({
  teams: [],
  currentTeam: null,
  members: [],
  loading: false,
  error: null,

  setTeams: (teams) => set({ teams }),
  setCurrentTeam: (currentTeam) => set({ currentTeam }),
  setMembers: (members) => set({ members }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  addTeam: (team) =>
    set((state) => ({
      teams: [...(state.teams || []), team],
    })),

  removeTeam: (teamId) =>
    set((state) => ({
      teams: (state.teams || []).filter((t) => t.id !== teamId),
      currentTeam: state.currentTeam?.id === teamId ? null : state.currentTeam,
    })),

  updateTeamInfo: (teamId, updates) =>
    set((state) => ({
      teams: (state.teams || []).map((t) => (t.id === teamId ? { ...t, ...updates } : t)),
      currentTeam: state.currentTeam?.id === teamId ? { ...state.currentTeam, ...updates } : state.currentTeam,
    })),

  addMember: (member) =>
    set((state) => ({
      members: [...state.members, member],
    })),

  removeMember: (userId) =>
    set((state) => ({
      members: (state.members || []).filter((m) => m.userId !== userId),
    })),

  updateMemberRole: (userId, role) =>
    set((state) => ({
      members: state.members.map((m) => (m.userId === userId ? { ...m, role } : m)),
    })),

  reset: () =>
    set({
      teams: [],
      currentTeam: null,
      members: [],
      loading: false,
      error: null,
    }),
}));
