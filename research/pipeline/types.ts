/**
 * Research Pipeline Types
 *
 * Types for the TCG cataloging research pipeline.
 * These are research-time types, NOT the production schema.
 */

// ── Supported TCGs ──────────────────────────────────────────────

export type TCG = "pokemon" | "yugioh" | "onepiece" | "mtg";

// ── Raw Data from Sources ───────────────────────────────────────

export interface RawCardData {
  source: DataSource;
  tcg: TCG;
  fetchedAt: string;
  rawJson: unknown;
}

export interface DataSource {
  name: string;
  type: "api" | "scrape";
  url: string;
  reliability: "high" | "medium" | "low";
  rateLimit?: { requests: number; perSeconds: number };
}

// ── Normalized Research Output ──────────────────────────────────

export interface ResearchSet {
  tcg: TCG;
  code: string;
  name: string;
  nameJp?: string;
  releaseDate?: string;
  releaseDateJp?: string;
  totalCards: number;
  region: "global" | "jp" | "en" | "asia";
  /** JP sets that map to this EN set (Pokemon often merges JP sets) */
  jpEquivalents?: string[];
}

export interface ResearchCard {
  tcg: TCG;
  /** Unique canonical ID within the TCG (e.g., Scryfall oracle_id for MTG) */
  canonicalId?: string;
  name: string;
  nameJp?: string;
  setCode: string;
  number: string;
  rarity: string;
  /** All known variants/printings of this card */
  variants: ResearchVariant[];
}

export interface ResearchVariant {
  /** The specific printing ID from the source */
  sourceId: string;
  source: string;
  setCode: string;
  number: string;
  rarity: string;
  treatment: string; // "regular", "holofoil", "full_art", "alt_art", etc.
  language: string; // ISO 639-1
  /** Is this variant functionally identical to the base card for gameplay? */
  gameplayEquivalent: boolean;
  /** Is this variant considered fungible for trading? */
  tradingFungible: boolean;
  imageUrl?: string;
}

// ── Fungibility Model ───────────────────────────────────────────

/**
 * Fungibility levels for the bridge trading engine.
 * Two cards are fungible at a given level if they can be swapped
 * in a bridge trade without either party caring.
 */
export type FungibilityLevel =
  | "exact" // Same card, same variant, same language, same condition
  | "variant" // Same card, different variant (e.g., holo vs regular)
  | "language" // Same card, same variant, different language
  | "printing" // Same card, different set/printing
  | "none"; // Not fungible

export interface FungibilityRule {
  tcg: TCG;
  /** What dimensions must match for two cards to be fungible */
  dimensions: {
    name: boolean; // Must have same card name
    setCode: boolean; // Must be from same set
    number: boolean; // Must have same collector number
    rarity: boolean; // Must have same rarity
    treatment: boolean; // Must have same treatment (foil, etc.)
    language: boolean; // Must be same language
    edition: boolean; // Must be same edition (1st ed vs unlimited)
  };
  level: FungibilityLevel;
}

// ── Pipeline Configuration ──────────────────────────────────────

export interface PipelineConfig {
  brightData: {
    apiKey: string;
    zone: string;
  };
  outputDir: string;
  tcgs: TCG[];
  /** Max concurrent requests */
  concurrency: number;
  /** Delay between requests in ms */
  delayMs: number;
}

export interface FetchResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  source: string;
  url: string;
  fetchedAt: string;
  durationMs: number;
}

// ── Research Report ─────────────────────────────────────────────

export interface ResearchReport {
  tcg: TCG;
  generatedAt: string;
  sets: ResearchSet[];
  sampleCards: ResearchCard[];
  variantTypes: string[];
  languages: string[];
  sources: DataSource[];
  findings: string[];
  openQuestions: string[];
}
