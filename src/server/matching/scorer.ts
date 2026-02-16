/**
 * Match Quality Scorer
 *
 * Scores bridge proposals based on:
 *   - Cycle length (fewer legs = better)
 *   - Region locality (fully local = big bonus)
 *   - Condition quality (NM > LP > MP...)
 */

import type { BridgeProposal } from "./bridge-builder";
import { getConfig } from "@/server/services/config.service";
import { getBatchTrustScores } from "@/server/services/trust-profile.service";

const DEFAULT_WEIGHTS = {
  baseScore: 100,
  cycleLengthPenalty: -10,
  fullyLocalBonus: 30,
  fewRegionsBonus: 15,
  conditionBonus: { NM: 5, LP: 4, MP: 3, HP: 2, DMG: 1 } as Record<string, number>,
  valueBalanceBonus: 20, // max bonus when cards are perfectly equal in value
  regionalImbalancePenalty: -25, // penalty for cross-region value flow
  chainBonus: 10, // chains are more robust than cycles
  gradeMatchBonus: 5, // graded cards with exact same company+grade are highly fungible
};

type ScorerWeights = typeof DEFAULT_WEIGHTS;

/**
 * Score a bridge proposal. Higher is better.
 */
export async function scoreProposal(proposal: BridgeProposal): Promise<number> {
  const raw = await getConfig("matching.scorer_weights");
  const WEIGHTS = { ...DEFAULT_WEIGHTS, ...raw } as ScorerWeights;
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

  // Value balance: smaller total settlement = better (cards closer in value)
  const totalSettlement = [...proposal.settlements.values()]
    .reduce((sum, v) => sum + Math.abs(v), 0) / 2; // divide by 2 since zero-sum doubles
  const avgAskPrice = proposal.legs.reduce((s, l) => s + l.askPrice, 0) / proposal.legs.length;
  if (avgAskPrice > 0) {
    const balanceRatio = 1 - Math.min(totalSettlement / avgAskPrice, 1);
    score += WEIGHTS.valueBalanceBonus * balanceRatio;
  }

  // Regional imbalance: penalize proposals that require cross-region payment flow
  if (proposal.regionalBalance && avgAskPrice > 0) {
    const imbalanceRatio = Math.min(
      proposal.regionalBalance.totalImbalance / (avgAskPrice * proposal.legs.length),
      1,
    );
    score += WEIGHTS.regionalImbalancePenalty * imbalanceRatio;
  }

  // Chains get a bonus — sequential execution means individual leg failure doesn't cascade
  if (proposal.isChain) {
    score += WEIGHTS.chainBonus;
  }

  // Graded proposals where all legs share the same grading company get a fungibility bonus
  if (proposal.isGraded) {
    const companies = new Set(proposal.legs.map((l) => l.condition.split("-")[0]));
    if (companies.size === 1) {
      score += WEIGHTS.gradeMatchBonus;
    }
  }

  // Trust bonus (Loop 6): higher-trust participants get a small scoring bump
  const trustBonusWeight = await getConfig("matching.trust_bonus_weight");
  if (trustBonusWeight > 0 && proposal.userIds.length > 0) {
    const trustScores = await getBatchTrustScores(proposal.userIds);
    const avgTrust = [...trustScores.values()].reduce((s, v) => s + v, 0) / trustScores.size;
    score += avgTrust * trustBonusWeight;
  }

  return Math.max(0, score);
}

/**
 * Score and sort proposals, returning the best matches first.
 */
export async function rankProposals(proposals: BridgeProposal[]): Promise<BridgeProposal[]> {
  const scored = await Promise.all(
    proposals.map(async (p) => ({ ...p, score: await scoreProposal(p) })),
  );
  return scored.sort((a, b) => b.score - a.score);
}
