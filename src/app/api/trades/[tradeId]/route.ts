import { NextResponse } from "next/server";
import { withAuthParams } from "@/server/middleware/with-auth";
import { db } from "@/lib/db";

// GET /api/trades/[tradeId] — Get a single trade with full details
export const GET = withAuthParams<{ tradeId: string }>(async (_req, { userId }, params) => {
  const { tradeId } = await params;

  const trade = await db.trade.findUnique({
    where: { id: tradeId },
    include: {
      legs: {
        include: {
          photoApproval: true,
          shippingAddress: true,
          haveListing: {
            select: {
              askPrice: true,
              condition: true,
              card: { select: { id: true, name: true, setName: true, number: true, tcg: true } },
            },
          },
          gradedHaveListing: {
            select: {
              askPrice: true,
              gradingCompany: true,
              grade: true,
              card: { select: { id: true, name: true, setName: true, number: true, tcg: true } },
            },
          },
          verification: {
            include: {
              authenticator: {
                select: {
                  businessName: true,
                  businessAddress: true,
                  shippingNotes: true,
                  acceptsDropOff: true,
                  acceptsMail: true,
                },
              },
            },
          },
        },
        orderBy: { sequence: "asc" },
      },
      proposal: true,
      escrow: { select: { id: true, status: true, totalAmount: true } },
    },
  });

  if (!trade) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }

  if (!trade.participantIds.includes(userId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  return NextResponse.json({ trade });
});
