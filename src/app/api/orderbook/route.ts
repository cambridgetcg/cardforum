import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

// GET /api/orderbook?cardId=xxx
// Returns order book depth: all active bid/ask price levels with quantities for a card.
export async function GET(req: NextRequest) {
  const cardId = req.nextUrl.searchParams.get("cardId");

  if (!cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }

  const [card, haveListings, wantListings] = await Promise.all([
    db.card.findUnique({
      where: { id: cardId },
      include: { set: true },
    }),
    db.haveListing.findMany({
      where: { cardId, isActive: true },
      select: { askPrice: true, condition: true, quantity: true },
      orderBy: { askPrice: "asc" },
    }),
    db.wantListing.findMany({
      where: { cardId, isActive: true },
      select: { bidPrice: true, minCondition: true, maxQuantity: true },
      orderBy: { bidPrice: "desc" },
    }),
  ]);

  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  // Aggregate asks by price level
  const askMap = new Map<number, { totalQty: number; listings: number; conditions: Set<string> }>();
  for (const h of haveListings) {
    const entry = askMap.get(h.askPrice);
    if (entry) {
      entry.totalQty += h.quantity;
      entry.listings += 1;
      entry.conditions.add(h.condition);
    } else {
      askMap.set(h.askPrice, { totalQty: h.quantity, listings: 1, conditions: new Set([h.condition]) });
    }
  }
  const asks = Array.from(askMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([price, data]) => ({
      price,
      totalQty: data.totalQty,
      listings: data.listings,
      conditions: Array.from(data.conditions),
    }));

  // Aggregate bids by price level
  const bidMap = new Map<number, { totalQty: number; listings: number; minConditions: Set<string> }>();
  for (const w of wantListings) {
    const entry = bidMap.get(w.bidPrice);
    if (entry) {
      entry.totalQty += w.maxQuantity;
      entry.listings += 1;
      entry.minConditions.add(w.minCondition);
    } else {
      bidMap.set(w.bidPrice, { totalQty: w.maxQuantity, listings: 1, minConditions: new Set([w.minCondition]) });
    }
  }
  const bids = Array.from(bidMap.entries())
    .sort(([a], [b]) => b - a)
    .map(([price, data]) => ({
      price,
      totalQty: data.totalQty,
      listings: data.listings,
      minConditions: Array.from(data.minConditions),
    }));

  // Summary stats
  const bestAsk = asks.length > 0 ? asks[0].price : null;
  const bestBid = bids.length > 0 ? bids[0].price : null;
  let spread: number | null = null;
  let spreadPct: number | null = null;
  let midpoint: number | null = null;
  if (bestAsk != null && bestBid != null) {
    spread = bestAsk - bestBid;
    midpoint = Math.round((bestAsk + bestBid) / 2);
    spreadPct = midpoint > 0 ? Math.round((spread / midpoint) * 1000) / 10 : null;
  }

  const totalAsks = haveListings.reduce((sum, h) => sum + h.quantity, 0);
  const totalBids = wantListings.reduce((sum, w) => sum + w.maxQuantity, 0);

  return NextResponse.json({
    card: {
      id: card.id,
      tcg: card.tcg,
      name: card.name,
      setName: card.setName,
      setCode: card.setCode,
      number: card.number,
      rarity: card.rarity,
      imageUrl: card.imageUrl,
      set: card.set,
    },
    asks,
    bids,
    summary: { bestAsk, bestBid, spread, spreadPct, midpoint, totalAsks, totalBids },
  });
}
