"""Every camera move of a map part, in order: when, on which word, from where to where, and whether it has a reason.
Flags: SAME-PLACE (only the zoom changes on the same spot), BACK (returns to a spot it left within 2 moves), STEP (a second move
within 4 s towards the same spot). Usage: cam_list.py <part folder> [--fix] (--fix drops flagged mid-line moves and drift)."""
import json
import math
import sys
from pathlib import Path

F = Path(sys.argv[1])
s = json.loads((F / "script.json").read_text(encoding="utf-8"))
p = json.loads((F / "_story-props.json").read_text(encoding="utf-8"))
st, L = s["story"], p["lines"]


def dist(a, b):
    la = math.radians((a[1] + b[1]) / 2)
    return math.hypot((a[0] - b[0]) * math.cos(la), a[1] - b[1])


def name(v):
    return f"[{v[0]:.1f}, {v[1]:.1f}] x{v[2]}"


moves, cur = [], None
for i, (sl, pl) in enumerate(zip(st, L)):
    if sl.get("turn") or sl.get("spin"):
        moves.append({"line": i, "t": pl["t0"], "cue": "(line start)", "to": None, "kind": "globe turn", "mid": False})
        cur = None
        continue
    seq = [("(line start)", sl["view"], pl["t0"], False)]
    for (cue, v), pv in zip(sl.get("views") or [], pl.get("views") or []):
        seq.append((cue, v, pv["at"], True))
    for cue, v, t, mid in seq:
        if cur is not None and list(v) == list(cur):
            continue
        moves.append({"line": i, "t": t, "cue": cue, "from": cur, "to": list(v), "mid": mid})
        cur = list(v)

for k, m in enumerate(moves):
    f = []
    if m.get("to") and m.get("from"):
        d = dist(m["from"], m["to"])
        span = 57.3 * 6 / max(m["to"][2], m["from"][2]) * 100
        if d < max(1.0, 0.15 * 5000 / max(m["to"][2], 1)):
            f.append("SAME-PLACE")
        prev = [x for x in moves[max(0, k - 3):k] if x.get("from")]
        if any(x["from"] and dist(x["from"], m["to"]) < 1.0 and abs(math.log(x["from"][2] / m["to"][2])) < 0.4 for x in prev[-2:]):
            f.append("BACK")
        if k and moves[k - 1].get("to") and m["t"] - moves[k - 1]["t"] < 4 and dist(moves[k - 1]["to"], m["to"]) < 2:
            f.append("STEP")
    m["flags"] = f

if "--fix" in sys.argv:
    s["drift"] = False
    drop = {(m["line"], m["cue"]) for m in moves if m["mid"] and m["flags"]}
    for i, sl in enumerate(st):
        if sl.get("views"):
            sl["views"] = [v for v in sl["views"] if (i, v[0]) not in drop]
            if not sl["views"]:
                sl.pop("views")
    (F / "script.json").write_text(json.dumps(s, indent=1, ensure_ascii=False), encoding="utf-8")
    print("dropped", len(drop), "mid-line moves; drift off")
else:
    for m in moves:
        mm, ss = divmod(m["t"], 60)
        if m.get("kind"):
            print(f"{int(mm)}:{ss:04.1f}  line {m['line']:2}  slow globe turn across the places named")
            continue
        txt = st[m["line"]]["text"]
        print(f"{int(mm)}:{ss:04.1f}  line {m['line']:2}  on '{m['cue']}'  -> {name(m['to'])}  {' '.join(m['flags'])}")
    print(len(moves), "moves,", sum(1 for m in moves if m["flags"]), "flagged; drift:", s.get("drift"))
