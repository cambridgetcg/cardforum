import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  delistToken,
  buyToken,
} from "@/server/services/digital-trade.service";

type Params = { params: Promise<{ listingId: string }> };

// POST /api/digital-marketplace/[listingId] — Buy a listing
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listingId } = await params;

  try {
    const trade = await buyToken(listingId, session.user.id);
    return NextResponse.json(trade, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Purchase failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE /api/digital-marketplace/[listingId] — Delist a token
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listingId } = await params;

  try {
    await delistToken(listingId, session.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delist failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
