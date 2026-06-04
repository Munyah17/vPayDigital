import { createProvider } from '@vpay/provider-fincra';
import { env } from '../config/index.js';

// Singleton provider instance — swap by changing ACTIVE_PROVIDER env var
export const provider = createProvider(env.ACTIVE_PROVIDER, {
  FINCRA_API_KEY: env.FINCRA_API_KEY,
  FINCRA_SECRET_KEY: env.FINCRA_SECRET_KEY,
  FINCRA_BASE_URL: env.FINCRA_BASE_URL,
  FINCRA_WEBHOOK_SECRET: env.FINCRA_WEBHOOK_SECRET,
  FINCRA_BUSINESS_ID: env.FINCRA_BUSINESS_ID,
  PROVIDER_TIMEOUT_MS: env.PROVIDER_TIMEOUT_MS,
});
