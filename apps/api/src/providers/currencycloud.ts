// =============================================================================
// Currencycloud Provider — Multi-currency IBAN platform
// =============================================================================

import type { IbanProvider, IbanRequestParams, IbanAccount, ProviderConfig, ProviderHealth } from './types.js';
import { logger } from '../utils/logger.js';
import { safeJson } from './httpUtils.js';

export class CurrencyCloudProvider implements IbanProvider {
  name = 'currencycloud';
  private config: ProviderConfig;
  private httpClient: typeof fetch;
  private authToken?: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.httpClient = fetch;
  }

  private async getAuthToken(): Promise<string> {
    if (this.authToken) return this.authToken;

    try {
      const response = await this.httpClient(
        `${this.config.baseUrl}/v2/authenticate/api`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            login_id: this.config.apiKey || '',
            api_key: this.config.apiSecret || '',
          }).toString(),
        }
      );

      if (!response.ok) {
        throw new Error(`Currencycloud auth failed: ${response.statusText}`);
      }

      const data = await safeJson(response);
      this.authToken = data.auth_token;
      return this.authToken;
    } catch (error) {
      logger.error(`Currencycloud auth error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async requestIban(params: IbanRequestParams): Promise<IbanAccount> {
    if (!this.config.enabled) {
      throw new Error('Currencycloud provider is not enabled');
    }

    try {
      const token = await this.getAuthToken();

      const response = await this.httpClient(
        `${this.config.baseUrl}/v2/virtual_accounts/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Auth-Token': token,
          },
          body: new URLSearchParams({
            account_name: params.fullName,
            account_holder_id: params.userId,
            currency: params.currency,
            country: params.country || 'GB',
          }).toString(),
        }
      );

      if (!response.ok) {
        const error = await safeJson(response);
        logger.error(`Currencycloud IBAN request failed: ${JSON.stringify(error)}`);
        throw new Error(`Currencycloud API error: ${error.errors?.[0]?.message || response.statusText}`);
      }

      const data = await safeJson(response);

      return {
        iban: data.iban,
        bic: data.bic_swift,
        bankName: data.bank_name || 'Currencycloud Partner Bank',
        accountName: data.account_name,
        providerAccountId: data.id,
        currency: params.currency,
        country: params.country,
      };
    } catch (error) {
      logger.error(`Currencycloud provider error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getAccount(providerAccountId: string): Promise<IbanAccount> {
    if (!this.config.enabled) {
      throw new Error('Currencycloud provider is not enabled');
    }

    try {
      const token = await this.getAuthToken();

      const response = await this.httpClient(
        `${this.config.baseUrl}/v2/virtual_accounts/${providerAccountId}`,
        {
          method: 'GET',
          headers: {
            'X-Auth-Token': token,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Currencycloud API error: ${response.statusText}`);
      }

      const data = await safeJson(response);

      return {
        iban: data.iban,
        bic: data.bic_swift,
        bankName: data.bank_name || 'Currencycloud Partner Bank',
        accountName: data.account_name,
        providerAccountId: data.id,
        currency: data.currency,
        country: data.country,
      };
    } catch (error) {
      logger.error(`Currencycloud getAccount error: ${error instanceof Error ? error.message : String(error)}`);
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
      const token = await this.getAuthToken();

      const response = await this.httpClient(
        `${this.config.baseUrl}/v2/reference/beneficiary_required_details`,
        {
          method: 'GET',
          headers: {
            'X-Auth-Token': token,
          },
        }
      );

      if (response.ok) {
        health.healthy = true;
        health.message = 'Currencycloud API is healthy';
      } else {
        health.message = `Currencycloud API returned ${response.status}`;
      }
    } catch (error) {
      health.message = `Health check failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    return health;
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.apiKey || !this.config.apiSecret) {
      logger.error('Currencycloud provider: Missing API credentials');
      return false;
    }

    if (!this.config.baseUrl) {
      logger.error('Currencycloud provider: Missing base URL');
      return false;
    }

    return true;
  }
}
