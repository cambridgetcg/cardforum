import { db } from "@/lib/db";
import {
  type KYCStatus,
  canTransitionKYC,
  getKYCLevel,
  kycLevelMeetsMinimum,
} from "@/types/domain";
import {
  KYC_BASIC_LISTING_CAP_CENTS,
  KYC_BASIC_TRADE_CAP_CENTS,
} from "@/lib/constants";
import type { SubmitBasicKYCInput, SubmitEnhancedKYCInput, ReviewKYCInput } from "@/lib/validators";

// ─── User-Facing ─────────────────────────────────────

/**
 * Submit basic KYC (government ID + selfie).
 * Transitions user from UNVERIFIED or BASIC_REJECTED → BASIC_PENDING.
 */
export async function submitBasicKYC(
  userId: string,
  input: SubmitBasicKYCInput,
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const from = user.kycStatus as KYCStatus;

  if (from !== "UNVERIFIED" && from !== "BASIC_REJECTED") {
    throw new Error(
      `Cannot submit basic KYC from status: ${from}. Must be UNVERIFIED or BASIC_REJECTED.`,
    );
  }

  const to: KYCStatus = "BASIC_PENDING";
  if (!canTransitionKYC(from, to)) {
    throw new Error(`Invalid KYC transition: ${from} → ${to}`);
  }

  return db.$transaction(async (tx) => {
    // Create document records
    for (const doc of input.documents) {
      await tx.kYCDocument.create({
        data: {
          userId,
          type: doc.type,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          storageKey: doc.storageKey,
        },
      });
    }

    // Transition status
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        kycStatus: to,
        kycTierChangedAt: new Date(),
        kycRejectionReason: null, // clear previous rejection
      },
    });

    // Audit trail
    await tx.kYCAudit.create({
      data: {
        userId,
        action: "SUBMIT_BASIC",
        fromStatus: from,
        toStatus: to,
        details: { documentCount: input.documents.length },
      },
    });

    return updated;
  });
}

/**
 * Submit enhanced KYC (proof of address + optional bank verification).
 * Transitions user from BASIC_VERIFIED or ENHANCED_REJECTED → ENHANCED_PENDING.
 */
export async function submitEnhancedKYC(
  userId: string,
  input: SubmitEnhancedKYCInput,
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const from = user.kycStatus as KYCStatus;

  if (from !== "BASIC_VERIFIED" && from !== "ENHANCED_REJECTED") {
    throw new Error(
      `Cannot submit enhanced KYC from status: ${from}. Must be BASIC_VERIFIED or ENHANCED_REJECTED.`,
    );
  }

  const to: KYCStatus = "ENHANCED_PENDING";
  if (!canTransitionKYC(from, to)) {
    throw new Error(`Invalid KYC transition: ${from} → ${to}`);
  }

  return db.$transaction(async (tx) => {
    for (const doc of input.documents) {
      await tx.kYCDocument.create({
        data: {
          userId,
          type: doc.type,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          storageKey: doc.storageKey,
        },
      });
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        kycStatus: to,
        kycTierChangedAt: new Date(),
        kycRejectionReason: null,
      },
    });

    await tx.kYCAudit.create({
      data: {
        userId,
        action: "SUBMIT_ENHANCED",
        fromStatus: from,
        toStatus: to,
        details: { documentCount: input.documents.length },
      },
    });

    return updated;
  });
}

/**
 * Get KYC status and documents for a user.
 */
export async function getKYCStatus(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      kycStatus: true,
      kycVerifiedAt: true,
      kycRejectionReason: true,
      kycDocuments: {
        select: {
          id: true,
          type: true,
          status: true,
          fileName: true,
          createdAt: true,
          rejectionReason: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return {
    status: user.kycStatus as KYCStatus,
    verifiedAt: user.kycVerifiedAt,
    rejectionReason: user.kycRejectionReason,
    documents: user.kycDocuments,
  };
}

// ─── Admin-Facing ────────────────────────────────────

/**
 * List users with pending KYC submissions.
 */
export async function listPendingKYC(
  statusFilter?: "BASIC_PENDING" | "ENHANCED_PENDING",
) {
  const where = statusFilter
    ? { kycStatus: statusFilter }
    : { kycStatus: { in: ["BASIC_PENDING" as const, "ENHANCED_PENDING" as const] } };

  return db.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      region: true,
      createdAt: true,
      kycStatus: true,
      kycDocuments: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "asc" }, // oldest submissions first
  });
}

/**
 * Approve or reject a KYC submission.
 */
export async function reviewKYC(
  userId: string,
  reviewerId: string,
  input: ReviewKYCInput,
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const from = user.kycStatus as KYCStatus;

  // Determine target status
  let to: KYCStatus;
  if (input.action === "approve") {
    if (from === "BASIC_PENDING") to = "BASIC_VERIFIED";
    else if (from === "ENHANCED_PENDING") to = "ENHANCED_VERIFIED";
    else throw new Error(`Cannot approve from status: ${from}`);
  } else {
    if (from === "BASIC_PENDING") to = "BASIC_REJECTED";
    else if (from === "ENHANCED_PENDING") to = "ENHANCED_REJECTED";
    else throw new Error(`Cannot reject from status: ${from}`);
  }

  if (!canTransitionKYC(from, to)) {
    throw new Error(`Invalid KYC transition: ${from} → ${to}`);
  }

  return db.$transaction(async (tx) => {
    // Update all pending documents for this user
    const docStatus = input.action === "approve" ? "APPROVED" : "REJECTED";
    await tx.kYCDocument.updateMany({
      where: { userId, status: "PENDING" },
      data: {
        status: docStatus,
        ...(input.action === "approve"
          ? { verifiedAt: new Date(), verifiedBy: reviewerId }
          : { rejectedAt: new Date(), rejectionReason: input.reason }),
      },
    });

    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        kycStatus: to,
        kycTierChangedAt: new Date(),
        kycReviewedBy: reviewerId,
        ...(input.action === "approve"
          ? { kycVerifiedAt: new Date(), kycRejectionReason: null }
          : { kycRejectionReason: input.reason }),
      },
    });

    await tx.kYCAudit.create({
      data: {
        userId,
        action: input.action === "approve" ? "APPROVE" : "REJECT",
        fromStatus: from,
        toStatus: to,
        reason: input.reason,
        reviewedBy: reviewerId,
      },
    });

    return updated;
  });
}

/**
 * Suspend a verified user's KYC.
 */
export async function suspendKYC(
  userId: string,
  reviewerId: string,
  reason: string,
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const from = user.kycStatus as KYCStatus;

  if (from !== "BASIC_VERIFIED" && from !== "ENHANCED_VERIFIED") {
    throw new Error(`Cannot suspend from status: ${from}. Must be verified.`);
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        kycStatus: "SUSPENDED",
        kycTierChangedAt: new Date(),
        kycReviewedBy: reviewerId,
      },
    });

    await tx.kYCAudit.create({
      data: {
        userId,
        action: "SUSPEND",
        fromStatus: from,
        toStatus: "SUSPENDED",
        reason,
        reviewedBy: reviewerId,
      },
    });

    return updated;
  });
}

/**
 * Revoke a suspended user's KYC (terminal state).
 */
export async function revokeKYC(
  userId: string,
  reviewerId: string,
  reason: string,
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const from = user.kycStatus as KYCStatus;

  if (from !== "SUSPENDED") {
    throw new Error(`Cannot revoke from status: ${from}. Must be SUSPENDED.`);
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        kycStatus: "REVOKED",
        kycTierChangedAt: new Date(),
        kycReviewedBy: reviewerId,
      },
    });

    await tx.kYCAudit.create({
      data: {
        userId,
        action: "REVOKE",
        fromStatus: from,
        toStatus: "REVOKED",
        reason,
        reviewedBy: reviewerId,
      },
    });

    return updated;
  });
}

/**
 * Reinstate a suspended user to their previous verified status.
 */
export async function reinstateKYC(
  userId: string,
  reviewerId: string,
  toStatus: "BASIC_VERIFIED" | "ENHANCED_VERIFIED",
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const from = user.kycStatus as KYCStatus;

  if (from !== "SUSPENDED") {
    throw new Error(`Cannot reinstate from status: ${from}. Must be SUSPENDED.`);
  }

  if (!canTransitionKYC(from, toStatus)) {
    throw new Error(`Invalid KYC transition: ${from} → ${toStatus}`);
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        kycStatus: toStatus,
        kycTierChangedAt: new Date(),
        kycReviewedBy: reviewerId,
        kycVerifiedAt: new Date(),
      },
    });

    await tx.kYCAudit.create({
      data: {
        userId,
        action: "REINSTATE",
        fromStatus: from,
        toStatus: toStatus,
        reviewedBy: reviewerId,
      },
    });

    return updated;
  });
}

// ─── Gate Functions ──────────────────────────────────

/**
 * Get the effective KYC level for a user.
 */
export async function getUserKYCLevel(
  userId: string,
): Promise<"UNVERIFIED" | "BASIC" | "ENHANCED"> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { kycStatus: true },
  });
  return getKYCLevel(user.kycStatus as KYCStatus);
}

/**
 * Assert that a user can create a listing at the given price.
 * BASIC KYC required for ≤$500, ENHANCED for >$500.
 */
export async function assertCanCreateListing(
  userId: string,
  askPriceCents: number,
) {
  const level = await getUserKYCLevel(userId);

  if (level === "UNVERIFIED") {
    throw new Error("KYC verification required to create listings. Please complete Basic KYC.");
  }

  if (askPriceCents > KYC_BASIC_LISTING_CAP_CENTS && !kycLevelMeetsMinimum(level, "ENHANCED")) {
    throw new Error(
      `Listings over $${KYC_BASIC_LISTING_CAP_CENTS / 100} require Enhanced KYC verification.`,
    );
  }
}

/**
 * Assert that a user can participate in a trade at the given value.
 * BASIC KYC required for ≤$1,000, ENHANCED for >$1,000.
 */
export async function assertCanTrade(
  userId: string,
  tradeValueCents: number,
) {
  const level = await getUserKYCLevel(userId);

  if (level === "UNVERIFIED") {
    throw new Error("KYC verification required to trade. Please complete Basic KYC.");
  }

  if (tradeValueCents > KYC_BASIC_TRADE_CAP_CENTS && !kycLevelMeetsMinimum(level, "ENHANCED")) {
    throw new Error(
      `Trades over $${KYC_BASIC_TRADE_CAP_CENTS / 100} require Enhanced KYC verification.`,
    );
  }
}

/**
 * Assert that a user can apply as an authenticator.
 * Requires ENHANCED KYC — authenticators handle custody and shipping.
 */
export async function assertCanApplyAsAuthenticator(userId: string) {
  const level = await getUserKYCLevel(userId);

  if (!kycLevelMeetsMinimum(level, "ENHANCED")) {
    throw new Error(
      "Enhanced KYC verification required to apply as an authenticator.",
    );
  }
}
