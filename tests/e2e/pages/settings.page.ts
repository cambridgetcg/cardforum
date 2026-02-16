import { type Page, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Settings Page Object.
 *
 * Covers: /settings
 * Source: src/app/(platform)/settings/page.tsx
 *
 * While loading, shows skeleton. After fetch, shows two cards:
 *   1. "Account" card (read-only: Email, Email Verified, Member Since)
 *   2. "Profile" card (editable: Display Name, Region, Bio + Save Changes button)
 */
export class SettingsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.navigateTo("/settings");
  }

  async assertProfileForm() {
    // Wait for the profile form to appear (labels are rendered as <label> text)
    await expect(this.page.getByText("Display Name")).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByText("Region", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByText("Bio", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(this.page.getByRole("button", { name: /save changes/i })).toBeVisible();
  }

  async assertAccountSection() {
    // Use heading role to avoid matching subtitle "Manage your account and preferences"
    await expect(this.page.getByRole("heading", { name: "Account" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(this.page.getByText("Email").first()).toBeVisible();
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
