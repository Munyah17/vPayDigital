-- =============================================================================
-- Migration 004: Fix trigger functions
-- =============================================================================
-- Root cause of "Database error saving new user":
--   New Supabase projects run postgres with search_path = '' for security.
--   Unqualified table names (profiles, wallets) cause "relation not found".
--   Fix: SET search_path = '' on each SECURITY DEFINER function and use
--   fully-qualified names (public.profiles, public.wallets, etc.).
--   Also adds ON CONFLICT clauses to make all inserts idempotent.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role public.user_role := 'consumer';
  v_full_name TEXT;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Only promote role if it's a trusted value; consumers self-select consumer/agent
  IF NEW.raw_user_meta_data->>'role' IN ('super_admin', 'staff', 'agent', 'consumer') THEN
    v_role := (NEW.raw_user_meta_data->>'role')::public.user_role;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (NEW.id, NEW.email, v_full_name, v_role, 'pending_verification')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.wallets (user_id, wallet_type, currency)
  VALUES (
    NEW.id,
    CASE NEW.role
      WHEN 'agent' THEN 'agent_float'::public.wallet_type
      ELSE 'consumer'::public.wallet_type
    END,
    'USD'::public.wallet_currency
  )
  ON CONFLICT (user_id, currency, wallet_type) DO NOTHING;

  IF NEW.role = 'agent' THEN
    INSERT INTO public.agent_profiles (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
