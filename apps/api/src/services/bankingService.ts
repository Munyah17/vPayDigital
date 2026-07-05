// =============================================================================
// Banking Service — receiving accounts (local virtual accounts + IBAN requests)
// =============================================================================

import { supabaseAdmin } from '../utils/supabase.js';
import type { VirtualAccount, IbanAccount } from '@vpay/types';

export class BankingService {
  async getBankingAccounts(userId: string): Promise<{ local: VirtualAccount | null; iban: IbanAccount | null }> {
    const [localRes, ibanRes] = await Promise.all([
      supabaseAdmin.from('virtual_accounts').select('*').eq('user_id', userId).maybeSingle(),
      supabaseAdmin.from('iban_accounts').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    return {
      local: (localRes.data as VirtualAccount) ?? null,
      iban: (ibanRes.data as IbanAccount) ?? null,
    };
  }

  async requestIbanAccount(userId: string): Promise<IbanAccount> {
    const { data: existing } = await supabaseAdmin
      .from('iban_accounts')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) return existing as IbanAccount;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('kyc_status')
      .eq('id', userId)
      .single();

    if (!profile || profile.kyc_status !== 'approved') {
      throw new Error('Identity verification must be approved before requesting an IBAN account');
    }

    const { data, error } = await supabaseAdmin
      .from('iban_accounts')
      .insert({ user_id: userId, status: 'requested' })
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to request IBAN account: ${error?.message}`);
    return data as IbanAccount;
  }
}

export const bankingService = new BankingService();
