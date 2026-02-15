import { db } from "@/lib/db";
import type { TxClient } from "./wallet.service";
import {
  AUTO_COMPLETE_DELIVERY_DAYS,
  AUTHENTICATOR_SHIP_SLA_HOURS,
  AUTHENTICATOR_SHIP_WARNING_HOURS,
  AUTHENTICATOR_SHIP_ESCALATION_HOURS,
  DEAD_LETTER_RETENTION_DAYS,
  INTERNATIONAL_BASE_COST_CENTS,
  INTERNATIONAL_INSURANCE_RATE,
  INTERNATIONAL_INSURANCE_MIN_CENTS,
} from "@/lib/constants";

// ─── Address Management ─────────────────────────────────

/**
 * Lock shipping addresses for all legs when trade enters ESCROWED.
 * Snapshots each recipient's default address onto the TradeLeg so it
 * cannot be changed after financial commitment.
 */
export async function lockShippingAddresses(tradeId: string, tx?: TxClient) {
  const client = tx ?? db;
  const legs = await client.tradeLeg.findMany({
    where: { tradeId },
    select: { id: true, toUserId: true },
  });

  for (const leg of legs) {
    const defaultAddress = await client.shippingAddress.findFirst({
      where: { userId: leg.toUserId, isDefault: true },
    });

    if (!defaultAddress) {
      throw new Error(
        `User ${leg.toUserId} has no default shipping address. ` +
        `All participants must set a shipping address before escrow.`
      );
    }

    await client.tradeLeg.update({
      where: { id: leg.id },
      data: { shippingAddressId: defaultAddress.id },
    });
  }
}

/**
 * Get the authenticator's business address for a trade leg.
 * Called when user needs to know where to send/drop off their card.
 */
export async function getAuthenticatorAddress(tradeLegId: string) {
  const leg = await db.tradeLeg.findUnique({
    where: { id: tradeLegId },
    include: {
      verification: {
        include: {
          authenticator: {
            select: {
              businessName: true,
              businessAddress: true,
              shippingNotes: true,
              acceptsDropOff: true,
              acceptsMail: true,
            },
          },
        },
      },
    },
  });

  if (!leg?.verification?.authenticator) {
    throw new Error("No authenticator assigned to this leg");
  }

  return leg.verification.authenticator;
}

/**
 * Get the recipient's locked shipping address for a trade leg.
 * Called when authenticator/sender needs to ship the card.
 * Only available after trade enters DELIVERING (authenticated) or SHIPPING (direct).
 */
export async function getRecipientAddress(tradeLegId: string) {
  const leg = await db.tradeLeg.findUnique({
    where: { id: tradeLegId },
    include: {
      shippingAddress: true,
      trade: { select: { status: true, mode: true } },
    },
  });

  if (!leg) throw new Error("Trade leg not found");

  const tradeStatus = leg.trade.status;
  const mode = leg.trade.mode ?? "AUTHENTICATED";

  // Address only revealed during shipping phases
  const shippingPhases =
    mode === "AUTHENTICATED"
      ? ["DELIVERING", "DELIVERED", "COMPLETED"]
      : ["SHIPPING", "DELIVERED", "COMPLETED"];

  if (!shippingPhases.includes(tradeStatus)) {
    throw new Error("Recipient address not available until shipping phase");
  }

  if (!leg.shippingAddress) {
    throw new Error("No shipping address locked for this leg");
  }

  return leg.shippingAddress;
}

// ─── Shipment Recording ─────────────────────────────────

/**
 * Record that a card has been shipped (outbound: authenticator → recipient,
 * or direct: sender → recipient). Updates tracking and leg status.
 */
export async function recordShipment(
  tradeLegId: string,
  userId: string,
  trackingNumber: string,
) {
  const leg = await db.tradeLeg.findUnique({
    where: { id: tradeLegId },
    include: {
      trade: { select: { id: true, status: true, mode: true } },
      verification: { select: { authenticatorId: true, authenticator: { select: { userId: true } } } },
    },
  });

  if (!leg) throw new Error("Trade leg not found");

  const mode = leg.trade.mode ?? "AUTHENTICATED";

  // Validate caller is authorized to ship
  if (mode === "AUTHENTICATED") {
    if (leg.verification?.authenticator?.userId !== userId) {
      throw new Error("Only the assigned authenticator can record shipment");
    }
    if (leg.status !== "VERIFIED") {
      throw new Error("Leg must be VERIFIED before shipping");
    }
  } else {
    // Direct mode: sender ships
    if (leg.fromUserId !== userId) {
      throw new Error("Only the sender can record shipment in direct mode");
    }
    if (leg.status !== "PENDING") {
      throw new Error("Leg must be PENDING before shipping in direct mode");
    }
  }

  const updateData: Record<string, unknown> = {
    status: "SHIPPED",
    shippedAt: new Date(),
  };

  if (mode === "AUTHENTICATED") {
    updateData.outboundTracking = trackingNumber;
  } else {
    updateData.trackingNumber = trackingNumber;
  }

  return db.tradeLeg.update({
    where: { id: tradeLegId },
    data: updateData,
  });
}

/**
 * Record inbound delivery method and optional tracking for user → authenticator.
 */
export async function recordInbound(
  tradeLegId: string,
  userId: string,
  deliveryMethod: "DROP_OFF" | "MAIL",
  trackingNumber?: string,
) {
  const leg = await db.tradeLeg.findUnique({
    where: { id: tradeLegId },
    include: { trade: { select: { mode: true } } },
  });

  if (!leg) throw new Error("Trade leg not found");
  if (leg.fromUserId !== userId) {
    throw new Error("Only the sender can record inbound shipping");
  }

  if (deliveryMethod === "MAIL" && !trackingNumber) {
    throw new Error("Tracking number required when mailing");
  }

  return db.tradeLeg.update({
    where: { id: tradeLegId },
    data: {
      deliveryMethod,
      ...(trackingNumber ? { trackingNumber } : {}),
    },
  });
}

// ─── Delivery Confirmation ──────────────────────────────

/**
 * Recipient confirms they received the card.
 * Transitions leg to DELIVERED. If ALL legs in the trade are DELIVERED,
 * returns true so caller can transition the trade.
 */
export async function confirmDelivery(
  tradeLegId: string,
  userId: string,
  photos?: string[],
) {
  const leg = await db.tradeLeg.findUnique({
    where: { id: tradeLegId },
    include: { trade: { select: { id: true } } },
  });

  if (!leg) throw new Error("Trade leg not found");
  if (leg.toUserId !== userId) {
    throw new Error("Only the recipient can confirm delivery");
  }
  if (leg.status !== "SHIPPED") {
    throw new Error("Leg must be SHIPPED before confirming delivery");
  }

  await db.tradeLeg.update({
    where: { id: tradeLegId },
    data: {
      status: "DELIVERED",
      deliveredAt: new Date(),
      ...(photos ? { deliveryPhotos: photos } : {}),
    },
  });

  // Check if all legs in the trade are now DELIVERED
  return areAllLegsDelivered(leg.trade.id);
}

/**
 * Check if all legs of a trade have reached DELIVERED status.
 */
export async function areAllLegsDelivered(tradeId: string): Promise<boolean> {
  const legs = await db.tradeLeg.findMany({
    where: { tradeId },
    select: { status: true },
  });

  return legs.length > 0 && legs.every((l) => l.status === "DELIVERED");
}

// ─── Auto-Complete ──────────────────────────────────────

/**
 * Auto-complete legs that have been in SHIPPED status for longer than
 * AUTO_COMPLETE_DELIVERY_DAYS without recipient confirmation.
 *
 * Called by cron job. Returns IDs of auto-completed legs.
 */
export async function autoCompleteDeliveries(): Promise<string[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - AUTO_COMPLETE_DELIVERY_DAYS);

  const staleLegs = await db.tradeLeg.findMany({
    where: {
      status: "SHIPPED",
      shippedAt: { lt: cutoff },
    },
    include: {
      trade: { select: { id: true, status: true } },
    },
  });

  // Only auto-complete if the leg has no open dispute
  const autoCompletedIds: string[] = [];

  for (const leg of staleLegs) {
    const hasOpenDispute = await db.dispute.findFirst({
      where: {
        tradeId: leg.trade.id,
        tradeLegId: leg.id,
        status: { in: ["OPEN", "INVESTIGATING", "ESCALATED"] },
      },
    });

    if (hasOpenDispute) continue; // skip — dispute pauses auto-complete

    await db.tradeLeg.update({
      where: { id: leg.id },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
      },
    });

    autoCompletedIds.push(leg.id);
  }

  return autoCompletedIds;
}

// ─── Shipping SLA Enforcement ───────────────────────────

interface SLAViolation {
  tradeLegId: string;
  tradeId: string;
  authenticatorId: string | null;
  hoursOverdue: number;
  severity: "WARNING" | "OVERDUE" | "ESCALATION";
}

/**
 * Check for shipping SLA violations. Called by cron job.
 *
 * Returns legs that need attention:
 * - WARNING (24h): First reminder to authenticator
 * - OVERDUE (48h): Deadline passed, flag authenticator
 * - ESCALATION (72h): Support intervention needed
 */
export async function checkShippingSLA(): Promise<SLAViolation[]> {
  // Find legs in VERIFIED status (authenticated) where trade is DELIVERING
  // These are legs where authenticator should have shipped but hasn't
  const deliveringTrades = await db.trade.findMany({
    where: { status: "DELIVERING" },
    include: {
      legs: {
        where: {
          status: "VERIFIED", // should be SHIPPED by now
          shippedAt: null,
        },
        select: {
          id: true,
          authenticatorId: true,
          updatedAt: true,
        },
      },
    },
  });

  const now = Date.now();
  const violations: SLAViolation[] = [];

  for (const trade of deliveringTrades) {
    for (const leg of trade.legs) {
      const hoursElapsed = (now - leg.updatedAt.getTime()) / (1000 * 60 * 60);

      if (hoursElapsed >= AUTHENTICATOR_SHIP_ESCALATION_HOURS) {
        violations.push({
          tradeLegId: leg.id,
          tradeId: trade.id,
          authenticatorId: leg.authenticatorId,
          hoursOverdue: hoursElapsed,
          severity: "ESCALATION",
        });
      } else if (hoursElapsed >= AUTHENTICATOR_SHIP_SLA_HOURS) {
        violations.push({
          tradeLegId: leg.id,
          tradeId: trade.id,
          authenticatorId: leg.authenticatorId,
          hoursOverdue: hoursElapsed,
          severity: "OVERDUE",
        });
      } else if (hoursElapsed >= AUTHENTICATOR_SHIP_WARNING_HOURS) {
        violations.push({
          tradeLegId: leg.id,
          tradeId: trade.id,
          authenticatorId: leg.authenticatorId,
          hoursOverdue: hoursElapsed,
          severity: "WARNING",
        });
      }
    }
  }

  // Also check direct trades in SHIPPING status where sender hasn't shipped
  const directTrades = await db.trade.findMany({
    where: { status: "SHIPPING", mode: "DIRECT" },
    include: {
      legs: {
        where: {
          status: "PENDING",
          shippedAt: null,
        },
        select: {
          id: true,
          fromUserId: true,
          updatedAt: true,
        },
      },
    },
  });

  for (const trade of directTrades) {
    for (const leg of trade.legs) {
      const hoursElapsed = (now - leg.updatedAt.getTime()) / (1000 * 60 * 60);
      const deadlineHours = 7 * 24; // DIRECT_TRADE_SHIPPING_DEADLINE_DAYS * 24

      if (hoursElapsed >= deadlineHours) {
        violations.push({
          tradeLegId: leg.id,
          tradeId: trade.id,
          authenticatorId: null,
          hoursOverdue: hoursElapsed,
          severity: "ESCALATION",
        });
      } else if (hoursElapsed >= deadlineHours * 0.75) {
        violations.push({
          tradeLegId: leg.id,
          tradeId: trade.id,
          authenticatorId: null,
          hoursOverdue: hoursElapsed,
          severity: "WARNING",
        });
      }
    }
  }

  return violations;
}

// ─── Card Return Flow ───────────────────────────────────

/**
 * Initiate card return when a trade is cancelled and cards are at authenticators.
 * Creates return tracking entries and starts the dead letter timer.
 */
export async function initiateCardReturns(tradeId: string, tx?: TxClient) {
  const client = tx ?? db;
  const legs = await client.tradeLeg.findMany({
    where: {
      tradeId,
      authenticatorId: { not: null },
      status: { in: ["CARD_RECEIVED", "PHOTO_REVIEW", "AUTHENTICATING", "VERIFIED"] },
    },
    select: {
      id: true,
      fromUserId: true,
      authenticatorId: true,
    },
  });

  // Mark legs as needing return (we reuse the status flow — set back to PENDING
  // would be confusing, so we leave status as-is and rely on returnTracking + notifications)
  for (const leg of legs) {
    await client.tradeLeg.update({
      where: { id: leg.id },
      data: {
        // returnTracking will be set by authenticator when they ship back
        updatedAt: new Date(), // reset timer for dead letter tracking
      },
    });

    // Create notification for authenticator
    if (leg.authenticatorId) {
      const authenticator = await client.authenticator.findUnique({
        where: { id: leg.authenticatorId },
        select: { userId: true },
      });

      if (authenticator) {
        await client.notification.create({
          data: {
            userId: authenticator.userId,
            type: "CARD_RETURN",
            title: "Card return required",
            message: `Trade cancelled. Please arrange return of the card to the sender or hold for pickup. Card must be returned within ${DEAD_LETTER_RETENTION_DAYS} days.`,
            link: `/trades`,
          },
        });
      }
    }

    // Notify sender to retrieve their card
    await client.notification.create({
      data: {
        userId: leg.fromUserId,
        type: "CARD_RETURN",
        title: "Retrieve your card",
        message: `Trade cancelled. Contact the authenticator to arrange pickup or return shipping. You have ${DEAD_LETTER_RETENTION_DAYS} days to retrieve your card.`,
        link: `/trades`,
      },
    });
  }

  return legs.length;
}

/**
 * Record that an authenticator has shipped a card back to the sender (return).
 */
export async function recordReturnShipment(
  tradeLegId: string,
  authenticatorUserId: string,
  trackingNumber: string,
) {
  const leg = await db.tradeLeg.findUnique({
    where: { id: tradeLegId },
    include: {
      trade: { select: { status: true } },
      verification: {
        select: { authenticator: { select: { userId: true } } },
      },
    },
  });

  if (!leg) throw new Error("Trade leg not found");
  if (leg.trade.status !== "CANCELLED") {
    throw new Error("Return shipping only available for cancelled trades");
  }
  if (leg.verification?.authenticator?.userId !== authenticatorUserId) {
    throw new Error("Only the assigned authenticator can record return shipment");
  }

  return db.tradeLeg.update({
    where: { id: tradeLegId },
    data: { returnTracking: trackingNumber },
  });
}

// ─── Photo Evidence Chain ────────────────────────────────

/**
 * Authenticator records receipt photos when card arrives.
 * These document card condition at the moment of receipt.
 */
export async function recordReceiptPhotos(
  tradeLegId: string,
  authenticatorUserId: string,
  photos: string[],
) {
  const leg = await db.tradeLeg.findUnique({
    where: { id: tradeLegId },
    include: {
      verification: { select: { authenticator: { select: { userId: true } } } },
    },
  });

  if (!leg) throw new Error("Trade leg not found");
  if (leg.verification?.authenticator?.userId !== authenticatorUserId) {
    throw new Error("Only the assigned authenticator can record receipt photos");
  }

  return db.tradeLeg.update({
    where: { id: tradeLegId },
    data: { receiptPhotos: photos },
  });
}

/**
 * Authenticator records pre-shipment photos before sending to recipient.
 * These document card condition + packaging quality before shipping.
 */
export async function recordPreShipPhotos(
  tradeLegId: string,
  authenticatorUserId: string,
  photos: string[],
) {
  const leg = await db.tradeLeg.findUnique({
    where: { id: tradeLegId },
    include: {
      verification: { select: { authenticator: { select: { userId: true } } } },
    },
  });

  if (!leg) throw new Error("Trade leg not found");
  if (leg.verification?.authenticator?.userId !== authenticatorUserId) {
    throw new Error("Only the assigned authenticator can record pre-ship photos");
  }
  if (leg.status !== "VERIFIED") {
    throw new Error("Card must be VERIFIED before recording pre-ship photos");
  }

  return db.tradeLeg.update({
    where: { id: tradeLegId },
    data: { preShipPhotos: photos },
  });
}

// ─── International Shipping ─────────────────────────────

/**
 * Estimate international shipping cost for a trade leg.
 * Used to quote users before they accept a trade with international legs.
 */
export function estimateInternationalCost(
  cardValueCents: number,
): { baseCost: number; insuranceCost: number; totalCost: number } {
  const baseCost = INTERNATIONAL_BASE_COST_CENTS;
  const insuranceCost = Math.max(
    Math.ceil(cardValueCents * INTERNATIONAL_INSURANCE_RATE),
    INTERNATIONAL_INSURANCE_MIN_CENTS,
  );
  return {
    baseCost,
    insuranceCost,
    totalCost: baseCost + insuranceCost,
  };
}

/**
 * Get full shipping details for a trade (all legs with addresses and tracking).
 */
export async function getTradeShippingDetails(tradeId: string, userId: string) {
  const trade = await db.trade.findUnique({
    where: { id: tradeId },
    include: {
      legs: {
        include: {
          shippingAddress: true,
          verification: {
            include: {
              authenticator: {
                select: {
                  businessName: true,
                  businessAddress: true,
                  shippingNotes: true,
                  acceptsDropOff: true,
                  acceptsMail: true,
                },
              },
            },
          },
          haveListing: { select: { askPrice: true, card: { select: { name: true } } } },
          gradedHaveListing: { select: { askPrice: true, card: { select: { name: true } } } },
        },
        orderBy: { sequence: "asc" },
      },
    },
  });

  if (!trade) throw new Error("Trade not found");

  // Verify user is a participant
  if (!trade.participantIds.includes(userId)) {
    throw new Error("Not authorized");
  }

  const mode = trade.mode ?? "AUTHENTICATED";
  const isShippingPhase = ["DELIVERING", "SHIPPING", "DELIVERED", "COMPLETED"].includes(trade.status);

  return trade.legs.map((leg) => {
    const cardName = leg.haveListing?.card?.name ?? leg.gradedHaveListing?.card?.name ?? "Unknown";
    const cardValue = leg.haveListing?.askPrice ?? leg.gradedHaveListing?.askPrice ?? 0;

    return {
      legId: leg.id,
      cardName,
      cardValue,
      fromUserId: leg.fromUserId,
      toUserId: leg.toUserId,
      region: leg.region,
      status: leg.status,
      isInternational: leg.isInternational,

      // Inbound shipping (user → authenticator or sender → recipient)
      deliveryMethod: leg.deliveryMethod,
      inboundTracking: leg.trackingNumber,

      // Outbound shipping (authenticator → recipient)
      outboundTracking: leg.outboundTracking,
      shippedAt: leg.shippedAt,
      deliveredAt: leg.deliveredAt,

      // Return shipping (cancelled trades)
      returnTracking: leg.returnTracking,

      // Authenticator info (only for authenticated trades, only when relevant)
      authenticator:
        mode === "AUTHENTICATED" && leg.verification?.authenticator
          ? {
              businessName: leg.verification.authenticator.businessName,
              businessAddress: leg.verification.authenticator.businessAddress,
              shippingNotes: leg.verification.authenticator.shippingNotes,
              acceptsDropOff: leg.verification.authenticator.acceptsDropOff,
              acceptsMail: leg.verification.authenticator.acceptsMail,
            }
          : null,

      // Recipient address (only visible to shipper during shipping phase)
      recipientAddress:
        isShippingPhase &&
        (leg.fromUserId === userId ||
          leg.verification?.authenticator !== undefined)
          ? leg.shippingAddress
          : null,
    };
  });
}
