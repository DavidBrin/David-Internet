import { test, expect } from "@playwright/test";

test.describe("Static pages", () => {
  test("/about renders David's name", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "David Brin" })).toBeVisible();
  });

  test("/sites/linear/docs renders the cached-copy banner", async ({ page }) => {
    await page.goto("/sites/linear/docs");
    await expect(page.getByText(/cached copy of/)).toBeVisible();
    await expect(page.locator(".cachedBannerInner strong")).toHaveText("linear.davids.net");
  });
});
