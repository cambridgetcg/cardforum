import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  db: {
    matchProposal: { findUnique: vi.fn() },
    haveListing: { findMany: vi.fn() },
    gradedHaveListing: { findMany: vi.fn() },
    sealedHaveListing: { findMany: vi.fn() },
    trade: { create: vi.fn(), findUniqueOrThrow: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    tradeLeg: { findMany: vi.fn() },
    tradePayment: { create: vi.fn() },
    authenticator: { findUniqueOrThrow: vi.fn() },
    $transaction: vi.fn(),
  },
  transition: vi.fn(),
  holds: vi.fn(),
  customer: vi.fn(),
  provider: vi.fn(),
  createIntent: vi.fn(),
}));
vi.mock("@/server/events/subscribers", () => ({}));
vi.mock("@/server/events/event-bus", () => ({ eventBus: { emitAsync: vi.fn() } }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/db", () => ({ db: m.db }));
vi.mock("@/server/services/trade.service", () => ({
  getUserTrades: vi.fn(),
  transitionTrade: m.transition,
}));
vi.mock("@/server/services/dispute.service", () => ({ createShippingDispute: vi.fn() }));
vi.mock("@/server/services/digital-token.service", () => ({ transferToken: vi.fn() }));
vi.mock("@/server/services/config.service", () => ({ getConfig: vi.fn(), getConfigs: vi.fn() }));
vi.mock("@/server/services/wallet.service", () => ({ calculateHoldAmounts: m.holds }));
vi.mock("@/server/services/stripe.service", () => ({ getOrCreateCustomer: m.customer }));
vi.mock("@/server/adapters/stripe.adapter", () => ({
  getPaymentProvider: m.provider,
  getPayoutProvider: vi.fn(),
}));

import { POST as purchase } from "@/app/api/digital-marketplace/[listingId]/route";
import { POST as digitise } from "@/app/api/digitisation/route";
import { POST as tradePost } from "@/app/api/trades/route";
import { buyToken } from "@/server/services/digital-trade.service";
import { createDigitisationRequest } from "@/server/services/digitisation.service";
import { assertNewTradeRemainsUnpaid } from "@/server/services/trade-admission.service";
import { createTradeHolds } from "@/server/services/marketplace-escrow.service";
import { UNPAID_TRADE_ADMISSION } from "@/lib/commerce-policy";

const actualTradeService = await vi.importActual<typeof import("@/server/services/trade.service")>(
  "@/server/services/trade.service",
);

const marked = [{ status: "PROPOSED", admission: UNPAID_TRADE_ADMISSION }];
const legacy = [{ status: "PROPOSED", at: "2099-01-01T00:00:00.000Z" }];
const request = (body: unknown) =>
  new NextRequest("https://cardforum.test/api/trades", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
const legs = [
  {
    fromUserId: "a",
    toUserId: "b",
    haveListingId: "first",
    gradedHaveListingId: null,
    sealedHaveListingId: null,
  },
  {
    fromUserId: "b",
    toUserId: "a",
    haveListingId: "second",
    gradedHaveListingId: null,
    sealedHaveListingId: null,
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: "a" } });
  m.db.matchProposal.findUnique.mockResolvedValue({
    id: "proposal",
    trade: null,
    tradeMode: "DIRECT",
    legs,
  });
  m.db.haveListing.findMany.mockResolvedValue([
    { id: "first", askPrice: 500 },
    { id: "second", askPrice: 500 },
  ]);
  m.db.gradedHaveListing.findMany.mockResolvedValue([]);
  m.db.sealedHaveListing.findMany.mockResolvedValue([]);
  m.db.trade.create.mockResolvedValue({ id: "new-barter" });
  m.db.trade.findUniqueOrThrow.mockResolvedValue({ statusHistory: legacy });
  m.db.tradeLeg.findMany.mockResolvedValue(
    legs.map((leg) => ({ ...leg, haveListing: { askPrice: 500 } })),
  );
  m.holds.mockResolvedValue(new Map([["a", 100]]));
  m.provider.mockReturnValue({ createPaymentIntent: m.createIntent });
  m.createIntent.mockResolvedValue({
    paymentIntentId: "existing-obligation",
    clientSecret: "mock",
    status: "requires_capture",
  });
  m.customer.mockResolvedValue("customer");
});

describe("fresh paid admission", () => {
  it("retires purchase and digitisation before auth, parsing or database writes", async () => {
    for (const handler of [purchase, digitise]) {
      const response = await handler();
      expect(response.status).toBe(410);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(m.auth).not.toHaveBeenCalled();
    expect(m.db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects direct service bypasses before touching a wallet or authenticator", async () => {
    await expect(buyToken("listing", "buyer")).rejects.toThrow("retired");
    await expect(
      createDigitisationRequest({
        userId: "a",
        cardId: "c",
        condition: "NM",
        authenticatorId: "v",
        verificationFeeCents: 500,
      }),
    ).rejects.toThrow("retired");
    expect(m.db.$transaction).not.toHaveBeenCalled();
    expect(m.db.authenticator.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("admits equal DIRECT barter using stored prices and rejects a monetary difference", async () => {
    expect((await tradePost(request({ proposalId: "proposal" }))).status).toBe(201);
    expect(m.db.trade.create).toHaveBeenCalledTimes(1);
    expect(m.db.trade.create.mock.calls[0][0].data.statusHistory[0].admission).toBe(
      UNPAID_TRADE_ADMISSION,
    );
    m.db.trade.create.mockClear();
    m.db.haveListing.findMany.mockResolvedValue([
      { id: "first", askPrice: 500 },
      { id: "second", askPrice: 600 },
    ]);
    expect((await tradePost(request({ proposalId: "proposal", settlements: [0, 0] }))).status).toBe(
      410,
    );
    expect(m.db.trade.create).not.toHaveBeenCalled();
  });

  it("refuses a new fee-bearing authenticated trade", async () => {
    m.db.matchProposal.findUnique.mockResolvedValue({
      id: "proposal",
      trade: null,
      tradeMode: "AUTHENTICATED",
      legs,
    });
    expect((await tradePost(request({ proposalId: "proposal" }))).status).toBe(410);
    expect(m.db.trade.create).not.toHaveBeenCalled();
  });

  it("continues existing trade actions through the original transition service", async () => {
    m.transition.mockResolvedValue({ id: "old", status: "CANCELLED" });
    expect((await tradePost(request({ tradeId: "old", action: "cancel" }))).status).toBe(200);
    expect(m.transition).toHaveBeenCalledWith("old", "a", "CANCELLED");
    expect(m.db.matchProposal.findUnique).not.toHaveBeenCalled();
  });
});

describe("existing obligation and later price changes", () => {
  it("does not reclassify unmarked rollout trade terms", async () => {
    await assertNewTradeRemainsUnpaid({
      id: "old",
      mode: "AUTHENTICATED",
      statusHistory: legacy,
    });
    expect(m.db.tradeLeg.findMany).not.toHaveBeenCalled();
  });

  it("rechecks a new barter against current prices before commitment", async () => {
    const trade = { id: "new", mode: "DIRECT", statusHistory: marked };
    await expect(assertNewTradeRemainsUnpaid(trade)).resolves.toBeUndefined();
    m.db.tradeLeg.findMany.mockResolvedValue([
      { ...legs[0], haveListing: { askPrice: 500 } },
      { ...legs[1], haveListing: { askPrice: 600 } },
    ]);
    await expect(assertNewTradeRemainsUnpaid(trade)).rejects.toThrow("retired");
  });

  it("keeps payment-intent creation for a legacy obligation, even one created during rollout", async () => {
    const result = await createTradeHolds("old");
    expect(result.totalHeld).toBe(100);
    expect(m.createIntent).toHaveBeenCalledTimes(1);
    expect(m.db.tradePayment.create).toHaveBeenCalledTimes(1);
  });

  it("refuses a fresh monetary hold before customer creation, Stripe or payment records", async () => {
    m.db.trade.findUniqueOrThrow.mockResolvedValue({ statusHistory: marked });
    await expect(createTradeHolds("new")).rejects.toThrow("retired");
    expect(m.customer).not.toHaveBeenCalled();
    expect(m.provider).not.toHaveBeenCalled();
    expect(m.db.tradePayment.create).not.toHaveBeenCalled();
  });

  it("keeps a new zero-net barter free of payment calls", async () => {
    m.db.trade.findUniqueOrThrow.mockResolvedValue({ statusHistory: marked });
    m.holds.mockResolvedValue(
      new Map([
        ["a", 0],
        ["b", 0],
      ]),
    );
    await expect(createTradeHolds("new")).resolves.toEqual({ totalHeld: 0, payments: [] });
    expect(m.customer).not.toHaveBeenCalled();
    expect(m.provider).not.toHaveBeenCalled();
  });
});

describe("authentication upgrade", () => {
  it("preserves an existing unmarked upgrade but rejects a new marked paid service before writing", async () => {
    const record = {
      id: "trade",
      mode: "DIRECT",
      status: "PROPOSED",
      userAId: "a",
      userBId: "b",
      statusHistory: legacy,
    };
    m.db.trade.findUnique.mockResolvedValue(record);
    await actualTradeService.requestAuthentication("trade", "a");
    expect(m.db.trade.update).toHaveBeenCalledWith({
      where: { id: "trade" },
      data: { mode: "AUTHENTICATED" },
    });
    m.db.trade.update.mockClear();
    m.db.trade.findUnique.mockResolvedValue({ ...record, statusHistory: marked });
    await expect(actualTradeService.requestAuthentication("trade", "a")).rejects.toThrow("retired");
    expect(m.db.trade.update).not.toHaveBeenCalled();
  });
});
