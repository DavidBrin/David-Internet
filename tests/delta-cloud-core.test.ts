import { describe, expect, it } from "vitest";
import { BANDS, EDGES, FLOWS, NODES, VIEW, VPC_FRAME, nodeById } from "@/demos/delta-cloud/core/model";
import { borderPoint, overlaps, routeEdge } from "@/demos/delta-cloud/core/geometry";
import meta from "@/demos/delta-cloud/meta";
import site from "@content/delta-cloud/site";

describe("Delta Cloud map model", () => {
  const ids = new Set(NODES.map((n) => n.id));

  it("has unique node and edge ids", () => {
    expect(ids.size).toBe(NODES.length);
    expect(new Set(EDGES.map((e) => e.id)).size).toBe(EDGES.length);
  });

  it("every edge joins two known, distinct nodes", () => {
    for (const e of EDGES) {
      expect(ids.has(e.from), `${e.id}: from ${e.from}`).toBe(true);
      expect(ids.has(e.to), `${e.id}: to ${e.to}`).toBe(true);
      expect(e.from).not.toBe(e.to);
    }
  });

  it("every flow walks known edges and every step has a caption", () => {
    const edgeIds = new Set(EDGES.map((e) => e.id));
    for (const f of FLOWS) {
      expect(f.steps.length).toBeGreaterThanOrEqual(4);
      for (const s of f.steps) {
        expect(edgeIds.has(s.edge), `${f.id}: ${s.edge}`).toBe(true);
        expect(s.caption.length).toBeGreaterThan(20);
      }
    }
  });

  it("every node carries a broad phrase and at least one specific point", () => {
    for (const n of NODES) {
      expect(n.detail.phrase.length, n.id).toBeGreaterThan(20);
      expect(n.detail.points.length, n.id).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps the big-picture nodes the page promises", () => {
    for (const id of ["delta", "batch", "cpu-batch", "search", "rds", "redis", "s3", "endpoints", "alb", "waf", "bedrock", "github", "audit"]) {
      expect(ids.has(id), id).toBe(true);
    }
    expect(nodeById("delta").detail.phrase).toMatch(/agent-orchestrated platform/i);
    expect(nodeById("batch").detail.phrase).toMatch(/stateless compute engine/i);
    expect(nodeById("search").detail.phrase).toMatch(/stateless compute engine/i);
  });

  it("omits account ids, CIDRs, and concrete resource names", () => {
    const text = JSON.stringify({ NODES, EDGES, FLOWS, BANDS });
    expect(text).not.toMatch(/\b\d{12}\b/);
    expect(text).not.toMatch(/\d+\.\d+\.\d+\.\d+\/\d+/);
    expect(text).not.toMatch(/pf-delta|pfdelta|pf-infra|katalyxt\.ai/);
  });

  it("lays every node inside the canvas and its band, with no two nodes overlapping", () => {
    const bandById = new Map(BANDS.map((b) => [b.id, b]));
    for (const n of NODES) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w).toBeLessThanOrEqual(VIEW.w);
      expect(n.y + n.h).toBeLessThanOrEqual(VIEW.h);
      const band = bandById.get(n.group);
      expect(band, `${n.id} has no band for group ${n.group}`).toBeTruthy();
      expect(n.x, `${n.id} left of band`).toBeGreaterThanOrEqual(band!.x);
      expect(n.y, `${n.id} above band`).toBeGreaterThanOrEqual(band!.y);
      expect(n.x + n.w, `${n.id} past band right`).toBeLessThanOrEqual(band!.x + band!.w);
      expect(n.y + n.h, `${n.id} past band bottom`).toBeLessThanOrEqual(band!.y + band!.h);
    }
    for (let i = 0; i < NODES.length; i++) {
      for (let j = i + 1; j < NODES.length; j++) {
        expect(overlaps(NODES[i], NODES[j]), `${NODES[i].id} overlaps ${NODES[j].id}`).toBe(false);
      }
    }
  });

  it("keeps VPC bands inside the VPC frame and outside bands outside it", () => {
    for (const b of BANDS) {
      const inside =
        b.x >= VPC_FRAME.x && b.y >= VPC_FRAME.y && b.x + b.w <= VPC_FRAME.x + VPC_FRAME.w && b.y + b.h <= VPC_FRAME.y + VPC_FRAME.h;
      expect(inside, b.id).toBe(!!b.inVpc);
    }
  });
});

describe("Delta Cloud edge routing", () => {
  it("borderPoint lands on the rectangle's edge", () => {
    const n = nodeById("delta");
    const p = borderPoint(n, { x: 5000, y: n.y + n.h / 2 });
    expect(p.x).toBeCloseTo(n.x + n.w);
    expect(p.y).toBeCloseTo(n.y + n.h / 2);
    const q = borderPoint(n, { x: n.x + n.w / 2, y: -5000 });
    expect(q.y).toBeCloseTo(n.y);
  });

  it("routes each edge from outside one box to outside the other", () => {
    const inside = (p: { x: number; y: number }, id: string) => {
      const n = nodeById(id);
      return p.x > n.x && p.x < n.x + n.w && p.y > n.y && p.y < n.y + n.h;
    };
    for (const e of EDGES) {
      const seg = routeEdge(e, nodeById);
      expect(inside(seg.a, e.from), `${e.id} start inside ${e.from}`).toBe(false);
      expect(inside(seg.b, e.to), `${e.id} end inside ${e.to}`).toBe(false);
      const length = seg.points.reduce(
        (acc, p, i) => (i === 0 ? 0 : acc + Math.hypot(p.x - seg.points[i - 1].x, p.y - seg.points[i - 1].y)),
        0,
      );
      expect(length, `${e.id} too short`).toBeGreaterThan(8);
      expect([2, 4]).toContain(seg.points.length);
    }
  });
});

describe("Delta Cloud discovery metadata", () => {
  it("story anchors point at stage sections and disclose what is left out", () => {
    const anchors = new Set(meta.story.map((b) => b.anchor).filter(Boolean));
    expect([...anchors].sort()).toEqual(["#cloud-map", "#compute-planes", "#two-environments"]);
    expect(meta.story.map((b) => b.body).join(" ")).toMatch(/Terraform itself is private/);
    expect(meta.sources.every((s) => s.path.startsWith("src/demos/delta-cloud/"))).toBe(true);
  });

  it("is an internal static demo whose deep links match the stage sections", () => {
    expect(site).toMatchObject({
      project: "delta-cloud",
      kind: "demo",
      liveUrl: "/demos/delta-cloud",
      fakeDomain: "cloud.davids.net",
      favicon: "☁️",
    });
    expect(site.deepLinks.map((l) => l.path)).toEqual(["#cloud-map", "#compute-planes", "#two-environments"]);
  });
});
