import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CreditCard, Ticket, ArrowUpRight, ArrowDownLeft, Plus,
  Zap, Eye, EyeOff, ChevronRight, Sparkles
} from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { VirtualCard, VirtualCardSkeleton } from '../../components/cards/VirtualCard';
import { WalletCard, WalletCardSkeleton } from '../../components/wallet/WalletCard';
import { useAuthStore } from '../../stores/authStore';
import { useWalletStore } from '../../stores/walletStore';
import { api } from '../../lib/axios';
import { formatCurrency, formatDate, titleCase } from '@vpay/utils';
import type { WalletTransaction } from '@vpay/types';

const CONSUMER_ACTIONS = [
  { label: 'Request Card', icon: CreditCard, color: 'from-indigo-600/30 to-indigo-800/20', to: '/cards/request', description: 'Request a card' },
  { label: 'Redeem', icon: Ticket, color: 'from-purple-600/30 to-purple-800/20', to: '/vouchers/redeem', description: 'Use a voucher' },
  { label: 'Send', icon: ArrowUpRight, color: 'from-pink-600/30 to-pink-800/20', to: '/wallet?action=send', description: 'Transfer funds' },
  { label: 'Top Up', icon: Plus, color: 'from-emerald-600/30 to-emerald-800/20', to: '/wallet?action=topup', description: 'Add money' },
];

const AGENT_ACTIONS = [
  { label: 'Issue Card', icon: CreditCard, color: 'from-indigo-600/30 to-indigo-800/20', to: '/cards/new', description: 'Issue virtual card' },
  { label: 'Issue Voucher', icon: Ticket, color: 'from-purple-600/30 to-purple-800/20', to: '/agent/issue', description: 'Create voucher' },
  { label: 'Send', icon: ArrowUpRight, color: 'from-pink-600/30 to-pink-800/20', to: '/wallet?action=send', description: 'Transfer funds' },
  { label: 'Float', icon: Plus, color: 'from-emerald-600/30 to-emerald-800/20', to: '/agent/float', description: 'Manage float' },
];

const staggerParent = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const staggerChild = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
};

export default function Dashboard() {
  const { profile } = useAuthStore();
  const { wallets, cards, isLoading: storeLoading } = useWalletStore();
  const navigate = useNavigate();
  const [showBalance, setShowBalance] = useState(true);

  const isAgent = ['agent', 'super_admin', 'staff'].includes(profile?.role ?? '');
  const quickActions = isAgent ? AGENT_ACTIONS : CONSUMER_ACTIONS;

  const activeWallet = wallets.find(w => w.currency === (profile?.preferred_currency ?? 'USD')) ?? wallets[0];
  const activeCard = cards.find(c => c.status === 'active');

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['recent-transactions', activeWallet?.id],
    queryFn: () => activeWallet
      ? api.get(`/api/wallets/${activeWallet.id}/transactions?limit=5`)
      : null,
    enabled: !!activeWallet,
  });

  const { data: ratesData } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => api.get('/api/wallets/exchange-rates'),
    staleTime: 60_000,
  });

  const transactions: WalletTransaction[] = txData?.data?.data ?? [];
  // "Total Portfolio Value" previously only summed USD wallets, silently
  // hiding EUR/GBP/ZAR/KES balances under a label implying the full total.
  // Convert every wallet to USD using live rates; a wallet whose currency
  // has no rate on record just falls back to its raw balance rather than
  // being dropped, so it's never invisible even if the conversion is off.
  const rates: Array<{ from_currency: string; to_currency: string; rate: number }> = ratesData?.data?.data ?? [];
  const totalBalance = wallets.reduce((sum, w) => {
    if (w.currency === 'USD') return sum + w.balance;
    const rate = rates.find(r => r.from_currency === w.currency && r.to_currency === 'USD')?.rate;
    return sum + w.balance * (rate ?? 1);
  }, 0);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <p className="text-foreground/40 text-sm">{greeting()},</p>
          <h1 className="font-display font-bold text-2xl text-foreground">
            {profile?.display_name ?? profile?.full_name?.split(' ')[0] ?? 'User'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {profile?.kyc_status !== 'approved' && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/profile/kyc')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                         bg-amber-500/10 border border-amber-500/30
                         text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-all"
            >
              <Sparkles className="w-3 h-3" />
              Verify KYC
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Balance Overview */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-card p-6 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 via-purple-600/5 to-transparent" />
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-indigo-600/5 blur-3xl" />

        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <p className="text-foreground/40 text-sm font-medium">Total Portfolio Value</p>
            <button onClick={() => setShowBalance(s => !s)} className="p-1.5 rounded-lg hover:bg-foreground/5 transition-colors">
              {showBalance ? <EyeOff className="w-4 h-4 text-foreground/30" /> : <Eye className="w-4 h-4 text-foreground/30" />}
            </button>
          </div>

          <motion.div
            key={showBalance ? 'shown' : 'hidden'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {showBalance ? (
              <p className="font-display font-bold text-4xl text-foreground">
                {storeLoading ? (
                  <span className="inline-block w-40 h-9 rounded-lg shimmer" />
                ) : (
                  formatCurrency(totalBalance, 'USD')
                )}
              </p>
            ) : (
              <p className="font-display font-bold text-4xl text-foreground">••••••</p>
            )}
          </motion.div>

          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-foreground/40 text-xs">{wallets.length} active {wallets.length === 1 ? 'wallet' : 'wallets'}</span>
            </div>
            {cards.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-400" />
                <span className="text-foreground/40 text-xs">{cards.filter(c => c.status === 'active').length} active {cards.filter(c => c.status === 'active').length === 1 ? 'card' : 'cards'}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        variants={staggerParent}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {quickActions.map(action => (
          <motion.button
            key={action.label}
            variants={staggerChild}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate(action.to)}
            className={`
              flex flex-col items-center gap-2 p-3 rounded-2xl
              bg-gradient-to-br ${action.color}
              border border-foreground/10 hover:border-foreground/20
              transition-all duration-200
            `}
          >
            <div className="w-10 h-10 rounded-xl bg-foreground/10 flex items-center justify-center">
              <action.icon className="w-5 h-5 text-foreground" />
            </div>
            <div className="text-center">
              <p className="text-foreground text-xs font-semibold">{action.label}</p>
              <p className="text-foreground/30 text-[10px]">{action.description}</p>
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* Wallets & Card side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wallets */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-foreground font-semibold text-sm">My Wallets</h2>
            <button onClick={() => navigate('/wallet')} className="text-indigo-400 text-xs hover:text-indigo-300 flex items-center gap-0.5">
              All wallets <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {storeLoading ? (
              Array.from({ length: 2 }).map((_, i) => <WalletCardSkeleton key={i} />)
            ) : wallets.length > 0 ? (
              wallets.slice(0, 2).map(wallet => (
                <WalletCard
                  key={wallet.id}
                  wallet={wallet}
                  isActive={wallet.id === activeWallet?.id}
                  onTopUp={() => navigate('/wallet?action=topup')}
                  onSend={() => navigate('/wallet?action=send')}
                />
              ))
            ) : (
              <EmptyState message="No wallets yet" action="Activate wallet" onAction={() => {}} />
            )}
          </div>
        </div>

        {/* Featured Card */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-foreground font-semibold text-sm">Active Card</h2>
            <button onClick={() => navigate('/cards')} className="text-indigo-400 text-xs hover:text-indigo-300 flex items-center gap-0.5">
              All cards <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex flex-col items-center justify-center min-h-[200px]">
            {storeLoading ? (
              <VirtualCardSkeleton size="lg" />
            ) : activeCard ? (
              <VirtualCard card={activeCard} size="lg" />
            ) : (
              <div className="glass-card p-8 text-center w-full">
                <CreditCard className="w-12 h-12 text-foreground/20 mx-auto mb-3" />
                <p className="text-foreground/40 text-sm mb-4">No active cards</p>
                <button onClick={() => navigate('/cards/new')} className="btn-brand inline-flex items-center gap-1.5 text-sm py-2 px-5">
                  <Plus className="w-4 h-4" />
                  Issue Card
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-foreground font-semibold text-sm">Recent Transactions</h2>
          <button onClick={() => navigate('/transactions')} className="text-indigo-400 text-xs hover:text-indigo-300 flex items-center gap-0.5">
            View all <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="glass-card divide-y divide-foreground/5">
          {txLoading ? (
            Array.from({ length: 4 }).map((_, i) => <TransactionSkeleton key={i} />)
          ) : transactions.length > 0 ? (
            transactions.map(txn => <TransactionRow key={txn.id} txn={txn} />)
          ) : (
            <div className="p-8 text-center">
              <p className="text-foreground/20 text-sm">No transactions yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TransactionRow({ txn }: { txn: WalletTransaction }) {
  const isCredit = txn.direction === 'credit';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-4 p-4 hover:bg-foreground/3 transition-colors"
    >
      <div className={`
        w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
        ${isCredit ? 'bg-emerald-500/15' : 'bg-red-500/15'}
      `}>
        {isCredit
          ? <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
          : <ArrowUpRight className="w-5 h-5 text-red-400" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-foreground text-sm font-medium truncate">{txn.description ?? titleCase(txn.type)}</p>
        <p className="text-foreground/30 text-xs">{formatDate(txn.created_at, 'relative')}</p>
      </div>

      <div className="text-right">
        <p className={`font-semibold text-sm ${isCredit ? 'text-emerald-400' : 'text-foreground'}`}>
          {isCredit ? '+' : '-'}{formatCurrency(txn.amount, txn.currency)}
        </p>
        <StatusBadge status={txn.status} />
      </div>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    completed: 'badge-active',
    pending: 'badge-pending',
    processing: 'badge-pending',
    failed: 'badge-failed',
    reversed: 'badge-inactive',
  };
  return <span className={`${classes[status] ?? 'badge-inactive'}`}>{status}</span>;
}

function TransactionSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4">
      <div className="w-10 h-10 rounded-xl shimmer flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="w-32 h-3 rounded shimmer" />
        <div className="w-20 h-2.5 rounded shimmer" />
      </div>
      <div className="w-20 h-4 rounded shimmer" />
    </div>
  );
}

function EmptyState({ message, action, onAction }: { message: string; action: string; onAction: () => void }) {
  return (
    <div className="glass-card p-8 text-center">
      <Zap className="w-10 h-10 text-foreground/10 mx-auto mb-3" />
      <p className="text-foreground/30 text-sm mb-4">{message}</p>
      <button onClick={onAction} className="btn-ghost text-sm py-2 px-4">{action}</button>
    </div>
  );
}
