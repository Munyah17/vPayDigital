-- =============================================================================
-- Escrow and Disputes — real schemas for two Super Admin command-center modules
-- =============================================================================

CREATE TYPE escrow_status AS ENUM ('pending', 'funded', 'released', 'refunded', 'disputed', 'cancelled');

CREATE TABLE escrow_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference TEXT UNIQUE NOT NULL DEFAULT 'ESC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
  payer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  payee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  payer_wallet_id UUID REFERENCES wallets(id) ON DELETE RESTRICT,
  amount DECIMAL(20, 8) NOT NULL CHECK (amount > 0),
  currency wallet_currency NOT NULL,
  description TEXT NOT NULL,
  status escrow_status NOT NULL DEFAULT 'pending',
  funded_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  released_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_escrow_payer ON escrow_transactions(payer_id);
CREATE INDEX idx_escrow_payee ON escrow_transactions(payee_id);
CREATE INDEX idx_escrow_status ON escrow_transactions(status);

ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escrow_select_own" ON escrow_transactions
  FOR SELECT TO authenticated USING (payer_id = auth.uid() OR payee_id = auth.uid());

CREATE POLICY "escrow_select_admin" ON escrow_transactions
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "escrow_all_service" ON escrow_transactions
  FOR ALL TO service_role USING (true);

CREATE TRIGGER set_updated_at_escrow
  BEFORE UPDATE ON escrow_transactions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================

CREATE TYPE dispute_status AS ENUM ('open', 'investigating', 'resolved', 'rejected');

CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference TEXT UNIQUE NOT NULL DEFAULT 'DSP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
  raised_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  related_transaction_id UUID REFERENCES wallet_transactions(id),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status dispute_status NOT NULL DEFAULT 'open',
  resolution_notes TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_disputes_raised_by ON disputes(raised_by);
CREATE INDEX idx_disputes_status ON disputes(status);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "disputes_select_own" ON disputes
  FOR SELECT TO authenticated USING (raised_by = auth.uid());

CREATE POLICY "disputes_select_admin" ON disputes
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "disputes_insert_own" ON disputes
  FOR INSERT TO authenticated WITH CHECK (raised_by = auth.uid());

CREATE POLICY "disputes_all_service" ON disputes
  FOR ALL TO service_role USING (true);

CREATE TRIGGER set_updated_at_disputes
  BEFORE UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
