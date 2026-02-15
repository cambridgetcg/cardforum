import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { submitRatingSchema } from "@/lib/validators";
import { submitRating } from "@/server/services/authenticator-rating.service";

// POST /api/authenticator/ratings — Submit a rating for an authenticator after trade
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = submitRatingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const rating = await submitRating(session.user.id, parsed.data);
    return NextResponse.json({ rating }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to submit rating";
    const status = message.includes("Not authorized") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
