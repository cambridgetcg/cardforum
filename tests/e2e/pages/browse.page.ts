import { type Page, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Browse Page Object.
 *
 * Covers: /browse, /browse/sets/[setCode], /browse/cards/[cardId]
 * Source: src/app/(platform)/browse/page.tsx
 */
export class BrowsePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.navigateTo("/browse");
  }

  /** Click a TCG filter button by label. */
  async filterByTCG(label: string) {
    await this.page.getByRole("button", { name: label }).click();
  }

  /** Assert that set cards are visible in the grid. */
  async assertSetCardsVisible(minCount = 1) {
    // Set cards contain a "cards" text badge (e.g. "124 cards")
    const setCards = this.page.locator("a[href^='/browse/sets/']");
    await expect(setCards.first()).toBeVisible();
    const count = await setCards.count();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }

  /** Click on a specific set by code (e.g. "OP01"). */
  async clickSet(setCode: string) {
    await this.page.locator(`a[href='/browse/sets/${setCode}']`).click();
    await this.page.waitForURL(`**/browse/sets/${setCode}`, { timeout: 10_000 });
  }

  /** Assert we're on a set detail page. */
  async assertOnSetPage(setName: string) {
    await expect(this.page.getByRole("heading", { level: 1 })).toContainText(setName);
  }

  /** Assert card grid items are visible. */
  async assertCardGridVisible(minCount = 1) {
    const cards = this.page.locator("a[href^='/browse/cards/']");
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }

  /** Click on the first card in the grid. */
  async clickFirstCard() {
    await this.page.locator("a[href^='/browse/cards/']").first().click();
    await this.page.waitForURL(/\/browse\/cards\//, { timeout: 10_000 });
  }

  /** Search within a set — placeholder ends with "..." */
  async searchInSet(query: string) {
    await this.page.getByPlaceholder("Search within this set...").fill(query);
    // Wait for debounced search (300ms in set detail page)
    await this.page.waitForTimeout(400);
  }
}
