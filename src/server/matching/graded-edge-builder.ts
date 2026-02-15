/**
 * Graded Edge Builder — Constructs matching graph edges for graded (slabbed) cards.
 *
 * Graded cards match on grade equivalence (exact grade or within a range),
 * not condition thresholds. This runs as a separate matching pool from raw cards.
 */

import type { ListingEdge } from "./cycle-finder";
import { gradeMatchesWant } from "@/lib/grading";
import type { GradingCompany } from "@/types/domain";

/** A graded have listing loaded from DB with user region. */
export interface GradedHaveRow {
  id: string;
  userId: string;
  cardId: string;
  gradingCompany: string;
  grade: number;
  certNumber: string;
  language: string;
  askPrice: number;
  user: { id: string; region: string | null };
}

/** A graded want listing loaded from DB with user region. */
export interface GradedWantRow {
  id: string;
  userId: string;
  cardId: string;
  gradingCompany: string | null;
  minGrade: number;
  maxGrade: number | null;
  bidPrice: number;
  user: { id: string; region: string | null };
}

/**
 * Build listing edges from graded have/want listings.
 *
 * Reuses the `ListingEdge` interface from cycle-finder so that the existing
 * `findCycles()` algorithm works unchanged. The `condition` field carries
 * the grade as a string (e.g., "PSA-9") for display purposes.
 */
export function buildGradedEdges(
  haveListings: GradedHaveRow[],
  wantListings: GradedWantRow[],
): ListingEdge[] {
  const edges: ListingEdge[] = [];

  // Group want listings by cardId for efficient lookup
  const wantsByCard = new Map<string, GradedWantRow[]>();
  for (const want of wantListings) {
    const list = wantsByCard.get(want.cardId) ?? [];
    list.push(want);
    wantsByCard.set(want.cardId, list);
  }

  for (const have of haveListings) {
    const matchingWants = wantsByCard.get(have.cardId) ?? [];

    for (const want of matchingWants) {
      // Skip self-matches
      if (have.userId === want.userId) continue;

      // Check grade equivalence
      if (
        !gradeMatchesWant(
          have.grade,
          have.gradingCompany as GradingCompany,
          want.minGrade,
          want.maxGrade,
          (want.gradingCompany as GradingCompany) ?? null,
        )
      ) {
        continue;
      }

      // Check price viability
      if (want.bidPrice < have.askPrice) continue;

      edges.push({
        haveListingId: have.id,
        wantListingId: want.id,
        cardId: have.cardId,
        haveUserId: have.userId,
        wantUserId: want.userId,
        haveRegion: have.user.region ?? "unknown",
        wantRegion: want.user.region ?? "unknown",
        condition: `${have.gradingCompany}-${have.grade}`,
        askPrice: have.askPrice,
        bidPrice: want.bidPrice,
      });
    }
  }

  return edges;
}
