import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Smartphone, Zap, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/axios';
import { useWalletStore } from '../../stores/walletStore';
import { formatCurrency } from '@vpay/utils';
import toast from 'react-hot-toast';

type Tab = 'airtime' | 'electricity';

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

      <div className="flex gap-2 p-1 rounded-xl bg-foreground/5 w-fit">
        <button
          onClick={() => setTab('airtime')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'airtime' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/50'}`}
        >
          <Smartphone className="w-4 h-4" /> Airtime & Data
        </button>
        <button
          onClick={() => setTab('electricity')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'electricity' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/50'}`}
        >
          <Zap className="w-4 h-4" /> Electricity
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'airtime' ? (
          <motion.div key="airtime" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <AirtimeForm />
          </motion.div>
        ) : (
          <motion.div key="electricity" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <ElectricityForm />
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!(parseFloat(amount) >= 5)) { toast.error('ZESA electricity has a $5 minimum'); return; }
    setResult(null);
    purchase.mutate();
  };

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
