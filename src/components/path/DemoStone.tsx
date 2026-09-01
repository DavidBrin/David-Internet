/**
 * DemoStone — a project "rock" in the river. Manifest-backed demos link out;
 * in-progress demos render as inert "coming soon" stones (label only — never
 * describe unfinished content).
 */
import type { DemoRef } from "@/lib/journey";

export default function DemoStone({ demo }: { demo: DemoRef }) {
  const inner = (
    <>
      <span className="stoneShape" aria-hidden="true">
        <span className="stoneSplash" />
      </span>
      <span className="stoneText">
        <span className="stoneLabel">{demo.label}</span>
        <span className="stoneMeta">
          {demo.status === "in-progress" ? "coming soon" : demo.status === "live" ? "visit" : "read the wiki"}
        </span>
      </span>
    </>
  );

  if (demo.href && demo.status !== "in-progress") {
    return (
      <div className="demoStoneGroup">
        <a className={`demoStone demoStone--${demo.status}`} href={demo.href}>
          {inner}
        </a>
        {demo.wikiHref && demo.wikiHref !== demo.href && (
          <a className="stoneWiki" href={demo.wikiHref} target="_blank" rel="noopener noreferrer">
            wiki
          </a>
        )}
      </div>
    );
  }
  return <span className="demoStone demoStone--soon">{inner}</span>;
}
