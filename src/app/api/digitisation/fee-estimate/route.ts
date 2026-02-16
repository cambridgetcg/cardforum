import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getConfig } from "@/server/services/config.service";

/**
 * GET /api/digitisation/fee-estimate?authenticatorId=...
 *
 * Returns the verification fee for a given authenticator based on their tier.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authenticatorId = req.nextUrl.searchParams.get("authenticatorId");
  if (!authenticatorId) {
    return NextResponse.json({ error: "authenticatorId is required" }, { status: 400 });
  }

  const authenticator = await db.authenticator.findUnique({
    where: { id: authenticatorId },
    select: {
      tier: true,
      businessName: true,
      region: true,
    },
  });

  if (!authenticator) {
    return NextResponse.json({ error: "Authenticator not found" }, { status: 404 });
  }

  const feeStructure = await getConfig("authenticator.fee_structure");
  const tier = (authenticator.tier ?? "STANDARD") as string;
  const feeConfig = feeStructure[tier] ?? feeStructure.STANDARD;

  return NextResponse.json({
    authenticatorId,
    businessName: authenticator.businessName,
    region: authenticator.region,
    tier,
    feeCents: feeConfig.baseFee,
    platformPercent: feeConfig.platformPercent,
  });
}
