import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCached, setCached } from "@/lib/orderbook-cache";

/**
 * GET /api/orderbook/sealed?productId=xxx
 * Returns order book depth for sealed product listings.
 */
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("productId");

  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  const cacheKey = `orderbook:sealed:${productId}`;
  const cached = getCached<object>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "public, max-age=10" },
    });
  }

  const [product, haveListings, wantListings] = await Promise.all([
    db.sealedProduct.findUnique({ where: { id: productId } }),
    db.sealedHaveListing.findMany({
      where: { sealedProductId: productId, isActive: true },
      select: { askPrice: true, condition: true, quantity: true },
      orderBy: { askPrice: "asc" },
    }),
    db.sealedWantListing.findMany({
      where: { sealedProductId: productId, isActive: true },
      select: { bidPrice: true, minCondition: true, maxQuantity: true },
      orderBy: { bidPrice: "desc" },
    }),
  ]);

  if (!product) {
    return NextResponse.json({ error: "Sealed product not found" }, { status: 404 });
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
      askMap.set(h.askPrice, {
        totalQty: h.quantity,
        listings: 1,
        conditions: new Set([h.condition]),
      });
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
  const bidMap = new Map<
    number,
    { totalQty: number; listings: number; minConditions: Set<string> }
  >();
  for (const w of wantListings) {
    const entry = bidMap.get(w.bidPrice);
    if (entry) {
      entry.totalQty += w.maxQuantity;
      entry.listings += 1;
      entry.minConditions.add(w.minCondition);
    } else {
      bidMap.set(w.bidPrice, {
        totalQty: w.maxQuantity,
        listings: 1,
        minConditions: new Set([w.minCondition]),
      });
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

  const result = {
    product: {
      id: product.id,
      tcg: product.tcg,
      name: product.name,
      setName: product.setName,
      setCode: product.setCode,
      productType: product.productType,
      imageUrl: product.imageUrl,
    },
    asks,
    bids,
    summary: { bestAsk, bestBid, spread, spreadPct, midpoint, totalAsks, totalBids },
  };

  setCached(cacheKey, result);

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, max-age=10" },
  });
}
