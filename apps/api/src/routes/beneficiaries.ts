import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { beneficiaryService } from '../services/beneficiaryService.js';

const router = Router();

const createBeneficiarySchema = z.object({
  nickname: z.string().optional(),
  beneficiary_type: z.enum(['bank', 'mobile_money', 'crypto', 'card']),
  account_name: z.string().optional(),
  account_number: z.string().optional(),
  bank_name: z.string().optional(),
  bank_code: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  routing_number: z.string().optional(),
  swift_code: z.string().optional(),
  mobile_number: z.string().optional(),
  mobile_provider: z.string().optional(),
  crypto_address: z.string().optional(),
  crypto_network: z.string().optional(),
});

const updateBeneficiarySchema = z.object({
  nickname: z.string().optional(),
  is_favourite: z.boolean().optional(),
});

// GET /api/beneficiaries — list saved beneficiaries
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const beneficiaries = await beneficiaryService.list(req.user!.id);
  res.json({ success: true, data: beneficiaries });
});

// POST /api/beneficiaries — save a new beneficiary
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const body = createBeneficiarySchema.parse(req.body);
  const beneficiary = await beneficiaryService.create({ ...body, user_id: req.user!.id });
  res.status(201).json({ success: true, data: beneficiary });
});

// PATCH /api/beneficiaries/:id — update nickname / favourite
router.patch('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const body = updateBeneficiarySchema.parse(req.body);
  const beneficiary = await beneficiaryService.update(String(req.params.id), req.user!.id, body);
  res.json({ success: true, data: beneficiary });
});

// DELETE /api/beneficiaries/:id — remove a saved beneficiary
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  await beneficiaryService.remove(String(req.params.id), req.user!.id);
  res.json({ success: true, message: 'Beneficiary removed' });
});

export { router as beneficiaryRouter };
