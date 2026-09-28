"use client";

/**
 * #vision: lane_detection_node, stage by stage. A virtual 640x480 OAK-D frame of the
 * synthetic lot goes through the ported locate_centroid (core/lane.ts); the panel draws
 * the node's own cv2 debug overlay, every intermediate image, the straight / curve
 * decision and the value published on /centroid. Sliders mirror the team's calibration
 * GUI and start at racer_calibration2.yaml. Heavy work (render ~40 ms + pipeline ~10 ms)
 * runs in a rAF loop capped at 8 fps while driving, or once per change otherwise, and
 * only while the panel is near the viewport. React only re-renders the readouts.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { CAMERA, renderCamera, type Pose } from "../core/camera";
import { bgrFromRGBA, type Mat } from "../core/cv";
import { runModel, standInDetections, type DetectorOutput, type Prediction } from "../core/detect";
import type { LaneResult } from "../core/lane";
import { LANE_PARAMS, type LaneParams } from "../core/params";
import { World } from "../core/world";
import { useFitCanvas, useRaf } from "../ui/useFitCanvas";
import { SCENES, poseAt, type Scene } from "./scenes";
import { drawDetections, drawLaneOverlay } from "./render";
import { LAB_PARAMS, clippedCrop, runLane } from "./presets";
import StageStrip from "./StageStrip";
import Calibration from "./Calibration";
import Decision from "./Decision";
import "./vision.css";

const SPEED = 0.5; // m/s
const FRAME_DT = 1 / 8; // cap: 8 frames a second while driving
const GARBAGE_AHEAD = 1.1;

/** module-level so the memoised Calibration panel keeps stable children */
const GUI_PHOTO = (
  <figure className="acViFigure">
    <img
      src="/demos/autonomous-car/media/lane-debug.jpg"
      width={1400}
      height={1050}
      loading="lazy"
      alt="The team's lane calibration GUI on a laptop: the mask window, the parameter sliders and the tracked centroids on the camera feed"
    />
    <figcaption>
      The team&apos;s calibration GUI during tuning: the mask window, the sliders, and the tracked centroids on the real
      camera feed. With the final yaml band (rows 50 to 70 percent), the node usually tracks one dash at a time. The
      team&apos;s calibration photo shows a 62 percent band, where several dashes fall inside it and the straight and
      curve logic engages.
    </figcaption>
  </figure>
);

interface Engine {
  normal: World;
  deep: World | null;
  rgba: Uint8ClampedArray;
  image: ImageData;
  frameCanvas: HTMLCanvasElement;
  bgr: Mat | null;
  result: LaneResult | null;
  preds: Prediction[];
  det: DetectorOutput | null;
  s: number;
  acc: number;
  frameNo: number;
  garbageS: number;
}

export interface Snap {
  r: LaneResult;
  det: DetectorOutput | null;
  s: number;
  ms: number;
}

/** true while the element is within `margin` of the viewport (re-arms when it leaves). */
function useInView<T extends Element>(margin = "200px") {
  const [inView, setInView] = useState(false);
  const io = useRef<IntersectionObserver | null>(null);
  const ref = useCallback(
    (el: T | null) => {
      io.current?.disconnect();
      io.current = null;
      if (!el) return;
      const obs = new IntersectionObserver((entries) => setInView(entries.some((e) => e.isIntersecting)), { rootMargin: margin });
      obs.observe(el);
      io.current = obs;
    },
    [margin],
  );
  useEffect(() => () => io.current?.disconnect(), []);
  return { ref, inView };
}

function paramsFor(sc: Scene): LaneParams {
  return sc.params ?? LANE_PARAMS;
}

export default function VisionPanel() {
  const { ref: rootRef, inView } = useInView<HTMLDivElement>("200px");
  const [ready, setReady] = useState(false);
  const [sceneId, setSceneId] = useState(SCENES[0].id);
  const [params, setParams] = useState<LaneParams>(LANE_PARAMS);
  const [off, setOff] = useState(0);
  const [dth, setDth] = useState(0);
  const [driving, setDriving] = useState(false);
  const [snap, setSnap] = useState<Snap | null>(null);

  const eng = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene>(SCENES[0]);
  const paramsRef = useRef(params);
  const offRef = useRef(off);
  const dthRef = useRef(dth);
  const drivingRef = useRef(driving);
  const dirtyFrame = useRef(true);
  const dirtyPipe = useRef(true);
  const autoStarted = useRef(false);
  /** params came from a scene override and the user hasn't touched a slider since */
  const paramsFromScene = useRef(false);

  paramsRef.current = params;
  drivingRef.current = driving;

  // ---------------------------------------------------------------- world (after mount, once near)
  useEffect(() => {
    if (!inView || eng.current) return;
    const id = window.setTimeout(() => {
      if (eng.current) return;
      const normal = new World();
      const rgba = new Uint8ClampedArray(CAMERA.W * CAMERA.H * 4);
      const frameCanvas = document.createElement("canvas");
      frameCanvas.width = CAMERA.W;
      frameCanvas.height = CAMERA.H;
      eng.current = {
        normal,
        deep: null,
        rgba,
        image: new ImageData(rgba, CAMERA.W, CAMERA.H),
        frameCanvas,
        bgr: null,
        result: null,
        preds: [],
        det: null,
        s: SCENES[0].s,
        acc: 0,
        frameNo: 0,
        garbageS: 0,
      };
      dirtyFrame.current = true;
      setReady(true);
    }, 40);
    return () => window.clearTimeout(id);
  }, [inView]);

  // auto-start the drive once, the first time the panel comes near the viewport
  useEffect(() => {
    if (ready && inView && !autoStarted.current) {
      autoStarted.current = true;
      setDriving(true);
    }
  }, [ready, inView]);

  // ---------------------------------------------------------------- canvases
  const drawCamera = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = "#0d0f11";
    ctx.fillRect(0, 0, w, h);
    const e = eng.current;
    if (!e || !e.result) return;
    const k = w / CAMERA.W;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(e.frameCanvas, 0, 0, w, h);
    const r = e.result;
    const c = r.crop;
    // dim everything the node never reads
    ctx.fillStyle = "rgba(8,10,12,0.42)";
    ctx.fillRect(0, 0, w, c.y0 * k);
    ctx.fillRect(0, c.y1 * k, w, h - c.y1 * k);
    ctx.fillRect(0, c.y0 * k, c.x0 * k, (c.y1 - c.y0) * k);
    ctx.fillRect(c.x1 * k, c.y0 * k, w - c.x1 * k, (c.y1 - c.y0) * k);
    // detector overlay first (the lane node gets the clean frame; camera_driver2 publishes before drawing)
    if (e.det && e.det.preds.length) drawDetections(ctx, e.det.preds, k, e.det.targetIndex, CAMERA.W);
    ctx.save();
    ctx.translate(c.x0 * k, c.y0 * k);
    drawLaneOverlay(ctx, r, k, { rejectLabels: w >= 520, widthMin: paramsRef.current.Width_min, widthMax: paramsRef.current.Width_max });
    ctx.restore();
    // crop band outline
    ctx.save();
    ctx.strokeStyle = "#eab308";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(c.x0 * k - 1, c.y0 * k - 1, (c.x1 - c.x0) * k + 2, (c.y1 - c.y0) * k + 2);
    ctx.setLineDash([]);
    const tag = `lane crop: rows ${c.y0} to ${c.y1}, cols ${c.x0} to ${c.x1}`;
    ctx.font = `600 ${w < 520 ? 10 : 11.5}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    const tw = ctx.measureText(tag).width + 10;
    const ty = c.y1 * k + 24 <= h ? c.y1 * k + 3 : Math.max(0, c.y0 * k - 21);
    ctx.fillStyle = "rgba(17,19,21,0.82)";
    ctx.fillRect(c.x0 * k - 1, ty, tw, 18);
    ctx.fillStyle = "#facc15";
    ctx.textBaseline = "middle";
    ctx.fillText(tag, c.x0 * k + 4, ty + 9.5);
    ctx.restore();
  }, []);

  const drawImg = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = "#0d0f11";
    ctx.fillRect(0, 0, w, h);
    const e = eng.current;
    if (!e || !e.result) return;
    const r = e.result;
    const c = r.crop;
    const k = w / r.width;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(e.frameCanvas, c.x0, c.y0, r.width, r.height, 0, 0, w, h);
    drawLaneOverlay(ctx, r, k, { rejectLabels: true, widthMin: paramsRef.current.Width_min, widthMax: paramsRef.current.Width_max });
  }, []);

  const crop0 = clippedCrop(CAMERA.W, CAMERA.H, params).box;
  const imgAspect = (crop0.x1 - crop0.x0) / (crop0.y1 - crop0.y0);
  const cam = useFitCanvas(drawCamera, CAMERA.W / CAMERA.H);
  const img = useFitCanvas(drawImg, imgAspect);
  const redrawCam = cam.redraw;
  const redrawImg = img.redraw;

  // ---------------------------------------------------------------- the frame loop
  const compute = useCallback(() => {
    const e = eng.current;
    if (!e) return;
    const sc = sceneRef.current;
    let world = e.normal;
    if (sc.shade === "deep") {
      if (!e.deep) e.deep = new World({ shadeScale: 2.6 });
      world = e.deep;
    }
    const t0 = performance.now();
    if (dirtyFrame.current || !e.bgr) {
      const pose: Pose = poseAt(world, e.s, offRef.current, dthRef.current);
      if (sc.garbage) {
        const g = world.garbage[0];
        if (g && drivingRef.current && e.s > e.garbageS - 0.35) {
          // drove up to the box: put a fresh one further down the tape
          e.garbageS = e.s + 2.6;
          const p = world.pointAt(e.garbageS);
          g.x = p.x;
          g.y = p.y;
        }
      }
      renderCamera(world, pose, e.rgba, CAMERA, { seed: drivingRef.current ? 7 + (e.frameNo++ % 997) : 7 });
      e.frameCanvas.getContext("2d")?.putImageData(e.image, 0, 0);
      e.bgr = bgrFromRGBA(e.rgba, CAMERA.W, CAMERA.H);
      e.preds = sc.garbage ? standInDetections(world, pose) : [];
      dirtyFrame.current = false;
    }
    const r = runLane(e.bgr, paramsRef.current);
    e.result = r;
    e.det = sc.garbage ? runModel(e.preds, CAMERA.W) : null;
    dirtyPipe.current = false;
    const ms = performance.now() - t0;
    redrawCam();
    redrawImg();
    setSnap({ r, det: e.det, s: e.s, ms });
  }, [redrawCam, redrawImg]);

  // discrete changes (scene, sliders) compute on a timeout too, so they never wait on rAF
  const kickId = useRef(0);
  const kick = useCallback(() => {
    if (kickId.current) return;
    kickId.current = window.setTimeout(() => {
      kickId.current = 0;
      if (dirtyFrame.current || dirtyPipe.current) compute();
    }, 0);
  }, [compute]);
  useEffect(() => () => window.clearTimeout(kickId.current), []);

  useRaf(
    (dt) => {
      const e = eng.current;
      if (!e) return;
      if (drivingRef.current) {
        e.s = (e.s + SPEED * dt) % e.normal.length;
        e.acc += dt;
        if (e.acc >= FRAME_DT) {
          e.acc = 0;
          dirtyFrame.current = true;
        }
      }
      if (dirtyFrame.current || dirtyPipe.current) compute();
    },
    ready && inView,
  );

  // ---------------------------------------------------------------- scene + controls
  const placeGarbage = useCallback((sc: Scene) => {
    const e = eng.current;
    if (!e) return;
    const world = e.normal;
    if (!sc.garbage) {
      world.garbage = [];
      return;
    }
    const pose = poseAt(world, sc.s, sc.off, sc.dth);
    // same placement as the fixture frame (scripts/demos/autonomous-car.ts)
    world.garbage = [
      {
        id: "box",
        x: pose.x + Math.cos(pose.th) * GARBAGE_AHEAD,
        y: pose.y + Math.sin(pose.th) * GARBAGE_AHEAD + 0.05,
        w: 0.26,
        d: 0.2,
        h: 0.14,
        yaw: 0.25,
        color: [176, 128, 84],
        label: "cardboard box",
      },
    ];
    e.garbageS = sc.s + GARBAGE_AHEAD;
  }, []);

  const pickScene = useCallback(
    (sc: Scene) => {
      sceneRef.current = sc;
      setSceneId(sc.id);
      setDriving(false);
      setOff(sc.off);
      setDth(sc.dth);
      offRef.current = sc.off;
      dthRef.current = sc.dth;
      if (sc.params) {
        setParams(paramsFor(sc));
        paramsFromScene.current = true;
      } else if (paramsFromScene.current) {
        setParams(LANE_PARAMS);
        paramsFromScene.current = false;
      }
      const e = eng.current;
      if (e) {
        e.s = sc.s;
        e.acc = 0;
      }
      placeGarbage(sc);
      dirtyFrame.current = true;
      kick();
    },
    [placeGarbage, kick],
  );

  const onOff = (v: number) => {
    setOff(v);
    offRef.current = v;
    dirtyFrame.current = true;
    kick();
  };
  const onDth = (v: number) => {
    setDth(v);
    dthRef.current = v;
    dirtyFrame.current = true;
    kick();
  };
  const onS = (v: number) => {
    const e = eng.current;
    if (!e) return;
    e.s = v;
    dirtyFrame.current = true;
    kick();
  };

  const onParam = useCallback(<K extends keyof LaneParams>(key: K, value: LaneParams[K]) => {
    paramsFromScene.current = false;
    setParams((p) => ({ ...p, [key]: value }));
  }, []);
  const onReset = useCallback(() => {
    paramsFromScene.current = false;
    setParams(LANE_PARAMS);
  }, []);
  const onLab = useCallback(() => {
    paramsFromScene.current = false;
    setParams(LAB_PARAMS);
  }, []);

  useEffect(() => {
    dirtyPipe.current = true;
    if (eng.current) kick();
  }, [params, kick]);

  const scene = SCENES.find((s) => s.id === sceneId) ?? SCENES[0];
  const lapLen = eng.current?.normal.length ?? 90.27;
  const sNow = snap?.s ?? scene.s;

  return (
    <div ref={rootRef} className="acViRoot">
      <div className="acPanel acViTop">
        <div className="acViScenes" role="group" aria-label="Scenes">
          {SCENES.map((sc) => (
            <button key={sc.id} type="button" className="acBtn acViScene" data-active={sc.id === sceneId} onClick={() => pickScene(sc)}>
              {sc.label}
              {sc.tag ? <span className="acViSceneTag">{sc.tag}</span> : null}
            </button>
          ))}
        </div>
        <p className="acViHint">{scene.hint}</p>

        <div className="acViMain">
          <div className="acViLeft">
            <div className="acScreen acViScreen">
              <div className="acViScreenBar">
                <span className="acViDot" data-on={driving} />
                <span className="acMono">OAK-D Lite RGB, 640x480 (virtual)</span>
                <span className="acViScreenMs acMono">{snap ? `${snap.ms.toFixed(0)} ms/frame` : ""}</span>
              </div>
              <div ref={cam.wrapRef} className="acViCamWrap">
                <canvas ref={cam.canvasRef} aria-label="Camera frame with the lane node's debug overlay" />
                {!ready ? <div className="acLoading acViLoading">Building the test lot (baking the ground texture)...</div> : null}
              </div>
              <div className="acViImgHead acMono">
                <span>cv2.imshow(&apos;img&apos;, img)</span>
                <span className="acViLegend">
                  <i className="acViSw" style={{ background: "rgb(0,255,0)" }} /> passed
                  <i className="acViSw acViSwDash" /> rejected
                  <i className="acViSw" style={{ background: "rgb(255,0,0)" }} /> threshold
                  <i className="acViSw acViSwRound" style={{ background: "rgb(0,0,255)" }} /> target
                  <i className="acViSw acViSwRound" style={{ background: "rgb(255,0,0)" }} /> single-line target
                </span>
              </div>
              <div ref={img.wrapRef} className="acViImgWrap" style={{ aspectRatio: `${crop0.x1 - crop0.x0} / ${crop0.y1 - crop0.y0}` }}>
                <canvas ref={img.canvasRef} aria-label="The node's img debug window: the crop band enlarged" />
              </div>
            </div>

            <div className="acViDrive">
              <button type="button" className="acBtn" data-active={driving} disabled={!ready} onClick={() => setDriving((d) => !d)}>
                {driving ? "Pause" : "Drive"}
              </button>
              <span className="acViDriveNote">
                {driving ? "Creeping along the tape at 0.5 m/s, 8 frames a second." : "Paused. Drive creeps the car along the tape at 0.5 m/s."}
              </span>
            </div>
            <div className="acViPose">
              <label className="acSliderLabel acViSlider">
                <span>Along the tape</span>
                <input type="range" min={0} max={lapLen} step={0.01} value={sNow} onChange={(ev) => onS(+ev.target.value)} disabled={!ready} />
                <span className="acMono acViVal">{sNow.toFixed(2)} m</span>
              </label>
              <label className="acSliderLabel acViSlider">
                <span>Lateral offset</span>
                <input type="range" min={-2.5} max={2.5} step={0.01} value={off} onChange={(ev) => onOff(+ev.target.value)} />
                <span className="acMono acViVal">{off >= 0 ? "+" : ""}{(off * 100).toFixed(0)} cm {off > 0 ? "L" : off < 0 ? "R" : ""}</span>
              </label>
              <label className="acSliderLabel acViSlider">
                <span>Heading</span>
                <input type="range" min={-1.3} max={1.3} step={0.005} value={dth} onChange={(ev) => onDth(+ev.target.value)} />
                <span className="acMono acViVal">{dth >= 0 ? "+" : ""}{((dth * 180) / Math.PI).toFixed(1)}° {dth > 0 ? "L" : dth < 0 ? "R" : ""}</span>
              </label>
            </div>
          </div>

          <div className="acViRight">
            <Decision snap={snap} params={params} />
          </div>
        </div>
      </div>

      <StageStrip r={snap?.r ?? null} params={params} />

      <Calibration params={params} onParam={onParam} onReset={onReset} onLab={onLab}>
        {GUI_PHOTO}
      </Calibration>

      <div className="acNote">
        Frames come from a synthetic parking lot seen through a virtual 640x480 camera. The 640 px width is read from the
        team&apos;s detector screenshot; the mount height (30 cm), pitch (18° down) and field of view (69°) are assumptions.
        The pipeline is the node&apos;s own code, ported line for line and fixture-tested bit-exact against the original
        running under OpenCV 4.11.
      </div>
    </div>
  );
}
