/**
 * Cycle Finder — Core bridge matching algorithm
 *
 * Builds a directed graph where:
 *   - Nodes = users (identified by userId)
 *   - Edges = a user "has" card X and another user "wants" card X
 *
 * A cycle means: User A gives to User B, B gives to C, ..., N gives to A.
 * Each edge is a (haveListingId, wantListingId) pair for the same card.
 *
 * Uses bounded DFS to find cycles of max depth 6.
 * Each cycle represents a set of trades that can all be fulfilled.
 */

export interface ListingEdge {
  haveListingId: string;
  wantListingId: string;
  cardId: string;
  haveUserId: string;
  wantUserId: string;
  haveRegion: string;
  wantRegion: string;
  condition: string;
  askPrice: number; // cents — from HaveListing
  bidPrice: number; // cents — from WantListing
}

export interface Cycle {
  edges: ListingEdge[];
  length: number;
  regions: string[];
  isFullyLocal: boolean;
}

const MAX_CYCLE_DEPTH = 6;

/**
 * Build adjacency list from listing edges.
 * Key: userId who HAS a card -> edges where someone WANTs that card from them.
 */
function buildAdjacencyList(
  edges: ListingEdge[]
): Map<string, ListingEdge[]> {
  const adj = new Map<string, ListingEdge[]>();
  for (const edge of edges) {
    const list = adj.get(edge.haveUserId) ?? [];
    list.push(edge);
    adj.set(edge.haveUserId, list);
  }
  return adj;
}

/**
 * Find all cycles in the listing graph using bounded DFS.
 *
 * For each starting node, DFS up to MAX_CYCLE_DEPTH.
 * A cycle is detected when we reach the start node again.
 */
export function findCycles(edges: ListingEdge[]): Cycle[] {
  if (edges.length === 0) return [];

  const adj = buildAdjacencyList(edges);
  const cycles: Cycle[] = [];
  const seen = new Set<string>();

  const userIds = new Set<string>();
  for (const edge of edges) {
    userIds.add(edge.haveUserId);
    userIds.add(edge.wantUserId);
  }

  for (const startUser of userIds) {
    if (!adj.has(startUser)) continue;
    dfs(startUser, startUser, [], new Set([startUser]), adj, cycles, seen);
  }

  return cycles;
}

function dfs(
  startUser: string,
  currentUser: string,
  path: ListingEdge[],
  visited: Set<string>,
  adj: Map<string, ListingEdge[]>,
  cycles: Cycle[],
  seen: Set<string>
): void {
  if (path.length >= MAX_CYCLE_DEPTH) return;

  const outEdges = adj.get(currentUser);
  if (!outEdges) return;

  for (const edge of outEdges) {
    // Skip non-viable edges: buyer won't pay seller's price
    if (edge.bidPrice < edge.askPrice) continue;

    const nextUser = edge.wantUserId;

    // Don't reuse the same have listing in one cycle
    if (path.some((e) => e.haveListingId === edge.haveListingId)) continue;

    // Found a cycle back to start (need at least 2 edges for a real trade)
    if (nextUser === startUser && path.length >= 1) {
      const cyclePath = [...path, edge];
      const key = cyclePath
        .map((e) => `${e.haveListingId}:${e.wantListingId}`)
        .sort()
        .join("|");

      if (!seen.has(key)) {
        seen.add(key);
        const regions = collectRegions(cyclePath);
        cycles.push({
          edges: cyclePath,
          length: cyclePath.length,
          regions,
          isFullyLocal: isFullyLocal(cyclePath),
        });
      }
      continue;
    }

    if (!visited.has(nextUser)) {
      visited.add(nextUser);
      dfs(startUser, nextUser, [...path, edge], visited, adj, cycles, seen);
      visited.delete(nextUser);
    }
  }
}

function collectRegions(edges: ListingEdge[]): string[] {
  const regions = new Set<string>();
  for (const e of edges) {
    regions.add(e.haveRegion);
    regions.add(e.wantRegion);
  }
  return [...regions];
}

function isFullyLocal(edges: ListingEdge[]): boolean {
  return edges.every((e) => e.haveRegion === e.wantRegion);
}
