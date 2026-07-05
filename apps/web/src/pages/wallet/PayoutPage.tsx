import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Building2, Smartphone, Bitcoin, CreditCard, ChevronRight, ArrowLeft, Info, Star } from 'lucide-react';
import { api } from '../../lib/axios';
import { useWalletStore } from '../../stores/walletStore';
import { formatCurrency } from '@vpay/utils';
import type { Beneficiary, BeneficiaryType } from '@vpay/types';
import toast from 'react-hot-toast';

type PayoutMethod = { id: string; label: string; icon: React.ElementType; description: string; fields: FieldDef[] };
type FieldDef = { id: string; label: string; placeholder: string; type?: string; required?: boolean };

const METHOD_TO_BENEFICIARY_TYPE: Record<string, BeneficiaryType> = {
  bank_transfer: 'bank',
  mobile_money: 'mobile_money',
  crypto: 'crypto',
  card: 'card',
};

const BENEFICIARY_TO_PAYOUT_FIELDS: Record<string, Record<string, string>> = {
  bank: { account_name: 'beneficiary_name', account_number: 'beneficiary_account', bank_name: 'beneficiary_bank', swift_code: 'beneficiary_bank_code', country: 'beneficiary_country' },
  mobile_money: { account_name: 'beneficiary_name', mobile_number: 'mobile_number', mobile_provider: 'mobile_provider' },
  crypto: { account_name: 'beneficiary_name', crypto_address: 'crypto_address', crypto_network: 'crypto_network' },
  card: { account_name: 'beneficiary_name', account_number: 'beneficiary_account', bank_name: 'beneficiary_bank' },
};

const PAYOUT_METHODS: PayoutMethod[] = [
  {
    id: 'bank_transfer',
    label: 'Bank Transfer',
    icon: Building2,
    description: '1-3 business days · 1% + $1 fee',
    fields: [
      { id: 'beneficiary_name', label: 'Account holder name', placeholder: 'Full name', required: true },
      { id: 'beneficiary_account', label: 'Account number / IBAN', placeholder: 'e.g. GB29NWBK60161331926819', required: true },
      { id: 'beneficiary_bank', label: 'Bank name', placeholder: 'e.g. Barclays', required: true },
      { id: 'beneficiary_bank_code', label: 'Swift / Sort code', placeholder: 'e.g. BARCGB22' },
      { id: 'beneficiary_country', label: 'Destination country', placeholder: 'e.g. GB' },
    ],
  },
  {
    id: 'mobile_money',
    label: 'Mobile Money',
    icon: Smartphone,
    description: 'Instant to a few hours · 1% + $1 fee',
    fields: [
      { id: 'beneficiary_name', label: "Recipient's name", placeholder: 'Full name', required: true },
      { id: 'mobile_number', label: 'Mobile number', placeholder: '+263 77 123 4567', required: true },
      { id: 'mobile_provider', label: 'Provider', placeholder: 'e.g. EcoCash, M-Pesa, MTN' },
      { id: 'beneficiary_country', label: 'Country', placeholder: 'e.g. ZW' },
    ],
  },
  {
    id: 'crypto',
    label: 'Crypto',
    icon: Bitcoin,
    description: 'Minutes · 1% + $1 fee',
    fields: [
      { id: 'beneficiary_name', label: 'Wallet label', placeholder: 'My BTC Wallet', required: true },
      { id: 'crypto_address', label: 'Wallet address', placeholder: '0x... or bc1...', required: true },
      { id: 'crypto_network', label: 'Network', placeholder: 'e.g. BTC, ETH, USDT-TRC20' },
    ],
  },
  {
    id: 'card',
    label: 'Card',
    icon: CreditCard,
    description: '1-5 business days · 1% + $1 fee',
    fields: [
      { id: 'beneficiary_name', label: 'Cardholder name', placeholder: 'Name on card', required: true },
      { id: 'beneficiary_account', label: 'Card number (last 4)', placeholder: 'XXXX', required: true },
      { id: 'beneficiary_bank', label: 'Card network', placeholder: 'e.g. Visa, Mastercard' },
    ],
  },
];

export default function PayoutPage() {
  const navigate = useNavigate();
  const { wallets, activeWallet, fetchWallets } = useWalletStore();

  useEffect(() => {
    if (wallets.length === 0) fetchWallets();
  }, []);
  const [step, setStep] = useState<'method' | 'form' | 'confirm'>('method');
  const [method, setMethod] = useState<PayoutMethod | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState(activeWallet?.id ?? '');
  const [amount, setAmount] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [saveBeneficiary, setSaveBeneficiary] = useState(false);

  const selectedWallet = wallets.find(w => w.id === selectedWalletId) ?? activeWallet;

  const fee = amount ? Math.max(parseFloat(amount) * 0.01 + 1, 1.5) : 0;
  const total = amount ? parseFloat(amount) + fee : 0;

  const beneficiaryType = method ? METHOD_TO_BENEFICIARY_TYPE[method.id] : undefined;

  const { data: beneficiariesData } = useQuery({
    queryKey: ['beneficiaries'],
    queryFn: () => api.get<{ success: boolean; data: Beneficiary[] }>('/api/beneficiaries'),
  });
  const savedBeneficiaries = (beneficiariesData?.data?.data ?? []).filter(b => b.beneficiary_type === beneficiaryType);

  const applyBeneficiary = (b: Beneficiary) => {
    const mapping = BENEFICIARY_TO_PAYOUT_FIELDS[b.beneficiary_type] ?? {};
    const next: Record<string, string> = {};
    for (const [beneficiaryField, payoutField] of Object.entries(mapping)) {
      const value = (b as unknown as Record<string, string | undefined>)[beneficiaryField];
      if (value) next[payoutField] = value;
    }
    setFields(f => ({ ...f, ...next }));
  };

  const payoutMutation = useMutation({
    mutationFn: () => api.post('/api/wallets/payout', {
      amount: parseFloat(amount),
      currency: selectedWallet?.currency ?? 'USD',
      method: method!.id,
      notes: notes || undefined,
      ...fields,
    }),
    onSuccess: async () => {
      if (saveBeneficiary && beneficiaryType) {
        const mapping = BENEFICIARY_TO_PAYOUT_FIELDS[beneficiaryType] ?? {};
        const payload: Record<string, string> = { beneficiary_type: beneficiaryType };
        for (const [beneficiaryField, payoutField] of Object.entries(mapping)) {
          if (fields[payoutField]) payload[beneficiaryField] = fields[payoutField];
        }
        try {
          await api.post('/api/beneficiaries', payload);
        } catch {
          // Payout already succeeded — a failed save shouldn't block the success flow.
        }
      }
      toast.success('Payout initiated! Processing within the quoted timeframe.');
      navigate('/wallet');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Payout failed'),
  });

  const isFormValid = method?.fields.filter(f => f.required).every(f => fields[f.id]?.trim());

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => step === 'method' ? navigate('/wallet') : setStep(step === 'confirm' ? 'form' : 'method')}
          className="p-2 rounded-xl hover:bg-foreground/5 text-foreground/40 hover:text-foreground transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display font-bold text-foreground text-2xl">Withdraw</h1>
          <p className="text-foreground/40 text-xs">{step === 'method' ? 'Choose method' : step === 'form' ? 'Enter details' : 'Confirm'}</p>
        </div>
      </div>

      {/* Step: Method selection */}
      {step === 'method' && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
          {PAYOUT_METHODS.map(m => (
            <button key={m.id} onClick={() => { setMethod(m); setFields({}); setStep('form'); }}
              className="w-full flex items-center gap-4 p-4 glass-card hover:border-foreground/20 hover:bg-foreground/8 text-left transition-all rounded-2xl">
              <div className="w-11 h-11 rounded-xl bg-indigo-600/20 flex items-center justify-center flex-shrink-0">
                <m.icon className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-medium">{m.label}</p>
                <p className="text-foreground/40 text-xs mt-0.5">{m.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-foreground/20 flex-shrink-0" />
            </button>
          ))}
        </motion.div>
      )}

      {/* Step: Form */}
      {step === 'form' && method && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
          <div className="flex items-center gap-3 p-4 glass-card rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
              <method.icon className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-foreground font-medium">{method.label}</p>
              <p className="text-foreground/40 text-xs">{method.description}</p>
            </div>
          </div>

          {savedBeneficiaries.length > 0 && (
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Saved beneficiaries</label>
              <div className="flex gap-2 flex-wrap">
                {savedBeneficiaries.map(b => (
                  <button
                    key={b.id}
                    onClick={() => applyBeneficiary(b)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-foreground/70"
                  >
                    {b.is_favourite && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                    {b.nickname || b.account_name || 'Beneficiary'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Wallet & amount */}
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">From wallet</label>
              <select value={selectedWalletId} onChange={e => setSelectedWalletId(e.target.value)} className="input-field">
                {wallets.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.currency} wallet — {formatCurrency(w.balance, w.currency)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Amount ({selectedWallet?.currency ?? 'USD'})</label>
              <input value={amount} onChange={e => setAmount(e.target.value)} type="number" step="0.01" min="1"
                className="input-field" placeholder="0.00" />
              {amount && (
                <div className="flex justify-between text-xs mt-1.5 text-foreground/40">
                  <span>Fee: {formatCurrency(fee, selectedWallet?.currency ?? 'USD')}</span>
                  <span>Total: {formatCurrency(total, selectedWallet?.currency ?? 'USD')}</span>
                </div>
              )}
            </div>

            {/* Method-specific fields */}
            {method.fields.map(field => (
              <div key={field.id}>
                <label className="block text-foreground/60 text-sm mb-1.5">
                  {field.label} {field.required && <span className="text-red-400">*</span>}
                </label>
                <input value={fields[field.id] ?? ''} onChange={e => setFields(f => ({ ...f, [field.id]: e.target.value }))}
                  type={field.type ?? 'text'} className="input-field" placeholder={field.placeholder} />
              </div>
            ))}

            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Notes (optional)</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} className="input-field"
                placeholder="Payment reference, memo..." />
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground/60">
              <input type="checkbox" checked={saveBeneficiary} onChange={e => setSaveBeneficiary(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-600" />
              Save this beneficiary for next time
            </label>
          </div>

          {selectedWallet && amount && total > selectedWallet.balance && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <Info className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">Insufficient balance. Available: {formatCurrency(selectedWallet.balance, selectedWallet.currency)}</p>
            </div>
          )}

          <button onClick={() => setStep('confirm')}
            disabled={!amount || !isFormValid || (!!selectedWallet && total > selectedWallet.balance)}
            className="btn-brand w-full py-3 disabled:opacity-40">
            Review Payout
          </button>
        </motion.div>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && method && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
          <div className="glass-card p-5 space-y-4 rounded-2xl">
            <p className="text-foreground/50 text-xs uppercase tracking-wider font-medium">Payout Summary</p>
            <div className="space-y-3 text-sm">
              <SummaryRow label="Method" value={method.label} />
              <SummaryRow label="From" value={`${selectedWallet?.currency ?? 'USD'} Wallet`} />
              <SummaryRow label="Amount" value={formatCurrency(parseFloat(amount), selectedWallet?.currency ?? 'USD')} />
              <SummaryRow label="Fee" value={formatCurrency(fee, selectedWallet?.currency ?? 'USD')} />
              <div className="h-px bg-foreground/10" />
              <SummaryRow label="Total deducted" value={formatCurrency(total, selectedWallet?.currency ?? 'USD')} highlight />
              {method.fields.map(f => fields[f.id] && (
                <SummaryRow key={f.id} label={f.label} value={fields[f.id]} />
              ))}
              {notes && <SummaryRow label="Notes" value={notes} />}
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-amber-400 text-sm">Payouts cannot be reversed once initiated. Confirm all details are correct.</p>
          </div>

          <button onClick={() => payoutMutation.mutate()} disabled={payoutMutation.isPending}
            className="btn-brand w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40">
            {payoutMutation.isPending ? 'Processing...' : <><ArrowUpRight className="w-4 h-4" /> Confirm Payout</>}
          </button>
        </motion.div>
      )}
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-foreground/50">{label}</span>
      <span className={`text-right ${highlight ? 'text-foreground font-bold text-base' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}
