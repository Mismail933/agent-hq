"""How long the camera sits on the same framing with no film/photo/spin covering (the owner: 'stuck on a country')."""
import json, sys
from pathlib import Path
p = json.loads((Path(sys.argv[1]) / "_story-props.json").read_text(encoding="utf-8"))
L, T = p["lines"], p["seconds"]
moves, cover = [], []
for i, l in enumerate(L):
    prev = L[i - 1] if i else None
    if not prev or (l.get("view") != prev.get("view") and not l.get("keep")):
        moves.append(l["t0"])
    for v in l.get("views") or []:
        moves.append(v["at"])
    if l.get("spin"):
        cover.append((l["t0"], l["t1"]))
    if l.get("footage"):
        v = l["footage"]; cover.append((v["at"], v["at"] + v["dur"]))
    for k in ("photo", "photo2"):
        if l.get(k):
            cover.append((l[k].get("at", l["t0"]), l["t1"]))
moves = sorted(moves) + [T]
out = []
for a, b in zip(moves, moves[1:]):
    still = (b - a) - sum(max(0.0, min(b, s1) - max(a, s0)) for s0, s1 in cover)
    li = max(i for i, l in enumerate(L) if l["t0"] <= a + 0.01)
    out.append((round(still, 1), round(a, 1), round(b, 1), li, L[li].get("view")))
out.sort(reverse=True)
print("camera-still stretches over", sys.argv[2] if len(sys.argv) > 2 else 6, "s:")
for o in out:
    if o[0] > float(sys.argv[2] if len(sys.argv) > 2 else 6):
        print(f"  {o[0]:5.1f} s  {o[1]:6.1f}-{o[2]:6.1f}  from line {o[3]}  view {o[4]}")
