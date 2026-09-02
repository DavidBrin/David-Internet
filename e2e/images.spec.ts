import { test, expect } from "@playwright/test";

const SMASH_LIVE_URL = "https://smash-david.vercel.app";

test.describe("Images tab", () => {
  test("query 'smash' renders real thumbnails linking to the live replica", async ({
    page,
  }) => {
    await page.goto("/search?q=smash&tab=images");

    const tiles = page.locator(".image-tile");
    const count = await tiles.count();
    expect(count).toBeGreaterThan(0);

    const firstImg = tiles.first().locator("img.image-thumb");
    await expect(firstImg).toBeVisible();
    await expect(firstImg).toHaveAttribute("src", /^\/content\/super-smash\/screenshots\/.+\.png$/);

    const link = tiles.first().locator("a.image-tile-link");
    await expect(link).toHaveAttribute("href", SMASH_LIVE_URL);

    await page.context().route("https://smash-david.vercel.app/**", (route) =>
      route.fulfill({ contentType: "text/html", body: "<title>smash stub</title>" }),
    );
    const [popup] = await Promise.all([page.waitForEvent("popup"), link.click()]);
    await expect(popup).toHaveURL(SMASH_LIVE_URL);
  });

  test("no query shows the browse-all gallery (homepage Images link)", async ({ page }) => {
    await page.goto("/search?tab=images");

    const tiles = page.locator(".image-tile");
    expect(await tiles.count()).toBeGreaterThan(30);
    await expect(page.getByText("Search David's Internet.")).toHaveCount(0);
  });
});
