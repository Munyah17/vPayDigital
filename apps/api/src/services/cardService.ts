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

    // 2. Call provider to issue card
    const providerResponse = await provider.issueCard({
      cardholder_name: params.cardholder_name,
      currency: params.currency,
      amount: params.amount,
      card_type: params.card_type,
      network: params.network,
    });

    // 3. Debit wallet atomically
    const { error: debitErr } = await supabaseAdmin.rpc('record_wallet_debit', {
      p_wallet_id: wallet.id,
      p_amount: params.amount,
      p_type: 'card_load',
      p_description: `Card issuance: ${params.network.toUpperCase()} ${params.card_type}`,
      p_metadata: { card_type: params.card_type, network: params.network },
    });

    if (debitErr) {
      logger.error({ debitErr }, 'Wallet debit failed after card issue — requires reconciliation');
      // Attempt to terminate the card
      try {
        await provider.terminateCard(providerResponse.provider_card_id);
      } catch (terminateErr) {
        logger.error({ terminateErr, provider_card_id: providerResponse.provider_card_id }, 'Failed to terminate card after debit failure');
      }
      throw new Error('Failed to debit wallet for card issuance');
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
      .select('id, provider_card_id, status, user_id')
      .eq('id', cardId)
      .single();

    if (!card) throw new Error('Card not found');
    if (!isAdmin && card.user_id !== userId) throw new Error('Unauthorized');
    if (['terminated', 'expired', 'exhausted'].includes(card.status)) {
      throw new Error(`Card already ${card.status}`);
    }

    await provider.terminateCard(card.provider_card_id);

    await supabaseAdmin
      .from('cards')
      .update({ status: 'terminated', terminated_at: new Date().toISOString() })
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
