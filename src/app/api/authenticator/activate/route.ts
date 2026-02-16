import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { activateAuthenticator } from "@/server/services/authenticator.service";

/**
 * POST /api/authenticator/activate
 *
 * Activates an approved authenticator (APPROVED/ONBOARDING → ACTIVE).
 * Only callable by the authenticator's own user.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find the authenticator record for this user
  const authenticator = await db.authenticator.findUnique({
    where: { userId: session.user.id },
  });

  if (!authenticator) {
    return NextResponse.json({ error: "No authenticator profile found" }, { status: 404 });
  }

  try {
    const updated = await activateAuthenticator(authenticator.id);
    return NextResponse.json({ authenticator: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to activate";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
