-- =============================================================================
-- vPay Initial Schema Migration
-- Production-grade fintech platform database
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE user_role AS ENUM ('super_admin', 'staff', 'agent', 'consumer');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'pending_verification', 'closed');
CREATE TYPE kyc_status AS ENUM ('not_submitted', 'pending', 'approved', 'rejected', 'expired');

CREATE TYPE wallet_type AS ENUM ('consumer', 'agent_float', 'master_pool', 'fee_pool', 'settlement');
CREATE TYPE wallet_currency AS ENUM ('USD', 'EUR', 'GBP', 'ZAR', 'NGN', 'GHS', 'KES', 'ZWL', 'USDT', 'BTC', 'ETH');
CREATE TYPE wallet_status AS ENUM ('active', 'frozen', 'closed');

CREATE TYPE transaction_type AS ENUM (
  'deposit', 'withdrawal', 'transfer', 'card_load', 'card_debit',
  'voucher_redemption', 'fee', 'reversal', 'commission', 'settlement',
  'refund', 'adjustment', 'float_top_up'
);
CREATE TYPE transaction_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'reversed', 'disputed');
CREATE TYPE transaction_direction AS ENUM ('credit', 'debit');

CREATE TYPE card_type AS ENUM ('single_use', 'multi_use', 'disposable', 'time_limited', 'merchant_locked', 'subscription');
CREATE TYPE card_status AS ENUM ('pending', 'active', 'frozen', 'terminated', 'expired', 'exhausted', 'consumed');
CREATE TYPE card_network AS ENUM ('visa', 'mastercard', 'amex', 'unionpay');
CREATE TYPE card_currency AS ENUM ('USD', 'EUR', 'GBP', 'ZAR', 'NGN', 'GHS');

CREATE TYPE voucher_type AS ENUM (
  'virtual_card', 'gift_card', 'streaming', 'gaming', 'ecommerce',
  'subscription', 'utility', 'travel', 'general'
);
CREATE TYPE voucher_status AS ENUM ('active', 'redeemed', 'expired', 'cancelled', 'refunded');
CREATE TYPE gift_card_brand AS ENUM (
  'netflix', 'amazon', 'ebay', 'spotify', 'apple', 'google_play',
  'steam', 'playstation', 'xbox', 'binance', 'airbnb', 'uber',
  'skrill', 'paypal', 'disney_plus', 'hulu', 'youtube', 'microsoft',
  'visa_gift', 'mastercard_gift', 'other'
);

CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE payout_method AS ENUM ('bank_transfer', 'crypto', 'mobile_money', 'card', 'internal');

CREATE TYPE webhook_status AS ENUM ('pending', 'delivered', 'failed', 'retrying');
CREATE TYPE webhook_event_type AS ENUM (
  'card.issued', 'card.terminated', 'card.frozen', 'card.unfrozen',
  'card.transaction', 'card.exhausted',
  'wallet.funded', 'wallet.debited', 'wallet.transfer',
  'voucher.issued', 'voucher.redeemed', 'voucher.expired',
  'payout.initiated', 'payout.completed', 'payout.failed',
  'kyc.submitted', 'kyc.approved', 'kyc.rejected',
  'fraud.detected', 'user.suspended',
  'settlement.completed', 'reversal.received'
);

CREATE TYPE fraud_flag_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE fraud_flag_status AS ENUM ('open', 'investigating', 'resolved', 'false_positive');

CREATE TYPE support_ticket_status AS ENUM ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed');
CREATE TYPE support_ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TYPE notification_type AS ENUM (
  'card_issued', 'card_terminated', 'card_frozen', 'transaction_success',
  'transaction_failed', 'voucher_redeemed', 'payout_completed', 'payout_failed',
  'low_balance', 'suspicious_activity', 'kyc_update', 'system_alert'
);
CREATE TYPE notification_channel AS ENUM ('email', 'sms', 'push', 'in_app');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'delivered', 'failed', 'read');

CREATE TYPE settlement_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'disputed');
CREATE TYPE commission_type AS ENUM ('card_issuance', 'voucher_sale', 'fx_spread', 'float_premium', 'referral');

-- =============================================================================
-- PROFILES (extends Supabase auth.users)
-- =============================================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  full_name TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'consumer',
  status user_status NOT NULL DEFAULT 'pending_verification',
  kyc_status kyc_status NOT NULL DEFAULT 'not_submitted',
  date_of_birth DATE,
  nationality TEXT,
  country_of_residence TEXT DEFAULT 'ZW',
  address JSONB DEFAULT '{}',
  referral_code TEXT UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 8)),
  referred_by UUID REFERENCES profiles(id),
  preferred_currency wallet_currency DEFAULT 'USD',
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret TEXT,
  login_count INTEGER DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  last_login_ip INET,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_status ON profiles(status);
CREATE INDEX idx_profiles_kyc_status ON profiles(kyc_status);
CREATE INDEX idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_phone ON profiles(phone);

-- =============================================================================
-- AGENT PROFILES (extends profiles for agents)
-- =============================================================================

CREATE TABLE agent_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_name TEXT,
  business_registration_number TEXT,
  tax_id TEXT,
  commission_rate DECIMAL(5, 4) DEFAULT 0.0200, -- 2% default
  float_limit DECIMAL(20, 8) DEFAULT 10000.00,
  daily_issuance_limit INTEGER DEFAULT 100,
  monthly_issuance_limit INTEGER DEFAULT 2000,
  is_verified BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  territory TEXT,
  agent_tier INTEGER DEFAULT 1 CHECK (agent_tier BETWEEN 1 AND 5),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_agent_profiles_user_id ON agent_profiles(user_id);
CREATE INDEX idx_agent_profiles_tier ON agent_profiles(agent_tier);

-- =============================================================================
-- KYC DOCUMENTS
-- =============================================================================

CREATE TABLE kyc_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'national_id', 'passport', 'drivers_license', 'voters_card',
    'proof_of_address', 'selfie', 'business_registration'
  )),
  document_number TEXT,
  front_url TEXT,
  back_url TEXT,
  selfie_url TEXT,
  country_of_issue TEXT,
  expiry_date DATE,
  status kyc_status DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  provider_reference TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_kyc_user_id ON kyc_documents(user_id);
CREATE INDEX idx_kyc_status ON kyc_documents(status);

-- =============================================================================
-- WALLETS
-- =============================================================================

CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  wallet_type wallet_type NOT NULL DEFAULT 'consumer',
  currency wallet_currency NOT NULL DEFAULT 'USD',
  balance DECIMAL(20, 8) NOT NULL DEFAULT 0.00,
  pending_balance DECIMAL(20, 8) NOT NULL DEFAULT 0.00,
  frozen_balance DECIMAL(20, 8) NOT NULL DEFAULT 0.00,
  total_credited DECIMAL(20, 8) NOT NULL DEFAULT 0.00,
  total_debited DECIMAL(20, 8) NOT NULL DEFAULT 0.00,
  status wallet_status NOT NULL DEFAULT 'active',
  daily_debit_limit DECIMAL(20, 8) DEFAULT 5000.00,
  monthly_debit_limit DECIMAL(20, 8) DEFAULT 50000.00,
  provider_account_id TEXT,
  provider_virtual_account_number TEXT,
  provider_bank_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT positive_balance CHECK (balance >= 0),
  CONSTRAINT positive_pending CHECK (pending_balance >= 0),
  CONSTRAINT positive_frozen CHECK (frozen_balance >= 0)
);

CREATE UNIQUE INDEX idx_wallets_user_currency ON wallets(user_id, currency, wallet_type);
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_status ON wallets(status);
CREATE INDEX idx_wallets_type ON wallets(wallet_type);

-- =============================================================================
-- WALLET TRANSACTIONS
-- =============================================================================

CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  type transaction_type NOT NULL,
  direction transaction_direction NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  fee DECIMAL(20, 8) DEFAULT 0.00,
  net_amount DECIMAL(20, 8) NOT NULL,
  currency wallet_currency NOT NULL,
  balance_before DECIMAL(20, 8) NOT NULL,
  balance_after DECIMAL(20, 8) NOT NULL,
  status transaction_status NOT NULL DEFAULT 'pending',
  reference TEXT UNIQUE NOT NULL DEFAULT 'TXN-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
  provider_reference TEXT,
  related_wallet_id UUID REFERENCES wallets(id),
  related_transaction_id UUID REFERENCES wallet_transactions(id),
  voucher_id UUID,
  card_id UUID,
  description TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  device_fingerprint TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ,
  CONSTRAINT positive_amount CHECK (amount > 0),
  CONSTRAINT positive_fee CHECK (fee >= 0)
);

CREATE INDEX idx_wallet_txn_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_txn_user_id ON wallet_transactions(user_id);
CREATE INDEX idx_wallet_txn_type ON wallet_transactions(type);
CREATE INDEX idx_wallet_txn_status ON wallet_transactions(status);
CREATE INDEX idx_wallet_txn_reference ON wallet_transactions(reference);
CREATE INDEX idx_wallet_txn_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX idx_wallet_txn_provider_ref ON wallet_transactions(provider_reference);

-- =============================================================================
-- EXCHANGE RATES
-- =============================================================================

CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_currency wallet_currency NOT NULL,
  to_currency wallet_currency NOT NULL,
  rate DECIMAL(20, 8) NOT NULL,
  mid_rate DECIMAL(20, 8),
  spread_percentage DECIMAL(5, 4) DEFAULT 0.0150,
  provider TEXT DEFAULT 'open_exchange_rates',
  is_active BOOLEAN DEFAULT true,
  fetched_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '5 minutes',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT valid_rate CHECK (rate > 0)
);

CREATE UNIQUE INDEX idx_exchange_rates_pair ON exchange_rates(from_currency, to_currency) WHERE is_active = true;
CREATE INDEX idx_exchange_rates_active ON exchange_rates(is_active, expires_at);

-- =============================================================================
-- VIRTUAL CARDS
-- =============================================================================

CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  wallet_id UUID REFERENCES wallets(id) ON DELETE RESTRICT,
  issued_by_agent UUID REFERENCES profiles(id),
  card_type card_type NOT NULL DEFAULT 'single_use',
  network card_network NOT NULL DEFAULT 'visa',
  currency card_currency NOT NULL DEFAULT 'USD',
  status card_status NOT NULL DEFAULT 'pending',
  -- Encrypted/tokenized card data (never store plaintext)
  card_token TEXT, -- Provider token reference
  masked_pan TEXT, -- e.g., 4532 **** **** 1234
  last_four TEXT,
  cardholder_name TEXT NOT NULL,
  expiry_month SMALLINT CHECK (expiry_month BETWEEN 1 AND 12),
  expiry_year SMALLINT,
  -- Balances
  initial_balance DECIMAL(20, 8) DEFAULT 0.00,
  current_balance DECIMAL(20, 8) DEFAULT 0.00,
  total_spent DECIMAL(20, 8) DEFAULT 0.00,
  -- Controls
  spending_limit_daily DECIMAL(20, 8),
  spending_limit_weekly DECIMAL(20, 8),
  spending_limit_monthly DECIMAL(20, 8),
  spending_limit_per_transaction DECIMAL(20, 8),
  allowed_categories TEXT[],
  blocked_categories TEXT[],
  allowed_merchants TEXT[],
  -- Provider data
  provider_card_id TEXT,
  provider_name TEXT DEFAULT 'fincra',
  -- Card specific fields
  is_3ds_enabled BOOLEAN DEFAULT true,
  is_online_enabled BOOLEAN DEFAULT true,
  is_atm_enabled BOOLEAN DEFAULT false,
  is_contactless_enabled BOOLEAN DEFAULT true,
  allowed_countries TEXT[],
  -- Expiry for time-limited
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  terminated_at TIMESTAMPTZ,
  -- Voucher linkage
  voucher_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT positive_balance CHECK (current_balance >= 0),
  CONSTRAINT valid_card_expiry CHECK (expiry_month IS NULL OR (expiry_month BETWEEN 1 AND 12))
);

CREATE INDEX idx_cards_user_id ON cards(user_id);
CREATE INDEX idx_cards_status ON cards(status);
CREATE INDEX idx_cards_type ON cards(card_type);
CREATE INDEX idx_cards_network ON cards(network);
CREATE INDEX idx_cards_issued_by ON cards(issued_by_agent);
CREATE INDEX idx_cards_provider_card_id ON cards(provider_card_id);
CREATE INDEX idx_cards_voucher_id ON cards(voucher_id);

-- =============================================================================
-- CARD TRANSACTIONS
-- =============================================================================

CREATE TABLE card_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  wallet_transaction_id UUID REFERENCES wallet_transactions(id),
  type TEXT NOT NULL CHECK (type IN ('purchase', 'refund', 'reversal', 'fee', 'load', 'withdrawal')),
  amount DECIMAL(20, 8) NOT NULL,
  currency card_currency NOT NULL,
  merchant_name TEXT,
  merchant_category TEXT,
  merchant_country TEXT,
  merchant_id TEXT,
  status transaction_status NOT NULL DEFAULT 'pending',
  authorization_code TEXT,
  provider_reference TEXT,
  balance_before DECIMAL(20, 8),
  balance_after DECIMAL(20, 8),
  is_declined BOOLEAN DEFAULT false,
  decline_reason TEXT,
  is_3ds BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  settled_at TIMESTAMPTZ
);

CREATE INDEX idx_card_txn_card_id ON card_transactions(card_id);
CREATE INDEX idx_card_txn_user_id ON card_transactions(user_id);
CREATE INDEX idx_card_txn_status ON card_transactions(status);
CREATE INDEX idx_card_txn_created_at ON card_transactions(created_at DESC);
CREATE INDEX idx_card_txn_provider_ref ON card_transactions(provider_reference);

-- =============================================================================
-- VOUCHERS
-- =============================================================================

CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  issuer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  batch_id UUID,
  type voucher_type NOT NULL,
  gift_card_brand gift_card_brand,
  amount DECIMAL(20, 8) NOT NULL,
  currency wallet_currency NOT NULL DEFAULT 'USD',
  status voucher_status NOT NULL DEFAULT 'active',
  -- Issuance cost (agent deduction)
  cost DECIMAL(20, 8) NOT NULL,
  fee DECIMAL(20, 8) DEFAULT 0.00,
  -- Metadata encoded in voucher
  encoded_data JSONB NOT NULL DEFAULT '{}',
  -- Constraints
  max_redemptions INTEGER DEFAULT 1,
  redemption_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  -- Redemption
  redeemed_by UUID REFERENCES profiles(id),
  redeemed_at TIMESTAMPTZ,
  card_id UUID REFERENCES cards(id),
  -- Provider / service specifics
  provider_reference TEXT,
  service_metadata JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT positive_amount CHECK (amount > 0),
  CONSTRAINT valid_redemption_count CHECK (redemption_count <= max_redemptions)
);

CREATE INDEX idx_vouchers_code ON vouchers(code);
CREATE INDEX idx_vouchers_issuer ON vouchers(issuer_id);
CREATE INDEX idx_vouchers_status ON vouchers(status);
CREATE INDEX idx_vouchers_type ON vouchers(type);
CREATE INDEX idx_vouchers_expires_at ON vouchers(expires_at);
CREATE INDEX idx_vouchers_batch_id ON vouchers(batch_id);

-- =============================================================================
-- VOUCHER BATCHES (for bulk issuance)
-- =============================================================================

CREATE TABLE voucher_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issuer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  name TEXT,
  type voucher_type NOT NULL,
  gift_card_brand gift_card_brand,
  quantity INTEGER NOT NULL,
  amount_per_voucher DECIMAL(20, 8) NOT NULL,
  currency wallet_currency NOT NULL DEFAULT 'USD',
  total_cost DECIMAL(20, 8) NOT NULL,
  total_fee DECIMAL(20, 8) DEFAULT 0.00,
  redeemed_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_voucher_batches_issuer ON voucher_batches(issuer_id);

-- =============================================================================
-- PAYOUT REQUESTS
-- =============================================================================

CREATE TABLE payout_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  amount DECIMAL(20, 8) NOT NULL,
  fee DECIMAL(20, 8) DEFAULT 0.00,
  net_amount DECIMAL(20, 8) NOT NULL,
  currency wallet_currency NOT NULL,
  method payout_method NOT NULL,
  status payout_status NOT NULL DEFAULT 'pending',
  -- Beneficiary details (stored securely)
  beneficiary_name TEXT,
  beneficiary_account TEXT,
  beneficiary_bank TEXT,
  beneficiary_bank_code TEXT,
  beneficiary_country TEXT,
  beneficiary_currency TEXT,
  -- Crypto fields
  crypto_address TEXT,
  crypto_network TEXT,
  -- Mobile money fields
  mobile_number TEXT,
  mobile_provider TEXT,
  -- References
  provider_reference TEXT,
  provider_status TEXT,
  reference TEXT UNIQUE NOT NULL DEFAULT 'PAY-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
  notes TEXT,
  processed_by UUID REFERENCES profiles(id),
  processed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT positive_amount CHECK (amount > 0)
);

CREATE INDEX idx_payout_user_id ON payout_requests(user_id);
CREATE INDEX idx_payout_status ON payout_requests(status);
CREATE INDEX idx_payout_method ON payout_requests(method);
CREATE INDEX idx_payout_created_at ON payout_requests(created_at DESC);

-- =============================================================================
-- COMMISSIONS
-- =============================================================================

CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  wallet_transaction_id UUID REFERENCES wallet_transactions(id),
  type commission_type NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  currency wallet_currency NOT NULL DEFAULT 'USD',
  rate DECIMAL(5, 4) NOT NULL,
  reference_amount DECIMAL(20, 8),
  status transaction_status DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT positive_commission CHECK (amount > 0)
);

CREATE INDEX idx_commissions_agent_id ON commissions(agent_id);
CREATE INDEX idx_commissions_type ON commissions(type);
CREATE INDEX idx_commissions_status ON commissions(status);

-- =============================================================================
-- FEES
-- =============================================================================

CREATE TABLE fee_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  fee_type TEXT NOT NULL CHECK (fee_type IN ('flat', 'percentage', 'tiered')),
  applies_to TEXT NOT NULL CHECK (applies_to IN (
    'card_issuance', 'card_reload', 'payout', 'fx_conversion',
    'voucher_issuance', 'subscription', 'dormancy'
  )),
  flat_amount DECIMAL(20, 8) DEFAULT 0.00,
  percentage DECIMAL(5, 4) DEFAULT 0.00,
  min_fee DECIMAL(20, 8) DEFAULT 0.00,
  max_fee DECIMAL(20, 8),
  currency wallet_currency DEFAULT 'USD',
  tier_config JSONB DEFAULT '{}',
  applies_to_roles user_role[] DEFAULT '{consumer,agent}',
  is_active BOOLEAN DEFAULT true,
  effective_from TIMESTAMPTZ DEFAULT now(),
  effective_until TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_fee_configs_active ON fee_configs(is_active, applies_to);

-- =============================================================================
-- SETTLEMENTS
-- =============================================================================

CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiated_by UUID REFERENCES profiles(id),
  settlement_period_start TIMESTAMPTZ NOT NULL,
  settlement_period_end TIMESTAMPTZ NOT NULL,
  total_transactions INTEGER DEFAULT 0,
  gross_amount DECIMAL(20, 8) DEFAULT 0.00,
  total_fees DECIMAL(20, 8) DEFAULT 0.00,
  net_amount DECIMAL(20, 8) DEFAULT 0.00,
  currency wallet_currency NOT NULL DEFAULT 'USD',
  status settlement_status DEFAULT 'pending',
  provider_reference TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_settlements_status ON settlements(status);
CREATE INDEX idx_settlements_period ON settlements(settlement_period_start, settlement_period_end);

-- =============================================================================
-- WEBHOOK EVENTS
-- =============================================================================

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type webhook_event_type NOT NULL,
  source TEXT DEFAULT 'fincra',
  payload JSONB NOT NULL,
  signature TEXT,
  status webhook_status DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  idempotency_key TEXT UNIQUE,
  related_entity_id UUID,
  related_entity_type TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_source ON webhook_events(source);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at DESC);
CREATE INDEX idx_webhook_events_next_retry ON webhook_events(next_retry_at) WHERE status = 'retrying';

-- =============================================================================
-- PROVIDER LOGS (audit all external API calls)
-- =============================================================================

CREATE TABLE provider_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL DEFAULT 'fincra',
  operation TEXT NOT NULL,
  method TEXT,
  endpoint TEXT,
  request_payload JSONB,
  response_payload JSONB,
  status_code INTEGER,
  success BOOLEAN,
  duration_ms INTEGER,
  error_message TEXT,
  related_entity_id UUID,
  related_entity_type TEXT,
  user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_provider_logs_provider ON provider_logs(provider);
CREATE INDEX idx_provider_logs_operation ON provider_logs(operation);
CREATE INDEX idx_provider_logs_success ON provider_logs(success);
CREATE INDEX idx_provider_logs_created_at ON provider_logs(created_at DESC);
CREATE INDEX idx_provider_logs_entity ON provider_logs(related_entity_id, related_entity_type);

-- =============================================================================
-- FRAUD FLAGS
-- =============================================================================

CREATE TABLE fraud_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  card_id UUID REFERENCES cards(id),
  wallet_transaction_id UUID REFERENCES wallet_transactions(id),
  card_transaction_id UUID REFERENCES card_transactions(id),
  flag_type TEXT NOT NULL,
  severity fraud_flag_severity NOT NULL DEFAULT 'medium',
  status fraud_flag_status NOT NULL DEFAULT 'open',
  risk_score DECIMAL(5, 2) CHECK (risk_score BETWEEN 0 AND 100),
  description TEXT,
  evidence JSONB DEFAULT '{}',
  automated BOOLEAN DEFAULT true,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  ip_address INET,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_fraud_flags_user_id ON fraud_flags(user_id);
CREATE INDEX idx_fraud_flags_severity ON fraud_flags(severity);
CREATE INDEX idx_fraud_flags_status ON fraud_flags(status);
CREATE INDEX idx_fraud_flags_created_at ON fraud_flags(created_at DESC);

-- =============================================================================
-- SUPPORT TICKETS
-- =============================================================================

CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number TEXT UNIQUE NOT NULL DEFAULT 'TKT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assigned_to UUID REFERENCES profiles(id),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'card_issue', 'payment_failed', 'account_access', 'kyc_verification',
    'payout_issue', 'fraud_report', 'general_inquiry', 'technical_issue', 'other'
  )),
  status support_ticket_status NOT NULL DEFAULT 'open',
  priority support_ticket_priority NOT NULL DEFAULT 'normal',
  related_card_id UUID REFERENCES cards(id),
  related_transaction_id UUID REFERENCES wallet_transactions(id),
  tags TEXT[],
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  message TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  attachments TEXT[],
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id);

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  channel notification_channel NOT NULL DEFAULT 'in_app',
  status notification_status NOT NULL DEFAULT 'pending',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  action_label TEXT,
  icon TEXT,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  failed_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;

-- =============================================================================
-- AUDIT LOGS (immutable)
-- =============================================================================

CREATE TABLE audit_logs (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES profiles(id),
  actor_role user_role,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  changes JSONB DEFAULT '{}',
  old_values JSONB DEFAULT '{}',
  new_values JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2025 PARTITION OF audit_logs
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE audit_logs_2026 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =============================================================================
-- SESSIONS (track active sessions)
-- =============================================================================

CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  device_info JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX idx_sessions_active ON user_sessions(is_active, expires_at);

-- =============================================================================
-- VIRTUAL ACCOUNT ASSIGNMENTS
-- =============================================================================

CREATE TABLE virtual_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  provider TEXT DEFAULT 'fincra',
  provider_account_id TEXT NOT NULL,
  account_number TEXT,
  account_name TEXT,
  bank_name TEXT,
  bank_code TEXT,
  currency wallet_currency NOT NULL DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_virtual_accounts_user_id ON virtual_accounts(user_id);
CREATE INDEX idx_virtual_accounts_provider_id ON virtual_accounts(provider_account_id);

-- =============================================================================
-- BENEFICIARIES
-- =============================================================================

CREATE TABLE beneficiaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nickname TEXT,
  beneficiary_type TEXT CHECK (beneficiary_type IN ('bank', 'mobile_money', 'crypto', 'card')),
  account_name TEXT,
  account_number TEXT,
  bank_name TEXT,
  bank_code TEXT,
  country TEXT,
  currency TEXT,
  routing_number TEXT,
  swift_code TEXT,
  mobile_number TEXT,
  mobile_provider TEXT,
  crypto_address TEXT,
  crypto_network TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_favourite BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_beneficiaries_user_id ON beneficiaries(user_id);

-- =============================================================================
-- SYSTEM CONFIG
-- =============================================================================

CREATE TABLE system_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_system_config_key ON system_config(key);
CREATE INDEX idx_system_config_public ON system_config(is_public);
