// =============================================================================
// Provider Abstraction Layer — Types
// =============================================================================

export interface IbanRequestParams {
  userId: string;
  email: string;
  fullName: string;
  currency: string;
  country?: string;
}

export interface IbanAccount {
  iban: string;
  bic: string;
  bankName: string;
  accountName: string;
  providerAccountId: string;
  currency: string;
  country?: string;
}

export interface ProviderConfig {
  name: string;
  apiKey?: string;
  apiSecret?: string;
  baseUrl: string;
  environment: 'sandbox' | 'production';
  enabled: boolean;
  priority: number; // Lower = higher priority
}

export interface ProviderHealth {
  provider: string;
  healthy: boolean;
  lastChecked: Date;
  message?: string;
}

export interface ProviderSelectionContext {
  userId: string;
  country?: string;
  currency?: string;
  preferredProvider?: string;
}

/**
 * Base interface for all IBAN providers
 */
export interface IbanProvider {
  /**
   * Provider name identifier
   */
  name: string;

  /**
   * Request a new IBAN account
   */
  requestIban(params: IbanRequestParams): Promise<IbanAccount>;

  /**
   * Get account details
   */
  getAccount(providerAccountId: string): Promise<IbanAccount>;

  /**
   * Check if provider is available and healthy
   */
  healthCheck(): Promise<ProviderHealth>;

  /**
   * Validate configuration is complete
   */
  validateConfig(): Promise<boolean>;
}
