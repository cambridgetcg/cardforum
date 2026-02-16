import { db } from "@/lib/db";
import { canTransition, type TradeStatus, type TradeMode } from "@/types/domain";
import { computeSettlements } from "@/server/matching/bridge-builder";
import { areAllLegsPhotoCleared, createPhotoApprovalIfNeeded } from "./photo-approval.service";
import { assignForLegs } from "./authenticator.service";
import {
  holdVerificationFees,
  releaseFeesToAuthenticators,
  debitVerificationFees,
  refundVerificationFees,
} from "./fee.service";
import { createEscrow, releaseEscrow, refundEscrow } from "./escrow.service";
import {
  holdForTrade,
  releaseFromTrade,
  refundTradeHold,
  calculateHoldAmounts,
  type TxClient,
} from "./wallet.service";
import { createTradeHolds, captureAndSettle, cancelTradeHolds } from "./marketplace-escrow.service";
import { assertCanTrade } from "./kyc.service";
import { getConfig } from "@/server/services/config.service";
import { lockShippingAddresses, initiateCardReturns } from "./shipping.service";
import { eventBus } from "@/server/events/event-bus";
import "@/server/events/subscribers";

export async function getUserTrades(userId: string) {
  return db.trade.findMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    select: {
      id: true,
      proposalId: true,
      userAId: true,
      userBId: true,
      participantIds: true,
      mode: true,
      status: true,
      statusHistory: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
      legs: {
        include: {
          photoApproval: true,
          haveListing: {
            select: {
              askPrice: true,
              card: { select: { name: true } },
            },
          },
        },
      },
      proposal: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function transitionTrade(tradeId: string, userId: string, newStatus: TradeStatus) {
  const trade = await db.trade.findUnique({ where: { id: tradeId } });

  if (!trade) throw new Error("Trade not found");
  const participants = trade.participantIds as string[];
  if (!participants.includes(userId)) {
    throw new Error("Not authorized");
  }
  const mode = (trade.mode ?? "AUTHENTICATED") as TradeMode;
  if (!canTransition(trade.status as TradeStatus, newStatus, mode)) {
    throw new Error(`Cannot transition from ${trade.status} to ${newStatus}`);
  }

  // ─── Read-only gates (outside transaction) ────────
  if (newStatus === "ACCEPTED") {
    const legs = await db.tradeLeg.findMany({
      where: { tradeId },
      include: { haveListing: { select: { askPrice: true } } },
    });
    const totalValue = legs.reduce((sum, leg) => sum + (leg.haveListing?.askPrice ?? 0), 0);
    await assertCanTrade(trade.userAId, totalValue);
    await assertCanTrade(trade.userBId, totalValue);
  }

  if (newStatus === "AUTHENTICATING" && mode === "AUTHENTICATED") {
    const cleared = await areAllLegsPhotoCleared(tradeId);
    if (!cleared) {
      throw new Error("Not all legs have passed photo approval");
    }
  }

  // For DIRECT trades, ensure all Stripe payments are authorized before completion
  if (newStatus === "COMPLETED" && mode === "DIRECT") {
    const pendingPayments = await db.tradePayment.findMany({
      where: { tradeId, status: { notIn: ["AUTHORIZED", "CAPTURED"] } },
    });
    if (pendingPayments.length > 0) {
      throw new Error("Not all trade payments are authorized — cannot complete trade");
    }
  }

  // ─── All mutations in a single transaction ────────
  let autoNextStatus: TradeStatus | null = null;

  const updated = await db.$transaction(async (tx: TxClient) => {
    const statusHistory = (trade.statusHistory as Array<{ status: string; at: string }>) ?? [];
    statusHistory.push({ status: newStatus, at: new Date().toISOString() });

    // ─── ACCEPTED: deactivate consumed listings ───
    if (newStatus === "ACCEPTED") {
      await deactivateConsumedListings(tradeId, tx);
    }

    // ─── ESCROWED: lock addresses + hold funds ───
    if (newStatus === "ESCROWED") {
      await lockShippingAddresses(tradeId, tx);

      if (mode === "DIRECT") {
        // Marketplace model: Stripe PaymentIntents (outside transaction — Stripe calls)
        // Hold creation happens after the DB transaction commits (see below).
      } else {
        // AUTHENTICATED mode: wallet-based holds (legacy, until BaaS integration)
        const totalHold = await holdWalletFunds(tradeId, tx);
        await createEscrow(tradeId, totalHold, "USD", tx);
      }
    }

    // ─── Status update ───
    const result = await tx.trade.update({
      where: { id: tradeId },
      data: {
        status: newStatus,
        statusHistory,
        ...(newStatus === "COMPLETED" ? { completedAt: new Date() } : {}),
      },
    });

    // ─── CARDS_SUBMITTED: create photo approvals ───
    if (newStatus === "CARDS_SUBMITTED") {
      const legs = await tx.tradeLeg.findMany({ where: { tradeId } });
      for (const leg of legs) {
        await createPhotoApprovalIfNeeded(leg.id, tx);
      }
    }

    // ─── AUTHENTICATING: assign + hold/debit verification fees ───
    if (newStatus === "AUTHENTICATING" && mode === "AUTHENTICATED") {
      await assignForLegs(tradeId, tx);
      await holdVerificationFees(tradeId, tx);
      await debitVerificationFees(tradeId, tx);
    }

    // ─── DISPUTED: create dispute ───
    if (newStatus === "DISPUTED") {
      await tx.dispute.create({
        data: {
          tradeId,
          raisedById: userId,
          reason: "Trade disputed by participant",
          status: "OPEN",
        },
      });
    }

    // ─── COMPLETED: settle funds + release fees + release escrow ───
    if (newStatus === "COMPLETED") {
      if (mode === "DIRECT") {
        // Marketplace model: Stripe capture + transfer (outside transaction — Stripe calls)
        // Settlement happens after the DB transaction commits (see below).
      } else {
        // AUTHENTICATED mode: wallet-based settlement (legacy)
        await settleWalletFunds(tradeId, tx);
        await releaseFeesToAuthenticators(tradeId, tx);
        const tradeWithEscrow = await tx.trade.findUnique({
          where: { id: tradeId },
          select: { escrow: { select: { id: true } } },
        });
        if (tradeWithEscrow?.escrow) {
          await releaseEscrow(tradeWithEscrow.escrow.id, tx);
        }
      }
    }

    // ─── CANCELLED: refund holds + refund fees + return cards + refund escrow ───
    if (newStatus === "CANCELLED") {
      if (mode === "DIRECT") {
        // Marketplace model: cancel PaymentIntents (outside transaction — Stripe calls)
        // Cancellation happens after the DB transaction commits (see below).
      } else {
        // AUTHENTICATED mode: wallet-based refunds (legacy)
        await refundWalletHolds(tradeId, tx);
        await refundVerificationFees(tradeId, tx);
        await initiateCardReturns(tradeId, tx);
        const tradeWithEscrow = await tx.trade.findUnique({
          where: { id: tradeId },
          select: { escrow: { select: { id: true } } },
        });
        if (tradeWithEscrow?.escrow) {
          await refundEscrow(tradeWithEscrow.escrow.id, "Trade cancelled", tx);
        }
      }
    }

    // ─── Auto-transition detection ───
    // Set flags for cascading transitions that happen AFTER this transaction commits.
    if (newStatus === "ACCEPTED") {
      autoNextStatus = "ESCROWED";
    }

    if (newStatus === "CARDS_SUBMITTED") {
      // If all legs pass photo check (below threshold or already approved), auto-advance
      const legs = await tx.tradeLeg.findMany({
        where: { tradeId },
        include: {
          photoApproval: { select: { status: true } },
          haveListing: { select: { askPrice: true } },
        },
      });
      const photoThreshold = await getConfig("thresholds.photo_approval_cents");
      const allCleared = legs.every(
        (leg) =>
          !leg.haveListing ||
          leg.haveListing.askPrice < photoThreshold ||
          leg.photoApproval?.status === "APPROVED",
      );
      if (allCleared && mode === "AUTHENTICATED") {
        autoNextStatus = "AUTHENTICATING";
      }
    }

    return result;
  });

  // ─── Stripe marketplace operations (outside DB transaction) ───
  // These call external Stripe APIs and must happen after DB commit.
  // On failure, we compensate by reverting the DB state.
  if (mode === "DIRECT") {
    if (newStatus === "ESCROWED") {
      try {
        await createTradeHolds(tradeId);
      } catch (stripeErr) {
        // Stripe hold creation failed — revert trade back to ACCEPTED
        const revertHistory =
          (updated.statusHistory as Array<{ status: string; at: string }>) ?? [];
        revertHistory.push({
          status: "ACCEPTED",
          at: new Date().toISOString(),
          // @ts-expect-error — extra metadata for audit trail
          revertReason: `Stripe hold creation failed: ${stripeErr instanceof Error ? stripeErr.message : "unknown"}`,
        });
        await db.trade.update({
          where: { id: tradeId },
          data: { status: "ACCEPTED", statusHistory: revertHistory },
        });
        throw new Error(
          `Trade payment hold failed. Trade reverted to ACCEPTED. ${stripeErr instanceof Error ? stripeErr.message : ""}`,
        );
      }
    }
    if (newStatus === "COMPLETED") {
      try {
        await captureAndSettle(tradeId);
      } catch (stripeErr) {
        // Capture/settle failed — mark trade for manual reconciliation
        // Do NOT revert to a previous state (funds may be partially captured)
        await db.trade.update({
          where: { id: tradeId },
          data: {
            statusHistory: [
              ...((updated.statusHistory as Array<{ status: string; at: string }>) ?? []),
              {
                status: "SETTLEMENT_FAILED",
                at: new Date().toISOString(),
                error: stripeErr instanceof Error ? stripeErr.message : "unknown",
              },
            ],
          },
        });
        throw new Error(
          `Trade settlement failed and requires manual reconciliation. ${stripeErr instanceof Error ? stripeErr.message : ""}`,
        );
      }
    }
    if (newStatus === "CANCELLED") {
      try {
        await cancelTradeHolds(tradeId);
      } catch (stripeErr) {
        // Cancel failed — log but don't block (holds will auto-expire)
        console.error(`[trade] Failed to cancel Stripe holds for trade ${tradeId}:`, stripeErr);
      }
    }
  }

  // ─── Event emissions (fire-and-forget, after all mutations) ───
  const previousStatus = trade.status as string;
  eventBus.emitAsync("trade.status_changed", {
    tradeId,
    from: previousStatus,
    to: newStatus,
    userId,
  });

  if (newStatus === "COMPLETED") {
    eventBus.emitAsync("trade.completed", {
      tradeId,
      participantIds: trade.participantIds as string[],
    });
  }

  if (newStatus === "CANCELLED") {
    eventBus.emitAsync("trade.cancelled", {
      tradeId,
      reason: "Trade cancelled by participant",
      cancelledBy: userId,
    });
  }

  // ─── Cascading auto-transitions (outside transaction) ───
  // These re-enter transitionTrade recursively for the next state.
  if (autoNextStatus && canTransition(newStatus, autoNextStatus, mode)) {
    try {
      return await transitionTrade(tradeId, userId, autoNextStatus);
    } catch {
      // Auto-transition failed (e.g., insufficient balance for ESCROWED).
      // The original transition still succeeded — return that result.
      return updated;
    }
  }

  return updated;
}

// ─── Wallet Helpers ──────────────────────────────────────

interface TradeLegForWallet {
  fromUserId: string;
  toUserId: string;
  askPrice: number;
}

async function loadTradeLegs(
  tradeId: string,
  client: TxClient | typeof db = db,
): Promise<TradeLegForWallet[]> {
  const legs = await client.tradeLeg.findMany({
    where: { tradeId },
    include: {
      haveListing: { select: { askPrice: true } },
      gradedHaveListing: { select: { askPrice: true } },
      sealedHaveListing: { select: { askPrice: true } },
    },
  });

  return legs.map((leg) => ({
    fromUserId: leg.fromUserId,
    toUserId: leg.toUserId,
    askPrice:
      leg.haveListing?.askPrice ??
      leg.gradedHaveListing?.askPrice ??
      leg.sealedHaveListing?.askPrice ??
      0,
  }));
}

/**
 * Deactivate all listings consumed by a trade's legs.
 * Handles raw, graded, and sealed listing types.
 * Used by both manual ACCEPTED transition and auto-accept in matching.service.
 */
export async function deactivateConsumedListings(tradeId: string, tx: TxClient) {
  const legs = await tx.tradeLeg.findMany({
    where: { tradeId },
    select: {
      haveListingId: true,
      wantListingId: true,
      gradedHaveListingId: true,
      gradedWantListingId: true,
      sealedHaveListingId: true,
      sealedWantListingId: true,
    },
  });

  const rawHaveIds = legs.map((l) => l.haveListingId).filter(Boolean) as string[];
  const rawWantIds = legs.map((l) => l.wantListingId).filter(Boolean) as string[];
  const gradedHaveIds = legs.map((l) => l.gradedHaveListingId).filter(Boolean) as string[];
  const gradedWantIds = legs.map((l) => l.gradedWantListingId).filter(Boolean) as string[];
  const sealedHaveIds = legs.map((l) => l.sealedHaveListingId).filter(Boolean) as string[];
  const sealedWantIds = legs.map((l) => l.sealedWantListingId).filter(Boolean) as string[];

  const ops: Promise<unknown>[] = [];

  if (rawHaveIds.length > 0)
    ops.push(
      tx.haveListing.updateMany({ where: { id: { in: rawHaveIds } }, data: { isActive: false } }),
    );
  if (rawWantIds.length > 0)
    ops.push(
      tx.wantListing.updateMany({ where: { id: { in: rawWantIds } }, data: { isActive: false } }),
    );
  if (gradedHaveIds.length > 0)
    ops.push(
      tx.gradedHaveListing.updateMany({
        where: { id: { in: gradedHaveIds } },
        data: { isActive: false },
      }),
    );
  if (gradedWantIds.length > 0)
    ops.push(
      tx.gradedWantListing.updateMany({
        where: { id: { in: gradedWantIds } },
        data: { isActive: false },
      }),
    );
  if (sealedHaveIds.length > 0)
    ops.push(
      tx.sealedHaveListing.updateMany({
        where: { id: { in: sealedHaveIds } },
        data: { isActive: false },
      }),
    );
  if (sealedWantIds.length > 0)
    ops.push(
      tx.sealedWantListing.updateMany({
        where: { id: { in: sealedWantIds } },
        data: { isActive: false },
      }),
    );

  await Promise.all(ops);
}

function toBridgeLegs(legs: TradeLegForWallet[]) {
  return legs.map((l, i) => ({
    fromUserId: l.fromUserId,
    toUserId: l.toUserId,
    cardId: "",
    region: "",
    haveListingId: "",
    wantListingId: "",
    condition: "",
    language: "",
    askPrice: l.askPrice,
    sequence: i,
  }));
}

/**
 * Hold funds from each participant's wallet when trade enters ESCROWED.
 * hold = max(netSettlement, 0) + sellerFees
 * Returns total held amount (for escrow creation).
 *
 * When called with an outer transaction client, joins that transaction.
 * Otherwise creates its own transaction to ensure all holds are atomic.
 */
async function holdWalletFunds(tradeId: string, tx?: TxClient): Promise<number> {
  const client = tx ?? db;
  const legs = await loadTradeLegs(tradeId, client);
  const bridgeLegs = toBridgeLegs(legs);
  const settlements = computeSettlements(bridgeLegs);
  const holds = await calculateHoldAmounts(legs, settlements);

  const execute = async (innerTx: TxClient) => {
    let totalHeld = 0;
    for (const [userId, holdAmount] of holds) {
      if (holdAmount > 0) {
        await holdForTrade(userId, tradeId, holdAmount, innerTx);
        totalHeld += holdAmount;
      }
    }
    return totalHeld;
  };

  if (tx) return execute(tx);
  return db.$transaction((innerTx: TxClient) => execute(innerTx));
}

/**
 * Settle wallet balances when trade completes.
 *
 * Only release settlement credits — seller fees are NOT captured as separate
 * transactions because they are already implicitly captured in the hold:
 *
 *   hold = max(net, 0) + sellerFees
 *
 * At settlement, users with negative net (owed money) receive TRADE_RELEASE.
 * The unreleased portion of each user's hold IS their seller fee — it stays
 * deducted from their balance permanently, which is the platform's revenue.
 *
 *   Positive-net user: hold = net + fees. Release = 0. Retained = net + fees.
 *     → net portion settles their debt (funds other users' releases).
 *     → fees portion is platform revenue. ✓
 *
 *   Negative-net user: hold = 0 + fees. Release = |net|. Retained = fees.
 *     → Release credits them the settlement they're owed.
 *     → fees portion is platform revenue. ✓
 */
async function settleWalletFunds(tradeId: string, tx?: TxClient) {
  const client = tx ?? db;
  const legs = await loadTradeLegs(tradeId, client);
  const bridgeLegs = toBridgeLegs(legs);
  const settlements = computeSettlements(bridgeLegs);

  const execute = async (innerTx: TxClient) => {
    for (const [userId, net] of settlements) {
      // Credit users who are owed money (negative net = sent higher-value card)
      if (net < 0) {
        await releaseFromTrade(userId, tradeId, Math.abs(net), innerTx);
      }
    }
  };

  if (tx) return execute(tx);
  await db.$transaction((innerTx: TxClient) => execute(innerTx));
}

/**
 * Refund all wallet holds for a cancelled trade.
 */
async function refundWalletHolds(tradeId: string, tx?: TxClient) {
  const client = tx ?? db;
  const holdTxns = await client.walletTransaction.findMany({
    where: { tradeId, type: "TRADE_HOLD" },
  });

  const execute = async (innerTx: TxClient) => {
    for (const txn of holdTxns) {
      // TRADE_HOLD amounts are negative; refund the absolute value
      await refundTradeHold(txn.userId, tradeId, Math.abs(txn.amount), innerTx);
    }
  };

  if (tx) return execute(tx);
  await db.$transaction((innerTx: TxClient) => execute(innerTx));
}

/**
 * Upgrade a DIRECT trade to AUTHENTICATED mode.
 * Can only be done before escrow (PROPOSED or ACCEPTED status).
 */
export async function requestAuthentication(tradeId: string, userId: string) {
  const trade = await db.trade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error("Trade not found");
  if ((trade.mode ?? "AUTHENTICATED") !== "DIRECT") {
    throw new Error("Trade is already authenticated");
  }
  if (!["PROPOSED", "ACCEPTED"].includes(trade.status)) {
    throw new Error("Can only request authentication before escrow");
  }
  if (trade.userAId !== userId && trade.userBId !== userId) {
    throw new Error("Not authorized");
  }

  return db.trade.update({
    where: { id: tradeId },
    data: { mode: "AUTHENTICATED" },
  });
}
