// =============================================================================
// vPay Shared Utilities
// =============================================================================

import type { WalletCurrency } from '@vpay/types';

// ─── Currency Formatting ──────────────────────────────────────────────────────

// NGN/GHS/ZWL are intentionally excluded — banned currencies per platform
// policy (Zimbabwe is USD-only; no ZWL/ZiG/NGN/GHS anywhere in the product).
const CURRENCY_LOCALES: Record<string, string> = {
  USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', ZAR: 'en-ZA', KES: 'sw-KE',
};

export function formatCurrency(
  amount: number,
  currency: WalletCurrency | string = 'USD',
  options?: Intl.NumberFormatOptions
): string {
  try {
    const locale = CURRENCY_LOCALES[currency] ?? 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatCompact(amount: number, currency = 'USD'): string {
  if (amount >= 1_000_000) return `${formatCurrency(amount / 1_000_000, currency as WalletCurrency)}M`;
  if (amount >= 1_000) return `${formatCurrency(amount / 1_000, currency as WalletCurrency)}K`;
  return formatCurrency(amount, currency as WalletCurrency);
}

// ─── Date Formatting ──────────────────────────────────────────────────────────

export function formatDate(date: string | Date, format: 'short' | 'long' | 'relative' = 'short'): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid date';

  if (format === 'relative') return formatRelativeTime(d);

  if (format === 'long') {
    return d.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date, 'short');
}

export function formatCardExpiry(month?: number, year?: number): string {
  if (!month || !year) return 'MM/YY';
  return `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;
}

// ─── Card Formatting ──────────────────────────────────────────────────────────

export function maskCardNumber(lastFour: string, network: string = 'visa'): string {
  const segments = network === 'amex' ? ['****', '******', lastFour.slice(0, 5)] : ['****', '****', '****', lastFour];
  return segments.join(' ');
}

export function formatCardNumber(pan: string): string {
  const cleaned = pan.replace(/\D/g, '');
  return cleaned.match(/.{1,4}/g)?.join(' ') ?? pan;
}

// ─── String Utils ─────────────────────────────────────────────────────────────

export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function titleCase(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Number Utils ─────────────────────────────────────────────────────────────

export function toDecimal(value: number, decimals = 2): number {
  return parseFloat(value.toFixed(decimals));
}

export function percentChange(from: number, to: number): number {
  if (from === 0) return to > 0 ? 100 : 0;
  return toDecimal(((to - from) / Math.abs(from)) * 100);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(phone.replace(/\s/g, ''));
}

export function isValidAmount(amount: number, min = 0.01, max = 100_000): boolean {
  return amount >= min && amount <= max && isFinite(amount);
}

export function isValidVoucherCode(code: string): boolean {
  return /^VP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
}

// ─── Crypto Utils (client-safe) ───────────────────────────────────────────────

export async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateId(length = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, b => chars[b % chars.length]).join('');
}

// ─── Object Utils ─────────────────────────────────────────────────────────────

export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach(k => delete result[k]);
  return result;
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(k => { if (k in obj) result[k] = obj[k]; });
  return result;
}

export function deepMerge<T extends Record<string, unknown>>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const key in override) {
    const val = override[key];
    if (val !== undefined && val !== null) {
      result[key] = val as T[typeof key];
    }
  }
  return result;
}

// ─── Error Utils ─────────────────────────────────────────────────────────────

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'An unexpected error occurred';
}

// ─── Retry Logic ─────────────────────────────────────────────────────────────

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; delay?: number; backoff?: number } = {}
): Promise<T> {
  const { retries = 3, delay = 1000, backoff = 2 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(backoff, attempt)));
      }
    }
  }

  throw lastError;
}

// ─── Array Utils ─────────────────────────────────────────────────────────────

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    return { ...groups, [groupKey]: [...(groups[groupKey] ?? []), item] };
  }, {} as Record<string, T[]>);
}

export function sumBy<T>(array: T[], key: keyof T): number {
  return array.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
}

export function uniqueBy<T>(array: T[], key: keyof T): T[] {
  const seen = new Set<unknown>();
  return array.filter(item => {
    const k = item[key];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
