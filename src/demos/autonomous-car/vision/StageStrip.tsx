"use client";

/**
 * The nine intermediate images of locate_centroid, each on a 1:1 canvas (448x96, the
 * crop) scaled by CSS with pixelated sampling, captioned with the Python line that made it.
 */
import { memo, useCallback, useEffect, useRef } from "react";
import type { LaneResult } from "../core/lane";
import type { LaneParams } from "../core/params";
import type { Mat } from "../core/cv";
import { countOn, matToCanvas } from "./render";

type StageKey = "roi" | "mask" | "masked" | "gray" | "bw" | "blurred" | "eroded" | "dilated" | "final";

interface StageDef {
  key: StageKey;
  title: string;
  code: (p: LaneParams) => string;
  note: (p: LaneParams, r: LaneResult) => string;
  binary?: boolean;
}

/** OpenCV's fixed-point BGR2GRAY applied to (H, S, V) read as (B, G, R). */
function grayOfHSV(h: number, s: number, v: number): number {
  return (h * 3735 + s * 19235 + v * 9798 + 16384) >> 15;
}

const STAGES: StageDef[] = [
  {
    key: "roi",
    title: "Crop",
    code: () => "img = frame[self.start_height:self.bottom_height, self.left_width:self.right_width]",
    note: (_p, r) => `${r.width}x${r.height} px of the 640x480 frame, fixed on the first frame (camera_init).`,
  },
  {
    key: "mask",
    title: "HSV mask",
    code: () => "mask = cv2.inRange(hsv, lower, upper)",
    note: (p) =>
      `hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV) first. White where H ${p.Hue_low} to ${p.Hue_high}, S ${p.Saturation_low} to ${p.Saturation_high} and V ${p.Value_low} to ${p.Value_high}, all inclusive.`,
    binary: true,
  },
  {
    key: "masked",
    title: "Masked HSV",
    code: (p) =>
      p.inverted_filter === 1
        ? "bitwise_mask = cv2.bitwise_and(hsv, hsv, mask=cv2.bitwise_not(mask))"
        : "bitwise_mask = cv2.bitwise_and(hsv, hsv, mask=mask)",
    note: (p) =>
      `The HSV bytes where the mask is ${p.inverted_filter === 1 ? "black (inverted_filter = 1)" : "white"}, zero elsewhere. Shown the way cv2.imshow would: H, S, V painted as B, G, R.`,
  },
  {
    key: "gray",
    title: "Gray of masked HSV",
    code: () => "gray = cv2.cvtColor(bitwise_mask, cv2.COLOR_BGR2GRAY)",
    note: (p) => {
      const lo = grayOfHSV(p.Hue_low, p.Saturation_low, p.Value_low);
      const cut =
        p.inverted_filter === 1
          ? ""
          : lo > p.gray_lower
            ? ` With these bounds the dimmest pixel the mask passes has gray ${lo}, above gray_lower ${p.gray_lower}, so the gate only bites once the mask is loosened.`
            : ` With these bounds the dimmest pixel the mask passes has gray ${lo}, so gray_lower ${p.gray_lower} trims the low-S, low-V corner of the mask.`;
      return `The node converts the masked HSV image as if it were BGR, so gray = 0.114·H + 0.587·S + 0.299·V. That is why gray_lower works as a second gate, one that weighs saturation most.${cut}`;
    },
  },
  {
    key: "bw",
    title: "Threshold",
    code: () => "(dummy, blackAndWhiteImage) = cv2.threshold(gray, self.gray_lower, gray_upper, cv2.THRESH_BINARY)",
    note: (p) => `255 where gray > ${p.gray_lower}.`,
    binary: true,
  },
  {
    key: "blurred",
    title: "Blur",
    code: () => "blurred = cv2.blur(blackAndWhiteImage,(self.kernal_size, self.kernal_size))",
    note: (p) => `${p.kernal_size}x${p.kernal_size} box filter: edges turn gray, lone pixels fade.`,
  },
  {
    key: "eroded",
    title: "Erode",
    code: () => "erosion = cv2.erode(blurred, kernel, iterations = self.erosion_itterations)",
    note: (p) =>
      `kernel = np.ones((${p.kernal_size}, ${p.kernal_size})), ${p.erosion_itterations} iteration${p.erosion_itterations === 1 ? "" : "s"}: minimum filter, removes specks narrower than the kernel.`,
  },
  {
    key: "dilated",
    title: "Dilate",
    code: () => "dilation = cv2.dilate(erosion, kernel, iterations = self.dilation_itterations)",
    note: (p) => {
      const grow = (p.kernal_size >> 1) * p.dilation_itterations;
      return `${p.dilation_itterations} iteration${p.dilation_itterations === 1 ? "" : "s"}: maximum filter, grows blobs by ${grow} px on each side and joins broken tape edges.`;
    },
  },
  {
    key: "final",
    title: "Threshold + contours",
    code: () =>
      "(dummy, blackAndWhiteImage) = cv2.threshold(dilation, self.gray_lower, gray_upper, cv2.THRESH_BINARY)\ncontours, dummy = cv2.findContours(blackAndWhiteImage, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)",
    note: (p, r) => {
      const n = r.contours.length;
      const ok = r.contours.filter((c) => c.pass).length;
      return `gray_lower again re-binarises the blurred edges. ${n} outer contour${n === 1 ? "" : "s"} examined, ${ok} with ${p.Width_min} < w < ${p.Width_max}.`;
    },
    binary: true,
  },
];

function Thumb({ def, idx, r, params }: { def: StageDef; idx: number; r: LaneResult | null; params: LaneParams }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statRef = useRef<HTMLSpanElement | null>(null);
  const setCanvas = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
    if (el) el.style.display = "block";
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !r) return;
    const m: Mat = r.stages[def.key];
    matToCanvas(m, c);
    if (def.key === "final") {
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.lineWidth = 2;
        for (const ct of r.contours) {
          ctx.strokeStyle = ct.pass ? "rgb(0,255,0)" : "rgb(255,70,70)";
          ctx.beginPath();
          ct.pts.forEach((p, i) => (i ? ctx.lineTo(p[0] + 0.5, p[1] + 0.5) : ctx.moveTo(p[0] + 0.5, p[1] + 0.5)));
          ctx.closePath();
          ctx.stroke();
          if (ct.cx !== undefined && ct.cy !== undefined) {
            ctx.fillStyle = "rgb(0,255,0)";
            ctx.beginPath();
            ctx.arc(ct.cx, ct.cy, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    if (statRef.current) {
      if (m.c === 1 && def.binary) {
        const on = countOn(m);
        statRef.current.textContent = `${on.toLocaleString("en-US")} px white (${((100 * on) / (m.w * m.h)).toFixed(1)}%)`;
      } else if (m.c === 1) {
        let mx = 0;
        for (let i = 0; i < m.data.length; i++) if (m.data[i] > mx) mx = m.data[i];
        statRef.current.textContent = `max ${mx}`;
      } else statRef.current.textContent = `${m.w}x${m.h}x3`;
    }
  }, [r, def]);

  return (
    <figure className="acViThumb">
      <div className="acViThumbHead">
        <span className="acViThumbNum">{idx + 1}</span>
        <span className="acViThumbTitle">{def.title}</span>
        <span ref={statRef} className="acViThumbStat acMono" />
      </div>
      <div className="acViThumbImg">
        <canvas ref={setCanvas} width={448} height={96} />
      </div>
      <figcaption>
        <code className="acViCode">{def.code(params)}</code>
        {r ? <span className="acViThumbNote">{def.note(params, r)}</span> : null}
      </figcaption>
    </figure>
  );
}

function StageStrip({ r, params }: { r: LaneResult | null; params: LaneParams }) {
  return (
    <div className="acPanel acViStages">
      <div className="acViSectionHead">
        <h3 className="acViH3">Every intermediate image</h3>
        <span className="acChip">mirrors locate_centroid</span>
      </div>
      <div className="acViThumbGrid">
        {STAGES.map((def, i) => (
          <Thumb key={def.key} def={def} idx={i} r={r} params={params} />
        ))}
      </div>
    </div>
  );
}

export default memo(StageStrip);
