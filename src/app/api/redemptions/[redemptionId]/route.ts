import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  getRedemption,
  reserveStock,
  prepareShipment,
  markShipped,
  confirmDelivery,
  completeRedemption,
  cancelRedemption,
  failRedemption,
} from "@/server/services/redemption.service";

type Params = { params: Promise<{ redemptionId: string }> };

// GET /api/redemptions/[redemptionId]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { redemptionId } = await params;
  const redemption = await getRedemption(redemptionId);
  if (!redemption) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(redemption);
}

// POST /api/redemptions/[redemptionId] — State transition actions
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { redemptionId } = await params;
  const body = await req.json();
  const action = body.action as string;

  try {
    switch (action) {
      case "reserve": {
        const result = await reserveStock(redemptionId);
        return NextResponse.json(result);
      }
      case "prepare": {
        const result = await prepareShipment(redemptionId, session.user.id);
        return NextResponse.json(result);
      }
      case "ship": {
        const trackingNumber = body.trackingNumber as string;
        if (!trackingNumber) {
          return NextResponse.json(
            { error: "Tracking number is required" },
            { status: 400 },
          );
        }
        const result = await markShipped(redemptionId, trackingNumber);
        return NextResponse.json(result);
      }
      case "confirm": {
        const result = await confirmDelivery(redemptionId, session.user.id);
        return NextResponse.json(result);
      }
      case "complete": {
        const result = await completeRedemption(redemptionId);
        return NextResponse.json(result);
      }
      case "cancel": {
        const result = await cancelRedemption(redemptionId, session.user.id);
        return NextResponse.json(result);
      }
      case "fail": {
        const reason = body.reason as string;
        if (!reason) {
          return NextResponse.json(
            { error: "Failure reason is required" },
            { status: 400 },
          );
        }
        const result = await failRedemption(redemptionId, reason);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json(
          { error: "Invalid action. Use: reserve, prepare, ship, confirm, complete, cancel, fail" },
          { status: 400 },
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
