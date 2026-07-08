// =============================================================================
// Banking Service — receiving accounts (local virtual accounts + IBAN requests)
// with multi-provider support
// =============================================================================

import { supabaseAdmin } from '../utils/supabase.js';
import { getProviderRegistry } from '../providers/registry.js';
import { logger } from '../utils/logger.js';
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

  async requestIbanAccount(userId: string, preferredProvider?: string): Promise<IbanAccount> {
    // Check if user already has an IBAN
    const { data: existing } = await supabaseAdmin
      .from('iban_accounts')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      logger.info(`IBAN account already exists for user ${userId}`);
      return existing as IbanAccount;
    }

    // Verify KYC approval
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, country_of_residence, preferred_currency, kyc_status')
      .eq('id', userId)
      .single();

    if (profileError || !profile || profile.kyc_status !== 'approved') {
      throw new Error('Identity verification must be approved before requesting an IBAN account');
    }

    // Create initial IBAN account record (status: in_review)
    const { data: ibanRecord, error: insertError } = await supabaseAdmin
      .from('iban_accounts')
      .insert({
        user_id: userId,
        status: 'in_review',
        requested_currency: profile.preferred_currency || 'EUR',
        metadata: {
          preferred_provider: preferredProvider,
        },
      })
      .select()
      .single();

    if (insertError || !ibanRecord) {
      throw new Error(`Failed to create IBAN request: ${insertError?.message}`);
    }

    try {
      // Select best provider based on user's location
      const registry = getProviderRegistry();
      const provider = await registry.selectWithFallback({
        userId,
        country: profile.country_of_residence,
        currency: profile.preferred_currency,
        preferredProvider,
      });

      if (!provider) {
        throw new Error('No available IBAN providers. Please try again later.');
      }

      // Request IBAN from selected provider
      logger.info(`Requesting IBAN from provider: ${provider.name} for user ${userId}`);
      const ibanData = await provider.requestIban({
        userId,
        email: profile.email,
        fullName: profile.full_name,
        currency: profile.preferred_currency || 'EUR',
        country: profile.country_of_residence,
      });

      // Update IBAN account with provider details
      const { data: updatedIban, error: updateError } = await supabaseAdmin
        .from('iban_accounts')
        .update({
          status: 'active',
          provider: provider.name,
          provider_account_id: ibanData.providerAccountId,
          iban: ibanData.iban,
          bic: ibanData.bic,
          bank_name: ibanData.bankName,
          activated_at: new Date().toISOString(),
          metadata: {
            preferred_provider: preferredProvider,
            account_name: ibanData.accountName,
          },
        })
        .eq('id', ibanRecord.id)
        .select()
        .single();

      if (updateError || !updatedIban) {
        throw new Error(`Failed to update IBAN account: ${updateError?.message}`);
      }

      logger.info(`IBAN account activated for user ${userId} via ${provider.name}`);
      return updatedIban as IbanAccount;
    } catch (error) {
      // Mark as rejected if provider request failed
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Provider request failed: ${errorMessage}`);

      await supabaseAdmin
        .from('iban_accounts')
        .update({
          status: 'rejected',
          rejection_reason: errorMessage,
        })
        .eq('id', ibanRecord.id);

      throw error;
    }
  }

  async getProviderHealth() {
    const registry = getProviderRegistry();
    return registry.getHealthStatus();
  }

  async switchProvider(userId: string, newProvider: string): Promise<IbanAccount> {
    const { data: ibanAccount, error: fetchError } = await supabaseAdmin
      .from('iban_accounts')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError || !ibanAccount) {
      throw new Error('IBAN account not found');
    }

    // Only allow switching if current account is not active
    if (ibanAccount.status === 'active') {
      throw new Error('Cannot switch providers for an active IBAN account. Please contact support.');
    }

    // Re-request with new provider preference
    await supabaseAdmin.from('iban_accounts').delete().eq('id', ibanAccount.id);
    return this.requestIbanAccount(userId, newProvider);
  }
}

export const bankingService = new BankingService();
