// =============================================================================
// Voucher Service — issuance, redemption, and auto-provisioning engine
// =============================================================================

import { supabaseAdmin } from '../utils/supabase.js';
import { cardService } from './cardService.js';
import { vitalPay } from '../utils/vitalpay.js';
import { getFeeConfig } from '../utils/feeConfig.js';
import { logger } from '../utils/logger.js';
import type { Voucher, VoucherType, GiftCardBrand, WalletCurrency, CardNetwork } from '@vpay/types';

// GiftCardBrand enum values don't always match VitalPay's product naming —
// map the ones that differ; anything else is searched for by its own name.
const BRAND_SEARCH_TERMS: Partial<Record<GiftCardBrand, string>> = {
  google_play: 'Google Play',
  apple_music: 'Apple Music',
  playstation: 'PlayStation',
  disney_plus: 'Disney',
  visa_gift: 'Visa',
  mastercard_gift: 'Mastercard',
};

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
    // Float hierarchy: Super Admin holds the real VitalPay-sourced float in
    // the platform's master_pool wallet and draws from it directly. Staff
    // ("Admin") and Agent both issue against their OWN allocated float
    // wallet (wallet_type 'agent_float', shared mechanism regardless of
    // role name) — neither can issue more than they were parcelled out via
    // POST /api/admin/float/allocate. Nobody gets an unconstrained,
    // untracked free pass anymore.
    const isSuperAdmin = params.issuer_role === 'super_admin';
    const debitWalletType = isSuperAdmin ? 'master_pool' : 'agent_float';

    // Calculate cost with fee — staff/super_admin issue at cost (no markup,
    // they ARE the platform); agents already paid for their float at a
    // markup when they bought it, so voucherIssuancePercent still applies
    // to them specifically.
    const fees = await getFeeConfig();
    const isAgent = params.issuer_role === 'agent';
    const fee = isAgent ? params.amount * fees.voucherIssuancePercent : 0;
    const totalCost = params.amount + fee;

    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('id, balance, status')
      .eq('user_id', params.issuer_id)
      .eq('currency', params.currency)
      .eq('wallet_type', debitWalletType)
      .single();

    if (!wallet) {
      throw new Error(isSuperAdmin ? 'Master pool wallet not found for this currency' : 'Float wallet not found — ask a Super Admin to allocate float first');
    }
    if (wallet.balance < totalCost) {
      throw new Error(`Insufficient float. Available: ${wallet.balance}, Required: ${totalCost}`);
    }
    const walletId = wallet.id;

    // Generate unique voucher code
    const { data: codeResult } = await supabaseAdmin
      .rpc('generate_voucher_code', { prefix: 'VP' });

    const code = codeResult as string;

    // Encode service data in voucher
    const encodedData = this.buildEncodedData(params);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (params.expires_in_days ?? 30));

    // Debit whichever wallet was resolved above — master_pool for super_admin,
    // the issuer's own agent_float wallet for staff/agent.
    {
      const { error: debitErr } = await supabaseAdmin.rpc('record_wallet_debit', {
        p_wallet_id: walletId,
        p_amount: totalCost,
        p_type: 'voucher_redemption',
        p_description: `Voucher issuance: ${params.type} ${params.gift_card_brand ?? ''} $${params.amount}`,
        p_metadata: { voucher_type: params.type, amount: params.amount },
      });
      if (debitErr) throw new Error(`Failed to debit float wallet: ${debitErr.message}`);
    }

    // Create voucher record
    // gift_card_brand is a Postgres enum column — it only accepts NULL or a
    // real brand value, never '' (the frontend always includes the field in
    // its form state, sending '' for every non-gift-card voucher type).
    const { data: voucher, error } = await supabaseAdmin
      .from('vouchers')
      .insert({
        code,
        issuer_id: params.issuer_id,
        type: params.type,
        gift_card_brand: params.gift_card_brand || null,
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

    if (error || !voucher) throw new Error(`Failed to create voucher${error ? `: ${error.message}` : ''}`);

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
      const message = await this.purchaseGiftCardForVoucher(result, params.user_id);
      return {
        voucher: result as Voucher,
        message,
      };
    }

    return {
      voucher: result as Voucher,
      message: 'Voucher redeemed successfully!',
    };
  }

  /**
   * Actually purchases a real gift card via VitalPay instead of just
   * claiming one was sent — the previous implementation returned a
   * "check your email" message with no fulfillment call anywhere behind it.
   *
   * KNOWN GAP: redeem_voucher() already marked the voucher 'redeemed'
   * atomically before this runs. If the VitalPay purchase fails here, the
   * voucher is burned with nothing delivered — there's no compensating
   * transaction yet. Failures are logged loudly and the user is told to
   * contact support with the voucher code rather than silently swallowing
   * the error, but this needs a proper reconciliation job (retry queue on
   * vouchers with provider_reference IS NULL) before real money value
   * flows through this path.
   */
  private async purchaseGiftCardForVoucher(
    voucher: { voucher_id: string; gift_card_brand: string; amount: number; currency: string },
    userId: string
  ): Promise<string> {
    // redeem_voucher() returns voucher_id, not id — this previously read
    // voucher.id (always undefined), which broke both the support-contact
    // reference shown to the user AND the .eq('id', voucher.id) update
    // below, which matched zero rows and silently never recorded the
    // VitalPay order against the voucher even on a successful purchase.
    const voucherId = voucher.voucher_id;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (!profile?.email) {
      logger.error({ voucher_id: voucherId }, 'Gift card redemption: no recipient email on profile');
      return `${voucher.gift_card_brand} gift card redeemed, but we couldn't find an email to deliver it to — contact support with code reference ${voucherId}.`;
    }

    try {
      const brand = voucher.gift_card_brand as GiftCardBrand;
      const searchTerm = BRAND_SEARCH_TERMS[brand] ?? brand.replace(/_/g, ' ');
      const { products } = await vitalPay.getGiftCardProducts({ per_page: 50 });
      const product = products.find(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!product) {
        logger.error({ voucher_id: voucherId, brand }, 'Gift card redemption: no matching VitalPay product found');
        return `${voucher.gift_card_brand} gift card redemption is delayed — no matching product found. Contact support with code reference ${voucherId}.`;
      }

      const order = await vitalPay.purchaseGiftCard({
        product_id: product.product_id,
        amount: voucher.amount,
        currency: voucher.currency,
        recipient_email: profile.email,
        reference: `GIFT-${voucherId}`,
      });

      await supabaseAdmin
        .from('vouchers')
        .update({ provider_reference: order.reference, service_metadata: { vitalpay_order: order } })
        .eq('id', voucherId);

      return `${voucher.gift_card_brand} gift card purchased! It'll be emailed to ${profile.email} shortly.`;
    } catch (err) {
      logger.error({ err, voucher_id: voucherId }, 'Gift card purchase via VitalPay failed after voucher was redeemed — needs manual reconciliation');
      return `${voucher.gift_card_brand} gift card redemption is delayed — our team has been notified. Contact support with code reference ${voucherId} if it doesn't arrive soon.`;
    }
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
