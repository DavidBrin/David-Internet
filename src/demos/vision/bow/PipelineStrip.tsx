"use client";

import { useEffect, useMemo, useState } from "react";
import type { BowResults } from "./types";

const STAGES = [
  { label: "Interest points", chip: "mirrors uniform_sampling()" },
  { label: "Patch extraction", chip: "mirrors uniform_sampling()" },
  { label: "Visual vocabulary", chip: "mirrors form_visual_vocab()" },
  { label: "Word histogram", chip: "mirrors get_histogram()" },
  { label: "k-NN vote", chip: "mirrors KNN_classifier()" },
];

const AUTOPLAY_MS = 2600;
const IMG_W = 200;
const IMG_H = 133;
const VOCAB_SIZE = 484;
const VOCAB_CELL = 44;
const VOCAB_PITCH = 48;
const VOCAB_MARGIN = 4;

function cosine(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export default function PipelineStrip({ data }: { data: BowResults }) {
  const [stage, setStage] = useState(0);
  const [visit, setVisit] = useState(0);
  const [playing, setPlaying] = useState(true);

  const goStage = (n: number) => {
    setStage(n);
    setVisit((v) => v + 1);
  };

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setStage((s) => (s + 1) % STAGES.length);
      setVisit((v) => v + 1);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [playing]);

  const centerPoint = useMemo(() => {
    let best = data.samplePoints[0];
    let bestD = Infinity;
    for (const p of data.samplePoints) {
      const d = (p[0] - IMG_W / 2) ** 2 + (p[1] - IMG_H / 2) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }, [data.samplePoints]);

  const cos = useMemo(() => cosine(data.sampleHist, data.sampleNonHist), [data.sampleHist, data.sampleNonHist]);

  const bestRow = useMemo(() => {
    return data.accuracies.find((r) => r.k === 5 && r.points === "uniform" && r.features === "patch") ?? data.accuracies[5];
  }, [data.accuracies]);

  return (
    <div className="vsBwStrip">
      <div className="vsRow vsBwStageRow">
        {STAGES.map((s, i) => (
          <button
            key={s.label}
            type="button"
            className="vsBtn vsBwStageBtn"
            data-active={stage === i}
            onClick={() => goStage(i)}
          >
            <span className="vsBwStageIdx">{i + 1}</span>
            {s.label}
          </button>
        ))}
        <button
          type="button"
          className="vsBtn vsBwPlayBtn"
          data-active={playing}
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause pipeline animation" : "Play pipeline animation"}
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
      </div>

      <div className="vsBwStageChip">
        <span className="vsChip">{STAGES[stage].chip}</span>
      </div>

      <div className="vsBwViewport">
        <div key={`${stage}-${visit}`} className="vsBwStageBody">
          {stage === 0 && <PointsStage data={data} />}
          {stage === 1 && <PatchStage data={data} center={centerPoint} />}
          {stage === 2 && <VocabStage />}
          {stage === 3 && <HistogramStage data={data} />}
          {stage === 4 && <KnnStage data={data} cos={cos} bestRow={bestRow} />}
        </div>
      </div>
    </div>
  );
}

function PointsStage({ data }: { data: BowResults }) {
  return (
    <div className="vsBwPointsStage">
      <div className="vsBwImgWrap">
        <img src="/demos/vision/bow/sample_face.webp" alt="Sample face with interest points" width={IMG_W} height={IMG_H} />
        <svg className="vsBwOverlay" viewBox={`0 0 ${IMG_W} ${IMG_H}`} preserveAspectRatio="none" aria-hidden="true">
          {data.samplePoints.map((p, i) => (
            <circle
              key={i}
              cx={p[0]}
              cy={p[1]}
              r={1.6}
              className="vsBwPoint"
              style={{ animationDelay: `${i * 5}ms` }}
            />
          ))}
        </svg>
      </div>
      <p className="vsBwCaption">
        {data.params.nPts} interest points on a {data.params.wGrid}px grid ({data.params.imSize[1]}x
        {data.params.imSize[0]} image).
      </p>
    </div>
  );
}

function PatchStage({ data, center }: { data: BowResults; center: [number, number] }) {
  const patch = data.params.patchSize;
  const zoom = 20;
  const half = patch / 2;
  const bgW = IMG_W * zoom;
  const bgH = IMG_H * zoom;
  const bgX = -(center[0] - half) * zoom;
  const bgY = -(center[1] - half) * zoom;
  return (
    <div className="vsBwPatchStage">
      <div className="vsBwImgWrap vsBwImgWrapSmall">
        <img src="/demos/vision/bow/sample_face.webp" alt="Sample face" width={IMG_W} height={IMG_H} />
        <svg className="vsBwOverlay" viewBox={`0 0 ${IMG_W} ${IMG_H}`} preserveAspectRatio="none" aria-hidden="true">
          <rect
            x={center[0] - half}
            y={center[1] - half}
            width={patch}
            height={patch}
            className="vsBwPatchBox"
          />
        </svg>
      </div>
      <div className="vsBwArrow" aria-hidden="true">
        &#8594;
      </div>
      <div className="vsBwPatchZoom">
        <div
          className="vsBwPatchZoomImg"
          style={{
            width: patch * zoom,
            height: patch * zoom,
            backgroundImage: "url(/demos/vision/bow/sample_face.webp)",
            backgroundSize: `${bgW}px ${bgH}px`,
            backgroundPosition: `${bgX}px ${bgY}px`,
          }}
        >
          <svg
            className="vsBwPatchGrid"
            viewBox={`0 0 ${patch * zoom} ${patch * zoom}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {Array.from({ length: patch + 1 }, (_, i) => (
              <line key={`v${i}`} x1={i * zoom} y1={0} x2={i * zoom} y2={patch * zoom} />
            ))}
            {Array.from({ length: patch + 1 }, (_, i) => (
              <line key={`h${i}`} x1={0} y1={i * zoom} x2={patch * zoom} y2={i * zoom} />
            ))}
          </svg>
        </div>
        <p className="vsBwCaption">
          {patch}x{patch} patch, upscaled {zoom}x
        </p>
      </div>
    </div>
  );
}

function VocabStage() {
  const [cell, setCell] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCell((c) => (c + 1) % 100), 45);
    return () => clearInterval(id);
  }, []);
  const col = cell % 10;
  const row = Math.floor(cell / 10);
  const x = VOCAB_MARGIN + col * VOCAB_PITCH;
  const y = VOCAB_MARGIN + row * VOCAB_PITCH;
  return (
    <div className="vsBwVocabStage">
      <div className="vsBwVocabWrap">
        <img src="/demos/vision/bow/vocab.png" alt="100-word visual vocabulary (10x10 k-means cluster centers)" width={VOCAB_SIZE} height={VOCAB_SIZE} />
        <svg className="vsBwOverlay" viewBox={`0 0 ${VOCAB_SIZE} ${VOCAB_SIZE}`} preserveAspectRatio="none" aria-hidden="true">
          <rect x={x} y={y} width={VOCAB_CELL} height={VOCAB_CELL} className="vsBwVocabSweep" />
        </svg>
      </div>
      <p className="vsBwCaption">
        100 k-means cluster centers over ~8,000 patches &mdash; word #{cell} highlighted
      </p>
    </div>
  );
}

function HistogramStage({ data }: { data: BowResults }) {
  const [showGhost, setShowGhost] = useState(false);
  const max = Math.max(...data.sampleHist, ...data.sampleNonHist, 1);
  return (
    <div className="vsBwHistStage">
      <div className="vsRow">
        <button
          type="button"
          className="vsBtn"
          data-active={showGhost}
          onClick={() => setShowGhost((s) => !s)}
        >
          {showGhost ? "Hide" : "Show"} non-face ghost
        </button>
      </div>
      <div className="vsBwBars">
        {data.sampleHist.map((v, i) => (
          <div key={i} className="vsBwBarCol">
            {showGhost && (
              <div
                className="vsBwBarGhost"
                style={{ height: `${(data.sampleNonHist[i] / max) * 100}%` }}
              />
            )}
            <div
              className="vsBwBar"
              style={{ height: `${(v / max) * 100}%`, animationDelay: `${i * 4}ms` }}
            />
          </div>
        ))}
      </div>
      <p className="vsBwCaption">
        100-bin word histogram for the sample face{showGhost ? " (ghosted: sample non-face)" : ""}.
      </p>
    </div>
  );
}

function KnnStage({
  data,
  cos,
  bestRow,
}: {
  data: BowResults;
  cos: number;
  bestRow: BowResults["accuracies"][number];
}) {
  const gallery = [
    { src: "/demos/vision/bow/face_0.webp", label: "Face" },
    { src: "/demos/vision/bow/face_1.webp", label: "Face" },
    { src: "/demos/vision/bow/face_2.webp", label: "Face" },
    { src: "/demos/vision/bow/face_3.webp", label: "Face" },
    { src: "/demos/vision/bow/nonface_0.webp", label: "Non-face" },
    { src: "/demos/vision/bow/nonface_1.webp", label: "Non-face" },
    { src: "/demos/vision/bow/nonface_2.webp", label: "Non-face" },
    { src: "/demos/vision/bow/nonface_3.webp", label: "Non-face" },
  ];
  return (
    <div className="vsBwKnnStage">
      <div className="vsBwKnnQuery">
        <img src="/demos/vision/bow/sample_face.webp" alt="Query: sample face" width={IMG_W} height={IMG_H} />
        <p className="vsBwCaption">query</p>
      </div>
      <div className="vsBwArrow" aria-hidden="true">
        &#8594;
      </div>
      <div className="vsBwKnnGallery">
        {gallery.map((g, i) => (
          <div key={i} className="vsBwKnnThumb">
            <img src={g.src} alt={g.label} width={80} height={80} />
            <span className={`vsBwKnnLabel${g.label === "Face" ? " vsBwKnnLabelFace" : ""}`}>{g.label}</span>
          </div>
        ))}
      </div>
      <div className="vsBwKnnStats">
        <div className="vsBwKnnStat">
          <span className="vsMono vsBwKnnStatNum">{cos.toFixed(3)}</span>
          <span className="vsBwKnnStatLabel">cosine(query hist, non-face hist)</span>
        </div>
        <div className="vsBwKnnStat">
          <span className="vsMono vsBwKnnStatNum">{Math.round(bestRow.posAcc * 100)}%</span>
          <span className="vsBwKnnStatLabel">
            archived pos. accuracy at k={bestRow.k}, {bestRow.points} points, {bestRow.features} features
          </span>
        </div>
      </div>
    </div>
  );
}
