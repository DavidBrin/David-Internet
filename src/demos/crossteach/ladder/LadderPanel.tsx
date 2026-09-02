"use client";

/**
 * #ladder -- "The learning ladder": the weekly DTU 02456 notebook progression
 * that led to cross-teaching. Course notebooks ship output-stripped, so most
 * cards explain + visualize what David's solution code does; only the
 * autodiff graph (3.2) and the half-moon FFN (3.3) run live in TypeScript.
 * Prefix ctL. Owns: ladder.css, ffn.ts, cards/*.
 *
 * The strip below is its own overflow-x:auto container -- it never scrolls
 * the page. The image lightbox (for the RNN card's attention diagrams) is
 * an overlay confined to this panel, not a page-level modal.
 */
import { useCallback, useEffect, useState } from "react";
import "./ladder.css";
import AutodiffCard from "./cards/AutodiffCard";
import HalfMoonCard from "./cards/HalfMoonCard";
import MnistCard from "./cards/MnistCard";
import CnnIntroCard from "./cards/CnnIntroCard";
import CnnBlocksCard from "./cards/CnnBlocksCard";
import RnnCard from "./cards/RnnCard";
import AutoencoderCard from "./cards/AutoencoderCard";
import VaeCard from "./cards/VaeCard";
import GanCard from "./cards/GanCard";
import ForwardCard from "./cards/ForwardCard";

interface Expanded {
  src: string;
  caption: string;
}

export default function LadderPanel() {
  const [expanded, setExpanded] = useState<Expanded | null>(null);
  const onExpand = useCallback((src: string, caption: string) => setExpanded({ src, caption }), []);
  const close = useCallback(() => setExpanded(null), []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, close]);

  return (
    <div className="ctPanel ctLPanel">
      <h2 className="ctH2">The learning ladder</h2>
      <p className="ctIntro">
        DTU 02456 climbs to cross-teaching week by week. Two cards below run live in
        TypeScript (autodiff, the half-moon net); the rest explain and visualize what
        David&apos;s solution notebooks do -- the course ships its notebooks with every
        stored figure and curve stripped out, so nothing here claims to be an archived
        result.
      </p>

      <div className="ctLStrip" role="list">
        <AutodiffCard />
        <HalfMoonCard />
        <MnistCard />
        <CnnIntroCard />
        <CnnBlocksCard week="4.2" title="CNN CIFAR-10" frozen={false} />
        <CnnBlocksCard week="4.3" title="CNN transfer" frozen />
        <RnnCard onExpand={onExpand} />
        <AutoencoderCard />
        <VaeCard />
        <GanCard />
        <ForwardCard />
      </div>

      {expanded && (
        <div className="ctLLightbox" onClick={close} role="dialog" aria-modal="true" aria-label={expanded.caption}>
          <div className="ctLLightboxInner" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={expanded.src} alt={expanded.caption} />
            <div className="ctLLightboxCaption">{expanded.caption}</div>
            <button type="button" className="ctBtn ctLLightboxClose" onClick={close}>
              close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
