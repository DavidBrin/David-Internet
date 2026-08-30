/**
 * JourneyPhaseSection — one chapter on the riverbank.
 * Content card alternates sides of the river; set-pieces (sand-wash title,
 * paper-wash photo reveals, branch island, demo stones, delta fan targets)
 * are all CSS effects driven by the section's --sp scroll progress.
 * Real headings + DOM order first: the visual layers are decoration.
 */
import Image from "next/image";
import type { JourneyPhase, DisappearingMessage as Msg } from "@/lib/journey";
import DemoStone from "./DemoStone";
import DisappearingMessage from "./DisappearingMessage";

function AnchorEtch({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <div className="anchorEtch" data-progress>
      <p className="anchorEtch-line">
        {words.map((w, i) => (
          <span key={i} className="anchorEtch-word" style={{ "--wi": i } as React.CSSProperties}>
            {w}
          </span>
        ))}
      </p>
      <p className="anchorEtch-note">— carved into a school desk, and into everything since</p>
    </div>
  );
}

interface Props {
  phase: JourneyPhase;
  index: number;
  /** Which bank the content card sits on. */
  side: "left" | "right";
  /** Interleaved sand-etched aside (from the messages pool), if any. */
  message?: Msg;
  /** The fixed anchor line (only passed to the etch-anchor phase). */
  anchorMessage?: Msg;
}

export default function JourneyPhaseSection({ phase, index, side, message, anchorMessage }: Props) {
  const { palette } = phase.scene;
  const isDelta = phase.effect === "delta-fan";

  return (
    <section
      id={phase.id}
      className={`phaseSection phaseSection--${side}${isDelta ? " phaseSection--delta" : ""}`}
      data-phase-index={index}
      data-progress
      style={
        {
          "--accent": palette.accent,
          "--ink": palette.ink,
          "--water": palette.water,
        } as React.CSSProperties
      }
    >
      <div className="phaseInner">
        <div className="phaseCard">
          <p className="phaseKicker">
            <span className="phaseKicker-label">{phase.kicker}</span>
            {phase.period && <span className="phaseKicker-period">{phase.period}</span>}
          </p>

          {phase.effect === "wash-sand" ? (
            <h2 className="phaseTitle washTitle">
              <span className="washTitle-sand" aria-hidden="true">
                {phase.title}
              </span>
              <span className="washTitle-ink">{phase.title}</span>
            </h2>
          ) : (
            <h2 className="phaseTitle">{phase.title}</h2>
          )}

          <p className="phaseBody">{phase.body}</p>

          {phase.links && phase.links.length > 0 && (
            <p className="phaseLinks">
              {phase.links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  {...(l.external ? { target: "_blank", rel: "noreferrer" } : {})}
                >
                  {l.label} →
                </a>
              ))}
            </p>
          )}

          {phase.media.length > 0 && (
            <div className={`phaseMedia${phase.media.length > 2 ? " phaseMedia--many" : ""}`}>
              {phase.media.map((m, i) => (
                <figure
                  key={i}
                  className={`mediaFigure mediaFigure--${m.reveal ?? "fade"}${m.placeholder ? " mediaFigure--placeholder" : ""}`}
                >
                  <div className="mediaFrame">
                    {m.placeholder ? (
                      <span className="mediaPlaceholder">{m.alt}</span>
                    ) : (
                      <Image src={m.src} alt={m.alt} fill sizes="(max-width: 700px) 45vw, 260px" />
                    )}
                    <span className="mediaWash" aria-hidden="true" />
                  </div>
                  {m.caption && <figcaption>{m.caption}</figcaption>}
                </figure>
              ))}
            </div>
          )}
        </div>

        {phase.branch && (
          <div className="branchIsland" aria-hidden="true">
            <span>{phase.branch.label}</span>
          </div>
        )}

        {phase.demos && phase.demos.length > 0 && !isDelta && (
          <div className="phaseStones">
            {phase.demos.map((d) => (
              <DemoStone key={d.slug} demo={d} />
            ))}
          </div>
        )}
      </div>

      {isDelta && phase.demos && (
        <div className="deltaStones">
          {phase.demos.map((d) => (
            <DemoStone key={d.slug} demo={d} />
          ))}
        </div>
      )}

      {anchorMessage && <AnchorEtch text={anchorMessage.text} />}
      {message && <DisappearingMessage message={message} />}
    </section>
  );
}
