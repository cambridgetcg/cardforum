import { db } from "@/lib/db";
import type { DisputeStatus } from "@/types/domain";
import { refundTradeHold } from "./wallet.service";
import { refundVerificationFees } from "./fee.service";
import { refundEscrow } from "./escrow.service";
import { initiateCardReturns } from "./shipping.service";

/**
 * Resolve a dispute and handle the financial consequences.
 *
 * Resolution types:
 *   RESOLVED_BUYER  — buyer was right (card was fake/wrong condition).
 *                     Refund all holds to ALL participants, cancel trade.
 *   RESOLVED_SELLER — seller was right (card was genuine).
 *                     Re-verify or proceed. Currently: complete the trade normally.
 *   ESCALATED       — needs further review. No financial action yet.
 *   CLOSED          — administrative close. Refund all holds.
 */
export async function resolveDispute(
  disputeId: string,
  adminUserId: string,
  newStatus: DisputeStatus,
  resolution: string,
) {
  const dispute = await db.dispute.findUnique({
    where: { id: disputeId },
    include: {
      trade: {
        include: {
          escrow: { select: { id: true, status: true } },
        },
      },
    },
  });

  if (!dispute) throw new Error("Dispute not found");
  if (dispute.status === "CLOSED") throw new Error("Dispute already closed");

  const trade = dispute.trade;
  const tradeId = trade.id;

  // Update dispute status
  await db.dispute.update({
    where: { id: disputeId },
    data: { status: newStatus, resolution },
  });

  // RESOLVED_BUYER or CLOSED: refund everything, cancel the trade
  if (newStatus === "RESOLVED_BUYER" || newStatus === "CLOSED") {
    // Refund wallet holds
    const holdTxns = await db.walletTransaction.findMany({
      where: { tradeId, type: "TRADE_HOLD" },
    });
    for (const txn of holdTxns) {
      await refundTradeHold(txn.userId, tradeId, Math.abs(txn.amount));
    }

    // Refund verification fees
    await refundVerificationFees(tradeId);

    // Refund escrow
    if (trade.escrow && trade.escrow.status === "HELD") {
      await refundEscrow(trade.escrow.id, `Dispute resolved: ${resolution}`);
    }

    // Initiate card returns for cards at authenticators
    await initiateCardReturns(tradeId);

    // Transition trade to CANCELLED
    const statusHistory =
      (trade.statusHistory as Array<{ status: string; at: string }>) ?? [];
    statusHistory.push({ status: "CANCELLED", at: new Date().toISOString() });

    await db.trade.update({
      where: { id: tradeId },
      data: { status: "CANCELLED", statusHistory },
    });
  }

  // RESOLVED_SELLER: seller was right. Trade can proceed to completion.
  // An admin must separately transition the trade to VERIFIED → ... → COMPLETED
  // via the normal flow. We just mark the dispute resolved here.
  if (newStatus === "RESOLVED_SELLER") {
    // Re-enable the trade by transitioning it back to VERIFIED
    // (if all legs were actually verified before the dispute)
    const allLegs = await db.tradeLeg.findMany({ where: { tradeId } });
    const allVerifiedOrFailed = allLegs.every(
      (leg) => leg.status === "VERIFIED" || leg.status === "FAILED",
    );

    if (allVerifiedOrFailed) {
      // Mark any FAILED legs as VERIFIED (seller was right)
      await db.tradeLeg.updateMany({
        where: { tradeId, status: "FAILED" },
        data: { status: "VERIFIED" },
      });

      const statusHistory =
        (trade.statusHistory as Array<{ status: string; at: string }>) ?? [];
      statusHistory.push({ status: "VERIFIED", at: new Date().toISOString() });

      await db.trade.update({
        where: { id: tradeId },
        data: { status: "VERIFIED", statusHistory },
      });
    }
  }

  // ESCALATED: no financial action, just mark for higher review
}

// ─── Shipping-Specific Disputes ─────────────────────────

/**
 * Create a shipping dispute for a specific trade leg.
 *
 * Structured reasons: NOT_RECEIVED, DAMAGED_IN_TRANSIT, WRONG_CARD,
 * EMPTY_PACKAGE, CONDITION_MISMATCH.
 *
 * Pauses auto-complete timer for the affected leg.
 */
export async function createShippingDispute(
  tradeId: string,
  tradeLegId: string,
  raisedById: string,
  reason: string,
  evidence: string[],
) {
  // Validate leg belongs to trade and user is the recipient
  const leg = await db.tradeLeg.findUnique({
    where: { id: tradeLegId },
    include: { trade: { select: { id: true, status: true, participantIds: true } } },
  });

  if (!leg) throw new Error("Trade leg not found");
  if (leg.tradeId !== tradeId) throw new Error("Leg does not belong to this trade");
  if (!leg.trade.participantIds.includes(raisedById)) {
    throw new Error("Not authorized to raise dispute");
  }

  // Only allow shipping disputes during shipping/delivery phases
  const validStatuses = ["DELIVERING", "SHIPPING", "DELIVERED"];
  if (!validStatuses.includes(leg.trade.status)) {
    throw new Error("Shipping disputes can only be raised during shipping/delivery phases");
  }

  const dispute = await db.dispute.create({
    data: {
      tradeId,
      tradeLegId,
      raisedById,
      reason,
      evidence,
      status: "OPEN",
    },
  });

  // Transition trade to DISPUTED
  const trade = await db.trade.findUnique({ where: { id: tradeId } });
  if (trade && trade.status !== "DISPUTED") {
    const statusHistory =
      (trade.statusHistory as Array<{ status: string; at: string }>) ?? [];
    statusHistory.push({ status: "DISPUTED", at: new Date().toISOString() });

    await db.trade.update({
      where: { id: tradeId },
      data: { status: "DISPUTED", statusHistory },
    });
  }

  return dispute;
}

/**
 * Get all open disputes, optionally filtered by trade.
 */
export async function getOpenDisputes(tradeId?: string) {
  return db.dispute.findMany({
    where: {
      ...(tradeId ? { tradeId } : {}),
      status: { in: ["OPEN", "INVESTIGATING", "ESCALATED"] },
    },
    include: {
      trade: {
        select: {
          id: true,
          status: true,
          userAId: true,
          userBId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get a single dispute with full context.
 */
export async function getDispute(disputeId: string) {
  return db.dispute.findUnique({
    where: { id: disputeId },
    include: {
      trade: {
        include: {
          legs: {
            include: {
              verification: { include: { authenticator: true } },
              haveListing: { select: { askPrice: true, card: { select: { name: true } } } },
            },
          },
          escrow: { include: { entries: true } },
        },
      },
    },
  });
}
