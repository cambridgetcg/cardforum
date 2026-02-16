import { db } from "@/lib/db";
import { isSameCustomsZone } from "@/lib/constants";
import { getConfigs } from "@/server/services/config.service";
import { REDEMPTION_TRANSITIONS } from "@/types/domain";
import type { Redemption, RedemptionStatus } from "@/generated/prisma/client";

// ─── Helpers ────────────────────────────────────────────

function assertTransition(from: RedemptionStatus, to: RedemptionStatus) {
  const allowed = REDEMPTION_TRANSITIONS[from as keyof typeof REDEMPTION_TRANSITIONS] ?? [];
  if (!allowed.includes(to as typeof allowed[number])) {
    throw new Error(`Invalid redemption transition: ${from} → ${to}`);
  }
}

async function getRedemptionOrThrow(redemptionId: string) {
  return db.redemption.findUniqueOrThrow({
    where: { id: redemptionId },
  });
}

// ─── Request Redemption ─────────────────────────────────

interface RedemptionInput {
  tokenId: string;
  userId: string;
  redeemerCountry: string;
  preferredVaultId?: string;
}

export async function requestRedemption(
  input: RedemptionInput,
): Promise<Redemption> {
  return db.$transaction(async (tx) => {
    const token = await tx.digitalToken.findUniqueOrThrow({
      where: { id: input.tokenId },
    });

    if (token.currentOwnerId !== input.userId) {
      throw new Error("You do not own this token");
    }
    if (token.status !== "ACTIVE") {
      throw new Error(`Token cannot be redeemed (status: ${token.status})`);
    }

    // Find vault with stock
    const inventoryItems = await tx.authenticatorInventory.findMany({
      where: {
        cardId: token.cardId,
        condition: token.condition,
        language: token.language,
        isAvailable: true,
        quantity: { gt: 0 },
        authenticator: { isVaultOperator: true, isActive: true },
      },
      include: {
        authenticator: {
          select: {
            id: true,
            region: true,
            rating: true,
            currentLoad: true,
            regionRef: { select: { country: true } },
          },
        },
      },
    });

    if (inventoryItems.length === 0) {
      throw new Error("No vault stock available for this card and condition");
    }

    // Score vaults: same zone > rating > lower load
    let selectedItem = inventoryItems[0];
    if (input.preferredVaultId) {
      const preferred = inventoryItems.find(
        (i) => i.authenticator.id === input.preferredVaultId,
      );
      if (preferred) selectedItem = preferred;
    } else {
      const scored = inventoryItems.map((item) => {
        const vaultCountry = item.authenticator.regionRef?.country ?? "";
        const sameZone = isSameCustomsZone(input.redeemerCountry, vaultCountry);
        return {
          item,
          score:
            (sameZone ? 1000 : 0) +
            item.authenticator.rating * 10 -
            item.authenticator.currentLoad,
        };
      });
      scored.sort((a, b) => b.score - a.score);
      selectedItem = scored[0].item;
    }

    const vaultCountry = selectedItem.authenticator.regionRef?.country ?? "";
    const crossZone = !isSameCustomsZone(input.redeemerCountry, vaultCountry);
    const {
      "digital.redemption_base_fee_cents": baseFee,
      "digital.cross_zone_surcharge_cents": surchargeConfig,
    } = await getConfigs(["digital.redemption_base_fee_cents", "digital.cross_zone_surcharge_cents"]);
    const surcharge = crossZone ? surchargeConfig : 0;
    const totalFee = baseFee + surcharge;

    // Set token status
    await tx.digitalToken.update({
      where: { id: input.tokenId },
      data: { status: "REDEMPTION_PENDING" },
    });

    // Reserve stock (decrement inventory)
    const newQuantity = selectedItem.quantity - 1;
    await tx.authenticatorInventory.update({
      where: { id: selectedItem.id },
      data: {
        quantity: newQuantity,
        isAvailable: newQuantity > 0,
      },
    });

    // Debit redemption fee from redeemer
    const user = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { walletBalance: true },
    });
    const newBalance = user.walletBalance - totalFee;
    if (newBalance < 0) {
      throw new Error("Insufficient wallet balance for redemption fee");
    }
    await tx.user.update({
      where: { id: input.userId },
      data: { walletBalance: newBalance },
    });
    await tx.walletTransaction.create({
      data: {
        userId: input.userId,
        type: "REDEMPTION_FEE",
        amount: -totalFee,
        balanceAfter: newBalance,
        description: `Redemption fee${crossZone ? " (cross-zone)" : ""} for token ${input.tokenId.slice(-6)}`,
      },
    });

    // Create redemption
    return tx.redemption.create({
      data: {
        tokenId: input.tokenId,
        redeemerId: input.userId,
        vaultAuthenticatorId: selectedItem.authenticator.id,
        vaultCountry,
        redeemerCountry: input.redeemerCountry,
        isCrossZone: crossZone,
        redemptionFeeCents: baseFee,
        crossZoneSurcharge: surcharge,
      },
    });
  });
}

// ─── State Transitions ──────────────────────────────────

export async function reserveStock(
  redemptionId: string,
): Promise<Redemption> {
  const redemption = await getRedemptionOrThrow(redemptionId);
  assertTransition(redemption.status, "STOCK_RESERVED");

  return db.redemption.update({
    where: { id: redemptionId },
    data: { status: "STOCK_RESERVED" },
  });
}

export async function prepareShipment(
  redemptionId: string,
  authenticatorUserId: string,
): Promise<Redemption> {
  const redemption = await getRedemptionOrThrow(redemptionId);
  assertTransition(redemption.status, "PREPARING");

  // Verify caller is the vault authenticator
  const auth = await db.authenticator.findUnique({
    where: { userId: authenticatorUserId },
    select: { id: true },
  });
  if (!auth || auth.id !== redemption.vaultAuthenticatorId) {
    throw new Error("Only the vault authenticator can prepare shipment");
  }

  return db.redemption.update({
    where: { id: redemptionId },
    data: { status: "PREPARING" },
  });
}

export async function markShipped(
  redemptionId: string,
  trackingNumber: string,
): Promise<Redemption> {
  const redemption = await getRedemptionOrThrow(redemptionId);
  assertTransition(redemption.status, "SHIPPED");

  return db.redemption.update({
    where: { id: redemptionId },
    data: {
      status: "SHIPPED",
      trackingOutbound: trackingNumber,
      shippedAt: new Date(),
    },
  });
}

export async function confirmDelivery(
  redemptionId: string,
  redeemerId: string,
): Promise<Redemption> {
  const redemption = await getRedemptionOrThrow(redemptionId);
  assertTransition(redemption.status, "DELIVERED");

  if (redemption.redeemerId !== redeemerId) {
    throw new Error("Only the redeemer can confirm delivery");
  }

  return db.redemption.update({
    where: { id: redemptionId },
    data: { status: "DELIVERED", deliveredAt: new Date() },
  });
}

export async function completeRedemption(
  redemptionId: string,
): Promise<Redemption> {
  const redemption = await getRedemptionOrThrow(redemptionId);
  assertTransition(redemption.status, "COMPLETED");

  return db.$transaction(async (tx) => {
    // Credit vault authenticator
    const auth = await tx.authenticator.findUniqueOrThrow({
      where: { id: redemption.vaultAuthenticatorId },
      select: { userId: true },
    });
    const totalFee = redemption.redemptionFeeCents + redemption.crossZoneSurcharge;
    const authUser = await tx.user.findUniqueOrThrow({
      where: { id: auth.userId },
      select: { walletBalance: true },
    });
    const authNewBalance = authUser.walletBalance + totalFee;
    await tx.user.update({
      where: { id: auth.userId },
      data: { walletBalance: authNewBalance },
    });
    await tx.walletTransaction.create({
      data: {
        userId: auth.userId,
        type: "VAULT_EARN",
        amount: totalFee,
        balanceAfter: authNewBalance,
        description: `Redemption payout for token ${redemption.tokenId.slice(-6)}`,
      },
    });

    // Burn the token
    await tx.digitalToken.update({
      where: { id: redemption.tokenId },
      data: { status: "REDEEMED", redeemedAt: new Date() },
    });

    return tx.redemption.update({
      where: { id: redemptionId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  });
}

export async function cancelRedemption(
  redemptionId: string,
  userId: string,
): Promise<Redemption> {
  const redemption = await getRedemptionOrThrow(redemptionId);
  assertTransition(redemption.status, "CANCELLED");

  return db.$transaction(async (tx) => {
    // Return reserved stock to vault inventory
    const inventory = await tx.authenticatorInventory.findFirst({
      where: {
        authenticatorId: redemption.vaultAuthenticatorId,
        cardId: (await tx.digitalToken.findUniqueOrThrow({
          where: { id: redemption.tokenId },
          select: { cardId: true, condition: true, language: true },
        })).cardId,
      },
    });

    if (inventory) {
      await tx.authenticatorInventory.update({
        where: { id: inventory.id },
        data: { quantity: { increment: 1 }, isAvailable: true },
      });
    }

    // Refund redemption fee
    const totalFee = redemption.redemptionFeeCents + redemption.crossZoneSurcharge;
    const user = await tx.user.findUniqueOrThrow({
      where: { id: redemption.redeemerId },
      select: { walletBalance: true },
    });
    const newBalance = user.walletBalance + totalFee;
    await tx.user.update({
      where: { id: redemption.redeemerId },
      data: { walletBalance: newBalance },
    });
    await tx.walletTransaction.create({
      data: {
        userId: redemption.redeemerId,
        type: "DIGITISATION_FEE_REFUND",
        amount: totalFee,
        balanceAfter: newBalance,
        description: `Redemption fee refund for token ${redemption.tokenId.slice(-6)}`,
      },
    });

    // Return token to ACTIVE
    await tx.digitalToken.update({
      where: { id: redemption.tokenId },
      data: { status: "ACTIVE" },
    });

    return tx.redemption.update({
      where: { id: redemptionId },
      data: { status: "CANCELLED" },
    });
  });
}

export async function failRedemption(
  redemptionId: string,
  reason: string,
): Promise<Redemption> {
  const redemption = await getRedemptionOrThrow(redemptionId);
  assertTransition(redemption.status, "FAILED");

  return db.$transaction(async (tx) => {
    // Return reserved stock
    const token = await tx.digitalToken.findUniqueOrThrow({
      where: { id: redemption.tokenId },
      select: { cardId: true, condition: true, language: true },
    });
    const inventory = await tx.authenticatorInventory.findFirst({
      where: {
        authenticatorId: redemption.vaultAuthenticatorId,
        cardId: token.cardId,
        condition: token.condition,
        language: token.language,
      },
    });
    if (inventory) {
      await tx.authenticatorInventory.update({
        where: { id: inventory.id },
        data: { quantity: { increment: 1 }, isAvailable: true },
      });
    }

    // Refund redemption fee
    const totalFee = redemption.redemptionFeeCents + redemption.crossZoneSurcharge;
    const user = await tx.user.findUniqueOrThrow({
      where: { id: redemption.redeemerId },
      select: { walletBalance: true },
    });
    const newBalance = user.walletBalance + totalFee;
    await tx.user.update({
      where: { id: redemption.redeemerId },
      data: { walletBalance: newBalance },
    });
    await tx.walletTransaction.create({
      data: {
        userId: redemption.redeemerId,
        type: "DIGITISATION_FEE_REFUND",
        amount: totalFee,
        balanceAfter: newBalance,
        description: `Redemption fee refund (failed) for token ${redemption.tokenId.slice(-6)}`,
      },
    });

    // Return token to ACTIVE
    await tx.digitalToken.update({
      where: { id: redemption.tokenId },
      data: { status: "ACTIVE" },
    });

    return tx.redemption.update({
      where: { id: redemptionId },
      data: { status: "FAILED", failureReason: reason },
    });
  });
}

// ─── Queries ────────────────────────────────────────────

export async function getUserRedemptions(userId: string): Promise<Redemption[]> {
  return db.redemption.findMany({
    where: { redeemerId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      token: { include: { card: true } },
      vaultAuthenticator: { select: { id: true, businessName: true, region: true } },
    },
  });
}

export async function getRedemption(
  redemptionId: string,
): Promise<Redemption | null> {
  return db.redemption.findUnique({
    where: { id: redemptionId },
    include: {
      token: { include: { card: true } },
      vaultAuthenticator: { select: { id: true, businessName: true, region: true } },
      redeemer: { select: { id: true, name: true } },
    },
  });
}

export async function getVaultRedemptions(
  authenticatorId: string,
): Promise<Redemption[]> {
  return db.redemption.findMany({
    where: { vaultAuthenticatorId: authenticatorId },
    orderBy: { createdAt: "desc" },
    include: {
      token: { include: { card: true } },
      redeemer: { select: { id: true, name: true, country: true } },
    },
  });
}
