
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI, User } from '../core/services/api/auth.service';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  register: (data: {
    email: string;
    password: string;
    name: string;
  }) => Promise<void>;
  login: (data: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  //  NOUVEAU: Initialiser depuis le storage
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authAPI.register(data);

          // Plus besoin de localStorage séparé, persist s'en charge
          set({
            user: response.user,
            accessToken: response.accessToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          const errorMessage =
            error.response?.data?.message || 'Failed to register';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      login: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authAPI.login(data);

          //  Plus besoin de localStorage séparé
          set({
            user: response.user,
            accessToken: response.accessToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          const errorMessage =
            error.response?.data?.message || 'Failed to login';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await authAPI.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          //  persist va automatiquement nettoyer le storage
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            error: null,
          });
        }
      },

      refreshUser: async () => {
        //  Utiliser le token du state, pas localStorage
        const { accessToken } = get();

        if (!accessToken) {
          set({ isAuthenticated: false });
          return;
        }

        try {
          const response = await authAPI.me();
          set({
            user: response.user,
            isAuthenticated: true,
          });
        } catch (error) {
          console.error('Failed to refresh user:', error);
          //  Token invalide, déconnecter
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
          });
        }
      },

      //  NOUVEAU: Initialiser l'auth au démarrage de l'app
      initializeAuth: async () => {
        const { accessToken } = get();

        if (accessToken) {
          console.log(' Initializing auth from storage...');
          try {
            await get().refreshUser();
          } catch (error) {
            console.error('Auth initialization failed:', error);
          }
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      //  Persister user et token
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
