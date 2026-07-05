import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Landmark, Building2, Copy, CheckCircle2, Clock, ShieldAlert, Plus, Star, Trash2, X, Send,
} from 'lucide-react';
import { api } from '../../lib/axios';
import { useAuthStore } from '../../stores/authStore';
import { BANKING_CONFIG } from '@vpay/config';
import type { VirtualAccount, IbanAccount, IbanAccountStatus, Beneficiary, BeneficiaryType } from '@vpay/types';
import toast from 'react-hot-toast';

type Tab = 'accounts' | 'send' | 'beneficiaries';

const TAB_LABELS: Record<Tab, string> = {
  accounts: 'Receiving Accounts',
  send: 'Send',
  beneficiaries: 'Beneficiaries',
};

export default function BankingServices() {
  const [tab, setTab] = useState<Tab>('accounts');

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display font-bold text-foreground text-2xl">Banking Services</h1>
        <p className="text-foreground/40 text-sm">Receiving accounts and saved payout recipients</p>
      </div>

      <div className="flex items-center gap-2">
        {(['accounts', 'send', 'beneficiaries'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              tab === t
                ? 'bg-indigo-600 text-white shadow-glow-sm'
                : 'bg-foreground/5 text-foreground/40 hover:text-foreground border border-foreground/10'
            }`}
          >
            {TAB_LABELS[t]}
            {t === 'send' && (
              <span className="px-1.5 py-0.5 rounded-md bg-foreground/10 text-foreground/40 text-[9px] uppercase tracking-wider">Soon</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'accounts' && <AccountsTab />}
      {tab === 'send' && <SendComingSoon />}
      {tab === 'beneficiaries' && <BeneficiariesTab />}
    </div>
  );
}

function SendComingSoon() {
  return (
    <div className="glass-card p-12 text-center opacity-75">
      <Send className="w-10 h-10 text-foreground/20 mx-auto mb-4" />
      <h3 className="text-foreground font-semibold mb-1.5">Sending is coming soon</h3>
      <p className="text-foreground/40 text-sm max-w-sm mx-auto">
        Sending from your banking account will unlock once we're live with a licensed EU banking
        partner. In the meantime, you can still withdraw to a bank account from{' '}
        <Link to="/wallet/payout" className="text-indigo-400 hover:underline">Wallet → Withdraw</Link>.
      </p>
    </div>
  );
}

// ─── Receiving Accounts ────────────────────────────────────────────────────────

function AccountsTab() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['banking-accounts'],
    queryFn: () => api.get<{ success: boolean; data: { local: VirtualAccount | null; iban: IbanAccount | null } }>('/api/banking/accounts'),
  });

  const local = data?.data?.data?.local ?? null;
  const iban = data?.data?.data?.iban ?? null;

  const requestIbanMutation = useMutation({
    mutationFn: () => api.post('/api/banking/iban/request'),
    onSuccess: () => {
      toast.success('IBAN account requested');
      queryClient.invalidateQueries({ queryKey: ['banking-accounts'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Could not request IBAN account'),
  });

  const createLocalMutation = useMutation({
    mutationFn: async () => {
      const walletsRes = await api.get<{ success: boolean; data: { id: string }[] }>('/api/wallets');
      const walletId = walletsRes.data?.data?.[0]?.id;
      if (!walletId) throw new Error('No wallet found');
      return api.post(`/api/wallets/${walletId}/virtual-account`);
    },
    onSuccess: () => {
      toast.success('Receiving account created');
      queryClient.invalidateQueries({ queryKey: ['banking-accounts'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Could not create receiving account'),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="glass-card p-6 h-40 shimmer" />
        <div className="glass-card p-6 h-32 shimmer" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {BANKING_CONFIG.ibanEnabled && (
        <IbanCard
          iban={iban}
          kycApproved={profile?.kyc_status === 'approved'}
          onRequest={() => requestIbanMutation.mutate()}
          requesting={requestIbanMutation.isPending}
        />
      )}

      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-foreground font-semibold">Local Receiving Account</h3>
            <p className="text-foreground/40 text-xs">Get a local bank account number to top up your wallet</p>
          </div>
        </div>

        {local ? (
          <div className="flex items-center gap-4 flex-wrap p-4 rounded-xl bg-foreground/[0.03] border border-foreground/5">
            <div>
              <p className="text-foreground font-display font-bold text-lg tabular-nums">{local.account_number}</p>
              <p className="text-foreground/40 text-xs">{local.account_name} · {local.bank_name}</p>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(local.account_number ?? ''); toast.success('Copied'); }}
              className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5 ml-auto"
            >
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>
        ) : (
          <button
            onClick={() => createLocalMutation.mutate()}
            disabled={createLocalMutation.isPending}
            className="btn-brand text-sm py-2.5 px-4 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {createLocalMutation.isPending ? 'Creating…' : 'Create receiving account'}
          </button>
        )}
      </div>
    </div>
  );
}

const IBAN_STEPS: { key: IbanAccountStatus; label: string }[] = [
  { key: 'requested', label: 'Requested' },
  { key: 'in_review', label: 'Under Review' },
  { key: 'provisioning', label: 'Provisioning' },
  { key: 'active', label: 'Active' },
];

function IbanCard({ iban, kycApproved, onRequest, requesting }: {
  iban: IbanAccount | null;
  kycApproved: boolean;
  onRequest: () => void;
  requesting: boolean;
}) {
  const currentStepIndex = iban ? IBAN_STEPS.findIndex(s => s.key === iban.status) : -1;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 border border-indigo-500/20">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center flex-shrink-0">
          <Landmark className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-foreground font-semibold">EU IBAN Account</h3>
          <p className="text-foreground/40 text-xs">Receive euro payments directly via SEPA transfer</p>
        </div>
      </div>

      {iban && iban.status !== 'rejected' ? (
        <div className="space-y-4">
          <div className="flex items-center">
            {IBAN_STEPS.map((step, i) => (
              <div key={step.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i <= currentStepIndex ? 'bg-indigo-600 text-white' : 'bg-foreground/10 text-foreground/30'
                  }`}>
                    {i < currentStepIndex ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className={`text-[10px] whitespace-nowrap ${i <= currentStepIndex ? 'text-foreground/70' : 'text-foreground/30'}`}>
                    {step.label}
                  </span>
                </div>
                {i < IBAN_STEPS.length - 1 && (
                  <div className={`h-px flex-1 mx-1 mb-4 ${i < currentStepIndex ? 'bg-indigo-600' : 'bg-foreground/10'}`} />
                )}
              </div>
            ))}
          </div>

          {iban.status === 'active' ? (
            <div className="p-4 rounded-xl bg-foreground/[0.03] border border-foreground/5">
              <p className="text-foreground font-display font-bold text-lg tracking-wider">{iban.iban}</p>
              <p className="text-foreground/40 text-xs">{iban.bic} · {iban.bank_name}</p>
            </div>
          ) : (
            <p className="text-foreground/40 text-xs">
              We've received your request. EU IBAN accounts are rolling out — you'll be notified the moment yours is ready.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {!kycApproved && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-400 text-sm">
                Complete identity verification before requesting an IBAN account.{' '}
                <Link to="/profile/kyc" className="underline">Verify now</Link>
              </p>
            </div>
          )}
          {iban?.status === 'rejected' && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <Clock className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{iban.rejection_reason ?? 'Your previous request was rejected.'}</p>
            </div>
          )}
          <button
            onClick={onRequest}
            disabled={!kycApproved || requesting}
            className="btn-brand text-sm py-2.5 px-4 disabled:opacity-40"
          >
            {requesting ? 'Requesting…' : 'Request my EU IBAN'}
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Beneficiaries ─────────────────────────────────────────────────────────────

function BeneficiariesTab() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['beneficiaries'],
    queryFn: () => api.get<{ success: boolean; data: Beneficiary[] }>('/api/beneficiaries'),
  });

  const beneficiaries = data?.data?.data ?? [];

  const favouriteMutation = useMutation({
    mutationFn: ({ id, is_favourite }: { id: string; is_favourite: boolean }) =>
      api.patch(`/api/beneficiaries/${id}`, { is_favourite }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['beneficiaries'] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/beneficiaries/${id}`),
    onSuccess: () => { toast.success('Beneficiary removed'); queryClient.invalidateQueries({ queryKey: ['beneficiaries'] }); },
    onError: () => toast.error('Failed to remove beneficiary'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="btn-brand text-sm py-2 px-4 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add beneficiary
        </button>
      </div>

      {isLoading ? (
        <div className="glass-card p-6 h-40 shimmer" />
      ) : beneficiaries.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Building2 className="w-12 h-12 text-foreground/10 mx-auto mb-4" />
          <p className="text-foreground/40 text-sm">No saved beneficiaries yet</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <ul className="divide-y divide-foreground/5">
            {beneficiaries.map(b => (
              <li key={b.id} className="flex items-center gap-3 p-4">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/20 flex items-center justify-center flex-shrink-0 text-indigo-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm font-medium truncate">{b.nickname || b.account_name || 'Beneficiary'}</p>
                  <p className="text-foreground/40 text-xs truncate">
                    {b.account_number ?? b.mobile_number ?? b.crypto_address} · {b.bank_name ?? b.mobile_provider ?? b.crypto_network}
                  </p>
                </div>
                <span className={b.is_verified ? 'badge-active' : 'badge-pending'}>{b.is_verified ? 'Verified' : 'Unverified'}</span>
                <button
                  onClick={() => favouriteMutation.mutate({ id: b.id, is_favourite: !b.is_favourite })}
                  className="p-1.5 rounded-lg hover:bg-foreground/5 transition-colors"
                  title={b.is_favourite ? 'Unfavourite' : 'Favourite'}
                >
                  <Star className={`w-4 h-4 ${b.is_favourite ? 'text-amber-400 fill-amber-400' : 'text-foreground/20'}`} />
                </button>
                <button
                  onClick={() => { if (confirm('Remove this beneficiary?')) removeMutation.mutate(b.id); }}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-foreground/20 hover:text-red-400" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showAdd && <AddBeneficiaryDialog onClose={() => setShowAdd(false)} />}
    </div>
  );
}

type BeneficiaryFieldDef = { id: string; label: string; placeholder: string };
const BENEFICIARY_TYPE_FIELDS: Record<BeneficiaryType, BeneficiaryFieldDef[]> = {
  bank: [
    { id: 'account_name', label: 'Account holder name', placeholder: 'Full name' },
    { id: 'account_number', label: 'Account number / IBAN', placeholder: 'e.g. GB29NWBK60161331926819' },
    { id: 'bank_name', label: 'Bank name', placeholder: 'e.g. Barclays' },
    { id: 'swift_code', label: 'Swift / Sort code', placeholder: 'e.g. BARCGB22' },
    { id: 'country', label: 'Country', placeholder: 'e.g. GB' },
  ],
  mobile_money: [
    { id: 'account_name', label: "Recipient's name", placeholder: 'Full name' },
    { id: 'mobile_number', label: 'Mobile number', placeholder: '+263 77 123 4567' },
    { id: 'mobile_provider', label: 'Provider', placeholder: 'e.g. EcoCash, M-Pesa' },
  ],
  crypto: [
    { id: 'account_name', label: 'Wallet label', placeholder: 'My BTC Wallet' },
    { id: 'crypto_address', label: 'Wallet address', placeholder: '0x... or bc1...' },
    { id: 'crypto_network', label: 'Network', placeholder: 'e.g. BTC, ETH, USDT-TRC20' },
  ],
  card: [
    { id: 'account_name', label: 'Cardholder name', placeholder: 'Name on card' },
    { id: 'account_number', label: 'Card number (last 4)', placeholder: 'XXXX' },
    { id: 'bank_name', label: 'Card network', placeholder: 'e.g. Visa, Mastercard' },
  ],
};

function AddBeneficiaryDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<BeneficiaryType>('bank');
  const [nickname, setNickname] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/beneficiaries', { beneficiary_type: type, nickname: nickname || undefined, ...fields }),
    onSuccess: () => {
      toast.success('Beneficiary saved');
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to save beneficiary'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-foreground text-lg">Add beneficiary</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-foreground/5"><X className="w-4 h-4 text-foreground/40" /></button>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {(Object.keys(BENEFICIARY_TYPE_FIELDS) as BeneficiaryType[]).map(t => (
            <button
              key={t}
              onClick={() => { setType(t); setFields({}); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize ${
                type === t ? 'bg-indigo-600 text-white' : 'bg-foreground/5 text-foreground/40 border border-foreground/10'
              }`}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-foreground/60 text-sm mb-1.5">Nickname (optional)</label>
            <input value={nickname} onChange={e => setNickname(e.target.value)} className="input-field" placeholder="e.g. Mom's account" />
          </div>
          {BENEFICIARY_TYPE_FIELDS[type].map(field => (
            <div key={field.id}>
              <label className="block text-foreground/60 text-sm mb-1.5">{field.label}</label>
              <input
                value={fields[field.id] ?? ''}
                onChange={e => setFields(f => ({ ...f, [field.id]: e.target.value }))}
                className="input-field"
                placeholder={field.placeholder}
              />
            </div>
          ))}
        </div>

        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="btn-brand w-full py-3 mt-5 disabled:opacity-40"
        >
          {createMutation.isPending ? 'Saving…' : 'Save beneficiary'}
        </button>
      </motion.div>
    </div>
  );
}
