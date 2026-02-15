/**
 * Exchange Rate Service — Fetches, caches, and serves FX rates.
 *
 * Architecture:
 *   1. In-memory cache (fastest, lives as long as the process)
 *   2. Database cache (survives restarts, shared across instances)
 *   3. External API fetch (Wise rates → OpenExchangeRates fallback)
 *
 * All rates are relative to USD (base currency).
 * Rate meaning: 1 USD = N units of target currency.
 *   e.g. { JPY: 148.5 } means 1 USD = 148.5 JPY
 *
 * To convert local → USD: localAmount / rate
 * To convert USD → local: usdAmount * rate
 */

import { db } from "@/lib/db";
import {
  SUPPORTED_CURRENCIES,
  RATE_CACHE_TTL_MS,
  RATE_STALE_THRESHOLD_MS,
  getCurrencyExponent,
  type SupportedCurrency,
} from "@/lib/currency";

// ─── Types ───────────────────────────────────────────

export interface ExchangeRates {
  baseCurrency: "USD";
  rates: Record<string, number>; // { EUR: 0.921, JPY: 148.5, ... }
  fetchedAt: Date;
  source: string;
}

// ─── In-Memory Cache ─────────────────────────────────

let memoryCache: ExchangeRates | null = null;

// ─── Public API ──────────────────────────────────────

/**
 * Get the current exchange rates. Tries in order:
 *   1. In-memory cache (if fresh)
 *   2. Database cache (if fresh)
 *   3. External API fetch (refreshes both caches)
 */
export async function getRates(): Promise<ExchangeRates> {
  // 1. In-memory cache
  if (memoryCache && !isExpired(memoryCache.fetchedAt, RATE_CACHE_TTL_MS)) {
    return memoryCache;
  }

  // 2. Database cache
  const dbCache = await loadFromDatabase();
  if (dbCache && !isExpired(dbCache.fetchedAt, RATE_CACHE_TTL_MS)) {
    memoryCache = dbCache;
    return dbCache;
  }

  // 3. Fetch fresh rates
  const fresh = await fetchFreshRates();
  memoryCache = fresh;
  await saveToDatabase(fresh);
  return fresh;
}

/**
 * Get the rate for a specific currency relative to USD.
 * Returns 1.0 for USD.
 * Throws if currency is not in the rate table.
 */
export async function getRate(currency: string): Promise<number> {
  const upper = currency.toUpperCase();
  if (upper === "USD") return 1.0;

  const { rates } = await getRates();
  const rate = rates[upper];
  if (rate === undefined) {
    throw new Error(`Exchange rate not available for ${upper}`);
  }
  return rate;
}

/**
 * Convert an amount from one currency to USD cents.
 *
 * @param minorUnits - Amount in source currency minor units
 * @param currency - ISO-4217 source currency code
 * @returns Amount in USD cents (rounded)
 */
export async function convertToUsdCents(
  minorUnits: number,
  currency: string,
): Promise<{ usdCents: number; rate: number; rateTimestamp: Date }> {
  const upper = currency.toUpperCase();

  if (upper === "USD") {
    return { usdCents: minorUnits, rate: 1.0, rateTimestamp: new Date() };
  }

  const rates = await getRates();
  const rate = rates.rates[upper];
  if (rate === undefined) {
    throw new Error(`Exchange rate not available for ${upper}`);
  }

  // Convert: local minor units → local major → USD major → USD cents
  const localExp = getCurrencyExponent(upper);
  const localMajor = minorUnits / Math.pow(10, localExp);
  const usdMajor = localMajor / rate; // rate is USD→local, so divide
  const usdCents = Math.round(usdMajor * 100);

  return { usdCents, rate, rateTimestamp: rates.fetchedAt };
}

/**
 * Convert USD cents to a target currency minor units.
 */
export async function convertFromUsdCents(
  usdCents: number,
  targetCurrency: string,
): Promise<{ targetMinorUnits: number; rate: number }> {
  const upper = targetCurrency.toUpperCase();

  if (upper === "USD") {
    return { targetMinorUnits: usdCents, rate: 1.0 };
  }

  const rates = await getRates();
  const rate = rates.rates[upper];
  if (rate === undefined) {
    throw new Error(`Exchange rate not available for ${upper}`);
  }

  const usdMajor = usdCents / 100;
  const targetMajor = usdMajor * rate;
  const targetExp = getCurrencyExponent(upper);
  const targetMinorUnits = Math.round(targetMajor * Math.pow(10, targetExp));

  return { targetMinorUnits, rate };
}

/**
 * Force refresh rates from external source.
 * Called by cron job or admin action.
 */
export async function refreshRates(): Promise<ExchangeRates> {
  const fresh = await fetchFreshRates();
  memoryCache = fresh;
  await saveToDatabase(fresh);
  return fresh;
}

/**
 * Check if the current cached rates are stale (older than the stale threshold).
 * Stale rates should trigger a warning — listings created with stale rates may be inaccurate.
 */
export async function areRatesStale(): Promise<boolean> {
  const rates = await getRates();
  return isExpired(rates.fetchedAt, RATE_STALE_THRESHOLD_MS);
}

/**
 * Get the rate used to convert a local currency price to USD,
 * expressed as "1 unit of local currency = X USD".
 * This is the "inverse" of the stored rate (which is USD→local).
 */
export async function getLocalToUsdRate(currency: string): Promise<number> {
  const upper = currency.toUpperCase();
  if (upper === "USD") return 1.0;

  const rate = await getRate(upper);
  return 1 / rate;
}

// ─── Internal: Database Operations ───────────────────

async function loadFromDatabase(): Promise<ExchangeRates | null> {
  const row = await db.exchangeRateCache.findFirst({
    where: { baseCurrency: "USD" },
    orderBy: { fetchedAt: "desc" },
  });

  if (!row) return null;

  return {
    baseCurrency: "USD",
    rates: row.rates as Record<string, number>,
    fetchedAt: row.fetchedAt,
    source: row.source,
  };
}

async function saveToDatabase(rates: ExchangeRates): Promise<void> {
  await db.exchangeRateCache.create({
    data: {
      baseCurrency: rates.baseCurrency,
      rates: rates.rates,
      source: rates.source,
      fetchedAt: rates.fetchedAt,
      expiresAt: new Date(rates.fetchedAt.getTime() + RATE_CACHE_TTL_MS),
    },
  });
}

// ─── Internal: External API Fetch ────────────────────

/**
 * Fetch fresh rates from external APIs. Tries:
 *   1. Wise (free, mid-market rates)
 *   2. OpenExchangeRates (fallback, requires API key)
 *   3. Static fallback (last resort — use hardcoded approximate rates)
 */
async function fetchFreshRates(): Promise<ExchangeRates> {
  // Try Wise first
  try {
    return await fetchFromWise();
  } catch (e) {
    console.warn("[exchange-rate] Wise fetch failed, trying fallback:", (e as Error).message);
  }

  // Try OpenExchangeRates
  const oxrKey = process.env.OPENEXCHANGERATES_APP_ID;
  if (oxrKey) {
    try {
      return await fetchFromOpenExchangeRates(oxrKey);
    } catch (e) {
      console.warn("[exchange-rate] OXR fetch failed:", (e as Error).message);
    }
  }

  // Last resort: use database cache even if stale
  const staleDb = await loadFromDatabase();
  if (staleDb) {
    console.warn("[exchange-rate] Using stale DB rates from", staleDb.fetchedAt.toISOString());
    return staleDb;
  }

  // Absolute last resort: hardcoded approximate rates (should never happen in production)
  console.error("[exchange-rate] All rate sources failed, using hardcoded fallback");
  return getHardcodedFallbackRates();
}

/**
 * Fetch rates from the Wise API.
 * Uses the public /v1/rates endpoint (no auth required for read-only rates).
 */
async function fetchFromWise(): Promise<ExchangeRates> {
  const env = process.env.WISE_ENVIRONMENT ?? "sandbox";
  const baseUrl = env === "live"
    ? "https://api.transferwise.com"
    : "https://api.sandbox.transferwise.tech";

  // Wise rates endpoint accepts source and target currencies
  // We fetch all USD→target pairs in one batch
  const targets = SUPPORTED_CURRENCIES.filter((c) => c !== "USD").join(",");
  const url = `${baseUrl}/v1/rates?source=USD&target=${targets}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = process.env.WISE_API_TOKEN;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Wise rates API returned ${response.status}`);
  }

  const data: WiseRateResponse[] = await response.json();

  const rates: Record<string, number> = {};
  for (const entry of data) {
    if (entry.source === "USD") {
      rates[entry.target] = entry.rate;
    }
  }

  return {
    baseCurrency: "USD",
    rates,
    fetchedAt: new Date(),
    source: "wise",
  };
}

interface WiseRateResponse {
  source: string;
  target: string;
  rate: number;
  time: string;
}

/**
 * Fetch rates from OpenExchangeRates API (fallback).
 * Requires OPENEXCHANGERATES_APP_ID env var.
 */
async function fetchFromOpenExchangeRates(appId: string): Promise<ExchangeRates> {
  const url = `https://openexchangerates.org/api/latest.json?app_id=${appId}&base=USD`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`OpenExchangeRates API returned ${response.status}`);
  }

  const data: { rates: Record<string, number> } = await response.json();

  // Filter to only supported currencies
  const rates: Record<string, number> = {};
  for (const currency of SUPPORTED_CURRENCIES) {
    if (currency === "USD") continue;
    if (data.rates[currency] !== undefined) {
      rates[currency] = data.rates[currency];
    }
  }

  return {
    baseCurrency: "USD",
    rates,
    fetchedAt: new Date(),
    source: "openexchangerates",
  };
}

/** Hardcoded approximate rates — absolute last resort. */
function getHardcodedFallbackRates(): ExchangeRates {
  return {
    baseCurrency: "USD",
    rates: {
      EUR: 0.92, GBP: 0.79, JPY: 149.0, CAD: 1.36, AUD: 1.53,
      CHF: 0.88, KRW: 1320.0, SGD: 1.34, HKD: 7.82, NZD: 1.66,
      SEK: 10.4, NOK: 10.6, DKK: 6.88, PLN: 3.97, CZK: 23.1,
      MXN: 17.1, BRL: 4.97, TWD: 32.0, THB: 34.5, MYR: 4.47, PHP: 56.0,
    },
    fetchedAt: new Date(),
    source: "hardcoded_fallback",
  };
}

// ─── Utilities ───────────────────────────────────────

function isExpired(timestamp: Date, ttlMs: number): boolean {
  return Date.now() - timestamp.getTime() > ttlMs;
}

/**
 * Clear the in-memory cache. Used in tests.
 */
export function clearMemoryCache(): void {
  memoryCache = null;
}
