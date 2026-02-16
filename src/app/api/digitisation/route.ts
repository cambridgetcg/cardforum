import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createDigitisationSchema } from "@/lib/validators";
import {
  createDigitisationRequest,
  getUserDigitisationRequests,
} from "@/server/services/digitisation.service";

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
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createDigitisationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const request = await createDigitisationRequest({
      userId: session.user.id,
      ...parsed.data,
    });
    return NextResponse.json(request, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
