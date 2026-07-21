// =============================================================================
// AI Assistant — marketing copy + analytics Q&A via the Anthropic API. Real
// calls when ANTHROPIC_API_KEY is configured; a clear "not configured" error
// otherwise rather than faking a response.
// =============================================================================
import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';
import { env } from '../config/index.js';

const router = Router();

const askSchema = z.object({
  mode: z.enum(['marketing', 'analytics', 'general']).default('general'),
  prompt: z.string().min(1).max(4000),
});

const SYSTEM_PROMPTS: Record<string, string> = {
  marketing: 'You are a marketing copywriter for ePay Smart, a Zimbabwe-focused digital wallet and virtual card platform. Write concise, compelling copy. No emoji unless asked.',
  analytics: 'You are a data analyst for ePay Smart, a Zimbabwe-focused digital wallet platform. You are given real current platform metrics as context — answer questions grounded in that data, and say plainly if the data provided cannot answer the question rather than guessing.',
  general: 'You are an operations assistant for ePay Smart, a Zimbabwe-focused digital wallet and virtual card platform.',
};

router.post('/ask', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const body = askSchema.parse(req.body);

  if (!env.ANTHROPIC_API_KEY) {
    res.status(503).json({ success: false, error: 'AI Assistant needs an ANTHROPIC_API_KEY configured on the server — nothing has been added yet.' });
    return;
  }

  let context = '';
  if (body.mode === 'analytics') {
    const { data: metrics } = await supabaseAdmin.from('vw_platform_metrics').select('*').single();
    context = metrics ? `\n\nCurrent platform metrics:\n${JSON.stringify(metrics, null, 2)}` : '';
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1024,
        system: SYSTEM_PROMPTS[body.mode] + context,
        messages: [{ role: 'user', content: body.prompt }],
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      res.status(502).json({ success: false, error: `Anthropic API error: ${resp.status} ${errBody.slice(0, 300)}` });
      return;
    }

    const data = await resp.json() as { content: Array<{ type: string; text?: string }> };
    const text = data.content.find(c => c.type === 'text')?.text ?? '';
    res.json({ success: true, data: { response: text } });
  } catch (err) {
    res.status(502).json({ success: false, error: err instanceof Error ? err.message : 'Failed to reach Anthropic API' });
  }
});

export { router as aiAssistantRouter };
