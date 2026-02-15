/**
 * Greedy Packer — Selects non-overlapping proposals
 *
 * Given scored proposals (sorted best-first), greedily picks proposals
 * that don't conflict on any listing. Two proposals conflict if they
 * share a haveListingId or wantListingId, since each listing can only
 * participate in one trade at a time.
 */

import type { BridgeProposal } from "./bridge-builder";

export interface PackResult {
  packed: BridgeProposal[];
  excluded: BridgeProposal[];
}

/**
 * Pack non-overlapping proposals greedily by score (descending).
 *
 * For each proposal in score order, check whether any of its listing IDs
 * have already been consumed by a higher-scoring proposal. If not, include
 * it and mark all its listings as consumed.
 */
export function packProposals(
  proposals: BridgeProposal[],
  maxPacked = 50,
): PackResult {
  const usedHaveIds = new Set<string>();
  const usedWantIds = new Set<string>();
  const packed: BridgeProposal[] = [];
  const excluded: BridgeProposal[] = [];

  for (const proposal of proposals) {
    if (packed.length >= maxPacked) {
      excluded.push(proposal);
      continue;
    }

    const hasConflict = proposal.legs.some(
      (leg) => usedHaveIds.has(leg.haveListingId) || usedWantIds.has(leg.wantListingId),
    );

    if (hasConflict) {
      excluded.push(proposal);
      continue;
    }

    // Consume all listings in this proposal
    for (const leg of proposal.legs) {
      usedHaveIds.add(leg.haveListingId);
      usedWantIds.add(leg.wantListingId);
    }
    packed.push(proposal);
  }

  return { packed, excluded };
}
