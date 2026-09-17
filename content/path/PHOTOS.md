# Path photo wish list

Drop files into `public/path/<phase>/` (or tell me the paths) and I can wire them.
Swapping a real file in is a one-line edit in `content/path/journey.ts`: set `src`,
drop `placeholder: true`, and replace the "belongs here" alt text with a
description of what's actually in the shot.

Each frame reads as an intentional held place until its photo lands, so nothing
looks broken. Frames crop to 4:3 (or 16:9 for the first two when a phase has 3+
photos). Use `fit: "contain"` for wide slides that shouldn't be cropped, and
`focus: "50% 60%"` (object-position) to keep a face in frame under a crop.

## Still empty frames

- **Roots:** a childhood photo. Frame reads "A childhood photo belongs here";
  caption: *"San Diego, before any of this had a name."*
- **Roots:** an early robot or Robolink build. Frame reads "A first-robot photo
  belongs here"; caption: *"Robolink, 2017 — where taking robots apart turned into a habit."*

These two are the only frames still on placeholders.

## Now on the page (wired 2026-09-17)

- **Scripps Ranch High:** Model UN 2022, high-school graduation.
- **First ventures & service:** GATSVI ecoX 2020 gold-award slide (`fit: contain`),
  Feeding San Diego distribution line, Feeding San Diego volunteer badge.
- **UC San Diego:** Triton UAS build, PCBs with solder mask, first EEG workshop (2023),
  college graduation (2026).
- **Voytek Lab:** no lab photo — links to the Voytek Lab alumni page instead
  (`https://voyteklab.com/members`).
- **The braided reach:** the finished autonomous car, live lane detection, live object detection.
- **DTU, Denmark:** the DTU campus sign, a quantum-information lecture.
- **General Atomics:** David and the team at the General Atomics Electromagnetics sign.
- **The run-up:** a HardHacks bench mid-build.
- **Katalyxt:** co-founder gallery shots + the four headshots (unchanged).

## Staged but not placed (backups in `public/path/ucsd/`)

- `triton-fit-park.jpg`, `lecture.png` — extra UCSD options if any of the four
  placed shots gets swapped out.

## Not a photo, but the other open ask

The "Daily Dose of Damn" export. The sand-etched asides on the page are house
lines written in the page's voice (see `messages` in `journey.ts`); the desk-carved
anchor line is the only real one. Export the pool and they get swapped one-for-one.
