"use client";

import { useState } from "react";
import { fmt3 } from "./format";
import MicroctSlice from "./MicroctSlice";
import type { CurvesData, MicroctData } from "./types";

type Tab = "pet" | "microct";

export default function ResultsTabs({ curves, microct }: { curves: CurvesData; microct: MicroctData }) {
  const [tab, setTab] = useState<Tab>("pet");

  return (
    <div className="ctTResults">
      <div className="ctTTabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "pet"}
          className="ctTTab"
          data-active={tab === "pet" ? "true" : "false"}
          onClick={() => setTab("pet")}
        >
          Oxford-IIIT Pet (this page&rsquo;s checkpoints)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "microct"}
          className="ctTTab"
          data-active={tab === "microct" ? "true" : "false"}
          onClick={() => setTab("microct")}
        >
          Micro-CT (the report)
        </button>
      </div>

      {tab === "pet" ? <PetTab curves={curves} /> : <MicroctTab microct={microct} />}
    </div>
  );
}

function PetTab({ curves }: { curves: CurvesData }) {
  const { unetSupervised, vitSupervised, finalEval, checkpointReEval } = curves;
  const ctRows = finalEval.rows;
  const findRow = (model: string) => ctRows.find((r) => r.model === model);
  const unetCT = findRow("U-Net");
  const vitCT = findRow("ViT");
  const ensCT = findRow("Ensemble");

  return (
    <div className="ctTTabPanel">
      <div className="ctTTableWrap">
        <table className="ctTTable">
          <thead>
            <tr>
              <th>Model</th>
              <th>Setting</th>
              <th>Dice</th>
              <th>IoU</th>
              <th>Pixel acc.</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>U-Net</td>
              <td>supervised baseline</td>
              <td className="ctMono">{fmt3(unetSupervised.test_metrics.dice)}</td>
              <td className="ctMono">{fmt3(unetSupervised.test_metrics.iou)}</td>
              <td className="ctMono">{fmt3(unetSupervised.test_metrics.pixel_accuracy)}</td>
            </tr>
            <tr>
              <td>ViT</td>
              <td>supervised baseline</td>
              <td className="ctMono">{fmt3(vitSupervised.test_metrics.dice)}</td>
              <td className="ctMono">{fmt3(vitSupervised.test_metrics.iou)}</td>
              <td className="ctMono">{fmt3(vitSupervised.test_metrics.pixel_accuracy)}</td>
            </tr>
            {unetCT && (
              <tr className="ctTRowCT">
                <td>U-Net</td>
                <td>cross-teaching</td>
                <td className="ctMono">{fmt3(unetCT.dice)}</td>
                <td className="ctMono">{fmt3(unetCT.iou)}</td>
                <td className="ctMono">{fmt3(unetCT.pixelAccuracy)}</td>
              </tr>
            )}
            {vitCT && (
              <tr className="ctTRowCT">
                <td>ViT</td>
                <td>cross-teaching</td>
                <td className="ctMono">{fmt3(vitCT.dice)}</td>
                <td className="ctMono">{fmt3(vitCT.iou)}</td>
                <td className="ctMono">{fmt3(vitCT.pixelAccuracy)}</td>
              </tr>
            )}
            {ensCT && (
              <tr className="ctTRowCT ctTRowEns">
                <td>Ensemble</td>
                <td>cross-teaching</td>
                <td className="ctMono">{fmt3(ensCT.dice)}</td>
                <td className="ctMono">{fmt3(ensCT.iou)}</td>
                <td className="ctMono">{fmt3(ensCT.pixelAccuracy)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="ctTVerdict">
        With 590 labeled images and ImageNet-pretrained encoders the ensemble ties the supervised U-Net at Dice{" "}
        {fmt3(ensCT ? ensCT.dice : 0)} - cross-teaching&rsquo;s value here is training on images no human labeled.
      </p>

      <p className="ctNote">
        <strong>Post-hoc re-eval:</strong> {checkpointReEval.notes} Re-evaluated validation Dice: U-Net{" "}
        <span className="ctMono">{fmt3(checkpointReEval.validation_metrics.unet.dice)}</span>, ViT{" "}
        <span className="ctMono">{fmt3(checkpointReEval.validation_metrics.vit.dice)}</span>, ensemble{" "}
        <span className="ctMono">{fmt3(checkpointReEval.validation_metrics.ensemble.dice)}</span>.
      </p>
    </div>
  );
}

function MicroctTab({ microct }: { microct: MicroctData }) {
  const { report } = microct;
  const [figureExpanded, setFigureExpanded] = useState(false);

  return (
    <div className="ctTTabPanel">
      <div className="ctRow">
        <span className="ctChip">{report.labeled} labeled slices</span>
        <span className="ctChip">{report.unlabeled} unlabeled slices</span>
        <span className="ctChip">22 nm resolution X-ray micro-tomography</span>
      </div>

      <div className="ctTTableWrap">
        <table className="ctTTable">
          <thead>
            <tr>
              <th>Model</th>
              <th>Supervised only</th>
              <th>Cross-teaching</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>U-Net</td>
              <td className="ctMono">{fmt3(report.dice.unetSupervised)}</td>
              <td className="ctMono">{fmt3(report.dice.unetCrossTeaching)}</td>
            </tr>
            <tr>
              <td>ViT</td>
              <td className="ctMono">{fmt3(report.dice.vitSupervised)}</td>
              <td className="ctMono">{fmt3(report.dice.vitCrossTeaching)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="ctNote">{report.note}</p>

      <div className="ctTSliceGrid">
        {microct.slices.map((s) => (
          <MicroctSlice key={s.id} id={s.id} poreFraction={s.poreFraction} />
        ))}
      </div>

      <div className="ctTFigureBlock">
        <div className="ctTFigureThumb" onClick={() => setFigureExpanded((v) => !v)} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setFigureExpanded((v) => !v); }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/demos/crossteach/report30epoch.webp" alt="Report-era 30-epoch training figure thumbnail" />
          <span className="ctTFigureHint">{figureExpanded ? "click to collapse" : "click to expand"}</span>
        </div>
        {figureExpanded && (
          <div className="ctTFigureExpanded">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/demos/crossteach/report30epoch.webp" alt="Report-era 30-epoch training figure, expanded" />
          </div>
        )}
        <p className="ctNote">The report-era 30-epoch training figure (per-pixel confidence at 0.9, consistency weight 0.5).</p>
      </div>
    </div>
  );
}
