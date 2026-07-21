// =============================================================================
// Invoicing, Quotations & Receipting — billing for business clients
// =============================================================================
import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';

const router = Router();

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
});

function computeTotals(lineItems: z.infer<typeof lineItemSchema>[], taxPercent: number) {
  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0);
  const taxAmount = subtotal * (taxPercent / 100);
  return { subtotal: round2(subtotal), taxAmount: round2(taxAmount), total: round2(subtotal + taxAmount) };
}
function round2(n: number) { return Math.round(n * 100) / 100; }

// ── Clients ──────────────────────────────────────────────────────────────
const clientSchema = z.object({
  name: z.string().min(1).max(150),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
});

router.get('/clients', authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin.from('billing_clients').select('*').order('name');
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

router.post('/clients', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const body = clientSchema.parse(req.body);
  const { data, error } = await supabaseAdmin.from('billing_clients').insert({ ...body, created_by: req.user!.id }).select().single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.status(201).json({ success: true, data });
});

// ── Quotations ───────────────────────────────────────────────────────────
const quoteSchema = z.object({
  client_id: z.string().uuid(),
  line_items: z.array(lineItemSchema).min(1),
  currency: z.enum(['USD', 'EUR', 'GBP', 'ZAR']).default('USD'),
  tax_percent: z.number().min(0).max(100).default(0),
  valid_until: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

router.get('/quotations', authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin.from('quotations').select('*, billing_clients(name, email)').order('created_at', { ascending: false });
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

router.post('/quotations', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const body = quoteSchema.parse(req.body);
  const totals = computeTotals(body.line_items, body.tax_percent);
  const { data, error } = await supabaseAdmin
    .from('quotations')
    .insert({ ...body, subtotal: totals.subtotal, tax_amount: totals.taxAmount, total: totals.total, created_by: req.user!.id })
    .select()
    .single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.status(201).json({ success: true, data });
});

router.patch('/quotations/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body as { status: string };
  const { data, error } = await supabaseAdmin.from('quotations').update({ status }).eq('id', req.params.id).select().single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

// POST /api/admin/invoicing/quotations/:id/convert — quote -> invoice
router.post('/quotations/:id/convert', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { data: quote } = await supabaseAdmin.from('quotations').select('*').eq('id', req.params.id).single();
  if (!quote) { res.status(404).json({ success: false, error: 'Quotation not found' }); return; }

  const { data: invoice, error } = await supabaseAdmin
    .from('invoices')
    .insert({
      client_id: quote.client_id, quotation_id: quote.id, line_items: quote.line_items,
      currency: quote.currency, subtotal: quote.subtotal, tax_percent: quote.tax_percent,
      tax_amount: quote.tax_amount, total: quote.total, notes: quote.notes, created_by: req.user!.id,
    })
    .select()
    .single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.status(201).json({ success: true, data: invoice });
});

// ── Invoices ─────────────────────────────────────────────────────────────
const invoiceSchema = z.object({
  client_id: z.string().uuid(),
  line_items: z.array(lineItemSchema).min(1),
  currency: z.enum(['USD', 'EUR', 'GBP', 'ZAR']).default('USD'),
  tax_percent: z.number().min(0).max(100).default(0),
  due_date: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

router.get('/invoices', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.query as { status?: string };
  let query = supabaseAdmin.from('invoices').select('*, billing_clients(name, email)').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

router.post('/invoices', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const body = invoiceSchema.parse(req.body);
  const totals = computeTotals(body.line_items, body.tax_percent);
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .insert({ ...body, subtotal: totals.subtotal, tax_amount: totals.taxAmount, total: totals.total, created_by: req.user!.id })
    .select()
    .single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.status(201).json({ success: true, data });
});

router.patch('/invoices/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body as { status: string };
  const { data, error } = await supabaseAdmin.from('invoices').update({ status }).eq('id', req.params.id).select().single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

// POST /api/admin/invoicing/invoices/:id/record-payment — marks paid, issues a receipt
const paymentSchema = z.object({
  payment_method: z.string().min(1).max(100),
  payment_reference: z.string().max(200).optional(),
});

router.post('/invoices/:id/record-payment', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const body = paymentSchema.parse(req.body);
  const { data: invoice } = await supabaseAdmin.from('invoices').select('*').eq('id', req.params.id).single();
  if (!invoice) { res.status(404).json({ success: false, error: 'Invoice not found' }); return; }
  if (invoice.status === 'paid') { res.status(400).json({ success: false, error: 'Already paid' }); return; }

  await supabaseAdmin
    .from('invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString(), payment_reference: body.payment_reference ?? null })
    .eq('id', invoice.id);

  const { data: receipt, error } = await supabaseAdmin
    .from('receipts')
    .insert({
      invoice_id: invoice.id, amount: invoice.total, currency: invoice.currency,
      payment_method: body.payment_method, issued_by: req.user!.id,
    })
    .select()
    .single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  res.status(201).json({ success: true, data: receipt });
});

// ── Receipts ─────────────────────────────────────────────────────────────
router.get('/receipts', authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('receipts')
    .select('*, invoices(invoice_number, billing_clients(name))')
    .order('created_at', { ascending: false });
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

export { router as invoicingRouter };
