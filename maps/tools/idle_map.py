"""The owner 11-07 22:40: never a still map with nothing happening. Lists stretches of map-only time (no film, no photo) where nothing
new appears on the map (no pin, move, fill change, date, tint, region, label, arc) for more than MAX seconds.
Usage: idle_map.py <part folder> [MAX]"""
import json
import sys
from pathlib import Path

F = Path(sys.argv[1])
MAX = float(sys.argv[2]) if len(sys.argv) > 2 else 5.0
p = json.loads((F / "_story-props.json").read_text(encoding="utf-8"))
L = p["lines"]
cover, ev = [], []
prev = {}
for i, l in enumerate(L):
    if l.get("footage"):
        v = l["footage"]; cover.append((v["at"], v["at"] + v["dur"]))
    for k in ("photo", "photo2"):
        if l.get(k):
            cover.append((l[k].get("at", l["t0"]), l[k].get("until", l["t1"])))
    if l.get("spin") or l.get("turn"):
        cover.append((l["t0"], l["t1"]))       # the globe turns under the words: moving, not still
    if l.get("view") != prev.get("view") or l.get("fill") != prev.get("fill") or l.get("date") != prev.get("date"):
        ev.append((l["t0"], i, "line"))
    for x in l.get("pins") or []:
        ev.append((x["at"], i, "pin " + x["label"]))
    for x in l.get("views") or []:
        ev.append((x["at"], i, "move"))
    for t, _ in l.get("dates") or []:
        ev.append((t, i, "date"))
    for x in l.get("tints") or []:
        if isinstance(x, dict) and "at" in x:
            ev.append((x["at"], i, "tint"))
    for x in l.get("labels") or []:
        if isinstance(x, dict) and "at" in x:
            ev.append((x["at"], i, "label"))
    for r in l.get("regions") or []:
        ev.append((l["t0"] + (r.get("delay") or 0), i, "region"))
    if l.get("arc"):
        ev.append((l["t0"], i, "arc"))
    prev = l
cover.sort()
end = L[-1]["t1"]
free, t = [], 0.0
for a, b in cover:
    if a > t:
        free.append((t, a))
    t = max(t, b)
if end > t:
    free.append((t, end))
ev.sort()
bad = []
for a, b in free:
    marks = [a] + [e[0] for e in ev if a < e[0] < b] + [b]
    for x, y in zip(marks, marks[1:]):
        if y - x > MAX:
            line = max(i for i, l in enumerate(L) if l["t0"] <= x + 0.01)
            bad.append((round(y - x, 1), round(x, 1), round(y, 1), line))
bad.sort(reverse=True)
print("map-only stretches with nothing new for more than", MAX, "s:", len(bad))
for d, x, y, line in bad:
    print(f"  {d:5.1f} s  {x:6.1f}-{y:6.1f}  line {line}: {L[line].get('say', '')[:90]}")
