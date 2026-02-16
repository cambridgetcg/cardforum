import { NextResponse, type NextRequest } from "next/server";
import { refreshRates } from "@/server/services/exchange-rate.service";

/**
 * GET /api/cron/refresh-rates
 *
 * Refreshes the exchange rate cache from external sources.
 * Designed to run every hour via Vercel Cron.
 *
 * Vercel Cron config: see vercel.json
 *   { "path": "/api/cron/refresh-rates", "schedule": "0 * * * *" }
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rates = await refreshRates();
    const currencyCount = Object.keys(rates.rates).length;

    return NextResponse.json({
      success: true,
      source: rates.source,
      currencyCount,
      fetchedAt: rates.fetchedAt.toISOString(),
    });
  } catch (error) {
    console.error("[cron/refresh-rates] Failed:", error);
    return NextResponse.json(
      { error: "Failed to refresh rates", message: (error as Error).message },
      { status: 500 },
    );
  }
}
