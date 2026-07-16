// =============================================================================
// VitalPay Payment Settlement — shared by the top-up routes and the webhook
// handler, since a payment can be confirmed via either path (sandbox keys
// resolve synchronously in the initialize/verify response; live keys rely
// on the webhook after hosted checkout completes).
// =============================================================================

import { supabaseAdmin } from '../utils/supabase.js';
import { logger } from '../utils/logger.js';
import type { VitalPayPayment } from '@vpay/provider-vitalpay';

const isUniqueViolation = (error: { code?: string; message?: string } | null) =>
  error?.code === '23505' || (error?.message?.includes('duplicate key') ?? false);

/**
 * Credits the wallet for a successful VitalPay wallet-top-up payment.
 * Idempotent: relies on wallet_transactions.reference being UNIQUE, so a
 * duplicate call (webhook retry racing the synchronous verify path, or two
 * webhook deliveries of the same event) is a harmless no-op rather than a
 * double-credit.
 *
 * `walletId` should be passed explicitly whenever the caller already knows
 * it (e.g. the initialize route, right after calling ensureWallet) —
 * VitalPay's /payments/initialize response isn't documented to echo back
 * the metadata we sent, unlike /payments/verify, so falling back to
 * `payment.metadata.wallet_id` only reliably works from the verify path
 * and the webhook.
 */
export async function settleWalletTopup(payment: VitalPayPayment, walletId?: string): Promise<void> {
  if (payment.status !== 'successful') return;

  const metadata = (payment as unknown as { metadata?: Record<string, unknown> }).metadata ?? {};
  const resolvedWalletId = walletId ?? (metadata.wallet_id as string | undefined);
  if (!resolvedWalletId) {
    logger.warn({ reference: payment.reference }, 'VitalPay payment has no resolvable wallet_id — not a wallet top-up, skipping');
    return;
  }

  const { error } = await supabaseAdmin.rpc('record_wallet_credit', {
    p_wallet_id: resolvedWalletId,
    p_amount: payment.amount,
    p_type: 'deposit',
    p_description: 'Wallet top-up via VitalPay',
    p_reference: payment.reference,
    p_metadata: { vitalpay_reference: payment.reference, platform_reference: payment.platform_reference },
  });

  if (error) {
    if (isUniqueViolation(error)) {
      logger.info({ reference: payment.reference }, 'VitalPay top-up already credited — idempotent skip');
      return;
    }
    logger.error({ error, reference: payment.reference }, 'Failed to credit wallet for VitalPay top-up');
    throw new Error(`Failed to credit wallet: ${error.message}`);
  }
}

