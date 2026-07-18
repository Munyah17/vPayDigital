import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';
import { vitalPay } from '../utils/vitalpay.js';
import { vasService } from '../services/vasService.js';

const router = Router();

const purchaseAirtimeSchema = z.object({
  operator_id: z.string().min(1),
  phone: z.string().min(6),
  amount: z.number().min(0.5),
  currency: z.enum(['USD', 'EUR', 'GBP', 'ZAR']),
  type: z.enum(['airtime', 'data']).optional(),
});

const purchaseElectricitySchema = z.object({
  meter_number: z.string().min(1).max(30),
  amount: z.number().min(5),
  currency: z.enum(['USD', 'EUR', 'GBP', 'ZAR']),
  country: z.string().length(2).optional(),
});

// GET /api/vas/airtime/operators
router.get('/airtime/operators', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const countryIso = req.query.country_iso as string | undefined;
  const { operators } = await vitalPay.getAirtimeOperators({ country_iso: countryIso });
  res.json({ success: true, data: operators });
});

// POST /api/vas/airtime/purchase
router.post('/airtime/purchase', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const body = purchaseAirtimeSchema.parse(req.body);
  try {
    const order = await vasService.purchaseAirtime({ user_id: req.user!.id, ...body });
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Airtime purchase failed';
    const status = message.includes('Insufficient balance') ? 402
      : message.includes('wallet') ? 404
      : 502;
    res.status(status).json({ success: false, error: message });
  }
});

// POST /api/vas/electricity/purchase
router.post('/electricity/purchase', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const body = purchaseElectricitySchema.parse(req.body);
  try {
    const order = await vasService.purchaseElectricity({ user_id: req.user!.id, ...body });
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Electricity purchase failed';
    const status = message.includes('Insufficient balance') ? 402
      : message.includes('wallet') ? 404
      : 502;
    res.status(status).json({ success: false, error: message });
  }
});

// GET /api/vas/orders — history across airtime/data/electricity
router.get('/orders', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { service_type, page = '1', limit = '20' } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);

  let query = supabaseAdmin
    .from('vas_orders')
    .select('*', { count: 'exact' })
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (service_type) query = query.eq('service_type', service_type);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data, meta: { page: Number(page), limit: Number(limit), total: count } });
});

export { router as vasRouter };
