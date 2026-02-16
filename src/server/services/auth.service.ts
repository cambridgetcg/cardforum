import { db } from "@/lib/db";
import type { AuthenticatorTier } from "@/types/domain";

export async function getAuthenticatorsByRegion(region: string) {
  return db.authenticator.findMany({
    where: { region, isActive: true },
    include: { user: { select: { name: true, image: true } } },
    orderBy: { rating: "desc" },
  });
}

export async function assignAuthenticator(tradeLegId: string, authenticatorId: string) {
  return db.verificationAssignment.create({
    data: {
      tradeLegId,
      authenticatorId,
    },
  });
}

export async function registerAuthenticator(
  userId: string,
  region: string,
  tier: AuthenticatorTier = "STANDARD",
) {
  return db.authenticator.create({
    data: {
      userId,
      region,
      tier,
    },
  });
}
