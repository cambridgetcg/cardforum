import { NextResponse } from "next/server";

// GET /api/matches — View match proposals for current user
export async function GET() {
  // TODO: Implement with matching engine
  return NextResponse.json({ proposals: [] });
}

// POST /api/matches — Trigger matching for current user's listings
export async function POST() {
  // TODO: Implement with matching engine
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
