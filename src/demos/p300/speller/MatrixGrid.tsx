"use client";

import { CHAR_SET } from "../core/decode";

interface MatrixGridProps {
  targetRow: number;
  targetCol: number;
  /** Stimulus code 1-6 = column flashing, 7-12 = row flashing, null = no flash right now. */
  activeStim: number | null;
  /** 12-vector (6 cols + 6 rows), 1 where that col/row is the current decode argmax. */
  decodedRounded: number[] | null;
  decodedLetter: string | null;
  locked: boolean;
  pickable: boolean;
  onPick: (ch: string) => void;
}

export default function MatrixGrid({
  targetRow,
  targetCol,
  activeStim,
  decodedRounded,
  decodedLetter,
  locked,
  pickable,
  onPick,
}: MatrixGridProps) {
  const flashCol = activeStim !== null && activeStim >= 1 && activeStim <= 6 ? activeStim - 1 : null;
  const flashRow = activeStim !== null && activeStim >= 7 && activeStim <= 12 ? activeStim - 7 : null;
  const decodedCol = decodedRounded ? decodedRounded.findIndex((v, i) => i < 6 && v === 1) : -1;
  const decodedRow = decodedRounded ? decodedRounded.findIndex((v, i) => i >= 6 && v === 1) - 6 : -1;

  return (
    <div className="pSGrid" role="grid" aria-label="Speller matrix">
      {CHAR_SET.split("").map((ch, i) => {
        const row = Math.floor(i / 6);
        const col = i % 6;
        const isTarget = row === targetRow && col === targetCol;
        const isFlashing = col === flashCol || row === flashRow;
        const isDecodedCell = col === decodedCol && row === decodedRow && decodedCol >= 0 && decodedRow >= 0;
        const isDecodedLetter = decodedLetter !== null && ch === decodedLetter;
        return (
          <button
            key={ch}
            type="button"
            className="pSCell"
            data-flash={isFlashing || undefined}
            data-target={isTarget || undefined}
            data-decoded={isDecodedCell || undefined}
            data-locked={(isDecodedCell && locked) || undefined}
            data-hit={(isDecodedLetter && locked) || undefined}
            disabled={!pickable}
            onClick={() => pickable && onPick(ch)}
            aria-selected={isTarget}
          >
            {ch}
          </button>
        );
      })}
    </div>
  );
}
