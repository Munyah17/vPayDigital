import { useQuery } from '@tanstack/react-query';
import { UserCog } from 'lucide-react';
import { api } from '../../lib/axios';
import { formatCurrency } from '@vpay/utils';
import type { AgentMetrics } from '@vpay/types';

export default function Agents() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-agents'],
    queryFn: () => api.get<{ success: boolean; data: AgentMetrics[] }>('/api/admin/agents'),
  });
  const agents: AgentMetrics[] = (data?.data as any)?.data ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <UserCog className="w-7 h-7 text-brand-400" />
        <h1 className="font-display font-bold text-white text-3xl">Agents</h1>
      </header>

      <div className="panel overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-white/30">Loading…</div>
        ) : agents.length === 0 ? (
          <div className="p-12 text-center text-white/30">No agents yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-white/40 text-[10px] uppercase tracking-wider border-b border-white/5">
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Tier</th>
                  <th className="px-4 py-3 font-medium">Float balance</th>
                  <th className="px-4 py-3 font-medium">Vouchers</th>
                  <th className="px-4 py-3 font-medium">Cards</th>
                  <th className="px-4 py-3 font-medium">Commissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {agents.map((a) => (
                  <tr key={a.agent_id} className="table-row">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium text-sm">{a.full_name}</p>
                      {a.business_name && <p className="text-white/40 text-xs">{a.business_name}</p>}
                    </td>
                    <td className="px-4 py-3"><span className="badge-info">T{a.agent_tier}</span></td>
                    <td className="px-4 py-3 text-white tabular-nums">{formatCurrency(a.float_balance ?? 0, a.currency)}</td>
                    <td className="px-4 py-3 text-white/60 text-sm">{a.total_vouchers_issued} <span className="text-white/30">({a.vouchers_redeemed} redeemed)</span></td>
                    <td className="px-4 py-3 text-white/60 text-sm">{a.total_cards_issued}</td>
                    <td className="px-4 py-3 text-emerald-400 tabular-nums">{formatCurrency(a.total_commissions_earned ?? 0, a.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
