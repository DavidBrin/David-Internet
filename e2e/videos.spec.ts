import { test, expect } from "@playwright/test";

test.describe("Videos tab", () => {
  // Only the YouTube manifest carries a video (the site's own demo), so a query for
  // another project renders the intentional empty state rather than crashing.
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

  test("lists the site's demo video, linked to the YouTube replica", async ({ page }) => {
    await page.goto("/search?q=youtube&tab=videos");
    const row = page.locator(".video-row").first();
    await expect(row).toBeVisible();
    await expect(row.locator(".video-title")).toHaveAttribute(
      "href",
      "https://youtube-david.vercel.app/watch?v=vhgG-DQ4d6j",
    );
    await expect(row.locator(".video-duration")).toHaveText("0:23");
  });
});
