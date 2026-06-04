import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Search, CheckCircle, XCircle, Eye, X, ExternalLink } from 'lucide-react';
import { api } from '../../lib/axios';
import { formatDate } from '@vpay/utils';
import toast from 'react-hot-toast';

type KycDoc = {
  id: string;
  user_id: string;
  document_type: string;
  document_number?: string;
  front_url?: string;
  back_url?: string;
  selfie_url?: string;
  country_of_issue?: string;
  expiry_date?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  reviewed_at?: string;
  created_at: string;
  profiles?: { full_name: string; email: string; kyc_status: string };
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400',
  approved: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-red-500/10 text-red-400',
};

export default function KycReviewPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<KycDoc | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-kyc', page, statusFilter],
    queryFn: () => api.get('/api/admin/kyc', {
      params: { page, limit: 20, status: statusFilter || undefined },
    }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      api.patch(`/api/admin/kyc/${id}/review`, { status, rejection_reason: reason }),
    onSuccess: (_, vars) => {
      toast.success(`Document ${vars.status}`);
      qc.invalidateQueries({ queryKey: ['admin-kyc'] });
      setSelected(null);
      setRejectionReason('');
    },
    onError: () => toast.error('Review failed'),
  });

  const docs: KycDoc[] = data?.data?.data ?? [];
  const total: number = data?.data?.meta?.total ?? 0;

  const filtered = search
    ? docs.filter(d =>
        d.profiles?.email?.includes(search) ||
        d.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        d.document_type.includes(search)
      )
    : docs;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-brand-400" />
          <div>
            <h1 className="font-display font-bold text-white text-2xl">KYC Review</h1>
            <p className="text-white/30 text-sm">{total} documents</p>
          </div>
        </div>
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
          {['pending', 'approved', 'rejected', ''].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${statusFilter === s ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </header>

      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 max-w-xs">
        <Search className="w-4 h-4 text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search user or document type..." className="bg-transparent text-white text-sm outline-none flex-1 placeholder:text-white/20" />
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {['User', 'Document Type', 'Doc Number', 'Country', 'Expiry', 'Status', 'Submitted', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-white/30 text-xs font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 w-20 rounded shimmer" /></td>
                ))}</tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-white/30 text-sm">No KYC documents found</td></tr>
            ) : filtered.map(doc => (
              <motion.tr key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <p className="text-white text-sm">{doc.profiles?.full_name ?? '—'}</p>
                  <p className="text-white/30 text-xs">{doc.profiles?.email ?? '—'}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-white/70 text-sm capitalize">{doc.document_type.replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-white/50 text-xs font-mono">{doc.document_number ?? '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-white/50 text-xs">{doc.country_of_issue ?? '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-white/40 text-xs">{doc.expiry_date ? formatDate(doc.expiry_date, 'short') : '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-medium capitalize ${STATUS_STYLES[doc.status]}`}>
                    {doc.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-white/40 text-xs">{formatDate(doc.created_at, 'short')}</span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => { setSelected(doc); setRejectionReason(''); }}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-all">
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
          <p className="text-white/30 text-xs">{total} total</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-white/5 text-white/40 text-xs disabled:opacity-30 hover:bg-white/10">Prev</button>
            <span className="px-3 py-1.5 text-white/40 text-xs">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={filtered.length < 20}
              className="px-3 py-1.5 rounded-lg bg-white/5 text-white/40 text-xs disabled:opacity-30 hover:bg-white/10">Next</button>
          </div>
        </div>
      </div>

      {/* Review modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="glass-card w-full max-w-xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-white text-lg">Document Review</h2>
                <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/30">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* User info */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 text-sm">
                <InfoRow label="User" value={`${selected.profiles?.full_name ?? '—'} (${selected.profiles?.email ?? '—'})`} />
                <InfoRow label="Document" value={selected.document_type.replace('_', ' ')} />
                <InfoRow label="Number" value={selected.document_number ?? '—'} />
                <InfoRow label="Country" value={selected.country_of_issue ?? '—'} />
                {selected.expiry_date && <InfoRow label="Expiry" value={formatDate(selected.expiry_date, 'short')} />}
                <InfoRow label="Submitted" value={formatDate(selected.created_at, 'long')} />
              </div>

              {/* Document images */}
              <div className="space-y-3">
                {[
                  { label: 'Front', url: selected.front_url },
                  { label: 'Back', url: selected.back_url },
                  { label: 'Selfie', url: selected.selfie_url },
                ].filter(d => d.url).map(doc => (
                  <div key={doc.label} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-white/60 text-sm">{doc.label}</span>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-indigo-400 text-sm hover:text-indigo-300 transition-colors">
                      View <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>

              {/* Actions */}
              {selected.status === 'pending' ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-white/50 text-xs mb-1.5 block">Rejection Reason (required if rejecting)</label>
                    <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none resize-none placeholder:text-white/20 focus:border-indigo-500/50"
                      placeholder="e.g. Document expired, image unclear..." />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => reviewMutation.mutate({ id: selected.id, status: 'rejected', reason: rejectionReason })}
                      disabled={!rejectionReason || reviewMutation.isPending}
                      className="flex-1 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                    <button onClick={() => reviewMutation.mutate({ id: selected.id, status: 'approved' })}
                      disabled={reviewMutation.isPending}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4" /> Approve
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`flex items-center gap-2 p-3 rounded-xl border ${STATUS_STYLES[selected.status]} border-current/20`}>
                  {selected.status === 'approved' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
                  <div>
                    <p className="text-sm capitalize font-medium">{selected.status}</p>
                    {selected.rejection_reason && <p className="text-xs opacity-70">{selected.rejection_reason}</p>}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-white/40">{label}</span>
      <span className="text-white capitalize text-right">{value}</span>
    </div>
  );
}
