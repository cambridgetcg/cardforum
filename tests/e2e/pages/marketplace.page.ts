import { type Page, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Marketplace Page Object.
 *
 * Covers: /marketplace, /marketplace/[cardId]
 */
export class MarketplacePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.navigateTo("/marketplace");
  }

  async assertSearchVisible() {
    await expect(this.page.getByPlaceholder("Search cards...")).toBeVisible();
  }

  async assertTCGFilters() {
    await expect(this.page.getByRole("button", { name: "All" })).toBeVisible();
  }

  async search(query: string) {
    await this.page.getByPlaceholder("Search cards...").fill(query);
    await this.page.waitForTimeout(400); // debounce
  }

  async filterByTCG(label: string) {
    await this.page.getByRole("button", { name: label }).click();
  }

  async clickFirstCard() {
    const card = this.page.locator("a[href^='/marketplace/']").first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();
    await this.page.waitForLoadState("domcontentloaded");
  }
}
