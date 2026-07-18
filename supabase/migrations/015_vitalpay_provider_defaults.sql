-- Fincra was removed entirely (never had real credentials, never processed
-- a real transaction) — VitalPay is now the only payment provider. Update
-- the leftover 'fincra' column defaults and backfill any rows that were
-- created under those defaults before this switch.

ALTER TABLE cards ALTER COLUMN provider_name SET DEFAULT 'vitalpay';
UPDATE cards SET provider_name = 'vitalpay' WHERE provider_name = 'fincra';

ALTER TABLE webhook_events ALTER COLUMN source SET DEFAULT 'vitalpay';
UPDATE webhook_events SET source = 'vitalpay' WHERE source = 'fincra';

ALTER TABLE provider_logs ALTER COLUMN provider SET DEFAULT 'vitalpay';
UPDATE provider_logs SET provider = 'vitalpay' WHERE provider = 'fincra';

ALTER TABLE virtual_accounts ALTER COLUMN provider SET DEFAULT 'vitalpay';
UPDATE virtual_accounts SET provider = 'vitalpay' WHERE provider = 'fincra';
