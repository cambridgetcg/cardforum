import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createGradedHaveListingSchema, createGradedWantListingSchema } from "@/lib/validators";
import {
  getUserGradedListings,
  createGradedHaveListing,
  createGradedWantListing,
  deactivateGradedListing,
} from "@/server/services/graded-listing.service";

// GET /api/graded-listings — List current user's graded have/want listings
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const listings = await getUserGradedListings(session.user.id);
  return NextResponse.json(listings);
}

// POST /api/graded-listings — Create a new graded have or want listing
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const type = body.type as "have" | "want";

  if (type === "have") {
    const parsed = createGradedHaveListingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const listing = await createGradedHaveListing(session.user.id, parsed.data);
    return NextResponse.json(listing, { status: 201 });
  }

  if (type === "want") {
    const parsed = createGradedWantListingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const listing = await createGradedWantListing(session.user.id, parsed.data);
    return NextResponse.json(listing, { status: 201 });
  }

  return NextResponse.json({ error: "type must be 'have' or 'want'" }, { status: 400 });
}

// DELETE /api/graded-listings?id=...&type=have|want — Deactivate a graded listing
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const id = searchParams.get("id");
  const type = searchParams.get("type") as "have" | "want" | null;

  if (!id || !type || !["have", "want"].includes(type)) {
    return NextResponse.json({ error: "id and type required" }, { status: 400 });
  }

  await deactivateGradedListing(session.user.id, id, type);
  return NextResponse.json({ success: true });
}
