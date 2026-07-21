import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ToggleLeft, Zap, Gift, Tv, CreditCard, Ticket, Landmark } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import toast from 'react-hot-toast';

interface ModuleDef { key: string; label: string; description: string; icon: typeof Zap }

const MODULES: ModuleDef[] = [
  { key: 'virtual_cards', label: 'Virtual Cards', description: 'Card issuance across the platform', icon: CreditCard },
  { key: 'vouchers', label: 'Vouchers & Gift Cards', description: 'Voucher issuance and redemption', icon: Gift },
  { key: 'airtime_data', label: 'Airtime & Data', description: 'Mobile airtime top-up', icon: Zap },
  { key: 'bill_payments', label: 'Bills & Electricity', description: 'ZESA tokens, DStv, ZOL, TelOne, municipal bills', icon: Tv },
  { key: 'banking_iban', label: 'Banking Services', description: 'IBAN/receiving account requests', icon: Landmark },
  { key: 'payouts', label: 'Payouts / Withdrawals', description: 'Cash-out to bank, mobile money, crypto', icon: Ticket },
];

// Reuses the existing generic system_config admin endpoint (key
// "feature_flags") — read publicly via GET /api/feature-flags so the
// consumer app can gate features without a deploy.
export default function ModulesPage() {
  const qc = useQueryClient();
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['admin-config', 'feature_flags'],
    queryFn: () => api.get<{ success: boolean; data: Array<{ key: string; value: Record<string, boolean> }> }>('/api/admin/config'),
  });

  useEffect(() => {
    const existing = data?.data?.data?.find(c => c.key === 'feature_flags')?.value;
    if (existing) setFlags(existing);
  }, [data]);

  const save = useMutation({
    mutationFn: (value: Record<string, boolean>) => api.patch('/api/admin/config/feature_flags', { value }),
    onSuccess: () => {
      toast.success('Module setting updated — live immediately');
      qc.invalidateQueries({ queryKey: ['admin-config'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed to save'),
  });

  const toggle = (key: string) => {
    const next = { ...flags, [key]: flags[key] === false ? true : false };
    setFlags(next);
    save.mutate(next);
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
          <ToggleLeft className="w-5 h-5 text-foreground" />
        </div>
        <div>
          <h1 className="font-display font-bold text-foreground text-2xl">Modules</h1>
          <p className="text-foreground/40 text-sm">Turn platform features on/off without a deploy</p>
        </div>
      </div>

      {!isLoading && (
        <div className="glass-card divide-y divide-foreground/5">
          {MODULES.map(m => {
            const enabled = flags[m.key] !== false;
            return (
              <div key={m.key} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${enabled ? 'bg-indigo-500/10 text-indigo-400' : 'bg-foreground/5 text-foreground/30'}`}>
                    <m.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-foreground text-sm font-medium">{m.label}</p>
                    <p className="text-foreground/30 text-xs">{m.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggle(m.key)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${enabled ? 'bg-indigo-600' : 'bg-foreground/10'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
