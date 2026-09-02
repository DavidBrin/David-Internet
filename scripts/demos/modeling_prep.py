# -*- coding: ascii -*-
"""Early 3D Modeling demo prep (run via scripts/demos/modeling.ts -> py -3.12).

argv: rawRoot (demos/), outDir (public/demos/modeling), repoRoot.

No Inventor and no VEX assets ship: the page is renders + a hand-ported 2D
robot sim. This prep
  1. compresses the Inventor renders to WebP, grouped by project (the "Wing
     simulator" screenshot is NASA's FoilSim JS, not an Inventor render - it
     ships separately, attributed),
  2. compresses a curated set of VEXcode VR screenshots ("C 10- David Lim" is
     excluded - unclear name provenance, flagged for David),
  3. parses the .vrblocks Blockly XML into readable block listings and
     extracts the .vrpython sources, shipping programs.json for the sim's
     program picker + the Source drawer copies in demos/modeling_src/,
  4. writes tests/fixtures/modeling-vex.json: block/line counts per program so
     the shipped listings stay in sync with the raw archive.

Console is cp1252: ASCII-only prints.
"""
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

from PIL import Image

RAW_CAD = os.path.join(sys.argv[1], "inventor_cad_raw")
RAW_VEX = os.path.join(sys.argv[1], "vexcode_vr_raw")
OUT = sys.argv[2]
REPO = sys.argv[3]
SRC_DIR = os.path.join(REPO, "demos", "modeling_src")
FIX_DIR = os.path.join(REPO, "tests", "fixtures")


def save_webp(src, dst, max_w, quality):
    im = Image.open(src).convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, "WEBP", quality=quality, method=6)
    return os.path.getsize(dst)


# ------------------------------------------------------------- renders
# Grouped by project; captions/feature stories live in the panel (from the
# part-file names in demos/inventor_cad_raw/models/).

RENDER_GROUPS = [
    ("goldberg", ["Goldberg Pic1.png", "Goldberg Pic2.png"]),
    ("glider", ["Glider pic 1.png", "Glider pic 2.png", "Glider pic 3.png",
                 "Glider pic 4.png", "Glider pic 5.png", "Glider pic 6.png", "Glider drawing.png"]),
    ("gears-simple", ["Simple Gear Chain 1.png", "Simple Gear chain 2.png"]),
    ("gears-complex", ["Complex gear chain 1.png", "Complex Gear chain 2.png"]),
    ("space-crush", ["Space Crush 1.png", "Space Crush 2.png"]),
    ("space-launch", ["Space Launch 1.png", "Space Launch 2.png"]),
    ("sketch", ["Basic Sketch.png"]),
]
FOILSIM = "Wing simulator.png"


def prep_renders():
    total = 0
    manifest = []
    for group, files in RENDER_GROUPS:
        for i, name in enumerate(files):
            dst_name = "%s-%d.webp" % (group, i + 1)
            size = save_webp(os.path.join(RAW_CAD, "renders", name),
                             os.path.join(OUT, "renders", dst_name), 1200, 84)
            total += size
            manifest.append({"group": group, "file": "renders/" + dst_name, "original": name})
    size = save_webp(os.path.join(RAW_CAD, "renders", FOILSIM),
                     os.path.join(OUT, "renders", "foilsim.webp"), 1200, 84)
    total += size
    with open(os.path.join(OUT, "renders.json"), "w") as f:
        json.dump({"groups": [g for g, _ in RENDER_GROUPS], "images": manifest,
                   "foilsim": "renders/foilsim.webp"}, f)
    print("renders: %d images, %d KB total" % (len(manifest) + 1, total // 1024))


# ------------------------------------------------------------- screenshots

SCREENS = [
    "C 1.1.png", "C 2.1.png", "C 3.1.png", "4 (counter loop).png",
    "C 4.2 (perimeter).png", "C 4.3 .png", "C 5.1 (maze).png", "C 5.2.png",
    "6 (sensors).png", "C 6.2.1.png", "C 7.1.png", "7(2D list).png",
    "C 8.3.png", "C 11.1 LIMO list.png", "C 13.png", "C 14.png",
]


def screen_slug(name):
    s = os.path.splitext(name)[0].lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def prep_screens():
    total = 0
    manifest = []
    for name in SCREENS:
        dst_name = screen_slug(name) + ".webp"
        size = save_webp(os.path.join(RAW_VEX, "screenshots", name),
                         os.path.join(OUT, "vex", "screens", dst_name), 1100, 82)
        total += size
        manifest.append({"file": "vex/screens/" + dst_name, "original": name})
    with open(os.path.join(OUT, "vex", "screens.json"), "w") as f:
        json.dump({"images": manifest}, f)
    print("screens: %d images, %d KB total" % (len(manifest), total // 1024))


# ------------------------------------------------------------- vex programs

def field_text(el):
    return (el.text or "").strip()


def block_line(block):
    """One readable line for a Blockly block: type cleaned + its own fields
    and shadow values, in document order (nested statement blocks excluded)."""
    btype = block.get("type", "?")
    name = btype
    for prefix in ("pg_drivetrain_", "pg_control_", "pg_looks_", "pg_sensing_",
                   "pg_events_", "pg_operator_", "pg_variables_", "pg_"):
        if name.startswith(prefix):
            name = name[len(prefix):]
            break
    name = name.replace("_", " ")
    parts = []
    for child in block:
        tag = child.tag
        if tag == "field":
            parts.append(field_text(child))
        elif tag == "value":
            # a value slot holds a shadow (literal) and/or a nested reporter block
            texts = []
            for sub in child.iter():
                if sub.tag == "field" and field_text(sub):
                    texts.append(field_text(sub))
                elif sub.tag == "block":
                    st = sub.get("type", "")
                    if "random" in st:
                        texts.append("random")
                    elif "sensing" in st:
                        texts.append(st.split("_")[-1])
            if texts:
                parts.append("(" + " ".join(texts) + ")")
    line = name
    if parts:
        line += " " + " ".join(parts)
    return re.sub(r"\s+", " ", line).strip()


def walk_blocks(block, depth, out):
    while block is not None:
        out.append({"d": depth, "t": block_line(block)})
        for stmt in block.findall("statement"):
            inner = stmt.find("block")
            if inner is not None:
                walk_blocks(inner, depth + 1, out)
        nxt = block.find("next")
        block = nxt.find("block") if nxt is not None else None


def parse_vrblocks(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    root = ET.fromstring(data["workspace"])
    # The workspace XML uses xhtml as the DEFAULT namespace, so every element
    # tag arrives namespaced - strip it once so find()/findall() work plainly.
    for el in root.iter():
        if "}" in el.tag:
            el.tag = el.tag.split("}", 1)[1]
    start = root.find("block")
    listing = []
    if start is not None:
        walk_blocks(start, 0, listing)
    return data.get("playground", ""), listing


def parse_vrpython(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data.get("playground", ""), data["textContent"]


# Reconstructed from the C 4.2 screenshot (no .vrblocks file survives): the
# octagon perimeter - velocity 500, drive 400, pen down, repeat 8 {drive 200,
# turn right 45}.
PERIMETER_LISTING = [
    {"d": 0, "t": "when started"},
    {"d": 0, "t": "set drive velocity 500 %"},
    {"d": 0, "t": "set turn velocity 500 %"},
    {"d": 0, "t": "drive fwd 400 mm"},
    {"d": 0, "t": "move pen down"},
    {"d": 0, "t": "repeat 8"},
    {"d": 1, "t": "drive fwd 200 mm"},
    {"d": 1, "t": "turn right 45 degrees"},
]

PROGRAMS = [
    {"id": "maze", "title": "Wall Maze (C 5.1)", "src": "C 5.1.vrblocks", "kind": "blocks",
     "screenshot": "vex/screens/c-5-1-maze.webp",
     "blurb": "Drive the Wall Maze: dead reckoning to the entrance, then wall-following with the front eye until the down eye sees the green finish."},
    {"id": "perimeter", "title": "Perimeter octagon (C 4.2)", "src": None, "kind": "blocks",
     "screenshot": "vex/screens/c-4-2-perimeter.webp",
     "blurb": "Pen down, repeat 8: drive 200 mm, turn 45 degrees - the first loop that draws. RECONSTRUCTED from the screenshot; the block file didn't survive."},
    {"id": "dance", "title": "Dance (C 7)", "src": "C 7-dance.vrblocks", "kind": "blocks",
     "screenshot": "vex/screens/c-7-1.webp",
     "blurb": "Nested repeats: 4x4 spins, drives and reverses ending back at heading 0 - choreography as control flow."},
    {"id": "random", "title": "Random drive (C 14)", "src": "C 14- Random drive.vrblocks", "kind": "blocks",
     "screenshot": "vex/screens/c-14.webp",
     "blurb": "Pen down, drive forever; on the front eye seeing an object turn a random 90-180 degrees, on a bumper hit back off - a screensaver with sensors."},
    {"id": "artcanvas", "title": "Art Canvas (C 13, Python)", "src": "C 13 .vrpython", "kind": "python",
     "screenshot": "vex/screens/c-13.webp",
     "blurb": "The first text program: position polling loops, distance-sensor arithmetic, and a math.sqrt(2) diagonal."},
    {"id": "experiment", "title": "Grid experiment (Python)", "src": "Experiment text project.vrpython", "kind": "python",
     "screenshot": None,
     "blurb": "A free-form Python session on the Grid: a heading-conditioned square, a 565.685 mm diagonal (sqrt 2 again), and operation_circle - 90 tiny arcs."},
]


def prep_programs():
    os.makedirs(SRC_DIR, exist_ok=True)
    out_programs = []
    counts = {}
    for prog in PROGRAMS:
        entry = {k: prog[k] for k in ("id", "title", "kind", "screenshot", "blurb")}
        if prog["id"] == "perimeter":
            entry["playground"] = "Grid Map"
            entry["listing"] = PERIMETER_LISTING
            entry["reconstructed"] = True
        elif prog["kind"] == "blocks":
            playground, listing = parse_vrblocks(os.path.join(RAW_VEX, "programs", prog["src"]))
            entry["playground"] = playground
            entry["listing"] = listing
        else:
            playground, text = parse_vrpython(os.path.join(RAW_VEX, "programs", prog["src"]))
            entry["playground"] = playground
            entry["python"] = text
            entry["listing"] = [{"d": 0, "t": ln} for ln in text.splitlines()]
        out_programs.append(entry)
        counts[prog["id"]] = len(entry["listing"])
        # drawer copy
        if prog["kind"] == "python":
            with open(os.path.join(SRC_DIR, prog["id"] + ".py"), "w", encoding="utf-8", newline="\n") as f:
                f.write("# %s - extracted from %s (VEXcode VR, 2020).\n" % (prog["title"], prog["src"]))
                f.write("# Playground: %s. The template header ('Author: VEX') is VEXcode's own.\n\n" % entry["playground"])
                f.write(entry["python"])
        else:
            with open(os.path.join(SRC_DIR, prog["id"] + "_blocks.txt"), "w", encoding="utf-8", newline="\n") as f:
                src_note = prog["src"] or "RECONSTRUCTED from the C 4.2 screenshot (no block file survives)"
                f.write("%s - block listing extracted from %s (VEXcode VR, 2020).\n" % (prog["title"], src_note))
                f.write("Rendered from the Blockly XML; original screenshots in demos/vexcode_vr_raw/.\n\n")
                for item in entry["listing"]:
                    f.write("  " * item["d"] + item["t"] + "\n")
    with open(os.path.join(OUT, "vex", "programs.json"), "w") as f:
        json.dump({"programs": out_programs}, f)
    os.makedirs(FIX_DIR, exist_ok=True)
    with open(os.path.join(FIX_DIR, "modeling-vex.json"), "w") as f:
        json.dump({"listingCounts": counts}, f)
    for pid, n in counts.items():
        print("program %s: %d listing lines" % (pid, n))
    print("programs.json + drawer sources written")


ONLY = os.environ.get("MODELING_PREP_ONLY", "").split(",") if os.environ.get("MODELING_PREP_ONLY") else None
STEPS = [("renders", prep_renders), ("screens", prep_screens), ("programs", prep_programs)]
for name, fn in STEPS:
    if ONLY and name not in ONLY:
        continue
    fn()
print("modeling prep done")
