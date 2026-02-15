import { RATING_COMPONENT_WEIGHTS } from "@/lib/constants";
import {
  RATING_DECAY_WEIGHTS,
  RATING_MIN_ACCOUNT_AGE_DAYS,
  RATING_EXTREME_THRESHOLD,
} from "@/types/domain";

interface RatingRecord {
  score: number;
  accuracyScore: number | null;
  speedScore: number | null;
  satisfactionScore: number | null;
  communicationScore: number | null;
  createdAt: Date;
}

interface RaterInfo {
  accountCreatedAt: Date;
}

/**
 * Compute the weighted composite score from individual component scores.
 * Falls back to the overall score when components are null (legacy ratings).
 */
export function computeWeightedScore(rating: RatingRecord): number {
  const w = RATING_COMPONENT_WEIGHTS;
  if (
    rating.accuracyScore != null &&
    rating.speedScore != null &&
    rating.satisfactionScore != null &&
    rating.communicationScore != null
  ) {
    return (
      rating.accuracyScore * w.accuracy +
      rating.speedScore * w.speed +
      rating.satisfactionScore * w.satisfaction +
      rating.communicationScore * w.communication
    );
  }
  return rating.score;
}

/**
 * Apply time-weighted decay to a set of ratings.
 *
 * effective_rating =
 *   (last_90_days × 0.6) + (91-180_days × 0.3) + (lifetime × 0.1)
 */
export function computeTimeWeightedRating(ratings: RatingRecord[]): number {
  if (ratings.length === 0) return 5.0; // default for new authenticators

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const buckets = { last90: [] as number[], mid: [] as number[], lifetime: [] as number[] };

  for (const r of ratings) {
    const age = (now - r.createdAt.getTime()) / day;
    const score = computeWeightedScore(r);
    if (age <= 90) buckets.last90.push(score);
    else if (age <= 180) buckets.mid.push(score);
    else buckets.lifetime.push(score);
  }

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  const last90Avg = avg(buckets.last90);
  const midAvg = avg(buckets.mid);
  const lifetimeAvg = avg(buckets.lifetime);

  // If a bucket is empty, redistribute its weight proportionally
  const w = RATING_DECAY_WEIGHTS;
  let totalWeight = 0;
  let weightedSum = 0;

  if (last90Avg != null) {
    weightedSum += last90Avg * w.last90Days;
    totalWeight += w.last90Days;
  }
  if (midAvg != null) {
    weightedSum += midAvg * w.days91to180;
    totalWeight += w.days91to180;
  }
  if (lifetimeAvg != null) {
    weightedSum += lifetimeAvg * w.lifetime;
    totalWeight += w.lifetime;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 5.0;
}

/**
 * Determine the effective weight for a rating based on protection rules.
 * - Extreme ratings (1.0 or 5.0) without comments are weighted 50%.
 * - Ratings from accounts younger than 30 days are weighted 50%.
 */
export function getRatingWeight(
  score: number,
  comment: string | null | undefined,
  rater: RaterInfo
): number {
  let weight = 1.0;

  // Extreme rating without explanation
  if ((score <= RATING_EXTREME_THRESHOLD.low || score >= RATING_EXTREME_THRESHOLD.high) && !comment) {
    weight *= 0.5;
  }

  // New account penalty
  const accountAgeDays = (Date.now() - rater.accountCreatedAt.getTime()) / (24 * 60 * 60 * 1000);
  if (accountAgeDays < RATING_MIN_ACCOUNT_AGE_DAYS) {
    weight *= 0.5;
  }

  return weight;
}
