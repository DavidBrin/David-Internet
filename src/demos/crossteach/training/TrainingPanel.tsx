"use client";

/** #training - real panel. Prefix ctT. */
import { useCallback, useEffect, useRef, useState } from "react";
import "./training.css";
import CurvesChart from "./CurvesChart";
import StripChart from "./StripChart";
import ResultsTabs from "./ResultsTabs";
import type { CurvesData, MicroctData } from "./types";

const PLAY_DURATION_MS = 3200;

export default function TrainingPanel() {
  const [curves, setCurves] = useState<CurvesData | null>(null);
  const [microct, setMicroct] = useState<MicroctData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [epoch, setEpoch] = useState(1);
  const [playing, setPlaying] = useState(false);
  const autoStartedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const startEpochRef = useRef<number>(1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/demos/crossteach/curves.json").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`curves.json: ${r.status}`)))),
      fetch("/demos/crossteach/microct/microct.json").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`microct.json: ${r.status}`)))),
    ])
      .then(([curvesData, microctData]) => {
        if (cancelled) return;
        setCurves(curvesData as CurvesData);
        setMicroct(microctData as MicroctData);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const playFrom = useCallback(
    (fromEpoch: number) => {
      if (!curves) return;
      const epochCount = curves.config.epochs;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      startRef.current = performance.now();
      startEpochRef.current = fromEpoch;
      setPlaying(true);
      const step = (now: number) => {
        const elapsed = now - startRef.current;
        const t = Math.min(1, elapsed / PLAY_DURATION_MS);
        const next = startEpochRef.current + t * (epochCount - startEpochRef.current);
        setEpoch(next);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          setPlaying(false);
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [curves],
  );

  // auto-play the draw-in animation once on mount, ref-guarded
  useEffect(() => {
    if (!curves || autoStartedRef.current) return;
    autoStartedRef.current = true;
    playFrom(1);
  }, [curves, playFrom]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleScrub = (v: number) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setPlaying(false);
    }
    setEpoch(v);
  };

  const handlePlayClick = () => {
    if (playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setPlaying(false);
      return;
    }
    const epochCount = curves?.config.epochs ?? 8;
    playFrom(epoch >= epochCount - 0.05 ? 1 : epoch);
  };

  return (
    <div className="ctPanel">
      <h2 className="ctH2">Training replay + two verdicts</h2>
      <p className="ctIntro">
        These are the committed per-epoch metrics from the GitHub repo (curves.json), not a re-run; scrub or replay
        the eight logged epochs below.
      </p>

      {error && <p className="ctNote ctTError">Could not load training data: {error}</p>}
      {!error && (!curves || !microct) && <p className="ctNote">Loading training curves...</p>}

      {curves && microct && (
        <>
          <div className="ctTScrubRow ctRow">
            <button type="button" className="ctBtn ctBtnPrimary" onClick={handlePlayClick}>
              {playing ? "Pause" : "Play"}
            </button>
            <input
              type="range"
              className="ctTScrubber"
              min={1}
              max={curves.config.epochs}
              step={1}
              value={Math.round(epoch)}
              onChange={(e) => handleScrub(Number(e.target.value))}
              aria-label="Epoch scrubber"
            />
            <span className="ctChip ctMono">
              epoch {Math.min(curves.config.epochs, Math.round(epoch))} / {curves.config.epochs}
            </span>
          </div>

          <CurvesChart curves={curves} epoch={epoch} />

          <div className="ctTStripLabel">Exchange signal: confident-image ratio and consistency loss</div>
          <StripChart crossTeaching={curves.crossTeaching} epoch={epoch} />

          <ResultsTabs curves={curves} microct={microct} />
        </>
      )}
    </div>
  );
}
