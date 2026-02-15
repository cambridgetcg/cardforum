import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { confirmDeliverySchema } from "@/lib/validators";
import { confirmDelivery } from "@/server/services/shipping.service";
import { transitionTrade } from "@/server/services/trade.service";
import { db } from "@/lib/db";

// PATCH /api/trades/[tradeId]/legs/[legId]/deliver — Confirm delivery (recipient)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tradeId: string; legId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tradeId, legId } = await params;

  const body = await req.json();
  const parsed = confirmDeliverySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const allDelivered = await confirmDelivery(legId, session.user.id, parsed.data.photos);

    // If all legs are delivered, transition trade to DELIVERED then COMPLETED
    if (allDelivered) {
      const trade = await db.trade.findUnique({
        where: { id: tradeId },
        select: { status: true, userAId: true },
      });

      if (trade && trade.status !== "DELIVERED" && trade.status !== "COMPLETED") {
        await transitionTrade(tradeId, trade.userAId, "DELIVERED");
        await transitionTrade(tradeId, trade.userAId, "COMPLETED");
      }
    }

    return NextResponse.json({ allDelivered });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to confirm delivery";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
