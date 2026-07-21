// =============================================================================
// Marketing — promo code CRUD + validation
// =============================================================================
import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';

const router = Router();

const createSchema = z.object({
  code: z.string().min(3).max(30).transform(s => s.toUpperCase()),
  description: z.string().max(200).optional(),
  discount_type: z.enum(['percent', 'flat']),
  discount_value: z.number().positive(),
  max_uses: z.number().int().positive().optional(),
  min_amount: z.number().positive().optional(),
  expires_at: z.string().datetime().optional(),
});

router.get('/', authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin.from('promo_codes').select('*').order('created_at', { ascending: false });
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

router.post('/', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const body = createSchema.parse(req.body);
  const { data, error } = await supabaseAdmin.from('promo_codes').insert({ ...body, created_by: req.user!.id }).select().single();
  if (error) {
    const message = error.code === '23505' ? `Code "${body.code}" already exists` : error.message;
    res.status(error.code === '23505' ? 409 : 500).json({ success: false, error: message });
    return;
  }
  res.status(201).json({ success: true, data });
});

router.patch('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { active } = req.body as { active: boolean };
  const { data, error } = await supabaseAdmin.from('promo_codes').update({ active }).eq('id', req.params.id).select().single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

// GET /api/promo/validate/:code — any authenticated user, e.g. before checkout
router.get('/validate/:code', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { data: promo } = await supabaseAdmin
    .from('promo_codes')
    .select('*')
    .eq('code', String(req.params.code).toUpperCase())
    .eq('active', true)
    .maybeSingle();

  if (!promo) { res.status(404).json({ success: false, error: 'Invalid or inactive promo code' }); return; }
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) { res.status(410).json({ success: false, error: 'Promo code has expired' }); return; }
  if (promo.max_uses && promo.used_count >= promo.max_uses) { res.status(410).json({ success: false, error: 'Promo code has reached its usage limit' }); return; }

  res.json({ success: true, data: { code: promo.code, discount_type: promo.discount_type, discount_value: promo.discount_value, min_amount: promo.min_amount } });
});

export { router as promoCodesRouter };
