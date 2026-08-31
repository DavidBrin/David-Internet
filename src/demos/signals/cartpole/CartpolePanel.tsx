"use client";

import { useState } from "react";
import CartScene from "./CartScene";
import PolePlane from "./PolePlane";
import StripChart from "./StripChart";
import { useCartpoleSim } from "./useCartpoleSim";
import "./cartpole.css";

const PRESETS = {
  open: { k1: 0, k2: 0 },
  p25: { k1: -25, k2: 0 },
  pd: { k1: -25.8, k2: -8 },
} as const;

export default function CartpolePanel() {
  const [k1, setK1] = useState<number>(PRESETS.open.k1);
  const [k2, setK2] = useState<number>(PRESETS.open.k2);
  const [nonlinear, setNonlinear] = useState(true);

  const sim = useCartpoleSim(k1, k2, nonlinear);

  const applyPreset = (p: { k1: number; k2: number }) => {
    setK1(p.k1);
    setK2(p.k2);
  };

  const isPreset = (p: { k1: number; k2: number }) => Math.abs(k1 - p.k1) < 1e-9 && Math.abs(k2 - p.k2) < 1e-9;

  return (
    <div className="sigCpWrap">
      <div className="sigCpTop">
        <div className="sigCpCol">
          <CartScene stateRef={sim.stateRef} cameraRef={sim.cameraRef} fell={sim.fell} nonlinear={nonlinear} />
          <div className="sigRow">
            <button
              type="button"
              className={`sigBtn ${!nonlinear ? "sigBtnOn" : ""}`}
              onClick={() => setNonlinear(false)}
            >
              linearized
            </button>
            <button
              type="button"
              className={`sigBtn ${nonlinear ? "sigBtnOn" : ""}`}
              onClick={() => setNonlinear(true)}
            >
              nonlinear (sin/cos)
            </button>
            <button type="button" className="sigBtn" onClick={sim.reset}>
              reset
            </button>
            {sim.fell && <span className="sigCpFellNote">fell — click reset</span>}
          </div>
        </div>

        <div className="sigCpCol">
          <PolePlane k1={k1} k2={k2} />
          <div className="sigRow">
            <button type="button" className={`sigBtn ${isPreset(PRESETS.open) ? "sigBtnOn" : ""}`} onClick={() => applyPreset(PRESETS.open)}>
              open loop
            </button>
            <button type="button" className={`sigBtn ${isPreset(PRESETS.p25) ? "sigBtnOn" : ""}`} onClick={() => applyPreset(PRESETS.p25)}>
              P only, k=25
            </button>
            <button type="button" className={`sigBtn ${isPreset(PRESETS.pd) ? "sigBtnOn" : ""}`} onClick={() => applyPreset(PRESETS.pd)}>
              David&rsquo;s PD preset
            </button>
          </div>
          <div className="sigCpSliders">
            <label>
              k₁
              <input
                type="range"
                min={-40}
                max={10}
                step={0.1}
                value={k1}
                onChange={(e) => setK1(Number(e.target.value))}
              />
              <span className="sigCpSliderVal">{k1.toFixed(1)}</span>
            </label>
            <label>
              k₂
              <input
                type="range"
                min={-16}
                max={4}
                step={0.1}
                value={k2}
                onChange={(e) => setK2(Number(e.target.value))}
              />
              <span className="sigCpSliderVal">{k2.toFixed(1)}</span>
            </label>
          </div>
        </div>
      </div>

      <div className="sigCpCol sigCpChartCol">
        <StripChart historyRef={sim.historyRef} simTimeRef={sim.simTimeRef} gustRef={sim.gustRef} sinceGustRef={sim.sinceGustRef} />
        <div className="sigRow">
          <button type="button" className="sigBtn" disabled={sim.fell} onClick={() => sim.gust("step")}>
            gust
          </button>
          <button type="button" className="sigBtn" disabled={sim.fell} onClick={() => sim.gust("random")}>
            random gust
          </button>
          <button type="button" className="sigBtn" onClick={sim.reset}>
            reset
          </button>
        </div>
      </div>

      <p className="sigNote">
        a(t) = k₁θ + k₂θ̇ feeds the cart&rsquo;s acceleration back from the stick&rsquo;s angle and angular velocity.
        Open loop the poles sit at ±√(g/L) ≈ ±3.13 — one in the right half-plane, so the stick falls. Proportional
        feedback alone (k=25) only pushes the poles onto the imaginary axis: no growth, but no decay either — it
        oscillates forever. Adding derivative feedback (David&rsquo;s preset, k₁=−25.8, k₂=−8) puts a critically
        damped double pole at s=−4, so a gust&rsquo;s impulse response decays as t·e<sup>−4t</sup> with no overshoot.
      </p>
    </div>
  );
}
