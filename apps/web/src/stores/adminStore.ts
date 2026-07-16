import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { Profile } from '@vpay/types';

const ADMIN_ROLES = ['super_admin', 'staff'] as const;

async function fetchAdminProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (data && ADMIN_ROLES.includes(data.role)) return data as Profile;
  return null;
}

interface AdminStore {
  profile: Profile | null;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

let adminAuthListenerSubscribed = false;

export const useAdminStore = create<AdminStore>()(
  persist(
    (set) => ({
      profile: null,
      isInitialized: false,

      initialize: async () => {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          const profile = await fetchAdminProfile(session.user.id);
          set({ profile, isInitialized: true });
        } else {
          set({ profile: null, isInitialized: true });
        }

        // Guard against duplicate subscriptions if initialize() is ever
        // called more than once (e.g. dev remounts / StrictMode) — matches
        // the same guard in authStore.
        if (!adminAuthListenerSubscribed) {
          adminAuthListenerSubscribed = true;
          supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
              const profile = await fetchAdminProfile(session.user.id);
              set({ profile });
            } else {
              set({ profile: null });
            }
          });
        }
      },

      signOut: async () => {
        // Clear local state immediately and unconditionally, so a slow or failed
        // remote call can never leave the UI looking "stuck" signed in.
        set({ profile: null });
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
    { name: 'vpay-admin', partialize: (s) => ({ profile: s.profile }) }
  )
);
