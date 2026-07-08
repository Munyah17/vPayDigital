// =============================================================================
// Lorum Provider — Africa-first virtual IBAN issuer
// =============================================================================

import type { IbanProvider, IbanRequestParams, IbanAccount, ProviderConfig, ProviderHealth } from './types.js';
import { logger } from '../utils/logger.js';

export class LorumProvider implements IbanProvider {
  name = 'lorum';
  private config: ProviderConfig;
  private httpClient: typeof fetch;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.httpClient = fetch;
  }

  async requestIban(params: IbanRequestParams): Promise<IbanAccount> {
    if (!this.config.enabled) {
      throw new Error('Lorum provider is not enabled');
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
            email: params.email,
            full_name: params.fullName,
            user_id: params.userId,
            currency: params.currency,
            country: params.country,
            account_type: 'individual',
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        logger.error(`Lorum IBAN request failed: ${JSON.stringify(error)}`);
        throw new Error(`Lorum API error: ${error.message || response.statusText}`);
      }

      const data = await response.json();

      return {
        iban: data.iban,
        bic: data.bic,
        bankName: data.bank_name || 'Lorum Financial',
        accountName: data.account_name || params.fullName,
        providerAccountId: data.account_id,
        currency: params.currency,
        country: params.country,
      };
    } catch (error) {
      logger.error(`Lorum provider error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getAccount(providerAccountId: string): Promise<IbanAccount> {
    if (!this.config.enabled) {
      throw new Error('Lorum provider is not enabled');
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
        throw new Error(`Lorum API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        iban: data.iban,
        bic: data.bic,
        bankName: data.bank_name || 'Lorum Financial',
        accountName: data.account_name,
        providerAccountId: data.account_id,
        currency: data.currency,
        country: data.country,
      };
    } catch (error) {
      logger.error(`Lorum getAccount error: ${error instanceof Error ? error.message : String(error)}`);
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
        health.message = 'Lorum API is healthy';
      } else {
        health.message = `Lorum API returned ${response.status}`;
      }
    } catch (error) {
      health.message = `Health check failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    return health;
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.apiKey) {
      logger.error('Lorum provider: Missing API key');
      return false;
    }

    if (!this.config.baseUrl) {
      logger.error('Lorum provider: Missing base URL');
      return false;
    }

    return true;
  }
}
