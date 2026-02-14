import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/dashboard — Dashboard stats for current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [haveCount, wantCount, activeTrades, completedTrades, proposals] =
    await Promise.all([
      db.haveListing.count({ where: { userId, isActive: true } }),
      db.wantListing.count({ where: { userId, isActive: true } }),
      db.trade.count({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
          status: {
            notIn: ["COMPLETED", "REJECTED", "CANCELLED"],
          },
        },
      }),
      db.trade.count({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
          status: "COMPLETED",
        },
      }),
      db.matchProposal.count({
        where: {
          isViable: true,
          expiresAt: { gt: new Date() },
          trade: null,
          legs: {
            some: {
              OR: [{ fromUserId: userId }, { toUserId: userId }],
            },
          },
        },
      }),
    ]);

  return NextResponse.json({
    listings: haveCount + wantCount,
    haveCount,
    wantCount,
    activeTrades,
    completedTrades,
    pendingProposals: proposals,
  });
}
