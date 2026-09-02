"use client";

/**
 * 4.2 CNN CIFAR-10 and 4.3 CNN transfer -- explanation cards, both driven by
 * this one block-diagram component (conv-pool-conv-pool-conv-pool-fc-fc).
 * `frozen` swaps in the transfer-learning variant: the conv stack shown
 * locked (a CSS padlock, no emoji) and the fc head highlighted as the only
 * part still training.
 */
import { CardShell, Illustration } from "./CardShell";

interface Block {
  label: string;
  ch: number;
}

const BLOCKS: Block[] = [
  { label: "conv", ch: 32 },
  { label: "pool", ch: 32 },
  { label: "conv", ch: 64 },
  { label: "pool", ch: 64 },
  { label: "conv", ch: 128 },
  { label: "pool", ch: 128 },
  { label: "fc", ch: 256 },
  { label: "fc", ch: 10 },
];

const HEAD_START = 6;

function Lock() {
  return (
    <span className="ctLLock" aria-hidden="true">
      <span className="ctLLockShackle" />
      <span className="ctLLockBody" />
    </span>
  );
}

export default function CnnBlocksCard({
  week,
  title,
  frozen,
}: {
  week: string;
  title: string;
  frozen: boolean;
}) {
  return (
    <CardShell week={week} title={title}>
      <p className="ctLBody">
        {frozen
          ? "The pretrained convolutional stack is frozen (its weights stop updating) and only a new fully-connected head is retrained on the target classes -- far fewer parameters to learn, and far less data needed."
          : "David's notebook stacks three conv-pool blocks (channels doubling 32, 64, 128) before two fully-connected layers reduce down to the 10 CIFAR-10 classes."}
      </p>
      <div className="ctLBlocks">
        {BLOCKS.map((blk, i) => {
          const isHead = i >= HEAD_START;
          const isFrozen = frozen && !isHead;
          const isHighlightedHead = frozen && isHead;
          return (
            <div className="ctLBlockGroup" key={i}>
              <div
                className={`ctLBlock${isFrozen ? " ctLBlockFrozen" : ""}${isHighlightedHead ? " ctLBlockHead" : ""}`}
              >
                {isFrozen && <Lock />}
                <span className="ctLBlockLabel">{blk.label}</span>
                <span className="ctLBlockCh ctMono">{blk.ch}</span>
              </div>
              {i < BLOCKS.length - 1 && (
                <span className="ctLBlockArrow" aria-hidden="true">
                  {"->"}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <Illustration>
        illustration -- a block diagram of the notebook&apos;s architecture, not a rendered
        layer trace
      </Illustration>
    </CardShell>
  );
}
