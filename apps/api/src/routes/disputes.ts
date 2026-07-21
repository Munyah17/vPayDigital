// =============================================================================
// Disputes — formal dispute/chargeback tracking, distinct from fraud_flags
// (internal risk signals) and support_tickets (general customer support)
// =============================================================================
import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';

const router = Router();

const createSchema = z.object({
  subject: z.string().min(3).max(150),
  description: z.string().min(10).max(2000),
  related_transaction_id: z.string().uuid().optional(),
});

const updateSchema = z.object({
  status: z.enum(['open', 'investigating', 'resolved', 'rejected']),
  resolution_notes: z.string().max(2000).optional(),
});

// POST /api/disputes — any authenticated user raises one
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const body = createSchema.parse(req.body);
  const { data, error } = await supabaseAdmin
    .from('disputes')
    .insert({ ...body, raised_by: req.user!.id })
    .select()
    .single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.status(201).json({ success: true, data });
});

// GET /api/disputes — caller's own
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('disputes')
    .select('*')
    .eq('raised_by', req.user!.id)
    .order('created_at', { ascending: false });
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

// GET /api/admin/disputes — all disputes
router.get('/admin', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.query as { status?: string };
  let query = supabaseAdmin
    .from('disputes')
    .select('*, profiles!disputes_raised_by_fkey(email, full_name)')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

// PATCH /api/admin/disputes/:id — update status/resolution
router.patch('/admin/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const body = updateSchema.parse(req.body);
  const patch: Record<string, unknown> = { ...body };
  if (body.status === 'resolved' || body.status === 'rejected') {
    patch.resolved_by = req.user!.id;
    patch.resolved_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from('disputes')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

export { router as disputesRouter };
