// =============================================================================
// vPay Provider Abstraction — VitalPay (Tayari / KMG VitalLinks) Implementation
// Base URL: https://kmgvitallinks.co.uk/api/v1
// VitalPay is NEVER exposed to the frontend. All calls go through the API.
// =============================================================================

import axios, { AxiosInstance } from 'axios';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  ProviderError,
  type PaymentProvider,
  type ProviderCardDetails,
  type ProviderCardTransaction,
  type ProviderCardIssueRequest,
  type ProviderCardIssueResponse,
  type ProviderPaginationParams,
  type ProviderPayoutRequest,
  type ProviderPayoutResponse,
  type ProviderVirtualAccountRequest,
  type ProviderVirtualAccountResponse,
} from '@vpay/types';
import { withRetry } from '@vpay/utils';

// ─── Config ────────────────────────────────────────────────────────────────

export interface VitalPayConfig {
  secretKey: string;
  baseUrl: string;
  webhookSecret?: string;
  timeoutMs?: number;
}

// ─── Response shapes (only the fields we actually read) ────────────────────

export interface VitalPayCardProgramme {
  id: string; name: string; currency: string; brand: string; region: string;
  min_load: number; max_balance: number; available: boolean;
}

export interface VitalPayCard {
  // The docs' example payloads show "card_uid" but every real sandbox
  // response (issue/get/fund/freeze/terminate) uses "id" instead —
  // confirmed by direct testing. There is no card_uid field in practice.
  id: string; label: string; masked_pan: string; expiry: string;
  currency: string; balance: number; status: string;
  // Present ONLY in the issue response (verified by direct testing: GET
  // /virtual-cards/{id} afterwards returns masked_pan only). VitalPay's
  // model is that the full card details are shown on the end customer's
  // dashboard — this one-shot delivery is the only chance to capture them.
  card_number?: string; pin_code?: string;
}

export interface VitalPayGiftCardProduct {
  product_id: number; name: string; country: string; currency_code: string;
  fixed_amounts: number[] | null; min_amount: number | null; max_amount: number | null;
  image_url?: string; redeem_instrs?: string;
}

export interface VitalPayGiftCardOrder {
  // The docs' example shows "redemption_code" and "product_id" in the
  // purchase response, but the real response has neither — confirmed by
  // direct testing. It returns pin_code/serial_number instead, and status
  // resolves to "completed" synchronously in sandbox rather than
  // "processing". Keep all of these optional since live mode may differ
  // again (the docs promise redemption_code arrives via webhook for
  // system-of-record use, which hasn't been observed directly).
  reference: string; service: string; status: string;
  amount: number; currency: string;
  product_id?: number;
  pin_code?: string;
  serial_number?: string;
  redeem_url?: string | null;
  recipient_email?: string;
  redemption_code?: string;
}

export interface VitalPayElectricityOrder {
  // Confirmed by direct testing: the real sandbox response has a single
  // "token" string and no "unit" field, unlike the docs' example
  // ("token_pieces" array + "unit"). Both shapes kept optional in case live
  // mode matches the documented one instead.
  reference: string; service: string; meter_number: string;
  amount: number; currency: string; status: string;
  token?: string; token_pieces?: string[]; units?: number; unit?: string;
}

export interface VitalPayAirtimeOperator {
  operator_id: string; name: string; country_iso: string; currency: string;
  min_amount: number; max_amount: number;
  supported_types: Array<'airtime' | 'data'>; logo_url?: string;
}

export interface VitalPayAirtimeOrder {
  // NOT yet confirmed against a real sandbox call (unlike cards/gift-cards/
  // electricity/payments above) — this follows the documented shape as-is.
  // Verify field names against a real response before trusting them the
  // way the other integrations here were corrected.
  reference: string; service: string; operator_id: string; phone: string;
  amount: number; currency: string; status: string; type?: 'airtime' | 'data';
  created_at?: string;
}

export interface VitalPayPayment {
  reference: string; platform_reference?: string;
  // Confirmed against a real sandbox call: this comes back as a numeric
  // string ("25.00"), not a JSON number. Callers must Number() it before
  // doing arithmetic.
  amount: number | string; currency: string;
  status: string; mode?: string; payment_url?: string | null;
  payment_method?: string; customer_email?: string; completed_at?: string;
}

export interface VitalPayFloatTopup {
  reference: string; amount: number; credited_amount?: number; currency: string;
  status: string; checkout_url?: string | null; mode?: string;
}

export interface VitalPaySettlement {
  reference: string; amount: number; fee: number; net_amount: number;
  status: string; settlement_method?: string; requested_at: string; completed_at?: string;
}

export interface VitalPayWebhook {
  id: number; url: string; events: string[]; is_active: boolean;
  total_deliveries?: number; successful_deliveries?: number; failed_deliveries?: number;
}

// ─── Low-level client covering the full documented API surface ─────────────

export class VitalPayClient {
  readonly http: AxiosInstance;

  constructor(config: VitalPayConfig) {
    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs ?? 30_000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.secretKey}`,
      },
    });

    this.http.interceptors.response.use(
      (res) => res,
      (err) => {
        const data = err?.response?.data;
        const message = data?.error ?? data?.message ?? err.message ?? 'VitalPay provider error';
        const details = data?.errors ? `: ${JSON.stringify(data.errors)}` : '';
        return Promise.reject(new ProviderError(`${message}${details}`, err?.response?.status));
      }
    );
  }

  private async req<T>(method: string, url: string, data?: unknown, params?: Record<string, unknown>): Promise<T> {
    return withRetry(async () => {
      const res = await this.http.request<{ success: boolean; data: T; message?: string }>({ method, url, data, params });
      return res.data.data;
    }, { retries: 2, delay: 1000, backoff: 2 });
  }

  // ── Catalog ──
  getCategories() {
    return this.req<{ tier: string; categories: Array<{ slug: string; label: string; description: string; enabled: boolean }> }>(
      'GET', '/catalog/categories'
    );
  }

  // ── Virtual Cards ──
  getCardCatalogue() {
    return this.req<{ programmes: VitalPayCardProgramme[] }>('GET', '/virtual-cards/catalogue');
  }

  issueVirtualCard(body: { programme_id: string; label: string; initial_amount: number; customer_name?: string; customer_email?: string; reference?: string }) {
    return this.req<VitalPayCard>('POST', '/virtual-cards/issue', body);
  }

  getVirtualCard(cardUid: string) {
    return this.req<VitalPayCard>('GET', `/virtual-cards/${cardUid}`);
  }

  fundVirtualCard(cardUid: string, amount: number) {
    return this.req<VitalPayCard>('POST', `/virtual-cards/${cardUid}/fund`, { amount });
  }

  toggleFreezeVirtualCard(cardUid: string) {
    // The server 411s ("Length Required") on a bodyless POST — confirmed by
    // direct testing. An explicit empty JSON body satisfies it.
    return this.req<VitalPayCard>('POST', `/virtual-cards/${cardUid}/freeze`, {});
  }

  terminateVirtualCard(cardUid: string) {
    // Despite the docs' example showing a "refunded" field, the real
    // response has none — balance just drops to 0 with a message saying the
    // remainder was returned to the gateway account. Callers must compute
    // the refund amount from their own records (e.g. the card's balance
    // before calling this), not from this response.
    return this.req<VitalPayCard>('DELETE', `/virtual-cards/${cardUid}`);
  }

  // ── Gift Cards ──
  getGiftCardProducts(params?: { country?: string; page?: number; per_page?: number }) {
    return this.req<{ products: VitalPayGiftCardProduct[]; meta: { page: number; total: number; per_page: number } }>(
      'GET', '/gift-cards/products', undefined, params
    );
  }

  purchaseGiftCard(body: { product_id: number; amount: number; currency: string; recipient_email: string; reference: string }) {
    return this.req<VitalPayGiftCardOrder>('POST', '/gift-cards/purchase', body);
  }

  getGiftCardHistory(params?: { status?: string; from?: string; to?: string; per_page?: number }) {
    return this.req<{ items: VitalPayGiftCardOrder[]; meta: unknown }>('GET', '/gift-cards/history', undefined, params);
  }

  // ── Electricity Tokens (ZW / ZESA-ZETDC only, per docs) ──
  purchaseElectricityToken(body: { meter_number: string; amount: number; currency: string; country: string; reference: string }) {
    return this.req<VitalPayElectricityOrder>('POST', '/electricity/purchase', body);
  }

  getElectricityHistory(params?: { status?: string; from?: string; to?: string; per_page?: number }) {
    return this.req<{ items: VitalPayElectricityOrder[]; meta: unknown }>('GET', '/electricity/history', undefined, params);
  }

  // ── Airtime & Data ──
  getAirtimeOperators(params?: { country_iso?: string }) {
    return this.req<{ operators: VitalPayAirtimeOperator[] }>('GET', '/airtime/operators', undefined, params);
  }

  purchaseAirtime(body: { operator_id: string; phone: string; amount: number; currency: string; reference: string; type?: 'airtime' | 'data' }) {
    return this.req<VitalPayAirtimeOrder>('POST', '/airtime/purchase', body);
  }

  getAirtimeHistory(params?: { type?: string; status?: string; from?: string; to?: string; per_page?: number }) {
    return this.req<{ items: VitalPayAirtimeOrder[]; meta: unknown }>('GET', '/airtime/history', undefined, params);
  }

  // ── Payments (customer collections — this is what end-user wallet
  // top-up and any other "charge the customer" flow should use) ──
  initializePayment(body: {
    amount: number; currency: string; email: string; reference: string;
    phone?: string; name?: string; callback_url?: string; description?: string;
    metadata?: Record<string, unknown>; payment_method?: string;
  }) {
    return this.req<VitalPayPayment>('POST', '/payments/initialize', body);
  }

  verifyPayment(reference: string) {
    return this.req<VitalPayPayment>('GET', `/payments/verify/${encodeURIComponent(reference)}`);
  }

  listPayments(params?: { status?: string; from?: string; to?: string; per_page?: number }) {
    return this.req<VitalPayPayment[]>('GET', '/payments/list', undefined, params);
  }

  refundPayment(body: { reference: string; amount?: number; reason?: string }) {
    return this.req<{ reference: string; refund_amount: number; status: string; refunded_at: string }>('POST', '/payments/refund', body);
  }

  // ── Float top-up — VitalPay's OWN merchant-side prepaid balance, used to
  // pre-pay for card issuance / gift cards / VAS. This is NOT an end-user
  // facing operation — it funds our own capacity to consume VitalPay's
  // services, analogous to a treasury top-up, not a customer wallet. ──
  initializeFloatTopup(body: { amount: number; currency: string; callback_url?: string }) {
    return this.req<VitalPayFloatTopup>('POST', '/wallet/topup/initialize', body);
  }

  verifyFloatTopup(reference: string) {
    return this.req<VitalPayFloatTopup>('GET', `/wallet/topup/verify/${encodeURIComponent(reference)}`);
  }

  // ── Settlements — moves money from OUR merchant float to a bank / mobile
  // money / wallet destination WE control. Documented as a merchant
  // settlement primitive, not a per-user arbitrary-beneficiary payout API. ──
  requestSettlement(body: { amount: number; settlement_method: string; account_details: Record<string, unknown>; notes?: string }) {
    return this.req<VitalPaySettlement>('POST', '/settlements/request', body);
  }

  listSettlements(params?: { status?: string; from?: string; to?: string; per_page?: number }) {
    return this.req<VitalPaySettlement[]>('GET', '/settlements/list', undefined, params);
  }

  // ── Webhooks ──
  registerWebhook(body: { url: string; events: string[]; description?: string }) {
    return this.req<VitalPayWebhook & { secret: string }>('POST', '/webhooks', body);
  }

  listWebhooks() {
    return this.req<VitalPayWebhook[]>('GET', '/webhooks');
  }

  updateWebhook(id: number, body: Partial<{ url: string; events: string[]; is_active: boolean; description: string }>) {
    return this.req<VitalPayWebhook>('PUT', `/webhooks/${id}`, body);
  }

  deleteWebhook(id: number) {
    return this.req<void>('DELETE', `/webhooks/${id}`);
  }

  simulateWebhook(body: { event: string; scenario?: 'success' | 'failed'; reference?: string; webhook_id?: number }) {
    return this.req<{ event: string; scenario: string; deliveries: unknown[] }>('POST', '/webhooks/simulate', body);
  }
}

// ─── Signature verification ─────────────────────────────────────────────────
// VitalPay's docs specify the X-VitalPay-Signature header but not the exact
// algorithm. HMAC-SHA256 hex digest of the raw body is the near-universal
// convention for this class of API (Stripe, Paystack, Flutterwave, ...) —
// this has NOT been confirmed against a real delivery from VitalPay/KMG, so
// verify it against their support/docs before relying on it for anything
// where a mismatch would silently reject (or worse, silently accept) real
// webhook traffic.
export function verifyVitalPaySignature(rawBody: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ─── PaymentProvider adapter — covers card issuance/management only ────────
// See method-level comments for the operations VitalPay's documented API
// doesn't support the way Fincra's did (virtual accounts, arbitrary-
// beneficiary payouts, FX rates, card transaction history).
export class VitalPayProvider implements PaymentProvider {
  readonly name = 'vitalpay';
  readonly api: VitalPayClient;
  private readonly webhookSecret: string;
  private programmeCache: VitalPayCardProgramme[] | null = null;

  constructor(config: VitalPayConfig) {
    this.api = new VitalPayClient(config);
    this.webhookSecret = config.webhookSecret ?? '';
  }

  // Picking the first currency match and ignoring amount/brand used to send
  // real requests to the wrong programme — e.g. a $150 request matched the
  // $5-$99 Mastercard tier and VitalPay 422'd with an amount-range error, or
  // a Visa request silently issued a Mastercard because Mastercard sorted
  // first. Matches on currency + brand + the requested amount actually
  // falling inside [min_load, max_balance].
  private async programmeForRequest(currency: string, network: string, amount: number): Promise<VitalPayCardProgramme> {
    if (!this.programmeCache) {
      const { programmes } = await this.api.getCardCatalogue();
      this.programmeCache = programmes;
    }
    const sameCurrency = this.programmeCache.filter(
      (p) => p.currency.toUpperCase() === currency.toUpperCase() && p.available
    );
    if (sameCurrency.length === 0) {
      throw new ProviderError(
        `VitalPay has no available card programme for ${currency} (it currently only issues USD cards)`,
        422
      );
    }
    const sameBrand = sameCurrency.filter((p) => p.brand.toUpperCase() === network.toUpperCase());
    const candidates = sameBrand.length > 0 ? sameBrand : sameCurrency;
    const inRange = candidates.find((p) => amount >= p.min_load && amount <= p.max_balance);
    if (inRange) return inRange;
    if (sameBrand.length === 0) {
      const available = [...new Set(sameCurrency.map((p) => p.brand))].join(', ');
      throw new ProviderError(
        `VitalPay has no ${network} card programme for ${currency} (available: ${available})`,
        422
      );
    }
    const ranges = candidates.map((p) => `${p.min_load}-${p.max_balance}`).join(', ');
    throw new ProviderError(
      `${amount} ${currency} is outside every available ${network} card programme's range (${ranges})`,
      422
    );
  }

  async issueCard(req: ProviderCardIssueRequest): Promise<ProviderCardIssueResponse> {
    const programme = await this.programmeForRequest(req.currency, req.network, req.amount);
    const card = await this.api.issueVirtualCard({
      programme_id: programme.id,
      label: req.cardholder_name.slice(0, 64),
      initial_amount: req.amount,
      customer_name: req.cardholder_name,
      // Passing this in case VitalPay emails full card details to the
      // cardholder on issuance — their docs never confirm or deny this,
      // but it's the standard mechanism issuer APIs use to deliver a raw
      // PAN to the actual cardholder without the merchant's backend (us)
      // ever seeing it. Costs nothing to send even if unused.
      customer_email: req.cardholder_email,
      reference: (req.metadata?.reference as string) ?? undefined,
    });
    return this.toCardIssueResponse(card);
  }

  private toCardIssueResponse(card: VitalPayCard): ProviderCardIssueResponse {
    const [expMonth, expYear] = (card.expiry ?? '').split('/');
    const lastFour = (card.masked_pan.match(/(\d{4})\s*$/) ?? [])[1] ?? '0000';
    return {
      provider_card_id: card.id,
      masked_pan: card.masked_pan,
      last_four: lastFour,
      expiry_month: Number(expMonth) || 12,
      expiry_year: Number(expYear) || new Date().getFullYear() + 3,
      // The card id is the only stable handle VitalPay returns — it
      // doubles as the token here.
      card_token: card.id,
      status: card.status,
      // One-shot full card details, present only on the issue response.
      full_pan: card.card_number,
      pin_code: card.pin_code,
    };
  }

  async freezeCard(providerCardId: string): Promise<void> {
    await this.api.toggleFreezeVirtualCard(providerCardId);
  }

  async unfreezeCard(providerCardId: string): Promise<void> {
    // VitalPay exposes a single toggle endpoint for both directions.
    // cardService only calls freeze/unfreeze when the card's current status
    // actually matches (active → freeze, frozen → unfreeze), so toggling is
    // safe as long as our DB status stays in sync with VitalPay's.
    await this.api.toggleFreezeVirtualCard(providerCardId);
  }

  async terminateCard(providerCardId: string): Promise<{ refunded?: number }> {
    // Despite the docs' example, the real termination response has no
    // "refunded" field (confirmed by direct testing) — balance just drops
    // to 0. VitalPay has no card-spend-transaction webhook or endpoint, so
    // our own locally-tracked current_balance can't be trusted either (it
    // never decreases for spend we have no visibility into). Fetch the
    // balance right before terminating instead — VitalPay's own numbers are
    // the only reliable source of truth for what's actually left.
    const card = await this.api.getVirtualCard(providerCardId);
    await this.api.terminateVirtualCard(providerCardId);
    return { refunded: card.balance };
  }

  async getCardDetails(providerCardId: string): Promise<ProviderCardDetails> {
    const card = await this.api.getVirtualCard(providerCardId);
    const [expMonth, expYear] = (card.expiry ?? '').split('/');
    return {
      id: card.id,
      maskedPan: card.masked_pan,
      expiryMonth: Number(expMonth) || 0,
      expiryYear: Number(expYear) || 0,
      currency: card.currency,
      status: card.status,
      balance: card.balance,
    };
  }

  async getCardTransactions(_providerCardId: string, _params?: ProviderPaginationParams): Promise<ProviderCardTransaction[]> {
    // Not supported: VitalPay's documented API has no endpoint for listing
    // individual card-spend transactions, and its webhook event list
    // (payment.*, refund.processed, settlement.completed, service.*) has no
    // card-spend event either. Returning an empty list rather than
    // fabricating data — card spend history just won't populate through
    // this provider unless/until VitalPay exposes that endpoint.
    return [];
  }

  async fundCard(providerCardId: string, amount: number): Promise<void> {
    await this.api.fundVirtualCard(providerCardId, amount);
  }

  async createVirtualAccount(_req: ProviderVirtualAccountRequest): Promise<ProviderVirtualAccountResponse> {
    // Not supported: VitalPay has no persistent-virtual-account / dedicated
    // IBAN concept in its documented API — its collection model is
    // checkout-based (POST /payments/initialize) rather than "give the
    // customer an account number to transfer into at any time." Wallet
    // top-up is wired through the Payments API directly in the wallets
    // route instead of through this interface method.
    throw new ProviderError(
      'VitalPay has no persistent virtual account API — wallet top-up uses the payments/initialize checkout flow instead',
      501
    );
  }

  async initiatePayout(req: ProviderPayoutRequest): Promise<ProviderPayoutResponse> {
    // /settlements/request schema-tested directly against the sandbox with
    // an arbitrary, never-before-seen mobile money number in
    // account_details — it validated the request and got as far as an
    // "Insufficient balance" check rather than rejecting the beneficiary
    // as unregistered, consistent with it accepting a different
    // destination per request rather than one fixed pre-approved account.
    // (Couldn't fully confirm end-to-end delivery — the sandbox key's
    // settlement balance check reads the LIVE pool, which is $0 since we
    // have no live keys yet — so treat this as well-supported rather than
    // 100% proven.)
    const settlement = await this.api.requestSettlement({
      amount: req.amount,
      settlement_method: req.method === 'mobile_money' ? 'mobile_money'
        : req.method === 'crypto' ? 'wallet'
        : 'bank_transfer',
      account_details: {
        account_number: req.beneficiary.account_number,
        bank_code: req.beneficiary.bank_code,
        account_name: req.beneficiary.name,
        msisdn: req.beneficiary.mobile_number,
      },
      notes: req.description,
    });
    return {
      provider_reference: settlement.reference,
      status: settlement.status,
    };
  }

  async getPayoutStatus(providerReference: string): Promise<string> {
    const settlements = await this.api.listSettlements();
    const match = settlements.find((s) => s.reference === providerReference);
    if (!match) throw new ProviderError(`Settlement ${providerReference} not found`, 404);
    return match.status;
  }

  async getExchangeRate(_from: string, _to: string): Promise<number> {
    // Not supported: no FX-rate endpoint is documented for VitalPay.
    throw new ProviderError('VitalPay does not expose an FX rate endpoint', 501);
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    return verifyVitalPaySignature(payload, signature, this.webhookSecret);
  }
}

export { ProviderError };
