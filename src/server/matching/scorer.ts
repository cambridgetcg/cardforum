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
import { getCustomsZone } from "@/lib/constants";

const DEFAULT_WEIGHTS = {
  baseScore: 100,
  cycleLengthPenalty: -10,
  fullyLocalBonus: 30,
  fewRegionsBonus: 15,
  conditionBonus: { NM: 5, LP: 4, MP: 3, HP: 2, DMG: 1 } as Record<string, number>,
  valueBalanceBonus: 60, // max bonus when cards are perfectly equal in value (netting moat)
  settlementSizePenalty: -40, // max penalty for large settlement relative to trade value
  regionalImbalancePenalty: -60, // penalty for cross-region value flow
  chainBonus: 10, // chains are more robust than cycles
  gradeMatchBonus: 5, // graded cards with exact same company+grade are highly fungible
  dmmPriorityBonus: 15, // proposals involving DMM liquidity get priority
  swapPreferenceBonus: 50, // bonus when all participants prefer balanced swaps
  shippingCostPenalty: -20, // max penalty for high estimated shipping costs
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
  // This is the PRIMARY moat signal — equal-value swaps are fee-free under netting model
  const totalSettlement =
    [...proposal.settlements.values()].reduce((sum, v) => sum + Math.abs(v), 0) / 2; // divide by 2 since zero-sum doubles
  const totalValue = proposal.legs.reduce((s, l) => s + l.askPrice, 0);
  const avgAskPrice = totalValue / proposal.legs.length;
  if (avgAskPrice > 0) {
    const balanceRatio = 1 - Math.min(totalSettlement / avgAskPrice, 1);
    score += WEIGHTS.valueBalanceBonus * balanceRatio;
  }

  // Settlement size penalty: large net settlements = more payment friction, worse UX
  if (totalValue > 0) {
    const settlementRatio = Math.min(totalSettlement / totalValue, 1);
    score += WEIGHTS.settlementSizePenalty * settlementRatio;
  }

  // Regional imbalance: penalize proposals that require cross-region payment flow
  if (proposal.regionalBalance && avgAskPrice > 0) {
    const imbalanceRatio = Math.min(
      proposal.regionalBalance.totalImbalance / (avgAskPrice * proposal.legs.length),
      1,
    );
    score += WEIGHTS.regionalImbalancePenalty * imbalanceRatio;
  }

  // Shipping cost estimate: penalize proposals with high total shipping
  if (proposal.legs.length > 0) {
    const totalShipping = proposal.legs.reduce(
      (sum, leg) =>
        sum +
        estimateShippingCost(
          leg.region,
          proposal.legs.find((l) => l.toUserId === leg.fromUserId)?.region ?? leg.region,
        ),
      0,
    );
    const avgShipping = totalShipping / proposal.legs.length;
    // Normalize: local ~$8 (800c), international ~$30 (3000c). Scale to 0-1.
    const shippingRatio = Math.min(avgShipping / 3000, 1);
    score += WEIGHTS.shippingCostPenalty * shippingRatio;
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

  // DMM priority: proposals that include DMM listings get a scoring bonus
  if (proposal.hasDMM) {
    score += WEIGHTS.dmmPriorityBonus;
  }

  // Swap preference: when all participants opted for balanced swaps, big bonus
  if (proposal.allPreferBalancedSwap) {
    score += WEIGHTS.swapPreferenceBonus;
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

/**
 * Estimate shipping cost in cents between two regions.
 * Uses customs zone proximity as a proxy. Region strings may be
 * "City, CC" format or country codes — extract CC from the end.
 */
function estimateShippingCost(fromRegion: string, toRegion: string): number {
  if (fromRegion === toRegion) return 800; // ~$8 same city/region

  const fromCC = extractCountryCode(fromRegion);
  const toCC = extractCountryCode(toRegion);

  if (fromCC === toCC) return 1000; // ~$10 same country, different region
  if (getCustomsZone(fromCC) === getCustomsZone(toCC)) return 1500; // ~$15 same customs zone (e.g. EU)
  return 3000; // ~$30 international (different customs zones)
}

function extractCountryCode(region: string): string {
  // Region may be "Tokyo, JP" or "JP" or "Tokyo, Japan"
  const parts = region.split(",").map((s) => s.trim());
  const last = parts[parts.length - 1];
  // If last part is 2 chars, it's a country code
  if (last.length === 2) return last.toUpperCase();
  return region.toUpperCase();
}
