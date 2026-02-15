import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { listApplications } from "@/server/services/authenticator.service";
import type { AuthenticatorApplicationStatus } from "@/types/domain";

// GET /api/authenticator/applications — List pending applications (admin)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Add proper admin role check. For now, any authenticated user can view.
  // This should be restricted to admin users in production.

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as
    | AuthenticatorApplicationStatus
    | null;

  const applications = await listApplications(status ?? undefined);
  return NextResponse.json({ applications });
}
