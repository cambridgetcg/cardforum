/**
 * Condition Trust Service — tracks seller AI agreement rates.
 *
 * When a trade completes and authenticator CCS is available,
 * this service compares the AI CCS (from listing time) with the
 * authenticator CCS and updates the seller's agreement rate.
 *
 * Pattern source: authenticator-rating.service.ts (aggregate computation)
 */

import { db } from "@/lib/db";
import { ccsDelta } from "@/lib/ccs";

/** Agreement threshold: composite delta ≤ 1.0 CCS points. */
const AGREEMENT_THRESHOLD = 1.0;

/**
 * Recalculate a seller's AI agreement rate from all their
 * ConditionComparison records.
 *
 * Called after createConditionComparison() adds a new data point.
 */
export async function recalculateUserAIAgreement(
  userId: string,
): Promise<void> {
  const comparisons = await db.conditionComparison.findMany({
    where: { sellerId: userId },
    select: { agreed: true },
  });

  if (comparisons.length === 0) return;

  const agreedCount = comparisons.filter((c) => c.agreed).length;
  const rate = agreedCount / comparisons.length;

  await db.user.update({
    where: { id: userId },
    data: {
      aiAgreementRate: Math.round(rate * 1000) / 1000, // 3 decimal places
      aiAgreementCount: comparisons.length,
    },
  });
}

/**
 * Check if a CCS delta indicates agreement.
 *
 * Exported for use in condition-comparison.service.ts.
 */
export function isWithinAgreement(
  aiComposite: number,
  authComposite: number,
): boolean {
  return ccsDelta(aiComposite, authComposite) <= AGREEMENT_THRESHOLD;
}
