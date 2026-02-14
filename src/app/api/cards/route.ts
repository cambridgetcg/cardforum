import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

// GET /api/cards?query=...&tcg=...&page=1&limit=20
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.get("query") ?? "";
  const tcg = searchParams.get("tcg");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const skip = (page - 1) * limit;

  const where = {
    ...(query && {
      OR: [
        { name: { contains: query, mode: "insensitive" as const } },
        { setName: { contains: query, mode: "insensitive" as const } },
        { setCode: { contains: query, mode: "insensitive" as const } },
      ],
    }),
    ...(tcg && { tcg: tcg as "POKEMON" | "ONEPIECE" | "YUGIOH" | "MTG" }),
  };

  const [cards, total] = await Promise.all([
    db.card.findMany({
      where,
      orderBy: [{ tcg: "asc" }, { name: "asc" }],
      skip,
      take: limit,
    }),
    db.card.count({ where }),
  ]);

  return NextResponse.json({
    cards,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
