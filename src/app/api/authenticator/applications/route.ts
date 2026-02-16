import { NextResponse } from "next/server";
import { withRole } from "@/server/middleware/rbac";
import { listApplications } from "@/server/services/authenticator.service";
import type { AuthenticatorApplicationStatus } from "@/types/domain";

// GET /api/authenticator/applications — List pending applications (admin)
export const GET = withRole("ADMIN")(async (req) => {
  const status = req.nextUrl.searchParams.get("status") as
    | AuthenticatorApplicationStatus
    | null;

  const applications = await listApplications(status ?? undefined);
  return NextResponse.json({ applications });
});
