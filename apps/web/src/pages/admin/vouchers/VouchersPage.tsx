import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Ticket, Package, BarChart2, Search } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatDate, formatCurrency } from '@vpay/utils';

type VoucherBatch = {
  id: string;
  issuer_id: string;
  name?: string;
  type: string;
  gift_card_brand?: string;
  quantity: number;
  amount_per_voucher: number;
  currency: string;
  total_cost: number;
  total_fee: number;
  redeemed_count: number;
  expires_at: string;
  created_at: string;
  profiles?: { full_name: string; email: string };
};

type Tab = 'batches' | 'analytics';

export default function VouchersPage() {
  const [tab, setTab] = useState<Tab>('batches');

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <Ticket className="w-7 h-7 text-brand-400" />
        <h1 className="font-display font-bold text-foreground text-2xl">Vouchers</h1>
      </header>

      <div className="flex gap-1 p-1 bg-foreground/5 rounded-xl w-fit">
        {([
          { id: 'batches', label: 'Batches', icon: Package },
          { id: 'analytics', label: 'Analytics', icon: BarChart2 },
        ] as { id: Tab; label: string; icon: React.ElementType }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-foreground/10 text-foreground' : 'text-foreground/40 hover:text-foreground'}`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'batches' && <BatchesTab />}
      {tab === 'analytics' && <AnalyticsTab />}
    </div>
  );
}

function BatchesTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-voucher-batches', page],
    queryFn: () => api.get('/api/admin/voucher-batches', { params: { page, limit: 25 } }),
  });

  const batches: VoucherBatch[] = data?.data?.data ?? [];
  const total: number = data?.data?.meta?.total ?? 0;

  const filtered = search
    ? batches.filter(b =>
        b.name?.toLowerCase().includes(search.toLowerCase()) ||
        b.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        b.type.includes(search)
      )
    : batches;

  const totalVouchers = batches.reduce((s, b) => s + b.quantity, 0);
  const totalRedeemed = batches.reduce((s, b) => s + b.redeemed_count, 0);
  const totalRevenue = batches.reduce((s, b) => s + Number(b.total_cost), 0);
  const redemptionRate = totalVouchers ? Math.round((totalRedeemed / totalVouchers) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Batches', value: String(total) },
          { label: 'Total Vouchers', value: totalVouchers.toLocaleString() },
          { label: 'Redeemed', value: `${totalRedeemed.toLocaleString()} (${redemptionRate}%)` },
          { label: 'Total Revenue', value: formatCurrency(totalRevenue, 'USD') },
        ].map(s => (
          <div key={s.label} className="glass-card p-4">
            <p className="text-foreground/40 text-xs">{s.label}</p>
            <p className="text-xl font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 max-w-xs">
        <Search className="w-4 h-4 text-foreground/30" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, type, issuer..." className="bg-transparent text-foreground text-sm outline-none flex-1 placeholder:text-foreground/20" />
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-foreground/5">
              {['Batch', 'Issuer', 'Type', 'Qty', 'Per Voucher', 'Total Cost', 'Redeemed', 'Expires', 'Created'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-foreground/30 text-xs font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/[0.03]">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 9 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 w-20 rounded shimmer" /></td>
                ))}</tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-foreground/30 text-sm">No voucher batches found</td></tr>
            ) : filtered.map(batch => {
              const pct = batch.quantity ? Math.round((batch.redeemed_count / batch.quantity) * 100) : 0;
              return (
                <motion.tr key={batch.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="hover:bg-foreground/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-foreground text-sm font-medium">{batch.name ?? batch.id.slice(0, 8)}</p>
                    <p className="text-foreground/30 text-xs font-mono">{batch.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-foreground/70 text-sm">{batch.profiles?.full_name ?? '—'}</p>
                    <p className="text-foreground/30 text-xs">{batch.profiles?.email ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-foreground/70 text-xs capitalize">{batch.type.replace('_', ' ')}</span>
                      {batch.gift_card_brand && (
                        <p className="text-foreground/30 text-xs capitalize">{batch.gift_card_brand.replace('_', ' ')}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="text-foreground text-sm">{batch.quantity}</span></td>
                  <td className="px-4 py-3">
                    <span className="text-foreground text-sm">{formatCurrency(batch.amount_per_voucher, batch.currency)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-foreground text-sm font-medium">{formatCurrency(batch.total_cost, batch.currency)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 rounded-full bg-foreground/10">
                        <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-foreground/50 text-xs">{batch.redeemed_count}/{batch.quantity}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${new Date(batch.expires_at) < new Date() ? 'text-red-400' : 'text-foreground/40'}`}>
                      {formatDate(batch.expires_at, 'short')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-foreground/40 text-xs">{formatDate(batch.created_at, 'short')}</span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-foreground/5">
          <p className="text-foreground/30 text-xs">{total} total batches</p>
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

function AnalyticsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-voucher-batches-all'],
    queryFn: () => api.get('/api/admin/voucher-batches', { params: { page: 1, limit: 100 } }),
  });

  const batches: VoucherBatch[] = data?.data?.data ?? [];

  const byType = batches.reduce<Record<string, { qty: number; redeemed: number; revenue: number }>>((acc, b) => {
    if (!acc[b.type]) acc[b.type] = { qty: 0, redeemed: 0, revenue: 0 };
    acc[b.type].qty += b.quantity;
    acc[b.type].redeemed += b.redeemed_count;
    acc[b.type].revenue += Number(b.total_cost);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-foreground/5">
          <h3 className="text-foreground font-medium text-sm">Vouchers by Type</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-foreground/5">
              {['Type', 'Issued', 'Redeemed', 'Redemption Rate', 'Revenue'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-foreground/30 text-xs font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/[0.03]">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 w-20 rounded shimmer" /></td>
                ))}</tr>
              ))
            ) : Object.entries(byType).length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-foreground/30 text-sm">No data yet</td></tr>
            ) : Object.entries(byType).map(([type, stats]) => {
              const rate = stats.qty ? Math.round((stats.redeemed / stats.qty) * 100) : 0;
              return (
                <tr key={type} className="hover:bg-foreground/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-foreground text-sm capitalize">{type.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3"><span className="text-foreground/70 text-sm">{stats.qty.toLocaleString()}</span></td>
                  <td className="px-4 py-3"><span className="text-foreground/70 text-sm">{stats.redeemed.toLocaleString()}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-foreground/10">
                        <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${rate}%` }} />
                      </div>
                      <span className="text-foreground/50 text-xs">{rate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-emerald-400 text-sm font-medium">{formatCurrency(stats.revenue, 'USD')}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
