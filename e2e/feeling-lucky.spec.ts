import { test, expect } from "@playwright/test";

const PROJECT_SLUGS = [
  "linear",
  "youtube",
  "super-smash",
  "fake-phone",
  "bet",
  "dollar-pixels",
  "notion",
];

test.describe("I'm Feeling Lucky", () => {
  test("lands on one of the project fallback docs pages", async ({ page }) => {
    await page.goto("/");

    // feelingLucky() picks a random "home" doc and window.location.assign()s to its href.
    // Every project's liveUrl is null, so every home doc resolves to /sites/<slug>/docs.
    await Promise.all([
      page.waitForURL(new RegExp(`/sites/(${PROJECT_SLUGS.join("|")})/docs$`)),
      page.getByRole("button", { name: "I'm Feeling Lucky" }).click(),
    ]);

    const url = new URL(page.url());
    const match = url.pathname.match(/^\/sites\/([^/]+)\/docs$/);
    expect(match).not.toBeNull();
    expect(PROJECT_SLUGS).toContain(match?.[1]);
  });
});
