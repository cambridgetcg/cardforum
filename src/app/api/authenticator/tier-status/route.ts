import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTierEligibility } from "@/server/services/tier-promotion.service";

// GET /api/authenticator/tier-status — Check tier promotion eligibility
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const eligibility = await getTierEligibility(session.user.id);
    return NextResponse.json({ eligibility });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get tier status";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
