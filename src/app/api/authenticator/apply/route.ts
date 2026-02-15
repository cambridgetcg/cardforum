import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  submitApplication,
  getAuthenticatorProfile,
} from "@/server/services/authenticator.service";
import { authenticatorApplicationSchema } from "@/lib/validators";

// GET /api/authenticator/apply — Get current user's authenticator profile/status
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getAuthenticatorProfile(session.user.id);
  return NextResponse.json({ authenticator: profile });
}

// POST /api/authenticator/apply — Submit authenticator application
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = authenticatorApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const authenticator = await submitApplication(session.user.id, parsed.data);
    return NextResponse.json({ authenticator }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to submit application";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
