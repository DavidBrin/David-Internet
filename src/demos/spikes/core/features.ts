/**
 * Intra-spike features — port of spikeparam.patch.features.intra:
 * ramp polynomial, peak width/sharpness, and the bounded exponential-decay
 * fit (fit_exp_nonlinear), plus gen_fit_ramp / gen_fit_exp with r².
 */
import { lmFit } from "./lm";
import { controlPoints, ControlIndices, polyfit1 } from "./points";

export interface RampFeatures {
  polyParams: [number, number];
  rampAmp: number;
  inflectionTime: number;
  inflectionAmp: number;
}

export interface PeakFeatures {
  peakAmp: number;
  peakWidth: number;
  peakSharpness: number;
}

export interface ExpFeatures {
  expAmp: number;
  expLambda: number;
  expConst: number;
}

export function expFunc(t: number, expAmp: number, expLambda: number, expConst: number): number {
  return expAmp * Math.exp(-expLambda * t) + expConst;
}

export function computeRampFeatures(
  spike: ArrayLike<number>,
  fs: number,
  idxRampStart: number,
  idxInflection: number,
  idxPeak: number,
): RampFeatures {
  const len = idxInflection - idxRampStart;
  if (len < 2) throw new Error("ramp too short");
  const times: number[] = [];
  const ramp: number[] = [];
  for (let i = 0; i < len; i++) {
    times.push((i * 1000) / fs);
    ramp.push(spike[idxRampStart + i] as number);
  }
  const [slope, intercept] = polyfit1(times, ramp);
  return {
    polyParams: [slope, intercept],
    rampAmp: slope,
    inflectionTime: (idxPeak - idxInflection) / Math.trunc(fs / 1000),
    inflectionAmp: ramp[len - 1],
  };
}

export function computePeakFeatures(
  spike: ArrayLike<number>,
  fs: number,
  idxRise: number,
  idxPeak: number,
  idxDecay: number,
): PeakFeatures {
  const peakAmp = spike[idxPeak] as number;
  const peakWidth = (idxDecay - idxRise) / Math.trunc(fs / 1000);
  const pad = Math.trunc(fs / 1000 / 10);
  const peakSharpness =
    ((spike[idxPeak] as number) - (spike[idxPeak - pad] as number) +
      ((spike[idxPeak] as number) - (spike[idxPeak + pad] as number))) / 2;
  return { peakAmp, peakWidth, peakSharpness };
}

export function computeDecayFeatures(
  spike: ArrayLike<number>,
  fs: number,
  idxExpStart: number,
  idxExpEnd: number,
): ExpFeatures {
  const len = idxExpEnd - idxExpStart;
  if (len < 3) throw new Error("exp window too short");
  const times = new Float64Array(len);
  const y = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    times[i] = (i * 1000) / fs;
    y[i] = spike[idxExpStart + i] as number;
  }
  const p = lmFit(
    (params, out) => {
      for (let i = 0; i < len; i++) out[i] = expFunc(times[i], params[0], params[1], params[2]);
    },
    y,
    [50, 1, -60],
    { lower: [0, 0, -100], upper: [1000, 10, 50], maxIter: 400 },
  );
  return { expAmp: p[0], expLambda: p[1], expConst: p[2] };
}

function r2(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i] as number; mb += b[i] as number; }
  ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) {
    const da = (a[i] as number) - ma;
    const db = (b[i] as number) - mb;
    sab += da * db; saa += da * da; sbb += db * db;
  }
  const r = sab / Math.sqrt(saa * sbb);
  return r * r;
}

export function genFitRamp(
  spike: ArrayLike<number>,
  fs: number,
  idx: ControlIndices,
  poly: [number, number],
): { fit: Float64Array; r2: number } {
  const len = idx.inflection - idx.rampStart;
  const fit = new Float64Array(len);
  const seg = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = (i * 1000) / fs;
    fit[i] = poly[0] * t + poly[1];
    seg[i] = spike[idx.rampStart + i] as number;
  }
  return { fit, r2: r2(seg, fit) };
}

export function genFitExp(
  spike: ArrayLike<number>,
  fs: number,
  idx: ControlIndices,
  exp: ExpFeatures,
): { fit: Float64Array; r2: number } {
  const len = idx.expEnd - idx.expStart;
  const fit = new Float64Array(len);
  const seg = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = (i * 1000) / fs;
    fit[i] = expFunc(t, exp.expAmp, exp.expLambda, exp.expConst);
    seg[i] = spike[idx.expStart + i] as number;
  }
  return { fit, r2: r2(seg, fit) };
}

export interface SpikeFeatures {
  indices: ControlIndices;
  ramp: RampFeatures;
  peak: PeakFeatures;
  exp: ExpFeatures;
  r2Ramp: number;
  r2Exp: number;
  dSmoothed: Float64Array;
}

/** compute_features + gen_fit for one windowed spike. Throws on degenerate fits. */
export function computeFeatures(
  spike: ArrayLike<number>,
  fs: number,
  opts: { peakInd?: number; smoothFrac?: number } = {},
): SpikeFeatures {
  const { indices, dSmoothed } = controlPoints(spike, fs, {
    peakInd: opts.peakInd,
    smoothFrac: opts.smoothFrac ?? 0.008,
  });
  for (const v of Object.values(indices)) {
    if (!Number.isFinite(v) || v < 0) throw new Error("negative control point");
  }
  const ramp = computeRampFeatures(spike, fs, indices.rampStart, indices.inflection, indices.peak);
  const peak = computePeakFeatures(spike, fs, indices.rise, indices.peak, indices.decay);
  const exp = computeDecayFeatures(spike, fs, indices.expStart, indices.expEnd);
  const gr = genFitRamp(spike, fs, indices, ramp.polyParams);
  const ge = genFitExp(spike, fs, indices, exp);
  return { indices, ramp, peak, exp, r2Ramp: gr.r2, r2Exp: ge.r2, dSmoothed };
}
