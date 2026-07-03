import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { LifeBuoy, Search, Eye, X } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatDate, titleCase } from '@vpay/utils';
import toast from 'react-hot-toast';

type Ticket = {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
  resolved_at?: string;
  profiles?: { full_name: string; email: string };
};

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-foreground/5 text-foreground/40',
  normal: 'bg-blue-500/10 text-blue-400',
  high: 'bg-orange-500/10 text-orange-400',
  urgent: 'bg-red-500/10 text-red-400',
};

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-yellow-500/10 text-yellow-400',
  in_progress: 'bg-blue-500/10 text-blue-400',
  waiting_customer: 'bg-foreground/5 text-foreground/40',
  resolved: 'bg-emerald-500/10 text-emerald-400',
  closed: 'bg-foreground/5 text-foreground/30',
};

export default function SupportPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('open');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [newStatus, setNewStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-support', page, statusFilter, priorityFilter],
    queryFn: () => api.get('/api/admin/support-tickets', {
      params: { page, limit: 20, status: statusFilter || undefined, priority: priorityFilter || undefined },
    }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/admin/support-tickets/${id}`, { status }),
    onSuccess: () => {
      toast.success('Ticket updated');
      qc.invalidateQueries({ queryKey: ['admin-support'] });
      setSelected(null);
    },
    onError: () => toast.error('Update failed'),
  });

  const tickets: Ticket[] = data?.data?.data ?? [];
  const total: number = data?.data?.meta?.total ?? 0;

  const filtered = search
    ? tickets.filter(t =>
        t.profiles?.email?.includes(search) ||
        t.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        t.subject.toLowerCase().includes(search.toLowerCase()) ||
        t.ticket_number.includes(search)
      )
    : tickets;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LifeBuoy className="w-7 h-7 text-brand-400" />
          <div>
            <h1 className="font-display font-bold text-foreground text-2xl">Support Tickets</h1>
            <p className="text-foreground/30 text-sm">{total} tickets</p>
          </div>
        </div>
        <div className="flex gap-1 p-1 bg-foreground/5 rounded-xl">
          {['open', 'in_progress', 'resolved', ''].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? 'bg-foreground/10 text-foreground' : 'text-foreground/40 hover:text-foreground'}`}>
              {s ? titleCase(s.replace('_', ' ')) : 'All'}
            </button>
          ))}
        </div>
      </header>

      <div className="flex gap-3">
        <div className="flex items-center gap-2 bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 flex-1 max-w-xs">
          <Search className="w-4 h-4 text-foreground/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search user, subject, #TKT..." className="bg-transparent text-foreground text-sm outline-none flex-1 placeholder:text-foreground/20" />
        </div>
        <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}
          className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground/60 text-sm outline-none">
          <option value="">All Priorities</option>
          {['low', 'normal', 'high', 'urgent'].map(p => (
            <option key={p} value={p}>{titleCase(p)}</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Open', count: tickets.filter(t => t.status === 'open').length, color: 'text-yellow-400' },
          { label: 'In Progress', count: tickets.filter(t => t.status === 'in_progress').length, color: 'text-blue-400' },
          { label: 'Urgent', count: tickets.filter(t => t.priority === 'urgent').length, color: 'text-red-400' },
          { label: 'Resolved', count: tickets.filter(t => t.status === 'resolved').length, color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="glass-card p-4">
            <p className="text-foreground/40 text-xs">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.count}</p>
          </div>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-foreground/5">
              {['#', 'User', 'Subject', 'Category', 'Priority', 'Status', 'Created', 'Actions'].map(h => (
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
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-foreground/30 text-sm">No tickets found</td></tr>
            ) : filtered.map(ticket => (
              <motion.tr key={ticket.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="hover:bg-foreground/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <span className="text-foreground/40 text-xs font-mono">{ticket.ticket_number}</span>
                </td>
                <td className="px-4 py-3">
                  <p className="text-foreground text-sm">{ticket.profiles?.full_name ?? '—'}</p>
                  <p className="text-foreground/30 text-xs">{ticket.profiles?.email ?? '—'}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-foreground/80 text-sm max-w-[200px] truncate">{ticket.subject}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-foreground/50 text-xs capitalize">{ticket.category.replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-medium capitalize ${PRIORITY_STYLES[ticket.priority]}`}>
                    {ticket.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${STATUS_STYLES[ticket.status] ?? 'bg-foreground/5 text-foreground/40'}`}>
                    {titleCase(ticket.status.replace('_', ' '))}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-foreground/40 text-xs">{formatDate(ticket.created_at, 'short')}</span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => { setSelected(ticket); setNewStatus(ticket.status); }}
                    className="p-1.5 rounded-lg hover:bg-foreground/10 text-foreground/30 hover:text-foreground transition-all">
                    <Eye className="w-4 h-4" />
                  </button>
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
            <button onClick={() => setPage(p => p + 1)} disabled={filtered.length < 20}
              className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Next</button>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="glass-card w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-foreground">{selected.subject}</h2>
                <p className="text-foreground/30 text-xs">{selected.ticket_number}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-foreground/10 text-foreground/30">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <InfoRow label="User" value={`${selected.profiles?.full_name ?? '—'} (${selected.profiles?.email ?? '—'})`} />
              <InfoRow label="Category" value={titleCase(selected.category.replace('_', ' '))} />
              <InfoRow label="Priority" value={titleCase(selected.priority)} />
              <InfoRow label="Created" value={formatDate(selected.created_at, 'long')} />
            </div>
            <div className="p-4 rounded-xl bg-foreground/5 border border-foreground/10">
              <p className="text-foreground/60 text-sm whitespace-pre-wrap">{selected.description}</p>
            </div>
            <div>
              <label className="text-foreground/50 text-xs mb-1.5 block">Update Status</label>
              <div className="flex gap-2">
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                  className="flex-1 bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground text-sm outline-none">
                  {['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'].map(s => (
                    <option key={s} value={s}>{titleCase(s.replace('_', ' '))}</option>
                  ))}
                </select>
                <button onClick={() => updateMutation.mutate({ id: selected.id, status: newStatus })}
                  disabled={newStatus === selected.status || updateMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-all disabled:opacity-40">
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-foreground/40">{label}</span>
      <span className="text-foreground text-right">{value}</span>
    </div>
  );
}
