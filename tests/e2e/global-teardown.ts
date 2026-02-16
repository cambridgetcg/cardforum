import { test as teardown } from "@playwright/test";

/**
 * Global teardown: cleans up test data created during the E2E run.
 * Uses the same FK-safe cascade order as tests/helpers.ts:129-167.
 */
teardown("clean up test data", async () => {
  const { db } = await import("../../src/lib/db");

  const testEmails = ["e2e-test@cardforum.test"];

  // Find test users
  const testUsers = await db.user.findMany({
    where: { email: { in: testEmails } },
    select: { id: true },
  });

  if (testUsers.length === 0) return;

  const userIds = testUsers.map((u) => u.id);

  // Delete in FK-safe order (leaf → root)
  // Only delete data owned by test users to avoid nuking real data
  await db.notification.deleteMany({ where: { userId: { in: userIds } } });
  await db.walletTransaction.deleteMany({ where: { userId: { in: userIds } } });
  await db.payout.deleteMany({ where: { userId: { in: userIds } } });

  await db.haveListing.deleteMany({ where: { userId: { in: userIds } } });
  await db.wantListing.deleteMany({ where: { userId: { in: userIds } } });

  await db.shippingAddress.deleteMany({ where: { userId: { in: userIds } } });
  await db.session.deleteMany({ where: { userId: { in: userIds } } });
  await db.account.deleteMany({ where: { userId: { in: userIds } } });

  await db.user.deleteMany({ where: { id: { in: userIds } } });
});
