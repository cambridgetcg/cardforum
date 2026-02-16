import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withRole } from "@/server/middleware/rbac";
import { runMatching, getUserProposals } from "@/server/services/matching.service";

// GET /api/matches — View match proposals for current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const proposals = await getUserProposals(session.user.id);
  return NextResponse.json({ proposals });
}

// POST /api/matches — Trigger global matching run (admin only)
export const POST = withRole("ADMIN")(async () => {
  const proposals = await runMatching();
  return NextResponse.json({
    found: proposals.length,
    message: `Found ${proposals.length} potential bridge matches`,
  });
});
