// =============================================================================
// Providers — configured payment/service provider status and recent activity
// =============================================================================
import { Router, Response } from 'express';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';
import { provider } from '../utils/provider.js';
import { vitalPay } from '../utils/vitalpay.js';
import { env } from '../config/index.js';

const router = Router();

// GET /api/admin/providers — the one configured provider (VitalPay), live
// reachability, and recent operation stats from provider_logs.
router.get('/', authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const start = Date.now();
  let reachable = true;
  let latencyMs: number | null = null;
  try {
    await vitalPay.getCategories();
    latencyMs = Date.now() - start;
  } catch {
    reachable = false;
  }

  const { data: recentLogs } = await supabaseAdmin
    .from('provider_logs')
    .select('operation, success, duration_ms, error_message, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const successCount = (recentLogs ?? []).filter(l => l.success).length;
  const failureCount = (recentLogs ?? []).length - successCount;

  res.json({
    success: true,
    data: {
      providers: [{
        name: provider.name,
        base_url: env.VITALPAY_BASE_URL,
        reachable,
        latency_ms: latencyMs,
        recent_operations: recentLogs ?? [],
        recent_success_count: successCount,
        recent_failure_count: failureCount,
      }],
    },
  });
});

export { router as providersRouter };
