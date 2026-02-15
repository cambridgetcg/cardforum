/**
 * Matching Engine Ports — Strategy interfaces for the matching pipeline.
 *
 * The matching pipeline has 4 stages: find → score → pack → persist.
 * Each stage is defined by an interface so implementations can be swapped
 * (e.g. different scoring weights, packing algorithms, depth limits).
 */

import type { ListingEdge, Cycle } from "@/server/matching/cycle-finder";
import type { ChainAnchor, Chain } from "@/server/matching/chain-finder";
import type { BridgeProposal } from "@/server/matching/bridge-builder";
import type { PackResult } from "@/server/matching/packer";

// ─── Configuration ───────────────────────────────────

export interface MatchingConfig {
  maxCycleDepth: number;
  maxChainDepth: number;
  maxPacked: number;
  proposalExpiryDays: number;
  scorerWeights: ScorerWeights;
}

export interface ScorerWeights {
  baseScore: number;
  cycleLengthPenalty: number;
  fullyLocalBonus: number;
  fewRegionsBonus: number;
  conditionBonus: Record<string, number>;
  valueBalanceBonus: number;
  regionalImbalancePenalty: number;
  chainBonus: number;
  gradeMatchBonus: number;
}

export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  maxCycleDepth: 6,
  maxChainDepth: 6,
  maxPacked: 50,
  proposalExpiryDays: 7,
  scorerWeights: {
    baseScore: 100,
    cycleLengthPenalty: -10,
    fullyLocalBonus: 30,
    fewRegionsBonus: 15,
    conditionBonus: { NM: 5, LP: 4, MP: 3, HP: 2, DMG: 1 },
    valueBalanceBonus: 20,
    regionalImbalancePenalty: -25,
    chainBonus: 10,
    gradeMatchBonus: 5,
  },
};

// ─── Strategy Interfaces ─────────────────────────────

/** Finds cycles in the listing graph */
export interface IMatchFinder {
  findCycles(edges: ListingEdge[], config: MatchingConfig): Cycle[];
  findChains(
    anchors: ChainAnchor[],
    edges: ListingEdge[],
    authenticatorWantCardIds: Set<string>,
    config: MatchingConfig,
  ): Chain[];
}

/** Scores and ranks bridge proposals */
export interface IMatchScorer {
  scoreProposal(proposal: BridgeProposal, weights: ScorerWeights): number;
  rankProposals(proposals: BridgeProposal[], weights: ScorerWeights): BridgeProposal[];
}

/** Packs non-overlapping proposals from ranked set */
export interface IMatchPacker {
  packProposals(proposals: BridgeProposal[], maxPacked: number): PackResult;
}
