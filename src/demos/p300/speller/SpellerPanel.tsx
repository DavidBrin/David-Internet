"use client";

/**
 * #speller - the live speller sim. Prefix pS.
 *
 * A 6x6 matrix flashes rows/columns at the real 100/75 ms cadence on
 * synthetic EEG (core/eeg.ts), and the notebook's decoding logic
 * (core/decode.ts, fixture-tested against the Python original) turns the
 * accumulated per-flash scores into a letter. See sim.ts for the trial
 * builder that ties the two together.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import "./speller.css";
import MatrixGrid from "./MatrixGrid";
import { useCanvasStrip } from "./useCanvasStrip";
import {
  CHANNELS_8,
  FLASH_ON_MS,
  FLASH_OFF_MS,
  REPETITIONS,
  SOA_MS,
  WINDOW_MS,
  WINDOW_SAMPLES,
  flashScore,
  mulberry32,
  stimHitsTarget,
} from "../core/eeg";
import { CHAR_SET, decodeCharacter } from "../core/decode";
import { MS_PER_SAMPLE, Trial, buildTrial, charRowCol, flashEpoch, weightedEpochTrace } from "./sim";

type DecodeResult = ReturnType<typeof decodeCharacter>;

const SPEEDS = [1, 2, 4, 8] as const;
const DEFAULT_SPEED = 4;
const DEFAULT_SNR = 1;
const EEG_WINDOW_MS = 3000;
const EEG_HEIGHT = 176;
const ERP_HEIGHT = 150;

function addInto(sum: Float32Array, trace: Float32Array) {
  for (let i = 0; i < sum.length; i++) sum[i] += trace[i];
}

export default function SpellerPanel() {
  // --- controls ---
  const [snr, setSnr] = useState(DEFAULT_SNR);
  const [speed, setSpeed] = useState<number>(DEFAULT_SPEED);
  const [pickedTarget, setPickedTarget] = useState("A");
  const [wordInput, setWordInput] = useState("");
  const [gateConfirmed, setGateConfirmed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // --- run state (rendered) ---
  const [running, setRunning] = useState(false);
  const [currentTarget, setCurrentTarget] = useState("A");
  const [letterIndex, setLetterIndex] = useState(0);
  const [queueLength, setQueueLength] = useState(0);
  const [activeStim, setActiveStim] = useState<number | null>(null);
  const [repsSoFar, setRepsSoFar] = useState(0);
  const [decodeResult, setDecodeResult] = useState<DecodeResult | null>(null);
  const [locked, setLocked] = useState(false);
  const [nTarget, setNTarget] = useState(0);
  const [nNonTarget, setNNonTarget] = useState(0);
  const [outputLetters, setOutputLetters] = useState<Array<{ expected: string; decoded: string | null }>>([]);

  // --- live mirrors of state, read by the imperative loop (avoids stale closures) ---
  const snrRef = useRef(snr);
  snrRef.current = snr;
  const speedRef = useRef(speed);
  speedRef.current = speed;

  // --- mutable sim state (not React state: updated up to 60x/sec) ---
  const genRef = useRef(0);
  const rafId = useRef<number | null>(null);
  const runIndexRef = useRef(0);
  const baseSeedRef = useRef(0);
  const lettersQueueRef = useRef<string[]>([]);
  const letterIdxRef = useRef(0);

  const trialRef = useRef<Trial | null>(null);
  const visPtr = useRef(0);
  const flashPtr = useRef(0);
  const simMsTime = useRef(0);
  const lastFrameTime = useRef<number | null>(null);
  const predictions = useRef<number[]>([]);
  const stimulus = useRef<number[]>([]);
  const prevLetterRef = useRef<string | null>(null);
  const lockedRef = useRef(false);
  const decodeResultRef = useRef<DecodeResult | null>(null);
  const activeStimRef = useRef<number | null>(null);
  const decodeRandRef = useRef<() => number>(() => Math.random());

  const targetSumRef = useRef(new Float32Array(WINDOW_SAMPLES));
  const targetCountRef = useRef(0);
  const nonTargetSumRef = useRef(new Float32Array(WINDOW_SAMPLES));
  const nonTargetCountRef = useRef(0);

  const lastTrialRef = useRef<Trial | null>(null);
  const lastSimMsRef = useRef(0);

  const uiRandRef = useRef<(() => number) | null>(null);
  if (uiRandRef.current === null) uiRandRef.current = mulberry32(42);

  const { canvasRef: eegCanvasRef, wrapRef: eegWrapRef, getCtx: getEegCtx } = useCanvasStrip(EEG_HEIGHT, () =>
    drawEeg(),
  );
  const { canvasRef: erpCanvasRef, wrapRef: erpWrapRef, getCtx: getErpCtx } = useCanvasStrip(ERP_HEIGHT, () =>
    drawErp(),
  );

  function drawEeg() {
    const got = getEegCtx();
    if (!got) return;
    const { ctx, w, h } = got;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#faf7fd";
    ctx.fillRect(0, 0, w, h);

    const labelW = 30;
    const plotW = Math.max(1, w - labelW);
    const laneH = h / CHANNELS_8.length;

    ctx.font = "10px ui-monospace, Consolas, monospace";
    ctx.fillStyle = "#8b7aa0";
    ctx.textBaseline = "middle";
    for (let ci = 0; ci < CHANNELS_8.length; ci++) {
      ctx.fillText(CHANNELS_8[ci], 2, ci * laneH + laneH / 2);
    }

    const trial = lastTrialRef.current;
    if (!trial) {
      ctx.strokeStyle = "#ddd0ee";
      ctx.lineWidth = 1;
      for (let ci = 0; ci < CHANNELS_8.length; ci++) {
        const cy = ci * laneH + laneH / 2;
        ctx.beginPath();
        ctx.moveTo(labelW, cy);
        ctx.lineTo(w, cy);
        ctx.stroke();
      }
      return;
    }

    const tEnd = lastSimMsRef.current;
    const tStart = Math.max(0, tEnd - EEG_WINDOW_MS);
    const s0 = Math.max(0, Math.floor(tStart / MS_PER_SAMPLE));
    const s1 = Math.min(trial.sampleCount - 1, Math.ceil(tEnd / MS_PER_SAMPLE));
    const span = Math.max(1, tEnd - tStart);
    const ampScale = laneH * 0.42;

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "#7e22ce";
    for (let ci = 0; ci < CHANNELS_8.length; ci++) {
      const buf = trial.channels[ci];
      const cy = ci * laneH + laneH / 2;
      ctx.beginPath();
      let first = true;
      for (let s = s0; s <= s1; s++) {
        const t = s * MS_PER_SAMPLE;
        const x = labelW + ((t - tStart) / span) * plotW;
        const y = cy - buf[s] * ampScale;
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
  }

  function drawErp() {
    const got = getErpCtx();
    if (!got) return;
    const { ctx, w, h } = got;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#faf7fd";
    ctx.fillRect(0, 0, w, h);

    const padX = 6;
    const plotW = Math.max(1, w - padX * 2);
    const baseline = h * 0.55;
    const ampScale = h * 0.32;
    const xAt = (s: number) => padX + (s / (WINDOW_SAMPLES - 1)) * plotW;

    const sampleAt300 = Math.round(300 / MS_PER_SAMPLE);
    ctx.strokeStyle = "#e3d8f2";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xAt(sampleAt300), 6);
    ctx.lineTo(xAt(sampleAt300), h - 16);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#9b8ab0";
    ctx.font = "10px ui-monospace, Consolas, monospace";
    ctx.fillText("300 ms", xAt(sampleAt300) + 4, h - 6);

    ctx.strokeStyle = "#ddd0ee";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, baseline);
    ctx.lineTo(w - padX, baseline);
    ctx.stroke();

    const drawTrace = (sum: Float32Array, count: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let s = 0; s < WINDOW_SAMPLES; s++) {
        const v = count > 0 ? sum[s] / count : 0;
        const x = xAt(s);
        const y = baseline - v * ampScale;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    drawTrace(nonTargetSumRef.current, nonTargetCountRef.current, "#a3a9c4");
    drawTrace(targetSumRef.current, targetCountRef.current, "#a855f7");
  }

  function tick(now: number, gen: number) {
    if (gen !== genRef.current) return;
    const trial = trialRef.current;
    if (!trial) return;
    if (lastFrameTime.current === null) lastFrameTime.current = now;
    const dtReal = now - lastFrameTime.current;
    lastFrameTime.current = now;
    simMsTime.current = Math.min(trial.durationMs, simMsTime.current + dtReal * speedRef.current);
    const simMs = simMsTime.current;

    // visible flash (row/col highlight)
    while (visPtr.current < trial.flashes.length && trial.flashes[visPtr.current].tOn + SOA_MS <= simMs) {
      visPtr.current += 1;
    }
    let newActive: number | null = null;
    if (visPtr.current < trial.flashes.length) {
      const f = trial.flashes[visPtr.current];
      if (simMs >= f.tOn && simMs < f.tOn + FLASH_ON_MS) newActive = f.stim;
    }
    if (newActive !== activeStimRef.current) {
      activeStimRef.current = newActive;
      setActiveStim(newActive);
    }

    // score completed flashes, decode at repetition boundaries
    while (flashPtr.current < trial.flashes.length && trial.flashes[flashPtr.current].tOn + WINDOW_MS <= simMs) {
      const f = trial.flashes[flashPtr.current];
      const epoch = flashEpoch(trial, f);
      const score = flashScore(epoch);
      predictions.current.push(score);
      stimulus.current.push(f.stim);
      const hit = stimHitsTarget(f.stim, trial.row, trial.col);
      const trace = weightedEpochTrace(epoch);
      if (hit) {
        addInto(targetSumRef.current, trace);
        targetCountRef.current += 1;
      } else {
        addInto(nonTargetSumRef.current, trace);
        nonTargetCountRef.current += 1;
      }
      flashPtr.current += 1;

      if (flashPtr.current % 12 === 0) {
        const reps = flashPtr.current / 12;
        const result = decodeCharacter(predictions.current, stimulus.current, reps, decodeRandRef.current);
        let nowLocked = lockedRef.current;
        if (!nowLocked && result.letter !== null && result.letter === prevLetterRef.current) nowLocked = true;
        lockedRef.current = nowLocked;
        prevLetterRef.current = result.letter;
        decodeResultRef.current = result;
        setRepsSoFar(reps);
        setDecodeResult(result);
        setLocked(nowLocked);
        setNTarget(targetCountRef.current);
        setNNonTarget(nonTargetCountRef.current);
      }
    }

    lastTrialRef.current = trial;
    lastSimMsRef.current = simMs;
    drawEeg();
    drawErp();

    if (simMs >= trial.durationMs) {
      finishLetter(gen);
      return;
    }
    rafId.current = requestAnimationFrame((t) => tick(t, gen));
  }

  function startLetter(queue: string[], idx: number, baseSeed: number, gen: number) {
    const target = queue[idx];
    const seed = baseSeed + idx * 997;
    const trial = buildTrial(target, seed, snrRef.current);

    trialRef.current = trial;
    visPtr.current = 0;
    flashPtr.current = 0;
    simMsTime.current = 0;
    lastFrameTime.current = null;
    predictions.current = [];
    stimulus.current = [];
    prevLetterRef.current = null;
    lockedRef.current = false;
    decodeResultRef.current = null;
    activeStimRef.current = null;
    targetSumRef.current = new Float32Array(WINDOW_SAMPLES);
    targetCountRef.current = 0;
    nonTargetSumRef.current = new Float32Array(WINDOW_SAMPLES);
    nonTargetCountRef.current = 0;
    decodeRandRef.current = mulberry32(seed + 555);

    setCurrentTarget(target);
    setActiveStim(null);
    setRepsSoFar(0);
    setDecodeResult(null);
    setLocked(false);
    setNTarget(0);
    setNNonTarget(0);

    lastTrialRef.current = trial;
    lastSimMsRef.current = 0;
    drawEeg();
    drawErp();

    rafId.current = requestAnimationFrame((t) => tick(t, gen));
  }

  function finishLetter(gen: number) {
    if (gen !== genRef.current) return;
    const trial = trialRef.current;
    if (!trial) return;
    const decoded = decodeResultRef.current?.letter ?? null;
    setOutputLetters((prev) => [...prev, { expected: trial.target, decoded }]);

    const queue = lettersQueueRef.current;
    const nextIdx = letterIdxRef.current + 1;
    if (nextIdx < queue.length) {
      letterIdxRef.current = nextIdx;
      setLetterIndex(nextIdx);
      startLetter(queue, nextIdx, baseSeedRef.current, gen);
    } else {
      setRunning(false);
    }
  }

  function startRun() {
    if (running) return;
    genRef.current += 1;
    const gen = genRef.current;
    const letters = wordInput.trim().length > 0 ? wordInput.trim().split("") : [pickedTarget];
    lettersQueueRef.current = letters;
    letterIdxRef.current = 0;
    setLetterIndex(0);
    setQueueLength(letters.length);
    setOutputLetters([]);
    const baseSeed = 1000003 * (runIndexRef.current + 1);
    runIndexRef.current += 1;
    baseSeedRef.current = baseSeed;
    setRunning(true);
    startLetter(letters, 0, baseSeed, gen);
  }

  function resetRun() {
    genRef.current += 1;
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    setRunning(false);
    setActiveStim(null);
    activeStimRef.current = null;
    setRepsSoFar(0);
    setDecodeResult(null);
    decodeResultRef.current = null;
    setLocked(false);
    setNTarget(0);
    setNNonTarget(0);
    setOutputLetters([]);
    setLetterIndex(0);
    setQueueLength(0);
    trialRef.current = null;
    lastTrialRef.current = null;
    lastSimMsRef.current = 0;
    drawEeg();
    drawErp();
  }

  function handleGateStart() {
    setGateConfirmed(true);
    startRun();
  }

  function handlePick(ch: string) {
    if (running) return;
    setPickedTarget(ch);
  }

  function surpriseMe() {
    if (running) return;
    const r = uiRandRef.current!();
    const idx = Math.min(35, Math.floor(r * 36));
    setPickedTarget(CHAR_SET[idx]);
  }

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    return () => {
      genRef.current += 1;
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const displayTarget = running ? currentTarget : wordInput.trim().length > 0 ? wordInput.trim()[0] : pickedTarget;
  const { row: targetRow, col: targetCol } = charRowCol(displayTarget);

  const barValues = useMemo(() => {
    const mean = decodeResult?.mean;
    if (!mean) return new Array<number>(12).fill(0);
    const min = Math.min(...mean);
    const max = Math.max(...mean);
    const range = max - min || 1;
    return mean.map((v) => ((v - min) / range) * 100);
  }, [decodeResult]);

  return (
    <div className="ppPanel">
      <h2 className="ppH2">The live speller</h2>
      <p className="ppIntro">
        A synthetic subject watches the matrix below while its rows and columns flash in the real 100/75 ms
        cadence, 12 flashes per repetition, 15 repetitions per letter. Watch the averaged target-flash trace pull
        away from the non-target average as repetitions accumulate, and the decoder&apos;s column/row bars converge
        on the watched letter.
      </p>

      {!gateConfirmed && (
        <div className="pSGate">
          <p className="pSGateWarn">
            <strong>Contains rapid flashing.</strong> Once started, the matrix strobes at roughly 5-6 Hz for the
            duration of the run. Skip this if that is a concern.
          </p>
          <button type="button" className="ppBtn ppBtnPrimary" onClick={handleGateStart}>
            Start flashing
          </button>
        </div>
      )}

      {reducedMotion && (
        <p className="ppNote">
          Reduced motion is on: flashes render as soft steady highlights that fade in and out instead of a hard
          strobe.
        </p>
      )}

      <div className="pSControls ppRow">
        <div className="pSControlGroup">
          <span className="pSControlLabel">Target</span>
          <button type="button" className="ppBtn" onClick={surpriseMe} disabled={running}>
            surprise me
          </button>
          <span className="ppChip ppMono">{displayTarget}</span>
        </div>
        <div className="pSControlGroup">
          <label htmlFor="pSSnr" className="pSControlLabel">
            SNR
          </label>
          <input
            id="pSSnr"
            type="range"
            min={0.3}
            max={3}
            step={0.1}
            value={snr}
            onChange={(e) => setSnr(Number(e.target.value))}
          />
          <span className="ppChip ppMono">{snr.toFixed(1)}</span>
        </div>
        <div className="pSControlGroup">
          <span className="pSControlLabel">Speed</span>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className="ppBtn"
              data-active={speed === s || undefined}
              onClick={() => setSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className="pSControls ppRow">
        <input
          className="pSWordInput ppMono"
          value={wordInput}
          disabled={running}
          maxLength={8}
          placeholder="spell a word (optional, A-Z 1-9 _)"
          onChange={(e) => setWordInput(e.target.value.toUpperCase().replace(/[^A-Z1-9_]/g, "").slice(0, 8))}
        />
        {gateConfirmed && (
          <>
            <button type="button" className="ppBtn ppBtnPrimary" onClick={startRun} disabled={running}>
              {running ? "Running..." : "Start"}
            </button>
            <button type="button" className="ppBtn" onClick={resetRun}>
              Reset
            </button>
          </>
        )}
      </div>

      {queueLength > 1 && (
        <p className="ppNote">
          spelling letter {Math.min(letterIndex + 1, queueLength)} of {queueLength}
          {!running && outputLetters.length === queueLength ? " - done" : ""}
        </p>
      )}

      <div
        className="pSMatrixWrap"
        data-reduced={reducedMotion || undefined}
        style={
          {
            "--pS-on-ms": `${FLASH_ON_MS / speed}ms`,
            "--pS-off-ms": `${FLASH_OFF_MS / speed}ms`,
          } as CSSProperties
        }
      >
        <MatrixGrid
          targetRow={targetRow}
          targetCol={targetCol}
          activeStim={activeStim}
          decodedRounded={decodeResult?.rounded ?? null}
          decodedLetter={decodeResult?.letter ?? null}
          locked={locked}
          pickable={!running}
          onPick={handlePick}
        />
        <div className="pSDecodeCol">
          <div className="pSBigLetter" data-locked={locked || undefined}>
            {decodeResult?.letter ?? "·"}
          </div>
          <div className="pSBigLetterCaption">
            {locked ? "locked" : decodeResult ? `rep ${repsSoFar}/${REPETITIONS}` : "idle"}
          </div>
          <div className="pSBars" aria-hidden="true">
            {barValues.map((v, i) => (
              <div
                key={i}
                className="pSBar"
                data-active={decodeResult?.rounded[i] === 1 || undefined}
                data-kind={i < 6 ? "col" : "row"}
              >
                <div className="pSBarFill" style={{ height: `${v}%` }} />
                <div className="pSBarLabel">{i < 6 ? `C${i + 1}` : `R${i - 5}`}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="ppNote">
        The notebook uses a CNN for this score; the sim stands in template matching; the letter-decoding
        downstream is the notebook&apos;s logic, ported and fixture-tested.
      </p>

      {outputLetters.length > 0 && (
        <div className="pSOutputStrip ppRow" aria-label="Decoded output vs requested word">
          {outputLetters.map((o, i) => (
            <span
              key={i}
              className="pSOutputChip ppMono"
              data-correct={o.decoded !== null && o.decoded === o.expected || undefined}
              data-miss={(o.decoded === null || o.decoded !== o.expected) || undefined}
            >
              {o.decoded ?? "?"}
            </span>
          ))}
        </div>
      )}

      <div className="pSTraceRow">
        <div className="pSTraceCol">
          <div className="pSTraceHead">Scrolling EEG - 8 channels</div>
          <div className="pSCanvasWrap" ref={eegWrapRef}>
            <canvas ref={eegCanvasRef} className="pSCanvas" />
          </div>
        </div>
        <div className="pSTraceCol">
          <div className="pSTraceHead">
            Target flashes (n={nTarget}) vs non-target (n={nNonTarget})
          </div>
          <div className="pSCanvasWrap" ref={erpWrapRef}>
            <canvas ref={erpCanvasRef} className="pSCanvas" />
          </div>
        </div>
      </div>

      <div className="pSFigures">
        <details className="pSFigure">
          <summary>The real experiment setup: BCI Competition III</summary>
          <img
            src="/demos/p300/experiment.webp"
            alt="Subject wired for EEG in front of a P300 speller matrix"
            className="pSFigureImg"
          />
        </details>
        <details className="pSFigure">
          <summary>Row x column intersection: the decoding idea</summary>
          <img
            src="/demos/p300/speller-system.webp"
            alt="Diagram of a flashing row and column intersecting on the target letter"
            className="pSFigureImg"
          />
        </details>
      </div>
    </div>
  );
}
