import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { Profile } from '@vpay/types';

interface AuthState {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        profile: null,
        isInitialized: false,

        initialize: async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            set({ user: { id: session.user.id, email: session.user.email! } });
            await get().refreshProfile();
          }
          supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
              set({ user: { id: session.user.id, email: session.user.email! } });
              await get().refreshProfile();
            } else {
              set({ user: null, profile: null });
            }
          });
          set({ isInitialized: true });
        },

        refreshProfile: async () => {
          const { user } = get();
          if (!user) return;
          const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (data) set({ profile: data as Profile });
        },

        signOut: async () => {
          await supabase.auth.signOut();
          set({ user: null, profile: null });
        },
      }),
      { name: 'vpay-admin-auth', partialize: (s) => ({ user: s.user }) }
    )
  )
);
