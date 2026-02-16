/**
 * TCGPlayer Pipeline Types
 *
 * Type definitions and helpers for the TCGCSV-based TCGPlayer pipeline.
 * TCGCSV (tcgcsv.com) provides a free, public, unauthenticated JSON API
 * that proxies TCGPlayer's catalog + pricing data, refreshed daily.
 */

// ─── Category IDs ──────────────────────────────────────────────

export const TCGPLAYER_CATEGORIES = {
  MTG: 1,
  YUGIOH: 2,
  POKEMON: 3,
  ONEPIECE: 68,
} as const;

export type TcgplayerTcg = keyof typeof TCGPLAYER_CATEGORIES;

/** Map from our internal TCG enum values to TCGCSV category IDs */
export const TCG_TO_CATEGORY: Record<string, number> = {
  ONEPIECE: TCGPLAYER_CATEGORIES.ONEPIECE,
  POKEMON: TCGPLAYER_CATEGORIES.POKEMON,
  YUGIOH: TCGPLAYER_CATEGORIES.YUGIOH,
  MTG: TCGPLAYER_CATEGORIES.MTG,
};

export const TCGCSV_BASE_URL = "https://tcgcsv.com";

// ─── API Response Types ────────────────────────────────────────

export interface TcgcsvResponse<T> {
  totalItems: number;
  success: boolean;
  errors: string[];
  results: T[];
}

export interface TcgcsvGroup {
  groupId: number;
  name: string;
  abbreviation: string;
  supplemental: boolean;
  publishedOn: string; // ISO date
  modifiedOn: string;
  categoryId: number;
}

export interface ExtendedDataEntry {
  name: string;
  displayName: string;
  value: string;
}

export interface TcgcsvProduct {
  productId: number;
  name: string;
  cleanName: string;
  imageUrl: string;
  categoryId: number;
  groupId: number;
  url: string;
  modifiedOn: string;
  imageCount: number;
  presaleInfo: { isPresale: boolean; releasedOn: string | null; note: string | null };
  extendedData: ExtendedDataEntry[];
}

export interface TcgcsvPrice {
  productId: number;
  lowPrice: number | null;
  midPrice: number | null;
  highPrice: number | null;
  marketPrice: number | null;
  directLowPrice: number | null;
  subTypeName: string; // "Normal", "Foil", "1st Edition Normal", etc.
}

// ─── Pipeline Types ────────────────────────────────────────────

export interface TcgplayerGroupEntry {
  groupId: number;
  name: string;
  abbreviation: string;
  publishedOn: string;
  setCode: string; // Normalized: "OP01", "ST01", etc.
  productType: string | null;
  isSupplemental: boolean;
}

export interface TcgplayerPriceEntry {
  subTypeName: string;
  lowPrice: number | null;
  midPrice: number | null;
  highPrice: number | null;
  marketPrice: number | null;
  directLowPrice: number | null;
}

export interface TcgplayerCard {
  productId: number;
  cardId: string; // From extendedData.Number (e.g., "OP01-002")
  name: string;
  cleanName: string;
  url: string;
  imageUrl: string;
  groupId: number;
  setCode: string;
  rarity: string | null;
  cardType: string | null;
  color: string | null;
  power: string | null;
  cost: string | null;
  life: string | null;
  subtypes: string | null;
  attribute: string | null;
  effectText: string | null;
  counterPlus: string | null;
  prices: TcgplayerPriceEntry[];
}

export interface TcgplayerSealedProduct {
  productId: number;
  name: string;
  cleanName: string;
  url: string;
  imageUrl: string;
  groupId: number;
  setCode: string;
  prices: TcgplayerPriceEntry[];
}

export interface TcgplayerScrapeResult {
  tcg: string;
  groupName: string;
  groupId: number;
  setCode: string;
  totalProducts: number;
  totalCards: number;
  scrapedAt: string;
  durationMs: number;
  cards: TcgplayerCard[];
  sealedProducts: number;
  sealedProductData?: TcgplayerSealedProduct[];
  errors: string[];
}

export interface TcgplayerDiscoveryResult {
  tcg: string;
  categoryId: number;
  groups: TcgplayerGroupEntry[];
  supplementalGroups: TcgplayerGroupEntry[];
  discoveredAt: string;
}

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Extract a value from TCGPlayer's extendedData array by field name.
 */
export function getExtendedDataValue(data: ExtendedDataEntry[], name: string): string | null {
  const entry = data.find((d) => d.name === name);
  return entry?.value?.trim() || null;
}

/**
 * Re-export normalizeSetCode from the canonical source.
 * @see set-code-mappings.ts
 */
export { normalizeSetCode } from "./set-code-mappings";

/**
 * Classify whether a group is supplemental based on its abbreviation.
 * Supplements include prerelease kits, announcement sets, championship series, etc.
 */
export function classifySupplemental(abbreviation: string, name: string): boolean {
  const abbr = abbreviation.toUpperCase();
  const nameLower = name.toLowerCase();
  return (
    abbr.includes("PRE") ||
    abbr.includes("ANN") ||
    abbr.includes("CS") ||
    nameLower.includes("promo") ||
    nameLower.includes("prerelease") ||
    nameLower.includes("championship") ||
    nameLower.includes("event pack")
  );
}

/**
 * Infer product type from set code prefix.
 */
export function inferProductType(code: string): string | null {
  if (code.startsWith("OP")) return "booster";
  if (code.startsWith("ST")) return "starter";
  if (code.startsWith("EB")) return "extra";
  if (code.startsWith("PRB")) return "premium";
  if (code.startsWith("PROMO") || code === "P") return "promo";
  return null;
}

/**
 * Map TCGPlayer subTypeName to our variant treatment/version.
 * For One Piece: "Normal" → "regular", "Foil" → "parallel"
 * For Pokemon: "Normal" → "regular", "Holofoil" → "holofoil", etc.
 */
export function mapSubTypeToVersion(
  subTypeName: string,
  tcg: string,
): { version: string; treatment: string } {
  const sub = subTypeName.toLowerCase();

  if (tcg === "ONEPIECE") {
    if (sub === "normal") return { version: "", treatment: "regular" };
    if (sub === "foil") return { version: "Foil", treatment: "parallel" };
  }

  if (tcg === "POKEMON") {
    if (sub === "normal") return { version: "", treatment: "regular" };
    if (sub === "holofoil") return { version: "Holofoil", treatment: "holofoil" };
    if (sub === "reverse holofoil")
      return { version: "Reverse Holofoil", treatment: "reverse_holofoil" };
    if (sub.includes("1st edition")) return { version: "1st Edition", treatment: "regular" };
  }

  if (tcg === "YUGIOH") {
    if (sub === "unlimited") return { version: "", treatment: "regular" };
    if (sub.includes("1st edition")) return { version: "1st Edition", treatment: "regular" };
    if (sub === "limited") return { version: "Limited", treatment: "regular" };
  }

  if (tcg === "MTG") {
    if (sub === "normal") return { version: "", treatment: "regular" };
    if (sub === "foil") return { version: "Foil", treatment: "foil" };
  }

  // Fallback: use the subTypeName as version
  return { version: subTypeName, treatment: subTypeName.toLowerCase() };
}

/**
 * Check if a product is sealed (non-card) based on empty extendedData.
 */
export function isSealed(product: TcgcsvProduct): boolean {
  return !product.extendedData || product.extendedData.length === 0;
}

/**
 * Infer sealed product type from product name.
 */
export function inferSealedProductType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("booster box")) return "BOOSTER_BOX";
  if (lower.includes("booster pack")) return "BOOSTER_PACK";
  if (lower.includes("starter deck")) return "STARTER_DECK";
  if (lower.includes("bundle")) return "BUNDLE";
  if (lower.includes("collection box")) return "COLLECTION_BOX";
  if (lower.includes("premium pack")) return "PREMIUM_PACK";
  return "OTHER";
}
