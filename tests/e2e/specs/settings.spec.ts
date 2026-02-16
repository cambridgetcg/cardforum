import { test, expect } from "../fixtures/auth.fixture";
import { SettingsPage } from "../pages/settings.page";

/**
 * Settings tests — verify profile load, edit, and save.
 *
 * Settings page fetches /api/users/me on mount via useEffect.
 * While loading, it shows a skeleton. After load, it shows the form.
 * We wait for DOM content instead of intercepting the API response.
 */
test.describe("Settings", () => {
  test("settings page loads with profile data", async ({ authedPage }) => {
    const settings = new SettingsPage(authedPage);
    await settings.navigate();
    await settings.assertHeading("Settings");

    // Wait for profile to load (form appears when loading=false)
    await settings.assertProfileForm();
    await settings.assertAccountSection();
  });

  test("displays user email in account section", async ({ authedPage }) => {
    const settings = new SettingsPage(authedPage);
    await settings.navigate();

    // Wait for profile data to load and render
    await expect(authedPage.getByText("e2e-test@cardforum.test")).toBeVisible({ timeout: 10_000 });
  });

  test("can save profile changes", async ({ authedPage }) => {
    const settings = new SettingsPage(authedPage);
    await settings.navigate();

    // Wait for form to be ready
    await expect(authedPage.getByPlaceholder("Your name")).toBeVisible({ timeout: 10_000 });

    await settings.updateName("E2E Updated User");

    // Set up PATCH response listener BEFORE clicking save
    const savePromise = authedPage.waitForResponse(
      (r) => r.url().includes("/api/users/me") && r.request().method() === "PATCH",
      { timeout: 5_000 },
    );

    await settings.save();
    await savePromise;

    await settings.assertSaveSuccess();
  });
});
