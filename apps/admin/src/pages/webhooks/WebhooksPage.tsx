import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Webhook, RefreshCw, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../lib/axios';
import { formatDate } from '@vpay/utils';
import toast from 'react-hot-toast';

type WebhookEvent = {
  id: string;
  event_type: string;
  source: string;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  max_attempts: number;
  last_attempt_at?: string;
  next_retry_at?: string;
  error_message?: string;
  processed_at?: string;
  idempotency_key?: string;
  payload: Record<string, unknown>;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400',
  delivered: 'bg-emerald-500/10 text-emerald-400',
  failed: 'bg-red-500/10 text-red-400',
  retrying: 'bg-blue-500/10 text-blue-400',
};

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-yellow-400',
  delivered: 'bg-emerald-400',
  failed: 'bg-red-400',
  retrying: 'bg-blue-400 animate-pulse',
};

export default function WebhooksPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-webhooks', page, statusFilter, eventTypeFilter],
    queryFn: () => api.get('/api/admin/webhook-events', {
      params: { page, limit: 25, status: statusFilter || undefined, event_type: eventTypeFilter || undefined },
    }),
    refetchInterval: 15_000,
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/webhook-events/${id}/retry`),
    onSuccess: () => {
      toast.success('Webhook queued for retry');
      qc.invalidateQueries({ queryKey: ['admin-webhooks'] });
    },
    onError: () => toast.error('Failed to retry webhook'),
  });

  const events: WebhookEvent[] = data?.data?.data ?? [];
  const total: number = data?.data?.meta?.total ?? 0;

  const filtered = search
    ? events.filter(e =>
        e.event_type.toLowerCase().includes(search.toLowerCase()) ||
        e.idempotency_key?.includes(search) ||
        e.source?.includes(search)
      )
    : events;

  const statCounts = {
    delivered: events.filter(e => e.status === 'delivered').length,
    failed: events.filter(e => e.status === 'failed').length,
    retrying: events.filter(e => e.status === 'retrying').length,
    pending: events.filter(e => e.status === 'pending').length,
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Webhook className="w-7 h-7 text-brand-400" />
          <div>
            <h1 className="font-display font-bold text-white text-2xl">Webhook Events</h1>
            <p className="text-white/30 text-sm">{total} total · live feed every 15s</p>
          </div>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm hover:text-white hover:bg-white/10 transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </header>

      {/* Status summary */}
      <div className="grid grid-cols-4 gap-4">
        {(Object.entries(statCounts) as [string, number][]).map(([s, n]) => (
          <button key={s} onClick={() => { setStatusFilter(statusFilter === s ? '' : s); setPage(1); }}
            className={`glass-card p-4 text-left transition-all hover:border-white/10 ${statusFilter === s ? 'border-white/20' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} />
              <p className="text-white/40 text-xs capitalize">{s}</p>
            </div>
            <p className="text-2xl font-bold text-white">{n}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex-1 max-w-xs">
          <Search className="w-4 h-4 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search event type, key..." className="bg-transparent text-white text-sm outline-none flex-1 placeholder:text-white/20" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white/60 text-sm outline-none">
          <option value="">All Statuses</option>
          {['pending', 'delivered', 'failed', 'retrying'].map(s => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </select>
        <select value={eventTypeFilter} onChange={e => { setEventTypeFilter(e.target.value); setPage(1); }}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white/60 text-sm outline-none">
          <option value="">All Event Types</option>
          {[
            'card.issued', 'card.terminated', 'card.frozen', 'card.transaction',
            'wallet.funded', 'wallet.debited', 'payout.completed', 'payout.failed',
            'voucher.issued', 'voucher.redeemed', 'kyc.approved', 'fraud.detected',
          ].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Events list */}
      <div className="glass-card overflow-hidden divide-y divide-white/[0.03]">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-4 flex gap-4 items-center">
              <div className="w-2 h-2 rounded-full shimmer" />
              <div className="h-4 w-40 rounded shimmer" />
              <div className="h-4 w-24 rounded shimmer ml-auto" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-white/30 text-sm">No webhook events found</div>
        ) : filtered.map(event => (
          <motion.div key={event.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="px-4 py-3 flex items-center gap-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
              onClick={() => setExpanded(expanded === event.id ? null : event.id)}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[event.status]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-white text-sm font-mono">{event.event_type}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_STYLES[event.status]}`}>{event.status}</span>
                  <span className="text-white/20 text-xs">{event.source}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-white/30 text-xs">{formatDate(event.created_at, 'short')}</span>
                  <span className="text-white/20 text-xs">{event.attempts}/{event.max_attempts} attempts</span>
                  {event.idempotency_key && (
                    <span className="text-white/20 text-xs font-mono truncate max-w-[200px]">{event.idempotency_key}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {event.status === 'failed' && (
                  <button onClick={e => { e.stopPropagation(); retryMutation.mutate(event.id); }}
                    disabled={retryMutation.isPending}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/20 transition-all disabled:opacity-50">
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                )}
                {expanded === event.id ? (
                  <ChevronUp className="w-4 h-4 text-white/30" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white/30" />
                )}
              </div>
            </div>

            {/* Expanded payload view */}
            {expanded === event.id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="border-t border-white/5 bg-black/20">
                <div className="px-4 py-4 space-y-3">
                  {event.error_message && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <p className="text-red-400 text-xs font-mono">{event.error_message}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-white/30 text-xs mb-2 font-medium uppercase tracking-wider">Payload</p>
                    <pre className="text-white/60 text-xs font-mono overflow-auto max-h-48 p-3 bg-black/30 rounded-xl">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <p className="text-white/30 mb-0.5">Last attempt</p>
                      <p className="text-white/60">{event.last_attempt_at ? formatDate(event.last_attempt_at, 'short') : '—'}</p>
                    </div>
                    <div>
                      <p className="text-white/30 mb-0.5">Next retry</p>
                      <p className="text-white/60">{event.next_retry_at ? formatDate(event.next_retry_at, 'short') : '—'}</p>
                    </div>
                    <div>
                      <p className="text-white/30 mb-0.5">Processed at</p>
                      <p className="text-white/60">{event.processed_at ? formatDate(event.processed_at, 'short') : '—'}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-white/30 text-xs">{total} total events</p>
        <div className="flex gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg bg-white/5 text-white/40 text-xs disabled:opacity-30 hover:bg-white/10">Prev</button>
          <span className="px-3 py-1.5 text-white/40 text-xs">Page {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={filtered.length < 25}
            className="px-3 py-1.5 rounded-lg bg-white/5 text-white/40 text-xs disabled:opacity-30 hover:bg-white/10">Next</button>
        </div>
      </div>
    </div>
  );
}
