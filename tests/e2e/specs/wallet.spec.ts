import { test, expect } from "../fixtures/auth.fixture";
import { WalletPage } from "../pages/wallet.page";

/**
 * Wallet tests — verify balance display, deposit/withdraw UI.
 */
test.describe("Wallet", () => {
  test("wallet page loads with balance", async ({ authedPage }) => {
    const wallet = new WalletPage(authedPage);
    await wallet.navigate();
    await wallet.assertHeading("Wallet");

    // Wait for API response
    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/wallet/balance") && r.status() === 200,
      { timeout: 10_000 },
    );

    await wallet.assertBalanceVisible();
  });

  test("deposit button is visible", async ({ authedPage }) => {
    const wallet = new WalletPage(authedPage);
    await wallet.navigate();

    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/wallet/balance") && r.status() === 200,
      { timeout: 10_000 },
    );

    await wallet.assertDepositButtonVisible();
  });

  test("connect section loads", async ({ authedPage }) => {
    const wallet = new WalletPage(authedPage);
    await wallet.navigate();

    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/connect/status") && r.status() === 200,
      { timeout: 10_000 },
    );

    await wallet.assertConnectSectionVisible();
  });
});
