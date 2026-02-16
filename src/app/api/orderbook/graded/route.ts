import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCached, setCached } from "@/lib/orderbook-cache";

/**
 * GET /api/orderbook/graded?cardId=xxx&gradingCompany=PSA
 * Returns order book depth for graded card listings.
 */
export async function GET(req: NextRequest) {
  const cardId = req.nextUrl.searchParams.get("cardId");
  const gradingCompany = req.nextUrl.searchParams.get("gradingCompany");

  if (!cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }

  const cacheKey = `orderbook:graded:${cardId}:${gradingCompany ?? "all"}`;
  const cached = getCached<object>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "public, max-age=10" },
    });
  }

  const haveWhere: Record<string, unknown> = { cardId, isActive: true };
  const wantWhere: Record<string, unknown> = { cardId, isActive: true };
  if (gradingCompany) {
    haveWhere.gradingCompany = gradingCompany;
    wantWhere.gradingCompany = gradingCompany;
  }

  const [haveListings, wantListings] = await Promise.all([
    db.gradedHaveListing.findMany({
      where: haveWhere,
      select: { askPrice: true, gradingCompany: true, grade: true },
      orderBy: { askPrice: "asc" },
    }),
    db.gradedWantListing.findMany({
      where: wantWhere,
      select: { bidPrice: true, gradingCompany: true, minGrade: true, maxGrade: true },
      orderBy: { bidPrice: "desc" },
    }),
  ]);

  // Aggregate asks by price level
  const askMap = new Map<number, { totalQty: number; listings: number; grades: Set<string> }>();
  for (const h of haveListings) {
    const entry = askMap.get(h.askPrice);
    const gradeLabel = `${h.gradingCompany} ${h.grade}`;
    if (entry) {
      entry.totalQty += 1;
      entry.listings += 1;
      entry.grades.add(gradeLabel);
    } else {
      askMap.set(h.askPrice, { totalQty: 1, listings: 1, grades: new Set([gradeLabel]) });
    }
  }
  const asks = Array.from(askMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([price, data]) => ({
      price,
      totalQty: data.totalQty,
      listings: data.listings,
      grades: Array.from(data.grades),
    }));

  // Aggregate bids by price level
  const bidMap = new Map<
    number,
    { totalQty: number; listings: number; gradeRanges: Set<string> }
  >();
  for (const w of wantListings) {
    const entry = bidMap.get(w.bidPrice);
    const rangeLabel = w.maxGrade
      ? `${w.gradingCompany ?? "Any"} ${w.minGrade}-${w.maxGrade}`
      : `${w.gradingCompany ?? "Any"} ${w.minGrade}+`;
    if (entry) {
      entry.totalQty += 1;
      entry.listings += 1;
      entry.gradeRanges.add(rangeLabel);
    } else {
      bidMap.set(w.bidPrice, { totalQty: 1, listings: 1, gradeRanges: new Set([rangeLabel]) });
    }
  }
  const bids = Array.from(bidMap.entries())
    .sort(([a], [b]) => b - a)
    .map(([price, data]) => ({
      price,
      totalQty: data.totalQty,
      listings: data.listings,
      gradeRanges: Array.from(data.gradeRanges),
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

  const result = {
    asks,
    bids,
    summary: {
      bestAsk,
      bestBid,
      spread,
      spreadPct,
      midpoint,
      totalAsks: haveListings.length,
      totalBids: wantListings.length,
    },
  };

  setCached(cacheKey, result);

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, max-age=10" },
  });
}
