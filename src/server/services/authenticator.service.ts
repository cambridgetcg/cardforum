import { db } from "@/lib/db";
import type { TxClient } from "./wallet.service";
import {
  type AuthenticatorApplicationStatus,
  type AuthenticatorTier,
  type Condition,
  canTransitionApplication,
  AUTHENTICATOR_TIER_VALUE_CAPS,
} from "@/types/domain";
import { checkTierPromotion } from "./tier-promotion.service";
import { maybeAssignRandomAudit } from "./random-audit.service";
import { forfeitAuthenticatorFee } from "./fee.service";
import { createConditionComparison } from "./condition-comparison.service";
import { assignReserveAuthenticator } from "./reserve-assignment.service";
import { verifySlabForTradeLeg } from "./slab-verification.service";
import { eventBus } from "@/server/events/event-bus";
import type {
  AuthenticatorApplicationInput,
  ApplicationReviewInput,
  VerificationResultInput,
} from "@/lib/validators";
import { assertCanApplyAsAuthenticator } from "./kyc.service";

// ─── Application Flow ──────────────────────────────────────

/**
 * Submit an authenticator application.
 * Creates the Authenticator record in SUBMITTED status.
 */
export async function submitApplication(
  userId: string,
  input: AuthenticatorApplicationInput
) {
  // KYC gate: authenticators must have Enhanced KYC
  await assertCanApplyAsAuthenticator(userId);

  // Check if user already has an authenticator record
  const existing = await db.authenticator.findUnique({
    where: { userId },
  });

  if (existing) {
    const terminal = ["ACTIVE", "ONBOARDING", "APPROVED", "PENDING_REVIEW", "SUBMITTED"];
    if (terminal.includes(existing.applicationStatus)) {
      throw new Error(
        `You already have an application in status: ${existing.applicationStatus}`
      );
    }
    // Allow re-application from REVOKED (after cooldown) or DRAFT
    if (existing.applicationStatus === "REVOKED") {
      const daysSinceRevoked = existing.updatedAt
        ? (Date.now() - existing.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
        : 0;
      if (daysSinceRevoked < 30) {
        throw new Error("Cannot reapply within 30 days of revocation");
      }
    }
  }

  if (existing) {
    return db.authenticator.update({
      where: { userId },
      data: {
        businessName: input.businessName,
        region: input.region,
        regionId: input.regionId,
        tcgExpertise: input.tcgExpertise,
        experienceDesc: input.experienceDesc,
        proofOfExpertise: input.proofOfExpertise,
        applicationStatus: "SUBMITTED",
        appliedAt: new Date(),
      },
    });
  }

  return db.authenticator.create({
    data: {
      userId,
      businessName: input.businessName,
      region: input.region,
      regionId: input.regionId,
      tcgExpertise: input.tcgExpertise,
      experienceDesc: input.experienceDesc,
      proofOfExpertise: input.proofOfExpertise,
      applicationStatus: "SUBMITTED",
      appliedAt: new Date(),
    },
  });
}

/**
 * Get the current user's authenticator profile (for dashboard).
 */
export async function getAuthenticatorProfile(userId: string) {
  return db.authenticator.findUnique({
    where: { userId },
    include: {
      user: { select: { name: true, email: true, image: true } },
      assignments: {
        where: { completedAt: null },
        include: {
          tradeLeg: {
            include: {
              haveListing: {
                select: {
                  askPrice: true,
                  condition: true,
                  card: { select: { name: true, tcg: true, setName: true } },
                },
              },
              gradedHaveListing: {
                select: {
                  askPrice: true,
                  grade: true,
                  gradingCompany: true,
                  certNumber: true,
                  card: { select: { name: true, tcg: true, setName: true } },
                },
              },
              photoApproval: { select: { photos: true, status: true } },
            },
          },
        },
        orderBy: { assignedAt: "asc" },
      },
      ratings: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
}

/**
 * List pending applications (admin endpoint).
 */
export async function listApplications(
  status?: AuthenticatorApplicationStatus
) {
  return db.authenticator.findMany({
    where: status ? { applicationStatus: status } : {
      applicationStatus: { in: ["SUBMITTED", "PENDING_REVIEW", "MORE_INFO_NEEDED"] },
    },
    include: {
      user: { select: { name: true, email: true, image: true, createdAt: true } },
    },
    orderBy: { appliedAt: "asc" },
  });
}

/**
 * Review an authenticator application (admin action).
 */
export async function reviewApplication(
  authenticatorId: string,
  reviewerId: string,
  input: ApplicationReviewInput
) {
  const authenticator = await db.authenticator.findUnique({
    where: { id: authenticatorId },
  });

  if (!authenticator) throw new Error("Authenticator not found");

  const currentStatus =
    authenticator.applicationStatus as AuthenticatorApplicationStatus;

  // Map review action to target status
  const targetStatusMap = {
    approve: "APPROVED" as const,
    reject: "REVOKED" as const,
    request_info: "MORE_INFO_NEEDED" as const,
  };
  const targetStatus = targetStatusMap[input.action];

  // Compound transition: SUBMITTED → PENDING_REVIEW → targetStatus
  // When an admin reviews a SUBMITTED application, both hops must be valid.
  if (currentStatus === "SUBMITTED") {
    if (!canTransitionApplication("SUBMITTED", "PENDING_REVIEW")) {
      throw new Error("Cannot transition from SUBMITTED to PENDING_REVIEW");
    }
    if (!canTransitionApplication("PENDING_REVIEW", targetStatus)) {
      throw new Error(
        `Cannot transition from PENDING_REVIEW to ${targetStatus}`
      );
    }
  } else {
    if (!canTransitionApplication(currentStatus, targetStatus)) {
      throw new Error(
        `Cannot transition from ${currentStatus} to ${targetStatus}`
      );
    }
  }

  const [updated] = await db.$transaction([
    db.authenticator.update({
      where: { id: authenticatorId },
      data: {
        applicationStatus: targetStatus,
        ...(input.action === "approve" ? { approvedAt: new Date() } : {}),
      },
    }),
    db.authenticatorAudit.create({
      data: {
        authenticatorId,
        type: "APPLICATION_REVIEW",
        details: {
          action: input.action,
          reviewerId,
          notes: input.notes ?? null,
          previousStatus: currentStatus,
          newStatus: targetStatus,
        },
      },
    }),
  ]);

  return updated;
}

/**
 * Activate an approved authenticator (final onboarding step).
 */
export async function activateAuthenticator(authenticatorId: string) {
  const authenticator = await db.authenticator.findUnique({
    where: { id: authenticatorId },
  });

  if (!authenticator) throw new Error("Authenticator not found");
  if (
    authenticator.applicationStatus !== "APPROVED" &&
    authenticator.applicationStatus !== "ONBOARDING"
  ) {
    throw new Error("Authenticator must be APPROVED or ONBOARDING to activate");
  }

  return db.authenticator.update({
    where: { id: authenticatorId },
    data: {
      applicationStatus: "ACTIVE",
      isActive: true,
      lastActiveAt: new Date(),
    },
  });
}

// ─── Assignment Algorithm ──────────────────────────────────

/**
 * Assign authenticators to all legs of a trade.
 * Called when trade enters AUTHENTICATING phase.
 */
export async function assignForLegs(tradeId: string, tx?: TxClient) {
  const client = tx ?? db;
  const legs = await client.tradeLeg.findMany({
    where: { tradeId },
    include: {
      haveListing: { select: { askPrice: true } },
      gradedHaveListing: { select: { askPrice: true } },
    },
  });

  const assignments = [];

  for (const leg of legs) {
    const cardValue = leg.haveListing?.askPrice
      ?? leg.gradedHaveListing?.askPrice
      ?? 0;

    const authenticator = await findBestAuthenticator(
      leg.region,
      cardValue,
      [leg.fromUserId, leg.toUserId] // exclude trade participants
    );

    if (!authenticator) {
      throw new Error(
        `No eligible authenticator available in region "${leg.region}" for card value $${(cardValue / 100).toFixed(2)}`
      );
    }

    const assignment = await client.verificationAssignment.create({
      data: {
        tradeLegId: leg.id,
        authenticatorId: authenticator.id,
      },
    });
    await client.tradeLeg.update({
      where: { id: leg.id },
      data: { authenticatorId: authenticator.id },
    });
    await client.authenticator.update({
      where: { id: authenticator.id },
      data: { currentLoad: { increment: 1 } },
    });

    assignments.push(assignment);
  }

  // Phase 4: Assign reserve authenticators for failover (non-critical, uses db directly)
  for (const assignment of assignments) {
    await assignReserveAuthenticator(assignment.tradeLegId);
  }

  return assignments;
}

/**
 * Find the best available authenticator for a region and card value.
 */
async function findBestAuthenticator(
  region: string,
  cardValueCents: number,
  excludeUserIds: string[]
) {
  // Find eligible tiers based on card value
  const eligibleTiers: AuthenticatorTier[] = [];
  for (const [tier, cap] of Object.entries(AUTHENTICATOR_TIER_VALUE_CAPS)) {
    if (cardValueCents <= cap) {
      eligibleTiers.push(tier as AuthenticatorTier);
    }
  }

  if (eligibleTiers.length === 0) return null;

  // Query active authenticators in the region
  const candidates = await db.authenticator.findMany({
    where: {
      region,
      isActive: true,
      applicationStatus: "ACTIVE",
      tier: { in: eligibleTiers },
      userId: { notIn: excludeUserIds },
    },
    orderBy: [
      // Prefer higher tiers (PREMIUM > VERIFIED > STANDARD)
      // Prisma sorts enums by declaration order, so we sort by rating as primary
      { rating: "desc" },
    ],
  });

  if (candidates.length === 0) return null;

  // Sort by: tier priority (PREMIUM > VERIFIED > STANDARD), then rating, then load
  const tierPriority: Record<string, number> = {
    PREMIUM: 3,
    VERIFIED: 2,
    STANDARD: 1,
  };

  candidates.sort((a, b) => {
    const tierDiff =
      (tierPriority[b.tier] ?? 0) - (tierPriority[a.tier] ?? 0);
    if (tierDiff !== 0) return tierDiff;

    const ratingDiff = b.rating - a.rating;
    if (Math.abs(ratingDiff) > 0.01) return ratingDiff;

    // Prefer less busy authenticators
    return a.currentLoad - b.currentLoad;
  });

  // Return the best candidate that isn't at capacity
  return (
    candidates.find((c) => c.currentLoad < c.maxLoad) ?? null
  );
}

// ─── Verification Result Processing ────────────────────────

/**
 * Submit a verification result for a trade leg.
 * Only callable by the assigned authenticator.
 */
export async function submitVerificationResult(
  assignmentId: string,
  authenticatorUserId: string,
  input: VerificationResultInput
) {
  const assignment = await db.verificationAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      authenticator: { select: { id: true, userId: true } },
      tradeLeg: {
        include: {
          trade: true,
          haveListing: { select: { condition: true } },
        },
      },
    },
  });

  if (!assignment) throw new Error("Assignment not found");
  if (assignment.authenticator.userId !== authenticatorUserId) {
    throw new Error("Not authorized — you are not the assigned authenticator");
  }
  if (assignment.completedAt) {
    throw new Error("Verification already completed");
  }
  if (assignment.tradeLeg.status !== "AUTHENTICATING") {
    throw new Error(
      `Trade leg is in status ${assignment.tradeLeg.status}, expected AUTHENTICATING`
    );
  }

  // Store the result and process it
  const result = await db.$transaction(async (tx) => {
    // 1. Save the verification result
    const updated = await tx.verificationAssignment.update({
      where: { id: assignmentId },
      data: {
        result: {
          authentic: input.authentic,
          conditionVerified: input.conditionVerified,
          conditionMatchesListing: input.conditionMatchesListing,
          notes: input.notes,
          defects: input.defects,
          confidenceLevel: input.confidenceLevel,
          slabIntact: input.slabIntact,
          certVerified: input.certVerified,
        },
        photos: input.photos,
        completedAt: new Date(),
      },
    });

    // 2. Decrement authenticator load
    await tx.authenticator.update({
      where: { id: assignment.authenticator.id },
      data: {
        currentLoad: { decrement: 1 },
        totalVerified: { increment: 1 },
        lastActiveAt: new Date(),
      },
    });

    // 3. Transition trade leg based on result
    if (input.authentic && input.conditionMatchesListing) {
      // PASS — card is authentic and condition matches
      await tx.tradeLeg.update({
        where: { id: assignment.tradeLegId },
        data: { status: "VERIFIED" },
      });

      // Check if ALL legs of the trade are now verified
      const allLegs = await tx.tradeLeg.findMany({
        where: { tradeId: assignment.tradeLeg.tradeId },
      });
      const allVerified = allLegs.every(
        (leg) =>
          leg.id === assignment.tradeLegId || leg.status === "VERIFIED"
      );

      if (allVerified) {
        // Advance trade to VERIFIED
        const trade = assignment.tradeLeg.trade;
        const statusHistory =
          (trade.statusHistory as Array<{ status: string; at: string }>) ?? [];
        statusHistory.push({
          status: "VERIFIED",
          at: new Date().toISOString(),
        });

        await tx.trade.update({
          where: { id: trade.id },
          data: { status: "VERIFIED", statusHistory },
        });
      }
    } else {
      // FAIL — card is counterfeit or condition doesn't match
      await tx.tradeLeg.update({
        where: { id: assignment.tradeLegId },
        data: { status: "FAILED" },
      });

      // Move trade to DISPUTED
      const trade = assignment.tradeLeg.trade;
      const statusHistory =
        (trade.statusHistory as Array<{ status: string; at: string }>) ?? [];
      statusHistory.push({
        status: "DISPUTED",
        at: new Date().toISOString(),
      });

      await tx.trade.update({
        where: { id: trade.id },
        data: { status: "DISPUTED", statusHistory },
      });

      // Create a dispute record
      await tx.dispute.create({
        data: {
          tradeId: trade.id,
          raisedById: assignment.authenticator.userId,
          reason: input.authentic
            ? `Condition mismatch: listed as ${assignment.tradeLeg.haveListing?.condition ?? "unknown"}, verified as ${input.conditionVerified}`
            : "Card failed authenticity verification",
          evidence: input.photos,
        },
      });
    }

    return updated;
  });

  // Post-transaction hooks:
  // Phase 2: Check tier promotion after verification
  await checkTierPromotion(assignment.authenticator.id);

  // Phase 2: Probabilistic random audit
  await maybeAssignRandomAudit(assignmentId);

  // Phase 2: AI vs Authenticator condition comparison
  await createConditionComparison(assignment.tradeLegId);

  // Phase 2: Slab verification for graded cards
  if (assignment.tradeLeg.haveListing === null) {
    // No raw haveListing means this is a graded card leg — run slab verification
    try {
      const slabResult = await verifySlabForTradeLeg(assignment.tradeLegId);
      // Merge slab result into the verification assignment result
      const existingResult = (result.result ?? {}) as Record<string, unknown>;
      const mergedResult = JSON.parse(JSON.stringify({
        ...existingResult,
        slabVerification: slabResult,
      }));
      await db.verificationAssignment.update({
        where: { id: assignmentId },
        data: { result: mergedResult },
      });
    } catch (err) {
      console.error("[authenticator] Slab verification failed (non-blocking):", err);
    }
  }

  // Phase 3: Forfeit authenticator fee on verification failure
  if (!input.authentic || !input.conditionMatchesListing) {
    await forfeitAuthenticatorFee(assignmentId, "Verification failed");
  }

  // Emit event for observability
  eventBus.emitAsync("authenticator.verified", {
    tradeLegId: assignment.tradeLegId,
    tradeId: assignment.tradeLeg.tradeId,
    authentic: input.authentic,
    conditionMatches: input.conditionMatchesListing,
  });

  return result;
}

/**
 * Get a specific verification assignment with full context.
 * Used by the authenticator verification UI.
 */
export async function getVerificationAssignment(
  assignmentId: string,
  authenticatorUserId: string
) {
  const assignment = await db.verificationAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      authenticator: { select: { userId: true } },
      tradeLeg: {
        include: {
          haveListing: {
            include: { card: true },
          },
          gradedHaveListing: {
            include: { card: true },
          },
          photoApproval: true,
        },
      },
    },
  });

  if (!assignment) throw new Error("Assignment not found");
  if (assignment.authenticator.userId !== authenticatorUserId) {
    throw new Error("Not authorized");
  }

  return assignment;
}

// ─── Region Helpers ────────────────────────────────────────

export async function listRegions() {
  return db.region.findMany({
    orderBy: [{ country: "asc" }, { name: "asc" }],
  });
}

export async function getOrCreateRegion(country: string, name: string) {
  return db.region.upsert({
    where: { country_name: { country, name } },
    update: {},
    create: { country, name },
  });
}
