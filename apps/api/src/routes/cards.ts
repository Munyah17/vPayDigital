import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin, requireAgent, AuthenticatedRequest } from '../middleware/auth.js';
import { cardService } from '../services/cardService.js';
import { supabaseAdmin } from '../utils/supabase.js';
import { decryptCardSecret } from '../utils/cardCrypto.js';

const router = Router();

const issueCardSchema = z.object({
  cardholder_name: z.string().min(2).max(26),
  card_type: z.enum(['single_use', 'multi_use', 'disposable', 'time_limited', 'merchant_locked', 'subscription']),
  network: z.enum(['visa', 'mastercard', 'amex', 'unionpay']).default('visa'),
  currency: z.enum(['USD', 'EUR', 'GBP', 'ZAR']).default('USD'),
  amount: z.number().min(5).max(10000),
  spending_limit_daily: z.number().optional(),
  spending_limit_per_transaction: z.number().optional(),
  expires_at: z.string().datetime().optional(),
});

// GET /api/cards — list user's cards
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('cards')
    .select(`
      id, card_type, network, currency, status, masked_pan, last_four,
      cardholder_name, expiry_month, expiry_year, current_balance,
      initial_balance, total_spent, activated_at, expires_at, created_at
    `)
    .eq('user_id', req.user!.id)
    .not('status', 'in', '("terminated","expired")')
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.json({ success: true, data });
});

// GET /api/cards/:id — card detail
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('cards')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .single();

  if (error || !data) {
    res.status(404).json({ success: false, error: 'Card not found' });
    return;
  }
  // Ciphertext never leaves the API — full details only via /:id/reveal.
  delete (data as Record<string, unknown>).encrypted_pan;
  delete (data as Record<string, unknown>).encrypted_pin;
  res.json({ success: true, data });
});

// GET /api/cards/:id/reveal — full card details, card owner only.
// VitalPay's model (confirmed by their support): the full card number is
// delivered once in the issue response and is meant to be displayed on the
// end customer's own dashboard. We store it encrypted at issuance and
// decrypt it here on demand. Cards issued before this shipped (or ones
// VitalPay didn't return a PAN for) return has_details: false.
router.get('/:id/reveal', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { data: card } = await supabaseAdmin
    .from('cards')
    .select('id, user_id, status, encrypted_pan, encrypted_pin, expiry_month, expiry_year, cardholder_name')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .single();

  if (!card) {
    res.status(404).json({ success: false, error: 'Card not found' });
    return;
  }
  if (card.status === 'terminated' || card.status === 'expired') {
    res.status(410).json({ success: false, error: 'Card is no longer active' });
    return;
  }
  if (!card.encrypted_pan) {
    res.json({ success: true, data: { has_details: false } });
    return;
  }

  res.json({
    success: true,
    data: {
      has_details: true,
      pan: decryptCardSecret(card.encrypted_pan),
      pin: card.encrypted_pin ? decryptCardSecret(card.encrypted_pin) : null,
      expiry_month: card.expiry_month,
      expiry_year: card.expiry_year,
      cardholder_name: card.cardholder_name,
    },
  });
});

// POST /api/cards — issue card (agents and admins only — debits issuer float)
router.post('/', authenticate, requireAgent, async (req: AuthenticatedRequest, res: Response) => {
  const body = issueCardSchema.parse(req.body);
  const card = await cardService.issueCard({
    ...body,
    user_id: req.user!.id,
    issued_by_agent: req.user!.id,
    cardholder_name: body.cardholder_name,
  });
  res.status(201).json({ success: true, data: card, message: 'Card issued successfully' });
});

const requestCardSchema = z.object({
  cardholder_name: z.string().min(2).max(26),
  card_type: z.enum(['single_use', 'multi_use', 'disposable', 'subscription']).default('multi_use'),
  network: z.enum(['visa', 'mastercard']).default('visa'),
  currency: z.enum(['USD', 'EUR', 'GBP', 'ZAR']).default('USD'),
  requested_amount: z.number().min(5).max(10000),
  notes: z.string().max(200).optional(),
});

// POST /api/cards/request — consumer self-service card request. Instant and
// self-funded: cardService.issueCard debits the requester's OWN 'consumer'
// wallet (issued_by_agent is omitted) and issues the card immediately —
// no agent approval step. Matches the buy-voucher -> redeem -> top up wallet
// -> request card flow: the card is only ever backed by money already in
// the consumer's wallet, never platform float.
router.post('/request', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'consumer') {
    res.status(403).json({ success: false, error: 'Only consumer accounts use this endpoint. Agents/admins issue cards directly.' });
    return;
  }

  const body = requestCardSchema.parse(req.body);

  const card = await cardService.issueCard({
    user_id: req.user!.id,
    cardholder_name: body.cardholder_name,
    card_type: body.card_type,
    network: body.network,
    currency: body.currency,
    amount: body.requested_amount,
  });

  res.status(201).json({ success: true, data: card, message: 'Card issued instantly!' });
});

// POST /api/cards/:id/freeze
router.post('/:id/freeze', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  await cardService.freezeCard(req.params.id, req.user!.id);
  res.json({ success: true, message: 'Card frozen successfully' });
});

// POST /api/cards/:id/unfreeze
router.post('/:id/unfreeze', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  await cardService.unfreezeCard(req.params.id, req.user!.id);
  res.json({ success: true, message: 'Card unfrozen successfully' });
});

// POST /api/cards/:id/terminate
router.post('/:id/terminate', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const isAdmin = ['super_admin', 'staff'].includes(req.user!.role);
  await cardService.terminateCard(req.params.id, req.user!.id, isAdmin);
  res.json({ success: true, message: 'Card terminated successfully' });
});

// GET /api/cards/:id/transactions
router.get('/:id/transactions', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const transactions = await cardService.getCardTransactions(req.params.id, req.user!.id);
  res.json({ success: true, data: transactions });
});

// GET /api/cards/:id/transactions/local — from our DB
router.get('/:id/transactions/local', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 20 } = req.query as { page?: number; limit?: number };
  const offset = (page - 1) * limit;

  const { data, count, error } = await supabaseAdmin
    .from('card_transactions')
    .select('*', { count: 'exact' })
    .eq('card_id', req.params.id)
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }
  res.json({ success: true, data, meta: { page, limit, total: count } });
});

export { router as cardRouter };
