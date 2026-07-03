import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createClient } from '@supabase/supabase-js';
import type { Profile } from '@vpay/types';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

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

        supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session?.user) {
            const profile = await fetchAdminProfile(session.user.id);
            set({ profile });
          } else {
            set({ profile: null });
          }
        });
      },

      signOut: async () => {
        await supabase.auth.signOut();
        set({ profile: null });
      },
    }),
    { name: 'vpay-admin', partialize: (s) => ({ profile: s.profile }) }
  )
);

export { supabase as adminSupabase };
