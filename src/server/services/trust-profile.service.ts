/**
 * Trust Profile Service — Composite trust scoring across all dimensions.
 *
 * Aggregates isolated trust signals (trades, KYC, photo AI agreement,
 * authenticator status, expert contributions) into a single 0–100
 * composite score with per-dimension breakdown.
 *
 * Loop 6: Portable Trust Credential
 */

import { db } from "@/lib/db";

// ─── Types ──────────────────────────────────────────────

export interface TrustProfile {
  userId: string;
  composite: number; // 0–100 overall trust score
  tradeScore: {
    completed: number;
    cancelled: number;
    disputed: number;
    completionRate: number;
    points: number; // 0–30
  };
  kycScore: {
    tier: string;
    points: number; // 0–15
  };
  photoTrust: {
    agreementRate: number | null;
    comparisons: number;
    trusted: boolean;
    points: number; // 0–10
  };
  identityScore: {
    emailVerified: boolean;
    accountAgeDays: number;
    points: number; // 0–10
  };
  authScore: {
    isAuthenticator: boolean;
    tier: string | null;
    rating: number | null;
    verifications: number;
    points: number; // 0–10
  } | null;
  expertScore: {
    publishedPosts: number;
    endorsedPosts: number;
    totalHelpful: number;
    points: number; // 0–5
  };
  frozen: boolean;
}

// ─── Scoring Constants ──────────────────────────────────

const BASE_SCORE = 20;
const MAX_TRADE_POINTS = 30;
const MAX_KYC_POINTS = 15;
const MAX_PHOTO_POINTS = 10;
const MAX_IDENTITY_POINTS = 10;
const MAX_AUTH_POINTS = 10;
const MAX_EXPERT_POINTS = 5;

const TRADE_COMPLETED_BONUS = 2;
const TRADE_CANCELLED_PENALTY = 3;
const TRADE_DISPUTE_PENALTY = 5;
const TRADE_MAX_COMPLETED_BONUS = 20;

const KYC_TIER_POINTS: Record<string, number> = {
  UNVERIFIED: 0,
  BASIC_PENDING: 2,
  BASIC_VERIFIED: 10,
  BASIC_REJECTED: 0,
  ENHANCED_PENDING: 10,
  ENHANCED_VERIFIED: 15,
  ENHANCED_REJECTED: 5,
  SUSPENDED: 0,
  REVOKED: 0,
};

const AUTH_TIER_POINTS: Record<string, number> = {
  STANDARD: 3,
  VERIFIED: 6,
  PREMIUM: 10,
};

// ─── Core ───────────────────────────────────────────────

/**
 * Compute a user's full trust profile with per-dimension breakdown.
 */
export async function getTrustProfile(userId: string): Promise<TrustProfile> {
  // Load all data in parallel
  const [user, tradeCounts, disputeCount, authenticator, expertStats] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        emailVerified: true,
        createdAt: true,
        kycStatus: true,
        aiAgreementRate: true,
        aiAgreementCount: true,
        walletFrozen: true,
      },
    }),
    // Trade counts by status for this user
    Promise.all([
      db.trade.count({ where: { participantIds: { has: userId }, status: "COMPLETED" } }),
      db.trade.count({ where: { participantIds: { has: userId }, status: "CANCELLED" } }),
    ]),
    // Disputes where this user was the counterparty (resolved against them)
    db.dispute.count({
      where: {
        OR: [
          { status: "RESOLVED_BUYER", trade: { participantIds: { has: userId } } },
          { status: "RESOLVED_SELLER", trade: { participantIds: { has: userId } } },
        ],
      },
    }),
    // Authenticator profile (if exists)
    db.authenticator.findFirst({
      where: { userId, applicationStatus: "ACTIVE" },
      select: { tier: true, rating: true, totalVerified: true },
    }),
    // Expert contributions
    db.expertPost.aggregate({
      where: { authorId: userId, status: "PUBLISHED" },
      _count: true,
      _sum: { helpfulCount: true },
    }),
  ]);

  if (!user) {
    return emptyProfile(userId);
  }

  const [completedTrades, cancelledTrades] = tradeCounts;

  // Expert endorsement count
  const endorsedPostCount = await db.expertEndorsement.count({
    where: {
      post: { authorId: userId, status: "PUBLISHED" },
    },
  });

  // ─── Calculate each dimension ───────────────────

  // Trade score (0–30)
  const totalTrades = completedTrades + cancelledTrades;
  const completionRate = totalTrades > 0 ? completedTrades / totalTrades : 0;
  const tradeRawPoints =
    Math.min(completedTrades * TRADE_COMPLETED_BONUS, TRADE_MAX_COMPLETED_BONUS) -
    cancelledTrades * TRADE_CANCELLED_PENALTY -
    disputeCount * TRADE_DISPUTE_PENALTY;
  const tradePoints = Math.max(0, Math.min(MAX_TRADE_POINTS, tradeRawPoints));

  // KYC score (0–15)
  const kycTier = user.kycStatus ?? "UNVERIFIED";
  const kycPoints = Math.min(MAX_KYC_POINTS, KYC_TIER_POINTS[kycTier] ?? 0);

  // Photo trust (0–10)
  const agreementRate = user.aiAgreementRate;
  const comparisons = user.aiAgreementCount;
  const trusted = agreementRate != null && agreementRate >= 0.9 && comparisons >= 5;
  let photoPoints = 0;
  if (trusted) {
    photoPoints = 10;
  } else if (agreementRate != null && agreementRate >= 0.8 && comparisons >= 3) {
    photoPoints = 5;
  }
  photoPoints = Math.min(MAX_PHOTO_POINTS, photoPoints);

  // Identity score (0–10): email verified + account age
  const emailVerified = user.emailVerified != null;
  const accountAgeDays = Math.floor(
    (Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000),
  );
  const agePoints = Math.min(5, Math.floor(accountAgeDays / 30)); // +1 per 30 days, max 5
  const identityPoints = Math.min(MAX_IDENTITY_POINTS, (emailVerified ? 5 : 0) + agePoints);

  // Authenticator score (0–10)
  let authScore: TrustProfile["authScore"] = null;
  let authPoints = 0;
  if (authenticator) {
    authPoints = Math.min(MAX_AUTH_POINTS, AUTH_TIER_POINTS[authenticator.tier] ?? 0);
    authScore = {
      isAuthenticator: true,
      tier: authenticator.tier,
      rating: authenticator.rating,
      verifications: authenticator.totalVerified,
      points: authPoints,
    };
  }

  // Expert score (0–5): +1 per endorsed post, max 5
  const publishedPosts = expertStats._count;
  const totalHelpful = expertStats._sum.helpfulCount ?? 0;
  const expertPoints = Math.min(MAX_EXPERT_POINTS, endorsedPostCount);

  // ─── Composite ──────────────────────────────────

  const rawComposite =
    BASE_SCORE + tradePoints + kycPoints + photoPoints + identityPoints + authPoints + expertPoints;
  const composite = user.walletFrozen ? 0 : Math.min(100, Math.max(0, rawComposite));

  return {
    userId,
    composite,
    tradeScore: {
      completed: completedTrades,
      cancelled: cancelledTrades,
      disputed: disputeCount,
      completionRate: Math.round(completionRate * 1000) / 1000,
      points: tradePoints,
    },
    kycScore: {
      tier: kycTier,
      points: kycPoints,
    },
    photoTrust: {
      agreementRate,
      comparisons,
      trusted,
      points: photoPoints,
    },
    identityScore: {
      emailVerified,
      accountAgeDays,
      points: identityPoints,
    },
    authScore,
    expertScore: {
      publishedPosts,
      endorsedPosts: endorsedPostCount,
      totalHelpful,
      points: expertPoints,
    },
    frozen: user.walletFrozen,
  };
}

/**
 * Lightweight trust score for a user — returns just the composite number (0–100).
 * Useful for batch lookups in the matching engine.
 */
export async function getTrustScore(userId: string): Promise<number> {
  const profile = await getTrustProfile(userId);
  return profile.composite;
}

/**
 * Batch load trust scores for multiple users.
 * Returns a Map of userId → composite trust score.
 */
export async function getBatchTrustScores(userIds: string[]): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  // Load in parallel batches
  const results = await Promise.all(userIds.map((id) => getTrustProfile(id)));
  for (const profile of results) {
    scores.set(profile.userId, profile.composite);
  }
  return scores;
}

// ─── Helpers ────────────────────────────────────────────

function emptyProfile(userId: string): TrustProfile {
  return {
    userId,
    composite: BASE_SCORE,
    tradeScore: { completed: 0, cancelled: 0, disputed: 0, completionRate: 0, points: 0 },
    kycScore: { tier: "UNVERIFIED", points: 0 },
    photoTrust: { agreementRate: null, comparisons: 0, trusted: false, points: 0 },
    identityScore: { emailVerified: false, accountAgeDays: 0, points: 0 },
    authScore: null,
    expertScore: { publishedPosts: 0, endorsedPosts: 0, totalHelpful: 0, points: 0 },
    frozen: false,
  };
}
