import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { bankingService } from '../services/bankingService.js';

const router = Router();

// GET /api/banking/accounts — local receiving account + IBAN request status
router.get('/accounts', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const accounts = await bankingService.getBankingAccounts(req.user!.id);
  res.json({ success: true, data: accounts });
});

// POST /api/banking/iban/request — request (or fetch existing) EU IBAN account
router.post('/iban/request', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ibanAccount = await bankingService.requestIbanAccount(req.user!.id);
    res.status(201).json({ success: true, data: ibanAccount });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Identity verification')) {
      res.status(403).json({ success: false, error: err.message });
      return;
    }
    throw err;
  }
});

export { router as bankingRouter };
