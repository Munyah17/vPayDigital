-- =============================================================================
-- Migration 007: Remove unsupported currencies (NGN, GHS, ZWL)
-- =============================================================================
-- Business decision: Zimbabwe operates in USD only (no ZWL/ZiG), and no West
-- African currencies are offered. Narrows wallet_currency and card_currency
-- to the currencies Virtual Pay actually supports. Verified against the live
-- database beforehand — zero rows anywhere use NGN, GHS, or ZWL, so this is
-- a safe, lossless narrowing.
-- =============================================================================

-- ─── wallet_currency ───────────────────────────────────────────────────────
ALTER TYPE wallet_currency RENAME TO wallet_currency_old;
CREATE TYPE wallet_currency AS ENUM ('USD', 'EUR', 'GBP', 'ZAR', 'KES', 'USDT', 'BTC', 'ETH');

ALTER TABLE profiles ALTER COLUMN preferred_currency TYPE wallet_currency USING preferred_currency::text::wallet_currency;
ALTER TABLE wallets ALTER COLUMN currency TYPE wallet_currency USING currency::text::wallet_currency;
ALTER TABLE wallet_transactions ALTER COLUMN currency TYPE wallet_currency USING currency::text::wallet_currency;
ALTER TABLE exchange_rates ALTER COLUMN from_currency TYPE wallet_currency USING from_currency::text::wallet_currency;
ALTER TABLE exchange_rates ALTER COLUMN to_currency TYPE wallet_currency USING to_currency::text::wallet_currency;
ALTER TABLE vouchers ALTER COLUMN currency TYPE wallet_currency USING currency::text::wallet_currency;
ALTER TABLE voucher_batches ALTER COLUMN currency TYPE wallet_currency USING currency::text::wallet_currency;
ALTER TABLE payout_requests ALTER COLUMN currency TYPE wallet_currency USING currency::text::wallet_currency;
ALTER TABLE commissions ALTER COLUMN currency TYPE wallet_currency USING currency::text::wallet_currency;
ALTER TABLE fee_configs ALTER COLUMN currency TYPE wallet_currency USING currency::text::wallet_currency;
ALTER TABLE settlements ALTER COLUMN currency TYPE wallet_currency USING currency::text::wallet_currency;
ALTER TABLE virtual_accounts ALTER COLUMN currency TYPE wallet_currency USING currency::text::wallet_currency;
ALTER TABLE iban_accounts ALTER COLUMN requested_currency TYPE wallet_currency USING requested_currency::text::wallet_currency;

DROP TYPE wallet_currency_old;

-- ─── card_currency ─────────────────────────────────────────────────────────
ALTER TYPE card_currency RENAME TO card_currency_old;
CREATE TYPE card_currency AS ENUM ('USD', 'EUR', 'GBP', 'ZAR');

ALTER TABLE cards ALTER COLUMN currency TYPE card_currency USING currency::text::card_currency;
ALTER TABLE card_transactions ALTER COLUMN currency TYPE card_currency USING currency::text::card_currency;

DROP TYPE card_currency_old;

-- ─── Supported-currencies config value ─────────────────────────────────────
UPDATE system_config
SET value = '["USD","EUR","GBP","ZAR","KES"]'
WHERE key = 'supported_currencies';
