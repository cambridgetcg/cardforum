import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { resolveRole, hasRole } from "@/server/middleware/rbac";
import { reviewApplication } from "@/server/services/authenticator.service";
import { applicationReviewSchema } from "@/lib/validators";

// PATCH /api/authenticator/applications/[id] — Review an application (admin)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await resolveRole(session.user.id);
  if (!hasRole(role, "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = applicationReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const updated = await reviewApplication(id, session.user.id, parsed.data);
    return NextResponse.json({ authenticator: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to review application";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
