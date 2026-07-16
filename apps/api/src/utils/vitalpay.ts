import { VitalPayClient } from '@vpay/provider-vitalpay';
import { env } from '../config/index.js';

// Direct VitalPay client for operations that don't fit the generic
// PaymentProvider interface (customer payments, gift cards, merchant float
// top-up) — used regardless of which provider ACTIVE_PROVIDER selects for
// card issuance, since these flows are VitalPay-specific.
export const vitalPay = new VitalPayClient({
  secretKey: env.VITALPAY_SECRET_KEY,
  baseUrl: env.VITALPAY_BASE_URL,
  webhookSecret: env.VITALPAY_WEBHOOK_SECRET,
  timeoutMs: parseInt(env.PROVIDER_TIMEOUT_MS),
});
