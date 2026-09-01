import { test, expect } from "@playwright/test";

const SMASH_WIKI_URL = "https://davids-wikipedia.vercel.app/wiki/Super_Smash_(replica)";

test.describe("Images tab", () => {
  test("query 'smash' renders real thumbnails linking to the project's wiki article", async ({
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
    // every image tile links to the project's Wikipedia article.
    const link = tiles.first().locator("a.image-tile-link");
    await expect(link).toHaveAttribute("href", SMASH_WIKI_URL);

    // External links open in a new tab; stub the wiki host so this works offline in CI.
    await page.context().route("https://davids-wikipedia.vercel.app/**", (route) =>
      route.fulfill({ contentType: "text/html", body: "<title>wiki stub</title>" }),
    );
    const [popup] = await Promise.all([page.waitForEvent("popup"), link.click()]);
    await expect(popup).toHaveURL(SMASH_WIKI_URL);
  });

  test("no query shows the browse-all gallery (homepage Images link)", async ({ page }) => {
    await page.goto("/search?tab=images");

    // All 34 vendored screenshots across every project, not the search prompt.
    const tiles = page.locator(".image-tile");
    expect(await tiles.count()).toBeGreaterThan(30);
    await expect(page.getByText("Search David's Internet.")).toHaveCount(0);
  });
});
