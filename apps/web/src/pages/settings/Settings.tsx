import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Bell, Globe, Key, LogOut, ChevronRight, Copy, Check } from 'lucide-react';
import { api } from '../../lib/axios';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${enabled ? 'bg-indigo-600' : 'bg-foreground/15'}`}
      aria-pressed={enabled}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-foreground shadow transition-all duration-200 ${enabled ? 'right-0.5' : 'left-0.5'}`} />
    </button>
  );
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'ZAR', 'NGN', 'GHS', 'KES', 'ZWL'];

type NotifKey = 'transactions' | 'security' | 'promotional';

export default function Settings() {
  const { profile, signOut, refreshProfile } = useAuthStore();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [currency, setCurrency] = useState(profile?.preferred_currency ?? 'USD');
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [notifs, setNotifs] = useState<Record<NotifKey, boolean>>({
    transactions: true,
    security: true,
    promotional: false,
  });

  const toggleNotif = (key: NotifKey) => setNotifs(n => ({ ...n, [key]: !n[key] }));

  const copyReferral = () => {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(profile.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Referral code copied');
    }
  };

  const saveCurrency = async () => {
    setSavingCurrency(true);
    try {
      await api.patch('/api/profile', { preferred_currency: currency });
      await refreshProfile();
      toast.success('Preferred currency updated');
    } catch {
      toast.error('Failed to update currency');
    } finally {
      setSavingCurrency(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="font-display font-bold text-foreground text-2xl">Settings</h1>

      {/* Account info */}
      <Section>
        <div className="space-y-1 mb-4">
          <p className="text-foreground font-medium text-sm">Account</p>
          <p className="text-foreground/40 text-xs">Manage your account details</p>
        </div>
        <InfoRow label="Email" value={profile?.email ?? '—'} />
        <InfoRow label="Account type" value={profile?.role ?? '—'} />
        <InfoRow label="KYC status" value={profile?.kyc_status?.replace('_', ' ') ?? '—'}
          badge={profile?.kyc_status === 'approved' ? 'badge-active' : profile?.kyc_status === 'pending' ? 'badge-pending' : 'badge-inactive'} />
      </Section>

      {/* Preferred currency */}
      <Section>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-indigo-400" />
          <p className="text-foreground font-medium text-sm">Preferred Currency</p>
        </div>
        <div className="flex gap-2">
          <select value={currency} onChange={e => setCurrency(e.target.value as typeof currency)} className="input-field flex-1 py-2">
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={saveCurrency} disabled={savingCurrency || currency === profile?.preferred_currency}
            className="btn-brand px-4 py-2 text-sm disabled:opacity-40">
            {savingCurrency ? 'Saving...' : 'Save'}
          </button>
        </div>
      </Section>

      {/* Security */}
      <Section>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-indigo-400" />
          <p className="text-foreground font-medium text-sm">Security</p>
        </div>
        <button onClick={() => navigate('/profile/kyc')}
          className="w-full flex items-center justify-between py-3 border-b border-foreground/5 hover:text-foreground/80 transition-colors">
          <div className="text-left">
            <p className="text-foreground/80 text-sm">Identity Verification (KYC)</p>
            <p className="text-foreground/30 text-xs capitalize">{profile?.kyc_status?.replace('_', ' ') ?? 'Not submitted'}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-foreground/30" />
        </button>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-foreground/80 text-sm">Two-Factor Authentication</p>
            <p className="text-foreground/30 text-xs">{profile?.two_factor_enabled ? 'Enabled' : 'Disabled'}</p>
          </div>
          <span className={profile?.two_factor_enabled ? 'badge-active' : 'badge-inactive'}>
            {profile?.two_factor_enabled ? 'On' : 'Off'}
          </span>
        </div>
      </Section>

      {/* Referral */}
      <Section>
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-indigo-400" />
          <p className="text-foreground font-medium text-sm">Referral Code</p>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-foreground/5 border border-foreground/10">
          <code className="text-foreground font-mono text-lg flex-1 tracking-widest">{profile?.referral_code ?? '—'}</code>
          <button onClick={copyReferral} className="p-2 rounded-lg hover:bg-foreground/10 text-foreground/40 hover:text-foreground transition-all">
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-foreground/30 text-xs mt-2">Share your code to earn referral bonuses when friends sign up.</p>
      </Section>

      {/* Notifications placeholder */}
      <Section>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-indigo-400" />
          <p className="text-foreground font-medium text-sm">Notifications</p>
        </div>
        <div className="space-y-3">
          {([
            { key: 'transactions' as NotifKey, label: 'Transaction alerts', sub: 'Receive alerts for card and wallet activity' },
            { key: 'security' as NotifKey, label: 'Security alerts', sub: 'Login, password changes, 2FA events' },
            { key: 'promotional' as NotifKey, label: 'Promotional', sub: 'New features and offers' },
          ]).map(n => (
            <div key={n.key} className="flex items-center justify-between">
              <div>
                <p className="text-foreground/80 text-sm">{n.label}</p>
                <p className="text-foreground/30 text-xs">{n.sub}</p>
              </div>
              <Toggle enabled={notifs[n.key]} onToggle={() => toggleNotif(n.key)} />
            </div>
          ))}
        </div>
      </Section>

      <button onClick={handleSignOut}
        className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-400 font-medium flex items-center justify-center gap-2 transition-all">
        <LogOut className="w-4 h-4" /> Sign out
      </button>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="glass-card p-5 space-y-0 rounded-2xl">{children}</div>;
}

function InfoRow({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-foreground/[0.04] last:border-0">
      <p className="text-foreground/50 text-sm">{label}</p>
      {badge ? (
        <span className={`${badge} capitalize`}>{value}</span>
      ) : (
        <p className="text-foreground text-sm font-medium capitalize">{value}</p>
      )}
    </div>
  );
}
