/**
 * Repository Ports — Data access abstraction interfaces.
 *
 * Services depend on these interfaces instead of calling Prisma directly.
 * This enables: mocking in tests, swapping ORMs, read replicas, caching layers.
 *
 * Each repository covers one aggregate root. Queries that span aggregates
 * should use a dedicated read-model or service-level composition.
 */

// ─── Base Types ──────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ─── User Repository ─────────────────────────────────

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  region: string | null;
  country: string | null;
  walletBalance: number;
  walletFrozen: boolean;
  walletFrozenReason: string | null;
  stripeCustomerId: string | null;
  stripeConnectAccountId: string | null;
  connectOnboardingComplete: boolean;
  createdAt: Date;
}

export interface IUserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  updateWalletBalance(id: string, delta: number): Promise<UserRecord>;
  updateStripeCustomerId(id: string, customerId: string): Promise<void>;
  updateConnectAccount(id: string, data: { accountId?: string | null; onboardingComplete?: boolean }): Promise<void>;
}

// ─── Listing Repository ──────────────────────────────

export interface HaveListingRecord {
  id: string;
  userId: string;
  cardId: string;
  condition: string;
  language: string;
  askPrice: number;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
}

export interface WantListingRecord {
  id: string;
  userId: string;
  cardId: string;
  minCondition: string;
  language: string | null;
  bidPrice: number;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
}

export interface IListingRepository {
  findActiveHaveListings(): Promise<HaveListingRecord[]>;
  findActiveWantListings(): Promise<WantListingRecord[]>;
  findUserHaveListings(userId: string): Promise<HaveListingRecord[]>;
  findUserWantListings(userId: string): Promise<WantListingRecord[]>;
  createHaveListing(data: Omit<HaveListingRecord, "id" | "createdAt" | "isActive">): Promise<HaveListingRecord>;
  createWantListing(data: Omit<WantListingRecord, "id" | "createdAt" | "isActive">): Promise<WantListingRecord>;
  deactivateListings(haveIds: string[], wantIds: string[]): Promise<void>;
}

// ─── Trade Repository ────────────────────────────────

export interface TradeRecord {
  id: string;
  proposalId: string;
  userAId: string;
  userBId: string;
  participantIds: string[];
  status: string;
  mode: string;
  statusHistory: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TradeLegRecord {
  id: string;
  tradeId: string;
  fromUserId: string;
  toUserId: string;
  region: string;
  sequence: number;
  status: string;
  haveListingId: string | null;
  wantListingId: string | null;
}

export interface ITradeRepository {
  findById(id: string): Promise<(TradeRecord & { legs: TradeLegRecord[] }) | null>;
  findByUser(userId: string): Promise<TradeRecord[]>;
  findByStatus(status: string): Promise<TradeRecord[]>;
  updateStatus(id: string, status: string, historyEntry: unknown): Promise<TradeRecord>;
  create(data: Omit<TradeRecord, "id" | "createdAt" | "updatedAt">, legs: Omit<TradeLegRecord, "id" | "tradeId">[]): Promise<TradeRecord>;
}

// ─── Wallet Transaction Repository ───────────────────

export interface WalletTransactionRecord {
  id: string;
  userId: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  stripeSessionId: string | null;
  stripePayoutId: string | null;
  createdAt: Date;
}

export interface IWalletTransactionRepository {
  findByUser(userId: string, pagination?: PaginationParams): Promise<WalletTransactionRecord[]>;
  findByStripeSessionId(sessionId: string): Promise<WalletTransactionRecord | null>;
  create(data: Omit<WalletTransactionRecord, "id" | "createdAt">): Promise<WalletTransactionRecord>;
}

// ─── Card Repository ─────────────────────────────────

export interface CardRecord {
  id: string;
  name: string;
  tcg: string;
  setName: string;
  number: string;
  rarity: string;
  imageUrl: string | null;
}

export interface ICardRepository {
  search(query: string, tcg?: string, limit?: number): Promise<CardRecord[]>;
  findById(id: string): Promise<CardRecord | null>;
  findByIds(ids: string[]): Promise<CardRecord[]>;
}
