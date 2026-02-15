import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { recordInboundSchema } from "@/lib/validators";
import { recordInbound } from "@/server/services/shipping.service";

// PATCH /api/trades/[tradeId]/legs/[legId]/inbound — Record inbound delivery method
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tradeId: string; legId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { legId } = await params;

  const body = await req.json();
  const parsed = recordInboundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const leg = await recordInbound(
      legId,
      session.user.id,
      parsed.data.deliveryMethod,
      parsed.data.trackingNumber,
    );
    return NextResponse.json(leg);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record inbound";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
