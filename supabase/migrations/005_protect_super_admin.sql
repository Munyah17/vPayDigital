-- =============================================================================
-- Migration 005: Super Admin account protection
-- =============================================================================
-- The super_admin account (munyamuzvidziwa19@gmail.com) is the master account.
-- Rules enforced at DB level:
--   1. Super admin profiles CANNOT be deleted (by anyone, including service role)
--   2. Super admin auth.users row CANNOT be deleted
--   3. Super admin role and email CANNOT be changed
--   4. Status can never be set to 'suspended' or 'closed' for super_admin
-- =============================================================================

-- ─── 1. Protect profiles from deletion ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.protect_super_admin_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.role = 'super_admin' THEN
    RAISE EXCEPTION 'Super Admin account cannot be deleted.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_super_admin_delete ON public.profiles;
CREATE TRIGGER trg_protect_super_admin_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_delete();

-- ─── 2. Protect auth.users from deletion (prevents cascade delete bypass) ────

CREATE OR REPLACE FUNCTION public.protect_super_admin_auth_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = OLD.id AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Super Admin auth account cannot be deleted.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_super_admin_auth_delete ON auth.users;
CREATE TRIGGER trg_protect_super_admin_auth_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_auth_delete();

-- ─── 3. Protect role, email, and status from tampering ────────────────────────

CREATE OR REPLACE FUNCTION public.protect_super_admin_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.role = 'super_admin' THEN
    IF NEW.role != 'super_admin' THEN
      RAISE EXCEPTION 'Super Admin role cannot be changed.';
    END IF;
    IF NEW.email != OLD.email THEN
      RAISE EXCEPTION 'Super Admin email cannot be changed.';
    END IF;
    IF NEW.status IN ('suspended', 'closed') THEN
      RAISE EXCEPTION 'Super Admin account cannot be suspended or closed.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_super_admin_update ON public.profiles;
CREATE TRIGGER trg_protect_super_admin_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_update();

-- ─── 4. Ensure the super admin profile is always active ───────────────────────

UPDATE public.profiles
SET
  role       = 'super_admin',
  status     = 'active',
  kyc_status = 'approved'
WHERE email = 'munyamuzvidziwa19@gmail.com';
