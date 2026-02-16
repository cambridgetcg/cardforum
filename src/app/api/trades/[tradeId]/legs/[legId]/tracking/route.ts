import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLegTrackingStatus } from "@/server/services/carrier-tracking.service";

type Params = { params: Promise<{ tradeId: string; legId: string }> };

/**
 * GET /api/trades/[tradeId]/legs/[legId]/tracking
 *
 * Returns live carrier tracking status for a trade leg.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tradeId, legId } = await params;

  // Verify user is a participant
  const trade = await db.trade.findUnique({
    where: { id: tradeId },
    select: { participantIds: true },
  });

  if (!trade) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }

  const participants = trade.participantIds as string[];
  if (!participants.includes(session.user.id)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const status = await getLegTrackingStatus(legId);

  if (!status) {
    return NextResponse.json({ error: "No tracking information available" }, { status: 404 });
  }

  return NextResponse.json(status);
}
