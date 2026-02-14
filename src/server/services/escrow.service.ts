import { db } from "@/lib/db";

export async function createEscrow(tradeId: string, amount: number, currency = "USD") {
  return db.escrow.create({
    data: {
      tradeId,
      totalAmount: amount,
      currency,
      entries: {
        create: {
          type: "HOLD",
          amount,
          note: "Initial escrow hold",
        },
      },
    },
    include: { entries: true },
  });
}

export async function releaseEscrow(escrowId: string) {
  const escrow = await db.escrow.findUnique({ where: { id: escrowId } });
  if (!escrow || escrow.status !== "HELD") {
    throw new Error("Escrow not available for release");
  }

  return db.escrow.update({
    where: { id: escrowId },
    data: {
      status: "RELEASED",
      entries: {
        create: {
          type: "RELEASE",
          amount: escrow.totalAmount,
          note: "Trade completed — funds released",
        },
      },
    },
  });
}

export async function refundEscrow(escrowId: string, reason: string) {
  const escrow = await db.escrow.findUnique({ where: { id: escrowId } });
  if (!escrow || escrow.status !== "HELD") {
    throw new Error("Escrow not available for refund");
  }

  return db.escrow.update({
    where: { id: escrowId },
    data: {
      status: "REFUNDED",
      entries: {
        create: {
          type: "REFUND",
          amount: escrow.totalAmount,
          note: reason,
        },
      },
    },
  });
}
