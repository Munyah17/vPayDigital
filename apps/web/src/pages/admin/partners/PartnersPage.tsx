import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Handshake as HandshakeIcon, Plus, X } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatRelativeTime } from '@vpay/utils';
import toast from 'react-hot-toast';

interface Partner {
  id: string; name: string; type: string | null; contact_email: string | null;
  revenue_share_percent: number | null; status: string; created_at: string;
}

const STATUS_COLOR: Record<string, string> = { active: 'text-emerald-400', inactive: 'text-foreground/30', pending: 'text-amber-400' };

export default function PartnersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: '', contact_email: '', contact_phone: '', revenue_share_percent: '' });

  const { data, isLoading } = useQuery({ queryKey: ['admin-partners'], queryFn: () => api.get<{ success: boolean; data: Partner[] }>('/api/admin/partners') });

  const create = useMutation({
    mutationFn: () => api.post('/api/admin/partners', { ...form, revenue_share_percent: form.revenue_share_percent ? parseFloat(form.revenue_share_percent) : undefined }),
    onSuccess: () => { toast.success('Partner added'); qc.invalidateQueries({ queryKey: ['admin-partners'] }); setShowForm(false); setForm({ name: '', type: '', contact_email: '', contact_phone: '', revenue_share_percent: '' }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/api/admin/partners/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-partners'] }),
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const partners = data?.data?.data ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
            <HandshakeIcon className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-2xl">Partners</h1>
            <p className="text-foreground/40 text-sm">Business/integration partners, distinct from regular users</p>
          </div>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-brand flex items-center gap-2 px-4 py-2 text-sm">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'New partner'}
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Partner name" className="input-field" />
            <input value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} placeholder="Type (integration, reseller…)" className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} type="email" placeholder="Contact email" className="input-field" />
            <input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="Contact phone" className="input-field" />
          </div>
          <div>
            <label className="block text-foreground/60 text-sm mb-1.5">Revenue share % (optional)</label>
            <input value={form.revenue_share_percent} onChange={e => setForm(f => ({ ...f, revenue_share_percent: e.target.value }))} type="number" step="0.1" min="0" max="100" className="input-field" />
          </div>
          <button onClick={() => create.mutate()} disabled={create.isPending || !form.name} className="btn-primary w-full py-2.5">
            {create.isPending ? 'Adding…' : 'Add partner'}
          </button>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-6"><div className="w-32 h-4 rounded shimmer" /></div>
        ) : partners.length === 0 ? (
          <p className="text-foreground/20 text-sm p-8 text-center">No partners yet</p>
        ) : (
          <ul className="divide-y divide-foreground/5">
            {partners.map(p => (
              <li key={p.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-foreground text-sm font-medium">{p.name}{p.type ? ` · ${p.type}` : ''}</p>
                  <p className="text-foreground/40 text-xs">
                    {p.contact_email ?? 'No contact'}{p.revenue_share_percent ? ` · ${p.revenue_share_percent}% revenue share` : ''} · {formatRelativeTime(new Date(p.created_at))}
                  </p>
                </div>
                <select
                  value={p.status}
                  onChange={e => updateStatus.mutate({ id: p.id, status: e.target.value })}
                  className={`bg-transparent text-xs font-medium capitalize border border-foreground/10 rounded-lg px-2 py-1 ${STATUS_COLOR[p.status]}`}
                >
                  {['pending', 'active', 'inactive'].map(s => <option key={s} value={s} className="text-black">{s}</option>)}
                </select>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
