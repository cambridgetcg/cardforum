import { NextResponse } from "next/server";

// GET /api/trades — List current user's trades
export async function GET() {
  // TODO: Implement with trade.service
  return NextResponse.json({ trades: [] });
}

// POST /api/trades — Accept/reject/cancel a trade
export async function POST() {
  // TODO: Implement with trade.service
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
