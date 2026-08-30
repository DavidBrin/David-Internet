# Nocturnal Neuro — hardware files (not shipped)

The KiCad project lives in the archive at `demos/nocturnal_neuro_raw/kicad_ganglion_pcb/` and never
leaves this repository's build machine. Every board/schematic asset on the demo page is derived from
it by `scripts/demos/nocturnal.ts` (`pnpm sync-demos nocturnal`) and committed under
`public/demos/nocturnal/`.

## What is in the project

| File | What | Used for |
|---|---|---|
| `Ganglion_PCB.kicad_pcb` (1.7 MB, KiCad 8) | The reworked four-layer board: 141 footprints (140 parts + the OpenBCI logo), 61.4 × 61.4 mm octagon, aux origin set for the fab | `kicad-cli pcb export svg` per layer → `pcb/*.svg`; footprint refs/positions/pad extents → `pcb/footprints.json` |
| `Ganglion BOM/*.gbr`, `*.drl`, `*.gbrjob` | Gerber + Excellon fab outputs (KiCad 8.0.6, 2024-11-04) | The drill files → `pcb/footprints.json → drills` (PTH vias 0.4 mm, component holes 1.016 mm, NPTH 0.9 mm) |
| `Ganglion_PCB.kicad_sch` (root, B size) | Power, the four AD8237 input amplifiers, MCP3912 AFE, DIP switches, headers, the Simblee module | `kicad-cli sch export svg` → `sch/root.svg` |
| `References.kicad_sch` ("INPUT_V_REF") | Reference / bias generation: MCP6V31 op-amps and 500 kΩ networks | `sch/references.svg` |
| `TVS.kicad_sch` ("INPUT_PROTECTION") | TPD4E1B06 TVS arrays on the electrode inputs | `sch/tvs.svg` |
| `Ganglion_Sensors_01.kicad_sch` ("SENSORS") | Accelerometer, microSD, analog switches, DAC, logic | `sch/sensors.svg` |
| `*.sch`, `*-cache.lib`, `*-rescue.lib`, `report.txt` | The legacy (KiCad 5) sources and the rescue report from re-opening OpenBCI's project in KiCad 8 (2024-11-03) | Story only |
| `OpenBCI_KiCad_library_files/` | OpenBCI's symbol and footprint libraries (`OpenBCI.lib`, `OpenBCI.pretty`) | Rendered inside the exports |
| `Ganglion_01_BOM_CSV.csv` | The BOM (41 lines) with the substitution notes in the right-hand columns | `bom.json` |
| `DigiKey_orderedParts.xlsx` | The DigiKey order: 39 lines, $64.28 | `order.json`, merged into `bom.json` |

## How the exports are simplified

`kicad-cli` SVGs carry an invisible `<text>` copy of every label plus the stroke-font outline as
one `<path>` per segment. The prep script drops the text and descriptions, merges chained
segments into polylines, rounds to 0.01 mm, and (for the board layers) strips colours so the page
can tint each layer with CSS. Sizes: board layers 162 KB (F.Cu) down to 0.6 KB (edge); root sheet
537 KB, the other three 30–180 KB. Nothing is rasterised.

## Provenance

The Ganglion is open-source hardware published by OpenBCI, Inc. (GitHub: `OpenBCI/Ganglion_Hardware_Design_Files`);
its licence terms are stated in that repository and apply to the derived renders here. The rework
(re-capture in KiCad 8, re-layout, symbol rescue, BOM re-sourcing and the DigiKey order) is David's,
Nov 2024. The board was ordered as parts; this page shows the design, not a photographed build.
