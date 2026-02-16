import { type Page, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Settings Page Object.
 *
 * Covers: /settings
 */
export class SettingsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.navigateTo("/settings");
  }

  async assertProfileForm() {
    await expect(this.page.getByText("Display Name")).toBeVisible();
    await expect(this.page.getByText("Region")).toBeVisible();
    await expect(this.page.getByText("Bio")).toBeVisible();
    await expect(this.page.getByRole("button", { name: /save changes/i })).toBeVisible();
  }

  async assertAccountSection() {
    await expect(this.page.getByText("Account")).toBeVisible();
    await expect(this.page.getByText("Email")).toBeVisible();
  }

  async updateName(name: string) {
    const input = this.page.getByPlaceholder("Your name");
    await input.clear();
    await input.fill(name);
  }

  async save() {
    await this.page.getByRole("button", { name: /save changes/i }).click();
  }

  async assertSaveSuccess() {
    await expect(this.page.getByText("Profile saved successfully")).toBeVisible();
  }
}
