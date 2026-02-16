/**
 * Sealed Edge Builder — Constructs matching graph edges for sealed products.
 *
 * Sealed products match on identity (same sealedProductId), condition threshold,
 * and price viability. Runs as a separate matching pool from raw and graded cards.
 */

import type { ListingEdge } from "./cycle-finder";
import { sealedConditionMeetsMinimum, type SealedCondition } from "@/types/domain";

interface UserWithRegion {
  id: string;
  region: string | null;
  regionId?: string | null;
  regionRef?: { name: string; country: string } | null;
}

/** A sealed have listing loaded from DB with user region. */
export interface SealedHaveRow {
  id: string;
  userId: string;
  sealedProductId: string;
  condition: string;
  language: string;
  askPrice: number;
  user: UserWithRegion;
}

/** A sealed want listing loaded from DB with user region. */
export interface SealedWantRow {
  id: string;
  userId: string;
  sealedProductId: string;
  minCondition: string;
  language: string | null;
  bidPrice: number;
  user: UserWithRegion;
}

/** Resolve a user's effective region string, preferring the normalized Region FK */
function resolveRegion(user: UserWithRegion): string {
  if (user.regionRef) return `${user.regionRef.name}, ${user.regionRef.country}`;
  return user.region ?? "unknown";
}

/**
 * Build listing edges from sealed have/want listings.
 *
 * Reuses the `ListingEdge` interface from cycle-finder so that the existing
 * `findCycles()` algorithm works unchanged. The `cardId` field carries
 * `sealedProductId` — the cycle finder doesn't care what it represents.
 */
export function buildSealedEdges(
  haveListings: SealedHaveRow[],
  wantListings: SealedWantRow[],
): ListingEdge[] {
  const edges: ListingEdge[] = [];

  // Group want listings by sealedProductId for efficient lookup
  const wantsByProduct = new Map<string, SealedWantRow[]>();
  for (const want of wantListings) {
    const list = wantsByProduct.get(want.sealedProductId) ?? [];
    list.push(want);
    wantsByProduct.set(want.sealedProductId, list);
  }

  for (const have of haveListings) {
    const matchingWants = wantsByProduct.get(have.sealedProductId) ?? [];

    for (const want of matchingWants) {
      // Skip self-matches
      if (have.userId === want.userId) continue;

      // Check sealed condition meets minimum
      if (
        !sealedConditionMeetsMinimum(
          have.condition as SealedCondition,
          want.minCondition as SealedCondition,
        )
      ) {
        continue;
      }

      // Check price viability
      if (want.bidPrice < have.askPrice) continue;

      // Language filter: want.language specified → must match have.language
      if (want.language && have.language !== want.language) continue;

      edges.push({
        haveListingId: have.id,
        wantListingId: want.id,
        cardId: have.sealedProductId,
        haveUserId: have.userId,
        wantUserId: want.userId,
        haveRegion: resolveRegion(have.user),
        wantRegion: resolveRegion(want.user),
        condition: have.condition,
        language: have.language,
        askPrice: have.askPrice,
        bidPrice: want.bidPrice,
      });
    }
  }

  return edges;
}
