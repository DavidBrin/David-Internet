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
          {demo.status === "in-progress" ? "coming soon" : demo.status === "live" ? "visit" : "read the docs"}
        </span>
      </span>
    </>
  );

  if (demo.href && demo.status !== "in-progress") {
    return (
      <a className={`demoStone demoStone--${demo.status}`} href={demo.href}>
        {inner}
      </a>
    );
  }
  return <span className="demoStone demoStone--soon">{inner}</span>;
}
