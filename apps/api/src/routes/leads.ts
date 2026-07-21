// =============================================================================
// Leads — track prospective users/businesses before they sign up
// =============================================================================
import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(150),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  company: z.string().max(150).optional(),
  source: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

const updateSchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']).optional(),
  notes: z.string().max(1000).optional(),
  assigned_to: z.string().uuid().optional(),
});

router.get('/', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.query as { status?: string };
  let query = supabaseAdmin.from('leads').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

router.post('/', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const body = createSchema.parse(req.body);
  const { data, error } = await supabaseAdmin.from('leads').insert({ ...body, created_by: req.user!.id }).select().single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.status(201).json({ success: true, data });
});

router.patch('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const body = updateSchema.parse(req.body);
  const { data, error } = await supabaseAdmin.from('leads').update(body).eq('id', req.params.id).select().single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

export { router as leadsRouter };
