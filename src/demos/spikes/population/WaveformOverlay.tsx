"use client";

/**
 * The brushed spikes' real waveforms, decoded from waveforms.json on demand. Mirrors the
 * notebooks' plot_waveform(..., Overlapped=True): mean +-1 SD shading plus a capped number of
 * individual traces at low alpha. `wf` indexes into waveforms.windows; rows without one are
 * skipped (only ~1,400 of the ~2,700 spikes were shipped with a waveform window).
 */
import { useCallback, useMemo, useRef } from "react";
import { decodeI16, type FeatureRow, type WaveformsJson } from "../core/data";
import { formatNum } from "./stats";
import { useCanvas } from "./useCanvas";

const INK = "#4a3f20";
const MUTED = "#8a7a4e";
const GRID = "#e7dcbb";
const ACCENT = "#f59e0b";
const FS = 50000;
const TRACE_CAP = 60;

interface WaveformOverlayProps {
  rows: FeatureRow[];
  waveforms: WaveformsJson;
}

export default function WaveformOverlay({ rows, waveforms }: WaveformOverlayProps) {
  const cacheRef = useRef<Map<number, Float64Array>>(new Map());

  const decode = useCallback(
    (wf: number): Float64Array => {
      let arr = cacheRef.current.get(wf);
      if (!arr) {
        arr = decodeI16(waveforms.windows[wf], waveforms.scale);
        cacheRef.current.set(wf, arr);
      }
      return arr;
    },
    [waveforms],
  );

  const { mean, sd, traces, nWithWf, timeMs, yMin, yMax } = useMemo(() => {
    const decoded: Float64Array[] = [];
    for (const r of rows) {
      if (r.wf == null) continue;
      if (r.wf < 0 || r.wf >= waveforms.windows.length) continue;
      decoded.push(decode(r.wf));
    }
    const nSamp = decoded[0]?.length ?? Math.round(waveforms.windows[0]?.length ? decodeI16(waveforms.windows[0], waveforms.scale).length : 251);
    const meanArr = new Float64Array(nSamp);
    const sdArr = new Float64Array(nSamp);
    let lo = Infinity;
    let hi = -Infinity;
    if (decoded.length > 0) {
      for (const d of decoded) {
        for (let i = 0; i < nSamp; i++) meanArr[i] += d[i];
      }
      for (let i = 0; i < nSamp; i++) meanArr[i] /= decoded.length;
      for (const d of decoded) {
        for (let i = 0; i < nSamp; i++) {
          const diff = d[i] - meanArr[i];
          sdArr[i] += diff * diff;
        }
      }
      for (let i = 0; i < nSamp; i++) sdArr[i] = Math.sqrt(sdArr[i] / decoded.length);
      for (const d of decoded) {
        for (let i = 0; i < nSamp; i++) {
          if (d[i] < lo) lo = d[i];
          if (d[i] > hi) hi = d[i];
        }
      }
    } else {
      lo = -1;
      hi = 1;
    }
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.08;

    let traceSet: Float64Array[];
    if (decoded.length <= TRACE_CAP) {
      traceSet = decoded;
    } else {
      traceSet = [];
      const stride = decoded.length / TRACE_CAP;
      for (let k = 0; k < TRACE_CAP; k++) traceSet.push(decoded[Math.floor(k * stride)]);
    }

    const decim = waveforms.decim || 2;
    const t = new Float64Array(nSamp);
    for (let i = 0; i < nSamp; i++) t[i] = ((i * decim) / FS) * 1000;

    return { mean: meanArr, sd: sdArr, traces: traceSet, nWithWf: decoded.length, timeMs: t, yMin: lo - pad, yMax: hi + pad };
  }, [rows, waveforms, decode]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, W: number, H: number) => {
      ctx.fillStyle = "#fffdf6";
      ctx.fillRect(0, 0, W, H);

      const L = 48;
      const R = 12;
      const T = 12;
      const B = 28;
      const pw = Math.max(10, W - L - R);
      const ph = Math.max(10, H - T - B);

      if (nWithWf === 0) {
        ctx.fillStyle = MUTED;
        ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("no waveforms in this selection", L + pw / 2, T + ph / 2);
        return false;
      }

      const tMax = timeMs[timeMs.length - 1] || 1;
      const xPix = (t: number) => L + (t / tMax) * pw;
      const yPix = (v: number) => T + (1 - (v - yMin) / (yMax - yMin || 1)) * ph;

      // grid
      ctx.strokeStyle = GRID;
      ctx.lineWidth = 1;
      ctx.fillStyle = MUTED;
      ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      const yStep = niceStep(yMax - yMin);
      for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep) {
        const y = Math.round(yPix(v)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(L, y);
        ctx.lineTo(L + pw, y);
        ctx.stroke();
        ctx.fillText(formatNum(v), L - 5, y);
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let t = 0; t <= tMax + 1e-9; t += 2) {
        const x = Math.round(xPix(t)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, T);
        ctx.lineTo(x, T + ph);
        ctx.stroke();
        ctx.fillText(t.toFixed(0), x, T + ph + 4);
      }
      ctx.strokeStyle = INK;
      ctx.strokeRect(L + 0.5, T + 0.5, pw - 1, ph - 1);

      // individual traces, low alpha
      ctx.strokeStyle = ACCENT;
      ctx.globalAlpha = 0.1;
      ctx.lineWidth = 1;
      for (const tr of traces) {
        ctx.beginPath();
        for (let i = 0; i < tr.length; i++) {
          const x = xPix(timeMs[i]);
          const y = yPix(tr[i]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // mean +- SD shading
      ctx.beginPath();
      for (let i = 0; i < mean.length; i++) ctx.lineTo(xPix(timeMs[i]), yPix(mean[i] + sd[i]));
      for (let i = mean.length - 1; i >= 0; i--) ctx.lineTo(xPix(timeMs[i]), yPix(mean[i] - sd[i]));
      ctx.closePath();
      ctx.fillStyle = "rgba(245,158,11,0.18)";
      ctx.fill();

      // mean line
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < mean.length; i++) {
        const x = xPix(timeMs[i]);
        const y = yPix(mean[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // axis labels
      ctx.fillStyle = INK;
      ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("time (ms)", L + pw / 2, H - 4);
      ctx.save();
      ctx.translate(12, T + ph / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("mV", 0, 0);
      ctx.restore();

      return false;
    },
    [mean, sd, traces, nWithWf, timeMs, yMin, yMax],
  );

  const { canvasRef, wrapRef } = useCanvas(draw);

  return (
    <div ref={wrapRef} className="skCanvasWrap skPopWaveWrap">
      <canvas ref={canvasRef} role="img" aria-label="Mean plus or minus one SD waveform of the selected spikes, with individual traces" />
    </div>
  );
}

function niceStep(span: number): number {
  if (!isFinite(span) || span <= 0) return 1;
  const rawStep = span / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  if (norm < 1.5) return mag;
  if (norm < 3) return 2 * mag;
  if (norm < 7) return 5 * mag;
  return 10 * mag;
}
