import { NextResponse, type NextRequest } from "next/server";
import { runCalibration } from "@/server/services/calibration.service";

// GET /api/cron/ccs-calibration — Run daily CCS calibration analysis
// Called by Vercel Cron daily at 8am UTC
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runCalibration();
    if (!result) {
      return NextResponse.json({ success: true, message: "Insufficient data for calibration" });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Calibration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
