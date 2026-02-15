import { AUTHENTICATOR_FEE_STRUCTURE } from "@/lib/constants";
import type { AuthenticatorTier } from "@/types/domain";

export interface FeeBreakdown {
  baseFee: number;         // cents — total fee per card
  platformShare: number;   // cents — platform takes this
  authenticatorShare: number; // cents — authenticator earns this
}

/**
 * Calculate the verification fee for a single card based on authenticator tier.
 *
 * Fee structure (from AUTHENTICATOR_DESIGN.md §6.2):
 *   STANDARD: $3/card, 30% platform → $0.90 platform, $2.10 authenticator
 *   VERIFIED:  $4/card, 25% platform → $1.00 platform, $3.00 authenticator
 *   PREMIUM:   $5/card, 20% platform → $1.00 platform, $4.00 authenticator
 */
export function calculateVerificationFee(tier: AuthenticatorTier): FeeBreakdown {
  const { baseFee, platformPercent } = AUTHENTICATOR_FEE_STRUCTURE[tier];
  const platformShare = Math.round(baseFee * (platformPercent / 100));
  const authenticatorShare = baseFee - platformShare;

  return { baseFee, platformShare, authenticatorShare };
}

/**
 * Calculate total fees for an entire trade (all legs).
 */
export function calculateTradeFees(
  legs: Array<{ tier: AuthenticatorTier }>
): {
  totalFees: number;
  totalPlatformShare: number;
  totalAuthenticatorShare: number;
  perLeg: FeeBreakdown[];
} {
  const perLeg = legs.map((leg) => calculateVerificationFee(leg.tier));
  return {
    totalFees: perLeg.reduce((sum, f) => sum + f.baseFee, 0),
    totalPlatformShare: perLeg.reduce((sum, f) => sum + f.platformShare, 0),
    totalAuthenticatorShare: perLeg.reduce((sum, f) => sum + f.authenticatorShare, 0),
    perLeg,
  };
}
