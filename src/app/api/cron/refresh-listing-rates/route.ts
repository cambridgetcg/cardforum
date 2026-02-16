import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { convertToUsdCents } from "@/server/services/exchange-rate.service";
import { RATE_STALE_THRESHOLD_MS } from "@/lib/currency";

/**
 * Cron: Refresh stale USD equivalents for active non-USD listings.
 * Prevents stale exchange rate arbitrage in the matching engine.
 * Only updates listings whose rateTimestamp is older than the stale threshold (6 hours).
 */
export async function POST() {
  const staleThreshold = new Date(Date.now() - RATE_STALE_THRESHOLD_MS);

  // Find all active non-USD listings with stale rates
  const [
    staleHaves,
    staleWants,
    staleGradedHaves,
    staleGradedWants,
    staleSealedHaves,
    staleSealedWants,
  ] = await Promise.all([
    db.haveListing.findMany({
      where: {
        isActive: true,
        currency: { not: "USD" },
        OR: [{ rateTimestamp: { lt: staleThreshold } }, { rateTimestamp: null }],
      },
      select: { id: true, askPrice: true, currency: true },
    }),
    db.wantListing.findMany({
      where: {
        isActive: true,
        currency: { not: "USD" },
        OR: [{ rateTimestamp: { lt: staleThreshold } }, { rateTimestamp: null }],
      },
      select: { id: true, bidPrice: true, currency: true },
    }),
    db.gradedHaveListing.findMany({
      where: {
        isActive: true,
        currency: { not: "USD" },
        OR: [{ rateTimestamp: { lt: staleThreshold } }, { rateTimestamp: null }],
      },
      select: { id: true, askPrice: true, currency: true },
    }),
    db.gradedWantListing.findMany({
      where: {
        isActive: true,
        currency: { not: "USD" },
        OR: [{ rateTimestamp: { lt: staleThreshold } }, { rateTimestamp: null }],
      },
      select: { id: true, bidPrice: true, currency: true },
    }),
    db.sealedHaveListing.findMany({
      where: {
        isActive: true,
        currency: { not: "USD" },
        OR: [{ rateTimestamp: { lt: staleThreshold } }, { rateTimestamp: null }],
      },
      select: { id: true, askPrice: true, currency: true },
    }),
    db.sealedWantListing.findMany({
      where: {
        isActive: true,
        currency: { not: "USD" },
        OR: [{ rateTimestamp: { lt: staleThreshold } }, { rateTimestamp: null }],
      },
      select: { id: true, bidPrice: true, currency: true },
    }),
  ]);

  let updated = 0;

  // Batch update helper — converts and updates in small batches
  async function refreshAskListings(
    listings: { id: string; askPrice: number; currency: string }[],
    model: "haveListing" | "gradedHaveListing" | "sealedHaveListing",
  ) {
    for (const listing of listings) {
      const { usdCents, rate, rateTimestamp } = await convertToUsdCents(
        listing.askPrice,
        listing.currency,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db[model] as any).update({
        where: { id: listing.id },
        data: { usdEquivalent: usdCents, exchangeRate: rate, rateTimestamp },
      });
      updated++;
    }
  }

  async function refreshBidListings(
    listings: { id: string; bidPrice: number; currency: string }[],
    model: "wantListing" | "gradedWantListing" | "sealedWantListing",
  ) {
    for (const listing of listings) {
      const { usdCents, rate, rateTimestamp } = await convertToUsdCents(
        listing.bidPrice,
        listing.currency,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db[model] as any).update({
        where: { id: listing.id },
        data: { usdEquivalent: usdCents, exchangeRate: rate, rateTimestamp },
      });
      updated++;
    }
  }

  await Promise.all([
    refreshAskListings(staleHaves, "haveListing"),
    refreshBidListings(staleWants, "wantListing"),
    refreshAskListings(staleGradedHaves, "gradedHaveListing"),
    refreshBidListings(staleGradedWants, "gradedWantListing"),
    refreshAskListings(staleSealedHaves, "sealedHaveListing"),
    refreshBidListings(staleSealedWants, "sealedWantListing"),
  ]);

  const staleCount =
    staleHaves.length +
    staleWants.length +
    staleGradedHaves.length +
    staleGradedWants.length +
    staleSealedHaves.length +
    staleSealedWants.length;

  console.log(`[refresh-listing-rates] Refreshed ${updated}/${staleCount} stale listing rates`);

  return NextResponse.json({ found: staleCount, updated });
}
