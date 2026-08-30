import { describe, expect, it } from "vitest";
import { alu16, alu4, aluFlags, ALU_OPS, toSigned16 } from "@/demos/verilog/shelf/models/alu";
import { barrelShift, barrelShiftValue, fromBits, toBits } from "@/demos/verilog/shelf/models/barrel";
import { cla, lookaheadTerm } from "@/demos/verilog/shelf/models/cla";
import { clkDivStep, clkDivReset, clkDivTrace } from "@/demos/verilog/shelf/models/clkdiv";
import { convEncode, convEncReset, convEncStep } from "@/demos/verilog/shelf/models/convenc";
import { counterStep } from "@/demos/verilog/shelf/models/counter";
import { binaryToGray, grayChain, grayToBinary } from "@/demos/verilog/shelf/models/gray";
import { johnsonSequence, johnsonStep } from "@/demos/verilog/shelf/models/johnson";
import { defaultTap, lfsrSequence, lfsrStep } from "@/demos/verilog/shelf/models/lfsr";
import { decoder2to4, fullAdder, mux2, STYLES } from "@/demos/verilog/shelf/models/threeStyles";
import { uartFrame, uartLoopback, uartRxReset, uartRxStep, uartTxReset, uartTxStep } from "@/demos/verilog/shelf/models/uart";

describe("barrel shifter (hw4)", () => {
  // rows from 8bits_rslt.txt, din = 10110110
  const din = 0b10110110;
  it.each([
    ["right", false, 1, 0b01011011],
    ["right", false, 3, 0b00010110],
    ["left", false, 2, 0b11011000],
    ["left", false, 7, 0b00000000],
    ["right", true, 2, 0b10101101],
    ["right", true, 3, 0b11010110],
    ["left", true, 3, 0b10110101],
    ["left", true, 0, 0b10110110],
  ] as const)("%s rotate=%s by %d", (dir, rotate, amt, expected) => {
    expect(barrelShiftValue(8, din, amt, dir, rotate)).toBe(expected);
    expect(barrelShift(8, din, amt, dir, rotate).out).toBe(expected);
  });

  it("mux-stage network agrees with the behavioral formula for every input", () => {
    for (const d of [0b10110110, 0b01111001, 0b10000001, 0xff, 0]) {
      for (const dir of ["left", "right"] as const) {
        for (const rotate of [false, true]) {
          for (let amt = 0; amt < 8; amt++) {
            expect(barrelShift(8, d, amt, dir, rotate).out).toBe(barrelShiftValue(8, d, amt, dir, rotate));
          }
        }
      }
    }
  });

  it("exposes three stages of 1, 2, 4 with sources", () => {
    const r = barrelShift(8, din, 5, "right", false);
    expect(r.stages.map((s) => s.distance)).toEqual([1, 2, 4]);
    expect(r.stages.map((s) => s.active)).toEqual([true, false, true]);
    expect(r.stages[0].source[7]).toBe(-1); // zero fill
    expect(r.stages[2].source[0]).toBe(4);
    expect(fromBits(toBits(0xb6, 8))).toBe(0xb6);
  });
});

describe("LFSR (hw5)", () => {
  it("walks the N=6 sequence recorded in rslt.txt", () => {
    const taps = defaultTap(6);
    expect(taps).toBe(0b110000);
    const seq = lfsrSequence(0b111111, taps, 6);
    expect(seq.states.slice(0, 8)).toEqual([0b111111, 0b111110, 0b111100, 0b111000, 0b110000, 0b100000, 0b000001, 0b000010]);
    expect(seq.states[11]).toBe(0b100001);
    expect(seq.period).toBe(63);
    expect(seq.maximal).toBe(true);
  });

  it("default taps are maximal length for every N = 2..8", () => {
    for (let n = 2; n <= 8; n++) {
      const seq = lfsrSequence((1 << n) - 1, defaultTap(n), n);
      expect(seq.period).toBe((1 << n) - 1);
    }
  });

  it("the testbench's custom N=6 tap/seed 0x21 also has period 63", () => {
    expect(lfsrSequence(0x21, 0x21, 6).period).toBe(63);
  });

  it("a non-primitive tap pattern gives a short cycle", () => {
    const seq = lfsrSequence(0b0001, 0b1111, 4);
    expect(seq.period).toBe(5);
    expect(seq.maximal).toBe(false);
    expect(lfsrStep(0b0001, 0b1111, 4)).toBe(0b0011);
  });
});

describe("Gray to binary (hw6)", () => {
  it("matches the testbench's expected conversions", () => {
    expect(grayToBinary(0b10, 16)).toBe(0b11);
    expect(grayToBinary(0b11, 16)).toBe(0b10);
    expect(grayToBinary(0b1000, 4)).toBe(0b1111);
    expect(grayToBinary(0, 4)).toBe(0);
  });
  it("inverts binaryToGray", () => {
    for (let b = 0; b < 256; b++) expect(grayToBinary(binaryToGray(b), 8)).toBe(b);
  });
  it("chain evaluates MSB first", () => {
    expect(grayChain(0b0110, 4).map((c) => c.b)).toEqual([0, 1, 0, 0]);
  });
});

describe("carry-lookahead adder (hw6)", () => {
  it("adds the directed testbench vectors", () => {
    expect(cla(2, 1, 1, 32).result).toBe(4);
    expect(cla(4, 7, 1, 32).result).toBe(12);
    expect(cla(15, 2, 0, 32).result).toBe(17);
    expect(cla(10, 5, 0, 32).result).toBe(15);
  });
  it("carries out of the top bit", () => {
    const r = cla(0xff, 0x01, 0, 8);
    expect(r.result).toBe(0x100);
    expect(r.carry).toEqual([0, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(r.g).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
    expect(r.p.every((x) => x === 1)).toBe(true);
    expect(r.depthRipple).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(r.depthLookahead).toEqual([0, 2, 2, 2, 2, 2, 2, 2, 2]);
  });
  it("matches a + b + cin for random 32-bit operands", () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0);
    for (let i = 0; i < 200; i++) {
      const a = rnd();
      const b = rnd();
      const c = rnd() & 1;
      expect(cla(a, b, c, 32).result).toBe((a + b + c) % 2 ** 33);
    }
  });
  it("prints the lookahead expansion", () => {
    expect(lookaheadTerm(2)).toBe("G1 + P1·G0 + P1·P0·cin");
  });
});

describe("clock divider (hw6)", () => {
  it("divides by 4 with a 50/50 duty cycle, counting on both edges", () => {
    const t = clkDivTrace(4, 16);
    expect(t.count).toEqual([1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7, 0]);
    expect(t.clkout).toEqual([0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0]);
  });
  it("wraps at 2N-1", () => {
    let s = clkDivReset(3);
    for (let i = 0; i < 5; i++) s = clkDivStep(s, 3);
    expect(s.count).toBe(5);
    expect(clkDivStep(s, 3).count).toBe(0);
  });
});

describe("16-bit ALU (hw2 alu_enum.sv)", () => {
  it.each([
    ["AADD", 5, 3, 8],
    ["ASUB", 5, 3, 2],
    ["ASUB", 3, 5, 0xfffe],
    ["AAND", 0x00f0, 0x0f0f, 0],
    ["AOR", 0x00f0, 0x0f0f, 0x0fff],
    ["AXOR", 0x00f0, 0x0f0f, 0x0fff],
    ["ASL", 5, 3, 40],
    ["ASR", 0xfff8, 2, 0xfffe],
    ["ASRU", 0xfff8, 2, 0x3ffe],
    ["ASR", 0x8000, 1, 0xc000],
    ["ASRU", 0x8000, 1, 0x4000],
    ["AADD", 0x7fff, 1, 0x8000],
  ] as const)("%s(%d, %d) = %d", (op, a, b, r) => {
    expect(alu16(op, a, b)).toBe(r);
  });
  it("covers all eight opa commands", () => {
    expect(ALU_OPS).toHaveLength(8);
    expect(toSigned16(0xfffe)).toBe(-2);
  });
  it("derives flags", () => {
    expect(aluFlags("AADD", 0x7fff, 1, 0x8000)).toEqual({ zero: false, negative: true, carry: false, overflow: true });
    expect(aluFlags("ASUB", 3, 3, 0)).toEqual({ zero: true, negative: false, carry: false, overflow: false });
    expect(aluFlags("AADD", 0xffff, 1, 0).carry).toBe(true);
  });
  it("4-bit alu.sv ops from the alu_top testbench", () => {
    expect(alu4(0, 0, 1)).toBe(1);
    expect(alu4(1, 1, 1)).toBe(0);
    expect(alu4(2, 1, 1)).toBe(1);
    expect(alu4(3, 1, 0)).toBe(1);
    expect(alu4(0, 15, 1)).toBe(0);
  });
});

describe("Johnson counter (hw3)", () => {
  it("walks the 8-state sequence from right.txt", () => {
    expect(johnsonSequence(0, 4)).toEqual([0b0000, 0b1000, 0b1100, 0b1110, 0b1111, 0b0111, 0b0011, 0b0001]);
    expect(johnsonStep(0b0001, 4)).toBe(0b0000);
    expect(johnsonStep(0b1000, 4)).toBe(0b1100); // after preset load 1000
  });
});

describe("4-bit counter (hw2)", () => {
  it("counts and wraps, clear wins", () => {
    let c = 0;
    for (let i = 0; i < 15; i++) c = counterStep(c);
    expect(c).toBe(15);
    expect(counterStep(c)).toBe(0);
    expect(counterStep(9, 4, true)).toBe(0);
  });
});

describe("three styles of one circuit (hw1)", () => {
  it("decoder: all three styles are one-hot and agree", () => {
    for (let sel = 0; sel < 4; sel++) {
      const r = decoder2to4(sel);
      for (const s of STYLES) expect(r[s]).toBe(1 << sel);
    }
  });
  it("full adder: all three styles agree with a+b+cin", () => {
    for (let v = 0; v < 8; v++) {
      const a = v & 1;
      const b = (v >> 1) & 1;
      const cin = (v >> 2) & 1;
      const r = fullAdder(a, b, cin);
      for (const s of STYLES) {
        expect(r[s].sum).toBe((a + b + cin) & 1);
        expect(r[s].cout).toBe((a + b + cin) >> 1);
      }
    }
  });
  it("mux: all three styles select in[sel]", () => {
    for (let v = 0; v < 8; v++) {
      const in0 = v & 1;
      const in1 = (v >> 1) & 1;
      const sel = (v >> 2) & 1;
      const r = mux2(in0, in1, sel);
      for (const s of STYLES) expect(r[s]).toBe(sel ? in1 : in0);
    }
  });
});

describe("convolutional encoder (hw7)", () => {
  it("N=4, masks 'o17 / 'o13 as in conv_enc_tb.sv", () => {
    expect(convEncode([1, 1, 0, 1], 0b1111, 0b1011, 4)).toEqual([
      [1, 1],
      [0, 1],
      [0, 1],
      [1, 1],
    ]);
  });
  it("shifts the new bit in at the MSB", () => {
    const s = convEncStep(convEncReset(0b1111, 0b1011), 1, 0b1111, 0b1011, 4);
    expect(s.history).toBe(0b1000);
    expect(convEncStep(s, 0, 0b1111, 0b1011, 4).history).toBe(0b0100);
  });
});

describe("UART (hw8)", () => {
  it("frames a byte as start, 8 data bits LSB first, stop", () => {
    expect(uartFrame(0xa5)).toEqual([0, 1, 0, 1, 0, 0, 1, 0, 1, 1]);
  });

  it.each([0xa5, 0xa8, 0xab, 0xae, 0x00, 0xff])("loops back 0x%s at 16 clocks per bit", (byte) => {
    const r = uartLoopback(byte, 16);
    expect(r.rxByte).toBe(byte);
    expect(r.rxDoneAt).toBeGreaterThan(0);
    expect(r.txDoneAt).toBeGreaterThan(0);
  });

  it("holds every bit for NUM_CLKS_PER_BIT clocks", () => {
    const r = uartLoopback(0xa5, 16);
    const frame = uartFrame(0xa5);
    const s = r.txTrace.indexOf(0);
    for (let k = 0; k < 10; k++) {
      const run = r.txTrace.slice(s + 16 * k, s + 16 * (k + 1));
      expect(run.every((b) => b === frame[k])).toBe(true);
    }
  });

  it("works at other baud divisors", () => {
    expect(uartLoopback(0x3c, 4).rxByte).toBe(0x3c);
    expect(uartLoopback(0x3c, 434).rxByte).toBe(0x3c);
  });

  it("tx state machine: start bit follows idle, done pulses after stop", () => {
    let s = uartTxReset();
    s = uartTxStep(s, 0xff, false, 4);
    expect(s.state).toBe("IDLE");
    expect(s.tx).toBe(1);
    s = uartTxStep(s, 0xff, true, 4);
    expect(s.state).toBe("START");
    for (let i = 0; i < 4; i++) s = uartTxStep(s, 0xff, false, 4);
    expect(s.state).toBe("DATA");
    expect(s.tx).toBe(0);
  });

  it("rx state machine: validates the start bit at mid-bit", () => {
    let s = uartRxReset();
    s = uartRxStep(s, 0, 16);
    expect(s.state).toBe("START");
    for (let i = 0; i < 7; i++) s = uartRxStep(s, 0, 16);
    expect(s.state).toBe("START");
    s = uartRxStep(s, 0, 16);
    expect(s.state).toBe("DATA");
    expect(s.bitIndex).toBe(0);
  });
});
