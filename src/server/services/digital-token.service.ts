import { db } from "@/lib/db";
import { getConfigs } from "@/server/services/config.service";
import type {
  DigitalToken,
  DigitalTokenTransfer,
  Condition,
} from "@/generated/prisma/client";

// ─── Types ──────────────────────────────────────────────

interface VaultStockSummary {
  cardId: string;
  condition: Condition;
  language: string;
  quantity: number;
}

interface VaultStockByRegion {
  authenticatorId: string;
  region: string;
  country: string;
  quantity: number;
  authenticatorName: string | null;
}

interface RedeemableLocation {
  authenticatorId: string;
  region: string;
  country: string;
  quantity: number;
  authenticatorName: string | null;
  isSameZone: boolean;
}

// ─── Queries ────────────────────────────────────────────

export async function getToken(tokenId: string): Promise<DigitalToken | null> {
  return db.digitalToken.findUnique({
    where: { id: tokenId },
    include: {
      card: true,
      digitiser: { select: { id: true, name: true } },
      currentOwner: { select: { id: true, name: true } },
      vaultAuthenticator: { select: { id: true, businessName: true, region: true } },
    },
  });
}

export async function getUserTokens(userId: string): Promise<DigitalToken[]> {
  return db.digitalToken.findMany({
    where: { currentOwnerId: userId, status: { notIn: ["BURNED"] } },
    orderBy: { createdAt: "desc" },
    include: {
      card: true,
      digitiser: { select: { id: true, name: true } },
    },
  });
}

export async function getTokensByCard(
  cardId: string,
  condition: Condition,
): Promise<DigitalToken[]> {
  return db.digitalToken.findMany({
    where: { cardId, condition, status: "ACTIVE" },
    include: { card: true },
  });
}

// ─── Transfer ───────────────────────────────────────────

export async function transferToken(
  tokenId: string,
  fromUserId: string,
  toUserId: string,
  priceCents: number,
): Promise<DigitalTokenTransfer> {
  return db.$transaction(async (tx) => {
    const token = await tx.digitalToken.findUniqueOrThrow({
      where: { id: tokenId },
    });

    if (token.currentOwnerId !== fromUserId) {
      throw new Error("Seller does not own this token");
    }

    // Fee calculations
    const {
      "fees.digital_platform_rate": digitalPlatformRate,
      "fees.digitiser_royalty_rate": digitiserRoyaltyRate,
    } = await getConfigs(["fees.digital_platform_rate", "fees.digitiser_royalty_rate"]);
    const platformFeeCents = Math.floor(priceCents * digitalPlatformRate);
    // Self-trade guard: no royalty if digitiser is the seller
    const royaltyCents = token.digitiserId === fromUserId
      ? 0
      : Math.floor(priceCents * digitiserRoyaltyRate);
    const sellerNetCents = priceCents - platformFeeCents - royaltyCents;

    // Debit buyer
    const buyer = await tx.user.findUniqueOrThrow({
      where: { id: toUserId },
      select: { walletBalance: true },
    });
    const buyerNewBalance = buyer.walletBalance - priceCents;
    if (buyerNewBalance < 0) {
      throw new Error("Buyer has insufficient wallet balance");
    }
    await tx.user.update({
      where: { id: toUserId },
      data: { walletBalance: buyerNewBalance },
    });
    await tx.walletTransaction.create({
      data: {
        userId: toUserId,
        type: "DIGITAL_TRADE_HOLD",
        amount: -priceCents,
        balanceAfter: buyerNewBalance,
        description: `Digital trade purchase for token ${tokenId.slice(-6)}`,
      },
    });

    // Credit seller
    const seller = await tx.user.findUniqueOrThrow({
      where: { id: fromUserId },
      select: { walletBalance: true },
    });
    const sellerNewBalance = seller.walletBalance + sellerNetCents;
    await tx.user.update({
      where: { id: fromUserId },
      data: { walletBalance: sellerNewBalance },
    });
    await tx.walletTransaction.create({
      data: {
        userId: fromUserId,
        type: "DIGITAL_TRADE_RELEASE",
        amount: sellerNetCents,
        balanceAfter: sellerNewBalance,
        description: `Digital trade sale for token ${tokenId.slice(-6)}`,
      },
    });

    // Credit digitiser royalty (if applicable)
    if (royaltyCents > 0) {
      const digitiser = await tx.user.findUniqueOrThrow({
        where: { id: token.digitiserId },
        select: { walletBalance: true },
      });
      const digitiserNewBalance = digitiser.walletBalance + royaltyCents;
      await tx.user.update({
        where: { id: token.digitiserId },
        data: { walletBalance: digitiserNewBalance },
      });
      await tx.walletTransaction.create({
        data: {
          userId: token.digitiserId,
          type: "DIGITISER_ROYALTY",
          amount: royaltyCents,
          balanceAfter: digitiserNewBalance,
          description: `Royalty from digital trade of token ${tokenId.slice(-6)}`,
        },
      });
    }

    // Transfer ownership
    await tx.digitalToken.update({
      where: { id: tokenId },
      data: {
        currentOwnerId: toUserId,
        lastTradedAt: new Date(),
        status: "ACTIVE",
      },
    });

    // Create audit trail
    return tx.digitalTokenTransfer.create({
      data: {
        tokenId,
        fromUserId,
        toUserId,
        priceCents,
        royaltyCents,
        platformFeeCents,
      },
    });
  });
}

// ─── Burn ───────────────────────────────────────────────

export async function burnToken(tokenId: string): Promise<void> {
  await db.digitalToken.update({
    where: { id: tokenId },
    data: { status: "BURNED", redeemedAt: new Date() },
  });
}

// ─── Vault Stock Queries ────────────────────────────────

export async function getVaultStock(
  authenticatorId: string,
): Promise<VaultStockSummary[]> {
  const items = await db.authenticatorInventory.findMany({
    where: { authenticatorId, isAvailable: true, quantity: { gt: 0 } },
    select: { cardId: true, condition: true, language: true, quantity: true },
  });
  return items;
}

export async function getGlobalStock(
  cardId: string,
  condition: Condition,
): Promise<VaultStockByRegion[]> {
  const items = await db.authenticatorInventory.findMany({
    where: { cardId, condition, isAvailable: true, quantity: { gt: 0 } },
    include: {
      authenticator: {
        select: { id: true, businessName: true, region: true, regionRef: { select: { country: true } } },
      },
    },
  });

  return items.map((item) => ({
    authenticatorId: item.authenticator.id,
    region: item.authenticator.region,
    country: item.authenticator.regionRef?.country ?? "",
    quantity: item.quantity,
    authenticatorName: item.authenticator.businessName,
  }));
}

export async function getRedeemableLocations(
  cardId: string,
  condition: Condition,
  redeemerCountry: string,
): Promise<RedeemableLocation[]> {
  const { isSameCustomsZone } = await import("@/lib/constants");

  const stock = await getGlobalStock(cardId, condition);

  return stock
    .map((s) => ({
      ...s,
      isSameZone: isSameCustomsZone(redeemerCountry, s.country),
    }))
    .sort((a, b) => {
      // Same zone first, then by quantity descending
      if (a.isSameZone !== b.isSameZone) return a.isSameZone ? -1 : 1;
      return b.quantity - a.quantity;
    });
}

// ─── Digitiser Dashboard ────────────────────────────────

export async function getDigitiserStats(userId: string) {
  const [tokens, transfers] = await Promise.all([
    db.digitalToken.findMany({
      where: { digitiserId: userId },
      select: { id: true, status: true, cardId: true, condition: true, mintedAt: true },
    }),
    db.digitalTokenTransfer.findMany({
      where: {
        token: { digitiserId: userId },
        royaltyCents: { gt: 0 },
      },
      select: { royaltyCents: true, transferredAt: true, tokenId: true },
    }),
  ]);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const lifetimeRoyalties = transfers.reduce((sum, t) => sum + t.royaltyCents, 0);
  const last30dRoyalties = transfers
    .filter((t) => t.transferredAt >= thirtyDaysAgo)
    .reduce((sum, t) => sum + t.royaltyCents, 0);

  return {
    totalTokensDigitised: tokens.length,
    activeTokens: tokens.filter((t) => t.status !== "BURNED" && t.status !== "REDEEMED").length,
    lifetimeRoyaltyCents: lifetimeRoyalties,
    last30dRoyaltyCents: last30dRoyalties,
    totalTrades: transfers.length,
  };
}

export async function getDigitisedTokens(userId: string) {
  return db.digitalToken.findMany({
    where: { digitiserId: userId },
    orderBy: { mintedAt: "desc" },
    include: {
      card: true,
      currentOwner: { select: { id: true, name: true } },
      transfers: { orderBy: { transferredAt: "desc" }, take: 10 },
    },
  });
}
