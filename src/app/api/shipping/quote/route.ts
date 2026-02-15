import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { internationalQuoteSchema } from "@/lib/validators";
import { estimateInternationalCost } from "@/server/services/shipping.service";
import { CUSTOMS_HS_CODE } from "@/lib/constants";

/**
 * POST /api/shipping/quote — Get international shipping cost estimate
 *
 * Used to show users the cost before they accept a trade with international legs.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = internationalQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { fromCountry, toCountry, cardValueCents } = parsed.data;

  if (fromCountry === toCountry) {
    return NextResponse.json({
      isInternational: false,
      baseCost: 0,
      insuranceCost: 0,
      totalCost: 0,
      message: "Domestic shipping — no additional international cost",
    });
  }

  const quote = estimateInternationalCost(cardValueCents);

  return NextResponse.json({
    isInternational: true,
    fromCountry,
    toCountry,
    ...quote,
    customs: {
      hsCode: CUSTOMS_HS_CODE,
      declaredValue: cardValueCents,
      description: "Trading card game collectible",
      note: "Import duties/taxes are the recipient's responsibility",
    },
  });
}
