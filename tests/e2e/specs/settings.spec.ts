import { test, expect } from "../fixtures/auth.fixture";
import { SettingsPage } from "../pages/settings.page";

/**
 * Settings tests — verify profile load, edit, and save.
 */
test.describe("Settings", () => {
  test("settings page loads with profile data", async ({ authedPage }) => {
    const settings = new SettingsPage(authedPage);
    await settings.navigate();
    await settings.assertHeading("Settings");

    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/users/me") && r.status() === 200,
      { timeout: 10_000 },
    );

    await settings.assertProfileForm();
    await settings.assertAccountSection();
  });

  test("displays user email in account section", async ({ authedPage }) => {
    const settings = new SettingsPage(authedPage);
    await settings.navigate();

    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/users/me") && r.status() === 200,
      { timeout: 10_000 },
    );

    await expect(authedPage.getByText("e2e-test@cardforum.test")).toBeVisible();
  });

  test("can save profile changes", async ({ authedPage }) => {
    const settings = new SettingsPage(authedPage);
    await settings.navigate();

    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/users/me") && r.status() === 200,
      { timeout: 10_000 },
    );

    await settings.updateName("E2E Updated User");
    await settings.save();

    // Wait for PATCH response
    await authedPage.waitForResponse(
      (r) => r.url().includes("/api/users/me") && r.request().method() === "PATCH",
      { timeout: 5_000 },
    );

    await settings.assertSaveSuccess();
  });
});
