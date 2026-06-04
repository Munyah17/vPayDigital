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
}

export const useWalletStore = create<WalletState>()(
  devtools(
    (set, get) => ({
      wallets: [],
      activeWallet: null,
      transactions: [],
      cards: [],
      notifications: [],
      unreadCount: 0,
      isLoading: false,

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
          const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to load wallets';
          toast.error(msg, { id: 'fetch-wallets-err' });
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
    })
  )
);
