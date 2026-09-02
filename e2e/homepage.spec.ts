import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("shows the David wordmark and an autofocused search box", async ({ page }) => {
    await page.goto("/");

    // Wordmark.tsx renders role="img"; the homepage passes title="David's Internet"
    // (src/app/page.tsx), so that's the accessible name of the mark itself.
    await expect(page.getByRole("img", { name: "David's Internet", exact: true })).toBeVisible();

    // SearchBox has autoFocus on the home variant.
    const input = page.getByRole("combobox", { name: "Search David's Internet" });
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });

  test("typing a query and pressing Enter navigates to /search?q=...", async ({ page }) => {
    await page.goto("/");

    const input = page.getByRole("combobox", { name: "Search David's Internet" });
    await input.fill("youtube");
    await input.press("Enter");

    await expect(page).toHaveURL(/\/search\?q=youtube$/);
  });

  test("topnav has a Wikipedia link and the avatar still goes to the resume", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Account and apps" }).getByRole("link", { name: "Wikipedia" })).toHaveAttribute(
      "href",
      "https://davids-wikipedia.vercel.app",
    );
    await expect(page.getByRole("link", { name: "About David" })).toHaveAttribute("href", "/about");
  });
});
