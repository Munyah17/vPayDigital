import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, UserCheck, UserX, ChevronDown, Key, MoreHorizontal } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatDate, titleCase } from '@vpay/utils';
import { useAdminStore } from '../../../stores/adminStore';
import type { Profile } from '@vpay/types';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const qc = useQueryClient();
  const { profile: myProfile } = useAdminStore();
  const isSuperAdmin = myProfile?.role === 'super_admin';
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, role, status],
    queryFn: () => api.get('/api/admin/users', { params: { page, limit: 20, role: role || undefined, status: status || undefined } }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/admin/users/${id}/status`, { status }),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['admin-users'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed'),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.patch(`/api/admin/users/${id}/role`, { role }),
    onSuccess: () => { toast.success('Role updated'); qc.invalidateQueries({ queryKey: ['admin-users'] }); setActionMenu(null); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed'),
  });

  const users: Profile[] = data?.data?.data ?? [];
  const total: number = data?.data?.meta?.total ?? 0;

  const filtered = search
    ? users.filter(u =>
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.includes(search)
      )
    : users;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Users</h1>
          <p className="text-foreground/30 text-sm">{total.toLocaleString()} total users</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2 bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 flex-1 max-w-xs">
          <Search className="w-4 h-4 text-foreground/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name or email..."
            className="bg-transparent text-foreground text-sm outline-none flex-1 placeholder:text-foreground/20" />
        </div>
        <select value={role} onChange={e => { setRole(e.target.value); setPage(1); }}
          className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground/60 text-sm outline-none">
          <option value="">All Roles</option>
          <option value="consumer">Consumer</option>
          <option value="agent">Agent</option>
          <option value="staff">Staff</option>
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground/60 text-sm outline-none">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="pending_verification">Pending</option>
        </select>
      </div>

      <div className="panel overflow-hidden" onClick={() => setActionMenu(null)}>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-foreground/5">
              {['User', 'Role', 'KYC', 'Status', 'Joined', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-foreground/30 text-xs font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/3">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 w-24 rounded shimmer" /></td>
                ))}</tr>
              ))
            ) : filtered.map(user => (
              <motion.tr key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="hover:bg-foreground/2 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center text-indigo-400 text-xs font-bold flex-shrink-0">
                      {user.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                      <p className="text-foreground text-sm font-medium">{user.full_name}</p>
                      <p className="text-foreground/30 text-xs">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-foreground/60 text-xs capitalize">{user.role}</span>
                </td>
                <td className="px-4 py-3"><KycBadge status={user.kyc_status} /></td>
                <td className="px-4 py-3"><StatusBadge status={user.status} /></td>
                <td className="px-4 py-3">
                  <span className="text-foreground/40 text-xs">{formatDate(user.created_at, 'short')}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    {/* Suspend / Activate */}
                    {user.role !== 'super_admin' && (
                      user.status === 'active' ? (
                        <button onClick={() => statusMutation.mutate({ id: user.id, status: 'suspended' })}
                          title="Suspend" className="p-1.5 rounded-lg hover:bg-red-500/10 text-foreground/30 hover:text-red-400 transition-all">
                          <UserX className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={() => statusMutation.mutate({ id: user.id, status: 'active' })}
                          title="Activate" className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-foreground/30 hover:text-emerald-400 transition-all">
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )
                    )}

                    {/* Super admin extras */}
                    {isSuperAdmin && user.role !== 'super_admin' && (
                      <div className="relative">
                        <button onClick={() => setActionMenu(actionMenu === user.id ? null : user.id)}
                          className="p-1.5 rounded-lg hover:bg-foreground/10 text-foreground/30 hover:text-foreground transition-all">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {actionMenu === user.id && (
                          <div className="absolute right-0 top-8 z-50 w-44 bg-card border border-foreground/10 rounded-xl shadow-2xl py-1 overflow-hidden">
                            <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-foreground/20">Change Role</p>
                            {['consumer', 'agent', 'staff'].filter(r => r !== user.role).map(r => (
                              <button key={r} onClick={() => roleMutation.mutate({ id: user.id, role: r })}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors capitalize">
                                <ChevronDown className="w-3 h-3 rotate-[-90deg]" /> Set as {titleCase(r)}
                              </button>
                            ))}
                            <div className="h-px bg-foreground/5 my-1" />
                            <button onClick={() => { setResetTarget(user); setActionMenu(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-400/70 hover:text-amber-400 hover:bg-amber-500/5 transition-colors">
                              <Key className="w-3 h-3" /> Reset Password
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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
            <button onClick={() => setPage(p => p + 1)} disabled={filtered.length < 20}
              className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/40 text-xs disabled:opacity-30 hover:bg-foreground/10">Next</button>
          </div>
        </div>
      </div>

      {resetTarget && (
        <PasswordResetDialog user={resetTarget} onClose={() => setResetTarget(null)} />
      )}
    </div>
  );
}

function PasswordResetDialog({ user, onClose }: { user: Profile; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('Minimum 8 characters'); return; }
    setLoading(true);
    try {
      await api.post(`/api/admin/users/${user.id}/reset-password`, { new_password: password });
      toast.success(`Password reset for ${user.full_name}`);
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="panel p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="font-display font-bold text-foreground text-lg mb-1">Reset Password</h3>
        <p className="text-foreground/40 text-sm mb-5">{user.full_name} · {user.email}</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-foreground/50 text-sm mb-1.5">New Password</label>
            <input value={password} onChange={e => setPassword(e.target.value)}
              type="password" required minLength={8} className="input w-full" placeholder="Min 8 characters" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-foreground/10 text-foreground/50 text-sm hover:bg-foreground/5">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 py-2.5 text-sm">
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    active: 'badge-active', suspended: 'badge-failed',
    pending_verification: 'badge-pending', closed: 'badge-inactive',
  };
  return <span className={cfg[status] ?? 'badge-inactive'}>{titleCase(status.replace('_', ' '))}</span>;
}

function KycBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    approved: 'badge-active', pending: 'badge-pending',
    rejected: 'badge-failed', not_submitted: 'badge-inactive',
  };
  return <span className={cfg[status] ?? 'badge-inactive'}>{titleCase(status.replace('_', ' '))}</span>;
}
