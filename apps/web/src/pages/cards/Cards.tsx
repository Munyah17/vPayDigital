import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard, Plus, Snowflake, Trash2, Eye, EyeOff,
  RefreshCw, ArrowUpRight
} from 'lucide-react';
import { VirtualCard, VirtualCardSkeleton } from '../../components/cards/VirtualCard';
import { api } from '../../lib/axios';
import { formatCurrency, formatDate, titleCase } from '@vpay/utils';
import type { Card, CardTransaction } from '@vpay/types';
import toast from 'react-hot-toast';

export default function Cards() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showSensitive, setShowSensitive] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data: cardsData, isLoading } = useQuery({
    queryKey: ['cards'],
    queryFn: () => api.get<{ success: boolean; data: Card[] }>('/api/cards'),
  });

  const { data: txData } = useQuery({
    queryKey: ['card-transactions', selectedCard?.id],
    queryFn: () => selectedCard
      ? api.get<{ success: boolean; data: CardTransaction[] }>(`/api/cards/${selectedCard.id}/transactions/local`)
      : null,
    enabled: !!selectedCard,
  });

  const freezeMutation = useMutation({
    mutationFn: (cardId: string) => api.post(`/api/cards/${cardId}/freeze`),
    onSuccess: () => { toast.success('Card frozen'); queryClient.invalidateQueries({ queryKey: ['cards'] }); },
    onError: () => toast.error('Failed to freeze card'),
  });

  const unfreezeMutation = useMutation({
    mutationFn: (cardId: string) => api.post(`/api/cards/${cardId}/unfreeze`),
    onSuccess: () => { toast.success('Card unfrozen'); queryClient.invalidateQueries({ queryKey: ['cards'] }); },
    onError: () => toast.error('Failed to unfreeze card'),
  });

  const terminateMutation = useMutation({
    mutationFn: (cardId: string) => api.post(`/api/cards/${cardId}/terminate`),
    onSuccess: () => {
      toast.success('Card terminated');
      setSelectedCard(null);
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
    onError: () => toast.error('Failed to terminate card'),
  });

  const cards: Card[] = cardsData?.data?.data ?? [];
  const filteredCards = filterStatus === 'all'
    ? cards
    : cards.filter(c => c.status === filterStatus);

  const transactions: CardTransaction[] = txData?.data?.data ?? [];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">My Cards</h1>
          <p className="text-white/40 text-sm">{cards.length} virtual {cards.length === 1 ? 'card' : 'cards'}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/cards/new')}
          className="btn-brand flex items-center gap-2 py-2.5 px-4 text-sm"
        >
          <Plus className="w-4 h-4" />
          New Card
        </motion.button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {['all', 'active', 'frozen', 'exhausted', 'terminated'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`
              px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all
              ${filterStatus === status
                ? 'bg-indigo-600 text-white shadow-glow-sm'
                : 'bg-white/5 text-white/40 hover:text-white border border-white/10'
              }
            `}
          >
            {titleCase(status)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Grid */}
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="glass-card p-4">
                  <VirtualCardSkeleton size="md" />
                  <div className="mt-4 space-y-2">
                    <div className="w-20 h-3 rounded shimmer" />
                    <div className="w-32 h-5 rounded shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCards.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredCards.map(card => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2 }}
                  onClick={() => setSelectedCard(card)}
                  className={`
                    glass-card p-4 cursor-pointer transition-all duration-200
                    ${selectedCard?.id === card.id ? 'border-indigo-500/50 shadow-glow-sm' : 'hover:border-white/20'}
                  `}
                >
                  <VirtualCard card={card} size="md" />

                  {/* Card info */}
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-white/40 text-xs capitalize">{titleCase(card.card_type)}</p>
                      <p className="text-white font-semibold text-sm">
                        {formatCurrency(card.current_balance, card.currency)}
                      </p>
                    </div>
                    <StatusChip status={card.status} />
                  </div>

                  {/* Quick actions */}
                  {card.status === 'active' && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); freezeMutation.mutate(card.id); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg
                                   bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20
                                   text-blue-400 text-xs transition-all"
                      >
                        <Snowflake className="w-3.5 h-3.5" />
                        Freeze
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/cards/${card.id}/transactions`); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg
                                   bg-white/5 hover:bg-white/10 border border-white/10
                                   text-white/60 text-xs transition-all"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        History
                      </button>
                    </div>
                  )}
                  {card.status === 'frozen' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); unfreezeMutation.mutate(card.id); }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 mt-3 rounded-lg
                                 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20
                                 text-emerald-400 text-xs transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Unfreeze Card
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <CreditCard className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <p className="text-white/40 text-sm mb-2">No {filterStatus === 'all' ? '' : filterStatus} cards</p>
              <button onClick={() => navigate('/cards/new')} className="btn-brand text-sm py-2 px-4">
                <Plus className="w-4 h-4 mr-1.5" />
                Issue Card
              </button>
            </div>
          )}
        </div>

        {/* Card Detail Panel */}
        <div>
          <AnimatePresence mode="wait">
            {selectedCard ? (
              <motion.div
                key={selectedCard.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass-card p-5 space-y-5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold text-sm">Card Details</h3>
                  <button onClick={() => setShowSensitive(s => !s)}
                    className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                    {showSensitive ? <EyeOff className="w-4 h-4 text-white/40" /> : <Eye className="w-4 h-4 text-white/40" />}
                  </button>
                </div>

                <VirtualCard card={selectedCard} size="sm" showSensitive={showSensitive}
                  onToggleSensitive={() => setShowSensitive(s => !s)} />

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <StatBox label="Balance" value={formatCurrency(selectedCard.current_balance, selectedCard.currency)} />
                  <StatBox label="Spent" value={formatCurrency(selectedCard.total_spent, selectedCard.currency)} />
                  <StatBox label="Type" value={titleCase(selectedCard.card_type)} />
                  <StatBox label="Network" value={selectedCard.network.toUpperCase()} />
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  {selectedCard.status === 'active' && (
                    <>
                      <button
                        onClick={() => freezeMutation.mutate(selectedCard.id)}
                        disabled={freezeMutation.isPending}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                                   bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20
                                   text-blue-400 text-sm font-medium transition-all"
                      >
                        <Snowflake className="w-4 h-4" />
                        Freeze Card
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Terminate this card? This cannot be undone.')) {
                            terminateMutation.mutate(selectedCard.id);
                          }
                        }}
                        disabled={terminateMutation.isPending}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                                   bg-red-500/10 hover:bg-red-500/20 border border-red-500/20
                                   text-red-400 text-sm font-medium transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                        Terminate Card
                      </button>
                    </>
                  )}
                  {selectedCard.status === 'frozen' && (
                    <button
                      onClick={() => unfreezeMutation.mutate(selectedCard.id)}
                      disabled={unfreezeMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                                 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20
                                 text-emerald-400 text-sm font-medium transition-all"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Unfreeze Card
                    </button>
                  )}
                </div>

                {/* Recent transactions */}
                {transactions.length > 0 && (
                  <div>
                    <p className="text-white/40 text-xs font-medium mb-2 uppercase tracking-wider">Recent Activity</p>
                    <div className="space-y-2">
                      {transactions.slice(0, 4).map(tx => (
                        <div key={tx.id} className="flex items-center justify-between py-1">
                          <div>
                            <p className="text-white text-xs truncate max-w-[120px]">{tx.merchant_name ?? titleCase(tx.type)}</p>
                            <p className="text-white/30 text-[10px]">{formatDate(tx.created_at, 'relative')}</p>
                          </div>
                          <p className={`text-xs font-semibold ${tx.type === 'refund' ? 'text-emerald-400' : 'text-white/70'}`}>
                            {tx.type === 'refund' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-8 text-center"
              >
                <CreditCard className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">Select a card to view details</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const config: Record<string, { cls: string; label: string }> = {
    active: { cls: 'badge-active', label: 'Active' },
    frozen: { cls: 'badge-frozen', label: 'Frozen' },
    pending: { cls: 'badge-pending', label: 'Pending' },
    terminated: { cls: 'badge-inactive', label: 'Terminated' },
    expired: { cls: 'badge-inactive', label: 'Expired' },
    exhausted: { cls: 'badge-inactive', label: 'Exhausted' },
  };
  const c = config[status] ?? { cls: 'badge-inactive', label: status };
  return <span className={c.cls}>{c.label}</span>;
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/3 rounded-xl p-3 border border-white/5">
      <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-white text-sm font-semibold">{value}</p>
    </div>
  );
}
