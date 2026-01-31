import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

interface AuthState {
  user: Profile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: Profile | null, token?: string | null) => void;
  updatePoints: (points: number) => void;
  updateNickname: (nickname: string) => void;
  logout: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user, token = null) =>
        set({
          user,
          token,
          isAuthenticated: !!user,
          isLoading: false,
        }),

      updatePoints: (points) =>
        set((state) => ({
          user: state.user ? { ...state.user, points } : null,
        })),

      updateNickname: (nickname) =>
        set((state) => ({
          user: state.user ? { ...state.user, nickname } : null,
        })),

      logout: async () => {
        // Clear local state FIRST (before Supabase call)
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });

        // Clear localStorage manually to ensure clean state
        try {
          localStorage.removeItem('auth-storage');
        } catch (e) {
          console.error('Failed to clear localStorage:', e);
        }

        // Then sign out from Supabase (don't block on errors)
        try {
          await supabase.auth.signOut();
        } catch (error) {
          console.error('Supabase signOut error:', error);
        }
      },

      initialize: async () => {
        try {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();

          if (sessionError) {
            console.error('[Auth] Session error:', sessionError);
            // Clear invalid session
            await supabase.auth.signOut();
            set({ user: null, token: null, isAuthenticated: false, isLoading: false });
            return;
          }

          if (session?.user) {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            if (profileError) {
              console.error('[Auth] Profile fetch error:', profileError);
              // Session exists but profile doesn't - sign out
              await supabase.auth.signOut();
              set({ user: null, token: null, isAuthenticated: false, isLoading: false });
              return;
            }

            if (profile) {
              set({
                user: profile,
                token: session.access_token,
                isAuthenticated: true,
                isLoading: false,
              });
              return;
            }
          }

          // No session - clear any stale local storage
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        } catch (error) {
          console.error('[Auth] Failed to initialize:', error);
          // On error, clear everything and allow access
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Listen to auth state changes with debounce
let authChangeTimeout: ReturnType<typeof setTimeout> | null = null;

supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('[Auth] State change:', event);

  // Clear any pending auth change handling
  if (authChangeTimeout) {
    clearTimeout(authChangeTimeout);
  }

  // Debounce auth state changes to prevent rapid-fire updates
  authChangeTimeout = setTimeout(async () => {
    try {
      if (event === 'SIGNED_OUT') {
        useAuthStore.getState().setUser(null, null);
      } else if (event === 'SIGNED_IN' && session?.user) {
        // Check if we already have this user loaded
        const currentUser = useAuthStore.getState().user;
        if (currentUser?.id === session.user.id) {
          // Just update token
          useAuthStore.setState({ token: session.access_token });
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (error) {
          console.error('[Auth] Profile fetch error:', error);
          return;
        }

        if (profile) {
          useAuthStore.getState().setUser(profile, session.access_token);
        }
      } else if (event === 'TOKEN_REFRESHED' && session) {
        useAuthStore.setState({ token: session.access_token });
      }
    } catch (error) {
      console.error('[Auth] Auth state change error:', error);
    }
  }, 100);
});

export default useAuthStore;
