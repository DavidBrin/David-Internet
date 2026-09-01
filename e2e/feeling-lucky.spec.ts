import { test, expect } from "@playwright/test";

const WIKI_SLUGS = [
  "Linear_(replica)",
  "YouTube_(replica)",
  "Super_Smash_(replica)",
  "Fake_Phone",
  "Bet_(app)",
  "Dollar_Pixels",
  "Notion_(replica)",
];

test.describe("I'm Feeling Lucky", () => {
  test("lands on a project wiki article or an internal demo", async ({ page }) => {
    // Stub the external wiki host so the navigation works offline in CI.
    await page.route("https://davids-wikipedia.vercel.app/**", (route) =>
      route.fulfill({ contentType: "text/html", body: "<title>wiki stub</title>" }),
    );
    await page.goto("/");

    // feelingLucky() picks a random "home" doc and window.location.assign()s to its href.
    // Replicas have liveUrl null → wiki article; demos have an internal /demos route.
    await Promise.all([
      page.waitForURL(/davids-wikipedia\.vercel\.app\/wiki\/.+|\/demos\/.+/),
      page.getByRole("button", { name: "I'm Feeling Lucky" }).click(),
    ]);

    const url = new URL(page.url());
    if (url.hostname === "davids-wikipedia.vercel.app") {
      const match = url.pathname.match(/^\/wiki\/(.+)$/);
      expect(match).not.toBeNull();
      expect(WIKI_SLUGS).toContain(decodeURIComponent(match?.[1] ?? ""));
    } else {
      expect(url.pathname).toMatch(/^\/demos\/.+/);
    }
  });
});
