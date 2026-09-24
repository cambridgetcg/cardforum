import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  NEW_PAID_COMMERCE_RETIRED_MESSAGE,
  NEW_PAID_COMMERCE_RETIRED_STATUS,
} from "@/lib/commerce-policy";
import { getUserDigitisationRequests } from "@/server/services/digitisation.service";

// GET /api/digitisation — List current user's digitisation requests
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requests = await getUserDigitisationRequests(session.user.id);
  return NextResponse.json(requests);
}

// POST /api/digitisation — Create a new digitisation request
export async function POST() {
  return NextResponse.json(
    { error: NEW_PAID_COMMERCE_RETIRED_MESSAGE, code: "NEW_PAID_COMMERCE_RETIRED" },
    { status: NEW_PAID_COMMERCE_RETIRED_STATUS, headers: { "Cache-Control": "no-store" } },
  );
}
