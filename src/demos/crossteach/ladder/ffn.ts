/**
 * Tiny 2-8-8-1 feed-forward net (tanh hidden, sigmoid out), trained by plain
 * full-batch gradient descent -- no libraries. Ported by hand from the shape
 * of David's 3.3 "FFN Half Moon" notebook solution for the ladder's one live
 * training card. Forward/backward are written out with loops (not matrices)
 * so the whole thing stays readable.
 */

const H1 = 8;
const H2 = 8;

export interface Net {
  W1: number[][]; // 2 x H1
  b1: number[]; // H1
  W2: number[][]; // H1 x H2
  b2: number[]; // H2
  W3: number[][]; // H2 x 1
  b3: number[]; // 1
}

function randRange(scale: number): number {
  return (Math.random() * 2 - 1) * scale;
}

export function createNet(): Net {
  const s1 = Math.sqrt(1 / 2);
  const s2 = Math.sqrt(1 / H1);
  const s3 = Math.sqrt(1 / H2);
  return {
    W1: Array.from({ length: 2 }, () => Array.from({ length: H1 }, () => randRange(s1))),
    b1: new Array(H1).fill(0),
    W2: Array.from({ length: H1 }, () => Array.from({ length: H2 }, () => randRange(s2))),
    b2: new Array(H2).fill(0),
    W3: Array.from({ length: H2 }, () => [randRange(s3)]),
    b3: [0],
  };
}

function tanh(x: number): number {
  return Math.tanh(x);
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

interface ForwardCache {
  h1: number[];
  h2: number[];
  out: number;
}

function forwardCache(net: Net, x: number[]): ForwardCache {
  const h1 = new Array<number>(H1);
  for (let j = 0; j < H1; j++) {
    let s = net.b1[j];
    for (let i = 0; i < 2; i++) s += x[i] * net.W1[i][j];
    h1[j] = tanh(s);
  }
  const h2 = new Array<number>(H2);
  for (let k = 0; k < H2; k++) {
    let s = net.b2[k];
    for (let j = 0; j < H1; j++) s += h1[j] * net.W2[j][k];
    h2[k] = tanh(s);
  }
  let s3 = net.b3[0];
  for (let k = 0; k < H2; k++) s3 += h2[k] * net.W3[k][0];
  return { h1, h2, out: sigmoid(s3) };
}

export function predict(net: Net, x: number[]): number {
  return forwardCache(net, x).out;
}

/**
 * One full-batch gradient-descent step over (X, Y). Mutates `net` in place
 * and returns the mean binary cross-entropy loss before the update.
 */
export function trainStep(net: Net, X: number[][], Y: number[], lr: number): number {
  const n = X.length;
  const gW1 = net.W1.map((row) => row.map(() => 0));
  const gb1 = net.b1.map(() => 0);
  const gW2 = net.W2.map((row) => row.map(() => 0));
  const gb2 = net.b2.map(() => 0);
  const gW3 = net.W3.map((row) => row.map(() => 0));
  const gb3 = [0];
  let lossSum = 0;
  const eps = 1e-7;

  for (let n_i = 0; n_i < n; n_i++) {
    const x = X[n_i];
    const y = Y[n_i];
    const { h1, h2, out } = forwardCache(net, x);
    lossSum += -(y * Math.log(out + eps) + (1 - y) * Math.log(1 - out + eps));

    // sigmoid + BCE combine to a clean gradient at the pre-activation.
    const dOutPre = out - y;
    for (let k = 0; k < H2; k++) gW3[k][0] += h2[k] * dOutPre;
    gb3[0] += dOutPre;

    const dH2pre = new Array<number>(H2);
    for (let k = 0; k < H2; k++) {
      const dH2 = dOutPre * net.W3[k][0];
      dH2pre[k] = dH2 * (1 - h2[k] * h2[k]);
    }

    for (let j = 0; j < H1; j++) {
      for (let k = 0; k < H2; k++) gW2[j][k] += h1[j] * dH2pre[k];
    }
    for (let k = 0; k < H2; k++) gb2[k] += dH2pre[k];

    const dH1pre = new Array<number>(H1);
    for (let j = 0; j < H1; j++) {
      let s = 0;
      for (let k = 0; k < H2; k++) s += dH2pre[k] * net.W2[j][k];
      dH1pre[j] = s * (1 - h1[j] * h1[j]);
    }

    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < H1; j++) gW1[i][j] += x[i] * dH1pre[j];
    }
    for (let j = 0; j < H1; j++) gb1[j] += dH1pre[j];
  }

  const scale = lr / n;
  for (let i = 0; i < 2; i++) for (let j = 0; j < H1; j++) net.W1[i][j] -= scale * gW1[i][j];
  for (let j = 0; j < H1; j++) net.b1[j] -= scale * gb1[j];
  for (let j = 0; j < H1; j++) for (let k = 0; k < H2; k++) net.W2[j][k] -= scale * gW2[j][k];
  for (let k = 0; k < H2; k++) net.b2[k] -= scale * gb2[k];
  for (let k = 0; k < H2; k++) net.W3[k][0] -= scale * gW3[k][0];
  net.b3[0] -= scale * gb3[0];

  return lossSum / n;
}
