/**
 * Trend Signal Source Registry
 *
 * Configuration for all data sources that feed the trend explorer.
 * Like pullrates-box-structures.ts but for signal sources instead of box structures.
 *
 * Sources are organized by cost tier:
 *   Free:     TCGCSV (prices), CardForum internal
 *   Freemium: Google Trends (via BrightData scrape), Reddit API
 *   Paid:     SerpApi (Google Trends), Twitter API v2
 *
 * Usage:
 *   import { TREND_SOURCES, getEnabledSources, TCG_TREND_KEYWORDS } from "./trends-sources";
 */

import type { TCG } from "./types";
import type { SignalSourceConfig, TrendMetric, CostTier } from "./trends-types";

// ── Source Registry ─────────────────────────────────────────

/**
 * All known signal sources with their configuration.
 * Priority determines fallback order (lower = preferred).
 */
export const TREND_SOURCES: SignalSourceConfig[] = [
  // ─── Free Sources ───────────────────────────────────────
  {
    id: "tcgcsv",
    name: "TCGCSV (TCGPlayer Proxy)",
    metrics: ["market_price", "low_price", "mid_price", "high_price", "direct_low_price"],
    entityTypes: ["card", "set"],
    endpoint: "https://tcgcsv.com",
    auth: "none",
    rateLimit: { requests: 1, perSeconds: 1 },
    costTier: "free",
    enabled: true,
    tcgs: ["onepiece", "pokemon", "yugioh", "mtg"],
    priority: 1,
    refreshIntervalSeconds: 86400, // Daily
  },
  {
    id: "cardforum_internal",
    name: "CardForum Internal Metrics",
    metrics: ["listing_count", "forum_activity"],
    entityTypes: ["card", "set", "tcg"],
    endpoint: "/api/internal/trends",
    auth: "bearer",
    authEnvVar: "CARDFORUM_API_KEY",
    rateLimit: { requests: 100, perSeconds: 60 },
    costTier: "free",
    enabled: false, // Enable when CardForum has enough activity data
    tcgs: ["onepiece", "pokemon", "yugioh", "mtg"],
    priority: 2,
    refreshIntervalSeconds: 3600, // Hourly
  },

  // ─── Freemium Sources ───────────────────────────────────
  {
    id: "google_trends_scrape",
    name: "Google Trends (BrightData Scrape)",
    metrics: ["search_interest"],
    entityTypes: ["card", "set", "tcg"],
    endpoint: "https://trends.google.com/trends/api/dailytrends",
    auth: "proxy",
    authEnvVar: "BRIGHT_DATA_API_KEY",
    rateLimit: { requests: 10, perSeconds: 60 },
    costTier: "freemium",
    enabled: false, // Enable when BrightData is configured
    tcgs: ["onepiece", "pokemon", "yugioh", "mtg"],
    priority: 3,
    refreshIntervalSeconds: 86400, // Daily
  },
  {
    id: "reddit",
    name: "Reddit API",
    metrics: ["reddit_mentions"],
    entityTypes: ["set", "tcg"],
    endpoint: "https://oauth.reddit.com",
    auth: "bearer",
    authEnvVar: "REDDIT_ACCESS_TOKEN",
    rateLimit: { requests: 60, perSeconds: 60 },
    costTier: "freemium",
    enabled: false,
    tcgs: ["onepiece", "pokemon", "yugioh", "mtg"],
    priority: 4,
    refreshIntervalSeconds: 3600, // Hourly
  },

  // ─── Paid Sources ───────────────────────────────────────
  {
    id: "serpapi_google_trends",
    name: "SerpApi Google Trends",
    metrics: ["search_interest"],
    entityTypes: ["card", "set", "tcg"],
    endpoint: "https://serpapi.com/search.json",
    auth: "api_key",
    authEnvVar: "SERPAPI_KEY",
    rateLimit: { requests: 100, perSeconds: 3600 },
    costTier: "paid",
    enabled: false,
    tcgs: ["onepiece", "pokemon", "yugioh", "mtg"],
    priority: 5,
    refreshIntervalSeconds: 86400, // Daily
  },
  {
    id: "twitter",
    name: "Twitter/X API v2",
    metrics: ["twitter_mentions"],
    entityTypes: ["set", "tcg"],
    endpoint: "https://api.twitter.com/2",
    auth: "bearer",
    authEnvVar: "TWITTER_BEARER_TOKEN",
    rateLimit: { requests: 300, perSeconds: 900 },
    costTier: "paid",
    enabled: false,
    tcgs: ["onepiece", "pokemon", "yugioh", "mtg"],
    priority: 6,
    refreshIntervalSeconds: 3600, // Hourly
  },
];

// ── Source Lookup Functions ──────────────────────────────────

/**
 * Get all enabled sources for a given TCG.
 * Returns sources sorted by priority (lowest = best).
 */
export function getEnabledSources(tcg: TCG): SignalSourceConfig[] {
  return TREND_SOURCES
    .filter((s) => s.enabled && s.tcgs.includes(tcg))
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Get the best available source for a specific metric + TCG.
 * Respects priority and enabled state.
 */
export function getBestSource(metric: TrendMetric, tcg: TCG): SignalSourceConfig | null {
  return TREND_SOURCES
    .filter((s) => s.enabled && s.tcgs.includes(tcg) && s.metrics.includes(metric))
    .sort((a, b) => a.priority - b.priority)[0] ?? null;
}

/**
 * Get all sources that provide a given metric, regardless of enabled state.
 */
export function getSourcesForMetric(metric: TrendMetric): SignalSourceConfig[] {
  return TREND_SOURCES
    .filter((s) => s.metrics.includes(metric))
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Get source by ID.
 */
export function getSourceById(id: string): SignalSourceConfig | null {
  return TREND_SOURCES.find((s) => s.id === id) ?? null;
}

/**
 * Check if a source's API key is configured in the environment.
 */
export function isSourceConfigured(source: SignalSourceConfig): boolean {
  if (source.auth === "none") return true;
  if (!source.authEnvVar) return false;
  return !!process.env[source.authEnvVar];
}

/**
 * Get all sources grouped by cost tier.
 */
export function getSourcesByCostTier(): Record<CostTier, SignalSourceConfig[]> {
  const result: Record<CostTier, SignalSourceConfig[]> = {
    free: [],
    freemium: [],
    paid: [],
  };
  for (const source of TREND_SOURCES) {
    result[source.costTier].push(source);
  }
  return result;
}

// ── TCG Search Keywords ─────────────────────────────────────

/**
 * Keywords for Google Trends / social media searches.
 * Hierarchical: TCG-level → set-level → card-level.
 *
 * TCG-level keywords track overall game health.
 * Set-level keywords track release hype and demand.
 * Card-level keywords track individual chase card demand.
 */
export const TCG_TREND_KEYWORDS: Record<TCG, {
  /** TCG-wide search terms */
  tcgKeywords: string[];
  /** Set-level keywords keyed by set code */
  setKeywords: Record<string, string[]>;
  /** High-value card keywords keyed by cardId */
  cardKeywords: Record<string, string[]>;
}> = {
  onepiece: {
    tcgKeywords: [
      "one piece card game",
      "one piece tcg",
      "one piece cards",
      "opcg",
    ],
    setKeywords: {
      OP01: ["one piece romance dawn", "op01 cards"],
      OP02: ["one piece paramount war", "op02 cards"],
      OP03: ["one piece pillars of strength", "op03 cards"],
      OP04: ["one piece kingdoms of intrigue", "op04 cards"],
      OP05: ["one piece awakening new era", "op05 cards"],
      OP06: ["one piece wings of the captain", "op06 cards"],
      OP07: ["one piece 500 years future", "op07 cards"],
      OP08: ["one piece two legends", "op08 cards"],
      OP09: ["one piece emperors new world", "op09 cards"],
      OP10: ["one piece royal blood", "op10 cards"],
      OP11: ["one piece fist divine speed", "op11 cards"],
      OP12: ["one piece legacy master", "op12 cards"],
      OP13: ["one piece carrying will", "op13 cards"],
      OP14: ["one piece azure sea seven", "op14 cards"],
    },
    cardKeywords: {
      // Chase cards — update as market evolves
      "OP01-120": ["shanks op01 secret rare", "shanks one piece card"],
      "OP02-120": ["ace op02 manga", "ace one piece card game"],
      "OP04-112": ["yamato op04 secret", "yamato one piece card"],
    },
  },
  pokemon: {
    tcgKeywords: [
      "pokemon cards",
      "pokemon tcg",
      "pokemon card game",
      "pokemon cards value",
    ],
    setKeywords: {
      // Populate per active sets
    },
    cardKeywords: {
      // Populate per chase cards
    },
  },
  yugioh: {
    tcgKeywords: [
      "yugioh cards",
      "yu-gi-oh tcg",
      "yugioh card game",
      "yugioh card prices",
    ],
    setKeywords: {},
    cardKeywords: {},
  },
  mtg: {
    tcgKeywords: [
      "magic the gathering",
      "mtg cards",
      "magic cards",
      "mtg prices",
    ],
    setKeywords: {},
    cardKeywords: {},
  },
};

/**
 * Get all keywords for a TCG + optional set + optional card.
 * Returns a flat list of search terms for Google Trends queries.
 */
export function getKeywords(
  tcg: TCG,
  setCode?: string,
  cardId?: string,
): string[] {
  const config = TCG_TREND_KEYWORDS[tcg];
  const keywords: string[] = [...config.tcgKeywords];

  if (setCode && config.setKeywords[setCode]) {
    keywords.push(...config.setKeywords[setCode]);
  }

  if (cardId && config.cardKeywords[cardId]) {
    keywords.push(...config.cardKeywords[cardId]);
  }

  return keywords;
}

// ── Reddit Subreddits ───────────────────────────────────────

/**
 * Subreddits to monitor for each TCG.
 */
export const TCG_SUBREDDITS: Record<TCG, string[]> = {
  onepiece: ["OnePieceTCG", "OnePieceCard"],
  pokemon: ["PokemonTCG", "pkmntcgcollections", "pokemoncardvalue"],
  yugioh: ["yugioh", "YuGiOhMasterDuel", "YuGiOhMarketplace"],
  mtg: ["magicTCG", "mtgfinance", "magicTCGmarketplace"],
};

// ── TCGCSV Category Mapping ─────────────────────────────────

/**
 * Re-export TCGCSV category IDs for the price fetcher.
 * Matches tcgplayer-types.ts but uses lowercase TCG keys.
 */
export const TCGCSV_CATEGORIES: Record<TCG, number> = {
  onepiece: 68,
  pokemon: 3,
  yugioh: 2,
  mtg: 1,
};

// ── Set Code Discovery ────────────────────────────────────────

const TCG_DIR_MAP: Record<TCG, string> = {
  onepiece: "onepiece",
  pokemon: "pokemon",
  yugioh: "yugioh",
  mtg: "mtg",
};

/**
 * Get available set codes from existing TCGPlayer JSON files.
 * Scans research/{tcg}/ for tcgplayer-{code}.json files.
 */
export function getAvailableSetCodes(tcg: TCG): string[] {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const dir = path.join(process.cwd(), "research", TCG_DIR_MAP[tcg]);
  if (!fs.existsSync(dir)) return [];

  const prefix = "tcgplayer-";
  return fs.readdirSync(dir)
    .filter((f: string) =>
      f.startsWith(prefix) &&
      f.endsWith(".json") &&
      !f.includes("groups") &&
      !f.includes("progress") &&
      !f.includes("summary"),
    )
    .map((f: string) => f.replace(prefix, "").replace(".json", "").toUpperCase());
}
