-- =============================================================================
-- Mass Communication, Marketing (promo codes), and Leads — three Super Admin
-- command-center modules
-- =============================================================================

CREATE TYPE communication_channel AS ENUM ('email', 'sms', 'push');
CREATE TYPE communication_status AS ENUM ('draft', 'sending', 'sent', 'failed');

CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel communication_channel NOT NULL DEFAULT 'email',
  segment TEXT NOT NULL DEFAULT 'all',
  subject TEXT,
  message TEXT NOT NULL,
  status communication_status NOT NULL DEFAULT 'draft',
  recipient_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "communications_all_admin" ON communications FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "communications_all_service" ON communications FOR ALL TO service_role USING (true);

-- =============================================================================

CREATE TYPE promo_discount_type AS ENUM ('percent', 'flat');

CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_type promo_discount_type NOT NULL DEFAULT 'percent',
  discount_value DECIMAL(10, 2) NOT NULL CHECK (discount_value > 0),
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  min_amount DECIMAL(20, 8),
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_codes_select_active" ON promo_codes
  FOR SELECT TO authenticated USING (active = true OR is_admin());
CREATE POLICY "promo_codes_write_admin" ON promo_codes
  FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "promo_codes_update_admin" ON promo_codes
  FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "promo_codes_all_service" ON promo_codes FOR ALL TO service_role USING (true);

-- =============================================================================

CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'converted', 'lost');

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  source TEXT,
  status lead_status NOT NULL DEFAULT 'new',
  notes TEXT,
  assigned_to UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_all_admin" ON leads FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "leads_all_service" ON leads FOR ALL TO service_role USING (true);

CREATE TRIGGER set_updated_at_leads
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
