/**
 * Pull Rate Pipeline Types
 *
 * All interfaces for the sealed-product pull rate / drop rate research pipeline.
 * These are research-time types for computing booster box expected values.
 */

import type { TCG } from "./types";

// ── Product Types ─────────────────────────────────────────────

export type BoosterProductType =
  | "booster_pack"
  | "booster_box"
  | "draft_booster"
  | "set_booster"
  | "play_booster"
  | "collector_booster"
  | "op_booster" // One Piece standard booster
  | "eb_booster" // One Piece extra booster
  | "prb_booster" // One Piece premium booster
  | "core_booster" // Yu-Gi-Oh core set booster
  | "sv_booster"; // Pokemon Scarlet & Violet era booster

export type BoxLanguage = "EN" | "JP" | "KR" | "CN" | "DE" | "FR" | "IT" | "ES" | "PT";

// ── Rarity Tiers ──────────────────────────────────────────────

/**
 * Canonical rarity tier hierarchy per TCG.
 * Ordered from most common (index 0) to rarest (last index).
 */
export const RARITY_TIERS: Record<TCG, string[]> = {
  onepiece: ["C", "UC", "R", "SR", "SEC", "L", "SP", "DON", "MANGA", "TREASURE"],
  pokemon: [
    "C",
    "UC",
    "R",
    "RH",
    "H",
    "RR",
    "V",
    "VMAX",
    "VSTAR",
    "EX",
    "IR",
    "SAR",
    "SR",
    "UR",
    "HYP",
    "SIR",
    "SAR",
    "ACE",
    "SHR",
  ],
  yugioh: [
    "C",
    "R",
    "SR",
    "UR",
    "SCRT",
    "ULTR",
    "GHOST",
    "STARLIGHT",
    "COLLECTORS",
    "QCR",
    "PRISMATIC",
  ],
  mtg: ["C", "UC", "R", "MR", "SPECIAL", "BONUS"],
};

/**
 * Maps source-specific rarity strings to canonical tier.
 * Keys are lowercased source strings.
 */
export const RARITY_NORMALIZERS: Record<TCG, Record<string, string>> = {
  onepiece: {
    common: "C",
    c: "C",
    uncommon: "UC",
    uc: "UC",
    u: "UC",
    rare: "R",
    r: "R",
    "super rare": "SR",
    sr: "SR",
    "secret rare": "SEC",
    sec: "SEC",
    leader: "L",
    l: "L",
    special: "SP",
    sp: "SP",
    don: "DON",
    "don!!": "DON",
    "manga rare": "MANGA",
    "treasure rare": "TREASURE",
    tr: "TREASURE",
    // TCGPlayer uses same abbreviations
    promo: "SP",
  },
  pokemon: {
    common: "C",
    c: "C",
    uncommon: "UC",
    uc: "UC",
    u: "UC",
    rare: "R",
    r: "R",
    "rare holo": "H",
    "holo rare": "H",
    "rare holo v": "V",
    v: "V",
    "rare holo vmax": "VMAX",
    vmax: "VMAX",
    "rare holo vstar": "VSTAR",
    vstar: "VSTAR",
    "double rare": "RR",
    rr: "RR",
    "ultra rare": "UR",
    ur: "UR",
    "illustration rare": "IR",
    ir: "IR",
    "special art rare": "SAR",
    sar: "SAR",
    "super rare": "SR",
    sr: "SR",
    "hyper rare": "HYP",
    hyp: "HYP",
    "special illustration rare": "SIR",
    sir: "SIR",
    "ace spec rare": "ACE",
    ace: "ACE",
    "shiny rare": "SHR",
    "rare ultra": "UR",
    "rare secret": "SR",
    "rare rainbow": "HYP",
    "rare holo ex": "EX",
    ex: "EX",
    "reverse holo": "RH",
    promo: "R",
  },
  yugioh: {
    common: "C",
    c: "C",
    rare: "R",
    r: "R",
    "super rare": "SR",
    sr: "SR",
    super: "SR",
    "ultra rare": "UR",
    ur: "UR",
    ultra: "UR",
    "secret rare": "SCRT",
    scrt: "SCRT",
    secret: "SCRT",
    "ultimate rare": "ULTR",
    ultr: "ULTR",
    ultimate: "ULTR",
    "ghost rare": "GHOST",
    ghost: "GHOST",
    "starlight rare": "STARLIGHT",
    starlight: "STARLIGHT",
    "collector's rare": "COLLECTORS",
    "collectors rare": "COLLECTORS",
    "quarter century secret rare": "QCR",
    qcr: "QCR",
    "prismatic secret rare": "PRISMATIC",
    prismatic: "PRISMATIC",
    "short print": "C", // short prints are commons with lower weight
  },
  mtg: {
    common: "C",
    c: "C",
    uncommon: "UC",
    uc: "UC",
    u: "UC",
    rare: "R",
    r: "R",
    mythic: "MR",
    "mythic rare": "MR",
    mr: "MR",
    m: "MR",
    special: "SPECIAL",
    bonus: "BONUS",
  },
};

/**
 * Normalize a rarity string from any source to canonical tier.
 */
export function normalizeRarity(tcg: TCG, rawRarity: string): string | null {
  const key = rawRarity.toLowerCase().trim();
  return RARITY_NORMALIZERS[tcg][key] ?? null;
}

// ── Pull Rate Sheet (ala MTGJSON BoosterSheet) ────────────────

/**
 * A pool of cards that a pack slot draws from.
 * Each entry has a card identifier and a weight (for weighted random).
 */
export interface PullRateSheet {
  name: string;
  /** Total weight of all entries (sum of cardWeights values). Auto-calculated if omitted. */
  totalWeight?: number;
  /** If true, foil/premium treatment applied to cards drawn from this sheet */
  foil?: boolean;
  /**
   * Card weights keyed by rarity tier (not individual cards).
   * e.g., { "C": 100, "UC": 50, "R": 20, "SR": 5, "SEC": 1 }
   * Used when we don't have per-card weights but know rarity distribution.
   */
  rarityWeights: Record<string, number>;
  /**
   * Optional: per-card weights for TCGs with short prints (Yu-Gi-Oh).
   * cardId → weight. Overrides rarityWeights for specific cards.
   */
  cardWeights?: Record<string, number>;
}

/**
 * One slot in a booster pack — draws N cards from a sheet.
 */
export interface PackSlot {
  /** Human-readable slot name, e.g., "common_slot", "rare_slot" */
  name: string;
  /** How many cards this slot draws */
  count: number;
  /** Which sheet to draw from */
  sheetName: string;
  /** If true, this slot is guaranteed (not random) */
  guaranteed: boolean;
  /** Probability this slot appears in the pack (1.0 if always present) */
  probability: number;
  /** Group for mutually exclusive slots (e.g., "rare_plus" group where SR replaces R) */
  slotGroup?: string;
}

/**
 * One specific pack configuration with a probability weight.
 * E.g., "standard" pack (99%) vs "god pack" (1%).
 */
export interface PackVariant {
  name: string;
  /** Probability weight (relative, not necessarily normalized to 1.0) */
  weight: number;
  slots: PackSlot[];
}

/**
 * Full pack configuration: all variants + all sheets.
 */
export interface PackConfig {
  cardsPerPack: number;
  variants: PackVariant[];
  sheets: Record<string, PullRateSheet>;
}

/**
 * Guarantees at the box level (e.g., "at least 1 SR per box").
 */
export interface BoxGuarantee {
  rarity: string;
  minPerBox: number;
  /** If true, this replaces rather than supplements the per-pack math */
  overridePackMath: boolean;
}

/**
 * Top-level box configuration for a specific product.
 */
export interface BoxConfig {
  tcg: TCG;
  setCode: string;
  language: BoxLanguage;
  productType: BoosterProductType;
  packsPerBox: number;
  packConfig: PackConfig;
  boxGuarantees: BoxGuarantee[];
  /** Provenance */
  source: {
    name: string;
    url?: string;
    reliability: "high" | "medium" | "low";
    notes?: string;
  };
}

// ── Computed Outputs ──────────────────────────────────────────

/**
 * Card counts per rarity tier for a set/language.
 */
export interface RarityDistribution {
  tcg: TCG;
  setCode: string;
  language: BoxLanguage;
  /** rarity tier → count of unique cards */
  counts: Record<string, number>;
  /** rarity tier → list of card IDs */
  cardIds: Record<string, string[]>;
  /** Total unique cards (excluding parallels/variants) */
  totalUniqueCards: number;
  /** Source of the data */
  source: string;
  generatedAt: string;
}

/**
 * Computed pull rate for a single rarity tier.
 */
export interface PullRate {
  rarity: string;
  /** Expected number of cards of this rarity per pack */
  perPack: number;
  /** Expected number of cards of this rarity per box */
  perBox: number;
  /** Probability of pulling at least one card of this rarity in a single pack */
  packProbability: number;
  /** Probability of pulling at least one card of this rarity in a box */
  boxProbability: number;
  /** Expected copies of a specific card of this rarity per box */
  perSpecificCardPerBox: number;
  /** Number of unique cards at this rarity in the set */
  uniqueCards: number;
}

/**
 * Full pull rate report for a set + product + language.
 */
export interface PullRateReport {
  tcg: TCG;
  setCode: string;
  language: BoxLanguage;
  productType: BoosterProductType;
  packsPerBox: number;
  rates: PullRate[];
  /** Map of rarity → PullRate for quick lookup */
  ratesByRarity: Record<string, PullRate>;
  generatedAt: string;
  source: string;
}

/**
 * Per-rarity EV contribution.
 */
export interface EVBreakdown {
  rarity: string;
  expectedPerBox: number;
  avgCardPrice: number;
  medianCardPrice: number;
  evContribution: number;
  /** Percentage of total box EV from this rarity */
  evShare: number;
}

/**
 * Full expected value report for a set/product/language.
 */
export interface EVReport {
  tcg: TCG;
  setCode: string;
  language: BoxLanguage;
  productType: BoosterProductType;
  priceCurrency: string;
  priceSource: string;
  boxPriceCents: number | null;
  totalEVCents: number;
  evRatio: number | null;
  breakdown: EVBreakdown[];
  generatedAt: string;
}

// ── Validation ────────────────────────────────────────────────

export interface ValidationSource {
  name: string;
  url?: string;
  sampleSize?: number;
  methodology?: string;
}

export interface ValidationResult {
  rarity: string;
  theoreticalRate: number;
  observedRate: number | null;
  deviation: number | null;
  /** p-value from chi-squared or binomial test */
  pValue: number | null;
  significant: boolean;
}

export interface PullRateValidation {
  tcg: TCG;
  setCode: string;
  language: BoxLanguage;
  productType: BoosterProductType;
  sources: ValidationSource[];
  results: ValidationResult[];
  overallAssessment: "confirmed" | "plausible" | "suspicious" | "rejected" | "insufficient_data";
  generatedAt: string;
}

// ── Pipeline Progress ─────────────────────────────────────────

export type PipelineStage = "distribution" | "compute" | "validate" | "ev" | "report";

export interface PipelineProgress {
  tcg: TCG;
  setCode: string;
  completedStages: Record<PipelineStage, { completedAt: string } | null>;
  lastUpdated: string;
  errors: Array<{ stage: PipelineStage; error: string; at: string }>;
}
