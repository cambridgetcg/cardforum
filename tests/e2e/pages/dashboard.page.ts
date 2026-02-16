import { type Page, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Dashboard Page Object.
 *
 * Covers: /dashboard
 * Source: src/app/(platform)/dashboard/page.tsx
 */
export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.navigateTo("/dashboard");
  }

  /** Assert the dashboard loaded with the user's name. */
  async assertWelcome() {
    await this.assertHeading("Dashboard");
  }

  /** Navigate to a section from dashboard links. */
  async goToSection(name: string) {
    await this.page.getByRole("link", { name }).click();
    await this.page.waitForLoadState("domcontentloaded");
  }
}
