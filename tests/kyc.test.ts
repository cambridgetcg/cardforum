import { describe, it, expect, afterAll, beforeEach } from "vitest";
import {
  getTestDb,
  disconnectDb,
  createTestUser,
  cleanupTestData,
  makeBasicKYCDocs,
  makeEnhancedKYCDocs,
  approveBasicKYC,
  approveEnhancedKYC,
  fullyVerifyUser,
} from "./helpers";
import {
  submitBasicKYC,
  submitEnhancedKYC,
  getKYCStatus,
  listPendingKYC,
  reviewKYC,
  suspendKYC,
  revokeKYC,
  reinstateKYC,
  getUserKYCLevel,
} from "@/server/services/kyc.service";
import { getKYCLevel, kycLevelMeetsMinimum, canTransitionKYC } from "@/types/domain";

const db = getTestDb();

describe("KYC System", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectDb();
  });

  // ─── Pure Domain Helpers ─────────────────────────────

  describe("Domain helpers (pure functions)", () => {
    it("getKYCLevel returns correct level for each status", () => {
      expect(getKYCLevel("UNVERIFIED")).toBe("UNVERIFIED");
      expect(getKYCLevel("BASIC_PENDING")).toBe("UNVERIFIED");
      expect(getKYCLevel("BASIC_VERIFIED")).toBe("BASIC");
      expect(getKYCLevel("BASIC_REJECTED")).toBe("UNVERIFIED");
      expect(getKYCLevel("ENHANCED_PENDING")).toBe("UNVERIFIED");
      expect(getKYCLevel("ENHANCED_VERIFIED")).toBe("ENHANCED");
      expect(getKYCLevel("ENHANCED_REJECTED")).toBe("UNVERIFIED");
      expect(getKYCLevel("SUSPENDED")).toBe("UNVERIFIED");
      expect(getKYCLevel("REVOKED")).toBe("UNVERIFIED");
    });

    it("kycLevelMeetsMinimum checks hierarchy correctly", () => {
      expect(kycLevelMeetsMinimum("UNVERIFIED", "BASIC")).toBe(false);
      expect(kycLevelMeetsMinimum("BASIC", "BASIC")).toBe(true);
      expect(kycLevelMeetsMinimum("BASIC", "ENHANCED")).toBe(false);
      expect(kycLevelMeetsMinimum("ENHANCED", "BASIC")).toBe(true);
      expect(kycLevelMeetsMinimum("ENHANCED", "ENHANCED")).toBe(true);
    });

    it("canTransitionKYC validates allowed transitions", () => {
      expect(canTransitionKYC("UNVERIFIED", "BASIC_PENDING")).toBe(true);
      expect(canTransitionKYC("UNVERIFIED", "ENHANCED_PENDING")).toBe(false);
      expect(canTransitionKYC("BASIC_PENDING", "BASIC_VERIFIED")).toBe(true);
      expect(canTransitionKYC("BASIC_PENDING", "BASIC_REJECTED")).toBe(true);
      expect(canTransitionKYC("BASIC_VERIFIED", "ENHANCED_PENDING")).toBe(true);
      expect(canTransitionKYC("BASIC_VERIFIED", "SUSPENDED")).toBe(true);
      expect(canTransitionKYC("BASIC_REJECTED", "BASIC_PENDING")).toBe(true);
      expect(canTransitionKYC("ENHANCED_VERIFIED", "SUSPENDED")).toBe(true);
      expect(canTransitionKYC("SUSPENDED", "REVOKED")).toBe(true);
      expect(canTransitionKYC("SUSPENDED", "BASIC_VERIFIED")).toBe(true);
      expect(canTransitionKYC("SUSPENDED", "ENHANCED_VERIFIED")).toBe(true);
      expect(canTransitionKYC("REVOKED", "BASIC_PENDING")).toBe(false);
    });
  });

  // ─── Basic KYC Submission ────────────────────────────

  describe("Basic KYC submission", () => {
    it("submits basic KYC from UNVERIFIED", async () => {
      const user = await createTestUser({ email: "kyc-basic@test.com" });
      const updated = await submitBasicKYC(user.id, makeBasicKYCDocs());

      expect(updated.kycStatus).toBe("BASIC_PENDING");

      // Documents created
      const docs = await db.kYCDocument.findMany({ where: { userId: user.id } });
      expect(docs).toHaveLength(2);
      expect(docs.map((d) => d.type).sort()).toEqual(["GOVERNMENT_ID", "SELFIE"]);

      // Audit trail created
      const audits = await db.kYCAudit.findMany({ where: { userId: user.id } });
      expect(audits).toHaveLength(1);
      expect(audits[0].action).toBe("SUBMIT_BASIC");
      expect(audits[0].fromStatus).toBe("UNVERIFIED");
      expect(audits[0].toStatus).toBe("BASIC_PENDING");
    });

    it("resubmits basic KYC after rejection", async () => {
      const user = await createTestUser({ email: "kyc-resubmit@test.com" });
      const admin = await createTestUser({ email: "kyc-admin-resub@test.com" });

      await submitBasicKYC(user.id, makeBasicKYCDocs());
      await reviewKYC(user.id, admin.id, { action: "reject", reason: "Blurry photo" });

      // User should be BASIC_REJECTED
      const rejected = await db.user.findUnique({ where: { id: user.id } });
      expect(rejected!.kycStatus).toBe("BASIC_REJECTED");

      // Resubmit
      const resubmitted = await submitBasicKYC(user.id, makeBasicKYCDocs());
      expect(resubmitted.kycStatus).toBe("BASIC_PENDING");
    });

    it("rejects basic KYC submission from invalid status", async () => {
      const user = await createTestUser({ email: "kyc-invalid@test.com" });
      const admin = await createTestUser({ email: "kyc-admin-inv@test.com" });

      // Get to BASIC_VERIFIED
      await approveBasicKYC(user.id, admin.id);

      // Cannot re-submit basic from BASIC_VERIFIED
      await expect(submitBasicKYC(user.id, makeBasicKYCDocs())).rejects.toThrow(
        /Cannot submit basic KYC from status/,
      );
    });
  });

  // ─── Enhanced KYC Submission ─────────────────────────

  describe("Enhanced KYC submission", () => {
    it("submits enhanced KYC from BASIC_VERIFIED", async () => {
      const user = await createTestUser({ email: "kyc-enhanced@test.com" });
      const admin = await createTestUser({ email: "kyc-admin-enh@test.com" });

      await approveBasicKYC(user.id, admin.id);
      const updated = await submitEnhancedKYC(user.id, makeEnhancedKYCDocs());

      expect(updated.kycStatus).toBe("ENHANCED_PENDING");

      const docs = await db.kYCDocument.findMany({
        where: { userId: user.id, type: "PROOF_OF_ADDRESS" },
      });
      expect(docs).toHaveLength(1);
    });

    it("rejects enhanced KYC from UNVERIFIED", async () => {
      const user = await createTestUser({ email: "kyc-enh-unver@test.com" });

      await expect(submitEnhancedKYC(user.id, makeEnhancedKYCDocs())).rejects.toThrow(
        /Cannot submit enhanced KYC from status/,
      );
    });

    it("resubmits enhanced KYC after rejection", async () => {
      const user = await createTestUser({ email: "kyc-enh-resub@test.com" });
      const admin = await createTestUser({ email: "kyc-admin-enhresub@test.com" });

      await approveBasicKYC(user.id, admin.id);
      await submitEnhancedKYC(user.id, makeEnhancedKYCDocs());
      await reviewKYC(user.id, admin.id, { action: "reject", reason: "Expired document" });

      const rejected = await db.user.findUnique({ where: { id: user.id } });
      expect(rejected!.kycStatus).toBe("ENHANCED_REJECTED");

      const resubmitted = await submitEnhancedKYC(user.id, makeEnhancedKYCDocs());
      expect(resubmitted.kycStatus).toBe("ENHANCED_PENDING");
    });
  });

  // ─── KYC Review (Admin) ──────────────────────────────

  describe("KYC review (admin)", () => {
    it("approves basic KYC", async () => {
      const user = await createTestUser({ email: "kyc-approve@test.com" });
      const admin = await createTestUser({ email: "kyc-admin-approve@test.com" });

      await submitBasicKYC(user.id, makeBasicKYCDocs());
      const approved = await reviewKYC(user.id, admin.id, { action: "approve" });

      expect(approved.kycStatus).toBe("BASIC_VERIFIED");
      expect(approved.kycVerifiedAt).toBeTruthy();
      expect(approved.kycReviewedBy).toBe(admin.id);

      // Documents marked as APPROVED
      const docs = await db.kYCDocument.findMany({ where: { userId: user.id } });
      expect(docs.every((d) => d.status === "APPROVED")).toBe(true);
      expect(docs.every((d) => d.verifiedBy === admin.id)).toBe(true);
    });

    it("rejects basic KYC with reason", async () => {
      const user = await createTestUser({ email: "kyc-reject@test.com" });
      const admin = await createTestUser({ email: "kyc-admin-reject@test.com" });

      await submitBasicKYC(user.id, makeBasicKYCDocs());
      const rejected = await reviewKYC(user.id, admin.id, {
        action: "reject",
        reason: "Photo too blurry",
      });

      expect(rejected.kycStatus).toBe("BASIC_REJECTED");
      expect(rejected.kycRejectionReason).toBe("Photo too blurry");

      // Documents marked as REJECTED
      const docs = await db.kYCDocument.findMany({ where: { userId: user.id } });
      expect(docs.every((d) => d.status === "REJECTED")).toBe(true);
    });

    it("approves enhanced KYC", async () => {
      const user = await createTestUser({ email: "kyc-enh-approve@test.com" });
      const admin = await createTestUser({ email: "kyc-admin-enappr@test.com" });

      await approveBasicKYC(user.id, admin.id);
      await submitEnhancedKYC(user.id, makeEnhancedKYCDocs());
      const approved = await reviewKYC(user.id, admin.id, { action: "approve" });

      expect(approved.kycStatus).toBe("ENHANCED_VERIFIED");
    });

    it("rejects review from non-pending status", async () => {
      const user = await createTestUser({ email: "kyc-rev-invalid@test.com" });
      const admin = await createTestUser({ email: "kyc-admin-revinv@test.com" });

      // UNVERIFIED user — cannot approve
      await expect(reviewKYC(user.id, admin.id, { action: "approve" })).rejects.toThrow(
        /Cannot approve from status/,
      );
    });
  });

  // ─── Suspend / Revoke / Reinstate ────────────────────

  describe("Suspend, revoke, reinstate", () => {
    it("suspends a BASIC_VERIFIED user", async () => {
      const user = await createTestUser({ email: "kyc-suspend@test.com" });
      const admin = await createTestUser({ email: "kyc-admin-susp@test.com" });

      await approveBasicKYC(user.id, admin.id);
      const suspended = await suspendKYC(user.id, admin.id, "Suspicious activity");

      expect(suspended.kycStatus).toBe("SUSPENDED");

      const audit = await db.kYCAudit.findFirst({
        where: { userId: user.id, action: "SUSPEND" },
      });
      expect(audit).toBeTruthy();
      expect(audit!.reason).toBe("Suspicious activity");
    });

    it("suspends an ENHANCED_VERIFIED user", async () => {
      const user = await createTestUser({ email: "kyc-susp-enh@test.com" });
      const admin = await createTestUser({ email: "kyc-admin-suspenh@test.com" });

      await fullyVerifyUser(user.id, admin.id);
      const suspended = await suspendKYC(user.id, admin.id, "Investigation");

      expect(suspended.kycStatus).toBe("SUSPENDED");
    });

    it("cannot suspend a non-verified user", async () => {
      const user = await createTestUser({ email: "kyc-susp-unv@test.com" });
      const admin = await createTestUser({ email: "kyc-admin-suspunv@test.com" });

      await expect(suspendKYC(user.id, admin.id, "Reason")).rejects.toThrow(
        /Cannot suspend from status/,
      );
    });

    it("revokes a SUSPENDED user", async () => {
      const user = await createTestUser({ email: "kyc-revoke@test.com" });
      const admin = await createTestUser({ email: "kyc-admin-revoke@test.com" });

      await approveBasicKYC(user.id, admin.id);
      await suspendKYC(user.id, admin.id, "Suspicious activity");
      const revoked = await revokeKYC(user.id, admin.id, "Confirmed fraud");

      expect(revoked.kycStatus).toBe("REVOKED");

      const audit = await db.kYCAudit.findFirst({
        where: { userId: user.id, action: "REVOKE" },
      });
      expect(audit!.reason).toBe("Confirmed fraud");
    });

    it("cannot revoke a non-suspended user", async () => {
      const user = await createTestUser({ email: "kyc-revoke-inv@test.com" });
      const admin = await createTestUser({ email: "kyc-admin-revokeinv@test.com" });

      await approveBasicKYC(user.id, admin.id);

      await expect(revokeKYC(user.id, admin.id, "Reason")).rejects.toThrow(
        /Cannot revoke from status.*Must be SUSPENDED/,
      );
    });

    it("reinstates a SUSPENDED user to BASIC_VERIFIED", async () => {
      const user = await createTestUser({ email: "kyc-reinstate@test.com" });
      const admin = await createTestUser({ email: "kyc-admin-reinstate@test.com" });

      await approveBasicKYC(user.id, admin.id);
      await suspendKYC(user.id, admin.id, "Investigation");
      const reinstated = await reinstateKYC(user.id, admin.id, "BASIC_VERIFIED");

      expect(reinstated.kycStatus).toBe("BASIC_VERIFIED");
      expect(reinstated.kycVerifiedAt).toBeTruthy();
    });

    it("reinstates a SUSPENDED user to ENHANCED_VERIFIED", async () => {
      const user = await createTestUser({ email: "kyc-reinstate-enh@test.com" });
      const admin = await createTestUser({ email: "kyc-admin-reinsnh@test.com" });

      await fullyVerifyUser(user.id, admin.id);
      await suspendKYC(user.id, admin.id, "Investigation");
      const reinstated = await reinstateKYC(user.id, admin.id, "ENHANCED_VERIFIED");

      expect(reinstated.kycStatus).toBe("ENHANCED_VERIFIED");
    });

    it("cannot reinstate a non-suspended user", async () => {
      const user = await createTestUser({ email: "kyc-reinst-inv@test.com" });
      const admin = await createTestUser({ email: "kyc-admin-reinstinv@test.com" });

      await approveBasicKYC(user.id, admin.id);

      await expect(reinstateKYC(user.id, admin.id, "BASIC_VERIFIED")).rejects.toThrow(
        /Cannot reinstate from status.*Must be SUSPENDED/,
      );
    });
  });

  // ─── Status Query ────────────────────────────────────

  describe("KYC status query", () => {
    it("returns status and documents for a user", async () => {
      const user = await createTestUser({ email: "kyc-status@test.com" });
      const admin = await createTestUser({ email: "kyc-admin-status@test.com" });

      await approveBasicKYC(user.id, admin.id);
      const status = await getKYCStatus(user.id);

      expect(status.status).toBe("BASIC_VERIFIED");
      expect(status.verifiedAt).toBeTruthy();
      expect(status.documents).toHaveLength(2);
    });

    it("getUserKYCLevel returns correct level", async () => {
      const user = await createTestUser({ email: "kyc-level@test.com" });

      expect(await getUserKYCLevel(user.id)).toBe("UNVERIFIED");

      const admin = await createTestUser({ email: "kyc-admin-level@test.com" });
      await approveBasicKYC(user.id, admin.id);
      expect(await getUserKYCLevel(user.id)).toBe("BASIC");

      await approveEnhancedKYC(user.id, admin.id);
      expect(await getUserKYCLevel(user.id)).toBe("ENHANCED");
    });
  });

  // ─── Pending List ────────────────────────────────────

  describe("Pending KYC list (admin)", () => {
    it("lists users with pending KYC", async () => {
      const user1 = await createTestUser({ email: "kyc-pending1@test.com" });
      const user2 = await createTestUser({ email: "kyc-pending2@test.com" });

      await submitBasicKYC(user1.id, makeBasicKYCDocs());
      await submitBasicKYC(user2.id, makeBasicKYCDocs());

      const pending = await listPendingKYC();
      expect(pending).toHaveLength(2);
    });

    it("filters by status", async () => {
      const user1 = await createTestUser({ email: "kyc-filter1@test.com" });
      const user2 = await createTestUser({ email: "kyc-filter2@test.com" });
      const admin = await createTestUser({ email: "kyc-admin-filter@test.com" });

      await submitBasicKYC(user1.id, makeBasicKYCDocs());
      await approveBasicKYC(user2.id, admin.id);
      await submitEnhancedKYC(user2.id, makeEnhancedKYCDocs());

      const basicPending = await listPendingKYC("BASIC_PENDING");
      expect(basicPending).toHaveLength(1);
      expect(basicPending[0].id).toBe(user1.id);

      const enhancedPending = await listPendingKYC("ENHANCED_PENDING");
      expect(enhancedPending).toHaveLength(1);
      expect(enhancedPending[0].id).toBe(user2.id);
    });
  });

  // ─── Full Lifecycle ──────────────────────────────────

  describe("Full KYC lifecycle", () => {
    it("walks through UNVERIFIED → BASIC → ENHANCED → SUSPENDED → REINSTATED", async () => {
      const user = await createTestUser({ email: "kyc-lifecycle@test.com" });
      const admin = await createTestUser({ email: "kyc-admin-lifecycle@test.com" });

      // 1. UNVERIFIED → BASIC_PENDING → BASIC_VERIFIED
      await submitBasicKYC(user.id, makeBasicKYCDocs());
      await reviewKYC(user.id, admin.id, { action: "approve" });
      let u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(u.kycStatus).toBe("BASIC_VERIFIED");

      // 2. BASIC_VERIFIED → ENHANCED_PENDING → ENHANCED_VERIFIED
      await submitEnhancedKYC(user.id, makeEnhancedKYCDocs());
      await reviewKYC(user.id, admin.id, { action: "approve" });
      u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(u.kycStatus).toBe("ENHANCED_VERIFIED");

      // 3. ENHANCED_VERIFIED → SUSPENDED
      await suspendKYC(user.id, admin.id, "Suspicious activity");
      u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(u.kycStatus).toBe("SUSPENDED");

      // 4. SUSPENDED → ENHANCED_VERIFIED (reinstate)
      await reinstateKYC(user.id, admin.id, "ENHANCED_VERIFIED");
      u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(u.kycStatus).toBe("ENHANCED_VERIFIED");

      // Verify audit trail has all transitions
      const audits = await db.kYCAudit.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      });
      expect(audits.map((a) => a.action)).toEqual([
        "SUBMIT_BASIC",
        "APPROVE",
        "SUBMIT_ENHANCED",
        "APPROVE",
        "SUSPEND",
        "REINSTATE",
      ]);
    });
  });
});
