import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getAuthenticatorComparisonStats,
  getSellerComparisonStats,
} from "@/server/services/condition-comparison.service";

/**
 * GET /api/condition-comparisons
 *
 * Query params:
 *   authenticatorId — stats for a specific authenticator
 *   sellerId        — stats for a specific seller
 *   tradeLegId      — single comparison record
 *   limit / offset  — paginated list (default 50/0)
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const authenticatorId = searchParams.get("authenticatorId");
  const sellerId = searchParams.get("sellerId");
  const tradeLegId = searchParams.get("tradeLegId");
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  // Single comparison by trade leg
  if (tradeLegId) {
    const comparison = await db.conditionComparison.findUnique({
      where: { tradeLegId },
    });
    if (!comparison) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(comparison);
  }

  // Authenticator stats
  if (authenticatorId) {
    const stats = await getAuthenticatorComparisonStats(authenticatorId);
    return NextResponse.json(stats);
  }

  // Seller stats (users can only see their own unless admin)
  if (sellerId) {
    const stats = await getSellerComparisonStats(sellerId);
    return NextResponse.json(stats);
  }

  // Paginated list of all comparisons
  const [comparisons, total] = await Promise.all([
    db.conditionComparison.findMany({
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
    db.conditionComparison.count(),
  ]);

  return NextResponse.json({
    comparisons,
    pagination: { total, limit, offset },
  });
}
