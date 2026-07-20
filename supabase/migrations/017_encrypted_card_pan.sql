-- VitalPay's issue response delivers the full card number (and a pin code)
-- exactly once, at issuance — their model is that the card is displayed on
-- the END CUSTOMER's dashboard (our platform), not the merchant dashboard
-- (confirmed by VitalPay support 2026-07-19). We store it AES-256-GCM
-- encrypted with the server-side ENCRYPTION_KEY; only the /api/cards/:id/reveal
-- endpoint (card owner only) ever decrypts it. Never returned in list/detail
-- responses.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS encrypted_pan TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS encrypted_pin TEXT;
