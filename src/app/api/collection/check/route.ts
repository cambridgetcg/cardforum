import { NextResponse } from "next/server";
import { withAuth } from "@/server/middleware/with-auth";
import { getOwnedCardIds } from "@/server/services/collection.service";

// GET /api/collection/check?cardIds=id1,id2,id3 — Batch check ownership
export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url);
  const cardIdsParam = url.searchParams.get("cardIds") ?? "";
  const cardIds = cardIdsParam.split(",").filter(Boolean);

  if (cardIds.length === 0) {
    return NextResponse.json({ owned: [] });
  }

  if (cardIds.length > 200) {
    return NextResponse.json({ error: "Max 200 card IDs" }, { status: 400 });
  }

  try {
    const owned = await getOwnedCardIds(userId, cardIds);
    return NextResponse.json({ owned: [...owned] });
  } catch {
    return NextResponse.json({ error: "Failed to check collection" }, { status: 500 });
  }
});
