import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const { data: { session } } = await supabase.auth.refreshSession();
      if (session) {
        err.config.headers.Authorization = `Bearer ${session.access_token}`;
        return api.request(err.config);
      }
      await supabase.auth.signOut();
      window.location.href = '/admin';
    }
    return Promise.reject(err);
  }
);

export { api };
