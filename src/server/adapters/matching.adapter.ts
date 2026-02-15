/**
 * Default Matching Adapter — Wraps the existing matching algorithms
 * behind the strategy interfaces defined in matching.port.ts.
 *
 * This adapter delegates to the existing cycle-finder, scorer, and packer
 * implementations, passing config parameters through instead of using hardcoded values.
 */

import type {
  IMatchFinder,
  IMatchScorer,
  IMatchPacker,
  MatchingConfig,
  ScorerWeights,
} from "@/server/ports/matching.port";
import type { ListingEdge, Cycle } from "@/server/matching/cycle-finder";
import type { ChainAnchor, Chain } from "@/server/matching/chain-finder";
import type { BridgeProposal } from "@/server/matching/bridge-builder";
import type { PackResult } from "@/server/matching/packer";

// ─── Finder ──────────────────────────────────────────

export class DefaultMatchFinder implements IMatchFinder {
  findCycles(edges: ListingEdge[], config: MatchingConfig): Cycle[] {
    if (edges.length === 0) return [];

    const adj = new Map<string, ListingEdge[]>();
    for (const edge of edges) {
      const list = adj.get(edge.haveUserId) ?? [];
      list.push(edge);
      adj.set(edge.haveUserId, list);
    }

    const cycles: Cycle[] = [];
    const seen = new Set<string>();
    const userIds = new Set<string>();
    for (const edge of edges) {
      userIds.add(edge.haveUserId);
      userIds.add(edge.wantUserId);
    }

    for (const startUser of userIds) {
      if (!adj.has(startUser)) continue;
      this.dfs(startUser, startUser, [], new Set([startUser]), adj, cycles, seen, config.maxCycleDepth);
    }

    return cycles;
  }

  private dfs(
    startUser: string,
    currentUser: string,
    path: ListingEdge[],
    visited: Set<string>,
    adj: Map<string, ListingEdge[]>,
    cycles: Cycle[],
    seen: Set<string>,
    maxDepth: number,
  ): void {
    if (path.length >= maxDepth) return;

    const outEdges = adj.get(currentUser);
    if (!outEdges) return;

    for (const edge of outEdges) {
      if (edge.bidPrice < edge.askPrice) continue;
      if (path.some((e) => e.haveListingId === edge.haveListingId)) continue;

      const nextUser = edge.wantUserId;

      if (nextUser === startUser && path.length >= 1) {
        const cyclePath = [...path, edge];
        const key = cyclePath.map((e) => `${e.haveListingId}:${e.wantListingId}`).sort().join("|");
        if (!seen.has(key)) {
          seen.add(key);
          const regions = [...new Set(cyclePath.flatMap((e) => [e.haveRegion, e.wantRegion]))];
          cycles.push({
            edges: cyclePath,
            length: cyclePath.length,
            regions,
            isFullyLocal: cyclePath.every((e) => e.haveRegion === e.wantRegion),
          });
        }
        continue;
      }

      if (!visited.has(nextUser)) {
        visited.add(nextUser);
        this.dfs(startUser, nextUser, [...path, edge], visited, adj, cycles, seen, maxDepth);
        visited.delete(nextUser);
      }
    }
  }

  findChains(
    anchors: ChainAnchor[],
    edges: ListingEdge[],
    authenticatorWantCardIds: Set<string>,
    config: MatchingConfig,
  ): Chain[] {
    if (anchors.length === 0 || edges.length === 0) return [];

    const adj = new Map<string, ListingEdge[]>();
    for (const edge of edges) {
      const list = adj.get(edge.haveUserId) ?? [];
      list.push(edge);
      adj.set(edge.haveUserId, list);
    }

    const wantEdgesByCard = new Map<string, ListingEdge[]>();
    for (const edge of edges) {
      const list = wantEdgesByCard.get(edge.cardId) ?? [];
      list.push(edge);
      wantEdgesByCard.set(edge.cardId, list);
    }

    const chains: Chain[] = [];
    for (const anchor of anchors) {
      const firstEdges = wantEdgesByCard.get(anchor.cardId) ?? [];
      for (const firstEdge of firstEdges) {
        const recipient = firstEdge.wantUserId;
        this.chainDfs(anchor, recipient, [firstEdge], new Set([recipient]), adj, authenticatorWantCardIds, chains, config.maxChainDepth);
      }
    }

    return chains;
  }

  private chainDfs(
    anchor: ChainAnchor,
    currentUser: string,
    path: ListingEdge[],
    visited: Set<string>,
    adj: Map<string, ListingEdge[]>,
    authenticatorWantCardIds: Set<string>,
    chains: Chain[],
    maxDepth: number,
  ): void {
    if (path.length >= 1) {
      const lastEdge = path[path.length - 1];
      const regions = [anchor.region, ...new Set(path.flatMap((e) => [e.haveRegion, e.wantRegion]))];
      const uniqueRegions = [...new Set(regions)];
      chains.push({
        anchor,
        edges: [...path],
        length: path.length,
        regions: uniqueRegions,
        isFullyLocal: uniqueRegions.length === 1,
        terminatesAtAuthenticator: authenticatorWantCardIds.has(lastEdge.cardId),
      });
    }

    if (path.length >= maxDepth) return;

    const outEdges = adj.get(currentUser);
    if (!outEdges) return;

    for (const edge of outEdges) {
      if (edge.bidPrice < edge.askPrice) continue;
      if (path.some((e) => e.haveListingId === edge.haveListingId)) continue;
      const nextUser = edge.wantUserId;
      if (visited.has(nextUser)) continue;

      visited.add(nextUser);
      this.chainDfs(anchor, nextUser, [...path, edge], visited, adj, authenticatorWantCardIds, chains, maxDepth);
      visited.delete(nextUser);
    }
  }
}

// ─── Scorer ──────────────────────────────────────────

export class DefaultMatchScorer implements IMatchScorer {
  scoreProposal(proposal: BridgeProposal, weights: ScorerWeights): number {
    let score = weights.baseScore;

    score += proposal.cycle.length * weights.cycleLengthPenalty;

    if (proposal.cycle.isFullyLocal) {
      score += weights.fullyLocalBonus;
    } else {
      const uniqueRegions = new Set(proposal.cycle.regions).size;
      if (uniqueRegions <= 2) score += weights.fewRegionsBonus;
    }

    for (const leg of proposal.legs) {
      score += weights.conditionBonus[leg.condition] ?? 0;
    }

    const totalSettlement = [...proposal.settlements.values()]
      .reduce((sum, v) => sum + Math.abs(v), 0) / 2;
    const avgAskPrice = proposal.legs.reduce((s, l) => s + l.askPrice, 0) / proposal.legs.length;
    if (avgAskPrice > 0) {
      const balanceRatio = 1 - Math.min(totalSettlement / avgAskPrice, 1);
      score += weights.valueBalanceBonus * balanceRatio;
    }

    if (proposal.regionalBalance && avgAskPrice > 0) {
      const imbalanceRatio = Math.min(
        proposal.regionalBalance.totalImbalance / (avgAskPrice * proposal.legs.length),
        1,
      );
      score += weights.regionalImbalancePenalty * imbalanceRatio;
    }

    if (proposal.isChain) score += weights.chainBonus;

    if (proposal.isGraded) {
      const companies = new Set(proposal.legs.map((l) => l.condition.split("-")[0]));
      if (companies.size === 1) score += weights.gradeMatchBonus;
    }

    return Math.max(0, score);
  }

  rankProposals(proposals: BridgeProposal[], weights: ScorerWeights): BridgeProposal[] {
    return proposals
      .map((p) => ({ ...p, score: this.scoreProposal(p, weights) }))
      .sort((a, b) => b.score - a.score);
  }
}

// ─── Packer ──────────────────────────────────────────

export class DefaultMatchPacker implements IMatchPacker {
  packProposals(proposals: BridgeProposal[], maxPacked: number): PackResult {
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

      for (const leg of proposal.legs) {
        usedHaveIds.add(leg.haveListingId);
        usedWantIds.add(leg.wantListingId);
      }
      packed.push(proposal);
    }

    return { packed, excluded };
  }
}
