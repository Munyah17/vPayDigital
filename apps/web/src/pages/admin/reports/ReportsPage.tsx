import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileBarChart, Download, DollarSign, Users, ArrowLeftRight } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../../../lib/adminAxios';
import { supabase } from '../../../lib/supabase';
import { formatCurrency } from '@vpay/utils';

type ReportTab = 'transactions' | 'revenue' | 'growth';

function daysAgoISO(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('revenue');
  const [rangeDays, setRangeDays] = useState(30);
  const from = daysAgoISO(rangeDays);

  const revenue = useQuery({
    queryKey: ['admin-report-revenue', rangeDays],
    queryFn: () => api.get<{ success: boolean; data: { total_fees: number; by_type: { type: string; amount: number }[]; transaction_count: number } }>('/api/admin/reports/revenue', { params: { from } }),
    enabled: tab === 'revenue',
  });

  const growth = useQuery({
    queryKey: ['admin-report-growth', rangeDays],
    queryFn: () => api.get<{ success: boolean; data: { total: number; by_role: Record<string, number>; daily: { date: string; count: number }[] } }>('/api/admin/reports/user-growth', { params: { from } }),
    enabled: tab === 'growth',
  });

  const transactions = useQuery({
    queryKey: ['admin-report-transactions', rangeDays],
    queryFn: () => api.get<{ success: boolean; data: Array<{ reference: string; type: string; amount: number; currency: string; status: string; created_at: string }> }>('/api/admin/reports/transactions', { params: { from } }),
    enabled: tab === 'transactions',
  });

  const downloadCsv = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${api.defaults.baseURL}/api/admin/reports/transactions?from=${from}&format=csv`, {
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${rangeDays}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
            <FileBarChart className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-2xl">Reports</h1>
            <p className="text-foreground/40 text-sm">Real revenue, growth, and transaction data — exportable</p>
          </div>
        </div>
        <select value={rangeDays} onChange={e => setRangeDays(Number(e.target.value))} className="input-field w-auto">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 12 months</option>
        </select>
      </div>

      <div className="flex gap-2 p-1 rounded-xl bg-foreground/5 w-fit">
        {([
          { key: 'revenue', label: 'Revenue', icon: DollarSign },
          { key: 'growth', label: 'User Growth', icon: Users },
          { key: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-background text-foreground shadow-sm' : 'text-foreground/50'}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'revenue' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <p className="text-foreground/30 text-xs uppercase tracking-wider">Total fees collected</p>
              <p className="font-display font-bold text-foreground text-2xl mt-1">
                {revenue.data ? formatCurrency(revenue.data.data.data.total_fees, 'USD') : '—'}
              </p>
            </div>
            <div className="glass-card p-5">
              <p className="text-foreground/30 text-xs uppercase tracking-wider">Fee-generating transactions</p>
              <p className="font-display font-bold text-foreground text-2xl mt-1">
                {revenue.data?.data?.data?.transaction_count?.toLocaleString() ?? '—'}
              </p>
            </div>
          </div>
          <div className="glass-card p-5">
            <h3 className="text-foreground font-semibold text-sm mb-4">Fees by transaction type</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenue.data?.data?.data?.by_type ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="type" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: 12 }} formatter={(v: number) => formatCurrency(v, 'USD')} />
                <Bar dataKey="amount" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'growth' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5">
              <p className="text-foreground/30 text-xs uppercase tracking-wider">New signups</p>
              <p className="font-display font-bold text-foreground text-2xl mt-1">{growth.data?.data?.data?.total ?? '—'}</p>
            </div>
            {Object.entries(growth.data?.data?.data?.by_role ?? {}).map(([role, count]) => (
              <div key={role} className="glass-card p-5">
                <p className="text-foreground/30 text-xs uppercase tracking-wider capitalize">{role}</p>
                <p className="font-display font-bold text-foreground text-2xl mt-1">{count}</p>
              </div>
            ))}
          </div>
          <div className="glass-card p-5">
            <h3 className="text-foreground font-semibold text-sm mb-4">Signups per day</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={growth.data?.data?.data?.daily ?? []}>
                <defs>
                  <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} fill="url(#growthGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'transactions' && (
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-foreground/5">
            <p className="text-foreground/40 text-sm">{transactions.data?.data?.data?.length ?? 0} transactions</p>
            <button onClick={downloadCsv} className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="text-foreground/30 text-xs uppercase tracking-wider">
                  <th className="text-left p-3">Reference</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-right p-3">Amount</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {(transactions.data?.data?.data ?? []).map(tx => (
                  <tr key={tx.reference} className="text-foreground/70">
                    <td className="p-3 font-mono text-xs">{tx.reference}</td>
                    <td className="p-3 capitalize">{tx.type.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(tx.amount, tx.currency)}</td>
                    <td className="p-3 capitalize">{tx.status}</td>
                    <td className="p-3 text-foreground/40">{new Date(tx.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
