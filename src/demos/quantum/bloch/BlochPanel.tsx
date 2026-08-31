"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  GATES,
  applyGate as applyGateCore,
  cloneState,
  qubitState,
  rx,
  ry,
  rz,
  type Mat,
  type State,
} from "@/demos/quantum/sim/core";
import { axisAngleFromGate, blochVector, fmtComplex, pauliIdentities, thetaPhiFromState } from "./model";
import BlochScene, { type BlochSceneHandle } from "./BlochScene";
import "./bloch.css";

const SIMPLE_GATES = ["X", "Y", "Z", "H", "S", "T"] as const;
const IDENTITIES = pauliIdentities();

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

function MatrixTable({ m }: { m: Mat }) {
  const rows: React.ReactNode[] = [];
  for (let r = 0; r < m.d; r++) {
    const cols: React.ReactNode[] = [];
    for (let c = 0; c < m.d; c++) {
      const idx = r * m.d + c;
      cols.push(<td key={c}>{fmtComplex(m.re[idx], m.im[idx])}</td>);
    }
    rows.push(<tr key={r}>{cols}</tr>);
  }
  return (
    <table className="qBlMatrix">
      <tbody>{rows}</tbody>
    </table>
  );
}

export default function BlochPanel() {
  const sceneRef = useRef<BlochSceneHandle>(null);

  // state |0> (theta=0, phi=0) by default
  const [theta, setTheta] = useState(0);
  const [phi, setPhi] = useState(0);
  const [liveState, setLiveState] = useState<State>(() => qubitState(0, 0));
  const [lastGate, setLastGate] = useState<{ name: string; mat: Mat }>({ name: "I", mat: GATES.I });
  const [rotAngle, setRotAngle] = useState(Math.PI / 2);

  const [identityIdx, setIdentityIdx] = useState(0);
  const [demonstrated, setDemonstrated] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [lastIdentityIdx, setLastIdentityIdx] = useState<number | null>(null);
  const [verifying, setVerifying] = useState(false);

  const bv = useMemo(() => blochVector(liveState), [liveState]);

  useEffect(() => {
    sceneRef.current?.jumpTo(blochVector(liveState));
    // run once on mount to line the scene up with the initial state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setThetaPhiDirect(nt: number, np: number) {
    setTheta(nt);
    setPhi(np);
    const ns = qubitState(nt, np);
    setLiveState(ns);
    sceneRef.current?.jumpTo(blochVector(ns));
  }

  function runGate(mat: Mat, label: string) {
    const prevVec = blochVector(liveState);
    const clone = cloneState(liveState);
    applyGateCore(clone, mat, [0]);
    const { theta: nt, phi: np } = thetaPhiFromState(clone);
    const { axis, angle } = axisAngleFromGate(mat);
    setLiveState(clone);
    setTheta(nt);
    setPhi(np);
    setLastGate({ name: label, mat });
    sceneRef.current?.animateGate(prevVec, axis, angle);
  }

  async function handleVerify() {
    if (verifying) return;
    setVerifying(true);
    const idx = identityIdx;
    const spec = IDENTITIES[idx];
    runGate(GATES[spec.second], spec.second);
    await sleep(340);
    runGate(GATES[spec.first], spec.first);
    await sleep(340);
    setDemonstrated((d) => {
      const next: [boolean, boolean, boolean] = [...d];
      next[idx] = true;
      return next;
    });
    setLastIdentityIdx(idx);
    setIdentityIdx((idx + 1) % 3);
    setVerifying(false);
  }

  const activeIdentity = lastIdentityIdx !== null ? IDENTITIES[lastIdentityIdx] : null;

  return (
    <div className="qBlLayout">
      <div className="qBlSceneCol">
        <BlochScene ref={sceneRef} />

        <div className="qBlSliderRow">
          <label htmlFor="qBl-theta">theta (θ)</label>
          <input
            id="qBl-theta"
            type="range"
            min={0}
            max={Math.PI}
            step={0.001}
            value={theta}
            onChange={(e) => setThetaPhiDirect(parseFloat(e.target.value), phi)}
          />
          <span className="qBlVal">{theta.toFixed(3)}</span>
        </div>
        <div className="qBlSliderRow">
          <label htmlFor="qBl-phi">phi (φ)</label>
          <input
            id="qBl-phi"
            type="range"
            min={0}
            max={2 * Math.PI}
            step={0.001}
            value={phi}
            onChange={(e) => setThetaPhiDirect(theta, parseFloat(e.target.value))}
          />
          <span className="qBlVal">{phi.toFixed(3)}</span>
        </div>

        <div className="qBlGateRow">
          <div className="qBlGateGroup">
            {SIMPLE_GATES.map((g) => (
              <button key={g} type="button" className="qBtn" onClick={() => runGate(GATES[g], g)}>
                {g}
              </button>
            ))}
          </div>
          <div className="qBlDivider" />
          <div className="qBlGateGroup">
            <button type="button" className="qBtn" onClick={() => runGate(rx(rotAngle), `Rx(${rotAngle.toFixed(2)})`)}>
              Rx
            </button>
            <button type="button" className="qBtn" onClick={() => runGate(ry(rotAngle), `Ry(${rotAngle.toFixed(2)})`)}>
              Ry
            </button>
            <button type="button" className="qBtn" onClick={() => runGate(rz(rotAngle), `Rz(${rotAngle.toFixed(2)})`)}>
              Rz
            </button>
            <input
              type="range"
              min={0}
              max={2 * Math.PI}
              step={0.01}
              value={rotAngle}
              onChange={(e) => setRotAngle(parseFloat(e.target.value))}
              aria-label="Rotation angle for Rx/Ry/Rz"
            />
            <span className="qBlVal">{rotAngle.toFixed(2)}</span>
          </div>
        </div>

        <p className="qNote">
          Drag to orbit the sphere. The θ/φ sliders set the state directly — the arrow jumps there. Gate
          buttons rotate the current state; the axis of rotation and its great circle appear while the arrow slerps.
        </p>
      </div>

      <div className="qBlReadoutCol">
        <div className="qBlBlock">
          <p className="qBlBlockTitle">amplitudes</p>
          <dl className="qBlAmps">
            <dt>α</dt>
            <dd>{fmtComplex(liveState.re[0], liveState.im[0])}</dd>
            <dt>β</dt>
            <dd>{fmtComplex(liveState.re[1], liveState.im[1])}</dd>
          </dl>
        </div>

        <div className="qBlBlock">
          <p className="qBlBlockTitle">bloch vector</p>
          <div className="qBlExpect">
            <span>⟨σx⟩ {bv[0].toFixed(4)}</span>
            <span>⟨σy⟩ {bv[1].toFixed(4)}</span>
            <span>⟨σz⟩ {bv[2].toFixed(4)}</span>
          </div>
        </div>

        <div className="qBlBlock">
          <p className="qBlBlockTitle">last gate — {lastGate.name}</p>
          <MatrixTable m={lastGate.mat} />
        </div>

        <div className="qBlBlock">
          <p className="qBlBlockTitle">verify identities (σxσy = iσz, cyclic)</p>
          <button type="button" className="qBtn" onClick={handleVerify} disabled={verifying}>
            {verifying ? "verifying…" : `Verify ${IDENTITIES[identityIdx].label}`}
          </button>
          <div className="qBlIdentities" style={{ marginTop: 8 }}>
            {IDENTITIES.map((idn, i) => (
              <div key={idn.key} className="qBlIdentityRow">
                <span className={demonstrated[i] ? "qBlOk" : "qBlPending"}>
                  {idn.label} {demonstrated[i] ? "✓" : ""}
                </span>
              </div>
            ))}
          </div>
          {activeIdentity && (
            <div className="qBlVerifyPanel">
              <div className="qBlMatrixWrap">
                <span className="qBlMatrixLabel">
                  {activeIdentity.first}{activeIdentity.second}
                </span>
                <MatrixTable m={activeIdentity.composed} />
              </div>
              <div className="qBlMatrixWrap">
                <span className="qBlMatrixLabel">i·{activeIdentity.target}</span>
                <MatrixTable m={activeIdentity.expected} />
              </div>
              <span className={activeIdentity.ok ? "qBlOk" : "qBlPending"}>
                {activeIdentity.ok ? "equal ✓" : "…"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
