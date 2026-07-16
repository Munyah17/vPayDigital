import { createProvider, type PaymentProvider } from '@vpay/provider-fincra';
import { VitalPayProvider } from '@vpay/provider-vitalpay';
import { env } from '../config/index.js';

// Singleton provider instance — swap by changing ACTIVE_PROVIDER env var.
function selectProvider(): PaymentProvider {
  if (env.ACTIVE_PROVIDER === 'vitalpay') {
    return new VitalPayProvider({
      secretKey: env.VITALPAY_SECRET_KEY,
      baseUrl: env.VITALPAY_BASE_URL,
      webhookSecret: env.VITALPAY_WEBHOOK_SECRET,
      timeoutMs: parseInt(env.PROVIDER_TIMEOUT_MS),
    });
  }
  return createProvider(env.ACTIVE_PROVIDER, {
    FINCRA_API_KEY: env.FINCRA_API_KEY,
    FINCRA_SECRET_KEY: env.FINCRA_SECRET_KEY,
    FINCRA_BASE_URL: env.FINCRA_BASE_URL,
    FINCRA_WEBHOOK_SECRET: env.FINCRA_WEBHOOK_SECRET,
    FINCRA_BUSINESS_ID: env.FINCRA_BUSINESS_ID,
    PROVIDER_TIMEOUT_MS: env.PROVIDER_TIMEOUT_MS,
  });
}

export const provider = selectProvider();
