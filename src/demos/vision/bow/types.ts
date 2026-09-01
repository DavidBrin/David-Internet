export interface BowResults {
  params: { imSize: [number, number]; nPts: number; wGrid: number; patchSize: number; nClusters: number };
  counts: { face: number; nonface: number };
  samplePoints: [number, number][];
  sampleHist: number[];
  sampleNonHist: number[];
  accuracies: {
    k: number;
    points: string;
    features: string;
    posAcc: number;
    negAcc: number;
    totalAcc: number;
  }[];
  bayes: {
    bins: string[];
    spamCounts: number[];
    notSpamCounts: number[];
    totalSpam: number;
    totalNotSpam: number;
  };
  note: string;
}
