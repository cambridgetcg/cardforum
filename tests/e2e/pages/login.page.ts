import { type Page, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Login Page Object.
 *
 * Covers: /login
 * Source: src/components/auth/login-form.tsx
 */
export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.navigateTo("/login");
  }

  /** Fill credentials and submit. */
  async loginWith(email: string, password: string) {
    await this.page.getByLabel("Email").fill(email);
    await this.page.getByLabel("Password").fill(password);
    await this.page.getByRole("button", { name: /sign in/i }).click();
  }

  /** Assert redirect to login with callbackUrl. */
  async assertRedirectedFrom(originalPath: string) {
    await expect(this.page).toHaveURL(
      new RegExp(`/login\\?callbackUrl=${encodeURIComponent(originalPath)}`)
    );
  }

  /** Assert login error is visible. */
  async assertError(text: string) {
    await expect(this.page.getByText(text)).toBeVisible();
  }
}
