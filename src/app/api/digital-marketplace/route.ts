import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createDigitalTokenListingSchema } from "@/lib/validators";
import {
  createListing,
  getActiveListings,
  getMarketData,
} from "@/server/services/digital-trade.service";
import type { Condition } from "@/generated/prisma/client";

// GET /api/digital-marketplace — Browse listings or market data
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const view = searchParams.get("view");

  // Market data: /api/digital-marketplace?view=data&cardId=...&condition=...
  if (view === "data") {
    const cardId = searchParams.get("cardId");
    const condition = searchParams.get("condition") as Condition | null;
    if (!cardId || !condition) {
      return NextResponse.json({ error: "cardId and condition are required" }, { status: 400 });
    }
    const data = await getMarketData(cardId, condition);
    return NextResponse.json(data);
  }

  // Browse active listings
  const filters = {
    cardId: searchParams.get("cardId") ?? undefined,
    condition: (searchParams.get("condition") as Condition) ?? undefined,
    tcg: searchParams.get("tcg") ?? undefined,
    minPrice: searchParams.get("minPrice") ? parseInt(searchParams.get("minPrice")!) : undefined,
    maxPrice: searchParams.get("maxPrice") ? parseInt(searchParams.get("maxPrice")!) : undefined,
    limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined,
    offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : undefined,
  };

  const listings = await getActiveListings(filters);
  return NextResponse.json(listings);
}

// POST /api/digital-marketplace — Create a listing
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createDigitalTokenListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const listing = await createListing(parsed.data.tokenId, session.user.id, parsed.data.askPrice);
    return NextResponse.json(listing, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create listing";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
