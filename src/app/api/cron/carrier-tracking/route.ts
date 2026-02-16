import { NextResponse, type NextRequest } from "next/server";
import { checkAndAutoConfirmDeliveries } from "@/server/services/carrier-tracking.service";

/**
 * GET /api/cron/carrier-tracking
 *
 * Checks all shipped trade legs for carrier delivery status.
 * Auto-confirms delivery when carrier reports "delivered".
 * Runs every 2 hours via Vercel Cron.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await checkAndAutoConfirmDeliveries();

  return NextResponse.json({
    checked: result.checked,
    confirmed: result.confirmed.length,
    confirmedLegIds: result.confirmed,
  });
}
