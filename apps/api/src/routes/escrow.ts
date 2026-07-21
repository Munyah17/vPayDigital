// =============================================================================
// Escrow — admin-managed held-funds transactions between two platform users
// =============================================================================
import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';

const router = Router();

const createSchema = z.object({
  payer_email: z.string().email(),
  payee_email: z.string().email(),
  amount: z.number().positive(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'ZAR']),
  description: z.string().min(3).max(300),
});

// GET /api/admin/escrow — full list
router.get('/', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.query as { status?: string };
  let query = supabaseAdmin
    .from('escrow_transactions')
    .select('*, payer:payer_id(email, full_name), payee:payee_id(email, full_name)')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

// POST /api/admin/escrow — create + immediately fund (debits payer's wallet)
router.post('/', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const body = createSchema.parse(req.body);

  const [{ data: payer }, { data: payee }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id').eq('email', body.payer_email).single(),
    supabaseAdmin.from('profiles').select('id').eq('email', body.payee_email).single(),
  ]);
  if (!payer) { res.status(404).json({ success: false, error: `No user with email ${body.payer_email}` }); return; }
  if (!payee) { res.status(404).json({ success: false, error: `No user with email ${body.payee_email}` }); return; }

  const { data: wallet } = await supabaseAdmin
    .from('wallets')
    .select('id, balance')
    .eq('user_id', payer.id)
    .eq('currency', body.currency)
    .eq('wallet_type', 'consumer')
    .single();
  if (!wallet) { res.status(404).json({ success: false, error: 'Payer has no wallet in that currency' }); return; }
  if (wallet.balance < body.amount) { res.status(402).json({ success: false, error: `Insufficient balance. Available: ${wallet.balance}` }); return; }

  const { data: escrow, error: insertErr } = await supabaseAdmin
    .from('escrow_transactions')
    .insert({
      payer_id: payer.id, payee_id: payee.id, payer_wallet_id: wallet.id,
      amount: body.amount, currency: body.currency, description: body.description,
      status: 'pending', created_by: req.user!.id,
    })
    .select()
    .single();
  if (insertErr || !escrow) { res.status(500).json({ success: false, error: insertErr?.message ?? 'Failed to create escrow' }); return; }

  const { error: debitErr } = await supabaseAdmin.rpc('record_wallet_debit', {
    p_wallet_id: wallet.id, p_amount: body.amount, p_type: 'fee',
    p_description: `Escrow hold: ${escrow.reference}`, p_metadata: { escrow_id: escrow.id },
  });
  if (debitErr) {
    await supabaseAdmin.from('escrow_transactions').update({ status: 'cancelled', notes: `Funding failed: ${debitErr.message}` }).eq('id', escrow.id);
    res.status(500).json({ success: false, error: `Failed to fund escrow: ${debitErr.message}` });
    return;
  }

  const { data: funded } = await supabaseAdmin
    .from('escrow_transactions')
    .update({ status: 'funded', funded_at: new Date().toISOString() })
    .eq('id', escrow.id)
    .select()
    .single();

  res.status(201).json({ success: true, data: funded });
});

// POST /api/admin/escrow/:id/release — credit payee, close out
router.post('/:id/release', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { data: escrow } = await supabaseAdmin.from('escrow_transactions').select('*').eq('id', req.params.id).single();
  if (!escrow) { res.status(404).json({ success: false, error: 'Escrow not found' }); return; }
  if (escrow.status !== 'funded') { res.status(400).json({ success: false, error: `Cannot release from status ${escrow.status}` }); return; }

  const { data: payeeWallet } = await supabaseAdmin
    .from('wallets').select('id').eq('user_id', escrow.payee_id).eq('currency', escrow.currency).eq('wallet_type', 'consumer').single();
  if (!payeeWallet) { res.status(404).json({ success: false, error: 'Payee has no wallet in that currency' }); return; }

  await supabaseAdmin.rpc('record_wallet_credit', {
    p_wallet_id: payeeWallet.id, p_amount: escrow.amount, p_type: 'transfer',
    p_description: `Escrow released: ${escrow.reference}`, p_metadata: { escrow_id: escrow.id },
  });

  const { data } = await supabaseAdmin
    .from('escrow_transactions')
    .update({ status: 'released', released_at: new Date().toISOString(), released_by: req.user!.id })
    .eq('id', escrow.id).select().single();

  res.json({ success: true, data });
});

// POST /api/admin/escrow/:id/refund — credit payer back, close out
router.post('/:id/refund', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { data: escrow } = await supabaseAdmin.from('escrow_transactions').select('*').eq('id', req.params.id).single();
  if (!escrow) { res.status(404).json({ success: false, error: 'Escrow not found' }); return; }
  if (escrow.status !== 'funded') { res.status(400).json({ success: false, error: `Cannot refund from status ${escrow.status}` }); return; }
  if (!escrow.payer_wallet_id) { res.status(500).json({ success: false, error: 'Escrow has no payer wallet on record' }); return; }

  await supabaseAdmin.rpc('record_wallet_credit', {
    p_wallet_id: escrow.payer_wallet_id, p_amount: escrow.amount, p_type: 'refund',
    p_description: `Escrow refunded: ${escrow.reference}`, p_metadata: { escrow_id: escrow.id },
  });

  const { data } = await supabaseAdmin
    .from('escrow_transactions')
    .update({ status: 'refunded', released_at: new Date().toISOString(), released_by: req.user!.id })
    .eq('id', escrow.id).select().single();

  res.json({ success: true, data });
});

export { router as escrowRouter };
