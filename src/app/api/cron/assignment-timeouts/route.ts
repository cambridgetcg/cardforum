import { NextResponse, type NextRequest } from "next/server";
import { checkAcceptanceTimeouts } from "@/server/services/reserve-assignment.service";

// POST /api/cron/assignment-timeouts — Check for timed-out verification assignments
// Intended to be called by Vercel Cron or external scheduler
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await checkAcceptanceTimeouts();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Timeout check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
