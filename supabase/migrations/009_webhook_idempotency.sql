-- =============================================================================
-- Webhook idempotency — atomic claim instead of check-then-act
-- =============================================================================
-- The API previously SELECTed webhook_events by idempotency_key, checked the
-- status in application code, then upserted — two near-simultaneous
-- deliveries of the same event (common with payment-provider retries) could
-- both pass the check and both run processWebhookEvent(), double-crediting
-- wallets or double-reversing payouts. This makes the claim one atomic
-- statement: only the caller whose INSERT/UPDATE actually lands may process
-- the event; everyone else is told it's already being handled.

ALTER TYPE webhook_status ADD VALUE IF NOT EXISTS 'processing';

-- Postgres forbids using a new enum value in the same transaction it was
-- added in — CREATE FUNCTION would otherwise fail validating the literals
-- below with "unsafe use of new value of enum type". This migration only
-- runs the ALTER TYPE and CREATE FUNCTION together (never both against live
-- data in the same statement), so disabling the body pre-check is safe here.
SET LOCAL check_function_bodies = off;

CREATE OR REPLACE FUNCTION claim_webhook_event(
  p_idempotency_key TEXT,
  p_event_type webhook_event_type,
  p_source TEXT,
  p_payload JSONB,
  p_signature TEXT
) RETURNS TABLE(id UUID, claimed BOOLEAN) AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO webhook_events (event_type, source, payload, signature, status, idempotency_key, attempts, last_attempt_at)
  VALUES (p_event_type, p_source, p_payload, p_signature, 'processing', p_idempotency_key, 1, now())
  ON CONFLICT (idempotency_key) DO UPDATE
    SET status = 'processing',
        attempts = webhook_events.attempts + 1,
        last_attempt_at = now()
    WHERE webhook_events.status NOT IN ('delivered', 'processing')
  RETURNING webhook_events.id INTO v_id;

  IF v_id IS NULL THEN
    -- Conflict existed and its status was 'delivered' or 'processing' —
    -- someone else already owns this event. Return its id (for logging)
    -- with claimed = false so the caller knows not to reprocess.
    SELECT we.id INTO v_id FROM webhook_events we WHERE we.idempotency_key = p_idempotency_key;
    RETURN QUERY SELECT v_id, FALSE;
  ELSE
    RETURN QUERY SELECT v_id, TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql;
