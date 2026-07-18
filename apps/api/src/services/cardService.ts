// =============================================================================
// Card Service — business logic for card operations
// =============================================================================

import { supabaseAdmin } from '../utils/supabase.js';
import { provider } from '../utils/provider.js';
import { logger } from '../utils/logger.js';
import type { Card, CardType, CardNetwork, CardCurrency } from '@vpay/types';

export interface IssueCardParams {
  user_id: string;
  cardholder_name: string;
  card_type: CardType;
  network: CardNetwork;
  currency: CardCurrency;
  amount: number;
  issued_by_agent?: string;
  voucher_id?: string;
  spending_limit_daily?: number;
  spending_limit_per_transaction?: number;
  expires_at?: string;
}

export class CardService {
  async issueCard(params: IssueCardParams): Promise<Card> {
    // Fetch the actual cardholder's email — VitalPay's /virtual-cards/issue
    // accepts an optional customer_email, which we weren't passing at all.
    // Whether VitalPay emails the full PAN/CVV to that address on issuance
    // is unconfirmed, but it's the standard PCI-scope-reduction pattern for
    // card-issuing APIs (matches how EcoCash SMSes card details directly to
    // the cardholder rather than exposing them to the merchant's backend),
    // and passing it costs nothing even if unused.
    const { data: cardholderProfile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', params.user_id)
      .single();

    // 1. Verify user has sufficient balance (deducted from agent float or consumer wallet)
    const walletType = params.issued_by_agent ? 'agent_float' : 'consumer';
    const { data: wallet, error: walletErr } = await supabaseAdmin
      .from('wallets')
      .select('id, balance, status')
      .eq('user_id', params.issued_by_agent ?? params.user_id)
      .eq('currency', params.currency)
      .eq('wallet_type', walletType)
      .single();

    if (walletErr || !wallet) {
      throw new Error('Wallet not found for card issuance');
    }

    if (wallet.status !== 'active') {
      throw new Error('Wallet is not active');
    }

    if (wallet.balance < params.amount) {
      throw new Error(`Insufficient balance. Available: ${wallet.balance}, Required: ${params.amount}`);
    }

    // 2. Debit wallet atomically FIRST. record_wallet_debit row-locks the
    // wallet and re-checks the balance server-side, so this is the safe
    // place for the money-moving step to happen — calling the provider
    // first and debiting after would risk issuing a funded card with no
    // corresponding debit if the debit then failed.
    const { error: debitErr } = await supabaseAdmin.rpc('record_wallet_debit', {
      p_wallet_id: wallet.id,
      p_amount: params.amount,
      p_type: 'card_load',
      p_description: `Card issuance: ${params.network.toUpperCase()} ${params.card_type}`,
      p_metadata: { card_type: params.card_type, network: params.network },
    });

    if (debitErr) {
      throw new Error(`Failed to debit wallet for card issuance: ${debitErr.message}`);
    }

    // 3. Call provider to issue card. If this fails, refund the debit —
    // no card was ever created at the provider, so there's nothing to roll
    // back on their end.
    let providerResponse;
    try {
      providerResponse = await provider.issueCard({
        cardholder_name: params.cardholder_name,
        cardholder_email: cardholderProfile?.email,
        currency: params.currency,
        amount: params.amount,
        card_type: params.card_type,
        network: params.network,
      });
    } catch (err) {
      logger.error({ err }, 'Provider card issuance failed — refunding wallet debit');
      await supabaseAdmin.rpc('record_wallet_credit', {
        p_wallet_id: wallet.id,
        p_amount: params.amount,
        p_type: 'refund',
        p_description: `Card issuance failed refund: ${params.network.toUpperCase()} ${params.card_type}`,
        p_metadata: { card_type: params.card_type, network: params.network, original_failure: String(err) },
      });
      throw err;
    }

    // 4. Persist card record
    const now = new Date();
    const expiryDate = params.expires_at
      ? new Date(params.expires_at)
      : new Date(now.getFullYear() + 2, now.getMonth(), 1);

    const { data: card, error: cardErr } = await supabaseAdmin
      .from('cards')
      .insert({
        user_id: params.user_id,
        wallet_id: wallet.id,
        issued_by_agent: params.issued_by_agent,
        card_type: params.card_type,
        network: params.network,
        currency: params.currency,
        status: 'active',
        card_token: providerResponse.card_token,
        masked_pan: providerResponse.masked_pan,
        last_four: providerResponse.last_four,
        cardholder_name: params.cardholder_name,
        expiry_month: providerResponse.expiry_month,
        expiry_year: providerResponse.expiry_year,
        initial_balance: params.amount,
        current_balance: params.amount,
        provider_card_id: providerResponse.provider_card_id,
        provider_name: provider.name,
        spending_limit_daily: params.spending_limit_daily,
        spending_limit_per_transaction: params.spending_limit_per_transaction,
        expires_at: expiryDate.toISOString(),
        activated_at: now.toISOString(),
        voucher_id: params.voucher_id,
      })
      .select()
      .single();

    if (cardErr || !card) {
      logger.error({ cardErr }, 'Failed to persist card record');
      throw new Error('Failed to save card record');
    }

    // 5. Log provider interaction
    await supabaseAdmin.from('provider_logs').insert({
      provider: provider.name,
      operation: 'issue_card',
      success: true,
      related_entity_id: card.id,
      related_entity_type: 'card',
      user_id: params.user_id,
    });

    logger.info({ card_id: card.id, user_id: params.user_id }, 'Card issued successfully');
    return card as Card;
  }

  async freezeCard(cardId: string, userId: string): Promise<void> {
    const { data: card } = await supabaseAdmin
      .from('cards')
      .select('id, provider_card_id, status, user_id')
      .eq('id', cardId)
      .single();

    if (!card) throw new Error('Card not found');
    if (card.user_id !== userId) throw new Error('Unauthorized');
    if (card.status !== 'active') throw new Error(`Cannot freeze card with status: ${card.status}`);

    await provider.freezeCard(card.provider_card_id);

    await supabaseAdmin
      .from('cards')
      .update({ status: 'frozen' })
      .eq('id', cardId);
  }

  async unfreezeCard(cardId: string, userId: string): Promise<void> {
    const { data: card } = await supabaseAdmin
      .from('cards')
      .select('id, provider_card_id, status, user_id')
      .eq('id', cardId)
      .single();

    if (!card) throw new Error('Card not found');
    if (card.user_id !== userId) throw new Error('Unauthorized');
    if (card.status !== 'frozen') throw new Error('Card is not frozen');

    await provider.unfreezeCard(card.provider_card_id);

    await supabaseAdmin
      .from('cards')
      .update({ status: 'active' })
      .eq('id', cardId);
  }

  async terminateCard(cardId: string, userId: string, isAdmin = false): Promise<void> {
    const { data: card } = await supabaseAdmin
      .from('cards')
      .select('id, provider_card_id, wallet_id, current_balance, status, user_id')
      .eq('id', cardId)
      .single();

    if (!card) throw new Error('Card not found');
    if (!isAdmin && card.user_id !== userId) throw new Error('Unauthorized');
    if (['terminated', 'expired', 'exhausted'].includes(card.status)) {
      throw new Error(`Card already ${card.status}`);
    }

    const result = await provider.terminateCard(card.provider_card_id);

    // Prefer an explicit refund figure from the provider's response when
    // it gives one; otherwise fall back to our own tracked current_balance
    // (VitalPay's termination response has no such field despite the docs'
    // example showing one — confirmed by direct testing — it just zeroes
    // the card's balance on their end without saying how much that was).
    // Previously no provider's response was read here at all, so a
    // terminated card's remaining funds were never refunded regardless of
    // provider.
    const providerRefund = result && typeof result === 'object' ? result.refunded : undefined;
    const refunded = typeof providerRefund === 'number' ? providerRefund : Number(card.current_balance ?? 0);
    if (refunded > 0) {
      await supabaseAdmin.rpc('record_wallet_credit', {
        p_wallet_id: card.wallet_id,
        p_amount: refunded,
        p_type: 'refund',
        p_description: 'Card termination refund',
        p_metadata: { card_id: cardId },
      });
    }

    await supabaseAdmin
      .from('cards')
      .update({ status: 'terminated', terminated_at: new Date().toISOString(), current_balance: 0 })
      .eq('id', cardId);
  }

  async getCardTransactions(cardId: string, userId: string) {
    const { data: card } = await supabaseAdmin
      .from('cards')
      .select('provider_card_id, user_id')
      .eq('id', cardId)
      .single();

    if (!card || card.user_id !== userId) throw new Error('Card not found');

    return provider.getCardTransactions(card.provider_card_id);
  }
}

export const cardService = new CardService();
