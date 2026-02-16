/**
 * React Query Hooks — Pre-built hooks for common API calls.
 *
 * Usage:
 *   import { useWalletBalance, useTrades } from "@/hooks/use-api";
 *   const { data: balance, isLoading } = useWalletBalance();
 *   const { data: trades } = useTrades();
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type WalletBalance, type ExpertPostListParams, type CollectionStats, type CollectionEntry, type PullRateData } from "@/lib/api-client";

// ─── Query Keys ──────────────────────────────────────
// Centralized keys prevent typos and enable targeted invalidation.

export const queryKeys = {
  wallet: {
    balance: ["wallet", "balance"] as const,
    history: ["wallet", "history"] as const,
  },
  trades: {
    list: ["trades"] as const,
    detail: (id: string) => ["trades", id] as const,
  },
  listings: {
    list: ["listings"] as const,
  },
  marketplace: {
    list: (params?: { tcg?: string; query?: string }) => ["marketplace", params] as const,
    orderbook: (cardId: string) => ["marketplace", "orderbook", cardId] as const,
  },
  dashboard: ["dashboard"] as const,
  connect: {
    status: ["connect", "status"] as const,
  },
  kyc: {
    status: ["kyc", "status"] as const,
  },
  cards: {
    search: (query: string, tcg?: string) => ["cards", query, tcg] as const,
  },
  expert: {
    list: (params?: ExpertPostListParams) => ["expert", "posts", params] as const,
    detail: (id: string) => ["expert", "posts", id] as const,
  },
  collection: {
    list: (params?: { tcg?: string; set?: string }) => ["collection", params] as const,
    stats: ["collection", "stats"] as const,
    check: (cardIds: string[]) => ["collection", "check", cardIds] as const,
  },
  pullRates: {
    get: (setCode: string) => ["pullRates", setCode] as const,
  },
} as const;

// ─── Wallet Hooks ────────────────────────────────────

export function useWalletBalance() {
  return useQuery({
    queryKey: queryKeys.wallet.balance,
    queryFn: api.wallet.getBalance,
  });
}

export function useWalletHistory() {
  return useQuery({
    queryKey: queryKeys.wallet.history,
    queryFn: api.wallet.getHistory,
  });
}

export function useDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amountCents: number) => api.wallet.deposit(amountCents),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.wallet.balance });
      qc.invalidateQueries({ queryKey: queryKeys.wallet.history });
    },
  });
}

export function useWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amountCents: number) => api.wallet.withdraw(amountCents),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.wallet.balance });
      qc.invalidateQueries({ queryKey: queryKeys.wallet.history });
    },
  });
}

// ─── Trade Hooks ─────────────────────────────────────

export function useTrades() {
  return useQuery({
    queryKey: queryKeys.trades.list,
    queryFn: api.trades.list,
  });
}

export function useTrade(tradeId: string) {
  return useQuery({
    queryKey: queryKeys.trades.detail(tradeId),
    queryFn: () => api.trades.get(tradeId),
    enabled: !!tradeId,
  });
}

export function useTradeAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { tradeId: string; action: "accept" | "reject" | "cancel" }) =>
      api.trades.action(data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.trades.list });
      qc.invalidateQueries({ queryKey: queryKeys.trades.detail(variables.tradeId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

// ─── Listing Hooks ───────────────────────────────────

export function useListings() {
  return useQuery({
    queryKey: queryKeys.listings.list,
    queryFn: api.listings.list,
  });
}

export function useCreateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api.listings.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.listings.list });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

// ─── Marketplace Hooks ───────────────────────────────

export function useMarketplace(params?: { tcg?: string; query?: string }) {
  return useQuery({
    queryKey: queryKeys.marketplace.list(params),
    queryFn: () => api.marketplace.list(params),
  });
}

export function useOrderbook(cardId: string) {
  return useQuery({
    queryKey: queryKeys.marketplace.orderbook(cardId),
    queryFn: () => api.marketplace.orderbook(cardId),
    enabled: !!cardId,
  });
}

// ─── Dashboard Hook ──────────────────────────────────

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: api.dashboard.get,
  });
}

// ─── Connect Hooks ───────────────────────────────────

export function useConnectStatus() {
  return useQuery({
    queryKey: queryKeys.connect.status,
    queryFn: api.connect.status,
  });
}

export function useConnectOnboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.connect.onboard,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.connect.status });
    },
  });
}

// ─── Card Search Hook ────────────────────────────────

export function useCardSearch(query: string, tcg?: string) {
  return useQuery({
    queryKey: queryKeys.cards.search(query, tcg),
    queryFn: () => api.cards.search(query, tcg),
    enabled: query.length >= 1,
  });
}

// ─── KYC Hook ────────────────────────────────────────

export function useKYCStatus() {
  return useQuery({
    queryKey: queryKeys.kyc.status,
    queryFn: api.kyc.status,
  });
}

// ─── Expert Hub Hooks ───────────────────────────────

export function useExpertPosts(params?: ExpertPostListParams) {
  return useQuery({
    queryKey: queryKeys.expert.list(params),
    queryFn: () => api.expert.list(params),
  });
}

export function useExpertPost(postId: string) {
  return useQuery({
    queryKey: queryKeys.expert.detail(postId),
    queryFn: () => api.expert.get(postId),
    enabled: !!postId,
  });
}

export function useCreateExpertPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api.expert.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expert", "posts"] as const });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useVoteExpertPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, value, helpful }: { postId: string; value: 1 | -1; helpful: boolean }) =>
      api.expert.vote(postId, value, helpful),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expert", "posts"] as const });
    },
  });
}

export function useDeleteExpertPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => api.expert.delete(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expert", "posts"] as const });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

// ─── Collection Hooks ───────────────────────────────

export function useCollection(params?: { tcg?: string; set?: string }) {
  return useQuery({
    queryKey: queryKeys.collection.list(params),
    queryFn: () => api.collection.list(params),
  });
}

export function useCollectionStats() {
  return useQuery({
    queryKey: queryKeys.collection.stats,
    queryFn: api.collection.stats,
  });
}

export function useCollectionCheck(cardIds: string[]) {
  return useQuery({
    queryKey: queryKeys.collection.check(cardIds),
    queryFn: () => api.collection.check(cardIds),
    enabled: cardIds.length > 0,
  });
}

export function useAddToCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { cardId: string; quantity?: number; condition?: string; notes?: string }) =>
      api.collection.add(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection"] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useRemoveFromCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => api.collection.remove(entryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection"] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

// ─── Pull Rate Hooks ────────────────────────────────

export function usePullRates(setCode: string) {
  return useQuery({
    queryKey: queryKeys.pullRates.get(setCode),
    queryFn: () => api.pullRates.get(setCode),
    enabled: !!setCode,
    staleTime: 24 * 60 * 60 * 1000, // 24h — pull rates rarely change
  });
}
