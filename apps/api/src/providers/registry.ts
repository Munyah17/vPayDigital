// =============================================================================
// Provider Registry — Manager for all IBAN providers
// =============================================================================

import type { IbanProvider, ProviderConfig, ProviderSelectionContext, ProviderHealth } from './types.js';
import { LorumProvider } from './lorum.js';
import { CurrencyCloudProvider } from './currencycloud.js';
import { OpenPaydProvider } from './openpayd.js';
import { AirwallexProvider } from './airwallex.js';
import { logger } from '../utils/logger.js';

/**
 * Provider priority configuration
 * Lower number = higher priority
 */
const DEFAULT_PROVIDER_PRIORITY: Record<string, number> = {
  lorum: 1,        // Africa-first, best for Zimbabwe
  currencycloud: 2, // Mature, global coverage
  openpayd: 3,      // Embedded finance focus
  airwallex: 4,     // Global fallback
};

export class ProviderRegistry {
  private providers: Map<string, IbanProvider> = new Map();
  private configs: Map<string, ProviderConfig> = new Map();
  private providerPriority: Record<string, number> = DEFAULT_PROVIDER_PRIORITY;

  /**
   * Register a provider
   */
  registerProvider(name: string, provider: IbanProvider, config: ProviderConfig): void {
    this.providers.set(name, provider);
    this.configs.set(name, config);
    logger.info(`Provider registered: ${name}`);
  }

  /**
   * Get a specific provider
   */
  getProvider(name: string): IbanProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): Map<string, IbanProvider> {
    return this.providers;
  }

  /**
   * Validate all provider configurations
   */
  async validateAll(): Promise<boolean> {
    const providers = Array.from(this.providers.values());
    const results = await Promise.all(providers.map(p => p.validateConfig()));
    return results.every(r => r === true);
  }

  /**
   * Get health status of all providers
   */
  async getHealthStatus(): Promise<ProviderHealth[]> {
    const providers = Array.from(this.providers.values());
    return Promise.all(providers.map(p => p.healthCheck()));
  }

  /**
   * Select the best provider based on context
   * Uses smart routing based on geography, availability, and priority
   */
  selectProvider(context: ProviderSelectionContext): IbanProvider | null {
    // 1. If client explicitly prefers a provider, try it first
    if (context.preferredProvider) {
      const preferred = this.getProvider(context.preferredProvider);
      if (preferred && this.configs.get(context.preferredProvider)?.enabled) {
        return preferred;
      }
    }

    // 2. Geography-based routing
    if (context.country) {
      const provider = this.selectByCountry(context.country);
      if (provider) return provider;
    }

    // 3. Default priority-based selection
    return this.selectByPriority();
  }

  /**
   * Smart routing based on customer location
   */
  private selectByCountry(country: string): IbanProvider | null {
    const countryLower = country.toLowerCase();

    // Zimbabwe and Africa = Lorum (best fit for Africa)
    if (['zw', 'zimbabwe', 'za', 'south africa', 'ke', 'kenya', 'ng', 'nigeria'].includes(countryLower)) {
      const lorum = this.getProvider('lorum');
      if (lorum && this.configs.get('lorum')?.enabled) {
        logger.info(`Provider selection: Lorum (Africa-optimized for ${country})`);
        return lorum;
      }
    }

    // EU countries = Currencycloud or OpenPayd
    const euCountries = ['de', 'fr', 'nl', 'be', 'at', 'ie', 'it', 'es', 'pt', 'gr', 'pl', 'cz', 'hu', 'ro'];
    if (euCountries.includes(countryLower)) {
      const currencycloud = this.getProvider('currencycloud');
      if (currencycloud && this.configs.get('currencycloud')?.enabled) {
        logger.info(`Provider selection: Currencycloud (EU-optimized for ${country})`);
        return currencycloud;
      }
    }

    // UK = OpenPayd or Currencycloud
    if (['gb', 'uk', 'united kingdom'].includes(countryLower)) {
      const openpayd = this.getProvider('openpayd');
      if (openpayd && this.configs.get('openpayd')?.enabled) {
        logger.info(`Provider selection: OpenPayd (UK-optimized)`);
        return openpayd;
      }
    }

    // US/Global = Airwallex
    if (['us', 'usa', 'united states'].includes(countryLower)) {
      const airwallex = this.getProvider('airwallex');
      if (airwallex && this.configs.get('airwallex')?.enabled) {
        logger.info(`Provider selection: Airwallex (US-optimized)`);
        return airwallex;
      }
    }

    return null;
  }

  /**
   * Select provider by priority (lowest number = highest priority)
   */
  private selectByPriority(): IbanProvider | null {
    const enabledProviders = Array.from(this.providers.entries())
      .filter(([name]) => this.configs.get(name)?.enabled)
      .sort(([nameA], [nameB]) => {
        const priorityA = this.providerPriority[nameA] ?? 999;
        const priorityB = this.providerPriority[nameB] ?? 999;
        return priorityA - priorityB;
      });

    if (enabledProviders.length === 0) {
      logger.error('No enabled providers available');
      return null;
    }

    const [selectedName] = enabledProviders[0];
    logger.info(`Provider selection: ${selectedName} (by priority)`);
    return this.getProvider(selectedName) || null;
  }

  /**
   * Try providers in order (with fallback)
   * Used when a specific provider fails
   */
  async selectWithFallback(context: ProviderSelectionContext): Promise<IbanProvider | null> {
    const primaryProvider = this.selectProvider(context);
    if (primaryProvider) {
      // Check if it's healthy
      const health = await primaryProvider.healthCheck();
      if (health.healthy) {
        return primaryProvider;
      }
      logger.warn(`Primary provider ${primaryProvider.name} is not healthy, trying fallback`);
    }

    // Fallback to next available provider
    const enabledProviders = Array.from(this.providers.entries())
      .filter(([name]) => this.configs.get(name)?.enabled && name !== primaryProvider?.name)
      .sort(([nameA], [nameB]) => {
        const priorityA = this.providerPriority[nameA] ?? 999;
        const priorityB = this.providerPriority[nameB] ?? 999;
        return priorityA - priorityB;
      });

    for (const [name] of enabledProviders) {
      const provider = this.getProvider(name);
      if (provider) {
        const health = await provider.healthCheck();
        if (health.healthy) {
          logger.info(`Using fallback provider: ${name}`);
          return provider;
        }
      }
    }

    logger.error('No healthy providers available');
    return null;
  }

  /**
   * Set provider priority (lower = higher priority)
   */
  setPriority(priorities: Record<string, number>): void {
    this.providerPriority = { ...DEFAULT_PROVIDER_PRIORITY, ...priorities };
  }
}

// Singleton registry
let registryInstance: ProviderRegistry | null = null;

export function getProviderRegistry(): ProviderRegistry {
  if (!registryInstance) {
    registryInstance = new ProviderRegistry();
  }
  return registryInstance;
}

/**
 * Initialize all providers with configuration from environment
 */
export async function initializeProviders(): Promise<void> {
  const registry = getProviderRegistry();

  // Lorum configuration
  if (process.env.LORUM_API_KEY) {
    const lorum = new LorumProvider({
      name: 'lorum',
      apiKey: process.env.LORUM_API_KEY,
      baseUrl: process.env.LORUM_BASE_URL || 'https://sandbox.lorum.com',
      environment: process.env.LORUM_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
      enabled: process.env.LORUM_ENABLED !== 'false',
      priority: 1,
    });
    registry.registerProvider('lorum', lorum, {
      name: 'lorum',
      apiKey: process.env.LORUM_API_KEY,
      baseUrl: process.env.LORUM_BASE_URL || 'https://sandbox.lorum.com',
      environment: process.env.LORUM_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
      enabled: process.env.LORUM_ENABLED !== 'false',
      priority: 1,
    });
  }

  // Currencycloud configuration
  if (process.env.CURRENCYCLOUD_API_KEY) {
    const currencycloud = new CurrencyCloudProvider({
      name: 'currencycloud',
      apiKey: process.env.CURRENCYCLOUD_API_KEY,
      apiSecret: process.env.CURRENCYCLOUD_API_SECRET,
      baseUrl: process.env.CURRENCYCLOUD_BASE_URL || 'https://api-sandbox.currencycloud.com',
      environment: process.env.CURRENCYCLOUD_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
      enabled: process.env.CURRENCYCLOUD_ENABLED !== 'false',
      priority: 2,
    });
    registry.registerProvider('currencycloud', currencycloud, {
      name: 'currencycloud',
      apiKey: process.env.CURRENCYCLOUD_API_KEY,
      apiSecret: process.env.CURRENCYCLOUD_API_SECRET,
      baseUrl: process.env.CURRENCYCLOUD_BASE_URL || 'https://api-sandbox.currencycloud.com',
      environment: process.env.CURRENCYCLOUD_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
      enabled: process.env.CURRENCYCLOUD_ENABLED !== 'false',
      priority: 2,
    });
  }

  // OpenPayd configuration
  if (process.env.OPENPAYD_API_KEY) {
    const openpayd = new OpenPaydProvider({
      name: 'openpayd',
      apiKey: process.env.OPENPAYD_API_KEY,
      baseUrl: process.env.OPENPAYD_BASE_URL || 'https://sandbox-api.openpayd.com',
      environment: process.env.OPENPAYD_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
      enabled: process.env.OPENPAYD_ENABLED !== 'false',
      priority: 3,
    });
    registry.registerProvider('openpayd', openpayd, {
      name: 'openpayd',
      apiKey: process.env.OPENPAYD_API_KEY,
      baseUrl: process.env.OPENPAYD_BASE_URL || 'https://sandbox-api.openpayd.com',
      environment: process.env.OPENPAYD_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
      enabled: process.env.OPENPAYD_ENABLED !== 'false',
      priority: 3,
    });
  }

  // Airwallex configuration
  if (process.env.AIRWALLEX_API_KEY) {
    const airwallex = new AirwallexProvider({
      name: 'airwallex',
      apiKey: process.env.AIRWALLEX_API_KEY,
      baseUrl: process.env.AIRWALLEX_BASE_URL || 'https://api-sandbox.airwallex.com',
      environment: process.env.AIRWALLEX_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
      enabled: process.env.AIRWALLEX_ENABLED !== 'false',
      priority: 4,
    });
    registry.registerProvider('airwallex', airwallex, {
      name: 'airwallex',
      apiKey: process.env.AIRWALLEX_API_KEY,
      baseUrl: process.env.AIRWALLEX_BASE_URL || 'https://api-sandbox.airwallex.com',
      environment: process.env.AIRWALLEX_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
      enabled: process.env.AIRWALLEX_ENABLED !== 'false',
      priority: 4,
    });
  }

  // Validate configurations
  const valid = await registry.validateAll();
  if (!valid) {
    logger.warn('Some provider configurations are invalid');
  }

  logger.info(`Provider registry initialized with ${registry.getAllProviders().size} providers`);
}
