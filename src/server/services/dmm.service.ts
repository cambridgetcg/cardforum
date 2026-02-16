/**
 * Designated Market Maker (DMM) Service
 *
 * Formalizes authenticators with inventory as liquidity providers.
 * DMM authenticators commit to maintaining two-sided quotes (have + want)
 * for cards they hold in custody, guaranteeing fill rates even with
 * thin order books.
 *
 * DMM listings are real HaveListing/WantListing rows with isDMM: true,
 * so all existing matching infrastructure works unchanged.
 */

import { db } from "@/lib/db";
import { getConfig } from "./config.service";
import { eventBus } from "@/server/events/event-bus";

// ─── Price Derivation ────────────────────────────────────

/**
 * Derive market mid-price for a card+condition.
 * Returns null if no market data exists (we don't invent prices).
 */
async function getMarketMidPrice(cardId: string, condition: string): Promise<number | null> {
  const [askAgg, bidAgg] = await Promise.all([
    db.haveListing.aggregate({
      where: { cardId, condition: condition as never, isActive: true, isDMM: false },
      _min: { askPrice: true },
      _avg: { askPrice: true },
    }),
    db.wantListing.aggregate({
      where: { cardId, isActive: true, isDMM: false },
      _max: { bidPrice: true },
      _avg: { bidPrice: true },
    }),
  ]);

  const bestAsk = askAgg._min.askPrice;
  const bestBid = bidAgg._max.bidPrice;

  if (bestAsk != null && bestBid != null) {
    return Math.round((bestAsk + bestBid) / 2);
  }
  if (bestAsk != null) return bestAsk;
  if (bestBid != null) return bestBid;

  // Fallback: check recent completed trades
  const recentTrade = await db.tradeLeg.findFirst({
    where: {
      haveListing: { cardId, condition: condition as never },
      trade: { status: "COMPLETED" },
    },
    select: { haveListing: { select: { askPrice: true } } },
    orderBy: { trade: { completedAt: "desc" } },
  });

  return recentTrade?.haveListing?.askPrice ?? null;
}

// ─── Core DMM Functions ──────────────────────────────────

/**
 * Sync authenticator inventory to DMM quotes.
 * For each available inventory item, ensure matching HaveListing + WantListing
 * rows exist with isDMM: true.
 */
export async function syncInventoryToQuotes(authenticatorId: string): Promise<number> {
  const designation = await db.dMMDesignation.findUnique({
    where: { authenticatorId },
    include: { authenticator: { select: { userId: true, region: true } } },
  });

  if (!designation?.isActive) {
    throw new Error("No active DMM designation for this authenticator");
  }

  const inventory = await db.authenticatorInventory.findMany({
    where: { authenticatorId, isAvailable: true },
  });

  const spreadBps = designation.maxSpreadBps;
  let created = 0;

  for (const item of inventory) {
    const midPrice = await getMarketMidPrice(item.cardId, item.condition);
    if (midPrice == null || midPrice <= 0) continue; // skip cards without market data

    const dmmAsk = Math.round(midPrice * (1 + spreadBps / 20000));
    const dmmBid = Math.round(midPrice * (1 - spreadBps / 20000));

    if (dmmAsk <= 0 || dmmBid <= 0) continue;

    // Check if DMM have listing already exists for this user+card+condition
    const existingHave = await db.haveListing.findFirst({
      where: {
        userId: designation.authenticator.userId,
        cardId: item.cardId,
        condition: item.condition as never,
        isDMM: true,
        isActive: true,
      },
    });

    if (!existingHave) {
      await db.haveListing.create({
        data: {
          userId: designation.authenticator.userId,
          cardId: item.cardId,
          condition: item.condition as never,
          language: item.language,
          askPrice: dmmAsk,
          currency: "USD",
          usdEquivalent: dmmAsk,
          isDMM: true,
          autoAccept: true,
          autoAcceptMaxGap: 999999,
          autoAcceptRegions: [],
          notes: `DMM:${item.id}`,
        },
      });
      created++;
    }

    // Check if DMM want listing already exists for this user+card
    const existingWant = await db.wantListing.findFirst({
      where: {
        userId: designation.authenticator.userId,
        cardId: item.cardId,
        isDMM: true,
        isActive: true,
      },
    });

    if (!existingWant) {
      await db.wantListing.create({
        data: {
          userId: designation.authenticator.userId,
          cardId: item.cardId,
          minCondition: item.condition as never,
          language: item.language,
          bidPrice: dmmBid,
          currency: "USD",
          usdEquivalent: dmmBid,
          isDMM: true,
          autoAccept: true,
          autoAcceptMaxGap: 999999,
          autoAcceptRegions: [],
          notes: `DMM:${item.id}`,
        },
      });
      created++;
    }
  }

  return created;
}

/**
 * Refresh all DMM quotes for an authenticator.
 * Re-prices active DMM listings based on current market data.
 * Deactivates stale quotes beyond the staleness threshold.
 */
export async function refreshDMMQuotes(authenticatorId: string): Promise<number> {
  const designation = await db.dMMDesignation.findUnique({
    where: { authenticatorId },
    include: { authenticator: { select: { userId: true } } },
  });

  if (!designation?.isActive) return 0;

  const stalenessHours = await getConfig("matching.dmm_quote_staleness_hours");
  const staleThreshold = new Date(Date.now() - stalenessHours * 60 * 60 * 1000);
  const spreadBps = designation.maxSpreadBps;

  // Get all active DMM listings for this authenticator's user
  const [haveListings, wantListings] = await Promise.all([
    db.haveListing.findMany({
      where: { userId: designation.authenticator.userId, isDMM: true, isActive: true },
    }),
    db.wantListing.findMany({
      where: { userId: designation.authenticator.userId, isDMM: true, isActive: true },
    }),
  ]);

  let updated = 0;

  // Refresh have listings
  for (const listing of haveListings) {
    // Deactivate stale quotes
    if (listing.updatedAt < staleThreshold) {
      await db.haveListing.update({
        where: { id: listing.id },
        data: { isActive: false },
      });
      continue;
    }

    const midPrice = await getMarketMidPrice(listing.cardId, listing.condition);
    if (midPrice == null || midPrice <= 0) {
      // No market data — deactivate
      await db.haveListing.update({
        where: { id: listing.id },
        data: { isActive: false },
      });
      continue;
    }

    const newAsk = Math.round(midPrice * (1 + spreadBps / 20000));
    if (newAsk !== listing.askPrice && newAsk > 0) {
      await db.haveListing.update({
        where: { id: listing.id },
        data: { askPrice: newAsk, usdEquivalent: newAsk },
      });
      updated++;
    }
  }

  // Refresh want listings
  for (const listing of wantListings) {
    if (listing.updatedAt < staleThreshold) {
      await db.wantListing.update({
        where: { id: listing.id },
        data: { isActive: false },
      });
      continue;
    }

    const midPrice = await getMarketMidPrice(listing.cardId, listing.minCondition);
    if (midPrice == null || midPrice <= 0) {
      await db.wantListing.update({
        where: { id: listing.id },
        data: { isActive: false },
      });
      continue;
    }

    const newBid = Math.round(midPrice * (1 - spreadBps / 20000));
    if (newBid !== listing.bidPrice && newBid > 0) {
      await db.wantListing.update({
        where: { id: listing.id },
        data: { bidPrice: newBid, usdEquivalent: newBid },
      });
      updated++;
    }
  }

  return updated;
}

/**
 * Check DMM obligation: does the authenticator have enough active quotes?
 */
export async function checkObligation(authenticatorId: string): Promise<boolean> {
  const designation = await db.dMMDesignation.findUnique({
    where: { authenticatorId },
    include: { authenticator: { select: { userId: true } } },
  });

  if (!designation?.isActive) return true;

  const activeQuotes = await db.haveListing.count({
    where: {
      userId: designation.authenticator.userId,
      isDMM: true,
      isActive: true,
    },
  });

  const obligationMet = activeQuotes >= designation.minQuoteCards;

  // Update designation status
  await db.dMMDesignation.update({
    where: { authenticatorId },
    data: { obligationMet, lastCheckAt: new Date() },
  });

  if (!obligationMet) {
    eventBus.emitAsync("dmm.obligation_breached", {
      authenticatorId,
      activeQuotes,
      required: designation.minQuoteCards,
    });
  }

  return obligationMet;
}

/**
 * Designate an authenticator as a DMM.
 * Requires authenticator applicationStatus === "ACTIVE".
 */
export async function designateAsDMM(
  authenticatorId: string,
  adminId: string,
  options?: { maxSpreadBps?: number; minQuoteCards?: number },
): Promise<void> {
  const authenticator = await db.authenticator.findUnique({
    where: { id: authenticatorId },
    select: { applicationStatus: true },
  });

  if (!authenticator) {
    throw new Error("Authenticator not found");
  }
  if (authenticator.applicationStatus !== "ACTIVE") {
    throw new Error("Authenticator must be ACTIVE to be designated as DMM");
  }

  // Check if already designated
  const existing = await db.dMMDesignation.findUnique({
    where: { authenticatorId },
  });

  if (existing?.isActive) {
    throw new Error("Authenticator is already designated as DMM");
  }

  if (existing) {
    // Re-activate revoked designation
    await db.dMMDesignation.update({
      where: { authenticatorId },
      data: {
        isActive: true,
        designatedBy: adminId,
        designatedAt: new Date(),
        maxSpreadBps: options?.maxSpreadBps ?? existing.maxSpreadBps,
        minQuoteCards: options?.minQuoteCards ?? existing.minQuoteCards,
        obligationMet: true,
        revokedAt: null,
        revokedBy: null,
        revokeReason: null,
      },
    });
  } else {
    await db.dMMDesignation.create({
      data: {
        authenticatorId,
        designatedBy: adminId,
        maxSpreadBps: options?.maxSpreadBps ?? 500,
        minQuoteCards: options?.minQuoteCards ?? 10,
      },
    });
  }

  // Sync inventory to quotes
  await syncInventoryToQuotes(authenticatorId);

  eventBus.emitAsync("dmm.designated", { authenticatorId, adminId });
}

/**
 * Revoke DMM designation. Deactivates all DMM listings.
 */
export async function revokeDMM(
  authenticatorId: string,
  adminId: string,
  reason: string,
): Promise<void> {
  const designation = await db.dMMDesignation.findUnique({
    where: { authenticatorId },
    include: { authenticator: { select: { userId: true } } },
  });

  if (!designation?.isActive) {
    throw new Error("No active DMM designation to revoke");
  }

  // Deactivate designation
  await db.dMMDesignation.update({
    where: { authenticatorId },
    data: {
      isActive: false,
      revokedAt: new Date(),
      revokedBy: adminId,
      revokeReason: reason,
    },
  });

  // Deactivate all DMM listings
  await Promise.all([
    db.haveListing.updateMany({
      where: { userId: designation.authenticator.userId, isDMM: true, isActive: true },
      data: { isActive: false },
    }),
    db.wantListing.updateMany({
      where: { userId: designation.authenticator.userId, isDMM: true, isActive: true },
      data: { isActive: false },
    }),
  ]);

  eventBus.emitAsync("dmm.revoked", { authenticatorId, reason });
}

/**
 * Refresh all DMM quotes across all active designations.
 * Called before each matching run.
 */
export async function refreshAllDMMQuotes(): Promise<void> {
  const designations = await db.dMMDesignation.findMany({
    where: { isActive: true },
  });

  for (const d of designations) {
    try {
      const updated = await refreshDMMQuotes(d.authenticatorId);
      if (updated > 0) {
        eventBus.emitAsync("dmm.quotes_refreshed", {
          authenticatorId: d.authenticatorId,
          updated,
        });
      }
    } catch (err) {
      console.error(`[DMM] Failed to refresh quotes for ${d.authenticatorId}:`, err);
    }
  }
}
