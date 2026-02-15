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

async function fetchApi<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    let body: unknown;
    try { body = await res.json(); } catch { /* empty */ }
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
  withdraw: (amountCents: number) => post<{ transaction: unknown; payout: unknown }>("/api/wallet/withdraw", { amountCents }),
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

const dashboard = {
  get: () => get<unknown>("/api/dashboard"),
};

// ─── Connect ─────────────────────────────────────────

const connect = {
  onboard: () => post<{ url: string }>("/api/connect/onboard"),
  status: () => get<{ hasConnectAccount: boolean; onboardingComplete: boolean }>("/api/connect/status"),
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
} as const;
