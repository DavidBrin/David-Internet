"use client";

import type { ReactNode } from "react";

/** One bit as a small square lamp. Click handler makes it a toggle. */
export function Bit({
  value,
  label,
  onClick,
  title,
  size = "md",
}: {
  value: number;
  label?: string;
  onClick?: () => void;
  title?: string;
  size?: "sm" | "md";
}) {
  const cls = `shelfBit ${value ? "isOn" : ""} ${onClick ? "isClickable" : ""} ${size === "sm" ? "isSm" : ""}`;
  const inner = (
    <>
      <span className="shelfBitVal">{value}</span>
      {label && <span className="shelfBitLabel">{label}</span>}
    </>
  );
  if (onClick)
    return (
      <button type="button" className={cls} onClick={onClick} title={title} aria-pressed={!!value}>
        {inner}
      </button>
    );
  return (
    <span className={cls} title={title}>
      {inner}
    </span>
  );
}

/** A row of bits, MSB on the left. `onToggle(i)` makes them editable. */
export function BitRow({
  value,
  width,
  onToggle,
  prefix,
  labels,
  size,
}: {
  value: number;
  width: number;
  onToggle?: (i: number) => void;
  prefix?: string;
  labels?: boolean;
  size?: "sm" | "md";
}) {
  const bits: ReactNode[] = [];
  for (let i = width - 1; i >= 0; i--) {
    bits.push(
      <Bit
        key={i}
        value={(value >>> i) & 1}
        label={labels ? `${prefix ?? ""}${i}` : undefined}
        onClick={onToggle ? () => onToggle(i) : undefined}
        size={size}
      />,
    );
  }
  return <span className="shelfBitRow">{bits}</span>;
}

export function PlayControls({
  running,
  onToggle,
  onStep,
  onReset,
  reduced,
  speed,
  onSpeed,
  speedLabel = "speed",
  min = 1,
  max = 60,
}: {
  running: boolean;
  onToggle: () => void;
  onStep: () => void;
  onReset?: () => void;
  reduced: boolean;
  speed?: number;
  onSpeed?: (v: number) => void;
  speedLabel?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="demoControls shelfPlay">
      {!reduced && (
        <button type="button" className={`demoBtn ${running ? "isActive" : "isPrimary"}`} onClick={onToggle}>
          {running ? "Pause" : "Run"}
        </button>
      )}
      <button type="button" className="demoBtn" onClick={onStep}>
        Step
      </button>
      {onReset && (
        <button type="button" className="demoBtn" onClick={onReset}>
          Reset
        </button>
      )}
      {speed !== undefined && onSpeed && !reduced && (
        <label>
          {speedLabel}
          <input type="range" min={min} max={max} value={speed} onChange={(e) => onSpeed(Number(e.target.value))} />
          <span className="demoMono shelfSpeed">{speed}</span>
        </label>
      )}
      {reduced && <span className="demoNote">Reduced motion: stepping only.</span>}
    </div>
  );
}

export function bin(v: number, w: number): string {
  return (v >>> 0).toString(2).padStart(w, "0").slice(-w);
}

export function hex(v: number, w: number): string {
  return "0x" + (v >>> 0).toString(16).toUpperCase().padStart(Math.ceil(w / 4), "0");
}
