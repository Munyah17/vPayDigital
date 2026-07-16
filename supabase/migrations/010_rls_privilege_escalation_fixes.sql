-- =============================================================================
-- Close privilege-escalation gaps in RLS policies and the signup trigger
-- =============================================================================

-- 1. profiles_update_admin had USING (is_admin()) with no WITH CHECK, so
--    Postgres reused USING as the check — which only tests the actor's
--    CURRENT role, never the target row's new values. Any staff account
--    (not just super_admin) could run
--      UPDATE profiles SET role = 'super_admin' WHERE id = <own id>
--    directly against PostgREST with their own JWT. Role changes must go
--    through the backend's requireSuperAdmin-gated endpoints, which use the
--    service_role key (profiles_all_service, unaffected by this policy) —
--    so this policy should never permit a role change at all.
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (
    is_admin() AND
    role = (SELECT p.role FROM profiles p WHERE p.id = profiles.id)
  );

-- 2. Same gap on payout_requests: any staff account could rewrite
--    beneficiary_account / beneficiary_bank / amount / currency / user_id
--    on a pending payout via PostgREST — a classic insider-fraud vector for
--    redirecting outbound funds. The backend's own PATCH endpoint only ever
--    touches status/notes/processed_by/processed_at, so lock the RLS policy
--    down to match that shape.
DROP POLICY IF EXISTS "payout_update_admin" ON payout_requests;
CREATE POLICY "payout_update_admin" ON payout_requests
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (
    is_admin() AND
    ROW(amount, currency, user_id, wallet_id, beneficiary_name, beneficiary_account,
        beneficiary_bank, beneficiary_bank_code, beneficiary_country,
        crypto_address, crypto_network, mobile_number, mobile_provider)
    IS NOT DISTINCT FROM (
      SELECT ROW(p.amount, p.currency, p.user_id, p.wallet_id, p.beneficiary_name,
                 p.beneficiary_account, p.beneficiary_bank, p.beneficiary_bank_code,
                 p.beneficiary_country, p.crypto_address, p.crypto_network,
                 p.mobile_number, p.mobile_provider)
      FROM payout_requests p WHERE p.id = payout_requests.id
    )
  );

-- 3. handle_new_user() let public signup (anon key, client-controlled
--    raw_user_meta_data) self-assign 'super_admin' or 'staff' as long as the
--    value matched the enum — the frontend only ever offers consumer/agent,
--    but nothing stopped a direct POST to Supabase Auth's signup endpoint
--    with data: { role: 'super_admin' }. Staff/super_admin accounts are
--    only ever created via POST /api/admin/staff and the seed script, both
--    of which explicitly set the role afterward through the service_role
--    key (profiles_all_service) regardless of what this trigger assigns —
--    so self-service signup should never be trusted with more than
--    consumer/agent.
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

  IF NEW.raw_user_meta_data->>'role' IN ('agent', 'consumer') THEN
    v_role := (NEW.raw_user_meta_data->>'role')::public.user_role;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (NEW.id, NEW.email, v_full_name, v_role, 'pending_verification')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
