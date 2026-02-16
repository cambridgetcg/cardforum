import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncInventoryToQuotes, refreshDMMQuotes } from "@/server/services/dmm.service";
import { z } from "zod";

const actionSchema = z.object({
  action: z.enum(["sync", "refresh"]),
});

const adjustSchema = z.object({
  cardId: z.string().min(1),
  askPrice: z.number().int().min(1).optional(),
  bidPrice: z.number().int().min(1).optional(),
});

/**
 * GET /api/dmm/quotes — List caller's DMM quotes
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify caller is a designated DMM
  const authenticator = await db.authenticator.findUnique({
    where: { userId: session.user.id },
    select: { id: true, dmmDesignation: true },
  });

  if (!authenticator?.dmmDesignation?.isActive) {
    return NextResponse.json({ error: "Not a designated DMM" }, { status: 403 });
  }

  const [haveQuotes, wantQuotes] = await Promise.all([
    db.haveListing.findMany({
      where: { userId: session.user.id, isDMM: true },
      include: {
        card: { select: { id: true, name: true, setName: true, number: true, imageUrl: true } },
      },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    }),
    db.wantListing.findMany({
      where: { userId: session.user.id, isDMM: true },
      include: {
        card: { select: { id: true, name: true, setName: true, number: true, imageUrl: true } },
      },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  return NextResponse.json({
    designation: authenticator.dmmDesignation,
    haveQuotes,
    wantQuotes,
  });
}

/**
 * POST /api/dmm/quotes — Trigger quote sync or refresh
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authenticator = await db.authenticator.findUnique({
    where: { userId: session.user.id },
    select: { id: true, dmmDesignation: true },
  });

  if (!authenticator?.dmmDesignation?.isActive) {
    return NextResponse.json({ error: "Not a designated DMM" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    if (parsed.data.action === "sync") {
      const created = await syncInventoryToQuotes(authenticator.id);
      return NextResponse.json({ success: true, created });
    } else {
      const updated = await refreshDMMQuotes(authenticator.id);
      return NextResponse.json({ success: true, updated });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Operation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * PATCH /api/dmm/quotes — Manually adjust spread for a card
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authenticator = await db.authenticator.findUnique({
    where: { userId: session.user.id },
    select: { id: true, dmmDesignation: true },
  });

  if (!authenticator?.dmmDesignation?.isActive) {
    return NextResponse.json({ error: "Not a designated DMM" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = adjustSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Promise<unknown>[] = [];

  if (parsed.data.askPrice != null) {
    updates.push(
      db.haveListing.updateMany({
        where: {
          userId: session.user.id,
          cardId: parsed.data.cardId,
          isDMM: true,
          isActive: true,
        },
        data: { askPrice: parsed.data.askPrice, usdEquivalent: parsed.data.askPrice },
      }),
    );
  }

  if (parsed.data.bidPrice != null) {
    updates.push(
      db.wantListing.updateMany({
        where: {
          userId: session.user.id,
          cardId: parsed.data.cardId,
          isDMM: true,
          isActive: true,
        },
        data: { bidPrice: parsed.data.bidPrice, usdEquivalent: parsed.data.bidPrice },
      }),
    );
  }

  await Promise.all(updates);

  return NextResponse.json({ success: true });
}
