// ─── Platform Fee & Wallet ─────────────────────────────
export const PLATFORM_FEE_RATE = 0.022; // 2.2% seller fee per card sent
export const MIN_DEPOSIT_CENTS = 500; // $5
export const MAX_DEPOSIT_CENTS = 10_000_00; // $10,000
export const MIN_WITHDRAWAL_CENTS = 1000; // $10

export const PHOTO_APPROVAL_THRESHOLD_CENTS = 5000; // $50.00
export const MAX_PHOTO_COUNT = 4;
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_PHOTO_ATTEMPTS = 2;

// ─── Authenticator Tier Promotion Thresholds ──────────
export const TIER_PROMOTION_THRESHOLDS = {
  VERIFIED: {
    minVerifications: 50,
    minRating: 4.5,
    minDaysActive: 90,
    maxDisputesLost: 0,
  },
  PREMIUM: {
    minVerifications: 200,
    minRating: 4.8,
    minDaysActive: 180,
    requiresInsuranceBond: true,
    requiresStaffAudit: true,
  },
} as const;

// ─── Authenticator Fee Structure ──────────────────────
// Per-card base fee in cents, keyed by tier
export const AUTHENTICATOR_FEE_STRUCTURE = {
  STANDARD: { baseFee: 300, platformPercent: 30 }, // $3, 30% to platform
  VERIFIED: { baseFee: 400, platformPercent: 25 }, // $4, 25% to platform
  PREMIUM: { baseFee: 500, platformPercent: 20 },  // $5, 20% to platform
} as const;

// ─── Random Audit Frequency ──────────────────────────
// 1-in-N verifications are randomly selected for audit
export const RANDOM_AUDIT_FREQUENCY = {
  STANDARD: 10, // 1 in 10
  VERIFIED: 20, // 1 in 20
  PREMIUM: 50,  // 1 in 50
} as const;

// ─── Rating Weights ──────────────────────────────────
export const RATING_COMPONENT_WEIGHTS = {
  accuracy: 0.4,
  speed: 0.2,
  satisfaction: 0.25,
  communication: 0.15,
} as const;

// ─── Reserve Authenticator ───────────────────────────
export const RESERVE_ACCEPTANCE_TIMEOUT_HOURS = 24;

// ─── Direct Trade ────────────────────────────────────
export const DIRECT_TRADE_SHIPPING_DEADLINE_DAYS = 7;
export const DIRECT_TRADE_AUTO_COMPLETE_DAYS = 14; // auto-complete if buyer doesn't confirm

// ─── Shipping & Postage ──────────────────────────────
export const AUTHENTICATOR_SHIP_SLA_HOURS = 48;     // must ship within 48h of DELIVERING
export const AUTHENTICATOR_SHIP_WARNING_HOURS = 24;  // first reminder at 24h
export const AUTHENTICATOR_SHIP_ESCALATION_HOURS = 72; // support escalation at 72h
export const SHIPPING_INSURANCE_THRESHOLD_CENTS = 20_000; // $200 — mandatory insurance above this
export const SHIPPING_SIGNATURE_THRESHOLD_CENTS = 5_000;  // $50 — signature required above this
export const DEAD_LETTER_RETENTION_DAYS = 30;        // unclaimed cards at authenticator after cancel
export const AUTO_COMPLETE_DELIVERY_DAYS = 14;       // same as DIRECT_TRADE_AUTO_COMPLETE_DAYS

// ─── International Shipping ──────────────────────────
export const INTERNATIONAL_BASE_COST_CENTS = 1_500;  // $15 base
export const INTERNATIONAL_INSURANCE_RATE = 0.01;    // 1% of card value
export const INTERNATIONAL_INSURANCE_MIN_CENTS = 500; // $5 minimum insurance
export const CUSTOMS_HS_CODE = "9504.40";            // "articles for parlour games, incl. playing cards"

// ─── CCS (CardForum Condition Score) ─────────────────
export const CCS_DIMENSION_WEIGHTS = {
  surface: 0.30,
  corners: 0.25,
  edges: 0.25,
  centering: 0.20,
} as const;

/** No dimension may be more than this many points below composite */
export const CCS_MIN_CAP_THRESHOLD = 2.0;

/** CCS-to-Condition tier thresholds. ccsToTier() uses cascading >= checks. */
export const CCS_TIER_BOUNDARIES = {
  NM:  { min: 9.0 },
  LP:  { min: 7.0 },
  MP:  { min: 5.0 },
  HP:  { min: 3.0 },
  DMG: { min: 1.0 },
} as const;

/** Sub-tier notation boundaries for marketplace display */
export const CCS_SUB_TIER_BOUNDARIES: Record<string, { min: number; max: number }> = {
  "NM+": { min: 9.5, max: 10.0 },
  "NM":  { min: 9.0, max: 9.4 },
  "NM-": { min: 8.5, max: 8.9 },
  "LP+": { min: 8.0, max: 8.4 },
  "LP":  { min: 7.5, max: 7.9 },
  "LP-": { min: 7.0, max: 7.4 },
  "MP+": { min: 6.0, max: 6.5 },
  "MP":  { min: 5.5, max: 5.9 },
  "MP-": { min: 5.0, max: 5.4 },
  "HP+": { min: 4.0, max: 4.5 },
  "HP":  { min: 3.5, max: 3.9 },
  "HP-": { min: 3.0, max: 3.4 },
  "DMG": { min: 1.0, max: 2.9 },
};

// ─── Digital Trade & Royalties ───────────────────────
export const DIGITAL_TRADE_PLATFORM_FEE_RATE = 0.05;   // 5% to platform
export const DIGITISER_ROYALTY_RATE = 0.02;             // 2% to original digitiser

// ─── Redemption ─────────────────────────────────────
export const REDEMPTION_BASE_FEE_CENTS = 500;           // $5 base handling fee
export const CROSS_ZONE_SURCHARGE_CENTS = 1500;         // $15 cross-zone surcharge

// ─── Customs Zones ──────────────────────────────────
export const CUSTOMS_ZONES: Record<string, string[]> = {
  EU: ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"],
  US: ["US"],
  JP: ["JP"],
  UK: ["GB"],
  AU: ["AU","NZ"],
  CA: ["CA"],
};

export function getCustomsZone(countryCode: string): string {
  for (const [zone, countries] of Object.entries(CUSTOMS_ZONES)) {
    if (countries.includes(countryCode)) return zone;
  }
  return countryCode; // Country is its own zone
}

export function isSameCustomsZone(countryA: string, countryB: string): boolean {
  return getCustomsZone(countryA) === getCustomsZone(countryB);
}

// ─── KYC Thresholds ──────────────────────────────
export const KYC_BASIC_LISTING_CAP_CENTS = 50_000; // $500 — BASIC users can list up to this
export const KYC_BASIC_TRADE_CAP_CENTS = 100_000; // $1,000 — BASIC users can trade up to this
export const KYC_MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const KYC_PRESIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes
export const KYC_DOCUMENT_RETENTION_YEARS = 7;
