"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  FALLEN_DEG,
  GUST_AMPLITUDE,
  GUST_DURATION,
  INITIAL_THETA_DEG,
  RANDOM_GUST_AMPLITUDE,
  RANDOM_GUST_DURATION,
  SIM_DT,
  SIM_SUBSTEPS,
  degToRad,
  makeFullDerivative,
  rk4,
  type State4,
} from "./model";

export interface HistorySample {
  t: number;
  theta: number;
  x: number;
}

export type GustKind = "step" | "random";

export interface GustState {
  kind: GustKind;
  startT: number;
  endT: number;
}

export interface SinceGust {
  t: number[];
  theta: number[];
}

export interface CartpoleSim {
  stateRef: MutableRefObject<State4>;
  cameraRef: MutableRefObject<number>;
  simTimeRef: MutableRefObject<number>;
  historyRef: MutableRefObject<HistorySample[]>;
  gustRef: MutableRefObject<GustState | null>;
  sinceGustRef: MutableRefObject<SinceGust>;
  fell: boolean;
  reset: () => void;
  gust: (kind: GustKind) => void;
}

const HISTORY_WINDOW_S = 8;
const SINCE_GUST_CAP_S = 9;
const CAMERA_MARGIN_M = 1.4;

function initialState(): State4 {
  return [degToRad(INITIAL_THETA_DEG), 0, 0, 0];
}

/** Owns the live simulation state and runs the single fixed-step physics loop. */
export function useCartpoleSim(k1: number, k2: number, nonlinear: boolean): CartpoleSim {
  const k1Ref = useRef(k1);
  k1Ref.current = k1;
  const k2Ref = useRef(k2);
  k2Ref.current = k2;
  const nonlinearRef = useRef(nonlinear);
  nonlinearRef.current = nonlinear;

  const stateRef = useRef<State4>(initialState());
  const cameraRef = useRef(0);
  const simTimeRef = useRef(0);
  const historyRef = useRef<HistorySample[]>([]);
  const gustRef = useRef<GustState | null>(null);
  const sinceGustRef = useRef<SinceGust>({ t: [], theta: [] });
  const fellRef = useRef(false);
  const [fell, setFell] = useState(false);

  const reset = () => {
    stateRef.current = initialState();
    cameraRef.current = 0;
    simTimeRef.current = 0;
    historyRef.current = [];
    gustRef.current = null;
    sinceGustRef.current = { t: [], theta: [] };
    fellRef.current = false;
    setFell(false);
  };

  const gust = (kind: GustKind) => {
    if (fellRef.current) return;
    const t0 = simTimeRef.current;
    gustRef.current = { kind, startT: t0, endT: t0 + (kind === "step" ? GUST_DURATION : RANDOM_GUST_DURATION) };
    sinceGustRef.current = { t: [], theta: [] };
  };

  useEffect(() => {
    let raf = 0;

    const disturbanceAt = (t: number): number => {
      const g = gustRef.current;
      if (!g || t >= g.endT) return 0;
      return g.kind === "step" ? GUST_AMPLITUDE : (Math.random() * 2 - 1) * RANDOM_GUST_AMPLITUDE;
    };

    const loop = () => {
      if (!document.hidden && !fellRef.current) {
        const deriv = makeFullDerivative(k1Ref.current, k2Ref.current, { nonlinear: nonlinearRef.current });
        for (let s = 0; s < SIM_SUBSTEPS; s++) {
          const x = disturbanceAt(simTimeRef.current);
          stateRef.current = rk4(deriv, stateRef.current, x, SIM_DT);
          simTimeRef.current += SIM_DT;
          const g = gustRef.current;
          if (g && simTimeRef.current - g.startT < SINCE_GUST_CAP_S) {
            sinceGustRef.current.t.push(simTimeRef.current - g.startT);
            sinceGustRef.current.theta.push(stateRef.current[0]);
          }
        }

        const theta = stateRef.current[0];
        if (Math.abs(theta) > degToRad(FALLEN_DEG)) {
          const sign = theta < 0 ? -1 : 1;
          stateRef.current = [degToRad(90) * sign, 0, stateRef.current[2], 0];
          fellRef.current = true;
          setFell(true);
        } else {
          const cartX = stateRef.current[2];
          if (cartX - cameraRef.current > CAMERA_MARGIN_M) cameraRef.current = cartX - CAMERA_MARGIN_M;
          else if (cartX - cameraRef.current < -CAMERA_MARGIN_M) cameraRef.current = cartX + CAMERA_MARGIN_M;

          const hist = historyRef.current;
          hist.push({ t: simTimeRef.current, theta, x: disturbanceAt(simTimeRef.current) });
          while (hist.length > 1 && simTimeRef.current - hist[0].t > HISTORY_WINDOW_S) hist.shift();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return { stateRef, cameraRef, simTimeRef, historyRef, gustRef, sinceGustRef, fell, reset, gust };
}
