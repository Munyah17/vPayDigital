import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';
import { provider } from '../utils/provider.js';
import { vitalPay } from '../utils/vitalpay.js';
import { walletService } from '../services/walletService.js';
import { payoutService } from '../services/payoutService.js';
import { settleWalletTopup } from '../services/vitalPayPaymentService.js';
import { env } from '../config/index.js';

const router = Router();

const transferSchema = z.object({
  to_email: z.string().email(),
  amount: z.number().positive(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'ZAR']),
});

const topupSchema = z.object({
  amount: z.number().min(5),
  currency: z.enum(['USD', 'GBP', 'ZAR']),
});

const initiatePayoutSchema = z.object({
  amount: z.number().min(1),
  currency: z.enum(['USD', 'EUR', 'GBP', 'ZAR']),
  method: z.enum(['bank_transfer', 'crypto', 'mobile_money', 'card']),
  beneficiary_name: z.string().min(2),
  beneficiary_account: z.string().optional(),
  beneficiary_bank: z.string().optional(),
  beneficiary_bank_code: z.string().optional(),
  beneficiary_country: z.string().optional(),
  beneficiary_currency: z.string().optional(),
  crypto_address: z.string().optional(),
  crypto_network: z.string().optional(),
  mobile_number: z.string().optional(),
  mobile_provider: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/wallets — get all wallets for user
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('wallets')
    .select('*')
    .eq('user_id', req.user!.id)
    .eq('status', 'active')
    .order('currency');

  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.json({ success: true, data });
});

// GET /api/wallets/exchange-rates — must be before /:id to avoid wildcard capture
router.get('/exchange-rates', authenticate, async (_req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('exchange_rates')
    .select('*')
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString());

  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.json({ success: true, data: data ?? [] });
});

// POST /api/wallets/topup/initialize — start a VitalPay-hosted checkout to
// fund the caller's own wallet. Must be registered before /:id/transactions
// so "topup" is never captured as a wallet id.
router.post('/topup/initialize', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { amount, currency } = topupSchema.parse(req.body);

  const wallet = await walletService.ensureWallet(req.user!.id, currency);
  const reference = `TOPUP-${Date.now().toString(36).toUpperCase()}-${wallet.id.slice(0, 8)}`;

  const payment = await vitalPay.initializePayment({
    amount,
    currency,
    email: req.user!.email,
    reference,
    name: req.user!.email.split('@')[0],
    callback_url: `${env.WEB_APP_URL}/wallet?topup=complete`,
    metadata: { wallet_topup: true, user_id: req.user!.id, wallet_id: wallet.id },
  });

  // Sandbox keys resolve synchronously (status: "successful" in the
  // initialize response itself, per VitalPay's docs) — credit right away
  // rather than waiting on a webhook that sandbox mode may never send.
  // settleWalletTopup is idempotent, so if a webhook also fires for this
  // reference later, it's a no-op.
  await settleWalletTopup(payment, wallet.id);

  res.status(201).json({
    success: true,
    data: {
      reference: payment.reference,
      status: payment.status,
      payment_url: payment.payment_url ?? null,
      mode: payment.mode,
    },
  });
});

// GET /api/wallets/topup/verify/:reference — poll after redirect back from
// hosted checkout (live mode) or to confirm a sandbox top-up completed.
router.get('/topup/verify/:reference', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const payment = await vitalPay.verifyPayment(String(req.params.reference));
  await settleWalletTopup(payment);
  res.json({ success: true, data: { reference: payment.reference, status: payment.status, amount: payment.amount, currency: payment.currency } });
});

// GET /api/wallets/:id/transactions
router.get('/:id/transactions', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 20, type, status } = req.query as {
    page?: number; limit?: number; type?: string; status?: string;
  };
  const offset = (Number(page) - 1) * Number(limit);

  // Verify wallet belongs to user
  const { data: wallet } = await supabaseAdmin
    .from('wallets')
    .select('id, user_id')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .single();

  if (!wallet) {
    res.status(404).json({ success: false, error: 'Wallet not found' });
    return;
  }

  let query = supabaseAdmin
    .from('wallet_transactions')
    .select('*', { count: 'exact' })
    .eq('wallet_id', req.params.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (type) query = query.eq('type', type);
  if (status) query = query.eq('status', status);

  const { data, count, error } = await query;
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  res.json({ success: true, data, meta: { page: Number(page), limit: Number(limit), total: count } });
});

// POST /api/wallets/:id/virtual-account — assign/retrieve virtual account
router.post('/:id/virtual-account', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { data: wallet } = await supabaseAdmin
    .from('wallets')
    .select('id, user_id, currency, provider_virtual_account_number, provider_bank_name')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .single();

  if (!wallet) { res.status(404).json({ success: false, error: 'Wallet not found' }); return; }

  if (wallet.provider_virtual_account_number) {
    res.json({ success: true, data: { account_number: wallet.provider_virtual_account_number, bank_name: wallet.provider_bank_name } });
    return;
  }

  const vaResult = await provider.createVirtualAccount({
    user_id: req.user!.id,
    currency: wallet.currency,
    full_name: req.user!.email.split('@')[0],
    email: req.user!.email,
  });

  await supabaseAdmin
    .from('wallets')
    .update({ provider_virtual_account_number: vaResult.account_number, provider_bank_name: vaResult.bank_name, provider_account_id: vaResult.provider_account_id })
    .eq('id', wallet.id);

  await supabaseAdmin.from('virtual_accounts').upsert({
    user_id: req.user!.id,
    wallet_id: wallet.id,
    provider: 'fincra',
    provider_account_id: vaResult.provider_account_id,
    account_number: vaResult.account_number,
    bank_name: vaResult.bank_name,
    currency: wallet.currency,
    is_active: true,
  }, { onConflict: 'user_id,wallet_id' });

  res.json({ success: true, data: { account_number: vaResult.account_number, bank_name: vaResult.bank_name } });
});

// POST /api/wallets/transfer — internal transfer to another user by email
router.post('/transfer', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { to_email, amount, currency } = transferSchema.parse(req.body);

  const { data: recipient } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', to_email)
    .single();

  if (!recipient) { res.status(404).json({ success: false, error: 'Recipient not found' }); return; }
  if (recipient.id === req.user!.id) { res.status(400).json({ success: false, error: 'Cannot transfer to yourself' }); return; }

  // walletService.transfer() checks the debit/credit RPC results and throws on
  // failure instead of silently proceeding — a race that changes the sender's
  // balance between the pre-check and the debit call must not credit the
  // recipient anyway.
  try {
    await walletService.transfer({
      from_user_id: req.user!.id,
      to_user_id: recipient.id,
      amount,
      currency,
      description: `Transfer to ${to_email}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transfer failed';
    const status = message.includes('Insufficient balance') ? 402
      : message.includes('not found') ? 404
      : 500;
    res.status(status).json({ success: false, error: message });
    return;
  }

  res.json({ success: true, message: `${amount} ${currency} sent to ${to_email}` });
});

// POST /api/wallets/payout — initiate payout
router.post('/payout', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const body = initiatePayoutSchema.parse(req.body);

  // payoutService debits the wallet BEFORE calling the provider and
  // auto-refunds if the provider call fails — the inline version here used
  // to call the provider first with no rollback if the debit failed after,
  // which could pay out real funds with no corresponding wallet debit.
  let payout;
  try {
    payout = await payoutService.initiatePayout({
      user_id: req.user!.id,
      amount: body.amount,
      currency: body.currency,
      method: body.method,
      beneficiary_name: body.beneficiary_name,
      beneficiary_account: body.beneficiary_account,
      beneficiary_bank: body.beneficiary_bank,
      beneficiary_bank_code: body.beneficiary_bank_code,
      beneficiary_country: body.beneficiary_country,
      crypto_address: body.crypto_address,
      crypto_network: body.crypto_network,
      mobile_number: body.mobile_number,
      mobile_provider: body.mobile_provider,
      notes: body.notes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payout failed';
    const status = message.includes('Insufficient balance') ? 402
      : message.includes('not found') || message.includes('not active') ? 404
      : 502;
    res.status(status).json({ success: false, error: message });
    return;
  }

  res.status(201).json({
    success: true,
    data: payout,
    message: 'Payout initiated successfully',
  });
});

export { router as walletRouter };
