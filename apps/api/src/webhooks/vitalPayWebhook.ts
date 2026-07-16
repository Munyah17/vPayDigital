// =============================================================================
// VitalPay Webhook Handler
// =============================================================================
// Signature algorithm (HMAC-SHA256 hex of the raw body) is NOT confirmed
// against a real VitalPay delivery — see verifyVitalPaySignature's own
// comment in @vpay/provider-vitalpay. Verify against a real webhook or
// VitalPay/KMG support before relying on this for anything security-
// critical, and adjust verifyVitalPaySignature if it doesn't match.

import { Request, Response } from 'express';
import { verifyVitalPaySignature } from '@vpay/provider-vitalpay';
import type { VitalPayPayment } from '@vpay/provider-vitalpay';
import { supabaseAdmin } from '../utils/supabase.js';
import { env } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { settleWalletTopup } from '../services/vitalPayPaymentService.js';

export async function handleVitalPayWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers['x-vitalpay-signature'] as string;
  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body);

  if (!env.VITALPAY_WEBHOOK_SECRET) {
    logger.error('VitalPay webhook received but VITALPAY_WEBHOOK_SECRET is not configured — rejecting');
    res.status(401).json({ error: 'Webhook not configured' });
    return;
  }

  if (!verifyVitalPaySignature(rawBody, signature, env.VITALPAY_WEBHOOK_SECRET)) {
    logger.warn({ url: req.url }, 'Invalid VitalPay webhook signature');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const payload = req.body as { event: string; data: Record<string, unknown> };
  const eventType = mapVitalPayEvent(payload.event);
  const stableId = (payload.data?.reference as string) ?? (payload.data?.platform_reference as string);

  if (!stableId) {
    logger.warn({ event: payload.event }, 'VitalPay webhook payload has no reference — cannot dedupe, processing best-effort');
  }
  const idempotencyKey = `${payload.event}-${stableId ?? Date.now()}`;

  const { data: claimRows, error: claimErr } = await supabaseAdmin.rpc('claim_webhook_event', {
    p_idempotency_key: idempotencyKey,
    p_event_type: eventType,
    p_source: 'vitalpay',
    p_payload: payload.data,
    p_signature: signature,
  });

  if (claimErr) {
    logger.error({ claimErr, event: payload.event }, 'Failed to claim VitalPay webhook event');
    res.status(500).json({ success: false, error: 'Failed to record webhook event' });
    return;
  }

  const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
  if (!claim?.claimed) {
    res.json({ success: true, message: 'Already processed or in progress' });
    return;
  }

  try {
    await processVitalPayEvent(payload.event, payload.data);
    await supabaseAdmin
      .from('webhook_events')
      .update({ status: 'delivered', processed_at: new Date().toISOString() })
      .eq('id', claim.id);
    res.json({ success: true, received: true });
  } catch (err) {
    logger.error({ err, event: payload.event }, 'VitalPay webhook processing failed');
    await supabaseAdmin
      .from('webhook_events')
      .update({ status: 'failed', error_message: err instanceof Error ? err.message : 'Unknown error' })
      .eq('id', claim.id);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
}

async function processVitalPayEvent(event: string, data: Record<string, unknown>): Promise<void> {
  switch (event) {
    case 'payment.success': {
      await settleWalletTopup(data as unknown as VitalPayPayment);
      break;
    }

    case 'payment.failed':
    case 'payment.pending': {
      logger.info({ reference: data.reference, event }, 'VitalPay payment did not complete');
      break;
    }

    case 'refund.processed': {
      // No wallet-side effect wired yet — refunds against a wallet top-up
      // would need to debit the wallet back, but there's no case in this
      // codebase today that issues a VitalPay refund. Logged for visibility
      // so it isn't silently dropped if that changes.
      logger.warn({ reference: data.reference }, 'VitalPay refund.processed received — no automatic wallet debit wired up yet');
      break;
    }

    case 'service.completed':
    case 'service.failed': {
      // Gift card fulfillment outcome — matches the reference voucherService
      // set as vouchers.provider_reference when it called /gift-cards/purchase.
      const reference = data.reference as string | undefined;
      if (!reference) break;

      const { data: voucher } = await supabaseAdmin
        .from('vouchers')
        .select('id, service_metadata')
        .eq('provider_reference', reference)
        .maybeSingle();

      if (!voucher) {
        logger.info({ reference }, 'VitalPay service event for unknown reference — not a tracked gift card order');
        break;
      }

      await supabaseAdmin
        .from('vouchers')
        .update({
          service_metadata: {
            ...(voucher.service_metadata as Record<string, unknown>),
            fulfillment_status: event === 'service.completed' ? 'completed' : 'failed',
            fulfillment_payload: data,
          },
        })
        .eq('id', voucher.id);

      if (event === 'service.failed') {
        logger.error({ voucher_id: voucher.id, reference }, 'VitalPay gift card fulfillment failed after voucher redemption — needs manual reconciliation');
      }
      break;
    }

    case 'settlement.completed': {
      logger.info({ reference: data.reference }, 'VitalPay settlement completed');
      break;
    }

    default:
      logger.info({ event }, 'Unhandled VitalPay webhook event type');
  }
}

function mapVitalPayEvent(vitalPayEvent: string): string {
  const mapping: Record<string, string> = {
    'payment.success': 'wallet.funded',
    'payment.failed': 'payment.failed',
    'payment.pending': 'payment.pending',
    'refund.processed': 'refund.processed',
    'settlement.completed': 'settlement.completed',
    'service.processing': 'service.processing',
    'service.completed': 'service.completed',
    'service.failed': 'service.failed',
  };
  return mapping[vitalPayEvent] ?? vitalPayEvent;
}
