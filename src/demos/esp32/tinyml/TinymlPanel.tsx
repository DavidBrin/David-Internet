"use client";

/**
 * Stage 4: Train → Quantize → Deploy → Infer.
 *
 * Reads model.json (Dense 76→32→16→1, float + INT8-quantized weights) and
 * training.json (per-fold GroupKFold curves, pre-computed at build from the
 * real pipeline). Quantize + Infer run the shared net.ts kernels against the
 * page-wide live frame stream from core/frameStore.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrames } from "../core/frameStore";
import { engineerFeatures, scale } from "../core/features";
import { forwardFloat, forwardInt8, type ModelJson } from "../core/net";
import "./tinyml.css";

// --------------------------------------------------------------- training.json

interface FoldData {
  acc: number[];
  valAcc: number[];
  loss: number[];
  valLoss: number[];
  heldOutAcc: number;
  heldOutGroups: number;
  heldOutSample: string[];
}

interface TrainingJson {
  config: string;
  samples: number;
  folds: FoldData[];
}

const REVEAL_MS = 40;

/** Normalizes a series to its own [min,max] (padded) so its real shape reads
 * even when the absolute range is narrow (val-accuracy sits in a 0.89–0.90 band). */
function seriesRange(values: number[]): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.05 || 0.01;
  return [lo - pad, hi + pad];
}

function chartPath(values: number[], n: number, total: number, w: number, h: number, lo: number, hi: number): string {
  if (n <= 0) return "";
  const span = hi - lo || 1;
  const pts: string[] = [];
  for (let i = 0; i < Math.min(n, values.length); i++) {
    const x = total > 1 ? (i / (total - 1)) * w : 0;
    const y = h - ((values[i] - lo) / span) * h;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.length ? `M${pts.join(" L")}` : "";
}

function TrainChart({ fold }: { fold: FoldData }) {
  const [replayToken, setReplayToken] = useState(0);
  const [revealN, setRevealN] = useState(1);
  const total = fold.acc.length;

  useEffect(() => {
    setRevealN(1);
    const id = setInterval(() => {
      setRevealN((n) => {
        if (n >= total) {
          clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, REVEAL_MS);
    return () => clearInterval(id);
  }, [fold, replayToken, total]);

  const w = 560;
  const h = 150;
  const [lossLo, lossHi] = seriesRange(fold.loss);
  const [accLo, accHi] = seriesRange(fold.valAcc);
  const lossPath = chartPath(fold.loss, revealN, total, w, h, lossLo, lossHi);
  const valAccPath = chartPath(fold.valAcc, revealN, total, w, h, accLo, accHi);
  const shown = Math.min(revealN, total) - 1;
  const lossNow = fold.loss[shown];
  const accNow = fold.valAcc[shown];

  return (
    <div>
      <div className="etMlChartWrap">
        <svg className="etMlChart" viewBox={`0 0 ${w + 40} ${h + 24}`} role="img" aria-label="Training loss and validation accuracy per epoch">
          <g transform="translate(32,4)">
            <line x1={0} x2={w} y1={0} y2={0} stroke="#f0dfc8" strokeWidth={1} />
            <line x1={0} x2={w} y1={h} y2={h} stroke="#f0dfc8" strokeWidth={1} />
            <path d={lossPath} fill="none" stroke="#94a3b8" strokeWidth={2} />
            <path d={valAccPath} fill="none" stroke="#f97316" strokeWidth={2} />
            <text x={0} y={h + 16} fontSize={9} fill="#9ca3af">
              epoch 0
            </text>
            <text x={w} y={h + 16} fontSize={9} fill="#9ca3af" textAnchor="end">
              epoch {total - 1}
            </text>
            <text x={-6} y={4} textAnchor="end" fontSize={9} fill="#94a3b8">
              loss {lossNow?.toFixed(3)}
            </text>
            <text x={-6} y={16} textAnchor="end" fontSize={9} fill="#f97316">
              acc {accNow?.toFixed(3)}
            </text>
          </g>
        </svg>
      </div>
      <div className="etMlLegend">
        <span>
          <span className="etMlLegendSwatch" style={{ background: "#94a3b8" }} />
          train loss (own scale)
        </span>
        <span>
          <span className="etMlLegendSwatch" style={{ background: "#f97316" }} />
          val accuracy (own scale)
        </span>
        <button className="etBtn" onClick={() => setReplayToken((t) => t + 1)}>
          Replay
        </button>
      </div>
    </div>
  );
}

function TrainStage({ training }: { training: TrainingJson }) {
  const [foldIdx, setFoldIdx] = useState(0);
  const fold = training.folds[foldIdx];
  const mean = useMemo(
    () => training.folds.reduce((s, f) => s + f.heldOutAcc, 0) / training.folds.length,
    [training],
  );
  const sampleText = fold.heldOutSample.slice(0, 3).join(", ");

  return (
    <div>
      <p className="etNote">
        {training.config} · {training.samples.toLocaleString()} samples.
      </p>
      <div className="etRow etMlFoldRow">
        <span className="etLabel">Fold</span>
        {training.folds.map((_, i) => (
          <button
            key={i}
            className="etBtn"
            data-active={i === foldIdx}
            onClick={() => setFoldIdx(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <TrainChart fold={fold} />
      <p className="etMlHeldOut">
        Fold {foldIdx + 1} holds out {fold.heldOutGroups} student groups (e.g. {sampleText}, …).
        GroupKFold splits by student, so the model is never graded on a person it trained on.
      </p>
      <table className="etMlFoldTable">
        <thead>
          <tr>
            <th>Fold</th>
            <th>Held-out acc</th>
            <th>Groups held out</th>
          </tr>
        </thead>
        <tbody>
          {training.folds.map((f, i) => (
            <tr key={i} data-active={i === foldIdx}>
              <td>{i + 1}</td>
              <td className="etMono">{f.heldOutAcc.toFixed(3)}</td>
              <td>{f.heldOutGroups}</td>
            </tr>
          ))}
          <tr>
            <td>mean</td>
            <td className="etMono">{mean.toFixed(3)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------- quantize

interface Trace {
  frame: { px: Float32Array; label: "present" | "empty"; sid: string; seq: number };
  floatT: ReturnType<typeof forwardFloat>;
  int8T: ReturnType<typeof forwardInt8>;
}

function LayerBars({
  label,
  floatVals,
  deqVals,
  scaleZp,
}: {
  label: string;
  floatVals: number[];
  deqVals: number[];
  scaleZp: { scale: number; zeroPoint: number };
}) {
  const maxAbs = Math.max(1e-6, ...floatVals.map(Math.abs), ...deqVals.map(Math.abs));
  let differCount = 0;
  return (
    <div className="etMlLayerBlock">
      <div className="etMlLayerMeta">
        <span className="etLabel">{label}</span>
        <span className="etMono">
          out: scale={scaleZp.scale.toFixed(5)} zp={scaleZp.zeroPoint}
        </span>
      </div>
      <div className="etMlBarGrid">
        {floatVals.map((fv, i) => {
          const dv = deqVals[i] ?? 0;
          const differs = Math.abs(fv - dv) > Math.max(0.03, maxAbs * 0.06);
          if (differs) differCount++;
          return (
            <div className="etMlBarPair" key={i} data-differs={differs}>
              <div className="etMlBarFloat" style={{ height: `${Math.min(100, (fv / maxAbs) * 50)}%` }} />
              <div className="etMlBarInt" style={{ height: `${Math.min(100, (dv / maxAbs) * 50)}%` }} />
            </div>
          );
        })}
      </div>
      <div className="etMlBarCaption">
        top = float32, bottom = INT8 dequantized · {differCount} of {floatVals.length} units visibly differ
      </div>
    </div>
  );
}

function QuantizeStage({ model, trace }: { model: ModelJson; trace: Trace | null }) {
  const kerasBytes = model.kerasBytes;
  const tfliteBytes = model.tfliteBytes;
  const ratio = kerasBytes / tfliteBytes;
  const maxBarW = 220;

  return (
    <div>
      {!trace ? (
        <p className="etMlWaiting">waiting for the live frame stream…</p>
      ) : (
        <>
          <div className="etMlQuantGrid">
            <LayerBars
              label="Layer 1 (32, ReLU)"
              floatVals={trace.floatT.layers[0]}
              deqVals={trace.int8T.layersDeq[0]}
              scaleZp={model.quantLayers[0].outQuant}
            />
            <LayerBars
              label="Layer 2 (16, ReLU)"
              floatVals={trace.floatT.layers[1]}
              deqVals={trace.int8T.layersDeq[1]}
              scaleZp={model.quantLayers[1].outQuant}
            />
            <div className="etMlOutBlock">
              <span className="etLabel">Output (logistic)</span>
              <span className="etMono">
                out: scale={model.outputQuant.scale.toFixed(5)} zp={model.outputQuant.zeroPoint}
              </span>
              <div className="etMlProbRow">
                <div>
                  <div className="etMlProbVal" data-side="float">
                    {trace.floatT.prob.toFixed(4)}
                  </div>
                  <div className="etMlBarCaption">float32</div>
                </div>
                <div>
                  <div className="etMlProbVal" data-side="int8">
                    {trace.int8T.prob.toFixed(4)}
                  </div>
                  <div className="etMlBarCaption">INT8 dequant</div>
                </div>
              </div>
              <p className="etNote">
                Same math, two number formats: float32 and INT8 usually land within the 3rd
                decimal of each other (diff = {Math.abs(trace.floatT.prob - trace.int8T.prob).toFixed(4)}) —
                that gap is the quantization error budget, not a bug.
              </p>
            </div>
          </div>
        </>
      )}
      <div className="etMlSizeRow">
        <span className="etLabel">Model size</span>
        <div className="etMlSizeBar">
          <div className="etMlSizeBarTrack" data-model="keras" style={{ width: maxBarW }} />
          <span className="etMlSizeLabel">Keras {kerasBytes.toLocaleString()} B</span>
        </div>
        <div className="etMlSizeBar">
          <div
            className="etMlSizeBarTrack"
            data-model="tflite"
            style={{ width: Math.max(4, (maxBarW * tfliteBytes) / kerasBytes) }}
          />
          <span className="etMlSizeLabel">
            TFLite INT8 {tfliteBytes.toLocaleString()} B ({ratio.toFixed(1)}×)
          </span>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------- deploy

function byteAt(i: number): number {
  const h = ((i * 2654435761) ^ (i << 13)) >>> 0;
  return h & 0xff;
}

function hex2(v: number): string {
  return `0x${v.toString(16).padStart(2, "0")}`;
}

function ChipGraphic({ live }: { live: boolean }) {
  const pins = Array.from({ length: 6 }, (_, i) => i);
  return (
    <svg className="etMlChip" width={150} height={120} viewBox="0 0 150 120" role="img" aria-label="ESP32-S3 chip">
      {pins.map((i) => (
        <g key={`l${i}`}>
          <line x1={20} x2={34} y1={16 + i * 15} y2={16 + i * 15} stroke="#9ca3af" strokeWidth={2} />
          <line x1={116} x2={130} y1={16 + i * 15} y2={16 + i * 15} stroke="#9ca3af" strokeWidth={2} />
        </g>
      ))}
      <rect x={34} y={6} width={82} height={104} rx={6} fill="#1f2430" stroke="#0b0d12" strokeWidth={1.5} />
      <text x={75} y={54} textAnchor="middle" fontSize={11} fill="#d6deeb" fontFamily="ui-monospace, monospace">
        ESP32
      </text>
      <text x={75} y={68} textAnchor="middle" fontSize={11} fill="#d6deeb" fontFamily="ui-monospace, monospace">
        -S3
      </text>
      <circle className="etMlChipLed" cx={75} cy={90} r={5} fill={live ? "#22c55e" : "#6b7280"} />
    </svg>
  );
}

function DeployStage({
  model,
  flashing,
  flashed,
  flashBytes,
  onFlash,
}: {
  model: ModelJson;
  flashing: boolean;
  flashed: boolean;
  flashBytes: number;
  onFlash: () => void;
}) {
  const total = model.tfliteBytes;
  const rowStart = Math.max(0, Math.floor(flashBytes / 8) - 3);
  const rowEnd = Math.max(rowStart, Math.floor(flashBytes / 8));
  const rows: number[] = [];
  for (let r = rowStart; r <= rowEnd; r++) rows.push(r);

  return (
    <div className="etMlDeployGrid">
      <ChipGraphic live={flashed} />
      <div className="etMlFlashCol">
        <div className="etRow">
          <button className="etBtn" onClick={onFlash} disabled={flashing}>
            {flashing ? "Flashing…" : flashed ? "Reflash" : "Flash"}
          </button>
          <span className="etMono">
            {flashBytes.toLocaleString()} / {total.toLocaleString()} bytes
          </span>
        </div>
        <div className="etMlProgressTrack">
          <div className="etMlProgressFill" style={{ width: `${(flashBytes / total) * 100}%` }} />
        </div>
        {flashed && <p className="etNote etMono">model_tflite_len = {total} · arena OK</p>}
        <div className="etMlHexdump">
          {rows.length === 0 && !flashing && !flashed ? (
            <span style={{ opacity: 0.5 }}>press Flash to stream model_data.h…</span>
          ) : (
            rows.map((r) => (
              <div key={r}>
                <span className="etMlHexOffset">{(r * 8).toString(16).padStart(4, "0")}: </span>
                {Array.from({ length: 8 }, (_, k) => hex2(byteAt(r * 8 + k))).join(", ")}
                {","}
              </div>
            ))
          )}
        </div>
        <p className="etNote">
          The ESP32&apos;s <code className="etMono">runInference()</code>: quantize the scaled feature
          vector to int8 → <code className="etMono">interpreter-&gt;Invoke()</code> → dequantize the
          logistic output back to a 0–1 confidence.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------- infer

function InferStage({ flashed, trace, history }: { flashed: boolean; trace: Trace | null; history: boolean[] }) {
  if (!flashed) {
    return <p className="etMlWaiting">flash the model to bring the chip live</p>;
  }
  if (!trace) {
    return <p className="etMlWaiting">waiting for the live frame stream…</p>;
  }
  const present = trace.int8T.prob > 0.5;
  const confidence = trace.int8T.prob * 100;
  const correct = history.filter(Boolean).length;

  return (
    <div>
      <div className="etMlInferRow">
        <span className={`etBadge ${present ? "etBadgePresent" : "etBadgeEmpty"}`}>
          {present ? "PRESENT" : "EMPTY"}
        </span>
        <span className="etMlConfidence">{confidence.toFixed(1)}%</span>
      </div>
      <p className="etMlTally">
        agrees with the dataset label {correct}/{history.length} recent frames
      </p>
    </div>
  );
}

// --------------------------------------------------------------------- panel

export default function TinymlPanel() {
  const { frame } = useFrames();
  const [model, setModel] = useState<ModelJson | null>(null);
  const [training, setTraining] = useState<TrainingJson | null>(null);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [flashing, setFlashing] = useState(false);
  const [flashed, setFlashed] = useState(false);
  const [flashBytes, setFlashBytes] = useState(0);
  const [history, setHistory] = useState<boolean[]>([]);

  const frameRef = useRef(frame);
  frameRef.current = frame;
  const flashedRef = useRef(flashed);
  flashedRef.current = flashed;
  const modelRef = useRef(model);
  modelRef.current = model;

  useEffect(() => {
    let alive = true;
    fetch("/demos/esp32/model.json")
      .then((r) => r.json())
      .then((j: ModelJson) => alive && setModel(j))
      .catch(() => {});
    fetch("/demos/esp32/training.json")
      .then((r) => r.json())
      .then((j: TrainingJson) => alive && setTraining(j))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Throttled (~4 Hz) recompute of both forward passes on the live frame —
  // the frame stream itself ticks at ~10 fps, this deliberately samples slower.
  useEffect(() => {
    if (!model) return;
    const id = setInterval(() => {
      const f = frameRef.current;
      const m = modelRef.current;
      if (!f || !m) return;
      const feats = engineerFeatures(f.px);
      const xScaled = scale(feats, m.scalerMean, m.scalerScale);
      const floatT = forwardFloat(m, xScaled);
      const int8T = forwardInt8(m, xScaled);
      setTrace({ frame: f, floatT, int8T });
      if (flashedRef.current) {
        const predicted = int8T.prob > 0.5 ? "present" : "empty";
        setHistory((h) => [...h, predicted === f.label].slice(-20));
      }
    }, 250);
    return () => clearInterval(id);
  }, [model]);

  const flashRaf = useRef(0);
  const handleFlash = () => {
    if (flashing || !model) return;
    setFlashed(false);
    setHistory([]);
    setFlashing(true);
    setFlashBytes(0);
    const total = model.tfliteBytes;
    const durationMs = 2000;
    const start = performance.now();
    const tick = (now: number) => {
      const frac = Math.min(1, (now - start) / durationMs);
      setFlashBytes(Math.floor(frac * total));
      if (frac < 1) {
        flashRaf.current = requestAnimationFrame(tick);
      } else {
        setFlashing(false);
        setFlashed(true);
      }
    };
    flashRaf.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => cancelAnimationFrame(flashRaf.current), []);

  if (!model || !training) {
    return <p className="etNote">loading model.json / training.json…</p>;
  }

  return (
    <div className="etMlWrap">
      <div className="etMlStage">
        <div className="etMlStageHead">
          <h3>
            <span className="etMlStageNum">1</span>Train
          </h3>
        </div>
        <TrainStage training={training} />
      </div>

      <div className="etMlStage">
        <div className="etMlStageHead">
          <h3>
            <span className="etMlStageNum">2</span>Quantize
          </h3>
        </div>
        <QuantizeStage model={model} trace={trace} />
      </div>

      <div className="etMlStage">
        <div className="etMlStageHead">
          <h3>
            <span className="etMlStageNum">3</span>Deploy
          </h3>
        </div>
        <DeployStage
          model={model}
          flashing={flashing}
          flashed={flashed}
          flashBytes={flashBytes}
          onFlash={handleFlash}
        />
      </div>

      <div className="etMlStage">
        <div className="etMlStageHead">
          <h3>
            <span className="etMlStageNum">4</span>Infer
          </h3>
        </div>
        <InferStage flashed={flashed} trace={trace} history={history} />
      </div>
    </div>
  );
}
