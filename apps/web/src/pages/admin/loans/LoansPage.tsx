import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, Plus, X } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatCurrency, formatRelativeTime } from '@vpay/utils';
import toast from 'react-hot-toast';

interface Loan {
  id: string; reference: string; principal: number; interest_rate_percent: number; term_months: number;
  currency: string; status: string; total_repayable: number | null; amount_repaid: number;
  due_date: string | null; created_at: string;
  profiles: { email: string; full_name: string } | null;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-foreground/40', approved: 'text-indigo-400', active: 'text-amber-400',
  repaid: 'text-emerald-400', defaulted: 'text-red-400', rejected: 'text-foreground/30',
};

export default function LoansPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ borrower_email: '', principal: '', interest_rate_percent: '5', term_months: '12', currency: 'USD' });
  const [repayAmounts, setRepayAmounts] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({ queryKey: ['admin-loans'], queryFn: () => api.get<{ success: boolean; data: Loan[] }>('/api/admin/loans') });

  const create = useMutation({
    mutationFn: () => api.post('/api/admin/loans', { ...form, principal: parseFloat(form.principal), interest_rate_percent: parseFloat(form.interest_rate_percent), term_months: parseInt(form.term_months) }),
    onSuccess: () => { toast.success('Loan request created'); qc.invalidateQueries({ queryKey: ['admin-loans'] }); setShowForm(false); setForm({ borrower_email: '', principal: '', interest_rate_percent: '5', term_months: '12', currency: 'USD' }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const action = useMutation({
    mutationFn: ({ id, path, body }: { id: string; path: string; body?: unknown }) => api.post(`/api/admin/loans/${id}/${path}`, body),
    onSuccess: () => { toast.success('Updated'); qc.invalidateQueries({ queryKey: ['admin-loans'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const loans = data?.data?.data ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
            <Coins className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-2xl">Loans</h1>
            <p className="text-foreground/40 text-sm">Origination, disbursement, and repayment tracking</p>
          </div>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-brand flex items-center gap-2 px-4 py-2 text-sm">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'New loan'}
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-6 space-y-4">
          <div>
            <label className="block text-foreground/60 text-sm mb-1.5">Borrower email</label>
            <input value={form.borrower_email} onChange={e => setForm(f => ({ ...f, borrower_email: e.target.value }))} type="email" className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Principal</label>
              <input value={form.principal} onChange={e => setForm(f => ({ ...f, principal: e.target.value }))} type="number" step="0.01" min="0.01" className="input-field" />
            </div>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Currency</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="input-field">
                {['USD', 'EUR', 'GBP', 'ZAR'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Interest rate %</label>
              <input value={form.interest_rate_percent} onChange={e => setForm(f => ({ ...f, interest_rate_percent: e.target.value }))} type="number" step="0.1" min="0" className="input-field" />
            </div>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Term (months)</label>
              <input value={form.term_months} onChange={e => setForm(f => ({ ...f, term_months: e.target.value }))} type="number" min="1" className="input-field" />
            </div>
          </div>
          <button onClick={() => create.mutate()} disabled={create.isPending || !form.borrower_email || !form.principal} className="btn-primary w-full py-2.5">
            {create.isPending ? 'Creating…' : 'Create loan request'}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="glass-card p-6"><div className="w-32 h-4 rounded shimmer" /></div>
        ) : loans.length === 0 ? (
          <div className="glass-card p-8 text-center text-foreground/20 text-sm">No loans yet</div>
        ) : loans.map(l => (
          <div key={l.id} className="glass-card p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-foreground font-semibold text-sm">{l.profiles?.email ?? 'Unknown borrower'}</p>
                <p className="text-foreground/30 text-xs font-mono">{l.reference} · {l.interest_rate_percent}% · {l.term_months}mo · {formatRelativeTime(new Date(l.created_at))}</p>
              </div>
              <div className="text-right">
                <p className="text-foreground font-semibold">{formatCurrency(l.principal, l.currency)}</p>
                <p className={`text-xs font-medium capitalize ${STATUS_COLOR[l.status]}`}>{l.status}</p>
              </div>
            </div>
            {l.total_repayable !== null && (
              <p className="text-foreground/40 text-xs">
                Repayable: {formatCurrency(l.total_repayable, l.currency)} · Repaid so far: {formatCurrency(l.amount_repaid, l.currency)}
                {l.due_date && ` · Due ${new Date(l.due_date).toLocaleDateString()}`}
              </p>
            )}
            <div className="flex gap-2 flex-wrap items-center">
              {l.status === 'pending' && (
                <>
                  <button onClick={() => action.mutate({ id: l.id, path: 'approve' })} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400">Approve</button>
                  <button onClick={() => action.mutate({ id: l.id, path: 'reject' })} className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400">Reject</button>
                </>
              )}
              {l.status === 'approved' && (
                <button onClick={() => action.mutate({ id: l.id, path: 'disburse' })} className="btn-brand px-3 py-1.5 text-xs">Disburse funds</button>
              )}
              {l.status === 'active' && (
                <>
                  <input
                    value={repayAmounts[l.id] ?? ''}
                    onChange={e => setRepayAmounts(a => ({ ...a, [l.id]: e.target.value }))}
                    type="number" step="0.01" min="0.01" placeholder="Amount"
                    className="input-field w-28 text-xs py-1.5"
                  />
                  <button
                    onClick={() => { action.mutate({ id: l.id, path: 'repay', body: { amount: parseFloat(repayAmounts[l.id] || '0') } }); setRepayAmounts(a => ({ ...a, [l.id]: '' })); }}
                    disabled={!repayAmounts[l.id]}
                    className="btn-ghost px-3 py-1.5 text-xs"
                  >
                    Record repayment
                  </button>
                  <button onClick={() => action.mutate({ id: l.id, path: 'default' })} className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400">Mark defaulted</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
