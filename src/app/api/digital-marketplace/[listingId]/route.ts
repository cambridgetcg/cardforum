import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { delistToken } from "@/server/services/digital-trade.service";

import {
  NEW_PAID_COMMERCE_RETIRED_MESSAGE,
  NEW_PAID_COMMERCE_RETIRED_STATUS,
} from "@/lib/commerce-policy";

type Params = { params: Promise<{ listingId: string }> };

// POST /api/digital-marketplace/[listingId] — Buy a listing
export async function POST() {
  return NextResponse.json(
    { error: NEW_PAID_COMMERCE_RETIRED_MESSAGE, code: "NEW_PAID_COMMERCE_RETIRED" },
    { status: NEW_PAID_COMMERCE_RETIRED_STATUS, headers: { "Cache-Control": "no-store" } },
  );
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
