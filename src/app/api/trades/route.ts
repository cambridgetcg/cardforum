import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserTrades, transitionTrade } from "@/server/services/trade.service";
import { tradeActionSchema } from "@/lib/validators";

const ACTION_STATUS_MAP = {
  accept: "ACCEPTED",
  reject: "REJECTED",
  cancel: "CANCELLED",
} as const;

// GET /api/trades — List current user's trades
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trades = await getUserTrades(session.user.id);
  return NextResponse.json({ trades });
}

// POST /api/trades — Create trade from proposal OR transition existing trade
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // Create trade from proposal
  if (body.proposalId) {
    const proposal = await db.matchProposal.findUnique({
      where: { id: body.proposalId },
      include: { legs: true, trade: true },
    });

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }
    if (proposal.trade) {
      return NextResponse.json({ error: "Trade already exists for this proposal" }, { status: 409 });
    }

    // Get unique user IDs from the proposal legs
    const userIds = [...new Set([
      ...proposal.legs.map((l) => l.fromUserId),
      ...proposal.legs.map((l) => l.toUserId),
    ])];

    if (!userIds.includes(session.user.id)) {
      return NextResponse.json({ error: "Not part of this proposal" }, { status: 403 });
    }

    // Use first two distinct users as userA and userB
    const trade = await db.trade.create({
      data: {
        proposalId: proposal.id,
        userAId: userIds[0],
        userBId: userIds[1] ?? userIds[0],
        status: "PROPOSED",
        statusHistory: [{ status: "PROPOSED", at: new Date().toISOString() }],
      },
      include: { legs: true },
    });

    return NextResponse.json(trade, { status: 201 });
  }

  // Transition existing trade
  const parsed = tradeActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { tradeId, action } = parsed.data;
  const newStatus = ACTION_STATUS_MAP[action];

  try {
    const trade = await transitionTrade(tradeId, session.user.id, newStatus);
    return NextResponse.json(trade);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update trade";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
