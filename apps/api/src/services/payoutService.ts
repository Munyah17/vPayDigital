// =============================================================================
// Payout Service — withdrawals and disbursements
// =============================================================================

import { supabaseAdmin } from '../utils/supabase.js';
import { provider } from '../utils/provider.js';
import { logger } from '../utils/logger.js';
import { FEE_CONFIG } from '@vpay/config';
import type {
  PayoutRequest,
  PayoutMethod,
  WalletCurrency,
} from '@vpay/types';

export interface InitiatePayoutParams {
  user_id: string;
  amount: number;
  currency: WalletCurrency;
  method: PayoutMethod;
  beneficiary_name: string;
  beneficiary_account?: string;
  beneficiary_bank?: string;
  beneficiary_bank_code?: string;
  beneficiary_country?: string;
  crypto_address?: string;
  crypto_network?: string;
  mobile_number?: string;
  mobile_provider?: string;
  notes?: string;
}

export class PayoutService {
  async initiatePayout(params: InitiatePayoutParams): Promise<PayoutRequest> {
    // 1. Compute fees
    const fee = this.calculateFee(params.amount, params.method);
    const totalDebit = params.amount + fee;

    // 2. Get wallet
    const { data: wallet, error: walletErr } = await supabaseAdmin
      .from('wallets')
      .select('id, balance, status')
      .eq('user_id', params.user_id)
      .eq('currency', params.currency)
      .eq('wallet_type', 'consumer')
      .single();

    if (walletErr || !wallet) throw new Error('Wallet not found');
    if (wallet.status !== 'active') throw new Error('Wallet is not active');
    if (wallet.balance < totalDebit) throw new Error('Insufficient balance');

    // 3. Persist payout in pending state FIRST so we don't lose it on crash
    const { data: payout, error: payoutErr } = await supabaseAdmin
      .from('payout_requests')
      .insert({
        user_id: params.user_id,
        wallet_id: wallet.id,
        amount: params.amount,
        fee,
        net_amount: params.amount,
        currency: params.currency,
        method: params.method,
        status: 'pending',
        beneficiary_name: params.beneficiary_name,
        beneficiary_account: params.beneficiary_account,
        beneficiary_bank: params.beneficiary_bank,
        beneficiary_bank_code: params.beneficiary_bank_code,
        beneficiary_country: params.beneficiary_country,
        crypto_address: params.crypto_address,
        crypto_network: params.crypto_network,
        mobile_number: params.mobile_number,
        mobile_provider: params.mobile_provider,
        notes: params.notes,
      })
      .select()
      .single();

    if (payoutErr || !payout) throw new Error(`Failed to create payout: ${payoutErr?.message}`);

    // 4. Debit the wallet (move funds to pending — net + fee)
    const { error: debitErr } = await supabaseAdmin.rpc('record_wallet_debit', {
      p_wallet_id: wallet.id,
      p_amount: totalDebit,
      p_type: 'withdrawal',
      p_description: `Payout ${payout.reference}`,
      p_metadata: { payout_id: payout.id, method: params.method, fee },
    });

    if (debitErr) {
      await supabaseAdmin
        .from('payout_requests')
        .update({ status: 'failed', notes: `Wallet debit failed: ${debitErr.message}` })
        .eq('id', payout.id);
      throw new Error('Failed to debit wallet for payout');
    }

    // 5. Call provider
    try {
      const providerResp = await provider.initiatePayout({
        amount: params.amount,
        currency: params.currency,
        method: params.method,
        beneficiary: {
          name: params.beneficiary_name,
          account_number: params.beneficiary_account,
          bank_code: params.beneficiary_bank_code,
          bank_name: params.beneficiary_bank,
          country: params.beneficiary_country,
          mobile_number: params.mobile_number,
          crypto_address: params.crypto_address,
          crypto_network: params.crypto_network,
        },
        reference: payout.reference,
        description: params.notes ?? 'vPay Payout',
      });

      await supabaseAdmin
        .from('payout_requests')
        .update({
          status: 'processing',
          provider_reference: providerResp.provider_reference,
          provider_status: providerResp.status,
        })
        .eq('id', payout.id);

      const updated = await this.getPayout(payout.id);
      return updated;
    } catch (err) {
      // Provider failed — refund the wallet and mark payout failed
      logger.error({ err, payout_id: payout.id }, 'Payout provider call failed — refunding');
      await supabaseAdmin.rpc('record_wallet_credit', {
        p_wallet_id: wallet.id,
        p_amount: totalDebit,
        p_type: 'refund',
        p_description: `Payout failed refund ${payout.reference}`,
        p_metadata: { payout_id: payout.id, original_failure: String(err) },
      });
      await supabaseAdmin
        .from('payout_requests')
        .update({ status: 'failed', notes: `Provider error: ${(err as Error).message}` })
        .eq('id', payout.id);
      throw err;
    }
  }

  async getPayoutsByUser(userId: string, limit = 50): Promise<PayoutRequest[]> {
    const { data, error } = await supabaseAdmin
      .from('payout_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as PayoutRequest[];
  }

  async getPayout(payoutId: string): Promise<PayoutRequest> {
    const { data, error } = await supabaseAdmin
      .from('payout_requests')
      .select('*')
      .eq('id', payoutId)
      .single();
    if (error || !data) throw new Error('Payout not found');
    return data as PayoutRequest;
  }

  private calculateFee(amount: number, method: PayoutMethod): number {
    if (method === 'internal') return 0;
    return FEE_CONFIG.payoutFlat + amount * FEE_CONFIG.payoutPercent;
  }
}

export const payoutService = new PayoutService();
