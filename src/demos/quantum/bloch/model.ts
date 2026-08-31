/**
 * Bloch-sphere geometry for the Bloch panel: state <-> (theta, phi) <-> Bloch vector,
 * and the axis/angle decomposition of a single-qubit gate (Ex.8's "every gate is a
 * rotation" fact). Built on top of the shared simulator in `sim/core` - no duplicate
 * state-vector math here.
 */
import { GATES, matMul, pauliExpectation, type Mat, type State } from "@/demos/quantum/sim/core";

export type Vec3 = [number, number, number];

/** <sigma_x>, <sigma_y>, <sigma_z> for a single-qubit state - the point on the sphere. */
export function blochVector(s: State): Vec3 {
  return [pauliExpectation(s, 0, "x"), pauliExpectation(s, 0, "y"), pauliExpectation(s, 0, "z")];
}

/** (x, y, z) from (theta, phi), matching qubit(theta, phi)'s own convention. */
export function sphericalToCartesian(theta: number, phi: number): Vec3 {
  return [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)];
}

/**
 * Recover (theta, phi) directly from the amplitudes of a single-qubit state, up to the
 * global-phase gauge that qubit(theta, phi) itself fixes (alpha real, >= 0). Robust to a
 * state carrying an arbitrary global phase after gate application: the phase of alpha
 * (or of beta, at the south pole where alpha ~ 0) is divided out first.
 *
 * qubitState(theta, phi) fed back in reproduces the same amplitudes (up to that same
 * global phase) - that is the "round trip" this function is tested against.
 */
export function thetaPhiFromState(s: State): { theta: number; phi: number } {
  const aRe = s.re[0];
  const aIm = s.im[0];
  const bRe = s.re[1];
  const bIm = s.im[1];
  const aAbs = Math.hypot(aRe, aIm);
  const bAbs = Math.hypot(bRe, bIm);
  const theta = 2 * Math.atan2(bAbs, aAbs);
  const eps = 1e-9;
  const argRef = aAbs > eps ? Math.atan2(aIm, aRe) : bAbs > eps ? Math.atan2(bIm, bRe) : 0;
  let phi = bAbs > eps ? Math.atan2(bIm, bRe) - argRef : 0;
  const twoPi = 2 * Math.PI;
  phi = ((phi % twoPi) + twoPi) % twoPi;
  return { theta, phi };
}

/** Rodrigues' rotation formula: rotate vector v by `angle` radians about unit axis `axis`. */
export function rotateAroundAxis(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const [x, y, z] = v;
  const [ax, ay, az] = axis;
  const cosT = Math.cos(angle);
  const sinT = Math.sin(angle);
  const dot = ax * x + ay * y + az * z;
  const crossX = ay * z - az * y;
  const crossY = az * x - ax * z;
  const crossZ = ax * y - ay * x;
  return [
    x * cosT + crossX * sinT + ax * dot * (1 - cosT),
    y * cosT + crossY * sinT + ay * dot * (1 - cosT),
    z * cosT + crossZ * sinT + az * dot * (1 - cosT),
  ];
}

/** Points (closed loop) on the unit great circle perpendicular to `axis`, for drawing it. */
export function greatCirclePoints(axis: Vec3, segments = 64): Vec3[] {
  // any vector not parallel to axis, then Gram-Schmidt to get an orthonormal basis (u, v)
  const [ax, ay, az] = axis;
  const seed: Vec3 = Math.abs(az) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const dot = seed[0] * ax + seed[1] * ay + seed[2] * az;
  let u: Vec3 = [seed[0] - dot * ax, seed[1] - dot * ay, seed[2] - dot * az];
  const uLen = Math.hypot(u[0], u[1], u[2]) || 1;
  u = [u[0] / uLen, u[1] / uLen, u[2] / uLen];
  const v: Vec3 = [ay * u[2] - az * u[1], az * u[0] - ax * u[2], ax * u[1] - ay * u[0]];
  const pts: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (2 * Math.PI * i) / segments;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push([u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s]);
  }
  return pts;
}

export interface GateAxisAngle {
  /** unit rotation axis n-hat */
  axis: Vec3;
  /** rotation angle 2*beta, in [0, 2*pi) */
  angle: number;
  /** global phase alpha, where U = e^{i alpha} * Rn(2 beta) */
  alpha: number;
}

/**
 * Decompose a single-qubit unitary U = e^{i alpha} * Rn(2 beta), Rn(theta) = cos(theta/2) I
 * - i sin(theta/2) (n.sigma). alpha = arg(det U)/2 kills the global phase; the remaining
 * W = e^{-i alpha} U is expanded against I, X, Y, Z to read off n and beta directly.
 */
export function axisAngleFromGate(g: Mat): GateAxisAngle {
  if (g.d !== 2) throw new Error("axisAngleFromGate expects a 2x2 gate");
  const re00 = g.re[0];
  const im00 = g.im[0];
  const re01 = g.re[1];
  const im01 = g.im[1];
  const re10 = g.re[2];
  const im10 = g.im[2];
  const re11 = g.re[3];
  const im11 = g.im[3];

  // det(U) = U00*U11 - U01*U10 (complex)
  const detRe = re00 * re11 - im00 * im11 - (re01 * re10 - im01 * im10);
  const detIm = re00 * im11 + im00 * re11 - (re01 * im10 + im01 * re10);
  const alpha = 0.5 * Math.atan2(detIm, detRe);
  const ca = Math.cos(alpha);
  const sa = Math.sin(alpha);
  // W = e^{-i alpha} * U : multiply each entry by (ca - i sa)
  const wRe = (re: number, im: number) => re * ca + im * sa;
  const wIm = (re: number, im: number) => im * ca - re * sa;
  const w00im = wIm(re00, im00);
  const w01re = wRe(re01, im01);
  const w01im = wIm(re01, im01);
  const w10re = wRe(re10, im10);
  const w10im = wIm(re10, im10);
  const w11re = wRe(re11, im11);
  const w11im = wIm(re11, im11);
  const w00re = wRe(re00, im00);

  const cosBeta = (w00re + w11re) / 2;
  const nzSinBeta = (w11im - w00im) / 2;
  const nxSinBeta = (-w01im - w10im) / 2;
  const nySinBeta = (w10re - w01re) / 2;
  const sinBeta = Math.hypot(nxSinBeta, nySinBeta, nzSinBeta);

  let axis: Vec3;
  if (sinBeta < 1e-12) {
    axis = [0, 0, 1];
  } else {
    axis = [nxSinBeta / sinBeta, nySinBeta / sinBeta, nzSinBeta / sinBeta];
  }
  const angle = 2 * Math.atan2(sinBeta, cosBeta);
  return { axis, angle, alpha };
}

// ---------------------------------------------------------------- Pauli identities

function scaleMat(m: Mat, sRe: number, sIm: number): Mat {
  const re = new Float64Array(m.d * m.d);
  const im = new Float64Array(m.d * m.d);
  for (let k = 0; k < m.d * m.d; k++) {
    re[k] = m.re[k] * sRe - m.im[k] * sIm;
    im[k] = m.re[k] * sIm + m.im[k] * sRe;
  }
  return { d: m.d, re, im };
}

export function matsApproxEqual(a: Mat, b: Mat, tol = 1e-12): boolean {
  for (let k = 0; k < a.re.length; k++) {
    if (Math.abs(a.re[k] - b.re[k]) > tol || Math.abs(a.im[k] - b.im[k]) > tol) return false;
  }
  return true;
}

export interface IdentityCheck {
  key: "XY_eq_iZ" | "YZ_eq_iX" | "ZX_eq_iY";
  label: string;
  /** apply second, then first (matrix product first * second) */
  first: "X" | "Y" | "Z";
  second: "X" | "Y" | "Z";
  target: "X" | "Y" | "Z";
  composed: Mat;
  expected: Mat;
  ok: boolean;
}

/** sigma_x sigma_y = i sigma_z, cyclically - the Ex.8 identity, checked by matrix composition. */
export function pauliIdentities(): IdentityCheck[] {
  const specs: { key: IdentityCheck["key"]; label: string; first: "X" | "Y" | "Z"; second: "X" | "Y" | "Z"; target: "X" | "Y" | "Z" }[] = [
    { key: "XY_eq_iZ", label: "XY = iZ", first: "X", second: "Y", target: "Z" },
    { key: "YZ_eq_iX", label: "YZ = iX", first: "Y", second: "Z", target: "X" },
    { key: "ZX_eq_iY", label: "ZX = iY", first: "Z", second: "X", target: "Y" },
  ];
  return specs.map((sp) => {
    const composed = matMul(GATES[sp.first], GATES[sp.second]);
    const expected = scaleMat(GATES[sp.target], 0, 1);
    return { ...sp, composed, expected, ok: matsApproxEqual(composed, expected) };
  });
}

// ---------------------------------------------------------------- misc formatting

export function fmtComplex(re: number, im: number, digits = 4): string {
  const r = re.toFixed(digits);
  const sign = im < 0 ? "-" : "+";
  const i = Math.abs(im).toFixed(digits);
  return `${r} ${sign} ${i}i`;
}
