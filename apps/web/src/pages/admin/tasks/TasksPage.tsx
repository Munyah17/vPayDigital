import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListChecks, Plus, X, Trash2 } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatRelativeTime } from '@vpay/utils';
import toast from 'react-hot-toast';

interface Task {
  id: string; title: string; description: string | null; status: string; priority: string;
  due_date: string | null; created_at: string;
  assignee: { email: string; full_name: string } | null;
}

const COLUMNS = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
] as const;

const PRIORITY_COLOR: Record<string, string> = {
  low: 'bg-foreground/5 text-foreground/40', medium: 'bg-indigo-500/10 text-indigo-400',
  high: 'bg-amber-500/10 text-amber-400', urgent: 'bg-red-500/10 text-red-400',
};

export default function TasksPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', due_date: '' });

  const { data, isLoading } = useQuery({ queryKey: ['admin-tasks'], queryFn: () => api.get<{ success: boolean; data: Task[] }>('/api/admin/tasks') });

  const create = useMutation({
    mutationFn: () => api.post('/api/admin/tasks', { ...form, due_date: form.due_date || undefined }),
    onSuccess: () => { toast.success('Task created'); qc.invalidateQueries({ queryKey: ['admin-tasks'] }); setShowForm(false); setForm({ title: '', description: '', priority: 'medium', due_date: '' }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/api/admin/tasks/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tasks'] }),
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/tasks/${id}`),
    onSuccess: () => { toast.success('Task deleted'); qc.invalidateQueries({ queryKey: ['admin-tasks'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const tasks = data?.data?.data ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
            <ListChecks className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-2xl">Task Manager</h1>
            <p className="text-foreground/40 text-sm">Internal ops tasks, separate from support tickets</p>
          </div>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-brand flex items-center gap-2 px-4 py-2 text-sm">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'New task'}
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-6 space-y-4">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" className="input-field" />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" rows={2} className="input-field resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="input-field">
              {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
            </select>
            <input value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} type="date" className="input-field" />
          </div>
          <button onClick={() => create.mutate()} disabled={create.isPending || !form.title} className="btn-primary w-full py-2.5">
            {create.isPending ? 'Creating…' : 'Create task'}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="glass-card p-6"><div className="w-32 h-4 rounded shimmer" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map(col => (
            <div key={col.key} className="space-y-3">
              <p className="text-foreground/40 text-xs uppercase tracking-wider font-medium">{col.label} ({tasks.filter(t => t.status === col.key).length})</p>
              <div className="space-y-2">
                {tasks.filter(t => t.status === col.key).map(t => (
                  <div key={t.id} className="glass-card p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-foreground text-sm font-medium">{t.title}</p>
                      <button onClick={() => remove.mutate(t.id)} className="p-1 rounded hover:bg-red-500/10 text-foreground/20 hover:text-red-400 flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {t.description && <p className="text-foreground/40 text-xs">{t.description}</p>}
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${PRIORITY_COLOR[t.priority]}`}>{t.priority}</span>
                      <span className="text-foreground/20 text-[10px]">{formatRelativeTime(new Date(t.created_at))}</span>
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      {COLUMNS.filter(c => c.key !== col.key).map(c => (
                        <button key={c.key} onClick={() => move.mutate({ id: t.id, status: c.key })} className="btn-ghost px-2 py-1 text-[10px] flex-1">
                          → {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {tasks.filter(t => t.status === col.key).length === 0 && (
                  <p className="text-foreground/15 text-xs text-center py-6">Empty</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
