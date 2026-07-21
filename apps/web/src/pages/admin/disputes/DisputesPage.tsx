import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gavel } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatRelativeTime } from '@vpay/utils';
import toast from 'react-hot-toast';

interface Dispute {
  id: string; reference: string; subject: string; description: string;
  status: string; resolution_notes: string | null; created_at: string;
  profiles: { email: string; full_name: string } | null;
}

const STATUS_COLOR: Record<string, string> = {
  open: 'text-amber-400', investigating: 'text-indigo-400',
  resolved: 'text-emerald-400', rejected: 'text-red-400',
};

export default function DisputesPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>('');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['admin-disputes', filter],
    queryFn: () => api.get<{ success: boolean; data: Dispute[] }>('/api/disputes/admin', { params: filter ? { status: filter } : {} }),
  });

  const update = useMutation({
    mutationFn: ({ id, status, resolution_notes }: { id: string; status: string; resolution_notes?: string }) =>
      api.patch(`/api/disputes/admin/${id}`, { status, resolution_notes }),
    onSuccess: () => { toast.success('Dispute updated'); qc.invalidateQueries({ queryKey: ['admin-disputes'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const disputes = data?.data?.data ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
            <Gavel className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-2xl">Disputes</h1>
            <p className="text-foreground/40 text-sm">Formal disputes raised by users, tracked to resolution</p>
          </div>
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="input-field w-auto">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="glass-card p-6"><div className="w-32 h-4 rounded shimmer" /></div>
        ) : disputes.length === 0 ? (
          <div className="glass-card p-8 text-center text-foreground/20 text-sm">No disputes {filter ? `with status "${filter}"` : 'yet'}</div>
        ) : disputes.map(d => (
          <div key={d.id} className="glass-card p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-foreground font-semibold text-sm">{d.subject}</p>
                <p className="text-foreground/30 text-xs font-mono">{d.reference} · {d.profiles?.email ?? 'unknown'} · {formatRelativeTime(new Date(d.created_at))}</p>
              </div>
              <span className={`text-xs font-medium capitalize ${STATUS_COLOR[d.status]}`}>{d.status}</span>
            </div>
            <p className="text-foreground/60 text-sm">{d.description}</p>

            {d.status !== 'resolved' && d.status !== 'rejected' && (
              <div className="space-y-2 pt-2 border-t border-foreground/5">
                <textarea
                  value={notes[d.id] ?? d.resolution_notes ?? ''}
                  onChange={e => setNotes(n => ({ ...n, [d.id]: e.target.value }))}
                  placeholder="Resolution notes…"
                  rows={2}
                  className="input-field resize-none text-sm"
                />
                <div className="flex gap-2 flex-wrap">
                  {d.status === 'open' && (
                    <button onClick={() => update.mutate({ id: d.id, status: 'investigating', resolution_notes: notes[d.id] })} className="btn-ghost px-3 py-1.5 text-xs">Start investigating</button>
                  )}
                  <button onClick={() => update.mutate({ id: d.id, status: 'resolved', resolution_notes: notes[d.id] })} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400">Mark resolved</button>
                  <button onClick={() => update.mutate({ id: d.id, status: 'rejected', resolution_notes: notes[d.id] })} className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400">Reject</button>
                </div>
              </div>
            )}
            {(d.status === 'resolved' || d.status === 'rejected') && d.resolution_notes && (
              <p className="text-foreground/40 text-xs pt-2 border-t border-foreground/5">Resolution: {d.resolution_notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
