import { type Page, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Trades Page Object.
 *
 * Covers: /trades, /trades/[tradeId]
 */
export class TradesPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.navigateTo("/trades");
  }

  async assertModeFilters() {
    await expect(this.page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Direct" })).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Authenticated" })).toBeVisible();
  }

  async assertFindMatchesButton() {
    await expect(this.page.getByRole("button", { name: /find matches/i })).toBeVisible();
  }

  async assertActiveSection() {
    await expect(this.page.getByText(/active/i).first()).toBeVisible();
  }
}
