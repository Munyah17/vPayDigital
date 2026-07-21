import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeySquare, Plus, X, Copy, ShieldOff } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatRelativeTime } from '@vpay/utils';
import toast from 'react-hot-toast';

interface ApiKey {
  id: string; name: string; key_prefix: string; scopes: string[];
  last_used_at: string | null; revoked: boolean; created_at: string;
}

const SCOPES = ['cards:read', 'cards:write', 'wallets:read', 'transactions:read', 'vouchers:write'];

export default function ApiManagementPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', scopes: [] as string[] });
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['admin-api-keys'], queryFn: () => api.get<{ success: boolean; data: ApiKey[] }>('/api/admin/api-keys') });

  const create = useMutation({
    mutationFn: () => api.post('/api/admin/api-keys', form),
    onSuccess: (res) => {
      const fullKey = (res.data as any)?.data?.full_key;
      setRevealedKey(fullKey);
      qc.invalidateQueries({ queryKey: ['admin-api-keys'] });
      setShowForm(false);
      setForm({ name: '', scopes: [] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/api-keys/${id}/revoke`),
    onSuccess: () => { toast.success('Key revoked'); qc.invalidateQueries({ queryKey: ['admin-api-keys'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const toggleScope = (scope: string) => setForm(f => ({ ...f, scopes: f.scopes.includes(scope) ? f.scopes.filter(s => s !== scope) : [...f.scopes, scope] }));

  const keys = data?.data?.data ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
            <KeySquare className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-2xl">API Management</h1>
            <p className="text-foreground/40 text-sm">Issue and revoke API keys for partner integrations</p>
          </div>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-brand flex items-center gap-2 px-4 py-2 text-sm">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'New key'}
        </button>
      </div>

      {revealedKey && (
        <div className="glass-card p-6 space-y-3 border-emerald-500/20">
          <p className="text-emerald-400 font-semibold text-sm">Key created — copy it now, it won't be shown again</p>
          <div className="flex items-center gap-2 bg-foreground/5 rounded-xl p-3">
            <code className="text-foreground font-mono text-xs flex-1 break-all">{revealedKey}</code>
            <button onClick={() => { navigator.clipboard.writeText(revealedKey); toast.success('Copied'); }} className="p-2 rounded-lg hover:bg-foreground/10 flex-shrink-0">
              <Copy className="w-4 h-4 text-foreground/40" />
            </button>
          </div>
          <button onClick={() => setRevealedKey(null)} className="btn-ghost w-full py-2 text-sm">Done</button>
        </div>
      )}

      {showForm && (
        <div className="glass-card p-6 space-y-4">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Key name (e.g. Partner X integration)" className="input-field" />
          <div>
            <p className="text-foreground/60 text-sm mb-2">Scopes</p>
            <div className="flex flex-wrap gap-2">
              {SCOPES.map(s => (
                <button
                  key={s}
                  onClick={() => toggleScope(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${form.scopes.includes(s) ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400' : 'bg-foreground/5 border-foreground/10 text-foreground/40'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => create.mutate()} disabled={create.isPending || !form.name} className="btn-primary w-full py-2.5">
            {create.isPending ? 'Generating…' : 'Generate key'}
          </button>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-6"><div className="w-32 h-4 rounded shimmer" /></div>
        ) : keys.length === 0 ? (
          <p className="text-foreground/20 text-sm p-8 text-center">No API keys issued yet</p>
        ) : (
          <ul className="divide-y divide-foreground/5">
            {keys.map(k => (
              <li key={k.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-foreground text-sm font-medium">{k.name}</p>
                  <p className="text-foreground/40 text-xs font-mono mt-0.5">
                    {k.key_prefix}… {k.scopes.length > 0 && `· ${k.scopes.join(', ')}`}
                  </p>
                  <p className="text-foreground/30 text-xs">
                    {k.last_used_at ? `Last used ${formatRelativeTime(new Date(k.last_used_at))}` : 'Never used'} · Created {formatRelativeTime(new Date(k.created_at))}
                  </p>
                </div>
                {k.revoked ? (
                  <span className="text-red-400 text-xs font-medium">Revoked</span>
                ) : (
                  <button onClick={() => revoke.mutate(k.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-foreground/30 hover:text-red-400 flex-shrink-0" title="Revoke">
                    <ShieldOff className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
