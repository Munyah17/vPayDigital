-- Bill payments (DStv, ZOL, TelOne, municipal) ride the same VAS order
-- lifecycle as airtime/electricity — new service_type plus a column for
-- which biller was paid.
ALTER TYPE vas_service_type ADD VALUE IF NOT EXISTS 'bill';
ALTER TABLE vas_orders ADD COLUMN IF NOT EXISTS biller_code TEXT;
ALTER TABLE vas_orders ADD COLUMN IF NOT EXISTS account_number TEXT;
