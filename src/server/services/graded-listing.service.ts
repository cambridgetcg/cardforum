import { db } from "@/lib/db";
import type { CreateGradedHaveListingInput, CreateGradedWantListingInput } from "@/lib/validators";
import { checkGradedAskCrossing, checkGradedBidCrossing } from "./price-validation.service";

export async function getUserGradedListings(userId: string) {
  const [have, want] = await Promise.all([
    db.gradedHaveListing.findMany({
      where: { userId, isActive: true },
      include: { card: true },
      orderBy: { createdAt: "desc" },
    }),
    db.gradedWantListing.findMany({
      where: { userId, isActive: true },
      include: { card: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { have, want };
}

export async function createGradedHaveListing(userId: string, input: CreateGradedHaveListingInput) {
  const crossing = await checkGradedAskCrossing(userId, input.cardId, input.askPrice);
  if (crossing.selfCross) {
    throw new Error(
      "Your ask price crosses your own active graded bid. Deactivate or raise your ask first.",
    );
  }

  const listing = await db.gradedHaveListing.create({
    data: { userId, ...input },
    include: { card: true },
  });

  return { ...listing, crossing: { marketCross: crossing.marketCross, bestBid: crossing.bestBid } };
}

export async function createGradedWantListing(userId: string, input: CreateGradedWantListingInput) {
  const crossing = await checkGradedBidCrossing(userId, input.cardId, input.bidPrice);
  if (crossing.selfCross) {
    throw new Error(
      "Your bid price crosses your own active graded ask. Deactivate or lower your bid first.",
    );
  }

  const listing = await db.gradedWantListing.create({
    data: { userId, ...input },
    include: { card: true },
  });

  return { ...listing, crossing: { marketCross: crossing.marketCross, bestAsk: crossing.bestAsk } };
}

export async function deactivateGradedListing(
  userId: string,
  listingId: string,
  type: "have" | "want",
) {
  if (type === "have") {
    return db.gradedHaveListing.update({
      where: { id: listingId, userId },
      data: { isActive: false },
    });
  }
  return db.gradedWantListing.update({
    where: { id: listingId, userId },
    data: { isActive: false },
  });
}
