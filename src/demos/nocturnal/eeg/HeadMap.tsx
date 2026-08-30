"use client";

import { useState } from "react";
import { formatImpedance, isBadContact, type EegChannel } from "./data";

/** Standard 10-20 top-view layout coordinates (x right, y towards the nose), unit head radius. */
const POS: Record<string, [number, number]> = {
  Fp1: [-0.31, 0.95],
  Fp2: [0.31, 0.95],
  F7: [-0.81, 0.59],
  F3: [-0.4, 0.52],
  Fz: [0, 0.5],
  F4: [0.4, 0.52],
  F8: [0.81, 0.59],
  T3: [-1, 0],
  C3: [-0.5, 0],
  Cz: [0, 0],
  C4: [0.5, 0],
  T4: [1, 0],
  P7: [-0.81, -0.59],
  P3: [-0.4, -0.52],
  Pz: [0, -0.5],
  P4: [0.4, -0.52],
  P8: [0.81, -0.59],
  O1: [-0.31, -0.95],
  O2: [0.31, -0.95],
  A2: [1.15, 0.05], // right earlobe / mastoid reference
};

interface Props {
  channels: EegChannel[];
  /** Selected names in click order: [A] or [A, B]. */
  selected: string[];
  colors: [string, string];
  onSelect: (names: string[]) => void;
}

export default function HeadMap({ channels, selected, colors, onSelect }: Props) {
  const [hover, setHover] = useState<string | null>(null);

  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onSelect(selected.filter((s) => s !== name));
    } else if (selected.length < 2) {
      onSelect([...selected, name]);
    } else {
      onSelect([selected[1], name]); // the third click replaces the oldest
    }
  };

  const hovered = hover ? channels.find((c) => c.name === hover) : null;
  const R = 1.12;

  return (
    <div>
      <svg className="nnE-head" viewBox="-1.42 -1.36 2.84 2.6" role="group" aria-label="10-20 electrode map">
        {/* ears */}
        <path className="nnE-headOutline" d={`M ${-R} -0.18 C ${-R - 0.16} -0.18 ${-R - 0.16} 0.18 ${-R} 0.18`} />
        <path className="nnE-headOutline" d={`M ${R} -0.18 C ${R + 0.16} -0.18 ${R + 0.16} 0.18 ${R} 0.18`} />
        {/* nose */}
        <path className="nnE-headOutline" d={`M -0.14 ${-R + 0.01} L 0 ${-R - 0.16} L 0.14 ${-R + 0.01}`} />
        <circle className="nnE-headOutline" cx={0} cy={0} r={R} />
        {channels.map((ch) => {
          const p = POS[ch.name];
          if (!p) return null;
          const idx = selected.indexOf(ch.name);
          const bad = isBadContact(ch);
          const cls = ["nnE-electrode", bad ? "isBad" : "", idx === 0 ? "isA" : idx === 1 ? "isB" : ""].join(" ");
          const fill = idx >= 0 ? colors[idx] : undefined;
          return (
            <g
              key={ch.name}
              className={cls}
              transform={`translate(${p[0]} ${-p[1]})`}
              onClick={() => toggle(ch.name)}
              onMouseEnter={() => setHover(ch.name)}
              onMouseLeave={() => setHover((h) => (h === ch.name ? null : h))}
              role="button"
              aria-pressed={idx >= 0}
              aria-label={`${ch.name}, ${formatImpedance(ch.impedanceKohm)}${bad ? ", poor contact" : ""}`}
            >
              <title>
                {ch.name} · {formatImpedance(ch.impedanceKohm)}
                {bad ? " · poor contact" : ""}
              </title>
              <circle r={0.115} style={fill ? { fill } : undefined} />
              <text>{ch.name}</text>
            </g>
          );
        })}
      </svg>
      <p className="nnE-hover">
        {hovered ? (
          <>
            <b>{hovered.name}</b> · {formatImpedance(hovered.impedanceKohm)}
            {hovered.offsetMv !== null ? ` · offset ${hovered.offsetMv} mV` : ""}
            {isBadContact(hovered) ? " · poor contact" : ""}
          </>
        ) : (
          "click one or two electrodes · hover for impedance"
        )}
      </p>
      <div className="nnE-legend">
        <span>
          <i className="nnE-swatch" style={{ background: colors[0] }} />A
        </span>
        <span>
          <i className="nnE-swatch" style={{ background: colors[1] }} />B
        </span>
        <span>
          <i className="nnE-swatch isBad" />
          poor contact
        </span>
      </div>
    </div>
  );
}
