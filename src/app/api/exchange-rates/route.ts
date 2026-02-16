import { NextResponse } from "next/server";
import { getRates, areRatesStale } from "@/server/services/exchange-rate.service";

/**
 * GET /api/exchange-rates
 *
 * Returns current exchange rates for client-side display.
 * Rates are relative to USD: { EUR: 0.921, JPY: 148.5, ... }
 * meaning 1 USD = N units of target currency.
 *
 * Public endpoint — no auth required (read-only market data).
 */
export async function GET() {
  try {
    const rates = await getRates();
    const stale = await areRatesStale();

    return NextResponse.json({
      baseCurrency: rates.baseCurrency,
      rates: rates.rates,
      fetchedAt: rates.fetchedAt.toISOString(),
      source: rates.source,
      stale,
    });
  } catch (error) {
    console.error("[exchange-rates] Failed to get rates:", error);
    return NextResponse.json({ error: "Failed to fetch exchange rates" }, { status: 500 });
  }
}
