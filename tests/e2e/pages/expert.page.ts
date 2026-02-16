import { type Page, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Expert Hub Page Object.
 *
 * Covers: /expert, /expert/[postId]
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
    // TCG filter buttons
    await expect(this.page.getByRole("button", { name: "All" })).toBeVisible();
  }

  async clickWritePost() {
    await this.page.getByRole("button", { name: /write post/i }).click();
  }

  async assertCreateFormVisible() {
    await expect(this.page.getByText("New Expert Post")).toBeVisible();
  }
}
