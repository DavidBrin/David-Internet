import { test, expect } from "@playwright/test";

test.describe("Videos tab", () => {
  // Every content/<project>/site.ts currently has videos: [], so the Videos tab is always
  // empty regardless of query. This spec asserts that renders the intentional empty state
  // rather than crashing.
  test("renders the empty state instead of crashing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/search?q=smash&tab=videos");

    await expect(
      page.getByText(/did not match any video results/),
    ).toBeVisible();
    await expect(page.locator(".video-list")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
