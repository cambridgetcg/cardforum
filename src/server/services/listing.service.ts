import { db } from "@/lib/db";
import type { CreateHaveListingInput, CreateWantListingInput } from "@/lib/validators";

export async function getUserListings(userId: string) {
  const [have, want] = await Promise.all([
    db.haveListing.findMany({
      where: { userId, isActive: true },
      include: { card: true },
      orderBy: { createdAt: "desc" },
    }),
    db.wantListing.findMany({
      where: { userId, isActive: true },
      include: { card: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { have, want };
}

export async function createHaveListing(userId: string, input: CreateHaveListingInput) {
  return db.haveListing.create({
    data: { userId, ...input },
    include: { card: true },
  });
}

export async function createWantListing(userId: string, input: CreateWantListingInput) {
  return db.wantListing.create({
    data: { userId, ...input },
    include: { card: true },
  });
}

export async function deactivateListing(userId: string, listingId: string, type: "have" | "want") {
  if (type === "have") {
    return db.haveListing.update({
      where: { id: listingId, userId },
      data: { isActive: false },
    });
  }
  return db.wantListing.update({
    where: { id: listingId, userId },
    data: { isActive: false },
  });
}
