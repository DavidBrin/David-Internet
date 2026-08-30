"use client";

import { useState } from "react";

export interface SourceTab {
  name: string;
  note?: string;
  /** Pre-highlighted HTML from shiki (built on the server). */
  html: string;
  lines: number;
}

/** Collapsible, tabbed view of the demo's original source files. */
export default function SourceDrawer({ tabs, footer }: { tabs: SourceTab[]; footer?: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const tab = tabs[active];

  return (
    <section className={`demoDrawer${open ? " isOpen" : ""}`} id="source" aria-label="Source">
      <button
        type="button"
        className="demoDrawerToggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="demoDrawerChevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
        Source
        <span className="demoDrawerCount">
          {tabs.length} file{tabs.length === 1 ? "" : "s"}
        </span>
      </button>

      {open ? (
        <div className="demoDrawerBody">
          <div className="demoDrawerTabs" role="tablist">
            {tabs.map((t, i) => (
              <button
                key={t.name}
                type="button"
                role="tab"
                aria-selected={i === active}
                className={`demoDrawerTab${i === active ? " isActive" : ""}`}
                onClick={() => setActive(i)}
              >
                {t.name}
              </button>
            ))}
          </div>
          {tab ? (
            <div className="demoDrawerPane" role="tabpanel">
              <div className="demoDrawerMeta">
                <span>{tab.note}</span>
                <span className="demoDrawerLines">{tab.lines} lines</span>
              </div>
              <div className="demoCode" dangerouslySetInnerHTML={{ __html: tab.html }} />
            </div>
          ) : null}
          {footer ? <p className="demoDrawerFooter">{footer}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
