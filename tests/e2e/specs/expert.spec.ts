import { test, expect } from "../fixtures/auth.fixture";
import { ExpertPage } from "../pages/expert.page";

/**
 * Expert Hub tests — verify post list, filters, create form.
 *
 * Uses React Query (useExpertPosts hook) which calls /api/expert/posts.
 * PostFilters has 4 filter groups: Game (TCG), Category, Language, Sort.
 * Each group has an "All" button, so we locate by section heading.
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

    // Wait for the post count text to appear in the DOM
    // The expert page always renders "{total} post(s)" after query resolves
    // or "No posts yet" when empty (text: "0 posts")
    await expect(authedPage.getByText(/\d+ posts?/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
