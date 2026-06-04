// =============================================================================
// Wallet Service — wallet creation, transfers, FX
// =============================================================================

import { supabaseAdmin } from '../utils/supabase.js';
import { provider } from '../utils/provider.js';
import { logger } from '../utils/logger.js';
import type {
  Wallet,
  WalletCurrency,
  WalletTransaction,
  WalletType,
} from '@vpay/types';

export interface TransferParams {
  from_user_id: string;
  to_user_id: string;
  amount: number;
  currency: WalletCurrency;
  description?: string;
}

export class WalletService {
  async getWalletsByUser(userId: string): Promise<Wallet[]> {
    const { data, error } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as Wallet[];
  }

  async ensureWallet(
    userId: string,
    currency: WalletCurrency,
    walletType: WalletType = 'consumer'
  ): Promise<Wallet> {
    const { data: existing } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('currency', currency)
      .eq('wallet_type', walletType)
      .maybeSingle();

    if (existing) return existing as Wallet;

    const { data, error } = await supabaseAdmin
      .from('wallets')
      .insert({ user_id: userId, currency, wallet_type: walletType, status: 'active' })
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to create wallet: ${error?.message}`);
    return data as Wallet;
  }

  async assignVirtualAccount(walletId: string): Promise<{ account_number: string; bank_name: string }> {
    const { data: wallet, error: walletErr } = await supabaseAdmin
      .from('wallets')
      .select('id, user_id, currency, provider_virtual_account_number')
      .eq('id', walletId)
      .single();

    if (walletErr || !wallet) throw new Error('Wallet not found');

    if (wallet.provider_virtual_account_number) {
      const { data: existing } = await supabaseAdmin
        .from('virtual_accounts')
        .select('account_number, bank_name')
        .eq('wallet_id', walletId)
        .maybeSingle();
      if (existing) return { account_number: existing.account_number, bank_name: existing.bank_name };
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', wallet.user_id)
      .single();

    if (!profile) throw new Error('Profile not found');

    const providerResp = await provider.createVirtualAccount({
      user_id: wallet.user_id,
      currency: wallet.currency,
      full_name: profile.full_name,
      email: profile.email,
    });

    await supabaseAdmin.from('virtual_accounts').insert({
      user_id: wallet.user_id,
      wallet_id: wallet.id,
      provider: provider.name,
      provider_account_id: providerResp.provider_account_id,
      account_number: providerResp.account_number,
      account_name: providerResp.account_name,
      bank_name: providerResp.bank_name,
      bank_code: providerResp.bank_code,
      currency: providerResp.currency,
    });

    await supabaseAdmin
      .from('wallets')
      .update({
        provider_account_id: providerResp.provider_account_id,
        provider_virtual_account_number: providerResp.account_number,
        provider_bank_name: providerResp.bank_name,
      })
      .eq('id', wallet.id);

    return {
      account_number: providerResp.account_number,
      bank_name: providerResp.bank_name,
    };
  }

  async transfer(params: TransferParams): Promise<{ debit: WalletTransaction; credit: WalletTransaction }> {
    const { data: srcWallet, error: srcErr } = await supabaseAdmin
      .from('wallets')
      .select('id, balance')
      .eq('user_id', params.from_user_id)
      .eq('currency', params.currency)
      .eq('wallet_type', 'consumer')
      .single();

    if (srcErr || !srcWallet) throw new Error('Source wallet not found');
    if (srcWallet.balance < params.amount) throw new Error('Insufficient balance');

    const dstWallet = await this.ensureWallet(params.to_user_id, params.currency);

    const { data: debit, error: debitErr } = await supabaseAdmin.rpc('record_wallet_debit', {
      p_wallet_id: srcWallet.id,
      p_amount: params.amount,
      p_type: 'transfer',
      p_description: params.description ?? 'Wallet transfer',
      p_metadata: { to_user_id: params.to_user_id, to_wallet_id: dstWallet.id },
    });
    if (debitErr) throw new Error(`Debit failed: ${debitErr.message}`);

    const { data: credit, error: creditErr } = await supabaseAdmin.rpc('record_wallet_credit', {
      p_wallet_id: dstWallet.id,
      p_amount: params.amount,
      p_type: 'transfer',
      p_description: params.description ?? 'Wallet transfer received',
      p_metadata: { from_user_id: params.from_user_id, from_wallet_id: srcWallet.id },
    });
    if (creditErr) {
      logger.error({ creditErr, debitTxnId: debit?.id }, 'Transfer credit failed after debit — reconciliation needed');
      throw new Error(`Credit failed: ${creditErr.message}`);
    }

    // Link the two transactions
    await supabaseAdmin
      .from('wallet_transactions')
      .update({ related_transaction_id: credit.id, related_wallet_id: dstWallet.id })
      .eq('id', debit.id);
    await supabaseAdmin
      .from('wallet_transactions')
      .update({ related_transaction_id: debit.id, related_wallet_id: srcWallet.id })
      .eq('id', credit.id);

    return { debit: debit as WalletTransaction, credit: credit as WalletTransaction };
  }

  async getTransactionsByWallet(
    walletId: string,
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<WalletTransaction[]> {
    const { data, error } = await supabaseAdmin
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', walletId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    return (data ?? []) as WalletTransaction[];
  }
}

export const walletService = new WalletService();
