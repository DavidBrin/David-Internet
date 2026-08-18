import { test, expect } from "@playwright/test";

test.describe("Knowledge panel", () => {
  // The rail is hidden below 1150px (globals.css), so use a desktop viewport.
  test.use({ viewport: { width: 1440, height: 900 } });

  test("query 'linear' on the All tab shows the panel with links to the project", async ({
    page,
  }) => {
    await page.goto("/search?q=linear");

    const panel = page.getByRole("complementary", { name: "About Linear" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Linear" })).toBeVisible();

    // liveUrl is null for every project, so both links fall back to the cached docs page.
    await expect(panel.getByRole("link", { name: "Visit site" })).toHaveAttribute(
      "href",
      "/sites/linear/docs",
    );
    await expect(panel.getByRole("link", { name: "Read the docs" })).toHaveAttribute(
      "href",
      "/sites/linear/docs",
    );
  });
});
