import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatRelativeTime } from '@vpay/utils';
import toast from 'react-hot-toast';

interface Communication {
  id: string; channel: string; segment: string; subject: string | null; message: string;
  status: string; recipient_count: number; sent_count: number; failed_count: number;
  error_message: string | null; created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'text-foreground/40', sending: 'text-indigo-400', sent: 'text-emerald-400', failed: 'text-red-400',
};

export default function CommunicationsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ channel: 'email', segment: 'all', subject: '', message: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-communications'],
    queryFn: () => api.get<{ success: boolean; data: Communication[] }>('/api/admin/communications'),
  });

  const send = useMutation({
    mutationFn: () => api.post('/api/admin/communications', form),
    onSuccess: (res) => {
      const status = (res.data as any)?.data?.status;
      if (status === 'draft') toast('Saved as draft — see message below for why', { icon: '⚠️' });
      else toast.success('Sent');
      qc.invalidateQueries({ queryKey: ['admin-communications'] });
      setForm({ channel: 'email', segment: 'all', subject: '', message: '' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const history = data?.data?.data ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
          <Send className="w-5 h-5 text-foreground" />
        </div>
        <div>
          <h1 className="font-display font-bold text-foreground text-2xl">Mass Communication</h1>
          <p className="text-foreground/40 text-sm">Email a segment of users directly</p>
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-foreground/60 text-sm mb-1.5">Channel</label>
            <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} className="input-field">
              <option value="email">Email</option>
              <option value="sms">SMS (not connected yet)</option>
              <option value="push">Push (not connected yet)</option>
            </select>
          </div>
          <div>
            <label className="block text-foreground/60 text-sm mb-1.5">Segment</label>
            <select value={form.segment} onChange={e => setForm(f => ({ ...f, segment: e.target.value }))} className="input-field">
              <option value="all">Everyone</option>
              <option value="consumer">Consumers</option>
              <option value="agent">Agents</option>
              <option value="staff">Staff</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-foreground/60 text-sm mb-1.5">Subject</label>
          <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="input-field" placeholder="Platform update" />
        </div>
        <div>
          <label className="block text-foreground/60 text-sm mb-1.5">Message</label>
          <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={5} className="input-field resize-none" />
        </div>
        <button onClick={() => send.mutate()} disabled={send.isPending || !form.message} className="btn-primary w-full py-2.5">
          {send.isPending ? 'Sending…' : 'Send'}
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <p className="text-foreground font-semibold text-sm p-4 border-b border-foreground/5">History</p>
        {isLoading ? (
          <div className="p-6"><div className="w-32 h-4 rounded shimmer" /></div>
        ) : history.length === 0 ? (
          <p className="text-foreground/20 text-sm p-8 text-center">Nothing sent yet</p>
        ) : (
          <ul className="divide-y divide-foreground/5">
            {history.map(c => (
              <li key={c.id} className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-foreground text-sm font-medium">{c.subject || '(no subject)'}</p>
                  <span className={`text-xs font-medium capitalize ${STATUS_COLOR[c.status]}`}>{c.status}</span>
                </div>
                <p className="text-foreground/40 text-xs mt-0.5">
                  {c.channel} · {c.segment} · {c.sent_count}/{c.recipient_count} sent · {formatRelativeTime(new Date(c.created_at))}
                </p>
                {c.error_message && <p className="text-amber-400/80 text-xs mt-1">{c.error_message}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
