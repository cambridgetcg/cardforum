import { NextResponse, type NextRequest } from "next/server";
import { runDailyTierCheck } from "@/server/services/tier-promotion.service";

// GET /api/cron/tier-check — Run daily tier promotion/demotion checks
// Called by Vercel Cron daily at 7am UTC
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDailyTierCheck();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tier check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
