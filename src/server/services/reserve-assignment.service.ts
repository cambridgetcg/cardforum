import { db } from "@/lib/db";
import { RESERVE_ACCEPTANCE_TIMEOUT_HOURS } from "@/lib/constants";
import type { AuthenticatorTier } from "@/types/domain";
import { AUTHENTICATOR_TIER_VALUE_CAPS } from "@/types/domain";

/**
 * Assign a reserve (backup) authenticator for a trade leg.
 * The reserve is the next-best candidate after the primary.
 * Called after primary assignment succeeds in assignForLegs.
 */
export async function assignReserveAuthenticator(tradeLegId: string) {
  const assignment = await db.verificationAssignment.findUnique({
    where: { tradeLegId },
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

  const cardValueCents = assignment.tradeLeg.haveListing?.askPrice ?? 0;
  const tierPriority: AuthenticatorTier[] = ["PREMIUM", "VERIFIED", "STANDARD"];

  // Find next-best authenticator (same criteria as primary, but exclude primary)
  const reserve = await db.authenticator.findFirst({
    where: {
      id: { not: assignment.authenticatorId },
      region: assignment.authenticator.region,
      isActive: true,
      applicationStatus: "ACTIVE",
      tier: {
        in: tierPriority.filter(
          (t) => AUTHENTICATOR_TIER_VALUE_CAPS[t] >= cardValueCents
        ),
      },
      userId: { notIn: assignment.tradeLeg.trade.participantIds },
    },
    orderBy: [{ tier: "asc" }, { rating: "desc" }, { currentLoad: "asc" }],
  });

  if (!reserve) return null; // no reserve available in region

  return db.verificationAssignment.update({
    where: { id: assignment.id },
    data: {
      reserveAuthenticatorId: reserve.id,
    },
  });
}

/**
 * Accept an assignment. The primary authenticator confirms they will process it.
 */
export async function acceptAssignment(
  assignmentId: string,
  authenticatorUserId: string
) {
  const assignment = await db.verificationAssignment.findUnique({
    where: { id: assignmentId },
    include: { authenticator: true },
  });

  if (!assignment) throw new Error("Assignment not found");
  if (assignment.authenticator.userId !== authenticatorUserId) {
    throw new Error("Not authorized");
  }
  if (assignment.acceptedAt) throw new Error("Already accepted");

  return db.verificationAssignment.update({
    where: { id: assignmentId },
    data: { acceptedAt: new Date() },
  });
}

/**
 * Check for assignments that haven't been accepted within the timeout window.
 * Reassigns to the reserve authenticator if available.
 * Designed to be called from a Vercel Cron route.
 */
export async function checkAcceptanceTimeouts() {
  const cutoff = new Date(
    Date.now() - RESERVE_ACCEPTANCE_TIMEOUT_HOURS * 60 * 60 * 1000
  );

  // Find assignments that are overdue and haven't been accepted
  const overdue = await db.verificationAssignment.findMany({
    where: {
      acceptedAt: null,
      completedAt: null,
      assignedAt: { lt: cutoff },
      reserveAuthenticatorId: { not: null },
    },
    include: {
      authenticator: true,
      reserveAuthenticator: true,
    },
  });

  const reassigned = [];

  for (const assignment of overdue) {
    if (!assignment.reserveAuthenticator) continue;

    // Reassign: swap primary and reserve
    const [updated] = await db.$transaction([
      db.verificationAssignment.update({
        where: { id: assignment.id },
        data: {
          authenticatorId: assignment.reserveAuthenticatorId!,
          reserveAuthenticatorId: null,
          assignedAt: new Date(),
          acceptedAt: null,
        },
      }),
      // Decrement old authenticator's load
      db.authenticator.update({
        where: { id: assignment.authenticatorId },
        data: { currentLoad: { decrement: 1 } },
      }),
      // Increment new authenticator's load
      db.authenticator.update({
        where: { id: assignment.reserveAuthenticatorId! },
        data: { currentLoad: { increment: 1 } },
      }),
      // Update trade leg to point to new authenticator
      db.tradeLeg.update({
        where: { id: assignment.tradeLegId },
        data: { authenticatorId: assignment.reserveAuthenticatorId },
      }),
      // Audit trail
      db.authenticatorAudit.create({
        data: {
          authenticatorId: assignment.authenticatorId,
          type: "ASSIGNMENT_TIMEOUT",
          details: {
            assignmentId: assignment.id,
            reassignedTo: assignment.reserveAuthenticatorId,
            assignedAt: assignment.assignedAt.toISOString(),
            timeoutHours: RESERVE_ACCEPTANCE_TIMEOUT_HOURS,
          },
        },
      }),
    ]);

    reassigned.push(updated);
  }

  return reassigned;
}
