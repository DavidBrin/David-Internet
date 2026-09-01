/**
 * Chapter 3 windowed-analysis cache — mirrors ds_power_windows / fooof_on_windows:
 * a longer per-well signal (655 s) sliced into `inc`-second windows, each Welch +
 * FOOOF'd on demand. Single-window fits are cheap (nperseg stays fs*2) so these
 * compute synchronously; only the signal itself and each window's fit are cached.
 */
import { synthLfp, wellParams, hashSeed } from "../core/synth";
import { welch } from "../core/welch";
import { fitSpecparam, PROJECT_SETTINGS, type SpecparamResult } from "../core/specparam";
import { PLATE_D } from "../core/plate";

const WIN_SAMPLES = 65536; // 655.36s at fs=100
const FS = 100;

const sigCache = new Map<string, Float64Array>();

export function getWindowSignal(day: number, r: number, c: number): Float64Array {
  const k = `${day}:${r}:${c}`;
  let sig = sigCache.get(k);
  if (!sig) {
    const params = wellParams(PLATE_D, day, r, c);
    sig = synthLfp(params, hashSeed("ch3win", day, r, c), WIN_SAMPLES, FS);
    sigCache.set(k, sig);
  }
  return sig;
}

const fitCache = new Map<string, SpecparamResult>();

export function getWindowFit(day: number, r: number, c: number, w: number, inc: number): SpecparamResult {
  const k = `${day}:${r}:${c}:${w}:${inc}`;
  let fit = fitCache.get(k);
  if (!fit) {
    const sig = getWindowSignal(day, r, c);
    const start = w * inc * FS;
    const end = Math.min(sig.length, (w + 1) * inc * FS);
    const slice = sig.subarray(start, end);
    const { freqs, psd } = welch(slice, FS);
    fit = fitSpecparam(freqs, psd, [2, 50], { ...PROJECT_SETTINGS, aperiodicMode: "fixed" });
    fitCache.set(k, fit);
  }
  return fit;
}

export const WINDOW_AXIS_SECONDS = 600;
export const WINDOW_SIGNAL_SAMPLES = WIN_SAMPLES;
export const WINDOW_FS = FS;
