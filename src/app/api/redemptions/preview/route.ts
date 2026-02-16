import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSameCustomsZone } from "@/lib/constants";
import { getConfigs } from "@/server/services/config.service";

/**
 * GET /api/redemptions/preview?tokenId=...
 *
 * Auto-detects redeemer country from their default shipping address.
 * Returns available vaults with fee breakdown and scoring.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokenId = req.nextUrl.searchParams.get("tokenId");
  if (!tokenId) {
    return NextResponse.json({ error: "tokenId is required" }, { status: 400 });
  }

  // Get token details
  const token = await db.digitalToken.findUnique({
    where: { id: tokenId },
    select: {
      id: true,
      cardId: true,
      condition: true,
      language: true,
      currentOwnerId: true,
      status: true,
      card: { select: { name: true, setName: true } },
    },
  });

  if (!token) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }
  if (token.currentOwnerId !== session.user.id) {
    return NextResponse.json({ error: "You do not own this token" }, { status: 403 });
  }
  if (token.status !== "ACTIVE") {
    return NextResponse.json(
      { error: `Token is not redeemable (status: ${token.status})` },
      { status: 400 },
    );
  }

  // Auto-detect country from default shipping address
  const defaultAddress = await db.shippingAddress.findFirst({
    where: { userId: session.user.id, isDefault: true },
    select: { country: true, city: true },
  });

  const redeemerCountry = defaultAddress?.country ?? null;

  // Find available vaults
  const inventoryItems = await db.authenticatorInventory.findMany({
    where: {
      cardId: token.cardId,
      condition: token.condition,
      language: token.language,
      isAvailable: true,
      quantity: { gt: 0 },
      authenticator: { isVaultOperator: true, isActive: true },
    },
    include: {
      authenticator: {
        select: {
          id: true,
          businessName: true,
          region: true,
          rating: true,
          currentLoad: true,
          regionRef: { select: { country: true } },
        },
      },
    },
  });

  // Load config for redemption fees
  const {
    "digital.redemption_base_fee_cents": baseFee,
    "digital.cross_zone_surcharge_cents": surchargeRate,
  } = await getConfigs(["digital.redemption_base_fee_cents", "digital.cross_zone_surcharge_cents"]);

  // Score and sort vaults
  const vaults = inventoryItems.map((item) => {
    const vaultCountry = item.authenticator.regionRef?.country ?? "";
    const sameZone = redeemerCountry ? isSameCustomsZone(redeemerCountry, vaultCountry) : false;
    const crossZone = redeemerCountry ? !sameZone : true;
    const surcharge = crossZone ? surchargeRate : 0;
    const totalFee = baseFee + surcharge;

    return {
      authenticatorId: item.authenticator.id,
      businessName: item.authenticator.businessName,
      region: item.authenticator.region,
      vaultCountry,
      rating: item.authenticator.rating,
      stock: item.quantity,
      sameZone,
      fee: {
        baseCents: baseFee,
        surchareCents: surcharge,
        totalCents: totalFee,
      },
      score:
        (sameZone ? 1000 : 0) + item.authenticator.rating * 10 - item.authenticator.currentLoad,
    };
  });

  vaults.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    token: {
      id: token.id,
      cardName: token.card?.name,
      setName: token.card?.setName,
      condition: token.condition,
    },
    redeemerCountry,
    redeemerCity: defaultAddress?.city ?? null,
    hasAddress: !!defaultAddress,
    vaults,
    recommended: vaults.length > 0 ? vaults[0].authenticatorId : null,
  });
}
