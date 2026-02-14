/**
 * Bridge Builder — Converts cycles into trade proposals
 *
 * Takes cycles found by the cycle-finder and constructs
 * MatchProposals with local-only TradeLeg assignments.
 *
 * Key constraint: every leg must be same-region (local delivery).
 */

import type { Cycle } from "./cycle-finder";

export interface BridgeProposal {
  cycle: Cycle;
  legs: {
    fromUserId: string;
    toUserId: string;
    cardId: string;
    region: string;
    haveListingId: string;
    wantListingId: string;
    sequence: number;
  }[];
  score: number;
}

/**
 * Build bridge proposals from detected cycles.
 * Ensures all legs are local (same region).
 */
export function buildBridges(cycles: Cycle[]): BridgeProposal[] {
  // TODO: Implement bridge construction
  // 1. For each cycle, verify all legs are local
  // 2. Construct leg assignments with sequence numbers
  // 3. Score each proposal
  // 4. Return sorted by score (highest first)
  void cycles;
  return [];
}
