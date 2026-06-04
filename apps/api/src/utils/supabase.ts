import { createClient } from '@supabase/supabase-js';
import { env } from '../config/index.js';

// Service role client — full access, server-side only
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

// Anon client — respects RLS
export const supabasePublic = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
