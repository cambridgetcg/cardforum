/**
 * Match Quality Scorer
 *
 * Scores bridge proposals based on:
 *   - Cycle length (fewer legs = better)
 *   - Region locality (all same region = bonus)
 *   - Condition match accuracy
 *   - User ratings
 */

import type { BridgeProposal } from "./bridge-builder";

const WEIGHTS = {
  cycleLengthPenalty: -10,
  sameRegionBonus: 20,
  conditionMatchBonus: 15,
  baseScore: 100,
};

/**
 * Score a bridge proposal. Higher is better.
 */
export function scoreProposal(proposal: BridgeProposal): number {
  let score = WEIGHTS.baseScore;

  // Shorter cycles are better
  score += proposal.cycle.length * WEIGHTS.cycleLengthPenalty;

  // All legs in same region is ideal
  const uniqueRegions = new Set(proposal.cycle.regions);
  if (uniqueRegions.size === 1) {
    score += WEIGHTS.sameRegionBonus;
  }

  return Math.max(0, score);
}

/**
 * Score and sort proposals, returning the best matches first.
 */
export function rankProposals(proposals: BridgeProposal[]): BridgeProposal[] {
  return proposals
    .map((p) => ({ ...p, score: scoreProposal(p) }))
    .sort((a, b) => b.score - a.score);
}
