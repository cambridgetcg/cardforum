import { db } from "@/lib/db";
import { RANDOM_AUDIT_FREQUENCY } from "@/lib/constants";
import type { AuthenticatorTier } from "@/types/domain";

/**
 * After a verification is submitted, probabilistically assign a random audit.
 * A second authenticator (same region, equal or higher tier) independently
 * reviews the same card, without seeing the first result.
 *
 * Returns the audit assignment if one was created, null otherwise.
 */
export async function maybeAssignRandomAudit(assignmentId: string) {
  const assignment = await db.verificationAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      authenticator: true,
      tradeLeg: {
        include: {
          trade: true,
          haveListing: { select: { askPrice: true } },
        },
      },
    },
  });

  if (!assignment) return null;

  const tier = assignment.authenticator.tier as AuthenticatorTier;
  const frequency = RANDOM_AUDIT_FREQUENCY[tier];

  // Probabilistic selection: 1 in N chance
  if (Math.random() >= 1 / frequency) return null;

  // Find a second authenticator: same region, equal or higher tier, not the same person
  const tierPriority: AuthenticatorTier[] = ["PREMIUM", "VERIFIED", "STANDARD"];
  const minTierIndex = tierPriority.indexOf(tier);
  const eligibleTiers = tierPriority.slice(0, minTierIndex + 1);

  const auditor = await db.authenticator.findFirst({
    where: {
      id: { not: assignment.authenticatorId },
      region: assignment.authenticator.region,
      isActive: true,
      applicationStatus: "ACTIVE",
      tier: { in: eligibleTiers },
      // Exclude trade participants
      userId: { notIn: assignment.tradeLeg.trade.participantIds },
    },
    orderBy: [{ tier: "asc" }, { rating: "desc" }, { currentLoad: "asc" }],
  });

  if (!auditor) {
    // No eligible auditor in region — log and skip
    await db.authenticatorAudit.create({
      data: {
        authenticatorId: assignment.authenticatorId,
        type: "AUDIT_SKIPPED",
        details: {
          reason: "No eligible auditor in region",
          region: assignment.authenticator.region,
          originalAssignmentId: assignmentId,
        },
      },
    });
    return null;
  }

  // Create the audit assignment on the same trade leg
  // We store it as an audit record with the assignment reference
  const [auditRecord] = await db.$transaction([
    db.authenticatorAudit.create({
      data: {
        authenticatorId: assignment.authenticatorId,
        type: "RANDOM_AUDIT",
        details: {
          originalAssignmentId: assignmentId,
          auditorId: auditor.id,
          auditorUserId: auditor.userId,
          status: "PENDING",
        },
      },
    }),
    db.authenticator.update({
      where: { id: auditor.id },
      data: { currentLoad: { increment: 1 } },
    }),
  ]);

  return auditRecord;
}

/**
 * Submit the result of a random audit.
 * Compares the auditor's assessment with the original authenticator's result.
 */
export async function submitAuditResult(
  auditId: string,
  auditorUserId: string,
  result: {
    authentic: boolean;
    conditionVerified: string;
    conditionMatchesListing: boolean;
    notes: string;
    confidenceLevel: string;
  }
) {
  const audit = await db.authenticatorAudit.findUnique({
    where: { id: auditId },
  });
  if (!audit || audit.type !== "RANDOM_AUDIT") {
    throw new Error("Audit not found");
  }

  const details = audit.details as {
    originalAssignmentId: string;
    auditorId: string;
    auditorUserId: string;
    status: string;
  };

  if (details.auditorUserId !== auditorUserId) {
    throw new Error("Not authorized");
  }
  if (details.status !== "PENDING") {
    throw new Error("Audit already completed");
  }

  // Get the original result for comparison
  const original = await db.verificationAssignment.findUnique({
    where: { id: details.originalAssignmentId },
  });
  if (!original?.result) throw new Error("Original result not found");

  const originalResult = original.result as {
    authentic: boolean;
    conditionVerified: string;
    conditionMatchesListing: boolean;
  };

  // Compare results
  const aligned =
    originalResult.authentic === result.authentic &&
    originalResult.conditionVerified === result.conditionVerified;

  const updatedDetails = {
    ...details,
    status: aligned ? "PASSED" : "DIVERGENT",
    auditResult: result,
    originalResult: {
      authentic: originalResult.authentic,
      conditionVerified: originalResult.conditionVerified,
    },
    aligned,
  };

  const [updatedAudit] = await db.$transaction([
    db.authenticatorAudit.update({
      where: { id: auditId },
      data: { details: updatedDetails },
    }),
    // Decrement auditor load
    db.authenticator.update({
      where: { id: details.auditorId },
      data: { currentLoad: { decrement: 1 } },
    }),
    // If divergent, create an escalation audit record
    ...(aligned
      ? []
      : [
          db.authenticatorAudit.create({
            data: {
              authenticatorId: audit.authenticatorId,
              type: "AUDIT_ESCALATION",
              details: {
                auditId,
                reason: "Audit results diverged from original verification",
                originalAuthentic: originalResult.authentic,
                auditAuthentic: result.authentic,
                originalCondition: originalResult.conditionVerified,
                auditCondition: result.conditionVerified,
              },
            },
          }),
        ]),
  ]);

  return updatedAudit;
}
