import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, Search } from 'lucide-react';
import { api } from '../../lib/axios';
import { formatDate } from '@vpay/utils';

type Customer = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  kyc_status: string;
  created_at: string;
};

const KYC_STYLE: Record<string, string> = {
  approved: 'badge-active',
  pending: 'badge-pending',
  rejected: 'badge-failed',
  not_submitted: 'badge-inactive',
  expired: 'badge-inactive',
};

const STATUS_STYLE: Record<string, string> = {
  active: 'badge-active',
  suspended: 'badge-failed',
  pending_verification: 'badge-pending',
  closed: 'badge-inactive',
};

export default function Customers() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['agent-customers', page],
    queryFn: () => api.get('/api/agent/customers', { params: { page, limit: 20 } }),
  });

  const customers: Customer[] = (data as any)?.data?.data ?? [];
  const total: number = (data as any)?.data?.meta?.total ?? 0;

  const filtered = search
    ? customers.filter(c =>
        c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.includes(search)
      )
    : customers;

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-7 h-7 text-indigo-400" />
          <div>
            <h1 className="font-display font-bold text-foreground text-2xl">Customers</h1>
            <p className="text-foreground/40 text-sm">{total} users with your issued cards</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 max-w-sm">
        <Search className="w-4 h-4 text-foreground/30" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email..." className="bg-transparent text-foreground text-sm outline-none flex-1 placeholder:text-foreground/20" />
      </div>

      {isLoading ? (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <tbody className="divide-y divide-foreground/5">
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 w-24 rounded shimmer" /></td>
                ))}</tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Users className="w-12 h-12 text-foreground/20 mx-auto mb-3" />
          <p className="text-foreground/40 text-sm">
            {total === 0 ? 'No customers yet — issue cards to get started' : 'No customers match your search'}
          </p>
        </div>
      ) : (
        <>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-foreground/5">
                  {['Customer', 'Account Status', 'KYC', 'Joined', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-foreground/30 text-xs font-medium uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/[0.03]">
                {filtered.map(c => (
                  <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="hover:bg-foreground/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center text-indigo-400 text-xs font-bold flex-shrink-0">
                          {c.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-foreground text-sm font-medium">{c.full_name}</p>
                          <p className="text-foreground/30 text-xs">{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={STATUS_STYLE[c.status] ?? 'badge-inactive'}>{c.status.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={KYC_STYLE[c.kyc_status] ?? 'badge-inactive'}>{c.kyc_status.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-foreground/40 text-xs">{formatDate(c.created_at, 'short')}</span>
                    </td>
                    <td className="px-4 py-3" />
                  </motion.tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-foreground/30 text-xs">{total} total customers</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Prev</button>
              <span className="px-3 py-1.5 text-foreground/40 text-xs">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={filtered.length < 20}
                className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
