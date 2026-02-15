/**
 * Chain Finder — Altruistic chains seeded by authenticator inventory
 *
 * Unlike cycles (closed loops), chains are open paths that start from an
 * authenticator's inventory item. An authenticator with stock can seed a
 * match that wouldn't otherwise exist: they provide the first card, and
 * subsequent legs follow normal have→want edges.
 *
 * Chains don't need to close — they terminate when no further edges exist,
 * or when they reach another authenticator who wants the final card.
 */

import type { ListingEdge, Cycle } from "./cycle-finder";
import {
  computeSettlements,
  computeRegionalBalance,
  type BridgeProposal,
  type BridgeLeg,
} from "./bridge-builder";
import { scoreProposal } from "./scorer";

export interface ChainAnchor {
  inventoryId: string;
  authenticatorId: string;
  cardId: string;
  condition: string;
  region: string;
  askPrice: number; // cents
}

export interface Chain {
  anchor: ChainAnchor;
  edges: ListingEdge[];
  length: number; // number of edges (legs)
  regions: string[];
  isFullyLocal: boolean;
  terminatesAtAuthenticator: boolean;
}

const MAX_CHAIN_DEPTH = 6;

/**
 * Find altruistic chains starting from authenticator inventory anchors.
 *
 * For each anchor, DFS through the edge graph from users who want the
 * anchor's card, following have→want edges up to MAX_CHAIN_DEPTH.
 */
export function findChains(
  anchors: ChainAnchor[],
  edges: ListingEdge[],
  authenticatorWantCardIds: Set<string>,
): Chain[] {
  if (anchors.length === 0 || edges.length === 0) return [];

  // Build adjacency: userId → outgoing edges (have→want)
  const adj = new Map<string, ListingEdge[]>();
  for (const edge of edges) {
    const list = adj.get(edge.haveUserId) ?? [];
    list.push(edge);
    adj.set(edge.haveUserId, list);
  }

  // For each anchor, find edges where someone wants the anchor's card
  // (the anchor provides the card, so we look for wantUsers of that card)
  const wantEdgesByCard = new Map<string, ListingEdge[]>();
  for (const edge of edges) {
    const list = wantEdgesByCard.get(edge.cardId) ?? [];
    list.push(edge);
    wantEdgesByCard.set(edge.cardId, list);
  }

  const chains: Chain[] = [];

  for (const anchor of anchors) {
    // Find users who want the anchor's card (these become the first "recipients")
    const firstEdges = wantEdgesByCard.get(anchor.cardId) ?? [];

    for (const firstEdge of firstEdges) {
      // The want user receives the anchor's card; now follow their have edges
      const recipient = firstEdge.wantUserId;
      const visited = new Set<string>([recipient]);

      chainDfs(
        anchor,
        recipient,
        [firstEdge],
        visited,
        adj,
        authenticatorWantCardIds,
        chains,
      );
    }
  }

  return chains;
}

function chainDfs(
  anchor: ChainAnchor,
  currentUser: string,
  path: ListingEdge[],
  visited: Set<string>,
  adj: Map<string, ListingEdge[]>,
  authenticatorWantCardIds: Set<string>,
  chains: Chain[],
): void {
  // Record chain if length >= 1 (at least one real leg beyond the anchor)
  if (path.length >= 1) {
    const lastEdge = path[path.length - 1];
    const lastCardId = lastEdge.cardId;
    const terminatesAtAuthenticator = authenticatorWantCardIds.has(lastCardId);

    const regions = collectChainRegions(anchor, path);
    chains.push({
      anchor,
      edges: [...path],
      length: path.length,
      regions,
      isFullyLocal: regions.length === 1,
      terminatesAtAuthenticator,
    });
  }

  if (path.length >= MAX_CHAIN_DEPTH) return;

  const outEdges = adj.get(currentUser);
  if (!outEdges) return;

  for (const edge of outEdges) {
    if (edge.bidPrice < edge.askPrice) continue;
    if (path.some((e) => e.haveListingId === edge.haveListingId)) continue;

    const nextUser = edge.wantUserId;
    if (visited.has(nextUser)) continue;

    visited.add(nextUser);
    chainDfs(anchor, nextUser, [...path, edge], visited, adj, authenticatorWantCardIds, chains);
    visited.delete(nextUser);
  }
}

function collectChainRegions(anchor: ChainAnchor, edges: ListingEdge[]): string[] {
  const regions = new Set<string>();
  regions.add(anchor.region);
  for (const e of edges) {
    regions.add(e.haveRegion);
    regions.add(e.wantRegion);
  }
  return [...regions];
}

/**
 * Convert a chain into a BridgeProposal for unified scoring and packing.
 *
 * The anchor leg (authenticator → first recipient) is synthesized as leg 0.
 * Subsequent legs come from the chain's edges.
 */
export function chainToProposal(chain: Chain): BridgeProposal {
  const firstEdge = chain.edges[0];

  // Leg 0: authenticator provides the anchor card
  const anchorLeg: BridgeLeg = {
    fromUserId: chain.anchor.authenticatorId,
    toUserId: firstEdge.wantUserId,
    cardId: chain.anchor.cardId,
    region: chain.anchor.region,
    haveListingId: chain.anchor.inventoryId, // inventory item acts as the "have listing"
    wantListingId: firstEdge.wantListingId,
    condition: chain.anchor.condition,
    askPrice: chain.anchor.askPrice,
    sequence: 0,
  };

  // Remaining legs from chain edges (offset sequence by 1)
  const edgeLegs: BridgeLeg[] = chain.edges.map((edge, i) => ({
    fromUserId: edge.haveUserId,
    toUserId: edge.wantUserId,
    cardId: edge.cardId,
    region: edge.haveRegion,
    haveListingId: edge.haveListingId,
    wantListingId: edge.wantListingId,
    condition: edge.condition,
    askPrice: edge.askPrice,
    sequence: i + 1,
  }));

  const legs = [anchorLeg, ...edgeLegs];
  const userIds = [...new Set(legs.flatMap((l) => [l.fromUserId, l.toUserId]))];
  const settlements = computeSettlements(legs);

  const userRegions = new Map<string, string>();
  userRegions.set(chain.anchor.authenticatorId, chain.anchor.region);
  for (const edge of chain.edges) {
    userRegions.set(edge.haveUserId, edge.haveRegion);
    userRegions.set(edge.wantUserId, edge.wantRegion);
  }

  const regionalBalance = computeRegionalBalance(settlements, userRegions);

  // Use a synthetic Cycle for compatibility with the scoring/packing pipeline
  const cycle: Cycle = {
    edges: chain.edges,
    length: legs.length,
    regions: chain.regions,
    isFullyLocal: chain.isFullyLocal,
  };

  const proposal: BridgeProposal = {
    cycle,
    legs,
    score: 0,
    userIds,
    settlements,
    regionalBalance,
    isChain: true,
  };
  proposal.score = scoreProposal(proposal);

  return proposal;
}
