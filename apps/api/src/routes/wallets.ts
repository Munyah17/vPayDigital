import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';
import { provider } from '../utils/provider.js';

const router = Router();

const initiatePayoutSchema = z.object({
  amount: z.number().min(1),
  currency: z.enum(['USD', 'EUR', 'GBP', 'ZAR', 'NGN', 'GHS']),
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
  const { to_email, amount, currency } = req.body as { to_email: string; amount: number; currency: string };

  if (!to_email || !amount || amount <= 0) {
    res.status(400).json({ success: false, error: 'to_email and positive amount are required' });
    return;
  }

  // Fetch recipient profile and sender wallet in parallel
  const [recipientRes, senderWalletRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('id').eq('email', to_email).single(),
    supabaseAdmin.from('wallets').select('id, balance, status').eq('user_id', req.user!.id).eq('currency', currency).eq('status', 'active').single(),
  ]);

  const recipient = recipientRes.data;
  const senderWallet = senderWalletRes.data;

  if (!recipient) { res.status(404).json({ success: false, error: 'Recipient not found' }); return; }
  if (recipient.id === req.user!.id) { res.status(400).json({ success: false, error: 'Cannot transfer to yourself' }); return; }
  if (!senderWallet) { res.status(404).json({ success: false, error: `No ${currency} wallet found` }); return; }
  if (senderWallet.balance < amount) { res.status(402).json({ success: false, error: 'Insufficient balance' }); return; }

  const { data: recipientWallet } = await supabaseAdmin
    .from('wallets')
    .select('id')
    .eq('user_id', recipient.id)
    .eq('currency', currency)
    .eq('status', 'active')
    .single();

  if (!recipientWallet) { res.status(404).json({ success: false, error: `Recipient has no ${currency} wallet` }); return; }

  const reference = `TXN-${Date.now().toString(36).toUpperCase()}`;

  await supabaseAdmin.rpc('record_wallet_debit', {
    p_wallet_id: senderWallet.id,
    p_amount: amount,
    p_type: 'transfer',
    p_description: `Transfer to ${to_email}`,
    p_reference: reference,
  });

  await supabaseAdmin.rpc('record_wallet_credit', {
    p_wallet_id: recipientWallet.id,
    p_amount: amount,
    p_type: 'transfer',
    p_description: `Transfer from ${req.user!.email}`,
    p_reference: `${reference}-R`,
  });

  res.json({ success: true, message: `${amount} ${currency} sent to ${to_email}` });
});

// POST /api/wallets/payout — initiate payout
router.post('/payout', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const body = initiatePayoutSchema.parse(req.body);

  // Get wallet
  const { data: wallet } = await supabaseAdmin
    .from('wallets')
    .select('id, balance, status')
    .eq('user_id', req.user!.id)
    .eq('currency', body.currency)
    .single();

  if (!wallet) {
    res.status(404).json({ success: false, error: 'Wallet not found' });
    return;
  }

  // Calculate fee (1% + $1 flat)
  const fee = Math.max(body.amount * 0.01 + 1, 1.5);
  const totalRequired = body.amount + fee;

  if (wallet.balance < totalRequired) {
    res.status(402).json({
      success: false,
      error: `Insufficient balance. Available: ${wallet.balance}, Required: ${totalRequired} (including ${fee} fee)`,
    });
    return;
  }

  // Generate reference
  const reference = `PAY-${Date.now().toString(36).toUpperCase()}`;

  // Initiate payout with provider
  const providerResult = await provider.initiatePayout({
    amount: body.amount,
    currency: body.currency,
    method: body.method,
    reference,
    description: body.notes,
    beneficiary: {
      name: body.beneficiary_name,
      account_number: body.beneficiary_account,
      bank_code: body.beneficiary_bank_code,
      bank_name: body.beneficiary_bank,
      country: body.beneficiary_country,
      mobile_number: body.mobile_number,
      crypto_address: body.crypto_address,
      crypto_network: body.crypto_network,
    },
  });

  // Debit wallet
  await supabaseAdmin.rpc('record_wallet_debit', {
    p_wallet_id: wallet.id,
    p_amount: totalRequired,
    p_type: 'withdrawal',
    p_description: `Payout: ${body.method} to ${body.beneficiary_name}`,
    p_reference: reference,
  });

  // Record payout request
  const { data: payout } = await supabaseAdmin
    .from('payout_requests')
    .insert({
      user_id: req.user!.id,
      wallet_id: wallet.id,
      amount: body.amount,
      fee,
      net_amount: body.amount,
      currency: body.currency,
      method: body.method,
      status: 'processing',
      beneficiary_name: body.beneficiary_name,
      beneficiary_account: body.beneficiary_account,
      beneficiary_bank: body.beneficiary_bank,
      beneficiary_country: body.beneficiary_country,
      crypto_address: body.crypto_address,
      crypto_network: body.crypto_network,
      mobile_number: body.mobile_number,
      mobile_provider: body.mobile_provider,
      provider_reference: providerResult.provider_reference,
      reference,
      notes: body.notes,
    })
    .select()
    .single();

  res.status(201).json({
    success: true,
    data: payout,
    message: 'Payout initiated successfully',
  });
});

export { router as walletRouter };
