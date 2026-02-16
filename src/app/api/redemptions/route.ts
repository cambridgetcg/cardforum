import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createRedemptionSchema } from "@/lib/validators";
import { requestRedemption, getUserRedemptions } from "@/server/services/redemption.service";

// GET /api/redemptions — List current user's redemptions
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redemptions = await getUserRedemptions(session.user.id);
  return NextResponse.json(redemptions);
}

// POST /api/redemptions — Request a redemption
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createRedemptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    // Auto-detect country from default shipping address if not provided
    let redeemerCountry = parsed.data.redeemerCountry;
    if (!redeemerCountry) {
      const defaultAddress = await db.shippingAddress.findFirst({
        where: { userId: session.user.id, isDefault: true },
        select: { country: true },
      });
      if (!defaultAddress?.country) {
        return NextResponse.json(
          { error: "No shipping address found. Add an address or provide redeemerCountry." },
          { status: 400 },
        );
      }
      redeemerCountry = defaultAddress.country;
    }

    const redemption = await requestRedemption({
      tokenId: parsed.data.tokenId,
      userId: session.user.id,
      redeemerCountry,
      preferredVaultId: parsed.data.preferredVaultId,
    });
    return NextResponse.json(redemption, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Redemption failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
