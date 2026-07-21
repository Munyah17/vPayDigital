import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Eye } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import toast from 'react-hot-toast';

interface Announcement {
  enabled: boolean;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  dismissible: boolean;
}

const DEFAULT: Announcement = { enabled: false, title: '', message: '', type: 'info', dismissible: true };

const TYPE_PREVIEW: Record<Announcement['type'], string> = {
  info: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
};

// One-click site-wide banner, backed by system_config (key "announcement")
// via the existing generic /api/admin/config endpoint — no new admin CRUD
// needed. Read publicly by the consumer/agent apps via
// GET /api/announcements/active.
export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Announcement>(DEFAULT);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-config', 'announcement'],
    queryFn: () => api.get<{ success: boolean; data: Array<{ key: string; value: Announcement }> }>('/api/admin/config'),
  });

  useEffect(() => {
    const existing = data?.data?.data?.find(c => c.key === 'announcement')?.value;
    if (existing) setForm({ ...DEFAULT, ...existing });
  }, [data]);

  const save = useMutation({
    mutationFn: (value: Announcement) => api.patch('/api/admin/config/announcement', { value }),
    onSuccess: () => {
      toast.success('Announcement updated — live immediately on the consumer app');
      qc.invalidateQueries({ queryKey: ['admin-config'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed to save'),
  });

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
          <Megaphone className="w-5 h-5 text-foreground" />
        </div>
        <div>
          <h1 className="font-display font-bold text-foreground text-2xl">Announcements</h1>
          <p className="text-foreground/40 text-sm">One site-wide banner, shown to every signed-in user until you turn it off</p>
        </div>
      </div>

      {!isLoading && (
        <div className="glass-card p-6 space-y-5">
          <label className="flex items-center justify-between">
            <span className="text-foreground font-medium text-sm">Banner enabled</span>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
              className={`w-11 h-6 rounded-full transition-colors relative ${form.enabled ? 'bg-indigo-600' : 'bg-foreground/10'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>

          <div>
            <label className="block text-foreground/60 text-sm mb-1.5">Title</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              maxLength={80}
              placeholder="Scheduled maintenance"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-foreground/60 text-sm mb-1.5">Message</label>
            <textarea
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              maxLength={300}
              rows={3}
              placeholder="We'll be performing maintenance tonight from 11pm-1am. Some features may be briefly unavailable."
              className="input-field resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as Announcement['type'] }))}
                className="input-field"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="success">Success</option>
              </select>
            </div>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Dismissible</label>
              <select
                value={form.dismissible ? 'yes' : 'no'}
                onChange={e => setForm(f => ({ ...f, dismissible: e.target.value === 'yes' }))}
                className="input-field"
              >
                <option value="yes">User can dismiss it</option>
                <option value="no">Always shown</option>
              </select>
            </div>
          </div>

          {form.enabled && form.title && (
            <div>
              <p className="text-foreground/30 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Eye className="w-3 h-3" /> Preview
              </p>
              <div className={`rounded-xl border p-3 ${TYPE_PREVIEW[form.type]}`}>
                <p className="font-semibold text-sm">{form.title}</p>
                {form.message && <p className="text-sm opacity-80 mt-0.5">{form.message}</p>}
              </div>
            </div>
          )}

          <button
            onClick={() => save.mutate(form)}
            disabled={save.isPending || (form.enabled && !form.title)}
            className="btn-primary w-full py-3"
          >
            {save.isPending ? 'Saving…' : 'Save & publish'}
          </button>
        </div>
      )}
    </div>
  );
}
