# The Path — an immersive river journey through David's life

**Design spec · 2026-08-30 · status: draft for review**

> A new standalone page on David's Internet. You scroll, and a rainstorm on the
> Sierra Nevada gives birth to a stream. You follow that stream down the
> mountain, and as it flows it carries you through the chapters of David's life —
> the world around the water changing with each chapter — until the river reaches
> the present and fans into a delta of recent work meeting the sea. Storytelling
> first. No active demos, only links out. Mostly static.

> **Content is NOT locked.** Per David: we are not deciding final copy or the
> exact phase grouping yet. In this revision, **dates are treated as fact**
> (sourced from the résumés — see Appendix A), the **mechanics and architecture
> are the deliverable**, and all narrative copy in §6 is a *provisional scaffold*
> David will rewrite/approve.

---

## 0. Open decisions (resolve while reviewing)

1. **Route name & title.** Route slug is easy to change later; the display
   title/wordmark is the thing worth getting right.
   - Recommendation: **route `/path`** (clear, breadcrumb `path.davids.net`),
     with the on-screen title as a separate choice.
   - Title candidates you floated + my read:
     - **Flowstate** — my favorite: double meaning (river flow + the deep-work
       *flow state*), short, modern, memorable, on-theme.
     - **The Path / Path Less Traveled** — strong and clear; "less traveled"
       is a touch cliché (Frost) but fits "carve your own path."
     - **Meander & Milestones** — lovely as a *subtitle*, long for a title.
     - **Flow / Flow Through Time** — fine but generic.
     - **Trailblazer** — off (Salesforce connotation).
   - Suggested combo: route `/path`, title **"Flowstate,"** subtitle *"meander &
     milestones."* **Decision pending.**
2. **Fidelity ceiling.** Locked to **Approach A hybrid** (§4): illustrated /
   photographic parallax scenes + an SVG (optionally light-canvas) water ribbon +
   scripted effect set-pieces. No physics engine. Heavier deps only where quality
   is otherwise unreachable, kept minimal. **Confirmed.**
3. **Entry point.** New route reached from the fake-Google home + footer + nav;
   does **not** replace the Google homepage. **Confirmed.**
4. **Content sourcing.** Copy + phase grouping stay provisional (David to
   finalize). Photos are David's ask. In-progress demos need asset capture (§6.3).
5. **The etched anchor line.** *"DON'T FIND YOUR PLACE IN THE WORLD, MAKE IT"* is
   a **fixed** set-piece etched in sand/dirt very early (§7.2) — it was carved
   into David's desk and appears in his essays.
6. **Disappearing messages.** A pool of short quotes ("Daily Dose of Damn")
   surfaces as semi-random sand-etched asides that wash away (§7.3). Source text
   must be exported by David — the assistant cannot read the notes app.

---

## 1. Goals & non-goals

### Goals
- Tell the story of David's life as a single continuous scroll, using a river as
  the narrative spine.
- Make **presentation and motion the product** — this page is storytelling, not a
  functional tool.
- Encode meaning in the river's shape: **meanders = life pivots**, **forks =
  parallel chapters**, **source→sea = past→present**.
- Place milestones — résumé events **and** project "demos" — in **true
  chronological order** along the river, each linking out (docs / live), never
  embedded/active.
- Stay within the site's ethos: **static export**, dependency-light, fast,
  accessible, graceful without JS.

### Non-goals
- No fluid/physics simulation, no backend, no runtime fetching.
- No live/interactive demo embeds on this page.
- Not a replacement for `/about` (they cross-link; About stays the plain résumé,
  this is the cinematic one).
- Not deciding final copy in this document.

---

## 2. The concept

A river is metaphor and mechanic at once:

- **Birth on scroll.** Opens static: Sierra Nevada peaks and *"Flow through the
  path of my life."* First scroll triggers rain; the rain pools and a stream's
  **wet leading edge advances** downhill, pinned to scroll position — **the
  ground below the edge stays dry**, like time-lapse of first water down a dry
  creek. The river is *born as you read it.*
- **The world changes, the water stays real.** The stream stays believable
  throughout; what changes per chapter is the **world around it** — backdrop,
  palette, light, terrain, the objects on the banks.
- **Shape carries meaning.** Gentle continuation = closely related; a sharp
  **meander** = a pivot; a **fork** (split around an island / a tributary that
  rejoins) = parallel chapters (a job during school, several projects at once —
  and David's real timeline overlaps heavily, so forks are frequent and earned).
- **Water tells stories.** As it passes each beat the water *acts on the world*:
  bounces off demo "rocks," washes words written in sand, rinses paper/dirt off a
  surface to reveal a photo or fact (§7).

---

## 3. Route, entry points & shell

- **New route:** `/path` (`src/app/path/page.tsx`), statically exported.
- **Breadcrumb chrome:** thin top bar like `/about` (`path.davids.net` · back to
  *David's Internet*), fading out once the journey begins; returns in the static
  fallback.
- **Entry points:** a global footer link; a tasteful "Follow the river →"
  doodle/link under the homepage search box (echoing "I'm Feeling Lucky"); an
  About / knowledge-panel cross-link.
- **Ending:** the sea/outro closes on a CTA back into the site (search / explore),
  so the page loops rather than dead-ends.

---

## 4. Rendering architecture (Approach A hybrid)

A stack of **z-layers** driven by one shared **scroll-progress** signal. No
physics; everything is authored motion parameterized by progress.

### 4.1 Layer stack (back → front)
1. **Sky / atmosphere** — furthest backdrop; color + light shift per phase.
2. **Scene backdrop** — the phase's world (mountains, HS/campus, lab, SF street);
   photographic or illustrated; lazy-loaded per phase.
3. **Mid parallax** — terrain, banks, foreground silhouettes at differing rates.
4. **Water ribbon** — the river: an **SVG path** with animated flowing fill
   (gradient + moving highlights/foam) whose **draw length is tied to scroll**
   (the stream-head mechanic). An optional thin `<canvas>` overlay is reserved
   *only* for ripple/foam shimmer or splash sprites if SVG filters fall short —
   decided by a spike, off by default.
5. **Effect set-pieces** — sand-text wash, paper/dirt reveal, demo splash, fork,
   delta, disappearing messages (§7); masked layers driven by local progress.
6. **Content cards** — milestone copy, photos, links on the banks; plain,
   accessible DOM. The visual layers are decoration behind them.

### 4.2 Scroll model
- A series of **sticky "scene" sections**; each phase is tall (several vh) with a
  `position: sticky` backdrop pinned while its scroll plays, then released. Native
  scrollbar preserved — no scroll hijacking.
- One hook computes **global progress** (0→1 over the page) and **per-section
  progress** (0→1 within each scene). Water draw reads global; set-pieces read
  local.
- **Preferred impl:** CSS **scroll-driven animations** (`animation-timeline:
  view()/scroll()`) where supported (GPU-composited, zero JS); a small
  `IntersectionObserver` + `rAF` progress hook is the fallback and drives what CSS
  timelines can't (e.g. SVG `stroke-dashoffset`). One hook, shared.

### 4.3 Dependencies
- **Default: none new** — SVG + CSS + a ~100-line progress hook.
- **Allowed only if a spike proves quality is otherwise unreachable**, lightest
  first: a tiny scroll-progress utility, then a lightweight SVG/tween helper.
  **Excluded:** physics/fluid engines and heavy WebGL frameworks (three.js/pixi)
  unless separately re-approved. Every added dep is flagged with its weight.

### 4.4 Performance budget
- Scene imagery lazy per phase (`loading="lazy"`, responsive `srcset`, AVIF/WebP +
  fallback); only hero + first phase eager.
- Animate `transform`/`opacity`/`stroke-dashoffset` only; `content-visibility:
  auto` off-screen. Static export intact (client renders from bundled data +
  `/public`; no runtime fetch). Concrete weight ceilings set once real assets land.

---

## 5. Data model

All narrative content in **one editable file** so David edits the story without
touching components — mirroring the `site.ts` manifest pattern.

- **Location:** `content/path/journey.ts` (exports a typed `Journey`).
- **Types:** added to `src/lib/types.ts` (frozen-contract file).

```ts
/** One chapter = one pinned scene the river flows through. Array order = time. */
export interface JourneyPhase {
  id: string;                 // "roots", "high-school", "voytek", "katalyxt", "delta"
  title: string;
  period?: string;            // display string, e.g. "Jun 2025 – Jun 2026"
  kicker?: string;            // eyebrow, e.g. "Embedded firmware"
  body: string;               // PROVISIONAL story copy (David finalizes)
  scene: SceneSpec;
  media: PhaseMedia[];        // photos/screenshots on the banks
  effect?: EffectBeat;        // optional scripted set-piece (§7)
  branch?: BranchSpec;        // optional fork (parallel chapter)
  demos?: DemoRef[];          // project "demos" anchored to THIS phase (§6.3)
  links?: JourneyLink[];      // outbound (résumé orgs, /about, external)
}

export interface SceneSpec {
  backdrop: string;           // /public path (image or illustration set)
  palette: { sky: string; water: string; accent: string; ink: string };
  light?: "dawn" | "day" | "dusk" | "night";
  waterMood?: "trickle" | "stream" | "rapids" | "delta";
}

export interface PhaseMedia {
  src: string; alt: string; caption?: string;
  reveal?: "wash-sand" | "wash-paper" | "fade" | "none";
}

/** A project demo placed on the river. Demos are IN PROGRESS — see §6.3. */
export interface DemoRef {
  slug: string;               // matches a manifest slug when one exists, else a placeholder id
  label: string;              // neutral label only (do NOT describe unfinished content)
  status: "live" | "docs" | "in-progress"; // in-progress ⇒ render a "coming soon" stone, no deep content
  needsAssets?: boolean;      // true ⇒ awaiting screenshots / recorded animation capture
  href?: string;              // resolved via manifest when slug is known
}

export interface BranchSpec { label: string; rejoins: boolean; }

export interface JourneyLink {
  label: string; href: string; project?: string; external?: boolean;
}

export interface EffectBeat {
  kind: "rain-birth" | "etch-anchor" | "wash-sand" | "wash-paper"
      | "bounce-demo" | "fork" | "delta-fan";
}

/** Semi-random sand-etched asides that wash away (§7.3). Source: David's export. */
export interface DisappearingMessage {
  text: string;               // short quote/line
  fixed?: boolean;            // true only for the desk-etched anchor line
}

export interface Journey {
  hero: { title: string; tagline: string; backdrop: string };
  phases: JourneyPhase[];
  messages: DisappearingMessage[];  // pool for §7.3 (Daily Dose of Damn)
}
```

- **Demo links reuse the manifests** when a matching slug exists (`resolveHref`),
  so deployed/undeployed state stays single-sourced. In-progress demos with no
  manifest render as inert "coming soon" stones.

---

## 6. The river, chronologically

> **Dates below are fact** (Appendix A). **Copy is a provisional scaffold** — the
> factual anchor (org · role · date) is settled; the *narrative voice* is David's
> to write. Grouping/number of phases is still open (some of these may merge).

### 6.1 Provisional phase scaffold (source → sea)

| # | Phase (working) | When | World / palette | River shape | Factual anchors (neutral) |
|---|-----------------|------|-----------------|-------------|---------------------------|
| 0 | **Hero — the source** | — | Still Sierra Nevada, dawn | No water; first scroll → rain → stream born | *"Flow through the path of my life."* |
| 1 | **Roots** | ~2017–2019 | Alpine meadow, warm | Thin trickle, gentle curves | First robotics (Robolink, 2017); guitarist in a band (2017–2020). **Etched anchor line here (§7.2).** Childhood photos (David's ask). |
| 2 | **Scripps Ranch High — maker & leader** | 2019–2023 | Bright coastal-suburb | River widens; **forks** (many parallel threads) | Engineering coursework; Robotics/Aerospace club; MUN/JMUN (led security council); Debate; *The Wing* (2× published author); sports (football, wrestling, XC, track). |
| 3 | **First ventures & service** *(tributaries)* | 2019–2022 | Warm, communal | Braided side-channels rejoining | GATSVI entrepreneurship — pitched Silicon Valley investors (Nov 2019–Jul 2020); Red Cross (2019–); Feeding San Diego (2021–); teaching: League of Amazing Programmers camp (2021–22), Berkeley Coding Academy cohort lead (Jul–Aug 2022). **'early' demo anchors here (§6.3).** |
| 4 | **UC San Diego + Triton UAS** | 2023–2024 | Campus, bright day | Sharp meander (into engineering) | UCSD, Regents Scholar, B.S. Computer Engineering; Triton Unmanned Aerial Systems — PCB/Altium (Sep 2023–Apr 2024). |
| 5 | **Voytek Lab** | Apr 2024–Jun 2025 | Lab interior, teal light | Deepening channel | Undergrad research: neural-data pipelines, patch-clamp & organoid MEA, MATLAB/Python. **Lab demo anchors here.** |
| 6 | **Braided reach — UCSD projects** | 2024–2025 | Shifting montage | River **braids** (concurrent channels) then re-gathers | Nocturnal Neuro (EEG diagnostic, Winter 2024); Autonomous Car (ROS 2, Spring 2025); Microtomography Segmentation (U-Net/ViT, Fall 2025). **UCSD-project demos anchor here.** |
| 7 | **DTU exchange** *(tributary)* | Fall 2025 | Cool Nordic | Tributary loop rejoining | Kongens Lyngby, Denmark — Quantum Information, Databases, Computational Data Science, Deep Learning. |
| 8 | **General Atomics** | Jun 2025–Jun 2026 | **Dark blue** industrial | Meander/pivot to hardware | Electrical Technologies Intern — embedded C for a camera driver & control system; optical-controls experiments; Git/Bitbucket, Linux. |
| 9 | **Run-up to founding** | Jan 2026 | Transitional, energizing | Quickening current | Data Refinement Pipeline (web data-refinery); IEEE HardHacks (embedded security + mobile via MQTT). |
| 10 | **Katalyxt AI — San Francisco** | Apr 2026–present | **Streets of SF**, city light | Strong, confident flow through the built world | Co-founder — enterprise AI platform; $200K pre-seed (NFX, KP Scout, Long Journey); $30K ARR in a one-month sprint; four design partners; leads product + eng end-to-end. |
| 11 | **The demos — delta** | 2026 | River mouth, distributaries | **Delta fan** into the sea | The recent David's-Internet replicas fan out; each a stone linking to docs/live. In-progress ones render "coming soon" (§6.3). |
| 12 | **The sea / outro** | now | Open horizon | Water finally fills the base of the frame | Closing line; CTA back into David's Internet. |

**Fork/braid logic (earned by the real overlaps):** Voytek (Apr 2024–Jun 2025)
overlaps Autonomous Car (Spring 2025) and the start of General Atomics (Jun
2025); DTU (Fall 2025) overlaps GA and Microtomography. These concurrencies are
exactly where the river forks/braids. Bend sharpness ∝ how big the pivot is.

### 6.2 Early-life lumping (per David's guidance)
The 2023 résumé's many small entries are **lumped into phases 1–3** as texture,
not enumerated one-by-one. Candidate emphases (David selects): *the maker* (robotics,
engineering courses), *the communicator* (MUN, debate, newspaper), *the servant-leader*
(Red Cross, Feeding SD, teaching), *the founder-in-embryo* (GATSVI investor pitch).
Full inventory preserved in **Appendix A** so nothing is lost.

### 6.3 Demos are IN PROGRESS — placement & constraints
Some demos are old projects (saved on another machine) being rebuilt; they are
**placed by the date of the project they represent**, not clustered at the end:
- A demo whose name contains **'early'** anchors in the pre-college reach (phase 3),
  *before* the lab/UCSD material.
- Lab demos anchor at **Voytek (phase 5)**; UCSD-project demos at the **braided
  reach (phase 6)**; the recent replica portfolio forms the **delta (phase 11)**.

**Hard constraints for the build:**
- **Do not describe an in-progress demo's content** or assume it can be dropped
  in. Render it as an inert **"coming soon" stone** (label only) until finalized.
- Adding a real demo may require **capturing new assets** — screenshots or
  **recorded animations** remade for this site — tracked via `needsAssets`.
- Exact demo→phase mapping is **David's to confirm** (which slug sits where).

---

## 7. Water-effect set-pieces

Authored beats tied to scroll triggers; each has a static fallback (§8).

1. **Rain birth (hero → phase 1).** First scroll: raindrops fall/fade, a puddle
   mask grows, the SVG stream begins drawing (`stroke-dashoffset` 100%→down).
   Establishes the rule: **wet edge = scroll head; below stays dry.**
2. **Etch the anchor line.** Very early (phase 1), *"DON'T FIND YOUR PLACE IN THE
   WORLD, MAKE IT"* appears **carved in sand/dirt**. Unlike the ephemeral asides,
   this one is deliberate and **lingers** — the water traces it rather than
   erasing it (or erases and it re-etches). It's the thesis of the whole page.
3. **Disappearing messages ("Daily Dose of Damn").** At intervals, a short quote
   from David's pool is **etched in sand and then washed away** by the passing
   stream — semi-random selection per visit (deterministic per session to stay
   static-friendly; no runtime randomness that breaks export — seed from
   scroll/section index). Data from `Journey.messages`; **David exports the pool.**
4. **Wash-away sand text.** A milestone label first drawn in sand; the stream
   sweeps left→right (SVG mask + gradient wipe on local progress), dissolving it
   into the current to reveal the real content card.
5. **Wash-away paper / dirt reveal.** A photo starts covered by paper/dirt; the
   passing water rinses it off (mask wipe following the water's edge) to reveal
   the image — childhood photos, key moments.
6. **Bounce off a demo.** Each demo "rock": as water reaches it, a splash sprite
   plays and the stream deflects around a pre-authored bump in the SVG path.
   Hover/focus intensifies the splash and surfaces the "visit"/"coming soon" state.
7. **Fork / tributary.** The path splits into authored SVG paths diverging around
   an "island" (parallel-chapter card), later merging; both draw with scroll.
8. **Delta fan.** The path splits into staggered distributaries, each terminating
   at a demo mouth.

Effects are **data-driven** via `EffectBeat`, so the story re-sequences without
new code.

---

## 8. Accessibility & reduced-motion (first-class)

- **`prefers-reduced-motion: reduce`** → a calm **vertical illustrated timeline**:
  each phase a static card with a still backdrop, the river a simple static
  connecting path, no rain/scrub/pinning. Identical content & links. Built
  alongside the animated version, not after.
- **No-JS** → the same static timeline (server-rendered DOM); animation is
  progressive enhancement.
- **Semantics:** ordered `<section>`s with real `h2` headings per phase; river/
  scene layers `aria-hidden`. Fully screen-reader and heading-jump navigable.
- **Keyboard:** all links in DOM order; demo "rocks" are real links/buttons with
  visible focus; no hover-only interaction.
- **Images:** meaningful `alt` on every photo/screenshot. The etched anchor line
  is also real text (visually styled), not an image, so it's readable and indexable.
- **Motion safety:** no strobing; gentle rain/foam; nothing essential conveyed by
  motion alone.

---

## 9. Responsive / mobile

- **Portrait scrollytelling.** Pin pattern works vertically; art-directed backdrop
  crops (`<picture>`); the river runs a simplified single channel (forks shown as
  a labeled split→merge); set-pieces reduce to the essential wash/reveal.
- Touch scroll only, no gesture hijacking. Text stays top-layer and legible over
  any backdrop (scrim where contrast needs it; per-phase contrast checked). Heavy
  photos gated to smaller sources on small screens.

---

## 10. File & component structure

```
src/app/path/
  page.tsx                 # Journey data → <JourneyPhase> list; static
  path.css                 # page-scoped styles (about.css / sites.css pattern)
src/components/path/
  RiverHero.tsx            # mountain hero + "rain on first scroll"
  JourneyPhase.tsx         # one pinned scene: backdrop + banks + content card
  RiverRibbon.tsx          # SVG water path; consumes scroll progress
  WaterEffect.tsx          # renders an EffectBeat (etch/wash/bounce/fork/delta)
  DemoStone.tsx            # a demo "rock" (manifest-backed or "coming soon")
  DisappearingMessage.tsx  # sand-etched aside that washes away
  useScrollProgress.ts     # single shared progress hook (global + per-section)
content/path/journey.ts    # story data (David-editable)
public/path/               # backdrops, photos, textures (sand/paper/foam)
```

Follows existing conventions (page-scoped CSS, components in `src/components/`,
content in `content/`, types in `src/lib/types.ts`). `DemoStone` reuses the
manifest registry + `resolveHref`.

---

## 11. Testing

- **e2e (Playwright, matches `e2e/`):** `/path` renders; hero + all phase
  headings present in order; demo stones link to expected `href` (or show
  "coming soon"); reduced-motion emulation → static timeline with all content &
  links, no pinned layers; no horizontal overflow at mobile/desktop.
- **Unit (Vitest):** `journey.ts` integrity — every `DemoRef.slug` with a
  manifest resolves; phases have heading + body; `messages` non-empty; asset
  paths well-formed; the fixed anchor message is present exactly once.
- **Manual:** motion/perf pass (scroll FPS, asset weight) + per-phase contrast.

---

## 12. Inputs needed from David

*(Only true blanks; all slot into `content/path/journey.ts` + `public/path/`
without component changes.)*

1. **Photos** — childhood/baby + friends; General Atomics era; per-phase imagery
   to reveal.
   - *Katalyxt / startup phase co-founder photos are already in-repo* —
     scraped 2026-08-30 into `public/path/co-founders/` (4 headshots + 29
     childhood-to-adulthood gallery shots), tagged for §6 phase 10. See that
     folder's `ASSETS.md`. Still needed from David: **per-photo age/year + who's
     in each gallery shot** (source has no captions) so scenes order young → old.
     (`sahil.png` was downscaled to `sahil.jpg` before commit; a full
     optimize-to-WebP pass on the rest happens in §13 step 7.)
2. **"Daily Dose of Damn" export** — the quote pool for §7.3 (assistant can't read
   the notes app). Flag the desk-etched anchor line as the fixed one.
3. **Essays containing the anchor phrase** — optional but useful for authentic
   lines / additional asides.
4. **In-progress demos** — which slugs exist, where each sits chronologically, and
   which need screenshots/animation capture (`needsAssets`).
5. **Copy tone** — one paragraph per phase (assistant drafts from résumé, David
   edits, or David supplies) + hero line + outro CTA.
6. **Final route name & title** (§0.1).

---

## 13. Build sequence (for the implementation plan)

1. Route shell + `/path` static page + breadcrumb chrome + footer/home entry links.
2. Data model (`types.ts`) + `content/path/journey.ts` seeded from Appendix A
   (placeholder art, provisional copy, "coming soon" demo stones).
3. Static reduced-motion timeline first (accessible baseline) — proves content,
   links, layout, tests.
4. `useScrollProgress` + pinned scenes + per-phase backdrop crossfade.
5. `RiverRibbon` SVG draw-on-scroll (stream-head mechanic).
6. Set-pieces in order: rain-birth → etch-anchor → wash-sand → wash-paper →
   fork/braid → delta-fan → demo bounce → disappearing messages.
7. Real assets swapped in; responsive art direction; perf + contrast passes.
8. e2e + unit tests; motion QA.

*(A short spike precedes step 5 to confirm the SVG-only water quality bar and
whether the optional canvas shimmer overlay is warranted — §4.3.)*

---

## 14. Out of scope

- Live/interactive demo embeds; backend/CMS/runtime fetching; real fluid physics;
  audio/soundtrack (possible future enhancement); changes to the demos themselves
  or their deployment status.

---

## Appendix A — source chronology (reference, not final copy)

Extracted from `db_resume_2026.pdf` (dates authoritative) and
`David Brin Resume 2023.docx.md` (early-life texture). Captured so nothing is
lost; David decides what surfaces.

**Professional / research (2026 résumé):**
- **Katalyxt AI** — Co-Founder — *Apr 2026–present*, San Diego. Enterprise AI
  platform; $200K pre-seed (NFX, KP Scout, Long Journey); $30K ARR one-month
  sprint; four design partners; leads human-centered design, DevOps, cloud, security, ML/LLM + memory.
- **General Atomics** — Electrical Technologies Intern — *Jun 2025–Jun 2026*, San
  Diego. Embedded C camera-driver/control system; optical-controls experiments;
  Git/Bitbucket, Linux, hardware validation.
- **Voytek Lab, UCSD** — Undergrad Research Assistant — *Apr 2024–Jun 2025*, San
  Diego. Neuro data pipelines (patch-clamp, organoid MEA); MATLAB + Python.
- **Berkeley Coding Academy** — Cohort Lead — *Jul 2022–Aug 2022*, Berkeley.
  Taught data science / intro ML in Python + Colab.

**Education:**
- **UC San Diego** — B.S. Computer Engineering, Regents Scholar, GPA 3.9 — *2026*.
  Coursework: ML, Computer Vision I/II, Embedded Systems, Computer Architecture,
  Data Structures & Algorithms, Circuits & Systems, Signal Analysis.
- **DTU (Denmark)** — Exchange Semester, graduate coursework — *Fall 2025*.
  Quantum Information, Databases, Computational Data Science, Deep Learning.

**Projects (2026 résumé):**
- **Semi-Supervised Microtomography Segmentation** — *Fall 2025* — U-Net + ViT cross-teaching.
- **Autonomous Car** — *Spring 2025* — ROS 2/Linux, CV, Roboflow, NVIDIA compute.
- **Nocturnal Neuro** — *Winter 2024* — EEG ML bipolar-diagnostic concept; hardware + signal processing + pitching.
- **Triton Unmanned Aerial Systems** — *Sep 2023–Apr 2024* — PCB (Altium), mech/elec, AutoCAD.
- **Data Refinement Pipeline** — *Jan 2026* — web-based data-refinery platform.
- **IEEE HardHacks** — *Jan 2026* — microcontroller embedded-security system + mobile app via MQTT.
- **Awards:** Regents Scholarship (2023–2026); CRA Undergraduate Research Award (2025–2026).
- **Certs:** Azure AZ-900 (*Jul 2024*); Databricks Fundamentals (*Aug 2026*).
- **Skills:** Python, C, C++, Java, MATLAB, Assembly, Verilog/VHDL; PyTorch, CV, DL,
  U-Net, ViT, Roboflow; Linux, ROS 2, Git, Bitbucket, LabVIEW, Altium, AutoCAD, MQTT, Azure.

**Early life (2023 résumé — to lump into phases 1–3):**
- **Robolink** — *2017 & 2021* — learned Arduino robotics, later taught the camp.
- **Guitarist in a band** — *2017–2020* — composed originals + performed covers.
- **MUN/JMUN** — *2018–2022* — led JMUN security council; public speaking.
- **United Synagogue Youth Board** — *Sep 2018–Mar 2020*.
- **Red Cross** — *2019–present* — disaster relief/preparedness (~40 hrs/yr).
- **Sports** — football, wrestling, cross country, track — *2019–present*.
- **GATSVI (Gifted & Talented Silicon Valley Innovators)** — *Nov 2019–Jul 2020* —
  entrepreneurship; field surveys; sold lollipops at profit on a challenge;
  built a business model and **pitched Silicon Valley investors**.
- **Debate club** (officer) — *2019–*.
- **League of Amazing Programmers** — Camp Counselor — *Jun 2021–Aug 2022* — taught programming basics.
- **Feeding San Diego** — *Dec 2021–present* — meal assembly/distribution.
- **Robotics/Aerospace Engineering club** — *2021–*.
- **The Wing** (student newspaper) — *Oct 2021–2023* — 2× published author.
- **Cultural Fusion District** — *Oct 2021–* — cultural-awareness nonprofit club.
- **Dan McKinney YMCA** — Youth Program Leader — *Jun 2023–Aug 2023*.
- **Scripps Ranch High School** — Class of *2023* — Seminar student, WGPA 4.75;
  engineering track (Intro to Design, Principles of Engineering, Digital
  Electronics), AP Physics C, Calc I–III.
- Also: Math Club, Economics Club, Red Cross Club (2019–2022).

*The etched anchor line — "DON'T FIND YOUR PLACE IN THE WORLD, MAKE IT" — sits in
phase 1 regardless of which early-life details surface around it.*
