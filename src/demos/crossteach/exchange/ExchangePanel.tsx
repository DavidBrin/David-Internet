"use client";

/**
 * #exchange - the pseudo-label exchange panel. Prefix ctX.
 *
 * Renders the four shipped checkpoints (U-Net/ViT x supervised/cross-taught)
 * against 12 held-out test images: prediction columns with a live confidence
 * slider, a sup/cross-taught toggle, a ground-truth overlay, an ensemble
 * strip, and a teach animation that visualizes one pseudo-label exchange
 * pass in each direction.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import "./exchange.css";
import ImagePicker from "./ImagePicker";
import TeachAnimation from "./TeachAnimation";
import {
  DecodeCache,
  buildColorCanvas,
  buildDimmedGrayscale,
  buildOverlayCanvas,
  computeCoverage,
  drawFitted,
  type DecodedChannel,
} from "./decode";
import { useFitCanvasSquare } from "./useFitCanvas";
import { modelKeyFor, type EnsembleKey, type ImageEntry, type PredictionsData, type TeachPhase } from "./types";

const DEFAULT_IMAGE_ID = "img06";
const AUTO_TEACH_DELAY_MS = 1500;
const TEACH_GAP_MS = 220;
const TEACH_MOVE_MS = 1500;
const TEACH_SKIP_MS = 850;

interface Bundle {
  id: string;
  mode: EnsembleKey;
  inputColor: HTMLCanvasElement;
  dimmed: HTMLCanvasElement;
  gtOverlay: HTMLCanvasElement;
  unetLabel: DecodedChannel;
  unetConf: DecodedChannel;
  vitLabel: DecodedChannel;
  vitConf: DecodedChannel;
  ensLabel: DecodedChannel;
}

async function loadBundle(cache: DecodeCache, id: string, mode: EnsembleKey): Promise<Bundle> {
  const unetKey = modelKeyFor("unet", mode);
  const vitKey = modelKeyFor("vit", mode);
  const [input, gt, unetLabel, unetConf, vitLabel, vitConf, ensLabel] = await Promise.all([
    cache.rgba(`/demos/crossteach/input/${id}.webp`),
    cache.channel(`/demos/crossteach/gt/${id}_512.png`),
    cache.channel(`/demos/crossteach/pred/${unetKey}/${id}.png`),
    cache.channel(`/demos/crossteach/conf/${unetKey}/${id}.png`),
    cache.channel(`/demos/crossteach/pred/${vitKey}/${id}.png`),
    cache.channel(`/demos/crossteach/conf/${vitKey}/${id}.png`),
    cache.channel(`/demos/crossteach/ens/${mode}/${id}.png`),
  ]);
  return {
    id,
    mode,
    inputColor: buildColorCanvas(input),
    dimmed: buildDimmedGrayscale(input),
    gtOverlay: buildOverlayCanvas(gt, { alpha: 176 }),
    unetLabel,
    unetConf,
    vitLabel,
    vitConf,
    ensLabel,
  };
}

export default function ExchangePanel() {
  const [predictions, setPredictions] = useState<PredictionsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string>(DEFAULT_IMAGE_ID);
  const [mode, setMode] = useState<EnsembleKey>("ct");
  const [showGT, setShowGT] = useState(false);
  const [threshold, setThreshold] = useState(0.75);

  const [bundleVersion, setBundleVersion] = useState(0);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<{ unet: number; vit: number } | null>(null);

  const [teachPhase, setTeachPhase] = useState<TeachPhase>("idle");
  const [teachT, setTeachT] = useState(0);

  const cacheRef = useRef<DecodeCache | null>(null);
  if (!cacheRef.current) cacheRef.current = new DecodeCache();
  const bundleRef = useRef<Bundle | null>(null);
  const loadGenRef = useRef(0);

  const teachGenRef = useRef(0);
  const teachRafRef = useRef<number | null>(null);
  const teachTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teachVitOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const teachUnetOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const autoTeachDoneRef = useRef(false);
  const autoTeachTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const columnsWrapRef = useRef<HTMLDivElement | null>(null);
  const vitColRef = useRef<HTMLDivElement | null>(null);
  const unetColRef = useRef<HTMLDivElement | null>(null);

  // Fetch the fixture once.
  useEffect(() => {
    let cancelled = false;
    fetch("/demos/crossteach/predictions.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`predictions.json: ${r.status}`))))
      .then((data: PredictionsData) => {
        if (cancelled) return;
        setPredictions(data);
        if (!data.images.some((img) => img.id === DEFAULT_IMAGE_ID) && data.images.length > 0) {
          setSelectedId(data.images[0].id);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stopTeach = useCallback(() => {
    teachGenRef.current += 1;
    if (teachRafRef.current !== null) {
      cancelAnimationFrame(teachRafRef.current);
      teachRafRef.current = null;
    }
    if (teachTimeoutRef.current !== null) {
      clearTimeout(teachTimeoutRef.current);
      teachTimeoutRef.current = null;
    }
    setTeachPhase("idle");
    setTeachT(0);
  }, []);

  const runPhase = useCallback((gen: number, durationMs: number, onDone: () => void) => {
    const start = performance.now();
    const step = (now: number) => {
      if (gen !== teachGenRef.current) return;
      const t = Math.min(1, (now - start) / durationMs);
      setTeachT(t);
      if (t < 1) {
        teachRafRef.current = requestAnimationFrame(step);
      } else {
        teachRafRef.current = null;
        onDone();
      }
    };
    teachRafRef.current = requestAnimationFrame(step);
  }, []);

  const runTeach = useCallback(() => {
    const bundle = bundleRef.current;
    const image = predictions?.images.find((img) => img.id === selectedId) ?? null;
    if (!bundle || !image || bundle.id !== selectedId || bundle.mode !== mode) return;

    teachGenRef.current += 1;
    const gen = teachGenRef.current;
    if (teachRafRef.current !== null) cancelAnimationFrame(teachRafRef.current);
    if (teachTimeoutRef.current !== null) clearTimeout(teachTimeoutRef.current);

    const unetKey = modelKeyFor("unet", mode);
    const vitKey = modelKeyFor("vit", mode);
    const vitOk = image.models[vitKey].imageConfidence >= threshold;
    const unetOk = image.models[unetKey].imageConfidence >= threshold;

    teachVitOverlayRef.current = buildOverlayCanvas(bundle.vitLabel, {
      conf: bundle.vitConf.data,
      threshold,
      alphaHigh: 230,
      alphaLow: 0,
    });
    teachUnetOverlayRef.current = buildOverlayCanvas(bundle.unetLabel, {
      conf: bundle.unetConf.data,
      threshold,
      alphaHigh: 230,
      alphaLow: 0,
    });

    const phase1: TeachPhase = vitOk ? "vit-to-unet" : "vit-skip";
    const phase1Dur = vitOk ? TEACH_MOVE_MS : TEACH_SKIP_MS;

    setTeachPhase(phase1);
    setTeachT(0);
    runPhase(gen, phase1Dur, () => {
      if (gen !== teachGenRef.current) return;
      teachTimeoutRef.current = setTimeout(() => {
        if (gen !== teachGenRef.current) return;
        const phase2: TeachPhase = unetOk ? "unet-to-vit" : "unet-skip";
        const phase2Dur = unetOk ? TEACH_MOVE_MS : TEACH_SKIP_MS;
        setTeachPhase(phase2);
        setTeachT(0);
        runPhase(gen, phase2Dur, () => {
          if (gen !== teachGenRef.current) return;
          setTeachPhase("idle");
          setTeachT(0);
        });
      }, TEACH_GAP_MS);
    });
  }, [predictions, selectedId, mode, threshold, runPhase]);

  const runTeachRef = useRef(runTeach);
  runTeachRef.current = runTeach;

  // Load the decoded asset bundle for the current image + mode; cancel any running
  // teach animation cleanly whenever the image or checkpoint pair changes.
  useEffect(() => {
    if (!predictions) return;
    const image = predictions.images.find((img) => img.id === selectedId);
    if (!image) return;
    stopTeach();
    loadGenRef.current += 1;
    const gen = loadGenRef.current;
    setBundleLoading(true);
    setBundleError(null);
    loadBundle(cacheRef.current!, selectedId, mode)
      .then((bundle) => {
        if (gen !== loadGenRef.current) return;
        bundleRef.current = bundle;
        setBundleLoading(false);
        setBundleVersion((v) => v + 1);
        if (!autoTeachDoneRef.current) {
          autoTeachDoneRef.current = true;
          autoTeachTimeoutRef.current = setTimeout(() => {
            runTeachRef.current();
          }, AUTO_TEACH_DELAY_MS);
        }
      })
      .catch((e: Error) => {
        if (gen !== loadGenRef.current) return;
        setBundleLoading(false);
        setBundleError(e.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predictions, selectedId, mode, stopTeach]);

  useEffect(() => {
    return () => {
      if (teachRafRef.current !== null) cancelAnimationFrame(teachRafRef.current);
      if (teachTimeoutRef.current !== null) clearTimeout(teachTimeoutRef.current);
      if (autoTeachTimeoutRef.current !== null) clearTimeout(autoTeachTimeoutRef.current);
    };
  }, []);

  // Live "keeps NN% of pixels" readout - cheap scalar math over the decoded conf
  // arrays, kept out of the canvas rAF loop and out of per-pixel React state.
  useEffect(() => {
    const bundle = bundleRef.current;
    if (!bundle) {
      setCoverage(null);
      return;
    }
    setCoverage({
      unet: computeCoverage(bundle.unetConf.data, threshold),
      vit: computeCoverage(bundle.vitConf.data, threshold),
    });
  }, [bundleVersion, threshold]);

  const drawInput = useCallback(
    (ctx: CanvasRenderingContext2D, size: number) => {
      const bundle = bundleRef.current;
      if (!bundle) return;
      drawFitted(ctx, bundle.inputColor, size, true, true);
      if (showGT) drawFitted(ctx, bundle.gtOverlay, size, false, false);
    },
    [showGT],
  );

  const drawUnet = useCallback(
    (ctx: CanvasRenderingContext2D, size: number) => {
      const bundle = bundleRef.current;
      if (!bundle) return;
      drawFitted(ctx, bundle.dimmed, size, true, true);
      const overlay = buildOverlayCanvas(bundle.unetLabel, {
        conf: bundle.unetConf.data,
        threshold,
        alphaHigh: 209,
        alphaLow: 10,
      });
      drawFitted(ctx, overlay, size, false, false);
    },
    [threshold],
  );

  const drawVit = useCallback(
    (ctx: CanvasRenderingContext2D, size: number) => {
      const bundle = bundleRef.current;
      if (!bundle) return;
      drawFitted(ctx, bundle.dimmed, size, true, true);
      const overlay = buildOverlayCanvas(bundle.vitLabel, {
        conf: bundle.vitConf.data,
        threshold,
        alphaHigh: 209,
        alphaLow: 10,
      });
      drawFitted(ctx, overlay, size, false, false);
    },
    [threshold],
  );

  const drawEnsemble = useCallback((ctx: CanvasRenderingContext2D, size: number) => {
    const bundle = bundleRef.current;
    if (!bundle) return;
    drawFitted(ctx, bundle.dimmed, size, true, true);
    const overlay = buildOverlayCanvas(bundle.ensLabel, { alpha: 213 });
    drawFitted(ctx, overlay, size, false, false);
  }, []);

  const { canvasRef: inputCanvasRef, wrapRef: inputWrapRef } = useFitCanvasSquare(drawInput, [bundleVersion, showGT]);
  const { canvasRef: unetCanvasRef, wrapRef: unetWrapRef } = useFitCanvasSquare(drawUnet, [bundleVersion, threshold]);
  const { canvasRef: vitCanvasRef, wrapRef: vitWrapRef } = useFitCanvasSquare(drawVit, [bundleVersion, threshold]);
  const { canvasRef: ensCanvasRef, wrapRef: ensWrapRef } = useFitCanvasSquare(drawEnsemble, [bundleVersion]);

  const handleSelect = useCallback((id: string) => setSelectedId(id), []);
  const handleTeachClick = useCallback(() => {
    if (teachPhase !== "idle") return;
    runTeach();
  }, [teachPhase, runTeach]);

  const image: ImageEntry | null = predictions?.images.find((img) => img.id === selectedId) ?? null;
  const unetKey = modelKeyFor("unet", mode);
  const vitKey = modelKeyFor("vit", mode);
  const unetMetrics = image?.models[unetKey] ?? null;
  const vitMetrics = image?.models[vitKey] ?? null;
  const ensMetrics = image?.ensembles[mode] ?? null;
  const unetGate = unetMetrics ? unetMetrics.imageConfidence >= threshold : null;
  const vitGate = vitMetrics ? vitMetrics.imageConfidence >= threshold : null;
  const bundleReady = bundleRef.current !== null && bundleRef.current.id === selectedId && bundleRef.current.mode === mode;

  return (
    <div className="ctPanel">
      <h2 className="ctH2">The pseudo-label exchange</h2>
      <p className="ctIntro">
        Two checkpoints grade each other's homework on 12 held-out test pets: when a model's image-level
        confidence clears the gate, its argmax prediction becomes the other model's training target.
      </p>

      {error && <p className="ctNote">Could not load exchange data: {error}</p>}
      {!error && !predictions && <p className="ctNote">Loading exchange data...</p>}

      {predictions && (
        <>
          <ImagePicker images={predictions.images} selectedId={selectedId} onSelect={handleSelect} />

          <div className="ctRow ctXControlsRow">
            <div className="ctXToggleGroup" role="group" aria-label="Checkpoint pair">
              <button type="button" className="ctBtn" data-active={mode === "sup"} onClick={() => setMode("sup")}>
                supervised
              </button>
              <button type="button" className="ctBtn" data-active={mode === "ct"} onClick={() => setMode("ct")}>
                cross-taught
              </button>
            </div>
            <button type="button" className="ctBtn" data-active={showGT} onClick={() => setShowGT((v) => !v)}>
              show ground truth
            </button>
            <button
              type="button"
              className="ctBtn ctBtnPrimary"
              onClick={handleTeachClick}
              disabled={teachPhase !== "idle" || bundleLoading || !bundleReady}
            >
              {teachPhase !== "idle" ? "teaching..." : "teach"}
            </button>
          </div>

          {bundleLoading && <p className="ctNote">Loading assets for {selectedId}...</p>}
          {bundleError && (
            <p className="ctNote">
              Could not load assets for {selectedId}: {bundleError}
            </p>
          )}

          <div className="ctXColumns" ref={columnsWrapRef}>
            <div className="ctXCol">
              <div className="ctXColHead">
                <span>Input{showGT ? " + ground truth" : ""}</span>
              </div>
              <div className="ctXCanvasWrap" ref={inputWrapRef}>
                <canvas ref={inputCanvasRef} className="ctXCanvas" />
              </div>
              <div className="ctXChipRow">
                <span className="ctChip">{image?.breed ?? "-"}</span>
              </div>
            </div>

            <div className="ctXCol" ref={unetColRef}>
              <div className="ctXColHead">
                <span>U-Net prediction</span>
              </div>
              <div className="ctXCanvasWrap" ref={unetWrapRef}>
                <canvas ref={unetCanvasRef} className="ctXCanvas" />
              </div>
              <div className="ctXChipRow">
                <span className="ctChip ctMono">dice {unetMetrics ? unetMetrics.dice.toFixed(3) : "-"}</span>
                <span className="ctChip ctMono">512px</span>
                {coverage && <span className="ctXCoverage">keeps {Math.round(coverage.unet * 100)}% of pixels</span>}
                {unetGate !== null && (
                  <span className="ctXGateBadge" data-state={unetGate ? "teaches" : "held-back"}>
                    {unetGate ? "teaches" : "held back"}
                  </span>
                )}
              </div>
            </div>

            <div className="ctXCol" ref={vitColRef}>
              <div className="ctXColHead">
                <span>ViT prediction</span>
              </div>
              <div className="ctXCanvasWrap" ref={vitWrapRef}>
                <canvas ref={vitCanvasRef} className="ctXCanvas" />
              </div>
              <div className="ctXChipRow">
                <span className="ctChip ctMono">dice {vitMetrics ? vitMetrics.dice.toFixed(3) : "-"}</span>
                <span className="ctChip ctMono">224px</span>
                {coverage && <span className="ctXCoverage">keeps {Math.round(coverage.vit * 100)}% of pixels</span>}
                {vitGate !== null && (
                  <span className="ctXGateBadge" data-state={vitGate ? "teaches" : "held-back"}>
                    {vitGate ? "teaches" : "held back"}
                  </span>
                )}
              </div>
            </div>

            <TeachAnimation
              wrapRef={columnsWrapRef}
              vitColRef={vitColRef}
              unetColRef={unetColRef}
              phase={teachPhase}
              t={teachT}
              vitOverlay={teachVitOverlayRef.current}
              unetOverlay={teachUnetOverlayRef.current}
            />
          </div>

          <div className="ctXSliderRow ctRow">
            <label htmlFor="ctXThreshold" className="ctXSliderLabel">
              Confidence threshold
            </label>
            <input
              id="ctXThreshold"
              className="ctXSlider"
              type="range"
              min={0.5}
              max={1}
              step={0.01}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
            <span className="ctChip ctMono">{threshold.toFixed(2)}</span>
            <span className="ctXSliderNote">training-run gate: 0.75 - this slider is exploratory</span>
          </div>

          <div className="ctXEnsemble">
            <div className="ctXEnsembleCanvasWrap" ref={ensWrapRef}>
              <canvas ref={ensCanvasRef} className="ctXCanvas" />
            </div>
            <div className="ctXEnsembleText">
              <div className="ctXChipRow">
                <span className="ctChip ctMono">ensemble dice {ensMetrics ? ensMetrics.dice.toFixed(3) : "-"}</span>
              </div>
              <p className="ctNote">Ensembling averages the U-Net's and ViT's logits before the final argmax.</p>
            </div>
          </div>

          {predictions.note && <p className="ctNote">{predictions.note}</p>}
        </>
      )}
    </div>
  );
}
