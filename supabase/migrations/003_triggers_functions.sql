-- =============================================================================
-- vPay Triggers, Functions, and Stored Procedures
-- =============================================================================

-- =============================================================================
-- AUTO-UPDATE updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_agent_profiles BEFORE UPDATE ON agent_profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_kyc_documents BEFORE UPDATE ON kyc_documents
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_wallets BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_cards BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_vouchers BEFORE UPDATE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_payout_requests BEFORE UPDATE ON payout_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_support_tickets BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_fee_configs BEFORE UPDATE ON fee_configs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_settlements BEFORE UPDATE ON settlements
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_fraud_flags BEFORE UPDATE ON fraud_flags
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_virtual_accounts BEFORE UPDATE ON virtual_accounts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_beneficiaries BEFORE UPDATE ON beneficiaries
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role := 'consumer';
  v_full_name TEXT;
BEGIN
  -- Extract name from metadata
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Determine role from metadata (only trusted server-side assignment)
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL AND
     NEW.raw_user_meta_data->>'role' IN ('super_admin', 'staff', 'agent', 'consumer') THEN
    v_role := (NEW.raw_user_meta_data->>'role')::user_role;
  END IF;

  INSERT INTO profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    v_role,
    'pending_verification'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- AUTO-CREATE WALLET ON PROFILE CREATION
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default USD wallet
  INSERT INTO wallets (user_id, wallet_type, currency)
  VALUES (
    NEW.id,
    CASE NEW.role WHEN 'agent' THEN 'agent_float'::wallet_type ELSE 'consumer'::wallet_type END,
    'USD'::wallet_currency
  )
  ON CONFLICT (user_id, currency, wallet_type) DO NOTHING;

  -- Create agent profile record if role is agent
  IF NEW.role = 'agent' THEN
    INSERT INTO agent_profiles (user_id) VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile();

-- =============================================================================
-- WALLET BALANCE INTEGRITY CHECK
-- =============================================================================

CREATE OR REPLACE FUNCTION check_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.balance < 0 THEN
    RAISE EXCEPTION 'Insufficient wallet balance. Current: %, Attempted: %',
      OLD.balance, NEW.balance;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_wallet_balance
  BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION check_wallet_balance();

-- =============================================================================
-- WALLET TRANSACTION LEDGER FUNCTION
-- Record a debit transaction atomically
-- =============================================================================

CREATE OR REPLACE FUNCTION record_wallet_debit(
  p_wallet_id UUID,
  p_amount DECIMAL,
  p_type transaction_type,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_reference TEXT DEFAULT NULL
)
RETURNS wallet_transactions AS $$
DECLARE
  v_wallet wallets;
  v_txn wallet_transactions;
  v_ref TEXT;
BEGIN
  -- Lock the wallet row
  SELECT * INTO v_wallet FROM wallets WHERE id = p_wallet_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found: %', p_wallet_id;
  END IF;

  IF v_wallet.status != 'active' THEN
    RAISE EXCEPTION 'Wallet is not active. Status: %', v_wallet.status;
  END IF;

  IF v_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: %, Required: %',
      v_wallet.balance, p_amount;
  END IF;

  -- Generate reference if not provided
  v_ref := COALESCE(p_reference, 'TXN-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 16)));

  -- Insert transaction
  INSERT INTO wallet_transactions (
    wallet_id, user_id, type, direction, amount, fee, net_amount,
    currency, balance_before, balance_after, status,
    reference, description, metadata
  ) VALUES (
    p_wallet_id, v_wallet.user_id, p_type, 'debit', p_amount, 0, p_amount,
    v_wallet.currency, v_wallet.balance, v_wallet.balance - p_amount, 'completed',
    v_ref, p_description, p_metadata
  ) RETURNING * INTO v_txn;

  -- Update wallet balance
  UPDATE wallets SET
    balance = balance - p_amount,
    total_debited = total_debited + p_amount
  WHERE id = p_wallet_id;

  RETURN v_txn;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- WALLET CREDIT FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION record_wallet_credit(
  p_wallet_id UUID,
  p_amount DECIMAL,
  p_type transaction_type,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_reference TEXT DEFAULT NULL
)
RETURNS wallet_transactions AS $$
DECLARE
  v_wallet wallets;
  v_txn wallet_transactions;
  v_ref TEXT;
BEGIN
  SELECT * INTO v_wallet FROM wallets WHERE id = p_wallet_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found: %', p_wallet_id;
  END IF;

  IF v_wallet.status != 'active' THEN
    RAISE EXCEPTION 'Wallet is not active: %', v_wallet.status;
  END IF;

  v_ref := COALESCE(p_reference, 'TXN-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 16)));

  INSERT INTO wallet_transactions (
    wallet_id, user_id, type, direction, amount, fee, net_amount,
    currency, balance_before, balance_after, status,
    reference, description, metadata
  ) VALUES (
    p_wallet_id, v_wallet.user_id, p_type, 'credit', p_amount, 0, p_amount,
    v_wallet.currency, v_wallet.balance, v_wallet.balance + p_amount, 'completed',
    v_ref, p_description, p_metadata
  ) RETURNING * INTO v_txn;

  UPDATE wallets SET
    balance = balance + p_amount,
    total_credited = total_credited + p_amount
  WHERE id = p_wallet_id;

  RETURN v_txn;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- VOUCHER CODE GENERATION
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_voucher_code(prefix TEXT DEFAULT 'VP')
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_code := prefix || '-' ||
      upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)) || '-' ||
      upper(substr(md5(random()::text), 1, 4)) || '-' ||
      upper(substr(md5(clock_timestamp()::text), 1, 4));

    SELECT EXISTS(SELECT 1 FROM vouchers WHERE code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VOUCHER REDEMPTION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION redeem_voucher(
  p_code TEXT,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_voucher vouchers;
  v_wallet wallets;
  v_result JSONB;
BEGIN
  -- Lock and fetch voucher
  SELECT * INTO v_voucher FROM vouchers WHERE code = p_code FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher not found');
  END IF;

  IF v_voucher.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher is ' || v_voucher.status);
  END IF;

  IF v_voucher.expires_at < now() THEN
    UPDATE vouchers SET status = 'expired' WHERE id = v_voucher.id;
    RETURN jsonb_build_object('success', false, 'error', 'Voucher has expired');
  END IF;

  IF v_voucher.redemption_count >= v_voucher.max_redemptions THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher redemption limit reached');
  END IF;

  -- Get user wallet
  SELECT * INTO v_wallet FROM wallets
  WHERE user_id = p_user_id AND currency = v_voucher.currency AND wallet_type = 'consumer'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User wallet not found');
  END IF;

  -- Mark voucher as redeemed
  UPDATE vouchers SET
    status = CASE WHEN redemption_count + 1 >= max_redemptions THEN 'redeemed' ELSE status END,
    redemption_count = redemption_count + 1,
    redeemed_by = p_user_id,
    redeemed_at = now()
  WHERE id = v_voucher.id;

  v_result := jsonb_build_object(
    'success', true,
    'voucher_id', v_voucher.id,
    'voucher_type', v_voucher.type,
    'amount', v_voucher.amount,
    'currency', v_voucher.currency,
    'gift_card_brand', v_voucher.gift_card_brand,
    'service_metadata', v_voucher.service_metadata
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- AUDIT LOG HELPER
-- =============================================================================

CREATE OR REPLACE FUNCTION create_audit_log(
  p_actor_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_changes JSONB DEFAULT '{}',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, changes, metadata)
  VALUES (p_actor_id, p_action, p_resource_type, p_resource_id, p_changes, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- CARD EXHAUSTION CHECK
-- =============================================================================

CREATE OR REPLACE FUNCTION check_card_exhaustion()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-terminate single-use cards when balance hits 0
  IF NEW.current_balance = 0 AND OLD.current_balance > 0 AND
     NEW.card_type = 'single_use' AND NEW.status = 'active' THEN
    NEW.status = 'exhausted';
    NEW.terminated_at = now();
  END IF;

  -- Auto-expire time-limited cards
  IF NEW.expires_at IS NOT NULL AND NEW.expires_at < now() AND NEW.status = 'active' THEN
    NEW.status = 'expired';
    NEW.terminated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_card_status
  BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION check_card_exhaustion();

-- =============================================================================
-- FRAUD SCORE CALCULATION
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_fraud_score(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_score DECIMAL := 0;
  v_failed_txns INTEGER;
  v_recent_cards INTEGER;
  v_flags INTEGER;
BEGIN
  -- Check recent failed transactions (last 24h)
  SELECT COUNT(*) INTO v_failed_txns
  FROM wallet_transactions
  WHERE user_id = p_user_id
    AND status = 'failed'
    AND created_at > now() - INTERVAL '24 hours';

  v_score := v_score + LEAST(v_failed_txns * 5, 25);

  -- Check rapid card issuance (last 1h)
  SELECT COUNT(*) INTO v_recent_cards
  FROM cards
  WHERE user_id = p_user_id
    AND created_at > now() - INTERVAL '1 hour';

  v_score := v_score + LEAST(v_recent_cards * 10, 30);

  -- Existing open fraud flags
  SELECT COUNT(*) INTO v_flags
  FROM fraud_flags
  WHERE user_id = p_user_id AND status = 'open';

  v_score := v_score + LEAST(v_flags * 15, 45);

  RETURN LEAST(v_score, 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PLATFORM ANALYTICS VIEWS
-- =============================================================================

CREATE OR REPLACE VIEW vw_platform_metrics AS
SELECT
  (SELECT COUNT(*) FROM profiles WHERE role = 'consumer') AS total_consumers,
  (SELECT COUNT(*) FROM profiles WHERE role = 'agent') AS total_agents,
  (SELECT COUNT(*) FROM profiles WHERE created_at > now() - INTERVAL '24 hours') AS new_users_24h,
  (SELECT COUNT(*) FROM cards WHERE status = 'active') AS active_cards,
  (SELECT COUNT(*) FROM cards WHERE created_at > now() - INTERVAL '24 hours') AS cards_issued_24h,
  (SELECT COUNT(*) FROM vouchers WHERE created_at > now() - INTERVAL '24 hours') AS vouchers_issued_24h,
  (SELECT COUNT(*) FROM vouchers WHERE redeemed_at > now() - INTERVAL '24 hours') AS vouchers_redeemed_24h,
  (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions
   WHERE direction = 'credit' AND created_at > now() - INTERVAL '24 hours') AS volume_24h,
  (SELECT COALESCE(SUM(balance), 0) FROM wallets WHERE wallet_type = 'master_pool') AS master_pool_balance,
  (SELECT COUNT(*) FROM fraud_flags WHERE status = 'open' AND severity IN ('high', 'critical')) AS critical_fraud_flags,
  (SELECT COUNT(*) FROM support_tickets WHERE status = 'open') AS open_support_tickets;

-- =============================================================================
-- AGENT ANALYTICS VIEW
-- =============================================================================

CREATE OR REPLACE VIEW vw_agent_metrics AS
SELECT
  p.id AS agent_id,
  p.full_name,
  ap.business_name,
  ap.agent_tier,
  ap.commission_rate,
  w.balance AS float_balance,
  w.currency,
  (SELECT COUNT(*) FROM vouchers v WHERE v.issuer_id = p.id) AS total_vouchers_issued,
  (SELECT COUNT(*) FROM vouchers v WHERE v.issuer_id = p.id AND v.status = 'redeemed') AS vouchers_redeemed,
  (SELECT COUNT(*) FROM cards c WHERE c.issued_by_agent = p.id) AS total_cards_issued,
  (SELECT COALESCE(SUM(amount), 0) FROM commissions cm WHERE cm.agent_id = p.id AND cm.status = 'completed') AS total_commissions_earned
FROM profiles p
JOIN agent_profiles ap ON ap.user_id = p.id
LEFT JOIN wallets w ON w.user_id = p.id AND w.wallet_type = 'agent_float' AND w.currency = 'USD'
WHERE p.role = 'agent';

-- =============================================================================
-- NOTIFICATION TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_card_issued()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
    INSERT INTO notifications (user_id, type, channel, title, body, data)
    VALUES (
      NEW.user_id,
      'card_issued',
      'in_app',
      'Virtual Card Issued',
      'Your ' || NEW.network || ' virtual card ending in ' || COALESCE(NEW.last_four, '****') || ' is now active.',
      jsonb_build_object('card_id', NEW.id, 'network', NEW.network, 'last_four', NEW.last_four)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_card_issued
  AFTER INSERT OR UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION notify_on_card_issued();

-- =============================================================================
-- LOW BALANCE NOTIFICATION
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_low_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.balance < 10 AND OLD.balance >= 10 THEN
    INSERT INTO notifications (user_id, type, channel, title, body, data)
    VALUES (
      NEW.user_id,
      'low_balance',
      'in_app',
      'Low Wallet Balance',
      'Your ' || NEW.currency || ' wallet balance is below $10. Top up now to continue.',
      jsonb_build_object('wallet_id', NEW.id, 'balance', NEW.balance, 'currency', NEW.currency)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_low_balance
  AFTER UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION notify_low_balance();

-- =============================================================================
-- INSERT DEFAULT SYSTEM CONFIG
-- =============================================================================

INSERT INTO system_config (key, value, description, is_public) VALUES
  ('platform_name', '"vPay"', 'Platform brand name', true),
  ('platform_version', '"1.0.0"', 'Current platform version', true),
  ('maintenance_mode', 'false', 'Enable maintenance mode', false),
  ('min_card_load_usd', '5', 'Minimum card load amount in USD', true),
  ('max_card_load_usd', '10000', 'Maximum card load amount in USD', true),
  ('default_card_expiry_months', '24', 'Default card expiry in months', true),
  ('voucher_expiry_days', '30', 'Default voucher expiry in days', true),
  ('max_cards_per_user', '10', 'Maximum active cards per consumer', false),
  ('max_daily_issuance_per_agent', '100', 'Max vouchers an agent can issue per day', false),
  ('fraud_auto_suspend_score', '80', 'Risk score threshold for auto-suspend', false),
  ('supported_currencies', '["USD","EUR","GBP","ZAR","NGN","GHS"]', 'Supported currencies', true),
  ('card_networks', '["visa","mastercard"]', 'Supported card networks', true),
  ('kyc_required_for_cards', 'true', 'Require KYC before card issuance', false),
  ('referral_bonus_usd', '2', 'Referral bonus in USD', true);
