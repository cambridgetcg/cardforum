import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

// GET /api/cards/[cardId] — single card with variants and active listings
export async function GET(_req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;

  const card = await db.card.findUnique({
    where: { id: cardId },
    include: {
      set: true,
      variants: {
        orderBy: [{ language: "asc" }, { treatment: "asc" }, { version: "asc" }],
      },
      haveListings: {
        where: { isActive: true },
        select: {
          id: true,
          askPrice: true,
          currency: true,
          usdEquivalent: true,
          condition: true,
          language: true,
          quantity: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: { askPrice: "asc" },
        take: 20,
      },
      wantListings: {
        where: { isActive: true },
        select: {
          id: true,
          bidPrice: true,
          currency: true,
          usdEquivalent: true,
          minCondition: true,
          language: true,
          maxQuantity: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: { bidPrice: "desc" },
        take: 20,
      },
      _count: { select: { variants: true, haveListings: true, wantListings: true } },
    },
  });

  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  return NextResponse.json({ card });
}
