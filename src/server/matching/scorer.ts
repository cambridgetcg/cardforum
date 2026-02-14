/**
 * Match Quality Scorer
 *
 * Scores bridge proposals based on:
 *   - Cycle length (fewer legs = better)
 *   - Region locality (fully local = big bonus)
 *   - Condition quality (NM > LP > MP...)
 */

import type { BridgeProposal } from "./bridge-builder";

const WEIGHTS = {
  baseScore: 100,
  cycleLengthPenalty: -10,
  fullyLocalBonus: 30,
  fewRegionsBonus: 15,
  conditionBonus: { NM: 5, LP: 4, MP: 3, HP: 2, DMG: 1 } as Record<string, number>,
};

/**
 * Score a bridge proposal. Higher is better.
 */
export function scoreProposal(proposal: BridgeProposal): number {
  let score = WEIGHTS.baseScore;

  // Shorter cycles are better (2-leg direct swap is ideal)
  score += proposal.cycle.length * WEIGHTS.cycleLengthPenalty;

  // Fully local is a huge bonus
  if (proposal.cycle.isFullyLocal) {
    score += WEIGHTS.fullyLocalBonus;
  } else {
    const uniqueRegions = new Set(proposal.cycle.regions).size;
    if (uniqueRegions <= 2) score += WEIGHTS.fewRegionsBonus;
  }

  // Better conditions = small bonus
  for (const leg of proposal.legs) {
    score += WEIGHTS.conditionBonus[leg.condition] ?? 0;
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
