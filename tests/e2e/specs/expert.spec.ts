import { test, expect } from "../fixtures/auth.fixture";
import { ExpertPage } from "../pages/expert.page";

/**
 * Expert Hub tests — verify post list, filters, create form.
 */
test.describe("Expert Hub", () => {
  test("expert hub loads with heading and write button", async ({ authedPage }) => {
    const expert = new ExpertPage(authedPage);
    await expert.navigate();
    await expert.assertHeadingAndDescription();
    await expert.assertWritePostButton();
  });

  test("shows filter controls", async ({ authedPage }) => {
    const expert = new ExpertPage(authedPage);
    await expert.navigate();
    await expert.assertFilters();
  });

  test("write post button opens create form", async ({ authedPage }) => {
    const expert = new ExpertPage(authedPage);
    await expert.navigate();
    await expert.clickWritePost();
    await expert.assertCreateFormVisible();
  });

  test("shows post count", async ({ authedPage }) => {
    const expert = new ExpertPage(authedPage);
    await expert.navigate();

    // Wait for posts API
    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/expert/posts") && r.status() === 200,
      { timeout: 10_000 },
    );

    // Should show "X posts" or "No posts yet"
    await expect(
      authedPage.getByText(/\d+ posts?|no posts yet/i).first()
    ).toBeVisible();
  });
});
