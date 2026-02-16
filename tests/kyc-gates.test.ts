import { describe, it, expect, afterAll, beforeEach } from "vitest";
import {
  getTestDb,
  disconnectDb,
  createTestUser,
  cleanupTestData,
  seedTestCard,
  approveBasicKYC,
  fullyVerifyUser,
} from "./helpers";
import {
  assertCanCreateListing,
  assertCanTrade,
  assertCanApplyAsAuthenticator,
} from "@/server/services/kyc.service";
import { KYC_BASIC_LISTING_CAP_CENTS, KYC_BASIC_TRADE_CAP_CENTS } from "@/lib/constants";

const db = getTestDb();

describe("KYC Gate Enforcement", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectDb();
  });

  // ─── Listing Gate ────────────────────────────────────

  describe("assertCanCreateListing", () => {
    it("blocks UNVERIFIED users from creating any listing", async () => {
      const user = await createTestUser({ email: "gate-list-unv@test.com" });

      await expect(assertCanCreateListing(user.id, 1000)).rejects.toThrow(
        /KYC verification required to create listings/,
      );
    });

    it("allows BASIC_VERIFIED user to list under cap", async () => {
      const user = await createTestUser({ email: "gate-list-basic@test.com" });
      const admin = await createTestUser({ email: "gate-admin-list@test.com" });

      await approveBasicKYC(user.id, admin.id);

      // Under $500 cap (50_000 cents)
      await expect(
        assertCanCreateListing(user.id, KYC_BASIC_LISTING_CAP_CENTS - 100),
      ).resolves.toBeUndefined();
    });

    it("allows BASIC_VERIFIED user at exactly the cap", async () => {
      const user = await createTestUser({ email: "gate-list-cap@test.com" });
      const admin = await createTestUser({ email: "gate-admin-cap@test.com" });

      await approveBasicKYC(user.id, admin.id);

      await expect(
        assertCanCreateListing(user.id, KYC_BASIC_LISTING_CAP_CENTS),
      ).resolves.toBeUndefined();
    });

    it("blocks BASIC_VERIFIED user from listing over cap", async () => {
      const user = await createTestUser({ email: "gate-list-over@test.com" });
      const admin = await createTestUser({ email: "gate-admin-over@test.com" });

      await approveBasicKYC(user.id, admin.id);

      await expect(
        assertCanCreateListing(user.id, KYC_BASIC_LISTING_CAP_CENTS + 1),
      ).rejects.toThrow(/require Enhanced KYC/);
    });

    it("allows ENHANCED_VERIFIED user to list over cap", async () => {
      const user = await createTestUser({ email: "gate-list-enh@test.com" });
      const admin = await createTestUser({ email: "gate-admin-enhl@test.com" });

      await fullyVerifyUser(user.id, admin.id);

      await expect(
        assertCanCreateListing(user.id, KYC_BASIC_LISTING_CAP_CENTS + 100_000),
      ).resolves.toBeUndefined();
    });
  });

  // ─── Trade Gate ──────────────────────────────────────

  describe("assertCanTrade", () => {
    it("blocks UNVERIFIED users from trading", async () => {
      const user = await createTestUser({ email: "gate-trade-unv@test.com" });

      await expect(assertCanTrade(user.id, 1000)).rejects.toThrow(
        /KYC verification required to trade/,
      );
    });

    it("allows BASIC_VERIFIED user to trade under cap", async () => {
      const user = await createTestUser({ email: "gate-trade-basic@test.com" });
      const admin = await createTestUser({ email: "gate-admin-trade@test.com" });

      await approveBasicKYC(user.id, admin.id);

      await expect(assertCanTrade(user.id, KYC_BASIC_TRADE_CAP_CENTS)).resolves.toBeUndefined();
    });

    it("blocks BASIC_VERIFIED user from high-value trade", async () => {
      const user = await createTestUser({ email: "gate-trade-high@test.com" });
      const admin = await createTestUser({ email: "gate-admin-thigh@test.com" });

      await approveBasicKYC(user.id, admin.id);

      await expect(assertCanTrade(user.id, KYC_BASIC_TRADE_CAP_CENTS + 1)).rejects.toThrow(
        /require Enhanced KYC/,
      );
    });

    it("allows ENHANCED_VERIFIED user for high-value trade", async () => {
      const user = await createTestUser({ email: "gate-trade-enh@test.com" });
      const admin = await createTestUser({ email: "gate-admin-tenh@test.com" });

      await fullyVerifyUser(user.id, admin.id);

      await expect(
        assertCanTrade(user.id, KYC_BASIC_TRADE_CAP_CENTS + 500_000),
      ).resolves.toBeUndefined();
    });
  });

  // ─── Authenticator Gate ──────────────────────────────

  describe("assertCanApplyAsAuthenticator", () => {
    it("blocks UNVERIFIED user from applying", async () => {
      const user = await createTestUser({ email: "gate-auth-unv@test.com" });

      await expect(assertCanApplyAsAuthenticator(user.id)).rejects.toThrow(
        /Enhanced KYC verification required/,
      );
    });

    it("blocks BASIC_VERIFIED user from applying", async () => {
      const user = await createTestUser({ email: "gate-auth-basic@test.com" });
      const admin = await createTestUser({ email: "gate-admin-authb@test.com" });

      await approveBasicKYC(user.id, admin.id);

      await expect(assertCanApplyAsAuthenticator(user.id)).rejects.toThrow(
        /Enhanced KYC verification required/,
      );
    });

    it("allows ENHANCED_VERIFIED user to apply", async () => {
      const user = await createTestUser({ email: "gate-auth-enh@test.com" });
      const admin = await createTestUser({ email: "gate-admin-authenh@test.com" });

      await fullyVerifyUser(user.id, admin.id);

      await expect(assertCanApplyAsAuthenticator(user.id)).resolves.toBeUndefined();
    });
  });

  // ─── SUSPENDED user gates ────────────────────────────

  describe("Suspended user enforcement", () => {
    it("blocks SUSPENDED user from creating listings", async () => {
      const user = await createTestUser({ email: "gate-susp-list@test.com" });
      const admin = await createTestUser({ email: "gate-admin-susp@test.com" });

      await approveBasicKYC(user.id, admin.id);
      const { suspendKYC } = await import("@/server/services/kyc.service");
      await suspendKYC(user.id, admin.id, "Investigation");

      await expect(assertCanCreateListing(user.id, 1000)).rejects.toThrow(
        /KYC verification required/,
      );
    });

    it("blocks SUSPENDED user from trading", async () => {
      const user = await createTestUser({ email: "gate-susp-trade@test.com" });
      const admin = await createTestUser({ email: "gate-admin-suspt@test.com" });

      await approveBasicKYC(user.id, admin.id);
      const { suspendKYC } = await import("@/server/services/kyc.service");
      await suspendKYC(user.id, admin.id, "Investigation");

      await expect(assertCanTrade(user.id, 1000)).rejects.toThrow(/KYC verification required/);
    });

    it("blocks SUSPENDED user from authenticator application", async () => {
      const user = await createTestUser({ email: "gate-susp-auth@test.com" });
      const admin = await createTestUser({ email: "gate-admin-suspa@test.com" });

      await fullyVerifyUser(user.id, admin.id);
      const { suspendKYC } = await import("@/server/services/kyc.service");
      await suspendKYC(user.id, admin.id, "Investigation");

      await expect(assertCanApplyAsAuthenticator(user.id)).rejects.toThrow(
        /Enhanced KYC verification required/,
      );
    });
  });
});
