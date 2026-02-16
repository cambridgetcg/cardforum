/**
 * Bridge Builder — Converts cycles into trade proposals
 *
 * Takes cycles found by the cycle-finder and constructs
 * MatchProposals with local-only TradeLeg assignments.
 */

import type { Cycle, ListingEdge } from "./cycle-finder";
import { scoreProposal } from "./scorer";

export interface RegionalBalance {
  /** net cents per region (positive = region exports value, negative = imports) */
  perRegion: Map<string, number>;
  /** sum of absolute per-region nets — 0 means perfectly balanced */
  totalImbalance: number;
}

export interface BridgeProposal {
  cycle: Cycle;
  legs: BridgeLeg[];
  score: number;
  userIds: string[];
  settlements: Map<string, number>; // userId → net cents (positive = pays, negative = receives)
  regionalBalance: RegionalBalance;
  isChain?: boolean;
  isGraded?: boolean;
  isSealed?: boolean;
  hasDMM?: boolean;
  allPreferBalancedSwap?: boolean;
  tradeMode?: "AUTHENTICATED" | "DIRECT";
}

export interface BridgeLeg {
  fromUserId: string;
  toUserId: string;
  cardId: string;
  region: string;
  language: string; // card language (EN, JP)
  haveListingId: string;
  wantListingId: string;
  condition: string;
  askPrice: number; // cents — transacted at the seller's ask price
  sequence: number;
}

/**
 * Build bridge proposals from detected cycles.
 * Prioritizes fully-local cycles, then scores and ranks.
 */
export async function buildBridges(cycles: Cycle[]): Promise<BridgeProposal[]> {
  const proposals: BridgeProposal[] = [];

  for (const cycle of cycles) {
    const legs = buildLegs(cycle.edges);
    const userIds = [...new Set(cycle.edges.map((e) => e.haveUserId))];
    const settlements = computeSettlements(legs);

    // Build userId → region map from cycle edges
    const userRegions = new Map<string, string>();
    for (const edge of cycle.edges) {
      userRegions.set(edge.haveUserId, edge.haveRegion);
      userRegions.set(edge.wantUserId, edge.wantRegion);
    }

    const regionalBalance = computeRegionalBalance(settlements, userRegions);

    const proposal: BridgeProposal = {
      cycle,
      legs,
      score: 0,
      userIds,
      settlements,
      regionalBalance,
      tradeMode: cycle.isFullyLocal ? "DIRECT" : "AUTHENTICATED",
    };
    proposal.score = await scoreProposal(proposal);
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
    language: edge.language,
    haveListingId: edge.haveListingId,
    wantListingId: edge.wantListingId,
    condition: edge.condition,
    askPrice: edge.askPrice,
    sequence: i,
  }));
}

/**
 * Compute net settlement for each user in the cycle.
 *
 * Each leg transacts at the askPrice (seller sets the price).
 * For each user: net = value of card received - value of card given.
 * Positive net = user pays the difference. Negative = user receives it.
 * Sum of all settlements = 0 (zero-sum across the cycle).
 */
export function computeSettlements(legs: BridgeLeg[]): Map<string, number> {
  const settlements = new Map<string, number>();

  for (const leg of legs) {
    // Sender gives a card worth leg.askPrice
    const senderNet = (settlements.get(leg.fromUserId) ?? 0) - leg.askPrice;
    settlements.set(leg.fromUserId, senderNet);

    // Receiver gets a card worth leg.askPrice
    const receiverNet = (settlements.get(leg.toUserId) ?? 0) + leg.askPrice;
    settlements.set(leg.toUserId, receiverNet);
  }

  return settlements;
}

/**
 * Compute per-region net settlement and total imbalance.
 *
 * Aggregates each user's settlement into their region. A perfectly balanced
 * trade has totalImbalance = 0, meaning no region is a net exporter/importer
 * of value (no international payment flow needed).
 */
export function computeRegionalBalance(
  settlements: Map<string, number>,
  userRegions: Map<string, string>,
): RegionalBalance {
  const perRegion = new Map<string, number>();

  for (const [userId, net] of settlements) {
    const region = userRegions.get(userId) ?? "unknown";
    perRegion.set(region, (perRegion.get(region) ?? 0) + net);
  }

  let totalImbalance = 0;
  for (const net of perRegion.values()) {
    totalImbalance += Math.abs(net);
  }

  return { perRegion, totalImbalance };
}

/**
 * Auto-accept constraint for a single listing.
 */
export interface AutoAcceptConstraint {
  autoAccept: boolean;
  autoAcceptMaxGap: number | null;
  autoAcceptMaxCycleLength: number | null;
  autoAcceptRegions: string[];
}

/**
 * Check whether a proposal is eligible for auto-acceptance.
 *
 * All listings in the proposal must have autoAccept enabled, and
 * the proposal must satisfy every participant's constraints.
 */
export function isAutoAcceptEligible(
  proposal: BridgeProposal,
  listingConstraints: Map<string, AutoAcceptConstraint>,
): boolean {
  for (const leg of proposal.legs) {
    const haveConstraint = listingConstraints.get(leg.haveListingId);
    const wantConstraint = listingConstraints.get(leg.wantListingId);

    // Both listings must opt in
    if (!haveConstraint?.autoAccept || !wantConstraint?.autoAccept) return false;

    // Check cycle length constraints
    for (const c of [haveConstraint, wantConstraint]) {
      if (
        c.autoAcceptMaxCycleLength != null &&
        proposal.cycle.length > c.autoAcceptMaxCycleLength
      ) {
        return false;
      }
    }

    // Check value gap constraints (per-user settlement must be within their max gap)
    for (const c of [haveConstraint, wantConstraint]) {
      if (c.autoAcceptMaxGap != null) {
        const userId = c === haveConstraint ? leg.fromUserId : leg.toUserId;
        const userNet = Math.abs(proposal.settlements.get(userId) ?? 0);
        if (userNet > c.autoAcceptMaxGap) return false;
      }
    }

    // Check region constraints
    for (const c of [haveConstraint, wantConstraint]) {
      if (c.autoAcceptRegions.length > 0) {
        const allRegionsAllowed = proposal.cycle.regions.every((r) =>
          c.autoAcceptRegions.includes(r),
        );
        if (!allRegionsAllowed) return false;
      }
    }
  }

  return true;
}
