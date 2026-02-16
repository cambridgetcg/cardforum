import { db } from "@/lib/db";
import { getConfig } from "@/server/services/config.service";
import { computeTimeWeightedRating } from "@/lib/authenticator-ratings";
import type { AuthenticatorTier } from "@/types/domain";

// ─── Tier Promotion ────────────────────────────────────

/**
 * Check whether an authenticator is eligible for promotion and apply it.
 * Called after each completed verification.
 */
export async function checkTierPromotion(authenticatorId: string) {
  const auth = await db.authenticator.findUnique({
    where: { id: authenticatorId },
    include: { ratings: { orderBy: { createdAt: "desc" } } },
  });
  if (!auth || auth.applicationStatus !== "ACTIVE") return null;

  const currentTier = auth.tier as AuthenticatorTier;
  const targetTier = getNextTier(currentTier);
  if (!targetTier) return null; // already PREMIUM

  const eligible = await isEligibleForTier(auth, targetTier);
  if (!eligible) return null;

  const [updated] = await db.$transaction([
    db.authenticator.update({
      where: { id: authenticatorId },
      data: { tier: targetTier },
    }),
    db.authenticatorAudit.create({
      data: {
        authenticatorId,
        type: "PROMOTION",
        details: {
          fromTier: currentTier,
          toTier: targetTier,
          totalVerified: auth.totalVerified,
          rating: auth.rating,
        },
      },
    }),
  ]);

  return updated;
}

// ─── Tier Demotion ─────────────────────────────────────

/**
 * Check whether an authenticator should be demoted.
 * Triggers: rating drop, disputes, inactivity, failed audit.
 */
export async function checkTierDemotion(authenticatorId: string) {
  const auth = await db.authenticator.findUnique({
    where: { id: authenticatorId },
    include: { ratings: { orderBy: { createdAt: "desc" } } },
  });
  if (!auth || auth.applicationStatus !== "ACTIVE") return null;

  const currentTier = auth.tier as AuthenticatorTier;
  if (currentTier === "STANDARD") return null; // can't demote below STANDARD

  const reason = await getDemotionReason(auth);
  if (!reason) return null;

  const demotedTier = currentTier === "PREMIUM" ? "VERIFIED" : "STANDARD";

  const [updated] = await db.$transaction([
    db.authenticator.update({
      where: { id: authenticatorId },
      data: { tier: demotedTier },
    }),
    db.authenticatorAudit.create({
      data: {
        authenticatorId,
        type: "DEMOTION",
        details: {
          fromTier: currentTier,
          toTier: demotedTier,
          reason,
          rating: auth.rating,
        },
      },
    }),
  ]);

  return updated;
}

// ─── Tier Eligibility Check (API) ─────────────────────

/**
 * Return the current authenticator's tier eligibility status.
 * Shows progress toward next tier and any demotion risks.
 */
export async function getTierEligibility(userId: string) {
  const auth = await db.authenticator.findUnique({
    where: { userId },
    include: { ratings: { orderBy: { createdAt: "desc" } } },
  });
  if (!auth) throw new Error("Authenticator not found");

  const currentTier = auth.tier as AuthenticatorTier;
  const effectiveRating = await computeTimeWeightedRating(auth.ratings);
  const daysSinceApproval = auth.approvedAt
    ? (Date.now() - auth.approvedAt.getTime()) / (24 * 60 * 60 * 1000)
    : 0;

  const thresholds = await getConfig("authenticator.tier_promotion_thresholds");
  const nextTier = getNextTier(currentTier);
  let nextTierProgress = null;

  if (nextTier === "VERIFIED") {
    const t = thresholds.VERIFIED;
    nextTierProgress = {
      targetTier: "VERIFIED",
      verifications: { current: auth.totalVerified, required: t.minVerifications },
      rating: { current: effectiveRating, required: t.minRating },
      daysActive: { current: Math.floor(daysSinceApproval), required: t.minDaysActive },
    };
  } else if (nextTier === "PREMIUM") {
    const t = thresholds.PREMIUM;
    nextTierProgress = {
      targetTier: "PREMIUM",
      verifications: { current: auth.totalVerified, required: t.minVerifications },
      rating: { current: effectiveRating, required: t.minRating },
      daysActive: { current: Math.floor(daysSinceApproval), required: t.minDaysActive },
      insuranceBond: { posted: !!auth.insuranceBondPaidAt, required: true },
    };
  }

  return {
    currentTier,
    effectiveRating,
    totalVerified: auth.totalVerified,
    nextTierProgress,
  };
}

// ─── Daily Tier Check (Cron) ──────────────────────────

/**
 * Run daily check for tier demotions across all active authenticators.
 * Designed to be called from a Vercel Cron route.
 */
export async function runDailyTierCheck() {
  const authenticators = await db.authenticator.findMany({
    where: {
      applicationStatus: "ACTIVE",
      tier: { not: "STANDARD" },
    },
    select: { id: true },
  });

  const results = [];
  for (const auth of authenticators) {
    const result = await checkTierDemotion(auth.id);
    if (result) results.push(result);
  }
  return results;
}

// ─── Internal Helpers ─────────────────────────────────

function getNextTier(current: AuthenticatorTier): AuthenticatorTier | null {
  if (current === "STANDARD") return "VERIFIED";
  if (current === "VERIFIED") return "PREMIUM";
  return null;
}

type AuthWithRatings = NonNullable<Awaited<ReturnType<typeof db.authenticator.findUnique>>> & {
  ratings: Array<{
    score: number;
    accuracyScore: number | null;
    speedScore: number | null;
    satisfactionScore: number | null;
    communicationScore: number | null;
    createdAt: Date;
  }>;
};

async function isEligibleForTier(
  auth: AuthWithRatings,
  targetTier: AuthenticatorTier,
): Promise<boolean> {
  const thresholds = await getConfig("authenticator.tier_promotion_thresholds");
  if (targetTier === "VERIFIED") {
    const t = thresholds.VERIFIED;
    if (auth.totalVerified < t.minVerifications) return false;

    const effectiveRating = await computeTimeWeightedRating(auth.ratings);
    if (effectiveRating < t.minRating) return false;

    const daysSinceApproval = auth.approvedAt
      ? (Date.now() - auth.approvedAt.getTime()) / (24 * 60 * 60 * 1000)
      : 0;
    if (daysSinceApproval < t.minDaysActive) return false;

    // Check disputes lost
    const disputesLost = await db.dispute.count({
      where: {
        trade: {
          legs: {
            some: { authenticatorId: auth.id },
          },
        },
        status: { in: ["RESOLVED_BUYER"] }, // resolved against the authenticator's side
      },
    });
    if (disputesLost > t.maxDisputesLost) return false;

    return true;
  }

  if (targetTier === "PREMIUM") {
    const t = thresholds.PREMIUM;
    if (auth.totalVerified < t.minVerifications) return false;

    const effectiveRating = await computeTimeWeightedRating(auth.ratings);
    if (effectiveRating < t.minRating) return false;

    const daysSinceApproval = auth.approvedAt
      ? (Date.now() - auth.approvedAt.getTime()) / (24 * 60 * 60 * 1000)
      : 0;
    if (daysSinceApproval < t.minDaysActive) return false;

    if (t.requiresInsuranceBond && !auth.insuranceBondPaidAt) return false;

    // Staff audit check: look for a passing audit in the last year
    if (t.requiresStaffAudit) {
      const staffAudit = await db.authenticatorAudit.findFirst({
        where: {
          authenticatorId: auth.id,
          type: "STAFF_AUDIT_PASSED",
          createdAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
        },
      });
      if (!staffAudit) return false;
    }

    return true;
  }

  return false;
}

async function getDemotionReason(auth: AuthWithRatings): Promise<string | null> {
  const currentTier = auth.tier as AuthenticatorTier;
  const effectiveRating = await computeTimeWeightedRating(auth.ratings);
  const thresholds = await getConfig("authenticator.tier_promotion_thresholds");
  const demotionWindowDays = await getConfig("authenticator.dispute_demotion_window_days");
  const demotionThreshold = await getConfig("authenticator.dispute_demotion_threshold");
  const inactivityDays = await getConfig("authenticator.inactivity_demotion_days");

  // Check: rating below tier minimum
  if (currentTier === "PREMIUM" && effectiveRating < thresholds.PREMIUM.minRating) {
    return `Rating dropped below ${thresholds.PREMIUM.minRating} (current: ${effectiveRating.toFixed(2)})`;
  }
  if (currentTier === "VERIFIED" && effectiveRating < thresholds.VERIFIED.minRating) {
    return `Rating dropped below ${thresholds.VERIFIED.minRating} (current: ${effectiveRating.toFixed(2)})`;
  }

  // Check: disputes exceeding threshold in window
  const windowStart = new Date(Date.now() - demotionWindowDays * 24 * 60 * 60 * 1000);
  const recentDisputes = await db.dispute.count({
    where: {
      trade: {
        legs: { some: { authenticatorId: auth.id } },
      },
      createdAt: { gte: windowStart },
    },
  });
  if (recentDisputes >= demotionThreshold) {
    return `${recentDisputes} disputes in last ${demotionWindowDays} days`;
  }

  // Check: failed audits (escalations) in window
  const failedAudits = await db.authenticatorAudit.count({
    where: {
      authenticatorId: auth.id,
      type: "AUDIT_ESCALATION",
      createdAt: { gte: windowStart },
    },
  });
  if (failedAudits >= 1) {
    return `${failedAudits} failed audit escalation(s) in last ${demotionWindowDays} days`;
  }

  // Check: inactivity
  const inactivityCutoff = new Date(Date.now() - inactivityDays * 24 * 60 * 60 * 1000);
  if (auth.lastActiveAt && auth.lastActiveAt < inactivityCutoff) {
    return `Inactive for ${inactivityDays}+ days`;
  }

  return null;
}
