import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { updateListingSchema } from "@/lib/validators";
import { updateListing } from "@/server/services/listing.service";

// PATCH /api/listings/[id] — Update a listing (price, condition, quantity, notes, isActive)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const listing = await updateListing(session.user.id, id, parsed.data);
    return NextResponse.json(listing);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    const status = message.includes("not found") || message.includes("not own") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
