import { NextResponse, type NextRequest } from "next/server";
import { ccsInputSchema } from "@/lib/validators";
import { calculateCCS } from "@/lib/ccs";

// POST /api/ccs/calculate
// Calculate CCS composite from dimension scores.
// Body: { surface, corners, edges, centering }
// Returns: full CCS result with composite, tier, subTier
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = ccsInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const ccs = calculateCCS(parsed.data);
  return NextResponse.json(ccs);
}
