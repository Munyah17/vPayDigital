// =============================================================================
// vPay Shared TypeScript Types
// =============================================================================

// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'staff' | 'agent' | 'consumer';
export type UserStatus = 'active' | 'suspended' | 'pending_verification' | 'closed';
export type KycStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected' | 'expired';

export type WalletType = 'consumer' | 'agent_float' | 'master_pool' | 'fee_pool' | 'settlement';
export type WalletCurrency = 'USD' | 'EUR' | 'GBP' | 'ZAR' | 'KES' | 'USDT' | 'BTC' | 'ETH';
export type WalletStatus = 'active' | 'frozen' | 'closed';

export type TransactionType =
  | 'deposit' | 'withdrawal' | 'transfer' | 'card_load' | 'card_debit'
  | 'voucher_redemption' | 'fee' | 'reversal' | 'commission' | 'settlement'
  | 'refund' | 'adjustment' | 'float_top_up';
export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'reversed' | 'disputed';
export type TransactionDirection = 'credit' | 'debit';

export type CardType = 'single_use' | 'multi_use' | 'disposable' | 'time_limited' | 'merchant_locked' | 'subscription';
export type CardStatus = 'pending' | 'active' | 'frozen' | 'terminated' | 'expired' | 'exhausted' | 'consumed';
export type CardNetwork = 'visa' | 'mastercard' | 'amex' | 'unionpay';
export type CardCurrency = 'USD' | 'EUR' | 'GBP' | 'ZAR';

export type VoucherType = 'virtual_card' | 'gift_card' | 'streaming' | 'gaming' | 'ecommerce' | 'subscription' | 'utility' | 'travel' | 'general';
export type VoucherStatus = 'active' | 'redeemed' | 'expired' | 'cancelled' | 'refunded';
export type GiftCardBrand =
  | 'netflix' | 'amazon' | 'ebay' | 'spotify' | 'apple' | 'google_play'
  | 'steam' | 'playstation' | 'xbox' | 'binance' | 'airbnb' | 'uber'
  | 'skrill' | 'paypal' | 'disney_plus' | 'hulu' | 'youtube' | 'microsoft'
  | 'visa_gift' | 'mastercard_gift' | 'other';

export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type PayoutMethod = 'bank_transfer' | 'crypto' | 'mobile_money' | 'card' | 'internal';

export type FraudFlagSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FraudFlagStatus = 'open' | 'investigating' | 'resolved' | 'false_positive';

export type NotificationType =
  | 'card_issued' | 'card_terminated' | 'card_frozen' | 'transaction_success'
  | 'transaction_failed' | 'voucher_redeemed' | 'payout_completed' | 'payout_failed'
  | 'low_balance' | 'suspicious_activity' | 'kyc_update' | 'system_alert';
export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

// ─── Models ──────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  phone?: string;
  full_name: string;
  display_name?: string;
  avatar_url?: string;
  role: UserRole;
  status: UserStatus;
  kyc_status: KycStatus;
  date_of_birth?: string;
  nationality?: string;
  country_of_residence?: string;
  address?: string;
  referral_code?: string;
  referred_by?: string;
  preferred_currency: WalletCurrency;
  two_factor_enabled: boolean;
  login_count: number;
  last_login_at?: string;
  last_login_ip?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentProfile {
  id: string;
  user_id: string;
  business_name?: string;
  business_registration_number?: string;
  tax_id?: string;
  commission_rate: number;
  float_limit: number;
  daily_issuance_limit: number;
  monthly_issuance_limit: number;
  is_verified: boolean;
  approved_by?: string;
  approved_at?: string;
  territory?: string;
  agent_tier: 1 | 2 | 3 | 4 | 5;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  wallet_type: WalletType;
  currency: WalletCurrency;
  balance: number;
  pending_balance: number;
  frozen_balance: number;
  total_credited: number;
  total_debited: number;
  status: WalletStatus;
  daily_debit_limit: number;
  monthly_debit_limit: number;
  provider_account_id?: string;
  provider_virtual_account_number?: string;
  provider_bank_name?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface VirtualAccount {
  id: string;
  user_id: string;
  wallet_id: string;
  provider: string;
  provider_account_id: string;
  account_number?: string;
  account_name?: string;
  bank_name?: string;
  bank_code?: string;
  currency: WalletCurrency;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type IbanAccountStatus = 'requested' | 'in_review' | 'provisioning' | 'active' | 'rejected';

export interface IbanAccount {
  id: string;
  user_id: string;
  wallet_id?: string;
  status: IbanAccountStatus;
  requested_currency: WalletCurrency;
  provider?: string;
  provider_account_id?: string;
  iban?: string;
  bic?: string;
  bank_name?: string;
  rejection_reason?: string;
  requested_at: string;
  activated_at?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type BeneficiaryType = 'bank' | 'mobile_money' | 'crypto' | 'card';

export interface Beneficiary {
  id: string;
  user_id: string;
  nickname?: string;
  beneficiary_type: BeneficiaryType;
  account_name?: string;
  account_number?: string;
  bank_name?: string;
  bank_code?: string;
  country?: string;
  currency?: string;
  routing_number?: string;
  swift_code?: string;
  mobile_number?: string;
  mobile_provider?: string;
  crypto_address?: string;
  crypto_network?: string;
  is_verified: boolean;
  is_favourite: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  user_id: string;
  type: TransactionType;
  direction: TransactionDirection;
  amount: number;
  fee: number;
  net_amount: number;
  currency: WalletCurrency;
  balance_before: number;
  balance_after: number;
  status: TransactionStatus;
  reference: string;
  provider_reference?: string;
  related_wallet_id?: string;
  related_transaction_id?: string;
  voucher_id?: string;
  card_id?: string;
  description?: string;
  notes?: string;
  metadata: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
  completed_at?: string;
}

export interface Card {
  id: string;
  user_id: string;
  wallet_id?: string;
  issued_by_agent?: string;
  card_type: CardType;
  network: CardNetwork;
  currency: CardCurrency;
  status: CardStatus;
  card_token?: string;
  masked_pan?: string;
  last_four?: string;
  cardholder_name: string;
  expiry_month?: number;
  expiry_year?: number;
  initial_balance: number;
  current_balance: number;
  total_spent: number;
  spending_limit_daily?: number;
  spending_limit_per_transaction?: number;
  provider_card_id?: string;
  provider_name: string;
  is_3ds_enabled: boolean;
  is_online_enabled: boolean;
  is_atm_enabled: boolean;
  is_contactless_enabled: boolean;
  activated_at?: string;
  expires_at?: string;
  terminated_at?: string;
  voucher_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CardTransaction {
  id: string;
  card_id: string;
  user_id: string;
  wallet_transaction_id?: string;
  type: 'purchase' | 'refund' | 'reversal' | 'fee' | 'load' | 'withdrawal';
  amount: number;
  currency: CardCurrency;
  merchant_name?: string;
  merchant_category?: string;
  merchant_country?: string;
  merchant_id?: string;
  status: TransactionStatus;
  authorization_code?: string;
  provider_reference?: string;
  balance_before?: number;
  balance_after?: number;
  is_declined: boolean;
  decline_reason?: string;
  is_3ds: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  settled_at?: string;
}

export interface Voucher {
  id: string;
  code: string;
  issuer_id: string;
  batch_id?: string;
  type: VoucherType;
  gift_card_brand?: GiftCardBrand;
  amount: number;
  currency: WalletCurrency;
  status: VoucherStatus;
  cost: number;
  fee: number;
  encoded_data: Record<string, unknown>;
  max_redemptions: number;
  redemption_count: number;
  expires_at: string;
  redeemed_by?: string;
  redeemed_at?: string;
  card_id?: string;
  provider_reference?: string;
  service_metadata: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PayoutRequest {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  currency: WalletCurrency;
  method: PayoutMethod;
  status: PayoutStatus;
  beneficiary_name?: string;
  beneficiary_account?: string;
  beneficiary_bank?: string;
  beneficiary_country?: string;
  beneficiary_currency?: string;
  crypto_address?: string;
  crypto_network?: string;
  mobile_number?: string;
  mobile_provider?: string;
  provider_reference?: string;
  reference: string;
  notes?: string;
  processed_by?: string;
  processed_at?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  title: string;
  body: string;
  action_url?: string;
  action_label?: string;
  icon?: string;
  data: Record<string, unknown>;
  read_at?: string;
  sent_at?: string;
  created_at: string;
}

export interface Commission {
  id: string;
  agent_id: string;
  wallet_transaction_id?: string;
  type: 'card_issuance' | 'voucher_sale' | 'fx_spread' | 'float_premium' | 'referral';
  amount: number;
  currency: WalletCurrency;
  rate: number;
  reference_amount?: number;
  status: TransactionStatus;
  paid_at?: string;
  created_at: string;
}

export interface ExchangeRate {
  id: string;
  from_currency: WalletCurrency;
  to_currency: WalletCurrency;
  rate: number;
  mid_rate?: number;
  spread_percentage: number;
  provider: string;
  is_active: boolean;
  fetched_at: string;
  expires_at: string;
}

export interface FraudFlag {
  id: string;
  user_id?: string;
  card_id?: string;
  wallet_transaction_id?: string;
  flag_type: string;
  severity: FraudFlagSeverity;
  status: FraudFlagStatus;
  risk_score?: number;
  description?: string;
  evidence: Record<string, unknown>;
  automated: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  resolution_notes?: string;
  ip_address?: string;
  created_at: string;
}

// ─── API Types ────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    has_more?: boolean;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface DateRangeFilter {
  from?: string;
  to?: string;
}

// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  profile: Profile;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role?: Extract<UserRole, 'consumer' | 'agent'>;
  referral_code?: string;
}

export interface OtpPayload {
  phone: string;
  otp: string;
}

// ─── Provider Types (abstraction layer) ───────────────────────────────────────

export interface ProviderCardIssueRequest {
  cardholder_name: string;
  cardholder_email?: string;
  currency: string;
  amount: number;
  card_type: CardType;
  network: CardNetwork;
  metadata?: Record<string, unknown>;
}

export interface ProviderCardIssueResponse {
  provider_card_id: string;
  masked_pan: string;
  last_four: string;
  expiry_month: number;
  expiry_year: number;
  card_token: string;
  status: string;
}

export interface ProviderPayoutRequest {
  amount: number;
  currency: string;
  method: PayoutMethod;
  beneficiary: {
    name: string;
    account_number?: string;
    bank_code?: string;
    bank_name?: string;
    country?: string;
    mobile_number?: string;
    crypto_address?: string;
    crypto_network?: string;
  };
  reference: string;
  description?: string;
}

export interface ProviderPayoutResponse {
  provider_reference: string;
  status: string;
  message?: string;
}

export interface ProviderVirtualAccountRequest {
  user_id: string;
  currency: string;
  full_name: string;
  email: string;
}

export interface ProviderVirtualAccountResponse {
  provider_account_id: string;
  account_number: string;
  account_name: string;
  bank_name: string;
  bank_code: string;
  currency: string;
}

export interface ProviderPaginationParams {
  page?: number;
  limit?: number;
}

export interface ProviderCardDetails {
  id: string;
  maskedPan: string;
  expiryMonth: number;
  expiryYear: number;
  currency: string;
  status: string;
  balance: number;
}

export interface ProviderCardTransaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description: string;
  merchantName?: string;
  merchantCountry?: string;
  status: string;
  createdAt: string;
}

// The provider abstraction every payment provider implementation (e.g.
// @vpay/provider-vitalpay) conforms to, so apps/api's services can swap
// providers via ACTIVE_PROVIDER without touching call sites.
export interface PaymentProvider {
  name: string;
  issueCard(req: ProviderCardIssueRequest): Promise<ProviderCardIssueResponse>;
  freezeCard(providerCardId: string): Promise<void>;
  unfreezeCard(providerCardId: string): Promise<void>;
  // Some providers report the remaining card balance on termination so it
  // can be refunded to the wallet; providers that don't just resolve void,
  // which callers must treat as "no refund information available."
  terminateCard(providerCardId: string): Promise<{ refunded?: number } | void>;
  getCardTransactions(providerCardId: string, params?: ProviderPaginationParams): Promise<ProviderCardTransaction[]>;
  getCardDetails(providerCardId: string): Promise<ProviderCardDetails>;
  fundCard(providerCardId: string, amount: number): Promise<void>;
  createVirtualAccount(req: ProviderVirtualAccountRequest): Promise<ProviderVirtualAccountResponse>;
  initiatePayout(req: ProviderPayoutRequest): Promise<ProviderPayoutResponse>;
  getPayoutStatus(providerReference: string): Promise<string>;
  getExchangeRate(from: string, to: string): Promise<number>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

// ─── Webhook Types ────────────────────────────────────────────────────────────

export interface WebhookEvent {
  id: string;
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
  signature?: string;
}

// ─── Dashboard Types ──────────────────────────────────────────────────────────

export interface PlatformMetrics {
  total_consumers: number;
  total_agents: number;
  new_users_24h: number;
  active_cards: number;
  cards_issued_24h: number;
  vouchers_issued_24h: number;
  vouchers_redeemed_24h: number;
  volume_24h: number;
  master_pool_balance: number;
  critical_fraud_flags: number;
  open_support_tickets: number;
}

export interface AgentMetrics {
  agent_id: string;
  full_name: string;
  business_name?: string;
  agent_tier: number;
  commission_rate: number;
  float_balance: number;
  currency: string;
  total_vouchers_issued: number;
  vouchers_redeemed: number;
  total_cards_issued: number;
  total_commissions_earned: number;
}

export interface TransactionSummary {
  period: string;
  total_transactions: number;
  total_volume: number;
  total_fees: number;
  currency: string;
}

// ─── Fee Config ───────────────────────────────────────────────────────────────

export interface FeeConfig {
  id: string;
  name: string;
  description?: string;
  fee_type: 'flat' | 'percentage' | 'tiered';
  applies_to: string;
  flat_amount: number;
  percentage: number;
  min_fee: number;
  max_fee?: number;
  currency: WalletCurrency;
  is_active: boolean;
}
