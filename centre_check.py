"""Measure the centring the owner complained about, on PNG frames: canvas size, and for each frame the caption's left and right margins (white/yellow letters on their dark stroke, in the caption band) and the left/right balance of everything that isn't background. python centre_check.py <props folder> <folder of f######.png>"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

props = json.loads((Path(sys.argv[1]) / "props.json").read_text(encoding="utf-8"))
L = props["lines"]
bad = 0
for png in sorted(Path(sys.argv[2]).glob("f*.png")):
    fr = int(png.stem[1:])
    line = [l for l in L if l["cut"] <= fr][-1]
    capy = (line.get("p") or {}).get("capy") or 1350
    a = np.asarray(Image.open(png).convert("RGB"), dtype="int16")
    h, w = a.shape[:2]
    k = w / 1080
    y0, y1 = int((capy + 8) * k), int((capy + 88) * k)
    band = a[y0:y1]
    white = (band.min(axis=2) > 235)
    yellow = (band[:, :, 0] > 235) & (band[:, :, 1] > 205) & (band[:, :, 2] < 110)
    cols = np.where((white | yellow).sum(axis=0) > 2)[0]
    msg = f"{png.name} {w}x{h} {line['shot']:11}"
    if len(cols) and not (line.get("p") or {}).get("nocap"):
        left, right = cols[0] / k, (w - 1 - cols[-1]) / k
        off = (left - right) / 2
        msg += f" caption margins L{left:4.0f} R{right:4.0f} off-centre {off:+5.0f}px"
        if abs(off) > 12:
            bad += 1
            msg += "  <-- OFF"
    print(msg)
print("frames with an off-centre caption:", bad)
