import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import toast from 'react-hot-toast';
import type { Wallet, WalletTransaction, Card, Notification } from '@vpay/types';
import { api } from '../lib/axios';

interface WalletState {
  wallets: Wallet[];
  activeWallet: Wallet | null;
  transactions: WalletTransaction[];
  cards: Card[];
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;

  fetchWallets: () => Promise<void>;
  fetchTransactions: (walletId: string, params?: { page?: number; limit?: number }) => Promise<void>;
  fetchCards: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  setActiveWallet: (wallet: Wallet) => void;
  markNotificationRead: (id: string) => Promise<void>;
  reset: () => void;
}

const initialState = {
  wallets: [] as Wallet[],
  activeWallet: null as Wallet | null,
  transactions: [] as WalletTransaction[],
  cards: [] as Card[],
  notifications: [] as Notification[],
  unreadCount: 0,
  isLoading: false,
};

export const useWalletStore = create<WalletState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      fetchWallets: async () => {
        set({ isLoading: true });
        try {
          const { data } = await api.get<{ success: boolean; data: Wallet[] }>('/api/wallets');
          const wallets = data.data ?? [];
          set({
            wallets,
            activeWallet: get().activeWallet ?? wallets[0] ?? null,
          });
        } catch (err: any) {
          const isNetworkError = !err.response;
          const msg = isNetworkError
            ? 'Cannot reach API server. Check that it is running.'
            : (err?.response?.data?.error ?? 'Failed to load wallets');
          toast.error(msg, { id: 'fetch-wallets-err' });
          throw err; // re-throw so callers can show their own error state
        } finally {
          set({ isLoading: false });
        }
      },

      fetchTransactions: async (walletId, params = {}) => {
        try {
          const { data } = await api.get(`/api/wallets/${walletId}/transactions`, { params });
          set({ transactions: data.data ?? [] });
        } catch {
          // non-critical — transactions tab shows empty state
        }
      },

      fetchCards: async () => {
        try {
          const { data } = await api.get<{ success: boolean; data: Card[] }>('/api/cards');
          set({ cards: data.data ?? [] });
        } catch {
          // non-critical — cards section shows empty state
        }
      },

      fetchNotifications: async () => {
        try {
          const { data } = await api.get<{ success: boolean; data: Notification[] }>('/api/notifications');
          const notifications = data.data ?? [];
          set({
            notifications,
            unreadCount: notifications.filter(n => !n.read_at).length,
          });
        } catch {
          // non-critical — bell icon just shows 0
        }
      },

      setActiveWallet: (wallet) => set({ activeWallet: wallet }),

      markNotificationRead: async (id: string) => {
        await api.patch(`/api/notifications/${id}/read`);
        set(state => ({
          notifications: state.notifications.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));
      },

      reset: () => set({ ...initialState }),
    })
  )
);
