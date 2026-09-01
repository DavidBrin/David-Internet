"use client";

/**
 * Phone replica — same copy/layout as demos/hardhack_src/ContentView.swift:
 * header, ONLINE/OFFLINE pill, "WATT'S UP?", SYSTEM ARMED/SECURE card with the
 * red toggle, LIVE TRANSMISSION LOG, "Reset Network Link". The toggle only calls
 * the action — sim.armed is read straight off the sim, so it visibly lags ~0.5 s
 * behind the tap while the C packet rides down the chain. That lag is the point.
 */
import { useEffect, useRef } from "react";
import type { SimState } from "../sim/core";
import type { SimHandle } from "../sim/store";

export default function Phone({ sim, actions }: { sim: SimState; actions: SimHandle["actions"] }) {
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [sim.phoneLog.length]);

  const armed = sim.armed;

  return (
    <div className="hhWirePhone">
      <div className="hhWirePhoneHeader">
        <span className="hhWirePhoneSignal" data-online={sim.phoneOnline} aria-hidden="true" />
        <span className="hhWirePhoneBrand">HARDHACK 2026</span>
        <span className={`hhWirePhonePill${sim.phoneOnline ? " hhWirePhonePill--online" : " hhWirePhonePill--offline"}`}>
          <i />
          {sim.phoneOnline ? "ONLINE" : "OFFLINE"}
        </span>
      </div>

      <div className="hhWirePhoneTitle">{"WATT'S UP?"}</div>

      <div className={`hhWirePhoneCard${armed ? " hhWirePhoneCard--armed" : ""}`}>
        <div className="hhWirePhoneCardIcon">{armed ? "⚠" : "✓"}</div>
        <div className="hhWirePhoneCardText">
          <div className="hhWirePhoneCardTitle">{armed ? "SYSTEM ARMED" : "SYSTEM SECURE"}</div>
          <div className="hhWirePhoneCardSub">{armed ? "Motion triggers siren" : "Monitoring standby"}</div>
        </div>
        <label className="hhWirePhoneToggle">
          <input type="checkbox" checked={armed} onChange={() => actions.setArmedFromPhone(!armed)} aria-label="Arm/disarm system" />
          <span className="hhWirePhoneToggleTrack">
            <span className="hhWirePhoneToggleThumb" />
          </span>
        </label>
      </div>

      <div className="hhWirePhoneLogWrap">
        <div className="hhWirePhoneLogHead">LIVE TRANSMISSION LOG</div>
        <div className="hhWirePhoneLog" ref={logRef}>
          {sim.phoneLog.map((l, i) => (
            <div key={`${l.t}-${i}`} className={`hhWirePhoneLogLine hhWirePhoneLogLine--${l.tone}`}>
              {l.text}
            </div>
          ))}
        </div>
      </div>

      <div className="hhWirePhoneFooter">
        <button type="button" className="hhBtn hhWirePhoneReset" onClick={() => actions.resetNetwork()}>
          {"↻ Reset Network Link"}
        </button>
        <div className="hhNote hhWirePhoneReconnects">reconnects: {sim.wifiReconnects}</div>
        <div className="hhWirePhoneCredits">Created by Brent, Alex, Aarnav &amp; David</div>
      </div>
    </div>
  );
}
