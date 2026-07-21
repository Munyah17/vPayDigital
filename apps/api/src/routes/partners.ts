// =============================================================================
// Partners — business/integration partners distinct from regular users
// =============================================================================
import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(150),
  type: z.string().max(50).optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().max(30).optional(),
  revenue_share_percent: z.number().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
});

const updateSchema = z.object({
  status: z.enum(['active', 'inactive', 'pending']).optional(),
  notes: z.string().max(1000).optional(),
});

router.get('/', authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin.from('partners').select('*').order('created_at', { ascending: false });
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

router.post('/', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const body = createSchema.parse(req.body);
  const { data, error } = await supabaseAdmin.from('partners').insert({ ...body, created_by: req.user!.id }).select().single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.status(201).json({ success: true, data });
});

router.patch('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const body = updateSchema.parse(req.body);
  const { data, error } = await supabaseAdmin.from('partners').update(body).eq('id', req.params.id).select().single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

export { router as partnersRouter };
