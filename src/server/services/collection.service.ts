/**
 * Collection Service — Track owned cards, compute set completion.
 *
 * Collections are OWNERSHIP records, separate from trade listings.
 * A user can own a card without listing it for trade.
 */

import { db } from "@/lib/db";
import type { Condition, TCG } from "@/types/domain";

// ─── Types ──────────────────────────────────────────

export interface AddToCollectionInput {
  userId: string;
  cardId: string;
  quantity?: number;
  condition?: Condition;
  pricePaid?: number; // cents
  notes?: string;
}

export interface CollectionEntryResult {
  id: string;
  cardId: string;
  quantity: number;
  condition: Condition | null;
  acquiredAt: string;
  pricePaid: number | null;
  notes: string | null;
  card: {
    id: string;
    name: string;
    tcg: string;
    setName: string;
    setCode: string | null;
    number: string | null;
    rarity: string | null;
    imageUrl: string | null;
  };
}

export interface SetCompletion {
  setCode: string;
  setName: string;
  tcg: string;
  owned: number;
  total: number;
  pct: number;
}

export interface CollectionStats {
  totalCards: number;
  uniqueCards: number;
  totalValue: number; // cents (sum of pricePaid)
  setCompletion: SetCompletion[];
}

// ─── Service Functions ──────────────────────────────

/**
 * Add a card to the user's collection.
 * If the exact (userId, cardId, condition) already exists, increments quantity.
 */
export async function addToCollection(input: AddToCollectionInput) {
  const { userId, cardId, quantity = 1, condition, pricePaid, notes } = input;

  // Check for existing entry
  const existing = await db.collectionEntry.findFirst({
    where: { userId, cardId, condition: condition ?? null },
  });

  if (existing) {
    return db.collectionEntry.update({
      where: { id: existing.id },
      data: {
        quantity: { increment: quantity },
        ...(pricePaid != null ? { pricePaid } : {}),
        ...(notes != null ? { notes } : {}),
      },
    });
  }

  return db.collectionEntry.create({
    data: {
      userId,
      cardId,
      quantity,
      condition: condition ?? null,
      pricePaid: pricePaid ?? null,
      notes: notes ?? null,
    },
  });
}

/**
 * Remove a card from the collection entirely.
 */
export async function removeFromCollection(userId: string, entryId: string) {
  return db.collectionEntry.deleteMany({
    where: { id: entryId, userId },
  });
}

/**
 * Update quantity or notes on an existing entry.
 */
export async function updateCollectionEntry(
  userId: string,
  entryId: string,
  data: { quantity?: number; notes?: string; pricePaid?: number | null },
) {
  return db.collectionEntry.updateMany({
    where: { id: entryId, userId },
    data,
  });
}

/**
 * List the user's entire collection with card data.
 */
export async function getCollection(
  userId: string,
  filters?: { tcg?: string; setCode?: string; rarity?: string },
): Promise<CollectionEntryResult[]> {
  const entries = await db.collectionEntry.findMany({
    where: {
      userId,
      card: {
        ...(filters?.tcg ? { tcg: filters.tcg as TCG } : {}),
        ...(filters?.setCode ? { setCode: filters.setCode } : {}),
        ...(filters?.rarity ? { rarity: filters.rarity } : {}),
      },
    },
    select: {
      id: true,
      cardId: true,
      quantity: true,
      condition: true,
      acquiredAt: true,
      pricePaid: true,
      notes: true,
      card: {
        select: {
          id: true,
          name: true,
          tcg: true,
          setName: true,
          setCode: true,
          number: true,
          rarity: true,
          imageUrl: true,
        },
      },
    },
    orderBy: [{ card: { setCode: "asc" } }, { card: { number: "asc" } }],
  });

  return entries.map((e) => ({
    id: e.id,
    cardId: e.cardId,
    quantity: e.quantity,
    condition: e.condition,
    acquiredAt: e.acquiredAt.toISOString(),
    pricePaid: e.pricePaid,
    notes: e.notes,
    card: e.card,
  }));
}

/**
 * Batch check which cards from a list are in the user's collection.
 * Returns a Set of cardIds that are owned.
 */
export async function getOwnedCardIds(userId: string, cardIds: string[]): Promise<Set<string>> {
  if (cardIds.length === 0) return new Set();

  const entries = await db.collectionEntry.findMany({
    where: { userId, cardId: { in: cardIds } },
    select: { cardId: true },
    distinct: ["cardId"],
  });

  return new Set(entries.map((e) => e.cardId));
}

/**
 * Compute collection stats: total cards, unique cards, set completion %.
 */
export async function getCollectionStats(userId: string): Promise<CollectionStats> {
  // Get all entries grouped by card
  const entries = await db.collectionEntry.findMany({
    where: { userId },
    select: {
      quantity: true,
      pricePaid: true,
      card: {
        select: { id: true, setCode: true, setName: true, tcg: true },
      },
    },
  });

  const totalCards = entries.reduce((sum, e) => sum + e.quantity, 0);
  const uniqueCardIds = new Set(entries.map((e) => e.card.id));
  const totalValue = entries.reduce((sum, e) => sum + (e.pricePaid ?? 0), 0);

  // Group by setCode for completion calc
  const ownedBySet = new Map<string, Set<string>>();
  const setMeta = new Map<string, { name: string; tcg: string }>();

  for (const e of entries) {
    const code = e.card.setCode;
    if (!code) continue;

    if (!ownedBySet.has(code)) {
      ownedBySet.set(code, new Set());
      setMeta.set(code, { name: e.card.setName, tcg: e.card.tcg });
    }
    ownedBySet.get(code)!.add(e.card.id);
  }

  // Get total cards per set
  const setCodes = [...ownedBySet.keys()];
  const setTotals = setCodes.length > 0
    ? await db.card.groupBy({
        by: ["setCode"],
        where: { setCode: { in: setCodes } },
        _count: true,
      })
    : [];

  const totalBySet = new Map(setTotals.map((s) => [s.setCode!, s._count]));

  const setCompletion: SetCompletion[] = setCodes
    .map((code) => {
      const owned = ownedBySet.get(code)!.size;
      const total = totalBySet.get(code) ?? 0;
      const meta = setMeta.get(code)!;
      return {
        setCode: code,
        setName: meta.name,
        tcg: meta.tcg,
        owned,
        total,
        pct: total > 0 ? Math.round((owned / total) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.pct - a.pct);

  return {
    totalCards,
    uniqueCards: uniqueCardIds.size,
    totalValue,
    setCompletion,
  };
}
