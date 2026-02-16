import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/middleware/rbac";
import { getCalibrationHistory } from "@/server/services/calibration.service";

// GET /api/admin/calibration/history — Paginated report history
export async function GET(req: NextRequest) {
  const ctx = await requireRole("ADMIN");
  if (ctx instanceof NextResponse) return ctx;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10), 0);

  const result = await getCalibrationHistory({ limit, offset });
  return NextResponse.json(result);
}
