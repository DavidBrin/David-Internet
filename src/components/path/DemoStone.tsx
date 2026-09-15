/**
 * DemoStone — a project "rock" in the river. Manifest-backed demos link out;
 * a project with no demo yet renders as an inert stone that says so, carrying
 * its `note` instead of pretending there is something behind the click.
 */
import type { DemoRef } from "@/lib/journey";

export default function DemoStone({ demo }: { demo: DemoRef }) {
  const pending = demo.status === "in-progress";
  const inner = (
    <>
      <span className="stoneShape" aria-hidden="true">
        <span className="stoneSplash" />
      </span>
      <span className="stoneText">
        <span className="stoneLabel">{demo.label}</span>
        <span className="stoneMeta">
          {pending ? "not a demo yet" : demo.status === "live" ? "visit" : "read the wiki"}
        </span>
        {pending && demo.note && <span className="stoneNote">{demo.note}</span>}
      </span>
    </>
  );

  if (demo.href && !pending) {
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
