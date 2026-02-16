import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/middleware/rbac";
import { getLatestCalibrationReport, runCalibration } from "@/server/services/calibration.service";

// GET /api/admin/calibration — Get latest calibration report
export async function GET() {
  const ctx = await requireRole("ADMIN");
  if (ctx instanceof NextResponse) return ctx;

  const report = await getLatestCalibrationReport();
  if (!report) {
    return NextResponse.json({ report: null, message: "No calibration reports yet" });
  }
  return NextResponse.json({ report });
}

// POST /api/admin/calibration — Trigger manual calibration run
export async function POST() {
  const ctx = await requireRole("ADMIN");
  if (ctx instanceof NextResponse) return ctx;

  try {
    const result = await runCalibration();
    if (!result) {
      return NextResponse.json({ success: true, message: "Insufficient data for calibration" });
    }
    return NextResponse.json({ success: true, report: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Calibration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
