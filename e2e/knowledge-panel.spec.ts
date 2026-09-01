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

    // liveUrl is null for every project, so both links go to the wiki article.
    await expect(panel.getByRole("link", { name: "Read the wiki" })).toHaveAttribute(
      "href",
      "https://davids-wikipedia.vercel.app/wiki/Linear_(replica)",
    );
    await expect(panel.getByRole("link", { name: "Wikipedia" })).toHaveAttribute(
      "href",
      "https://davids-wikipedia.vercel.app/wiki/Linear_(replica)",
    );
  });

  test("query 'esp32' shows Visit site to the demo and Wikipedia to the article", async ({
    page,
  }) => {
    await page.goto("/search?q=esp32");

    const panel = page.getByRole("complementary", { name: "About ESP32 Thermal TinyML" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("link", { name: "Visit site" })).toHaveAttribute(
      "href",
      "/demos/esp32",
    );
    await expect(panel.getByRole("link", { name: "Wikipedia" })).toHaveAttribute(
      "href",
      "https://davids-wikipedia.vercel.app/wiki/ESP32_Thermal_TinyML",
    );
  });
});
