import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Plus, X } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatRelativeTime } from '@vpay/utils';
import toast from 'react-hot-toast';

interface Lead {
  id: string; name: string; email: string | null; phone: string | null; company: string | null;
  source: string | null; status: string; notes: string | null; created_at: string;
}

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
const STATUS_COLOR: Record<string, string> = {
  new: 'text-indigo-400', contacted: 'text-amber-400', qualified: 'text-purple-400',
  converted: 'text-emerald-400', lost: 'text-red-400',
};

export default function LeadsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', source: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-leads', filter],
    queryFn: () => api.get<{ success: boolean; data: Lead[] }>('/api/admin/leads', { params: filter ? { status: filter } : {} }),
  });

  const create = useMutation({
    mutationFn: () => api.post('/api/admin/leads', form),
    onSuccess: () => {
      toast.success('Lead added');
      qc.invalidateQueries({ queryKey: ['admin-leads'] });
      setShowForm(false);
      setForm({ name: '', email: '', phone: '', company: '', source: '' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/api/admin/leads/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-leads'] }),
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const leads = data?.data?.data ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
            <UserPlus className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-2xl">Leads</h1>
            <p className="text-foreground/40 text-sm">Prospective users/businesses before they sign up</p>
          </div>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-brand flex items-center gap-2 px-4 py-2 text-sm">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add lead'}
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Company</label>
              <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Email</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" className="input-field" />
            </div>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-foreground/60 text-sm mb-1.5">Source</label>
            <input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className="input-field" placeholder="Referral, landing page, event…" />
          </div>
          <button onClick={() => create.mutate()} disabled={create.isPending || !form.name} className="btn-primary w-full py-2.5">
            {create.isPending ? 'Adding…' : 'Add lead'}
          </button>
        </div>
      )}

      <div className="flex gap-2 p-1 rounded-xl bg-foreground/5 w-fit flex-wrap">
        <button onClick={() => setFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === '' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/50'}`}>All</button>
        {STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${filter === s ? 'bg-background text-foreground shadow-sm' : 'text-foreground/50'}`}>{s}</button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-6"><div className="w-32 h-4 rounded shimmer" /></div>
        ) : leads.length === 0 ? (
          <p className="text-foreground/20 text-sm p-8 text-center">No leads yet</p>
        ) : (
          <ul className="divide-y divide-foreground/5">
            {leads.map(l => (
              <li key={l.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-foreground text-sm font-medium">{l.name}{l.company ? ` · ${l.company}` : ''}</p>
                  <p className="text-foreground/40 text-xs mt-0.5">
                    {[l.email, l.phone].filter(Boolean).join(' · ') || 'No contact info'}
                    {l.source ? ` · ${l.source}` : ''} · {formatRelativeTime(new Date(l.created_at))}
                  </p>
                </div>
                <select
                  value={l.status}
                  onChange={e => updateStatus.mutate({ id: l.id, status: e.target.value })}
                  className={`bg-transparent text-xs font-medium capitalize border border-foreground/10 rounded-lg px-2 py-1 ${STATUS_COLOR[l.status]}`}
                >
                  {STATUSES.map(s => <option key={s} value={s} className="text-black">{s}</option>)}
                </select>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
