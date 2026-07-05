-- =============================================================================
-- Migration 006: Banking Services — IBAN account request pipeline
-- =============================================================================
-- No EU BaaS/EMI provider is contracted yet, so this table tracks IBAN account
-- *requests* through a review/provisioning pipeline rather than calling any
-- provider API. Admins fill in iban/bic/bank_name manually once a provider is
-- signed and an account is actually opened.
-- =============================================================================

CREATE TABLE iban_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'in_review', 'provisioning', 'active', 'rejected')),
  requested_currency wallet_currency NOT NULL DEFAULT 'EUR',
  provider TEXT,
  provider_account_id TEXT,
  iban TEXT,
  bic TEXT,
  bank_name TEXT,
  rejection_reason TEXT,
  requested_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  activated_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (user_id)
);

CREATE INDEX idx_iban_accounts_user_id ON iban_accounts(user_id);
CREATE INDEX idx_iban_accounts_status ON iban_accounts(status);

ALTER TABLE iban_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iban_accounts_select_own" ON iban_accounts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "iban_accounts_select_admin" ON iban_accounts
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "iban_accounts_all_service" ON iban_accounts
  FOR ALL TO service_role USING (true);

CREATE TRIGGER set_updated_at_iban_accounts BEFORE UPDATE ON iban_accounts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
