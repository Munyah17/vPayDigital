-- =============================================================================
-- Value-Added Services orders — Airtime/Data and Electricity Tokens
-- =============================================================================
-- Both are "pay VitalPay to deliver something to a phone/meter number"
-- flows with the same lifecycle (debit wallet -> call VitalPay -> webhook
-- confirms completion/failure), structurally different from vouchers
-- (which are pre-paid, redeemable-by-code) and cards, so they get their
-- own table rather than being force-fit into either.

CREATE TYPE vas_service_type AS ENUM ('airtime', 'data', 'electricity');
CREATE TYPE vas_order_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');

CREATE TABLE vas_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  service_type vas_service_type NOT NULL,
  status vas_order_status NOT NULL DEFAULT 'pending',
  amount DECIMAL(20, 8) NOT NULL CHECK (amount > 0),
  fee DECIMAL(20, 8) NOT NULL DEFAULT 0,
  currency wallet_currency NOT NULL,
  -- airtime/data
  operator_id TEXT,
  phone TEXT,
  -- electricity
  meter_number TEXT,
  token_pieces JSONB,
  units DECIMAL(20, 4),
  -- shared
  reference TEXT UNIQUE NOT NULL,
  provider_reference TEXT,
  provider_payload JSONB DEFAULT '{}',
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_vas_orders_user_id ON vas_orders(user_id);
CREATE INDEX idx_vas_orders_status ON vas_orders(status);
CREATE INDEX idx_vas_orders_reference ON vas_orders(reference);
CREATE INDEX idx_vas_orders_provider_reference ON vas_orders(provider_reference);

ALTER TABLE vas_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vas_orders_select_own" ON vas_orders
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "vas_orders_select_admin" ON vas_orders
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "vas_orders_all_service" ON vas_orders
  FOR ALL TO service_role USING (true);

CREATE TRIGGER set_updated_at_vas_orders
  BEFORE UPDATE ON vas_orders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
