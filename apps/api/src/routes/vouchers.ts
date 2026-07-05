import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAgent, AuthenticatedRequest } from '../middleware/auth.js';
import { voucherService } from '../services/voucherService.js';
import { supabaseAdmin } from '../utils/supabase.js';

const router = Router();

const issueVoucherSchema = z.object({
  type: z.enum(['virtual_card', 'gift_card', 'streaming', 'gaming', 'ecommerce', 'subscription', 'utility', 'travel', 'general']),
  amount: z.number().min(1).max(5000),
  currency: z.enum(['USD', 'EUR', 'GBP', 'ZAR']).default('USD'),
  gift_card_brand: z.string().optional(),
  expires_in_days: z.number().min(1).max(365).default(30),
  quantity: z.number().min(1).max(100).default(1),
  metadata: z.record(z.unknown()).optional(),
});

const redeemVoucherSchema = z.object({
  code: z.string().min(1),
  cardholder_name: z.string().min(2).max(26),
});

// GET /api/vouchers — list vouchers
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const isAgent = ['agent', 'super_admin', 'staff'].includes(req.user!.role);
  const { page = 1, limit = 20 } = req.query as { page?: number; limit?: number };
  const offset = (Number(page) - 1) * Number(limit);

  let query = supabaseAdmin
    .from('vouchers')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (isAgent) {
    query = query.eq('issuer_id', req.user!.id);
  } else {
    query = query.eq('redeemed_by', req.user!.id);
  }

  const { data, count, error } = await query;
  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  res.json({ success: true, data, meta: { page: Number(page), limit: Number(limit), total: count } });
});

// GET /api/vouchers/check/:code — check voucher validity
router.get('/check/:code', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const voucher = await voucherService.getVoucherByCode(req.params.code as string);
  if (!voucher) {
    res.status(404).json({ success: false, error: 'Voucher not found' });
    return;
  }
  res.json({ success: true, data: voucher });
});

// POST /api/vouchers — issue voucher (agents only)
router.post('/', authenticate, requireAgent, async (req: AuthenticatedRequest, res: Response) => {
  const body = issueVoucherSchema.parse(req.body);

  if (body.quantity > 1) {
    const vouchers = [];
    for (let i = 0; i < body.quantity; i++) {
      const v = await voucherService.issueVoucher({
        ...body,
        issuer_id: req.user!.id,
        issuer_role: req.user!.role,
        gift_card_brand: body.gift_card_brand as never,
        currency: body.currency as never,
        type: body.type as never,
      });
      vouchers.push(v);
    }
    res.status(201).json({ success: true, data: vouchers, message: `${body.quantity} vouchers issued` });
    return;
  }

  const voucher = await voucherService.issueVoucher({
    ...body,
    issuer_id: req.user!.id,
    issuer_role: req.user!.role,
    gift_card_brand: body.gift_card_brand as never,
    currency: body.currency as never,
    type: body.type as never,
  });

  res.status(201).json({ success: true, data: voucher, message: 'Voucher issued successfully' });
});

// POST /api/vouchers/redeem — redeem a voucher
router.post('/redeem', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const body = redeemVoucherSchema.parse(req.body);

  const result = await voucherService.redeemVoucher({
    code: body.code,
    user_id: req.user!.id,
    cardholder_name: body.cardholder_name,
  });

  res.json({ success: true, data: result, message: result.message });
});

export { router as voucherRouter };
