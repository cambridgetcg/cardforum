import { db } from "@/lib/db";
import { findCycles, type ListingEdge } from "@/server/matching/cycle-finder";
import { buildBridges, type BridgeProposal } from "@/server/matching/bridge-builder";
import { conditionMeetsMinimum, type Condition } from "@/types/domain";

/**
 * Run the matching engine: load listings, build graph, find cycles, create proposals.
 * Returns the newly created match proposals.
 */
export async function runMatching(): Promise<BridgeProposal[]> {
  // 1. Load all active have and want listings with user region info
  const [haveListings, wantListings] = await Promise.all([
    db.haveListing.findMany({
      where: { isActive: true },
      include: { user: { select: { id: true, region: true } } },
    }),
    db.wantListing.findMany({
      where: { isActive: true },
      include: { user: { select: { id: true, region: true } } },
    }),
  ]);

  // 2. Build edges: for each card, connect haveUsers to wantUsers
  //    Edge: haveUser --[gives card]--> wantUser
  //    Condition: haveListing.condition meets wantListing.minCondition
  const edges: ListingEdge[] = [];

  // Group want listings by cardId for efficient lookup
  const wantsByCard = new Map<string, typeof wantListings>();
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

      // Check condition meets minimum
      if (!conditionMeetsMinimum(have.condition as Condition, want.minCondition as Condition)) {
        continue;
      }

      edges.push({
        haveListingId: have.id,
        wantListingId: want.id,
        cardId: have.cardId,
        haveUserId: have.userId,
        wantUserId: want.userId,
        haveRegion: have.user.region ?? "unknown",
        wantRegion: want.user.region ?? "unknown",
        condition: have.condition,
      });
    }
  }

  // 3. Find cycles
  const cycles = findCycles(edges);

  // 4. Build and score proposals
  const proposals = buildBridges(cycles);

  // 5. Persist top proposals to DB
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  for (const proposal of proposals.slice(0, 50)) {
    await db.matchProposal.create({
      data: {
        score: proposal.score,
        cycleLength: proposal.cycle.length,
        regions: proposal.cycle.regions,
        expiresAt,
        legs: {
          create: proposal.legs.map((leg) => ({
            fromUserId: leg.fromUserId,
            toUserId: leg.toUserId,
            cardId: leg.cardId,
            region: leg.region,
            sequence: leg.sequence,
          })),
        },
      },
    });
  }

  return proposals;
}

/**
 * Get match proposals relevant to a specific user.
 */
export async function getUserProposals(userId: string) {
  return db.matchProposal.findMany({
    where: {
      isViable: true,
      expiresAt: { gt: new Date() },
      legs: {
        some: {
          OR: [{ fromUserId: userId }, { toUserId: userId }],
        },
      },
    },
    include: {
      legs: true,
      trade: true,
    },
    orderBy: { score: "desc" },
    take: 20,
  });
}
