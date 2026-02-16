import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { resolveRole, hasRole } from "@/server/middleware/rbac";
import { reviewKYC, suspendKYC, revokeKYC, reinstateKYC } from "@/server/services/kyc.service";
import { z } from "zod";

const reviewBodySchema = z.object({
  action: z.enum(["approve", "reject", "suspend", "revoke", "reinstate"]),
  reason: z.string().max(1000).optional(),
  reinstateToStatus: z.enum(["BASIC_VERIFIED", "ENHANCED_VERIFIED"]).optional(),
});

// POST /api/kyc/[userId]/review — Review a user's KYC (admin)
export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await resolveRole(session.user.id);
  if (!hasRole(role, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  const body = await req.json();
  const parsed = reviewBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    let user;
    switch (parsed.data.action) {
      case "approve":
      case "reject":
        user = await reviewKYC(userId, session.user.id, {
          action: parsed.data.action,
          reason: parsed.data.reason,
        });
        break;
      case "suspend":
        user = await suspendKYC(
          userId,
          session.user.id,
          parsed.data.reason ?? "No reason provided",
        );
        break;
      case "revoke":
        user = await revokeKYC(userId, session.user.id, parsed.data.reason ?? "No reason provided");
        break;
      case "reinstate":
        if (!parsed.data.reinstateToStatus) {
          return NextResponse.json(
            { error: "reinstateToStatus is required for reinstate action" },
            { status: 400 },
          );
        }
        user = await reinstateKYC(userId, session.user.id, parsed.data.reinstateToStatus);
        break;
    }

    return NextResponse.json({ kycStatus: user.kycStatus });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to review KYC";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
