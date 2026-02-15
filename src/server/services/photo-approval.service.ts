import { db } from "@/lib/db";
import type { TxClient } from "./wallet.service";
import {
  PHOTO_APPROVAL_THRESHOLD_CENTS,
  MAX_PHOTO_COUNT,
  MAX_PHOTO_SIZE_BYTES,
  MAX_PHOTO_ATTEMPTS,
} from "@/lib/constants";

/**
 * Creates a PhotoApproval record and transitions the leg to PHOTO_REVIEW
 * if the linked HaveListing's askPrice meets the threshold.
 * Called when a leg transitions to CARD_RECEIVED.
 * No-op if below threshold.
 */
export async function createPhotoApprovalIfNeeded(tradeLegId: string, tx?: TxClient) {
  const client = tx ?? db;
  const leg = await client.tradeLeg.findUnique({
    where: { id: tradeLegId },
    include: { haveListing: { select: { askPrice: true } } },
  });

  if (!leg) throw new Error("Trade leg not found");

  // Photo approval only applies to raw card legs (graded legs use slab verification)
  if (!leg.haveListing) return null;

  if (leg.haveListing.askPrice < PHOTO_APPROVAL_THRESHOLD_CENTS) {
    return null; // Below threshold — no photo gate
  }

  const photoApproval = await client.photoApproval.create({
    data: { tradeLegId },
  });
  await client.tradeLeg.update({
    where: { id: tradeLegId },
    data: { status: "PHOTO_REVIEW" },
  });

  return photoApproval;
}

/**
 * Sender uploads photos for review.
 * Validates caller is the sender (fromUserId) on the leg.
 */
export async function submitPhotos(
  tradeLegId: string,
  userId: string,
  photos: string[]
) {
  const leg = await db.tradeLeg.findUnique({
    where: { id: tradeLegId },
    include: { photoApproval: true },
  });

  if (!leg) throw new Error("Trade leg not found");
  if (!leg.photoApproval) throw new Error("No photo approval required for this leg");
  if (leg.fromUserId !== userId) throw new Error("Only the sender can upload photos");

  if (
    leg.photoApproval.status !== "PENDING_PHOTOS" &&
    leg.photoApproval.status !== "REJECTED"
  ) {
    throw new Error(`Cannot submit photos in status ${leg.photoApproval.status}`);
  }

  if (photos.length === 0 || photos.length > MAX_PHOTO_COUNT) {
    throw new Error(`Must provide 1-${MAX_PHOTO_COUNT} photos`);
  }

  for (const photo of photos) {
    // Rough size check on base64 data URL
    const sizeBytes = Math.ceil((photo.length * 3) / 4);
    if (sizeBytes > MAX_PHOTO_SIZE_BYTES) {
      throw new Error(`Each photo must be under ${MAX_PHOTO_SIZE_BYTES / (1024 * 1024)}MB`);
    }
  }

  return db.photoApproval.update({
    where: { id: leg.photoApproval.id },
    data: {
      photos,
      status: "PENDING_REVIEW",
      attempts: { increment: 1 },
      submittedAt: new Date(),
      rejectionNote: null,
    },
  });
}

/**
 * Receiver approves or rejects photos.
 * If approved: leg advances to AUTHENTICATING.
 * If rejected and max attempts reached: leg fails, trade disputes.
 */
export async function reviewPhotos(
  tradeLegId: string,
  userId: string,
  approved: boolean,
  rejectionNote?: string
) {
  const leg = await db.tradeLeg.findUnique({
    where: { id: tradeLegId },
    include: { photoApproval: true },
  });

  if (!leg) throw new Error("Trade leg not found");
  if (!leg.photoApproval) throw new Error("No photo approval required for this leg");
  if (leg.toUserId !== userId) throw new Error("Only the receiver can review photos");
  if (leg.photoApproval.status !== "PENDING_REVIEW") {
    throw new Error(`Cannot review photos in status ${leg.photoApproval.status}`);
  }

  if (approved) {
    await db.$transaction([
      db.photoApproval.update({
        where: { id: leg.photoApproval.id },
        data: { status: "APPROVED", reviewedAt: new Date() },
      }),
      db.tradeLeg.update({
        where: { id: tradeLegId },
        data: { status: "AUTHENTICATING" },
      }),
    ]);
    return { approved: true };
  }

  // Rejected
  if (leg.photoApproval.attempts >= MAX_PHOTO_ATTEMPTS) {
    // Max attempts exhausted — fail the leg and dispute the trade
    await db.$transaction([
      db.photoApproval.update({
        where: { id: leg.photoApproval.id },
        data: {
          status: "REJECTED",
          rejectionNote: rejectionNote ?? null,
          reviewedAt: new Date(),
        },
      }),
      db.tradeLeg.update({
        where: { id: tradeLegId },
        data: { status: "FAILED" },
      }),
      db.trade.update({
        where: { id: leg.tradeId },
        data: { status: "DISPUTED" },
      }),
    ]);
    return { approved: false, failed: true };
  }

  // Still has attempts left — sender can resubmit
  await db.photoApproval.update({
    where: { id: leg.photoApproval.id },
    data: {
      status: "REJECTED",
      rejectionNote: rejectionNote ?? null,
      reviewedAt: new Date(),
    },
  });

  return { approved: false, failed: false };
}

/**
 * Returns true if every leg in the trade is either:
 * - below the photo threshold (no PhotoApproval record), or
 * - has an APPROVED PhotoApproval.
 * Used as a precondition for trade → AUTHENTICATING.
 */
export async function areAllLegsPhotoCleared(tradeId: string): Promise<boolean> {
  const legs = await db.tradeLeg.findMany({
    where: { tradeId },
    include: { photoApproval: true },
  });

  return legs.every(
    (leg) => !leg.photoApproval || leg.photoApproval.status === "APPROVED"
  );
}
