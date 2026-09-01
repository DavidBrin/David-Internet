/**
 * The deployed model (Dense 76→32→16→1) run two ways:
 *  - float32 forward pass with the Keras weights, and
 *  - a faithful re-implementation of the TFLite INT8 kernels (per-tensor affine
 *    quantization, int32 accumulation, fused ReLU clamp, quantized logistic),
 * so the page can show both columns side by side, activation by activation.
 * Both are tested against the real interpreter's outputs (pnpm sync-demos esp32).
 */

export interface QuantParams {
  scale: number;
  zeroPoint: number;
}

export interface QuantLayer {
  /** int8 weights, [outUnits][inUnits] (TFLite FC layout). */
  wq: number[][];
  /** Per-output-channel weight scales (TFLite quantizes FC weights per channel, symmetric — zero point 0). */
  wScales: number[];
  /** int32 bias (scale = inScale * wScales[o], zeroPoint 0). */
  bias: number[];
  inQuant: QuantParams;
  outQuant: QuantParams;
  activation: "relu" | "none";
}

export interface FloatLayer {
  /** float weights, [outUnits][inUnits]. */
  w: number[][];
  b: number[];
  activation: "relu" | "sigmoid";
}

export interface ModelJson {
  arch: number[];
  scalerMean: number[];
  scalerScale: number[];
  floatLayers: FloatLayer[];
  quantLayers: QuantLayer[];
  /** Quantization of the model input tensor. */
  inputQuant: QuantParams;
  /** Quantization of the logistic output tensor. */
  outputQuant: QuantParams;
  tfliteBytes: number;
  kerasBytes: number;
}

const clamp8 = (v: number) => Math.max(-128, Math.min(127, v));
/** TFLite's round-half-away-from-zero. */
const rnd = (v: number) => (v >= 0 ? Math.floor(v + 0.5) : Math.ceil(v - 0.5));

// ---------------------------------------------------------------- float path

export interface FloatTrace {
  /** Activations after each layer (pre-output includes relu/sigmoid). */
  layers: number[][];
  prob: number;
}

export function forwardFloat(model: ModelJson, xScaled: ArrayLike<number>): FloatTrace {
  let act: number[] = Array.from(xScaled);
  const layers: number[][] = [];
  for (const layer of model.floatLayers) {
    const out = new Array<number>(layer.w.length);
    for (let o = 0; o < layer.w.length; o++) {
      let s = layer.b[o];
      const row = layer.w[o];
      for (let i = 0; i < row.length; i++) s += row[i] * act[i];
      out[o] = layer.activation === "relu" ? Math.max(0, s) : 1 / (1 + Math.exp(-s));
    }
    layers.push(out);
    act = out;
  }
  return { layers, prob: act[0] };
}

// ---------------------------------------------------------------- int8 path

export interface QuantTrace {
  /** Quantized input actually fed to the graph. */
  inputQ: number[];
  /** int8 activations after each FC layer. */
  layersQ: number[][];
  /** The same activations dequantized (for the side-by-side bars). */
  layersDeq: number[][];
  /** int8 logistic output. */
  outQ: number;
  prob: number;
}

/** Quantize the scaled feature vector exactly as the ESP32's runInference does. */
export function quantizeInput(model: ModelJson, xScaled: ArrayLike<number>): number[] {
  const { scale, zeroPoint } = model.inputQuant;
  const q = new Array<number>(xScaled.length);
  for (let i = 0; i < xScaled.length; i++) q[i] = clamp8(rnd(xScaled[i] / scale) + zeroPoint);
  return q;
}

export function forwardInt8(model: ModelJson, xScaled: ArrayLike<number>): QuantTrace {
  let actQ = quantizeInput(model, xScaled);
  const inputQ = actQ.slice();
  const layersQ: number[][] = [];
  const layersDeq: number[][] = [];

  for (const layer of model.quantLayers) {
    const out = new Array<number>(layer.wq.length);
    for (let o = 0; o < layer.wq.length; o++) {
      // per-output-channel multiplier: M_o = s_in * s_w[o] / s_out (weights symmetric, zp 0)
      const M = (layer.inQuant.scale * layer.wScales[o]) / layer.outQuant.scale;
      let acc = layer.bias[o];
      const row = layer.wq[o];
      for (let i = 0; i < row.length; i++) {
        acc += (actQ[i] - layer.inQuant.zeroPoint) * row[i];
      }
      let q = rnd(acc * M) + layer.outQuant.zeroPoint;
      if (layer.activation === "relu") q = Math.max(layer.outQuant.zeroPoint, q);
      out[o] = clamp8(q);
    }
    layersQ.push(out);
    layersDeq.push(out.map((q) => (q - layer.outQuant.zeroPoint) * layer.outQuant.scale));
    actQ = out;
  }

  // Logistic op: dequantize the final FC output, sigmoid, requantize to the
  // output tensor's params (TFLite uses scale 1/256, zp -128).
  const last = model.quantLayers[model.quantLayers.length - 1];
  const preAct = (actQ[0] - last.outQuant.zeroPoint) * last.outQuant.scale;
  const p = 1 / (1 + Math.exp(-preAct));
  const outQ = clamp8(rnd(p / model.outputQuant.scale) + model.outputQuant.zeroPoint);
  const prob = (outQ - model.outputQuant.zeroPoint) * model.outputQuant.scale;

  return { inputQ, layersQ, layersDeq, outQ, prob };
}
