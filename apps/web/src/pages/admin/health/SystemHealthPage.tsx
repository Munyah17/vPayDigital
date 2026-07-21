import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, HelpCircle, RefreshCw } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatRelativeTime } from '@vpay/utils';

interface HealthCheck { name: string; status: 'operational' | 'degraded' | 'down' | 'unknown'; detail: string }

const STATUS_STYLES: Record<HealthCheck['status'], { icon: typeof CheckCircle2; color: string; label: string }> = {
  operational: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Operational' },
  degraded: { icon: XCircle, color: 'text-amber-400', label: 'Degraded' },
  down: { icon: XCircle, color: 'text-red-400', label: 'Down' },
  unknown: { icon: HelpCircle, color: 'text-foreground/30', label: 'Unknown' },
};

export default function SystemHealthPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-system-health-full'],
    queryFn: () => api.get<{ success: boolean; data: { checks: HealthCheck[]; checked_at: string } }>('/api/admin/system-health'),
    refetchInterval: 30_000,
  });

  const checks = data?.data?.data?.checks ?? [];
  const checkedAt = data?.data?.data?.checked_at;
  const allOperational = checks.length > 0 && checks.every(c => c.status === 'operational');

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-foreground text-2xl">System Health</h1>
          <p className="text-foreground/40 text-sm">
            Live checks against the database, VitalPay, and the webhook engine — not a static status page.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {!isLoading && (
        <div className={`glass-card p-5 flex items-center gap-3 ${allOperational ? 'border-emerald-500/20' : 'border-amber-500/20'}`}>
          {allOperational ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <XCircle className="w-5 h-5 text-amber-400" />
          )}
          <div>
            <p className="text-foreground font-semibold text-sm">
              {allOperational ? 'All systems operational' : 'One or more checks need attention'}
            </p>
            {checkedAt && (
              <p className="text-foreground/30 text-xs">Last checked {formatRelativeTime(new Date(checkedAt))}</p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="glass-card p-5">
            <div className="w-32 h-4 rounded shimmer" />
          </div>
        ) : checks.map(check => {
          const style = STATUS_STYLES[check.status];
          return (
            <div key={check.name} className="glass-card p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <style.icon className={`w-5 h-5 flex-shrink-0 ${style.color}`} />
                <div>
                  <p className="text-foreground font-medium text-sm">{check.name}</p>
                  <p className="text-foreground/40 text-xs">{check.detail}</p>
                </div>
              </div>
              <span className={`text-xs font-medium ${style.color}`}>{style.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
