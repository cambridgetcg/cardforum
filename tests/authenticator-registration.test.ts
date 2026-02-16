import { describe, it, expect, afterAll, beforeEach } from "vitest";
import {
  getTestDb,
  disconnectDb,
  createTestUser,
  createTestRegion,
  cleanupTestData,
  fullyVerifyUser,
} from "./helpers";
import {
  submitApplication,
  reviewApplication,
  activateAuthenticator,
  getAuthenticatorProfile,
  listApplications,
  listRegions,
} from "@/server/services/authenticator.service";
import { getTierEligibility } from "@/server/services/tier-promotion.service";

const db = getTestDb();

describe("Authenticator Registration", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectDb();
  });

  const validApplicationInput = {
    region: "Tokyo",
    tcgExpertise: ["POKEMON" as const],
    experienceDesc: "10 years of Pokemon card grading and authentication experience",
    proofOfExpertise: ["https://example.com/my-profile"],
  };

  /** Create a user with Enhanced KYC (required for authenticator application). */
  async function createVerifiedUser(email: string, opts?: { name?: string; region?: string }) {
    const kycAdmin = await createTestUser({ email: `kyc-admin-${Date.now()}@test.com` });
    const user = await createTestUser({ email, ...opts });
    await fullyVerifyUser(user.id, kycAdmin.id);
    return user;
  }

  // ─── Application Submission ────────────────────────

  describe("submitApplication", () => {
    it("creates a new authenticator application in SUBMITTED status", async () => {
      const user = await createVerifiedUser("auth-reg-submit@test.com");

      const auth = await submitApplication(user.id, validApplicationInput);

      expect(auth.id).toBeTruthy();
      expect(auth.userId).toBe(user.id);
      expect(auth.applicationStatus).toBe("SUBMITTED");
      expect(auth.region).toBe("Tokyo");
      expect(auth.tcgExpertise).toEqual(["POKEMON"]);
      expect(auth.tier).toBe("STANDARD");
      // NOTE: isActive defaults to true in schema — submitted authenticators are
      // technically "active" in the DB but gated by applicationStatus !== "ACTIVE"
      // in service layer checks. This is a design choice, not a bug.
      expect(auth.isActive).toBe(true);
      expect(auth.appliedAt).toBeTruthy();
    });

    it("accepts optional business name", async () => {
      const user = await createVerifiedUser("auth-reg-biz@test.com");

      const auth = await submitApplication(user.id, {
        ...validApplicationInput,
        businessName: "Card Auth Co.",
      });

      expect(auth.businessName).toBe("Card Auth Co.");
    });

    it("accepts multiple TCG expertise", async () => {
      const user = await createVerifiedUser("auth-reg-multi@test.com");

      const auth = await submitApplication(user.id, {
        ...validApplicationInput,
        tcgExpertise: ["POKEMON", "YUGIOH", "MTG"],
      });

      expect(auth.tcgExpertise).toEqual(["POKEMON", "YUGIOH", "MTG"]);
    });

    it("rejects duplicate application if already SUBMITTED", async () => {
      const user = await createVerifiedUser("auth-reg-dup@test.com");

      await submitApplication(user.id, validApplicationInput);

      await expect(submitApplication(user.id, validApplicationInput)).rejects.toThrow(
        "You already have an application in status: SUBMITTED",
      );
    });

    it("rejects duplicate if already ACTIVE", async () => {
      const user = await createVerifiedUser("auth-reg-active@test.com");

      await db.authenticator.create({
        data: {
          userId: user.id,
          ...validApplicationInput,
          applicationStatus: "ACTIVE",
          isActive: true,
          appliedAt: new Date(),
          approvedAt: new Date(),
        },
      });

      await expect(submitApplication(user.id, validApplicationInput)).rejects.toThrow(
        "You already have an application in status: ACTIVE",
      );
    });

    it("allows reapply from REVOKED after 30 days", async () => {
      const user = await createVerifiedUser("auth-reg-revoked@test.com");

      // Create a revoked application from 31 days ago
      await db.authenticator.create({
        data: {
          userId: user.id,
          ...validApplicationInput,
          applicationStatus: "REVOKED",
          appliedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        },
      });

      const auth = await submitApplication(user.id, validApplicationInput);
      expect(auth.applicationStatus).toBe("SUBMITTED");
    });

    it("blocks reapply from REVOKED within 30 days", async () => {
      const user = await createVerifiedUser("auth-reg-revoked30@test.com");

      await db.authenticator.create({
        data: {
          userId: user.id,
          ...validApplicationInput,
          applicationStatus: "REVOKED",
          appliedAt: new Date(),
          updatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        },
      });

      await expect(submitApplication(user.id, validApplicationInput)).rejects.toThrow(
        "Cannot reapply within 30 days of revocation",
      );
    });
  });

  // ─── Application Review (Admin) ────────────────────

  describe("reviewApplication", () => {
    it("approves a SUBMITTED application (compound transition)", async () => {
      const user = await createVerifiedUser("auth-reg-approve@test.com");
      const adminUser = await createTestUser({ email: "auth-reg-admin@test.com" });

      const auth = await submitApplication(user.id, validApplicationInput);

      const updated = await reviewApplication(auth.id, adminUser.id, {
        action: "approve",
        notes: "Great experience",
      });

      expect(updated.applicationStatus).toBe("APPROVED");
      expect(updated.approvedAt).toBeTruthy();
    });

    it("creates audit trail for review", async () => {
      const user = await createVerifiedUser("auth-reg-audit@test.com");
      const adminUser = await createTestUser({ email: "auth-reg-admin2@test.com" });

      const auth = await submitApplication(user.id, validApplicationInput);
      await reviewApplication(auth.id, adminUser.id, {
        action: "approve",
      });

      const audits = await db.authenticatorAudit.findMany({
        where: { authenticatorId: auth.id },
      });
      expect(audits).toHaveLength(1);
      expect(audits[0].type).toBe("APPLICATION_REVIEW");

      const details = audits[0].details as Record<string, unknown>;
      expect(details.action).toBe("approve");
      expect(details.reviewerId).toBe(adminUser.id);
      expect(details.previousStatus).toBe("SUBMITTED");
      expect(details.newStatus).toBe("APPROVED");
    });

    it("rejects a SUBMITTED application", async () => {
      const user = await createVerifiedUser("auth-reg-reject@test.com");
      const adminUser = await createTestUser({ email: "auth-reg-admin3@test.com" });

      const auth = await submitApplication(user.id, validApplicationInput);

      const updated = await reviewApplication(auth.id, adminUser.id, {
        action: "reject",
        notes: "Insufficient experience",
      });

      expect(updated.applicationStatus).toBe("REVOKED");
    });

    it("requests more info from SUBMITTED application", async () => {
      const user = await createVerifiedUser("auth-reg-moreinfo@test.com");
      const adminUser = await createTestUser({ email: "auth-reg-admin4@test.com" });

      const auth = await submitApplication(user.id, validApplicationInput);

      const updated = await reviewApplication(auth.id, adminUser.id, {
        action: "request_info",
        notes: "Please provide more proof",
      });

      expect(updated.applicationStatus).toBe("MORE_INFO_NEEDED");
    });
  });

  // ─── Activation ────────────────────────────────────

  describe("activateAuthenticator", () => {
    it("activates an APPROVED authenticator", async () => {
      const user = await createVerifiedUser("auth-reg-activate@test.com");
      const adminUser = await createTestUser({ email: "auth-reg-admin5@test.com" });

      const auth = await submitApplication(user.id, validApplicationInput);
      await reviewApplication(auth.id, adminUser.id, { action: "approve" });

      const activated = await activateAuthenticator(auth.id);

      expect(activated.applicationStatus).toBe("ACTIVE");
      expect(activated.isActive).toBe(true);
      expect(activated.lastActiveAt).toBeTruthy();
    });

    it("rejects activation of non-APPROVED authenticator", async () => {
      const user = await createVerifiedUser("auth-reg-badactivate@test.com");
      const auth = await submitApplication(user.id, validApplicationInput);

      await expect(activateAuthenticator(auth.id)).rejects.toThrow(
        "Authenticator must be APPROVED or ONBOARDING to activate",
      );
    });
  });

  // ─── Full Lifecycle ────────────────────────────────

  describe("Full registration lifecycle", () => {
    it("completes the entire journey: register → apply → review → activate → dashboard", async () => {
      // Step 1: User registers and completes Enhanced KYC
      const user = await createVerifiedUser("auth-reg-lifecycle@test.com", {
        name: "Lifecycle Tester",
        region: "Tokyo",
      });
      expect(user.id).toBeTruthy();

      // Step 2: User applies to become authenticator
      const auth = await submitApplication(user.id, {
        ...validApplicationInput,
        businessName: "Lifecycle Auth Co.",
      });
      expect(auth.applicationStatus).toBe("SUBMITTED");

      // Step 3: Admin reviews and approves
      const admin = await createTestUser({ email: "auth-reg-lifecycle-admin@test.com" });
      const approved = await reviewApplication(auth.id, admin.id, {
        action: "approve",
        notes: "Approved for testing",
      });
      expect(approved.applicationStatus).toBe("APPROVED");

      // Step 4: Authenticator completes onboarding (activation)
      const activated = await activateAuthenticator(auth.id);
      expect(activated.applicationStatus).toBe("ACTIVE");
      expect(activated.isActive).toBe(true);

      // Step 5: Dashboard data loads correctly
      const profile = await getAuthenticatorProfile(user.id);
      expect(profile).toBeTruthy();
      expect(profile!.tier).toBe("STANDARD");
      expect(profile!.rating).toBe(5.0); // default
      expect(profile!.currentLoad).toBe(0);
      expect(profile!.businessName).toBe("Lifecycle Auth Co.");

      // Step 6: Tier eligibility check works
      const eligibility = await getTierEligibility(user.id);
      expect(eligibility.currentTier).toBe("STANDARD");
      expect(eligibility.nextTierProgress).toBeTruthy();
      expect(eligibility.nextTierProgress!.targetTier).toBe("VERIFIED");
      expect(eligibility.nextTierProgress!.verifications.current).toBe(0);
      expect(eligibility.nextTierProgress!.verifications.required).toBe(50);
    });
  });

  // ─── Regions ───────────────────────────────────────

  describe("Regions", () => {
    it("lists available regions", async () => {
      await createTestRegion("JP", "Tokyo");
      await createTestRegion("US", "New York");

      const regions = await listRegions();
      expect(regions.length).toBeGreaterThanOrEqual(2);

      const tokyo = regions.find((r) => r.name === "Tokyo");
      expect(tokyo).toBeTruthy();
      expect(tokyo!.country).toBe("JP");
    });
  });

  // ─── Application Listing (Admin) ───────────────────

  describe("listApplications", () => {
    it("lists pending applications for admin review", async () => {
      const user1 = await createVerifiedUser("auth-reg-list1@test.com");
      const user2 = await createVerifiedUser("auth-reg-list2@test.com");

      await submitApplication(user1.id, validApplicationInput);
      await submitApplication(user2.id, {
        ...validApplicationInput,
        region: "London",
      });

      const apps = await listApplications("SUBMITTED");
      expect(apps.length).toBeGreaterThanOrEqual(2);

      // Verify includes user info
      const app = apps[0];
      expect(app.user).toBeTruthy();
      expect(app.user.email).toBeTruthy();
    });
  });
});
