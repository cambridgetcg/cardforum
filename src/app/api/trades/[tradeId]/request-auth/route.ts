import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requestAuthentication } from "@/server/services/trade.service";

// POST /api/trades/:tradeId/request-auth — Upgrade DIRECT trade to AUTHENTICATED
export async function POST(_req: Request, { params }: { params: Promise<{ tradeId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tradeId } = await params;

  try {
    const trade = await requestAuthentication(tradeId, session.user.id);
    return NextResponse.json(trade);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to request authentication";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
