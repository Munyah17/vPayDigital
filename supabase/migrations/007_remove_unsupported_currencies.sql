-- =============================================================================
-- Migration 007: Remove unsupported currencies (NGN, GHS, ZWL)
-- =============================================================================
-- Business decision: Zimbabwe operates in USD only (no ZWL/ZiG), and no West
-- African currencies are offered. Narrows wallet_currency and card_currency
-- to the currencies Virtual Pay actually supports. Verified against the live
-- database beforehand — zero rows anywhere use NGN, GHS, or ZWL, so this is
-- a safe, lossless narrowing.
-- =============================================================================

-- vw_agent_metrics selects wallets.currency directly, so it blocks altering
-- that column's type until dropped; recreated unchanged at the end.
DROP VIEW IF EXISTS vw_agent_metrics;

-- ─── wallet_currency ───────────────────────────────────────────────────────
ALTER TYPE wallet_currency RENAME TO wallet_currency_old;
CREATE TYPE wallet_currency AS ENUM ('USD', 'EUR', 'GBP', 'ZAR', 'KES', 'USDT', 'BTC', 'ETH');

ALTER TABLE profiles ALTER COLUMN preferred_currency DROP DEFAULT;
ALTER TABLE profiles ALTER COLUMN preferred_currency TYPE wallet_currency USING preferred_currency::text::wallet_currency;
ALTER TABLE profiles ALTER COLUMN preferred_currency SET DEFAULT 'USD';

ALTER TABLE wallets ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE wallets ALTER COLUMN currency TYPE wallet_currency USING currency::text::wallet_currency;
ALTER TABLE wallets ALTER COLUMN currency SET DEFAULT 'USD';

ALTER TABLE wallet_transactions ALTER COLUMN currency TYPE wallet_currency USING currency::text::wallet_currency;

ALTER TABLE exchange_rates ALTER COLUMN from_currency TYPE wallet_currency USING from_currency::text::wallet_currency;
ALTER TABLE exchange_rates ALTER COLUMN to_currency TYPE wallet_currency USING to_currency::text::wallet_currency;

ALTER TABLE vouchers ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE vouchers ALTER COLUMN currency TYPE wallet_currency USING currency::text::wallet_currency;
ALTER TABLE vouchers ALTER COLUMN currency SET DEFAULT 'USD';

ALTER TABLE voucher_batches ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE voucher_batches ALTER COLUMN currency TYPE wallet_currency USING currency::text::wallet_currency;
ALTER TABLE voucher_batches ALTER COLUMN currency SET DEFAULT 'USD';

ALTER TABLE payout_requests ALTER COLUMN currency TYPE wallet_currency USING currency::text::wallet_currency;

ALTER TABLE commissions ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE commissions ALTER COLUMN currency TYPE wallet_currency USING currency::text::wallet_currency;
ALTER TABLE commissions ALTER COLUMN currency SET DEFAULT 'USD';

ALTER TABLE fee_configs ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE fee_configs ALTER COLUMN currency TYPE wallet_currency USING currency::text::wallet_currency;
ALTER TABLE fee_configs ALTER COLUMN currency SET DEFAULT 'USD';

ALTER TABLE settlements ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE settlements ALTER COLUMN currency TYPE wallet_currency USING currency::text::wallet_currency;
ALTER TABLE settlements ALTER COLUMN currency SET DEFAULT 'USD';

ALTER TABLE virtual_accounts ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE virtual_accounts ALTER COLUMN currency TYPE wallet_currency USING currency::text::wallet_currency;
ALTER TABLE virtual_accounts ALTER COLUMN currency SET DEFAULT 'USD';

ALTER TABLE iban_accounts ALTER COLUMN requested_currency DROP DEFAULT;
ALTER TABLE iban_accounts ALTER COLUMN requested_currency TYPE wallet_currency USING requested_currency::text::wallet_currency;
ALTER TABLE iban_accounts ALTER COLUMN requested_currency SET DEFAULT 'EUR';

DROP TYPE wallet_currency_old;

-- ─── card_currency ─────────────────────────────────────────────────────────
ALTER TYPE card_currency RENAME TO card_currency_old;
CREATE TYPE card_currency AS ENUM ('USD', 'EUR', 'GBP', 'ZAR');

ALTER TABLE cards ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE cards ALTER COLUMN currency TYPE card_currency USING currency::text::card_currency;
ALTER TABLE cards ALTER COLUMN currency SET DEFAULT 'USD';

ALTER TABLE card_transactions ALTER COLUMN currency TYPE card_currency USING currency::text::card_currency;

DROP TYPE card_currency_old;

-- ─── Recreate dependent view (unchanged) ───────────────────────────────────
CREATE OR REPLACE VIEW vw_agent_metrics AS
SELECT
  p.id AS agent_id,
  p.full_name,
  ap.business_name,
  ap.agent_tier,
  ap.commission_rate,
  w.balance AS float_balance,
  w.currency,
  (SELECT COUNT(*) FROM vouchers v WHERE v.issuer_id = p.id) AS total_vouchers_issued,
  (SELECT COUNT(*) FROM vouchers v WHERE v.issuer_id = p.id AND v.status = 'redeemed') AS vouchers_redeemed,
  (SELECT COUNT(*) FROM cards c WHERE c.issued_by_agent = p.id) AS total_cards_issued,
  (SELECT COALESCE(SUM(amount), 0) FROM commissions cm WHERE cm.agent_id = p.id AND cm.status = 'completed') AS total_commissions_earned
FROM profiles p
JOIN agent_profiles ap ON ap.user_id = p.id
LEFT JOIN wallets w ON w.user_id = p.id AND w.wallet_type = 'agent_float' AND w.currency = 'USD'
WHERE p.role = 'agent';

-- ─── Supported-currencies config value ─────────────────────────────────────
UPDATE system_config
SET value = '["USD","EUR","GBP","ZAR","KES"]'
WHERE key = 'supported_currencies';
