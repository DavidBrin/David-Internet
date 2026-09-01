"use client";

import { useEffect, useState } from "react";
import "./bow.css";
import PipelineStrip from "./PipelineStrip";
import AccuracyTable from "./AccuracyTable";
import BayesCard from "./BayesCard";
import FigStrip from "@/demos/vision/FigStrip";
import type { BowResults } from "./types";

export default function BowPanel() {
  const [data, setData] = useState<BowResults | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/demos/vision/bow/bow_results.json")
      .then((r) => r.json())
      .then((j: BowResults) => {
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
    return <div className="vsPanel vsStub">Bag-of-words data failed to load.</div>;
  }
  if (!data) {
    return <div className="vsPanel vsStub">Loading bag-of-words results&hellip;</div>;
  }

  return (
    <div className="vsPanel vsBw">
      <PipelineStrip data={data} />

      <h3 className="vsBwSubhead">Accuracy across k, sampling and features</h3>
      <AccuracyTable data={data} />

      <h3 className="vsBwSubhead">Naive Bayes on word counts</h3>
      <BayesCard bayes={data.bayes} />

      <FigStrip panel="bow" />
    </div>
  );
}
