import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Landmark, Building2, X, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatDate } from '@vpay/utils';
import toast from 'react-hot-toast';

type IbanRequest = {
  id: string;
  user_id: string;
  status: 'requested' | 'in_review' | 'provisioning' | 'active' | 'rejected';
  requested_currency: string;
  iban?: string;
  bic?: string;
  bank_name?: string;
  rejection_reason?: string;
  created_at: string;
  profiles?: { full_name: string; email: string };
};

type LocalAccount = {
  id: string;
  account_number?: string;
  account_name?: string;
  bank_name?: string;
  currency: string;
  is_active: boolean;
  created_at: string;
  profiles?: { full_name: string; email: string };
};

const STATUS_STYLES: Record<string, string> = {
  requested: 'bg-amber-500/10 text-amber-400',
  in_review: 'bg-blue-500/10 text-blue-400',
  provisioning: 'bg-blue-500/10 text-blue-400',
  active: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-red-500/10 text-red-400',
};

type Tab = 'iban' | 'local';

export default function AdminBankingPage() {
  const [tab, setTab] = useState<Tab>('iban');

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <Landmark className="w-7 h-7 text-indigo-400" />
        <div>
          <h1 className="font-display font-bold text-foreground text-2xl">Banking Services</h1>
          <p className="text-foreground/30 text-sm">IBAN requests and local receiving accounts</p>
        </div>
      </header>

      <div className="flex gap-1 p-1 bg-foreground/5 rounded-xl w-fit">
        {(['iban', 'local'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === t ? 'bg-foreground/10 text-foreground' : 'text-foreground/40 hover:text-foreground'}`}>
            {t === 'iban' ? 'IBAN Requests' : 'Local Accounts'}
          </button>
        ))}
      </div>

      {tab === 'iban' ? <IbanRequestsTable /> : <LocalAccountsTable />}
    </div>
  );
}

function IbanRequestsTable() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<IbanRequest | null>(null);
  const [form, setForm] = useState({ iban: '', bic: '', bank_name: '', rejection_reason: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-iban-requests', page, statusFilter],
    queryFn: () => api.get('/api/admin/banking/iban-requests', {
      params: { page, limit: 20, status: statusFilter || undefined },
    }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/admin/banking/iban-requests/${id}`, { status, ...form }),
    onSuccess: (_, vars) => {
      toast.success(`Request marked ${vars.status}`);
      qc.invalidateQueries({ queryKey: ['admin-iban-requests'] });
      setSelected(null);
      setForm({ iban: '', bic: '', bank_name: '', rejection_reason: '' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Update failed'),
  });

  const requests: IbanRequest[] = data?.data?.data ?? [];
  const total: number = data?.data?.meta?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-foreground/5 rounded-xl overflow-x-auto max-w-full">
        {['', 'requested', 'in_review', 'provisioning', 'active', 'rejected'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize whitespace-nowrap ${statusFilter === s ? 'bg-foreground/10 text-foreground' : 'text-foreground/40 hover:text-foreground'}`}>
            {s ? s.replace('_', ' ') : 'All'}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-foreground/5">
              {['User', 'Currency', 'Status', 'Requested', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-foreground/30 text-xs font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/[0.03]">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 w-20 rounded shimmer" /></td>
                ))}</tr>
              ))
            ) : requests.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-foreground/30 text-sm">No IBAN requests found</td></tr>
            ) : requests.map(r => (
              <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-foreground/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <p className="text-foreground text-sm">{r.profiles?.full_name ?? '—'}</p>
                  <p className="text-foreground/30 text-xs">{r.profiles?.email ?? '—'}</p>
                </td>
                <td className="px-4 py-3"><span className="text-foreground/70 text-sm">{r.requested_currency}</span></td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-medium capitalize ${STATUS_STYLES[r.status]}`}>
                    {r.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3"><span className="text-foreground/40 text-xs">{formatDate(r.created_at, 'short')}</span></td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => { setSelected(r); setForm({ iban: r.iban ?? '', bic: r.bic ?? '', bank_name: r.bank_name ?? '', rejection_reason: '' }); }}
                    className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/60 text-xs hover:bg-foreground/10 transition-all"
                  >
                    Review
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-foreground/5">
          <p className="text-foreground/30 text-xs">{total} total</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Prev</button>
            <span className="px-3 py-1.5 text-foreground/40 text-xs">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={requests.length < 20}
              className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Next</button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="glass-card w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-foreground text-lg">Review IBAN Request</h2>
                <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-foreground/10 text-foreground/30">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-foreground/5 border border-foreground/10 text-sm space-y-1">
                <p className="text-foreground">{selected.profiles?.full_name} ({selected.profiles?.email})</p>
                <p className="text-foreground/40 text-xs">Requested {formatDate(selected.created_at, 'long')}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-foreground/50 text-xs mb-1.5 block">IBAN</label>
                  <input value={form.iban} onChange={e => setForm(f => ({ ...f, iban: e.target.value }))}
                    className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground text-sm outline-none placeholder:text-foreground/20 focus:border-indigo-500/50"
                    placeholder="e.g. DE89370400440532013000" />
                </div>
                <div>
                  <label className="text-foreground/50 text-xs mb-1.5 block">BIC / SWIFT</label>
                  <input value={form.bic} onChange={e => setForm(f => ({ ...f, bic: e.target.value }))}
                    className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground text-sm outline-none placeholder:text-foreground/20 focus:border-indigo-500/50"
                    placeholder="e.g. COBADEFFXXX" />
                </div>
                <div>
                  <label className="text-foreground/50 text-xs mb-1.5 block">Bank name</label>
                  <input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                    className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground text-sm outline-none placeholder:text-foreground/20 focus:border-indigo-500/50"
                    placeholder="e.g. Commerzbank" />
                </div>
                <div>
                  <label className="text-foreground/50 text-xs mb-1.5 block">Rejection reason (if rejecting)</label>
                  <textarea value={form.rejection_reason} onChange={e => setForm(f => ({ ...f, rejection_reason: e.target.value }))} rows={2}
                    className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground text-sm outline-none resize-none placeholder:text-foreground/20 focus:border-indigo-500/50"
                    placeholder="e.g. Failed compliance check" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => updateMutation.mutate({ id: selected.id, status: 'in_review' })}
                  disabled={updateMutation.isPending}
                  className="py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-all disabled:opacity-40">
                  Under Review
                </button>
                <button onClick={() => updateMutation.mutate({ id: selected.id, status: 'provisioning' })}
                  disabled={updateMutation.isPending}
                  className="py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-all disabled:opacity-40">
                  Provisioning
                </button>
                <button onClick={() => updateMutation.mutate({ id: selected.id, status: 'rejected' })}
                  disabled={!form.rejection_reason || updateMutation.isPending}
                  className="py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
                <button onClick={() => updateMutation.mutate({ id: selected.id, status: 'active' })}
                  disabled={!form.iban || !form.bic || !form.bank_name || updateMutation.isPending}
                  className="py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" /> Activate
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LocalAccountsTable() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-local-accounts', page],
    queryFn: () => api.get('/api/admin/banking/accounts', { params: { page, limit: 25 } }),
  });

  const accounts: LocalAccount[] = data?.data?.data ?? [];
  const total: number = data?.data?.meta?.total ?? 0;

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-foreground/5">
            {['User', 'Account Number', 'Bank', 'Currency', 'Status', 'Created'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-foreground/30 text-xs font-medium uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-foreground/[0.03]">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                <td key={j} className="px-4 py-3"><div className="h-4 w-20 rounded shimmer" /></td>
              ))}</tr>
            ))
          ) : accounts.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-12 text-center text-foreground/30 text-sm">No receiving accounts found</td></tr>
          ) : accounts.map(a => (
            <tr key={a.id} className="hover:bg-foreground/[0.02] transition-colors">
              <td className="px-4 py-3">
                <p className="text-foreground text-sm">{a.profiles?.full_name ?? '—'}</p>
                <p className="text-foreground/30 text-xs">{a.profiles?.email ?? '—'}</p>
              </td>
              <td className="px-4 py-3">
                <span className="text-foreground/70 text-sm font-mono flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-foreground/20" /> {a.account_number ?? '—'}
                </span>
              </td>
              <td className="px-4 py-3"><span className="text-foreground/50 text-xs">{a.bank_name ?? '—'}</span></td>
              <td className="px-4 py-3"><span className="text-foreground/70 text-sm">{a.currency}</span></td>
              <td className="px-4 py-3">
                <span className={a.is_active ? 'badge-active' : 'badge-inactive'}>{a.is_active ? 'Active' : 'Inactive'}</span>
              </td>
              <td className="px-4 py-3"><span className="text-foreground/40 text-xs">{formatDate(a.created_at, 'short')}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="flex items-center justify-between px-4 py-3 border-t border-foreground/5">
        <p className="text-foreground/30 text-xs">{total} total</p>
        <div className="flex gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Prev</button>
          <span className="px-3 py-1.5 text-foreground/40 text-xs">Page {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={accounts.length < 25}
            className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Next</button>
        </div>
      </div>
    </div>
  );
}
