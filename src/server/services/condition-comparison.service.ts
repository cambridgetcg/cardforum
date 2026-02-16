/**
 * Condition Comparison Service — AI vs Authenticator CCS tracking.
 *
 * When an authenticator completes verification with CCS data,
 * this service compares the authenticator's scores with the AI's
 * scores from listing time.  Stores per-dimension deltas for
 * analytics and calibration.
 *
 * Pattern source: authenticator-rating.service.ts (comparison + aggregate)
 */

import { db } from "@/lib/db";
import { ccsDelta } from "@/lib/ccs";
import { recalculateUserAIAgreement, isWithinAgreement } from "./condition-trust.service";
import type { AuthenticatorTier } from "@/types/domain";
import type { TCG } from "@/generated/prisma/enums";

// NOTE: Subscribers are registered via side-effect import in server entry points.
// Do NOT import "@/server/events/subscribers" here — it would create a circular dependency.

// ─── Types ──────────────────────────────────────────────

interface CCSData {
  surface: number;
  corners: number;
  edges: number;
  centering: number;
  composite: number;
}

export interface AuthenticatorComparisonStats {
  totalComparisons: number;
  agreementRate: number;
  avgDelta: CCSData;
}

export interface SellerComparisonStats {
  totalComparisons: number;
  agreementRate: number;
  avgDeltaComposite: number;
}

// ─── Core ───────────────────────────────────────────────

/**
 * Create a condition comparison record after authenticator verification.
 *
 * Loads AI CCS from the HaveListing and authenticator CCS from the
 * VerificationAssignment.result, computes deltas, stores the record,
 * and updates the seller's agreement rate.
 *
 * Silently returns null if AI CCS data is missing (listing was not
 * AI-graded) — this is expected for many listings.
 */
export async function createConditionComparison(tradeLegId: string): Promise<string | null> {
  const leg = await db.tradeLeg.findUnique({
    where: { id: tradeLegId },
    include: {
      haveListing: {
        include: { card: { select: { tcg: true } } },
      },
      verification: {
        include: {
          authenticator: { select: { tier: true } },
        },
      },
    },
  });

  if (!leg?.haveListing || !leg.verification) return null;

  // Check AI CCS exists on the listing
  const listing = leg.haveListing;
  if (
    listing.aiCCSSurface == null ||
    listing.aiCCSCorners == null ||
    listing.aiCCSEdges == null ||
    listing.aiCCSCentering == null ||
    listing.aiCCSComposite == null
  ) {
    return null; // Not AI-graded — skip comparison
  }

  // Extract authenticator CCS from verification result JSON
  const result = leg.verification.result as Record<string, unknown> | null;
  const authCCS = result?.ccs as CCSData | undefined;
  if (!authCCS) return null; // Authenticator didn't include CCS — skip

  // Compute absolute deltas
  const deltas = {
    surface: ccsDelta(listing.aiCCSSurface, authCCS.surface),
    corners: ccsDelta(listing.aiCCSCorners, authCCS.corners),
    edges: ccsDelta(listing.aiCCSEdges, authCCS.edges),
    centering: ccsDelta(listing.aiCCSCentering, authCCS.centering),
    composite: ccsDelta(listing.aiCCSComposite, authCCS.composite),
  };

  // Compute signed deltas: AI - Auth (positive = AI grades higher)
  const signedDeltas = {
    surface: listing.aiCCSSurface - authCCS.surface,
    corners: listing.aiCCSCorners - authCCS.corners,
    edges: listing.aiCCSEdges - authCCS.edges,
    centering: listing.aiCCSCentering - authCCS.centering,
    composite: listing.aiCCSComposite - authCCS.composite,
  };

  const agreed = await isWithinAgreement(listing.aiCCSComposite, authCCS.composite);

  // Create comparison record
  const comparison = await db.conditionComparison.create({
    data: {
      tradeLegId,
      haveListingId: listing.id,
      aiSurface: listing.aiCCSSurface,
      aiCorners: listing.aiCCSCorners,
      aiEdges: listing.aiCCSEdges,
      aiCentering: listing.aiCCSCentering,
      aiComposite: listing.aiCCSComposite,
      authSurface: authCCS.surface,
      authCorners: authCCS.corners,
      authEdges: authCCS.edges,
      authCentering: authCCS.centering,
      authComposite: authCCS.composite,
      deltaSurface: deltas.surface,
      deltaCorners: deltas.corners,
      deltaEdges: deltas.edges,
      deltaCentering: deltas.centering,
      deltaComposite: deltas.composite,
      signedDeltaSurface: signedDeltas.surface,
      signedDeltaCorners: signedDeltas.corners,
      signedDeltaEdges: signedDeltas.edges,
      signedDeltaCentering: signedDeltas.centering,
      signedDeltaComposite: signedDeltas.composite,
      tcg: listing.card.tcg as TCG,
      agreed,
      authenticatorId: leg.verification.authenticatorId,
      authenticatorTier: leg.verification.authenticator.tier as AuthenticatorTier,
      sellerId: leg.fromUserId,
    },
  });

  // Update seller's aggregate agreement rate
  await recalculateUserAIAgreement(leg.fromUserId);

  return comparison.id;
}

// ─── Analytics ──────────────────────────────────────────

/**
 * Aggregate comparison stats for an authenticator.
 * Shows how closely the authenticator's CCS aligns with AI.
 */
export async function getAuthenticatorComparisonStats(
  authenticatorId: string,
): Promise<AuthenticatorComparisonStats> {
  const comparisons = await db.conditionComparison.findMany({
    where: { authenticatorId },
  });

  if (comparisons.length === 0) {
    return {
      totalComparisons: 0,
      agreementRate: 0,
      avgDelta: { surface: 0, corners: 0, edges: 0, centering: 0, composite: 0 },
    };
  }

  const agreedCount = comparisons.filter((c) => c.agreed).length;

  return {
    totalComparisons: comparisons.length,
    agreementRate: agreedCount / comparisons.length,
    avgDelta: {
      surface: avg(comparisons.map((c) => c.deltaSurface)),
      corners: avg(comparisons.map((c) => c.deltaCorners)),
      edges: avg(comparisons.map((c) => c.deltaEdges)),
      centering: avg(comparisons.map((c) => c.deltaCentering)),
      composite: avg(comparisons.map((c) => c.deltaComposite)),
    },
  };
}

/**
 * Aggregate comparison stats for a seller.
 */
export async function getSellerComparisonStats(sellerId: string): Promise<SellerComparisonStats> {
  const comparisons = await db.conditionComparison.findMany({
    where: { sellerId },
    select: { agreed: true, deltaComposite: true },
  });

  if (comparisons.length === 0) {
    return { totalComparisons: 0, agreementRate: 0, avgDeltaComposite: 0 };
  }

  const agreedCount = comparisons.filter((c) => c.agreed).length;

  return {
    totalComparisons: comparisons.length,
    agreementRate: agreedCount / comparisons.length,
    avgDeltaComposite: avg(comparisons.map((c) => c.deltaComposite)),
  };
}

// ─── Helpers ────────────────────────────────────────────

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
