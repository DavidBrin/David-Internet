"use client";

/**
 * 5.1 Recurrent Neural Networks -- explanation card. An unrolled 4-step cell
 * chain with a token flowing through (pure CSS animation, auto-loops), plus
 * the three real course lecture diagrams about attention -- click a thumbnail
 * to expand it inside the panel via the `onExpand` callback from LadderPanel.
 */
import { CardShell, Illustration } from "./CardShell";

const STEPS = ["t=1", "t=2", "t=3", "t=4"];

const ATTN_IMAGES = [
  {
    src: "/demos/crossteach/ladder/attention_rnn.webp",
    caption: "Attention over RNN hidden states (DTU 02456 lecture slide)",
  },
  {
    src: "/demos/crossteach/ladder/dot_product.webp",
    caption: "Dot-product attention (DTU 02456 lecture slide)",
  },
  {
    src: "/demos/crossteach/ladder/transformer_layer.webp",
    caption: "A transformer layer (DTU 02456 lecture slide)",
  },
];

export default function RnnCard({ onExpand }: { onExpand: (src: string, caption: string) => void }) {
  return (
    <CardShell week="5.1" title="Recurrent Neural Networks" wide>
      <p className="ctLBody">
        A character-level RNN reads one token at a time, updating a hidden state that
        carries information forward through the sequence. Unrolled through time it is the
        same cell reused at every step, sharing weights across the chain below.
      </p>
      <div className="ctLRnnChain" aria-hidden="true">
        <div className="ctLRnnCells">
          {STEPS.map((s, i) => (
            <div className="ctLRnnStepWrap" key={s}>
              <div className="ctLRnnCell" style={{ animationDelay: `${i * 0.35}s` }}>
                <span className="ctLRnnH">h{i}</span>
              </div>
              {i < STEPS.length - 1 && (
                <span className="ctLRnnArrow" aria-hidden="true">
                  {"->"}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="ctLRnnTrack">
          <span className="ctLRnnToken" />
        </div>
      </div>
      <p className="ctLBody">
        The course then builds toward attention -- letting a decoder look back at every
        encoder hidden state instead of squeezing the whole sequence through one vector --
        and eventually the transformer, which replaces recurrence with attention
        entirely. Three lecture diagrams below; click to expand.
      </p>
      <div className="ctLAttnThumbs">
        {ATTN_IMAGES.map((img) => (
          <button
            key={img.src}
            type="button"
            className="ctLAttnThumb"
            onClick={() => onExpand(img.src, img.caption)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.src} alt={img.caption} loading="lazy" />
            <span className="ctLAttnCaption">{img.caption}</span>
          </button>
        ))}
      </div>
      <Illustration>
        illustration -- the unrolled chain is a schematic, not a trained model&apos;s trace;
        the three diagrams are real course lecture slides
      </Illustration>
    </CardShell>
  );
}
