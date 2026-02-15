import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

// GET /api/card-sets?tcg=ONEPIECE
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tcg = searchParams.get("tcg");

  const where = {
    ...(tcg && { tcg: tcg as "POKEMON" | "ONEPIECE" | "YUGIOH" | "MTG" }),
  };

  const sets = await db.cardSet.findMany({
    where,
    include: {
      _count: { select: { cards: true } },
    },
    orderBy: [{ tcg: "asc" }, { code: "asc" }],
  });

  return NextResponse.json({ sets });
}
