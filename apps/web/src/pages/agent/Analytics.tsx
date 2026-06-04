import { BarChart3, TrendingUp, Ticket, CreditCard, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/axios';
import { formatCurrency } from '@vpay/utils';

interface AgentMetrics {
  total_vouchers_issued: number;
  vouchers_redeemed: number;
  total_cards_issued: number;
  total_commissions_earned: number;
  float_balance: number;
  currency: string;
}

export default function Analytics() {
  const { data } = useQuery({
    queryKey: ['agent-metrics'],
    queryFn: () => api.get<{ success: boolean; data: AgentMetrics }>('/api/agent/metrics').catch(() => null),
  });
  const metrics = (data as any)?.data?.data;

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-7 h-7 text-indigo-400" />
        <h1 className="font-display font-bold text-white text-2xl">Analytics</h1>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Ticket} label="Vouchers issued" value={metrics?.total_vouchers_issued ?? 0} />
        <Stat icon={TrendingUp} label="Redeemed" value={metrics?.vouchers_redeemed ?? 0} />
        <Stat icon={CreditCard} label="Cards issued" value={metrics?.total_cards_issued ?? 0} />
        <Stat icon={DollarSign} label="Commissions" value={formatCurrency(metrics?.total_commissions_earned ?? 0, metrics?.currency ?? 'USD')} />
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="metric-card">
      <Icon className="w-4 h-4 text-indigo-400 mb-2" />
      <p className="text-white/30 text-[10px] uppercase tracking-wider">{label}</p>
      <p className="font-display font-bold text-white text-xl">{value}</p>
    </div>
  );
}
