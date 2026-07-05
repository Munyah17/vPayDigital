// =============================================================================
// vPay Shared Configuration
// =============================================================================

export const APP_CONFIG = {
  name: 'ePay Smart',
  tagline: 'Your Virtual Payments, Redefined',
  version: '1.0.0',
  supportEmail: 'support@epaysmart.live',
  websiteUrl: 'https://epaysmart.live',
} as const;

export const CARD_CONFIG = {
  networks: ['visa', 'mastercard'] as const,
  defaultCurrency: 'USD',
  minLoadAmountUsd: 5,
  maxLoadAmountUsd: 10_000,
  defaultExpiryMonths: 24,
  maxCardsPerUser: 10,
} as const;

export const VOUCHER_CONFIG = {
  defaultExpiryDays: 30,
  codePrefix: 'VP',
  maxBatchSize: 500,
} as const;

export const FEE_CONFIG = {
  cardIssuanceFlat: 0.5,
  cardIssuancePercent: 0.015,
  fxSpread: 0.015,
  payoutFlat: 1.0,
  payoutPercent: 0.01,
} as const;

export const BANKING_CONFIG = {
  // No EU BaaS/EMI provider is contracted yet — flip this on once one is signed.
  // Backend endpoints work regardless; this only gates frontend visibility.
  ibanEnabled: false,
} as const;

export const FRAUD_CONFIG = {
  autoSuspendScore: 80,
  reviewScore: 60,
  maxFailedTransactions24h: 5,
  maxCardsPerHour: 3,
} as const;

export const CURRENCIES: Array<{ code: string; name: string; symbol: string; flag: string }> = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', flag: '🇰🇪' },
];

export const GIFT_CARD_BRANDS = [
  { id: 'netflix', name: 'Netflix', color: '#E50914', logo: '/brands/netflix.svg', category: 'streaming' },
  { id: 'spotify', name: 'Spotify', color: '#1DB954', logo: '/brands/spotify.svg', category: 'streaming' },
  { id: 'amazon', name: 'Amazon', color: '#FF9900', logo: '/brands/amazon.svg', category: 'ecommerce' },
  { id: 'apple', name: 'Apple', color: '#000000', logo: '/brands/apple.svg', category: 'general' },
  { id: 'google_play', name: 'Google Play', color: '#01875F', logo: '/brands/google-play.svg', category: 'gaming' },
  { id: 'steam', name: 'Steam', color: '#1B2838', logo: '/brands/steam.svg', category: 'gaming' },
  { id: 'playstation', name: 'PlayStation', color: '#003087', logo: '/brands/playstation.svg', category: 'gaming' },
  { id: 'xbox', name: 'Xbox', color: '#107C10', logo: '/brands/xbox.svg', category: 'gaming' },
  { id: 'binance', name: 'Binance', color: '#F3BA2F', logo: '/brands/binance.svg', category: 'crypto' },
  { id: 'airbnb', name: 'Airbnb', color: '#FF5A5F', logo: '/brands/airbnb.svg', category: 'travel' },
  { id: 'uber', name: 'Uber', color: '#000000', logo: '/brands/uber.svg', category: 'travel' },
  { id: 'ebay', name: 'eBay', color: '#E53238', logo: '/brands/ebay.svg', category: 'ecommerce' },
] as const;

export const CARD_NETWORK_COLORS: Record<string, { primary: string; secondary: string; gradient: string }> = {
  visa: {
    primary: '#7c3aed',
    secondary: '#9333ea',
    gradient: 'from-[#6d28d9] via-[#7c3aed] to-[#9333ea]',
  },
  mastercard: {
    primary: '#7c3aed',
    secondary: '#9333ea',
    gradient: 'from-[#6d28d9] via-[#7c3aed] to-[#9333ea]',
  },
  amex: {
    primary: '#5b21b6',
    secondary: '#7c3aed',
    gradient: 'from-[#4c1d95] via-[#5b21b6] to-[#6d28d9]',
  },
  unionpay: {
    primary: '#4c1d95',
    secondary: '#6d28d9',
    gradient: 'from-[#3b0764] via-[#4c1d95] to-[#5b21b6]',
  },
};

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  transfer: 'Transfer',
  card_load: 'Card Load',
  card_debit: 'Card Debit',
  voucher_redemption: 'Voucher Redeemed',
  fee: 'Service Fee',
  reversal: 'Reversal',
  commission: 'Commission',
  settlement: 'Settlement',
  refund: 'Refund',
  adjustment: 'Adjustment',
  float_top_up: 'Float Top-Up',
};

export const STATUS_COLORS: Record<string, string> = {
  active: 'emerald',
  pending: 'amber',
  pending_verification: 'amber',
  processing: 'blue',
  completed: 'emerald',
  failed: 'red',
  frozen: 'blue',
  terminated: 'gray',
  expired: 'gray',
  exhausted: 'gray',
  suspended: 'red',
  redeemed: 'emerald',
  cancelled: 'gray',
};
