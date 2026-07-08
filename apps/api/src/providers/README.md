# IBAN Provider System

Multi-provider abstraction layer for issuing Virtual IBANs with automatic failover and geography-based routing.

## Architecture

```
Client Request
    ↓
BankingService.requestIbanAccount()
    ↓
ProviderRegistry.selectWithFallback()
    ├─ Smart routing by geography/priority
    ├─ Health checks on providers
    └─ Automatic fallback on failure
    ↓
Selected IbanProvider (Lorum/Currencycloud/OpenPayd/Airwallex)
    ↓
Provider API → Virtual IBAN issued
    ↓
Store in DB: iban_accounts table with provider metadata
```

## Providers

### 1. **Lorum** (Priority: 1 — Africa-first)
- **Best for:** Zimbabwe, Africa, Middle East
- **Supported currencies:** EUR, USD, AED, and others (30+ markets)
- **Features:** Individual & business accounts
- **Sandbox:** https://sandbox.lorum.com
- **Docs:** https://www.lorum.com

**Environment Variables:**
```
LORUM_ENABLED=true
LORUM_API_KEY=your_api_key
LORUM_BASE_URL=https://sandbox.lorum.com  # or production
LORUM_ENVIRONMENT=sandbox # or production
```

### 2. **Currencycloud** (Priority: 2 — Mature, Global)
- **Best for:** EU, UK, Global remittances
- **Supported currencies:** 35+, including GBP, EUR, USD
- **Features:** Multi-currency accounts, FX conversions
- **Sandbox:** https://api-sandbox.currencycloud.com
- **Docs:** https://developer.currencycloud.com

**Environment Variables:**
```
CURRENCYCLOUD_ENABLED=true
CURRENCYCLOUD_API_KEY=your_login_id
CURRENCYCLOUD_API_SECRET=your_api_key
CURRENCYCLOUD_BASE_URL=https://api-sandbox.currencycloud.com
CURRENCYCLOUD_ENVIRONMENT=sandbox # or production
```

### 3. **OpenPayd** (Priority: 3 — Embedded Finance)
- **Best for:** UK, Europe, platforms needing modular integration
- **Supported currencies:** EUR, GBP, USD (expanding)
- **Features:** Embedded finance, instant account creation
- **Sandbox:** https://sandbox-api.openpayd.com
- **Docs:** https://www.openpayd.com

**Environment Variables:**
```
OPENPAYD_ENABLED=true
OPENPAYD_API_KEY=your_api_key
OPENPAYD_BASE_URL=https://sandbox-api.openpayd.com
OPENPAYD_ENVIRONMENT=sandbox # or production
```

### 4. **Airwallex** (Priority: 4 — Global Fallback)
- **Best for:** Global users, enterprise features
- **Supported currencies:** 50+
- **Features:** Payments, virtual cards, FX
- **Sandbox:** https://api-sandbox.airwallex.com
- **Docs:** https://www.airwallex.com

**Environment Variables:**
```
AIRWALLEX_ENABLED=true
AIRWALLEX_API_KEY=your_api_key
AIRWALLEX_BASE_URL=https://api-sandbox.airwallex.com
AIRWALLEX_ENVIRONMENT=sandbox # or production
```

## Smart Routing Rules

The system automatically selects the best provider based on:

1. **User's geographic location** (country_of_residence)
   - Zimbabwe/Africa → Lorum
   - EU countries → Currencycloud
   - UK → OpenPayd
   - US → Airwallex
   - Others → Priority fallback chain

2. **Provider priority** (lower number = higher priority)
   - 1: Lorum (Africa-first)
   - 2: Currencycloud (mature, global)
   - 3: OpenPayd (embedded finance)
   - 4: Airwallex (global fallback)

3. **Provider health** (health checks)
   - If primary provider is down → automatic fallback to next healthy provider
   - Clients never see the outage (transparent failover)

4. **Explicit preference** (optional)
   - Client can request specific provider via `?preferredProvider=lorum`

## API Endpoints

### User Endpoints

**GET /api/banking/accounts**
- Get user's banking accounts (local + IBAN)
- Returns: `{ local: VirtualAccount | null, iban: IbanAccount | null }`

**POST /api/banking/iban/request**
- Request a new IBAN account
- Query params: `?preferredProvider=lorum` (optional)
- Returns: Full IBAN account details with IBAN, BIC, bank name
- Requires: KYC approval (`kyc_status: 'approved'`)
- Status flow: `requested` → `in_review` → `provisioning` → `active`

**POST /api/banking/iban/switch-provider** (Admin)
- Switch provider for pending IBAN request
- Body: `{ newProvider: "currencycloud" }`
- Only works if current account is not active

### Admin Endpoints

**GET /api/banking/providers**
- List all configured providers and their health status
- Returns: `{ providers: [...], health: [...] }`

**POST /api/banking/providers/health**
- Trigger health check on all providers
- Returns: Health status for each provider

## Database Schema

```sql
CREATE TABLE iban_accounts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  wallet_id UUID,
  status TEXT, -- 'requested' | 'in_review' | 'provisioning' | 'active' | 'rejected'
  requested_currency VARCHAR(3),
  provider VARCHAR(50), -- 'lorum' | 'currencycloud' | 'openpayd' | 'airwallex'
  provider_account_id VARCHAR(255), -- Provider's unique account ID
  iban VARCHAR(34),
  bic VARCHAR(11),
  bank_name VARCHAR(255),
  rejection_reason TEXT,
  metadata JSONB, -- { preferred_provider, account_name, ... }
  activated_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## How to Add a New Provider

1. Create new file: `apps/api/src/providers/myprovider.ts`

2. Implement `IbanProvider` interface:
```typescript
import type { IbanProvider, IbanRequestParams, IbanAccount, ProviderConfig, ProviderHealth } from './types.js';

export class MyProviderProvider implements IbanProvider {
  name = 'myprovider';
  
  async requestIban(params: IbanRequestParams): Promise<IbanAccount> {
    // Implementation
  }
  
  async getAccount(providerAccountId: string): Promise<IbanAccount> {
    // Implementation
  }
  
  async healthCheck(): Promise<ProviderHealth> {
    // Implementation
  }
  
  async validateConfig(): Promise<boolean> {
    // Implementation
  }
}
```

3. Register in `registry.ts`:
```typescript
const myprovider = new MyProviderProvider({ ... });
registry.registerProvider('myprovider', myprovider, config);
```

4. Set environment variables for the provider

5. The system automatically picks it based on priority/geography

## Error Handling

```typescript
// Client requests IBAN
POST /api/banking/iban/request

// If all providers fail:
{
  "success": false,
  "error": "No available IBAN providers. Please try again later."
}

// If KYC not approved:
{
  "success": false,
  "error": "Identity verification must be approved before requesting an IBAN account",
  "status": 403
}
```

## Testing in Sandbox

```bash
# 1. Set sandbox environment variables
LORUM_ENVIRONMENT=sandbox
CURRENCYCLOUD_ENVIRONMENT=sandbox
OPENPAYD_ENVIRONMENT=sandbox
AIRWALLEX_ENVIRONMENT=sandbox

# 2. Request IBAN from authenticated user (KYC approved)
curl -X POST http://localhost:3000/api/banking/iban/request \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Check provider health
curl -X POST http://localhost:3000/api/banking/providers/health \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 4. Request specific provider
curl -X POST http://localhost:3000/api/banking/iban/request?preferredProvider=lorum \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Monitoring & Admin Dashboard

The admin dashboard should show:
- [ ] List of all IBAN requests with provider info
- [ ] Provider health status (green/red)
- [ ] Failed requests and rejection reasons
- [ ] Provider switch history (audit trail)
- [ ] Currency distribution by provider
- [ ] Geographic distribution of IBANs

## Next Steps

1. **Get API keys** from all 4 providers (Lorum, Currencycloud, OpenPayd, Airwallex)
2. **Configure environment variables** in `.env.local` and Vercel
3. **Test** each provider in sandbox before going live
4. **Monitor** provider health in production
5. **Add virtual card issuance** as separate module (Airwallex + others)
