/**
 * Seed PlatformConfig — populates all 45 config keys with defaults + descriptions.
 *
 * Usage:
 *   npx tsx prisma/seed-config.ts            # seed all keys
 *   npx tsx prisma/seed-config.ts --dry-run  # preview only
 *
 * Safe to re-run: uses upsert (only updates description + category, never overwrites value).
 */

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const dryRun = process.argv.includes("--dry-run");

// ─── Config Seed Data ────────────────────────────────────

interface ConfigSeed {
  key: string;
  value: unknown;
  category: string;
  description: string;
}

const seeds: ConfigSeed[] = [
  // Fees
  {
    key: "fees.platform_rate",
    value: 0.022,
    category: "fees",
    description: "Platform fee rate per card sent (2.2%)",
  },
  {
    key: "fees.digital_platform_rate",
    value: 0.05,
    category: "fees",
    description: "Platform fee rate on digital token trades (5%)",
  },
  {
    key: "fees.digitiser_royalty_rate",
    value: 0.02,
    category: "fees",
    description: "Royalty to original digitiser on secondary sales (2%)",
  },
  {
    key: "fees.min_deposit_cents",
    value: 500,
    category: "fees",
    description: "Minimum deposit amount ($5)",
  },
  {
    key: "fees.max_deposit_cents",
    value: 1_000_000,
    category: "fees",
    description: "Maximum deposit amount ($10,000)",
  },
  {
    key: "fees.min_withdrawal_cents",
    value: 1000,
    category: "fees",
    description: "Minimum withdrawal amount ($10)",
  },

  // Authenticator
  {
    key: "authenticator.fee_structure",
    value: {
      STANDARD: { baseFee: 300, platformPercent: 30 },
      VERIFIED: { baseFee: 400, platformPercent: 25 },
      PREMIUM: { baseFee: 500, platformPercent: 20 },
    },
    category: "authenticator",
    description: "Per-card verification fee in cents and platform revenue share by tier",
  },
  {
    key: "authenticator.tier_promotion_thresholds",
    value: {
      VERIFIED: { minVerifications: 50, minRating: 4.5, minDaysActive: 90, maxDisputesLost: 0 },
      PREMIUM: {
        minVerifications: 200,
        minRating: 4.8,
        minDaysActive: 180,
        requiresInsuranceBond: true,
        requiresStaffAudit: true,
      },
    },
    category: "authenticator",
    description: "Requirements for authenticator tier promotion",
  },
  {
    key: "authenticator.random_audit_frequency",
    value: { STANDARD: 10, VERIFIED: 20, PREMIUM: 50 },
    category: "authenticator",
    description: "1-in-N verifications randomly selected for audit, by tier",
  },
  {
    key: "authenticator.reserve_timeout_hours",
    value: 24,
    category: "authenticator",
    description: "Hours before reserve assignment times out",
  },
  {
    key: "authenticator.ship_sla_hours",
    value: 48,
    category: "authenticator",
    description: "SLA: must ship within N hours of DELIVERING",
  },
  {
    key: "authenticator.ship_warning_hours",
    value: 24,
    category: "authenticator",
    description: "First shipping reminder at N hours",
  },
  {
    key: "authenticator.ship_escalation_hours",
    value: 72,
    category: "authenticator",
    description: "Support escalation at N hours overdue",
  },
  {
    key: "authenticator.dispute_demotion_window_days",
    value: 30,
    category: "authenticator",
    description: "Rolling window (days) for dispute-based demotion",
  },
  {
    key: "authenticator.dispute_demotion_threshold",
    value: 3,
    category: "authenticator",
    description: "Number of lost disputes in window to trigger demotion",
  },
  {
    key: "authenticator.inactivity_demotion_days",
    value: 90,
    category: "authenticator",
    description: "Days of inactivity before tier demotion",
  },

  // Thresholds
  {
    key: "thresholds.photo_approval_cents",
    value: 5000,
    category: "thresholds",
    description: "Card value (cents) above which photo approval is required ($50)",
  },
  {
    key: "thresholds.max_photo_count",
    value: 4,
    category: "thresholds",
    description: "Maximum photos per card submission",
  },
  {
    key: "thresholds.max_photo_size_bytes",
    value: 5 * 1024 * 1024,
    category: "thresholds",
    description: "Maximum photo file size (5 MB)",
  },
  {
    key: "thresholds.max_photo_attempts",
    value: 2,
    category: "thresholds",
    description: "Maximum photo resubmission attempts",
  },
  {
    key: "thresholds.photo_trust_min_agreement_rate",
    value: 0.9,
    category: "thresholds",
    description: "AI agreement rate threshold for trusted seller status (90%)",
  },
  {
    key: "thresholds.photo_trust_min_comparisons",
    value: 5,
    category: "thresholds",
    description: "Minimum AI comparisons needed before trust exemption",
  },

  // Shipping
  {
    key: "shipping.insurance_threshold_cents",
    value: 20_000,
    category: "shipping",
    description: "Mandatory insurance above this value ($200)",
  },
  {
    key: "shipping.signature_threshold_cents",
    value: 5_000,
    category: "shipping",
    description: "Signature required above this value ($50)",
  },
  {
    key: "shipping.dead_letter_retention_days",
    value: 30,
    category: "shipping",
    description: "Days authenticator holds unclaimed cards after cancellation",
  },
  {
    key: "shipping.auto_complete_days",
    value: 14,
    category: "shipping",
    description: "Auto-complete delivery after N days without dispute",
  },
  {
    key: "shipping.direct_trade_deadline_days",
    value: 7,
    category: "shipping",
    description: "Days to ship in direct trades before warning",
  },
  {
    key: "shipping.international_base_cost_cents",
    value: 1_500,
    category: "shipping",
    description: "Base international shipping cost ($15)",
  },
  {
    key: "shipping.international_insurance_rate",
    value: 0.01,
    category: "shipping",
    description: "International insurance rate (1% of card value)",
  },
  {
    key: "shipping.international_insurance_min_cents",
    value: 500,
    category: "shipping",
    description: "Minimum international insurance ($5)",
  },

  // KYC
  {
    key: "kyc.basic_listing_cap_cents",
    value: 50_000,
    category: "kyc",
    description: "BASIC users can list cards up to this value ($500)",
  },
  {
    key: "kyc.basic_trade_cap_cents",
    value: 100_000,
    category: "kyc",
    description: "BASIC users can trade up to this value ($1,000)",
  },
  {
    key: "kyc.max_document_size_bytes",
    value: 10 * 1024 * 1024,
    category: "kyc",
    description: "Maximum KYC document file size (10 MB)",
  },
  {
    key: "kyc.presigned_url_expiry_seconds",
    value: 300,
    category: "kyc",
    description: "S3 presigned URL expiry for KYC uploads (5 min)",
  },
  {
    key: "kyc.document_retention_years",
    value: 7,
    category: "kyc",
    description: "KYC document retention period (years)",
  },

  // Rating
  {
    key: "rating.component_weights",
    value: { accuracy: 0.4, speed: 0.2, satisfaction: 0.25, communication: 0.15 },
    category: "rating",
    description: "Authenticator rating component weights (must sum to 1.0)",
  },
  {
    key: "rating.decay_weights",
    value: { last90Days: 0.6, days91to180: 0.3, lifetime: 0.1 },
    category: "rating",
    description: "Time-decay weights for composite rating calculation",
  },

  // CCS
  {
    key: "ccs.dimension_weights",
    value: { surface: 0.3, corners: 0.25, edges: 0.25, centering: 0.2 },
    category: "ccs",
    description: "CCS dimension weights for composite calculation (must sum to 1.0)",
  },
  {
    key: "ccs.min_cap_threshold",
    value: 2.0,
    category: "ccs",
    description: "Max allowed gap between any dimension and composite",
  },
  {
    key: "ccs.tier_boundaries",
    value: {
      NM: { min: 9.0 },
      LP: { min: 7.0 },
      MP: { min: 5.0 },
      HP: { min: 3.0 },
      DMG: { min: 1.0 },
    },
    category: "ccs",
    description: "CCS composite → condition tier boundary thresholds",
  },
  {
    key: "ccs.sub_tier_boundaries",
    value: {
      "NM+": { min: 9.5, max: 10.0 },
      NM: { min: 9.0, max: 9.4 },
      "NM-": { min: 8.5, max: 8.9 },
      "LP+": { min: 8.0, max: 8.4 },
      LP: { min: 7.5, max: 7.9 },
      "LP-": { min: 7.0, max: 7.4 },
      "MP+": { min: 6.0, max: 6.5 },
      MP: { min: 5.5, max: 5.9 },
      "MP-": { min: 5.0, max: 5.4 },
      "HP+": { min: 4.0, max: 4.5 },
      HP: { min: 3.5, max: 3.9 },
      "HP-": { min: 3.0, max: 3.4 },
      DMG: { min: 1.0, max: 2.9 },
    },
    category: "ccs",
    description: "CCS sub-tier display boundaries (NM+, NM, NM-, ...)",
  },

  // Matching
  {
    key: "matching.max_cycle_depth",
    value: 6,
    category: "matching",
    description: "Maximum cycle length the matcher will explore",
  },
  {
    key: "matching.max_packed",
    value: 50,
    category: "matching",
    description: "Maximum proposals packed per matching run",
  },
  {
    key: "matching.proposal_expiry_days",
    value: 7,
    category: "matching",
    description: "Days before an unaccepted proposal expires",
  },
  {
    key: "matching.scorer_weights",
    value: {
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
    category: "matching",
    description: "Match scorer weight parameters — adjust to tune proposal quality",
  },

  // Digital
  {
    key: "digital.redemption_base_fee_cents",
    value: 500,
    category: "digital",
    description: "Base redemption handling fee ($5)",
  },
  {
    key: "digital.cross_zone_surcharge_cents",
    value: 1500,
    category: "digital",
    description: "Cross-zone redemption surcharge ($15)",
  },

  // Calibration
  {
    key: "calibration.drift_threshold",
    value: 0.5,
    category: "calibration",
    description: "CCS drift threshold for calibration alerts",
  },
  {
    key: "calibration.outlier_delta_threshold",
    value: 2.0,
    category: "calibration",
    description: "Delta threshold to flag CCS outlier comparisons",
  },
  {
    key: "calibration.outlier_min_samples",
    value: 5,
    category: "calibration",
    description: "Minimum samples before flagging outlier patterns",
  },
  {
    key: "calibration.min_sample_size",
    value: 10,
    category: "calibration",
    description: "Minimum comparisons for statistical significance",
  },
  {
    key: "calibration.recent_window_days",
    value: 30,
    category: "calibration",
    description: "Recent window (days) for drift analysis",
  },
  {
    key: "calibration.baseline_window_days",
    value: 180,
    category: "calibration",
    description: "Baseline window (days) for drift comparison",
  },
  {
    key: "calibration.extreme_delta_threshold",
    value: 3.0,
    category: "calibration",
    description: "CCS delta that triggers immediate authenticator suspension",
  },
  {
    key: "calibration.agreement_threshold",
    value: 1.0,
    category: "calibration",
    description: "Max CCS delta considered 'in agreement'",
  },
];

// ─── Seed Logic ──────────────────────────────────────────

async function seedConfig() {
  console.log(`\nSeeding PlatformConfig (${seeds.length} keys)${dryRun ? " [DRY RUN]" : ""}...\n`);

  let created = 0;
  let updated = 0;

  for (const seed of seeds) {
    if (dryRun) {
      console.log(`  [DRY] ${seed.key} (${seed.category}): ${seed.description}`);
      continue;
    }

    const existing = await db.platformConfig.findUnique({ where: { key: seed.key } });

    if (existing) {
      // Only update description and category — never overwrite admin-tuned values
      await db.platformConfig.update({
        where: { key: seed.key },
        data: {
          description: seed.description,
          category: seed.category,
        },
      });
      updated++;
    } else {
      await db.platformConfig.create({
        data: {
          key: seed.key,
          value: seed.value as never,
          category: seed.category,
          description: seed.description,
          version: 1,
        },
      });
      created++;
    }
  }

  console.log(`\n  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Total:   ${seeds.length}\n`);
}

seedConfig()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
