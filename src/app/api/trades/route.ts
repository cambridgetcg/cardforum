import { canCreateUnpaidProposal } from "@/server/services/trade-admission.service";
import {
  UNPAID_TRADE_ADMISSION,
  NEW_PAID_COMMERCE_RETIRED_MESSAGE,
  NEW_PAID_COMMERCE_RETIRED_STATUS,
} from "@/lib/commerce-policy";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserTrades, transitionTrade } from "@/server/services/trade.service";
import { tradeActionSchema } from "@/lib/validators";
import { createShippingDispute } from "@/server/services/dispute.service";
import type { TradeStatus } from "@/types/domain";

const ACTION_STATUS_MAP: Record<string, string> = {
  accept: "ACCEPTED",
  reject: "REJECTED",
  cancel: "CANCELLED",
  escrow: "ESCROWED",
  submit_cards: "CARDS_SUBMITTED",
  authenticate: "AUTHENTICATING",
  deliver: "DELIVERING",
  complete: "COMPLETED",
  dispute: "DISPUTED",
};

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
      return NextResponse.json(
        { error: "Trade already exists for this proposal" },
        { status: 409 },
      );
    }

    // Get unique user IDs from the proposal legs
    const userIds = [
      ...new Set([
        ...proposal.legs.map((l) => l.fromUserId),
        ...proposal.legs.map((l) => l.toUserId),
      ]),
    ];

    if (!userIds.includes(session.user.id)) {
      return NextResponse.json({ error: "Not part of this proposal" }, { status: 403 });
    }

    if (!(await canCreateUnpaidProposal(proposal.tradeMode, proposal.legs))) {
      return NextResponse.json(
        { error: NEW_PAID_COMMERCE_RETIRED_MESSAGE, code: "NEW_PAID_COMMERCE_RETIRED" },
        { status: NEW_PAID_COMMERCE_RETIRED_STATUS, headers: { "Cache-Control": "no-store" } },
      );
    }

    // Use first two distinct users as userA and userB
    const trade = await db.trade.create({
      data: {
        proposalId: proposal.id,
        userAId: userIds[0],
        userBId: userIds[1] ?? userIds[0],
        participantIds: userIds,
        mode: proposal.tradeMode ?? "AUTHENTICATED",
        status: "PROPOSED",
        statusHistory: [
          { status: "PROPOSED", at: new Date().toISOString(), admission: UNPAID_TRADE_ADMISSION },
        ],
        legs: {
          create: proposal.legs.map((leg) => ({
            haveListingId: leg.haveListingId,
            wantListingId: leg.wantListingId,
            gradedHaveListingId: leg.gradedHaveListingId,
            gradedWantListingId: leg.gradedWantListingId,
            isGraded: !!leg.gradedHaveListingId,
            fromUserId: leg.fromUserId,
            toUserId: leg.toUserId,
            region: leg.region,
            sequence: leg.sequence,
          })),
        },
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

  // Handle dispute action separately — uses createShippingDispute with structured data
  if (action === "dispute") {
    if (!parsed.data.reason) {
      return NextResponse.json({ error: "reason is required for dispute action" }, { status: 400 });
    }

    try {
      // If tradeLegId provided, create a per-leg shipping dispute
      if (parsed.data.tradeLegId) {
        const dispute = await createShippingDispute(
          tradeId,
          parsed.data.tradeLegId,
          session.user.id,
          parsed.data.reason,
          parsed.data.evidence ?? [],
        );
        return NextResponse.json({ dispute });
      }

      // Otherwise, fall through to general DISPUTED transition
      const trade = await transitionTrade(tradeId, session.user.id, "DISPUTED");
      return NextResponse.json(trade);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create dispute";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const newStatus = ACTION_STATUS_MAP[action] as TradeStatus;

  try {
    const trade = await transitionTrade(tradeId, session.user.id, newStatus);
    return NextResponse.json(trade);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update trade";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
