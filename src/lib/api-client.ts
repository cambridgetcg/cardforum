/**
 * Typed API Client — Centralized fetch wrapper for all API routes.
 *
 * Eliminates ad-hoc `fetch()` calls throughout components.
 * Each method returns typed data, throws `ApiError` on failure.
 *
 * Usage:
 *   import { api } from "@/lib/api-client";
 *   const balance = await api.wallet.getBalance();
 *   const trades = await api.trades.list();
 */

// ─── Error ───────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body?: unknown,
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = "ApiError";
  }
}

// ─── Base Fetch ──────────────────────────────────────

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      /* empty */
    }
    throw new ApiError(res.status, res.statusText, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function get<T>(url: string) {
  return fetchApi<T>(url);
}

function post<T>(url: string, data?: unknown) {
  return fetchApi<T>(url, { method: "POST", body: data ? JSON.stringify(data) : undefined });
}

function put<T>(url: string, data: unknown) {
  return fetchApi<T>(url, { method: "PUT", body: JSON.stringify(data) });
}

function patch<T>(url: string, data: unknown) {
  return fetchApi<T>(url, { method: "PATCH", body: JSON.stringify(data) });
}

function del<T>(url: string) {
  return fetchApi<T>(url, { method: "DELETE" });
}

// ─── Wallet ──────────────────────────────────────────

export interface WalletBalance {
  balance: number;
  frozen: boolean;
  frozenReason: string | null;
}

export interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

const wallet = {
  getBalance: () => get<WalletBalance>("/api/wallet/balance"),
  getHistory: () => get<WalletTransaction[]>("/api/wallet/history"),
  deposit: (amountCents: number) => post<{ url: string }>("/api/wallet/deposit", { amountCents }),
  withdraw: (amountCents: number) =>
    post<{ transaction: unknown; payout: unknown }>("/api/wallet/withdraw", { amountCents }),
};

// ─── Cards ───────────────────────────────────────────

export interface CardSearchResult {
  id: string;
  name: string;
  tcg: string;
  setName: string;
  number: string;
  rarity: string;
  imageUrl: string | null;
}

const cards = {
  search: (query: string, tcg?: string) => {
    const params = new URLSearchParams({ query });
    if (tcg) params.set("tcg", tcg);
    return get<CardSearchResult[]>(`/api/cards?${params}`);
  },
};

// ─── Listings ────────────────────────────────────────

const listings = {
  list: () => get<unknown[]>("/api/listings"),
  create: (data: unknown) => post<unknown>("/api/listings", data),
};

// ─── Graded Listings ─────────────────────────────────

const gradedListings = {
  list: () => get<unknown[]>("/api/graded-listings"),
  create: (data: unknown) => post<unknown>("/api/graded-listings", data),
};

// ─── Trades ──────────────────────────────────────────

const trades = {
  list: () => get<unknown[]>("/api/trades"),
  get: (tradeId: string) => get<{ trade: unknown }>(`/api/trades/${tradeId}`),
  action: (data: { tradeId: string; action: "accept" | "reject" | "cancel" }) =>
    post<unknown>("/api/trades", data),
};

// ─── Marketplace ─────────────────────────────────────

const marketplace = {
  list: (params?: { tcg?: string; query?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.tcg) searchParams.set("tcg", params.tcg);
    if (params?.query) searchParams.set("query", params.query);
    const qs = searchParams.toString();
    return get<unknown[]>(`/api/marketplace${qs ? `?${qs}` : ""}`);
  },
  orderbook: (cardId: string) => get<unknown>(`/api/orderbook?cardId=${cardId}`),
};

// ─── Dashboard ───────────────────────────────────────

export interface DashboardStats {
  listings: number;
  haveCount: number;
  wantCount: number;
  gradedHaveCount: number;
  gradedWantCount: number;
  activeTrades: number;
  completedTrades: number;
  pendingProposals: number;
  expertPostCount: number;
  collectionCards: number;
  collectionEntries: number;
}

const dashboard = {
  get: () => get<DashboardStats>("/api/dashboard"),
};

// ─── Connect ─────────────────────────────────────────

const connect = {
  onboard: () => post<{ url: string }>("/api/connect/onboard"),
  status: () =>
    get<{ hasConnectAccount: boolean; onboardingComplete: boolean }>("/api/connect/status"),
  dashboard: () => get<{ url: string }>("/api/connect/dashboard"),
};

// ─── KYC ─────────────────────────────────────────────

const kyc = {
  status: () => get<unknown>("/api/kyc/status"),
  submit: (data: unknown) => post<unknown>("/api/kyc/submit", data),
};

// ─── AI Grading ──────────────────────────────────────

const aiGrading = {
  grade: (photos: string[]) => post<unknown>("/api/ai-grading", { photos }),
};

// ─── Authenticator ───────────────────────────────────

const authenticator = {
  apply: (data: unknown) => post<unknown>("/api/authenticator/apply", data),
  dashboard: () => get<unknown>("/api/authenticator/dashboard"),
  tierStatus: () => get<unknown>("/api/authenticator/tier-status"),
};

// ─── Expert Hub ─────────────────────────────────────

export interface ExpertPostSummary {
  id: string;
  title: string;
  excerpt: string | null;
  category: string;
  tcg: string | null;
  language: string | null;
  upvotes: number;
  downvotes: number;
  helpfulCount: number;
  publishedAt: string | null;
  author: { id: string; name: string | null; image: string | null };
  card: { id: string; name: string; number: string | null; imageUrl: string | null } | null;
  set: { id: string; name: string; code: string } | null;
  endorsements: { id: string; endorserType: string }[];
  _count: { votes: number; endorsements: number };
}

export interface ExpertPostDetail extends ExpertPostSummary {
  authorId: string;
  content: string;
  tags: string[];
  status: string;
  createdAt: string;
  card: {
    id: string;
    name: string;
    number: string | null;
    imageUrl: string | null;
    tcg: string;
  } | null;
  set: { id: string; name: string; code: string; tcg: string } | null;
  endorsements: { id: string; endorserType: string; endorserId: string; note: string | null }[];
}

export interface ExpertPostListParams {
  tcg?: string;
  category?: string;
  sort?: string;
  language?: string;
  cardId?: string;
  setId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface ExpertPostListResponse {
  posts: ExpertPostSummary[];
  total: number;
  page: number;
  totalPages: number;
}

const expert = {
  list: (params?: ExpertPostListParams) => {
    const sp = new URLSearchParams();
    if (params?.tcg) sp.set("tcg", params.tcg);
    if (params?.category) sp.set("category", params.category);
    if (params?.sort) sp.set("sort", params.sort);
    if (params?.language) sp.set("language", params.language);
    if (params?.cardId) sp.set("cardId", params.cardId);
    if (params?.setId) sp.set("setId", params.setId);
    if (params?.status) sp.set("status", params.status);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.limit) sp.set("limit", String(params.limit));
    const qs = sp.toString();
    return get<ExpertPostListResponse>(`/api/expert/posts${qs ? `?${qs}` : ""}`);
  },
  get: (postId: string) => get<{ post: ExpertPostDetail }>(`/api/expert/posts/${postId}`),
  create: (data: unknown) => post<{ post: ExpertPostDetail }>("/api/expert/posts", data),
  update: (postId: string, data: unknown) =>
    patch<{ post: ExpertPostDetail }>(`/api/expert/posts/${postId}`, data),
  delete: (postId: string) => del<{ success: boolean }>(`/api/expert/posts/${postId}`),
  vote: (postId: string, value: 1 | -1, helpful: boolean) =>
    post<unknown>(`/api/expert/posts/${postId}/vote`, { value, helpful }),
  endorse: (postId: string, note?: string) =>
    post<unknown>(`/api/expert/posts/${postId}/endorse`, { note }),
};

// ─── Collection ─────────────────────────────────────

export interface CollectionEntry {
  id: string;
  cardId: string;
  quantity: number;
  condition: string | null;
  acquiredAt: string;
  pricePaid: number | null;
  notes: string | null;
  card: {
    id: string;
    name: string;
    tcg: string;
    setName: string;
    setCode: string | null;
    number: string | null;
    rarity: string | null;
    imageUrl: string | null;
  };
}

export interface CollectionStats {
  totalCards: number;
  uniqueCards: number;
  totalValue: number;
  setCompletion: {
    setCode: string;
    setName: string;
    tcg: string;
    owned: number;
    total: number;
    pct: number;
  }[];
}

export interface PullRateData {
  tcg: string;
  setCode: string;
  language: string;
  productType: string;
  packsPerBox: number;
  rates: {
    rarity: string;
    perPack: number;
    perBox: number;
    packProbability: number;
    boxProbability: number;
    perSpecificCardPerBox: number;
    uniqueCards: number;
  }[];
}

const collection = {
  list: (params?: { tcg?: string; set?: string; rarity?: string }) => {
    const sp = new URLSearchParams();
    if (params?.tcg) sp.set("tcg", params.tcg);
    if (params?.set) sp.set("set", params.set);
    if (params?.rarity) sp.set("rarity", params.rarity);
    const qs = sp.toString();
    return get<{ entries: CollectionEntry[] }>(`/api/collection${qs ? `?${qs}` : ""}`);
  },
  add: (data: {
    cardId: string;
    quantity?: number;
    condition?: string;
    pricePaid?: number;
    notes?: string;
  }) => post<{ entry: unknown }>("/api/collection", data),
  update: (
    entryId: string,
    data: { quantity?: number; notes?: string; pricePaid?: number | null },
  ) => patch<{ success: boolean }>(`/api/collection/${entryId}`, data),
  remove: (entryId: string) => del<{ success: boolean }>(`/api/collection/${entryId}`),
  stats: () => get<CollectionStats>("/api/collection/stats"),
  check: (cardIds: string[]) =>
    get<{ owned: string[] }>(`/api/collection/check?cardIds=${cardIds.join(",")}`),
};

// ─── Pull Rates ─────────────────────────────────────

const pullRates = {
  get: (setCode: string) => get<PullRateData>(`/api/pull-rates/${setCode}`),
};

// ─── Export ──────────────────────────────────────────

export const api = {
  wallet,
  cards,
  listings,
  gradedListings,
  trades,
  marketplace,
  dashboard,
  connect,
  kyc,
  aiGrading,
  authenticator,
  expert,
  collection,
  pullRates,
} as const;
