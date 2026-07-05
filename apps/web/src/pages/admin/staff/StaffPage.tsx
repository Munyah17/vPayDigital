import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { UserPlus, Trash2, Shield, ShieldAlert, Eye, EyeOff, Loader2 } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatDate } from '@vpay/utils';
import toast from 'react-hot-toast';

interface StaffMember {
  id: string; email: string; full_name: string;
  role: string; status: string; created_at: string; last_login_at?: string;
}

export default function StaffPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-staff'],
    queryFn: () => api.get('/api/admin/staff'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/staff/${id}`),
    onSuccess: () => { toast.success('Staff member removed'); qc.invalidateQueries({ queryKey: ['admin-staff'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to remove'),
  });

  const staff: StaffMember[] = data?.data?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Staff Management</h1>
          <p className="text-foreground/30 text-sm mt-0.5">Create and manage admin staff accounts</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm">
          <UserPlus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      {/* Info banner */}
      <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
        <p className="text-indigo-300 text-sm">
          <strong>Role hierarchy:</strong> Super Admin → Staff → Agent → Consumer.
          Staff can manage users, review KYC, handle support, and issue operations.
          Only Super Admin can create/delete staff and change roles.
        </p>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-foreground/5">
              {['Member', 'Role', 'Status', 'Created', 'Last Login', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-foreground/30 text-xs font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 w-24 rounded shimmer" /></td>
                ))}</tr>
              ))
            ) : staff.map(s => (
              <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="hover:bg-foreground/2 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.role === 'super_admin' ? 'bg-purple-500/20' : 'bg-indigo-500/20'}`}>
                      {s.role === 'super_admin'
                        ? <ShieldAlert className="w-4 h-4 text-purple-400" />
                        : <Shield className="w-4 h-4 text-indigo-400" />}
                    </div>
                    <div>
                      <p className="text-foreground text-sm font-medium">{s.full_name}</p>
                      <p className="text-foreground/30 text-xs">{s.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg ${s.role === 'super_admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                    {s.role === 'super_admin' ? 'Super Admin' : 'Staff'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge-${s.status === 'active' ? 'active' : 'inactive'}`}>{s.status}</span>
                </td>
                <td className="px-4 py-3"><span className="text-foreground/40 text-xs">{formatDate(s.created_at, 'short')}</span></td>
                <td className="px-4 py-3"><span className="text-foreground/40 text-xs">{s.last_login_at ? formatDate(s.last_login_at, 'relative') : 'Never'}</span></td>
                <td className="px-4 py-3">
                  {s.role !== 'super_admin' && (
                    <button onClick={() => { if (confirm(`Remove ${s.full_name}?`)) deleteMutation.mutate(s.id); }}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-foreground/30 hover:text-red-400 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {showCreate && <CreateStaffDialog onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['admin-staff'] }); }} />}
    </div>
  );
}

function CreateStaffDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'staff' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/admin/staff', form);
      toast.success(`Staff member ${form.full_name} created`);
      onSuccess();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Failed to create staff');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="panel p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="font-display font-bold text-foreground text-lg mb-5">Add Staff Member</h3>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-foreground/50 text-sm mb-1.5">Full Name</label>
            <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              required className="input w-full" placeholder="Jane Doe" />
          </div>
          <div>
            <label className="block text-foreground/50 text-sm mb-1.5">Email</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              type="email" required className="input w-full" placeholder="jane@epaysmart.live" />
          </div>
          <div>
            <label className="block text-foreground/50 text-sm mb-1.5">Temporary Password</label>
            <div className="relative">
              <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                type={showPwd ? 'text' : 'password'} required minLength={8} className="input w-full pr-10"
                placeholder="Min 8 characters" />
              <button type="button" onClick={() => setShowPwd(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground/60">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-foreground/10 text-foreground/50 hover:bg-foreground/5 text-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Staff'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
