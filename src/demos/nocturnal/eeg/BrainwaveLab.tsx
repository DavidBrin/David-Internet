"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadEeg, isBadContact, formatImpedance, type EegData } from "./data";
import { lowpassDecimate, notch60 } from "./filters";
import { welch, coherence, bandPeaks } from "./coherence";
import HeadMap from "./HeadMap";
import Viewer from "./Viewer";
import { PsdInset, CoherencePanel } from "./SpectrumPanel";
import "./eeg.css";

const WINDOW_S = 10;
const COLOR_A = "#6366F1";
const COLOR_B = "#e8710a";
const GAINS = [0.25, 0.35, 0.5, 0.7, 1, 1.4, 2, 2.8, 4, 5.6, 8];

interface Toggles {
  ds: boolean;
  notch: boolean;
  car: boolean;
}

interface Pipe {
  fs: number;
  channels: Float32Array[];
}

/** Run the notebook pipeline over the whole recording once per toggle set (memoised below). */
function runPipeline(data: EegData, t: Toggles): Pipe {
  let fs = data.fs;
  let chans: Float32Array[] = data.channels;
  if (t.ds) {
    chans = chans.map((c) => Float32Array.from(lowpassDecimate(c, fs, 2)));
    fs = fs / 2;
  }
  if (t.notch) {
    chans = chans.map((c) => Float32Array.from(notch60(c, fs)));
  }
  if (t.car) {
    // reference = mean of the good-contact channels only (a 40 MΩ electrode would smear its
    // noise into every trace); subtracted from all 20 so the bad ones move too
    const good = data.header.channels.map((c, i) => (isBadContact(c) ? -1 : i)).filter((i) => i >= 0);
    const n = chans[0].length;
    const mean = new Float32Array(n);
    for (const gi of good) {
      const c = chans[gi];
      for (let k = 0; k < n; k++) mean[k] += c[k];
    }
    const inv = 1 / good.length;
    for (let k = 0; k < n; k++) mean[k] *= inv;
    chans = chans.map((c) => {
      const out = new Float32Array(n);
      for (let k = 0; k < n; k++) out[k] = c[k] - mean[k];
      return out;
    });
  }
  return { fs, channels: chans };
}

export default function BrainwaveLab() {
  const [data, setData] = useState<EegData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string[]>(["Fp2", "O1"]);
  const [toggles, setToggles] = useState<Toggles>({ ds: false, notch: false, car: false });
  const [playing, setPlaying] = useState(true);
  const [gainIdx, setGainIdx] = useState(4); // GAINS[4] = 1 → ±50 µV per row
  const [autoscale, setAutoscale] = useState(false);
  const [t0, setT0] = useState(WINDOW_S);
  const [scrubNonce, setScrubNonce] = useState(0);
  const t0Ref = useRef(WINDOW_S);

  useEffect(() => {
    let alive = true;
    loadEeg().then(
      (d) => alive && setData(d),
      (e: unknown) => alive && setError(String(e)),
    );
    return () => {
      alive = false;
    };
  }, []);

  const pipe = useMemo(() => (data ? runPipeline(data, toggles) : null), [data, toggles]);

  const maxStart = data ? Math.max(0, data.header.durationS - WINDOW_S) : 0;
  const bad = useMemo(() => (data ? data.header.channels.map(isBadContact) : []), [data]);
  const badNames = data ? data.header.channels.filter(isBadContact).map((c) => `${c.name} (${formatImpedance(c.impedanceKohm)})`) : [];

  const chanA = sel[0];
  const chanB = sel[1];
  const idxA = data && chanA ? data.names.indexOf(chanA) : -1;
  const idxB = data && chanB ? data.names.indexOf(chanB) : -1;

  // PSD inset: channel A over the whole recording, raw vs pipeline output
  const psdBefore = useMemo(() => {
    if (!data || idxA < 0) return null;
    return welch(data.channels[idxA], data.fs, 512);
  }, [data, idxA]);
  const psdAfter = useMemo(() => {
    if (!pipe || idxA < 0) return null;
    return welch(pipe.channels[idxA], pipe.fs, pipe.fs === 250 ? 512 : 256);
  }, [pipe, idxA]);

  // coherence over the current 10 s window, recomputed as the playhead moves (quantised to 0.25 s)
  const t0q = Math.round(t0 * 4) / 4;
  const coh = useMemo(() => {
    if (!pipe || idxA < 0 || idxB < 0) return null;
    const n = WINDOW_S * pipe.fs;
    const i0 = Math.max(0, Math.min(Math.round(t0q * pipe.fs), pipe.channels[0].length - n));
    const x = pipe.channels[idxA].subarray(i0, i0 + n);
    const y = pipe.channels[idxB].subarray(i0, i0 + n);
    return coherence(x, y, pipe.fs, pipe.fs === 250 ? 256 : 128);
  }, [pipe, idxA, idxB, t0q]);

  // restart the coherence draw-in on a pair change or a scrub jump (> 2 s at once)
  const drawKeyRef = useRef({ key: 0, pair: `${chanA}|${chanB}`, t0q });
  {
    const st = drawKeyRef.current;
    const pair = `${chanA}|${chanB}`;
    if (st.pair !== pair || Math.abs(t0q - st.t0q) > 2) st.key++;
    st.pair = pair;
    st.t0q = t0q;
  }

  const cohSummary = useMemo(() => {
    if (!coh) return null;
    const peaks = bandPeaks(coh.f, coh.cxy).filter((p) => p.peak);
    if (!peaks.length) return null;
    const best = peaks.reduce((a, b) => (b.peak!.value > a.peak!.value ? b : a));
    return { label: best.label, value: best.peak!.value, f: best.peak!.f };
  }, [coh]);

  if (error) {
    return <p className="demoNote">Couldn&rsquo;t load the recording ({error}) — run <code>pnpm sync-demos nocturnal</code>.</p>;
  }
  if (!data || !pipe) {
    return <p className="demoNote">Loading the recording (627 KB of int16 samples)…</p>;
  }

  const uvPerHalfRow = 50 / GAINS[gainIdx];
  const setT0Both = (v: number) => {
    t0Ref.current = v;
    setT0(v);
    setScrubNonce((n) => n + 1);
  };

  return (
    <div>
      <div className="nnE-grid">
        <div className="nnE-left">
          <div className="nnCard nnE-card">
            <h4>Head map (10-20)</h4>
            <HeadMap channels={data.header.channels} selected={sel} colors={[COLOR_A, COLOR_B]} onSelect={setSel} />
          </div>
          <div className="nnCard nnE-card">
            <h4>Pipeline (the notebook, in TypeScript)</h4>
            <div className="nnE-pipeline">
              <label title="The notebook's 'Signal Filtering' cell, completed: FIR lowpass at 62.5 Hz (Hamming, 0.2 s), then keep every 2nd sample. Viewer and spectra then run at 125 Hz.">
                <input type="checkbox" checked={toggles.ds} onChange={(e) => setToggles({ ...toggles, ds: e.target.checked })} />
                <span>
                  <span className="nnE-step">①</span> Lowpass + downsample → 125 Hz
                  <small>firwin 62.5 Hz, 0.2 s · decimate ×2</small>
                </span>
              </label>
              <label title="FIR bandstop 58–62 Hz (Hamming, 0.5 s). A2 is ~90% mains power — watch its trace and the PSD's 60 Hz line.">
                <input type="checkbox" checked={toggles.notch} onChange={(e) => setToggles({ ...toggles, notch: e.target.checked })} />
                <span>
                  <span className="nnE-step">②</span> Notch 60 Hz
                  <small>firwin bandstop 58–62 Hz, 0.5 s</small>
                </span>
              </label>
              <label title="Subtract the per-sample mean of the 16 good-contact channels from every trace. Cz, T3, C4 and A2 are excluded from the average — their electrodes read tens of MΩ, so they would pollute the reference.">
                <input type="checkbox" checked={toggles.car} onChange={(e) => setToggles({ ...toggles, car: e.target.checked })} />
                <span>
                  <span className="nnE-step">③</span> Common-average reference
                  <small>mean of the 16 good channels</small>
                </span>
              </label>
            </div>
          </div>
          {psdBefore && psdAfter ? (
            <div className="nnCard nnE-card">
              <h4>
                PSD {chanA ?? "—"} · before → after
              </h4>
              <PsdInset channel={chanA ?? ""} before={psdBefore} after={psdAfter} fMax={pipe.fs / 2} />
            </div>
          ) : null}
        </div>

        <div>
          <div className="demoControls nnE-viewerBar">
            <button type="button" className="demoBtn isPrimary" onClick={() => setPlaying((p) => !p)}>
              {playing ? "⏸ pause" : "▶ play"}
            </button>
            <label>
              scrub
              <input
                type="range"
                min={0}
                max={Math.floor(maxStart * 10) / 10}
                step={0.1}
                value={Math.min(t0, maxStart)}
                onChange={(e) => setT0Both(Number(e.target.value))}
              />
            </label>
            <span className="nnE-time demoMono">
              {t0.toFixed(1)}–{(t0 + WINDOW_S).toFixed(1)} s
            </span>
            <span className="nnE-gain">
              gain
              <button type="button" className="demoBtn" onClick={() => setGainIdx((i) => Math.max(0, i - 1))} aria-label="less gain">
                −
              </button>
              <button type="button" className="demoBtn" onClick={() => setGainIdx((i) => Math.min(GAINS.length - 1, i + 1))} aria-label="more gain">
                +
              </button>
              <span>±{uvPerHalfRow.toFixed(0)} µV / row</span>
            </span>
            <label title="Scale each channel by its own variance. Off by default so a bad electrode looks bad.">
              <input type="checkbox" checked={autoscale} onChange={(e) => setAutoscale(e.target.checked)} /> autoscale
            </label>
          </div>
          <Viewer
            fs={pipe.fs}
            channels={pipe.channels}
            names={data.names}
            bad={bad}
            selected={sel}
            colors={[COLOR_A, COLOR_B]}
            playing={playing}
            uvPerHalfRow={uvPerHalfRow}
            autoscale={autoscale}
            windowS={WINDOW_S}
            t0Ref={t0Ref}
            maxStart={maxStart}
            scrubNonce={scrubNonce}
            onTick={setT0}
          />
        </div>
      </div>

      {coh && chanA && chanB ? (
        <div>
          <div className="nnE-cohHead">
            <h3>
              Coherence {chanA} ↔ {chanB}
            </h3>
            <span>
              10 s window from {t0q.toFixed(1)} s · Welch, nperseg {pipe.fs === 250 ? 256 : 128} at {pipe.fs} Hz
            </span>
          </div>
          <CoherencePanel a={chanA} b={chanB} f={coh.f} cxy={coh.cxy} drawKey={drawKeyRef.current.key} />
          {cohSummary ? (
            <p className="nnE-cohSummary">
              Max coherence <b>{cohSummary.value.toFixed(2)}</b> in <b>{cohSummary.label}</b> ({cohSummary.f.toFixed(1)} Hz) for this
              window{cohSummary.label === "α" ? " — the posterior alpha rhythm showing up front-to-back" : ""}.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="nnE-empty">Select two electrodes on the head map to see their coherence spectrum.</div>
      )}

      <p className="demoNote">
        Recording: HELLOworld, 2024-12-06, Cognionics headset, 20 EEG channels at 500 Hz, ~63 s; shipped at 250 Hz as int16 with
        per-channel scale (627 KB). Everything above is computed in the browser from that file.
      </p>
      <p className="demoNote">
        Per the header&rsquo;s impedance table, {badNames.join(", ")} had poor electrode contact (normal is ~50–200 kΩ) — they are drawn
        hollow on the head map, and excluded from the common-average reference.
      </p>

      <p className="nnE-codeTitle">Cognionics → EDF (from the notebook, not run here)</p>
      <pre className="demoMono nnE-code">{`raw = np.fromfile(input_file, dtype=np.float32)
eeg = raw.reshape(n_channels, n_samples)
with pyedflib.EdfWriter(output_file, n_channels, file_type=pyedflib.FILETYPE_EDFPLUS) as edf:
    edf.setSignalHeaders(channel_info)
    edf.writeSamples(eeg)`}</pre>
      <p className="demoNote">
        The notebook&rsquo;s reshape assumes channel-major data, but the Cognionics export is sample-major (multiplexed) — which is why
        this page reads the BrainVision header instead of guessing the layout.
      </p>
    </div>
  );
}
