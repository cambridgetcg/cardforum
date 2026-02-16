import { NextResponse } from "next/server";
import { requireRole } from "@/server/middleware/rbac";
import { dismissCalibrationReport } from "@/server/services/calibration.service";
import { z } from "zod";

const dismissSchema = z.object({
  reportId: z.string().min(1),
});

// POST /api/admin/calibration/dismiss — Dismiss a calibration report
export async function POST(req: Request) {
  const ctx = await requireRole("ADMIN");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const parsed = dismissSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await dismissCalibrationReport(parsed.data.reportId, ctx.userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to dismiss report";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
