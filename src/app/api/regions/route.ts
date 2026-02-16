import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/regions — Public list of all regions grouped by country
export async function GET() {
  const regions = await db.region.findMany({
    orderBy: [{ country: "asc" }, { name: "asc" }],
  });

  // Group by country
  const grouped: Record<string, Array<{ id: string; name: string }>> = {};
  for (const r of regions) {
    if (!grouped[r.country]) grouped[r.country] = [];
    grouped[r.country].push({ id: r.id, name: r.name });
  }

  return NextResponse.json({ regions, grouped });
}
