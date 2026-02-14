import { NextResponse } from "next/server";

// GET /api/cards?query=...&tcg=...&page=1&limit=20 — Search card catalog
export async function GET() {
  // TODO: Implement card catalog search
  return NextResponse.json({ cards: [], total: 0 });
}
