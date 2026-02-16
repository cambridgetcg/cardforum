import { db } from "@/lib/db";
import type { CreateSealedHaveListingInput, CreateSealedWantListingInput } from "@/lib/validators";
import { convertToUsdCents } from "./exchange-rate.service";
import { eventBus } from "@/server/events/event-bus";
import { checkSealedAskCrossing, checkSealedBidCrossing } from "./price-validation.service";

export async function getUserSealedListings(userId: string) {
  const [have, want] = await Promise.all([
    db.sealedHaveListing.findMany({
      where: { userId },
      include: { sealedProduct: true },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    }),
    db.sealedWantListing.findMany({
      where: { userId },
      include: { sealedProduct: true },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    }),
  ]);
  return { have, want };
}

export async function createSealedHaveListing(userId: string, input: CreateSealedHaveListingInput) {
  const currency = input.currency ?? "USD";
  const { usdCents, rate, rateTimestamp } = await convertToUsdCents(input.askPrice, currency);

  const crossing = await checkSealedAskCrossing(userId, input.sealedProductId, usdCents);
  if (crossing.selfCross) {
    throw new Error(
      "Your ask price crosses your own active sealed bid. Deactivate or raise your ask first.",
    );
  }

  const listing = await db.sealedHaveListing.create({
    data: {
      userId,
      ...input,
      currency,
      usdEquivalent: usdCents,
      exchangeRate: rate,
      rateTimestamp,
    },
    include: { sealedProduct: true },
  });

  eventBus.emitAsync("listing.created", {
    listingId: listing.id,
    type: "have",
    userId,
    cardId: input.sealedProductId,
  });

  return { ...listing, crossing: { marketCross: crossing.marketCross, bestBid: crossing.bestBid } };
}

export async function createSealedWantListing(userId: string, input: CreateSealedWantListingInput) {
  const currency = input.currency ?? "USD";
  const { usdCents, rate, rateTimestamp } = await convertToUsdCents(input.bidPrice, currency);

  const crossing = await checkSealedBidCrossing(userId, input.sealedProductId, usdCents);
  if (crossing.selfCross) {
    throw new Error(
      "Your bid price crosses your own active sealed ask. Deactivate or lower your bid first.",
    );
  }

  const listing = await db.sealedWantListing.create({
    data: {
      userId,
      ...input,
      currency,
      usdEquivalent: usdCents,
      exchangeRate: rate,
      rateTimestamp,
    },
    include: { sealedProduct: true },
  });

  eventBus.emitAsync("listing.created", {
    listingId: listing.id,
    type: "want",
    userId,
    cardId: input.sealedProductId,
  });

  return { ...listing, crossing: { marketCross: crossing.marketCross, bestAsk: crossing.bestAsk } };
}

export async function deactivateSealedListing(
  userId: string,
  listingId: string,
  type: "have" | "want",
) {
  if (type === "have") {
    await db.sealedHaveListing.update({
      where: { id: listingId, userId },
      data: { isActive: false },
    });
  } else {
    await db.sealedWantListing.update({
      where: { id: listingId, userId },
      data: { isActive: false },
    });
  }

  eventBus.emitAsync("listing.deactivated", {
    listingId,
    type,
    reason: "User deactivated",
  });
}
