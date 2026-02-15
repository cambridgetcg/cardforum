/**
 * Currency Utilities — Multi-currency support for a global trading platform.
 *
 * CardForum uses USD as the internal settlement currency (wallets, matching).
 * Users price listings in their preferred local currency. Prices are stored
 * in local minor units alongside a USD equivalent snapshot for matching.
 *
 * Key concepts:
 *   - "minor units" = smallest currency unit (cents for USD, yen for JPY)
 *   - ISO-4217 codes throughout (USD, JPY, GBP, EUR, etc.)
 *   - Zero-decimal currencies (JPY, KRW) have exponent 0
 */

// ─── Supported Currencies ────────────────────────────

export const SUPPORTED_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "KRW",
  "SGD", "HKD", "NZD", "SEK", "NOK", "DKK", "PLN", "CZK",
  "MXN", "BRL", "TWD", "THB", "MYR", "PHP",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/** ISO-4217 minor unit exponents — how many decimal places the currency has. */
export const CURRENCY_EXPONENTS: Record<string, number> = {
  USD: 2, EUR: 2, GBP: 2, CAD: 2, AUD: 2, CHF: 2,
  SGD: 2, HKD: 2, NZD: 2, SEK: 2, NOK: 2, DKK: 2,
  PLN: 2, CZK: 2, MXN: 2, BRL: 2, TWD: 2, THB: 2,
  MYR: 2, PHP: 2,
  JPY: 0, KRW: 0, // zero-decimal
};

/** Human-readable labels and symbols for supported currencies. */
export const CURRENCY_INFO: Record<string, { symbol: string; name: string; flag: string }> = {
  USD: { symbol: "$", name: "US Dollar", flag: "🇺🇸" },
  EUR: { symbol: "€", name: "Euro", flag: "🇪🇺" },
  GBP: { symbol: "£", name: "British Pound", flag: "🇬🇧" },
  JPY: { symbol: "¥", name: "Japanese Yen", flag: "🇯🇵" },
  CAD: { symbol: "C$", name: "Canadian Dollar", flag: "🇨🇦" },
  AUD: { symbol: "A$", name: "Australian Dollar", flag: "🇦🇺" },
  CHF: { symbol: "Fr", name: "Swiss Franc", flag: "🇨🇭" },
  KRW: { symbol: "₩", name: "South Korean Won", flag: "🇰🇷" },
  SGD: { symbol: "S$", name: "Singapore Dollar", flag: "🇸🇬" },
  HKD: { symbol: "HK$", name: "Hong Kong Dollar", flag: "🇭🇰" },
  NZD: { symbol: "NZ$", name: "New Zealand Dollar", flag: "🇳🇿" },
  SEK: { symbol: "kr", name: "Swedish Krona", flag: "🇸🇪" },
  NOK: { symbol: "kr", name: "Norwegian Krone", flag: "🇳🇴" },
  DKK: { symbol: "kr", name: "Danish Krone", flag: "🇩🇰" },
  PLN: { symbol: "zł", name: "Polish Zloty", flag: "🇵🇱" },
  CZK: { symbol: "Kč", name: "Czech Koruna", flag: "🇨🇿" },
  MXN: { symbol: "MX$", name: "Mexican Peso", flag: "🇲🇽" },
  BRL: { symbol: "R$", name: "Brazilian Real", flag: "🇧🇷" },
  TWD: { symbol: "NT$", name: "New Taiwan Dollar", flag: "🇹🇼" },
  THB: { symbol: "฿", name: "Thai Baht", flag: "🇹🇭" },
  MYR: { symbol: "RM", name: "Malaysian Ringgit", flag: "🇲🇾" },
  PHP: { symbol: "₱", name: "Philippine Peso", flag: "🇵🇭" },
};

// ─── Country → Currency Mapping ──────────────────────

/** Maps ISO-3166-1 alpha-2 country codes to their primary currency. */
export const COUNTRY_CURRENCY: Record<string, SupportedCurrency> = {
  US: "USD", CA: "CAD", GB: "GBP", JP: "JPY", AU: "AUD", NZ: "NZD",
  CH: "CHF", KR: "KRW", SG: "SGD", HK: "HKD", TW: "TWD", TH: "THB",
  MY: "MYR", PH: "PHP", MX: "MXN", BR: "BRL",
  SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK",
  // Eurozone countries → EUR
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR",
  AT: "EUR", PT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR", LU: "EUR",
  SK: "EUR", SI: "EUR", EE: "EUR", LV: "EUR", LT: "EUR", MT: "EUR",
  CY: "EUR", HR: "EUR",
};

/**
 * Derive the default currency for a country.
 * Falls back to USD for unmapped countries.
 */
export function currencyForCountry(countryCode: string): SupportedCurrency {
  return COUNTRY_CURRENCY[countryCode.toUpperCase()] ?? "USD";
}

// ─── Minor Unit Conversion ───────────────────────────

/**
 * Get the exponent (number of decimal places) for a currency.
 * Defaults to 2 for unknown currencies.
 */
export function getCurrencyExponent(currency: string): number {
  return CURRENCY_EXPONENTS[currency.toUpperCase()] ?? 2;
}

/**
 * Convert a major-unit amount to minor units (e.g. $14.50 → 1450, ¥2000 → 2000).
 */
export function toMinorUnits(amount: number, currency: string): number {
  const exp = getCurrencyExponent(currency);
  return Math.round(amount * Math.pow(10, exp));
}

/**
 * Convert minor units to a major-unit amount (e.g. 1450 cents → 14.50, 2000 yen → 2000).
 */
export function fromMinorUnits(minorUnits: number, currency: string): number {
  const exp = getCurrencyExponent(currency);
  return minorUnits / Math.pow(10, exp);
}

// ─── Formatting ──────────────────────────────────────

/**
 * Format a price given in minor units with the correct currency symbol and decimals.
 *
 * Examples:
 *   formatPrice(1500, "USD") → "$15.00"
 *   formatPrice(2000, "JPY") → "¥2,000"
 *   formatPrice(1272, "GBP") → "£12.72"
 */
export function formatPrice(minorUnits: number, currency: string = "USD"): string {
  const info = CURRENCY_INFO[currency.toUpperCase()];
  const exp = getCurrencyExponent(currency);
  const major = minorUnits / Math.pow(10, exp);

  const symbol = info?.symbol ?? currency;

  if (exp === 0) {
    // Zero-decimal currencies: no decimal places, use thousands separator
    return `${symbol}${major.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }

  return `${symbol}${major.toLocaleString("en-US", { minimumFractionDigits: exp, maximumFractionDigits: exp })}`;
}

/**
 * Format a price with an approximate USD equivalent.
 *
 * Examples:
 *   formatPriceWithConversion(200000, "JPY", 0.00673) → "¥2,000 (~$13.46)"
 *   formatPriceWithConversion(1500, "USD", 1.0) → "$15.00"
 */
export function formatPriceWithConversion(
  minorUnits: number,
  currency: string,
  rateToUsd: number,
): string {
  const localFormatted = formatPrice(minorUnits, currency);

  if (currency.toUpperCase() === "USD") {
    return localFormatted;
  }

  const exp = getCurrencyExponent(currency);
  const majorAmount = minorUnits / Math.pow(10, exp);
  const usdAmount = majorAmount * rateToUsd;
  const usdFormatted = `$${usdAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return `${localFormatted} (~${usdFormatted})`;
}

/**
 * Convert minor units from one currency to another using a rate.
 *
 * The rate is expressed as: 1 unit of sourceCurrency = rate units of targetCurrency.
 * Returns the result in target currency minor units.
 */
export function convertMinorUnits(
  sourceMinorUnits: number,
  sourceCurrency: string,
  targetCurrency: string,
  rate: number,
): number {
  const sourceExp = getCurrencyExponent(sourceCurrency);
  const targetExp = getCurrencyExponent(targetCurrency);

  // Convert to major units, apply rate, convert back to minor units
  const sourceMajor = sourceMinorUnits / Math.pow(10, sourceExp);
  const targetMajor = sourceMajor * rate;
  return Math.round(targetMajor * Math.pow(10, targetExp));
}

/**
 * Check if a currency code is supported.
 */
export function isSupportedCurrency(currency: string): currency is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(currency.toUpperCase());
}

// ─── Platform Constants ──────────────────────────────

/** Internal settlement currency for wallets and matching. */
export const SETTLEMENT_CURRENCY = "USD" as const;

/** Maximum staleness for exchange rates before listings are flagged. */
export const RATE_STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Rate cache TTL — how often to refresh rates. */
export const RATE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/** FX tolerance band for matching — matches within this % are valid despite rate drift. */
export const FX_TOLERANCE = 0.02; // 2%

/** Threshold for flagging a listing's price as stale (rate moved too much since listing). */
export const PRICE_STALE_THRESHOLD = 0.05; // 5%
