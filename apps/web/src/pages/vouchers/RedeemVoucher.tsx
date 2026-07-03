import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { Ticket, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { api } from '../../lib/axios';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

export default function RedeemVoucher() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [code, setCode] = useState('');
  const [name, setName] = useState(profile?.full_name ?? '');

  const redeem = useMutation({
    mutationFn: () => api.post('/api/vouchers/redeem', { code: code.trim().toUpperCase(), cardholder_name: name }),
    onSuccess: (res) => {
      const result = (res.data as any).data;
      toast.success(result?.message ?? 'Redeemed!');
      if (result?.card?.id) navigate(`/cards/${result.card.id}`);
      else navigate('/wallet');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Redeem failed'),
  });

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-foreground/40 hover:text-foreground text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-glow">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-xl">Redeem a voucher</h1>
            <p className="text-foreground/40 text-sm">Got a voucher code? Use it to load your wallet or get a card.</p>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); redeem.mutate(); }} className="space-y-4">
          <div>
            <label className="block text-foreground/60 text-sm mb-1.5">Voucher code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="VP-XXXX-XXXX-XXXX"
              className="input-field font-mono tracking-wider text-center text-lg"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-foreground/60 text-sm mb-1.5">Name on card (if applicable)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
          </div>
          <button type="submit" disabled={redeem.isPending || !code} className="btn-brand w-full py-3 flex items-center justify-center gap-2">
            {redeem.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><Ticket className="w-4 h-4" /> Redeem</>)}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
