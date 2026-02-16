import { db } from "@/lib/db";

/**
 * Price crossing detection for listings.
 *
 * Self-crossing: Prevents a user from creating a bid that crosses their own ask
 * (or vice versa), which would create a self-matching loop.
 *
 * Market crossing: Informational — returns the best opposite-side price so
 * the UI can warn about immediately marketable orders.
 */

// ─── Raw Card Listings ──────────────────────────────────

export async function checkRawAskCrossing(
  userId: string,
  cardId: string,
  askPriceUsd: number,
): Promise<{ selfCross: boolean; marketCross: boolean; bestBid: number | null }> {
  const [userBids, marketBids] = await Promise.all([
    db.wantListing.findFirst({
      where: { userId, cardId, isActive: true, usdEquivalent: { gte: askPriceUsd } },
      select: { usdEquivalent: true },
      orderBy: { usdEquivalent: "desc" },
    }),
    db.wantListing.findFirst({
      where: { cardId, isActive: true, userId: { not: userId } },
      select: { usdEquivalent: true },
      orderBy: { usdEquivalent: "desc" },
    }),
  ]);

  return {
    selfCross: userBids != null,
    marketCross:
      marketBids != null &&
      marketBids.usdEquivalent != null &&
      marketBids.usdEquivalent >= askPriceUsd,
    bestBid: marketBids?.usdEquivalent ?? null,
  };
}

export async function checkRawBidCrossing(
  userId: string,
  cardId: string,
  bidPriceUsd: number,
): Promise<{ selfCross: boolean; marketCross: boolean; bestAsk: number | null }> {
  const [userAsks, marketAsks] = await Promise.all([
    db.haveListing.findFirst({
      where: { userId, cardId, isActive: true, usdEquivalent: { lte: bidPriceUsd } },
      select: { usdEquivalent: true },
      orderBy: { usdEquivalent: "asc" },
    }),
    db.haveListing.findFirst({
      where: { cardId, isActive: true, userId: { not: userId } },
      select: { usdEquivalent: true },
      orderBy: { usdEquivalent: "asc" },
    }),
  ]);

  return {
    selfCross: userAsks != null,
    marketCross:
      marketAsks != null &&
      marketAsks.usdEquivalent != null &&
      marketAsks.usdEquivalent <= bidPriceUsd,
    bestAsk: marketAsks?.usdEquivalent ?? null,
  };
}

// ─── Graded Card Listings ───────────────────────────────

export async function checkGradedAskCrossing(
  userId: string,
  cardId: string,
  askPrice: number,
): Promise<{ selfCross: boolean; marketCross: boolean; bestBid: number | null }> {
  const [userBids, marketBids] = await Promise.all([
    db.gradedWantListing.findFirst({
      where: { userId, cardId, isActive: true, bidPrice: { gte: askPrice } },
      select: { bidPrice: true },
      orderBy: { bidPrice: "desc" },
    }),
    db.gradedWantListing.findFirst({
      where: { cardId, isActive: true, userId: { not: userId } },
      select: { bidPrice: true },
      orderBy: { bidPrice: "desc" },
    }),
  ]);

  return {
    selfCross: userBids != null,
    marketCross: marketBids != null && marketBids.bidPrice >= askPrice,
    bestBid: marketBids?.bidPrice ?? null,
  };
}

export async function checkGradedBidCrossing(
  userId: string,
  cardId: string,
  bidPrice: number,
): Promise<{ selfCross: boolean; marketCross: boolean; bestAsk: number | null }> {
  const [userAsks, marketAsks] = await Promise.all([
    db.gradedHaveListing.findFirst({
      where: { userId, cardId, isActive: true, askPrice: { lte: bidPrice } },
      select: { askPrice: true },
      orderBy: { askPrice: "asc" },
    }),
    db.gradedHaveListing.findFirst({
      where: { cardId, isActive: true, userId: { not: userId } },
      select: { askPrice: true },
      orderBy: { askPrice: "asc" },
    }),
  ]);

  return {
    selfCross: userAsks != null,
    marketCross: marketAsks != null && marketAsks.askPrice <= bidPrice,
    bestAsk: marketAsks?.askPrice ?? null,
  };
}

// ─── Sealed Product Listings ────────────────────────────

export async function checkSealedAskCrossing(
  userId: string,
  sealedProductId: string,
  askPriceUsd: number,
): Promise<{ selfCross: boolean; marketCross: boolean; bestBid: number | null }> {
  const [userBids, marketBids] = await Promise.all([
    db.sealedWantListing.findFirst({
      where: { userId, sealedProductId, isActive: true, usdEquivalent: { gte: askPriceUsd } },
      select: { usdEquivalent: true },
      orderBy: { usdEquivalent: "desc" },
    }),
    db.sealedWantListing.findFirst({
      where: { sealedProductId, isActive: true, userId: { not: userId } },
      select: { usdEquivalent: true },
      orderBy: { usdEquivalent: "desc" },
    }),
  ]);

  return {
    selfCross: userBids != null,
    marketCross:
      marketBids != null &&
      marketBids.usdEquivalent != null &&
      marketBids.usdEquivalent >= askPriceUsd,
    bestBid: marketBids?.usdEquivalent ?? null,
  };
}

export async function checkSealedBidCrossing(
  userId: string,
  sealedProductId: string,
  bidPriceUsd: number,
): Promise<{ selfCross: boolean; marketCross: boolean; bestAsk: number | null }> {
  const [userAsks, marketAsks] = await Promise.all([
    db.sealedHaveListing.findFirst({
      where: { userId, sealedProductId, isActive: true, usdEquivalent: { lte: bidPriceUsd } },
      select: { usdEquivalent: true },
      orderBy: { usdEquivalent: "asc" },
    }),
    db.sealedHaveListing.findFirst({
      where: { sealedProductId, isActive: true, userId: { not: userId } },
      select: { usdEquivalent: true },
      orderBy: { usdEquivalent: "asc" },
    }),
  ]);

  return {
    selfCross: userAsks != null,
    marketCross:
      marketAsks != null &&
      marketAsks.usdEquivalent != null &&
      marketAsks.usdEquivalent <= bidPriceUsd,
    bestAsk: marketAsks?.usdEquivalent ?? null,
  };
}
