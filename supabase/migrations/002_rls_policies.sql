-- =============================================================================
-- vPay Row Level Security Policies
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT role IN ('super_admin', 'staff') FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT role = 'super_admin' FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_agent()
RETURNS BOOLEAN AS $$
  SELECT role = 'agent' FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================================================
-- PROFILES POLICIES
-- =============================================================================

-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Admins can read all profiles
CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT TO authenticated
  USING (is_admin());

-- Agents can read consumer profiles they issued cards to
CREATE POLICY "profiles_select_agent_consumers" ON profiles
  FOR SELECT TO authenticated
  USING (
    is_agent() AND
    id IN (SELECT DISTINCT user_id FROM cards WHERE issued_by_agent = auth.uid())
  );

-- Users can update their own profile (restricted fields)
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- Admins can update any profile
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE TO authenticated
  USING (is_admin());

-- Service role can do anything (used by backend)
CREATE POLICY "profiles_all_service" ON profiles
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- AGENT PROFILES POLICIES
-- =============================================================================

CREATE POLICY "agent_profiles_select_own" ON agent_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "agent_profiles_select_admin" ON agent_profiles
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "agent_profiles_all_service" ON agent_profiles
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- KYC DOCUMENTS POLICIES
-- =============================================================================

CREATE POLICY "kyc_select_own" ON kyc_documents
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "kyc_insert_own" ON kyc_documents
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "kyc_select_admin" ON kyc_documents
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "kyc_update_admin" ON kyc_documents
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "kyc_all_service" ON kyc_documents
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- WALLETS POLICIES
-- =============================================================================

CREATE POLICY "wallets_select_own" ON wallets
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "wallets_select_admin" ON wallets
  FOR SELECT TO authenticated USING (is_admin());

-- Agents can see consumer wallets for their issued cards
CREATE POLICY "wallets_select_agent" ON wallets
  FOR SELECT TO authenticated
  USING (
    is_agent() AND
    user_id IN (SELECT DISTINCT user_id FROM cards WHERE issued_by_agent = auth.uid())
  );

CREATE POLICY "wallets_all_service" ON wallets
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- WALLET TRANSACTIONS POLICIES
-- =============================================================================

CREATE POLICY "wallet_txn_select_own" ON wallet_transactions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "wallet_txn_select_admin" ON wallet_transactions
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "wallet_txn_all_service" ON wallet_transactions
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- EXCHANGE RATES POLICIES
-- =============================================================================

-- Exchange rates are public read
CREATE POLICY "exchange_rates_select_public" ON exchange_rates
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "exchange_rates_all_admin" ON exchange_rates
  FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "exchange_rates_all_service" ON exchange_rates
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- CARDS POLICIES
-- =============================================================================

CREATE POLICY "cards_select_own" ON cards
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "cards_select_admin" ON cards
  FOR SELECT TO authenticated USING (is_admin());

-- Agents can see cards they issued
CREATE POLICY "cards_select_issued" ON cards
  FOR SELECT TO authenticated
  USING (is_agent() AND issued_by_agent = auth.uid());

CREATE POLICY "cards_all_service" ON cards
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- CARD TRANSACTIONS POLICIES
-- =============================================================================

CREATE POLICY "card_txn_select_own" ON card_transactions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "card_txn_select_admin" ON card_transactions
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "card_txn_all_service" ON card_transactions
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- VOUCHERS POLICIES
-- =============================================================================

-- Issuer can see their vouchers
CREATE POLICY "vouchers_select_issuer" ON vouchers
  FOR SELECT TO authenticated USING (issuer_id = auth.uid());

-- Redeemer can see their vouchers
CREATE POLICY "vouchers_select_redeemer" ON vouchers
  FOR SELECT TO authenticated USING (redeemed_by = auth.uid());

-- Admins can see all
CREATE POLICY "vouchers_select_admin" ON vouchers
  FOR SELECT TO authenticated USING (is_admin());

-- Agents can create vouchers
CREATE POLICY "vouchers_insert_agent" ON vouchers
  FOR INSERT TO authenticated
  WITH CHECK (issuer_id = auth.uid() AND is_agent());

CREATE POLICY "vouchers_all_service" ON vouchers
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- PAYOUT REQUESTS POLICIES
-- =============================================================================

CREATE POLICY "payout_select_own" ON payout_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "payout_insert_own" ON payout_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "payout_select_admin" ON payout_requests
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "payout_update_admin" ON payout_requests
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "payout_all_service" ON payout_requests
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- COMMISSIONS POLICIES
-- =============================================================================

CREATE POLICY "commissions_select_own" ON commissions
  FOR SELECT TO authenticated USING (agent_id = auth.uid());

CREATE POLICY "commissions_select_admin" ON commissions
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "commissions_all_service" ON commissions
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- FEE CONFIGS POLICIES
-- =============================================================================

CREATE POLICY "fee_configs_select_all" ON fee_configs
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "fee_configs_manage_admin" ON fee_configs
  FOR ALL TO authenticated USING (is_super_admin());

CREATE POLICY "fee_configs_all_service" ON fee_configs
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- SETTLEMENTS POLICIES
-- =============================================================================

CREATE POLICY "settlements_select_admin" ON settlements
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "settlements_manage_admin" ON settlements
  FOR ALL TO authenticated USING (is_super_admin());

CREATE POLICY "settlements_all_service" ON settlements
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- WEBHOOK EVENTS POLICIES
-- =============================================================================

CREATE POLICY "webhook_events_select_admin" ON webhook_events
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "webhook_events_all_service" ON webhook_events
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- PROVIDER LOGS POLICIES
-- =============================================================================

CREATE POLICY "provider_logs_select_admin" ON provider_logs
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "provider_logs_all_service" ON provider_logs
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- FRAUD FLAGS POLICIES
-- =============================================================================

CREATE POLICY "fraud_flags_select_own" ON fraud_flags
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND severity NOT IN ('high', 'critical'));

CREATE POLICY "fraud_flags_select_admin" ON fraud_flags
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "fraud_flags_all_service" ON fraud_flags
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- SUPPORT TICKETS POLICIES
-- =============================================================================

CREATE POLICY "support_select_own" ON support_tickets
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "support_insert_own" ON support_tickets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "support_select_admin" ON support_tickets
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "support_update_admin" ON support_tickets
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "support_all_service" ON support_tickets
  FOR ALL TO service_role USING (true);

CREATE POLICY "support_messages_select" ON support_ticket_messages
  FOR SELECT TO authenticated
  USING (
    ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.uid())
    OR is_admin()
    OR (is_internal = false AND is_admin())
  );

CREATE POLICY "support_messages_insert" ON support_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    (ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.uid()) OR is_admin())
  );

CREATE POLICY "support_messages_all_service" ON support_ticket_messages
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- NOTIFICATIONS POLICIES
-- =============================================================================

CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_all_service" ON notifications
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- AUDIT LOGS POLICIES
-- =============================================================================

CREATE POLICY "audit_logs_select_admin" ON audit_logs
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "audit_logs_select_own" ON audit_logs
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid() AND action NOT IN ('fraud.detected', 'user.suspended'));

CREATE POLICY "audit_logs_insert_service" ON audit_logs
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "audit_logs_all_service" ON audit_logs
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- USER SESSIONS POLICIES
-- =============================================================================

CREATE POLICY "sessions_select_own" ON user_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "sessions_select_admin" ON user_sessions
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "sessions_all_service" ON user_sessions
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- VIRTUAL ACCOUNTS POLICIES
-- =============================================================================

CREATE POLICY "virtual_accounts_select_own" ON virtual_accounts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "virtual_accounts_select_admin" ON virtual_accounts
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "virtual_accounts_all_service" ON virtual_accounts
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- BENEFICIARIES POLICIES
-- =============================================================================

CREATE POLICY "beneficiaries_crud_own" ON beneficiaries
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "beneficiaries_all_service" ON beneficiaries
  FOR ALL TO service_role USING (true);

-- =============================================================================
-- SYSTEM CONFIG POLICIES
-- =============================================================================

CREATE POLICY "system_config_select_public" ON system_config
  FOR SELECT TO authenticated USING (is_public = true);

CREATE POLICY "system_config_select_admin" ON system_config
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "system_config_manage_super_admin" ON system_config
  FOR ALL TO authenticated USING (is_super_admin());

CREATE POLICY "system_config_all_service" ON system_config
  FOR ALL TO service_role USING (true);
