-- =============================================================================
-- Migration 008: Fix voucher redemption to actually credit the wallet
-- =============================================================================
-- Vouchers exist to fund a user's wallet (ledger); virtual cards then draw
-- their balance from the wallet. redeem_voucher() was marking vouchers as
-- redeemed but never crediting the wallet — cards funded via a "virtual_card"
-- voucher only worked if the wallet already independently had enough balance.
-- This adds the missing record_wallet_credit call.
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

  -- Credit the voucher's value to the user's wallet — this is the step that
  -- was missing. Card issuance (for virtual_card-type vouchers) then draws
  -- from this same wallet balance, same as any other card load.
  PERFORM record_wallet_credit(
    v_wallet.id,
    v_voucher.amount,
    'voucher_redemption',
    'Voucher redeemed: ' || v_voucher.code,
    jsonb_build_object('voucher_id', v_voucher.id, 'voucher_code', v_voucher.code)
  );

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
