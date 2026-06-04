import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Ticket, Scan, CheckCircle2, XCircle, Loader2,
  Gift, CreditCard, Gamepad2, Music, ShoppingBag, Clock
} from 'lucide-react';
import { api } from '../../lib/axios';
import { formatCurrency, formatDate, titleCase } from '@vpay/utils';
import type { Voucher } from '@vpay/types';
import toast from 'react-hot-toast';

const redeemSchema = z.object({
  code: z.string().min(8, 'Enter a valid voucher code'),
  cardholder_name: z.string().min(2, 'Enter your name as it should appear on the card'),
});

type RedeemForm = z.infer<typeof redeemSchema>;

const VOUCHER_TYPE_ICONS: Record<string, React.ElementType> = {
  virtual_card: CreditCard,
  gift_card: Gift,
  gaming: Gamepad2,
  streaming: Music,
  ecommerce: ShoppingBag,
  subscription: Clock,
};

export default function Vouchers() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'redeem' | 'history'>('redeem');
  const [redeemResult, setRedeemResult] = useState<{ success: boolean; message: string; data?: unknown } | null>(null);

  const { data: vouchersData, isLoading } = useQuery({
    queryKey: ['vouchers'],
    queryFn: () => api.get<{ success: boolean; data: Voucher[] }>('/api/vouchers'),
  });

  const vouchers: Voucher[] = vouchersData?.data?.data ?? [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RedeemForm>({
    resolver: zodResolver(redeemSchema),
  });

  const redeemMutation = useMutation({
    mutationFn: (data: RedeemForm) => api.post('/api/vouchers/redeem', data),
    onSuccess: (res) => {
      setRedeemResult({ success: true, message: res.data.message, data: res.data.data });
      reset();
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to redeem voucher';
      setRedeemResult({ success: false, message: msg });
      toast.error(msg);
    },
  });

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-white">Vouchers</h1>
        <p className="text-white/40 text-sm">Redeem voucher codes or view your history</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-6 w-fit">
        {[
          { id: 'redeem', label: 'Redeem Voucher', icon: Scan },
          { id: 'history', label: 'My Vouchers', icon: Ticket },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as never); setRedeemResult(null); }}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-glow-sm'
                : 'text-white/40 hover:text-white'
              }
            `}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'redeem' ? (
          <motion.div
            key="redeem"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* Redemption result */}
            {redeemResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`glass-card p-6 mb-6 text-center border ${
                  redeemResult.success ? 'border-emerald-500/30' : 'border-red-500/30'
                }`}
              >
                {redeemResult.success ? (
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                ) : (
                  <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                )}
                <p className={`font-semibold text-sm ${redeemResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                  {redeemResult.success ? 'Voucher Redeemed!' : 'Redemption Failed'}
                </p>
                <p className="text-white/40 text-sm mt-1">{redeemResult.message}</p>
                <button
                  onClick={() => setRedeemResult(null)}
                  className="btn-ghost text-sm py-2 px-4 mt-4"
                >
                  Redeem Another
                </button>
              </motion.div>
            )}

            {!redeemResult && (
              <div className="glass-card p-6">
                {/* Decorative icon */}
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl
                                  bg-gradient-to-br from-purple-600/30 to-indigo-600/20
                                  border border-purple-500/30 mb-3">
                    <Scan className="w-8 h-8 text-purple-400" />
                  </div>
                  <h2 className="text-white font-semibold text-lg">Enter Voucher Code</h2>
                  <p className="text-white/30 text-sm mt-1">
                    Your voucher will be automatically processed and the service provisioned instantly
                  </p>
                </div>

                <form onSubmit={handleSubmit(data => redeemMutation.mutate(data))} className="space-y-4">
                  <div>
                    <label className="block text-white/60 text-sm mb-1.5 font-medium">Voucher Code</label>
                    <input
                      {...register('code')}
                      type="text"
                      placeholder="VP-XXXX-XXXX-XXXX"
                      className="input-field font-mono text-center text-lg tracking-widest uppercase"
                      onChange={(e) => {
                        e.target.value = e.target.value.toUpperCase();
                      }}
                    />
                    {errors.code && <p className="text-red-400 text-xs mt-1">{errors.code.message}</p>}
                  </div>

                  <div>
                    <label className="block text-white/60 text-sm mb-1.5 font-medium">
                      Cardholder Name <span className="text-white/20">(for virtual cards)</span>
                    </label>
                    <input
                      {...register('cardholder_name')}
                      type="text"
                      placeholder="JOHN DOE"
                      className="input-field uppercase"
                    />
                    {errors.cardholder_name && (
                      <p className="text-red-400 text-xs mt-1">{errors.cardholder_name.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={redeemMutation.isPending}
                    className="btn-brand w-full flex items-center justify-center gap-2 py-3"
                  >
                    {redeemMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Ticket className="w-4 h-4" />
                        Redeem Now
                      </>
                    )}
                  </button>
                </form>

                {/* What you can redeem */}
                <div className="mt-6 pt-6 border-t border-white/5">
                  <p className="text-white/30 text-xs uppercase tracking-wider font-medium mb-3">
                    Supported Voucher Types
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Virtual Cards', icon: CreditCard, color: 'text-blue-400' },
                      { label: 'Gift Cards', icon: Gift, color: 'text-pink-400' },
                      { label: 'Gaming', icon: Gamepad2, color: 'text-purple-400' },
                      { label: 'Streaming', icon: Music, color: 'text-red-400' },
                      { label: 'Shopping', icon: ShoppingBag, color: 'text-amber-400' },
                      { label: 'Subscriptions', icon: Clock, color: 'text-emerald-400' },
                    ].map(item => (
                      <div key={item.label} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/3 border border-white/5">
                        <item.icon className={`w-4 h-4 ${item.color}`} />
                        <span className="text-white/30 text-[10px] text-center">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="glass-card p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl shimmer flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="w-28 h-3 rounded shimmer" />
                      <div className="w-20 h-2.5 rounded shimmer" />
                    </div>
                    <div className="w-16 h-4 rounded shimmer" />
                  </div>
                ))}
              </div>
            ) : vouchers.length > 0 ? (
              <div className="space-y-3">
                {vouchers.map(voucher => (
                  <VoucherRow key={voucher.id} voucher={voucher} />
                ))}
              </div>
            ) : (
              <div className="glass-card p-10 text-center">
                <Ticket className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No vouchers yet</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VoucherRow({ voucher }: { voucher: Voucher }) {
  const Icon = VOUCHER_TYPE_ICONS[voucher.type] ?? Ticket;
  const isExpired = new Date(voucher.expires_at) < new Date();
  const status = isExpired && voucher.status === 'active' ? 'expired' : voucher.status;

  const statusColors: Record<string, string> = {
    active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    redeemed: 'text-white/40 bg-white/5 border-white/10',
    expired: 'text-red-400 bg-red-500/10 border-red-500/20',
    cancelled: 'text-white/30 bg-white/5 border-white/10',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 flex items-center gap-4"
    >
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-white/60" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium">
          {voucher.gift_card_brand ? titleCase(voucher.gift_card_brand) : titleCase(voucher.type)}
        </p>
        <p className="text-white/30 text-xs font-mono">{voucher.code}</p>
        <p className="text-white/20 text-[10px]">
          {voucher.status === 'redeemed'
            ? `Redeemed ${formatDate(voucher.redeemed_at ?? '', 'relative')}`
            : `Expires ${formatDate(voucher.expires_at, 'relative')}`
          }
        </p>
      </div>

      <div className="text-right">
        <p className="text-white font-semibold text-sm">{formatCurrency(voucher.amount, voucher.currency)}</p>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusColors[status] ?? statusColors.expired}`}>
          {titleCase(status)}
        </span>
      </div>
    </motion.div>
  );
}
