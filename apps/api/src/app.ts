// =============================================================================
// vPay API Application
// =============================================================================

import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { env } from './config/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import { cardRouter } from './routes/cards.js';
import { walletRouter } from './routes/wallets.js';
import { voucherRouter } from './routes/vouchers.js';
import { bankingRouter } from './routes/banking.js';
import { beneficiaryRouter } from './routes/beneficiaries.js';
import { vasRouter } from './routes/vas.js';
import { reportsRouter } from './routes/reports.js';
import { providersRouter } from './routes/providers.js';
import { escrowRouter } from './routes/escrow.js';
import { disputesRouter } from './routes/disputes.js';
import { communicationsRouter } from './routes/communications.js';
import { promoCodesRouter } from './routes/promoCodes.js';
import { leadsRouter } from './routes/leads.js';
import { invoicingRouter } from './routes/invoicing.js';
import { loansRouter } from './routes/loans.js';
import { partnersRouter } from './routes/partners.js';
import { tasksRouter } from './routes/tasks.js';
import { apiKeysRouter } from './routes/apiKeys.js';
import { aiAssistantRouter } from './routes/aiAssistant.js';
import { hrRouter } from './routes/hr.js';
import { handleVitalPayWebhook } from './webhooks/vitalPayWebhook.js';
import { authenticate, requireAdmin, requireAgent, requireSuperAdmin, AuthenticatedRequest } from './middleware/auth.js';
import { supabaseAdmin } from './utils/supabase.js';
import { ensureProvidersInitialized } from './providers/registry.js';
import { vitalPay } from './utils/vitalpay.js';
import { walletService } from './services/walletService.js';

const app = express();

app.set('trust proxy', 1);

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Fixed production/staging domains come from CORS_ORIGINS. On top of that,
// allow any *.vercel.app / *.netlify.app preview URL — this app gets
// deployed ad hoc to fresh Vercel/Netlify projects during testing, and
// auth is Bearer-token-based (not cookies), so accepting these preview
// origins doesn't expose a CSRF/cookie risk the way it would for a
// cookie-authenticated app.
const fixedOrigins = new Set([
  ...env.CORS_ORIGINS.split(','),
  // Capacitor native app shells — pinned in capacitor.config.ts
  // (androidScheme: 'https' -> https://localhost, iosScheme: 'capacitor'
  // -> capacitor://localhost). No credentials/cookies are involved
  // (Bearer-token auth), so a fixed local-scheme origin is safe to allow.
  'https://localhost',
  'capacitor://localhost',
]);
const previewOriginPattern = /^https:\/\/[a-z0-9-]+\.(vercel\.app|netlify\.app)$/;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || fixedOrigins.has(origin) || previewOriginPattern.test(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many attempts. Please wait.' },
});

app.use('/api', globalLimiter);
app.use('/api/auth', strictLimiter);

// ─── Compression ──────────────────────────────────────────────────────────────
app.use(compression());

// ─── Webhooks — raw body BEFORE json parsing ──────────────────────────────────
app.post(
  '/webhooks/vitalpay',
  express.raw({ type: 'application/json' }),
  (req, _res, next) => {
    (req as express.Request & { rawBody: string }).rawBody = req.body.toString();
    req.body = JSON.parse(req.body.toString());
    next();
  },
  handleVitalPayWebhook
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── Request Logging ──────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.url }, 'Incoming request');
  next();
});

// ─── IBAN Provider Registry ───────────────────────────────────────────────────
// index.ts (Railway/local) initializes this before listen(); serverless.ts
// (Vercel) has no such startup hook, so it's lazily initialized here instead.
app.use(async (_req, _res, next) => {
  try {
    await ensureProvidersInitialized();
  } catch (err) {
    logger.warn({ err }, 'Provider initialization warning — continuing without full provider registry');
  }
  next();
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// GET /api/announcements/active — unauthenticated. The consumer/agent apps
// poll this to show a site-wide banner; only ever reads the one
// admin-managed key, never the rest of system_config (fee_config etc. stay
// admin-only via /api/admin/config).
app.get('/api/announcements/active', async (_req, res) => {
  const { data } = await supabaseAdmin
    .from('system_config')
    .select('value')
    .eq('key', 'announcement')
    .maybeSingle();

  const announcement = data?.value as { enabled?: boolean } | undefined;
  if (!announcement?.enabled) {
    res.json({ success: true, data: null });
    return;
  }
  res.json({ success: true, data: announcement });
});

// GET /api/feature-flags — unauthenticated. Modules can be toggled off from
// Super Admin → Modules without a deploy; the frontend gates features by
// checking this. Unset flags default to true (opt-out, not opt-in) so
// existing features don't silently disappear the first time this loads
// with no config row yet.
app.get('/api/feature-flags', async (_req, res) => {
  const { data } = await supabaseAdmin
    .from('system_config')
    .select('value')
    .eq('key', 'feature_flags')
    .maybeSingle();

  res.json({ success: true, data: (data?.value as Record<string, boolean>) ?? {} });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/cards', cardRouter);
app.use('/api/wallets', walletRouter);
app.use('/api/vouchers', voucherRouter);
app.use('/api/banking', bankingRouter);
app.use('/api/beneficiaries', beneficiaryRouter);
app.use('/api/vas', vasRouter);
app.use('/api/admin/reports', reportsRouter);
app.use('/api/admin/providers', providersRouter);
app.use('/api/admin/escrow', escrowRouter);
app.use('/api/disputes', disputesRouter);
app.use('/api/admin/communications', communicationsRouter);
app.use('/api/promo', promoCodesRouter);
app.use('/api/admin/leads', leadsRouter);
app.use('/api/admin/invoicing', invoicingRouter);
app.use('/api/admin/loans', loansRouter);
app.use('/api/admin/partners', partnersRouter);
app.use('/api/admin/tasks', tasksRouter);
app.use('/api/admin/api-keys', apiKeysRouter);
app.use('/api/admin/ai-assistant', aiAssistantRouter);
app.use('/api/admin/hr', hrRouter);

// ─── Profile Routes ───────────────────────────────────────────────────────────
app.get('/api/profile', authenticate, async (req: AuthenticatedRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    // agent_profiles has two FKs to profiles (user_id and approved_by) —
    // PostgREST can't auto-pick one, so the embed must name the column
    // explicitly or every call to this endpoint 500s with "more than one
    // relationship was found".
    .select('*, agent_profiles!agent_profiles_user_id_fkey(*)')
    .eq('id', req.user!.id)
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

app.patch('/api/profile', authenticate, async (req: AuthenticatedRequest, res) => {
  const allowedFields = ['full_name', 'display_name', 'phone', 'date_of_birth', 'nationality', 'address', 'preferred_currency'];
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in req.body) updates[field] = (req.body as Record<string, unknown>)[field];
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', req.user!.id)
    .select()
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

// ─── Notifications ────────────────────────────────────────────────────────────
app.get('/api/notifications', authenticate, async (req: AuthenticatedRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

app.patch('/api/notifications/:id/read', authenticate, async (req: AuthenticatedRequest, res) => {
  await supabaseAdmin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id);
  res.json({ success: true });
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────
app.get('/api/admin/metrics', authenticate, requireAdmin, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('vw_platform_metrics')
    .select('*')
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

// GET /api/admin/metrics/history — real 30-day volume/fees/cards series and
// network breakdown for the dashboard charts (previously Math.random() mock
// data and a hardcoded percentage split).
app.get('/api/admin/metrics/history', authenticate, requireAdmin, async (_req, res) => {
  const [{ data: daily, error: dailyErr }, { data: byNetwork, error: netErr }] = await Promise.all([
    supabaseAdmin.from('vw_daily_volume_30d').select('*'),
    supabaseAdmin.from('vw_cards_by_network').select('*'),
  ]);
  if (dailyErr || netErr) {
    res.status(500).json({ success: false, error: (dailyErr ?? netErr)!.message });
    return;
  }
  res.json({ success: true, data: { daily, cards_by_network: byNetwork } });
});

// GET /api/admin/system-health — real checks, not a hardcoded "all green"
// panel. Each check reports what was actually observed; a check that
// couldn't run reports unknown rather than being silently marked healthy.
app.get('/api/admin/system-health', authenticate, requireAdmin, async (_req, res) => {
  const checks: Array<{ name: string; status: 'operational' | 'degraded' | 'down' | 'unknown'; detail: string }> = [];

  const dbStart = Date.now();
  const { error: dbError } = await supabaseAdmin.from('profiles').select('id').limit(1);
  checks.push(dbError
    ? { name: 'Database', status: 'down', detail: dbError.message }
    : { name: 'Database', status: 'operational', detail: `${Date.now() - dbStart}ms` });

  const vpStart = Date.now();
  try {
    await vitalPay.getCategories();
    checks.push({ name: 'VitalPay API', status: 'operational', detail: `${Date.now() - vpStart}ms` });
  } catch (err) {
    checks.push({ name: 'VitalPay API', status: 'down', detail: err instanceof Error ? err.message : 'Unreachable' });
  }

  const { data: lastWebhook } = await supabaseAdmin
    .from('webhook_events')
    .select('created_at, status')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  checks.push(lastWebhook
    ? { name: 'Webhook Engine', status: 'operational', detail: `Last event: ${lastWebhook.created_at} (${lastWebhook.status})` }
    : { name: 'Webhook Engine', status: 'unknown', detail: 'No webhook events recorded yet' });

  const { count: failedWebhookCount } = await supabaseAdmin
    .from('webhook_events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  checks.push({
    name: 'Webhook Failures (24h)',
    status: failedWebhookCount ? 'degraded' : 'operational',
    detail: failedWebhookCount ? `${failedWebhookCount} failed in the last 24h` : 'None in the last 24h',
  });

  res.json({ success: true, data: { checks, checked_at: new Date().toISOString() } });
});

app.get('/api/admin/users', authenticate, requireAdmin, async (req, res) => {
  const { page = '1', limit = '20', role, status } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);

  let query = supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, role, status, kyc_status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (role) query = query.eq('role', role);
  if (status) query = query.eq('status', status);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data, meta: { page: Number(page), limit: Number(limit), total: count } });
});

app.get('/api/admin/agents', authenticate, requireAdmin, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('vw_agent_metrics')
    .select('*');

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

app.patch('/api/admin/users/:id/status', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const { status } = req.body as { status: string };
  const allowed = ['active', 'suspended', 'closed'];
  if (!allowed.includes(status)) {
    res.status(400).json({ success: false, error: 'Invalid status' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ status })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  await supabaseAdmin.rpc('create_audit_log', {
    p_actor_id: req.user!.id,
    p_action: `user.status.${status}`,
    p_resource_type: 'profile',
    p_resource_id: req.params.id,
    p_changes: { status },
  });

  res.json({ success: true, data });
});

// ─── Agent Routes ─────────────────────────────────────────────────────────────
app.get('/api/agent/metrics', authenticate, requireAgent, async (req: AuthenticatedRequest, res) => {
  // Super Admin's usable float is the System Wallet (master_pool) itself —
  // and that wallet is PLATFORM-WIDE (any super_admin operates the same
  // one), not owned by whichever super_admin happened to create it, so no
  // user_id filter for that lookup. Staff/agent each have their own
  // per-user agent_float wallet, allocated individually.
  const isSuperAdminCaller = req.user!.role === 'super_admin';
  const floatQuery = isSuperAdminCaller
    ? supabaseAdmin.from('wallets').select('balance, currency').eq('wallet_type', 'master_pool').single()
    : supabaseAdmin.from('wallets').select('balance, currency').eq('user_id', req.user!.id).eq('wallet_type', 'agent_float').single();
  const [vouchersRes, cardsRes, commissionsRes, floatRes] = await Promise.all([
    supabaseAdmin.from('vouchers').select('id, status, amount', { count: 'exact' }).eq('issuer_id', req.user!.id),
    supabaseAdmin.from('cards').select('id', { count: 'exact' }).eq('issued_by_agent', req.user!.id),
    supabaseAdmin.from('commissions').select('amount, currency').eq('agent_id', req.user!.id).eq('status', 'completed'),
    floatQuery,
  ]);

  const totalCommissions = (commissionsRes.data ?? []).reduce((s: number, c: { amount: number }) => s + Number(c.amount), 0);
  const redeemed = (vouchersRes.data ?? []).filter((v: { status: string }) => v.status === 'redeemed').length;

  res.json({
    success: true,
    data: {
      total_vouchers_issued: vouchersRes.count ?? 0,
      vouchers_redeemed: redeemed,
      total_cards_issued: cardsRes.count ?? 0,
      total_commissions_earned: totalCommissions,
      float_balance: floatRes.data?.balance ?? 0,
      currency: floatRes.data?.currency ?? 'USD',
    },
  });
});

app.get('/api/agent/customers', authenticate, requireAgent, async (req: AuthenticatedRequest, res) => {
  const { page = '1', limit = '20' } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);

  const { data: issuedCards } = await supabaseAdmin
    .from('cards')
    .select('user_id')
    .eq('issued_by_agent', req.user!.id);

  const customerIds = [...new Set((issuedCards ?? []).map((c: { user_id: string }) => c.user_id))];

  if (customerIds.length === 0) {
    res.json({ success: true, data: [], meta: { page: 1, limit: Number(limit), total: 0 } });
    return;
  }

  const { data, count, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, status, kyc_status, created_at', { count: 'exact' })
    .in('id', customerIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data, meta: { page: Number(page), limit: Number(limit), total: count } });
});

// ─── KYC Routes ───────────────────────────────────────────────────────────────
app.get('/api/kyc', authenticate, async (req: AuthenticatedRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('kyc_documents')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false });

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

app.post('/api/kyc', authenticate, async (req: AuthenticatedRequest, res) => {
  const { document_type, document_number, front_url, back_url, selfie_url, country_of_issue, expiry_date } =
    req.body as Record<string, string>;

  if (!document_type || !front_url) {
    res.status(400).json({ success: false, error: 'document_type and front_url are required' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('kyc_documents')
    .upsert({ user_id: req.user!.id, document_type, document_number, front_url, back_url, selfie_url, country_of_issue, expiry_date, status: 'pending' },
      { onConflict: 'user_id,document_type' })
    .select()
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  await supabaseAdmin
    .from('profiles')
    .update({ kyc_status: 'pending' })
    .eq('id', req.user!.id);

  res.status(201).json({ success: true, data });
});

// ─── Support Tickets (User) ───────────────────────────────────────────────────
app.get('/api/support-tickets', authenticate, async (req: AuthenticatedRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false });

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

app.post('/api/support-tickets', authenticate, async (req: AuthenticatedRequest, res) => {
  const { subject, description, category, priority } = req.body as Record<string, string>;

  if (!subject || !description || !category) {
    res.status(400).json({ success: false, error: 'subject, description, and category are required' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .insert({ user_id: req.user!.id, subject, description, category, priority: priority ?? 'normal', status: 'open' })
    .select()
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.status(201).json({ success: true, data });
});

// ─── Admin: KYC Review ────────────────────────────────────────────────────────
app.get('/api/admin/kyc', authenticate, requireAdmin, async (req, res) => {
  const { page = '1', limit = '20', status } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);

  let query = supabaseAdmin
    .from('kyc_documents')
    .select('*, profiles!kyc_documents_user_id_fkey(full_name, email, kyc_status)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (status) query = query.eq('status', status);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data, meta: { page: Number(page), limit: Number(limit), total: count } });
});

app.patch('/api/admin/kyc/:id/review', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const { status, rejection_reason } = req.body as { status: string; rejection_reason?: string };

  if (!['approved', 'rejected'].includes(status)) {
    res.status(400).json({ success: false, error: 'Status must be approved or rejected' });
    return;
  }

  const { data: doc, error: fetchError } = await supabaseAdmin
    .from('kyc_documents')
    .update({ status, rejection_reason, reviewed_by: req.user!.id, reviewed_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (fetchError) { res.status(500).json({ success: false, error: fetchError.message }); return; }

  await supabaseAdmin
    .from('profiles')
    .update({ kyc_status: status === 'approved' ? 'approved' : 'rejected' })
    .eq('id', doc.user_id);

  res.json({ success: true, data: doc });
});

// ─── Admin: Support Tickets ───────────────────────────────────────────────────
app.get('/api/admin/support-tickets', authenticate, requireAdmin, async (req, res) => {
  const { page = '1', limit = '20', status, priority } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);

  let query = supabaseAdmin
    .from('support_tickets')
    .select('*, profiles!support_tickets_user_id_fkey(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data, meta: { page: Number(page), limit: Number(limit), total: count } });
});

app.patch('/api/admin/support-tickets/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const { status, assigned_to, priority } = req.body as Record<string, string>;
  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (assigned_to) updates.assigned_to = assigned_to;
  if (priority) updates.priority = priority;
  if (status === 'resolved' || status === 'closed') updates.resolved_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

// ─── Admin: Fraud Flags ───────────────────────────────────────────────────────
app.get('/api/admin/fraud-flags', authenticate, requireAdmin, async (req, res) => {
  const { page = '1', limit = '25', status, severity } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);

  let query = supabaseAdmin
    .from('fraud_flags')
    .select('*, profiles!fraud_flags_user_id_fkey(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (status) query = query.eq('status', status);
  if (severity) query = query.eq('severity', severity);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data, meta: { page: Number(page), limit: Number(limit), total: count } });
});

app.patch('/api/admin/fraud-flags/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const { status, resolution_notes } = req.body as { status: string; resolution_notes?: string };
  const allowed = ['investigating', 'resolved', 'false_positive'];
  if (!allowed.includes(status)) { res.status(400).json({ success: false, error: 'Invalid status' }); return; }

  const { data, error } = await supabaseAdmin
    .from('fraud_flags')
    .update({ status, resolution_notes, reviewed_by: req.user!.id, reviewed_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

// ─── Admin: Issue Card for Any User ──────────────────────────────────────────
app.post('/api/admin/cards/issue', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const { target_user_id, cardholder_name, card_type, network, currency, amount,
          spending_limit_daily, spending_limit_per_transaction, expires_at } =
    req.body as Record<string, unknown>;

  if (!target_user_id || !cardholder_name || !amount) {
    res.status(400).json({ success: false, error: 'target_user_id, cardholder_name and amount are required' });
    return;
  }

  // Verify target user exists
  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, status')
    .eq('id', target_user_id as string)
    .single();

  if (!targetProfile || targetProfile.status !== 'active') {
    res.status(404).json({ success: false, error: 'Target user not found or not active' });
    return;
  }

  const { cardService } = await import('./services/cardService.js');
  const card = await cardService.issueCard({
    user_id: target_user_id as string,
    issued_by_agent: req.user!.id,        // deducts from admin's agent_float
    cardholder_name: cardholder_name as string,
    card_type: (card_type as never) ?? 'single_use',
    network: (network as never) ?? 'visa',
    currency: (currency as never) ?? 'USD',
    amount: Number(amount),
    spending_limit_daily: spending_limit_daily ? Number(spending_limit_daily) : undefined,
    spending_limit_per_transaction: spending_limit_per_transaction ? Number(spending_limit_per_transaction) : undefined,
    expires_at: expires_at as string | undefined,
  });

  await supabaseAdmin.rpc('create_audit_log', {
    p_actor_id: req.user!.id,
    p_action: 'card.admin_issued',
    p_resource_type: 'card',
    p_resource_id: card.id,
    p_changes: { target_user_id, amount, currency, network, card_type },
  });

  res.status(201).json({ success: true, data: card, message: `Card issued to ${targetProfile.full_name}` });
});

// ─── Admin: Cards ─────────────────────────────────────────────────────────────
app.get('/api/admin/cards', authenticate, requireAdmin, async (req, res) => {
  const { page = '1', limit = '25', status, network } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);

  let query = supabaseAdmin
    .from('cards')
    .select('*, profiles!cards_user_id_fkey(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (status) query = query.eq('status', status);
  if (network) query = query.eq('network', network);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data, meta: { page: Number(page), limit: Number(limit), total: count } });
});

// ─── Admin: Payout Requests ───────────────────────────────────────────────────
app.get('/api/admin/payout-requests', authenticate, requireAdmin, async (req, res) => {
  const { page = '1', limit = '25', status, method } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);

  let query = supabaseAdmin
    .from('payout_requests')
    .select('*, profiles!payout_requests_user_id_fkey(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (status) query = query.eq('status', status);
  if (method) query = query.eq('method', method);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data, meta: { page: Number(page), limit: Number(limit), total: count } });
});

app.patch('/api/admin/payout-requests/:id/status', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const { status, notes } = req.body as { status: string; notes?: string };
  const allowed = ['processing', 'completed', 'failed', 'cancelled'];
  if (!allowed.includes(status)) { res.status(400).json({ success: false, error: 'Invalid status' }); return; }

  const { data, error } = await supabaseAdmin
    .from('payout_requests')
    .update({ status, notes, processed_by: req.user!.id, processed_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

// ─── Admin: Banking Services ──────────────────────────────────────────────────
app.get('/api/admin/banking/accounts', authenticate, requireAdmin, async (req, res) => {
  const { page = '1', limit = '25' } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);

  const { data, count, error } = await supabaseAdmin
    .from('virtual_accounts')
    .select('*, profiles!virtual_accounts_user_id_fkey(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data, meta: { page: Number(page), limit: Number(limit), total: count } });
});

app.get('/api/admin/banking/iban-requests', authenticate, requireAdmin, async (req, res) => {
  const { page = '1', limit = '25', status } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);

  let query = supabaseAdmin
    .from('iban_accounts')
    .select('*, profiles!iban_accounts_user_id_fkey(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (status) query = query.eq('status', status);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data, meta: { page: Number(page), limit: Number(limit), total: count } });
});

app.patch('/api/admin/banking/iban-requests/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const { status, iban, bic, bank_name, rejection_reason } = req.body as {
    status?: string; iban?: string; bic?: string; bank_name?: string; rejection_reason?: string;
  };
  const allowed = ['requested', 'in_review', 'provisioning', 'active', 'rejected'];
  if (status && !allowed.includes(status)) {
    res.status(400).json({ success: false, error: 'Invalid status' });
    return;
  }

  const { data: existing } = await supabaseAdmin
    .from('iban_accounts')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (!existing) { res.status(404).json({ success: false, error: 'IBAN request not found' }); return; }

  if (status === 'active' && !((iban ?? existing.iban) && (bic ?? existing.bic) && (bank_name ?? existing.bank_name))) {
    res.status(400).json({ success: false, error: 'iban, bic, and bank_name are required to activate' });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (iban) updates.iban = iban;
  if (bic) updates.bic = bic;
  if (bank_name) updates.bank_name = bank_name;
  if (rejection_reason) updates.rejection_reason = rejection_reason;

  if (status === 'active') {
    updates.activated_at = new Date().toISOString();
    const { walletService } = await import('./services/walletService.js');
    const wallet = await walletService.ensureWallet(existing.user_id, existing.requested_currency ?? 'EUR', 'consumer');
    updates.wallet_id = wallet.id;
  }

  const { data, error } = await supabaseAdmin
    .from('iban_accounts')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  await supabaseAdmin.rpc('create_audit_log', {
    p_actor_id: req.user!.id,
    p_action: `iban_account.${status ?? 'updated'}`,
    p_resource_type: 'iban_account',
    p_resource_id: req.params.id,
    p_changes: updates,
  });

  res.json({ success: true, data });
});

// ─── Admin: Settlements ───────────────────────────────────────────────────────
app.get('/api/admin/settlements', authenticate, requireAdmin, async (req, res) => {
  const { page = '1', limit = '20', status } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);

  let query = supabaseAdmin
    .from('settlements')
    .select('*, profiles!settlements_initiated_by_fkey(full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (status) query = query.eq('status', status);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data, meta: { page: Number(page), limit: Number(limit), total: count } });
});

app.post('/api/admin/settlements', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const { settlement_period_start, settlement_period_end, currency, notes } = req.body as Record<string, string>;

  const { data, error } = await supabaseAdmin
    .from('settlements')
    .insert({ settlement_period_start, settlement_period_end, currency: currency ?? 'USD', notes, initiated_by: req.user!.id, status: 'pending' })
    .select()
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

// ─── Admin: Exchange Rates ────────────────────────────────────────────────────
app.get('/api/admin/exchange-rates', authenticate, requireAdmin, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('exchange_rates')
    .select('*')
    .eq('is_active', true)
    .order('from_currency');

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

// ─── Admin: Webhook Events ────────────────────────────────────────────────────
app.get('/api/admin/webhook-events', authenticate, requireAdmin, async (req, res) => {
  const { page = '1', limit = '25', status, event_type } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);

  let query = supabaseAdmin
    .from('webhook_events')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (status) query = query.eq('status', status);
  if (event_type) query = query.eq('event_type', event_type);

  const { data, count, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data, meta: { page: Number(page), limit: Number(limit), total: count } });
});

app.post('/api/admin/webhook-events/:id/retry', authenticate, requireAdmin, async (req, res) => {
  const { data: event, error: fetchError } = await supabaseAdmin
    .from('webhook_events')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (fetchError || !event) { res.status(404).json({ success: false, error: 'Event not found' }); return; }

  const { data, error } = await supabaseAdmin
    .from('webhook_events')
    .update({ status: 'retrying', next_retry_at: new Date().toISOString(), attempts: (event.attempts ?? 0) + 1 })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

// ─── Admin: Voucher Batches ───────────────────────────────────────────────────
app.get('/api/admin/voucher-batches', authenticate, requireAdmin, async (req, res) => {
  const { page = '1', limit = '25' } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);

  const { data, count, error } = await supabaseAdmin
    .from('voucher_batches')
    .select('*, profiles!voucher_batches_issuer_id_fkey(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data, meta: { page: Number(page), limit: Number(limit), total: count } });
});

// ─── Admin: System Config ─────────────────────────────────────────────────────
// Covers fee_config, announcement, and feature_flags — all system-wide,
// revenue- or platform-affecting settings, so super_admin only (same tier
// as wallet-adjust/staff-management/role-changes below).
app.get('/api/admin/config', authenticate, requireSuperAdmin, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('system_config')
    .select('*')
    .order('key');

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

app.patch('/api/admin/config/:key', authenticate, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  const { value } = req.body as { value: unknown };

  const { data, error } = await supabaseAdmin
    .from('system_config')
    .upsert({ key: req.params.key, value, updated_by: req.user!.id, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select()
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

// ─── Super Admin: Staff Management ───────────────────────────────────────────
app.get('/api/admin/staff', authenticate, requireAdmin, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, role, status, created_at, last_login_at')
    .in('role', ['super_admin', 'staff'])
    .order('created_at', { ascending: false });
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

app.post('/api/admin/staff', authenticate, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  const { email, full_name, password, role } = req.body as Record<string, string>;
  if (!email || !full_name || !password) {
    res.status(400).json({ success: false, error: 'email, full_name and password are required' }); return;
  }
  if (!['staff'].includes(role)) {
    res.status(400).json({ success: false, error: 'Only staff role can be created this way' }); return;
  }
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name, role: 'staff' },
  });
  if (authErr || !user) { res.status(400).json({ success: false, error: authErr?.message ?? 'Failed to create user' }); return; }
  await supabaseAdmin.from('profiles').update({ role: 'staff', full_name, status: 'active' }).eq('id', user.id);
  await supabaseAdmin.rpc('create_audit_log', {
    p_actor_id: req.user!.id, p_action: 'staff.created',
    p_resource_type: 'profile', p_resource_id: user.id,
    p_changes: { email, role: 'staff' },
  });
  res.status(201).json({ success: true, data: { id: user.id, email, full_name, role: 'staff' } });
});

app.delete('/api/admin/staff/:id', authenticate, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  const { data: target } = await supabaseAdmin.from('profiles').select('role').eq('id', req.params.id).single();
  if (!target) { res.status(404).json({ success: false, error: 'User not found' }); return; }
  if (target.role === 'super_admin') { res.status(403).json({ success: false, error: 'Cannot delete super admin' }); return; }
  await supabaseAdmin.auth.admin.deleteUser(req.params.id);
  await supabaseAdmin.rpc('create_audit_log', {
    p_actor_id: req.user!.id, p_action: 'staff.deleted',
    p_resource_type: 'profile', p_resource_id: req.params.id, p_changes: {},
  });
  res.json({ success: true });
});

app.patch('/api/admin/users/:id/role', authenticate, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  const { role } = req.body as { role: string };
  if (!['consumer', 'agent', 'staff'].includes(role)) {
    res.status(400).json({ success: false, error: 'Role must be consumer, agent, or staff' }); return;
  }
  const { data: target } = await supabaseAdmin.from('profiles').select('role').eq('id', req.params.id).single();
  if (!target) { res.status(404).json({ success: false, error: 'User not found' }); return; }
  if (target.role === 'super_admin') { res.status(403).json({ success: false, error: 'Cannot change super admin role' }); return; }
  const { data, error } = await supabaseAdmin.from('profiles').update({ role }).eq('id', req.params.id).select().single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  if (role === 'agent') {
    await supabaseAdmin.from('agent_profiles').upsert({ user_id: req.params.id }, { onConflict: 'user_id' });
    await supabaseAdmin.from('wallets').upsert({ user_id: req.params.id, wallet_type: 'agent_float', currency: 'USD', status: 'active' }, { onConflict: 'user_id,currency,wallet_type' });
  }
  await supabaseAdmin.rpc('create_audit_log', {
    p_actor_id: req.user!.id, p_action: 'user.role_changed',
    p_resource_type: 'profile', p_resource_id: req.params.id, p_changes: { role },
  });
  res.json({ success: true, data });
});

// ─── Super Admin: Wallet Adjustments ─────────────────────────────────────────
app.get('/api/admin/wallets', authenticate, requireAdmin, async (req, res) => {
  const { page = '1', limit = '25', user_id, wallet_type } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);
  let query = supabaseAdmin
    .from('wallets')
    .select('*, profiles!wallets_user_id_fkey(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);
  if (user_id) query = query.eq('user_id', user_id);
  if (wallet_type) query = query.eq('wallet_type', wallet_type);
  const { data, count, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data, meta: { page: Number(page), limit: Number(limit), total: count } });
});

app.post('/api/admin/wallets/adjust', authenticate, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  const { wallet_id, direction, amount, reason } = req.body as {
    wallet_id: string; direction: 'credit' | 'debit'; amount: number; reason: string;
  };
  if (!wallet_id || !direction || !amount || !reason) {
    res.status(400).json({ success: false, error: 'wallet_id, direction, amount and reason are required' }); return;
  }
  if (amount <= 0) { res.status(400).json({ success: false, error: 'Amount must be positive' }); return; }
  const { data: wallet } = await supabaseAdmin.from('wallets').select('id, user_id, balance, currency').eq('id', wallet_id).single();
  if (!wallet) { res.status(404).json({ success: false, error: 'Wallet not found' }); return; }
  const rpc = direction === 'credit' ? 'record_wallet_credit' : 'record_wallet_debit';
  const { error } = await supabaseAdmin.rpc(rpc, {
    p_wallet_id: wallet_id, p_amount: amount, p_type: 'adjustment',
    p_description: `Admin adjustment: ${reason}`,
    p_metadata: { admin_id: req.user!.id, reason },
  });
  if (error) { res.status(400).json({ success: false, error: error.message }); return; }
  await supabaseAdmin.rpc('create_audit_log', {
    p_actor_id: req.user!.id, p_action: `wallet.admin_${direction}`,
    p_resource_type: 'wallet', p_resource_id: wallet_id,
    p_changes: { direction, amount, reason, balance_before: wallet.balance },
  });
  res.json({ success: true, message: `${direction === 'credit' ? 'Credited' : 'Debited'} ${wallet.currency} ${amount} — ${reason}` });
});

// POST /api/admin/float/allocate — parcel out float from the System Wallet
// (master_pool, sourced from Super Admin's real VitalPay balance) to a
// specific Admin(staff)/Agent's own float wallet. Unlike the generic
// wallet-adjust above, this is a real transfer — it debits master_pool and
// credits the target atomically, so allocations are conserved rather than
// conjured. The target's float wallet is created on first allocation.
app.post('/api/admin/float/allocate', authenticate, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  const { target_email, amount, currency } = req.body as { target_email: string; amount: number; currency: string };
  if (!target_email || !amount || !currency) {
    res.status(400).json({ success: false, error: 'target_email, amount and currency are required' }); return;
  }
  if (amount <= 0) { res.status(400).json({ success: false, error: 'Amount must be positive' }); return; }

  const { data: target } = await supabaseAdmin.from('profiles').select('id, role').eq('email', target_email).single();
  if (!target) { res.status(404).json({ success: false, error: `No user with email ${target_email}` }); return; }
  if (!['agent', 'staff'].includes(target.role)) {
    res.status(400).json({ success: false, error: 'Float can only be allocated to agent or staff accounts' }); return;
  }

  // Platform-wide wallet — not scoped to the calling super_admin's own
  // user_id, since any super_admin operates the same System Wallet.
  const { data: masterPool } = await supabaseAdmin
    .from('wallets').select('id, balance').eq('currency', currency).eq('wallet_type', 'master_pool').single();
  if (!masterPool) { res.status(404).json({ success: false, error: `No System Wallet found for ${currency}` }); return; }
  if (masterPool.balance < amount) {
    res.status(402).json({ success: false, error: `System Wallet has insufficient balance. Available: ${masterPool.balance}` }); return;
  }

  const targetWallet = await walletService.ensureWallet(target.id, currency as never, 'agent_float');

  const { error: debitErr } = await supabaseAdmin.rpc('record_wallet_debit', {
    p_wallet_id: masterPool.id, p_amount: amount, p_type: 'float_top_up',
    p_description: `Float allocated to ${target_email}`, p_metadata: { target_user_id: target.id },
  });
  if (debitErr) { res.status(400).json({ success: false, error: debitErr.message }); return; }

  const { error: creditErr } = await supabaseAdmin.rpc('record_wallet_credit', {
    p_wallet_id: targetWallet.id, p_amount: amount, p_type: 'float_top_up',
    p_description: `Float from Super Admin`, p_metadata: { source: 'master_pool', allocated_by: req.user!.id },
  });
  if (creditErr) {
    // Refund the master pool — the credit side failed after the debit succeeded.
    await supabaseAdmin.rpc('record_wallet_credit', {
      p_wallet_id: masterPool.id, p_amount: amount, p_type: 'reversal',
      p_description: `Float allocation to ${target_email} failed, reversed`, p_metadata: { target_user_id: target.id },
    });
    res.status(500).json({ success: false, error: `Failed to credit target wallet: ${creditErr.message}` });
    return;
  }

  await supabaseAdmin.rpc('create_audit_log', {
    p_actor_id: req.user!.id, p_action: 'float.allocate',
    p_resource_type: 'wallet', p_resource_id: targetWallet.id,
    p_changes: { target_email, amount, currency },
  });

  res.json({ success: true, message: `Allocated ${currency} ${amount} to ${target_email}` });
});

// ─── Super Admin: Audit Logs ──────────────────────────────────────────────────
app.get('/api/admin/audit-logs', authenticate, requireAdmin, async (req, res) => {
  const { page = '1', limit = '25', action, actor_id } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);
  let query = supabaseAdmin
    .from('audit_logs')
    .select('*, profiles!audit_logs_actor_id_fkey(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);
  if (action) query = query.ilike('action', `%${action}%`);
  if (actor_id) query = query.eq('actor_id', actor_id);
  const { data, count, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data, meta: { page: Number(page), limit: Number(limit), total: count } });
});

// ─── Super Admin: All Transactions ───────────────────────────────────────────
app.get('/api/admin/transactions', authenticate, requireAdmin, async (req, res) => {
  const { page = '1', limit = '25', type, direction, status } = req.query as Record<string, string>;
  const offset = (Number(page) - 1) * Number(limit);
  let query = supabaseAdmin
    .from('wallet_transactions')
    .select('*, profiles!wallet_transactions_user_id_fkey(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);
  if (type) query = query.eq('type', type);
  if (direction) query = query.eq('direction', direction);
  if (status) query = query.eq('status', status);
  const { data, count, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data, meta: { page: Number(page), limit: Number(limit), total: count } });
});

// ─── Super Admin: Force password reset ───────────────────────────────────────
app.post('/api/admin/users/:id/reset-password', authenticate, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  const { new_password } = req.body as { new_password: string };
  if (!new_password || new_password.length < 8) {
    res.status(400).json({ success: false, error: 'Password must be at least 8 characters' }); return;
  }
  const { error } = await supabaseAdmin.auth.admin.updateUserById(req.params.id, { password: new_password });
  if (error) { res.status(400).json({ success: false, error: error.message }); return; }
  await supabaseAdmin.rpc('create_audit_log', {
    p_actor_id: req.user!.id, p_action: 'user.password_reset',
    p_resource_type: 'profile', p_resource_id: req.params.id, p_changes: {},
  });
  res.json({ success: true, message: 'Password reset successfully' });
});

// ─── Not Found & Error Handler ────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export { app };
