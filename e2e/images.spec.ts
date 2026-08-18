import { test, expect } from "@playwright/test";

test.describe("Images tab", () => {
  test("query 'smash' renders real thumbnails linking to the project fallback page", async ({
    page,
  }) => {
    await page.goto("/search?q=smash&tab=images");

    const tiles = page.locator(".image-tile");
    const count = await tiles.count();
    expect(count).toBeGreaterThan(0);

    const firstImg = tiles.first().locator("img.image-thumb");
    await expect(firstImg).toBeVisible();
    // Vendored screenshot under /content/super-smash/screenshots, not a placeholder.
    await expect(firstImg).toHaveAttribute("src", /^\/content\/super-smash\/screenshots\/.+\.png$/);

    // liveUrl is null for super-smash, so resolveHref() ignores the target path and
    // every image tile links to the same internal fallback docs page.
    const link = tiles.first().locator("a.image-tile-link");
    await expect(link).toHaveAttribute("href", "/sites/super-smash/docs");

    await link.click();
    await expect(page).toHaveURL(/\/sites\/super-smash\/docs$/);
  });

  test("no query shows the browse-all gallery (homepage Images link)", async ({ page }) => {
    await page.goto("/search?tab=images");

    // All 34 vendored screenshots across every project, not the search prompt.
    const tiles = page.locator(".image-tile");
    expect(await tiles.count()).toBeGreaterThan(30);
    await expect(page.getByText("Search David's Internet.")).toHaveCount(0);
  });
});
