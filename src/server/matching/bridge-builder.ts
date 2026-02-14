/**
 * Bridge Builder — Converts cycles into trade proposals
 *
 * Takes cycles found by the cycle-finder and constructs
 * MatchProposals with local-only TradeLeg assignments.
 */

import type { Cycle, ListingEdge } from "./cycle-finder";
import { scoreProposal } from "./scorer";

export interface BridgeProposal {
  cycle: Cycle;
  legs: BridgeLeg[];
  score: number;
  userIds: string[];
}

export interface BridgeLeg {
  fromUserId: string;
  toUserId: string;
  cardId: string;
  region: string;
  haveListingId: string;
  wantListingId: string;
  condition: string;
  sequence: number;
}

/**
 * Build bridge proposals from detected cycles.
 * Prioritizes fully-local cycles, then scores and ranks.
 */
export function buildBridges(cycles: Cycle[]): BridgeProposal[] {
  const proposals: BridgeProposal[] = [];

  for (const cycle of cycles) {
    const legs = buildLegs(cycle.edges);
    const userIds = [...new Set(cycle.edges.map((e) => e.haveUserId))];

    const proposal: BridgeProposal = {
      cycle,
      legs,
      score: 0,
      userIds,
    };
    proposal.score = scoreProposal(proposal);
    proposals.push(proposal);
  }

  proposals.sort((a, b) => b.score - a.score);
  return proposals;
}

function buildLegs(edges: ListingEdge[]): BridgeLeg[] {
  return edges.map((edge, i) => ({
    fromUserId: edge.haveUserId,
    toUserId: edge.wantUserId,
    cardId: edge.cardId,
    region: edge.haveRegion,
    haveListingId: edge.haveListingId,
    wantListingId: edge.wantListingId,
    condition: edge.condition,
    sequence: i,
  }));
}
