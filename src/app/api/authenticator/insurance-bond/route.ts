import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { recordInsuranceBondSchema } from "@/lib/validators";
import { recordInsuranceBond } from "@/server/services/fee.service";
import { db } from "@/lib/db";

// POST /api/authenticator/insurance-bond — Record bond payment for PREMIUM eligibility
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = recordInsuranceBondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const authenticator = await db.authenticator.findUnique({
      where: { userId: session.user.id },
    });
    if (!authenticator) {
      return NextResponse.json({ error: "Authenticator not found" }, { status: 404 });
    }

    const updated = await recordInsuranceBond(
      authenticator.id,
      session.user.id,
      parsed.data.amount,
    );
    return NextResponse.json({ authenticator: updated }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record bond";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
