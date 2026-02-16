import { type Page, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Collection Page Object.
 *
 * Covers: /collection
 */
export class CollectionPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.navigateTo("/collection");
  }

  async assertStatsCards() {
    await expect(
      this.page.getByText(/total cards|unique cards|sets started|tracked value/i).first()
    ).toBeVisible({ timeout: 10_000 });
  }

  async assertTCGFilters() {
    await expect(this.page.getByRole("button", { name: "All TCGs" })).toBeVisible();
  }

  async assertEmptyState() {
    await expect(this.page.getByText(/your collection is empty|browse cards/i).first()).toBeVisible();
  }
}
