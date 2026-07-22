// =============================================================================
// Loans — origination, approval, disbursement, and repayment tracking
// =============================================================================
import { Router, Response } from 'express';
import { z } from 'zod';
// Real credit decisions + wallet money movement — super_admin only, same
// tier as wallet-adjust/staff-management in app.ts.
import { authenticate, requireSuperAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';

const router = Router();

const createSchema = z.object({
  borrower_email: z.string().email(),
  principal: z.number().positive(),
  interest_rate_percent: z.number().min(0).max(100),
  term_months: z.number().int().positive(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'ZAR']).default('USD'),
  notes: z.string().max(1000).optional(),
});

router.get('/', authenticate, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.query as { status?: string };
  let query = supabaseAdmin.from('loans').select('*, profiles!loans_borrower_id_fkey(email, full_name)').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

router.post('/', authenticate, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const body = createSchema.parse(req.body);
  const { data: borrower } = await supabaseAdmin.from('profiles').select('id').eq('email', body.borrower_email).single();
  if (!borrower) { res.status(404).json({ success: false, error: `No user with email ${body.borrower_email}` }); return; }

  const { borrower_email: _drop, ...rest } = body;
  const { data, error } = await supabaseAdmin
    .from('loans')
    .insert({ ...rest, borrower_id: borrower.id, created_by: req.user!.id })
    .select()
    .single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.status(201).json({ success: true, data });
});

// POST /:id/approve — computes total repayable and due date
router.post('/:id/approve', authenticate, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { data: loan } = await supabaseAdmin.from('loans').select('*').eq('id', req.params.id).single();
  if (!loan) { res.status(404).json({ success: false, error: 'Loan not found' }); return; }
  if (loan.status !== 'pending') { res.status(400).json({ success: false, error: `Cannot approve from status ${loan.status}` }); return; }

  const totalRepayable = Math.round(loan.principal * (1 + loan.interest_rate_percent / 100) * 100) / 100;
  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + loan.term_months);

  const { data, error } = await supabaseAdmin
    .from('loans')
    .update({ status: 'approved', total_repayable: totalRepayable, due_date: dueDate.toISOString().slice(0, 10), approved_by: req.user!.id })
    .eq('id', loan.id)
    .select()
    .single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

router.post('/:id/reject', authenticate, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin.from('loans').update({ status: 'rejected' }).eq('id', req.params.id).eq('status', 'pending').select().single();
  if (error || !data) { res.status(400).json({ success: false, error: error?.message ?? 'Cannot reject this loan' }); return; }
  res.json({ success: true, data });
});

// POST /:id/disburse — credits borrower's wallet with the principal
router.post('/:id/disburse', authenticate, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { data: loan } = await supabaseAdmin.from('loans').select('*').eq('id', req.params.id).single();
  if (!loan) { res.status(404).json({ success: false, error: 'Loan not found' }); return; }
  if (loan.status !== 'approved') { res.status(400).json({ success: false, error: `Cannot disburse from status ${loan.status}` }); return; }

  const { data: wallet } = await supabaseAdmin
    .from('wallets').select('id').eq('user_id', loan.borrower_id).eq('currency', loan.currency).eq('wallet_type', 'consumer').single();
  if (!wallet) { res.status(404).json({ success: false, error: 'Borrower has no wallet in that currency' }); return; }

  await supabaseAdmin.rpc('record_wallet_credit', {
    p_wallet_id: wallet.id, p_amount: loan.principal, p_type: 'deposit',
    p_description: `Loan disbursement: ${loan.reference}`, p_metadata: { loan_id: loan.id },
  });

  const { data, error } = await supabaseAdmin
    .from('loans')
    .update({ status: 'active', disbursed_at: new Date().toISOString() })
    .eq('id', loan.id).select().single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

// POST /:id/repay — debits borrower's wallet for a repayment amount
const repaySchema = z.object({ amount: z.number().positive() });
router.post('/:id/repay', authenticate, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { amount } = repaySchema.parse(req.body);
  const { data: loan } = await supabaseAdmin.from('loans').select('*').eq('id', req.params.id).single();
  if (!loan) { res.status(404).json({ success: false, error: 'Loan not found' }); return; }
  if (loan.status !== 'active') { res.status(400).json({ success: false, error: `Cannot record repayment from status ${loan.status}` }); return; }

  const { data: wallet } = await supabaseAdmin
    .from('wallets').select('id, balance').eq('user_id', loan.borrower_id).eq('currency', loan.currency).eq('wallet_type', 'consumer').single();
  if (!wallet) { res.status(404).json({ success: false, error: 'Borrower has no wallet in that currency' }); return; }
  if (wallet.balance < amount) { res.status(402).json({ success: false, error: `Borrower's balance (${wallet.balance}) is less than the repayment amount` }); return; }

  await supabaseAdmin.rpc('record_wallet_debit', {
    p_wallet_id: wallet.id, p_amount: amount, p_type: 'withdrawal',
    p_description: `Loan repayment: ${loan.reference}`, p_metadata: { loan_id: loan.id },
  });

  const newAmountRepaid = Number(loan.amount_repaid) + amount;
  const isFullyRepaid = loan.total_repayable !== null && newAmountRepaid >= Number(loan.total_repayable);

  const { data, error } = await supabaseAdmin
    .from('loans')
    .update({ amount_repaid: newAmountRepaid, status: isFullyRepaid ? 'repaid' : loan.status })
    .eq('id', loan.id).select().single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

router.post('/:id/default', authenticate, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin.from('loans').update({ status: 'defaulted' }).eq('id', req.params.id).eq('status', 'active').select().single();
  if (error || !data) { res.status(400).json({ success: false, error: error?.message ?? 'Cannot mark this loan defaulted' }); return; }
  res.json({ success: true, data });
});

export { router as loansRouter };
