import { assertNewTradeHoldsAllowed } from "@/lib/commerce-policy";
/**
 * Marketplace Escrow Service
 *
 * Replaces wallet-based escrow with Stripe PaymentIntents for the
 * marketplace model (Path C). Money never touches CardForum — Stripe
 * holds authorized funds and transfers directly to sellers.
 *
 * Flow:
 *   ESCROWED  → createTradeHolds()   → PaymentIntents (manual capture) per user
 *   COMPLETED → captureAndSettle()   → Capture PIs + Transfer to sellers
 *   CANCELLED → cancelTradeHolds()   → Cancel/void PaymentIntents
 */

import { db } from "@/lib/db";
import { getPaymentProvider, getPayoutProvider } from "@/server/adapters/stripe.adapter";
import { getOrCreateCustomer } from "./stripe.service";
import { computeSettlements } from "@/server/matching/bridge-builder";
import { calculateHoldAmounts, type TxClient } from "./wallet.service";
import { getConfig } from "@/server/services/config.service";
import { formatPrice } from "@/lib/currency";

// ─── Types ──────────────────────────────────────────────

interface TradeLegForSettlement {
  fromUserId: string;
  toUserId: string;
  askPrice: number;
}

interface HoldResult {
  totalHeld: number;
  payments: Array<{
    userId: string;
    amountCents: number;
    paymentIntentId: string;
    clientSecret: string;
  }>;
}

// ─── Load Trade Legs ────────────────────────────────────

async function loadTradeLegs(
  tradeId: string,
  client: TxClient | typeof db = db,
): Promise<TradeLegForSettlement[]> {
  const legs = await client.tradeLeg.findMany({
    where: { tradeId },
    include: {
      haveListing: { select: { askPrice: true } },
      gradedHaveListing: { select: { askPrice: true } },
    },
  });

  return legs.map((leg) => ({
    fromUserId: leg.fromUserId,
    toUserId: leg.toUserId,
    askPrice: leg.haveListing?.askPrice ?? leg.gradedHaveListing?.askPrice ?? 0,
  }));
}

function toBridgeLegs(legs: TradeLegForSettlement[]) {
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

// ─── Create Trade Holds (ESCROWED) ──────────────────────

/**
 * Create Stripe PaymentIntents for each user who owes money in a trade.
 * Uses manual capture — funds are authorized but not charged until COMPLETED.
 *
 * Hold calculation matches wallet-based approach:
 *   hold = max(netSettlement, 0) + sellerFees
 */
export async function createTradeHolds(tradeId: string): Promise<HoldResult> {
  const legs = await loadTradeLegs(tradeId);
  const bridgeLegs = toBridgeLegs(legs);
  const settlements = computeSettlements(bridgeLegs);
  const holds = await calculateHoldAmounts(legs, settlements);
  const trade = await db.trade.findUniqueOrThrow({
    where: { id: tradeId },
    select: { statusHistory: true },
  });
  assertNewTradeHoldsAllowed(trade.statusHistory, holds);

  const payments: HoldResult["payments"] = [];
  let totalHeld = 0;

  for (const [userId, holdAmount] of holds) {
    if (holdAmount <= 0) continue;

    // Get or create Stripe customer for this user
    const customerId = await getOrCreateCustomer(userId);

    // Create PaymentIntent with manual capture (auth hold)
    const provider = getPaymentProvider();
    const result = await provider.createPaymentIntent({
      customerId,
      amountCents: holdAmount,
      currency: "usd",
      captureMethod: "manual",
      metadata: {
        type: "trade_escrow",
        tradeId,
        userId,
      },
    });

    // Record the payment in DB
    await db.tradePayment.create({
      data: {
        tradeId,
        userId,
        amountCents: holdAmount,
        currency: "USD",
        stripePaymentIntentId: result.paymentIntentId,
        status: result.status === "requires_capture" ? "AUTHORIZED" : "REQUIRES_ACTION",
      },
    });

    payments.push({
      userId,
      amountCents: holdAmount,
      paymentIntentId: result.paymentIntentId,
      clientSecret: result.clientSecret,
    });

    totalHeld += holdAmount;
  }

  return { totalHeld, payments };
}

// ─── Capture & Settle (COMPLETED) ───────────────────────

/**
 * Capture all authorized PaymentIntents and transfer settlement
 * credits to sellers' Connect accounts.
 *
 * Settlement logic:
 *   1. Capture all authorized PaymentIntents (charges users who owe)
 *   2. For users owed money (negative net), transfer to their Connect account
 *   3. Platform fee is the difference between captured and transferred
 */
export async function captureAndSettle(tradeId: string): Promise<void> {
  const provider = getPaymentProvider();
  const payoutProvider = getPayoutProvider();

  // 1. Load all authorized PaymentIntents
  const payments = await db.tradePayment.findMany({
    where: { tradeId, status: "AUTHORIZED" },
  });

  if (payments.length === 0) {
    console.warn(`[marketplace-escrow] No authorized payments for trade ${tradeId}`);
    return;
  }

  // 2. Saga: Capture all PIs with rollback on failure
  const capturedPayments: Array<{ id: string; piId: string; chargeId: string }> = [];

  for (const payment of payments) {
    if (!payment.stripePaymentIntentId) continue;

    try {
      const { chargeId } = await provider.capturePaymentIntent(payment.stripePaymentIntentId);

      await db.tradePayment.update({
        where: { id: payment.id },
        data: { status: "CAPTURED", capturedAt: new Date() },
      });

      capturedPayments.push({ id: payment.id, piId: payment.stripePaymentIntentId, chargeId });
    } catch (err) {
      // Capture failed — rollback all previously captured payments
      console.error(
        `[marketplace-escrow] Capture failed for PI ${payment.stripePaymentIntentId} in trade ${tradeId}:`,
        err,
      );

      for (const captured of capturedPayments) {
        try {
          // Stripe supports refunds on captured charges
          const stripe = (
            provider as {
              stripe?: { refunds: { create: (p: { payment_intent: string }) => Promise<unknown> } };
            }
          ).stripe;
          if (stripe) {
            await stripe.refunds.create({ payment_intent: captured.piId });
          }
          await db.tradePayment.update({
            where: { id: captured.id },
            data: { status: "REFUNDED" },
          });
          console.warn(`[marketplace-escrow] Refunded PI ${captured.piId} (rollback)`);
        } catch (refundErr) {
          console.error(
            `[marketplace-escrow] CRITICAL: Failed to refund PI ${captured.piId}:`,
            refundErr,
          );
        }
      }

      // Cancel remaining uncaptured PIs
      for (const remaining of payments) {
        if (!remaining.stripePaymentIntentId) continue;
        if (capturedPayments.some((c) => c.piId === remaining.stripePaymentIntentId)) continue;
        if (remaining.id === payment.id) continue;

        try {
          await provider.cancelPaymentIntent(remaining.stripePaymentIntentId);
          await db.tradePayment.update({
            where: { id: remaining.id },
            data: { status: "VOIDED" },
          });
        } catch (cancelErr) {
          console.error(
            `[marketplace-escrow] Failed to cancel PI ${remaining.stripePaymentIntentId}:`,
            cancelErr,
          );
        }
      }

      throw new Error(
        `Trade ${tradeId} settlement failed: capture of PI ${payment.stripePaymentIntentId} failed. All captures rolled back.`,
      );
    }
  }

  // 3. All captures succeeded — proceed with transfers
  const legs = await loadTradeLegs(tradeId);
  const bridgeLegs = toBridgeLegs(legs);
  const settlements = computeSettlements(bridgeLegs);
  const feeRate = await getConfig("fees.platform_rate");

  // 4. Pre-compute all transfers (Stripe calls first, then atomic DB writes)
  const transferResults: Array<{
    userId: string;
    amountCents: number;
    platformFeeCents: number;
    stripeTransferId: string;
  }> = [];

  const feeOnlyRecords: Array<{
    userId: string;
    platformFeeCents: number;
  }> = [];

  for (const [userId, net] of settlements) {
    const sellerFee = legs
      .filter((l) => l.fromUserId === userId)
      .reduce((sum, l) => sum + Math.ceil(l.askPrice * feeRate), 0);

    if (net >= 0) {
      // User owes — no transfer, just record fee
      if (sellerFee > 0) {
        feeOnlyRecords.push({ userId, platformFeeCents: sellerFee });
      }
      continue;
    }

    const creditAmount = Math.abs(net);
    const transferAmount = Math.max(creditAmount - sellerFee, 0);
    if (transferAmount <= 0) continue;

    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { stripeConnectAccountId: true },
    });

    if (!user.stripeConnectAccountId) {
      console.error(
        `[marketplace-escrow] User ${userId} has no Connect account — cannot transfer ${formatPrice(transferAmount)}`,
      );
      continue;
    }

    const result = await payoutProvider.createTransfer({
      amountCents: transferAmount,
      currency: "usd",
      destinationAccountId: user.stripeConnectAccountId,
      metadata: {
        type: "trade_settlement",
        tradeId,
        userId,
        grossCredit: String(creditAmount),
        sellerFee: String(sellerFee),
      },
    });

    transferResults.push({
      userId,
      amountCents: transferAmount,
      platformFeeCents: sellerFee,
      stripeTransferId: result.transferId,
    });
  }

  // 5. Atomic DB write — all transfer records in a single transaction
  await db.$transaction(async (tx) => {
    for (const transfer of transferResults) {
      await tx.tradeTransfer.create({
        data: {
          tradeId,
          userId: transfer.userId,
          amountCents: transfer.amountCents,
          platformFeeCents: transfer.platformFeeCents,
          currency: "USD",
          stripeTransferId: transfer.stripeTransferId,
          status: "PAID",
          completedAt: new Date(),
        },
      });
    }

    for (const fee of feeOnlyRecords) {
      await tx.tradeTransfer.create({
        data: {
          tradeId,
          userId: fee.userId,
          amountCents: 0,
          platformFeeCents: fee.platformFeeCents,
          currency: "USD",
          status: "PAID",
          completedAt: new Date(),
        },
      });
    }
  });
}

// ─── Cancel Trade Holds (CANCELLED) ─────────────────────

/**
 * Cancel all authorized PaymentIntents for a trade.
 * Releases auth holds — no charge to users.
 */
export async function cancelTradeHolds(tradeId: string): Promise<void> {
  const provider = getPaymentProvider();

  const payments = await db.tradePayment.findMany({
    where: {
      tradeId,
      status: { in: ["AUTHORIZED", "REQUIRES_ACTION"] },
    },
  });

  for (const payment of payments) {
    if (!payment.stripePaymentIntentId) continue;

    try {
      await provider.cancelPaymentIntent(payment.stripePaymentIntentId);
    } catch (err) {
      // PaymentIntent may already be cancelled or expired
      console.error(
        `[marketplace-escrow] Failed to cancel PI ${payment.stripePaymentIntentId}:`,
        err,
      );
    }

    await db.tradePayment.update({
      where: { id: payment.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
  }
}

// ─── Query Helpers ──────────────────────────────────────

/** Check if all payments for a trade are authorized (ready for capture). */
export async function areAllPaymentsAuthorized(tradeId: string): Promise<boolean> {
  const payments = await db.tradePayment.findMany({
    where: { tradeId },
  });

  if (payments.length === 0) return false;

  return payments.every((p) => p.status === "AUTHORIZED");
}

/** Get trade payments summary for display. */
export async function getTradePaymentSummary(tradeId: string) {
  const [payments, transfers] = await Promise.all([
    db.tradePayment.findMany({ where: { tradeId } }),
    db.tradeTransfer.findMany({ where: { tradeId } }),
  ]);

  return {
    payments: payments.map((p) => ({
      userId: p.userId,
      amountCents: p.amountCents,
      status: p.status,
      stripePaymentIntentId: p.stripePaymentIntentId,
    })),
    transfers: transfers.map((t) => ({
      userId: t.userId,
      amountCents: t.amountCents,
      platformFeeCents: t.platformFeeCents,
      status: t.status,
      stripeTransferId: t.stripeTransferId,
    })),
    totalCharged: payments
      .filter((p) => p.status === "CAPTURED")
      .reduce((sum, p) => sum + p.amountCents, 0),
    totalTransferred: transfers
      .filter((t) => t.status === "PAID")
      .reduce((sum, t) => sum + t.amountCents, 0),
    totalFees: transfers.reduce((sum, t) => sum + t.platformFeeCents, 0),
  };
}

/**
 * Handle a payment authorization confirmation from Stripe webhook.
 * Called when a user completes 3D Secure or other payment confirmation.
 */
export async function handlePaymentAuthorized(stripePaymentIntentId: string): Promise<void> {
  await db.tradePayment.updateMany({
    where: { stripePaymentIntentId },
    data: { status: "AUTHORIZED" },
  });
}

/**
 * Handle a payment failure from Stripe webhook.
 * Marks the payment as failed and notifies.
 */
export async function handlePaymentFailed(stripePaymentIntentId: string): Promise<void> {
  await db.tradePayment.updateMany({
    where: { stripePaymentIntentId },
    data: { status: "FAILED" },
  });
}
