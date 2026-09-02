/** Shapes for /demos/p300/results.json — the results panel's data source. */

export interface BinaryModel {
  model: string;
  acc: number;
  channels: string;
  desc: string;
}

export interface ResultsData {
  subject: string;
  note: string;
  binary: BinaryModel[];
  /** Keyed by ensemble model name (e.g. "MCNN1") -> its members' weighted accuracies. */
  mcnnMembers: Record<string, number[]>;
  /** Character accuracy percent, index i = repetition i+1 (1..15). */
  spellerCurve: number[];
  spellerModel: string;
  wordTrue: string;
  wordPred: string;
}
