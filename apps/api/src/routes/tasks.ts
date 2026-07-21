// =============================================================================
// Task Manager — internal ops task tracking, separate from support_tickets
// =============================================================================
import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';

const router = Router();

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assigned_to: z.string().uuid().optional(),
  due_date: z.string().optional(),
});

const updateSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
});

router.get('/', authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .select('*, assignee:assigned_to(email, full_name)')
    .order('created_at', { ascending: false });
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

router.post('/', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const body = createSchema.parse(req.body);
  const { data, error } = await supabaseAdmin.from('tasks').insert({ ...body, created_by: req.user!.id }).select().single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.status(201).json({ success: true, data });
});

router.patch('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const body = updateSchema.parse(req.body);
  const { data, error } = await supabaseAdmin.from('tasks').update(body).eq('id', req.params.id).select().single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

router.delete('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { error } = await supabaseAdmin.from('tasks').delete().eq('id', req.params.id);
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true });
});

export { router as tasksRouter };
