import { Router, Response } from 'express';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { bankingService } from '../services/bankingService.js';
import { getProviderRegistry } from '../providers/registry.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/banking/accounts — local receiving account + IBAN request status
router.get('/accounts', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const accounts = await bankingService.getBankingAccounts(req.user!.id);
  res.json({ success: true, data: accounts });
});

// POST /api/banking/iban/request — request (or fetch existing) EU IBAN account
// Optional: ?preferredProvider=lorum to request specific provider
router.post('/iban/request', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { preferredProvider } = req.query;
    const ibanAccount = await bankingService.requestIbanAccount(
      req.user!.id,
      preferredProvider as string | undefined
    );
    res.status(201).json({ success: true, data: ibanAccount });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Identity verification')) {
      res.status(403).json({ success: false, error: err.message });
      return;
    }
    if (err instanceof Error && err.message.includes('No available IBAN providers')) {
      res.status(503).json({ success: false, error: err.message });
      return;
    }
    throw err;
  }
});

// POST /api/banking/iban/switch-provider — admin: switch provider for pending IBAN
router.post('/iban/switch-provider', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { newProvider } = req.body;
    if (!newProvider) {
      res.status(400).json({ success: false, error: 'newProvider is required' });
      return;
    }

    const ibanAccount = await bankingService.switchProvider(req.user!.id, newProvider);
    res.json({ success: true, data: ibanAccount });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Cannot switch providers')) {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    throw err;
  }
});

// GET /api/banking/providers — admin: get provider status and health
router.get('/providers', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const registry = getProviderRegistry();
    const health = await registry.getHealthStatus();
    const providers = Array.from(registry.getAllProviders().entries()).map(([name, provider]) => ({
      name,
      class: provider.constructor.name,
    }));

    res.json({
      success: true,
      data: {
        providers,
        health,
      },
    });
  } catch (err) {
    logger.error(`Failed to get provider status: ${err instanceof Error ? err.message : String(err)}`);
    res.status(500).json({ success: false, error: 'Failed to get provider status' });
  }
});

// POST /api/banking/providers/health — admin: trigger health check on all providers
router.post('/providers/health', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const registry = getProviderRegistry();
    const health = await registry.getHealthStatus();
    res.json({ success: true, data: health });
  } catch (err) {
    logger.error(`Health check failed: ${err instanceof Error ? err.message : String(err)}`);
    res.status(500).json({ success: false, error: 'Health check failed' });
  }
});

export { router as bankingRouter };
