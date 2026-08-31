/**
 * Lab 5 — stick balancing (Buck §11.1). Pure math only: no DOM, no React.
 *
 * Stick: massless rod, point mass at the tip, length L, hinged on a cart.
 * Cart acceleration a(t) is the control input; x(t) is an angular-acceleration
 * disturbance (wind gust).
 *
 *   Nonlinear:   L*theta'' = g*sin(theta) - a*cos(theta) + L*x
 *   Linearized:  L*theta'' = g*theta - a + L*x
 *
 * Open loop (a=0): H(s) = 1/(s^2 - g/L), poles at +-sqrt(g/L) - unstable.
 *
 * PD feedback uses gains k1, k2. The lab writes the control law as
 * a(t) = k1*theta + k2*theta', but literally substituting that into the
 * physics equations above does not reproduce the lab's own closed-loop
 * transfer function H(s) = 1/(s^2 - k2*s - (g + L*k1)/L) (nor the SciPy
 * fixture derived from it). Substituting a = -L*(k1*theta + k2*theta')
 * does reproduce both exactly — that's the sign actually implemented here.
 * With g=9.8, L=1, k1=-25.8, k2=-8 this gives a critically damped double
 * pole at s=-4, i.e. theta(t) = t*e^(-4t) for the impulse response.
 */

export const G = 9.8;
export const DEFAULT_L = 1;

/** [theta, theta_dot] */
export type State2 = readonly [theta: number, thetaDot: number];
/** [theta, theta_dot, cartX, cartV] */
export type State4 = readonly [theta: number, thetaDot: number, cartX: number, cartV: number];

export interface Pole {
  re: number;
  im: number;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Cart acceleration under PD feedback, in the sign convention that makes the
 * closed-loop characteristic equation s^2 - k2*s - (g + L*k1)/L = 0 (see file
 * header). This is also literally the cart's acceleration, used to drive the
 * cart's own position in the animation.
 */
export function controlA(theta: number, thetaDot: number, k1: number, k2: number, L: number = DEFAULT_L): number {
  return -L * (k1 * theta + k2 * thetaDot);
}

/**
 * Closed-loop poles: roots of s^2 - k2*s - (g + L*k1)/L = 0. Real roots when
 * the discriminant is >= 0, otherwise a complex-conjugate pair.
 */
export function closedLoopPoles(k1: number, k2: number, g: number = G, L: number = DEFAULT_L): [Pole, Pole] {
  const c = (g + L * k1) / L; // s^2 - k2*s - c = 0
  const D = k2 * k2 + 4 * c;
  if (D >= 0) {
    const sq = Math.sqrt(D);
    return [
      { re: (k2 + sq) / 2, im: 0 },
      { re: (k2 - sq) / 2, im: 0 },
    ];
  }
  const sq = Math.sqrt(-D);
  return [
    { re: k2 / 2, im: sq / 2 },
    { re: k2 / 2, im: -sq / 2 },
  ];
}

export interface DerivOpts {
  nonlinear?: boolean;
  g?: number;
  L?: number;
}

export type Deriv2 = (state: State2, x: number) => State2;

/** Builds the [theta, theta_dot] derivative function for given PD gains. */
export function makeDerivative(k1: number, k2: number, opts: DerivOpts = {}): Deriv2 {
  const g = opts.g ?? G;
  const L = opts.L ?? DEFAULT_L;
  const nonlinear = opts.nonlinear ?? false;
  return (state, x) => {
    const [theta, thetaDot] = state;
    const a = controlA(theta, thetaDot, k1, k2, L);
    const thetaDotDot = nonlinear
      ? (g * Math.sin(theta) - a * Math.cos(theta) + L * x) / L
      : (g * theta - a + L * x) / L;
    return [thetaDot, thetaDotDot];
  };
}

export type Deriv4 = (state: State4, x: number) => State4;

/** Builds the [theta, theta_dot, cartX, cartV] derivative function — the animation's full state. */
export function makeFullDerivative(k1: number, k2: number, opts: DerivOpts = {}): Deriv4 {
  const L = opts.L ?? DEFAULT_L;
  const thetaDeriv = makeDerivative(k1, k2, opts);
  return (state, x) => {
    const [theta, thetaDot, , cartV] = state;
    const [dTheta, dThetaDot] = thetaDeriv([theta, thetaDot], x);
    const a = controlA(theta, thetaDot, k1, k2, L);
    return [dTheta, dThetaDot, cartV, a];
  };
}

/**
 * Classic (4th-order, fixed-step) Runge-Kutta, generic over any fixed-length
 * numeric state tuple. Matches the scheme used to generate the SciPy fixture.
 */
export function rk4<S extends readonly number[]>(deriv: (state: S, x: number) => S, state: S, x: number, dt: number): S {
  const add = (base: S, k: S, scale: number): S => base.map((v, i) => v + scale * k[i]) as unknown as S;
  const k1 = deriv(state, x);
  const k2 = deriv(add(state, k1, dt / 2), x);
  const k3 = deriv(add(state, k2, dt / 2), x);
  const k4 = deriv(add(state, k3, dt), x);
  return state.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) as unknown as S;
}

/** Fallen threshold used by the animation, in degrees. */
export const FALLEN_DEG = 80;

/** Initial perturbation so the open-loop system visibly falls on load. */
export const INITIAL_THETA_DEG = 2;

/** Fixed integration step (240 Hz), 4 substeps per 60 fps animation frame. */
export const SIM_DT = 1 / 240;
export const SIM_SUBSTEPS = 4;

/** The lab's gust disturbance: x(t) = 1 for 0.5 s. */
export const GUST_AMPLITUDE = 1;
export const GUST_DURATION = 0.5;
/** A "random gust": 0.5 s of white noise at this amplitude. */
export const RANDOM_GUST_AMPLITUDE = 2;
export const RANDOM_GUST_DURATION = 0.5;

/** Peak |theta| in degrees over a slice of samples (radians in, degrees out). */
export function peakAbsDeg(thetaRad: readonly number[]): number {
  let m = 0;
  for (const v of thetaRad) m = Math.max(m, Math.abs(v));
  return radToDeg(m);
}

/**
 * First time (from the sample list, seconds) after which |theta| never again
 * exceeds thresholdDeg. Returns null if it never settles within the samples.
 */
export function settlingTimeS(times: readonly number[], thetaRad: readonly number[], thresholdDeg = 0.5): number | null {
  const thresholdRad = degToRad(thresholdDeg);
  for (let i = 0; i < times.length; i++) {
    let ok = true;
    for (let j = i; j < thetaRad.length; j++) {
      if (Math.abs(thetaRad[j]) > thresholdRad) {
        ok = false;
        break;
      }
    }
    if (ok) return times[i];
  }
  return null;
}
