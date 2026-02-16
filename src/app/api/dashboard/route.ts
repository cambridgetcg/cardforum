import { NextResponse } from "next/server";
import { withAuth } from "@/server/middleware/with-auth";
import { db } from "@/lib/db";

// GET /api/dashboard — Dashboard stats for current user
export const GET = withAuth(async (_req, { userId }) => {
  const [
    haveCount,
    wantCount,
    gradedHaveCount,
    gradedWantCount,
    activeTrades,
    completedTrades,
    proposals,
    expertPostCount,
    collectionCount,
  ] = await Promise.all([
    db.haveListing.count({ where: { userId, isActive: true } }),
    db.wantListing.count({ where: { userId, isActive: true } }),
    db.gradedHaveListing.count({ where: { userId, isActive: true } }),
    db.gradedWantListing.count({ where: { userId, isActive: true } }),
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
    db.expertPost.count({ where: { authorId: userId, status: "PUBLISHED" } }),
    db.collectionEntry.aggregate({
      where: { userId },
      _sum: { quantity: true },
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    listings: haveCount + wantCount + gradedHaveCount + gradedWantCount,
    haveCount,
    wantCount,
    gradedHaveCount,
    gradedWantCount,
    activeTrades,
    completedTrades,
    pendingProposals: proposals,
    expertPostCount,
    collectionCards: collectionCount._sum.quantity ?? 0,
    collectionEntries: collectionCount._count._all,
  });
});
