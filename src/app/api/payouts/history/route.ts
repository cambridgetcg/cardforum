import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPayouts } from "@/server/services/payout.service";

/**
 * GET /api/payouts/history — Returns the user's payout history.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payouts = await getUserPayouts(session.user.id);
  return NextResponse.json({ payouts });
}
