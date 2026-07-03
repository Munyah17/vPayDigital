import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Wifi, Shield } from 'lucide-react';
import { formatCurrency, maskCardNumber, formatCardExpiry } from '@vpay/utils';
import { CARD_NETWORK_COLORS } from '@vpay/config';
import { VLogoIcon } from '../ui/VLogoIcon';
import type { Card } from '@vpay/types';

interface VirtualCardProps {
  card: Card;
  showSensitive?: boolean;
  onToggleSensitive?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function VirtualCard({ card, showSensitive = false, onToggleSensitive, size = 'md', className = '' }: VirtualCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const colors = CARD_NETWORK_COLORS[card.network] ?? CARD_NETWORK_COLORS.visa;

  const sizeClasses = {
    sm: 'w-56 h-36',
    md: 'w-72 h-44',
    lg: 'w-96 h-56',
  };

  const fontSizes = {
    sm: { number: 'text-xs',  name: 'text-[10px]', balance: 'text-sm' },
    md: { number: 'text-sm',  name: 'text-xs',      balance: 'text-base' },
    lg: { number: 'text-lg',  name: 'text-sm',      balance: 'text-xl' },
  };

  const chipSizes = {
    sm: 'w-7 h-5',
    md: 'w-9 h-[26px]',
    lg: 'w-12 h-8',
  };

  const handleFlip = () => setIsFlipped(f => !f);

  return (
    <div
      className={`perspective-1000 ${sizeClasses[size]} cursor-pointer ${className}`}
      onClick={handleFlip}
      onMouseEnter={() => size === 'lg' && setIsFlipped(true)}
      onMouseLeave={() => size === 'lg' && setIsFlipped(false)}
    >
      <motion.div
        className="relative w-full h-full preserve-3d"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: [0.43, 0.13, 0.23, 0.96] }}
      >
        {/* ─── Card Front ──────────────────────────────────── */}
        <div className="absolute inset-0 backface-hidden">
          <div
            className={`
              relative w-full h-full rounded-2xl overflow-hidden
              bg-gradient-to-br ${colors.gradient}
              shadow-card border border-white/10
            `}
          >
            {/* Subtle noise texture */}
            <div className="absolute inset-0 bg-noise opacity-10" />
            {/* Holographic shimmer */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/[0.04] to-white/0" />
            {/* Top-right glow orb */}
            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/5 blur-2xl" />

            {/* Card content */}
            <div className="relative h-full px-5 py-4 flex flex-col justify-between">

              {/* Row 1: Logo + Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <VLogoIcon className="w-5" />
                  <p className="font-display font-bold text-white tracking-wide"
                    style={{ fontSize: size === 'sm' ? '11px' : size === 'lg' ? '15px' : '13px' }}>
                    ePayZW
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusPill status={card.status} />
                  <p className="text-white/60 font-semibold tracking-[0.12em] uppercase"
                    style={{ fontSize: '9px' }}>
                    Virtual
                  </p>
                </div>
              </div>

              {/* Row 2: Chip + NFC */}
              <div className="flex items-center gap-2.5">
                <div className={`${chipSizes[size]} rounded-md overflow-hidden shadow-sm relative`}
                  style={{ background: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 40%, #d97706 100%)' }}>
                  {/* Chip grid */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-[1.5px] p-[3px]">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="bg-amber-700/35 rounded-[1px]" />
                    ))}
                  </div>
                  {/* Chip lines */}
                  <div className="absolute inset-y-0 left-1/3 w-px bg-amber-600/40" />
                  <div className="absolute inset-y-0 right-1/3 w-px bg-amber-600/40" />
                  <div className="absolute inset-x-0 top-1/3 h-px bg-amber-600/40" />
                  <div className="absolute inset-x-0 bottom-1/3 h-px bg-amber-600/40" />
                </div>
                <Wifi className="text-white/40 rotate-90"
                  style={{ width: size === 'sm' ? 12 : size === 'lg' ? 18 : 14, height: size === 'sm' ? 12 : size === 'lg' ? 18 : 14 }} />
              </div>

              {/* Row 3: Card Number */}
              <p className={`card-number text-white/90 ${fontSizes[size].number} tracking-[0.22em]`}>
                {maskCardNumber(card.last_four ?? '****', card.network)}
              </p>

              {/* Row 4: Name + Expiry + Network */}
              <div className="flex items-end justify-between gap-2">
                <p className={`text-white font-semibold uppercase tracking-wider flex-1 truncate ${fontSizes[size].name}`}>
                  {card.cardholder_name}
                </p>
                <p className={`text-white/80 font-medium tabular-nums flex-shrink-0 ${fontSizes[size].name}`}>
                  {formatCardExpiry(card.expiry_month, card.expiry_year)}
                </p>
                <div className="flex-shrink-0">
                  <NetworkLogo network={card.network} size={size} />
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ─── Card Back ───────────────────────────────────── */}
        <div className="absolute inset-0 backface-hidden rotate-y-180">
          <div
            className={`
              relative w-full h-full rounded-2xl overflow-hidden
              bg-gradient-to-br from-gray-900 to-gray-800
              shadow-card border border-white/10
            `}
          >
            {/* Magnetic stripe */}
            <div className="absolute top-6 left-0 right-0 h-8 bg-black/80" />

            {/* CVV area */}
            <div className="absolute top-16 right-0 left-0 px-4">
              <div className="bg-white/10 rounded-lg p-2 flex items-center justify-between">
                <div className="h-5 flex-1 bg-white/5 rounded" />
                <div className="ml-3 text-right">
                  <p className="text-white/40 text-[9px] uppercase tracking-wider">CVV</p>
                  <p className="text-white font-mono font-bold text-sm">
                    {showSensitive ? '***' : '···'}
                  </p>
                </div>
              </div>
            </div>

            {/* Balance */}
            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-white/40 text-[9px] uppercase tracking-wider">Available Balance</p>
                  <p className={`text-white font-semibold ${fontSizes[size].balance}`}>
                    {formatCurrency(card.current_balance, card.currency)}
                  </p>
                </div>
                {onToggleSensitive && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleSensitive(); }}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    {showSensitive ? (
                      <EyeOff className="w-3 h-3 text-white/60" />
                    ) : (
                      <Eye className="w-3 h-3 text-white/60" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Security note */}
            <div className="absolute bottom-0 right-0 p-3">
              <Shield className="w-4 h-4 text-white/10" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tap hint */}
      <AnimatePresence>
        {!isFlipped && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="text-center text-foreground/20 text-[10px] mt-2"
          >
            Tap to flip
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function NetworkLogo({ network, size }: { network: string; size: 'sm' | 'md' | 'lg' }) {
  const circleSize = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-7 h-7' };
  const overlap    = { sm: '-ml-1.5', md: '-ml-2', lg: '-ml-2.5' };

  if (network === 'visa') {
    return (
      <p className="text-white font-extrabold italic tracking-wider"
        style={{ fontSize: size === 'sm' ? 11 : size === 'lg' ? 16 : 13 }}>
        VISA
      </p>
    );
  }
  if (network === 'mastercard') {
    return (
      <div className="flex items-center">
        <div className={`${circleSize[size]} rounded-full bg-[#EB001B]`} />
        <div className={`${circleSize[size]} rounded-full bg-[#F79E1B] ${overlap[size]} opacity-95`} />
      </div>
    );
  }
  return (
    <p className="text-white text-xs font-bold">
      {network.toUpperCase()}
    </p>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active:     'bg-emerald-400',
    frozen:     'bg-blue-400',
    terminated: 'bg-red-400',
    expired:    'bg-gray-400',
    exhausted:  'bg-orange-400',
    pending:    'bg-amber-400',
  };
  return <div className={`w-1.5 h-1.5 rounded-full ${colors[status] ?? 'bg-gray-400'}`} />;
}

// ─── Card Skeleton ────────────────────────────────────────────────────────────

export function VirtualCardSkeleton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'w-56 h-36', md: 'w-72 h-44', lg: 'w-96 h-56' };
  return (
    <div className={`${sizeClasses[size]} rounded-2xl shimmer bg-foreground/5`} />
  );
}
