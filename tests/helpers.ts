import {
  PrismaClient,
  AuthenticatorTier,
  AuthenticatorApplicationStatus,
  TCG,
  KYCStatus,
} from "@/generated/prisma/client";
import { hash } from "bcryptjs";
import { db as serviceDb } from "@/lib/db";

/**
 * Return the same PrismaClient that services use.
 * This avoids dual-client issues where cleanup via one client
 * isn't visible to operations via the other.
 */
export function getTestDb(): PrismaClient {
  return serviceDb;
}

/**
 * No-op: the shared service db lives for the process lifetime.
 * Vitest's globalTeardown (or process exit) handles cleanup.
 */
export async function disconnectDb() {
  // intentionally empty — disconnecting mid-suite breaks subsequent files
}

/**
 * Create a test user directly in the database.
 * Returns the user with their ID for use in tests.
 */
export async function createTestUser(
  overrides: {
    name?: string;
    email?: string;
    password?: string;
    region?: string;
  } = {},
) {
  const db = getTestDb();
  const email =
    overrides.email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
  const passwordHash = overrides.password
    ? await hash(overrides.password, 4) // low rounds for speed in tests
    : await hash("TestPassword123!", 4);

  return db.user.create({
    data: {
      name: overrides.name ?? "Test User",
      email,
      passwordHash,
      region: overrides.region ?? "Tokyo",
    },
  });
}

/**
 * Create a test authenticator for a given user.
 */
export async function createTestAuthenticator(
  userId: string,
  overrides: {
    tier?: AuthenticatorTier;
    region?: string;
    applicationStatus?: AuthenticatorApplicationStatus;
    isActive?: boolean;
    rating?: number;
    totalVerified?: number;
    maxLoad?: number;
  } = {},
) {
  const db = getTestDb();
  return db.authenticator.create({
    data: {
      userId,
      businessName: "Test Auth Biz",
      tier: overrides.tier ?? "STANDARD",
      region: overrides.region ?? "Tokyo",
      tcgExpertise: ["POKEMON"],
      experienceDesc: "10 years of card authentication experience",
      proofOfExpertise: ["https://example.com/proof1"],
      applicationStatus: overrides.applicationStatus ?? "ACTIVE",
      isActive: overrides.isActive ?? true,
      rating: overrides.rating ?? 5.0,
      totalVerified: overrides.totalVerified ?? 0,
      maxLoad: overrides.maxLoad ?? 5,
      appliedAt: new Date(),
      approvedAt: new Date(),
    },
  });
}

/**
 * Create a test region.
 */
export async function createTestRegion(country = "JP", name = "Tokyo") {
  const db = getTestDb();
  return db.region.upsert({
    where: { country_name: { country, name } },
    update: {},
    create: { country, name },
  });
}

/**
 * Seed base card data for tests that need cards.
 */
export async function seedTestCard(
  overrides: {
    name?: string;
    tcg?: TCG;
    setName?: string;
    number?: string;
  } = {},
) {
  const db = getTestDb();
  const tcg = overrides.tcg ?? "POKEMON";
  const setName = overrides.setName ?? "Test Set";
  const number = overrides.number ?? `${Date.now()}`;

  return db.card.upsert({
    where: { tcg_setName_number: { tcg, setName, number } },
    update: {},
    create: {
      name: overrides.name ?? "Test Card",
      tcg,
      setName,
      number,
      rarity: "Rare",
    },
  });
}

/**
 * Clean up ALL test data in FK-safe dependency order.
 * Deletes leaf tables first, then parent tables.
 */
export async function cleanupTestData() {
  const db = getTestDb();

  // Tier 1: leaf tables (no incoming FKs or only optional incoming FKs)
  await db.kYCAudit.deleteMany({});
  await db.kYCDocument.deleteMany({});
  await db.authenticatorAudit.deleteMany({});
  await db.authenticatorRating.deleteMany({});
  await db.photoApproval.deleteMany({});
  await db.verificationAssignment.deleteMany({});
  await db.dispute.deleteMany({});
  await db.escrowEntry.deleteMany({});
  await db.notification.deleteMany({});
  await db.walletTransaction.deleteMany({});
  await db.payout.deleteMany({});

  // Tier 2: depends on tier 3 (trades)
  await db.tradeLeg.deleteMany({});
  await db.escrow.deleteMany({});

  // Tier 3: depends on tier 4
  await db.trade.deleteMany({});
  await db.matchProposalLeg.deleteMany({});

  // Tier 4: depends on tier 5
  await db.matchProposal.deleteMany({});
  await db.haveListing.deleteMany({});
  await db.wantListing.deleteMany({});
  await db.gradedHaveListing.deleteMany({});
  await db.gradedWantListing.deleteMany({});

  // Tier 5: depends on users
  await db.authenticator.deleteMany({});
  await db.session.deleteMany({});
  await db.account.deleteMany({});

  // Tier 6: root table
  await db.user.deleteMany({});
}

// ─── KYC Test Helpers ────────────────────────────────

/** Valid basic KYC documents (government ID + selfie). */
export function makeBasicKYCDocs() {
  return {
    documents: [
      {
        type: "GOVERNMENT_ID" as const,
        fileName: "id.jpg",
        fileSize: 500_000,
        mimeType: "image/jpeg" as const,
        storageKey: `kyc/test/${Date.now()}/id.jpg`,
      },
      {
        type: "SELFIE" as const,
        fileName: "selfie.jpg",
        fileSize: 300_000,
        mimeType: "image/jpeg" as const,
        storageKey: `kyc/test/${Date.now()}/selfie.jpg`,
      },
    ],
  };
}

/** Valid enhanced KYC documents (proof of address). */
export function makeEnhancedKYCDocs() {
  return {
    documents: [
      {
        type: "PROOF_OF_ADDRESS" as const,
        fileName: "utility-bill.pdf",
        fileSize: 800_000,
        mimeType: "application/pdf" as const,
        storageKey: `kyc/test/${Date.now()}/bill.pdf`,
      },
    ],
  };
}

/**
 * Submit + approve basic KYC for a user, leaving them BASIC_VERIFIED.
 * Requires an admin user ID for the review action.
 */
export async function approveBasicKYC(userId: string, adminId: string) {
  const { submitBasicKYC, reviewKYC } = await import("@/server/services/kyc.service");
  await submitBasicKYC(userId, makeBasicKYCDocs());
  return reviewKYC(userId, adminId, { action: "approve" });
}

/**
 * Submit + approve enhanced KYC for a user, leaving them ENHANCED_VERIFIED.
 * User must already be BASIC_VERIFIED.
 */
export async function approveEnhancedKYC(userId: string, adminId: string) {
  const { submitEnhancedKYC, reviewKYC } = await import("@/server/services/kyc.service");
  await submitEnhancedKYC(userId, makeEnhancedKYCDocs());
  return reviewKYC(userId, adminId, { action: "approve" });
}

/**
 * Fully verify a user to ENHANCED level (basic + enhanced).
 */
export async function fullyVerifyUser(userId: string, adminId: string) {
  await approveBasicKYC(userId, adminId);
  return approveEnhancedKYC(userId, adminId);
}
