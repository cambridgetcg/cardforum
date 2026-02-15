import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/authenticator/analytics — Operator analytics dashboard
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Add proper admin role check.

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalAuthenticators,
    activeAuthenticators,
    regionCoverage,
    tierDistribution,
    recentVerifications,
    recentDisputes,
    ratingDistribution,
  ] = await Promise.all([
    // Total authenticators
    db.authenticator.count(),

    // Active authenticators
    db.authenticator.count({
      where: { isActive: true, applicationStatus: "ACTIVE" },
    }),

    // Region coverage: authenticators per region
    db.authenticator.groupBy({
      by: ["region"],
      where: { isActive: true, applicationStatus: "ACTIVE" },
      _count: true,
      orderBy: { _count: { region: "desc" } },
    }),

    // Tier distribution
    db.authenticator.groupBy({
      by: ["tier"],
      where: { isActive: true, applicationStatus: "ACTIVE" },
      _count: true,
    }),

    // Verification velocity: completed in last 30 days
    db.verificationAssignment.count({
      where: { completedAt: { gte: thirtyDaysAgo } },
    }),

    // Dispute rate in last 30 days
    db.dispute.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),

    // Rating distribution (average rating per tier)
    db.authenticator.groupBy({
      by: ["tier"],
      where: { isActive: true, applicationStatus: "ACTIVE" },
      _avg: { rating: true },
      _min: { rating: true },
      _max: { rating: true },
    }),
  ]);

  // Pending applications
  const pendingApplications = await db.authenticator.count({
    where: {
      applicationStatus: { in: ["SUBMITTED", "PENDING_REVIEW", "MORE_INFO_NEEDED"] },
    },
  });

  // Average load utilization
  const loadStats = await db.authenticator.aggregate({
    where: { isActive: true, applicationStatus: "ACTIVE" },
    _avg: { currentLoad: true, maxLoad: true },
    _sum: { currentLoad: true },
  });

  return NextResponse.json({
    overview: {
      totalAuthenticators,
      activeAuthenticators,
      pendingApplications,
      verificationsLast30d: recentVerifications,
      disputesLast30d: recentDisputes,
    },
    regionCoverage: regionCoverage.map((r) => ({
      region: r.region,
      count: r._count,
    })),
    tierDistribution: tierDistribution.map((t) => ({
      tier: t.tier,
      count: t._count,
    })),
    ratingDistribution: ratingDistribution.map((r) => ({
      tier: r.tier,
      avg: r._avg.rating,
      min: r._min.rating,
      max: r._max.rating,
    })),
    loadUtilization: {
      averageLoad: loadStats._avg.currentLoad,
      averageCapacity: loadStats._avg.maxLoad,
      totalActiveAssignments: loadStats._sum.currentLoad,
    },
  });
}
