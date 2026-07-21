-- =============================================================================
-- Invoicing, Quotations & Receipting — the biggest single Super Admin module:
-- a real billing subsystem for business clients (not platform end users).
-- =============================================================================

CREATE TABLE billing_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE billing_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_clients_all_admin" ON billing_clients FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "billing_clients_all_service" ON billing_clients FOR ALL TO service_role USING (true);

-- =============================================================================

CREATE TYPE quotation_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');

CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_number TEXT UNIQUE NOT NULL DEFAULT 'QUO-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  client_id UUID NOT NULL REFERENCES billing_clients(id) ON DELETE RESTRICT,
  line_items JSONB NOT NULL DEFAULT '[]',
  currency wallet_currency NOT NULL DEFAULT 'USD',
  subtotal DECIMAL(20, 2) NOT NULL DEFAULT 0,
  tax_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
  total DECIMAL(20, 2) NOT NULL DEFAULT 0,
  status quotation_status NOT NULL DEFAULT 'draft',
  valid_until DATE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotations_all_admin" ON quotations FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "quotations_all_service" ON quotations FOR ALL TO service_role USING (true);

CREATE TRIGGER set_updated_at_quotations
  BEFORE UPDATE ON quotations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================

CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT UNIQUE NOT NULL DEFAULT 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  client_id UUID NOT NULL REFERENCES billing_clients(id) ON DELETE RESTRICT,
  quotation_id UUID REFERENCES quotations(id),
  line_items JSONB NOT NULL DEFAULT '[]',
  currency wallet_currency NOT NULL DEFAULT 'USD',
  subtotal DECIMAL(20, 2) NOT NULL DEFAULT 0,
  tax_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
  total DECIMAL(20, 2) NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'draft',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_all_admin" ON invoices FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "invoices_all_service" ON invoices FOR ALL TO service_role USING (true);

CREATE TRIGGER set_updated_at_invoices
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================

CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number TEXT UNIQUE NOT NULL DEFAULT 'RCT-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  amount DECIMAL(20, 2) NOT NULL,
  currency wallet_currency NOT NULL,
  payment_method TEXT,
  issued_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receipts_all_admin" ON receipts FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "receipts_all_service" ON receipts FOR ALL TO service_role USING (true);
