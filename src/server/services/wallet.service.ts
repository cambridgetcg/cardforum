import { db } from "@/lib/db";
import { getConfig } from "@/server/services/config.service";
import { formatPrice } from "@/lib/currency";
import type { WalletTransactionType } from "@/generated/prisma/client";

/** Prisma interactive transaction client — use to join an outer transaction. */
export type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

// ─── Balance ────────────────────────────────────────────

export async function getBalance(userId: string): Promise<number> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { walletBalance: true },
  });
  return user.walletBalance;
}

// ─── Core Ledger Entry (atomic) ─────────────────────────

async function createEntry(
  userId: string,
  type: WalletTransactionType,
  amount: number,
  description: string,
  opts?: { tradeId?: string; stripePaymentIntentId?: string; stripePayoutId?: string; tx?: TxClient },
) {
  const execute = async (client: TxClient) => {
    const user = await client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { walletBalance: true, walletFrozen: true },
    });

    // Allow credits (refunds, reversals) even on frozen wallets, but block debits
    if (user.walletFrozen && amount < 0) {
      throw new Error("Wallet is frozen");
    }

    const balanceAfter = user.walletBalance + amount;
    if (balanceAfter < 0) {
      throw new Error("Insufficient wallet balance");
    }

    await client.user.update({
      where: { id: userId },
      data: { walletBalance: balanceAfter },
    });

    return client.walletTransaction.create({
      data: {
        userId,
        type,
        amount,
        balanceAfter,
        description,
        tradeId: opts?.tradeId,
        stripePaymentIntentId: opts?.stripePaymentIntentId,
        stripePayoutId: opts?.stripePayoutId,
      },
    });
  };

  if (opts?.tx) return execute(opts.tx);
  return db.$transaction((tx) => execute(tx));
}

// ─── Deposit / Withdraw ─────────────────────────────────

export async function deposit(
  userId: string,
  cents: number,
  stripePaymentIntentId: string,
) {
  // Idempotency: skip if this payment intent was already processed
  const existing = await db.walletTransaction.findUnique({
    where: { stripePaymentIntentId },
  });
  if (existing) return existing;

  return createEntry(userId, "DEPOSIT", cents, `Deposit of ${formatPrice(cents)}`, {
    stripePaymentIntentId,
  });
}

export async function withdraw(userId: string, cents: number) {
  return createEntry(userId, "WITHDRAWAL", -cents, `Withdrawal of ${formatPrice(cents)}`);
}

// ─── Trade Holds ────────────────────────────────────────

export async function holdForTrade(userId: string, tradeId: string, cents: number, tx?: TxClient) {
  return createEntry(userId, "TRADE_HOLD", -cents, `Hold for trade #${tradeId.slice(-6)}`, {
    tradeId, tx,
  });
}

export async function releaseFromTrade(userId: string, tradeId: string, cents: number, tx?: TxClient) {
  return createEntry(userId, "TRADE_RELEASE", cents, `Settlement from trade #${tradeId.slice(-6)}`, {
    tradeId, tx,
  });
}

export async function refundTradeHold(userId: string, tradeId: string, cents: number, tx?: TxClient) {
  return createEntry(userId, "TRADE_REFUND", cents, `Refund hold for trade #${tradeId.slice(-6)}`, {
    tradeId, tx,
  });
}

// ─── Verification Fees ──────────────────────────────────

export async function debitVerificationFee(userId: string, tradeId: string, cents: number, tx?: TxClient) {
  return createEntry(userId, "VERIFICATION_FEE", -cents, `Verification fee for trade #${tradeId.slice(-6)}`, {
    tradeId, tx,
  });
}

export async function refundVerificationFee(userId: string, tradeId: string, cents: number, tx?: TxClient) {
  return createEntry(userId, "VERIFICATION_FEE_REFUND", cents, `Verification fee refund for trade #${tradeId.slice(-6)}`, {
    tradeId, tx,
  });
}

// ─── Authenticator Earnings ─────────────────────────────

export async function creditAuthenticatorEarning(userId: string, tradeId: string, cents: number, tx?: TxClient) {
  return createEntry(userId, "AUTHENTICATOR_EARN", cents, `Verification payout for trade #${tradeId.slice(-6)}`, {
    tradeId, tx,
  });
}

// ─── Pending ACH Deposits ───────────────────────────────

export async function getPendingDeposits(userId: string) {
  const pending = await db.pendingDeposit.findMany({
    where: { userId, status: "PROCESSING" },
    orderBy: { createdAt: "desc" },
  });
  return {
    count: pending.length,
    totalCents: pending.reduce((sum, d) => sum + d.amountCents, 0),
    deposits: pending,
  };
}

// ─── Transaction History ────────────────────────────────

export async function getTransactions(userId: string, limit = 50) {
  return db.walletTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ─── Hold Calculation ───────────────────────────────────

/**
 * Calculate the hold amount required from each user when a trade enters ESCROWED.
 *
 * For each user:
 *   hold = max(netSettlement, 0) + sum(seller fees on cards they send)
 *
 * netSettlement: from computeSettlements (positive = user owes)
 * seller fees: PLATFORM_FEE_RATE * askPrice of each card the user sends
 */
export async function calculateHoldAmounts(
  legs: { fromUserId: string; askPrice: number }[],
  settlements: Map<string, number>,
): Promise<Map<string, number>> {
  const feeRate = await getConfig("fees.platform_rate");
  const holds = new Map<string, number>();

  // Collect all user IDs
  const userIds = new Set<string>();
  for (const [userId] of settlements) {
    userIds.add(userId);
  }

  for (const userId of userIds) {
    const net = settlements.get(userId) ?? 0;
    // positive net = user owes money (received higher-value card)
    const settlementHold = Math.max(net, 0);

    // Seller fee on cards this user sends
    const sellerFee = legs
      .filter((l) => l.fromUserId === userId)
      .reduce((sum, l) => sum + Math.ceil(l.askPrice * feeRate), 0);

    holds.set(userId, settlementHold + sellerFee);
  }

  return holds;
}

// ─── Wallet Freeze ─────────────────────────────────────

export async function freezeWallet(userId: string, reason: string) {
  return db.user.update({
    where: { id: userId },
    data: { walletFrozen: true, walletFrozenReason: reason },
  });
}

export async function unfreezeWallet(userId: string) {
  return db.user.update({
    where: { id: userId },
    data: { walletFrozen: false, walletFrozenReason: null },
  });
}
