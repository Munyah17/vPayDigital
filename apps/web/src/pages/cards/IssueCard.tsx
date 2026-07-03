import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Loader2, CreditCard } from 'lucide-react';
import { api } from '../../lib/axios';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';

const schema = z.object({
  cardholder_name: z.string().min(2).max(26),
  card_type: z.enum(['single_use', 'multi_use', 'disposable', 'subscription']),
  network: z.enum(['visa', 'mastercard']),
  currency: z.enum(['USD', 'EUR', 'GBP', 'ZAR', 'NGN', 'GHS']),
  amount: z.coerce.number().min(5).max(10_000),
});
type Form = z.infer<typeof schema>;

export default function IssueCard() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();

  if (profile?.role === 'consumer') {
    navigate('/cards/request', { replace: true });
    return null;
  }
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      cardholder_name: profile?.full_name ?? '',
      card_type: 'multi_use',
      network: 'visa',
      currency: 'USD',
      amount: 25,
    },
  });

  const issue = useMutation({
    mutationFn: (data: Form) => api.post('/api/cards', data),
    onSuccess: (res) => {
      toast.success('Card issued!');
      const card = (res.data as any)?.data;
      navigate(card?.id ? `/cards/${card.id}` : '/cards');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to issue card'),
  });

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-foreground/40 hover:text-foreground text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="glass-card p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-glow">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-xl">Issue a virtual card</h1>
            <p className="text-foreground/40 text-sm">Instantly create a card linked to your wallet</p>
          </div>
        </div>

        <form onSubmit={handleSubmit((d) => issue.mutate(d))} className="space-y-4">
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
                {['USD', 'EUR', 'GBP', 'ZAR', 'NGN', 'GHS'].map((c) => <option key={c} value={c}>{c}</option>)}
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
            <label className="block text-foreground/60 text-sm mb-1.5">Initial load amount</label>
            <input {...register('amount')} type="number" step="0.01" className="input-field" />
            {errors.amount && <p className="text-red-400 text-xs mt-1">{errors.amount.message}</p>}
          </div>

          <button type="submit" disabled={issue.isPending} className="btn-brand w-full py-3 flex items-center justify-center gap-2">
            {issue.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Issue card'}
          </button>
        </form>
      </div>
    </div>
  );
}
