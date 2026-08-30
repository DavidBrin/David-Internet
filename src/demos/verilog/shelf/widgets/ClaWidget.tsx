"use client";

import { useState } from "react";
import { usePlayback, useTicker } from "../hooks";
import { cla, lookaheadTerm } from "../models/cla";
import { Bit, BitRow, PlayControls, hex } from "../ui";

const N = 8;

function CarryRow({
  label,
  carries,
  depth,
  t,
  onPick,
}: {
  label: string;
  carries: number[];
  depth: number[];
  t: number;
  onPick?: (i: number) => void;
}) {
  return (
    <div className="shelfClaRow">
      <span className="shelfClaLabel">{label}</span>
      <span className="shelfBitRow">
        {Array.from({ length: N + 1 }, (_, k) => N - k).map((i) => {
          const ready = depth[i] <= t;
          return (
            <span key={i} className={`shelfClaCarry ${ready ? "isReady" : ""}`}>
              {ready ? (
                <Bit value={carries[i]} label={`c${i}`} size="sm" onClick={onPick ? () => onPick(i) : undefined} />
              ) : (
                <span className="shelfBit isSm isPending">
                  <span className="shelfBitVal">·</span>
                  <span className="shelfBitLabel">c{i}</span>
                </span>
              )}
            </span>
          );
        })}
      </span>
    </div>
  );
}

export default function ClaWidget() {
  const [a, setA] = useState(0b10110110);
  const [b, setB] = useState(0b01011011);
  const [cin, setCin] = useState(1);
  const [t, setT] = useState(N + 1);
  const [pick, setPick] = useState(3);
  const pb = usePlayback(false);
  const r = cla(a, b, cin, N);

  useTicker(pb.running, 3, (k) =>
    setT((v) => {
      const nv = Math.min(N + 1, v + k);
      if (nv >= N + 1) pb.setRunning(false);
      return nv;
    }),
  );

  const race = () => {
    setT(0);
    pb.setRunning(true);
  };
  const sumReady = (depth: number[]) => depth.slice(0, N).every((d) => d + 1 <= t);

  return (
    <div className="shelfWidget">
      <div className="shelfClaRow">
        <span className="shelfClaLabel">A</span>
        <BitRow value={a} width={N} labels onToggle={(i) => setA((v) => v ^ (1 << i))} />
        <span className="demoMono shelfState">{hex(a, 8)}</span>
      </div>
      <div className="shelfClaRow">
        <span className="shelfClaLabel">B</span>
        <BitRow value={b} width={N} labels onToggle={(i) => setB((v) => v ^ (1 << i))} />
        <span className="demoMono shelfState">{hex(b, 8)}</span>
      </div>
      <div className="shelfClaRow">
        <span className="shelfClaLabel">cin</span>
        <Bit value={cin} onClick={() => setCin((c) => c ^ 1)} />
      </div>
      <div className="shelfClaRow">
        <span className="shelfClaLabel">G = A·B</span>
        <span className="shelfBitRow">
          {r.g
            .map((g, i) => <Bit key={i} value={g} label={`g${i}`} size="sm" />)
            .reverse()}
        </span>
      </div>
      <div className="shelfClaRow">
        <span className="shelfClaLabel">P = A+B</span>
        <span className="shelfBitRow">
          {r.p
            .map((p, i) => <Bit key={i} value={p} label={`p${i}`} size="sm" />)
            .reverse()}
        </span>
      </div>

      <div className="shelfRace">
        <div className="shelfRaceHead">
          <span className="shelfSub">gate delay t = {Math.min(t, N + 1)}</span>
          <button type="button" className="demoBtn isPrimary" onClick={race}>
            Race
          </button>
        </div>
        <div className="shelfRaceLane">
          <div className="shelfSub">lookahead: c[i] = G[i-1] + P[i-1]·G[i-2] + … (two levels)</div>
          <CarryRow label="carries" carries={r.carry} depth={r.depthLookahead} t={t} onPick={setPick} />
          <div className="shelfClaRow">
            <span className="shelfClaLabel">sum</span>
            {sumReady(r.depthLookahead) ? (
              <BitRow value={r.result} width={N + 1} labels prefix="s" size="sm" />
            ) : (
              <span className="demoNote">settling…</span>
            )}
            {sumReady(r.depthLookahead) && <span className="shelfVerdict isGood">settled at t = 3</span>}
          </div>
        </div>
        <div className="shelfRaceLane">
          <div className="shelfSub">ripple: c[i+1] = G[i] + P[i]·c[i], one gate after the previous carry</div>
          <CarryRow label="carries" carries={r.carry} depth={r.depthRipple} t={t} onPick={setPick} />
          <div className="shelfClaRow">
            <span className="shelfClaLabel">sum</span>
            {sumReady(r.depthRipple) ? (
              <BitRow value={r.result} width={N + 1} labels prefix="s" size="sm" />
            ) : (
              <span className="demoNote">settling… (c{Math.max(0, Math.min(N, t))} just arrived)</span>
            )}
            {sumReady(r.depthRipple) && <span className="shelfVerdict isWarn">settled at t = {N + 1}</span>}
          </div>
        </div>
      </div>
      <PlayControls
        running={pb.running}
        onToggle={pb.toggle}
        onStep={() => setT((v) => Math.min(N + 1, v + 1))}
        onReset={() => setT(0)}
        reduced={pb.reduced}
      />
      <p className="demoNote demoMono">
        c{pick} = {lookaheadTerm(pick)} · result {hex(r.result, 9)} = {a} + {b} + {cin} = {r.result}
      </p>
      <p className="demoNote">
        The RTL writes each carry in G/P form; a synthesizer flattens that chain into the sum-of-products above so every
        carry is two gate levels deep. Click a carry to see its expansion.
      </p>
    </div>
  );
}
