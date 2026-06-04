import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, UserCheck, UserX } from 'lucide-react';
import { api } from '../../lib/axios';
import { formatDate, titleCase } from '@vpay/utils';
import type { Profile } from '@vpay/types';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, role, status],
    queryFn: () => api.get('/api/admin/users', { params: { page, limit: 20, role: role || undefined, status: status || undefined } }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/admin/users/${id}/status`, { status }),
    onSuccess: () => { toast.success('User status updated'); qc.invalidateQueries({ queryKey: ['admin-users'] }); },
    onError: () => toast.error('Failed to update status'),
  });

  const users: Profile[] = data?.data?.data ?? [];
  const total: number = data?.data?.meta?.total ?? 0;

  const filtered = search
    ? users.filter(u => u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.includes(search))
    : users;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Users</h1>
          <p className="text-white/30 text-sm">{total.toLocaleString()} total users</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex-1 max-w-xs">
          <Search className="w-4 h-4 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name or email..." className="bg-transparent text-white text-sm outline-none flex-1 placeholder:text-white/20" />
        </div>
        <select value={role} onChange={e => setRole(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white/60 text-sm outline-none">
          <option value="">All Roles</option>
          <option value="consumer">Consumer</option>
          <option value="agent">Agent</option>
          <option value="staff">Staff</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white/60 text-sm outline-none">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="pending_verification">Pending</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {['User', 'Role', 'KYC', 'Status', 'Joined', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-white/30 text-xs font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/3">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 w-24 rounded shimmer" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.map(user => (
              <motion.tr key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="hover:bg-white/2 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center text-indigo-400 text-xs font-bold flex-shrink-0">
                      {user.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{user.full_name}</p>
                      <p className="text-white/30 text-xs">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-white/60 text-xs capitalize">{user.role}</span>
                </td>
                <td className="px-4 py-3">
                  <KycBadge status={user.kyc_status} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={user.status} />
                </td>
                <td className="px-4 py-3">
                  <span className="text-white/40 text-xs">{formatDate(user.created_at, 'short')}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {user.status === 'active' ? (
                      <button onClick={() => statusMutation.mutate({ id: user.id, status: 'suspended' })}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all">
                        <UserX className="w-4 h-4" />
                      </button>
                    ) : (
                      <button onClick={() => statusMutation.mutate({ id: user.id, status: 'active' })}
                        className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-white/30 hover:text-emerald-400 transition-all">
                        <UserCheck className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
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
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    active: 'badge-active', suspended: 'badge-failed',
    pending_verification: 'badge-pending', closed: 'badge-inactive',
  };
  return <span className={cfg[status] ?? 'badge-inactive'}>{titleCase(status)}</span>;
}

function KycBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    approved: 'badge-active', pending: 'badge-pending',
    rejected: 'badge-failed', not_submitted: 'badge-inactive',
  };
  return <span className={cfg[status] ?? 'badge-inactive'}>{titleCase(status.replace('_', ' '))}</span>;
}
