import { db } from "@/lib/db";
import {
  canCreateUnpaidTrade,
  hasUnpaidTradeAdmission,
  NEW_PAID_COMMERCE_RETIRED_MESSAGE,
} from "@/lib/commerce-policy";

type ProposalLeg = {
  fromUserId: string;
  toUserId: string;
  haveListingId: string | null;
  gradedHaveListingId: string | null;
  sealedHaveListingId: string | null;
};

/** Resolve prices from server-owned listings, never a caller's claimed settlement. */
export async function canCreateUnpaidProposal(
  mode: string | null,
  legs: ProposalLeg[],
): Promise<boolean> {
  if (mode !== "DIRECT") return false;
  const ids = (key: "haveListingId" | "gradedHaveListingId" | "sealedHaveListingId") =>
    legs.map((leg) => leg[key]).filter((id): id is string => id !== null);
  const [raw, graded, sealed] = await Promise.all([
    db.haveListing.findMany({
      where: { id: { in: ids("haveListingId") } },
      select: { id: true, askPrice: true },
    }),
    db.gradedHaveListing.findMany({
      where: { id: { in: ids("gradedHaveListingId") } },
      select: { id: true, askPrice: true },
    }),
    db.sealedHaveListing.findMany({
      where: { id: { in: ids("sealedHaveListingId") } },
      select: { id: true, askPrice: true },
    }),
  ]);
  const prices = new Map(
    [...raw, ...graded, ...sealed].map((listing) => [listing.id, listing.askPrice]),
  );
  return canCreateUnpaidTrade(
    mode,
    legs.map((leg) => ({
      fromUserId: leg.fromUserId,
      toUserId: leg.toUserId,
      askPrice:
        prices.get(leg.haveListingId ?? leg.gradedHaveListingId ?? leg.sealedHaveListingId ?? "") ??
        null,
    })),
  );
}

/** Recheck new barter before commitment, since listing prices can change. */
export async function assertNewTradeRemainsUnpaid(trade: {
  id: string;
  mode: string | null;
  statusHistory: unknown;
}): Promise<void> {
  if (!hasUnpaidTradeAdmission(trade.statusHistory)) return;
  const legs = await db.tradeLeg.findMany({
    where: { tradeId: trade.id },
    include: {
      haveListing: { select: { askPrice: true } },
      gradedHaveListing: { select: { askPrice: true } },
      sealedHaveListing: { select: { askPrice: true } },
    },
  });
  if (
    !canCreateUnpaidTrade(
      trade.mode,
      legs.map((leg) => ({
        fromUserId: leg.fromUserId,
        toUserId: leg.toUserId,
        askPrice:
          leg.haveListing?.askPrice ??
          leg.gradedHaveListing?.askPrice ??
          leg.sealedHaveListing?.askPrice ??
          null,
      })),
    )
  )
    throw new Error(NEW_PAID_COMMERCE_RETIRED_MESSAGE);
}
