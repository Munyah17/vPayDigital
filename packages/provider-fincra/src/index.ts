// =============================================================================
// vPay Provider Abstraction — Fincra Implementation
// Fincra is NEVER exposed to the frontend. All calls go through the API.
// This layer can be swapped for any other provider.
// =============================================================================

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import type {
  ProviderCardIssueRequest,
  ProviderCardIssueResponse,
  ProviderPayoutRequest,
  ProviderPayoutResponse,
  ProviderVirtualAccountRequest,
  ProviderVirtualAccountResponse,
} from '@vpay/types';
import { withRetry } from '@vpay/utils';

// ─── Base Provider Interface ──────────────────────────────────────────────────

export interface PaymentProvider {
  name: string;
  issueCard(req: ProviderCardIssueRequest): Promise<ProviderCardIssueResponse>;
  freezeCard(providerCardId: string): Promise<void>;
  unfreezeCard(providerCardId: string): Promise<void>;
  // Some providers (e.g. VitalPay) return the remaining card balance as
  // part of termination so it can be refunded to the wallet; providers that
  // don't (e.g. Fincra) just resolve void, which callers must treat as "no
  // refund information available."
  terminateCard(providerCardId: string): Promise<{ refunded?: number } | void>;
  getCardTransactions(providerCardId: string, params?: PaginationParams): Promise<FincraCardTransaction[]>;
  getCardDetails(providerCardId: string): Promise<FincraCardDetails>;
  fundCard(providerCardId: string, amount: number): Promise<void>;
  createVirtualAccount(req: ProviderVirtualAccountRequest): Promise<ProviderVirtualAccountResponse>;
  initiatePayout(req: ProviderPayoutRequest): Promise<ProviderPayoutResponse>;
  getPayoutStatus(providerReference: string): Promise<string>;
  getExchangeRate(from: string, to: string): Promise<number>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
}

// ─── Fincra-specific Types ────────────────────────────────────────────────────

interface PaginationParams {
  page?: number;
  limit?: number;
}

interface FincraCardDetails {
  id: string;
  maskedPan: string;
  expiryMonth: number;
  expiryYear: number;
  currency: string;
  status: string;
  balance: number;
}

interface FincraCardTransaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description: string;
  merchantName?: string;
  merchantCountry?: string;
  status: string;
  createdAt: string;
}

interface FincraApiError {
  message: string;
  code?: string;
  statusCode?: number;
}

// ─── Fincra Provider Implementation ──────────────────────────────────────────

export class FincraProvider implements PaymentProvider {
  readonly name = 'fincra';
  private readonly client: AxiosInstance;
  private readonly webhookSecret: string;
  private readonly businessId: string;

  constructor(config: {
    apiKey: string;
    secretKey: string;
    baseUrl: string;
    webhookSecret: string;
    businessId: string;
    timeoutMs?: number;
  }) {
    this.webhookSecret = config.webhookSecret;
    this.businessId = config.businessId;

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs ?? 30_000,
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey,
        'x-business-id': config.businessId,
      },
    });

    this.client.interceptors.response.use(
      (res) => res,
      (err) => {
        const apiError: FincraApiError = {
          message: err?.response?.data?.message ?? err.message ?? 'Provider error',
          code: err?.response?.data?.code,
          statusCode: err?.response?.status,
        };
        return Promise.reject(new ProviderError(apiError.message, apiError.statusCode, apiError.code));
      }
    );
  }

  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    return withRetry(async () => {
      const res = await this.client.request<{ data: T; success: boolean }>(config);
      return res.data.data ?? (res.data as unknown as T);
    }, { retries: 2, delay: 1000, backoff: 2 });
  }

  // ─── Card Operations ─────────────────────────────────────────────────────

  async issueCard(req: ProviderCardIssueRequest): Promise<ProviderCardIssueResponse> {
    const res = await this.request<{
      id: string;
      maskedPan: string;
      last4: string;
      expiryMonth: number;
      expiryYear: number;
      token: string;
      status: string;
    }>({
      method: 'POST',
      url: '/cards/issue',
      data: {
        name: req.cardholder_name,
        currency: req.currency,
        amount: req.amount,
        type: this.mapCardType(req.card_type),
        network: req.network,
        meta: req.metadata ?? {},
      },
    });

    return {
      provider_card_id: res.id,
      masked_pan: res.maskedPan,
      last_four: res.last4,
      expiry_month: res.expiryMonth,
      expiry_year: res.expiryYear,
      card_token: res.token,
      status: res.status,
    };
  }

  async freezeCard(providerCardId: string): Promise<void> {
    await this.request({ method: 'POST', url: `/cards/${providerCardId}/freeze` });
  }

  async unfreezeCard(providerCardId: string): Promise<void> {
    await this.request({ method: 'POST', url: `/cards/${providerCardId}/unfreeze` });
  }

  async terminateCard(providerCardId: string): Promise<void> {
    await this.request({ method: 'POST', url: `/cards/${providerCardId}/terminate` });
  }

  async getCardDetails(providerCardId: string): Promise<FincraCardDetails> {
    return this.request<FincraCardDetails>({ method: 'GET', url: `/cards/${providerCardId}` });
  }

  async getCardTransactions(providerCardId: string, params?: PaginationParams): Promise<FincraCardTransaction[]> {
    return this.request<FincraCardTransaction[]>({
      method: 'GET',
      url: `/cards/${providerCardId}/transactions`,
      params: { page: params?.page ?? 1, limit: params?.limit ?? 50 },
    });
  }

  async fundCard(providerCardId: string, amount: number): Promise<void> {
    await this.request({
      method: 'POST',
      url: `/cards/${providerCardId}/fund`,
      data: { amount },
    });
  }

  // ─── Virtual Accounts ────────────────────────────────────────────────────

  async createVirtualAccount(req: ProviderVirtualAccountRequest): Promise<ProviderVirtualAccountResponse> {
    const res = await this.request<{
      id: string;
      accountNumber: string;
      accountName: string;
      bankName: string;
      bankCode: string;
      currency: string;
    }>({
      method: 'POST',
      url: '/virtual-accounts',
      data: {
        currency: req.currency,
        merchantReference: req.user_id,
        customerName: req.full_name,
        customerEmail: req.email,
        bvn: null,
      },
    });

    return {
      provider_account_id: res.id,
      account_number: res.accountNumber,
      account_name: res.accountName,
      bank_name: res.bankName,
      bank_code: res.bankCode,
      currency: res.currency,
    };
  }

  // ─── Payouts ─────────────────────────────────────────────────────────────

  async initiatePayout(req: ProviderPayoutRequest): Promise<ProviderPayoutResponse> {
    const res = await this.request<{ reference: string; status: string; message?: string }>({
      method: 'POST',
      url: '/disbursements/payouts',
      data: {
        amount: req.amount,
        currency: req.currency,
        destinationCurrency: req.beneficiary.country ? req.currency : req.currency,
        business: this.businessId,
        description: req.description ?? 'vPay Payout',
        customerReference: req.reference,
        beneficiary: this.buildBeneficiary(req),
      },
    });

    return {
      provider_reference: res.reference,
      status: res.status,
      message: res.message,
    };
  }

  async getPayoutStatus(providerReference: string): Promise<string> {
    const res = await this.request<{ status: string }>({
      method: 'GET',
      url: `/disbursements/payouts/${providerReference}`,
    });
    return res.status;
  }

  // ─── Exchange Rates ───────────────────────────────────────────────────────

  async getExchangeRate(from: string, to: string): Promise<number> {
    const res = await this.request<{ rate: number }>({
      method: 'GET',
      url: '/fx/rates',
      params: { from, to },
    });
    return res.rate;
  }

  // ─── Webhook Verification ─────────────────────────────────────────────────

  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const crypto = require('crypto') as typeof import('crypto');
      const expected = crypto
        .createHmac('sha512', this.webhookSecret)
        .update(payload)
        .digest('hex');
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex')
      );
    } catch {
      return false;
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private mapCardType(cardType: string): string {
    const mapping: Record<string, string> = {
      single_use: 'single-use',
      multi_use: 'multi-use',
      disposable: 'single-use',
      time_limited: 'multi-use',
      merchant_locked: 'multi-use',
      subscription: 'multi-use',
    };
    return mapping[cardType] ?? 'single-use';
  }

  private buildBeneficiary(req: ProviderPayoutRequest): Record<string, unknown> {
    const b = req.beneficiary;
    return {
      name: b.name,
      ...(b.account_number && { accountNumber: b.account_number }),
      ...(b.bank_code && { bankCode: b.bank_code }),
      ...(b.bank_name && { bankName: b.bank_name }),
      ...(b.country && { country: b.country }),
      ...(b.mobile_number && { phoneNumber: b.mobile_number }),
      ...(b.crypto_address && { cryptoAddress: b.crypto_address }),
      ...(b.crypto_network && { cryptoNetwork: b.crypto_network }),
    };
  }
}

// ─── Provider Error ───────────────────────────────────────────────────────────

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

// ─── Provider Factory ─────────────────────────────────────────────────────────

export function createProvider(name: string, config: Record<string, string>): PaymentProvider {
  switch (name) {
    case 'fincra':
      return new FincraProvider({
        apiKey: config.FINCRA_API_KEY,
        secretKey: config.FINCRA_SECRET_KEY,
        baseUrl: config.FINCRA_BASE_URL,
        webhookSecret: config.FINCRA_WEBHOOK_SECRET,
        businessId: config.FINCRA_BUSINESS_ID,
        timeoutMs: parseInt(config.PROVIDER_TIMEOUT_MS ?? '30000'),
      });
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

export type { FincraCardTransaction, FincraCardDetails };
