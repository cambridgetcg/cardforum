import { NextResponse, type NextRequest } from "next/server";
import { getTrustProfile } from "@/server/services/trust-profile.service";

/**
 * GET /api/users/[userId]/trust
 *
 * Public endpoint — returns the trust profile for a user.
 * Shows composite score (0–100) plus per-dimension breakdown.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const profile = await getTrustProfile(userId);

  return NextResponse.json(profile);
}
