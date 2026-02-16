import { db } from "@/lib/db";
import type { CreateHaveListingInput, CreateWantListingInput, UpdateListingInput } from "@/lib/validators";
import { assertCanCreateListing } from "./kyc.service";
import { convertToUsdCents } from "./exchange-rate.service";
import { eventBus } from "@/server/events/event-bus";

export async function getUserListings(userId: string) {
  const [have, want] = await Promise.all([
    db.haveListing.findMany({
      where: { userId },
      include: { card: true },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    }),
    db.wantListing.findMany({
      where: { userId },
      include: { card: true },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    }),
  ]);
  return { have, want };
}

export async function createHaveListing(userId: string, input: CreateHaveListingInput) {
  const currency = input.currency ?? "USD";
  const { usdCents, rate, rateTimestamp } = await convertToUsdCents(input.askPrice, currency);

  // KYC gate uses USD equivalent for cap checks
  await assertCanCreateListing(userId, usdCents);

  const listing = await db.haveListing.create({
    data: {
      userId,
      ...input,
      currency,
      usdEquivalent: usdCents,
      exchangeRate: rate,
      rateTimestamp,
    },
    include: { card: true },
  });

  eventBus.emitAsync("listing.created", {
    listingId: listing.id,
    type: "have",
    userId,
    cardId: input.cardId,
  });

  return listing;
}

export async function createWantListing(userId: string, input: CreateWantListingInput) {
  const currency = input.currency ?? "USD";
  const { usdCents, rate, rateTimestamp } = await convertToUsdCents(input.bidPrice, currency);

  // KYC gate uses USD equivalent for cap checks
  await assertCanCreateListing(userId, usdCents);

  const listing = await db.wantListing.create({
    data: {
      userId,
      ...input,
      currency,
      usdEquivalent: usdCents,
      exchangeRate: rate,
      rateTimestamp,
    },
    include: { card: true },
  });

  eventBus.emitAsync("listing.created", {
    listingId: listing.id,
    type: "want",
    userId,
    cardId: input.cardId,
  });

  return listing;
}

export async function updateListing(userId: string, listingId: string, input: UpdateListingInput) {
  const { type, ...fields } = input;

  if (type === "have") {
    // Verify ownership
    const existing = await db.haveListing.findUnique({ where: { id: listingId } });
    if (!existing || existing.userId !== userId) {
      throw new Error("Listing not found or you do not own it");
    }

    // If price or currency changed, recompute USD equivalent
    const data: Record<string, unknown> = {};
    if (fields.condition !== undefined) data.condition = fields.condition;
    if (fields.quantity !== undefined) data.quantity = fields.quantity;
    if (fields.notes !== undefined) data.notes = fields.notes;
    if (fields.isActive !== undefined) data.isActive = fields.isActive;

    if (fields.askPrice !== undefined || fields.currency !== undefined) {
      const newPrice = fields.askPrice ?? existing.askPrice;
      const newCurrency = fields.currency ?? existing.currency ?? "USD";
      const { usdCents, rate, rateTimestamp } = await convertToUsdCents(newPrice, newCurrency);
      data.askPrice = newPrice;
      data.currency = newCurrency;
      data.usdEquivalent = usdCents;
      data.exchangeRate = rate;
      data.rateTimestamp = rateTimestamp;
    }

    return db.haveListing.update({
      where: { id: listingId, userId },
      data,
      include: { card: true },
    });
  }

  // Want listing
  const existing = await db.wantListing.findUnique({ where: { id: listingId } });
  if (!existing || existing.userId !== userId) {
    throw new Error("Listing not found or you do not own it");
  }

  const data: Record<string, unknown> = {};
  if (fields.minCondition !== undefined) data.minCondition = fields.minCondition;
  if (fields.maxQuantity !== undefined) data.maxQuantity = fields.maxQuantity;
  if (fields.notes !== undefined) data.notes = fields.notes;
  if (fields.isActive !== undefined) data.isActive = fields.isActive;

  if (fields.bidPrice !== undefined || fields.currency !== undefined) {
    const newPrice = fields.bidPrice ?? existing.bidPrice;
    const newCurrency = fields.currency ?? existing.currency ?? "USD";
    const { usdCents, rate, rateTimestamp } = await convertToUsdCents(newPrice, newCurrency);
    data.bidPrice = newPrice;
    data.currency = newCurrency;
    data.usdEquivalent = usdCents;
    data.exchangeRate = rate;
    data.rateTimestamp = rateTimestamp;
  }

  return db.wantListing.update({
    where: { id: listingId, userId },
    data,
    include: { card: true },
  });
}

export async function deactivateListing(userId: string, listingId: string, type: "have" | "want") {
  let result;
  if (type === "have") {
    result = await db.haveListing.update({
      where: { id: listingId, userId },
      data: { isActive: false },
    });
  } else {
    result = await db.wantListing.update({
      where: { id: listingId, userId },
      data: { isActive: false },
    });
  }

  eventBus.emitAsync("listing.deactivated", {
    listingId,
    type,
    reason: "User deactivated",
  });

  return result;
}
