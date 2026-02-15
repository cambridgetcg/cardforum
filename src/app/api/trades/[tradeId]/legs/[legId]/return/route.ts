import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { recordShipmentSchema } from "@/lib/validators";
import { recordReturnShipment } from "@/server/services/shipping.service";

// PATCH /api/trades/[tradeId]/legs/[legId]/return — Record return shipment (authenticator)
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
  const parsed = recordShipmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const leg = await recordReturnShipment(legId, session.user.id, parsed.data.trackingNumber);
    return NextResponse.json(leg);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record return shipment";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
