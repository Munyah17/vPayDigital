// =============================================================================
// HR & Payroll — internal staff records and payroll runs. Manages ePay
// Smart's own staff, not platform end users.
// =============================================================================
import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';

const router = Router();

const staffSchema = z.object({
  profile_email: z.string().email(),
  job_title: z.string().max(150).optional(),
  department: z.string().max(100).optional(),
  employment_type: z.enum(['full_time', 'part_time', 'contract']).default('full_time'),
  base_salary: z.number().nonnegative(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'ZAR']).default('USD'),
  start_date: z.string().optional(),
});

router.get('/staff', authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin.from('staff_records').select('*, profiles(email, full_name)').order('created_at', { ascending: false });
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

router.post('/staff', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const body = staffSchema.parse(req.body);
  const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('email', body.profile_email).single();
  if (!profile) { res.status(404).json({ success: false, error: `No user with email ${body.profile_email}` }); return; }

  const { profile_email: _drop, ...rest } = body;
  const { data, error } = await supabaseAdmin.from('staff_records').insert({ ...rest, profile_id: profile.id }).select().single();
  if (error) {
    const message = error.code === '23505' ? 'This user already has a staff record' : error.message;
    res.status(error.code === '23505' ? 409 : 500).json({ success: false, error: message });
    return;
  }
  res.status(201).json({ success: true, data });
});

router.patch('/staff/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { active, base_salary } = req.body as { active?: boolean; base_salary?: number };
  const patch: Record<string, unknown> = {};
  if (active !== undefined) patch.active = active;
  if (base_salary !== undefined) patch.base_salary = base_salary;
  const { data, error } = await supabaseAdmin.from('staff_records').update(patch).eq('id', req.params.id).select().single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

// ── Payroll runs ─────────────────────────────────────────────────────────
const runSchema = z.object({
  period_start: z.string(),
  period_end: z.string(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'ZAR']).default('USD'),
});

router.get('/payroll', authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin.from('payroll_runs').select('*').order('created_at', { ascending: false });
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

router.get('/payroll/:id/items', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('payroll_items')
    .select('*, staff_records(job_title, profiles(email, full_name))')
    .eq('payroll_run_id', req.params.id);
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

// POST /payroll — creates a run and auto-generates one line item per active staff member
router.post('/payroll', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const body = runSchema.parse(req.body);
  const { data: staff } = await supabaseAdmin.from('staff_records').select('id, base_salary, currency').eq('active', true).eq('currency', body.currency);
  if (!staff || staff.length === 0) { res.status(400).json({ success: false, error: `No active staff records in ${body.currency}` }); return; }

  const totalAmount = staff.reduce((sum, s) => sum + Number(s.base_salary), 0);

  const { data: run, error: runErr } = await supabaseAdmin
    .from('payroll_runs')
    .insert({ ...body, total_amount: totalAmount, created_by: req.user!.id })
    .select()
    .single();
  if (runErr || !run) { res.status(500).json({ success: false, error: runErr?.message ?? 'Failed to create run' }); return; }

  const items = staff.map(s => ({ payroll_run_id: run.id, staff_record_id: s.id, gross_amount: s.base_salary, net_amount: s.base_salary }));
  const { error: itemsErr } = await supabaseAdmin.from('payroll_items').insert(items);
  if (itemsErr) { res.status(500).json({ success: false, error: itemsErr.message }); return; }

  res.status(201).json({ success: true, data: run });
});

router.post('/payroll/:id/process', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin.from('payroll_runs').update({ status: 'processed' }).eq('id', req.params.id).eq('status', 'draft').select().single();
  if (error || !data) { res.status(400).json({ success: false, error: error?.message ?? 'Cannot process this run' }); return; }
  res.json({ success: true, data });
});

// POST /payroll/:id/pay — credits each staff member's consumer wallet with net_amount
router.post('/payroll/:id/pay', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { data: run } = await supabaseAdmin.from('payroll_runs').select('*').eq('id', req.params.id).single();
  if (!run) { res.status(404).json({ success: false, error: 'Payroll run not found' }); return; }
  if (run.status !== 'processed') { res.status(400).json({ success: false, error: 'Run must be processed before paying' }); return; }

  const { data: items } = await supabaseAdmin
    .from('payroll_items')
    .select('*, staff_records(profile_id)')
    .eq('payroll_run_id', run.id)
    .eq('paid', false);

  let paidCount = 0, skippedCount = 0;
  for (const item of items ?? []) {
    const profileId = (item as unknown as { staff_records: { profile_id: string } }).staff_records.profile_id;
    const { data: wallet } = await supabaseAdmin.from('wallets').select('id').eq('user_id', profileId).eq('currency', run.currency).eq('wallet_type', 'consumer').single();
    if (!wallet) { skippedCount++; continue; }

    await supabaseAdmin.rpc('record_wallet_credit', {
      p_wallet_id: wallet.id, p_amount: item.net_amount, p_type: 'deposit',
      p_description: `Payroll: ${run.reference}`, p_metadata: { payroll_run_id: run.id },
    });
    await supabaseAdmin.from('payroll_items').update({ paid: true }).eq('id', item.id);
    paidCount++;
  }

  const { data: updatedRun } = await supabaseAdmin
    .from('payroll_runs')
    .update({ status: 'paid', processed_at: new Date().toISOString() })
    .eq('id', run.id)
    .select()
    .single();

  res.json({ success: true, data: { run: updatedRun, paid_count: paidCount, skipped_count: skippedCount } });
});

export { router as hrRouter };
