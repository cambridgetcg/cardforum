import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUserTokens,
  getToken,
  getGlobalStock,
  getRedeemableLocations,
} from "@/server/services/digital-token.service";
import type { Condition } from "@/generated/prisma/client";

// GET /api/digital-tokens — User's tokens or stock queries
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const view = searchParams.get("view");

  // Stock lookup: /api/digital-tokens?view=stock&cardId=...&condition=...
  if (view === "stock") {
    const cardId = searchParams.get("cardId");
    const condition = searchParams.get("condition") as Condition | null;
    if (!cardId || !condition) {
      return NextResponse.json({ error: "cardId and condition are required" }, { status: 400 });
    }
    const stock = await getGlobalStock(cardId, condition);
    return NextResponse.json(stock);
  }

  // Redeemable locations: /api/digital-tokens?view=redeem&cardId=...&condition=...&country=...
  if (view === "redeem") {
    const cardId = searchParams.get("cardId");
    const condition = searchParams.get("condition") as Condition | null;
    const country = searchParams.get("country");
    if (!cardId || !condition || !country) {
      return NextResponse.json(
        { error: "cardId, condition, and country are required" },
        { status: 400 },
      );
    }
    const locations = await getRedeemableLocations(cardId, condition, country);
    return NextResponse.json(locations);
  }

  // Single token: /api/digital-tokens?tokenId=...
  const tokenId = searchParams.get("tokenId");
  if (tokenId) {
    const token = await getToken(tokenId);
    if (!token) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }
    return NextResponse.json(token);
  }

  // Default: user's tokens
  const tokens = await getUserTokens(session.user.id);
  return NextResponse.json(tokens);
}
