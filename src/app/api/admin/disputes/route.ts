import { NextResponse, type NextRequest } from "next/server";
import { withRole } from "@/server/middleware/rbac";
import { getAllDisputes, getOpenDisputes } from "@/server/services/dispute.service";

// GET /api/admin/disputes?status=OPEN — List all disputes (admin only)
export const GET = withRole("ADMIN")(async (req: NextRequest) => {
  const status = req.nextUrl.searchParams.get("status");

  const disputes = status === "open"
    ? await getOpenDisputes()
    : await getAllDisputes(status ?? undefined);

  return NextResponse.json({ disputes });
});
