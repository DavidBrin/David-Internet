"use client";

/**
 * Calibration sliders, grouped like the team's calibration GUI, under the node's own
 * ROS parameter names (spelling included). Everything recomputes live.
 */
import { memo, type ReactNode } from "react";
import { LANE_PARAMS, type LaneParams } from "../core/params";
import { LAB_BAND, LAB_PARAMS, clippedCrop, sameParams } from "./presets";

type NumKey = Exclude<keyof LaneParams, "inverted_filter">;

interface SliderDef {
  key: NumKey;
  min: number;
  max: number;
  step: number;
  digits?: number;
}

interface Group {
  title: string;
  sub: string;
  sliders: SliderDef[];
}

const GROUPS: Group[] = [
  {
    title: "HSV mask",
    sub: "cv2.inRange(hsv, lower, upper)",
    sliders: [
      { key: "Hue_low", min: 0, max: 179, step: 1 },
      { key: "Hue_high", min: 0, max: 179, step: 1 },
      { key: "Saturation_low", min: 0, max: 255, step: 1 },
      { key: "Saturation_high", min: 0, max: 255, step: 1 },
      { key: "Value_low", min: 0, max: 255, step: 1 },
      { key: "Value_high", min: 0, max: 255, step: 1 },
    ],
  },
  {
    title: "Gray gate",
    sub: "cv2.threshold(gray, gray_lower, 255)",
    sliders: [{ key: "gray_lower", min: 0, max: 255, step: 1 }],
  },
  {
    title: "Noise cleanup",
    sub: "blur, erode, dilate with np.ones((k, k))",
    sliders: [
      { key: "kernal_size", min: 1, max: 11, step: 1 },
      { key: "erosion_itterations", min: 0, max: 8, step: 1 },
      { key: "dilation_itterations", min: 0, max: 8, step: 1 },
    ],
  },
  {
    title: "Contour filter",
    sub: "Width_min < w < Width_max on cv2.minAreaRect",
    sliders: [
      { key: "Width_min", min: 0, max: 150, step: 1 },
      { key: "Width_max", min: 0, max: 300, step: 1 },
      { key: "number_of_lines", min: 0, max: 100, step: 1 },
    ],
  },
  {
    title: "Steering error",
    sub: "(cx - centre) / centre, straight vs curve",
    sliders: [
      { key: "error_threshold", min: 0, max: 1, step: 0.01, digits: 2 },
      { key: "camera_centerline", min: 0, max: 1, step: 0.01, digits: 2 },
    ],
  },
  {
    title: "Crop",
    sub: "read once at camera_init",
    sliders: [
      { key: "crop_width_decimal", min: 0.1, max: 1, step: 0.01, digits: 2 },
      { key: "rows_to_watch_decimal", min: 0.05, max: 1, step: 0.01, digits: 2 },
      { key: "rows_offset_decimal", min: 0.05, max: 0.95, step: 0.01, digits: 2 },
    ],
  },
];

/** hue bar: OpenCV H is degrees / 2 */
function hueGradient(): string {
  const stops: string[] = [];
  for (let h = 0; h <= 180; h += 15) stops.push(`hsl(${h * 2} 90% 50%) ${((h / 180) * 100).toFixed(1)}%`);
  return `linear-gradient(to right, ${stops.join(", ")})`;
}
const HUE_BG = hueGradient();

function Calibration({
  params,
  onParam,
  onReset,
  onLab,
  children,
}: {
  params: LaneParams;
  onParam: <K extends keyof LaneParams>(key: K, value: LaneParams[K]) => void;
  onReset: () => void;
  onLab: () => void;
  /** the team's GUI photo, laid out as the last cell of the group grid */
  children?: ReactNode;
}) {
  const changed = (Object.keys(LANE_PARAMS) as (keyof LaneParams)[]).filter((k) => params[k] !== LANE_PARAMS[k]);
  const { box: crop, pyHeight } = clippedCrop(640, 480, params);
  const isLab = sameParams(params, LAB_PARAMS);
  const isLabBand = sameParams(params, LAB_BAND);
  const hl = (params.Hue_low / 180) * 100;
  const hh = (Math.min(180, params.Hue_high + 1) / 180) * 100;

  return (
    <div className="acPanel acViCalib">
      <div className="acViSectionHead">
        <h3 className="acViH3">Calibration</h3>
        <span className="acChip">racer_calibration2.yaml</span>
        <span className="acViPresets">
          <button type="button" className="acBtn" data-active={isLab} onClick={onLab}>
            Lab calibration (from the photo)
          </button>
          <button type="button" className="acBtn" onClick={onReset} disabled={changed.length === 0}>
            Reset to racer_calibration2.yaml
          </button>
        </span>
      </div>
      <p className="acViCalibNote">
        {changed.length === 0
          ? "All values are the team's tuned yaml. The names are the node's ROS parameter names, misspellings included."
          : isLab
            ? "The slider values visible in the team's calibration photo (kernal_size, the iteration counts, gray_lower and rows_offset_decimal are not on screen, so they stay at the yaml values). The photo's S ceiling of 161 was tuned on the real camera feed; this synthetic tape renders at S about 210, so here the mask keeps only the tape's soft edges."
            : isLabBand
              ? "The photo's band, width filter and centre line with the yaml's HSV box: the values the two-line scenes use."
              : `Changed from the yaml: ${changed.join(", ")}.`}
      </p>

      <div className="acViGroups">
        {GROUPS.map((g) => (
          <fieldset key={g.title} className="acViGroup">
            <legend>
              {g.title} <span className="acMono">{g.sub}</span>
            </legend>
            {g.title === "HSV mask" ? (
              <div className="acViHueBar" style={{ background: HUE_BG }} aria-hidden>
                <span className="acViHueWin" style={{ left: `${hl}%`, width: `${Math.max(0, hh - hl)}%` }} />
              </div>
            ) : null}
            {g.sliders.map((s) => {
              const v = params[s.key];
              const yaml = LANE_PARAMS[s.key];
              const diff = v !== yaml;
              return (
                <label key={s.key} className="acViParam" data-changed={diff}>
                  <span className="acViParamName acMono">{s.key}</span>
                  <input
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={v}
                    onChange={(e) => onParam(s.key, (s.digits ? +e.target.value : Math.round(+e.target.value)) as LaneParams[typeof s.key])}
                  />
                  <span className="acViParamVal acMono">{s.digits ? v.toFixed(s.digits) : v}</span>
                  <span className="acViParamYaml acMono" title="racer_calibration2.yaml">
                    {diff ? `yaml ${s.digits ? yaml.toFixed(s.digits) : yaml}` : ""}
                  </span>
                </label>
              );
            })}
            {g.title === "HSV mask" ? (
              <label className="acViToggle">
                <input
                  type="checkbox"
                  checked={params.inverted_filter === 1}
                  onChange={(e) => onParam("inverted_filter", e.target.checked ? 1 : 0)}
                />
                <span className="acMono">inverted_filter</span>
                <span className="acViToggleNote">{params.inverted_filter === 1 ? "1: keep what the mask rejects" : "0: keep what the mask accepts"}</span>
              </label>
            ) : null}
            {g.title === "Crop" ? (
              <p className="acViFixedNote">
                Rows {crop.y0} to {crop.y1}
                {pyHeight !== crop.y1 - crop.y0 ? ` (asks for ${crop.y0} to ${crop.y0 + pyHeight}; numpy clips at the frame edge)` : ""},
                columns {crop.x0} to {crop.x1}. The node reads these once, on the first frame (camera_init), so on the car
                a change takes effect when the node restarts; here it applies immediately.
              </p>
            ) : null}
          </fieldset>
        ))}
        {children}
      </div>
    </div>
  );
}

export default memo(Calibration);
