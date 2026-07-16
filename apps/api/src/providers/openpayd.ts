// =============================================================================
// OpenPayd Provider — Embedded finance virtual IBAN platform
// =============================================================================

import type { IbanProvider, IbanRequestParams, IbanAccount, ProviderConfig, ProviderHealth } from './types.js';
import { logger } from '../utils/logger.js';
import { safeJson } from './httpUtils.js';

export class OpenPaydProvider implements IbanProvider {
  name = 'openpayd';
  private config: ProviderConfig;
  private httpClient: typeof fetch;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.httpClient = fetch;
  }

  async requestIban(params: IbanRequestParams): Promise<IbanAccount> {
    if (!this.config.enabled) {
      throw new Error('OpenPayd provider is not enabled');
    }

    try {
      const response = await this.httpClient(
        `${this.config.baseUrl}/accounts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            account_holder: {
              id: params.userId,
              name: params.fullName,
              email: params.email,
            },
            currency: params.currency.toUpperCase(),
            country: params.country,
            account_type: 'virtual_iban',
            collection_payment_enabled: true,
          }),
        }
      );

      if (!response.ok) {
        const error = await safeJson(response);
        logger.error(`OpenPayd IBAN request failed: ${JSON.stringify(error)}`);
        throw new Error(`OpenPayd API error: ${error.message || response.statusText}`);
      }

      const data = await safeJson(response);

      return {
        iban: data.iban,
        bic: data.bic || data.swift_code,
        bankName: data.bank_name || 'OpenPayd Partner Bank',
        accountName: data.account_name || params.fullName,
        providerAccountId: data.account_id,
        currency: params.currency,
        country: params.country,
      };
    } catch (error) {
      logger.error(`OpenPayd provider error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getAccount(providerAccountId: string): Promise<IbanAccount> {
    if (!this.config.enabled) {
      throw new Error('OpenPayd provider is not enabled');
    }

    try {
      const response = await this.httpClient(
        `${this.config.baseUrl}/accounts/${providerAccountId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`OpenPayd API error: ${response.statusText}`);
      }

      const data = await safeJson(response);

      return {
        iban: data.iban,
        bic: data.bic || data.swift_code,
        bankName: data.bank_name || 'OpenPayd Partner Bank',
        accountName: data.account_name,
        providerAccountId: data.account_id,
        currency: data.currency,
        country: data.country,
      };
    } catch (error) {
      logger.error(`OpenPayd getAccount error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    const health: ProviderHealth = {
      provider: this.name,
      healthy: false,
      lastChecked: new Date(),
    };

    if (!this.config.enabled) {
      health.message = 'Provider is disabled in configuration';
      return health;
    }

    try {
      const response = await this.httpClient(
        `${this.config.baseUrl}/health`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
        }
      );

      if (response.ok) {
        health.healthy = true;
        health.message = 'OpenPayd API is healthy';
      } else {
        health.message = `OpenPayd API returned ${response.status}`;
      }
    } catch (error) {
      health.message = `Health check failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    return health;
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.apiKey) {
      logger.error('OpenPayd provider: Missing API key');
      return false;
    }

    if (!this.config.baseUrl) {
      logger.error('OpenPayd provider: Missing base URL');
      return false;
    }

    return true;
  }
}
