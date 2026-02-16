import { type Page, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Listings Page Object.
 *
 * Covers: /listings
 * Source: src/app/(platform)/listings/page.tsx
 */
export class ListingsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.navigateTo("/listings");
  }

  async assertTabs() {
    await expect(this.page.getByText("Raw Cards")).toBeVisible();
    await expect(this.page.getByText("Graded Slabs")).toBeVisible();
  }

  async assertCreateButtons() {
    await expect(this.page.getByRole("button", { name: /\+ have/i })).toBeVisible();
    await expect(this.page.getByRole("button", { name: /\+ want/i })).toBeVisible();
  }

  async switchToGraded() {
    await this.page.getByText("Graded Slabs").click();
  }

  async clickCreateHave() {
    await this.page.getByRole("button", { name: /\+ have/i }).click();
  }

  async clickCreateWant() {
    await this.page.getByRole("button", { name: /\+ want/i }).click();
  }
}
