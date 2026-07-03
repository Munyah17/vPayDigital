import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Search, X, CheckCircle, Eye } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatDate, titleCase } from '@vpay/utils';
import toast from 'react-hot-toast';

type FraudFlag = {
  id: string;
  user_id: string;
  flag_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  risk_score: number;
  description: string;
  automated: boolean;
  resolution_notes?: string;
  created_at: string;
  profiles?: { full_name: string; email: string };
};

const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-red-500/10 text-red-400',
  investigating: 'bg-yellow-500/10 text-yellow-400',
  resolved: 'bg-emerald-500/10 text-emerald-400',
  false_positive: 'bg-foreground/5 text-foreground/40',
};

export default function FraudPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<FraudFlag | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-fraud', page, statusFilter, severityFilter],
    queryFn: () => api.get('/api/admin/fraud-flags', {
      params: { page, limit: 25, status: statusFilter || undefined, severity: severityFilter || undefined },
    }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      api.patch(`/api/admin/fraud-flags/${id}`, { status, resolution_notes: notes }),
    onSuccess: () => {
      toast.success('Fraud flag updated');
      qc.invalidateQueries({ queryKey: ['admin-fraud'] });
      setSelected(null);
      setResolutionNotes('');
    },
    onError: () => toast.error('Failed to update flag'),
  });

  const flags: FraudFlag[] = data?.data?.data ?? [];
  const total: number = data?.data?.meta?.total ?? 0;

  const filtered = search
    ? flags.filter(f =>
        f.flag_type.toLowerCase().includes(search.toLowerCase()) ||
        f.profiles?.email?.includes(search) ||
        f.profiles?.full_name?.toLowerCase().includes(search.toLowerCase())
      )
    : flags;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-7 h-7 text-red-400" />
          <div>
            <h1 className="font-display font-bold text-foreground text-2xl">Fraud Monitoring</h1>
            <p className="text-foreground/30 text-sm">{total} total flags</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(['open', 'investigating', 'resolved', 'false_positive'] as const).map(s => (
            <button key={s} onClick={() => { setStatusFilter(statusFilter === s ? '' : s); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${statusFilter === s ? STATUS_STYLES[s] + ' border-current' : 'bg-foreground/5 border-foreground/10 text-foreground/40 hover:text-foreground'}`}>
              {titleCase(s.replace('_', ' '))}
            </button>
          ))}
        </div>
      </header>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 flex-1 max-w-xs">
          <Search className="w-4 h-4 text-foreground/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search user or flag type..." className="bg-transparent text-foreground text-sm outline-none flex-1 placeholder:text-foreground/20" />
        </div>
        <select value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); setPage(1); }}
          className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground/60 text-sm outline-none">
          <option value="">All Severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Open', count: flags.filter(f => f.status === 'open').length, color: 'text-red-400' },
          { label: 'Investigating', count: flags.filter(f => f.status === 'investigating').length, color: 'text-yellow-400' },
          { label: 'Critical', count: flags.filter(f => f.severity === 'critical').length, color: 'text-orange-400' },
          { label: 'Resolved today', count: flags.filter(f => f.status === 'resolved').length, color: 'text-emerald-400' },
        ].map(stat => (
          <div key={stat.label} className="glass-card p-4">
            <p className="text-foreground/40 text-xs">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.count}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-foreground/5">
              {['User', 'Flag Type', 'Severity', 'Risk Score', 'Status', 'Automated', 'Created', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-foreground/30 text-xs font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/[0.03]">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 w-20 rounded shimmer" /></td>
                ))}</tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-foreground/30 text-sm">No fraud flags found</td></tr>
            ) : filtered.map(flag => (
              <motion.tr key={flag.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="hover:bg-foreground/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <p className="text-foreground text-sm font-medium">{flag.profiles?.full_name ?? '—'}</p>
                  <p className="text-foreground/30 text-xs">{flag.profiles?.email ?? flag.user_id?.slice(0, 8)}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-foreground/70 text-xs font-mono">{flag.flag_type}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-medium border capitalize ${SEVERITY_STYLES[flag.severity]}`}>
                    {flag.severity}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-foreground/10">
                      <div className="h-1.5 rounded-full bg-gradient-to-r from-yellow-500 to-red-500"
                        style={{ width: `${flag.risk_score ?? 0}%` }} />
                    </div>
                    <span className="text-foreground/50 text-xs">{flag.risk_score ?? 0}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-medium capitalize ${STATUS_STYLES[flag.status]}`}>
                    {flag.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${flag.automated ? 'text-blue-400' : 'text-foreground/40'}`}>
                    {flag.automated ? 'Auto' : 'Manual'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-foreground/40 text-xs">{formatDate(flag.created_at, 'short')}</span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => { setSelected(flag); setResolutionNotes(flag.resolution_notes ?? ''); }}
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
            <button onClick={() => setPage(p => p + 1)} disabled={filtered.length < 25}
              className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Next</button>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-foreground text-lg">Fraud Flag Review</h2>
                <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-foreground/10 text-foreground/30 hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <Row label="User" value={`${selected.profiles?.full_name ?? '—'} (${selected.profiles?.email ?? '—'})`} />
                <Row label="Flag Type" value={selected.flag_type} mono />
                <Row label="Severity" value={selected.severity} />
                <Row label="Risk Score" value={String(selected.risk_score ?? 0)} />
                <Row label="Description" value={selected.description ?? '—'} />
                <Row label="Created" value={formatDate(selected.created_at, 'long')} />
                {selected.resolution_notes && <Row label="Previous notes" value={selected.resolution_notes} />}
              </div>

              {selected.status !== 'resolved' && selected.status !== 'false_positive' && (
                <>
                  <div>
                    <label className="text-foreground/50 text-xs mb-1.5 block">Resolution Notes</label>
                    <textarea value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} rows={3}
                      className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground text-sm outline-none resize-none placeholder:text-foreground/20 focus:border-indigo-500/50"
                      placeholder="Add notes about this flag..." />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => updateMutation.mutate({ id: selected.id, status: 'investigating', notes: resolutionNotes })}
                      disabled={updateMutation.isPending}
                      className="flex-1 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-medium hover:bg-yellow-500/20 transition-all disabled:opacity-50">
                      Mark Investigating
                    </button>
                    <button onClick={() => updateMutation.mutate({ id: selected.id, status: 'false_positive', notes: resolutionNotes })}
                      disabled={updateMutation.isPending}
                      className="flex-1 py-2 rounded-xl bg-foreground/5 border border-foreground/10 text-foreground/60 text-sm font-medium hover:bg-foreground/10 transition-all disabled:opacity-50">
                      False Positive
                    </button>
                    <button onClick={() => updateMutation.mutate({ id: selected.id, status: 'resolved', notes: resolutionNotes })}
                      disabled={updateMutation.isPending}
                      className="flex-1 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-50">
                      Resolve
                    </button>
                  </div>
                </>
              )}

              {(selected.status === 'resolved' || selected.status === 'false_positive') && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <p className="text-emerald-400 text-sm capitalize">This flag has been {selected.status.replace('_', ' ')}</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-foreground/40 flex-shrink-0">{label}</span>
      <span className={`text-foreground text-right ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}
