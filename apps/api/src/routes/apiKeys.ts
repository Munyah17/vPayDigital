// =============================================================================
// API Management — issue/revoke API keys for partners. Only a SHA-256 hash
// + short prefix are ever stored; the full key is returned exactly once,
// at creation, same principle as card PAN handling elsewhere in this app.
// =============================================================================
import { Router, Response } from 'express';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(150),
  partner_id: z.string().uuid().optional(),
  scopes: z.array(z.string()).default([]),
});

function generateApiKey(): { fullKey: string; prefix: string; hash: string } {
  const secret = randomBytes(24).toString('base64url');
  const fullKey = `epsm_live_${secret}`;
  const prefix = fullKey.slice(0, 16);
  const hash = createHash('sha256').update(fullKey).digest('hex');
  return { fullKey, prefix, hash };
}

router.get('/', authenticate, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .select('id, name, key_prefix, partner_id, scopes, last_used_at, revoked, created_at, partners(name)')
    .order('created_at', { ascending: false });
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

// POST / — the ONLY response that ever contains the full key
router.post('/', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const body = createSchema.parse(req.body);
  const { fullKey, prefix, hash } = generateApiKey();

  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .insert({ name: body.name, partner_id: body.partner_id, scopes: body.scopes, key_prefix: prefix, key_hash: hash, created_by: req.user!.id })
    .select('id, name, key_prefix, scopes, created_at')
    .single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  res.status(201).json({ success: true, data: { ...data, full_key: fullKey } });
});

router.post('/:id/revoke', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabaseAdmin.from('api_keys').update({ revoked: true }).eq('id', req.params.id).select().single();
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data });
});

export { router as apiKeysRouter };
