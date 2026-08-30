/** Authored hotspots for the schematic tour. `refs` must exist in sch/symbols.json for that sheet
 *  (the marker is placed on their bounding box); `boardRefs` are what the board pulses. */

export type SheetKey = "root" | "references" | "tvs" | "sensors";

export interface Hotspot {
  id: string;
  sheet: SheetKey;
  title: string;
  refs: string[];
  body: string;
  boardRefs?: string[];
}

export const HOTSPOTS: Hotspot[] = [
  {
    id: "afe",
    sheet: "root",
    title: "Delta-sigma AFE — MCP3912",
    refs: ["U7", "C18", "C19", "C20", "R38"],
    body:
      "U7 is a Microchip MCP3912: four simultaneously-sampled 24-bit delta-sigma ADCs with programmable gain, sold as an energy-metering front end and repurposed here to digitise microvolt-level biopotentials. It talks SPI to the Simblee and needs almost no support parts — decoupling and a crystal-free internal clock.",
    boardRefs: ["U7"],
  },
  {
    id: "inamps",
    sheet: "root",
    title: "Instrumentation amplifiers — AD8237 ×4",
    refs: ["U2", "U3", "U4", "U5", "R15", "R16", "R17", "R18", "R19", "R20", "R21", "R22"],
    body:
      "One AD8237 per channel: a micropower, zero-drift, rail-to-rail instrumentation amplifier that rejects the common-mode mains pickup on the electrode pair. Gain is set by the feedback divider (100 kΩ / 2 kΩ, R15–R22), i.e. 1 + 100k/2k = ×51 before the ADC.",
    boardRefs: ["U2", "U3", "U4", "U5", "R15", "R16", "R17", "R18", "R19", "R20", "R21", "R22"],
  },
  {
    id: "dip",
    sheet: "root",
    title: "Channel mode switches — CJS-1200",
    refs: ["SW1", "SW2", "SW3", "SW4"],
    body:
      "SW1–SW4 are two-position DIP slide switches, one per channel. They route each amplifier's negative input either to the channel's own second electrode pin (differential) or to the shared REF electrode (single-ended, the usual EEG hookup).",
  },
  {
    id: "mcu",
    sheet: "root",
    title: "BLE + MCU — Simblee RFD77101",
    refs: ["U8"],
    body:
      "U8 is RF Digital's Simblee: an nRF51822 (Cortex-M0, 2.4 GHz BLE) module with the antenna and radio front end on-board, programmed like an Arduino. It streams the four channels plus accelerometer over BLE. RF Digital has since folded and the module is not sourceable — it is the one part the BOM could not place.",
  },
  {
    id: "power",
    sheet: "root",
    title: "Power — battery, LDOs, supervisor",
    refs: ["B1", "SW5", "D1", "U9", "U11", "U10"],
    body:
      "A LiPo on the JST-PH connector B1 feeds the slide switch SW5 and a Schottky diode D1 for reverse protection. Two NCP551 150 mA low-quiescent LDOs (U9, U11) make separate analog and digital 3 V rails, and U10, an NCP300 voltage detector, holds the MCU in reset when the battery sags below threshold.",
  },
  {
    id: "refs",
    sheet: "references",
    title: "Reference & bias generation",
    refs: ["U1", "U24", "U26", "U27", "R34", "R35", "R36", "R48", "R1", "R10", "R12", "R13", "R14", "R29", "R30", "R31"],
    body:
      "Four MCP6V31 zero-drift op-amps buffer the mid-rail reference and drive the electrode bias so the inputs sit inside the amplifiers' common-mode range. The 500 kΩ resistors (R34–R36, R48) limit current into the body, and the RC networks (R1/C9, R10/C37, …) low-pass the reference so no noise is injected back into the front end.",
    boardRefs: ["U1", "U24", "U26", "U27", "R34", "R35", "R36", "R48"],
  },
  {
    id: "tvs",
    sheet: "tvs",
    title: "Input protection — TPD4E1B06 TVS arrays",
    refs: ["U28", "U29", "U30"],
    body:
      "Every electrode input passes a TPD4E1B06 four-channel TVS/ESD array before it reaches an amplifier. The diodes clamp static discharge and any stray voltage from the leads to the rails while adding only ~0.5 pF, which keeps the input impedance high enough for dry electrodes.",
  },
  {
    id: "dac",
    sheet: "sensors",
    title: "Bias DAC & buffers — AD5621, op-amps",
    refs: ["U12", "U14", "U15", "R39", "R40", "R41", "R42", "R43", "R44", "R45"],
    body:
      "U12 is an AD5621 12-bit nanoDAC on SPI. Its output, buffered and scaled by the op-amps U14/U15 and the R39–R45 network, lets firmware trim the electrode bias / impedance-test drive instead of relying on a fixed divider.",
  },
  {
    id: "mux",
    sheet: "sensors",
    title: "Analog switches — 74LVC1G66 ×5",
    refs: ["U18", "U19", "U20", "U21", "U22", "U16", "U23A", "U23B"],
    body:
      "Five 74LVC1G66 single bilateral switches, steered by the OR gate U16 and the NAND U23, gate the shared SPI lines so the ADC, accelerometer and SD socket can be driven from the Simblee's limited pin count without bus contention.",
    boardRefs: ["U18", "U19", "U20", "U21", "U22", "U16", "U23"],
  },
  {
    id: "accel",
    sheet: "sensors",
    title: "Accelerometer — LIS2DE12",
    refs: ["U17", "C41", "C42"],
    body:
      "U17 is an ST LIS2DE12 three-axis, ultra-low-power (8-bit) accelerometer on I²C. It is sampled alongside the EEG channels so movement artefacts can be tagged in the stream and the headset's orientation tracked.",
  },
  {
    id: "sd",
    sheet: "sensors",
    title: "microSD socket — ST-TF-003A",
    refs: ["U13", "C35"],
    body:
      "A push-push microSD socket (U13) with its bulk capacitor C35 gives the board local logging when a BLE link is unavailable. The socket in the original BOM is a Seeed part with no DigiKey listing; C35 was re-sourced as a Samsung 47 µF 0805.",
  },
];
