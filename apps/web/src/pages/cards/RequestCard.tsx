import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Loader2, CreditCard, Zap } from 'lucide-react';
import { api } from '../../lib/axios';
import { useAuthStore } from '../../stores/authStore';
import { useWalletStore } from '../../stores/walletStore';
import { formatCurrency } from '@vpay/utils';
import toast from 'react-hot-toast';

const schema = z.object({
  cardholder_name: z.string().min(2).max(26),
  card_type: z.enum(['single_use', 'multi_use', 'disposable', 'subscription']),
  network: z.enum(['visa', 'mastercard']),
  currency: z.enum(['USD', 'EUR', 'GBP', 'ZAR']),
  requested_amount: z.coerce.number().min(5).max(10_000),
  notes: z.string().max(200).optional(),
});
type Form = z.infer<typeof schema>;

export default function RequestCard() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { wallets } = useWalletStore();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      cardholder_name: profile?.full_name ?? '',
      card_type: 'multi_use',
      network: 'visa',
      currency: 'USD',
      requested_amount: 25,
    },
  });

  const currency = watch('currency');
  const amount = watch('requested_amount');
  const wallet = wallets.find(w => w.currency === currency);
  const insufficientFunds = !!wallet && Number(amount) > wallet.balance;

  const request = useMutation({
    mutationFn: (data: Form) => api.post('/api/cards/request', data),
    onSuccess: async (res) => {
      toast.success('Card issued instantly!');
      await useWalletStore.getState().fetchCards();
      await useWalletStore.getState().fetchWallets();
      const card = (res.data as any)?.data;
      navigate(card?.id ? `/cards/${card.id}` : '/cards');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Request failed'),
  });

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-foreground/40 hover:text-foreground text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="glass-card p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-glow">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-xl">Request New Card</h1>
            <p className="text-foreground/40 text-sm">Instantly generated and funded from your wallet balance</p>
          </div>
        </div>

        {/* How it works */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 mb-6 mt-4">
          <Zap className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
          <div className="text-indigo-300 text-xs space-y-1">
            <p className="font-medium">Instant, no approval needed</p>
            <p className="text-indigo-300/70">The load amount is deducted from your wallet balance and your card is generated immediately. No agent involved — top up your wallet first if you need more funds.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit((d) => request.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-foreground/60 text-sm mb-1.5">Cardholder name</label>
            <input {...register('cardholder_name')} className="input-field" />
            {errors.cardholder_name && <p className="text-red-400 text-xs mt-1">{errors.cardholder_name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Network</label>
              <select {...register('network')} className="input-field">
                <option value="visa">Visa</option>
                <option value="mastercard">Mastercard</option>
              </select>
            </div>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Currency</label>
              <select {...register('currency')} className="input-field">
                {['USD', 'EUR', 'GBP', 'ZAR'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-foreground/60 text-sm mb-1.5">Card type</label>
            <select {...register('card_type')} className="input-field">
              <option value="multi_use">Multi-use (reloadable)</option>
              <option value="single_use">Single-use (one transaction)</option>
              <option value="disposable">Disposable (privacy)</option>
              <option value="subscription">Subscription-only</option>
            </select>
          </div>

          <div>
            <label className="block text-foreground/60 text-sm mb-1.5">
              Load amount
              {wallet && <span className="text-foreground/30"> · wallet balance {formatCurrency(wallet.balance, wallet.currency)}</span>}
            </label>
            <input {...register('requested_amount')} type="number" step="0.01" className="input-field" />
            {errors.requested_amount && <p className="text-red-400 text-xs mt-1">{errors.requested_amount.message}</p>}
            {insufficientFunds ? (
              <p className="text-red-400 text-xs mt-1">
                Insufficient balance — you have {formatCurrency(wallet!.balance, wallet!.currency)}. Top up your wallet first.
              </p>
            ) : (
              <p className="text-foreground/30 text-xs mt-1">This amount is deducted from your {currency} wallet immediately.</p>
            )}
          </div>

          <div>
            <label className="block text-foreground/60 text-sm mb-1.5">Notes <span className="text-foreground/30">(optional)</span></label>
            <textarea
              {...register('notes')}
              rows={2}
              placeholder="Any specific requirements..."
              className="input-field resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={request.isPending || insufficientFunds}
            className="btn-brand w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {request.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Request New Card'}
          </button>
        </form>
      </div>
    </div>
  );
}
