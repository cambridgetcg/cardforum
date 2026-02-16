import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTradeShippingDetails } from "@/server/services/shipping.service";

// GET /api/trades/[tradeId]/shipping — Get shipping details for all legs
export async function GET(_req: Request, { params }: { params: Promise<{ tradeId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tradeId } = await params;

  try {
    const details = await getTradeShippingDetails(tradeId, session.user.id);
    return NextResponse.json({ legs: details });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get shipping details";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
