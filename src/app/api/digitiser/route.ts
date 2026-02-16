import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getDigitiserStats, getDigitisedTokens } from "@/server/services/digital-token.service";

// GET /api/digitiser — Digitiser dashboard stats or token list
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const view = searchParams.get("view");

  if (view === "tokens") {
    const tokens = await getDigitisedTokens(session.user.id);
    return NextResponse.json(tokens);
  }

  // Default: stats
  const stats = await getDigitiserStats(session.user.id);
  return NextResponse.json(stats);
}
