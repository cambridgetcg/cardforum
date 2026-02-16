import { type Page, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Collection Page Object.
 *
 * Covers: /collection
 * Source: src/app/(platform)/collection/page.tsx
 *
 * Uses React Query hooks (useCollection, useCollectionStats) — no raw fetch.
 * Stats: "Total Cards", "Unique Cards", "Sets Started", "Tracked Value"
 * TCG Filters: TCG_FILTERS from domain.ts → "All TCGs", "Pokemon", "One Piece", etc.
 * Empty state: "Your collection is empty. Browse sets to start collecting!"
 */
export class CollectionPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.navigateTo("/collection");
  }

  async assertStatsCards() {
    // Stats section renders after useCollectionStats resolves.
    // Labels: "Total Cards", "Unique Cards", "Sets Started", "Tracked Value"
    await expect(
      this.page.getByText(/Total Cards|Unique Cards|Sets Started|Tracked Value/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  }

  async assertTCGFilters() {
    // TCG filter buttons use TCG_FILTERS: "All TCGs", "Pokemon", "One Piece", "Yu-Gi-Oh!", "Magic"
    await expect(this.page.getByRole("button", { name: "All TCGs" })).toBeVisible();
  }

  async assertEmptyState() {
    // Empty state text from collection/page.tsx:173
    await expect(
      this.page.getByText(/your collection is empty|browse cards|no cards from this TCG/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  }
}
