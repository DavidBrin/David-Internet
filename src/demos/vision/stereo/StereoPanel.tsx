"use client";

/**
 * Photometric stereo panel: solve for normals + albedo from four lit faces
 * (per-pixel least squares, live), integrate depth with Horn's iterative
 * scheme, then relight the face and the recovered surface by dragging a
 * light direction. Mirrors src/demos/vision/core/stereo.ts.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  hornInit,
  hornStep,
  lambertian,
  photometricStereo,
  stereoGradients,
  type Grid,
  type HornState,
  type StereoResult,
} from "@/demos/vision/core/stereo";
import FigStrip from "@/demos/vision/FigStrip";
import LightDisc from "./LightDisc";
import PixelCanvas from "./PixelCanvas";
import {
  downsample,
  faceImgSrc,
  grayImageData,
  hillshade,
  loadFaceData,
  meanAbsDiff,
  normalMapImageData,
  type FaceHeightmap,
  type FaceLights,
} from "./stereoUtils";
import "./stereo.css";

type Mode = "3" | "4";
type Phase = "idle" | "revealing" | "integrating" | "done";

const IDX3 = [0, 1, 3]; // im1, im2, im4 (skip im3) — the HW's 1(b) vs 1(c) comparison
const REVEAL_ROWS_PER_FRAME = 6;
const HORN_STRIDE = 2;
const HORN_ITERS_PER_FRAME = 80;
const HORN_TARGET_ITERS = 2400;
const DEPTH_EXAGGERATION = 0.6;
const GT_EXAGGERATION = 0.12;

export default function StereoPanel() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [images, setImages] = useState<Grid[] | null>(null);
  const [lights, setLights] = useState<FaceLights | null>(null);
  const [heightmapGT, setHeightmapGT] = useState<FaceHeightmap | null>(null);

  const [mode, setMode] = useState<Mode>("4");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result3, setResult3] = useState<StereoResult | null>(null);
  const [result4, setResult4] = useState<StereoResult | null>(null);
  const [diff, setDiff] = useState<number | null>(null);

  const [revealRows, setRevealRows] = useState(0);
  const [hornIters, setHornIters] = useState(0);
  const [normalImg, setNormalImg] = useState<ImageData | null>(null);
  const [albedoImg, setAlbedoImg] = useState<ImageData | null>(null);
  const [depthImg, setDepthImg] = useState<ImageData | null>(null);
  const [relitImg, setRelitImg] = useState<ImageData | null>(null);
  const [gtImg, setGtImg] = useState<ImageData | null>(null);
  const [showGT, setShowGT] = useState(false);

  const [light, setLight] = useState<[number, number, number]>([0, 0, 1]);

  const rafRef = useRef(0);
  const hornRef = useRef<{ state: HornState; w: number; h: number } | null>(null);
  const activeResultRef = useRef<StereoResult | null>(null);
  const liveRef = useRef(true);
  const lightRef = useRef(light);
  useEffect(() => {
    lightRef.current = light;
  }, [light]);

  useEffect(() => {
    liveRef.current = true;
    loadFaceData()
      .then(({ images, lights, heightmap }) => {
        if (!liveRef.current) return;
        setImages(images);
        setLights(lights);
        setHeightmapGT(heightmap);
        setStatus("ready");
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[vision/stereo] failed to load face data:", err);
        if (liveRef.current) setStatus("error");
      });
    return () => {
      liveRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Ground-truth hillshade — recompute on load and whenever the light changes.
  useEffect(() => {
    if (!heightmapGT) return;
    const h = heightmapGT.data.length;
    const w = heightmapGT.data[0]?.length ?? 0;
    const flat = new Float64Array(w * h);
    const k = heightmapGT.scale / heightmapGT.q;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) flat[y * w + x] = heightmapGT.data[y][x] * k;
    setGtImg(hillshade(flat, w, h, light, GT_EXAGGERATION));
  }, [heightmapGT, light]);

  const runReveal = useCallback((result: StereoResult, onDone: () => void) => {
    const { h } = result.albedo;
    let rows = 0;
    const step = () => {
      rows = Math.min(h, rows + REVEAL_ROWS_PER_FRAME);
      setRevealRows(rows);
      setNormalImg(normalMapImageData(result.nx, result.ny, result.nz, rows));
      setAlbedoImg(grayImageData(result.albedo, rows));
      if (rows < h) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        onDone();
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  const runHorn = useCallback((result: StereoResult) => {
    const { gx, gy } = stereoGradients(result);
    const gx2 = downsample(gx, HORN_STRIDE);
    const gy2 = downsample(gy, HORN_STRIDE);
    const state = hornInit(gx2, gy2);
    hornRef.current = { state, w: gx2.w, h: gx2.h };
    let iters = 0;
    const step = () => {
      hornStep(state, HORN_ITERS_PER_FRAME);
      iters += HORN_ITERS_PER_FRAME;
      setHornIters(iters);
      setDepthImg(hillshade(state.g.data, gx2.w, gx2.h, lightRef.current, DEPTH_EXAGGERATION));
      if (iters < HORN_TARGET_ITERS) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setPhase("done");
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  const solve = useCallback(
    (nextMode: Mode) => {
      if (!images || !lights) return;
      cancelAnimationFrame(rafRef.current);
      const idx4 = [0, 1, 2, 3];
      const idx = nextMode === "3" ? IDX3 : idx4;
      const r = photometricStereo(
        idx.map((i) => images[i]),
        idx.map((i) => lights.lights[i]),
      );
      const other = photometricStereo(
        (nextMode === "3" ? idx4 : IDX3).map((i) => images[i]),
        (nextMode === "3" ? idx4 : IDX3).map((i) => lights.lights[i]),
      );
      const r3 = nextMode === "3" ? r : other;
      const r4 = nextMode === "3" ? other : r;
      setResult3(r3);
      setResult4(r4);
      setDiff(meanAbsDiff(r3.albedo, r4.albedo));
      setMode(nextMode);
      activeResultRef.current = r;
      setRevealRows(0);
      setHornIters(0);
      setDepthImg(null);
      setPhase("revealing");
      runReveal(r, () => {
        setPhase("integrating");
        runHorn(r);
      });
    },
    [images, lights, runReveal, runHorn],
  );

  const toggleMode = useCallback(
    (next: Mode) => {
      if (next === mode) return;
      const already = next === "3" ? result3 : result4;
      if (already) {
        cancelAnimationFrame(rafRef.current);
        setMode(next);
        activeResultRef.current = already;
        setRevealRows(0);
        setHornIters(0);
        setDepthImg(null);
        setPhase("revealing");
        runReveal(already, () => {
          setPhase("integrating");
          runHorn(already);
        });
      } else {
        solve(next);
      }
    },
    [mode, result3, result4, runReveal, runHorn, solve],
  );

  // Auto-solve once on load so the panel opens alive (the Solve button re-runs it).
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (status === "ready" && images && lights && !autoRanRef.current) {
      autoRanRef.current = true;
      solve("4");
    }
  }, [status, images, lights, solve]);

  // Relight the face live whenever the light or the active result changes.
  useEffect(() => {
    const r = activeResultRef.current;
    if (!r || phase === "idle" || phase === "revealing") return;
    setRelitImg(grayImageData({ data: lambertian(r, light), w: r.albedo.w, h: r.albedo.h }));
  }, [light, phase, mode]);

  // Re-shade the integrated depth whenever the light changes post-solve (no re-integration).
  useEffect(() => {
    const h = hornRef.current;
    if (!h || phase !== "done") return;
    setDepthImg(hillshade(h.state.g.data, h.w, h.h, light, DEPTH_EXAGGERATION));
  }, [light, phase]);

  const busy = phase === "revealing" || phase === "integrating";
  const relightReady = phase === "integrating" || phase === "done";

  if (status === "error") {
    return <div className="vsPanel vsStub">Could not load the face data set — see console for details.</div>;
  }

  return (
    <div className="vsPanel vsStPanel">
      <div className="vsRow vsStInputsRow">
        {([1, 2, 3, 4] as const).map((n) => {
          const l = lights?.lights[n - 1];
          const dim = mode === "3" && n === 3;
          return (
            <figure key={n} className={`vsStInput${dim ? " vsStInputDim" : ""}`}>
              <img src={faceImgSrc(n)} alt={`Face lit from image ${n}`} width={126} height={188} />
              <figcaption>
                im{n}
                {l ? (
                  <span className="vsMono vsStLightVec">
                    {l.map((v) => v.toFixed(2)).join(", ")}
                  </span>
                ) : null}
              </figcaption>
            </figure>
          );
        })}
      </div>

      <div className="vsRow vsStControlsRow">
        <button
          type="button"
          className="vsBtn vsBtnPrimary"
          onClick={() => solve(mode)}
          disabled={status !== "ready" || busy}
        >
          {status === "loading" ? "Loading..." : busy ? "Solving..." : "Solve"}
        </button>

        <div className="vsRow" style={{ gap: 4 }}>
          <button
            type="button"
            className="vsBtn"
            data-active={mode === "3"}
            onClick={() => toggleMode("3")}
            disabled={status !== "ready" || busy}
          >
            3 images {"{im1,im2,im4}"}
          </button>
          <button
            type="button"
            className="vsBtn"
            data-active={mode === "4"}
            onClick={() => toggleMode("4")}
            disabled={status !== "ready" || busy}
          >
            all 4
          </button>
        </div>

        <button
          type="button"
          className="vsBtn"
          data-active={showGT}
          onClick={() => setShowGT((v) => !v)}
        >
          compare with ground truth
        </button>

        {diff !== null && (
          <span className="vsMono vsStDiff">mean |albedo4 - albedo3| = {diff.toFixed(4)}</span>
        )}
      </div>

      <div className="vsStMapsGrid">
        <div className="vsStStage">
          <div className="vsStStageHead">
            <span>Normal map (n+1)/2</span>
            <span className="vsChip">mirrors photometric_stereo()</span>
          </div>
          <PixelCanvas data={normalImg} className="vsStCanvasWrap" label="Recovered surface normals" />
          {phase === "revealing" && (
            <div className="vsStProgress vsMono">row {revealRows} / 188</div>
          )}
        </div>

        <div className="vsStStage">
          <div className="vsStStageHead">
            <span>Albedo map</span>
            <span className="vsChip">mirrors photometric_stereo()</span>
          </div>
          <PixelCanvas data={albedoImg} className="vsStCanvasWrap" label="Recovered albedo" />
        </div>

        <div className="vsStStage">
          <div className="vsStStageHead">
            <span>Integrated depth</span>
            <span className="vsChip">mirrors horn_integrate()</span>
          </div>
          <PixelCanvas data={depthImg} className="vsStCanvasWrap vsStCanvasWide" label="Integrated depth (shaded)" />
          {phase === "integrating" && (
            <div className="vsStProgress vsMono">
              Horn iteration {hornIters} / {HORN_TARGET_ITERS}
            </div>
          )}
        </div>

        {showGT && (
          <div className="vsStStage">
            <div className="vsStStageHead">
              <span>Course ground-truth depth</span>
            </div>
            <PixelCanvas data={gtImg} className="vsStCanvasWrap vsStCanvasWide" label="Ground-truth heightmap (shaded)" />
          </div>
        )}
      </div>

      <div className="vsStRelightRow">
        <div className="vsStStage vsStStageRelight">
          <div className="vsStStageHead">
            <span>Relit face</span>
            <span className="vsChip">mirrors lambertian()</span>
          </div>
          <PixelCanvas
            data={relightReady ? relitImg : null}
            className="vsStCanvasWrap"
            label="Face relit from the recovered surface"
          />
        </div>

        <div className="vsStLightCol">
          <div className="vsSliderLabel">drag to relight</div>
          <LightDisc light={light} onChange={setLight} />
          <div className="vsMono vsStLightVec">
            {light.map((v) => v.toFixed(2)).join(", ")}
          </div>
          {!relightReady && <div className="vsStProgress vsMono">solve to enable</div>}
        </div>
      </div>

      <div className="vsNote">
        The original input pickle wasn&apos;t archived — these four inputs are re-rendered at build
        from the course&apos;s facedata (albedo + heightmap) with David&apos;s own HW1 lambertian(),
        under the four original light directions recovered from the notebook&apos;s printed output.
      </div>

      <FigStrip panel="stereo" />
    </div>
  );
}
