-- =============================================================================
-- HR & Payroll — manages ePay Smart's own staff, not platform users. Flagged
-- to the business owner as worth confirming this belongs in this admin at
-- all vs. a separate internal tool, but built for real per "build all of it."
-- =============================================================================

CREATE TABLE staff_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  job_title TEXT,
  department TEXT,
  employment_type TEXT NOT NULL DEFAULT 'full_time',
  base_salary DECIMAL(20, 2) NOT NULL DEFAULT 0,
  currency wallet_currency NOT NULL DEFAULT 'USD',
  start_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (profile_id)
);

ALTER TABLE staff_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_records_all_admin" ON staff_records FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "staff_records_all_service" ON staff_records FOR ALL TO service_role USING (true);

CREATE TRIGGER set_updated_at_staff_records
  BEFORE UPDATE ON staff_records
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================

CREATE TYPE payroll_status AS ENUM ('draft', 'processed', 'paid');

CREATE TABLE payroll_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference TEXT UNIQUE NOT NULL DEFAULT 'PAY-' || to_char(now(), 'YYYYMM') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status payroll_status NOT NULL DEFAULT 'draft',
  total_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
  currency wallet_currency NOT NULL DEFAULT 'USD',
  created_by UUID REFERENCES profiles(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_runs_all_admin" ON payroll_runs FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "payroll_runs_all_service" ON payroll_runs FOR ALL TO service_role USING (true);

CREATE TABLE payroll_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  staff_record_id UUID NOT NULL REFERENCES staff_records(id) ON DELETE RESTRICT,
  gross_amount DECIMAL(20, 2) NOT NULL,
  deductions DECIMAL(20, 2) NOT NULL DEFAULT 0,
  net_amount DECIMAL(20, 2) NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_items_all_admin" ON payroll_items FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "payroll_items_all_service" ON payroll_items FOR ALL TO service_role USING (true);
