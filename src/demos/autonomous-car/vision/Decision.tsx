"use client";

/**
 * Readout for one frame: the branch locate_centroid took, the value published on
 * /centroid, the node's log line, the width filter per contour, the curve logic
 * (errors before / after the "inside the band becomes 1" replacement), and, in the
 * garbage scene, what object_detection_node publishes.
 */
import { memo } from "react";
import type { LaneParams } from "../core/params";
import { DETECT_PARAMS, GUIDANCE_PARAMS } from "../core/params";
import type { Snap } from "./VisionPanel";
import { fmtW, logLine, pyFloat } from "./render";

const KIND_LABEL = {
  none: "Nothing detected",
  single: "Single line",
  straight: "Straight",
  curve: "Curve",
} as const;

const f3 = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(3);

function Decision({ snap, params }: { snap: Snap | null; params: LaneParams }) {
  if (!snap) {
    return (
      <div className="acViDecision">
        <div className="acViKind" data-kind="none">
          Waiting for the first frame
        </div>
      </div>
    );
  }
  const { r, det } = snap;
  const d = r.decision;
  const passed = r.contours.filter((c) => c.cx !== undefined);
  const nLines = passed.length;
  const thr = params.error_threshold;

  return (
    <div className="acViDecision">
      <div className="acViKindRow">
        <span className="acViKind" data-kind={d.kind}>
          {KIND_LABEL[d.kind]}
          {d.kind === "straight" || d.kind === "curve" ? ` (${nLines} lines)` : ""}
        </span>
        <span className="acViKindSub">
          {d.kind === "none"
            ? "no contour passed the width filter"
            : d.kind === "single"
              ? "one contour passed: its error is used as is"
              : `|e_first - e_last| = ${d.horizonDiff.toFixed(3)} ${d.kind === "straight" ? "≤" : ">"} ${thr}`}
        </span>
      </div>

      <div className="acScreen acViTopic">
        <div className="acViTopicHead acMono">
          <span>/centroid</span>
          <span className="acViTopicType">std_msgs/Float32</span>
        </div>
        {d.kind === "none" ? (
          <div className="acViTopicNone">Nothing detected: no message published, the car keeps its last command.</div>
        ) : (
          <div className="acViTopicVal acMono">
            data: <b>{pyFloat(Math.fround(d.error))}</b>
            <span className="acViSteer">{d.error > 0 ? "steer right" : d.error < 0 ? "steer left" : "straight ahead"}</span>
          </div>
        )}
        <div className="acViLog acMono">
          <span className="acViLogTag">[INFO] [lane_detection_node]:</span> {logLine(r)}
        </div>
      </div>

      <table className="acViTable acMono">
        <thead>
          <tr>
            <th>#</th>
            <th>w</th>
            <th>h</th>
            <th>filter</th>
            <th>cx, cy</th>
            <th>error</th>
          </tr>
        </thead>
        <tbody>
          {r.contours.length === 0 ? (
            <tr>
              <td colSpan={6} className="acViTableEmpty">
                No contours in the final binary image.
              </td>
            </tr>
          ) : (
            r.contours.slice(0, 6).map((c, i) => {
              const verdict = c.pass ? (c.cx === undefined ? "m00 = 0" : "pass") : c.rect.w <= params.Width_min ? "too narrow" : "too wide";
              const err = c.cx !== undefined ? (c.cx - r.centerX) / r.centerX : null;
              return (
                <tr key={i} data-pass={c.pass && c.cx !== undefined}>
                  <td>{i}</td>
                  <td>{fmtW(c.rect.w)}</td>
                  <td>{fmtW(c.rect.h)}</td>
                  <td className="acViVerdict">{verdict}</td>
                  <td>{c.cx !== undefined ? `${c.cx}, ${c.cy}` : ""}</td>
                  <td>{err !== null ? f3(err) : ""}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {r.contours.length > 6 ? <p className="acViSmall">+{r.contours.length - 6} more contours</p> : null}
      <p className="acViSmall">
        w and h are cv2.minAreaRect&apos;s sides, so w is not always the horizontal width: the filter reads whichever side
        OpenCV lists first. Centre line x = int({r.width} × {params.camera_centerline}) = {r.centerX} px; errors are
        (cx - {r.centerX}) / {r.centerX}.
      </p>

      <CurveLogic snap={snap} params={params} />

      {det ? <Detector det={det} /> : null}
    </div>
  );
}

function CurveLogic({ snap, params }: { snap: Snap; params: LaneParams }) {
  const d = snap.r.decision;
  const thr = params.error_threshold;
  const isCurve = d.kind === "curve";
  return (
    <div className="acViCurve" data-active={isCurve}>
      <div className="acViCurveHead">
        <b>Curve logic</b>
        <span className="acMono">p_horizon_diff &gt; error_threshold</span>
      </div>
      {isCurve ? (
        <>
          <p>
            The first and last lines&apos; errors differ by {d.horizonDiff.toFixed(3)}, more than {thr}. Every line with
            |error| &lt; {thr} (inside the threshold band) is replaced by 1, then the node picks the smallest |error|.
          </p>
          {Math.abs(thr * snap.r.centerX - (thr * snap.r.width) / 2) >= 0.5 ? (
            <p className="acViSmall">
              |error| &lt; {thr} means within {(thr * snap.r.centerX).toFixed(1)} px of the centre line, because errors are
              divided by the centre x ({snap.r.centerX} px). The red lines are drawn at {((thr * snap.r.width) / 2).toFixed(1)} px
              (error_threshold × width / 2), so the band that counts is{" "}
              {thr * snap.r.centerX > (thr * snap.r.width) / 2 ? "a little wider" : "a little narrower"} than the one drawn.
            </p>
          ) : null}
          <table className="acViTable acMono">
            <thead>
              <tr>
                <th>line</th>
                <th>error</th>
                <th>after</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.rawErrors.map((e, i) => {
                const picked = d.errors.indexOf(d.error) === i;
                return (
                  <tr key={i} data-pass={picked}>
                    <td>{i}</td>
                    <td>{f3(e)}</td>
                    <td>{d.errors[i] === 1 && Math.abs(e) < thr ? "1 (in band)" : f3(d.errors[i])}</td>
                    <td className="acViVerdict">{picked ? "picked" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {d.errors.every((e) => e === 1) ? (
            <p className="acViWarn">
              Every line was inside the band, so every error became 1 and the node publishes 1.0: full right. This is kept
              as written.
            </p>
          ) : (
            <p className="acViSmall">
              If every line were inside the band, every error would become 1 and the car would steer full right. This is
              kept as written.
            </p>
          )}
        </>
      ) : (
        <p className="acViSmall">
          {d.kind === "straight"
            ? `Not this frame: the lines agree within ${thr}, so the node averaged their errors instead.`
            : "Runs only when two or more lines pass and the first and last disagree by more than error_threshold. The yaml's 20 percent band rarely holds two dashes; the Curve branch and All lines centred scenes use the wider band from the team's calibration photo."}{" "}
          When it runs, lines inside the threshold band get error 1 and the smallest |error| wins, so if every line is
          inside the band the car steers full right. This is kept as written.
        </p>
      )}
    </div>
  );
}

function Detector({ det }: { det: NonNullable<Snap["det"]> }) {
  const wThr = GUIDANCE_PARAMS.width_threshold;
  const w = det.width ?? 0;
  return (
    <div className="acViDet">
      <div className="acViCurveHead">
        <b>object_detection_node</b>
        <span className="acMono">
          {DETECT_PARAMS.model} v{DETECT_PARAMS.version}, conf ≥ {DETECT_PARAMS.confidence.toFixed(2)}
        </span>
      </div>
      <div className="acViDetGrid acMono">
        <span>/object_detections/flag</span>
        <b>{det.flag ? "True" : "False"}</b>
        <span>/object_detections/centroid</span>
        <b>{det.centroid !== null ? pyFloat(Math.fround(det.centroid)) : "not published"}</b>
        <span>/object_detections/depth (widest box)</span>
        <b>{det.width !== null ? `${w.toFixed(1)} px` : "not published"}</b>
      </div>
      <div className="acViDetBar" aria-label={`Box width ${w.toFixed(0)} of ${wThr} px`}>
        <span style={{ width: `${Math.min(100, (w / (wThr * 1.25)) * 100)}%` }} data-over={w > wThr} />
        <i style={{ left: `${(1 / 1.25) * 100}%` }} />
      </div>
      <p className="acViSmall">
        {w > wThr
          ? `Box wider than ${wThr} px: the guidance node stops and runs the scoop.`
          : `The guidance node stops for the scoop once the box is wider than ${wThr} px (now ${w.toFixed(0)} px).`}{" "}
        The Roboflow model (garbage-dxrv3 v3) ran on the OAK-D&apos;s own processor and can&apos;t run in a browser, so
        the box here is the garbage&apos;s true outline projected into the camera.
      </p>
    </div>
  );
}

export default memo(Decision);
