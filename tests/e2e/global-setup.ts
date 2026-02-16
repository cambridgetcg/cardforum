import { test as setup } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { hash } from "bcryptjs";
import pg from "pg";

/**
 * Global setup: creates a test user in the DB and generates
 * an Auth.js-compatible JWT session cookie stored to disk.
 *
 * Uses raw pg instead of Prisma to avoid ESM/CJS module issues.
 * Table names use snake_case (Prisma @@map), column names use camelCase.
 * Auth.js v5 uses encrypted JWE tokens (A256CBC-HS512).
 */

const TEST_USER_EMAIL = "e2e-test@cardforum.test";
const TEST_USER_PASSWORD = "E2eTestPassword123!";
const COOKIE_NAME = "authjs.session-token";

setup("create authenticated session", async ({ page }) => {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const passwordHash = await hash(TEST_USER_PASSWORD, 4);

    // cuid()-style ID (Prisma default) — use a fixed prefix for easy identification
    const id = `e2e_test_${Date.now()}`;

    const result = await pool.query(
      `INSERT INTO users (id, name, email, "passwordHash", region, "createdAt", "updatedAt")
       VALUES ($1, 'E2E Test User', $2, $3, 'Tokyo', NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET "passwordHash" = $3, "updatedAt" = NOW()
       RETURNING id, name, email, image`,
      [id, TEST_USER_EMAIL, passwordHash],
    );

    const user = result.rows[0];

    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error("AUTH_SECRET env var is required for E2E tests");

    const token = await encode({
      token: {
        sub: user.id,
        name: user.name,
        email: user.email,
        picture: user.image,
      },
      secret,
      salt: COOKIE_NAME,
      maxAge: 30 * 24 * 60 * 60,
    });

    await page.context().addCookies([
      {
        name: COOKIE_NAME,
        value: token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.context().storageState({ path: "tests/e2e/.auth/user.json" });
  } finally {
    await pool.end();
  }
});
