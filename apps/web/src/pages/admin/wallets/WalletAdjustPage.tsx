import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, ArrowUpCircle, ArrowDownCircle, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatCurrency } from '@vpay/utils';
import toast from 'react-hot-toast';

interface Wallet {
  id: string; user_id: string; wallet_type: string; currency: string;
  balance: number; status: string; created_at: string;
  profiles: { full_name: string; email: string };
}

export default function WalletAdjustPage() {
  const [page, setPage] = useState(1);
  const [walletType, setWalletType] = useState('');
  const [search, setSearch] = useState('');
  const [adjustWallet, setAdjustWallet] = useState<Wallet | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-wallets', page, walletType],
    queryFn: () => api.get('/api/admin/wallets', { params: { page, limit: 25, wallet_type: walletType || undefined } }),
  });

  const wallets: Wallet[] = data?.data?.data ?? [];
  const total: number = data?.data?.meta?.total ?? 0;

  const filtered = search
    ? wallets.filter(w =>
        w.profiles?.email?.includes(search) ||
        w.profiles?.full_name?.toLowerCase().includes(search.toLowerCase())
      )
    : wallets;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-foreground">Wallet Adjustments</h1>
        <p className="text-foreground/30 text-sm mt-0.5">Manually credit or debit any user wallet. Every action is audit logged.</p>
      </div>

      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-amber-300 text-sm">
          Manual adjustments directly affect user balances and are recorded in the audit log.
          Always provide a clear reason — this is your paper trail for compliance.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 flex-1 max-w-xs">
          <Search className="w-4 h-4 text-foreground/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search user..." className="bg-transparent text-foreground text-sm outline-none flex-1 placeholder:text-foreground/20" />
        </div>
        <select value={walletType} onChange={e => setWalletType(e.target.value)}
          className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground/60 text-sm outline-none">
          <option value="">All Wallet Types</option>
          <option value="consumer">Consumer</option>
          <option value="agent_float">Agent Float</option>
          <option value="master_pool">Master Pool</option>
          <option value="fee_pool">Fee Pool</option>
          <option value="settlement">Settlement</option>
        </select>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-foreground/5">
              {['User', 'Type', 'Currency', 'Balance', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-foreground/30 text-xs font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/3">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 w-24 rounded shimmer" /></td>
                ))}</tr>
              ))
            ) : filtered.map(w => (
              <motion.tr key={w.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="hover:bg-foreground/2 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-foreground text-sm font-medium">{w.profiles?.full_name ?? '—'}</p>
                  <p className="text-foreground/30 text-xs">{w.profiles?.email ?? '—'}</p>
                </td>
                <td className="px-4 py-3"><span className="text-foreground/50 text-xs capitalize">{w.wallet_type.replace('_', ' ')}</span></td>
                <td className="px-4 py-3"><span className="text-foreground/60 text-sm font-mono">{w.currency}</span></td>
                <td className="px-4 py-3">
                  <span className="text-foreground font-semibold text-sm tabular-nums">{formatCurrency(w.balance, w.currency)}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge-${w.status === 'active' ? 'active' : w.status === 'frozen' ? 'pending' : 'inactive'}`}>{w.status}</span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setAdjustWallet(w)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 text-xs hover:bg-indigo-600/30 transition-colors">
                    Adjust
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-foreground/5">
          <p className="text-foreground/30 text-xs">{total} wallets</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Prev</button>
            <span className="px-3 py-1.5 text-foreground/40 text-xs">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={wallets.length < 25}
              className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Next</button>
          </div>
        </div>
      </div>

      {adjustWallet && (
        <AdjustDialog wallet={adjustWallet} onClose={() => setAdjustWallet(null)}
          onSuccess={() => { setAdjustWallet(null); refetch(); }} />
      )}
    </div>
  );
}

function AdjustDialog({ wallet, onClose, onSuccess }: { wallet: Wallet; onClose: () => void; onSuccess: () => void }) {
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (!reason.trim()) { toast.error('Reason is required'); return; }
    if (!confirm(`${direction === 'credit' ? 'Credit' : 'Debit'} ${formatCurrency(amt, wallet.currency)} ${direction === 'credit' ? 'to' : 'from'} ${wallet.profiles?.full_name}? This cannot be undone.`)) return;

    setLoading(true);
    try {
      await api.post('/api/admin/wallets/adjust', {
        wallet_id: wallet.id, direction, amount: amt, reason,
      });
      toast.success(`${direction === 'credit' ? 'Credited' : 'Debited'} ${formatCurrency(amt, wallet.currency)}`);
      onSuccess();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Adjustment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="panel p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="font-display font-bold text-foreground text-lg mb-1">Adjust Wallet</h3>
        <p className="text-foreground/40 text-sm mb-5">
          {wallet.profiles?.full_name} · {wallet.currency} {wallet.wallet_type.replace('_', ' ')}
          <span className="ml-2 text-foreground/60 font-semibold">{formatCurrency(wallet.balance, wallet.currency)}</span>
        </p>

        <form onSubmit={submit} className="space-y-4">
          {/* Direction toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setDirection('credit')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${direction === 'credit' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'border-foreground/10 text-foreground/40 hover:bg-foreground/5'}`}>
              <ArrowUpCircle className="w-4 h-4" /> Credit
            </button>
            <button type="button" onClick={() => setDirection('debit')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${direction === 'debit' ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'border-foreground/10 text-foreground/40 hover:bg-foreground/5'}`}>
              <ArrowDownCircle className="w-4 h-4" /> Debit
            </button>
          </div>

          <div>
            <label className="block text-foreground/50 text-sm mb-1.5">Amount ({wallet.currency})</label>
            <input value={amount} onChange={e => setAmount(e.target.value)}
              type="number" step="0.01" min="0.01" required className="input w-full" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-foreground/50 text-sm mb-1.5">Reason <span className="text-red-400">*</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              required rows={3} className="input w-full resize-none"
              placeholder="Dispute resolution, manual refund, error correction..." />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-foreground/10 text-foreground/50 hover:bg-foreground/5 text-sm">Cancel</button>
            <button type="submit" disabled={loading}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${direction === 'credit' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Confirm ${direction === 'credit' ? 'Credit' : 'Debit'}`}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
