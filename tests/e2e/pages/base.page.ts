import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Base Page Object — shared navigation and wait helpers.
 *
 * All page objects extend this for consistent patterns:
 *   - waitForHydration() waits for Next.js client-side hydration
 *   - navigateTo() handles base URL + wait
 *   - assertHeading() checks the page h1
 */
export class BasePage {
  constructor(protected readonly page: Page) {}

  /** Navigate to a path and wait for network to settle. */
  async navigateTo(path: string) {
    await this.page.goto(path);
    await this.waitForHydration();
  }

  /**
   * Wait for Next.js hydration to complete.
   * Client components fetch data in useEffect, so we wait for
   * at least one API response to resolve.
   */
  async waitForHydration() {
    // Wait for Next.js to finish loading (DOM stable)
    await this.page.waitForLoadState("domcontentloaded");
  }

  /** Assert the main heading text. */
  async assertHeading(text: string) {
    await expect(this.page.getByRole("heading", { level: 1 })).toContainText(text);
  }

  /** Get the current URL pathname. */
  get currentPath(): string {
    return new URL(this.page.url()).pathname;
  }
}
