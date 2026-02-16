/**
 * Trend Explorer Pipeline Types
 *
 * All interfaces for the market trend / investment signal research pipeline.
 * These are research-time types for detecting price movements, search interest
 * spikes, and cross-signal correlations across TCGs.
 */

import type { TCG } from "./types";

// ── Trend Metric Identifiers ────────────────────────────────

/**
 * What kind of metric a data point represents.
 */
export type TrendMetric =
  | "market_price"       // TCGPlayer/Cardmarket market price (cents)
  | "low_price"          // Lowest listing price (cents)
  | "mid_price"          // Median listing price (cents)
  | "high_price"         // Highest listing price (cents)
  | "direct_low_price"   // TCGPlayer Direct low (cents)
  | "search_interest"    // Google Trends relative interest (0-100)
  | "reddit_mentions"    // Reddit mention count
  | "twitter_mentions"   // Twitter/X mention count
  | "listing_count"      // Number of active listings on marketplace
  | "sales_volume"       // Number of recent sales
  | "forum_activity"     // CardForum internal activity score
  | "price_spread"       // Spread between low and high (cents)
  | "foil_multiplier";   // Ratio of foil to normal price

/**
 * What level of the hierarchy a trend applies to.
 */
export type TrendEntityType =
  | "card"        // Individual card (e.g., OP01-001)
  | "set"         // Entire set (e.g., OP01)
  | "tcg"         // Entire TCG (e.g., onepiece)
  | "product"     // Sealed product (booster box, etc.)
  | "rarity";     // Rarity tier within a set

// ── Data Points ─────────────────────────────────────────────

/**
 * A single timestamped measurement.
 * The atomic unit of all trend data.
 */
export interface TrendDataPoint {
  /** ISO timestamp of when this measurement was taken */
  timestamp: string;
  /** The metric being measured */
  metric: TrendMetric;
  /** The measured value (meaning depends on metric) */
  value: number;
  /** Source that provided this measurement */
  source: string;
}

/**
 * A time series of data points for a specific entity + metric.
 */
export interface TrendTimeSeries {
  entityType: TrendEntityType;
  entityId: string;     // e.g., "OP01-001", "OP01", "onepiece"
  tcg: TCG;
  setCode?: string;
  metric: TrendMetric;
  points: TrendDataPoint[];
  /** Computed deltas from the latest point */
  deltas: TrendDeltas | null;
}

/**
 * Computed percentage changes from the latest data point.
 */
export interface TrendDeltas {
  /** Value at the latest data point */
  current: number;
  /** 1-day change as decimal (0.05 = +5%) */
  delta1d: number | null;
  /** 7-day change as decimal */
  delta7d: number | null;
  /** 30-day change as decimal */
  delta30d: number | null;
  /** 90-day change as decimal */
  delta90d: number | null;
  /** Absolute change over 7 days (in original units) */
  abs7d: number | null;
  /** Absolute change over 30 days */
  abs30d: number | null;
}

// ── Price Snapshot ───────────────────────────────────────────

/**
 * Price data for a single card at a specific point in time.
 */
export interface CardPriceSnapshot {
  cardId: string;
  name: string;
  rarity: string | null;
  /** All price variants (Normal, Foil, etc.) */
  variants: CardPriceVariant[];
}

export interface CardPriceVariant {
  subTypeName: string;   // "Normal", "Foil", "1st Edition Normal", etc.
  marketPrice: number | null;
  lowPrice: number | null;
  midPrice: number | null;
  highPrice: number | null;
  directLowPrice: number | null;
}

/**
 * Complete price snapshot for a set at a point in time.
 */
export interface SetPriceSnapshot {
  tcg: TCG;
  setCode: string;
  source: string;
  snapshotAt: string;
  cards: CardPriceSnapshot[];
  /** Aggregate stats */
  stats: {
    totalCards: number;
    cardsWithPrices: number;
    avgMarketPrice: number | null;
    medianMarketPrice: number | null;
    totalSetValue: number | null;
  };
}

/**
 * Price trend for a single card across snapshots.
 */
export interface CardPriceTrend {
  cardId: string;
  name: string;
  rarity: string | null;
  setCode: string;
  tcg: TCG;
  /** Primary variant (usually "Normal") trend data */
  trend: TrendDeltas | null;
  /** All variant trends keyed by subTypeName */
  variantTrends: Record<string, TrendDeltas>;
  /** Full time series for the primary variant */
  history: TrendDataPoint[];
}

/**
 * Price trends for an entire set.
 */
export interface SetPriceTrends {
  tcg: TCG;
  setCode: string;
  generatedAt: string;
  source: string;
  /** Number of snapshots used to compute trends */
  snapshotCount: number;
  /** Date range of snapshots */
  dateRange: { oldest: string; newest: string };
  /** Per-card trends */
  cards: CardPriceTrend[];
  /** Set-level aggregate trends */
  setTrend: TrendDeltas | null;
}

// ── Signals ─────────────────────────────────────────────────

/**
 * Signal classification for trend direction.
 */
export type SignalDirection =
  | "emerging"   // Early uptrend detected (search interest rising, price stable/rising)
  | "surging"    // Strong uptrend in progress (price + search both rising fast)
  | "peaking"    // At or near peak (price high, search interest declining)
  | "fading"     // Downtrend detected (both price and search declining)
  | "stable"     // No significant movement
  | "anomaly"    // Unusual pattern that doesn't fit normal classification
  | "recovering" // Bouncing back after a decline
  | "crashing";  // Rapid price decline

/**
 * Signal strength indicator (how confident we are).
 */
export type SignalStrength = "strong" | "moderate" | "weak";

/**
 * A detected trend signal for an entity.
 */
export interface TrendSignal {
  entityType: TrendEntityType;
  entityId: string;
  tcg: TCG;
  setCode?: string;
  direction: SignalDirection;
  strength: SignalStrength;
  /** Human-readable explanation */
  reason: string;
  /** Metrics that contributed to this signal */
  contributingMetrics: TrendMetric[];
  /** Confidence score 0-1 */
  confidence: number;
  /** When this signal was detected */
  detectedAt: string;
  /** Supporting data points */
  evidence: {
    metric: TrendMetric;
    value: number;
    delta: number;
    period: string;
  }[];
}

// ── Correlation ─────────────────────────────────────────────

/**
 * Cross-metric correlation result.
 * E.g., "search interest for OP01 correlates with price at lag=7 days"
 */
export interface TrendCorrelation {
  /** First metric in the pair */
  metricA: {
    metric: TrendMetric;
    entityId: string;
    entityType: TrendEntityType;
  };
  /** Second metric in the pair */
  metricB: {
    metric: TrendMetric;
    entityId: string;
    entityType: TrendEntityType;
  };
  /** Pearson correlation coefficient (-1 to 1) */
  pearsonR: number;
  /** Number of aligned data points used */
  sampleSize: number;
  /** Lag in days where correlation is strongest */
  bestLagDays: number;
  /** Correlations at various lags */
  lagCorrelations: { lagDays: number; pearsonR: number }[];
  /** Statistical significance */
  pValue: number | null;
  significant: boolean;
}

/**
 * Anomaly detection result for a time series.
 */
export interface TrendAnomaly {
  entityType: TrendEntityType;
  entityId: string;
  tcg: TCG;
  metric: TrendMetric;
  /** The anomalous data point */
  dataPoint: TrendDataPoint;
  /** Z-score of the anomaly */
  zScore: number;
  /** Direction: spike up or crash down */
  direction: "spike" | "crash";
  /** Context: what the normal range looks like */
  context: {
    mean: number;
    stdDev: number;
    windowDays: number;
  };
}

// ── Alerts ──────────────────────────────────────────────────

/**
 * Investment-oriented alert types.
 */
export type AlertType =
  | "price_spike"         // Sudden price increase
  | "price_crash"         // Sudden price decrease
  | "search_surge"        // Search interest spiking
  | "momentum_shift"      // Trend direction changed
  | "volume_anomaly"      // Unusual trading volume
  | "correlation_break"   // Previously correlated metrics diverging
  | "new_set_impact"      // New set release affecting existing set prices
  | "undervalued"         // Price below EV or historical average
  | "overvalued";         // Price significantly above historical average

export type AlertSeverity = "critical" | "high" | "medium" | "low";

export interface TrendAlert {
  type: AlertType;
  severity: AlertSeverity;
  entityType: TrendEntityType;
  entityId: string;
  tcg: TCG;
  setCode?: string;
  /** Human-readable title */
  title: string;
  /** Detailed explanation */
  description: string;
  /** Supporting signal */
  signal: TrendSignal;
  /** When this alert was generated */
  generatedAt: string;
  /** Investment action suggestion */
  action: "buy" | "hold" | "sell" | "watch" | "none";
}

// ── Reports ─────────────────────────────────────────────────

/**
 * Complete trend report for a set.
 */
export interface SetTrendReport {
  tcg: TCG;
  setCode: string;
  generatedAt: string;
  /** Top movers by percentage change */
  topMovers: {
    period: "1d" | "7d" | "30d";
    gainers: CardPriceTrend[];
    losers: CardPriceTrend[];
  }[];
  /** Detected signals */
  signals: TrendSignal[];
  /** Alerts generated */
  alerts: TrendAlert[];
  /** Cross-metric correlations */
  correlations: TrendCorrelation[];
  /** Anomalies found */
  anomalies: TrendAnomaly[];
  /** Set-level summary stats */
  summary: {
    totalCards: number;
    cardsWithTrends: number;
    avgDelta7d: number | null;
    avgDelta30d: number | null;
    setValueTrend: TrendDeltas | null;
    dominantSignal: SignalDirection;
  };
}

/**
 * Cross-set trend report for an entire TCG.
 */
export interface TcgTrendReport {
  tcg: TCG;
  generatedAt: string;
  sets: Array<{
    setCode: string;
    setValueTrend: TrendDeltas | null;
    dominantSignal: SignalDirection;
    topGainerCard: { cardId: string; name: string; delta7d: number } | null;
    topLoserCard: { cardId: string; name: string; delta7d: number } | null;
    alertCount: number;
  }>;
  /** TCG-wide signals */
  signals: TrendSignal[];
  /** TCG-wide alerts */
  alerts: TrendAlert[];
  /** Cross-set correlations */
  crossSetCorrelations: TrendCorrelation[];
}

// ── Signal Source Configuration ─────────────────────────────

/**
 * Cost tier for API usage.
 */
export type CostTier = "free" | "freemium" | "paid";

/**
 * Configuration for a signal data source.
 */
export interface SignalSourceConfig {
  name: string;
  /** Unique identifier for this source */
  id: string;
  /** What metrics this source can provide */
  metrics: TrendMetric[];
  /** What entity types this source covers */
  entityTypes: TrendEntityType[];
  /** API endpoint or base URL */
  endpoint: string;
  /** Authentication method */
  auth: "none" | "api_key" | "bearer" | "proxy";
  /** Environment variable name for the API key */
  authEnvVar?: string;
  /** Rate limit */
  rateLimit: { requests: number; perSeconds: number };
  /** Cost tier */
  costTier: CostTier;
  /** Whether this source is currently enabled */
  enabled: boolean;
  /** TCGs this source covers */
  tcgs: TCG[];
  /** Priority (lower = preferred) */
  priority: number;
  /** Refresh interval in seconds */
  refreshIntervalSeconds: number;
}

// ── Pipeline Progress ───────────────────────────────────────

export type TrendPipelineStage =
  | "fetch_prices"
  | "fetch_search"
  | "correlate"
  | "report";

export interface TrendPipelineProgress {
  tcg: TCG;
  setCode: string;
  completedStages: Record<TrendPipelineStage, { completedAt: string } | null>;
  lastUpdated: string;
  errors: Array<{ stage: TrendPipelineStage; error: string; at: string }>;
}
