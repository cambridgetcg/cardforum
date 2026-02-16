import { db } from "@/lib/db";
import * as defaults from "@/lib/constants";

// ─── Types ──────────────────────────────────────────────

type ConfigCategory = "fees" | "thresholds" | "matching" | "kyc" | "shipping" | "authenticator" | "rating" | "ccs" | "digital" | "calibration" | "general";

/** All known config keys with their types. Add new keys here. */
export interface ConfigKeys {
  // Fees
  "fees.platform_rate": number;
  "fees.digital_platform_rate": number;
  "fees.digitiser_royalty_rate": number;
  "fees.min_deposit_cents": number;
  "fees.max_deposit_cents": number;
  "fees.min_withdrawal_cents": number;

  // Authenticator fees (per-tier)
  "authenticator.fee_structure": Record<string, { baseFee: number; platformPercent: number }>;
  "authenticator.tier_promotion_thresholds": typeof defaults.TIER_PROMOTION_THRESHOLDS;
  "authenticator.random_audit_frequency": Record<string, number>;
  "authenticator.reserve_timeout_hours": number;
  "authenticator.ship_sla_hours": number;
  "authenticator.ship_warning_hours": number;
  "authenticator.ship_escalation_hours": number;
  "authenticator.dispute_demotion_window_days": number;
  "authenticator.dispute_demotion_threshold": number;
  "authenticator.inactivity_demotion_days": number;

  // Photo approval
  "thresholds.photo_approval_cents": number;
  "thresholds.max_photo_count": number;
  "thresholds.max_photo_size_bytes": number;
  "thresholds.max_photo_attempts": number;
  "thresholds.photo_trust_min_agreement_rate": number;
  "thresholds.photo_trust_min_comparisons": number;

  // Shipping
  "shipping.insurance_threshold_cents": number;
  "shipping.signature_threshold_cents": number;
  "shipping.dead_letter_retention_days": number;
  "shipping.auto_complete_days": number;
  "shipping.direct_trade_deadline_days": number;
  "shipping.international_base_cost_cents": number;
  "shipping.international_insurance_rate": number;
  "shipping.international_insurance_min_cents": number;

  // KYC
  "kyc.basic_listing_cap_cents": number;
  "kyc.basic_trade_cap_cents": number;
  "kyc.max_document_size_bytes": number;
  "kyc.presigned_url_expiry_seconds": number;
  "kyc.document_retention_years": number;

  // Rating
  "rating.component_weights": Record<string, number>;
  "rating.decay_weights": Record<string, number>;

  // CCS
  "ccs.dimension_weights": Record<string, number>;
  "ccs.min_cap_threshold": number;
  "ccs.tier_boundaries": Record<string, { min: number }>;
  "ccs.sub_tier_boundaries": Record<string, { min: number; max: number }>;

  // Matching
  "matching.max_cycle_depth": number;
  "matching.max_packed": number;
  "matching.proposal_expiry_days": number;
  "matching.scorer_weights": Record<string, number | Record<string, number>>;
  "matching.trust_bonus_weight": number; // per-point bonus for participant trust (Loop 6)

  // Digital
  "digital.redemption_base_fee_cents": number;
  "digital.cross_zone_surcharge_cents": number;

  // Calibration
  "calibration.drift_threshold": number;
  "calibration.outlier_delta_threshold": number;
  "calibration.outlier_min_samples": number;
  "calibration.min_sample_size": number;
  "calibration.recent_window_days": number;
  "calibration.baseline_window_days": number;
  "calibration.extreme_delta_threshold": number;
  "calibration.agreement_threshold": number;
}

export type ConfigKey = keyof ConfigKeys;

// ─── Default Values ─────────────────────────────────────
// These are the fallback values when a key is not in the DB.
// They match the current compile-time constants exactly.

const CONFIG_DEFAULTS: Record<ConfigKey, unknown> = {
  "fees.platform_rate": defaults.PLATFORM_FEE_RATE,
  "fees.digital_platform_rate": defaults.DIGITAL_TRADE_PLATFORM_FEE_RATE,
  "fees.digitiser_royalty_rate": defaults.DIGITISER_ROYALTY_RATE,
  "fees.min_deposit_cents": defaults.MIN_DEPOSIT_CENTS,
  "fees.max_deposit_cents": defaults.MAX_DEPOSIT_CENTS,
  "fees.min_withdrawal_cents": defaults.MIN_WITHDRAWAL_CENTS,

  "authenticator.fee_structure": defaults.AUTHENTICATOR_FEE_STRUCTURE,
  "authenticator.tier_promotion_thresholds": defaults.TIER_PROMOTION_THRESHOLDS,
  "authenticator.random_audit_frequency": defaults.RANDOM_AUDIT_FREQUENCY,
  "authenticator.reserve_timeout_hours": defaults.RESERVE_ACCEPTANCE_TIMEOUT_HOURS,
  "authenticator.ship_sla_hours": defaults.AUTHENTICATOR_SHIP_SLA_HOURS,
  "authenticator.ship_warning_hours": defaults.AUTHENTICATOR_SHIP_WARNING_HOURS,
  "authenticator.ship_escalation_hours": defaults.AUTHENTICATOR_SHIP_ESCALATION_HOURS,
  "authenticator.dispute_demotion_window_days": 30,
  "authenticator.dispute_demotion_threshold": 3,
  "authenticator.inactivity_demotion_days": 90,

  "thresholds.photo_approval_cents": defaults.PHOTO_APPROVAL_THRESHOLD_CENTS,
  "thresholds.max_photo_count": defaults.MAX_PHOTO_COUNT,
  "thresholds.max_photo_size_bytes": defaults.MAX_PHOTO_SIZE_BYTES,
  "thresholds.max_photo_attempts": defaults.MAX_PHOTO_ATTEMPTS,
  "thresholds.photo_trust_min_agreement_rate": defaults.PHOTO_TRUST_MIN_AGREEMENT_RATE,
  "thresholds.photo_trust_min_comparisons": defaults.PHOTO_TRUST_MIN_COMPARISONS,

  "shipping.insurance_threshold_cents": defaults.SHIPPING_INSURANCE_THRESHOLD_CENTS,
  "shipping.signature_threshold_cents": defaults.SHIPPING_SIGNATURE_THRESHOLD_CENTS,
  "shipping.dead_letter_retention_days": defaults.DEAD_LETTER_RETENTION_DAYS,
  "shipping.auto_complete_days": defaults.AUTO_COMPLETE_DELIVERY_DAYS,
  "shipping.direct_trade_deadline_days": defaults.DIRECT_TRADE_SHIPPING_DEADLINE_DAYS,
  "shipping.international_base_cost_cents": defaults.INTERNATIONAL_BASE_COST_CENTS,
  "shipping.international_insurance_rate": defaults.INTERNATIONAL_INSURANCE_RATE,
  "shipping.international_insurance_min_cents": defaults.INTERNATIONAL_INSURANCE_MIN_CENTS,

  "kyc.basic_listing_cap_cents": defaults.KYC_BASIC_LISTING_CAP_CENTS,
  "kyc.basic_trade_cap_cents": defaults.KYC_BASIC_TRADE_CAP_CENTS,
  "kyc.max_document_size_bytes": defaults.KYC_MAX_DOCUMENT_SIZE_BYTES,
  "kyc.presigned_url_expiry_seconds": defaults.KYC_PRESIGNED_URL_EXPIRY_SECONDS,
  "kyc.document_retention_years": defaults.KYC_DOCUMENT_RETENTION_YEARS,

  "rating.component_weights": defaults.RATING_COMPONENT_WEIGHTS,
  "rating.decay_weights": { last90Days: 0.6, days91to180: 0.3, lifetime: 0.1 },

  "ccs.dimension_weights": defaults.CCS_DIMENSION_WEIGHTS,
  "ccs.min_cap_threshold": defaults.CCS_MIN_CAP_THRESHOLD,
  "ccs.tier_boundaries": defaults.CCS_TIER_BOUNDARIES,
  "ccs.sub_tier_boundaries": defaults.CCS_SUB_TIER_BOUNDARIES,

  "matching.max_cycle_depth": 6,
  "matching.max_packed": 50,
  "matching.proposal_expiry_days": 7,
  "matching.scorer_weights": {
    baseScore: 100,
    cycleLengthPenalty: -10,
    fullyLocalBonus: 30,
    fewRegionsBonus: 15,
    conditionBonus: { NM: 5, LP: 4, MP: 3, HP: 2, DMG: 1 },
    valueBalanceBonus: 20,
    regionalImbalancePenalty: -25,
    chainBonus: 10,
    gradeMatchBonus: 5,
  },

  "matching.trust_bonus_weight": 0.1, // 0.1 score per trust point (max +10 at trust=100)

  "digital.redemption_base_fee_cents": defaults.REDEMPTION_BASE_FEE_CENTS,
  "digital.cross_zone_surcharge_cents": defaults.CROSS_ZONE_SURCHARGE_CENTS,

  "calibration.drift_threshold": 0.5,
  "calibration.outlier_delta_threshold": 2.0,
  "calibration.outlier_min_samples": 5,
  "calibration.min_sample_size": 10,
  "calibration.recent_window_days": 30,
  "calibration.baseline_window_days": 180,
  "calibration.extreme_delta_threshold": 3.0,
  "calibration.agreement_threshold": 1.0,
};

// Category derived from key prefix
function categoryFromKey(key: ConfigKey): ConfigCategory {
  const prefix = key.split(".")[0];
  const map: Record<string, ConfigCategory> = {
    fees: "fees",
    authenticator: "authenticator",
    thresholds: "thresholds",
    shipping: "shipping",
    kyc: "kyc",
    rating: "rating",
    ccs: "ccs",
    matching: "matching",
    digital: "digital",
    calibration: "calibration",
  };
  return map[prefix] ?? "general";
}

// ─── In-Memory Cache ─────────────────────────────────────

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

function getCached(key: string): unknown | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCached(key: string, value: unknown): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Clear one or all cached config entries. */
export function invalidateConfigCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

// ─── Public API ──────────────────────────────────────────

/**
 * Get a config value by key. Returns the DB value if present,
 * otherwise falls back to the compiled default.
 *
 * Results are cached in-memory for 5 minutes.
 */
export async function getConfig<K extends ConfigKey>(key: K): Promise<ConfigKeys[K]> {
  // Check cache first
  const cached = getCached(key);
  if (cached !== undefined) return cached as ConfigKeys[K];

  // Query DB
  const row = await db.platformConfig.findUnique({ where: { key } });
  const value = row ? row.value : CONFIG_DEFAULTS[key];

  setCached(key, value);
  return value as ConfigKeys[K];
}

/**
 * Get multiple config values at once (batch read).
 */
export async function getConfigs<K extends ConfigKey>(keys: K[]): Promise<Record<K, ConfigKeys[K]>> {
  const result = {} as Record<K, ConfigKeys[K]>;
  const uncachedKeys: K[] = [];

  // Check cache for each key
  for (const key of keys) {
    const cached = getCached(key);
    if (cached !== undefined) {
      result[key] = cached as ConfigKeys[K];
    } else {
      uncachedKeys.push(key);
    }
  }

  // Batch query uncached keys
  if (uncachedKeys.length > 0) {
    const rows = await db.platformConfig.findMany({
      where: { key: { in: uncachedKeys } },
    });
    const rowMap = new Map(rows.map((r) => [r.key, r.value]));

    for (const key of uncachedKeys) {
      const value = rowMap.has(key) ? rowMap.get(key) : CONFIG_DEFAULTS[key];
      setCached(key, value);
      result[key] = value as ConfigKeys[K];
    }
  }

  return result;
}

/**
 * Set a config value. Creates or updates the DB row.
 * Invalidates cache and returns the updated row.
 */
export async function setConfig<K extends ConfigKey>(
  key: K,
  value: ConfigKeys[K],
  adminId: string,
): Promise<{ key: string; value: unknown; version: number }> {
  const category = categoryFromKey(key);

  // Read current value for audit trail
  const existing = await db.platformConfig.findUnique({ where: { key } });
  const oldValue = existing ? existing.value : null;

  const row = await db.platformConfig.upsert({
    where: { key },
    create: {
      key,
      value: value as never,
      category,
      updatedBy: adminId,
      version: 1,
    },
    update: {
      value: value as never,
      updatedBy: adminId,
      version: { increment: 1 },
    },
  });

  // Audit trail
  await db.configAudit.create({
    data: {
      key,
      oldValue: oldValue ?? undefined,
      newValue: value as never,
      changedBy: adminId,
    },
  });

  invalidateConfigCache(key);
  return { key: row.key, value: row.value, version: row.version };
}

/**
 * List all config entries, optionally filtered by category.
 */
export async function listConfigs(category?: ConfigCategory) {
  const where = category ? { category } : {};
  const rows = await db.platformConfig.findMany({
    where,
    orderBy: { key: "asc" },
  });

  // Merge with defaults: show DB rows + any defaults not yet in DB
  const dbKeys = new Set(rows.map((r) => r.key));
  const merged = [...rows];

  for (const [key, defaultValue] of Object.entries(CONFIG_DEFAULTS)) {
    if (!dbKeys.has(key)) {
      const cat = categoryFromKey(key as ConfigKey);
      if (category && cat !== category) continue;
      merged.push({
        key,
        value: defaultValue as never,
        category: cat,
        description: null,
        version: 0, // indicates "using default"
        updatedBy: null,
        updatedAt: new Date(),
        createdAt: new Date(),
      });
    }
  }

  return merged.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Delete a config override, reverting to compiled default.
 */
export async function deleteConfig(key: ConfigKey): Promise<void> {
  await db.platformConfig.delete({ where: { key } }).catch(() => {
    // key may not exist in DB (using default) — that's fine
  });
  invalidateConfigCache(key);
}

/**
 * Get the compiled default for a key (no DB query).
 */
export function getDefault<K extends ConfigKey>(key: K): ConfigKeys[K] {
  return CONFIG_DEFAULTS[key] as ConfigKeys[K];
}

/**
 * Get the audit log for config changes.
 * Optionally filter by key. Returns most recent first.
 */
export async function getConfigAuditLog(key?: string, limit = 100) {
  return db.configAudit.findMany({
    where: key ? { key } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
