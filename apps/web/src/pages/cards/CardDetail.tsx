import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Snowflake, Sun, Trash2, ArrowLeft, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { api } from '../../lib/axios';
import { VirtualCard, VirtualCardSkeleton } from '../../components/cards/VirtualCard';
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

  const freeze = useMutation({
    mutationFn: () => api.post(`/api/cards/${id}/freeze`),
    onSuccess: () => { toast.success('Card frozen'); qc.invalidateQueries({ queryKey: ['card', id] }); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed'),
  });
  const unfreeze = useMutation({
    mutationFn: () => api.post(`/api/cards/${id}/unfreeze`),
    onSuccess: () => { toast.success('Card unfrozen'); qc.invalidateQueries({ queryKey: ['card', id] }); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed'),
  });
  const terminate = useMutation({
    mutationFn: () => api.post(`/api/cards/${id}/terminate`),
    onSuccess: () => { toast.success('Card terminated'); navigate('/cards'); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed'),
  });

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/40 hover:text-white text-sm">
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
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Available balance</p>
              <p className="font-display font-bold text-white text-3xl">{formatCurrency(card.current_balance, card.currency)}</p>
              <p className="text-white/30 text-xs mt-1">of {formatCurrency(card.initial_balance, card.currency)} loaded · {formatCurrency(card.total_spent ?? 0, card.currency)} spent</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <DetailItem label="Type" value={titleCase(card.card_type)} />
              <DetailItem label="Network" value={card.network.toUpperCase()} />
              <DetailItem label="Status" value={titleCase(card.status)} />
              <DetailItem label="Currency" value={card.currency} />
            </div>
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
        <h2 className="font-display font-semibold text-white text-lg mb-3">Transactions</h2>
        <div className="glass-card overflow-hidden">
          {txns.length === 0 ? (
            <div className="p-8 text-center text-white/30 text-sm">No transactions yet</div>
          ) : (
            <ul className="divide-y divide-white/5">
              {txns.map((t) => (
                <li key={t.id} className="flex items-center gap-3 p-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${t.type === 'refund' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {t.type === 'refund' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{t.merchant_name ?? titleCase(t.type)}</p>
                    <p className="text-white/40 text-xs">{formatRelativeTime(new Date(t.created_at))}</p>
                  </div>
                  <p className={`text-sm font-semibold tabular-nums ${t.type === 'refund' ? 'text-emerald-400' : 'text-white'}`}>
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
      <p className="text-white/30 text-[10px] uppercase tracking-wider">{label}</p>
      <p className="text-white text-sm font-medium">{value}</p>
    </div>
  );
}
