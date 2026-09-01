"use client";

/**
 * #apriori — A-priori frequent-pair mining on the real Groceries baskets.
 *
 * Loads public/demos/arxiv/baskets.json at runtime, then on every (debounced)
 * min-support change re-runs the live getFrequentItemsets + calculateLift from
 * ../core/apriori (both fast on 14,963 baskets — main thread is fine).
 *
 * The "stream" is a scripted phase sequence (baskets -> counting -> pruned)
 * replayed by remounting the animated column via `key={replayKey}`; the
 * pruning highlight itself stays reactive to the slider even after the replay
 * has finished, so dragging the slider re-greys items live without a full replay.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { getFrequentItemsets, calculateLift, unpairKey } from "@/demos/arxiv/core/apriori";
import { topItemCounts, pairRows, scatterPoints, type BasketsJson } from "./aprioriHelpers";
import "./apriori.css";

const MIN_SUPPORT_MIN = 10;
const MIN_SUPPORT_MAX = 150;
const DEFAULT_SUPPORT = 25;
const SAMPLE_BASKETS = 20;
const TOP_ITEMS = 12;
const TOP_PAIRS = 12;

const BASKET_STAGGER_MS = 55;
const BASKET_DUR_MS = 400;
const COUNT_STAGGER_MS = 45;
const COUNT_DUR_MS = 550;

export default function AprioriCard() {
  const [data, setData] = useState<BasketsJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sliderVal, setSliderVal] = useState(DEFAULT_SUPPORT);
  const [minSupport, setMinSupport] = useState(DEFAULT_SUPPORT);
  const [replayKey, setReplayKey] = useState(0);
  const [phase, setPhase] = useState<"baskets" | "counting" | "pruned">("baskets");
  const timers = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/demos/arxiv/baskets.json")
      .then((r) => {
        if (!r.ok) throw new Error(`baskets.json: ${r.status}`);
        return r.json();
      })
      .then((json: BasketsJson) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // debounce slider -> minSupport used for the live computation
  useEffect(() => {
    const t = window.setTimeout(() => setMinSupport(sliderVal), 150);
    return () => window.clearTimeout(t);
  }, [sliderVal]);

  // stream animation phase sequencing (baskets fly in -> counters fill -> prune)
  useEffect(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (!data) return;
    setPhase("baskets");
    const sampleN = Math.min(SAMPLE_BASKETS, data.baskets.length);
    const basketsDone = sampleN * BASKET_STAGGER_MS + BASKET_DUR_MS + 150;
    const t1 = window.setTimeout(() => setPhase("counting"), basketsDone);
    const countingDone = basketsDone + TOP_ITEMS * COUNT_STAGGER_MS + COUNT_DUR_MS + 200;
    const t2 = window.setTimeout(() => setPhase("pruned"), countingDone);
    timers.current = [t1, t2];
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, replayKey]);

  const computed = useMemo(() => {
    if (!data) return null;
    const { itemCounts, frequentItems, frequentPairs } = getFrequentItemsets(data.baskets, minSupport);
    const lift = calculateLift(itemCounts, frequentPairs, data.baskets.length);
    return { itemCounts, frequentItems, frequentPairs, lift };
  }, [data, minSupport]);

  const top12 = useMemo(() => {
    if (!data || !computed) return [];
    return topItemCounts(computed.itemCounts, data.items, TOP_ITEMS);
  }, [data, computed]);

  const maxTop = top12.length ? top12[0].count : 1;

  const pairs = useMemo(() => {
    if (!data || !computed) return [];
    return pairRows(computed.frequentPairs, computed.lift, data.items, unpairKey, TOP_PAIRS);
  }, [data, computed]);

  const maxLiftInTable = pairs.length ? Math.max(...pairs.map((p) => p.lift)) : 1;

  const scatter = useMemo(() => {
    if (!computed) return [];
    return scatterPoints(computed.frequentPairs, computed.lift);
  }, [computed]);

  const sampleBaskets = useMemo(() => {
    if (!data) return [];
    return data.baskets.slice(0, SAMPLE_BASKETS);
  }, [data]);

  if (error) {
    return <div className="axPanel axA axANote">Failed to load basket data: {error}</div>;
  }
  if (!data || !computed) {
    return <div className="axPanel axA axANote">Loading 14,963 baskets&hellip;</div>;
  }

  const maxCount = scatter.length ? Math.max(...scatter.map((p) => p.count)) : 1;
  const maxLift = scatter.length ? Math.max(...scatter.map((p) => p.lift)) : 1;

  return (
    <div className="axPanel axA">
      <div className="axRow axAHead">
        <h3 className="axAH3">A-priori on 14,963 real baskets</h3>
        <span className="axChip">mirrors get_frequent_itemsets()</span>
        <span className="axChip">mirrors calculate_lift()</span>
        <button type="button" className="axBtn" onClick={() => setReplayKey((k) => k + 1)}>
          Replay
        </button>
      </div>

      <div className="axRow">
        <label className="axSliderLabel">
          min support
          <input
            type="range"
            min={MIN_SUPPORT_MIN}
            max={MIN_SUPPORT_MAX}
            value={sliderVal}
            onChange={(e) => setSliderVal(Number(e.target.value))}
          />
          <span className="axMono">{sliderVal}</span>
        </label>
        <span className="axMono axAReadout">
          {data.baskets.length.toLocaleString()} baskets &middot; {computed.frequentItems.size} frequent items
          &middot; {computed.frequentPairs.size} frequent pairs
        </span>
      </div>

      <div className="axAStream" key={replayKey}>
        <div className="axAStreamCol">
          <div className="axALabel">sample of {sampleBaskets.length} real baskets</div>
          <div className="axABasketList">
            {sampleBaskets.map((basket, i) => (
              <div className="axABasketRow" key={i} style={{ animationDelay: `${i * BASKET_STAGGER_MS}ms` }}>
                <span className="axABasketIdx axMono">#{i + 1}</span>
                {basket.map((item, j) => (
                  <span key={j} className="axAItemChip">
                    {data.items[item]}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="axAStreamCol">
          <div className="axALabel">top {top12.length} items by basket count</div>
          <div className="axACounters">
            {top12.map((it, i) => {
              const below = it.count < minSupport;
              const filled = phase !== "baskets";
              const pruned = phase === "pruned" && below;
              return (
                <div className="axACounterRow" key={it.item} data-pruned={pruned}>
                  <span className="axACounterName">{it.name}</span>
                  <div className="axACounterTrack">
                    <div
                      className="axACounterBar"
                      style={{
                        width: filled ? `${(it.count / maxTop) * 100}%` : "0%",
                        transitionDelay: `${i * COUNT_STAGGER_MS}ms`,
                      }}
                    />
                  </div>
                  <span className="axACounterCount axMono">{it.count}</span>
                </div>
              );
            })}
          </div>
          <div className="axAPruneLine axMono" data-visible={phase === "pruned"}>
            {data.items.length} items &rarr; {computed.frequentItems.size} frequent at support {minSupport}
          </div>
        </div>
      </div>

      <div className="axATables">
        <div className="axATableCol">
          <div className="axALabel">top {pairs.length} frequent pairs</div>
          <div className="axAPairTableWrap">
            <table className="axAPairTable">
              <thead>
                <tr>
                  <th>pair</th>
                  <th>count</th>
                  <th>lift</th>
                </tr>
              </thead>
              <tbody>
                {pairs.map((p) => (
                  <tr key={`${p.a}-${p.b}`}>
                    <td>
                      {p.nameA} &times; {p.nameB}
                    </td>
                    <td className="axMono">{p.count}</td>
                    <td>
                      <div className="axALiftCell">
                        <div className="axALiftTrack">
                          <div
                            className="axALiftBar"
                            style={{ width: `${Math.min(100, (p.lift / maxLiftInTable) * 100)}%` }}
                          />
                        </div>
                        <span className="axMono">{p.lift.toFixed(2)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="axATableCol">
          <div className="axALabel">lift vs count &middot; all {scatter.length} frequent pairs</div>
          <svg className="axAScatter" viewBox="0 0 320 170" preserveAspectRatio="xMidYMid meet">
            <line x1="34" y1="140" x2="310" y2="140" className="axAAxis" />
            <line x1="34" y1="10" x2="34" y2="140" className="axAAxis" />
            <text x="34" y="156" className="axAAxisLabel">
              count &rarr;
            </text>
            <text x="4" y="12" className="axAAxisLabel">
              lift
            </text>
            {scatter.map((p, i) => (
              <circle
                key={i}
                cx={34 + (p.count / maxCount) * 270}
                cy={140 - (p.lift / maxLift) * 125}
                r={2.6}
                className="axAScatterDot"
              />
            ))}
          </svg>
        </div>
      </div>

      <p className="axNote">
        The real Groceries dataset from the course exercise, aggregated to one basket per (member, date):
        38,765 rows into 14,963 baskets over 167 items.
      </p>
    </div>
  );
}
