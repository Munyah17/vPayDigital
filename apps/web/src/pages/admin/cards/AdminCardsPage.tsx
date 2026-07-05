import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CreditCard, Search } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatDate, formatCurrency, titleCase } from '@vpay/utils';

type Card = {
  id: string;
  user_id: string;
  card_type: string;
  network: 'visa' | 'mastercard' | 'amex' | 'unionpay';
  currency: string;
  status: 'pending' | 'active' | 'frozen' | 'terminated' | 'expired' | 'exhausted' | 'consumed';
  masked_pan?: string;
  last_four?: string;
  cardholder_name: string;
  current_balance: number;
  total_spent: number;
  provider_name?: string;
  created_at: string;
  expires_at?: string;
  profiles?: { full_name: string; email: string };
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400',
  active: 'bg-emerald-500/10 text-emerald-400',
  frozen: 'bg-blue-500/10 text-blue-400',
  terminated: 'bg-foreground/5 text-foreground/40',
  expired: 'bg-foreground/5 text-foreground/30',
  exhausted: 'bg-orange-500/10 text-orange-400',
  consumed: 'bg-foreground/5 text-foreground/30',
};

const NETWORK_COLORS: Record<string, string> = {
  visa: 'text-blue-400',
  mastercard: 'text-orange-400',
  amex: 'text-emerald-400',
  unionpay: 'text-red-400',
};

export default function AdminCardsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [networkFilter, setNetworkFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-cards', page, statusFilter, networkFilter],
    queryFn: () => api.get('/api/admin/cards', {
      params: { page, limit: 25, status: statusFilter || undefined, network: networkFilter || undefined },
    }),
  });

  const cards: Card[] = data?.data?.data ?? [];
  const total: number = data?.data?.meta?.total ?? 0;

  const filtered = search
    ? cards.filter(c =>
        c.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.profiles?.email?.includes(search) ||
        c.last_four?.includes(search) ||
        c.cardholder_name?.toLowerCase().includes(search.toLowerCase())
      )
    : cards;

  const statsByStatus = ['active', 'frozen', 'terminated', 'pending'].map(s => ({
    status: s,
    count: cards.filter(c => c.status === s).length,
  }));

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="w-7 h-7 text-brand-400" />
          <div>
            <h1 className="font-display font-bold text-foreground text-2xl">Cards</h1>
            <p className="text-foreground/30 text-sm">{total} total cards</p>
          </div>
        </div>
      </header>

      {/* Status pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statsByStatus.map(({ status, count }) => (
          <button key={status} onClick={() => { setStatusFilter(statusFilter === status ? '' : status); setPage(1); }}
            className={`glass-card p-4 text-left transition-all hover:border-foreground/10 ${statusFilter === status ? 'border-foreground/20' : ''}`}>
            <p className="text-foreground/40 text-xs capitalize mb-1">{status}</p>
            <p className="text-2xl font-bold text-foreground">{count}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 flex-1 min-w-[180px] max-w-xs">
          <Search className="w-4 h-4 text-foreground/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search user, cardholder, last 4..." className="bg-transparent text-foreground text-sm outline-none flex-1 placeholder:text-foreground/20" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground/60 text-sm outline-none">
          <option value="">All Statuses</option>
          {['pending', 'active', 'frozen', 'terminated', 'expired', 'exhausted'].map(s => (
            <option key={s} value={s}>{titleCase(s)}</option>
          ))}
        </select>
        <select value={networkFilter} onChange={e => { setNetworkFilter(e.target.value); setPage(1); }}
          className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground/60 text-sm outline-none">
          <option value="">All Networks</option>
          {['visa', 'mastercard', 'amex', 'unionpay'].map(n => (
            <option key={n} value={n}>{titleCase(n)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-foreground/5">
              {['Cardholder', 'Card', 'Network', 'Type', 'Balance', 'Spent', 'Status', 'Issued', 'Expires'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-foreground/30 text-xs font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/[0.03]">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 9 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 w-20 rounded shimmer" /></td>
                ))}</tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-foreground/30 text-sm">No cards found</td></tr>
            ) : filtered.map(card => (
              <motion.tr key={card.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="hover:bg-foreground/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <p className="text-foreground text-sm">{card.profiles?.full_name ?? card.cardholder_name}</p>
                  <p className="text-foreground/30 text-xs">{card.profiles?.email ?? '—'}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-foreground/70 text-sm font-mono">{card.masked_pan ?? (card.last_four ? `•••• ${card.last_four}` : '—')}</p>
                  <p className="text-foreground/30 text-xs">{card.cardholder_name}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-medium capitalize ${NETWORK_COLORS[card.network] ?? 'text-foreground/50'}`}>
                    {card.network}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-foreground/50 text-xs capitalize">{card.card_type?.replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-foreground text-sm">{formatCurrency(card.current_balance, card.currency)}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-foreground/50 text-sm">{formatCurrency(card.total_spent, card.currency)}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-medium capitalize ${STATUS_STYLES[card.status] ?? 'bg-foreground/5 text-foreground/40'}`}>
                    {card.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-foreground/40 text-xs">{formatDate(card.created_at, 'short')}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-foreground/40 text-xs">{card.expires_at ? formatDate(card.expires_at, 'short') : '—'}</span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-foreground/5">
          <p className="text-foreground/30 text-xs">{total} total cards</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Prev</button>
            <span className="px-3 py-1.5 text-foreground/40 text-xs">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={filtered.length < 25}
              className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
