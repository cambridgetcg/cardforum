import { db } from "@/lib/db";
import { getConfigs } from "@/server/services/config.service";
import { transferToken } from "./digital-token.service";
import type { DigitalTokenListing, DigitalTrade, Condition } from "@/generated/prisma/client";

// ─── Types ──────────────────────────────────────────────

interface DigitalListingFilters {
  cardId?: string;
  condition?: Condition;
  tcg?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
  offset?: number;
}

interface DigitalMarketData {
  cardId: string;
  condition: Condition;
  lowestAsk: number | null;
  totalListings: number;
  recentTrades: { priceCents: number; completedAt: Date }[];
}

// ─── Listing Management ─────────────────────────────────

export async function createListing(
  tokenId: string,
  userId: string,
  askPrice: number,
): Promise<DigitalTokenListing> {
  return db.$transaction(async (tx) => {
    const token = await tx.digitalToken.findUniqueOrThrow({
      where: { id: tokenId },
    });

    if (token.currentOwnerId !== userId) {
      throw new Error("You do not own this token");
    }
    if (token.status !== "ACTIVE") {
      throw new Error(`Token cannot be listed (status: ${token.status})`);
    }

    // Set token status to LISTED
    await tx.digitalToken.update({
      where: { id: tokenId },
      data: { status: "LISTED" },
    });

    // Deactivate any existing active listing for this token
    await tx.digitalTokenListing.updateMany({
      where: { tokenId, isActive: true },
      data: { isActive: false },
    });

    return tx.digitalTokenListing.create({
      data: {
        tokenId,
        sellerId: userId,
        askPrice,
      },
    });
  });
}

export async function delistToken(listingId: string, userId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const listing = await tx.digitalTokenListing.findUniqueOrThrow({
      where: { id: listingId },
      include: { token: true },
    });

    if (listing.sellerId !== userId) {
      throw new Error("You do not own this listing");
    }
    if (!listing.isActive) {
      throw new Error("Listing is already inactive");
    }

    await tx.digitalTokenListing.update({
      where: { id: listingId },
      data: { isActive: false },
    });

    await tx.digitalToken.update({
      where: { id: listing.tokenId },
      data: { status: "ACTIVE" },
    });
  });
}

// ─── Buy Flow ───────────────────────────────────────────

export async function buyToken(listingId: string, buyerId: string): Promise<DigitalTrade> {
  return db
    .$transaction(
      async (tx) => {
        const listing = await tx.digitalTokenListing.findUniqueOrThrow({
          where: { id: listingId },
          include: { token: true },
        });

        if (!listing.isActive) {
          throw new Error("Listing is no longer active");
        }
        if (listing.sellerId === buyerId) {
          throw new Error("Cannot buy your own listing");
        }

        const token = listing.token;
        if (token.status !== "LISTED") {
          throw new Error(`Token is not available (status: ${token.status})`);
        }

        // Calculate fees
        const {
          "fees.digital_platform_rate": digitalPlatformRate,
          "fees.digitiser_royalty_rate": digitiserRoyaltyRate,
        } = await getConfigs(["fees.digital_platform_rate", "fees.digitiser_royalty_rate"]);
        const priceCents = listing.askPrice;
        const platformFeeCents = Math.floor(priceCents * digitalPlatformRate);
        const royaltyCents =
          token.digitiserId === listing.sellerId
            ? 0
            : Math.floor(priceCents * digitiserRoyaltyRate);
        const sellerNetCents = priceCents - platformFeeCents - royaltyCents;

        // Lock the token
        await tx.digitalToken.update({
          where: { id: token.id },
          data: { status: "TRADE_LOCKED" },
        });

        // Deactivate listing
        await tx.digitalTokenListing.update({
          where: { id: listingId },
          data: { isActive: false },
        });

        // Create the trade record
        const trade = await tx.digitalTrade.create({
          data: {
            listingId,
            buyerId,
            sellerId: listing.sellerId,
            tokenId: token.id,
            priceCents,
            platformFeeCents,
            royaltyCents,
            sellerNetCents,
            completedAt: new Date(),
          },
        });

        return trade;
      },
      { timeout: 10000 },
    )
    .then(async (trade) => {
      // Execute the transfer outside the trade-creation transaction
      // to avoid long-running transactions with multiple wallet updates
      await transferToken(trade.tokenId, trade.sellerId, trade.buyerId, trade.priceCents);
      return trade;
    });
}

// ─── Queries ────────────────────────────────────────────

export async function getActiveListings(
  filters: DigitalListingFilters,
): Promise<DigitalTokenListing[]> {
  const where: Record<string, unknown> = { isActive: true };

  if (filters.cardId || filters.condition || filters.tcg) {
    const tokenWhere: Record<string, unknown> = { status: "LISTED" };
    if (filters.cardId) tokenWhere.cardId = filters.cardId;
    if (filters.condition) tokenWhere.condition = filters.condition;
    if (filters.tcg) tokenWhere.card = { tcg: filters.tcg };
    where.token = tokenWhere;
  }

  if (filters.minPrice || filters.maxPrice) {
    const priceFilter: Record<string, number> = {};
    if (filters.minPrice) priceFilter.gte = filters.minPrice;
    if (filters.maxPrice) priceFilter.lte = filters.maxPrice;
    where.askPrice = priceFilter;
  }

  return db.digitalTokenListing.findMany({
    where,
    orderBy: { askPrice: "asc" },
    take: filters.limit ?? 50,
    skip: filters.offset ?? 0,
    include: {
      token: {
        include: {
          card: true,
          digitiser: { select: { id: true, name: true } },
        },
      },
      seller: { select: { id: true, name: true } },
    },
  });
}

export async function getMarketData(
  cardId: string,
  condition: Condition,
): Promise<DigitalMarketData> {
  const [listings, recentTrades] = await Promise.all([
    db.digitalTokenListing.findMany({
      where: {
        isActive: true,
        token: { cardId, condition, status: "LISTED" },
      },
      orderBy: { askPrice: "asc" },
      select: { askPrice: true },
    }),
    db.digitalTrade.findMany({
      where: {
        listing: { token: { cardId, condition } },
        completedAt: { not: null },
      },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: { priceCents: true, completedAt: true },
    }),
  ]);

  return {
    cardId,
    condition,
    lowestAsk: listings.length > 0 ? listings[0].askPrice : null,
    totalListings: listings.length,
    recentTrades: recentTrades.map((t) => ({
      priceCents: t.priceCents,
      completedAt: t.completedAt!,
    })),
  };
}
