// =============================================================================
// Airwallex Provider — Global multi-currency platform
// =============================================================================

import type { IbanProvider, IbanRequestParams, IbanAccount, ProviderConfig, ProviderHealth } from './types.js';
import { logger } from '../utils/logger.js';
import { safeJson } from './httpUtils.js';

export class AirwallexProvider implements IbanProvider {
  name = 'airwallex';
  private config: ProviderConfig;
  private httpClient: typeof fetch;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.httpClient = fetch;
  }

  async requestIban(params: IbanRequestParams): Promise<IbanAccount> {
    if (!this.config.enabled) {
      throw new Error('Airwallex provider is not enabled');
    }

    try {
      const response = await this.httpClient(
        `${this.config.baseUrl}/api/v1/accounts`,
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
            currency: params.currency,
            country: params.country || 'GB',
            account_type: 'virtual',
            features: {
              local_payment_collection: true,
              sepa: true,
              swift: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await safeJson(response);
        logger.error(`Airwallex IBAN request failed: ${JSON.stringify(error)}`);
        throw new Error(`Airwallex API error: ${error.message || response.statusText}`);
      }

      const data = await safeJson(response);

      return {
        iban: data.iban,
        bic: data.bic || data.swift_code,
        bankName: data.bank_name || 'Airwallex',
        accountName: data.account_name || params.fullName,
        providerAccountId: data.account_id,
        currency: params.currency,
        country: params.country,
      };
    } catch (error) {
      logger.error(`Airwallex provider error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getAccount(providerAccountId: string): Promise<IbanAccount> {
    if (!this.config.enabled) {
      throw new Error('Airwallex provider is not enabled');
    }

    try {
      const response = await this.httpClient(
        `${this.config.baseUrl}/api/v1/accounts/${providerAccountId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Airwallex API error: ${response.statusText}`);
      }

      const data = await safeJson(response);

      return {
        iban: data.iban,
        bic: data.bic || data.swift_code,
        bankName: data.bank_name || 'Airwallex',
        accountName: data.account_name,
        providerAccountId: data.account_id,
        currency: data.currency,
        country: data.country,
      };
    } catch (error) {
      logger.error(`Airwallex getAccount error: ${error instanceof Error ? error.message : String(error)}`);
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
        `${this.config.baseUrl}/api/v1/health`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
        }
      );

      if (response.ok) {
        health.healthy = true;
        health.message = 'Airwallex API is healthy';
      } else {
        health.message = `Airwallex API returned ${response.status}`;
      }
    } catch (error) {
      health.message = `Health check failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    return health;
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.apiKey) {
      logger.error('Airwallex provider: Missing API key');
      return false;
    }

    if (!this.config.baseUrl) {
      logger.error('Airwallex provider: Missing base URL');
      return false;
    }

    return true;
  }
}
