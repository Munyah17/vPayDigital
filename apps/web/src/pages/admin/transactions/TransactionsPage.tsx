import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatCurrency, formatDate, titleCase } from '@vpay/utils';

interface Txn {
  id: string; type: string; direction: string; amount: number; currency: string;
  status: string; description?: string; reference: string; created_at: string;
  profiles?: { full_name: string; email: string };
}

const STATUS_BADGE: Record<string, string> = {
  completed: 'badge-active', pending: 'badge-pending',
  processing: 'badge-pending', failed: 'badge-failed', reversed: 'badge-inactive',
};

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-transactions', page, type, direction, status],
    queryFn: () => api.get('/api/admin/transactions', { params: {
      page, limit: 25,
      type: type || undefined,
      direction: direction || undefined,
      status: status || undefined,
    }}),
  });

  const txns: Txn[] = data?.data?.data ?? [];
  const total: number = data?.data?.meta?.total ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-foreground">All Transactions</h1>
        <p className="text-foreground/30 text-sm mt-0.5">{total.toLocaleString()} platform-wide wallet transactions</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select value={type} onChange={e => { setType(e.target.value); setPage(1); }}
          className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground/60 text-sm outline-none">
          <option value="">All Types</option>
          {['deposit','withdrawal','transfer','card_load','card_debit','voucher_redemption','fee','adjustment','commission'].map(t => (
            <option key={t} value={t}>{titleCase(t.replace('_', ' '))}</option>
          ))}
        </select>
        <select value={direction} onChange={e => { setDirection(e.target.value); setPage(1); }}
          className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground/60 text-sm outline-none">
          <option value="">All Directions</option>
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground/60 text-sm outline-none">
          <option value="">All Status</option>
          {['pending','processing','completed','failed','reversed'].map(s => (
            <option key={s} value={s}>{titleCase(s)}</option>
          ))}
        </select>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-foreground/5">
              {['User', 'Type', 'Amount', 'Status', 'Reference', 'Date'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-foreground/30 text-xs font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/3">
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 w-24 rounded shimmer" /></td>
                ))}</tr>
              ))
            ) : txns.map(t => (
              <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="hover:bg-foreground/2 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-foreground text-sm font-medium">{t.profiles?.full_name ?? '—'}</p>
                  <p className="text-foreground/30 text-xs">{t.profiles?.email ?? '—'}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${t.direction === 'credit' ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                      {t.direction === 'credit'
                        ? <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                        : <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />}
                    </div>
                    <span className="text-foreground/60 text-xs capitalize">{t.type.replace('_', ' ')}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-semibold tabular-nums ${t.direction === 'credit' ? 'text-emerald-400' : 'text-foreground'}`}>
                    {t.direction === 'credit' ? '+' : '−'}{formatCurrency(t.amount, t.currency)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={STATUS_BADGE[t.status] ?? 'badge-inactive'}>{titleCase(t.status)}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-foreground/30 text-[10px] font-mono">{t.reference}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-foreground/40 text-xs">{formatDate(t.created_at, 'short')}</span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-foreground/5">
          <p className="text-foreground/30 text-xs">{total.toLocaleString()} transactions</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Prev</button>
            <span className="px-3 py-1.5 text-foreground/40 text-xs">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={txns.length < 25}
              className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
