import { test, expect } from "@playwright/test";

test.describe("Search edge cases", () => {
  test("a query with no matches shows the zero-results state", async ({ page }) => {
    await page.goto("/search?q=zzzqqqxxx");

    await expect(
      page.getByText(/did not match any documents/),
    ).toBeVisible();
    await expect(page.locator(".results")).toHaveCount(0);
  });

  test("a misspelled query offers a 'Did you mean' correction that re-searches", async ({
    page,
  }) => {
    await page.goto("/search?q=yotube");

    const correction = page.locator(".did-you-mean a");
    await expect(correction).toBeVisible();
    await expect(correction).toHaveText("youtube");

    await correction.click();

    await expect(page).toHaveURL(/\/search\?q=youtube$/);
    await expect(page.locator(".results .result").first()).toBeVisible();
  });
});
