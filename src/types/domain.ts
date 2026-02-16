// ─── Domain Types ───────────────────────────────────────
// Shared enums and types for client and server.
// Prisma enums are the source of truth; these mirror them
// for use in client code without importing Prisma.

export const TCG = {
  POKEMON: "POKEMON",
  ONEPIECE: "ONEPIECE",
  YUGIOH: "YUGIOH",
  MTG: "MTG",
} as const;
export type TCG = (typeof TCG)[keyof typeof TCG];
export const TCG_VALUES = Object.values(TCG) as [TCG, ...TCG[]];

export const TCG_LABELS: Record<TCG, string> = {
  POKEMON: "Pokemon",
  ONEPIECE: "One Piece",
  YUGIOH: "Yu-Gi-Oh!",
  MTG: "Magic: The Gathering",
};

export const TCG_FILTERS: { value: TCG | ""; label: string }[] = [
  { value: "", label: "All TCGs" },
  { value: "POKEMON", label: "Pokemon" },
  { value: "ONEPIECE", label: "One Piece" },
  { value: "YUGIOH", label: "Yu-Gi-Oh!" },
  { value: "MTG", label: "Magic" },
];

export const TCG_BADGE_COLORS: Record<TCG, "default" | "success" | "warning" | "error" | "info"> = {
  POKEMON: "warning",
  ONEPIECE: "error",
  YUGIOH: "info",
  MTG: "success",
};

// ─── Card Language ──────────────────────────────────
// Partitions the order book: EN and JP cards are NOT fungible.

export const CardLanguage = {
  EN: "EN",
  JP: "JP",
} as const;
export type CardLanguage = (typeof CardLanguage)[keyof typeof CardLanguage];
export const CARD_LANGUAGE_VALUES = Object.values(CardLanguage) as [
  CardLanguage,
  ...CardLanguage[],
];

export const CARD_LANGUAGE_LABELS: Record<CardLanguage, string> = {
  EN: "English",
  JP: "Japanese",
};

export const Condition = {
  NM: "NM",
  LP: "LP",
  MP: "MP",
  HP: "HP",
  DMG: "DMG",
} as const;
export type Condition = (typeof Condition)[keyof typeof Condition];
export const CONDITION_VALUES = Object.values(Condition) as [Condition, ...Condition[]];

export const CONDITION_LABELS: Record<Condition, string> = {
  NM: "Near Mint",
  LP: "Lightly Played",
  MP: "Moderately Played",
  HP: "Heavily Played",
  DMG: "Damaged",
};

export const CONDITION_ORDER: Condition[] = ["NM", "LP", "MP", "HP", "DMG"];

export const GradingCompany = {
  PSA: "PSA",
  BGS: "BGS",
  CGC: "CGC",
  SGC: "SGC",
} as const;
export type GradingCompany = (typeof GradingCompany)[keyof typeof GradingCompany];
export const GRADING_COMPANY_VALUES = Object.values(GradingCompany) as [
  GradingCompany,
  ...GradingCompany[],
];

export const GRADING_COMPANY_LABELS: Record<GradingCompany, string> = {
  PSA: "PSA (Professional Sports Authenticator)",
  BGS: "BGS (Beckett Grading Services)",
  CGC: "CGC (Certified Guaranty Company)",
  SGC: "SGC (Sportscard Guaranty)",
};

export function conditionMeetsMinimum(actual: Condition, minimum: Condition): boolean {
  return CONDITION_ORDER.indexOf(actual) <= CONDITION_ORDER.indexOf(minimum);
}

// ─── Sealed Product Types ──────────────────────────────

export const SealedCondition = {
  FACTORY_SEALED: "FACTORY_SEALED",
  OPENED: "OPENED",
  DAMAGED_BOX: "DAMAGED_BOX",
} as const;
export type SealedCondition = (typeof SealedCondition)[keyof typeof SealedCondition];
export const SEALED_CONDITION_VALUES = Object.values(SealedCondition) as [
  SealedCondition,
  ...SealedCondition[],
];

export const SEALED_CONDITION_LABELS: Record<SealedCondition, string> = {
  FACTORY_SEALED: "Factory Sealed",
  OPENED: "Opened",
  DAMAGED_BOX: "Damaged Box",
};

export const SEALED_CONDITION_ORDER: SealedCondition[] = [
  "FACTORY_SEALED",
  "OPENED",
  "DAMAGED_BOX",
];

export function sealedConditionMeetsMinimum(
  actual: SealedCondition,
  minimum: SealedCondition,
): boolean {
  return SEALED_CONDITION_ORDER.indexOf(actual) <= SEALED_CONDITION_ORDER.indexOf(minimum);
}

export const SealedProductType = {
  BOOSTER_BOX: "BOOSTER_BOX",
  BOOSTER_PACK: "BOOSTER_PACK",
  STARTER_DECK: "STARTER_DECK",
  BUNDLE: "BUNDLE",
  COLLECTION_BOX: "COLLECTION_BOX",
  PREMIUM_PACK: "PREMIUM_PACK",
  OTHER: "OTHER",
} as const;
export type SealedProductType = (typeof SealedProductType)[keyof typeof SealedProductType];
export const SEALED_PRODUCT_TYPE_VALUES = Object.values(SealedProductType) as [
  SealedProductType,
  ...SealedProductType[],
];

export const SEALED_PRODUCT_TYPE_LABELS: Record<SealedProductType, string> = {
  BOOSTER_BOX: "Booster Box",
  BOOSTER_PACK: "Booster Pack",
  STARTER_DECK: "Starter Deck",
  BUNDLE: "Bundle",
  COLLECTION_BOX: "Collection Box",
  PREMIUM_PACK: "Premium Pack",
  OTHER: "Other",
};

// ─── CCS (CardForum Condition Score) ────────────────

/** Full CCS result with dimension scores, composite, and tier mapping. */
export interface CCS {
  surface: number; // 1.0-10.0 in 0.5 increments
  corners: number; // 1.0-10.0 in 0.5 increments
  edges: number; // 1.0-10.0 in 0.5 increments
  centering: number; // 1.0-10.0 in 0.5 increments
  composite: number; // weighted average with min-cap rule
  tier: Condition; // NM/LP/MP/HP/DMG
  subTier: string; // "NM+", "NM", "NM-", "LP+", etc.
}

/** Raw dimension scores input for CCS calculation. */
export interface CCSInput {
  surface: number;
  corners: number;
  edges: number;
  centering: number;
}

/** Valid CCS dimension scores: 1.0-10.0 in 0.5 increments. */
export const VALID_CCS_SCORES = [
  1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0,
] as const;

/** Format a price in minor units with currency symbol.
 *  Backwards-compatible: formatPrice(1500) → "$15.00"
 *  Multi-currency: formatPrice(200000, "JPY") → "¥2,000"
 */
export { formatPrice } from "@/lib/currency";

export const TradeMode = {
  AUTHENTICATED: "AUTHENTICATED",
  DIRECT: "DIRECT",
} as const;
export type TradeMode = (typeof TradeMode)[keyof typeof TradeMode];

export const TradeStatus = {
  PROPOSED: "PROPOSED",
  ACCEPTED: "ACCEPTED",
  ESCROWED: "ESCROWED",
  CARDS_SUBMITTED: "CARDS_SUBMITTED",
  AUTHENTICATING: "AUTHENTICATING",
  VERIFIED: "VERIFIED",
  DELIVERING: "DELIVERING",
  SHIPPING: "SHIPPING",
  DELIVERED: "DELIVERED",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  DISPUTED: "DISPUTED",
} as const;
export type TradeStatus = (typeof TradeStatus)[keyof typeof TradeStatus];

// Valid state transitions for the trade state machine (authenticated mode)
const AUTHENTICATED_TRANSITIONS: Record<TradeStatus, TradeStatus[]> = {
  PROPOSED: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["ESCROWED", "CANCELLED", "DISPUTED"],
  ESCROWED: ["CARDS_SUBMITTED", "CANCELLED", "DISPUTED"],
  CARDS_SUBMITTED: ["AUTHENTICATING", "CANCELLED", "DISPUTED"],
  AUTHENTICATING: ["VERIFIED", "DISPUTED"],
  VERIFIED: ["DELIVERING", "DISPUTED"],
  DELIVERING: ["DELIVERED", "DISPUTED"],
  SHIPPING: [],
  DELIVERED: ["COMPLETED", "DISPUTED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  DISPUTED: ["COMPLETED", "CANCELLED"],
};

// Valid state transitions for direct trades (no authenticator)
const DIRECT_TRANSITIONS: Record<TradeStatus, TradeStatus[]> = {
  PROPOSED: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["ESCROWED", "CANCELLED", "DISPUTED"],
  ESCROWED: ["SHIPPING", "CANCELLED", "DISPUTED"],
  SHIPPING: ["DELIVERED", "CANCELLED", "DISPUTED"],
  DELIVERED: ["COMPLETED", "DISPUTED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  DISPUTED: ["COMPLETED", "CANCELLED"],
  // Authenticated-only states (unreachable for DIRECT):
  CARDS_SUBMITTED: [],
  AUTHENTICATING: [],
  VERIFIED: [],
  DELIVERING: [],
};

/** Kept for backwards compatibility — returns AUTHENTICATED transitions */
export const TRADE_TRANSITIONS: Record<TradeStatus, TradeStatus[]> = AUTHENTICATED_TRANSITIONS;

export function getTradeTransitions(mode: TradeMode): Record<TradeStatus, TradeStatus[]> {
  return mode === "DIRECT" ? DIRECT_TRANSITIONS : AUTHENTICATED_TRANSITIONS;
}

export function canTransition(
  from: TradeStatus,
  to: TradeStatus,
  mode: TradeMode = "AUTHENTICATED",
): boolean {
  return getTradeTransitions(mode)[from].includes(to);
}

export const TradeLegStatus = {
  PENDING: "PENDING",
  CARD_RECEIVED: "CARD_RECEIVED",
  PHOTO_REVIEW: "PHOTO_REVIEW",
  AUTHENTICATING: "AUTHENTICATING",
  VERIFIED: "VERIFIED",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  FAILED: "FAILED",
} as const;
export type TradeLegStatus = (typeof TradeLegStatus)[keyof typeof TradeLegStatus];

export const PhotoApprovalStatus = {
  PENDING_PHOTOS: "PENDING_PHOTOS",
  PENDING_REVIEW: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type PhotoApprovalStatus = (typeof PhotoApprovalStatus)[keyof typeof PhotoApprovalStatus];

import { PHOTO_APPROVAL_THRESHOLD_CENTS } from "@/lib/constants";

/** Returns true if a leg's card value requires photo approval before authentication. */
export function legRequiresPhotoApproval(askPriceCents: number): boolean {
  return askPriceCents >= PHOTO_APPROVAL_THRESHOLD_CENTS;
}

export const AuthenticatorTier = {
  STANDARD: "STANDARD",
  VERIFIED: "VERIFIED",
  PREMIUM: "PREMIUM",
} as const;
export type AuthenticatorTier = (typeof AuthenticatorTier)[keyof typeof AuthenticatorTier];

export const AuthenticatorApplicationStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  PENDING_REVIEW: "PENDING_REVIEW",
  MORE_INFO_NEEDED: "MORE_INFO_NEEDED",
  APPROVED: "APPROVED",
  ONBOARDING: "ONBOARDING",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DEACTIVATED: "DEACTIVATED",
  REVOKED: "REVOKED",
} as const;
export type AuthenticatorApplicationStatus =
  (typeof AuthenticatorApplicationStatus)[keyof typeof AuthenticatorApplicationStatus];

// Valid application status transitions
export const APPLICATION_TRANSITIONS: Record<
  AuthenticatorApplicationStatus,
  AuthenticatorApplicationStatus[]
> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["PENDING_REVIEW"],
  PENDING_REVIEW: ["APPROVED", "MORE_INFO_NEEDED", "REVOKED"],
  MORE_INFO_NEEDED: ["SUBMITTED"],
  APPROVED: ["ONBOARDING"],
  ONBOARDING: ["ACTIVE"],
  ACTIVE: ["SUSPENDED", "DEACTIVATED"],
  SUSPENDED: ["ACTIVE", "REVOKED"],
  DEACTIVATED: ["ACTIVE"],
  REVOKED: [],
};

export function canTransitionApplication(
  from: AuthenticatorApplicationStatus,
  to: AuthenticatorApplicationStatus,
): boolean {
  return APPLICATION_TRANSITIONS[from].includes(to);
}

/** Maximum card value (cents) an authenticator can handle per tier. */
export const AUTHENTICATOR_TIER_VALUE_CAPS: Record<AuthenticatorTier, number> = {
  STANDARD: 10_000, // $100
  VERIFIED: 50_000, // $500
  PREMIUM: Infinity,
};

// ─── Rating System Constants ──────────────────────────

/** Time-weighted decay periods for composite rating calculation. */
export const RATING_DECAY_WEIGHTS = {
  last90Days: 0.6,
  days91to180: 0.3,
  lifetime: 0.1,
} as const;

/** Minimum account age (days) for full rating weight. Newer accounts get 50%. */
export const RATING_MIN_ACCOUNT_AGE_DAYS = 30;

/** Minimum/maximum score that requires a written comment. */
export const RATING_EXTREME_THRESHOLD = { low: 1.0, high: 5.0 } as const;

// ─── Shipping ────────────────────────────────────────

export const DeliveryMethod = {
  DROP_OFF: "DROP_OFF",
  MAIL: "MAIL",
} as const;
export type DeliveryMethod = (typeof DeliveryMethod)[keyof typeof DeliveryMethod];
export const DELIVERY_METHOD_VALUES = Object.values(DeliveryMethod) as [
  DeliveryMethod,
  ...DeliveryMethod[],
];

/** Structured dispute reasons for shipping issues. */
export const ShippingDisputeReason = {
  NOT_RECEIVED: "NOT_RECEIVED",
  DAMAGED_IN_TRANSIT: "DAMAGED_IN_TRANSIT",
  WRONG_CARD: "WRONG_CARD",
  EMPTY_PACKAGE: "EMPTY_PACKAGE",
  CONDITION_MISMATCH: "CONDITION_MISMATCH",
} as const;
export type ShippingDisputeReason =
  (typeof ShippingDisputeReason)[keyof typeof ShippingDisputeReason];

/**
 * Shipping packaging requirements by card value.
 * Used by authenticators and shown to direct-trade senders.
 */
export const SHIPPING_PACKAGING_REQUIREMENTS = {
  LOW: { maxCents: 5_000, tracking: true, signature: false, insurance: false, label: "< $50" },
  MEDIUM: {
    maxCents: 20_000,
    tracking: true,
    signature: true,
    insurance: false,
    label: "$50–$200",
  },
  HIGH: { maxCents: Infinity, tracking: true, signature: true, insurance: true, label: "$200+" },
} as const;

export function getPackagingRequirement(cardValueCents: number) {
  if (cardValueCents < 5_000) return SHIPPING_PACKAGING_REQUIREMENTS.LOW;
  if (cardValueCents < 20_000) return SHIPPING_PACKAGING_REQUIREMENTS.MEDIUM;
  return SHIPPING_PACKAGING_REQUIREMENTS.HIGH;
}

// ─── Payouts ────────────────────────────────────────

export const PayoutStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  REVERSED: "REVERSED",
} as const;
export type PayoutStatus = (typeof PayoutStatus)[keyof typeof PayoutStatus];

// ─── Escrow ─────────────────────────────────────────

export const EscrowStatus = {
  HELD: "HELD",
  RELEASED: "RELEASED",
  REFUNDED: "REFUNDED",
  DISPUTED: "DISPUTED",
} as const;
export type EscrowStatus = (typeof EscrowStatus)[keyof typeof EscrowStatus];

export const DisputeStatus = {
  OPEN: "OPEN",
  INVESTIGATING: "INVESTIGATING",
  RESOLVED_BUYER: "RESOLVED_BUYER",
  RESOLVED_SELLER: "RESOLVED_SELLER",
  ESCALATED: "ESCALATED",
  CLOSED: "CLOSED",
} as const;
export type DisputeStatus = (typeof DisputeStatus)[keyof typeof DisputeStatus];

// ─── KYC ──────────────────────────────────────────

export const KYCStatus = {
  UNVERIFIED: "UNVERIFIED",
  BASIC_PENDING: "BASIC_PENDING",
  BASIC_VERIFIED: "BASIC_VERIFIED",
  BASIC_REJECTED: "BASIC_REJECTED",
  ENHANCED_PENDING: "ENHANCED_PENDING",
  ENHANCED_VERIFIED: "ENHANCED_VERIFIED",
  ENHANCED_REJECTED: "ENHANCED_REJECTED",
  SUSPENDED: "SUSPENDED",
  REVOKED: "REVOKED",
} as const;
export type KYCStatus = (typeof KYCStatus)[keyof typeof KYCStatus];

export const KYC_STATUS_LABELS: Record<KYCStatus, string> = {
  UNVERIFIED: "Unverified",
  BASIC_PENDING: "Basic — Pending Review",
  BASIC_VERIFIED: "Basic — Verified",
  BASIC_REJECTED: "Basic — Rejected",
  ENHANCED_PENDING: "Enhanced — Pending Review",
  ENHANCED_VERIFIED: "Enhanced — Verified",
  ENHANCED_REJECTED: "Enhanced — Rejected",
  SUSPENDED: "Suspended",
  REVOKED: "Revoked",
};

export const KYC_TRANSITIONS: Record<KYCStatus, KYCStatus[]> = {
  UNVERIFIED: ["BASIC_PENDING"],
  BASIC_PENDING: ["BASIC_VERIFIED", "BASIC_REJECTED"],
  BASIC_VERIFIED: ["ENHANCED_PENDING", "SUSPENDED"],
  BASIC_REJECTED: ["BASIC_PENDING"],
  ENHANCED_PENDING: ["ENHANCED_VERIFIED", "ENHANCED_REJECTED"],
  ENHANCED_VERIFIED: ["SUSPENDED"],
  ENHANCED_REJECTED: ["ENHANCED_PENDING"],
  SUSPENDED: ["BASIC_VERIFIED", "ENHANCED_VERIFIED", "REVOKED"],
  REVOKED: [],
};

export function canTransitionKYC(from: KYCStatus, to: KYCStatus): boolean {
  return KYC_TRANSITIONS[from].includes(to);
}

/** Map KYCStatus to effective verification level for gate checks. */
export function getKYCLevel(status: KYCStatus): "UNVERIFIED" | "BASIC" | "ENHANCED" {
  switch (status) {
    case "BASIC_VERIFIED":
      return "BASIC";
    case "ENHANCED_VERIFIED":
      return "ENHANCED";
    default:
      return "UNVERIFIED";
  }
}

/** Returns true if the given KYC level meets the required minimum. */
export function kycLevelMeetsMinimum(
  actual: "UNVERIFIED" | "BASIC" | "ENHANCED",
  required: "BASIC" | "ENHANCED",
): boolean {
  const order = ["UNVERIFIED", "BASIC", "ENHANCED"];
  return order.indexOf(actual) >= order.indexOf(required);
}

// ─── Digitisation ──────────────────────────────────

export const DigitisationStatus = {
  SUBMITTED: "SUBMITTED",
  RECEIVED: "RECEIVED",
  VERIFYING: "VERIFYING",
  VERIFIED: "VERIFIED",
  MINTED: "MINTED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;
export type DigitisationStatus = (typeof DigitisationStatus)[keyof typeof DigitisationStatus];

export const DIGITISATION_TRANSITIONS: Record<DigitisationStatus, DigitisationStatus[]> = {
  SUBMITTED: ["RECEIVED", "CANCELLED"],
  RECEIVED: ["VERIFYING", "VERIFIED", "MINTED", "CANCELLED", "REJECTED"],
  VERIFYING: ["VERIFIED", "MINTED", "REJECTED"],
  VERIFIED: ["MINTED"],
  MINTED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransitionDigitisation(
  from: DigitisationStatus,
  to: DigitisationStatus,
): boolean {
  return DIGITISATION_TRANSITIONS[from].includes(to);
}

export const DigitalTokenStatus = {
  ACTIVE: "ACTIVE",
  LISTED: "LISTED",
  TRADE_LOCKED: "TRADE_LOCKED",
  REDEMPTION_PENDING: "REDEMPTION_PENDING",
  REDEEMED: "REDEEMED",
  BURNED: "BURNED",
} as const;
export type DigitalTokenStatus = (typeof DigitalTokenStatus)[keyof typeof DigitalTokenStatus];

export const DIGITAL_TOKEN_TRANSITIONS: Record<DigitalTokenStatus, DigitalTokenStatus[]> = {
  ACTIVE: ["LISTED", "REDEMPTION_PENDING"],
  LISTED: ["ACTIVE", "TRADE_LOCKED"],
  TRADE_LOCKED: ["ACTIVE"],
  REDEMPTION_PENDING: ["REDEEMED", "ACTIVE"],
  REDEEMED: ["BURNED"],
  BURNED: [],
};

export function canTransitionDigitalToken(
  from: DigitalTokenStatus,
  to: DigitalTokenStatus,
): boolean {
  return DIGITAL_TOKEN_TRANSITIONS[from].includes(to);
}

export const RedemptionStatus = {
  REQUESTED: "REQUESTED",
  STOCK_RESERVED: "STOCK_RESERVED",
  PREPARING: "PREPARING",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type RedemptionStatus = (typeof RedemptionStatus)[keyof typeof RedemptionStatus];

export const REDEMPTION_TRANSITIONS: Record<RedemptionStatus, RedemptionStatus[]> = {
  REQUESTED: ["STOCK_RESERVED", "FAILED", "CANCELLED"],
  STOCK_RESERVED: ["PREPARING", "FAILED", "CANCELLED"],
  PREPARING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransitionRedemption(from: RedemptionStatus, to: RedemptionStatus): boolean {
  return REDEMPTION_TRANSITIONS[from].includes(to);
}

// ─── Expert Knowledge Hub ────────────────────────────

export const ExpertPostCategory = {
  PRICE_ANALYSIS: "PRICE_ANALYSIS",
  COMBO_GUIDE: "COMBO_GUIDE",
  SET_REVIEW: "SET_REVIEW",
  CONDITION_GUIDE: "CONDITION_GUIDE",
  META_ANALYSIS: "META_ANALYSIS",
  FACTORY_DEFECT: "FACTORY_DEFECT",
  GRADING_TIPS: "GRADING_TIPS",
  STORAGE_TIPS: "STORAGE_TIPS",
  INVESTMENT_OUTLOOK: "INVESTMENT_OUTLOOK",
  MARKET_TRENDS: "MARKET_TRENDS",
} as const;
export type ExpertPostCategory = (typeof ExpertPostCategory)[keyof typeof ExpertPostCategory];
export const EXPERT_POST_CATEGORY_VALUES = Object.values(ExpertPostCategory) as [
  ExpertPostCategory,
  ...ExpertPostCategory[],
];

export const EXPERT_POST_CATEGORY_LABELS: Record<ExpertPostCategory, string> = {
  PRICE_ANALYSIS: "Price Analysis",
  COMBO_GUIDE: "Combo Guide",
  SET_REVIEW: "Set Review",
  CONDITION_GUIDE: "Condition Guide",
  META_ANALYSIS: "Meta Analysis",
  FACTORY_DEFECT: "Factory Defect",
  GRADING_TIPS: "Grading Tips",
  STORAGE_TIPS: "Storage Tips",
  INVESTMENT_OUTLOOK: "Investment Outlook",
  MARKET_TRENDS: "Market Trends",
};

export const ExpertPostStatus = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  PUBLISHED: "PUBLISHED",
  FLAGGED: "FLAGGED",
  REMOVED: "REMOVED",
} as const;
export type ExpertPostStatus = (typeof ExpertPostStatus)[keyof typeof ExpertPostStatus];
export const EXPERT_POST_STATUS_VALUES = Object.values(ExpertPostStatus) as [
  ExpertPostStatus,
  ...ExpertPostStatus[],
];

export const KYCDocumentType = {
  GOVERNMENT_ID: "GOVERNMENT_ID",
  SELFIE: "SELFIE",
  PROOF_OF_ADDRESS: "PROOF_OF_ADDRESS",
  BANK_VERIFICATION: "BANK_VERIFICATION",
} as const;
export type KYCDocumentType = (typeof KYCDocumentType)[keyof typeof KYCDocumentType];

export const KYC_DOCUMENT_LABELS: Record<KYCDocumentType, string> = {
  GOVERNMENT_ID: "Government-Issued ID",
  SELFIE: "Selfie (Liveness Check)",
  PROOF_OF_ADDRESS: "Proof of Address",
  BANK_VERIFICATION: "Bank Account Verification",
};

/** Documents required per KYC tier. */
export const KYC_REQUIRED_DOCUMENTS: Record<"BASIC" | "ENHANCED", KYCDocumentType[]> = {
  BASIC: ["GOVERNMENT_ID", "SELFIE"],
  ENHANCED: ["PROOF_OF_ADDRESS"],
};
