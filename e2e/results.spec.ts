import { test, expect } from "@playwright/test";

test.describe("Search results (All tab)", () => {
  test("query 'youtube' returns results with stats, favicon, breadcrumb, and bolded snippet", async ({
    page,
  }) => {
    await page.goto("/search?q=youtube");

    // "About N results (S seconds)" stats line.
    await expect(page.getByText(/^About [\d,]+ results? \(\d+\.\d\d seconds\)$/)).toBeVisible();

    const results = page.locator(".results .result");
    const count = await results.count();
    expect(count).toBeGreaterThan(1);

    // Multiple results should come from the youtube project (home doc + deep links).
    const youtubeResults = page.locator(".result-url", { hasText: "youtube.davids.net" });
    expect(await youtubeResults.count()).toBeGreaterThan(1);

    const first = results.first();
    // liveUrl is null for every project (content/youtube/site.ts), so every href
    // resolves to the project's Wikipedia article.
    await expect(first.locator(".result-title-link")).toHaveAttribute(
      "href",
      "https://davids-wikipedia.vercel.app/wiki/YouTube_(replica)",
    );
    await expect(first.locator(".result-favicon")).toBeVisible();
    await expect(first.locator(".result-url")).toBeVisible();

    // buildSnippet() bolds matched query terms with <b>.
    await expect(first.locator(".result-snippet b").first()).toBeVisible();
  });
});
