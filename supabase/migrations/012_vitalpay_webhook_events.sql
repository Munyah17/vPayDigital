-- =============================================================================
-- Add webhook_event_type values for VitalPay events that don't map onto an
-- existing Fincra-shaped value
-- =============================================================================

ALTER TYPE webhook_event_type ADD VALUE IF NOT EXISTS 'payment.failed';
ALTER TYPE webhook_event_type ADD VALUE IF NOT EXISTS 'payment.pending';
ALTER TYPE webhook_event_type ADD VALUE IF NOT EXISTS 'refund.processed';
ALTER TYPE webhook_event_type ADD VALUE IF NOT EXISTS 'service.processing';
ALTER TYPE webhook_event_type ADD VALUE IF NOT EXISTS 'service.completed';
ALTER TYPE webhook_event_type ADD VALUE IF NOT EXISTS 'service.failed';
