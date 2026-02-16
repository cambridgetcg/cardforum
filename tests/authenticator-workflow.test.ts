import { describe, it, expect, afterAll, beforeEach } from "vitest";
import {
  getTestDb,
  disconnectDb,
  createTestUser,
  createTestAuthenticator,
  createTestRegion,
  seedTestCard,
  cleanupTestData,
} from "./helpers";
import {
  submitVerificationResult,
  getVerificationAssignment,
  assignForLegs,
} from "@/server/services/authenticator.service";
import { submitRating } from "@/server/services/authenticator-rating.service";
import { computeWeightedScore, computeTimeWeightedRating } from "@/lib/authenticator-ratings";
import { calculateVerificationFee, calculateTradeFees } from "@/lib/authenticator-fees";
import { checkTierPromotion } from "@/server/services/tier-promotion.service";

const db = getTestDb();

// Helper to create a trade with a leg for testing
async function createTestTrade(opts: {
  senderUserId: string;
  receiverUserId: string;
  region: string;
  askPrice: number;
}) {
  const card = await seedTestCard();

  // Create have listing
  const haveListing = await db.haveListing.create({
    data: {
      userId: opts.senderUserId,
      cardId: card.id,
      condition: "NM",
      language: "EN",
      quantity: 1,
      askPrice: opts.askPrice,
    },
  });

  // Create want listing
  const wantListing = await db.wantListing.create({
    data: {
      userId: opts.receiverUserId,
      cardId: card.id,
      minCondition: "NM",
      maxQuantity: 1,
      bidPrice: opts.askPrice,
    },
  });

  // Create match proposal (required relation for Trade)
  const proposal = await db.matchProposal.create({
    data: {
      score: 1.0,
      cycleLength: 2,
      regions: [opts.region],
      isViable: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // Create trade
  const trade = await db.trade.create({
    data: {
      proposalId: proposal.id,
      userAId: opts.senderUserId,
      userBId: opts.receiverUserId,
      status: "AUTHENTICATING",
      participantIds: [opts.senderUserId, opts.receiverUserId],
      statusHistory: [
        { status: "PROPOSED", at: new Date().toISOString() },
        { status: "AUTHENTICATING", at: new Date().toISOString() },
      ],
      legs: {
        create: {
          fromUserId: opts.senderUserId,
          toUserId: opts.receiverUserId,
          region: opts.region,
          haveListingId: haveListing.id,
          wantListingId: wantListing.id,
          status: "AUTHENTICATING",
          sequence: 0,
        },
      },
    },
    include: { legs: true },
  });

  return { trade, card, haveListing, wantListing, proposal };
}

describe("Authenticator Workflow", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectDb();
  });

  // ─── Pure Rating Computation ───────────────────────

  describe("Rating computation", () => {
    it("computes weighted score from 4 components", async () => {
      const score = await computeWeightedScore({
        score: 4.65,
        accuracyScore: 5.0,
        speedScore: 4.0,
        satisfactionScore: 5.0,
        communicationScore: 4.0,
        createdAt: new Date(),
      });
      // 5*0.4 + 4*0.2 + 5*0.25 + 4*0.15 = 2.0 + 0.8 + 1.25 + 0.6 = 4.65
      expect(score).toBeCloseTo(4.65, 2);
    });

    it("returns simple average when components are null", async () => {
      const score = await computeWeightedScore({
        accuracyScore: null,
        speedScore: null,
        satisfactionScore: null,
        communicationScore: null,
        score: 4.0,
        createdAt: new Date(),
      });
      expect(score).toBeCloseTo(4.0, 2);
    });

    it("computes time-weighted rating with recency bias", async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oneHundredDaysAgo = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
      const twoHundredDaysAgo = new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000);

      const ratings = [
        { score: 5.0, accuracyScore: 5.0, speedScore: 5.0, satisfactionScore: 5.0, communicationScore: 5.0, createdAt: thirtyDaysAgo },
        { score: 3.0, accuracyScore: 3.0, speedScore: 3.0, satisfactionScore: 3.0, communicationScore: 3.0, createdAt: oneHundredDaysAgo },
        { score: 1.0, accuracyScore: 1.0, speedScore: 1.0, satisfactionScore: 1.0, communicationScore: 1.0, createdAt: twoHundredDaysAgo },
      ];

      const result = await computeTimeWeightedRating(ratings);
      // Recent (5.0) gets 60% weight, mid (3.0) gets 30%, old (1.0) gets 10%
      // Expected: 5.0*0.6 + 3.0*0.3 + 1.0*0.1 = 3.0 + 0.9 + 0.1 = 4.0
      expect(result).toBeCloseTo(4.0, 1);
    });

    it("returns default 5.0 for empty ratings (new authenticator)", async () => {
      const result = await computeTimeWeightedRating([]);
      expect(result).toBe(5.0);
    });
  });

  // ─── Fee Calculation ───────────────────────────────

  describe("Fee calculation", () => {
    it("calculates STANDARD tier fee", async () => {
      const fee = await calculateVerificationFee("STANDARD");
      expect(fee.baseFee).toBe(300);
      expect(fee.platformShare).toBe(90); // 30%
      expect(fee.authenticatorShare).toBe(210);
    });

    it("calculates VERIFIED tier fee", async () => {
      const fee = await calculateVerificationFee("VERIFIED");
      expect(fee.baseFee).toBe(400);
      expect(fee.platformShare).toBe(100); // 25%
      expect(fee.authenticatorShare).toBe(300);
    });

    it("calculates PREMIUM tier fee", async () => {
      const fee = await calculateVerificationFee("PREMIUM");
      expect(fee.baseFee).toBe(500);
      expect(fee.platformShare).toBe(100); // 20%
      expect(fee.authenticatorShare).toBe(400);
    });

    it("calculates trade fees across multiple legs", async () => {
      const result = await calculateTradeFees([
        { tier: "STANDARD" },
        { tier: "VERIFIED" },
      ]);
      expect(result.totalFees).toBe(700); // 300 + 400
      expect(result.totalPlatformShare).toBe(190); // 90 + 100
      expect(result.totalAuthenticatorShare).toBe(510); // 210 + 300
      expect(result.perLeg).toHaveLength(2);
    });
  });

  // ─── Verification Assignment ───────────────────────

  describe("Verification assignment", () => {
    it("assigns authenticator to trade legs", async () => {
      const sender = await createTestUser({ email: "wf-test-sender@test.com" });
      const receiver = await createTestUser({ email: "wf-test-receiver@test.com" });
      const authUser = await createTestUser({ email: "wf-test-auth@test.com" });
      await createTestAuthenticator(authUser.id, { region: "Tokyo" });

      const { trade } = await createTestTrade({
        senderUserId: sender.id,
        receiverUserId: receiver.id,
        region: "Tokyo",
        askPrice: 5000, // $50 — within STANDARD cap of $100
      });

      const assignments = await assignForLegs(trade.id);
      expect(assignments.length).toBe(1);

      const assignment = assignments[0];
      expect(assignment.tradeLegId).toBe(trade.legs[0].id);
    });

    it("throws if no authenticator available in region", async () => {
      const sender = await createTestUser({ email: "wf-test-sender2@test.com" });
      const receiver = await createTestUser({ email: "wf-test-receiver2@test.com" });

      const { trade } = await createTestTrade({
        senderUserId: sender.id,
        receiverUserId: receiver.id,
        region: "Antarctica", // no authenticator here
        askPrice: 5000,
      });

      await expect(assignForLegs(trade.id)).rejects.toThrow(
        /No eligible authenticator available/
      );
    });

    it("excludes trade participants from assignment", async () => {
      const sender = await createTestUser({ email: "wf-test-selfauth@test.com" });
      const receiver = await createTestUser({ email: "wf-test-selfauth-recv@test.com" });
      // Make sender also an authenticator — they should be excluded
      await createTestAuthenticator(sender.id, { region: "Tokyo" });

      const { trade } = await createTestTrade({
        senderUserId: sender.id,
        receiverUserId: receiver.id,
        region: "Tokyo",
        askPrice: 5000,
      });

      // Only the sender is an authenticator, and they're excluded
      await expect(assignForLegs(trade.id)).rejects.toThrow(
        /No eligible authenticator available/
      );
    });
  });

  // ─── Verification Result Submission ─────────────────

  describe("Verification result submission", () => {
    it("passes verification when authentic and condition matches", async () => {
      const sender = await createTestUser({ email: "wf-test-verify-sender@test.com" });
      const receiver = await createTestUser({ email: "wf-test-verify-receiver@test.com" });
      const authUser = await createTestUser({ email: "wf-test-verify-auth@test.com" });
      const auth = await createTestAuthenticator(authUser.id, { region: "Tokyo" });

      const { trade } = await createTestTrade({
        senderUserId: sender.id,
        receiverUserId: receiver.id,
        region: "Tokyo",
        askPrice: 5000,
      });

      // Assign authenticator
      const assignment = await db.verificationAssignment.create({
        data: {
          tradeLegId: trade.legs[0].id,
          authenticatorId: auth.id,
        },
      });

      // Submit passing verification
      const result = await submitVerificationResult(assignment.id, authUser.id, {
        authentic: true,
        conditionVerified: "NM",
        conditionMatchesListing: true,
        notes: "Card is in excellent condition",
        photos: ["https://img1.com", "https://img2.com", "https://img3.com", "https://img4.com"],
        defects: [],
        confidenceLevel: "HIGH",
        ccs: { surface: 9.0, corners: 9.0, edges: 9.0, centering: 9.0 },
      });

      expect(result.completedAt).toBeTruthy();

      // Check trade leg status
      const leg = await db.tradeLeg.findUnique({ where: { id: trade.legs[0].id } });
      expect(leg!.status).toBe("VERIFIED");

      // Check trade status (should be VERIFIED since all legs verified)
      const updatedTrade = await db.trade.findUnique({ where: { id: trade.id } });
      expect(updatedTrade!.status).toBe("VERIFIED");
    });

    it("fails verification and creates dispute on counterfeit", async () => {
      const sender = await createTestUser({ email: "wf-test-fake-sender@test.com" });
      const receiver = await createTestUser({ email: "wf-test-fake-receiver@test.com" });
      const authUser = await createTestUser({ email: "wf-test-fake-auth@test.com" });
      const auth = await createTestAuthenticator(authUser.id, { region: "Tokyo" });

      const { trade } = await createTestTrade({
        senderUserId: sender.id,
        receiverUserId: receiver.id,
        region: "Tokyo",
        askPrice: 5000,
      });

      const assignment = await db.verificationAssignment.create({
        data: {
          tradeLegId: trade.legs[0].id,
          authenticatorId: auth.id,
        },
      });

      await submitVerificationResult(assignment.id, authUser.id, {
        authentic: false,
        conditionVerified: "NM",
        conditionMatchesListing: true,
        notes: "Card is counterfeit — print quality mismatch",
        photos: ["https://img1.com", "https://img2.com", "https://img3.com", "https://img4.com"],
        defects: ["Print quality mismatch", "Wrong card stock"],
        confidenceLevel: "HIGH",
        ccs: { surface: 9.0, corners: 9.0, edges: 9.0, centering: 9.0 },
      });

      // Trade should be DISPUTED
      const updatedTrade = await db.trade.findUnique({ where: { id: trade.id } });
      expect(updatedTrade!.status).toBe("DISPUTED");

      // Dispute record should exist
      const disputes = await db.dispute.findMany({ where: { tradeId: trade.id } });
      expect(disputes.length).toBe(1);
      expect(disputes[0].reason).toContain("authenticity verification");
    });

    it("rejects unauthorized authenticator", async () => {
      const sender = await createTestUser({ email: "wf-test-unauth-sender@test.com" });
      const receiver = await createTestUser({ email: "wf-test-unauth-receiver@test.com" });
      const authUser = await createTestUser({ email: "wf-test-unauth-auth@test.com" });
      const otherUser = await createTestUser({ email: "wf-test-unauth-other@test.com" });
      const auth = await createTestAuthenticator(authUser.id, { region: "Tokyo" });

      const { trade } = await createTestTrade({
        senderUserId: sender.id,
        receiverUserId: receiver.id,
        region: "Tokyo",
        askPrice: 5000,
      });

      const assignment = await db.verificationAssignment.create({
        data: {
          tradeLegId: trade.legs[0].id,
          authenticatorId: auth.id,
        },
      });

      await expect(
        submitVerificationResult(assignment.id, otherUser.id, {
          authentic: true,
          conditionVerified: "NM",
          conditionMatchesListing: true,
          notes: "",
          photos: ["https://1.com", "https://2.com", "https://3.com", "https://4.com"],
          defects: [],
          confidenceLevel: "HIGH",
          ccs: { surface: 9.0, corners: 9.0, edges: 9.0, centering: 9.0 },
        })
      ).rejects.toThrow("Not authorized");
    });
  });

  // ─── Rating Submission ─────────────────────────────

  describe("Rating submission", () => {
    it("submits a rating for a completed verification", async () => {
      const sender = await createTestUser({ email: "wf-test-rate-sender@test.com" });
      const receiver = await createTestUser({ email: "wf-test-rate-receiver@test.com" });
      const authUser = await createTestUser({ email: "wf-test-rate-auth@test.com" });
      const auth = await createTestAuthenticator(authUser.id, { region: "Tokyo" });

      const { trade } = await createTestTrade({
        senderUserId: sender.id,
        receiverUserId: receiver.id,
        region: "Tokyo",
        askPrice: 5000,
      });

      // Create assignment and complete verification
      const assignment = await db.verificationAssignment.create({
        data: {
          tradeLegId: trade.legs[0].id,
          authenticatorId: auth.id,
          completedAt: new Date(),
          result: { authentic: true, conditionVerified: "NM", conditionMatchesListing: true },
        },
      });

      // Mark trade as COMPLETED
      await db.trade.update({
        where: { id: trade.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      // Receiver submits rating
      const rating = await submitRating(receiver.id, {
        tradeLegId: trade.legs[0].id,
        score: 5,
        accuracyScore: 5,
        speedScore: 4,
        satisfactionScore: 5,
        communicationScore: 5,
      });

      expect(rating.id).toBeTruthy();
      expect(rating.score).toBe(5);
      expect(rating.accuracyScore).toBe(5);

      // Check that authenticator aggregate rating was recalculated
      const updatedAuth = await db.authenticator.findUnique({
        where: { id: auth.id },
      });
      expect(updatedAuth!.rating).toBeGreaterThan(0);
    });
  });

  // ─── Tier Promotion ────────────────────────────────

  describe("Tier promotion", () => {
    it("does not promote STANDARD with insufficient verifications", async () => {
      const user = await createTestUser({ email: "wf-test-promo@test.com" });
      const auth = await createTestAuthenticator(user.id, {
        region: "Tokyo",
        tier: "STANDARD",
        totalVerified: 5, // need 50
        rating: 4.8,
      });

      const result = await checkTierPromotion(auth.id);
      expect(result).toBeNull();
    });

    it("does not promote even with enough verifications if rating too low", async () => {
      const user = await createTestUser({ email: "wf-test-promo-lowrate@test.com" });
      const auth = await createTestAuthenticator(user.id, {
        region: "Tokyo",
        tier: "STANDARD",
        totalVerified: 60,
        rating: 3.0, // need 4.5
      });

      // Create enough ratings with low scores
      for (let i = 0; i < 5; i++) {
        await db.authenticatorRating.create({
          data: {
            authenticatorId: auth.id,
            tradeLegId: `fake-leg-${i}`,
            raterId: user.id,
            score: 3.0,
            accuracyScore: 3.0,
            speedScore: 3.0,
            satisfactionScore: 3.0,
            communicationScore: 3.0,
          },
        });
      }

      const result = await checkTierPromotion(auth.id);
      expect(result).toBeNull(); // not promoted
    });
  });
});
