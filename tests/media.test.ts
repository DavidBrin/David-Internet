import { describe, expect, it } from "vitest";
import { imageResults, videoResults } from "@/lib/media";
import { fakePhoneManifest, linearManifest, manifests, youtubeManifest } from "./fixtures";

const totalImages = manifests.reduce((n, m) => n + m.images.length, 0);
const totalVideos = manifests.reduce((n, m) => n + m.videos.length, 0);

describe("imageResults", () => {
  it("returns every image in manifest order for an empty query", () => {
    const all = imageResults(manifests, "");
    expect(all).toHaveLength(totalImages);
    expect(all.map((r) => r.image.src)).toEqual(
      manifests.flatMap((m) => m.images.map((i) => i.src)),
    );
  });

  it("treats a whitespace-only query as empty", () => {
    expect(imageResults(manifests, "   ")).toHaveLength(totalImages);
    expect(imageResults(manifests, "\t\n")).toHaveLength(totalImages);
  });

  it("filters to the matching project for a project-name query", () => {
    const results = imageResults(manifests, "youtube");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.project === "youtube")).toBe(true);
  });

  it("matches on the display name and the fake domain", () => {
    expect(imageResults(manifests, "Fake Phone").every((r) => r.project === "fake-phone")).toBe(true);
    expect(imageResults(manifests, "linear.davids.net").map((r) => r.project)).toEqual(["linear"]);
  });

  it("matches on the caption", () => {
    const results = imageResults(manifests, "kanban");
    expect(results.map((r) => r.image.caption)).toEqual([
      "Kanban board grouped by workflow status",
    ]);
  });

  it("matches on manifest keywords and the target path", () => {
    expect(imageResults(manifests, "streaming").every((r) => r.project === "youtube")).toBe(true);
    const watch = imageResults(manifests, "watch");
    expect(watch.length).toBeGreaterThan(0);
    expect(watch[0].image.targetPath).toBe("/watch");
  });

  it("ranks the more relevant entry first", () => {
    const results = imageResults(manifests, "youtube watch player");
    expect(results[0].image.targetPath).toBe("/watch");
  });

  it("returns [] when nothing matches", () => {
    expect(imageResults(manifests, "zzzzqqqq")).toEqual([]);
  });

  it("carries the site identity and a resolved href", () => {
    const [first] = imageResults([youtubeManifest], "");
    expect(first.project).toBe("youtube");
    expect(first.siteName).toBe("YouTube Replica");
    expect(first.fakeDomain).toBe("youtube.davids.net");
    expect(first.href).toBe("https://youtube-david.vercel.app");
    const watch = imageResults([youtubeManifest], "watch")[0];
    expect(watch.href).toBe("https://youtube-david.vercel.app/watch");
  });

  it("falls back to the internal docs page when liveUrl is null", () => {
    const results = imageResults([fakePhoneManifest], "");
    expect(results).toHaveLength(1);
    expect(results[0].href).toBe("/sites/fake-phone/docs");
  });

  it("returns [] for manifests with no images", () => {
    expect(imageResults([{ ...linearManifest, images: [] }], "")).toEqual([]);
    expect(imageResults([], "anything")).toEqual([]);
  });
});

describe("videoResults", () => {
  it("returns every video in manifest order for an empty query", () => {
    const all = videoResults(manifests, "");
    expect(all).toHaveLength(totalVideos);
    expect(all.map((r) => r.video.src)).toEqual(
      manifests.flatMap((m) => m.videos.map((v) => v.src)),
    );
  });

  it("filters by relevance", () => {
    const results = videoResults(manifests, "prank");
    expect(results.map((r) => r.project)).toEqual(["fake-phone"]);
    expect(results[0].video.duration).toBe("0:09");
  });

  it("matches on the caption and keeps the poster and duration intact", () => {
    const results = videoResults(manifests, "walkthrough");
    expect(results).toHaveLength(1);
    expect(results[0].video.poster).toBe("/content/youtube/clips/walkthrough.jpg");
    expect(results[0].video.duration).toBe("0:42");
  });

  it("resolves hrefs against the deep-link target path", () => {
    const [linearVideo] = videoResults([linearManifest], "");
    expect(linearVideo.href).toBe("https://linear-david.vercel.app/issues");
    const [phoneVideo] = videoResults([fakePhoneManifest], "");
    expect(phoneVideo.href).toBe("/sites/fake-phone/docs");
  });

  it("returns [] when nothing matches", () => {
    expect(videoResults(manifests, "zzzzqqqq")).toEqual([]);
  });
});
