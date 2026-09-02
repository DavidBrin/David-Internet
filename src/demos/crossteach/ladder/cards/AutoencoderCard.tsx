"use client";

/**
 * 7.1 Autoencoder -- explanation card. Hourglass diagram: bar widths shrink
 * toward a bottleneck then widen back out, dimension labels alongside.
 */
import { CardShell, Illustration } from "./CardShell";

const STAGES = [
  { label: "input", dim: 784, w: 100 },
  { label: "enc", dim: 256, w: 74 },
  { label: "enc", dim: 64, w: 50 },
  { label: "z", dim: 16, w: 26 },
  { label: "dec", dim: 64, w: 50 },
  { label: "dec", dim: 256, w: 74 },
  { label: "out", dim: 784, w: 100 },
];

export default function AutoencoderCard() {
  return (
    <CardShell week="7.1" title="Autoencoder">
      <p className="ctLBody">
        The encoder squeezes the input down to a small bottleneck (the code), and the
        decoder tries to rebuild the original from just that bottleneck -- forcing the
        network to learn a compact representation instead of copying pixels.
      </p>
      <div className="ctLHourglass">
        {STAGES.map((s, i) => (
          <div key={i} className="ctLHourglassCol">
            <div className="ctLHourglassBar" style={{ width: `${s.w}%` }} />
            <span className="ctLHourglassDim ctMono">{s.dim}</span>
          </div>
        ))}
      </div>
      <div className="ctRow">
        <span className="ctLHourglassTag">encoder</span>
        <span className="ctLHourglassTag ctLHourglassTagZ">bottleneck</span>
        <span className="ctLHourglassTag">decoder</span>
      </div>
      <Illustration>illustration -- layer widths are schematic, not literal pixel renders</Illustration>
    </CardShell>
  );
}
