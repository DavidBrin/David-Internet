"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHANNEL_PRESETS,
  N_STATES,
  PREDECESSORS,
  RTL_TRACEBACK_DEPTH,
  ViterbiDecoder,
  channel,
  encode,
  expectedSymbols,
  parseBits,
  randomBits,
  seeded,
  type Bit,
  type ChannelPreset,
  type Symbol2,
} from "./model";
import type { SimJson, SimPreset } from "./simTypes";

export type Phase = "encoder" | "channel" | "bmc" | "acs" | "survivor" | "output";

interface Props {
  sim: SimJson | null;
  onPhase?: (phase: Phase) => void;
  onCycle?: (cycle: number) => void;
}

const DEMO_DEPTH = 12;
const RESET_CYCLES = 10;
const VISIBLE_STEPS = 22;
const SPEEDS: { label: string; stepsPerSec: number }[] = [
  { label: "slow", stepsPerSec: 0.8 },
  { label: "1×", stepsPerSec: 3 },
  { label: "fast", stepsPerSec: 15 },
];

const COLOR_BIT0 = "#1a73e8";
const COLOR_BIT1 = "#e8710a";
const COLOR_LOSER = "#c4c7ca";
const COLOR_TRACE = "#0EA5E9";
const COLOR_ERR = "#d93025";
const COLOR_OK = "#188038";
const INK = "#202124";
const MUTED = "#5f6368";

function sym(s: number): string {
  return ((s >> 1) & 1).toString() + (s & 1).toString();
}

/** Everything the canvas needs, computed once per input/channel change. */
interface Run {
  bits: Bit[];
  encStates: number[];
  symbols: Symbol2[];
  rx: Symbol2[];
  hits: number[];
  dec: ViterbiDecoder;
  /** decoded bit for input index i (filled as the run advances). */
  decoded: (Bit | null)[];
  /** RTL comparison, when in match mode. */
  rtl: { pathCost: (number | null)[][]; offset: number } | null;
}

function buildRun(bits: Bit[], preset: ChannelPreset, noise: number, depth: number, rtl: SimPreset | null): Run {
  const enc = encode(bits);
  let rx: Symbol2[];
  let hits: number[];
  if (rtl) {
    rx = rtl.rxSymbols.slice(RESET_CYCLES, RESET_CYCLES + bits.length) as Symbol2[];
    hits = rtl.errHits.slice(RESET_CYCLES, RESET_CYCLES + bits.length);
  } else {
    const ch = channel(enc.symbols, preset, seeded(7), noise);
    rx = ch.rx;
    hits = ch.hits;
  }
  const dec = new ViterbiDecoder(depth);
  // Pre-run the whole thing so playback is just indexing into history.
  const decoded: (Bit | null)[] = bits.map(() => null);
  rx.forEach((r, k) => {
    const rec = dec.step(r);
    if (rec.out !== null) decoded[k - depth + 1] = rec.out;
  });
  const tail = dec.flush();
  const start = Math.max(0, bits.length - tail.length);
  tail.forEach((b, i) => {
    if (decoded[start + i] === null) decoded[start + i] = b;
  });
  const win = rtl?.windows.find((w) => w.id === "in");
  return {
    bits,
    encStates: enc.states,
    symbols: enc.symbols,
    rx,
    hits,
    dec,
    decoded,
    rtl: win ? { pathCost: win.pathCost, offset: RESET_CYCLES + 2 } : null,
  };
}

export default function ViterbiPanel({ sim, onPhase, onCycle }: Props) {
  const [bitsText, setBitsText] = useState(() => randomBits(96, seeded(3)).join(""));
  const [presetId, setPresetId] = useState("2a1");
  const [noise, setNoise] = useState(0);
  const [rtlDepth, setRtlDepth] = useState(false);
  const [matchRtl, setMatchRtl] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [t, setT] = useState(0); // number of symbols consumed
  const [phaseIdx, setPhaseIdx] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduced = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const preset = CHANNEL_PRESETS.find((p) => p.id === presetId) ?? CHANNEL_PRESETS[0];
  const rtlPreset = matchRtl ? sim?.presets.find((p) => p.id === presetId) ?? null : null;
  const depth = rtlDepth || matchRtl ? RTL_TRACEBACK_DEPTH : DEMO_DEPTH;

  const bits = useMemo<Bit[]>(() => {
    if (rtlPreset) return rtlPreset.inputBits.slice(RESET_CYCLES) as Bit[];
    const b = parseBits(bitsText);
    return b.length ? b : [0];
  }, [bitsText, rtlPreset]);

  const run = useMemo(() => buildRun(bits, preset, noise, depth, rtlPreset), [bits, preset, noise, depth, rtlPreset]);

  // Reset playback when the run changes.
  useEffect(() => {
    setT(0);
    setPhaseIdx(0);
  }, [run]);

  const total = run.rx.length;
  const phases: Phase[] = ["encoder", "channel", "bmc", "acs", "survivor", "output"];

  // Playback clock: advance sub-phases, then steps.
  const progressRef = useRef(0);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const sps = SPEEDS[speedIdx].stepsPerSec * (reduced ? 0.5 : 1);
      progressRef.current += dt * sps;
      if (progressRef.current >= 1) {
        progressRef.current = 0;
        setT((v) => {
          if (v >= total) {
            setPlaying(false);
            return v;
          }
          return v + 1;
        });
        setPhaseIdx(0);
      } else {
        setPhaseIdx(Math.min(phases.length - 1, Math.floor(progressRef.current * phases.length)));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speedIdx, total, reduced]);

  useEffect(() => {
    if (phases[phaseIdx] !== undefined) onPhase?.(phases[phaseIdx]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIdx]);

  useEffect(() => {
    onCycle?.(RESET_CYCLES + 1 + t);
  }, [t, onCycle]);

  // ---- drawing -------------------------------------------------------------------------
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const W = wrap.clientWidth;
    const H = 430;
    if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) {
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.font = "11px Arial, Helvetica, sans-serif";
    ctx.textBaseline = "middle";

    const hist = run.dec.history;
    const cur = t - 1; // index of the step just completed (−1 before the first)
    const phase = phases[phaseIdx];
    const p = progressRef.current * phases.length - phaseIdx; // 0..1 within phase

    // Layout
    const left = 62;
    const right = 16;
    const stripY = 22;
    const trellisTop = 96;
    const rowH = 30;
    const trellisBottom = trellisTop + rowH * (N_STATES - 1);
    const decodedY = trellisBottom + 46;
    const cols = VISIBLE_STEPS;
    const colW = (W - left - right) / cols;
    const firstStep = Math.max(-1, cur - cols + 2); // leftmost column = state before this step
    const xOf = (k: number) => left + (k - firstStep) * colW; // x of the node column after step k
    const yOf = (s: number) => trellisTop + s * rowH;

    // ---- input/symbol strip
    ctx.fillStyle = MUTED;
    ctx.textAlign = "right";
    ctx.fillText("input d", left - 8, stripY);
    ctx.fillText("encoded", left - 8, stripY + 18);
    ctx.fillText("received", left - 8, stripY + 36);
    ctx.fillText("state", left - 8, stripY + 54);
    ctx.textAlign = "center";
    for (let k = Math.max(0, firstStep + 1); k <= Math.min(total - 1, firstStep + cols); k++) {
      const x = xOf(k) - colW / 2;
      const isCur = k === cur;
      const future = k > cur;
      ctx.globalAlpha = future ? 0.28 : 1;
      ctx.fillStyle = run.bits[k] ? COLOR_BIT1 : COLOR_BIT0;
      if (isCur) {
        ctx.fillStyle = "#e8f0fe";
        ctx.fillRect(x - colW / 2 + 1, stripY - 9, colW - 2, 74);
        ctx.fillStyle = run.bits[k] ? COLOR_BIT1 : COLOR_BIT0;
      }
      ctx.font = "bold 12px Arial";
      ctx.fillText(String(run.bits[k]), x, stripY);
      ctx.font = "11px ui-monospace, Menlo, Consolas, monospace";
      ctx.fillStyle = INK;
      ctx.fillText(sym(run.symbols[k]), x, stripY + 18);
      const hit = run.hits[k];
      if (hit) {
        ctx.fillStyle = COLOR_ERR;
        ctx.fillText(sym(run.rx[k]), x, stripY + 36);
        // underline the flipped bit(s)
        ctx.fillRect(x - 7 + (hit & 2 ? 0 : 7), stripY + 43, hit === 3 ? 14 : 6, 2);
      } else {
        ctx.fillStyle = INK;
        ctx.fillText(sym(run.rx[k]), x, stripY + 36);
      }
      ctx.fillStyle = MUTED;
      ctx.fillText(run.encStates[k].toString(2).padStart(3, "0"), x, stripY + 54);
      ctx.font = "11px Arial, Helvetica, sans-serif";
      ctx.globalAlpha = 1;
    }

    // ---- trellis rows
    ctx.textAlign = "right";
    for (let s = 0; s < N_STATES; s++) {
      ctx.fillStyle = MUTED;
      ctx.fillText(`s${s} ${s.toString(2).padStart(3, "0")}`, left - 8, yOf(s));
      ctx.strokeStyle = "#f1f3f4";
      ctx.beginPath();
      ctx.moveTo(left, yOf(s));
      ctx.lineTo(W - right, yOf(s));
      ctx.stroke();
    }

    // branches + nodes for each completed step in view
    const traceStates = cur >= 0 ? run.dec.tracePath(cur, undefined, depth) : [];
    const onTrace = (k: number, s: number) => {
      const i = cur - k;
      return i >= 0 && i < traceStates.length && traceStates[i] === s;
    };
    for (let k = Math.max(0, firstStep + 1); k <= Math.min(cur, firstStep + cols); k++) {
      const rec = hist[k];
      const x0 = xOf(k - 1);
      const x1 = xOf(k);
      const isCur = k === cur;
      for (let s = 0; s < N_STATES; s++) {
        const r = rec.acs[s];
        const [p0, p1] = PREDECESSORS[s];
        const cands: { from: number; bit: Bit; won: boolean; valid: boolean; cost: number }[] = [
          { from: p0, bit: 0, won: r.selection === 0, valid: hist[k - 1]?.valid[p0] ?? p0 === 0, cost: r.cost0 },
          { from: p1, bit: 1, won: r.selection === 1, valid: hist[k - 1]?.valid[p1] ?? p1 === 0, cost: r.cost1 },
        ];
        if (k === 0) {
          cands[0].valid = p0 === 0;
          cands[1].valid = p1 === 0;
        }
        for (const c of cands) {
          if (!c.valid) continue;
          const competing = isCur && (phase === "bmc" || phase === "acs");
          let alpha = 1;
          let width = 1.2;
          if (!c.won) {
            alpha = competing ? (phase === "bmc" ? 0.9 : 0.9 - 0.75 * p) : 0.28;
            width = competing ? 1.4 : 1;
          } else if (isCur) {
            width = phase === "bmc" ? 1.4 : 1.4 + 1.2 * Math.min(1, p);
          }
          if (isCur && phase === "encoder") alpha = 0.15;
          if (isCur && phase === "channel") alpha = 0.3;
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = c.won ? (c.bit ? COLOR_BIT1 : COLOR_BIT0) : COLOR_LOSER;
          ctx.lineWidth = width;
          ctx.setLineDash(c.won ? [] : [3, 3]);
          ctx.beginPath();
          ctx.moveTo(x0, yOf(c.from));
          ctx.lineTo(x1, yOf(s));
          ctx.stroke();
          ctx.setLineDash([]);
          if (isCur && (phase === "bmc" || phase === "acs")) {
            // branch metric label at 1/3 of the way
            const bm = rec.bm[s][c.bit];
            const lx = x0 + (x1 - x0) * 0.62;
            const ly = yOf(c.from) + (yOf(s) - yOf(c.from)) * 0.62;
            ctx.fillStyle = "#fff";
            ctx.fillRect(lx - 7, ly - 7, 14, 14);
            ctx.fillStyle = c.won ? INK : MUTED;
            ctx.textAlign = "center";
            ctx.fillText(phase === "bmc" ? `${bm}` : `${c.cost}`, lx, ly);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    // traceback glow
    if (cur >= 0 && traceStates.length > 1 && !(phaseIdx < 4 && phase !== "output")) {
      ctx.strokeStyle = COLOR_TRACE;
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.55;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i < traceStates.length; i++) {
        const k = cur - i;
        if (k < firstStep) break;
        const x = xOf(k);
        const y = yOf(traceStates[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // nodes with path metrics
    ctx.textAlign = "center";
    for (let k = Math.max(-1, firstStep); k <= Math.min(cur, firstStep + cols); k++) {
      const x = xOf(k);
      for (let s = 0; s < N_STATES; s++) {
        const valid = k < 0 ? s === 0 : hist[k].valid[s];
        const cost = k < 0 ? 0 : hist[k].cost[s];
        const best = k < 0 ? s === 0 : hist[k].bestState === s;
        const traced = k >= 0 && onTrace(k, s);
        ctx.beginPath();
        ctx.arc(x, yOf(s), valid ? 8 : 3, 0, Math.PI * 2);
        ctx.fillStyle = traced ? COLOR_TRACE : valid ? "#fff" : "#e8eaed";
        ctx.fill();
        if (valid) {
          ctx.strokeStyle = best ? INK : traced ? COLOR_TRACE : "#9aa0a6";
          ctx.lineWidth = best ? 2 : 1;
          ctx.stroke();
          ctx.fillStyle = traced ? "#fff" : INK;
          ctx.font = "9px ui-monospace, Menlo, Consolas, monospace";
          ctx.fillText(String(cost), x, yOf(s) + 0.5);
          ctx.font = "11px Arial, Helvetica, sans-serif";
        }
      }
    }

    // ---- decoded bits row
    ctx.textAlign = "right";
    ctx.fillStyle = MUTED;
    ctx.fillText("decoded", left - 8, decodedY);
    ctx.textAlign = "center";
    for (let k = Math.max(0, firstStep + 1); k <= Math.min(total - 1, firstStep + cols); k++) {
      const i = k - depth + 1; // the input index whose bit came out at step k
      const x = xOf(k) - colW / 2;
      if (k > cur || i < 0) continue;
      const b = run.decoded[i];
      if (b === null) continue;
      const ok = b === run.bits[i];
      ctx.fillStyle = ok ? COLOR_OK : COLOR_ERR;
      ctx.font = "bold 12px Arial";
      ctx.fillText(String(b), x, decodedY);
      ctx.font = "9px Arial";
      ctx.fillStyle = MUTED;
      ctx.fillText(`d${i}`, x, decodedY + 13);
      ctx.font = "11px Arial, Helvetica, sans-serif";
    }
    // arrow from the traceback origin down to the decoded bit
    if (cur >= depth - 1) {
      ctx.strokeStyle = COLOR_TRACE;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(xOf(cur - depth + 1), trellisBottom + 10);
      ctx.lineTo(xOf(cur - depth + 1) - colW / 2, decodedY - 10);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // phase caption
    ctx.textAlign = "left";
    ctx.fillStyle = MUTED;
    const captions: Record<Phase, string> = {
      encoder: "encoder.sv — shift the state register, emit {parity, bit}",
      channel: "channel — the error injector flips the masked bit(s) of this symbol",
      bmc: "bmc0.sv ×8 — Hamming distance from the received pair to each expected branch symbol",
      acs: "ACS.sv ×8 — add branch to path metric, compare the two candidates, keep the smaller",
      survivor: "decoder.sv — copy the winning predecessor's survivor register and append the decision bit",
      output: "decoder.sv — read the oldest bit off the best state's survivor register (traceback)",
    };
    ctx.fillText(cur >= 0 ? captions[phase] : "press play — or step — to start decoding", left, H - 12);
  }, [run, t, phaseIdx, depth, total, phases]);

  // Redraw on every animation frame while playing; on state change otherwise.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      draw();
      if (playing) raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [draw, playing]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  // ---- stats
  const injected = run.hits.slice(0, t).filter(Boolean).length;
  let decodedCount = 0;
  let wrong = 0;
  run.decoded.forEach((b, i) => {
    if (i <= t - depth && b !== null) {
      decodedCount++;
      if (b !== run.bits[i]) wrong++;
    }
  });
  let rtlAgree: string | null = null;
  if (run.rtl) {
    let ok = 0;
    let n = 0;
    run.dec.history.forEach((rec, k) => {
      const rtlCost = run.rtl!.pathCost[run.rtl!.offset + k];
      if (!rtlCost) return;
      n++;
      if (rtlCost.every((c, s) => c === rec.cost[s])) ok++;
    });
    rtlAgree = `${ok}/${n} cycles`;
  }

  const step = () => {
    setPlaying(false);
    progressRef.current = 0;
    setPhaseIdx(phases.length - 1);
    setT((v) => Math.min(total, v + 1));
  };

  return (
    <div className="vitPanel">
      <div className="demoControls">
        <label>
          message
          <input
            className="demoMono vitBitsInput"
            value={rtlPreset ? bits.join("") : bitsText}
            onChange={(e) => setBitsText(e.target.value)}
            disabled={!!rtlPreset}
            spellCheck={false}
            aria-label="input bits"
          />
        </label>
        <button type="button" className="demoBtn" onClick={() => setBitsText(randomBits(96).join(""))} disabled={!!rtlPreset}>
          random
        </button>
        <label>
          channel
          <select value={presetId} onChange={(e) => setPresetId(e.target.value)}>
            {CHANNEL_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          extra noise
          <input
            type="range"
            min={0}
            max={0.25}
            step={0.01}
            value={noise}
            onChange={(e) => setNoise(Number(e.target.value))}
            disabled={!!rtlPreset}
          />
          <span className="demoMono">{(noise * 100).toFixed(0)}%</span>
        </label>
        <label>
          <input type="checkbox" checked={rtlDepth || matchRtl} disabled={matchRtl} onChange={(e) => setRtlDepth(e.target.checked)} />
          RTL traceback depth (64)
        </label>
        <label title={sim ? "Replay the exact bitstream and channel errors the Icarus simulation saw" : "viterbi.json not built"}>
          <input type="checkbox" checked={matchRtl} disabled={!sim} onChange={(e) => setMatchRtl(e.target.checked)} />
          match RTL run
        </label>
      </div>

      <div className="demoControls">
        <button type="button" className={`demoBtn ${playing ? "" : "isPrimary"}`} onClick={() => setPlaying((v) => !v)}>
          {playing ? "pause" : t >= total ? "replay" : "play"}
        </button>
        <button type="button" className="demoBtn" onClick={step} disabled={t >= total}>
          step
        </button>
        <button
          type="button"
          className="demoBtn"
          onClick={() => {
            setT(0);
            setPhaseIdx(0);
            progressRef.current = 0;
          }}
        >
          reset
        </button>
        <span>
          speed
          {SPEEDS.map((s, i) => (
            <button
              key={s.label}
              type="button"
              className={`demoBtn vitSpeed ${i === speedIdx ? "isActive" : ""}`}
              onClick={() => setSpeedIdx(i)}
            >
              {s.label}
            </button>
          ))}
        </span>
        <span className="vitStat">
          symbol <b className="demoMono">{Math.min(t, total)}</b>/{total}
        </span>
        <span className="vitStat">
          errors injected <b className="demoMono">{injected}</b>
        </span>
        <span className="vitStat">
          decoded <b className="demoMono">{decodedCount}</b>, wrong{" "}
          <b className="demoMono" style={{ color: wrong ? COLOR_ERR : COLOR_OK }}>
            {wrong}
          </b>
        </span>
        {rtlAgree ? (
          <span className="vitStat">
            path metrics identical to RTL: <b className="demoMono">{rtlAgree}</b>
          </span>
        ) : null}
      </div>

      <div ref={wrapRef} className="vitCanvasWrap">
        <canvas ref={canvasRef} role="img" aria-label="Viterbi trellis animation" />
      </div>

      <details className="vitLegend">
        <summary>How to read the trellis</summary>
        <p>
          Rows are the eight encoder states; each column is one received symbol. Two branches enter every state — the
          one taken with input <span style={{ color: COLOR_BIT0 }}>0</span> and the one taken with input{" "}
          <span style={{ color: COLOR_BIT1 }}>1</span>. Each state expects a particular symbol on each branch (
          {[0, 1].map((s) => `s${s}: ${sym(expectedSymbols(s)[0])}/${sym(expectedSymbols(s)[1])}`).join(", ")}, …); the
          branch metric is how many bits the received symbol disagrees by. The ACS unit keeps the cheaper candidate
          (solid) and drops the other (dashed). Numbers in the nodes are path metrics; the outlined node is the
          current best state. After {depth} symbols the decoder reads the oldest bit of the best state&apos;s survivor
          register — the blue path — and that is the decoded bit; green matches the input, red does not. Flipped
          received bits are underlined in red.
        </p>
      </details>
    </div>
  );
}
