import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { Zap, Loader2, Copy } from 'lucide-react';
import { api } from '../../lib/axios';
import { titleCase, formatCurrency } from '@vpay/utils';
import toast from 'react-hot-toast';

const BRANDS = ['netflix', 'amazon', 'spotify', 'apple', 'apple_music', 'google_play', 'steam', 'playstation', 'xbox', 'binance', 'airbnb', 'uber', 'ebay'];

export default function Issue() {
  const [form, setForm] = useState({
    type: 'virtual_card', amount: 25, currency: 'USD', expires_in_days: 30,
    gift_card_brand: '', quantity: 1,
  });
  const [issued, setIssued] = useState<any[]>([]);

  const issue = useMutation({
    mutationFn: () => api.post('/api/vouchers', form),
    onSuccess: (res) => {
      const data = (res.data as any).data;
      setIssued(Array.isArray(data) ? data : [data]);
      toast.success(`${form.quantity} voucher(s) issued`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-glow">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-display font-bold text-foreground text-2xl">Issue vouchers</h1>
          <p className="text-foreground/40 text-sm">Generate bulk voucher codes to sell or distribute</p>
        </div>
      </div>

      <div className="glass-card p-6">
        <form onSubmit={(e) => { e.preventDefault(); issue.mutate(); }} className="space-y-4">
          <div>
            <label className="block text-foreground/60 text-sm mb-1.5">Voucher type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input-field">
              <option value="virtual_card">Virtual Card</option>
              <option value="gift_card">Gift Card</option>
              <option value="general">General</option>
            </select>
          </div>
          {form.type === 'gift_card' && (
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Brand</label>
              <select value={form.gift_card_brand} onChange={(e) => setForm({ ...form, gift_card_brand: e.target.value })} className="input-field">
                <option value="">Select brand</option>
                {BRANDS.map((b) => <option key={b} value={b}>{titleCase(b)}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Amount per voucher</label>
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) })} className="input-field" />
            </div>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Currency</label>
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="input-field">
                {['USD', 'EUR', 'GBP', 'ZAR'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Quantity</label>
              <input type="number" min={1} max={100} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) })} className="input-field" />
            </div>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Expires in (days)</label>
              <input type="number" value={form.expires_in_days} onChange={(e) => setForm({ ...form, expires_in_days: parseInt(e.target.value) })} className="input-field" />
            </div>
          </div>
          <button type="submit" disabled={issue.isPending} className="btn-brand w-full py-3 flex items-center justify-center gap-2">
            {issue.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Issue ${form.quantity} voucher${form.quantity > 1 ? 's' : ''}`}
          </button>
        </form>
      </div>

      {issued.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <h3 className="font-display font-semibold text-foreground mb-4">Issued voucher codes ({issued.length})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {issued.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-3 rounded-xl bg-foreground/5">
                <div>
                  <code className="text-foreground font-mono text-sm">{v.code}</code>
                  <p className="text-foreground/40 text-xs">{formatCurrency(v.amount, v.currency)}</p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(v.code); toast.success('Copied'); }} className="p-2 rounded-lg bg-foreground/5 hover:bg-foreground/10">
                  <Copy className="w-4 h-4 text-foreground/60" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(issued.map((v) => v.code).join('\n')); toast.success('All copied'); }}
            className="btn-ghost w-full py-2 mt-3 text-sm"
          >
            Copy all codes
          </button>
        </motion.div>
      )}
    </div>
  );
}
