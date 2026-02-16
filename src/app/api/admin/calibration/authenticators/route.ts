import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/middleware/rbac";
import { getAuthenticatorCalibrationStats } from "@/server/services/calibration.service";

// GET /api/admin/calibration/authenticators — Per-authenticator calibration stats
export async function GET(req: NextRequest) {
  const ctx = await requireRole("ADMIN");
  if (ctx instanceof NextResponse) return ctx;

  const url = new URL(req.url);
  const windowDays = parseInt(url.searchParams.get("windowDays") ?? "30", 10);

  const stats = await getAuthenticatorCalibrationStats({ windowDays: Math.min(windowDays, 365) });
  return NextResponse.json({ authenticators: stats });
}
