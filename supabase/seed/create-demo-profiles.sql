-- =============================================================================
-- vPay Demo Account Profile Setup
-- Run this AFTER applying all 3 migrations in order.
--
-- These users were already created in auth.users by the seed script.
-- This SQL manually creates their profiles + wallets since the
-- auto-trigger had not been installed yet when they were created.
-- =============================================================================

DO $$
DECLARE
  v_consumer_id UUID;
  v_agent_id    UUID;
  v_admin_id    UUID;
BEGIN

  -- Get demo user IDs from auth.users
  SELECT id INTO v_consumer_id FROM auth.users WHERE email = 'demo@vpay.app';
  SELECT id INTO v_agent_id    FROM auth.users WHERE email = 'agent@vpay.app';
  SELECT id INTO v_admin_id    FROM auth.users WHERE email = 'admin@vpay.app';

  -- ── Demo Consumer ─────────────────────────────────────────────────────────
  IF v_consumer_id IS NOT NULL THEN
    INSERT INTO profiles (id, email, full_name, role, status, kyc_status)
    VALUES (v_consumer_id, 'demo@vpay.app', 'Demo User', 'consumer', 'active', 'approved')
    ON CONFLICT (id) DO UPDATE
      SET role = 'consumer', status = 'active', kyc_status = 'approved',
          full_name = 'Demo User', updated_at = now();

    INSERT INTO wallets (user_id, wallet_type, currency, balance)
    VALUES (v_consumer_id, 'consumer', 'USD', 250.00)
    ON CONFLICT (user_id, wallet_type, currency) DO UPDATE
      SET balance = 250.00, status = 'active', updated_at = now();

    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_user_meta_data = raw_user_meta_data || '{"role":"consumer"}'::jsonb
    WHERE id = v_consumer_id;

    RAISE NOTICE 'Demo consumer ready: demo@vpay.app (%)', v_consumer_id;
  ELSE
    RAISE NOTICE 'WARNING: demo@vpay.app not found in auth.users — run seed script first';
  END IF;

  -- ── Demo Agent ────────────────────────────────────────────────────────────
  IF v_agent_id IS NOT NULL THEN
    INSERT INTO profiles (id, email, full_name, role, status, kyc_status)
    VALUES (v_agent_id, 'agent@vpay.app', 'Demo Agent', 'agent', 'active', 'approved')
    ON CONFLICT (id) DO UPDATE
      SET role = 'agent', status = 'active', kyc_status = 'approved',
          full_name = 'Demo Agent', updated_at = now();

    INSERT INTO wallets (user_id, wallet_type, currency, balance)
    VALUES (v_agent_id, 'agent_float', 'USD', 5000.00)
    ON CONFLICT (user_id, wallet_type, currency) DO UPDATE
      SET balance = 5000.00, status = 'active', updated_at = now();

    INSERT INTO agent_profiles (user_id)
    VALUES (v_agent_id)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_user_meta_data = raw_user_meta_data || '{"role":"agent"}'::jsonb
    WHERE id = v_agent_id;

    RAISE NOTICE 'Demo agent ready: agent@vpay.app (%)', v_agent_id;
  ELSE
    RAISE NOTICE 'WARNING: agent@vpay.app not found in auth.users — run seed script first';
  END IF;

  -- ── Demo Admin ────────────────────────────────────────────────────────────
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO profiles (id, email, full_name, role, status, kyc_status)
    VALUES (v_admin_id, 'admin@vpay.app', 'vPay Admin', 'super_admin', 'active', 'approved')
    ON CONFLICT (id) DO UPDATE
      SET role = 'super_admin', status = 'active', kyc_status = 'approved',
          full_name = 'vPay Admin', updated_at = now();

    INSERT INTO wallets (user_id, wallet_type, currency, balance)
    VALUES (v_admin_id, 'consumer', 'USD', 10000.00)
    ON CONFLICT (user_id, wallet_type, currency) DO UPDATE
      SET balance = 10000.00, status = 'active', updated_at = now();

    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_user_meta_data = raw_user_meta_data || '{"role":"super_admin"}'::jsonb
    WHERE id = v_admin_id;

    RAISE NOTICE 'Demo admin ready: admin@vpay.app (%)', v_admin_id;
  ELSE
    RAISE NOTICE 'WARNING: admin@vpay.app not found in auth.users — run seed script first';
  END IF;

END $$;
