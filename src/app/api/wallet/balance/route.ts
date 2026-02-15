import { NextResponse } from "next/server";
import { withAuth } from "@/server/middleware/with-auth";
import { db } from "@/lib/db";
import { getPendingDeposits } from "@/server/services/wallet.service";

export const GET = withAuth(async (_req, { userId }) => {
  const [user, pending] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { walletBalance: true, walletFrozen: true, walletFrozenReason: true },
    }),
    getPendingDeposits(userId),
  ]);

  return NextResponse.json({
    balance: user.walletBalance,
    frozen: user.walletFrozen,
    frozenReason: user.walletFrozenReason,
    pendingAch: {
      count: pending.count,
      totalCents: pending.totalCents,
    },
  });
});
