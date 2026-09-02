"use client";

/** Shared card atoms for the ladder strip: the card frame, the "live" badge, and
 * the honesty caption every non-live visualization carries. */
import type { ReactNode } from "react";

export function CardShell({
  week,
  title,
  children,
  wide,
}: {
  week: string;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <article className={`ctLCard${wide ? " ctLCardWide" : ""}`} role="listitem">
      <div className="ctLCardHead">
        <span className="ctChip ctLWeek">{week}</span>
        <h3 className="ctLCardTitle">{title}</h3>
      </div>
      {children}
    </article>
  );
}

export function LiveBadge() {
  return <span className="ctLLive">live in TypeScript</span>;
}

export function Illustration({ children }: { children?: ReactNode }) {
  return (
    <p className="ctLIllus">
      {children ?? "illustration -- the notebook's real run was not archived"}
    </p>
  );
}
