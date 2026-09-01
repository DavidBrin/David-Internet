"use client";

/**
 * #spectral — the same karate-club split, read off the Laplacian spectrum.
 *
 * On mount: build the Laplacian (../core/graphalgos.laplacian) and run the
 * live Jacobi eigensolver (jacobiEigen) — both fast at n=34. Stem plot of the
 * 34 ascending eigenvalues with an animated rise (CSS transform, not SVG
 * y-attribute transitions — line x1/y1/x2/y2 aren't CSS-animatable), the
 * lambda_2/lambda_3 spectral gap bracketed, and a second karate-club drawing
 * colored by the sign of the Fiedler vector (eigenvector for lambda_2 =
 * vectors[row][1]).
 */
import { useEffect, useMemo, useState } from "react";
import { laplacian, jacobiEigen } from "@/demos/arxiv/core/graphalgos";
import { scalePositions, type SocialJson } from "./spectralHelpers";
import "./spectral.css";

const WIDTH = 380;
const HEIGHT = 300;
const PAD = 22;

const STEM_W = 460;
const STEM_H = 200;
const STEM_PAD_L = 30;
const STEM_PAD_R = 10;
const STEM_PAD_B = 22;
const STEM_PAD_T = 16;

export default function SpectralCard() {
  const [data, setData] = useState<SocialJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [risen, setRisen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/demos/arxiv/social.json")
      .then((r) => {
        if (!r.ok) throw new Error(`social.json: ${r.status}`);
        return r.json();
      })
      .then((json: SocialJson) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const eig = useMemo(() => {
    if (!data) return null;
    const L = laplacian(data.n, data.edges);
    return jacobiEigen(L);
  }, [data]);

  useEffect(() => {
    if (!eig) return;
    setRisen(false);
    const t = window.setTimeout(() => setRisen(true), 60);
    return () => window.clearTimeout(t);
  }, [eig]);

  const pts = useMemo(() => {
    if (!data) return [];
    return scalePositions(data.pos, data.n, WIDTH, HEIGHT, PAD);
  }, [data]);

  if (error) {
    return <div className="axPanel axS axSNote">Failed to load the karate club graph: {error}</div>;
  }
  if (!data || !eig) {
    return <div className="axPanel axS axSNote">Computing the spectrum&hellip;</div>;
  }

  const values = eig.values;
  const n = values.length;
  const maxVal = Math.max(...values, 1e-9);
  const plotW = STEM_W - STEM_PAD_L - STEM_PAD_R;
  const barGap = plotW / n;
  const baseline = STEM_H - STEM_PAD_B;
  const xAt = (i: number) => STEM_PAD_L + i * barGap + barGap / 2;
  const yAt = (v: number) => baseline - (v / maxVal) * (baseline - STEM_PAD_T);

  const lambda2 = values[1];
  const lambda3 = values[2];
  const gapY1 = yAt(lambda2);
  const gapY2 = yAt(lambda3);
  const gapX = (xAt(1) + xAt(2)) / 2;

  const fiedler = eig.vectors.map((row) => row[1]);

  return (
    <div className="axPanel axS">
      <div className="axRow axSHead">
        <h3 className="axSH3">The same split, read from the spectrum</h3>
        <span className="axChip">mirrors compute_laplacian_eigenvalues()</span>
      </div>

      <div className="axSBody">
        <div className="axSStemCol">
          <div className="axSLabel">
            34 Laplacian eigenvalues, ascending
            {hover !== null && (
              <span className="axMono axSHoverReadout">
                {" "}
                &middot; index {hover}, value {values[hover].toFixed(4)}
              </span>
            )}
          </div>
          <svg className="axSStem" viewBox={`0 0 ${STEM_W} ${STEM_H}`} preserveAspectRatio="xMidYMid meet">
            <line x1={STEM_PAD_L} y1={baseline} x2={STEM_W - STEM_PAD_R} y2={baseline} className="axSAxis" />

            <g className="axSGap">
              <line x1={gapX} y1={gapY1} x2={gapX} y2={gapY2} />
              <line x1={gapX - 4} y1={gapY1} x2={gapX + 4} y2={gapY1} />
              <line x1={gapX - 4} y1={gapY2} x2={gapX + 4} y2={gapY2} />
              <text x={gapX + 8} y={(gapY1 + gapY2) / 2 + 4}>
                gap {(lambda3 - lambda2).toFixed(3)}
              </text>
            </g>

            {values.map((v, i) => {
              const x = xAt(i);
              const y = yAt(v);
              const isLambda1 = i === 0;
              const isHover = hover === i;
              return (
                <g
                  key={i}
                  className="axSStemGroup"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                >
                  <rect x={x - barGap / 2} y={0} width={barGap} height={STEM_H} className="axSHitRect" />
                  <line
                    x1={x}
                    y1={baseline}
                    x2={x}
                    y2={y}
                    className={isLambda1 ? "axSStemLine axSStemLambda1" : "axSStemLine"}
                    style={{
                      transform: risen ? "scaleY(1)" : "scaleY(0)",
                      transformOrigin: `${x}px ${baseline}px`,
                      transitionDelay: `${i * 14}ms`,
                    }}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={isHover ? 4 : 2.6}
                    className={isLambda1 ? "axSStemDot axSStemLambda1" : "axSStemDot"}
                    style={{
                      transform: risen ? "translateY(0px)" : `translateY(${baseline - y}px)`,
                      transitionDelay: `${i * 14}ms`,
                    }}
                  />
                </g>
              );
            })}
          </svg>
          <div className="axMono axSNote2">
            &lambda;&#8321; = {values[0].toFixed(4)} (connected) &middot; &lambda;&#8322; ={" "}
            {values[1].toFixed(4)} (algebraic connectivity) &middot; &lambda;&#8323; = {values[2].toFixed(4)}
          </div>
        </div>

        <div className="axSGraphCol">
          <div className="axSLabel">Fiedler vector sign cut</div>
          <svg className="axSGraph" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet">
            {data.edges.map(([a, b], i) => (
              <line key={i} x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} className="axSEdge" />
            ))}
            {pts.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={9}
                className={fiedler[i] >= 0 ? "axSNode axSNodePos" : "axSNode axSNodeNeg"}
              />
            ))}
          </svg>
          <p className="axNote axSCaption">
            Nodes colored by the sign of the eigenvector for &lambda;&#8322; (the Fiedler vector). This sign
            cut closely matches the Girvan&ndash;Newman split above.
          </p>
        </div>
      </div>

      <p className="axNote">The eigensolver is a live Jacobi iteration in TS, fixture-tested against numpy.</p>
    </div>
  );
}
