/**
 * The Path — story data. David edits this file; components never hardcode copy.
 *
 * STATUS: design-pass scaffold.
 *   - Dates are fact (résumés — see spec Appendix A).
 *   - All `body` copy is PLACEHOLDER narrative for David to rewrite.
 *   - `messages` is a PLACEHOLDER pool until the "Daily Dose of Damn" export
 *     lands. The desk-etched anchor line is real and fixed.
 *   - Demo slugs without a manifest render as inert "coming soon" stones.
 */
import type { Journey } from "@/lib/journey";

const journey: Journey = {
  hero: {
    // Title pending David's final call (spec §0.1) — "Flowstate" is the recommendation.
    title: "Flowstate",
    subtitle: "meander & milestones",
    tagline: "Flow through the path of my life.",
  },

  phases: [
    {
      id: "roots",
      title: "Roots",
      period: "2017 – 2019",
      kicker: "The source",
      body:
        "Every river starts as weather. A kid in San Diego taking apart robots at Robolink, " +
        "writing songs in a garage band, carving a sentence into a school desk that would " +
        "outlast the desk. [placeholder copy]",
      scene: {
        art: "meadow",
        palette: { sky: "#2c3a63", skyLow: "#f5b880", water: "#8fc3d4", accent: "#d97742", ink: "#42331f" },
        light: "dawn",
        waterMood: "trickle",
      },
      media: [
        { src: "", alt: "Childhood photo (from David)", caption: "photo coming", placeholder: true, reveal: "wash-paper" },
        { src: "", alt: "First robot (from David)", caption: "photo coming", placeholder: true, reveal: "wash-paper" },
      ],
      effect: "etch-anchor",
    },
    {
      id: "high-school",
      title: "Scripps Ranch High",
      period: "2019 – 2023",
      kicker: "Maker & leader",
      body:
        "The stream widens and splits around everything at once — engineering electives, " +
        "robotics club, running a Model UN security council, debate, a newspaper byline, four " +
        "sports. Too many channels, all of them moving. [placeholder copy]",
      scene: {
        art: "suburb",
        palette: { sky: "#7ec4e8", skyLow: "#eaf7fd", water: "#4f9ec4", accent: "#f4a259", ink: "#1d3557" },
        light: "day",
        waterMood: "stream",
      },
      media: [],
      effect: "wash-sand",
      branch: { label: "many threads at once", rejoins: true },
    },
    {
      id: "ventures",
      title: "First ventures & service",
      period: "2019 – 2022",
      kicker: "Tributaries",
      body:
        "Side channels feed the river: pitching Silicon Valley investors with GATSVI at " +
        "fifteen, Red Cross weekends, meal lines with Feeding San Diego, and the first taste " +
        "of teaching — programming camps and a Berkeley data-science cohort. [placeholder copy]",
      scene: {
        art: "ventures",
        palette: { sky: "#f2955e", skyLow: "#ffd9b0", water: "#4f94bd", accent: "#c1553a", ink: "#47281a" },
        light: "dusk",
        waterMood: "stream",
      },
      media: [],
      effect: "fork",
      branch: { label: "service · teaching · a first pitch", rejoins: true },
      demos: [
        { slug: "early-builds", label: "Early builds", status: "in-progress", needsAssets: true },
      ],
    },
    {
      id: "ucsd",
      title: "UC San Diego",
      period: "2023 – 2026",
      kicker: "The sharp meander",
      body:
        "A hard bend into engineering. Regents Scholar, computer engineering, and a first " +
        "year spent soldering for Triton UAS — PCB layouts in Altium for aircraft that had " +
        "to actually fly. [placeholder copy]",
      scene: {
        art: "campus",
        palette: { sky: "#a7d3f2", skyLow: "#eef8ff", water: "#4a90c2", accent: "#ffd166", ink: "#16324f" },
        light: "day",
        waterMood: "stream",
      },
      media: [],
    },
    {
      id: "voytek",
      title: "Voytek Lab",
      period: "Apr 2024 – Jun 2025",
      kicker: "The deepening channel",
      body:
        "A year and change underwater in neuroscience data — patch-clamp rigs, organoid " +
        "multi-electrode arrays, and the pipelines that turn electrical noise into signal. " +
        "[placeholder copy]",
      scene: {
        art: "lab",
        palette: { sky: "#04252a", skyLow: "#0c3f42", water: "#18b3a6", accent: "#7ef9e8", ink: "#d8f7f3" },
        light: "night",
        waterMood: "stream",
      },
      media: [],
      effect: "bounce-demo",
      demos: [
        { slug: "lab-pipelines", label: "Lab demo", status: "in-progress", needsAssets: true },
      ],
    },
    {
      id: "braided",
      title: "The braided reach",
      period: "2024 – 2025",
      kicker: "Concurrent channels",
      body:
        "The river braids: an EEG diagnostic concept one winter, an autonomous car on ROS 2 " +
        "the next spring, a semi-supervised segmentation ensemble in the fall — separate " +
        "channels sharing one valley, re-gathering downstream. [placeholder copy]",
      scene: {
        art: "braid",
        palette: { sky: "#43467f", skyLow: "#8d82c9", water: "#5fa8d3", accent: "#ffd166", ink: "#efeaff" },
        light: "dusk",
        waterMood: "rapids",
      },
      media: [],
      effect: "fork",
      branch: { label: "three projects, one valley", rejoins: true },
      demos: [
        { slug: "nocturnal-neuro", label: "Nocturnal Neuro", status: "in-progress", needsAssets: true },
        { slug: "autonomous-car", label: "Autonomous car", status: "in-progress", needsAssets: true },
        { slug: "microct-segmentation", label: "Microtomography", status: "in-progress", needsAssets: true },
      ],
    },
    {
      id: "dtu",
      title: "DTU, Denmark",
      period: "Fall 2025",
      kicker: "A tributary loop",
      body:
        "A cold, clear detour through Kongens Lyngby — quantum information, databases, deep " +
        "learning — before the loop rejoins the main current. [placeholder copy]",
      scene: {
        art: "nordic",
        palette: { sky: "#b6d6e8", skyLow: "#e9f3f8", water: "#4d7ea8", accent: "#86c7b8", ink: "#24455c" },
        light: "day",
        waterMood: "stream",
      },
      media: [],
      branch: { label: "exchange semester", rejoins: true },
    },
    {
      id: "general-atomics",
      title: "General Atomics",
      period: "Jun 2025 – Jun 2026",
      kicker: "Dark water",
      body:
        "A year in deep industrial blue: embedded C for a camera driver and control system, " +
        "optical-controls experiments, hardware that has no patience for almost-working. " +
        "[placeholder copy]",
      scene: {
        art: "industrial",
        palette: { sky: "#0a1428", skyLow: "#17294a", water: "#2b5f8a", accent: "#5aa9e6", ink: "#cfe3f5" },
        light: "night",
        waterMood: "stream",
      },
      media: [
        { src: "", alt: "General Atomics era photo (from David)", caption: "photo coming", placeholder: true, reveal: "wash-paper" },
      ],
      effect: "wash-paper",
    },
    {
      id: "runup",
      title: "The run-up",
      period: "Jan 2026",
      kicker: "Quickening current",
      body:
        "The current accelerates: a web data-refinery built in a sprint, an embedded-security " +
        "system hacked together at IEEE HardHacks. Something is about to happen. " +
        "[placeholder copy]",
      scene: {
        art: "runup",
        palette: { sky: "#33245c", skyLow: "#ff9e5e", water: "#5a8fc2", accent: "#ff6b35", ink: "#3d1f0f" },
        light: "dawn",
        waterMood: "rapids",
      },
      media: [],
    },
    {
      id: "katalyxt",
      title: "Katalyxt AI — San Francisco",
      period: "Apr 2026 – present",
      kicker: "The built world",
      body:
        "The river reaches the city. Four co-founders — a decade of reps behind them — raise " +
        "a pre-seed from NFX, KP Scout and Long Journey, land four design partners, and hit " +
        "$30K ARR in a one-month sprint. [placeholder copy]",
      scene: {
        art: "sanfrancisco",
        palette: { sky: "#f6bd6b", skyLow: "#fbe3ba", water: "#4a7fa5", accent: "#e4572e", ink: "#40241a" },
        light: "dusk",
        waterMood: "rapids",
      },
      media: [
        { src: "/path/co-founders/gallery/01.jpg", alt: "The co-founders, years before Katalyxt", caption: "a decade of reps — caption pending", reveal: "wash-paper" },
        { src: "/path/co-founders/gallery/25.jpg", alt: "The co-founders, growing up", caption: "caption pending", reveal: "wash-paper" },
        { src: "/path/co-founders/headshots/david.jpg", alt: "David Brin", caption: "David", reveal: "fade" },
        { src: "/path/co-founders/headshots/brennan.jpg", alt: "Brennan Lim", caption: "Brennan", reveal: "fade" },
        { src: "/path/co-founders/headshots/sahil.jpg", alt: "Sahil Simma", caption: "Sahil", reveal: "fade" },
        { src: "/path/co-founders/headshots/dilan.jpg", alt: "Dilan Doshi", caption: "Dilan", reveal: "fade" },
      ],
      effect: "wash-paper",
      links: [{ label: "katalyxt.ai", href: "https://katalyxt.ai", external: true }],
    },
    {
      id: "delta",
      title: "The delta",
      period: "2026",
      kicker: "Distributaries",
      body:
        "At the mouth, the river fans out into the replicas of David's Internet — each " +
        "distributary ends at a project you can visit. [placeholder copy]",
      scene: {
        art: "delta",
        palette: { sky: "#93c5c5", skyLow: "#e2f0ec", water: "#3f7f7a", accent: "#e0b25c", ink: "#1f4442" },
        light: "day",
        waterMood: "delta",
      },
      media: [],
      effect: "delta-fan",
      demos: [
        { slug: "linear", label: "Linear", status: "docs" },
        { slug: "youtube", label: "YouTube", status: "docs" },
        { slug: "super-smash", label: "Super Smash", status: "docs" },
        { slug: "fake-phone", label: "Fake Phone", status: "docs" },
        { slug: "bet", label: "Bet", status: "docs" },
        { slug: "dollar-pixels", label: "Dollar Pixels", status: "docs" },
        { slug: "notion", label: "Notion", status: "docs" },
      ],
    },
  ],

  outro: {
    line: "The river doesn't end. It becomes the sea, and the sea becomes weather.",
    cta: { label: "Back to David's Internet", href: "/" },
  },

  // PLACEHOLDER pool — replaced by the "Daily Dose of Damn" export.
  messages: [
    { text: "DON'T FIND YOUR PLACE IN THE WORLD, MAKE IT", fixed: true },
    { text: "placeholder: daily dose of damn #1" },
    { text: "placeholder: daily dose of damn #2" },
    { text: "placeholder: daily dose of damn #3" },
    { text: "placeholder: daily dose of damn #4" },
    { text: "placeholder: daily dose of damn #5" },
  ],
};

export default journey;
