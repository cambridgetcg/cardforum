import { NextResponse } from "next/server";

// GET /api/listings — List current user's have/want listings
export async function GET() {
  // TODO: Implement with listing.service
  return NextResponse.json({ have: [], want: [] });
}

// POST /api/listings — Create a new have or want listing
export async function POST() {
  // TODO: Implement with listing.service
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
