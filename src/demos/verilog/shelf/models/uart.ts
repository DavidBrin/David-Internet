/**
 * Cycle-accurate models of hw8 `uart_tx.sv` / `uart_rx.sv` (one call = one posedge clk).
 * Register semantics follow the RTL's non-blocking assignments: every field of the returned
 * state is computed from the *previous* state.
 */

export type TxState = "IDLE" | "START" | "DATA" | "STOP" | "CLEANUP";
export type RxState = "IDLE" | "START" | "DATA" | "STOP";

export interface UartTxState {
  state: TxState;
  count: number;
  bitIndex: number;
  tx: 0 | 1;
  done: boolean;
}

export interface UartRxState {
  state: RxState;
  /** data bit being sampled while in DATA (0..7) */
  bitIndex: number;
  count: number;
  dout: number;
  done: boolean;
}

export function uartTxReset(): UartTxState {
  return { state: "IDLE", count: 0, bitIndex: 0, tx: 0, done: false };
}

export function uartRxReset(): UartRxState {
  return { state: "IDLE", bitIndex: 0, count: 0, dout: 0, done: false };
}

/** One clock of `uart_tx`. `start` is sampled only in IDLE. */
export function uartTxStep(s: UartTxState, din: number, start: boolean, clksPerBit: number): UartTxState {
  const last = clksPerBit - 1;
  switch (s.state) {
    case "IDLE":
      return { state: start ? "START" : "IDLE", count: 0, bitIndex: 0, tx: 1, done: false };
    case "START":
      if (s.count === last) return { state: "DATA", count: 0, bitIndex: 0, tx: 0, done: false };
      return { ...s, tx: 0, done: false, bitIndex: 0, count: s.count + 1 };
    case "DATA": {
      const tx = ((din >> s.bitIndex) & 1) as 0 | 1;
      if (s.count === last) {
        if (s.bitIndex === 7) return { state: "STOP", count: 0, bitIndex: 0, tx, done: false };
        return { state: "DATA", count: 0, bitIndex: s.bitIndex + 1, tx, done: false };
      }
      return { state: "DATA", count: s.count + 1, bitIndex: s.bitIndex, tx, done: false };
    }
    case "STOP":
      if (s.count === last) return { state: "CLEANUP", count: 0, bitIndex: 0, tx: 1, done: true };
      return { state: "STOP", count: s.count + 1, bitIndex: 0, tx: 1, done: false };
    case "CLEANUP":
      return { ...s, state: "IDLE", done: true };
  }
}

/** One clock of `uart_rx`. The start bit is validated at its midpoint, data bits are sampled a full bit later each. */
export function uartRxStep(s: UartRxState, rx: 0 | 1, clksPerBit: number): UartRxState {
  const last = clksPerBit - 1;
  const mid = Math.floor((clksPerBit - 1) / 2);
  switch (s.state) {
    case "IDLE":
      return { state: rx === 0 ? "START" : "IDLE", bitIndex: 0, count: 0, dout: 0, done: false };
    case "START":
      if (rx === 0 && s.count === mid) return { state: "DATA", bitIndex: 0, count: 0, dout: 0, done: false };
      return { ...s, count: s.count + 1 };
    case "DATA":
      if (s.count === last) {
        const dout = (s.dout & ~(1 << s.bitIndex)) | (rx << s.bitIndex);
        if (s.bitIndex === 7) return { state: "STOP", bitIndex: 0, count: 0, dout, done: false };
        return { state: "DATA", bitIndex: s.bitIndex + 1, count: 0, dout, done: false };
      }
      return { ...s, count: s.count + 1 };
    case "STOP":
      if (s.count === last) return { state: "IDLE", bitIndex: 0, count: 0, dout: s.dout, done: true };
      return { ...s, count: s.count + 1 };
  }
}

/** The 10-bit frame `uart_tx` puts on the wire: start(0), d0..d7 LSB first, stop(1). */
export function uartFrame(byte: number): (0 | 1)[] {
  const bits: (0 | 1)[] = [0];
  for (let i = 0; i < 8; i++) bits.push(((byte >> i) & 1) as 0 | 1);
  bits.push(1);
  return bits;
}

export interface LoopbackResult {
  /** tx line sampled after each clock */
  txTrace: (0 | 1)[];
  rxByte: number;
  /** clock index at which rx.done rose (or -1) */
  rxDoneAt: number;
  txDoneAt: number;
}

/**
 * Wire tx to rx (like `uart_top.sv`) and clock until both report done. `tx` idles low while
 * the RTL is in reset, so rx is released one clock after tx to avoid a false start bit
 * (the course testbench survives this because rx re-synchronises on the real start bit).
 */
export function uartLoopback(byte: number, clksPerBit: number, maxClocks = clksPerBit * 14): LoopbackResult {
  let tx = uartTxStep(uartTxReset(), byte, false, clksPerBit); // one idle clock: tx = 1
  let rx = uartRxReset();
  const txTrace: (0 | 1)[] = [tx.tx];
  let rxDoneAt = -1;
  let txDoneAt = -1;
  let rxByte = -1;
  for (let clk = 1; clk < maxClocks; clk++) {
    const wire = tx.tx;
    const nextTx = uartTxStep(tx, byte, clk === 1, clksPerBit);
    const nextRx = uartRxStep(rx, wire, clksPerBit);
    tx = nextTx;
    rx = nextRx;
    txTrace.push(tx.tx);
    if (tx.done && txDoneAt < 0) txDoneAt = clk;
    if (rx.done && rxDoneAt < 0) {
      rxDoneAt = clk;
      rxByte = rx.dout; // dout is cleared again once rx returns to IDLE
    }
    if (txDoneAt >= 0 && rxDoneAt >= 0) break;
  }
  return { txTrace, rxByte, rxDoneAt, txDoneAt };
}
