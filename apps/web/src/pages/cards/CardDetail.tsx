import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Snowflake, Sun, Trash2, ArrowLeft, ArrowUpRight, ArrowDownLeft, Eye, EyeOff, Copy } from 'lucide-react';
import { api } from '../../lib/axios';
import { VirtualCard, VirtualCardSkeleton } from '../../components/cards/VirtualCard';
import { useWalletStore } from '../../stores/walletStore';
import { formatCurrency, formatRelativeTime, titleCase } from '@vpay/utils';
import type { Card, CardTransaction } from '@vpay/types';
import toast from 'react-hot-toast';

export default function CardDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showSensitive, setShowSensitive] = useState(false);

  const { data: cardRes, isLoading } = useQuery({
    queryKey: ['card', id],
    queryFn: () => api.get<{ success: boolean; data: Card }>(`/api/cards/${id}`),
    enabled: !!id,
  });

  const { data: txRes } = useQuery({
    queryKey: ['card-transactions', id, 'local'],
    queryFn: () => api.get<{ success: boolean; data: CardTransaction[] }>(`/api/cards/${id}/transactions/local`),
    enabled: !!id,
  });

  const card = cardRes?.data?.data;
  const txns = txRes?.data?.data ?? [];

  // Full card details are fetched only when the user explicitly asks —
  // never automatically — and dropped from the cache on hide.
  const [detailsVisible, setDetailsVisible] = useState(false);
  const reveal = useQuery({
    queryKey: ['card-reveal', id],
    queryFn: () => api.get<{ success: boolean; data: { has_details: boolean; pan?: string; pin?: string; expiry_month?: number; expiry_year?: number } }>(`/api/cards/${id}/reveal`),
    enabled: !!id && detailsVisible,
    staleTime: 0,
    gcTime: 0,
  });
  const revealData = reveal.data?.data?.data;
  const formatPan = (pan: string) => pan.replace(/(\d{4})(?=\d)/g, '$1 ');
  const copyText = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  const freeze = useMutation({
    mutationFn: () => api.post(`/api/cards/${id}/freeze`),
    onSuccess: () => { toast.success('Card frozen'); qc.invalidateQueries({ queryKey: ['card', id] }); useWalletStore.getState().fetchCards(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });
  const unfreeze = useMutation({
    mutationFn: () => api.post(`/api/cards/${id}/unfreeze`),
    onSuccess: () => { toast.success('Card unfrozen'); qc.invalidateQueries({ queryKey: ['card', id] }); useWalletStore.getState().fetchCards(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });
  const terminate = useMutation({
    mutationFn: () => api.post(`/api/cards/${id}/terminate`),
    onSuccess: () => { toast.success('Card terminated'); useWalletStore.getState().fetchCards(); navigate('/cards'); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-foreground/40 hover:text-foreground text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {isLoading || !card ? (
        <VirtualCardSkeleton size="lg" />
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <VirtualCard card={card} size="lg" showSensitive={showSensitive} onToggleSensitive={() => setShowSensitive(s => !s)} />
          </motion.div>
          <div className="glass-card p-6 flex-1 space-y-4">
            <div>
              <p className="text-foreground/40 text-xs uppercase tracking-wider mb-1">Available balance</p>
              <p className="font-display font-bold text-foreground text-3xl">{formatCurrency(card.current_balance, card.currency)}</p>
              <p className="text-foreground/30 text-xs mt-1">of {formatCurrency(card.initial_balance, card.currency)} loaded · {formatCurrency(card.total_spent ?? 0, card.currency)} spent</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <DetailItem label="Type" value={titleCase(card.card_type)} />
              <DetailItem label="Network" value={card.network.toUpperCase()} />
              <DetailItem label="Status" value={titleCase(card.status)} />
              <DetailItem label="Currency" value={card.currency} />
            </div>
            {/* Full card details — VitalPay delivers these for display on
                the cardholder's own dashboard */}
            {['active', 'frozen'].includes(card.status) && (
              <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-foreground/40 text-xs uppercase tracking-wider">Card details</p>
                  <button
                    onClick={() => setDetailsVisible(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300"
                  >
                    {detailsVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {detailsVisible ? 'Hide' : 'Show details'}
                  </button>
                </div>
                {detailsVisible && (
                  reveal.isLoading ? (
                    <p className="text-foreground/30 text-sm">Loading…</p>
                  ) : revealData?.has_details && revealData.pan ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-foreground font-mono text-sm tracking-wider">{formatPan(revealData.pan)}</p>
                        <button onClick={() => copyText('Card number', revealData.pan!)} className="p-1.5 rounded-lg hover:bg-foreground/10">
                          <Copy className="w-3.5 h-3.5 text-foreground/40" />
                        </button>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-foreground/40">Expiry <span className="text-foreground font-medium">{String(revealData.expiry_month).padStart(2, '0')}/{String(revealData.expiry_year).slice(-2)}</span></span>
                        {revealData.pin && (
                          <span className="text-foreground/40 flex items-center gap-1.5">
                            PIN <span className="text-foreground font-mono font-medium">{revealData.pin}</span>
                            <button onClick={() => copyText('PIN', revealData.pin!)} className="p-1 rounded hover:bg-foreground/10">
                              <Copy className="w-3 h-3 text-foreground/40" />
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-foreground/40 text-xs leading-relaxed">
                      Full details aren't available for this card — it was issued before
                      detail capture shipped. Newly issued cards show their full number here.
                    </p>
                  )
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {card.status === 'active' && (
                <button onClick={() => freeze.mutate()} disabled={freeze.isPending} className="btn-ghost flex-1 flex items-center justify-center gap-2 py-2 text-sm">
                  <Snowflake className="w-4 h-4" /> Freeze
                </button>
              )}
              {card.status === 'frozen' && (
                <button onClick={() => unfreeze.mutate()} disabled={unfreeze.isPending} className="btn-ghost flex-1 flex items-center justify-center gap-2 py-2 text-sm">
                  <Sun className="w-4 h-4" /> Unfreeze
                </button>
              )}
              {['active', 'frozen'].includes(card.status) && (
                <button
                  onClick={() => { if (confirm('Terminate this card? This cannot be undone.')) terminate.mutate(); }}
                  disabled={terminate.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400"
                >
                  <Trash2 className="w-4 h-4" /> Terminate
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <section>
        <h2 className="font-display font-semibold text-foreground text-lg mb-3">Transactions</h2>
        <div className="glass-card overflow-hidden">
          {txns.length === 0 ? (
            <div className="p-8 text-center text-foreground/30 text-sm">No transactions yet</div>
          ) : (
            <ul className="divide-y divide-foreground/5">
              {txns.map((t) => (
                <li key={t.id} className="flex items-center gap-3 p-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${t.type === 'refund' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {t.type === 'refund' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-sm font-medium truncate">{t.merchant_name ?? titleCase(t.type)}</p>
                    <p className="text-foreground/40 text-xs">{formatRelativeTime(new Date(t.created_at))}</p>
                  </div>
                  <p className={`text-sm font-semibold tabular-nums ${t.type === 'refund' ? 'text-emerald-400' : 'text-foreground'}`}>
                    {t.type === 'refund' ? '+' : '−'}{formatCurrency(t.amount, t.currency)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-foreground/30 text-[10px] uppercase tracking-wider">{label}</p>
      <p className="text-foreground text-sm font-medium">{value}</p>
    </div>
  );
}
