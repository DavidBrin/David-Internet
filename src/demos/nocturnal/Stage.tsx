"use client";

import { useCallback, useState } from "react";
import BoardExplorer from "./board/BoardExplorer";
import SchematicTour from "./schematic/SchematicTour";
import BrainwaveLab from "./eeg/BrainwaveLab";
import VentureStrip from "./venture/VentureStrip";
import "./nocturnal.css";

/** Parts a schematic hotspot asked the board to pulse. `nonce` re-triggers the pulse for the same refs. */
export interface BoardHighlight {
  refs: string[];
  nonce: number;
}

export default function NocturnalStage() {
  const [highlight, setHighlight] = useState<BoardHighlight>({ refs: [], nonce: 0 });

  const showOnBoard = useCallback((refs: string[]) => {
    setHighlight((h) => ({ refs, nonce: h.nonce + 1 }));
    document.getElementById("board")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <>
      <section className="demoPanel" id="board">
        <div className="demoPanelHead">
          <h2>PCB layer explorer</h2>
          <p>the reworked Ganglion, rendered from the KiCad project — drag to explode, hover a part for its BOM line</p>
        </div>
        <BoardExplorer highlight={highlight} />
      </section>

      <section className="demoPanel" id="schematic">
        <div className="demoPanelHead">
          <h2>Schematic tour</h2>
          <p>four sheets exported from KiCad; hotspots explain each block and point at the parts on the board</p>
        </div>
        <SchematicTour onShowOnBoard={showOnBoard} />
      </section>

      <section className="demoPanel" id="eeg">
        <div className="demoPanelHead">
          <h2>Brainwave lab</h2>
          <p>a real 20-channel recording and the DSP notebook&rsquo;s pipeline, running in the browser</p>
        </div>
        <BrainwaveLab />
      </section>

      <section className="demoPanel" id="venture">
        <div className="demoPanelHead">
          <h2>Venture strip</h2>
          <p>the three canvases from the Basement launch program, Nov 2024</p>
        </div>
        <VentureStrip />
      </section>
    </>
  );
}
