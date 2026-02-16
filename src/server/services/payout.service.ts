import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { withdraw } from "@/server/services/wallet.service";

/**
 * Full withdrawal flow: debit wallet, create Stripe transfer, track Payout.
 * If the Stripe transfer fails, immediately credits funds back.
 */
export async function withdrawWithPayout(userId: string, cents: number) {
  // 1. Verify user has completed Connect onboarding
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeConnectAccountId: true, connectOnboardingComplete: true },
  });

  if (!user.stripeConnectAccountId || !user.connectOnboardingComplete) {
    throw new Error("Bank account not connected");
  }

  // 2. Atomic wallet debit
  const walletTx = await withdraw(userId, cents);

  // 3. Create Stripe transfer to Connected account
  let transfer;
  try {
    transfer = await getStripe().transfers.create({
      amount: cents,
      currency: "usd",
      destination: user.stripeConnectAccountId,
      metadata: {
        userId,
        walletTransactionId: walletTx.id,
      },
    });
  } catch (err) {
    // Transfer failed — credit funds back immediately
    await creditBackFailedPayout(
      userId,
      cents,
      walletTx.id,
      err instanceof Error ? err.message : "Stripe transfer failed",
    );
    throw new Error("Payout failed. Funds have been returned to your wallet.");
  }

  // 4. Create Payout record + update WalletTransaction with transfer ID
  const payout = await db.$transaction(async (tx) => {
    await tx.walletTransaction.update({
      where: { id: walletTx.id },
      data: { stripePayoutId: transfer.id },
    });

    return tx.payout.create({
      data: {
        userId,
        walletTransactionId: walletTx.id,
        stripeTransferId: transfer.id,
        amount: cents,
        status: "PENDING",
      },
    });
  });

  return { transaction: walletTx, payout };
}

/**
 * Credit back a failed payout: restore wallet balance, create reversal transaction, mark Payout FAILED.
 */
async function creditBackFailedPayout(
  userId: string,
  cents: number,
  walletTransactionId: string,
  reason: string,
) {
  await db.$transaction(async (tx) => {
    // Credit wallet balance back
    await tx.user.update({
      where: { id: userId },
      data: { walletBalance: { increment: cents } },
    });

    // Get updated balance for the reversal transaction
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { walletBalance: true },
    });

    // Create reversal transaction
    await tx.walletTransaction.create({
      data: {
        userId,
        type: "WITHDRAWAL_REVERSAL",
        amount: cents,
        balanceAfter: user.walletBalance,
        description: `Payout returned: ${reason}`,
      },
    });

    // Create or update Payout as FAILED
    const existingPayout = await tx.payout.findUnique({
      where: { walletTransactionId },
    });

    if (existingPayout) {
      await tx.payout.update({
        where: { id: existingPayout.id },
        data: { status: "FAILED", failureReason: reason, failedAt: new Date() },
      });
    } else {
      await tx.payout.create({
        data: {
          userId,
          walletTransactionId,
          amount: cents,
          status: "FAILED",
          failureReason: reason,
          failedAt: new Date(),
        },
      });
    }
  });
}

// ─── Webhook Handlers ──────────────────────────────────

/**
 * Handle transfer.paid webhook — mark Payout as PAID.
 * Idempotent: skips if already PAID.
 */
export async function handleTransferPaid(stripeTransferId: string) {
  const payout = await db.payout.findUnique({
    where: { stripeTransferId },
  });

  if (!payout || payout.status === "PAID") return;

  await db.payout.update({
    where: { id: payout.id },
    data: { status: "PAID", paidAt: new Date() },
  });
}

/**
 * Handle transfer.failed webhook — mark FAILED + credit wallet back.
 * Idempotent: skips if already FAILED or REVERSED.
 */
export async function handleTransferFailed(stripeTransferId: string, reason: string) {
  const payout = await db.payout.findUnique({
    where: { stripeTransferId },
  });

  if (!payout || payout.status === "FAILED" || payout.status === "REVERSED") {
    return;
  }

  await creditBackFailedPayout(payout.userId, payout.amount, payout.walletTransactionId, reason);
}

/**
 * Handle transfer.reversed webhook — mark REVERSED + credit wallet back if was PAID.
 * Idempotent: skips if already REVERSED.
 */
export async function handleTransferReversed(stripeTransferId: string, reason: string) {
  const payout = await db.payout.findUnique({
    where: { stripeTransferId },
  });

  if (!payout || payout.status === "REVERSED") return;

  await db.$transaction(async (tx) => {
    // Credit wallet balance back
    await tx.user.update({
      where: { id: payout.userId },
      data: { walletBalance: { increment: payout.amount } },
    });

    const user = await tx.user.findUniqueOrThrow({
      where: { id: payout.userId },
      select: { walletBalance: true },
    });

    // Create reversal transaction
    await tx.walletTransaction.create({
      data: {
        userId: payout.userId,
        type: "WITHDRAWAL_REVERSAL",
        amount: payout.amount,
        balanceAfter: user.walletBalance,
        description: `Payout reversed: ${reason}`,
      },
    });

    // Mark payout as REVERSED
    await tx.payout.update({
      where: { id: payout.id },
      data: { status: "REVERSED", failureReason: reason, failedAt: new Date() },
    });
  });
}

/**
 * Get payout history for a user.
 */
export async function getUserPayouts(userId: string, limit = 20) {
  return db.payout.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
