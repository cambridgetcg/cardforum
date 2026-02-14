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

export const TCG_LABELS: Record<TCG, string> = {
  POKEMON: "Pokemon",
  ONEPIECE: "One Piece",
  YUGIOH: "Yu-Gi-Oh!",
  MTG: "Magic: The Gathering",
};

export const Condition = {
  NM: "NM",
  LP: "LP",
  MP: "MP",
  HP: "HP",
  DMG: "DMG",
} as const;
export type Condition = (typeof Condition)[keyof typeof Condition];

export const CONDITION_LABELS: Record<Condition, string> = {
  NM: "Near Mint",
  LP: "Lightly Played",
  MP: "Moderately Played",
  HP: "Heavily Played",
  DMG: "Damaged",
};

export const CONDITION_ORDER: Condition[] = ["NM", "LP", "MP", "HP", "DMG"];

export function conditionMeetsMinimum(
  actual: Condition,
  minimum: Condition
): boolean {
  return CONDITION_ORDER.indexOf(actual) <= CONDITION_ORDER.indexOf(minimum);
}

export const TradeStatus = {
  PROPOSED: "PROPOSED",
  ACCEPTED: "ACCEPTED",
  ESCROWED: "ESCROWED",
  CARDS_SUBMITTED: "CARDS_SUBMITTED",
  AUTHENTICATING: "AUTHENTICATING",
  VERIFIED: "VERIFIED",
  DELIVERING: "DELIVERING",
  DELIVERED: "DELIVERED",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  DISPUTED: "DISPUTED",
} as const;
export type TradeStatus = (typeof TradeStatus)[keyof typeof TradeStatus];

// Valid state transitions for the trade state machine
export const TRADE_TRANSITIONS: Record<TradeStatus, TradeStatus[]> = {
  PROPOSED: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["ESCROWED", "CANCELLED", "DISPUTED"],
  ESCROWED: ["CARDS_SUBMITTED", "CANCELLED", "DISPUTED"],
  CARDS_SUBMITTED: ["AUTHENTICATING", "CANCELLED", "DISPUTED"],
  AUTHENTICATING: ["VERIFIED", "DISPUTED"],
  VERIFIED: ["DELIVERING", "DISPUTED"],
  DELIVERING: ["DELIVERED", "DISPUTED"],
  DELIVERED: ["COMPLETED", "DISPUTED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  DISPUTED: ["COMPLETED", "CANCELLED"],
};

export function canTransition(
  from: TradeStatus,
  to: TradeStatus
): boolean {
  return TRADE_TRANSITIONS[from].includes(to);
}

export const TradeLegStatus = {
  PENDING: "PENDING",
  CARD_RECEIVED: "CARD_RECEIVED",
  AUTHENTICATING: "AUTHENTICATING",
  VERIFIED: "VERIFIED",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  FAILED: "FAILED",
} as const;
export type TradeLegStatus =
  (typeof TradeLegStatus)[keyof typeof TradeLegStatus];

export const AuthenticatorTier = {
  STANDARD: "STANDARD",
  VERIFIED: "VERIFIED",
  PREMIUM: "PREMIUM",
} as const;
export type AuthenticatorTier =
  (typeof AuthenticatorTier)[keyof typeof AuthenticatorTier];

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
export type DisputeStatus =
  (typeof DisputeStatus)[keyof typeof DisputeStatus];
