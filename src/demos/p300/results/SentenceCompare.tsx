"use client";

interface SentenceCompareProps {
  wordTrue: string;
  wordPred: string;
  model: string;
}

interface Col {
  i: number;
  t: string;
  p: string;
  mismatch: boolean;
}

/** True vs. predicted sentence, aligned character by character. Mismatches
 * get a red-ish background on the predicted row; the true letter sits right
 * above it in the same column, so hovering the column shows the pair. */
export default function SentenceCompare({ wordTrue, wordPred, model }: SentenceCompareProps) {
  const len = Math.min(wordTrue.length, wordPred.length);
  const cols: Col[] = [];
  let wrong = 0;
  for (let i = 0; i < len; i++) {
    const t = wordTrue[i];
    const p = wordPred[i];
    const mismatch = t !== p;
    if (mismatch) wrong++;
    cols.push({ i, t, p, mismatch });
  }

  return (
    <div className="pR-sentence">
      <p className="pR-countLine">
        {wrong} of {len} letters wrong at 15 repetitions, decoded with {model}.
      </p>
      <div className="pR-sentenceScroll">
        <div className="pR-sentenceGrid" style={{ gridTemplateColumns: `repeat(${len}, 17px)` }}>
          {cols.map((c) => (
            <div key={c.i} className={`pR-col${c.mismatch ? " pR-colMismatch" : ""}`}>
              <span className="pR-trueChar ppMono">{c.t}</span>
              <span className="pR-predChar ppMono">{c.p}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="pR-underscoreNote ppNote">&apos;_&apos; is the space character.</p>
    </div>
  );
}
