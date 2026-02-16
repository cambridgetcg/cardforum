import { test, expect } from "../fixtures/auth.fixture";

test.describe("OP01 Card Images", () => {
  test("OP01 set page loads cards with visible images", async ({ authedPage }) => {
    await authedPage.goto("/browse/sets/OP01");
    await authedPage.waitForLoadState("networkidle");

    // Wait for card grid to render
    const cards = authedPage.locator("img[src*='tcgplayer-cdn']");
    const count = await cards.count();

    console.log(`Found ${count} card images with TCGPlayer CDN URLs`);
    expect(count).toBeGreaterThan(0);

    // Check first 5 images loaded successfully (naturalWidth > 0 means loaded)
    const checkCount = Math.min(count, 5);
    for (let i = 0; i < checkCount; i++) {
      const img = cards.nth(i);
      const src = await img.getAttribute("src");
      console.log(`  Image ${i + 1}: ${src}`);

      // Verify the image actually rendered (not broken)
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      expect(naturalWidth, `Image ${i + 1} should have loaded: ${src}`).toBeGreaterThan(0);
    }
  });

  test("OP01 card detail page shows card image", async ({ authedPage }) => {
    // Get a card ID from the database via the API
    const res = await authedPage.request.get("/api/cards?set=OP01&limit=1");
    const data = await res.json();
    const cardId = data.cards?.[0]?.id;
    expect(cardId).toBeTruthy();

    // Navigate directly to the card detail page
    await authedPage.goto(`/browse/cards/${cardId}`);
    await authedPage.waitForLoadState("networkidle");

    // Check the card detail image loaded
    const img = authedPage.locator("img[src*='tcgplayer-cdn']").first();
    await expect(img).toBeVisible({ timeout: 10_000 });

    const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
    const src = await img.getAttribute("src");
    console.log(`Card detail image: ${src} (${naturalWidth}px wide)`);
    expect(naturalWidth).toBeGreaterThan(0);
  });

  test("card detail page shows variant buttons and no broken images", async ({ authedPage }) => {
    // Get a card with multiple variants (3+)
    const res = await authedPage.request.get("/api/cards?set=OP01&limit=40");
    const data = await res.json();
    const multiVariant = data.cards?.find(
      (c: { _count: { variants: number } }) => c._count.variants >= 3,
    );
    expect(multiVariant).toBeTruthy();

    await authedPage.goto(`/browse/cards/${multiVariant.id}`);
    await authedPage.waitForLoadState("networkidle");

    // Main card image should be visible
    const mainImg = authedPage.locator("img[src*='tcgplayer-cdn']").first();
    await expect(mainImg).toBeVisible({ timeout: 10_000 });
    const mainWidth = await mainImg.evaluate((el: HTMLImageElement) => el.naturalWidth);
    expect(mainWidth).toBeGreaterThan(0);

    // Variant buttons should exist (treatment labels like "parallel", "regular")
    const variantButtons = authedPage.locator("button", { hasText: /regular|parallel/ });
    const buttonCount = await variantButtons.count();
    console.log(`Card ${multiVariant.number}: ${buttonCount} variant buttons found`);
    expect(buttonCount).toBeGreaterThanOrEqual(2);

    // Check ALL images on the detail page are loaded (no broken)
    const allImages = authedPage.locator("img");
    const totalCount = await allImages.count();
    let broken = 0;
    for (let i = 0; i < totalCount; i++) {
      const img = allImages.nth(i);
      const src = await img.getAttribute("src");
      if (!src) continue;
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      if (naturalWidth === 0) broken++;
    }
    console.log(`Card detail: ${totalCount} images, ${broken} broken`);
    expect(broken, `${broken} images broken on card detail page`).toBe(0);
  });

  test("no broken images on OP01 set page", async ({ authedPage }) => {
    await authedPage.goto("/browse/sets/OP01");
    await authedPage.waitForLoadState("networkidle");

    // Find ALL img tags on the page
    const allImages = authedPage.locator("img");
    const totalCount = await allImages.count();

    let broken = 0;
    const brokenUrls: string[] = [];

    for (let i = 0; i < totalCount; i++) {
      const img = allImages.nth(i);
      const src = await img.getAttribute("src");
      if (!src) continue;

      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      if (naturalWidth === 0) {
        broken++;
        brokenUrls.push(src);
      }
    }

    console.log(`Total images: ${totalCount}, Broken: ${broken}`);
    if (brokenUrls.length > 0) {
      console.log("Broken URLs:", brokenUrls.slice(0, 5).join("\n  "));
    }

    expect(broken, `${broken} images failed to load`).toBe(0);
  });
});
