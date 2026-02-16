import { type Page, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Expert Hub Page Object.
 *
 * Covers: /expert, /expert/[postId]
 * Source: src/app/(platform)/expert/page.tsx
 *
 * PostFilters has 4 sections (Game, Category, Language, Sort) each with
 * heading <h4> and badge buttons. Multiple "All" buttons exist.
 */
export class ExpertPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.navigateTo("/expert");
  }

  async assertHeadingAndDescription() {
    await this.assertHeading("Expert Hub");
    await expect(this.page.getByText(/knowledge from the community/i)).toBeVisible();
  }

  async assertWritePostButton() {
    await expect(this.page.getByRole("button", { name: /write post/i })).toBeVisible();
  }

  async assertFilters() {
    // PostFilters renders 4 section headings: "Game", "Category", "Language", "Sort"
    await expect(this.page.getByText("Game", { exact: true })).toBeVisible();
    await expect(this.page.getByText("Category", { exact: true })).toBeVisible();
    await expect(this.page.getByText("Sort", { exact: true })).toBeVisible();
  }

  async clickWritePost() {
    await this.page.getByRole("button", { name: /write post/i }).click();
  }

  async assertCreateFormVisible() {
    await expect(this.page.getByText("New Expert Post")).toBeVisible();
  }
}
