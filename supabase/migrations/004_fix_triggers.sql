-- =============================================================================
-- Migration 004: Fix trigger robustness
-- =============================================================================

-- Make handle_new_user idempotent — bare INSERT fails with a PK collision if
-- Supabase retries the auth.users row (e.g., on email-confirmation resend or
-- provider-level retry). ON CONFLICT (id) DO NOTHING prevents this from surfacing
-- as "Database error saving new user" to the client.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role := 'consumer';
  v_full_name TEXT;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  IF NEW.raw_user_meta_data->>'role' IS NOT NULL AND
     NEW.raw_user_meta_data->>'role' IN ('super_admin', 'staff', 'agent', 'consumer') THEN
    v_role := (NEW.raw_user_meta_data->>'role')::user_role;
  END IF;

  INSERT INTO profiles (id, email, full_name, role, status)
  VALUES (NEW.id, NEW.email, v_full_name, v_role, 'pending_verification')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also make handle_new_profile idempotent — same reasoning: if the trigger fires
-- more than once (e.g., admin upsert via seed), the wallet insert must be safe.
-- The ON CONFLICT was already there but re-declaring the full function is cleaner.

CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wallets (user_id, wallet_type, currency)
  VALUES (
    NEW.id,
    CASE NEW.role WHEN 'agent' THEN 'agent_float'::wallet_type ELSE 'consumer'::wallet_type END,
    'USD'::wallet_currency
  )
  ON CONFLICT (user_id, currency, wallet_type) DO NOTHING;

  IF NEW.role = 'agent' THEN
    INSERT INTO agent_profiles (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
