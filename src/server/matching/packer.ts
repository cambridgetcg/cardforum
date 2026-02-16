/**
 * Optimal Packer — Selects non-overlapping proposals to maximize total score
 *
 * Uses branch-and-bound with greedy fallback for weighted set packing.
 * Two proposals conflict if they share a haveListingId, wantListingId,
 * or userId, since each listing/user can only participate in one trade at a time.
 *
 * The branch-and-bound solver tries to beat the greedy baseline within a
 * time budget. If the search space is too large, it returns the greedy result.
 */

import type { BridgeProposal } from "./bridge-builder";

export interface PackResult {
  packed: BridgeProposal[];
  excluded: BridgeProposal[];
}

const MAX_PACK_TIME_MS = 2000; // 2 second time budget for branch-and-bound
const MAX_NODES_EXPLORED = 50_000; // cap on search nodes to prevent runaway

/**
 * Check if a proposal conflicts with a set of already-used IDs.
 */
function hasConflict(
  proposal: BridgeProposal,
  usedListingIds: Set<string>,
  usedUserIds: Set<string>,
): boolean {
  // Check user conflicts (cross-pool dedup — M8)
  for (const userId of proposal.userIds) {
    if (usedUserIds.has(userId)) return true;
  }
  // Check listing conflicts
  for (const leg of proposal.legs) {
    if (usedListingIds.has(leg.haveListingId) || usedListingIds.has(leg.wantListingId)) {
      return true;
    }
  }
  return false;
}

/**
 * Consume a proposal's IDs into the used sets.
 */
function consume(
  proposal: BridgeProposal,
  usedListingIds: Set<string>,
  usedUserIds: Set<string>,
): void {
  for (const leg of proposal.legs) {
    usedListingIds.add(leg.haveListingId);
    usedListingIds.add(leg.wantListingId);
  }
  for (const userId of proposal.userIds) {
    usedUserIds.add(userId);
  }
}

/**
 * Greedy packing: iterate in score order, take if no conflict.
 * Always produces a valid solution. Used as baseline for branch-and-bound.
 */
function greedyPack(
  proposals: BridgeProposal[],
  maxPacked: number,
): { packed: BridgeProposal[]; totalScore: number } {
  const usedListingIds = new Set<string>();
  const usedUserIds = new Set<string>();
  const packed: BridgeProposal[] = [];
  let totalScore = 0;

  for (const proposal of proposals) {
    if (packed.length >= maxPacked) break;
    if (!hasConflict(proposal, usedListingIds, usedUserIds)) {
      consume(proposal, usedListingIds, usedUserIds);
      packed.push(proposal);
      totalScore += proposal.score;
    }
  }

  return { packed, totalScore };
}

/**
 * Branch-and-bound packing: try to find optimal selection within time budget.
 *
 * Explores the decision tree (include/exclude each proposal) with pruning:
 * - Skip proposals that conflict with current selection
 * - Prune branches where remaining upper bound can't beat current best
 * - Time-bounded to prevent cron timeout
 */
function branchAndBoundPack(
  proposals: BridgeProposal[],
  maxPacked: number,
  greedyScore: number,
): { packed: BridgeProposal[]; totalScore: number } | null {
  // Pre-compute suffix sums for upper bound pruning
  const suffixScoreSum = new Array<number>(proposals.length + 1);
  suffixScoreSum[proposals.length] = 0;
  for (let i = proposals.length - 1; i >= 0; i--) {
    suffixScoreSum[i] = suffixScoreSum[i + 1] + proposals[i].score;
  }

  const startTime = Date.now();
  let nodesExplored = 0;
  let bestScore = greedyScore;
  let bestPacked: BridgeProposal[] | null = null;

  function search(
    index: number,
    currentPacked: BridgeProposal[],
    currentScore: number,
    usedListingIds: Set<string>,
    usedUserIds: Set<string>,
  ): void {
    nodesExplored++;

    // Time/node budget check
    if (nodesExplored > MAX_NODES_EXPLORED) return;
    if (nodesExplored % 1000 === 0 && Date.now() - startTime > MAX_PACK_TIME_MS) return;

    // Prune: even if we took all remaining proposals, can't beat best
    if (currentScore + suffixScoreSum[index] <= bestScore) return;

    // Base case: end of proposals
    if (index >= proposals.length || currentPacked.length >= maxPacked) {
      if (currentScore > bestScore) {
        bestScore = currentScore;
        bestPacked = [...currentPacked];
      }
      return;
    }

    const proposal = proposals[index];

    // Branch 1: try including this proposal (if no conflict)
    if (!hasConflict(proposal, usedListingIds, usedUserIds)) {
      consume(proposal, usedListingIds, usedUserIds);
      currentPacked.push(proposal);

      search(index + 1, currentPacked, currentScore + proposal.score, usedListingIds, usedUserIds);

      // Undo
      currentPacked.pop();
      for (const leg of proposal.legs) {
        usedListingIds.delete(leg.haveListingId);
        usedListingIds.delete(leg.wantListingId);
      }
      for (const userId of proposal.userIds) {
        usedUserIds.delete(userId);
      }
    }

    // Branch 2: skip this proposal
    search(index + 1, currentPacked, currentScore, usedListingIds, usedUserIds);
  }

  search(0, [], 0, new Set(), new Set());
  return bestPacked ? { packed: bestPacked, totalScore: bestScore } : null;
}

/**
 * Pack non-overlapping proposals optimally.
 *
 * Strategy: greedy baseline, then branch-and-bound within time budget.
 * If B&B finds a better solution, use it. Otherwise, use greedy.
 *
 * Also enforces user-level deduplication (M8): same user can't appear
 * in proposals across different pools (raw, graded, sealed).
 */
export function packProposals(proposals: BridgeProposal[], maxPacked = 50): PackResult {
  // Sort by score descending (ensures greedy picks best-first)
  const sorted = [...proposals].sort((a, b) => b.score - a.score);

  // Greedy baseline (always fast, always correct)
  const greedy = greedyPack(sorted, maxPacked);

  // For small inputs, greedy is likely optimal
  let bestPacked = greedy.packed;
  if (sorted.length > greedy.packed.length + 2 && sorted.length <= 200) {
    // Try branch-and-bound to beat greedy
    const bnb = branchAndBoundPack(sorted, maxPacked, greedy.totalScore);
    if (bnb && bnb.totalScore > greedy.totalScore) {
      bestPacked = bnb.packed;
    }
  }

  // Build excluded list
  const packedProposalSet = new Set(bestPacked);
  const excluded = sorted.filter((p) => !packedProposalSet.has(p));

  return { packed: bestPacked, excluded };
}
