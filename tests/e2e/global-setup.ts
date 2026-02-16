import { test as setup } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { hash } from "bcryptjs";

/**
 * Global setup: creates a test user in the DB and generates
 * an Auth.js-compatible JWT session cookie stored to disk.
 *
 * The "chromium" project depends on this setup project
 * and reads the storageState from tests/e2e/.auth/user.json.
 *
 * Auth.js v5 uses encrypted JWE tokens (A256CBC-HS512).
 * The salt parameter must match the cookie name exactly.
 */

const TEST_USER_EMAIL = "e2e-test@cardforum.test";
const TEST_USER_PASSWORD = "E2eTestPassword123!";
const COOKIE_NAME = "authjs.session-token";

setup("create authenticated session", async ({ page }) => {
  // Dynamic import to use the Prisma client with pg adapter
  const { db } = await import("../../src/lib/db");

  // 1. Ensure test user exists (upsert to handle re-runs)
  const passwordHash = await hash(TEST_USER_PASSWORD, 4);
  const user = await db.user.upsert({
    where: { email: TEST_USER_EMAIL },
    update: { passwordHash },
    create: {
      name: "E2E Test User",
      email: TEST_USER_EMAIL,
      passwordHash,
      region: "Tokyo",
    },
  });

  // 2. Encode JWT matching Auth.js format
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
    maxAge: 30 * 24 * 60 * 60, // 30 days — matches auth.ts:11
  });

  // 3. Inject cookie into browser context
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

  // 4. Save storage state for other projects to reuse
  await page.context().storageState({ path: "tests/e2e/.auth/user.json" });
});
