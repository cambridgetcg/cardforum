import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { SealedProductType } from "@/generated/prisma/client";

// GET /api/sealed-marketplace?tcg=...&type=...&query=...&page=1&limit=20
// Returns sealed products that have at least one active listing, with bid/ask aggregates.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.get("query") ?? "";
  const tcg = searchParams.get("tcg");
  const productType = searchParams.get("type");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const skip = (page - 1) * limit;

  // 1. Find sealedProductIds that have at least one active listing
  const [activeHaveIds, activeWantIds] = await Promise.all([
    db.sealedHaveListing.findMany({
      where: { isActive: true },
      select: { sealedProductId: true },
      distinct: ["sealedProductId"],
    }),
    db.sealedWantListing.findMany({
      where: { isActive: true },
      select: { sealedProductId: true },
      distinct: ["sealedProductId"],
    }),
  ]);

  const activeProductIds = [
    ...new Set([
      ...activeHaveIds.map((h) => h.sealedProductId),
      ...activeWantIds.map((w) => w.sealedProductId),
    ]),
  ];

  if (activeProductIds.length === 0) {
    return NextResponse.json({ products: [], total: 0, page, limit, totalPages: 0 });
  }

  // 2. Query sealed products filtered to active listings + user filters
  const where = {
    id: { in: activeProductIds },
    ...(query && {
      OR: [
        { name: { contains: query, mode: "insensitive" as const } },
        { setName: { contains: query, mode: "insensitive" as const } },
        { setCode: { contains: query, mode: "insensitive" as const } },
      ],
    }),
    ...(tcg && { tcg: tcg as "POKEMON" | "ONEPIECE" | "YUGIOH" | "MTG" }),
    ...(productType && { productType: productType as SealedProductType }),
  };

  const [products, total] = await Promise.all([
    db.sealedProduct.findMany({
      where,
      include: { set: true },
      orderBy: [{ tcg: "asc" }, { name: "asc" }],
      skip,
      take: limit,
    }),
    db.sealedProduct.count({ where }),
  ]);

  const productIds = products.map((p) => p.id);

  // 3. Get bid/ask aggregates in USD-equivalent
  const [askAggs, bidAggs] = await Promise.all([
    db.sealedHaveListing.groupBy({
      by: ["sealedProductId"],
      where: { sealedProductId: { in: productIds }, isActive: true },
      _min: { askPrice: true, usdEquivalent: true },
      _count: true,
    }),
    db.sealedWantListing.groupBy({
      by: ["sealedProductId"],
      where: { sealedProductId: { in: productIds }, isActive: true },
      _max: { bidPrice: true, usdEquivalent: true },
      _count: true,
    }),
  ]);

  const askByProduct = new Map(
    askAggs.map((a) => [
      a.sealedProductId,
      { bestAsk: a._min.askPrice, bestAskUsd: a._min.usdEquivalent, count: a._count },
    ]),
  );
  const bidByProduct = new Map(
    bidAggs.map((b) => [
      b.sealedProductId,
      { bestBid: b._max.bidPrice, bestBidUsd: b._max.usdEquivalent, count: b._count },
    ]),
  );

  // 4. Merge product data with market info
  const result = products.map((product) => {
    const ask = askByProduct.get(product.id);
    const bid = bidByProduct.get(product.id);
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
      id: product.id,
      tcg: product.tcg,
      name: product.name,
      setName: product.setName,
      setCode: product.setCode,
      productType: product.productType,
      imageUrl: product.imageUrl,
      priceUsd: product.priceUsd,
      set: product.set,
      market: {
        bestAskUsd,
        bestBidUsd,
        spreadUsd,
        spreadPct,
        askCount: ask?.count ?? 0,
        bidCount: bid?.count ?? 0,
        bestAsk: ask?.bestAsk ?? null,
        bestBid: bid?.bestBid ?? null,
      },
    };
  });

  return NextResponse.json({
    products: result,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
