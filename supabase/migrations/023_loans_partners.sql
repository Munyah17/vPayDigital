-- =============================================================================
-- Loans and Partners — two Super Admin command-center modules
-- =============================================================================

CREATE TYPE loan_status AS ENUM ('pending', 'approved', 'active', 'repaid', 'defaulted', 'rejected');

CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference TEXT UNIQUE NOT NULL DEFAULT 'LOAN-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
  borrower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  principal DECIMAL(20, 2) NOT NULL CHECK (principal > 0),
  interest_rate_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
  term_months INTEGER NOT NULL CHECK (term_months > 0),
  currency wallet_currency NOT NULL DEFAULT 'USD',
  status loan_status NOT NULL DEFAULT 'pending',
  total_repayable DECIMAL(20, 2),
  amount_repaid DECIMAL(20, 2) NOT NULL DEFAULT 0,
  disbursed_at TIMESTAMPTZ,
  due_date DATE,
  notes TEXT,
  approved_by UUID REFERENCES profiles(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_loans_borrower ON loans(borrower_id);
CREATE INDEX idx_loans_status ON loans(status);

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loans_select_own" ON loans FOR SELECT TO authenticated USING (borrower_id = auth.uid());
CREATE POLICY "loans_select_admin" ON loans FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "loans_write_admin" ON loans FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "loans_update_admin" ON loans FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "loans_all_service" ON loans FOR ALL TO service_role USING (true);

CREATE TRIGGER set_updated_at_loans
  BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================

CREATE TYPE partner_status AS ENUM ('active', 'inactive', 'pending');

CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  revenue_share_percent DECIMAL(5, 2),
  status partner_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partners_all_admin" ON partners FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "partners_all_service" ON partners FOR ALL TO service_role USING (true);
