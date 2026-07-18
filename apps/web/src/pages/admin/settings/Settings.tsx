import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon, Save, RefreshCw } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import toast from 'react-hot-toast';
import { FEE_CONFIG, CURRENCIES } from '@vpay/config';

type ConfigEntry = { id: string; key: string; value: unknown; description?: string; updated_at: string };

const DEFAULT_FEATURES = {
  crypto_payments: false,
  amex_cards: true,
  unionpay_cards: false,
  gift_cards: true,
  vouchers: true,
  referral_bonuses: false,
  two_factor_required: false,
};

const DEFAULT_MAINTENANCE = { enabled: false, message: '' };

const DEFAULT_FEES = {
  ...FEE_CONFIG,
  voucherIssuancePercent: 0.015,
};

const FEE_FIELDS: Array<{ key: keyof typeof DEFAULT_FEES; label: string; isPercent: boolean; hint: string }> = [
  { key: 'cardIssuanceFlat', label: 'Card issuance — flat fee', isPercent: false, hint: 'Currently unused by card issuance (cards are funded at face value with no markup)' },
  { key: 'cardIssuancePercent', label: 'Card issuance — percent fee', isPercent: true, hint: 'Currently unused by card issuance' },
  { key: 'payoutFlat', label: 'Payout — flat fee', isPercent: false, hint: 'Added to every non-internal payout' },
  { key: 'payoutPercent', label: 'Payout — percent fee', isPercent: true, hint: 'Added to every non-internal payout' },
  { key: 'voucherIssuancePercent', label: 'Voucher issuance — percent fee', isPercent: true, hint: 'Charged to agents issuing vouchers (admins issue fee-free from the platform pool)' },
  { key: 'fxSpread', label: 'FX spread', isPercent: true, hint: 'Not yet wired into any live currency conversion' },
];

export default function Settings() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-config'],
    queryFn: () => api.get('/api/admin/config'),
  });

  const configMap: Record<string, unknown> = {};
  ((data?.data?.data ?? []) as ConfigEntry[]).forEach(e => { configMap[e.key] = e.value; });

  const features = (configMap['feature_flags'] as typeof DEFAULT_FEATURES) ?? DEFAULT_FEATURES;
  const maintenance = (configMap['maintenance'] as typeof DEFAULT_MAINTENANCE) ?? DEFAULT_MAINTENANCE;
  const fees = { ...DEFAULT_FEES, ...(configMap['fee_config'] as Partial<typeof DEFAULT_FEES> ?? {}) };

  const saveMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      api.patch(`/api/admin/config/${key}`, { value }),
    onSuccess: (_, vars) => {
      toast.success(`${vars.key} saved`);
      qc.invalidateQueries({ queryKey: ['admin-config'] });
    },
    onError: () => toast.error('Failed to save config'),
  });

  const [localFeatures, setLocalFeatures] = useState<typeof DEFAULT_FEATURES | null>(null);
  const [localMaintenance, setLocalMaintenance] = useState<typeof DEFAULT_MAINTENANCE | null>(null);
  const [localFees, setLocalFees] = useState<typeof DEFAULT_FEES | null>(null);

  const activeFeatures = localFeatures ?? features;
  const activeMaintenance = localMaintenance ?? maintenance;
  const activeFees = localFees ?? fees;

  const toggleFeature = (key: keyof typeof DEFAULT_FEATURES) => {
    setLocalFeatures(f => ({ ...(f ?? features), [key]: !(f ?? features)[key] }));
  };

  const saveFeatures = () => saveMutation.mutate({ key: 'feature_flags', value: activeFeatures });
  const saveMaintenance = () => saveMutation.mutate({ key: 'maintenance', value: activeMaintenance });
  const saveFees = () => saveMutation.mutate({ key: 'fee_config', value: activeFees });

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-7 h-7 text-brand-400" />
          <h1 className="font-display font-bold text-foreground text-2xl">Settings</h1>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card p-6"><div className="h-6 w-40 rounded shimmer mb-4" />
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-10 rounded shimmer" />
            ))}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <SettingsIcon className="w-7 h-7 text-brand-400" />
        <h1 className="font-display font-bold text-foreground text-2xl">Settings</h1>
      </header>

      {/* Maintenance mode */}
      <Section title="Maintenance Mode" description="Put the platform in maintenance mode to block user activity">
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-foreground text-sm font-medium">Maintenance Mode</p>
            <p className="text-foreground/30 text-xs mt-0.5">Users will see the maintenance message</p>
          </div>
          <Toggle enabled={activeMaintenance.enabled}
            onChange={v => setLocalMaintenance(m => ({ ...(m ?? maintenance), enabled: v }))} />
        </div>
        {activeMaintenance.enabled && (
          <div>
            <label className="text-foreground/50 text-xs mb-1.5 block">Maintenance Message</label>
            <input value={activeMaintenance.message}
              onChange={e => setLocalMaintenance(m => ({ ...(m ?? maintenance), message: e.target.value }))}
              className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-indigo-500/50"
              placeholder="We'll be back shortly..." />
          </div>
        )}
        <SaveButton onClick={saveMaintenance} loading={saveMutation.isPending} />
      </Section>

      {/* Feature flags */}
      <Section title="Feature Flags" description="Enable or disable platform features">
        {(Object.entries(activeFeatures) as [keyof typeof DEFAULT_FEATURES, boolean][]).map(([key, enabled]) => (
          <div key={key} className="flex items-center justify-between py-2.5 border-b border-foreground/[0.04] last:border-0">
            <div>
              <p className="text-foreground text-sm capitalize">{key.replace(/_/g, ' ')}</p>
            </div>
            <Toggle enabled={enabled} onChange={() => toggleFeature(key)} />
          </div>
        ))}
        <SaveButton onClick={saveFeatures} loading={saveMutation.isPending} />
      </Section>

      {/* Fee configuration — editable, backed by system_config.fee_config.
          Falls back to @vpay/config defaults until first saved here. */}
      <Section title="Fee Configuration" description="Tune platform markup — takes effect on the next transaction, no deploy needed">
        <div className="space-y-3">
          {FEE_FIELDS.map(field => (
            <div key={field.key} className="flex items-center justify-between gap-4 py-1">
              <div className="min-w-0">
                <p className="text-foreground text-sm">{field.label}</p>
                <p className="text-foreground/30 text-xs mt-0.5">{field.hint}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!field.isPercent && <span className="text-foreground/40 text-sm">$</span>}
                <input
                  type="number"
                  step={field.isPercent ? '0.001' : '0.01'}
                  min="0"
                  value={field.isPercent ? +(activeFees[field.key] * 100).toFixed(3) : activeFees[field.key]}
                  onChange={e => {
                    const raw = parseFloat(e.target.value);
                    const value = isNaN(raw) ? 0 : (field.isPercent ? raw / 100 : raw);
                    setLocalFees(f => ({ ...(f ?? fees), [field.key]: value }));
                  }}
                  className="w-24 bg-foreground/5 border border-foreground/10 rounded-lg px-2 py-1.5 text-foreground text-sm text-right outline-none focus:border-indigo-500/50"
                />
                {field.isPercent && <span className="text-foreground/40 text-sm">%</span>}
              </div>
            </div>
          ))}
        </div>
        <SaveButton onClick={saveFees} loading={saveMutation.isPending} />
      </Section>

      {/* Currencies */}
      <Section title="Supported Currencies" description="Currencies available across the platform">
        <div className="flex flex-wrap gap-2">
          {CURRENCIES.map(c => (
            <span key={c.code} className="px-3 py-1 rounded-xl bg-foreground/5 border border-foreground/10 text-foreground/60 text-xs font-mono">{c.code}</span>
          ))}
        </div>
      </Section>

      {/* Raw config entries */}
      {(data?.data?.data ?? []).length > 0 && (
        <Section title="All Config Keys" description="Raw system configuration from database">
          <div className="space-y-2">
            {((data?.data?.data ?? []) as ConfigEntry[]).map(entry => (
              <div key={entry.id} className="flex items-start justify-between gap-4 py-2 border-b border-foreground/[0.04] last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-xs font-mono">{entry.key}</p>
                  {entry.description && <p className="text-foreground/30 text-xs mt-0.5">{entry.description}</p>}
                </div>
                <p className="text-foreground/30 text-xs flex-shrink-0">{new Date(entry.updated_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-6 space-y-4">
      <div>
        <h2 className="text-foreground font-semibold text-sm">{title}</h2>
        {description && <p className="text-foreground/30 text-xs mt-0.5">{description}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!enabled)}
      className={`relative w-10 h-5 rounded-full transition-all ${enabled ? 'bg-indigo-600' : 'bg-foreground/10'}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-foreground transition-transform ${enabled ? 'translate-x-5' : ''}`} />
    </button>
  );
}

function SaveButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-all disabled:opacity-40 mt-2">
      {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
      Save
    </button>
  );
}
