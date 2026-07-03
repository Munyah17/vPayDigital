import { useEffect, useState, useMemo } from 'react';
import { ArrowUpRight, ArrowDownLeft, Search, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletStore } from '../../stores/walletStore';
import { formatCurrency, formatRelativeTime, titleCase } from '@vpay/utils';
import type { WalletTransaction } from '@vpay/types';

type Direction = 'all' | 'credit' | 'debit';

const TYPE_LABELS: Record<string, string> = {
  top_up: 'Top Up',
  transfer: 'Transfer',
  card_load: 'Card Load',
  payout: 'Payout',
  voucher_redemption: 'Voucher',
  fee: 'Fee',
  reversal: 'Reversal',
  commission: 'Commission',
  refund: 'Refund',
};

function groupByDate(txns: WalletTransaction[]): [string, WalletTransaction[]][] {
  const map = new Map<string, WalletTransaction[]>();
  for (const t of txns) {
    const d = new Date(t.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    let label: string;
    if (d.toDateString() === today.toDateString()) label = 'Today';
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
    else label = d.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short' });

    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(t);
  }
  return Array.from(map.entries());
}

export default function Transactions() {
  const { activeWallet, transactions, isLoading, fetchTransactions } = useWalletStore();
  const [direction, setDirection] = useState<Direction>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (activeWallet) fetchTransactions(activeWallet.id, { limit: 200 });
  }, [activeWallet?.id, fetchTransactions]);

  const allTypes = useMemo(() => {
    const set = new Set(transactions.map(t => t.type));
    return Array.from(set);
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (direction === 'credit' && t.direction !== 'credit') return false;
      if (direction === 'debit' && t.direction === 'credit') return false;
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const desc = (t.description ?? '').toLowerCase();
        const ref = (t.reference ?? '').toLowerCase();
        const type = titleCase(t.type).toLowerCase();
        if (!desc.includes(q) && !ref.includes(q) && !type.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, direction, typeFilter, search]);

  const totalIn = useMemo(() => filtered.filter(t => t.direction === 'credit').reduce((s, t) => s + t.amount, 0), [filtered]);
  const totalOut = useMemo(() => filtered.filter(t => t.direction !== 'credit').reduce((s, t) => s + t.amount, 0), [filtered]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-foreground text-2xl">Transactions</h1>
        <button
          onClick={() => setShowFilters(s => !s)}
          className={`p-2 rounded-xl border transition-all ${showFilters ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400' : 'bg-foreground/5 border-foreground/10 text-foreground/40 hover:text-foreground'}`}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Summary stats */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card px-4 py-3">
            <p className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Transactions</p>
            <p className="text-foreground font-bold font-display text-lg">{filtered.length}</p>
          </div>
          <div className="glass-card px-4 py-3">
            <p className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Money In</p>
            <p className="text-emerald-400 font-bold font-display text-lg tabular-nums">
              +{formatCurrency(totalIn, activeWallet?.currency ?? 'USD')}
            </p>
          </div>
          <div className="glass-card px-4 py-3">
            <p className="text-foreground/30 text-[10px] uppercase tracking-wider mb-1">Money Out</p>
            <p className="text-foreground font-bold font-display text-lg tabular-nums">
              -{formatCurrency(totalOut, activeWallet?.currency ?? 'USD')}
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2.5">
        <Search className="w-4 h-4 text-foreground/30 flex-shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          type="text"
          placeholder="Search by description, reference, type..."
          className="bg-transparent text-foreground/70 placeholder:text-foreground/20 text-sm flex-1 outline-none"
        />
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3">
              {/* Direction filter */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {(['all', 'credit', 'debit'] as Direction[]).map(d => (
                  <button
                    key={d}
                    onClick={() => setDirection(d)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                      direction === d
                        ? 'bg-indigo-600 text-white'
                        : 'bg-foreground/5 text-foreground/40 hover:text-foreground border border-foreground/10'
                    }`}
                  >
                    {d === 'all' ? 'All' : d === 'credit' ? 'Money In' : 'Money Out'}
                  </button>
                ))}
              </div>

              {/* Type filter */}
              {allTypes.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setTypeFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                      typeFilter === 'all'
                        ? 'bg-purple-600 text-white'
                        : 'bg-foreground/5 text-foreground/40 hover:text-foreground border border-foreground/10'
                    }`}
                  >
                    All types
                  </button>
                  {allTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => setTypeFilter(type)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                        typeFilter === type
                          ? 'bg-purple-600 text-white'
                          : 'bg-foreground/5 text-foreground/40 hover:text-foreground border border-foreground/10'
                      }`}
                    >
                      {TYPE_LABELS[type] ?? titleCase(type)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction list */}
      {isLoading && transactions.length === 0 ? (
        <div className="glass-card overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4 border-b border-foreground/5 last:border-0">
              <div className="w-9 h-9 rounded-xl shimmer flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="w-32 h-3 rounded shimmer" />
                <div className="w-20 h-2.5 rounded shimmer" />
              </div>
              <div className="w-20 h-4 rounded shimmer" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-foreground/20 text-sm">
            {transactions.length === 0 ? 'No transactions yet' : 'No transactions match your filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([label, txns]) => (
            <div key={label}>
              <p className="text-foreground/30 text-xs font-medium uppercase tracking-wider mb-2 px-1">{label}</p>
              <div className="glass-card overflow-hidden">
                <ul className="divide-y divide-foreground/5">
                  {txns.map(t => (
                    <li key={t.id} className="flex items-center gap-3 p-4 hover:bg-foreground/[0.02] transition-colors">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        t.direction === 'credit' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                      }`}>
                        {t.direction === 'credit'
                          ? <ArrowDownLeft className="w-4 h-4" />
                          : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-sm font-medium truncate">{t.description ?? titleCase(t.type)}</p>
                        <p className="text-foreground/30 text-xs">
                          {formatRelativeTime(new Date(t.created_at))}
                          {t.reference && <> · <span className="font-mono">{t.reference}</span></>}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-semibold tabular-nums ${t.direction === 'credit' ? 'text-emerald-400' : 'text-foreground'}`}>
                          {t.direction === 'credit' ? '+' : '−'}{formatCurrency(t.amount, t.currency)}
                        </p>
                        <p className="text-foreground/30 text-[10px]">{titleCase(t.status)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
