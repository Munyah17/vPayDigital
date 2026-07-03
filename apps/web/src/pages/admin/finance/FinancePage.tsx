import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Banknote, ArrowDownLeft, BarChart2, RefreshCw, CheckCircle, XCircle, Clock, Plus, X } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatDate, formatCurrency, titleCase } from '@vpay/utils';
import toast from 'react-hot-toast';

type Tab = 'payouts' | 'settlements' | 'fx';

const PAYOUT_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400',
  processing: 'bg-blue-500/10 text-blue-400',
  completed: 'bg-emerald-500/10 text-emerald-400',
  failed: 'bg-red-500/10 text-red-400',
  cancelled: 'bg-foreground/5 text-foreground/40',
};

const SETTLEMENT_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400',
  processing: 'bg-blue-500/10 text-blue-400',
  completed: 'bg-emerald-500/10 text-emerald-400',
  failed: 'bg-red-500/10 text-red-400',
  disputed: 'bg-orange-500/10 text-orange-400',
};

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>('payouts');

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <Banknote className="w-7 h-7 text-brand-400" />
        <h1 className="font-display font-bold text-foreground text-2xl">Finance & Settlements</h1>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-foreground/5 rounded-xl w-fit">
        {([
          { id: 'payouts', label: 'Payout Requests', icon: ArrowDownLeft },
          { id: 'settlements', label: 'Settlements', icon: BarChart2 },
          { id: 'fx', label: 'Exchange Rates', icon: RefreshCw },
        ] as { id: Tab; label: string; icon: React.ElementType }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-foreground/10 text-foreground' : 'text-foreground/40 hover:text-foreground'}`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'payouts' && <PayoutsTab />}
      {tab === 'settlements' && <SettlementsTab />}
      {tab === 'fx' && <FXTab />}
    </div>
  );
}

function PayoutsTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState('');
  const [notes, setNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payouts', page, statusFilter, methodFilter],
    queryFn: () => api.get('/api/admin/payout-requests', {
      params: { page, limit: 25, status: statusFilter || undefined, method: methodFilter || undefined },
    }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, n }: { id: string; status: string; n?: string }) =>
      api.patch(`/api/admin/payout-requests/${id}/status`, { status, notes: n }),
    onSuccess: () => {
      toast.success('Payout status updated');
      qc.invalidateQueries({ queryKey: ['admin-payouts'] });
      setReviewing(null);
      setNotes('');
    },
    onError: () => toast.error('Failed to update payout'),
  });

  const payouts = data?.data?.data ?? [];
  const total = data?.data?.meta?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground/60 text-sm outline-none">
          <option value="">All Statuses</option>
          {['pending', 'processing', 'completed', 'failed', 'cancelled'].map(s => (
            <option key={s} value={s}>{titleCase(s)}</option>
          ))}
        </select>
        <select value={methodFilter} onChange={e => { setMethodFilter(e.target.value); setPage(1); }}
          className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground/60 text-sm outline-none">
          <option value="">All Methods</option>
          {['bank_transfer', 'crypto', 'mobile_money', 'card', 'internal'].map(m => (
            <option key={m} value={m}>{titleCase(m.replace('_', ' '))}</option>
          ))}
        </select>
        <div className="ml-auto text-foreground/30 text-sm self-center">{total} requests</div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-foreground/5">
              {['User', 'Amount', 'Method', 'Beneficiary', 'Reference', 'Status', 'Date', 'Action'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-foreground/30 text-xs font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/[0.03]">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 w-20 rounded shimmer" /></td>
                ))}</tr>
              ))
            ) : payouts.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-foreground/30 text-sm">No payout requests</td></tr>
            ) : payouts.map((p: any) => (
              <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="hover:bg-foreground/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <p className="text-foreground text-sm">{p.profiles?.full_name ?? '—'}</p>
                  <p className="text-foreground/30 text-xs">{p.profiles?.email ?? '—'}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-foreground text-sm font-medium">{formatCurrency(p.amount, p.currency)}</p>
                  <p className="text-foreground/30 text-xs">Fee: {formatCurrency(p.fee, p.currency)}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-foreground/60 text-xs capitalize">{p.method?.replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-3">
                  <p className="text-foreground/70 text-xs">{p.beneficiary_name ?? '—'}</p>
                  <p className="text-foreground/30 text-xs">{p.beneficiary_bank ?? ''}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-foreground/40 text-xs font-mono">{p.reference}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-medium capitalize ${PAYOUT_STATUS_STYLES[p.status] ?? 'bg-foreground/5 text-foreground/40'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-foreground/40 text-xs">{formatDate(p.created_at, 'short')}</span>
                </td>
                <td className="px-4 py-3">
                  {(p.status === 'pending' || p.status === 'processing') && (
                    <button onClick={() => { setReviewing(p.id); setActionStatus(''); setNotes(''); }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-400 text-xs hover:bg-indigo-600/30 transition-all">
                      Review
                    </button>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-foreground/5">
          <p className="text-foreground/30 text-xs">{total} total</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Prev</button>
            <span className="px-3 py-1.5 text-foreground/40 text-xs">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={payouts.length < 25}
              className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Next</button>
          </div>
        </div>
      </div>

      {/* Review modal */}
      {reviewing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setReviewing(null); }}>
          <div className="glass-card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">Review Payout</h3>
              <button onClick={() => setReviewing(null)} className="p-1.5 rounded-lg hover:bg-foreground/10 text-foreground/30">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-foreground/50 text-xs mb-1.5 block">Action</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { s: 'processing', label: 'Processing', icon: Clock, cls: 'text-blue-400 border-blue-500/20 hover:bg-blue-500/10' },
                  { s: 'completed', label: 'Approve', icon: CheckCircle, cls: 'text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10' },
                  { s: 'failed', label: 'Reject', icon: XCircle, cls: 'text-red-400 border-red-500/20 hover:bg-red-500/10' },
                ].map(opt => (
                  <button key={opt.s} onClick={() => setActionStatus(opt.s)}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-medium transition-all ${actionStatus === opt.s ? opt.cls + ' bg-opacity-20' : 'border-foreground/10 text-foreground/40'} ${opt.cls}`}>
                    <opt.icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-foreground/50 text-xs mb-1.5 block">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground text-sm outline-none resize-none placeholder:text-foreground/20 focus:border-indigo-500/50"
                placeholder="Optional notes..." />
            </div>
            <button onClick={() => actionStatus && updateMutation.mutate({ id: reviewing, status: actionStatus, n: notes })}
              disabled={!actionStatus || updateMutation.isPending}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-all disabled:opacity-40">
              {updateMutation.isPending ? 'Updating...' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SettlementsTab() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ start: '', end: '', currency: 'USD', notes: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-settlements', page],
    queryFn: () => api.get('/api/admin/settlements', { params: { page, limit: 20 } }),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/admin/settlements', {
      settlement_period_start: form.start,
      settlement_period_end: form.end,
      currency: form.currency,
      notes: form.notes,
    }),
    onSuccess: () => {
      toast.success('Settlement initiated');
      qc.invalidateQueries({ queryKey: ['admin-settlements'] });
      setShowCreate(false);
      setForm({ start: '', end: '', currency: 'USD', notes: '' });
    },
    onError: () => toast.error('Failed to create settlement'),
  });

  const settlements = data?.data?.data ?? [];
  const total = data?.data?.meta?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-foreground/30 text-sm">{total} settlements</p>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-all">
          <Plus className="w-4 h-4" /> New Settlement
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-foreground/5">
              {['Period', 'Transactions', 'Gross Amount', 'Fees', 'Net Amount', 'Currency', 'Status', 'Initiated'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-foreground/30 text-xs font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/[0.03]">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 w-20 rounded shimmer" /></td>
                ))}</tr>
              ))
            ) : settlements.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-foreground/30 text-sm">No settlements yet</td></tr>
            ) : settlements.map((s: any) => (
              <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="hover:bg-foreground/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <p className="text-foreground text-xs">{formatDate(s.settlement_period_start, 'short')}</p>
                  <p className="text-foreground/30 text-xs">→ {formatDate(s.settlement_period_end, 'short')}</p>
                </td>
                <td className="px-4 py-3"><span className="text-foreground/70 text-sm">{s.total_transactions ?? 0}</span></td>
                <td className="px-4 py-3"><span className="text-foreground text-sm font-medium">{formatCurrency(s.gross_amount, s.currency)}</span></td>
                <td className="px-4 py-3"><span className="text-red-400 text-sm">-{formatCurrency(s.total_fees, s.currency)}</span></td>
                <td className="px-4 py-3"><span className="text-emerald-400 text-sm font-medium">{formatCurrency(s.net_amount, s.currency)}</span></td>
                <td className="px-4 py-3"><span className="text-foreground/50 text-xs">{s.currency}</span></td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-medium capitalize ${SETTLEMENT_STATUS_STYLES[s.status] ?? 'bg-foreground/5 text-foreground/40'}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3"><span className="text-foreground/40 text-xs">{formatDate(s.created_at, 'short')}</span></td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-foreground/5">
          <p className="text-foreground/30 text-xs">{total} total</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Prev</button>
            <span className="px-3 py-1.5 text-foreground/40 text-xs">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={settlements.length < 20}
              className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Next</button>
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="glass-card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">Initiate Settlement</h3>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-foreground/10 text-foreground/30"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <Field label="Period Start">
                <input type="date" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-indigo-500/50" />
              </Field>
              <Field label="Period End">
                <input type="date" value={form.end} onChange={e => setForm(f => ({ ...f, end: e.target.value }))}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-indigo-500/50" />
              </Field>
              <Field label="Currency">
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground text-sm outline-none">
                  {['USD', 'EUR', 'GBP', 'ZAR', 'NGN', 'GHS', 'KES', 'ZWL'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Notes">
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground text-sm outline-none resize-none focus:border-indigo-500/50"
                  placeholder="Optional notes..." />
              </Field>
            </div>
            <button onClick={() => createMutation.mutate()}
              disabled={!form.start || !form.end || createMutation.isPending}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-all disabled:opacity-40">
              {createMutation.isPending ? 'Creating...' : 'Create Settlement'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FXTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-fx'],
    queryFn: () => api.get('/api/admin/exchange-rates'),
    refetchInterval: 60_000,
  });

  const rates = data?.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-foreground/30 text-sm">{rates.length} active rate pairs</p>
        <p className="text-foreground/20 text-xs">Auto-refreshes every 60s</p>
      </div>
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-foreground/5">
              {['Pair', 'Rate', 'Mid Rate', 'Spread', 'Provider', 'Fetched'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-foreground/30 text-xs font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/[0.03]">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 w-20 rounded shimmer" /></td>
                ))}</tr>
              ))
            ) : rates.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-foreground/30 text-sm">No exchange rates configured</td></tr>
            ) : rates.map((r: any) => (
              <tr key={r.id} className="hover:bg-foreground/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <span className="text-foreground font-medium font-mono text-sm">{r.from_currency}/{r.to_currency}</span>
                </td>
                <td className="px-4 py-3"><span className="text-foreground text-sm">{Number(r.rate).toFixed(6)}</span></td>
                <td className="px-4 py-3"><span className="text-foreground/60 text-sm">{r.mid_rate ? Number(r.mid_rate).toFixed(6) : '—'}</span></td>
                <td className="px-4 py-3">
                  <span className="text-yellow-400 text-sm">{((r.spread_percentage ?? 0) * 100).toFixed(2)}%</span>
                </td>
                <td className="px-4 py-3"><span className="text-foreground/40 text-xs">{r.provider}</span></td>
                <td className="px-4 py-3"><span className="text-foreground/40 text-xs">{formatDate(r.fetched_at, 'short')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-foreground/50 text-xs mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
