// =============================================================================
// Voucher Service — issuance, redemption, and auto-provisioning engine
// =============================================================================

import { supabaseAdmin } from '../utils/supabase.js';
import { cardService } from './cardService.js';
import { logger } from '../utils/logger.js';
import type { Voucher, VoucherType, GiftCardBrand, WalletCurrency, CardNetwork } from '@vpay/types';

export interface IssueVoucherParams {
  issuer_id: string;
  issuer_role?: string;
  type: VoucherType;
  amount: number;
  currency: WalletCurrency;
  gift_card_brand?: GiftCardBrand;
  expires_in_days?: number;
  metadata?: Record<string, unknown>;
  quantity?: number;
}

export interface RedeemVoucherParams {
  code: string;
  user_id: string;
  cardholder_name: string;
}

export class VoucherService {
  async issueVoucher(params: IssueVoucherParams): Promise<Voucher> {
    const isAdmin = ['super_admin', 'staff'].includes(params.issuer_role ?? '');

    // Calculate cost with fee
    const fee = isAdmin ? 0 : params.amount * 0.015; // Admins issue from platform pool — no fee deducted
    const totalCost = params.amount + fee;

    let walletId: string | null = null;

    if (!isAdmin) {
      // Debit agent float wallet
      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('id, balance, status')
        .eq('user_id', params.issuer_id)
        .eq('currency', params.currency)
        .eq('wallet_type', 'agent_float')
        .single();

      if (!wallet) throw new Error('Agent float wallet not found');
      if (wallet.balance < totalCost) {
        throw new Error(`Insufficient float. Available: ${wallet.balance}, Required: ${totalCost}`);
      }
      walletId = wallet.id;
    }

    // Generate unique voucher code
    const { data: codeResult } = await supabaseAdmin
      .rpc('generate_voucher_code', { prefix: 'VP' });

    const code = codeResult as string;

    // Encode service data in voucher
    const encodedData = this.buildEncodedData(params);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (params.expires_in_days ?? 30));

    // Debit wallet — agents only (admins issue from platform pool, no debit)
    if (!isAdmin && walletId) {
      await supabaseAdmin.rpc('record_wallet_debit', {
        p_wallet_id: walletId,
        p_amount: totalCost,
        p_type: 'voucher_redemption',
        p_description: `Voucher issuance: ${params.type} ${params.gift_card_brand ?? ''} $${params.amount}`,
        p_metadata: { voucher_type: params.type, amount: params.amount },
      });
    }

    // Create voucher record
    const { data: voucher, error } = await supabaseAdmin
      .from('vouchers')
      .insert({
        code,
        issuer_id: params.issuer_id,
        type: params.type,
        gift_card_brand: params.gift_card_brand,
        amount: params.amount,
        currency: params.currency,
        status: 'active',
        cost: params.amount,
        fee,
        encoded_data: encodedData,
        expires_at: expiresAt.toISOString(),
        metadata: params.metadata ?? {},
      })
      .select()
      .single();

    if (error || !voucher) throw new Error('Failed to create voucher');

    // Record commission for agent
    const { data: agentProfile } = await supabaseAdmin
      .from('agent_profiles')
      .select('commission_rate')
      .eq('user_id', params.issuer_id)
      .single();

    if (agentProfile) {
      const commissionRate = agentProfile.commission_rate ?? 0.02;
      const commissionAmount = params.amount * commissionRate;

      await supabaseAdmin.from('commissions').insert({
        agent_id: params.issuer_id,
        type: 'voucher_sale',
        amount: commissionAmount,
        currency: params.currency,
        rate: commissionRate,
        reference_amount: params.amount,
        status: 'completed',
        paid_at: new Date().toISOString(),
      });
    }

    logger.info({ voucher_id: voucher.id, code, type: params.type }, 'Voucher issued');
    return voucher as Voucher;
  }

  async redeemVoucher(params: RedeemVoucherParams): Promise<{
    voucher: Voucher;
    card?: unknown;
    message: string;
  }> {
    // Use DB function for atomic redemption
    const { data: result, error } = await supabaseAdmin
      .rpc('redeem_voucher', {
        p_code: params.code.toUpperCase(),
        p_user_id: params.user_id,
      });

    if (error) throw new Error(error.message);
    if (!result.success) throw new Error(result.error);

    const voucherType: VoucherType = result.voucher_type;

    // Auto-provision based on voucher type
    if (voucherType === 'virtual_card') {
      const encodedData = result.service_metadata as {
        network: CardNetwork;
        card_type: string;
        currency: string;
      };

      const card = await cardService.issueCard({
        user_id: params.user_id,
        cardholder_name: params.cardholder_name,
        card_type: (encodedData.card_type ?? 'single_use') as never,
        network: (encodedData.network ?? 'visa') as CardNetwork,
        currency: (encodedData.currency ?? 'USD') as never,
        amount: result.amount,
        voucher_id: result.voucher_id,
      });

      // Link card to voucher
      await supabaseAdmin
        .from('vouchers')
        .update({ card_id: card.id })
        .eq('id', result.voucher_id);

      return {
        voucher: result as Voucher,
        card,
        message: `Virtual ${encodedData.network?.toUpperCase() ?? 'Visa'} card issued successfully!`,
      };
    }

    if (voucherType === 'gift_card') {
      return {
        voucher: result as Voucher,
        message: `${result.gift_card_brand} gift card redeemed! Check your email for the redemption code.`,
      };
    }

    return {
      voucher: result as Voucher,
      message: 'Voucher redeemed successfully!',
    };
  }

  async getVoucherByCode(code: string) {
    const { data, error } = await supabaseAdmin
      .from('vouchers')
      .select('id, code, type, gift_card_brand, amount, currency, status, expires_at')
      .eq('code', code.toUpperCase())
      .single();

    if (error) return null;
    return data;
  }

  private buildEncodedData(params: IssueVoucherParams): Record<string, unknown> {
    const base = {
      type: params.type,
      amount: params.amount,
      currency: params.currency,
      issued_by: params.issuer_id,
      issued_at: new Date().toISOString(),
    };

    if (params.type === 'virtual_card') {
      return { ...base, network: 'visa', card_type: 'single_use' };
    }

    if (params.type === 'gift_card') {
      return { ...base, brand: params.gift_card_brand };
    }

    return base;
  }
}

export const voucherService = new VoucherService();
