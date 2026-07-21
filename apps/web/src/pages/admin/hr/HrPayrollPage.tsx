import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Plus, X } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatCurrency, formatRelativeTime } from '@vpay/utils';
import toast from 'react-hot-toast';

type Tab = 'staff' | 'payroll';
interface StaffRecord {
  id: string; job_title: string | null; department: string | null; employment_type: string;
  base_salary: number; currency: string; active: boolean;
  profiles: { email: string; full_name: string } | null;
}
interface PayrollRun {
  id: string; reference: string; period_start: string; period_end: string;
  status: string; total_amount: number; currency: string; created_at: string;
}

const STATUS_COLOR: Record<string, string> = { draft: 'text-foreground/40', processed: 'text-indigo-400', paid: 'text-emerald-400' };

export default function HrPayrollPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('staff');
  const [showForm, setShowForm] = useState(false);
  const [staffForm, setStaffForm] = useState({ profile_email: '', job_title: '', department: '', employment_type: 'full_time', base_salary: '', currency: 'USD' });
  const [runForm, setRunForm] = useState({ period_start: '', period_end: '', currency: 'USD' });

  const staff = useQuery({ queryKey: ['hr-staff'], queryFn: () => api.get<{ success: boolean; data: StaffRecord[] }>('/api/admin/hr/staff'), enabled: tab === 'staff' });
  const payroll = useQuery({ queryKey: ['hr-payroll'], queryFn: () => api.get<{ success: boolean; data: PayrollRun[] }>('/api/admin/hr/payroll'), enabled: tab === 'payroll' });

  const addStaff = useMutation({
    mutationFn: () => api.post('/api/admin/hr/staff', { ...staffForm, base_salary: parseFloat(staffForm.base_salary) }),
    onSuccess: () => { toast.success('Staff record added'); qc.invalidateQueries({ queryKey: ['hr-staff'] }); setShowForm(false); setStaffForm({ profile_email: '', job_title: '', department: '', employment_type: 'full_time', base_salary: '', currency: 'USD' }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/api/admin/hr/staff/${id}`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-staff'] }),
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const createRun = useMutation({
    mutationFn: () => api.post('/api/admin/hr/payroll', runForm),
    onSuccess: () => { toast.success('Payroll run created'); qc.invalidateQueries({ queryKey: ['hr-payroll'] }); setShowForm(false); setRunForm({ period_start: '', period_end: '', currency: 'USD' }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const runAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.post(`/api/admin/hr/payroll/${id}/${action}`),
    onSuccess: (res, vars) => {
      if (vars.action === 'pay') {
        const d = (res.data as any)?.data;
        toast.success(`Paid ${d?.paid_count ?? 0} staff${d?.skipped_count ? `, ${d.skipped_count} skipped (no wallet)` : ''}`);
      } else {
        toast.success('Run processed');
      }
      qc.invalidateQueries({ queryKey: ['hr-payroll'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const staffList = staff.data?.data?.data ?? [];
  const runs = payroll.data?.data?.data ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
            <Briefcase className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-2xl">HR & Payroll</h1>
            <p className="text-foreground/40 text-sm">Manages ePay Smart's own staff — not platform users</p>
          </div>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-brand flex items-center gap-2 px-4 py-2 text-sm">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : tab === 'staff' ? 'Add staff' : 'New payroll run'}
        </button>
      </div>

      <div className="flex gap-2 p-1 rounded-xl bg-foreground/5 w-fit">
        <button onClick={() => { setTab('staff'); setShowForm(false); }} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'staff' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/50'}`}>Staff</button>
        <button onClick={() => { setTab('payroll'); setShowForm(false); }} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'payroll' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/50'}`}>Payroll Runs</button>
      </div>

      {showForm && tab === 'staff' && (
        <div className="glass-card p-6 space-y-4">
          <input value={staffForm.profile_email} onChange={e => setStaffForm(f => ({ ...f, profile_email: e.target.value }))} type="email" placeholder="Staff member's account email" className="input-field" />
          <div className="grid grid-cols-2 gap-3">
            <input value={staffForm.job_title} onChange={e => setStaffForm(f => ({ ...f, job_title: e.target.value }))} placeholder="Job title" className="input-field" />
            <input value={staffForm.department} onChange={e => setStaffForm(f => ({ ...f, department: e.target.value }))} placeholder="Department" className="input-field" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <select value={staffForm.employment_type} onChange={e => setStaffForm(f => ({ ...f, employment_type: e.target.value }))} className="input-field">
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
            </select>
            <input value={staffForm.base_salary} onChange={e => setStaffForm(f => ({ ...f, base_salary: e.target.value }))} type="number" step="0.01" min="0" placeholder="Base salary" className="input-field" />
            <select value={staffForm.currency} onChange={e => setStaffForm(f => ({ ...f, currency: e.target.value }))} className="input-field">
              {['USD', 'EUR', 'GBP', 'ZAR'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={() => addStaff.mutate()} disabled={addStaff.isPending || !staffForm.profile_email || !staffForm.base_salary} className="btn-primary w-full py-2.5">
            {addStaff.isPending ? 'Adding…' : 'Add staff record'}
          </button>
        </div>
      )}

      {showForm && tab === 'payroll' && (
        <div className="glass-card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Period start</label>
              <input value={runForm.period_start} onChange={e => setRunForm(f => ({ ...f, period_start: e.target.value }))} type="date" className="input-field" />
            </div>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Period end</label>
              <input value={runForm.period_end} onChange={e => setRunForm(f => ({ ...f, period_end: e.target.value }))} type="date" className="input-field" />
            </div>
          </div>
          <select value={runForm.currency} onChange={e => setRunForm(f => ({ ...f, currency: e.target.value }))} className="input-field">
            {['USD', 'EUR', 'GBP', 'ZAR'].map(c => <option key={c}>{c}</option>)}
          </select>
          <p className="text-foreground/30 text-xs">Generates one line item per active staff member in this currency, using their base salary.</p>
          <button onClick={() => createRun.mutate()} disabled={createRun.isPending || !runForm.period_start || !runForm.period_end} className="btn-primary w-full py-2.5">
            {createRun.isPending ? 'Creating…' : 'Create payroll run'}
          </button>
        </div>
      )}

      {tab === 'staff' ? (
        <div className="glass-card overflow-hidden">
          {staffList.length === 0 ? (
            <p className="text-foreground/20 text-sm p-8 text-center">No staff records yet</p>
          ) : (
            <ul className="divide-y divide-foreground/5">
              {staffList.map(s => (
                <li key={s.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-foreground text-sm font-medium">{s.profiles?.full_name ?? s.profiles?.email}</p>
                    <p className="text-foreground/40 text-xs">{s.job_title ?? 'No title'}{s.department ? ` · ${s.department}` : ''} · {formatCurrency(s.base_salary, s.currency)}/mo</p>
                  </div>
                  <button
                    onClick={() => toggleActive.mutate({ id: s.id, active: !s.active })}
                    className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${s.active ? 'bg-indigo-600' : 'bg-foreground/10'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${s.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {runs.length === 0 ? (
            <div className="glass-card p-8 text-center text-foreground/20 text-sm">No payroll runs yet</div>
          ) : runs.map(r => (
            <div key={r.id} className="glass-card p-5 flex items-center justify-between">
              <div>
                <p className="text-foreground font-semibold text-sm font-mono">{r.reference}</p>
                <p className="text-foreground/30 text-xs">{new Date(r.period_start).toLocaleDateString()} – {new Date(r.period_end).toLocaleDateString()} · {formatRelativeTime(new Date(r.created_at))}</p>
              </div>
              <div className="text-right flex items-center gap-3">
                <div>
                  <p className="text-foreground font-semibold">{formatCurrency(r.total_amount, r.currency)}</p>
                  <p className={`text-xs font-medium capitalize ${STATUS_COLOR[r.status]}`}>{r.status}</p>
                </div>
                {r.status === 'draft' && (
                  <button onClick={() => runAction.mutate({ id: r.id, action: 'process' })} className="btn-ghost px-3 py-1.5 text-xs">Process</button>
                )}
                {r.status === 'processed' && (
                  <button onClick={() => runAction.mutate({ id: r.id, action: 'pay' })} className="btn-brand px-3 py-1.5 text-xs">Pay staff</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
