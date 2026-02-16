import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/server/middleware/with-auth";
import { addToCollection, getCollection } from "@/server/services/collection.service";
import { db } from "@/lib/db";
import { z } from "zod";

const addSchema = z.object({
  cardId: z.string().min(1),
  quantity: z.number().int().min(1).max(999).optional(),
  condition: z.enum(["NM", "LP", "MP", "HP", "DMG"]).optional(),
  pricePaid: z.number().int().min(0).max(10_000_000).optional(),
  notes: z.string().max(500).optional(),
});

// GET /api/collection — List user's collection
export const GET = withAuth(async (req, { userId }) => {
  const url = new URL(req.url);
  const tcg = url.searchParams.get("tcg") ?? undefined;
  const setCode = url.searchParams.get("set") ?? undefined;
  const rarity = url.searchParams.get("rarity") ?? undefined;

  try {
    const entries = await getCollection(userId, { tcg, setCode, rarity });
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ error: "Failed to load collection" }, { status: 500 });
  }
});

// POST /api/collection — Add card to collection
export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Validate card exists
  const card = await db.card.findUnique({
    where: { id: parsed.data.cardId },
    select: { id: true },
  });
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  try {
    const entry = await addToCollection({
      userId,
      ...parsed.data,
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to add to collection" }, { status: 500 });
  }
});
