// =============================================================================
// Fincra Webhook Handler — event-driven architecture with retry queue
// =============================================================================

import { Request, Response } from 'express';
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

  // Idempotency check using event ID + type
  const idempotencyKey = `${payload.event}-${(payload.data?.id as string) ?? Date.now()}`;

  const { data: existing } = await supabaseAdmin
    .from('webhook_events')
    .select('id, status')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existing?.status === 'delivered') {
    res.json({ success: true, message: 'Already processed' });
    return;
  }

  // Map Fincra event to our event type
  const eventType = mapFincraEvent(payload.event);

  // Record webhook event
  const { data: webhookEvent } = await supabaseAdmin
    .from('webhook_events')
    .upsert({
      event_type: eventType,
      source: 'fincra',
      payload: payload.data,
      signature,
      status: 'pending',
      idempotency_key: idempotencyKey,
    }, { onConflict: 'idempotency_key' })
    .select()
    .single();

  // Acknowledge immediately — process asynchronously
  res.json({ success: true, received: true });

  // Process event
  try {
    await processWebhookEvent(eventType, payload.data);

    if (webhookEvent) {
      await supabaseAdmin
        .from('webhook_events')
        .update({ status: 'delivered', processed_at: new Date().toISOString() })
        .eq('id', webhookEvent.id);
    }
  } catch (err) {
    logger.error({ err, event: payload.event }, 'Webhook processing failed');
    if (webhookEvent) {
      await supabaseAdmin
        .from('webhook_events')
        .update({
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
          attempts: (webhookEvent as { attempts: number }).attempts + 1,
        })
        .eq('id', webhookEvent.id);
    }
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
