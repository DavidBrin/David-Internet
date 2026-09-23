"use client";

/**
 * servo_sweeper.py on the PCA9685: channel 0 at 50 Hz over I2C, 500-2500 us for
 * 0-180 deg. move_servo(): set_servo_angle(0), sleep 1 s, set_servo_angle(100),
 * sleep 1 s, disable_servo() (duty 0), rclpy.shutdown().
 */
import { SERVO, servoDuty } from "../core/params";

export type ServoPhase = "idle" | "zero" | "hundred" | "disabled";

const CX = 130,
  CY = 126,
  R = 100;

/** servo angle → point on the dial (0 deg at the left, 180 deg at the right) */
function pt(angle: number, r: number): [number, number] {
  const a = Math.PI - (angle * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
}

export default function ServoDial({ angle, phase }: { angle: number; phase: ServoPhase }) {
  const powered = phase === "zero" || phase === "hundred";
  const { pulseUs, duty } = servoDuty(angle);
  const shownDuty = powered ? duty : 0;
  const [nx, ny] = pt(angle, R - 16);
  const ticks = Array.from({ length: 10 }, (_, i) => i * 20);
  const arc = (a0: number, a1: number, r: number) => {
    const [x0, y0] = pt(a0, r);
    const [x1, y1] = pt(a1, r);
    return `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`;
  };

  const steps: { key: ServoPhase; code: string; note: string }[] = [
    { key: "zero", code: "set_servo_angle(0)", note: "time.sleep(1)" },
    { key: "hundred", code: "set_servo_angle(100)", note: "time.sleep(1)" },
    { key: "disabled", code: "disable_servo()", note: "duty 0, shutdown" },
  ];

  return (
    <div className="acMiServo">
      <svg viewBox="0 0 260 150" className="acMiServoSvg" role="img" aria-label={`scoop arm at ${angle} degrees`}>
        <path d={arc(0, 180, R)} className="acMiServoTrack" />
        <path d={arc(0, 100, R)} className="acMiServoRange" />
        {ticks.map((a) => {
          const [x0, y0] = pt(a, R - 6);
          const [x1, y1] = pt(a, R + 6);
          const [lx, ly] = pt(a, R + 18);
          return (
            <g key={a}>
              <line x1={x0} y1={y0} x2={x1} y2={y1} className="acMiServoTick" />
              {a % 60 === 0 ? (
                <text x={lx} y={ly + 4} textAnchor="middle" className="acMiServoTickLabel">
                  {a}°
                </text>
              ) : null}
            </g>
          );
        })}
        {(() => {
          const [x0, y0] = pt(100, R - 6);
          const [x1, y1] = pt(100, R + 6);
          const [lx, ly] = pt(100, R + 18);
          return (
            <g>
              <line x1={x0} y1={y0} x2={x1} y2={y1} className="acMiServoTick acMiServoTickKey" />
              <text x={lx} y={ly + 4} textAnchor="middle" className="acMiServoTickLabel acMiServoTickKeyText">
                100°
              </text>
            </g>
          );
        })()}
        <line x1={CX} y1={CY} x2={nx} y2={ny} className={`acMiServoArm${powered ? " acMiServoArmOn" : ""}`} />
        <circle cx={CX} cy={CY} r={9} className="acMiServoHub" />
        <text x={CX} y={CY - 26} textAnchor="middle" className="acMiServoAngle">
          {angle.toFixed(0)}°
        </text>
      </svg>
      <div className="acMiServoRead acMono">
        <div className="acMiServoRow">
          <span>pulse</span>
          <b>{powered ? `${pulseUs.toFixed(1)} µs` : "no pulse"}</b>
        </div>
        <div className="acMiServoRow">
          <span>duty_cycle</span>
          <b>{shownDuty}</b>
        </div>
        <div className="acMiServoMath">
          pulse = {SERVO.min_us} + angle/180 × {SERVO.max_us - SERVO.min_us}
          <br />
          duty = int(pulse / {1000000 / SERVO.frequency} × 65535)
          <br />0° → 1638 · 100° → 5279 · off → 0
        </div>
      </div>
      <ol className="acMiServoSeq">
        {steps.map((s) => (
          <li key={s.key} className={phase === s.key ? "acMiServoSeqOn" : undefined}>
            <code>{s.code}</code>
            <span>{s.note}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
