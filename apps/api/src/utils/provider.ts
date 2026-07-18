import { VitalPayProvider } from '@vpay/provider-vitalpay';
import { env } from '../config/index.js';

// VitalPay (Tayari / KMG VitalLinks) is the only payment provider — Fincra
// was removed entirely (never had real credentials; VitalPay is the
// actual partnership). If a second provider is ever added, reintroduce a
// selectProvider() branch here rather than hardcoding one.
export const provider = new VitalPayProvider({
  secretKey: env.VITALPAY_SECRET_KEY,
  baseUrl: env.VITALPAY_BASE_URL,
  webhookSecret: env.VITALPAY_WEBHOOK_SECRET,
  timeoutMs: parseInt(env.PROVIDER_TIMEOUT_MS),
});
