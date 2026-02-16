import { test as base, expect, type Page } from "@playwright/test";

/**
 * Extended test fixture with authenticated page + API request context.
 *
 * Usage:
 *   import { test, expect } from "../fixtures/auth.fixture";
 *   test("wallet shows balance", async ({ authedPage, authedRequest }) => { ... });
 *
 * The storageState is loaded from tests/e2e/.auth/user.json
 * (created by global-setup.ts).
 */
export const test = base.extend<{
  authedPage: Page;
  authedRequest: (typeof base)["prototype"]["request"];
}>({
  authedPage: async ({ page }, use) => {
    // storageState already loaded via project config
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },
  authedRequest: async ({ request }, use) => {
    // APIRequestContext shares cookies from storageState
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(request);
  },
});

export { expect };
