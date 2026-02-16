import { NextResponse } from "next/server";
import { withRole } from "@/server/middleware/rbac";
import { getConfigAuditLog } from "@/server/services/config.service";

// GET /api/admin/config/audit?key=fees.platform_rate&limit=50
export const GET = withRole("ADMIN")(async (req) => {
  const key = req.nextUrl.searchParams.get("key") ?? undefined;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 100);

  const entries = await getConfigAuditLog(key, limit);
  return NextResponse.json({ entries });
});
