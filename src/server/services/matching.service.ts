import { db } from "@/lib/db";
import { findCycles, type ListingEdge } from "@/server/matching/cycle-finder";
import {
  buildBridges,
  isAutoAcceptEligible,
  type AutoAcceptConstraint,
  type BridgeProposal,
} from "@/server/matching/bridge-builder";
import { packProposals } from "@/server/matching/packer";
import { findChains, chainToProposal, type ChainAnchor } from "@/server/matching/chain-finder";
import { buildGradedEdges } from "@/server/matching/graded-edge-builder";
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
        askPrice: have.askPrice,
        bidPrice: want.bidPrice,
      });
    }
  }

  // 3. Find cycles
  const cycles = findCycles(edges);

  // 3.5. Find altruistic chains from authenticator inventory
  const inventoryItems = await db.authenticatorInventory.findMany({
    where: { isAvailable: true },
    include: { authenticator: { select: { id: true, region: true } } },
  });

  const anchors: ChainAnchor[] = inventoryItems.map((item) => ({
    inventoryId: item.id,
    authenticatorId: item.authenticatorId,
    cardId: item.cardId,
    condition: item.condition,
    region: item.authenticator.region,
    askPrice: 0, // vault stock — no ask price (custody, not for sale)
  }));

  // Cards that authenticators want (for chain termination detection)
  const authenticatorUserIds = new Set(inventoryItems.map((i) => i.authenticatorId));
  const authenticatorWantCardIds = new Set<string>();
  for (const want of wantListings) {
    if (authenticatorUserIds.has(want.userId)) {
      authenticatorWantCardIds.add(want.cardId);
    }
  }

  const chains = findChains(anchors, edges, authenticatorWantCardIds);
  const chainProposals = chains.map(chainToProposal);

  // 3.6. Graded card matching (separate pool)
  const [gradedHaveListings, gradedWantListings] = await Promise.all([
    db.gradedHaveListing.findMany({
      where: { isActive: true },
      include: { user: { select: { id: true, region: true } } },
    }),
    db.gradedWantListing.findMany({
      where: { isActive: true },
      include: { user: { select: { id: true, region: true } } },
    }),
  ]);

  const gradedEdges = buildGradedEdges(gradedHaveListings, gradedWantListings);
  const gradedCycles = findCycles(gradedEdges);
  const gradedProposals = buildBridges(gradedCycles);

  // Tag graded proposals
  for (const p of gradedProposals) {
    p.isGraded = true;
  }

  // 4. Build and score proposals (raw cycles + chains + graded cycles merged)
  const cycleProposals = buildBridges(cycles);
  const proposals = [...cycleProposals, ...chainProposals, ...gradedProposals]
    .sort((a, b) => b.score - a.score);

  // 4.5. Pack non-overlapping proposals (replaces naive slice)
  const { packed } = packProposals(proposals);

  // 5. Persist top proposals to DB and check auto-accept eligibility
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  for (const proposal of packed) {
    const isGraded = proposal.isGraded ?? false;

    const matchProposal = await db.matchProposal.create({
      data: {
        score: proposal.score,
        cycleLength: proposal.cycle.length,
        regions: proposal.cycle.regions,
        tradeMode: proposal.tradeMode ?? "AUTHENTICATED",
        expiresAt,
        legs: {
          create: proposal.legs.map((leg) => ({
            fromUserId: leg.fromUserId,
            toUserId: leg.toUserId,
            cardId: leg.cardId,
            region: leg.region,
            sequence: leg.sequence,
            ...(isGraded
              ? { gradedHaveListingId: leg.haveListingId, gradedWantListingId: leg.wantListingId }
              : { haveListingId: leg.haveListingId, wantListingId: leg.wantListingId }),
          })),
        },
      },
    });

    // 5b. Check auto-accept eligibility
    const constraints = await loadAutoAcceptConstraints(proposal);
    if (isAutoAcceptEligible(proposal, constraints)) {
      const participantIds = proposal.userIds;

      await db.trade.create({
        data: {
          proposalId: matchProposal.id,
          userAId: participantIds[0],
          userBId: participantIds[1] ?? participantIds[0],
          participantIds,
          mode: proposal.tradeMode ?? "AUTHENTICATED",
          status: "ACCEPTED",
          statusHistory: [
            { status: "PROPOSED", at: new Date().toISOString() },
            { status: "ACCEPTED", at: new Date().toISOString(), auto: true },
          ],
          legs: {
            create: proposal.legs.map((leg) => ({
              ...(isGraded
                ? { gradedHaveListingId: leg.haveListingId, gradedWantListingId: leg.wantListingId, isGraded: true }
                : { haveListingId: leg.haveListingId, wantListingId: leg.wantListingId }),
              fromUserId: leg.fromUserId,
              toUserId: leg.toUserId,
              region: leg.region,
              sequence: leg.sequence,
            })),
          },
        },
      });

      // Deactivate consumed listings
      const haveIds = proposal.legs.map((l) => l.haveListingId);
      const wantIds = proposal.legs.map((l) => l.wantListingId);

      if (isGraded) {
        await Promise.all([
          db.gradedHaveListing.updateMany({
            where: { id: { in: haveIds } },
            data: { isActive: false },
          }),
          db.gradedWantListing.updateMany({
            where: { id: { in: wantIds } },
            data: { isActive: false },
          }),
        ]);
      } else {
        await Promise.all([
          db.haveListing.updateMany({
            where: { id: { in: haveIds } },
            data: { isActive: false },
          }),
          db.wantListing.updateMany({
            where: { id: { in: wantIds } },
            data: { isActive: false },
          }),
        ]);
      }
    }
  }

  return packed;
}

/**
 * Load auto-accept constraints for all listings in a proposal.
 * Returns a map from listingId → constraint.
 * Works for both raw and graded proposals.
 */
async function loadAutoAcceptConstraints(
  proposal: BridgeProposal,
): Promise<Map<string, AutoAcceptConstraint>> {
  const haveIds = proposal.legs.map((l) => l.haveListingId);
  const wantIds = proposal.legs.map((l) => l.wantListingId);

  const selectFields = {
    id: true,
    autoAccept: true,
    autoAcceptMaxGap: true,
    autoAcceptMaxCycleLength: true,
    autoAcceptRegions: true,
  } as const;

  const isGraded = proposal.isGraded ?? false;

  const [haveListings, wantListings] = isGraded
    ? await Promise.all([
        db.gradedHaveListing.findMany({ where: { id: { in: haveIds } }, select: selectFields }),
        db.gradedWantListing.findMany({ where: { id: { in: wantIds } }, select: selectFields }),
      ])
    : await Promise.all([
        db.haveListing.findMany({ where: { id: { in: haveIds } }, select: selectFields }),
        db.wantListing.findMany({ where: { id: { in: wantIds } }, select: selectFields }),
      ]);

  const constraints = new Map<string, AutoAcceptConstraint>();
  for (const listing of [...haveListings, ...wantListings]) {
    constraints.set(listing.id, {
      autoAccept: listing.autoAccept,
      autoAcceptMaxGap: listing.autoAcceptMaxGap,
      autoAcceptMaxCycleLength: listing.autoAcceptMaxCycleLength,
      autoAcceptRegions: listing.autoAcceptRegions,
    });
  }

  return constraints;
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
