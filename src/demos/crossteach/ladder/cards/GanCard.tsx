"use client";

/**
 * 7.3 GANs -- explanation card. Two facing blocks with a loss "tug of war"
 * bar between them; both fills animate on a fixed CSS loop (auto-runs on
 * mount, no button needed).
 */
import { CardShell, Illustration } from "./CardShell";

export default function GanCard() {
  return (
    <CardShell week="7.3" title="GANs">
      <p className="ctLBody">
        A generator tries to fabricate samples realistic enough to fool a discriminator,
        while the discriminator tries to tell real from fake; each network&apos;s loss
        pulls against the other&apos;s, training in the same loop toward a moving target.
      </p>
      <div className="ctLGan">
        <div className="ctLGanBlock ctLGanGen">generator</div>
        <div className="ctLGanTug" aria-hidden="true">
          <div className="ctLGanTugFillGen" />
          <div className="ctLGanTugFillDis" />
        </div>
        <div className="ctLGanBlock ctLGanDis">discriminator</div>
      </div>
      <Illustration>
        illustration -- the tug-of-war bar animates on a fixed loop, not measured loss
        curves
      </Illustration>
    </CardShell>
  );
}
