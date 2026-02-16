import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Condition } from "@/generated/prisma/client";

/**
 * GET /api/marketplace/price-suggestion?cardId=...&condition=...
 *
 * Returns suggested ask/bid prices for a card+condition based on
 * current marketplace data (active listings).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const cardId = searchParams.get("cardId");
  const condition = searchParams.get("condition");

  if (!cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }

  // Get active ask prices for this card (optionally filtered by condition)
  const askWhere = {
    cardId,
    isActive: true,
    ...(condition ? { condition: condition as Condition } : {}),
  };
  const bidWhere = {
    cardId,
    isActive: true,
    ...(condition ? { minCondition: condition as Condition } : {}),
  };

  const [askAgg, bidAgg, recentTrades] = await Promise.all([
    db.haveListing.aggregate({
      where: askWhere,
      _min: { askPrice: true },
      _max: { askPrice: true },
      _avg: { askPrice: true },
      _count: true,
    }),
    db.wantListing.aggregate({
      where: bidWhere,
      _min: { bidPrice: true },
      _max: { bidPrice: true },
      _avg: { bidPrice: true },
      _count: true,
    }),
    // Recent completed trades involving this card for historical pricing
    db.tradeLeg.findMany({
      where: {
        haveListing: { cardId, ...(condition ? { condition: condition as Condition } : {}) },
        trade: { status: "COMPLETED" },
      },
      select: {
        haveListing: { select: { askPrice: true } },
        trade: { select: { completedAt: true } },
      },
      orderBy: { trade: { completedAt: "desc" } },
      take: 10,
    }),
  ]);

  const lastSalePrices = recentTrades
    .map((t) => t.haveListing?.askPrice)
    .filter((p): p is number => p != null);

  const lastSale = lastSalePrices.length > 0 ? lastSalePrices[0] : null;
  const avgSale =
    lastSalePrices.length > 0
      ? Math.round(lastSalePrices.reduce((a, b) => a + b, 0) / lastSalePrices.length)
      : null;

  // Suggested price: midpoint of best ask and best bid, or avg of active asks, or last sale
  const bestAsk = askAgg._min.askPrice;
  const bestBid = bidAgg._max.bidPrice;

  let suggestedAsk: number | null = null;
  let suggestedBid: number | null = null;

  if (bestAsk != null && bestBid != null) {
    // Midpoint of spread
    const mid = Math.round((bestAsk + bestBid) / 2);
    suggestedAsk = mid;
    suggestedBid = mid;
  } else if (bestAsk != null) {
    suggestedAsk = bestAsk;
    suggestedBid = bestAsk;
  } else if (bestBid != null) {
    suggestedAsk = bestBid;
    suggestedBid = bestBid;
  } else if (avgSale != null) {
    suggestedAsk = avgSale;
    suggestedBid = avgSale;
  }

  return NextResponse.json({
    suggestedAsk,
    suggestedBid,
    market: {
      bestAsk,
      bestBid,
      avgAsk: askAgg._avg.askPrice ? Math.round(askAgg._avg.askPrice) : null,
      avgBid: bidAgg._avg.bidPrice ? Math.round(bidAgg._avg.bidPrice) : null,
      askCount: askAgg._count,
      bidCount: bidAgg._count,
    },
    history: {
      lastSale,
      avgSale,
      tradeCount: lastSalePrices.length,
    },
  });
}
