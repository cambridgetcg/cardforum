import { test, expect } from "../fixtures/auth.fixture";
import { WalletPage } from "../pages/wallet.page";

/**
 * Wallet tests — verify balance display, deposit/withdraw UI.
 *
 * Wallet page fires 3 parallel fetches on mount:
 *   /api/wallet/balance, /api/wallet/history, /api/connect/status
 * These complete before waitForResponse can be set up, so we
 * wait for DOM content instead of intercepting responses.
 */
test.describe("Wallet", () => {
  test("wallet page loads with balance", async ({ authedPage }) => {
    const wallet = new WalletPage(authedPage);
    await wallet.navigate();
    await wallet.assertHeading("Wallet");

    // Wait for "Loading wallet..." to disappear and balance to render
    await wallet.assertBalanceVisible();
  });

  test("deposit button is visible", async ({ authedPage }) => {
    const wallet = new WalletPage(authedPage);
    await wallet.navigate();

    // Wait for page to finish loading
    await wallet.assertDepositButtonVisible();
  });

  test("connect section loads", async ({ authedPage }) => {
    const wallet = new WalletPage(authedPage);
    await wallet.navigate();

    // Wait for connect status to load
    await wallet.assertConnectSectionVisible();
  });
});
