import { db } from "@/lib/db";
import type { TxClient } from "./wallet.service";

export async function createEscrow(tradeId: string, amount: number, currency = "USD", tx?: TxClient) {
  const client = tx ?? db;
  return client.escrow.create({
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

export async function releaseEscrow(escrowId: string, tx?: TxClient) {
  const client = tx ?? db;
  const escrow = await client.escrow.findUnique({ where: { id: escrowId } });
  if (!escrow || escrow.status !== "HELD") {
    throw new Error("Escrow not available for release");
  }

  return client.escrow.update({
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

export async function refundEscrow(escrowId: string, reason: string, tx?: TxClient) {
  const client = tx ?? db;
  const escrow = await client.escrow.findUnique({ where: { id: escrowId } });
  if (!escrow || escrow.status !== "HELD") {
    throw new Error("Escrow not available for refund");
  }

  return client.escrow.update({
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
