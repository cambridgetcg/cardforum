import { type Page, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Wallet Page Object.
 *
 * Covers: /wallet
 * Source: src/app/(platform)/wallet/page.tsx
 */
export class WalletPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.navigateTo("/wallet");
  }

  async assertBalanceVisible() {
    await expect(this.page.getByText(/balance/i).first()).toBeVisible();
  }

  async assertDepositButtonVisible() {
    await expect(this.page.getByRole("button", { name: /deposit/i })).toBeVisible();
  }

  async assertConnectSectionVisible() {
    await expect(
      this.page.getByText(/connect|stripe|payout/i).first()
    ).toBeVisible();
  }
}
