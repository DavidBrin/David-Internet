import { test, expect } from "@playwright/test";

const WIKI_SLUGS = [
  "Linear_(replica)",
  "YouTube_(replica)",
  "Super_Smash_(replica)",
  "Fake_Phone",
  "Bet_(app)",
  "Dollar_Pixels",
  "Notion_(replica)",
  "FL_Studio_(replica)",
];

const LIVE_REPLICA_HOSTS = [
  "linear-david.vercel.app",
  "notion-david.vercel.app",
  "smash-david.vercel.app",
  "fake-phone-david.vercel.app",
  "bet-david.vercel.app",
  "fl-studio-david.vercel.app",
  "dollar-pixels-david.vercel.app",
];

test.describe("I'm Feeling Lucky", () => {
  test("lands on a live replica, a wiki article, or an internal demo", async ({ page }) => {
    await page.route("https://davids-wikipedia.vercel.app/**", (route) =>
      route.fulfill({ contentType: "text/html", body: "<title>wiki stub</title>" }),
    );
    for (const host of LIVE_REPLICA_HOSTS) {
      await page.route(`https://${host}/**`, (route) =>
        route.fulfill({ contentType: "text/html", body: "<title>replica stub</title>" }),
      );
    }
    await page.goto("/");

    await Promise.all([
      page.waitForURL(
        /davids-wikipedia\.vercel\.app\/wiki\/.+|\/demos\/.+|linear-david\.vercel\.app|notion-david\.vercel\.app|smash-david\.vercel\.app|fake-phone-david\.vercel\.app|bet-david\.vercel\.app|fl-studio-david\.vercel\.app|dollar-pixels-david\.vercel\.app/,
      ),
      page.getByRole("button", { name: "I'm Feeling Lucky" }).click(),
    ]);

    const url = new URL(page.url());
    if (url.hostname === "davids-wikipedia.vercel.app") {
      const match = url.pathname.match(/^\/wiki\/(.+)$/);
      expect(match).not.toBeNull();
      expect(WIKI_SLUGS).toContain(decodeURIComponent(match?.[1] ?? ""));
    } else if (LIVE_REPLICA_HOSTS.includes(url.hostname)) {
      expect(url.pathname).toBe("/");
    } else {
      expect(url.pathname).toMatch(/^\/demos\/.+/);
    }
  });
});
