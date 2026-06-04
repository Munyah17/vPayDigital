// =============================================================================
// API Configuration — loads and validates env vars at startup
// =============================================================================

import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '../../.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: parseInt(optional('PORT', '3001')),
  IS_PRODUCTION: process.env.NODE_ENV === 'production',

  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_ANON_KEY: required('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
  SUPABASE_JWT_SECRET: required('SUPABASE_JWT_SECRET'),

  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRY: optional('JWT_EXPIRY', '15m'),
  JWT_REFRESH_EXPIRY: optional('JWT_REFRESH_EXPIRY', '7d'),

  FINCRA_API_KEY: required('FINCRA_API_KEY'),
  FINCRA_SECRET_KEY: required('FINCRA_SECRET_KEY'),
  FINCRA_BASE_URL: optional('FINCRA_BASE_URL', 'https://api.fincra.com'),
  FINCRA_WEBHOOK_SECRET: required('FINCRA_WEBHOOK_SECRET'),
  FINCRA_BUSINESS_ID: required('FINCRA_BUSINESS_ID'),

  ACTIVE_PROVIDER: optional('ACTIVE_PROVIDER', 'fincra'),
  PROVIDER_TIMEOUT_MS: optional('PROVIDER_TIMEOUT_MS', '30000'),

  WEB_APP_URL: optional('WEB_APP_URL', 'http://localhost:5173'),
  ADMIN_APP_URL: optional('ADMIN_APP_URL', 'http://localhost:5174'),
  CORS_ORIGINS: optional('CORS_ORIGINS', 'http://localhost:5173,http://localhost:5174'),

  RATE_LIMIT_WINDOW_MS: parseInt(optional('RATE_LIMIT_WINDOW_MS', '900000')),
  RATE_LIMIT_MAX_REQUESTS: parseInt(optional('RATE_LIMIT_MAX_REQUESTS', '100')),

  REDIS_URL: optional('REDIS_URL', 'redis://localhost:6379'),

  ENCRYPTION_KEY: required('ENCRYPTION_KEY'),

  RESEND_API_KEY: optional('RESEND_API_KEY', ''),
  EMAIL_FROM: optional('EMAIL_FROM', 'noreply@vpay.app'),

  TWILIO_ACCOUNT_SID: optional('TWILIO_ACCOUNT_SID', ''),
  TWILIO_AUTH_TOKEN: optional('TWILIO_AUTH_TOKEN', ''),
  TWILIO_PHONE_NUMBER: optional('TWILIO_PHONE_NUMBER', ''),

  LOG_LEVEL: optional('LOG_LEVEL', 'info'),
  SENTRY_DSN: optional('SENTRY_DSN', ''),
} as const;
