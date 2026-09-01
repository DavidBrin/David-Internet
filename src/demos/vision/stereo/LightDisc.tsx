"use client";

/**
 * Draggable hemisphere widget: the user picks a light direction (lx,ly) on the unit
 * disc, lz = sqrt(1-lx^2-ly^2) fills in the "coming toward you" component. Calls
 * onChange live on every pointermove while dragging.
 */
import { useCallback, useEffect, useRef } from "react";

export default function LightDisc({
  light,
  onChange,
  size = 96,
}: {
  light: [number, number, number];
  onChange: (l: [number, number, number]) => void;
  size?: number;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const posFromEvent = useCallback(
    (e: PointerEvent | React.PointerEvent) => {
      const el = wrapRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const r = rect.width / 2;
      let x = (e.clientX - cx) / r;
      let y = (e.clientY - cy) / r;
      const m = Math.hypot(x, y);
      if (m > 1) {
        x /= m;
        y /= m;
      }
      const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
      return [x, -y, z] as [number, number, number];
    },
    [],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      draggingRef.current = true;
      (e.target as Element).setPointerCapture(e.pointerId);
      const p = posFromEvent(e);
      if (p) onChange(p);
    },
    [onChange, posFromEvent],
  );

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const p = posFromEvent(e);
      if (p) onChange(p);
    };
    const up = () => {
      draggingRef.current = false;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onChange, posFromEvent]);

  const dotX = (light[0] * 0.5 + 0.5) * 100;
  const dotY = (-light[1] * 0.5 + 0.5) * 100;

  return (
    <div
      ref={wrapRef}
      className="vsStDisc"
      style={{ width: size, height: size }}
      onPointerDown={onPointerDown}
      role="slider"
      aria-label="Light direction"
      aria-valuetext={`x ${light[0].toFixed(2)}, y ${light[1].toFixed(2)}, z ${light[2].toFixed(2)}`}
    >
      <div className="vsStDiscRing" />
      <div className="vsStDiscCross" />
      <div
        className="vsStDiscDot"
        style={{ left: `${dotX}%`, top: `${dotY}%` }}
      />
    </div>
  );
}
