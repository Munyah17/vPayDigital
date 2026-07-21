import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Handshake, Plus, X } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatCurrency, formatRelativeTime } from '@vpay/utils';
import toast from 'react-hot-toast';

interface EscrowTx {
  id: string; reference: string; amount: number; currency: string; description: string;
  status: string; created_at: string;
  payer: { email: string; full_name: string } | null;
  payee: { email: string; full_name: string } | null;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-foreground/40', funded: 'text-indigo-400', released: 'text-emerald-400',
  refunded: 'text-amber-400', disputed: 'text-red-400', cancelled: 'text-foreground/30',
};

export default function EscrowPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ payer_email: '', payee_email: '', amount: '', currency: 'USD', description: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-escrow'],
    queryFn: () => api.get<{ success: boolean; data: EscrowTx[] }>('/api/admin/escrow'),
  });

  const create = useMutation({
    mutationFn: () => api.post('/api/admin/escrow', { ...form, amount: parseFloat(form.amount) }),
    onSuccess: () => {
      toast.success('Escrow funded');
      qc.invalidateQueries({ queryKey: ['admin-escrow'] });
      setShowForm(false);
      setForm({ payer_email: '', payee_email: '', amount: '', currency: 'USD', description: '' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed to create escrow'),
  });

  const release = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/escrow/${id}/release`),
    onSuccess: () => { toast.success('Released to payee'); qc.invalidateQueries({ queryKey: ['admin-escrow'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const refund = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/escrow/${id}/refund`),
    onSuccess: () => { toast.success('Refunded to payer'); qc.invalidateQueries({ queryKey: ['admin-escrow'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const escrows = data?.data?.data ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
            <Handshake className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-2xl">Escrow</h1>
            <p className="text-foreground/40 text-sm">Hold funds between two users until released or refunded</p>
          </div>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-brand flex items-center gap-2 px-4 py-2 text-sm">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'New escrow'}
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Payer email</label>
              <input value={form.payer_email} onChange={e => setForm(f => ({ ...f, payer_email: e.target.value }))} type="email" className="input-field" />
            </div>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Payee email</label>
              <input value={form.payee_email} onChange={e => setForm(f => ({ ...f, payee_email: e.target.value }))} type="email" className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Amount</label>
              <input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} type="number" step="0.01" min="0.01" className="input-field" />
            </div>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Currency</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="input-field">
                {['USD', 'EUR', 'GBP', 'ZAR'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-foreground/60 text-sm mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="input-field resize-none" />
          </div>
          <p className="text-foreground/30 text-xs">Creating debits the payer's wallet immediately — the funds are held until you release or refund.</p>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending || !form.payer_email || !form.payee_email || !form.amount || !form.description}
            className="btn-primary w-full py-2.5"
          >
            {create.isPending ? 'Creating…' : 'Create & fund escrow'}
          </button>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-6"><div className="w-32 h-4 rounded shimmer" /></div>
        ) : escrows.length === 0 ? (
          <p className="text-foreground/20 text-sm p-8 text-center">No escrow transactions yet</p>
        ) : (
          <ul className="divide-y divide-foreground/5">
            {escrows.map(e => (
              <li key={e.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-foreground text-sm font-medium">{e.description}</p>
                    <p className="text-foreground/30 text-xs font-mono">{e.reference} · {formatRelativeTime(new Date(e.created_at))}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-foreground font-semibold">{formatCurrency(e.amount, e.currency)}</p>
                    <p className={`text-xs font-medium capitalize ${STATUS_COLOR[e.status]}`}>{e.status}</p>
                  </div>
                </div>
                <p className="text-foreground/40 text-xs">
                  {e.payer?.email ?? '—'} → {e.payee?.email ?? '—'}
                </p>
                {e.status === 'funded' && (
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => release.mutate(e.id)} disabled={release.isPending} className="btn-ghost px-3 py-1.5 text-xs">Release to payee</button>
                    <button onClick={() => refund.mutate(e.id)} disabled={refund.isPending} className="px-3 py-1.5 text-xs rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400">Refund payer</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
