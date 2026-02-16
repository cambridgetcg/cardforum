import { db } from "@/lib/db";
import { calculateVerificationFee } from "@/lib/authenticator-fees";
import type { AuthenticatorTier } from "@/types/domain";
import {
  debitVerificationFee,
  refundVerificationFee,
  creditAuthenticatorEarning,
  type TxClient,
} from "./wallet.service";

/**
 * Hold verification fees in escrow when a trade enters AUTHENTICATING.
 * Creates fee-hold entries for each leg's authenticator.
 */
export async function holdVerificationFees(tradeId: string, tx?: TxClient) {
  const client = tx ?? db;
  const trade = await client.trade.findUnique({
    where: { id: tradeId },
    include: {
      escrow: true,
      legs: {
        include: {
          verification: { include: { authenticator: true } },
        },
      },
    },
  });

  if (!trade) throw new Error("Trade not found");
  if (!trade.escrow) throw new Error("Escrow not found for trade");
  if (trade.escrow.status !== "HELD") throw new Error("Escrow not in HELD status");

  // Calculate fees for each leg with an assigned authenticator
  const feeEntries = [];
  for (const leg of trade.legs) {
    if (!leg.verification?.authenticator) continue;

    const tier = leg.verification.authenticator.tier as AuthenticatorTier;
    const fee = await calculateVerificationFee(tier);

    feeEntries.push({
      escrowId: trade.escrow.id,
      type: "HOLD" as const,
      amount: fee.baseFee,
      note: JSON.stringify({
        feeType: "AUTHENTICATOR_VERIFICATION",
        tradeLegId: leg.id,
        authenticatorId: leg.verification.authenticatorId,
        baseFee: fee.baseFee,
        platformShare: fee.platformShare,
        authenticatorShare: fee.authenticatorShare,
        tier,
      }),
    });
  }

  if (feeEntries.length === 0) return null;

  return client.escrowEntry.createMany({ data: feeEntries });
}

/**
 * Debit verification fees from trade participants' wallets.
 * Each sender pays the verification fee for the leg where they send a card.
 * Called after holdVerificationFees at AUTHENTICATING transition.
 */
export async function debitVerificationFees(tradeId: string, tx?: TxClient) {
  const client = tx ?? db;
  const trade = await client.trade.findUnique({
    where: { id: tradeId },
    include: {
      legs: {
        include: {
          verification: { include: { authenticator: true } },
        },
      },
    },
  });

  if (!trade) throw new Error("Trade not found");

  for (const leg of trade.legs) {
    if (!leg.verification?.authenticator) continue;

    const tier = leg.verification.authenticator.tier as AuthenticatorTier;
    const fee = await calculateVerificationFee(tier);

    // Sender pays verification fee for their card being verified
    await debitVerificationFee(leg.fromUserId, tradeId, fee.baseFee, tx);
  }
}

/**
 * Refund verification fees when a trade is cancelled after AUTHENTICATING.
 * Credits back each sender who was debited.
 */
export async function refundVerificationFees(tradeId: string, tx?: TxClient) {
  const client = tx ?? db;
  const verificationFeeTxns = await client.walletTransaction.findMany({
    where: { tradeId, type: "VERIFICATION_FEE" },
  });

  for (const txn of verificationFeeTxns) {
    await refundVerificationFee(txn.userId, tradeId, Math.abs(txn.amount), tx);
  }
}

/**
 * Release fees to authenticators when a trade completes successfully.
 * Called when trade transitions to COMPLETED.
 * Creates escrow release entries AND credits authenticator wallets.
 */
export async function releaseFeesToAuthenticators(tradeId: string, tx?: TxClient) {
  const client = tx ?? db;
  const trade = await client.trade.findUnique({
    where: { id: tradeId },
    include: {
      escrow: { include: { entries: true } },
      legs: {
        include: {
          verification: { include: { authenticator: true } },
        },
      },
    },
  });

  if (!trade?.escrow) throw new Error("Escrow not found for trade");

  // Find all fee-hold entries
  const feeEntries = trade.escrow.entries.filter((e) => {
    if (e.type !== "HOLD" || !e.note) return false;
    try {
      const parsed = JSON.parse(e.note);
      return parsed.feeType === "AUTHENTICATOR_VERIFICATION";
    } catch {
      return false;
    }
  });

  // Create escrow release entries for each authenticator fee
  const releaseEntries = feeEntries.map((entry) => {
    const details = JSON.parse(entry.note!);
    return {
      escrowId: trade.escrow!.id,
      type: "RELEASE" as const,
      amount: details.authenticatorShare,
      note: JSON.stringify({
        feeType: "AUTHENTICATOR_PAYOUT",
        authenticatorId: details.authenticatorId,
        tradeLegId: details.tradeLegId,
        amount: details.authenticatorShare,
      }),
    };
  });

  if (releaseEntries.length > 0) {
    await client.escrowEntry.createMany({ data: releaseEntries });
  }

  // Credit authenticator wallets with their earnings
  for (const leg of trade.legs) {
    if (!leg.verification?.authenticator) continue;

    const tier = leg.verification.authenticator.tier as AuthenticatorTier;
    const fee = await calculateVerificationFee(tier);
    const authenticatorUserId = leg.verification.authenticator.userId;

    await creditAuthenticatorEarning(authenticatorUserId, tradeId, fee.authenticatorShare, tx);
  }
}

/**
 * Forfeit an authenticator's fee when their verification fails.
 * The fee is returned to the escrow pool (not released to authenticator).
 */
export async function forfeitAuthenticatorFee(assignmentId: string, reason: string) {
  const assignment = await db.verificationAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      tradeLeg: {
        include: {
          trade: { include: { escrow: { include: { entries: true } } } },
        },
      },
    },
  });

  if (!assignment?.tradeLeg.trade.escrow) return null;

  const escrow = assignment.tradeLeg.trade.escrow;

  // Find the fee-hold entry for this leg
  const feeEntry = escrow.entries.find((e) => {
    if (e.type !== "HOLD" || !e.note) return false;
    try {
      const parsed = JSON.parse(e.note);
      return (
        parsed.feeType === "AUTHENTICATOR_VERIFICATION" &&
        parsed.tradeLegId === assignment.tradeLegId
      );
    } catch {
      return false;
    }
  });

  if (!feeEntry) return null;

  // Create a refund entry (fee forfeited, returned to escrow pool)
  return db.escrowEntry.create({
    data: {
      escrowId: escrow.id,
      type: "REFUND",
      amount: feeEntry.amount,
      note: JSON.stringify({
        feeType: "AUTHENTICATOR_FEE_FORFEITED",
        assignmentId,
        authenticatorId: assignment.authenticatorId,
        reason,
      }),
    },
  });
}

/**
 * Record an insurance bond payment for a PREMIUM tier authenticator.
 */
export async function recordInsuranceBond(authenticatorId: string, userId: string, amount: number) {
  const auth = await db.authenticator.findUnique({
    where: { id: authenticatorId },
  });

  if (!auth) throw new Error("Authenticator not found");
  if (auth.userId !== userId) throw new Error("Not authorized");

  const [updated] = await db.$transaction([
    db.authenticator.update({
      where: { id: authenticatorId },
      data: {
        insuranceBondAmount: amount,
        insuranceBondPaidAt: new Date(),
      },
    }),
    db.authenticatorAudit.create({
      data: {
        authenticatorId,
        type: "INSURANCE_BOND",
        details: {
          action: "POSTED",
          amount,
          paidAt: new Date().toISOString(),
        },
      },
    }),
  ]);

  return updated;
}
