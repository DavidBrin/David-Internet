"use client";

/**
 * Sub-panel B — epipolar lines, the headline. F is recomputed live in TS from
 * the 13 dino correspondences and checked against the notebook's stored F.
 * Click either image to sweep its epipolar line across the other; hover a
 * correspondence dot to preview the same thing instantly.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  epipolarLine,
  epipolarLineLeft,
  epipole,
  fundamentalMatrix,
} from "@/demos/vision/core/fmatrix";
import { matMul, svd, type Mat } from "@/demos/vision/core/linalg";
import type { EpiData } from "./data";
import { setupImageCanvas, toNaturalXY } from "./canvasUtil";
import { epipoleBorderArrow, lineSegmentInRect, scaleLineToDisplay, type Line } from "./geom";

const SWEEP_MS = 550;
const HOVER_PX = 10; // hover-hit radius, in display px (points + mouse are both display-space here)

interface ViewMeta {
  name: "dino0" | "dino1";
  img: HTMLImageElement;
  w: number;
  h: number;
  scale: number;
}

interface ActiveLine {
  targetImg: "dino0" | "dino1";
  originImg: "dino0" | "dino1";
  originX: number;
  originY: number;
  line: Line;
}

interface Props {
  data: EpiData;
  dino0Img: HTMLImageElement;
  dino1Img: HTMLImageElement;
}

function maxAbsDiff(a: Mat, b: Mat): number {
  let m = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m = Math.max(m, Math.abs(a[i][j] - b[i][j]));
  return m;
}

function MiniMatrix({ m, digits = 3 }: { m: number[][]; digits?: number }) {
  return (
    <table className="vsEpMatrix">
      <tbody>
        {m.map((row, i) => (
          <tr key={i}>
            {row.map((v, j) => (
              <td key={j}>{v.toFixed(digits)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function LinesPanel({ data, dino0Img, dino1Img }: Props) {
  const cor = data.correspondences.dino;
  const F = useMemo(() => fundamentalMatrix(cor.cor1, cor.cor2), [cor]);
  const err = useMemo(() => maxAbsDiff(F, data.F.dino), [F, data.F.dino]);

  const scale0 = data.images.dino0.scale;
  const scale1 = data.images.dino1.scale;

  // epipole(F, ...) returns a point in the correspondences' ORIGINAL coordinate
  // frame (data.json note: display_px = original_px * scale) — rescale to each
  // view's display/shipped-px space before using it for bounds checks or drawing.
  const e1 = useMemo(() => {
    const e = epipole(F, false); // epipole in dino0, original coords
    return [e[0] * scale0, e[1] * scale0] as [number, number];
  }, [F, scale0]);
  const e2 = useMemo(() => {
    const e = epipole(F, true); // epipole in dino1, original coords
    return [e[0] * scale1, e[1] * scale1] as [number, number];
  }, [F, scale1]);

  const nPts = cor.cor1[0].length;
  // correspondences are original-coords too — rescale to display px for drawing.
  const points0 = useMemo<[number, number][]>(
    () => Array.from({ length: nPts }, (_, i) => [cor.cor1[0][i] * scale0, cor.cor1[1][i] * scale0]),
    [cor, nPts, scale0]
  );
  const points1 = useMemo<[number, number][]>(
    () => Array.from({ length: nPts }, (_, i) => [cor.cor2[0][i] * scale1, cor.cor2[1][i] * scale1]),
    [cor, nPts, scale1]
  );

  const meta0: ViewMeta = { name: "dino0", img: dino0Img, w: data.images.dino0.w, h: data.images.dino0.h, scale: scale0 };
  const meta1: ViewMeta = { name: "dino1", img: dino1Img, w: data.images.dino1.w, h: data.images.dino1.h, scale: scale1 };

  const [clickActive, setClickActive] = useState<ActiveLine | null>(null);
  const [hoverActive, setHoverActive] = useState<ActiveLine | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const sweepStartRef = useRef(0);
  const displayActive = hoverActive ?? clickActive;
  const sweeping = !hoverActive && clickActive !== null;

  const canvas0Ref = useRef<HTMLCanvasElement | null>(null);
  const canvas1Ref = useRef<HTMLCanvasElement | null>(null);

  function handleMove(view: ViewMeta, e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = view.name === "dino0" ? canvas0Ref.current : canvas1Ref.current;
    if (!canvas) return;
    const [x, y] = toNaturalXY(canvas, e.clientX, e.clientY, view.w); // display px
    const thisPoints = view.name === "dino0" ? points0 : points1; // display px too
    let best = -1;
    let bestD = HOVER_PX;
    for (let i = 0; i < thisPoints.length; i++) {
      const [px, py] = thisPoints[i];
      const d = Math.hypot(px - x, py - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) {
      if (hoverIdx !== null) {
        setHoverIdx(null);
        setHoverActive(null);
      }
      return;
    }
    if (best === hoverIdx) return;
    setHoverIdx(best);
    const [ox, oy] = thisPoints[best]; // display px, for the origin marker
    const targetImg = view.name === "dino0" ? "dino1" : "dino0";
    const targetScale = targetImg === "dino0" ? scale0 : scale1;
    const oxOrig = ox / view.scale;
    const oyOrig = oy / view.scale;
    const line = view.name === "dino0" ? epipolarLine(F, oxOrig, oyOrig) : epipolarLineLeft(F, oxOrig, oyOrig);
    setHoverActive({ targetImg, originImg: view.name, originX: ox, originY: oy, line: scaleLineToDisplay(line, targetScale) });
  }

  function handleLeave() {
    setHoverIdx(null);
    setHoverActive(null);
  }

  function handleClick(view: ViewMeta, e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = view.name === "dino0" ? canvas0Ref.current : canvas1Ref.current;
    if (!canvas) return;
    const [x, y] = toNaturalXY(canvas, e.clientX, e.clientY, view.w); // display px
    const xOrig = x / view.scale;
    const yOrig = y / view.scale;
    const targetImg = view.name === "dino0" ? "dino1" : "dino0";
    const targetScale = targetImg === "dino0" ? scale0 : scale1;
    const line = view.name === "dino0" ? epipolarLine(F, xOrig, yOrig) : epipolarLineLeft(F, xOrig, yOrig);
    setClickActive({ targetImg, originImg: view.name, originX: x, originY: y, line: scaleLineToDisplay(line, targetScale) });
    sweepStartRef.current = performance.now();
  }

  // draw one view: base image, correspondence dots, epipole, origin marker / line
  useEffect(() => {
    const canvas0 = canvas0Ref.current;
    const canvas1 = canvas1Ref.current;
    if (!canvas0 || !canvas1) return;
    let raf = 0;

    const drawView = (canvas: HTMLCanvasElement, view: ViewMeta, myPoints: [number, number][], epi: [number, number]) => {
      const { ctx } = setupImageCanvas(canvas, view.w, view.h, view.scale);
      ctx.clearRect(0, 0, view.w, view.h);
      ctx.drawImage(view.img, 0, 0, view.w, view.h);

      // correspondence dots
      for (let i = 0; i < myPoints.length; i++) {
        const [x, y] = myPoints[i];
        const isHover = i === hoverIdx;
        ctx.beginPath();
        ctx.arc(x, y, isHover ? 5.5 / view.scale : 3 / view.scale, 0, Math.PI * 2);
        ctx.fillStyle = isHover ? "#f59e0b" : "rgba(21,128,61,0.75)";
        ctx.fill();
        if (isHover) {
          ctx.lineWidth = 1.2 / view.scale;
          ctx.strokeStyle = "#f59e0b";
          ctx.stroke();
        }
      }

      // epipole marker or border arrow
      const inside = epi[0] >= 0 && epi[0] <= view.w && epi[1] >= 0 && epi[1] <= view.h;
      ctx.strokeStyle = "#7c3aed";
      ctx.fillStyle = "#7c3aed";
      ctx.lineWidth = 1.6 / view.scale;
      if (inside) {
        ctx.beginPath();
        ctx.arc(epi[0], epi[1], 6 / view.scale, 0, Math.PI * 2);
        ctx.moveTo(epi[0] - 9 / view.scale, epi[1]);
        ctx.lineTo(epi[0] + 9 / view.scale, epi[1]);
        ctx.moveTo(epi[0], epi[1] - 9 / view.scale);
        ctx.lineTo(epi[0], epi[1] + 9 / view.scale);
        ctx.stroke();
      } else {
        const [ax, ay] = epipoleBorderArrow(epi[0], epi[1], view.w, view.h);
        const cx = view.w / 2;
        const cy = view.h / 2;
        const ang = Math.atan2(epi[1] - cy, epi[0] - cx);
        const len = 14 / view.scale;
        ctx.beginPath();
        ctx.moveTo(ax - Math.cos(ang) * len, ay - Math.sin(ang) * len);
        ctx.lineTo(ax, ay);
        ctx.lineTo(ax - Math.cos(ang - 0.4) * (len * 0.55), ay - Math.sin(ang - 0.4) * (len * 0.55));
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - Math.cos(ang + 0.4) * (len * 0.55), ay - Math.sin(ang + 0.4) * (len * 0.55));
        ctx.stroke();
      }

      // active epipolar line, if this view is the target
      let again = false;
      if (displayActive && displayActive.targetImg === view.name) {
        const seg = lineSegmentInRect(displayActive.line, view.w, view.h);
        if (seg) {
          let [x0, y0, x1, y1] = seg;
          const animateThis = sweeping && !hoverActive;
          if (animateThis) {
            const t = Math.min(1, (performance.now() - sweepStartRef.current) / SWEEP_MS);
            const ease = 1 - Math.pow(1 - t, 3);
            x1 = x0 + (x1 - x0) * ease;
            y1 = y0 + (y1 - y0) * ease;
            if (t < 1) again = true;
          }
          ctx.strokeStyle = hoverActive ? "#f59e0b" : "#22c55e";
          ctx.lineWidth = 2 / view.scale;
          ctx.setLineDash(hoverActive ? [6 / view.scale, 4 / view.scale] : []);
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      // origin marker, if this view is where the click/hover originated
      if (displayActive && displayActive.originImg === view.name) {
        ctx.strokeStyle = hoverActive ? "#f59e0b" : "#22c55e";
        ctx.lineWidth = 1.6 / view.scale;
        ctx.beginPath();
        ctx.arc(displayActive.originX, displayActive.originY, 5 / view.scale, 0, Math.PI * 2);
        ctx.stroke();
      }
      return again;
    };

    const draw = () => {
      const again0 = drawView(canvas0, meta0, points0, e1);
      const again1 = drawView(canvas1, meta1, points1, e2);
      if (again0 || again1) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayActive, hoverActive, hoverIdx, sweeping, points0, points1, e1, e2, dino0Img, dino1Img]);

  // notebook's essential-matrix example: E = [t]_x R, R = 45deg z-rotation, t = [5,-3,2]
  const { E, rank } = useMemo(() => {
    const r2 = Math.SQRT1_2;
    const R: Mat = [
      [r2, -r2, 0],
      [r2, r2, 0],
      [0, 0, 1],
    ];
    const t = [5, -3, 2];
    const tCross: Mat = [
      [0, -t[2], t[1]],
      [t[2], 0, -t[0]],
      [-t[1], t[0], 0],
    ];
    const Em = matMul(tCross, R);
    const s = svd(Em).s;
    const rk = s.filter((v) => v > 1e-6).length;
    return { E: Em, rank: rk };
  }, []);

  return (
    <div className="vsPanel vsEpPanel">
      <div className="vsRow" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 className="vsEpH3">B. Epipolar lines</h3>
        <span className="vsRow" style={{ gap: 8 }}>
          <span className="vsChip">mirrors fundamental_matrix()</span>
          <span className="vsChip">mirrors compute_fundamental()</span>
        </span>
      </div>
      <div className="vsRow" style={{ marginTop: 6 }}>
        <span className={`vsEpBadge ${err < 1e-6 ? "vsEpBadgeOk" : "vsEpBadgeWarn"}`} title={`max |dF| = ${err.toExponential(2)}`}>
          {err < 1e-6 ? "recomputed in TS = notebook F (err < 1e-6)" : `recomputed in TS, max |dF| = ${err.toExponential(2)}`}
        </span>
      </div>

      <div className="vsEpRow">
        <div className="vsEpCanvasWrap">
          <canvas
            ref={canvas0Ref}
            className="vsEpCanvas"
            onMouseMove={(e) => handleMove(meta0, e)}
            onMouseLeave={handleLeave}
            onClick={(e) => handleClick(meta0, e)}
          />
          <div className="vsEpCaption">dino0.jpg &mdash; click or hover a dot</div>
        </div>
        <div className="vsEpCanvasWrap">
          <canvas
            ref={canvas1Ref}
            className="vsEpCanvas"
            onMouseMove={(e) => handleMove(meta1, e)}
            onMouseLeave={handleLeave}
            onClick={(e) => handleClick(meta1, e)}
          />
          <div className="vsEpCaption">dino1.jpg</div>
        </div>
      </div>

      <div className="vsEpEssential">
        <div>
          <div className="vsEpEssentialLabel">
            Notebook aside &mdash; essential matrix <span className="vsMono">E = [t]&times; R</span>
          </div>
          <div className="vsEpEssentialSub">R = 45&deg; z-rotation, t = [5, -3, 2]</div>
        </div>
        <MiniMatrix m={E} />
        <div className="vsEpEssentialRank">
          rank(E) = <span className="vsMono">{rank}</span>
        </div>
      </div>
    </div>
  );
}
