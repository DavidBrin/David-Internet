export interface FashionMnistRun {
  config: "SGD" | "Adam";
  dropout: boolean;
  testAcc: number;
}

export interface TransferRun {
  run: string;
  label: string;
  loss: number[];
  acc: number[];
}

export interface CnnCurves {
  fashionMnist: FashionMnistRun[];
  transferEpochs: number[];
  transfer: TransferRun[];
  note: string;
}
