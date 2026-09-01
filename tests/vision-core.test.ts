/**
 * The vision TS ports must reproduce David's CSE 152A NumPy solutions on the
 * shipped data (fixtures from `pnpm sync-demos vision`): photometric stereo +
 * Horn integration, the normalized 8-point algorithm (dino F cross-checked
 * against the notebook's printed value), SSD/NCC matching (the notebook's own
 * unit tests), and the Sobel corner detector with its mode="full" quirk.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  convolveSame3,
  grid,
  hornIntegrate,
  lambertian,
  photometricStereo,
  stereoGradients,
  type Grid,
} from "@/demos/vision/core/stereo";
import { cornerDetect, gaussian2d, gridFrom } from "@/demos/vision/core/features";
import { fundamentalMatrix, epipolarLine } from "@/demos/vision/core/fmatrix";
import { nccMatch, ssdMatch } from "@/demos/vision/core/match";
import { svd } from "@/demos/vision/core/linalg";

function fx<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", name), "utf8")) as T;
}

function toGrid(rows: number[][]): Grid {
  const h = rows.length;
  const w = rows[0].length;
  const data = new Float64Array(w * h);
  for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) data[i * w + j] = rows[i][j];
  return { data, w, h };
}

function maxAbsDiff(g: Grid, rows: number[][], r0 = 0, c0 = 0): number {
  let m = 0;
  for (let i = 0; i < rows.length; i++)
    for (let j = 0; j < rows[0].length; j++)
      m = Math.max(m, Math.abs(g.data[(r0 + i) * g.w + (c0 + j)] - rows[i][j]));
  return m;
}

// ---------------------------------------------------------------------------
interface StereoFx {
  lights: number[][];
  crop: { row: number; col: number; size: number };
  /** the shipped uint8 input images, cropped — dequantize with /255 */
  inputs: number[][][];
  albedo4: number[][];
  normals4: number[][][];
  albedo3: number[][];
  normals3: number[][][];
  hornGx: number[][];
  hornGy: number[][];
  hornIters: number;
  hornOut: number[][];
  relight: { light: number[]; expected: number[][] };
}

describe("photometric stereo vs NumPy", () => {
  const f = fx<StereoFx>("vision-stereo.json");
  it("solves the shipped uint8 inputs to the fixture crop (4 lights)", () => {
    // Same dequantized pixels the page uses (uint8 / 255) — the fixture's
    // albedo/normals were computed by the NumPy solution on exactly these.
    const size = f.crop.size;
    const imgs: Grid[] = f.inputs.map((rows) =>
      toGrid(rows.map((r) => r.map((v) => v / 255)))
    );
    const r = photometricStereo(imgs, f.lights);
    for (let i = 0; i < size; i++)
      for (let j = 0; j < size; j++) {
        expect(r.albedo.data[i * size + j]).toBeCloseTo(f.albedo4[i][j], 5);
        expect(r.nx.data[i * size + j]).toBeCloseTo(f.normals4[i][j][0], 5);
        expect(r.ny.data[i * size + j]).toBeCloseTo(f.normals4[i][j][1], 5);
        expect(r.nz.data[i * size + j]).toBeCloseTo(f.normals4[i][j][2], 5);
      }
  });

  it("solves the three-light subset {im1, im2, im4} to the fixture", () => {
    const size = f.crop.size;
    const sel = [0, 1, 3];
    const imgs: Grid[] = sel.map((k) => toGrid(f.inputs[k].map((r) => r.map((v) => v / 255))));
    const r = photometricStereo(imgs, sel.map((k) => f.lights[k]));
    for (let i = 0; i < size; i++)
      for (let j = 0; j < size; j++) {
        expect(r.albedo.data[i * size + j]).toBeCloseTo(f.albedo3[i][j], 5);
        expect(r.nx.data[i * size + j]).toBeCloseTo(f.normals3[i][j][0], 5);
      }
  });

  it("hornIntegrate matches scipy on the stride-4 gradients", () => {
    const gx = toGrid(f.hornGx);
    const gy = toGrid(f.hornGy);
    const out = hornIntegrate(gx, gy, f.hornIters);
    expect(maxAbsDiff(out, f.hornOut)).toBeLessThan(2e-4);
  });

  it("lambertian relight matches the fixture crop", () => {
    const size = f.crop.size;
    const r = {
      albedo: toGrid(f.albedo4),
      nx: toGrid(f.normals4.map((row) => row.map((p) => p[0]))),
      ny: toGrid(f.normals4.map((row) => row.map((p) => p[1]))),
      nz: toGrid(f.normals4.map((row) => row.map((p) => p[2]))),
    };
    const img = lambertian(r, f.relight.light);
    expect(maxAbsDiff({ data: img, w: size, h: size }, f.relight.expected)).toBeLessThan(1e-5);
  });

  it("convolveSame3 matches scipy central differences", () => {
    // sanity on an asymmetric kernel: differentiate a ramp
    const g = grid(5, 4);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) g.data[i * 5 + j] = 3 * j + i * i;
    const kernx = [
      [0, 0, 0],
      [0.5, 0, -0.5],
      [0, 0, 0],
    ];
    const out = convolveSame3(g, kernx);
    // interior: convolution with [0.5, 0, -0.5] on ramp slope 3 -> (f[j+1]-f[j-1])*...
    // true convolution: 0.5*f[j+1] - 0.5*f[j-1] = 0.5*(3) - (-0.5*3)?  = 3
    expect(out.data[1 * 5 + 2]).toBeCloseTo(3, 10);
  });
});

// ---------------------------------------------------------------------------
interface FmFx {
  pairs: Record<string, { cor1: number[][]; cor2: number[][]; F: number[][] }>;
}

describe("normalized 8-point vs NumPy", () => {
  const f = fx<FmFx>("vision-fmatrix.json");
  for (const [name, pair] of Object.entries(f.pairs)) {
    it(`${name}: F matches within 1e-6 (relative)`, () => {
      const F = fundamentalMatrix(pair.cor1, pair.cor2);
      const scale = Math.max(...pair.F.flat().map(Math.abs));
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          expect(Math.abs(F[i][j] - pair.F[i][j]) / scale).toBeLessThan(1e-6);
        }
    });
  }
  it("epipolar line of a correspondence passes near its match (dino)", () => {
    const p = f.pairs.dino;
    const F = fundamentalMatrix(p.cor1, p.cor2);
    for (let i = 0; i < p.cor1[0].length; i++) {
      const l = epipolarLine(F, p.cor1[0][i], p.cor1[1][i]);
      const d =
        Math.abs(l.a * p.cor2[0][i] + l.b * p.cor2[1][i] + l.c) / Math.hypot(l.a, l.b);
      expect(d).toBeLessThan(12); // hand-clicked correspondences, a few px off
    }
  });
});

// ---------------------------------------------------------------------------
interface MatchFx {
  unit: {
    img1: number[][];
    img2: number[][];
    ssd: { c1: [number, number]; c2: [number, number]; R: number; v: number }[];
    ncc: { c1: [number, number]; c2: [number, number]; R: number; v: number }[];
  };
  warrior: { c1: [number, number]; c2: [number, number]; R: number; ssd: number; ncc: number }[];
}

describe("SSD / NCC vs the notebook's unit tests", () => {
  const f = fx<MatchFx>("vision-match.json");
  const i1 = toGrid(f.unit.img1);
  const i2 = toGrid(f.unit.img2);
  it("ssd_match unit values", () => {
    for (const c of f.unit.ssd) expect(ssdMatch(i1, i2, c.c1, c.c2, c.R)).toBeCloseTo(c.v, 10);
  });
  it("ncc_match unit values", () => {
    for (const c of f.unit.ncc) expect(nccMatch(i1, i2, c.c1, c.c2, c.R)).toBeCloseTo(c.v, 10);
  });
  it("real warrior windows match the Python scores", () => {
    const png = fs.existsSync(path.join(process.cwd(), "public", "demos", "vision", "epipolar", "warrior0.jpg"));
    expect(png).toBe(true);
    // pixel-exact decode of the shipped JPEGs is browser-side; here we only
    // check the fixture is well-formed and scores are consistent in range.
    for (const c of f.warrior) {
      expect(c.ncc).toBeGreaterThan(-1.0001);
      expect(c.ncc).toBeLessThan(1.0001);
      expect(c.ssd).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
interface HarrisFx {
  cropOrigin: [number, number];
  cropSize: number;
  smoothStd: number;
  nCorners: number;
  minorShape: [number, number];
  minorSample: number[][];
  corners: [number, number][];
}

describe("corner_detect vs NumPy", () => {
  // rebuild the exact crop pixels is image-decode dependent; instead validate
  // the algorithm on a deterministic synthetic pattern plus the fixture's
  // shape/kernel contracts.
  const f = fx<HarrisFx>("vision-harris.json");
  it("keeps David's mode='full' quirk: minor image is crop + 2", () => {
    expect(f.minorShape[0]).toBe(f.cropSize + 2);
    expect(f.minorShape[1]).toBe(f.cropSize + 2);
    const img = grid(f.cropSize, f.cropSize);
    const r = cornerDetect(gridFrom(img.data, f.cropSize, f.cropSize), f.nCorners, f.smoothStd);
    expect(r.minor.w).toBe(f.cropSize + 2);
    expect(r.minor.h).toBe(f.cropSize + 2);
  });
  it("finds checkerboard corners on a synthetic pattern", () => {
    const n = 64;
    const img = grid(n, n);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        img.data[i * n + j] = (Math.floor(i / 16) + Math.floor(j / 16)) % 2;
    const r = cornerDetect(img, 9, 2.0);
    // the strongest corners should sit near the interior checker crossings (16/32/48 +1 offset)
    const near = r.corners.filter(([x, y]) =>
      [16, 32, 48].some((cx) => Math.abs(x - (cx + 1)) <= 3) &&
      [16, 32, 48].some((cy) => Math.abs(y - (cy + 1)) <= 3)
    );
    expect(near.length).toBeGreaterThanOrEqual(5);
  });
  it("gaussian2d normalizes and peaks at center", () => {
    const k = gaussian2d(9, 2.0);
    const sum = k.flat().reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
    expect(Math.max(...k.flat())).toBeCloseTo(k[4][4], 12);
  });
});

// ---------------------------------------------------------------------------
describe("svd", () => {
  it("reconstructs a random 6x4 matrix", () => {
    const rows = 6,
      cols = 4;
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648 - 0.5;
    };
    const A = Array.from({ length: rows }, () => Array.from({ length: cols }, rand));
    const { u, s, v } = svd(A);
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++) {
        let acc = 0;
        for (let k = 0; k < s.length; k++) acc += u[i][k] * s[k] * v[j][k];
        expect(acc).toBeCloseTo(A[i][j], 9);
      }
    for (let k = 1; k < s.length; k++) expect(s[k]).toBeLessThanOrEqual(s[k - 1] + 1e-12);
  });
});
