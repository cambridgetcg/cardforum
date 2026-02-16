import { NextResponse } from "next/server";
import { withAuth } from "@/server/middleware/with-auth";
import { getCollectionStats } from "@/server/services/collection.service";

// GET /api/collection/stats — Collection stats with set completion
export const GET = withAuth(async (_req, { userId }) => {
  try {
    const stats = await getCollectionStats(userId);
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ error: "Failed to load collection stats" }, { status: 500 });
  }
});
