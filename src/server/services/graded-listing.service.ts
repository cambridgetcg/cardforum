import { db } from "@/lib/db";
import type {
  CreateGradedHaveListingInput,
  CreateGradedWantListingInput,
} from "@/lib/validators";

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

export async function createGradedHaveListing(
  userId: string,
  input: CreateGradedHaveListingInput,
) {
  return db.gradedHaveListing.create({
    data: { userId, ...input },
    include: { card: true },
  });
}

export async function createGradedWantListing(
  userId: string,
  input: CreateGradedWantListingInput,
) {
  return db.gradedWantListing.create({
    data: { userId, ...input },
    include: { card: true },
  });
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
