import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const STALE_THRESHOLD_DAYS = 30;

/**
 * Cron: Deactivate listings that haven't been refreshed in 30 days.
 * Prevents ghost liquidity from polluting the order book and matching engine.
 * DMM listings are excluded (they have their own staleness logic in dmm.service.ts).
 */
export async function POST() {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - STALE_THRESHOLD_DAYS);

  const [
    haveResult,
    wantResult,
    gradedHaveResult,
    gradedWantResult,
    sealedHaveResult,
    sealedWantResult,
  ] = await Promise.all([
    db.haveListing.updateMany({
      where: { isActive: true, isDMM: false, lastRefreshedAt: { lt: threshold } },
      data: { isActive: false },
    }),
    db.wantListing.updateMany({
      where: { isActive: true, isDMM: false, lastRefreshedAt: { lt: threshold } },
      data: { isActive: false },
    }),
    db.gradedHaveListing.updateMany({
      where: { isActive: true, lastRefreshedAt: { lt: threshold } },
      data: { isActive: false },
    }),
    db.gradedWantListing.updateMany({
      where: { isActive: true, lastRefreshedAt: { lt: threshold } },
      data: { isActive: false },
    }),
    db.sealedHaveListing.updateMany({
      where: { isActive: true, lastRefreshedAt: { lt: threshold } },
      data: { isActive: false },
    }),
    db.sealedWantListing.updateMany({
      where: { isActive: true, lastRefreshedAt: { lt: threshold } },
      data: { isActive: false },
    }),
  ]);

  const total =
    haveResult.count +
    wantResult.count +
    gradedHaveResult.count +
    gradedWantResult.count +
    sealedHaveResult.count +
    sealedWantResult.count;

  console.log(
    `[cleanup-stale-listings] Deactivated ${total} stale listings (threshold: ${STALE_THRESHOLD_DAYS} days)`,
    {
      have: haveResult.count,
      want: wantResult.count,
      gradedHave: gradedHaveResult.count,
      gradedWant: gradedWantResult.count,
      sealedHave: sealedHaveResult.count,
      sealedWant: sealedWantResult.count,
    },
  );

  return NextResponse.json({ deactivated: total });
}
