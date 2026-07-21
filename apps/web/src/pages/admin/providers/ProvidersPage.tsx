import { useQuery } from '@tanstack/react-query';
import { Plug, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatRelativeTime } from '@vpay/utils';

interface ProviderLog {
  operation: string;
  success: boolean;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}

interface ProviderInfo {
  name: string;
  base_url: string;
  reachable: boolean;
  latency_ms: number | null;
  recent_operations: ProviderLog[];
  recent_success_count: number;
  recent_failure_count: number;
}

export default function ProvidersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-providers'],
    queryFn: () => api.get<{ success: boolean; data: { providers: ProviderInfo[] } }>('/api/admin/providers'),
    refetchInterval: 60_000,
  });

  const providers = data?.data?.data?.providers ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
          <Plug className="w-5 h-5 text-foreground" />
        </div>
        <div>
          <h1 className="font-display font-bold text-foreground text-2xl">Providers</h1>
          <p className="text-foreground/40 text-sm">Live connection status and recent operations</p>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-card p-6"><div className="w-40 h-4 rounded shimmer" /></div>
      ) : providers.map(p => (
        <div key={p.name} className="space-y-4">
          <div className="glass-card p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {p.reachable ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400" />
              )}
              <div>
                <p className="text-foreground font-semibold capitalize">{p.name}</p>
                <p className="text-foreground/40 text-xs">{p.base_url}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-medium ${p.reachable ? 'text-emerald-400' : 'text-red-400'}`}>
                {p.reachable ? 'Reachable' : 'Unreachable'}
              </p>
              {p.latency_ms !== null && <p className="text-foreground/30 text-xs">{p.latency_ms}ms</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-4">
              <p className="text-foreground/30 text-xs uppercase tracking-wider">Recent successes</p>
              <p className="font-display font-bold text-emerald-400 text-xl mt-1">{p.recent_success_count}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-foreground/30 text-xs uppercase tracking-wider">Recent failures</p>
              <p className="font-display font-bold text-red-400 text-xl mt-1">{p.recent_failure_count}</p>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <p className="text-foreground font-semibold text-sm p-4 border-b border-foreground/5">Recent operations</p>
            {p.recent_operations.length === 0 ? (
              <p className="text-foreground/20 text-sm p-6 text-center">No operations logged yet</p>
            ) : (
              <ul className="divide-y divide-foreground/5">
                {p.recent_operations.map((op, i) => (
                  <li key={i} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2.5">
                      {op.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                      <span className="text-foreground/70 text-sm">{op.operation}</span>
                      {op.error_message && <span className="text-red-400/70 text-xs truncate max-w-xs">{op.error_message}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-foreground/30 text-xs">
                      {op.duration_ms !== null && <span>{op.duration_ms}ms</span>}
                      <span>{formatRelativeTime(new Date(op.created_at))}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
