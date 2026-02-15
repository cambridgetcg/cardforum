import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getOpenDisputes, createShippingDispute } from "@/server/services/dispute.service";
import { z } from "zod";

const VALID_DISPUTE_REASONS = [
  "NOT_RECEIVED",
  "DAMAGED_IN_TRANSIT",
  "WRONG_CARD",
  "EMPTY_PACKAGE",
  "CONDITION_MISMATCH",
] as const;

const createDisputeSchema = z.object({
  tradeId: z.string().min(1),
  tradeLegId: z.string().min(1),
  reason: z.enum(VALID_DISPUTE_REASONS),
  evidence: z.array(z.string()).default([]),
});

// GET /api/disputes — List open disputes
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const disputes = await getOpenDisputes();
    return NextResponse.json({ disputes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch disputes";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// POST /api/disputes — File a shipping dispute for a specific trade leg
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createDisputeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const dispute = await createShippingDispute(
      parsed.data.tradeId,
      parsed.data.tradeLegId,
      session.user.id,
      parsed.data.reason,
      parsed.data.evidence,
    );
    return NextResponse.json({ dispute }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create dispute";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
