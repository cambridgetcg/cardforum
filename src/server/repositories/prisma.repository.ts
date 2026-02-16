/**
 * Prisma Repository Implementations — Default data access layer.
 *
 * Each class implements a repository port using the Prisma client.
 * Services can depend on the port interface and receive these via DI.
 *
 * Note: Repository port types use `string` for enums to stay ORM-agnostic.
 * Prisma's enum types are satisfied because string is assignable at runtime.
 * We use `as unknown as` casts where Prisma's strict enum typing conflicts.
 */

import { db } from "@/lib/db";
import type {
  IUserRepository,
  UserRecord,
  IListingRepository,
  HaveListingRecord,
  WantListingRecord,
  ITradeRepository,
  TradeRecord,
  TradeLegRecord,
  IWalletTransactionRepository,
  WalletTransactionRecord,
  PaginationParams,
  ICardRepository,
  CardRecord,
} from "@/server/ports/repository.port";

// ─── User ────────────────────────────────────────────

export class PrismaUserRepository implements IUserRepository {
  async findById(id: string): Promise<UserRecord | null> {
    const user = await db.user.findUnique({ where: { id } });
    return user as UserRecord | null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = await db.user.findUnique({ where: { email } });
    return user as UserRecord | null;
  }

  async updateWalletBalance(id: string, delta: number): Promise<UserRecord> {
    const user = await db.user.update({
      where: { id },
      data: { walletBalance: { increment: delta } },
    });
    return user as unknown as UserRecord;
  }

  async updateStripeCustomerId(id: string, customerId: string): Promise<void> {
    await db.user.update({ where: { id }, data: { stripeCustomerId: customerId } });
  }

  async updateConnectAccount(
    id: string,
    data: { accountId?: string | null; onboardingComplete?: boolean },
  ): Promise<void> {
    await db.user.update({
      where: { id },
      data: {
        ...(data.accountId !== undefined ? { stripeConnectAccountId: data.accountId } : {}),
        ...(data.onboardingComplete !== undefined
          ? { connectOnboardingComplete: data.onboardingComplete }
          : {}),
      },
    });
  }
}

// ─── Listing ─────────────────────────────────────────

export class PrismaListingRepository implements IListingRepository {
  async findActiveHaveListings(): Promise<HaveListingRecord[]> {
    const listings = await db.haveListing.findMany({ where: { isActive: true } });
    return listings as unknown as HaveListingRecord[];
  }

  async findActiveWantListings(): Promise<WantListingRecord[]> {
    const listings = await db.wantListing.findMany({ where: { isActive: true } });
    return listings as unknown as WantListingRecord[];
  }

  async findUserHaveListings(userId: string): Promise<HaveListingRecord[]> {
    const listings = await db.haveListing.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    return listings as unknown as HaveListingRecord[];
  }

  async findUserWantListings(userId: string): Promise<WantListingRecord[]> {
    const listings = await db.wantListing.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    return listings as unknown as WantListingRecord[];
  }

  async createHaveListing(
    data: Omit<HaveListingRecord, "id" | "createdAt" | "isActive">,
  ): Promise<HaveListingRecord> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listing = await db.haveListing.create({ data: data as any });
    return listing as unknown as HaveListingRecord;
  }

  async createWantListing(
    data: Omit<WantListingRecord, "id" | "createdAt" | "isActive">,
  ): Promise<WantListingRecord> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listing = await db.wantListing.create({ data: data as any });
    return listing as unknown as WantListingRecord;
  }

  async deactivateListings(haveIds: string[], wantIds: string[]): Promise<void> {
    await Promise.all([
      haveIds.length > 0
        ? db.haveListing.updateMany({ where: { id: { in: haveIds } }, data: { isActive: false } })
        : Promise.resolve(),
      wantIds.length > 0
        ? db.wantListing.updateMany({ where: { id: { in: wantIds } }, data: { isActive: false } })
        : Promise.resolve(),
    ]);
  }
}

// ─── Trade ───────────────────────────────────────────

export class PrismaTradeRepository implements ITradeRepository {
  async findById(id: string): Promise<(TradeRecord & { legs: TradeLegRecord[] }) | null> {
    const trade = await db.trade.findUnique({
      where: { id },
      include: { legs: true },
    });
    return trade as unknown as (TradeRecord & { legs: TradeLegRecord[] }) | null;
  }

  async findByUser(userId: string): Promise<TradeRecord[]> {
    const trades = await db.trade.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: { createdAt: "desc" },
    });
    return trades as unknown as TradeRecord[];
  }

  async findByStatus(status: string): Promise<TradeRecord[]> {
    const trades = await db.trade.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: { status: status as any },
      orderBy: { createdAt: "desc" },
    });
    return trades as unknown as TradeRecord[];
  }

  async updateStatus(id: string, status: string, historyEntry: unknown): Promise<TradeRecord> {
    const trade = await db.trade.findUniqueOrThrow({ where: { id } });
    const history = (trade.statusHistory as unknown[]) ?? [];

    const updated = await db.trade.update({
      where: { id },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: status as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        statusHistory: [...history, historyEntry] as any,
      },
    });
    return updated as unknown as TradeRecord;
  }

  async create(
    data: Omit<TradeRecord, "id" | "createdAt" | "updatedAt">,
    legs: Omit<TradeLegRecord, "id" | "tradeId">[],
  ): Promise<TradeRecord> {
    const trade = await db.trade.create({
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(data as any),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        legs: { create: legs as any },
      },
    });
    return trade as unknown as TradeRecord;
  }
}

// ─── Wallet Transaction ──────────────────────────────

export class PrismaWalletTransactionRepository implements IWalletTransactionRepository {
  async findByUser(
    userId: string,
    pagination?: PaginationParams,
  ): Promise<WalletTransactionRecord[]> {
    const limit = pagination?.limit ?? 50;
    const page = pagination?.page ?? 1;
    const txs = await db.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    });
    return txs as unknown as WalletTransactionRecord[];
  }

  async findByStripeSessionId(sessionId: string): Promise<WalletTransactionRecord | null> {
    // Note: Field may be named stripePaymentIntentId in schema — adjust when wiring
    const tx = await db.walletTransaction.findFirst({
      where: { stripePaymentIntentId: sessionId },
    });
    return tx as unknown as WalletTransactionRecord | null;
  }

  async create(
    data: Omit<WalletTransactionRecord, "id" | "createdAt">,
  ): Promise<WalletTransactionRecord> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = await db.walletTransaction.create({ data: data as any });
    return tx as unknown as WalletTransactionRecord;
  }
}

// ─── Card ────────────────────────────────────────────

export class PrismaCardRepository implements ICardRepository {
  async search(query: string, tcg?: string, limit = 20): Promise<CardRecord[]> {
    const cards = await db.card.findMany({
      where: {
        name: { contains: query, mode: "insensitive" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(tcg ? { tcg: tcg as any } : {}),
      },
      take: limit,
      orderBy: { name: "asc" },
    });
    return cards as unknown as CardRecord[];
  }

  async findById(id: string): Promise<CardRecord | null> {
    const card = await db.card.findUnique({ where: { id } });
    return card as unknown as CardRecord | null;
  }

  async findByIds(ids: string[]): Promise<CardRecord[]> {
    const cards = await db.card.findMany({ where: { id: { in: ids } } });
    return cards as unknown as CardRecord[];
  }
}
