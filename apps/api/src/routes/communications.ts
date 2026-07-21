// =============================================================================
// Mass Communication — bulk email to user segments via Resend. If no
// RESEND_API_KEY is configured, the communication saves as a real "draft"
// with a clear reason rather than faking a "sent" status.
// =============================================================================
import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';
import { env } from '../config/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

const createSchema = z.object({
  channel: z.enum(['email', 'sms', 'push']).default('email'),
  segment: z.enum(['all', 'consumer', 'agent', 'staff']).default('all'),
  subject: z.string().max(150).optional(),
  message: z.string().min(1).max(5000),
});

async function resolveRecipients(segment: string): Promise<Array<{ email: string }>> {
  let query = supabaseAdmin.from('profiles').select('email').eq('status', 'active');
  if (segment !== 'all') query = query.eq('role', segment);
  const { data } = await query;
  return (data ?? []).filter(r => !!r.email);
}

router.get('/', authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('communications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

router.post('/', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const body = createSchema.parse(req.body);
  const recipients = await resolveRecipients(body.segment);

  const { data: comm, error: insertErr } = await supabaseAdmin
    .from('communications')
    .insert({ ...body, recipient_count: recipients.length, created_by: req.user!.id })
    .select()
    .single();
  if (insertErr || !comm) { res.status(500).json({ success: false, error: insertErr?.message ?? 'Failed to save' }); return; }

  if (body.channel !== 'email' || !env.RESEND_API_KEY) {
    const reason = body.channel !== 'email'
      ? `${body.channel} sending isn't wired to a provider yet — email is the only channel that can actually send.`
      : 'No RESEND_API_KEY configured — saved as a draft. Add the key to actually send.';
    await supabaseAdmin.from('communications').update({ status: 'draft', error_message: reason }).eq('id', comm.id);
    res.status(201).json({ success: true, data: { ...comm, status: 'draft', error_message: reason } });
    return;
  }

  await supabaseAdmin.from('communications').update({ status: 'sending' }).eq('id', comm.id);

  let sentCount = 0, failedCount = 0;
  for (const r of recipients) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env.EMAIL_FROM || 'noreply@epaysmart.live',
          to: r.email,
          subject: body.subject || 'ePay Smart',
          text: body.message,
        }),
      });
      if (resp.ok) sentCount++; else failedCount++;
    } catch (err) {
      failedCount++;
      logger.warn({ err, email: r.email }, 'Mass communication send failed for recipient');
    }
  }

  const { data: final } = await supabaseAdmin
    .from('communications')
    .update({
      status: failedCount === recipients.length && recipients.length > 0 ? 'failed' : 'sent',
      sent_count: sentCount, failed_count: failedCount, sent_at: new Date().toISOString(),
    })
    .eq('id', comm.id)
    .select()
    .single();

  res.status(201).json({ success: true, data: final });
});

export { router as communicationsRouter };
