// =============================================================================
// Reports — real, exportable operational/financial reports over existing data
// =============================================================================
import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';

const router = Router();

const rangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
}

// GET /api/admin/reports/transactions?from=&to=&format=csv|json
router.get('/transactions', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { from, to } = rangeSchema.parse(req.query);
  const format = (req.query.format as string) ?? 'json';

  let query = supabaseAdmin
    .from('wallet_transactions')
    .select('reference, type, direction, amount, fee, net_amount, currency, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions-report.csv"');
    res.send(toCsv(data ?? []));
    return;
  }
  res.json({ success: true, data });
});

// GET /api/admin/reports/revenue?from=&to= — fees collected, grouped by type
router.get('/revenue', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { from, to } = rangeSchema.parse(req.query);

  let query = supabaseAdmin
    .from('wallet_transactions')
    .select('type, fee, currency, created_at')
    .eq('status', 'completed')
    .gt('fee', 0);

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  const byType = new Map<string, number>();
  let total = 0;
  for (const row of data ?? []) {
    const fee = Number(row.fee);
    byType.set(row.type, (byType.get(row.type) ?? 0) + fee);
    total += fee;
  }

  res.json({
    success: true,
    data: {
      total_fees: total,
      by_type: Array.from(byType.entries()).map(([type, amount]) => ({ type, amount })),
      transaction_count: (data ?? []).length,
    },
  });
});

// GET /api/admin/reports/user-growth?from=&to= — daily signups
router.get('/user-growth', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { from, to } = rangeSchema.parse(req.query);

  let query = supabaseAdmin.from('profiles').select('role, created_at').order('created_at');
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  const byDay = new Map<string, number>();
  for (const row of data ?? []) {
    const day = row.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  res.json({
    success: true,
    data: {
      total: (data ?? []).length,
      by_role: Object.fromEntries(
        Object.entries(
          (data ?? []).reduce((acc: Record<string, number>, r) => { acc[r.role] = (acc[r.role] ?? 0) + 1; return acc; }, {})
        )
      ),
      daily: Array.from(byDay.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
    },
  });
});

export { router as reportsRouter };
