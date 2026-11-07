"""The owner's standing rule (11-07): never more than MAX seconds on one map framing while the voice talks. For a part that
has been voiced (voice.json + _story-props.json), every line whose camera holds one framing longer than MAX (not covered by
film, a photo or a turning globe) gets a mid-line camera move on the word nearest the middle of that stretch: alternately
in closer (x1.7) and back out wider (x0.65) on the same place, so it stays on the subject but never sits still.
Writes the moves into script.json (views). Usage: auto_moves.py <part folder> [MAX]"""
import json
import re
import sys
from pathlib import Path

F = Path(sys.argv[1])
MAX = float(sys.argv[2]) if len(sys.argv) > 2 else 5.0
s = json.loads((F / "script.json").read_text(encoding="utf-8"))
p = json.loads((F / "_story-props.json").read_text(encoding="utf-8"))
vo = json.loads((F / "voice.json").read_text(encoding="utf-8"))
split = p.get("split", 0)
L, st = p["lines"], s["story"]
words = [l["words"] for l in vo["lines"] if not l.get("short")]
added = 0
for i, (l, sl) in enumerate(zip(L, st)):
    if sl.get("spin") or sl.get("turn") or (sl.get("follow") and sl.get("ship")):
        continue
    t0, t1 = l["t0"], l["t1"]
    marks = [t0] + sorted(v["at"] for v in l.get("views") or []) + [t1]
    cover = []
    if l.get("footage"):
        v = l["footage"]; cover.append((v["at"], v["at"] + v["dur"]))
    for k in ("photo", "photo2"):
        if l.get(k):
            cover.append((l[k].get("at", t0), t1))
    new = []
    for a, b in zip(marks, marks[1:]):
        free = [(a, b)]
        for c0, c1 in cover:   # the still map time = this stretch minus what film/photos cover
            free = [seg for x0, x1 in free for seg in ((x0, min(x1, c0)), (max(x0, c1), x1)) if seg[1] - seg[0] > 0.05]
        for x0, x1 in free:
            if x1 - x0 > MAX:
                mid = (x0 + x1) / 2
                ws = [w for w in words[i] if x0 + 1.0 < w[1] - split < x1 - 1.0 and len(re.sub(r"\W", "", w[0])) > 2]
                if ws:
                    w = min(ws, key=lambda w: abs(w[1] - split - mid))
                    new.append(re.sub(r"[^\w'-]", "", w[0]))
    if not new:
        continue
    base = list(sl.get("views", [[None, sl["view"]]])[-1][1]) if sl.get("views") else list(sl["view"])
    sl.setdefault("views", [])
    for n, cue in enumerate(new):
        k = 1.7 if (i + n) % 2 == 0 else 0.65
        base = [base[0], base[1], round(base[2] * k)]
        sl["views"].append([cue, base])
        added += 1
    sl["views"].sort(key=lambda v: sl["text"].lower().find(v[0].lower()))
(F / "script.json").write_text(json.dumps(s, indent=1, ensure_ascii=False), encoding="utf-8")
print("added", added, "camera moves")
