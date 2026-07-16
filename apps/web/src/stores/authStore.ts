import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { useWalletStore } from './walletStore';
import type { Profile } from '@vpay/types';

interface AuthState {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;
  profileError: string | null;

  setUser: (user: { id: string; email: string } | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

let authListenerSubscribed = false;

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        profile: null,
        isLoading: true,
        isInitialized: false,
        profileError: null,

        setUser: (user) => set({ user }),
        setProfile: (profile) => set({ profile }),
        setLoading: (isLoading) => set({ isLoading }),

        initialize: async () => {
          set({ isLoading: true });
          try {
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user) {
              set({ user: { id: session.user.id, email: session.user.email! } });
              await get().refreshProfile();
            }

            // Listen for auth changes — guard against duplicate subscriptions if
            // initialize() is ever called more than once (e.g. dev remounts).
            if (!authListenerSubscribed) {
              authListenerSubscribed = true;
              supabase.auth.onAuthStateChange(async (_event, session) => {
                if (session?.user) {
                  set({ user: { id: session.user.id, email: session.user.email! } });
                  await get().refreshProfile();
                } else {
                  // Session ended (explicit sign-out, expiry, or another tab
                  // signing out) — clear wallet/card/transaction/notification
                  // state too, or the next user on this device can briefly
                  // see the previous user's real balances before refetch.
                  set({ user: null, profile: null });
                  useWalletStore.getState().reset();
                }
              });
            }
          } finally {
            set({ isLoading: false, isInitialized: true });
          }
        },

        refreshProfile: async () => {
          const { user } = get();
          if (!user) return;

          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (error) {
            // Don't silently leave profile null on a transient network/DB
            // error — AuthGuard treats "no profile" the same as "not logged
            // in" and would otherwise bounce a genuinely authenticated user
            // back to the landing page with no explanation.
            set({ profileError: error.message });
            return;
          }

          set({ profile: data as Profile, profileError: null });
        },

        signOut: async () => {
          // Clear local state immediately and unconditionally, so a slow or failed
          // remote call can never leave the UI looking "stuck" signed in — and so
          // the next user on a shared device never sees this user's wallets/cards
          // while the post-login refetch is still in flight.
          set({ user: null, profile: null });
          useWalletStore.getState().reset();
          try {
            await Promise.race([
              supabase.auth.signOut(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('sign-out timed out')), 5000)),
            ]);
          } catch {
            // Local state is already cleared — nothing more to do.
          }
        },
      }),
      {
        name: 'vpay-auth',
        partialize: (state) => ({ user: state.user }),
      }
    )
  )
);
