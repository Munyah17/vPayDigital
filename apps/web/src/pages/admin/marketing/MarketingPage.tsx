import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, Plus, X, Copy } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatRelativeTime } from '@vpay/utils';
import toast from 'react-hot-toast';

interface PromoCode {
  id: string; code: string; description: string | null; discount_type: string; discount_value: number;
  max_uses: number | null; used_count: number; active: boolean; expires_at: string | null; created_at: string;
}

export default function MarketingPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', description: '', discount_type: 'percent', discount_value: '', max_uses: '', expires_at: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-promo-codes'],
    queryFn: () => api.get<{ success: boolean; data: PromoCode[] }>('/api/promo'),
  });

  const create = useMutation({
    mutationFn: () => api.post('/api/promo', {
      code: form.code,
      description: form.description || undefined,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      max_uses: form.max_uses ? parseInt(form.max_uses) : undefined,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : undefined,
    }),
    onSuccess: () => {
      toast.success('Promo code created');
      qc.invalidateQueries({ queryKey: ['admin-promo-codes'] });
      setShowForm(false);
      setForm({ code: '', description: '', discount_type: 'percent', discount_value: '', max_uses: '', expires_at: '' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed to create'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/api/promo/${id}`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-promo-codes'] }),
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const codes = data?.data?.data ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
            <TrendingUp className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-2xl">Marketing</h1>
            <p className="text-foreground/40 text-sm">Promo codes — validated via GET /api/promo/validate/:code</p>
          </div>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-brand flex items-center gap-2 px-4 py-2 text-sm">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'New code'}
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Code</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} maxLength={30} className="input-field font-mono" placeholder="WELCOME10" />
            </div>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field" placeholder="New user welcome discount" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Type</label>
              <select value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value }))} className="input-field">
                <option value="percent">Percent off</option>
                <option value="flat">Flat amount off</option>
              </select>
            </div>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Value</label>
              <input value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))} type="number" step="0.01" min="0.01" className="input-field" placeholder={form.discount_type === 'percent' ? '10' : '5.00'} />
            </div>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Max uses</label>
              <input value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} type="number" min="1" className="input-field" placeholder="Unlimited" />
            </div>
          </div>
          <div>
            <label className="block text-foreground/60 text-sm mb-1.5">Expires (optional)</label>
            <input value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} type="date" className="input-field" />
          </div>
          <button onClick={() => create.mutate()} disabled={create.isPending || !form.code || !form.discount_value} className="btn-primary w-full py-2.5">
            {create.isPending ? 'Creating…' : 'Create promo code'}
          </button>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-6"><div className="w-32 h-4 rounded shimmer" /></div>
        ) : codes.length === 0 ? (
          <p className="text-foreground/20 text-sm p-8 text-center">No promo codes yet</p>
        ) : (
          <ul className="divide-y divide-foreground/5">
            {codes.map(c => (
              <li key={c.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <code className="text-foreground font-mono font-semibold text-sm">{c.code}</code>
                    <button onClick={() => { navigator.clipboard.writeText(c.code); toast.success('Copied'); }} className="p-1 rounded hover:bg-foreground/10">
                      <Copy className="w-3 h-3 text-foreground/30" />
                    </button>
                  </div>
                  <p className="text-foreground/40 text-xs mt-0.5">
                    {c.discount_type === 'percent' ? `${c.discount_value}% off` : `$${c.discount_value} off`}
                    {' · '}{c.used_count}{c.max_uses ? `/${c.max_uses}` : ''} used
                    {' · '}{formatRelativeTime(new Date(c.created_at))}
                  </p>
                </div>
                <button
                  onClick={() => toggleActive.mutate({ id: c.id, active: !c.active })}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${c.active ? 'bg-indigo-600' : 'bg-foreground/10'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${c.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
