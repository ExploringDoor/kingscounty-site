#!/usr/bin/env python3
"""
Normalize team logo visual sizes.

Problem: user dropped 42 PNGs into logos/, each 500x500, but the logos inside
have different amounts of transparent whitespace padding. Some fill the whole
square, others leave huge margins — so when rendered at the same container
size on the page, the ones with extra padding LOOK smaller.

Fix: for each PNG,
  1. Find the bounding box of non-transparent pixels
  2. Crop to that bbox
  3. Scale the cropped image so its longest side = TARGET (e.g. 440px)
  4. Paste it centered into a fresh transparent 500x500 canvas

Result: every logo occupies the same fraction of its container, so they all
appear visually the same size on the site.

Also handles the CARNAGE duplicate (31.png and 35.png are identical).

Usage:  python3 scripts/normalize-logos.py

Writes:
  logos/normalized/<id>.png   (41 normalized team logos, named by KCSL team id)
  After verification, these replace the numbered files.
"""
from PIL import Image
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
LOGOS = ROOT / "logos"
OUT = LOGOS / "normalized"
OUT.mkdir(exist_ok=True)

# Final canvas size + the size the cropped content should scale to fit within
CANVAS = 500
TARGET = 440  # leaves 30px padding on each side for visual breathing room

# Mapping from the numbered upload filename → KCSL team id (from kcsl-data.json)
# Identified by visually inspecting each PNG. 31.png and 35.png are both
# CARNAGE — use 31, skip 35 as the duplicate.
NUM_TO_ID = {
    1:  "padres",
    2:  "tune-squad",
    3:  "make-em-pay",
    4:  "expos-edwin",
    5:  "ducks",
    6:  "bk-expos-ray",
    7:  "z-boyz",
    8:  "bk-fuel",
    9:  "supercocks",
    10: "juiceheads",
    11: "jackets",
    12: "renegades",
    13: "legionares",
    14: "badgers",
    15: "bullets",
    16: "cyclones",
    17: "diamond-dawgs",
    18: "warriors",
    19: "nightmares",
    20: "the-bats",
    21: "titans",
    22: "chosen-ones",
    23: "hidden-gems",
    24: "asylum",
    25: "asesinos",
    26: "delincuentes",
    27: "sunday-sauce",
    28: "post-time",
    29: "saints",
    30: "straight-ballerz",
    31: "carnage",          # keeping this one
    32: "blazers",
    33: "bulldogs",
    34: "bloodline",
    # 35: "carnage"  ← DUPLICATE, skipped
    36: "machine",
    37: "tainos",
    38: "ripperz",
    39: "blue-devils",
    40: "gators",
    41: "heat",
    42: "brooklyn-crew",
}

def normalize(src_path: Path, dst_path: Path):
    img = Image.open(src_path).convert("RGBA")
    # Find bounding box of non-transparent pixels
    alpha = img.split()[3]
    bbox = alpha.getbbox()
    if bbox is None:
        # Fully transparent — just copy as-is
        img.save(dst_path)
        return
    cropped = img.crop(bbox)

    # Scale cropped image so its LONGER side = TARGET, preserving aspect ratio
    cw, ch = cropped.size
    scale = TARGET / max(cw, ch)
    new_w = max(1, round(cw * scale))
    new_h = max(1, round(ch * scale))
    scaled = cropped.resize((new_w, new_h), Image.LANCZOS)

    # Paste into a fresh transparent 500x500 canvas, centered
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    ox = (CANVAS - new_w) // 2
    oy = (CANVAS - new_h) // 2
    canvas.paste(scaled, (ox, oy), scaled)

    canvas.save(dst_path, "PNG", optimize=True)
    return cropped.size, (new_w, new_h)


processed = 0
skipped = []
for num, team_id in NUM_TO_ID.items():
    src = LOGOS / f"{num}.png"
    if not src.exists():
        skipped.append(f"{num}.png (missing)")
        continue
    dst = OUT / f"{team_id}.png"
    result = normalize(src, dst)
    processed += 1
    if result:
        orig, scaled = result
        print(f"  {num:2d}.png → {team_id}.png   orig bbox {orig[0]}x{orig[1]} → scaled {scaled[0]}x{scaled[1]}")

print()
print(f"Processed {processed} logos into {OUT}")
if skipped:
    print(f"Skipped: {', '.join(skipped)}")
print(f"Duplicate 35.png (CARNAGE) ignored — 31.png used for carnage.png")
