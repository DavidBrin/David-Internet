/**
 * Shared thermal colormap + frame helpers for the ESP32 demo.
 * Frames ship as int16 quarter-degrees (°C × 4) in frames.json.
 */

export interface ThermalFrame {
  /** 64 temperatures in °C. */
  px: Float32Array;
  label: "present" | "empty";
  /** Salted-hash prefix of the contributor id. */
  sid: string;
  /** Sequence index within the contributor's contiguous run. */
  seq: number;
}

export interface FramesJson {
  note: string;
  tempScale: number; // 4 → quarter degrees
  frames: { p: number[]; l: 0 | 1; s: string }[];
  /** [start, end) ranges of contiguous sequences for the scrubber. */
  sequences: { sid: string; start: number; end: number }[];
  stats: { total: number; present: number; empty: number };
}

export function decodeFrames(j: FramesJson): ThermalFrame[] {
  const out: ThermalFrame[] = [];
  for (const s of j.sequences) {
    for (let i = s.start; i < s.end; i++) {
      const f = j.frames[i];
      out.push({
        px: Float32Array.from(f.p, (v) => v / j.tempScale),
        label: f.l === 1 ? "present" : "empty",
        sid: f.s,
        seq: i - s.start,
      });
    }
  }
  return out;
}

/** Ironbow-style thermal palette: t in [0,1] → [r,g,b]. */
export function thermalColor(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t));
  // black → purple → red → orange → yellow → white
  const stops: [number, number, number, number][] = [
    [0.0, 8, 4, 32],
    [0.2, 66, 10, 104],
    [0.45, 176, 32, 64],
    [0.7, 236, 120, 16],
    [0.88, 252, 208, 60],
    [1.0, 255, 255, 240],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      const [t0, r0, g0, b0] = stops[i - 1];
      const [t1, r1, g1, b1] = stops[i];
      const f = (x - t0) / (t1 - t0);
      return [r0 + f * (r1 - r0), g0 + f * (g1 - g0), b0 + f * (b1 - b0)];
    }
  }
  return [255, 255, 240];
}

/** Grayscale alternative used by the colormap picker. */
export function grayColor(t: number): [number, number, number] {
  const v = Math.max(0, Math.min(1, t)) * 255;
  return [v, v, v];
}

/**
 * Bicubic (Catmull-Rom) upsample of an 8x8 grid to n×n — what thermal_viewer.py's
 * interpolation="bicubic" shows vs "nearest".
 */
export function bicubicUpsample(px: ArrayLike<number>, n: number): Float32Array {
  const out = new Float32Array(n * n);
  const get = (r: number, c: number) => {
    const rr = Math.max(0, Math.min(7, r));
    const cc = Math.max(0, Math.min(7, c));
    return px[rr * 8 + cc];
  };
  const cubic = (p0: number, p1: number, p2: number, p3: number, t: number) =>
    p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  for (let y = 0; y < n; y++) {
    const fy = (y / (n - 1)) * 7;
    const ry = Math.floor(fy);
    const ty = fy - ry;
    for (let x = 0; x < n; x++) {
      const fx = (x / (n - 1)) * 7;
      const rx = Math.floor(fx);
      const tx = fx - rx;
      const col = [];
      for (let k = -1; k <= 2; k++) {
        col.push(cubic(get(ry + k, rx - 1), get(ry + k, rx), get(ry + k, rx + 1), get(ry + k, rx + 2), tx));
      }
      out[y * n + x] = cubic(col[0], col[1], col[2], col[3], ty);
    }
  }
  return out;
}
