import { supabaseAdmin } from './supabase.js';
import { FEE_CONFIG as DEFAULT_FEE_CONFIG } from '@vpay/config';

export interface FeeConfig {
  cardIssuanceFlat: number;
  cardIssuancePercent: number;
  fxSpread: number;
  payoutFlat: number;
  payoutPercent: number;
  voucherIssuancePercent: number;
}

const DEFAULTS: FeeConfig = {
  ...DEFAULT_FEE_CONFIG,
  voucherIssuancePercent: 0.015,
};

/**
 * Reads admin-configurable fee overrides from system_config (key
 * "fee_config"), falling back to the @vpay/config defaults for any field
 * not set. Fetched fresh on every call rather than cached — fee changes
 * are rare and low-traffic enough that a DB round-trip per calculation is
 * cheap, and it means an admin's change takes effect immediately with no
 * stale-cache window on a fintech app.
 */
export async function getFeeConfig(): Promise<FeeConfig> {
  const { data } = await supabaseAdmin
    .from('system_config')
    .select('value')
    .eq('key', 'fee_config')
    .maybeSingle();

  if (!data?.value || typeof data.value !== 'object') return DEFAULTS;
  return { ...DEFAULTS, ...(data.value as Partial<FeeConfig>) };
}
