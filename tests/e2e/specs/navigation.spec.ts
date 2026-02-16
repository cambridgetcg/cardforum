import { test, expect } from "../fixtures/auth.fixture";

/**
 * Navigation tests — verify header links, page transitions, auth gating.
 */
test.describe("Navigation", () => {
  test("header has all nav links", async ({ authedPage }) => {
    await authedPage.goto("/dashboard");
    await authedPage.waitForLoadState("domcontentloaded");

    // Desktop nav links
    const nav = authedPage.locator("header, nav");
    await expect(nav.getByRole("link", { name: /dashboard/i }).first()).toBeVisible();
    await expect(nav.getByRole("link", { name: /browse/i }).first()).toBeVisible();
    await expect(nav.getByRole("link", { name: /listings/i }).first()).toBeVisible();
    await expect(nav.getByRole("link", { name: /trades/i }).first()).toBeVisible();
  });

  test("full navigation flow: dashboard → browse → marketplace → listings", async ({
    authedPage,
  }) => {
    // Start at dashboard
    await authedPage.goto("/dashboard");
    await expect(authedPage.getByRole("heading", { level: 1 })).toContainText("Dashboard");

    // Navigate to browse
    await authedPage.goto("/browse");
    await expect(authedPage.getByRole("heading", { level: 1 })).toContainText("Browse");

    // Navigate to marketplace
    await authedPage.goto("/marketplace");
    await expect(authedPage.getByRole("heading", { level: 1 })).toContainText("Marketplace");

    // Navigate to listings
    await authedPage.goto("/listings");
    await expect(authedPage.getByRole("heading", { level: 1 })).toContainText("My Listings");

    // Navigate to trades
    await authedPage.goto("/trades");
    await expect(authedPage.getByRole("heading", { level: 1 })).toContainText("Trades");

    // Navigate to wallet
    await authedPage.goto("/wallet");
    await expect(authedPage.getByRole("heading", { level: 1 })).toContainText("Wallet");

    // Navigate to settings
    await authedPage.goto("/settings");
    await expect(authedPage.getByRole("heading", { level: 1 })).toContainText("Settings");

    // Navigate to expert
    await authedPage.goto("/expert");
    await expect(authedPage.getByRole("heading", { level: 1 })).toContainText("Expert Hub");

    // Navigate to collection
    await authedPage.goto("/collection");
    await expect(authedPage.getByRole("heading", { level: 1 })).toContainText("My Collection");
  });

  test("API endpoints return 200 for authenticated user", async ({ authedRequest }) => {
    const endpoints = [
      "/api/dashboard",
      "/api/wallet/balance",
      "/api/wallet/history",
      "/api/listings",
      "/api/trades",
      "/api/connect/status",
      "/api/users/me",
      "/api/card-sets",
      "/api/marketplace",
      "/api/collection",
      "/api/collection/stats",
    ];

    for (const endpoint of endpoints) {
      const res = await authedRequest.get(`http://localhost:3000${endpoint}`);
      expect(res.status(), `${endpoint} should return 200`).toBe(200);
    }
  });

  test("API endpoints return 401 for unauthenticated requests", async ({ request }) => {
    const protectedEndpoints = [
      "/api/dashboard",
      "/api/wallet/balance",
      "/api/listings",
      "/api/trades",
      "/api/users/me",
      "/api/collection",
    ];

    for (const endpoint of protectedEndpoints) {
      const res = await request.get(`http://localhost:3000${endpoint}`);
      expect(res.status(), `${endpoint} should return 401`).toBe(401);
    }
  });
});
