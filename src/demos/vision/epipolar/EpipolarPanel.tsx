"use client";

/**
 * Epipolar geometry / corners / matching panel (#epipolar). Loads data.json
 * and the course images once, then hands them to three independent
 * sub-panels: corner detection (A), epipolar lines (B, the headline), and
 * the SSD-vs-NCC race (C). See ./data.ts, ./imageLoad.ts, ./canvasUtil.ts,
 * ./geom.ts for the shared plumbing.
 */
import { useEffect, useState } from "react";
import { fundamentalMatrix } from "@/demos/vision/core/fmatrix";
import FigStrip from "@/demos/vision/FigStrip";
import CornersPanel from "./CornersPanel";
import { EPI_BASE, loadEpiData, type EpiData } from "./data";
import { imageToGrid, loadImage } from "./imageLoad";
import LinesPanel from "./LinesPanel";
import RacePanel from "./RacePanel";
import "./epipolar.css";

interface Loaded {
  data: EpiData;
  im0Img: HTMLImageElement;
  geiselImg: HTMLImageElement;
  dino0Img: HTMLImageElement;
  dino1Img: HTMLImageElement;
}

export default function EpipolarPanel() {
  const [state, setState] = useState<Loaded | "loading" | "error">("loading");

  useEffect(() => {
    let live = true;
    Promise.all([
      loadEpiData(),
      loadImage(`${EPI_BASE}/im0.jpg`),
      loadImage(`${EPI_BASE}/geisel.jpg`),
      loadImage(`${EPI_BASE}/dino0.jpg`),
      loadImage(`${EPI_BASE}/dino1.jpg`),
    ])
      .then(([data, im0Img, geiselImg, dino0Img, dino1Img]) => {
        if (!live) return;
        setState({ data, im0Img, geiselImg, dino0Img, dino1Img });
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("epipolar panel load failed:", err instanceof Error ? err.message : String(err));
        if (live) setState("error");
      });
    return () => {
      live = false;
    };
  }, []);

  if (state === "loading") {
    return <div className="vsPanel vsEpPanel vsEpLoading">loading epipolar data...</div>;
  }
  if (state === "error") {
    return <div className="vsPanel vsEpPanel vsEpLoading">could not load /demos/vision/epipolar/data.json</div>;
  }

  const { data, im0Img, geiselImg, dino0Img, dino1Img } = state;
  const im0Grid = imageToGrid(im0Img, "red");
  const geiselGrid = imageToGrid(geiselImg, "red");
  const dino0Grid = imageToGrid(dino0Img, "luma");
  const dino1Grid = imageToGrid(dino1Img, "luma");
  const F = fundamentalMatrix(data.correspondences.dino.cor1, data.correspondences.dino.cor2);
  const cor1 = data.correspondences.dino.cor1;
  // correspondences are in the ORIGINAL coordinate frame; RacePanel's c1 indexes
  // dino0Grid directly (display/shipped px), so rescale (display = original * scale).
  const dino0Scale = data.images.dino0.scale;
  const defaultC1: [number, number] = [cor1[0][0] * dino0Scale, cor1[1][0] * dino0Scale];

  return (
    <div className="vsEpStack">
      <CornersPanel
        im0Img={im0Img}
        im0Grid={im0Grid}
        im0Scale={data.images.im0.scale}
        geiselImg={geiselImg}
        geiselGrid={geiselGrid}
        geiselScale={data.images.geisel.scale}
      />
      <LinesPanel data={data} dino0Img={dino0Img} dino1Img={dino1Img} />
      <RacePanel
        F={F}
        dino0Img={dino0Img}
        dino1Img={dino1Img}
        dino0Grid={dino0Grid}
        dino1Grid={dino1Grid}
        dino0Scale={data.images.dino0.scale}
        dino1Scale={data.images.dino1.scale}
        defaultC1={defaultC1}
      />
      <FigStrip panel="epipolar" />
    </div>
  );
}
