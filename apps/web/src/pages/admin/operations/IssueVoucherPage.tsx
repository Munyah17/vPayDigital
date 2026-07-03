import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Copy, CheckCircle, ChevronDown } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import toast from 'react-hot-toast';

const TYPES = [
  { value: 'virtual_card',  label: 'Virtual Card' },
  { value: 'gift_card',     label: 'Gift Card' },
  { value: 'streaming',     label: 'Streaming' },
  { value: 'gaming',        label: 'Gaming' },
  { value: 'ecommerce',     label: 'E-commerce' },
  { value: 'general',       label: 'General' },
];

const BRANDS = ['netflix', 'amazon', 'spotify', 'apple', 'google_play', 'steam',
  'playstation', 'xbox', 'binance', 'airbnb', 'uber', 'ebay', 'disney_plus', 'youtube'];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'ZAR', 'NGN', 'GHS'];

type IssuedVoucher = { id: string; code: string; amount: number; currency: string; type: string; expires_at: string };

export default function IssueVoucherPage() {
  const [form, setForm] = useState({
    type: 'virtual_card',
    amount: 25,
    currency: 'USD',
    expires_in_days: 30,
    gift_card_brand: '',
    quantity: 1,
  });
  const [issued, setIssued] = useState<IssuedVoucher[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  // Show current float balance
  const { data: floatData } = useQuery({
    queryKey: ['admin-float'],
    queryFn: () => api.get('/api/agent/metrics'),
  });
  const floatBalance: number = (floatData?.data as any)?.data?.float_balance ?? 0;
  const floatCurrency: string = (floatData?.data as any)?.data?.currency ?? 'USD';

  const issue = useMutation({
    mutationFn: () => api.post('/api/vouchers', form),
    onSuccess: (res) => {
      const data = (res.data as any).data;
      const list: IssuedVoucher[] = Array.isArray(data) ? data : [data];
      setIssued(prev => [...list, ...prev]);
      toast.success(`${list.length} voucher${list.length > 1 ? 's' : ''} issued`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to issue voucher'),
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const cost = (form.amount * 1.015 * form.quantity).toFixed(2);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
            <Zap className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-2xl">Issue Vouchers</h1>
            <p className="text-foreground/30 text-sm">Generate voucher codes from the master float</p>
          </div>
        </div>

        {/* Float balance badge */}
        <div className="panel px-4 py-2.5 text-right">
          <p className="text-foreground/30 text-xs">Master Float</p>
          <p className="text-foreground font-bold text-lg font-display">
            {floatCurrency} {floatBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="panel space-y-5">
          <h2 className="text-foreground font-semibold text-sm">Voucher Configuration</h2>

          {/* Type */}
          <div>
            <label className="block text-foreground/50 text-xs mb-1.5">Type</label>
            <div className="relative">
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value, gift_card_brand: '' }))}
                className="input w-full appearance-none pr-8 [&>option]:text-black [&>option]:bg-foreground"
              >
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 pointer-events-none" />
            </div>
          </div>

          {/* Brand (gift cards only) */}
          <AnimatePresence>
            {form.type === 'gift_card' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <label className="block text-foreground/50 text-xs mb-1.5">Brand</label>
                <div className="relative">
                  <select
                    value={form.gift_card_brand}
                    onChange={e => setForm(f => ({ ...f, gift_card_brand: e.target.value }))}
                    className="input w-full appearance-none pr-8 [&>option]:text-black [&>option]:bg-foreground"
                  >
                    <option value="">Select brand</option>
                    {BRANDS.map(b => (
                      <option key={b} value={b}>{b.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 pointer-events-none" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Amount + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-foreground/50 text-xs mb-1.5">Amount</label>
              <input
                type="number" min={1} max={5000}
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-foreground/50 text-xs mb-1.5">Currency</label>
              <div className="relative">
                <select
                  value={form.currency}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="input w-full appearance-none pr-8 [&>option]:text-black [&>option]:bg-foreground"
                >
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Quantity + Expiry */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-foreground/50 text-xs mb-1.5">Quantity (max 100)</label>
              <input
                type="number" min={1} max={100}
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-foreground/50 text-xs mb-1.5">Expires in (days)</label>
              <input
                type="number" min={1} max={365}
                value={form.expires_in_days}
                onChange={e => setForm(f => ({ ...f, expires_in_days: Number(e.target.value) }))}
                className="input w-full"
              />
            </div>
          </div>

          {/* Cost summary */}
          <div className="rounded-xl bg-foreground/3 border border-foreground/5 p-3 flex items-center justify-between">
            <span className="text-foreground/40 text-sm">Total cost (incl. 1.5% fee)</span>
            <span className="text-foreground font-bold">{form.currency} {cost}</span>
          </div>

          <button
            onClick={() => issue.mutate()}
            disabled={issue.isPending || (form.type === 'gift_card' && !form.gift_card_brand)}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            {issue.isPending ? (
              <span className="w-4 h-4 rounded-full border-2 border-foreground/30 border-t-white animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            Issue {form.quantity > 1 ? `${form.quantity} Vouchers` : 'Voucher'}
          </button>
        </div>

        {/* Issued vouchers */}
        <div className="panel space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground font-semibold text-sm">Issued This Session</h2>
            {issued.length > 0 && (
              <span className="badge-info">{issued.length}</span>
            )}
          </div>

          {issued.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Zap className="w-8 h-8 text-foreground/10 mb-3" />
              <p className="text-foreground/20 text-sm">Issued vouchers will appear here</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {issued.map(v => (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-foreground/3 border border-foreground/5"
                >
                  <div>
                    <p className="text-foreground text-xs font-mono font-semibold tracking-widest">{v.code}</p>
                    <p className="text-foreground/30 text-[10px] mt-0.5">
                      {v.type.replace(/_/g, ' ')} · {v.currency} {Number(v.amount).toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => copyCode(v.code)}
                    className="p-1.5 rounded-lg hover:bg-foreground/10 transition-colors"
                  >
                    {copied === v.code
                      ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                      : <Copy className="w-4 h-4 text-foreground/30" />}
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
