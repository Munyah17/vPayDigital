import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Plus, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { formatCurrency, percentChange } from '@vpay/utils';
import type { Wallet } from '@vpay/types';

interface WalletCardProps {
  wallet: Wallet;
  isActive?: boolean;
  onClick?: () => void;
  onTopUp?: () => void;
  onSend?: () => void;
}

// NGN/GHS/ZWL are intentionally excluded — banned currencies per platform
// policy (Zimbabwe is USD-only; no ZWL/ZiG/NGN/GHS anywhere in the product).
const CURRENCY_FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', ZAR: '🇿🇦', KES: '🇰🇪',
};

const CURRENCY_GRADIENTS: Record<string, string> = {
  USD: 'from-emerald-600/20 to-emerald-800/10',
  EUR: 'from-blue-600/20 to-blue-800/10',
  GBP: 'from-purple-600/20 to-purple-800/10',
  ZAR: 'from-green-600/20 to-green-800/10',
  KES: 'from-red-600/20 to-red-800/10',
};

export function WalletCard({ wallet, isActive, onClick, onTopUp, onSend }: WalletCardProps) {
  const gradient = CURRENCY_GRADIENTS[wallet.currency] ?? 'from-white/5 to-white/2';
  const changePercent = percentChange(wallet.total_credited || 0, wallet.balance);

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-2xl p-5 cursor-pointer
        bg-gradient-to-br ${gradient}
        border transition-all duration-300
        ${isActive
          ? 'border-indigo-500/50 shadow-glow-sm bg-foreground/8'
          : 'border-foreground/10 bg-foreground/5 hover:border-foreground/20'
        }
      `}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/3 to-white/0" />

      {/* Content */}
      <div className="relative">
        {/* Top row */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{CURRENCY_FLAGS[wallet.currency] ?? '💱'}</span>
            <div>
              <p className="text-foreground/40 text-xs font-medium">{wallet.currency}</p>
              <p className="text-foreground/20 text-[10px] capitalize">{wallet.wallet_type.replace('_', ' ')}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {changePercent >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            )}
            <span className={`text-xs font-medium ${changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Balance */}
        <div className="mb-4">
          <motion.p
            key={wallet.balance}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold font-display text-foreground"
          >
            {formatCurrency(wallet.balance, wallet.currency)}
          </motion.p>
          {wallet.pending_balance > 0 && (
            <p className="text-foreground/30 text-xs mt-0.5">
              +{formatCurrency(wallet.pending_balance, wallet.currency)} pending
            </p>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1 text-foreground/40">
            <ArrowDownLeft className="w-3 h-3 text-emerald-400" />
            <span>{formatCurrency(wallet.total_credited, wallet.currency)}</span>
          </div>
          <div className="flex items-center gap-1 text-foreground/40">
            <ArrowUpRight className="w-3 h-3 text-red-400" />
            <span>{formatCurrency(wallet.total_debited, wallet.currency)}</span>
          </div>
        </div>

        {/* Quick actions */}
        {(onTopUp || onSend) && (
          <div className="flex gap-2 mt-4">
            {onTopUp && (
              <button
                onClick={(e) => { e.stopPropagation(); onTopUp(); }}
                className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-xl
                           bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30
                           text-indigo-400 hover:text-indigo-300 text-xs font-medium
                           transition-all duration-200"
              >
                <Plus className="w-3.5 h-3.5" />
                Top Up
              </button>
            )}
            {onSend && (
              <button
                onClick={(e) => { e.stopPropagation(); onSend(); }}
                className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-xl
                           bg-foreground/5 hover:bg-foreground/10 border border-foreground/10
                           text-foreground/60 hover:text-foreground text-xs font-medium
                           transition-all duration-200"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Send
              </button>
            )}
          </div>
        )}
      </div>

      {/* Active indicator */}
      {isActive && (
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-indigo-400 shadow-glow-sm" />
      )}
    </motion.div>
  );
}

export function WalletCardSkeleton() {
  return (
    <div className="rounded-2xl p-5 bg-foreground/5 border border-foreground/10">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full shimmer" />
        <div className="w-12 h-3 rounded shimmer" />
      </div>
      <div className="w-32 h-7 rounded shimmer mb-2" />
      <div className="w-20 h-3 rounded shimmer" />
    </div>
  );
}
