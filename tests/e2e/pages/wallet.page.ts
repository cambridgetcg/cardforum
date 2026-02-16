import { type Page, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Wallet Page Object.
 *
 * Covers: /wallet
 * Source: src/app/(platform)/wallet/page.tsx
 *
 * Shows "Loading wallet..." while fetching, then renders:
 *   - WalletBalance (shows balance text)
 *   - ConnectAccount (shows connect/stripe/payout section)
 *   - DepositButton + WithdrawForm grid
 *   - TransactionHistory
 */
export class WalletPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.navigateTo("/wallet");
  }

  async assertBalanceVisible() {
    // Wait for the balance text to appear (loading state shows "Loading wallet...")
    await expect(this.page.getByText(/balance/i).first()).toBeVisible({ timeout: 10_000 });
  }

  async assertDepositButtonVisible() {
    // Deposit button rendered by DepositButton component
    await expect(this.page.getByRole("button", { name: /deposit/i })).toBeVisible({
      timeout: 10_000,
    });
  }

  async assertConnectSectionVisible() {
    // ConnectAccount component renders stripe/payout/connect related text
    await expect(this.page.getByText(/connect|stripe|payout|withdrawals/i).first()).toBeVisible({
      timeout: 10_000,
    });
  }
}
