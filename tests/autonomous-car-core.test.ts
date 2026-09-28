/**
 * The autonomous-car TS ports must reproduce David's ORIGINAL ROS 2 nodes, run by
 * `pnpm sync-demos autonomous-car` under stubbed rclpy / cv_bridge / roboflowoak /
 * PCA9685 modules (see scripts/demos/autonomous-car_prep.py):
 *
 *  - cv:       every OpenCV op the lane node calls, bit-exact vs cv2 4.11 on random images
 *  - lane:     lane_detection_node.locate_centroid on 12 rendered frames x 8 parameter
 *              variants: published /centroid value, every stage (crc32), contours
 *  - detect:   camera_driver2.run_model on scripted predictions, 3 selection methods
 *  - guidance: lane_guidance_node3.PathPlanner on a 45 s message stream: every /cmd_vel
 *              Twist and log line, twice (yaml gains + a PID variant), and the startup probe
 *  - servo:    servo_sweeper duty cycles
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as cv from "@/demos/autonomous-car/core/cv";
import { locateCentroid } from "@/demos/autonomous-car/core/lane";
import { runModel, type Prediction, type SelectionMethod } from "@/demos/autonomous-car/core/detect";
import { PathPlanner, type Twist } from "@/demos/autonomous-car/core/control";
import { GUIDANCE_PARAMS, LANE_PARAMS, servoDuty, type GuidanceParams, type LaneParams } from "@/demos/autonomous-car/core/params";

function fx<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", name), "utf8")) as T;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(d: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = CRC_TABLE[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const bytes = (b64: string) => new Uint8Array(Buffer.from(b64, "base64"));

describe("OpenCV ops vs cv2", () => {
  const data = fx<{
    cases: {
      w: number;
      h: number;
      k: number;
      it: number;
      img: string;
      bw: string;
      hsv: number;
      gray: number;
      blur: number;
      erode: number;
      dilate: number;
      contours: { pts: [number, number][]; rect: number[]; m: number[] }[];
    }[];
  }>("autonomous-car-cv.json");

  it("color conversion, blur and morphology are bit-exact", () => {
    for (const c of data.cases) {
      const img: cv.Mat = { w: c.w, h: c.h, c: 3, data: bytes(c.img) };
      expect(crc32(cv.bgr2hsv(img).data)).toBe(c.hsv);
      const g = cv.bgr2gray(img);
      expect(crc32(g.data)).toBe(c.gray);
      expect(crc32(cv.blur(g, c.k).data)).toBe(c.blur);
      expect(crc32(cv.erode(g, c.k, c.it).data)).toBe(c.erode);
      expect(crc32(cv.dilate(g, c.k, c.it).data)).toBe(c.dilate);
    }
  });

  it("findContours (external, no approximation) matches point for point, in order", () => {
    let n = 0;
    for (const c of data.cases) {
      const got = cv.findContoursExternal({ w: c.w, h: c.h, c: 1, data: bytes(c.bw) });
      expect(got.length).toBe(c.contours.length);
      got.forEach((pts, i) => expect(pts).toEqual(c.contours[i].pts));
      n += got.length;
    }
    expect(n).toBeGreaterThan(100);
  });

  it("minAreaRect and moments match", () => {
    for (const c of data.cases)
      for (const ref of c.contours) {
        const r = cv.minAreaRect(ref.pts);
        const [cx, cy, w, h, a] = ref.rect;
        expect(r.cx).toBeCloseTo(cx, 3);
        expect(r.cy).toBeCloseTo(cy, 3);
        expect(r.w).toBeCloseTo(w, 3);
        expect(r.h).toBeCloseTo(h, 3);
        expect(r.angle).toBeCloseTo(a, 3);
        const m = cv.contourMoments(ref.pts);
        expect(m.m00).toBeCloseTo(ref.m[0], 6);
        expect(m.m10).toBeCloseTo(ref.m[1], 4);
        expect(m.m01).toBeCloseTo(ref.m[2], 4);
      }
  });
});

describe("lane_detection_node.locate_centroid", () => {
  const data = fx<{
    frames: Record<string, { box: [number, number, number, number]; w: number; h: number; bgr: string }>;
    cases: {
      frame: string;
      variant: string;
      params: LaneParams;
      published: number | null;
      stages: Record<string, number>;
      contours: { n: number; w: number; h: number; pass: boolean; cx?: number; cy?: number }[];
    }[];
  }>("autonomous-car-lane.json");

  function frameOf(name: string): cv.Mat {
    const f = data.frames[name];
    const [x0, y0, x1] = f.box;
    const full = cv.mat(f.w, f.h, 3);
    const crop = bytes(f.bgr);
    const cw = x1 - x0;
    for (let y = 0; y < crop.length / (cw * 3); y++) full.data.set(crop.subarray(y * cw * 3, (y + 1) * cw * 3), ((y0 + y) * f.w + x0) * 3);
    return full;
  }

  it("the yaml calibration is what the port ships", () => {
    const yaml = data.cases.find((c) => c.variant === "yaml")!.params;
    for (const k of Object.keys(LANE_PARAMS) as (keyof LaneParams)[]) expect(LANE_PARAMS[k]).toBe(yaml[k]);
  });

  it("publishes the same /centroid value as the original node on every frame and variant", () => {
    let published = 0;
    for (const c of data.cases) {
      const r = locateCentroid(frameOf(c.frame), c.params);
      if (c.published === null) expect(r.error, `${c.frame}/${c.variant}`).toBeNull();
      else {
        expect(r.error, `${c.frame}/${c.variant}`).not.toBeNull();
        expect(r.error!).toBeCloseTo(c.published, 12);
        published++;
      }
    }
    expect(published).toBeGreaterThan(50);
  });

  it("matches every intermediate stage and contour", () => {
    for (const c of data.cases) {
      const r = locateCentroid(frameOf(c.frame), c.params);
      const s = r.stages;
      const got: Record<string, number> = {
        hsv: crc32(s.hsv.data),
        mask: crc32(s.mask.data),
        masked: crc32(s.masked.data),
        gray: crc32(s.gray.data),
        bw: crc32(s.bw.data),
        blurred: crc32(s.blurred.data),
        eroded: crc32(s.eroded.data),
        dilated: crc32(s.dilated.data),
        final: crc32(s.final.data),
      };
      expect(got, `${c.frame}/${c.variant}`).toEqual(c.stages);
      expect(r.contours.length).toBe(c.contours.length);
      r.contours.forEach((k, i) => {
        const ref = c.contours[i];
        expect(k.pts.length).toBe(ref.n);
        expect(k.rect.w).toBeCloseTo(ref.w, 3);
        expect(k.rect.h).toBeCloseTo(ref.h, 3);
        expect(k.pass).toBe(ref.pass);
        expect(k.cx).toBe(ref.cx);
        expect(k.cy).toBe(ref.cy);
      });
    }
  });
});

describe("camera_driver2.run_model", () => {
  const data = fx<{
    imageWidth: number;
    cases: { method: SelectionMethod; preds: number[][]; flag: boolean; centroid?: number; width?: number }[];
  }>("autonomous-car-detect.json");

  it("publishes the same flag, steering error and width", () => {
    for (const c of data.cases) {
      const preds: Prediction[] = c.preds.map(([x, y, width, height, confidence], i) => ({ id: `p${i}`, label: "garbage", x, y, width, height, confidence }));
      const out = runModel(preds, data.imageWidth, c.method);
      expect(out.flag).toBe(c.flag);
      if (c.centroid === undefined) expect(out.centroid).toBeNull();
      else expect(out.centroid!).toBeCloseTo(c.centroid, 12);
      if (c.width === undefined) expect(out.width).toBeNull();
      else expect(out.width!).toBeCloseTo(c.width, 9);
    }
  });
});

describe("lane_guidance_node3.PathPlanner", () => {
  const data = fx<{
    events: [number, "centroid" | "width" | "tick", number | string | null][];
    runs: Record<string, { params: GuidanceParams; cmd_vel: [number, number, number][]; logs: [string, string][] }>;
    probes: Record<"absent" | "silent" | "live", { topic: string; logs: string[] }>;
  }>("autonomous-car-guidance.json");

  const num = (v: number | string | null) => (typeof v === "string" ? (v === "nan" ? NaN : v === "inf" ? Infinity : -Infinity) : (v as number));

  it("the yaml gains are what the port ships", () => {
    const p = data.runs.yaml.params;
    for (const k of Object.keys(GUIDANCE_PARAMS) as (keyof GuidanceParams)[]) {
      // not in racer_calibration2.yaml: the node's declared default (200 px) applied
      if (k === "width_threshold") expect(p[k]).toBeUndefined();
      else expect(GUIDANCE_PARAMS[k]).toBe(p[k]);
    }
    expect(GUIDANCE_PARAMS.width_threshold).toBe(200);
  });

  for (const name of ["yaml", "pid"]) {
    it(`publishes the same /cmd_vel stream and logs (${name})`, () => {
      const run = data.runs[name];
      const pl = new PathPlanner({ ...GUIDANCE_PARAMS, ...run.params });
      pl.nextPid = 1001 + (name === "pid" ? 2 : 0);
      pl.probe(false, false, 0);
      pl.logs = [];
      const out: Twist[] = [];
      pl.publish = (tw) => out.push({ ...tw });
      for (const [t, kind, v] of data.events) {
        if (kind === "centroid") pl.onCentroid(num(v), t);
        else if (kind === "width") pl.onWidth(num(v), t);
        else pl.tick(t);
      }
      expect(out.length).toBe(run.cmd_vel.length);
      out.forEach((tw, i) => {
        expect(tw.linear).toBeCloseTo(run.cmd_vel[i][1], 12);
        expect(tw.angular).toBeCloseTo(run.cmd_vel[i][2], 12);
      });
      expect(pl.logs.map((l) => [l.level, l.msg])).toEqual(run.logs);
    });
  }

  it("probes /object_detections/centroid once at startup, like check_topic_availability", () => {
    const cases: ["absent" | "silent" | "live", boolean, boolean][] = [
      ["absent", false, false],
      ["silent", false, true],
      ["live", true, true],
    ];
    for (const [name, seen, exists] of cases) {
      const pl = new PathPlanner(GUIDANCE_PARAMS);
      expect(pl.probe(seen, exists)).toBe(data.probes[name].topic);
      expect(pl.logs.map((l) => l.msg)).toEqual(data.probes[name].logs);
    }
  });

  it("falls back to /centroid when the detection topic has the wrong message type", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "demos/autonomous_car_raw/Code/lane_guidance_node3.py"), "utf-8");
    expect(src).toContain("!= 'std_msgs/msg/Float32'");
    expect(src).toContain("has wrong message type. Using {CENTROID_TOPIC_NAME}");
    const pl = new PathPlanner(GUIDANCE_PARAMS);
    expect(pl.probe(true, true, 0, "std_msgs/msg/Int32")).toBe("/centroid");
    expect(pl.logs.at(-1)).toEqual({ t: 0, level: "WARN", msg: "Topic /object_detections/centroid has wrong message type. Using /centroid" });
  });
});

describe("servo_sweeper", () => {
  const data = fx<{ sequence: number[]; angles: number[]; duties: number[] }>("autonomous-car-servo.json");
  it("computes the same PCA9685 duty cycles", () => {
    expect(data.sequence).toEqual([servoDuty(0).duty, servoDuty(100).duty, 0]);
    data.angles.forEach((a, i) => expect(servoDuty(a).duty).toBe(data.duties[i]));
  });
});
