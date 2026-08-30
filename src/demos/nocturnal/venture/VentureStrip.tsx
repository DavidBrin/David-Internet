"use client";

import { useState } from "react";
import "./venture.css";

interface Card {
  key: "bmc" | "vpc" | "empathy";
  title: string;
  date: string;
  takeaways: string[];
}

/** Front = the rasterised canvas from the raw PDF; back = what it said, in three lines. */
const CARDS: Card[] = [
  {
    key: "bmc",
    title: "Business Model Canvas",
    date: "21 Nov 2024",
    takeaways: [
      "Value proposition: an EEG headset plus a diagnostic ML model as an objective aid for psychiatrists — bipolar disorder and depression are routinely confused, and a diagnosis can take 7–13 years.",
      "Customers: mental-health professionals who prescribe, the patients themselves, and their caregivers; channels through clinics, direct sales and a 5% referral for practitioners.",
      "Money: $90 for a three-month subscription then $1/day; costs dominated by R&D and clinical trials, then headset production.",
    ],
  },
  {
    key: "vpc",
    title: "Value Proposition Canvas",
    date: "25 Nov 2024",
    takeaways: [
      "Customer jobs: diagnose and treat bipolar disorder and MDD, and get patients onto the correct treatment plan sooner.",
      "Pains: years to an accurate diagnosis, time lost in the wrong treatment, no quantitative data behind the decision, and the stigma of talking to yet another provider.",
      "Products: an EEG headset with a diagnostic algorithm, and a subscription to recurring EEG monitoring so symptoms and brain activity can be tracked over time.",
    ],
  },
  {
    key: "empathy",
    title: "Empathy Map",
    date: "25 Nov 2024",
    takeaways: [
      "Who: psychiatrists, primary-care providers and mental-health professionals — and their patients with bipolar disorder or MDD.",
      "What they say: clinicians are open to new tools because prescribing the right medication is hard when bipolar II and MDD look alike; patients say they don't always trust a subjective diagnosis.",
      "What they need: quicker, more concrete methods of diagnosis and monitoring to confirm that a treatment is working.",
    ],
  },
];

export default function VentureStrip() {
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const flip = (k: string) => setFlipped((f) => ({ ...f, [k]: !f[k] }));

  return (
    <div>
      <div className="nnV-grid">
        {CARDS.map((c) => (
          <div key={c.key} className={`nnV-card${flipped[c.key] ? " isFlipped" : ""}`}>
            <button
              type="button"
              className="nnV-inner"
              onClick={() => flip(c.key)}
              aria-pressed={!!flipped[c.key]}
              aria-label={`${c.title} — flip to read the takeaways`}
            >
              <div className="nnV-face nnV-front">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/demos/nocturnal/venture/${c.key}.webp`} alt={`${c.title}, ${c.date}`} loading="lazy" />
                <div className="nnV-label">
                  <b>{c.title}</b>
                  <span>{c.date} · click to flip</span>
                </div>
              </div>
              <div className="nnV-face nnV-back">
                <b>{c.title}</b>
                <ul>
                  {c.takeaways.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            </button>
          </div>
        ))}
      </div>
      <p className="demoNote">
        Made for The Basement&rsquo;s launch program at UC San Diego, November 2024 (Strategyzer-style templates; content is David&rsquo;s).
        The canvases frame the venture as an overnight EEG monitor whose data helps clinicians tell bipolar disorder and depression apart; it stopped at the prototype stage described on this page.
      </p>
    </div>
  );
}
