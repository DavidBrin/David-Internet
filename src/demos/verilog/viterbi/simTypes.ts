/** Shape of public/demos/verilog/viterbi.json (written by scripts/demos/verilog.ts). */

export interface SimWindow {
  id: string;
  from: number;
  signals: Record<string, (number | null)[]>;
  /** per cycle: the eight path metrics */
  pathCost: (number | null)[][];
}

export interface SimPreset {
  id: string;
  label: string;
  params: { PERIOD: number; BURST: number; ERR_BIT0: 0 | 1; ERR_BIT1: 0 | 1; USE_RAND: 0 | 1; ENABLE_ERR: 0 | 1 };
  status: "pass" | "fail" | "error";
  good: number;
  bad: number;
  corrupted: number;
  badIndices: number[];
  wallMs: number;
  windows: SimWindow[];
  inputBits: number[];
  decodedBits: number[];
  rxSymbols: number[];
  errHits: number[];
}

export interface SimJson {
  generatedAt: string;
  tool: string;
  clockNs: number;
  outputOffsetCycles: number;
  windows: { id: string; from: number; to: number }[];
  presets: SimPreset[];
}
