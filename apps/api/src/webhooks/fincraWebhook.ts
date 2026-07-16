// =============================================================================
// Fincra Webhook Handler — event-driven architecture with retry queue
// =============================================================================

import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { supabaseAdmin } from '../utils/supabase.js';
import { provider } from '../utils/provider.js';
import { logger } from '../utils/logger.js';

export async function handleFincraWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers['x-fincra-signature'] as string;
  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body);

  // Verify signature
  if (!provider.verifyWebhookSignature(rawBody, signature)) {
    logger.warn({ url: req.url }, 'Invalid webhook signature');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const payload = req.body as {
    event: string;
    data: Record<string, unknown>;
    timestamp?: string;
  };

  // Idempotency key: prefer a stable identifier from the event itself. If
  // none is present, hash the raw body instead of falling back to
  // Date.now() — a timestamp fallback would give every delivery of the same
  // eventless payload a unique key, silently disabling dedup for it.
  const stableId = (payload.data?.id as string)
    ?? (payload.data?.reference as string)
    ?? (payload.data?.transactionId as string)
    ?? createHash('sha256').update(rawBody).digest('hex').slice(0, 32);
  const idempotencyKey = `${payload.event}-${stableId}`;

  const eventType = mapFincraEvent(payload.event);

  // Atomically claim this event: only one concurrent/duplicate delivery of
  // the same idempotency key gets claimed = true. Everyone else (including
  // near-simultaneous retries racing each other) is told to stand down
  // instead of both proceeding to double-credit or double-reverse funds.
  const { data: claimRows, error: claimErr } = await supabaseAdmin.rpc('claim_webhook_event', {
    p_idempotency_key: idempotencyKey,
    p_event_type: eventType,
    p_source: 'fincra',
    p_payload: payload.data,
    p_signature: signature,
  });

  if (claimErr) {
    logger.error({ claimErr, event: payload.event }, 'Failed to claim webhook event');
    res.status(500).json({ success: false, error: 'Failed to record webhook event' });
    return;
  }

  const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
  if (!claim?.claimed) {
    res.json({ success: true, message: 'Already processed or in progress' });
    return;
  }

  const webhookEventId = claim.id as string;

  // Do the work BEFORE responding. On Vercel's serverless model the
  // execution context can be frozen the instant a response is sent, so
  // acknowledging first and processing "in the background" risked the
  // wallet-crediting work never actually running.
  try {
    await processWebhookEvent(eventType, payload.data);

    await supabaseAdmin
      .from('webhook_events')
      .update({ status: 'delivered', processed_at: new Date().toISOString() })
      .eq('id', webhookEventId);

    res.json({ success: true, received: true });
  } catch (err) {
    logger.error({ err, event: payload.event }, 'Webhook processing failed');
    await supabaseAdmin
      .from('webhook_events')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Unknown error',
      })
      .eq('id', webhookEventId);

    // Respond with an error so the provider's own retry logic re-delivers
    // this event — previously this always ACKed 200 even on failure, so a
    // genuinely failed webhook (e.g. a transient DB error) would never be
    // retried by Fincra.
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
}

async function processWebhookEvent(eventType: string, data: Record<string, unknown>): Promise<void> {
  switch (eventType) {
    case 'card.transaction': {
      const providerCardId = data.cardId as string;
      const { data: card } = await supabaseAdmin
        .from('cards')
        .select('id, user_id, current_balance')
        .eq('provider_card_id', providerCardId)
        .single();

      if (!card) break;

      const txnAmount = Number(data.amount ?? 0);
      const txnType = (data.type as string)?.toLowerCase() ?? 'purchase';

      await supabaseAdmin.from('card_transactions').insert({
        card_id: card.id,
        user_id: card.user_id,
        type: txnType,
        amount: txnAmount,
        currency: data.currency ?? 'USD',
        merchant_name: data.merchantName,
        merchant_category: data.merchantCategory,
        merchant_country: data.merchantCountry,
        status: 'completed',
        provider_reference: data.reference ?? data.id,
        balance_after: Number(data.balanceAfter ?? 0),
        metadata: data,
      });

      // Update card balance
      await supabaseAdmin
        .from('cards')
        .update({ current_balance: Number(data.balanceAfter ?? 0) })
        .eq('id', card.id);

      // Notify user
      await supabaseAdmin.from('notifications').insert({
        user_id: card.user_id,
        type: 'transaction_success',
        channel: 'in_app',
        title: txnType === 'purchase' ? 'Card Transaction' : 'Card Refund',
        body: `${txnType === 'purchase' ? 'Spent' : 'Refunded'} $${txnAmount.toFixed(2)} ${data.merchantName ? `at ${data.merchantName}` : ''}`.trim(),
        data: { card_id: card.id, amount: txnAmount },
      });
      break;
    }

    case 'card.exhausted': {
      const { data: card } = await supabaseAdmin
        .from('cards')
        .select('id, user_id')
        .eq('provider_card_id', data.cardId as string)
        .single();

      if (card) {
        await supabaseAdmin
          .from('cards')
          .update({ status: 'exhausted', terminated_at: new Date().toISOString(), current_balance: 0 })
          .eq('id', card.id);
      }
      break;
    }

    case 'payout.completed': {
      await supabaseAdmin
        .from('payout_requests')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('provider_reference', data.reference as string);
      break;
    }

    case 'payout.failed': {
      const { data: payout } = await supabaseAdmin
        .from('payout_requests')
        .update({ status: 'failed' })
        .eq('provider_reference', data.reference as string)
        .select('wallet_id, amount, fee, user_id')
        .single();

      // Reverse the debit — credit wallet back
      if (payout) {
        await supabaseAdmin.rpc('record_wallet_credit', {
          p_wallet_id: payout.wallet_id,
          p_amount: payout.amount + payout.fee,
          p_type: 'reversal',
          p_description: 'Payout failed — funds reversed',
        });

        await supabaseAdmin.from('notifications').insert({
          user_id: payout.user_id,
          type: 'payout_failed',
          channel: 'in_app',
          title: 'Payout Failed',
          body: `Your payout of $${payout.amount} has failed. Funds returned to your wallet.`,
          data: { reference: data.reference },
        });
      }
      break;
    }

    case 'wallet.funded': {
      // A virtual account received a deposit
      const { data: va } = await supabaseAdmin
        .from('virtual_accounts')
        .select('wallet_id, user_id')
        .eq('provider_account_id', data.accountId as string)
        .single();

      if (va) {
        await supabaseAdmin.rpc('record_wallet_credit', {
          p_wallet_id: va.wallet_id,
          p_amount: Number(data.amount),
          p_type: 'deposit',
          p_description: `Bank deposit via ${data.bankName ?? 'bank transfer'}`,
          p_reference: data.reference as string,
        });
      }
      break;
    }

    default:
      logger.info({ eventType }, 'Unhandled webhook event type');
  }
}

function mapFincraEvent(fincraEvent: string): string {
  const mapping: Record<string, string> = {
    'card.transaction': 'card.transaction',
    'card.deactivated': 'card.terminated',
    'card.frozen': 'card.frozen',
    'card.unfrozen': 'card.unfrozen',
    'card.exhausted': 'card.exhausted',
    'payout.successful': 'payout.completed',
    'payout.failed': 'payout.failed',
    'collection.successful': 'wallet.funded',
    'virtualaccount.credited': 'wallet.funded',
  };
  return mapping[fincraEvent] ?? fincraEvent;
}
