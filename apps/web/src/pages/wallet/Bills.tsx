import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Smartphone, Zap, Loader2, CheckCircle2, Tv, UserCheck } from 'lucide-react';
import { api } from '../../lib/axios';
import { useWalletStore } from '../../stores/walletStore';
import { formatCurrency } from '@vpay/utils';
import toast from 'react-hot-toast';

type Tab = 'airtime' | 'electricity' | 'bills';

interface Biller { id: string; name: string; type: string; currencies: string[]; variable_amount: boolean }

interface AirtimeOperator {
  operator_id: string; name: string; country_iso: string; currency: string;
  min_amount: number; max_amount: number; supported_types: string[];
}

// Zimbabwe operators lead the list in this business-preferred order; every
// other country follows in the provider's own order. Matching is by name
// keyword because VitalPay's operator ids aren't guaranteed stable.
const ZW_OPERATOR_ORDER = ['econet', 'netone', 'zol', 'liquid', 'telone', 'africom', 'powertel', 'telecel'];

function operatorSortRank(op: AirtimeOperator): number {
  if (op.country_iso !== 'ZW') return ZW_OPERATOR_ORDER.length + 1;
  const idx = ZW_OPERATOR_ORDER.findIndex(k => op.name.toLowerCase().includes(k) || op.operator_id.toLowerCase().includes(k));
  return idx === -1 ? ZW_OPERATOR_ORDER.length : idx;
}

export default function Bills() {
  const [tab, setTab] = useState<Tab>('airtime');

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display font-bold text-foreground text-2xl">Bills & Top-ups</h1>
        <p className="text-foreground/40 text-sm">Buy airtime, data, and electricity tokens</p>
      </div>

      <div className="flex gap-2 p-1 rounded-xl bg-foreground/5 w-full overflow-x-auto">
        <button
          onClick={() => setTab('airtime')}
          className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${tab === 'airtime' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/50'}`}
        >
          <Smartphone className="w-4 h-4 shrink-0" /> Airtime & Data
        </button>
        <button
          onClick={() => setTab('electricity')}
          className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${tab === 'electricity' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/50'}`}
        >
          <Zap className="w-4 h-4 shrink-0" /> Electricity
        </button>
        <button
          onClick={() => setTab('bills')}
          className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${tab === 'bills' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/50'}`}
        >
          <Tv className="w-4 h-4 shrink-0" /> TV & Bills
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'airtime' ? (
          <motion.div key="airtime" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <AirtimeForm />
          </motion.div>
        ) : tab === 'electricity' ? (
          <motion.div key="electricity" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <ElectricityForm />
          </motion.div>
        ) : (
          <motion.div key="bills" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <BillPayForm />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AirtimeForm() {
  const { activeWallet } = useWalletStore();
  const [operatorId, setOperatorId] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'airtime' | 'data'>('airtime');
  const [result, setResult] = useState<any>(null);

  const { data: operatorsData, isLoading: operatorsLoading } = useQuery({
    queryKey: ['airtime-operators'],
    queryFn: () => api.get<{ success: boolean; data: AirtimeOperator[] }>('/api/vas/airtime/operators'),
  });
  const operators = [...(operatorsData?.data?.data ?? [])].sort((a, b) => operatorSortRank(a) - operatorSortRank(b));
  const selectedOperator = operators.find(o => o.operator_id === operatorId);

  const purchase = useMutation({
    mutationFn: () => api.post('/api/vas/airtime/purchase', {
      operator_id: operatorId,
      phone,
      amount: parseFloat(amount),
      currency: activeWallet?.currency ?? 'USD',
      type,
    }),
    onSuccess: (res) => {
      toast.success('Purchase submitted!');
      setResult((res.data as any)?.data);
      useWalletStore.getState().fetchWallets();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Purchase failed'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorId) { toast.error('Select a network operator'); return; }
    if (!(parseFloat(amount) > 0)) { toast.error('Enter an amount greater than 0'); return; }
    setResult(null);
    purchase.mutate();
  };

  if (result) {
    return (
      <div className="glass-card p-6 text-center space-y-3">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
        <p className="text-foreground font-semibold">{formatCurrency(parseFloat(amount), activeWallet?.currency ?? 'USD')} {type} sent to {phone}</p>
        <p className="text-foreground/40 text-xs">Status: {result.status} · Ref: {result.reference}</p>
        <button onClick={() => { setResult(null); setPhone(''); setAmount(''); }} className="btn-ghost py-2 px-5 text-sm mt-2">
          Buy another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="glass-card p-6 space-y-4">
      <div className="flex gap-2">
        <button type="button" onClick={() => setType('airtime')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${type === 'airtime' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'bg-foreground/5 text-foreground/50'}`}>Airtime</button>
        <button type="button" onClick={() => setType('data')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${type === 'data' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'bg-foreground/5 text-foreground/50'}`}>Data</button>
      </div>

      <div>
        <label className="block text-foreground/60 text-sm mb-1.5">Network operator</label>
        <select value={operatorId} onChange={(e) => setOperatorId(e.target.value)} className="input-field" disabled={operatorsLoading}>
          <option value="">{operatorsLoading ? 'Loading operators…' : 'Select operator'}</option>
          {operators
            .filter(o => o.supported_types.includes(type))
            .map(o => <option key={o.operator_id} value={o.operator_id}>{o.name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-foreground/60 text-sm mb-1.5">Recipient phone number</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" required placeholder="+263771234567" className="input-field" />
      </div>

      <div>
        <label className="block text-foreground/60 text-sm mb-1.5">
          Amount ({activeWallet?.currency ?? 'USD'})
          {selectedOperator && <span className="text-foreground/30"> · min {selectedOperator.min_amount}, max {selectedOperator.max_amount}</span>}
        </label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" min="0.5" required placeholder="5.00" className="input-field" />
      </div>

      <button type="submit" disabled={purchase.isPending} className="btn-brand w-full py-3 flex items-center justify-center gap-2">
        {purchase.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Buy ${type}`}
      </button>
    </form>
  );
}

function ElectricityForm() {
  const { activeWallet } = useWalletStore();
  const [meterNumber, setMeterNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<any>(null);

  const purchase = useMutation({
    mutationFn: () => api.post('/api/vas/electricity/purchase', {
      meter_number: meterNumber,
      amount: parseFloat(amount),
      currency: activeWallet?.currency ?? 'USD',
      country: 'ZW',
    }),
    onSuccess: (res) => {
      toast.success('Token purchased!');
      setResult((res.data as any)?.data);
      useWalletStore.getState().fetchWallets();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Purchase failed'),
  });

  // Confirmation step before money moves: the user re-reads the meter
  // number and amount on a dedicated screen. (VitalPay's electricity API
  // has no meter-holder lookup endpoint yet — requested from them — so
  // this confirms the details we have rather than the registered name.)
  const [confirming, setConfirming] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!(parseFloat(amount) >= 5)) { toast.error('ZESA electricity has a $5 minimum'); return; }
    setResult(null);
    setConfirming(true);
  };

  if (confirming && !result) {
    return (
      <div className="glass-card p-6 space-y-4">
        <p className="text-foreground font-semibold">Confirm electricity purchase</p>
        <div className="rounded-xl bg-foreground/5 p-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3"><span className="text-foreground/40 shrink-0">Meter number</span><span className="text-foreground font-mono font-medium text-right break-all">{meterNumber}</span></div>
          <div className="flex justify-between gap-3"><span className="text-foreground/40 shrink-0">Utility</span><span className="text-foreground font-medium text-right">ZESA / ZETDC (Zimbabwe)</span></div>
          <div className="flex justify-between gap-3"><span className="text-foreground/40 shrink-0">Amount</span><span className="text-foreground font-semibold text-right">{formatCurrency(parseFloat(amount), activeWallet?.currency ?? 'USD')}</span></div>
        </div>
        <p className="text-foreground/30 text-xs leading-relaxed">
          Double-check the meter number — tokens are generated for this exact meter and cannot be transferred once issued.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setConfirming(false)} className="btn-ghost flex-1 py-2.5 text-sm">Edit details</button>
          <button
            onClick={() => { setConfirming(false); purchase.mutate(); }}
            disabled={purchase.isPending}
            className="btn-brand flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
          >
            {purchase.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & buy token'}
          </button>
        </div>
      </div>
    );
  }

  if (result) {
    const tokens: string[] = result.token_pieces ?? [];
    return (
      <div className="glass-card p-6 text-center space-y-3">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
        <p className="text-foreground font-semibold">Electricity token for meter {meterNumber}</p>
        {tokens.length > 0 ? (
          <div className="space-y-1">
            {tokens.map((t, i) => (
              <code key={i} className="block bg-foreground/5 rounded-lg py-2 px-3 text-foreground font-mono text-sm tracking-wider">{t}</code>
            ))}
          </div>
        ) : (
          <p className="text-foreground/40 text-xs">Status: {result.status} — token will appear here once processing completes.</p>
        )}
        {result.units && <p className="text-foreground/40 text-xs">{result.units} units</p>}
        <button onClick={() => { setResult(null); setMeterNumber(''); setAmount(''); }} className="btn-ghost py-2 px-5 text-sm mt-2">
          Buy another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="glass-card p-6 space-y-4">
      <div>
        <label className="block text-foreground/60 text-sm mb-1.5">Meter number</label>
        <input value={meterNumber} onChange={(e) => setMeterNumber(e.target.value)} required maxLength={30} placeholder="04123456789" className="input-field" />
      </div>
      <div>
        <label className="block text-foreground/60 text-sm mb-1.5">Amount ({activeWallet?.currency ?? 'USD'}) <span className="text-foreground/30">· $5 minimum</span></label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" min="5" required placeholder="20.00" className="input-field" />
      </div>
      <p className="text-foreground/30 text-xs">Currently supports ZESA/ZETDC (Zimbabwe) meters only.</p>
      <button type="submit" disabled={purchase.isPending} className="btn-brand w-full py-3 flex items-center justify-center gap-2">
        {purchase.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buy electricity token'}
      </button>
    </form>
  );
}

function BillPayForm() {
  const { activeWallet } = useWalletStore();
  const [billerCode, setBillerCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<any>(null);
  const [confirming, setConfirming] = useState(false);

  const { data: billersData, isLoading: billersLoading } = useQuery({
    queryKey: ['bill-billers'],
    queryFn: () => api.get<{ success: boolean; data: Biller[] }>('/api/vas/bills/billers', { params: { country: 'ZW' } }),
  });
  const billers = billersData?.data?.data ?? [];
  const selectedBiller = billers.find(b => b.id === billerCode);

  // Confirm the account belongs to who the user expects before money moves.
  // VitalPay returns account_name when the biller supports holder lookup —
  // null otherwise (confirmed by direct sandbox testing; DStv sandbox
  // currently returns null, so we show what we have rather than blocking).
  const validate = useMutation({
    mutationFn: () => api.get<{ success: boolean; data: { valid: boolean; account_name: string | null } }>('/api/vas/bills/validate', {
      params: { biller_code: billerCode, account_number: accountNumber, country: 'ZW' },
    }),
    onSuccess: () => setConfirming(true),
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Could not validate account'),
  });

  const purchase = useMutation({
    mutationFn: () => api.post('/api/vas/bills/pay', {
      biller_code: billerCode,
      account_number: accountNumber,
      amount: parseFloat(amount),
      currency: activeWallet?.currency ?? 'USD',
      country: 'ZW',
    }),
    onSuccess: (res) => {
      toast.success('Bill paid!');
      setConfirming(false);
      setResult((res.data as any)?.data);
      useWalletStore.getState().fetchWallets();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Payment failed'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billerCode) { toast.error('Select a biller'); return; }
    if (!(parseFloat(amount) > 0)) { toast.error('Enter an amount greater than 0'); return; }
    setResult(null);
    validate.mutate();
  };

  if (confirming && !result) {
    const accountName = validate.data?.data?.data?.account_name;
    return (
      <div className="glass-card p-6 space-y-4">
        <p className="text-foreground font-semibold">Confirm bill payment</p>
        <div className="rounded-xl bg-foreground/5 p-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3"><span className="text-foreground/40 shrink-0">Biller</span><span className="text-foreground font-medium text-right">{selectedBiller?.name}</span></div>
          <div className="flex justify-between gap-3"><span className="text-foreground/40 shrink-0">Account number</span><span className="text-foreground font-mono font-medium text-right break-all">{accountNumber}</span></div>
          {accountName ? (
            <div className="flex justify-between items-center gap-3">
              <span className="text-foreground/40 shrink-0">Registered to</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1.5 text-right justify-end"><UserCheck className="w-3.5 h-3.5 shrink-0" /> {accountName}</span>
            </div>
          ) : (
            <p className="text-foreground/30 text-xs pt-1">This biller doesn't return a registered name to confirm — double-check the account number is correct.</p>
          )}
          <div className="flex justify-between gap-3 pt-1 border-t border-foreground/10"><span className="text-foreground/40 shrink-0">Amount</span><span className="text-foreground font-semibold text-right">{formatCurrency(parseFloat(amount), activeWallet?.currency ?? 'USD')}</span></div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setConfirming(false)} className="btn-ghost flex-1 py-2.5 text-sm">Edit details</button>
          <button
            onClick={() => purchase.mutate()}
            disabled={purchase.isPending}
            className="btn-brand flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
          >
            {purchase.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & pay'}
          </button>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="glass-card p-6 text-center space-y-3">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
        <p className="text-foreground font-semibold">{formatCurrency(parseFloat(amount), activeWallet?.currency ?? 'USD')} paid to {selectedBiller?.name}</p>
        <p className="text-foreground/40 text-xs">Status: {result.status} · Ref: {result.reference}</p>
        <button onClick={() => { setResult(null); setAccountNumber(''); setAmount(''); }} className="btn-ghost py-2 px-5 text-sm mt-2">
          Pay another bill
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="glass-card p-6 space-y-4">
      <div>
        <label className="block text-foreground/60 text-sm mb-1.5">Biller</label>
        <select value={billerCode} onChange={(e) => setBillerCode(e.target.value)} className="input-field" disabled={billersLoading}>
          <option value="">{billersLoading ? 'Loading billers…' : 'Select biller'}</option>
          {billers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-foreground/60 text-sm mb-1.5">Account / smartcard number</label>
        <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required maxLength={40} placeholder="1234567890" className="input-field" />
      </div>

      <div>
        <label className="block text-foreground/60 text-sm mb-1.5">Amount ({activeWallet?.currency ?? 'USD'})</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" min="1" required placeholder="30.00" className="input-field" />
      </div>

      <p className="text-foreground/30 text-xs">Currently supports DStv, ZOL, TelOne, and Bulawayo City Council (Zimbabwe).</p>

      <button type="submit" disabled={validate.isPending} className="btn-brand w-full py-3 flex items-center justify-center gap-2">
        {validate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
      </button>
    </form>
  );
}
