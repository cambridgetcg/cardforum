import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

// GET /api/marketplace?tcg=...&set=...&query=...&page=1&limit=20
// Returns cards that have at least one active listing, with bid/ask aggregates.
// Aggregates use usdEquivalent for cross-currency comparison.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.get("query") ?? "";
  const tcg = searchParams.get("tcg");
  const set = searchParams.get("set");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const skip = (page - 1) * limit;

  // 1. Find cardIds that have at least one active listing
  const [activeHaveCardIds, activeWantCardIds] = await Promise.all([
    db.haveListing.findMany({
      where: { isActive: true },
      select: { cardId: true },
      distinct: ["cardId"],
    }),
    db.wantListing.findMany({
      where: { isActive: true },
      select: { cardId: true },
      distinct: ["cardId"],
    }),
  ]);

  const activeCardIds = [
    ...new Set([
      ...activeHaveCardIds.map((h) => h.cardId),
      ...activeWantCardIds.map((w) => w.cardId),
    ]),
  ];

  if (activeCardIds.length === 0) {
    return NextResponse.json({ cards: [], total: 0, page, limit, totalPages: 0 });
  }

  // 2. Query cards filtered to active listings + user filters
  const where = {
    id: { in: activeCardIds },
    ...(query && {
      OR: [
        { name: { contains: query, mode: "insensitive" as const } },
        { setName: { contains: query, mode: "insensitive" as const } },
        { setCode: { contains: query, mode: "insensitive" as const } },
      ],
    }),
    ...(tcg && { tcg: tcg as "POKEMON" | "ONEPIECE" | "YUGIOH" | "MTG" }),
    ...(set && { set: { code: set } }),
  };

  const [cards, total] = await Promise.all([
    db.card.findMany({
      where,
      include: { set: true },
      orderBy: [{ tcg: "asc" }, { name: "asc" }],
      skip,
      take: limit,
    }),
    db.card.count({ where }),
  ]);

  const cardIds = cards.map((c) => c.id);

  // 3. Get bid/ask aggregates in USD-equivalent for cross-currency comparison.
  //    Also aggregate on raw askPrice/bidPrice (legacy, for same-currency orderbooks).
  const [askAggs, bidAggs] = await Promise.all([
    db.haveListing.groupBy({
      by: ["cardId"],
      where: { cardId: { in: cardIds }, isActive: true },
      _min: { askPrice: true, usdEquivalent: true },
      _count: true,
    }),
    db.wantListing.groupBy({
      by: ["cardId"],
      where: { cardId: { in: cardIds }, isActive: true },
      _max: { bidPrice: true, usdEquivalent: true },
      _count: true,
    }),
  ]);

  const askByCard = new Map(
    askAggs.map((a) => [
      a.cardId,
      {
        bestAsk: a._min.askPrice,
        bestAskUsd: a._min.usdEquivalent,
        count: a._count,
      },
    ]),
  );
  const bidByCard = new Map(
    bidAggs.map((b) => [
      b.cardId,
      {
        bestBid: b._max.bidPrice,
        bestBidUsd: b._max.usdEquivalent,
        count: b._count,
      },
    ]),
  );

  // 4. Merge card data with market info
  const result = cards.map((card) => {
    const ask = askByCard.get(card.id);
    const bid = bidByCard.get(card.id);
    const bestAskUsd = ask?.bestAskUsd ?? null;
    const bestBidUsd = bid?.bestBidUsd ?? null;

    let spreadUsd: number | null = null;
    let spreadPct: number | null = null;
    if (bestAskUsd != null && bestBidUsd != null) {
      spreadUsd = bestAskUsd - bestBidUsd;
      const midpoint = (bestAskUsd + bestBidUsd) / 2;
      spreadPct = midpoint > 0 ? Math.round((spreadUsd / midpoint) * 1000) / 10 : null;
    }

    return {
      id: card.id,
      tcg: card.tcg,
      name: card.name,
      setName: card.setName,
      setCode: card.setCode,
      number: card.number,
      rarity: card.rarity,
      imageUrl: card.imageUrl,
      set: card.set,
      market: {
        // USD-equivalent prices for cross-currency comparison
        bestAskUsd,
        bestBidUsd,
        spreadUsd,
        spreadPct,
        askCount: ask?.count ?? 0,
        bidCount: bid?.count ?? 0,
        // Legacy: raw values (may be in different currencies across listings)
        bestAsk: ask?.bestAsk ?? null,
        bestBid: bid?.bestBid ?? null,
      },
    };
  });

  return NextResponse.json({
    cards: result,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
