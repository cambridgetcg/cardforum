import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { resolveRole, hasRole } from "@/server/middleware/rbac";
import { resolveDispute } from "@/server/services/dispute.service";
import type { DisputeStatus } from "@/types/domain";

const VALID_RESOLUTIONS: DisputeStatus[] = [
  "RESOLVED_BUYER",
  "RESOLVED_SELLER",
  "ESCALATED",
  "CLOSED",
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ disputeId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await resolveRole(session.user.id);
  if (!hasRole(role, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { disputeId } = await params;
  const body = await req.json();

  const { status, resolution } = body as {
    status?: string;
    resolution?: string;
  };

  if (!status || !VALID_RESOLUTIONS.includes(status as DisputeStatus)) {
    return NextResponse.json(
      { error: "Invalid resolution status" },
      { status: 400 },
    );
  }

  if (!resolution || typeof resolution !== "string") {
    return NextResponse.json(
      { error: "Resolution reason is required" },
      { status: 400 },
    );
  }

  try {
    await resolveDispute(
      disputeId,
      session.user.id,
      status as DisputeStatus,
      resolution,
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to resolve dispute";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
