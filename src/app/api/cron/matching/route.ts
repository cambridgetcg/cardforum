import { NextResponse, type NextRequest } from "next/server";
import { runMatching } from "@/server/services/matching.service";

/**
 * POST /api/cron/matching
 *
 * Triggers the matching engine: load active listings, build graph,
 * find cycles/chains, score proposals, persist to DB, auto-accept eligible.
 *
 * Vercel Cron config: see vercel.json (every 5 minutes)
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const proposals = await runMatching();

    return NextResponse.json({
      proposalsCreated: proposals.length,
      proposals: proposals.map((p) => ({
        score: p.score,
        cycleLength: p.cycle.length,
        regions: p.cycle.regions,
        legs: p.legs.length,
        isGraded: p.isGraded ?? false,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Matching failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
