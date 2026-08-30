# Nocturnal Neuro — demo page

Live at [/demos/nocturnal](/demos/nocturnal). A demo built inside David's Internet, not a vendored project: the archive it was made from lives in `demos/nocturnal_neuro_raw/` (KiCad project, BOM, DigiKey order, the EEG recording, the DSP notebook, the business canvases), the completed notebook in `demos/nocturnal_src/dsp.py`, and the build script in `scripts/demos/nocturnal.ts` + `nocturnal_prep.py`.

## What is on the page

**PCB layer explorer.** The reworked OpenBCI Ganglion — a 61 mm four-layer octagon with 140 footprints — rendered layer by layer from the `.kicad_pcb` with `kicad-cli` at build time. Drag or use the slider to explode the eight layers (silk, mask, copper × 4, mask, silk) plus the drill hits along a tilted axis; click a layer label to isolate it; flip to the bottom. Hover any footprint for its BOM line, and for the four substituted parts the note that justified the swap plus the DigiKey order line. Filters: substituted, passives, ICs, connectors, not sourced.

**Schematic tour.** The four sheets exported from KiCad, with pan/zoom and six hotspots (analog front end, instrumentation amplifiers, input protection, references/bias, power and radio, sensors) that explain the block and pulse the matching parts on the board.

**Brainwave lab.** David's own `HELLOworld` recording — 20 EEG channels in the 10-20 layout, Cognionics headset, 2024-12-06 — shipped at 250 Hz as int16 (627 KB) and processed live: pick electrodes on the head map, play the recording, toggle the notebook's pipeline (lowpass + downsample, 60 Hz notch, common-average reference) with a before/after PSD, and watch Welch coherence between any two electrodes as the window scrubs. The TypeScript ports are tested against SciPy on a slice of the recording (`tests/nocturnal-eeg.test.ts`, fixture generated at build).

**Venture strip.** The Business Model Canvas, Value Proposition Canvas and Empathy Map from The Basement's launch program (UC San Diego, Nov 2024) as flip cards.

## What was completed or fixed

- `DSP.ipynb` — the "Signal Filtering" cell was commented out and unfinished; `dsp.py` completes it as `filter_and_downsample` (the draft's lowpass cutoff was the target rate rather than half of it — the anti-alias cutoff is now `f_ds / 2`), adds a 60 Hz notch and common-average referencing, and fixes `convert_eeg_to_edf`, whose reshape assumed channel-major data while the Cognionics/BrainVision export is sample-major.
- The BOM CSV's right-hand columns are free-form; the prep script normalises them into `status: asIs | substituted | notFound` and matches each line to the DigiKey order by manufacturer part number (39 of 41 match; the two unmatched are the parts marked "not found").
- The prep script's `.kicad_pcb` parser only reads what the page needs: footprint reference, value, layer, position and pad extent, plus the Edge.Cuts extent so hit-areas line up with `kicad-cli`'s board-area page.

## Building

```
pnpm sync-demos nocturnal   # needs kicad-cli 8 (KICAD_CLI=<path> to override) and py -3.12 with numpy/scipy/pypdfium2/Pillow
pnpm test                   # includes the SciPy fixture tests for filters.ts / coherence.ts
```

## Attribution and what does not ship

The OpenBCI Ganglion is open-source hardware by OpenBCI, Inc.; the page says "rework of" and the footprint/symbol libraries are OpenBCI's. The KiCad project, Gerbers and the raw BrainVision recording are not shipped — see `demos/nocturnal_src/HARDWARE_FILES.md`. The recording is David's own (the header holds an impedance table and a timestamp, no personal fields). The canvases use Strategyzer / Gamestorming templates; their content is David's.
