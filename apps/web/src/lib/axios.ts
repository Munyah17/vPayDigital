import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// Cache the token in memory — updated instantly via auth state subscription.
let _cachedToken: string | null = null;

supabase.auth.onAuthStateChange((_event, session) => {
  _cachedToken = session?.access_token ?? null;
});

// Seed synchronously from the Supabase in-memory store on module load.
// onAuthStateChange fires asynchronously (next tick), so there is a small window
// where _cachedToken is null. The interceptor handles this with an async fallback.
supabase.auth.getSession().then(({ data }) => {
  _cachedToken = data.session?.access_token ?? null;
});

// Cache-first: synchronous on warm cache, one-time async fallback on first load.
api.interceptors.request.use(async (config) => {
  if (_cachedToken) {
    config.headers.Authorization = `Bearer ${_cachedToken}`;
    return config;
  }
  // Async fallback — only fires before onAuthStateChange has had a chance to set
  // the cache (i.e., the very first request on a fresh page load). After this
  // resolves the cache is warm and all subsequent calls are synchronous.
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    _cachedToken = session.access_token;
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Handle 401 — refresh token
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const { data: { session } } = await supabase.auth.refreshSession();
      if (session) {
        _cachedToken = session.access_token;
        err.config.headers.Authorization = `Bearer ${session.access_token}`;
        return api.request(err.config);
      }
      _cachedToken = null;
      await supabase.auth.signOut();
      window.location.href = '/auth/login';
    }
    return Promise.reject(err);
  }
);

export { api };
