import { test as teardown } from "@playwright/test";
import pg from "pg";

/**
 * Global teardown: cleans up test data created during the E2E run.
 * Uses raw pg instead of Prisma to avoid ESM/CJS module issues.
 * Table names use snake_case (Prisma @@map).
 * FK-safe cascade order: leaf → root.
 */
teardown("clean up test data", async () => {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const testEmails = ["e2e-test@cardforum.test"];

    const { rows: testUsers } = await pool.query(`SELECT id FROM users WHERE email = ANY($1)`, [
      testEmails,
    ]);

    if (testUsers.length === 0) return;

    const userIds = testUsers.map((u) => u.id);

    // Delete in FK-safe order (leaf → root)
    // Table names from Prisma @@map directives
    const tables = [
      "notifications",
      "wallet_transactions",
      "payouts",
      "have_listings",
      "want_listings",
      "shipping_addresses",
      "sessions",
      "accounts",
    ];

    for (const table of tables) {
      await pool.query(`DELETE FROM ${table} WHERE "userId" = ANY($1)`, [userIds]);
    }

    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [userIds]);
  } finally {
    await pool.end();
  }
});
