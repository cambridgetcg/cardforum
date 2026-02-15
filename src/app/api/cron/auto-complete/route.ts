import { NextResponse, type NextRequest } from "next/server";
import { autoCompleteDeliveries, areAllLegsDelivered } from "@/server/services/shipping.service";
import { transitionTrade } from "@/server/services/trade.service";
import { db } from "@/lib/db";

/**
 * GET /api/cron/auto-complete
 *
 * Auto-completes deliveries that have been in SHIPPED status for > 14 days
 * without recipient confirmation. Then transitions any fully-delivered trades.
 *
 * Vercel Cron config (vercel.json):
 * { "crons": [{ "path": "/api/cron/auto-complete", "schedule": "0 6 * * *" }] }
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const autoCompletedLegIds = await autoCompleteDeliveries();

  // For each auto-completed leg, check if the trade is now fully delivered
  const tradesCompleted: string[] = [];
  const checkedTrades = new Set<string>();

  for (const legId of autoCompletedLegIds) {
    const leg = await db.tradeLeg.findUnique({
      where: { id: legId },
      select: { tradeId: true },
    });

    if (!leg || checkedTrades.has(leg.tradeId)) continue;
    checkedTrades.add(leg.tradeId);

    const allDelivered = await areAllLegsDelivered(leg.tradeId);
    if (allDelivered) {
      const trade = await db.trade.findUnique({
        where: { id: leg.tradeId },
        select: { status: true, userAId: true },
      });

      if (trade && !["DELIVERED", "COMPLETED"].includes(trade.status)) {
        try {
          await transitionTrade(leg.tradeId, trade.userAId, "DELIVERED");
          await transitionTrade(leg.tradeId, trade.userAId, "COMPLETED");
          tradesCompleted.push(leg.tradeId);
        } catch {
          // Log but don't fail the cron
        }
      }
    }
  }

  return NextResponse.json({
    autoCompletedLegs: autoCompletedLegIds.length,
    tradesCompleted: tradesCompleted.length,
  });
}
