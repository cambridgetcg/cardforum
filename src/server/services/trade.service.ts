import { db } from "@/lib/db";
import { canTransition, type TradeStatus } from "@/types/domain";

export async function getUserTrades(userId: string) {
  return db.trade.findMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    include: {
      legs: true,
      proposal: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function transitionTrade(
  tradeId: string,
  userId: string,
  newStatus: TradeStatus
) {
  const trade = await db.trade.findUnique({ where: { id: tradeId } });

  if (!trade) throw new Error("Trade not found");
  if (trade.userAId !== userId && trade.userBId !== userId) {
    throw new Error("Not authorized");
  }
  if (!canTransition(trade.status as TradeStatus, newStatus)) {
    throw new Error(`Cannot transition from ${trade.status} to ${newStatus}`);
  }

  const statusHistory = (trade.statusHistory as Array<{ status: string; at: string }>) ?? [];
  statusHistory.push({ status: newStatus, at: new Date().toISOString() });

  return db.trade.update({
    where: { id: tradeId },
    data: {
      status: newStatus,
      statusHistory,
      ...(newStatus === "COMPLETED" ? { completedAt: new Date() } : {}),
    },
  });
}
