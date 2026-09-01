import { test, expect } from "@playwright/test";

test.describe("Static pages", () => {
  test("/about renders David's name", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "David Brin" })).toBeVisible();
  });

  test("/sites/linear/docs forwards to the project's wiki article", async ({ page }) => {
    // Stub the external wiki host so the client-side forward works offline in CI.
    await page.route("https://davids-wikipedia.vercel.app/**", (route) =>
      route.fulfill({ contentType: "text/html", body: "<title>wiki stub</title>" }),
    );
    await page.goto("/sites/linear/docs");
    await page.waitForURL("https://davids-wikipedia.vercel.app/wiki/Linear_(replica)");
  });

  test("/sites/esp32/docs forwards to the project's wiki article", async ({ page }) => {
    // Stub the external wiki host so the client-side forward works offline in CI.
    await page.route("https://davids-wikipedia.vercel.app/**", (route) =>
      route.fulfill({ contentType: "text/html", body: "<title>wiki stub</title>" }),
    );
    await page.goto("/sites/esp32/docs");
    await page.waitForURL("https://davids-wikipedia.vercel.app/wiki/ESP32_Thermal_TinyML");
  });
});
