// =============================================================================
// Value-Added Services — Airtime/Data and Electricity Tokens via VitalPay
// =============================================================================
// Same debit-before-provider-call pattern used everywhere else in this
// codebase: record_wallet_debit row-locks and re-checks balance server-side,
// so it's the safe place for the money-moving step. If the VitalPay call
// fails, refund immediately — nothing was delivered on their end.

import { supabaseAdmin } from '../utils/supabase.js';
import { vitalPay } from '../utils/vitalpay.js';
import { logger } from '../utils/logger.js';
import type { WalletCurrency } from '@vpay/types';

async function debitWallet(userId: string, currency: WalletCurrency, amount: number, description: string, metadata: Record<string, unknown>) {
  const { data: wallet, error: walletErr } = await supabaseAdmin
    .from('wallets')
    .select('id, balance, status')
    .eq('user_id', userId)
    .eq('currency', currency)
    .eq('wallet_type', 'consumer')
    .single();

  if (walletErr || !wallet) throw new Error(`No ${currency} wallet found`);
  if (wallet.status !== 'active') throw new Error('Wallet is not active');
  if (wallet.balance < amount) throw new Error(`Insufficient balance. Available: ${wallet.balance}, Required: ${amount}`);

  const { error: debitErr } = await supabaseAdmin.rpc('record_wallet_debit', {
    p_wallet_id: wallet.id,
    p_amount: amount,
    p_type: 'vas_purchase',
    p_description: description,
    p_metadata: metadata,
  });
  if (debitErr) throw new Error(`Failed to debit wallet: ${debitErr.message}`);

  return wallet.id as string;
}

async function refundWallet(walletId: string, amount: number, description: string, metadata: Record<string, unknown>) {
  await supabaseAdmin.rpc('record_wallet_credit', {
    p_wallet_id: walletId,
    p_amount: amount,
    p_type: 'refund',
    p_description: description,
    p_metadata: metadata,
  });
}

export interface PurchaseAirtimeParams {
  user_id: string;
  operator_id: string;
  phone: string;
  amount: number;
  currency: WalletCurrency;
  type?: 'airtime' | 'data';
}

export const vasService = {
  async purchaseAirtime(params: PurchaseAirtimeParams) {
    const reference = `AIR-${Date.now().toString(36).toUpperCase()}`;

    const walletId = await debitWallet(
      params.user_id, params.currency, params.amount,
      `${params.type ?? 'Airtime'} top-up: ${params.phone}`,
      { service: 'airtime', operator_id: params.operator_id, phone: params.phone }
    );

    const { data: order, error: insertErr } = await supabaseAdmin
      .from('vas_orders')
      .insert({
        user_id: params.user_id,
        wallet_id: walletId,
        service_type: params.type === 'data' ? 'data' : 'airtime',
        amount: params.amount,
        currency: params.currency,
        operator_id: params.operator_id,
        phone: params.phone,
        reference,
        status: 'processing',
      })
      .select()
      .single();
    if (insertErr || !order) throw new Error(`Failed to record order: ${insertErr?.message}`);

    try {
      const result = await vitalPay.purchaseAirtime({
        operator_id: params.operator_id,
        phone: params.phone,
        amount: params.amount,
        currency: params.currency,
        reference,
        type: params.type,
      });

      await supabaseAdmin
        .from('vas_orders')
        .update({
          status: result.status === 'completed' ? 'completed' : 'processing',
          provider_reference: result.reference,
          provider_payload: result,
        })
        .eq('id', order.id);

      return { ...order, status: result.status, provider_payload: result };
    } catch (err) {
      logger.error({ err, order_id: order.id }, 'Airtime purchase failed — refunding wallet');
      await supabaseAdmin.from('vas_orders').update({
        status: 'failed',
        failure_reason: err instanceof Error ? err.message : String(err),
      }).eq('id', order.id);
      await refundWallet(walletId, params.amount, `Airtime purchase failed refund: ${params.phone}`, { order_id: order.id });
      throw err;
    }
  },

  async purchaseElectricity(params: { user_id: string; meter_number: string; amount: number; currency: WalletCurrency; country?: string }) {
    const reference = `ELEC-${Date.now().toString(36).toUpperCase()}`;
    const country = params.country ?? 'ZW';

    const walletId = await debitWallet(
      params.user_id, params.currency, params.amount,
      `Electricity token: ${params.meter_number}`,
      { service: 'electricity', meter_number: params.meter_number }
    );

    const { data: order, error: insertErr } = await supabaseAdmin
      .from('vas_orders')
      .insert({
        user_id: params.user_id,
        wallet_id: walletId,
        service_type: 'electricity',
        amount: params.amount,
        currency: params.currency,
        meter_number: params.meter_number,
        reference,
        status: 'processing',
      })
      .select()
      .single();
    if (insertErr || !order) throw new Error(`Failed to record order: ${insertErr?.message}`);

    try {
      const result = await vitalPay.purchaseElectricityToken({
        meter_number: params.meter_number,
        amount: params.amount,
        currency: params.currency,
        country,
        reference,
      });

      const tokenPieces = result.token_pieces ?? (result.token ? [result.token] : []);

      await supabaseAdmin
        .from('vas_orders')
        .update({
          status: result.status === 'completed' ? 'completed' : 'processing',
          provider_reference: result.reference,
          provider_payload: result,
          token_pieces: tokenPieces,
          units: result.units ?? null,
        })
        .eq('id', order.id);

      return { ...order, status: result.status, token_pieces: tokenPieces, units: result.units };
    } catch (err) {
      logger.error({ err, order_id: order.id }, 'Electricity purchase failed — refunding wallet');
      await supabaseAdmin.from('vas_orders').update({
        status: 'failed',
        failure_reason: err instanceof Error ? err.message : String(err),
      }).eq('id', order.id);
      await refundWallet(walletId, params.amount, `Electricity purchase failed refund: ${params.meter_number}`, { order_id: order.id });
      throw err;
    }
  },

  async payBill(params: { user_id: string; biller_code: string; account_number: string; amount: number; currency: WalletCurrency; country?: string }) {
    const reference = `BILL-${Date.now().toString(36).toUpperCase()}`;
    const country = params.country ?? 'ZW';

    const walletId = await debitWallet(
      params.user_id, params.currency, params.amount,
      `Bill payment: ${params.biller_code} ${params.account_number}`,
      { service: 'bill', biller_code: params.biller_code, account_number: params.account_number }
    );

    const { data: order, error: insertErr } = await supabaseAdmin
      .from('vas_orders')
      .insert({
        user_id: params.user_id,
        wallet_id: walletId,
        service_type: 'bill',
        amount: params.amount,
        currency: params.currency,
        biller_code: params.biller_code,
        account_number: params.account_number,
        reference,
        status: 'processing',
      })
      .select()
      .single();
    if (insertErr || !order) throw new Error(`Failed to record order: ${insertErr?.message}`);

    try {
      const result = await vitalPay.payBill({
        biller_code: params.biller_code,
        country,
        account_number: params.account_number,
        amount: params.amount,
        currency: params.currency,
        reference,
      });

      await supabaseAdmin
        .from('vas_orders')
        .update({
          status: result.status === 'completed' ? 'completed' : 'processing',
          provider_reference: result.reference,
          provider_payload: result,
        })
        .eq('id', order.id);

      return { ...order, status: result.status, provider_payload: result };
    } catch (err) {
      logger.error({ err, order_id: order.id }, 'Bill payment failed — refunding wallet');
      await supabaseAdmin.from('vas_orders').update({
        status: 'failed',
        failure_reason: err instanceof Error ? err.message : String(err),
      }).eq('id', order.id);
      await refundWallet(walletId, params.amount, `Bill payment failed refund: ${params.biller_code} ${params.account_number}`, { order_id: order.id });
      throw err;
    }
  },
};
