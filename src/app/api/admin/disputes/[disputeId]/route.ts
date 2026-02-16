import { NextResponse } from "next/server";
import { requireRole } from "@/server/middleware/rbac";
import { getDispute } from "@/server/services/dispute.service";

type RouteContext = { params: Promise<{ disputeId: string }> };

// GET /api/admin/disputes/[disputeId] — Full dispute context (admin only)
export async function GET(_req: Request, context: RouteContext) {
  const ctx = await requireRole("ADMIN");
  if (ctx instanceof NextResponse) return ctx;

  const { disputeId } = await context.params;

  const dispute = await getDispute(disputeId);
  if (!dispute) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }

  return NextResponse.json({ dispute });
}
