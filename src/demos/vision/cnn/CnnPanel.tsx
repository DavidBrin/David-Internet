"use client";

import { useEffect, useState } from "react";
import "./cnn.css";
import ConfigCards from "./ConfigCards";
import TransferChart from "./TransferChart";
import FigStrip from "@/demos/vision/FigStrip";
import type { CnnCurves } from "./types";

export default function CnnPanel() {
  const [data, setData] = useState<CnnCurves | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/demos/vision/cnn/curves.json")
      .then((r) => r.json())
      .then((j: CnnCurves) => {
        if (live) setData(j);
      })
      .catch(() => {
        if (live) setError(true);
      });
    return () => {
      live = false;
    };
  }, []);

  if (error) {
    return <div className="vsPanel vsStub">CNN curves data failed to load.</div>;
  }
  if (!data) {
    return <div className="vsPanel vsStub">Loading CNN curves&hellip;</div>;
  }

  return (
    <div className="vsPanel vsCn">
      <div className="vsRow">
        <span className="vsChip">mirrors train()/test()</span>
        <span className="vsChip">labels 0-4 -&gt; 5-9 transfer</span>
      </div>

      <h3 className="vsCnSubhead">FashionMNIST: optimizer x dropout</h3>
      <ConfigCards runs={data.fashionMnist} />

      <h3 className="vsCnSubhead">STL-10 transfer study</h3>
      <TransferChart epochs={data.transferEpochs} runs={data.transfer} />

      <div className="vsNote">{data.note}</div>

      <FigStrip panel="cnn" label="Real notebook figures" />
    </div>
  );
}
