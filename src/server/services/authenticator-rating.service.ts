import { db } from "@/lib/db";
import type { SubmitRatingInput } from "@/lib/validators";
import {
  computeTimeWeightedRating,
  getRatingWeight,
} from "@/lib/authenticator-ratings";

/**
 * Submit a rating for an authenticator after a trade leg is completed.
 * Only the card recipient can rate, and only for completed trades.
 */
export async function submitRating(raterId: string, input: SubmitRatingInput) {
  // Verify the trade leg exists and the rater is the recipient
  const leg = await db.tradeLeg.findUnique({
    where: { id: input.tradeLegId },
    include: {
      trade: true,
      verification: { include: { authenticator: true } },
    },
  });

  if (!leg) throw new Error("Trade leg not found");
  if (leg.toUserId !== raterId) throw new Error("Not authorized — only the card recipient can rate");
  if (leg.trade.status !== "COMPLETED") throw new Error("Trade must be completed before rating");
  if (!leg.verification) throw new Error("No verification assignment for this leg");

  // Check for existing rating
  const existing = await db.authenticatorRating.findUnique({
    where: { tradeLegId: input.tradeLegId },
  });
  if (existing) throw new Error("Already rated this trade leg");

  const authenticatorId = leg.verification.authenticatorId;

  // Create rating and recalculate authenticator's aggregate score
  const [rating] = await db.$transaction([
    db.authenticatorRating.create({
      data: {
        authenticatorId,
        tradeLegId: input.tradeLegId,
        raterId,
        score: input.score,
        accuracyScore: input.accuracyScore,
        speedScore: input.speedScore,
        satisfactionScore: input.satisfactionScore,
        communicationScore: input.communicationScore,
        comment: input.comment,
      },
    }),
    // lastActiveAt tracks authenticator activity for inactivity checks
    db.authenticator.update({
      where: { id: authenticatorId },
      data: { lastActiveAt: new Date() },
    }),
  ]);

  // Recalculate aggregate rating with time-weighted decay and protection rules
  await recalculateAggregateRating(authenticatorId);

  return rating;
}

/**
 * Recalculate the aggregate rating for an authenticator using:
 * - Weighted component scores (accuracy 40%, speed 20%, satisfaction 25%, communication 15%)
 * - Time-weighted decay (60% last 90d, 30% 91-180d, 10% lifetime)
 * - Protection rules (extreme ratings, new account penalty)
 */
async function recalculateAggregateRating(authenticatorId: string) {
  const ratings = await db.authenticatorRating.findMany({
    where: { authenticatorId },
    orderBy: { createdAt: "desc" },
  });

  if (ratings.length === 0) return;

  // Fetch rater account ages for protection weighting
  const raterIds = [...new Set(ratings.map((r) => r.raterId))];
  const raters = await db.user.findMany({
    where: { id: { in: raterIds } },
    select: { id: true, createdAt: true },
  });
  const raterMap = new Map(raters.map((r) => [r.id, r]));

  // Apply protection weights
  const weightedRatings = ratings
    .map((r) => {
      const rater = raterMap.get(r.raterId);
      const weight = rater
        ? getRatingWeight(r.score, r.comment, { accountCreatedAt: rater.createdAt })
        : 1.0;
      return { ...r, weight };
    })
    .filter((r) => r.weight > 0);

  // Compute time-weighted composite
  const effectiveRating = await computeTimeWeightedRating(weightedRatings);

  await db.authenticator.update({
    where: { id: authenticatorId },
    data: { rating: Math.round(effectiveRating * 100) / 100 }, // 2 decimal places
  });
}
