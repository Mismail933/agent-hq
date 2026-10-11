"""
Every story gets its own world (2.36.0, Atlas's request after ep 29: Zhang Heng, Han China 138 CE, was rendered in the Greek kit:
a Mediterranean beach, the Alexandria lighthouse, Doric columns, togas and a European crown on the Han emperor; five different jars).

    hq assets <episode>                       what the script needs, what Rana has made, what is missing
    hq assets <episode> make                  Rana draws what is missing (saved job `assets`); Israa checks every piece
    hq assets <episode> add <backdrop|prop|costume> <id> "brief" [--for court|ruler] [--act "its animation"]
    hq assets <episode> skip ["why"] | unskip  Atlas's override: render without them (rule render.require_assets: all episodes)

A scene-file script lists the art its story needs that the kit lacks in `assets`: [{id, kind, brief, for, act}]
  backdrop  a place. `for` = the kit backdrop(s) it stands in for in this story (every scene on that backdrop is drawn in the new
            place); a scene can also name it in `set`. The scene's `backdrop` stays the nearest kit place (people are staged on it).
  prop      an object with one simple animation (`act`): props [{type: "asset", id, act_word, size}] in a scene, or <Asset id=.../>
            inside Rana's bespoke scenes (import {Asset} from './assets'). ONE design: the same jar in every shot.
  costume   what one character (`for`: scholar, ruler, ... or crowd) wears in this story. The face and identity stay; only the
            clothes and headwear change. All costumes live in ONE wardrobe file (assets/_wardrobe/Character.jsx = the project's cast
            + every costume, picked by <Character costume="id">), so a costume never changes once drawn. If the project's cast
            changes, the costumes are drawn again on the new cast ('stale').
Each piece is drawn ONCE per project (content/project-N/assets/<id>/, library.json) and reused by every later episode naming the
same id: a Han palace stays the Han palace. Rana draws a backdrop or prop as one component (validated like her bespoke scenes),
the engine renders a still (animate.py asset-still), Israa checks it (rule assets.review_rounds, rule review.assets); weak pieces
go back to her with Israa's notes. The library itself is the checkpoint: a finished piece is never drawn again after a stop.
An old script that only has free-text `kit_requests` shows them as 'unlisted': nothing can be drawn until they are listed.
"""
import hashlib
import json
import os
import re
import shutil
import time
from pathlib import Path

import control_plane as cp
import quality
import rules
import workers

ROOT = Path(__file__).parent
RANA, ISRAA = "Rana", "Israa"
KINDS = ("backdrop", "prop", "costume")
WEARERS = tuple(quality.ON_SCREEN) + ("crowd",)
FILE = {"backdrop": "Backdrop.jsx", "prop": "Prop.jsx"}
KIT_PLACES = tuple(b for b in quality.BACKDROPS if b not in ("map", "diagram", "card"))


def _sim():
    return os.environ.get("HQ_SIMULATE") == "1"


def slug(s):
    s = re.sub(r"[^a-z0-9]+", "_", str(s or "").lower()).strip("_")[:40]
    return s if s[:1].isalpha() else ("a_" + s if s else "")


def base(pid):
    return ROOT / "content" / f"project-{int(pid)}" / "assets"


def wardrobe_dir(pid):
    return base(pid) / "_wardrobe"


def library(pid):
    try:
        return json.loads((base(pid) / "library.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _save_library(pid, lib):
    base(pid).mkdir(parents=True, exist_ok=True)
    (base(pid) / "library.json").write_text(json.dumps(lib, indent=1, ensure_ascii=False), encoding="utf-8")


def _update(pid, aid, **fields):
    lib = library(pid)
    lib.setdefault(aid, {}).update(fields)
    _save_library(pid, lib)
    return lib[aid]


def _digest(path):
    try:
        return hashlib.sha256(Path(path).read_bytes()).hexdigest()[:16]
    except OSError:
        return ""


def cast_base(pid):
    """The cast file the wardrobe is built on: the project's own (cast.py) or the kit's."""
    import cast
    return cast.current_cast(pid) or cast.KIT


def _norm(a):
    brief = str(a.get("brief") or "").strip()[:1200]
    kind = str(a.get("kind") or "").strip().lower()
    if kind not in KINDS:
        kind = "costume" if re.search(r"\b(costume|dress|robe|clothes|clothing|hat|cap|uniform)\b", brief, re.I) else \
            "backdrop" if re.search(r"\b(backdrop|background|hall|palace|room|street|courtyard|landscape)\b", brief, re.I) else "prop"
    fr = a.get("for") or []
    if isinstance(fr, str):
        fr = [x for x in re.split(r"[,;/\s]+", fr.lower()) if x]
    return {"id": slug(a.get("id") or brief[:30]), "kind": kind, "brief": brief, "for": [str(x).lower() for x in fr][:6],
            "act": str(a.get("act") or "").strip()[:400]}


def needed(d):
    """The art a script asks for: [{id, kind, brief, for, act}] from `assets`. An old script's free-text `kit_requests` (only when it
    has no `assets` list) come back as kind 'unlisted'."""
    items, seen = [], set()
    for a in d.get("assets") or []:
        if isinstance(a, dict):
            n = _norm(a)
            if n["id"] and n["id"] not in seen:
                seen.add(n["id"])
                items.append(n)
    if not d.get("assets"):
        items += [{"id": "", "kind": "unlisted", "brief": str(t).strip()[:400], "for": [], "act": ""}
                  for t in d.get("kit_requests") or [] if str(t).strip()]
    return items


def state(pid, a, lib=None):
    """made | missing | stale (a costume drawn on a cast the project no longer uses) | drawing | unlisted."""
    if a["kind"] == "unlisted":
        return "unlisted"
    e = (library(pid) if lib is None else lib).get(a["id"])
    if not e or e.get("kind") != a["kind"]:
        return "missing"
    if e.get("status") == "drawing":
        return "drawing"
    if e.get("status") not in ("ready", "weak"):
        return "missing"
    if a["kind"] == "costume" and e.get("base") != _digest(cast_base(pid)):
        return "stale"
    return "made"


def script_problems(d):
    """Mistakes in how a script uses its own art (a scene naming a set or a prop the list doesn't have, a costume for nobody)."""
    out = []
    listed = {a["id"]: a for a in needed(d) if a["kind"] != "unlisted"}
    for a in listed.values():
        if a["kind"] == "costume" and (not a["for"] or a["for"][0] not in WEARERS):
            out.append(f"Costume '{a['id']}' must say who wears it (for: one of {', '.join(WEARERS)}).")
        if a["kind"] == "backdrop" and any(f not in KIT_PLACES for f in a["for"]):
            out.append(f"Backdrop '{a['id']}': 'for' must name kit backdrops it replaces ({', '.join(KIT_PLACES)}).")
    for s in d.get("scenes") or []:
        n = s.get("n", "?")
        if s.get("set") and (listed.get(slug(s["set"])) or {}).get("kind") != "backdrop":
            out.append(f"Scene {n}: set '{s['set']}' isn't a backdrop in the script's assets.")
        for p in s.get("props") or []:
            if (p or {}).get("type") == "asset" and (listed.get(slug(p.get("id"))) or {}).get("kind") != "prop":
                out.append(f"Scene {n}: prop '{p.get('id')}' isn't a prop in the script's assets.")
    return out


def view(eid):
    """hq assets <episode>: what the script needs, what is made (with Israa's word), what is missing."""
    ep = cp.get_episode(int(eid))
    if not ep:
        raise ValueError(f"No episode {eid}.")
    d, pid = ep["data"], ep["project_id"]
    lib = library(pid)
    rows = []
    for a in needed(d):
        e = lib.get(a["id"]) or {}
        row = {"id": a["id"], "kind": a["kind"], "brief": a["brief"][:200], "for": a["for"], "state": state(pid, a, lib)}
        if a["act"]:
            row["act"] = a["act"][:160]
        if e.get("review"):
            row["israa"] = f"{e['review'].get('verdict', '')}: {e['review'].get('summary', '')}"[:300]
        if e.get("files"):
            row["files"] = e["files"]
        if e.get("why"):
            row["why"] = e["why"][:300]
        rows.append(row)
    return {"episode": ep["id"], "title": ep["title"], "project": pid, "needed": rows,
            "missing": [r for r in rows if r["state"] != "made"], "script_problems": script_problems(d),
            "override": d.get("assets_override") or "", "rule_render_require_assets": rules.get("render.require_assets"),
            "drawn_for_this_project": sorted(lib)}


def render_block(ep):
    """'' when the video may be rendered, else why not (the list of what is missing and what to do)."""
    d = ep["data"]
    if not rules.get("render.require_assets") or d.get("assets_override"):
        return ""
    v = view(ep["id"])
    miss = [r for r in v["missing"] if r["state"] != "unlisted" or rules.get("render.kit_requests_block")]
    if not miss:
        return ""
    what = "; ".join((f"not listed yet: \"{r['brief'][:90]}\"" if r["state"] == "unlisted" else
                      f"{r['kind']} '{r['id']}'" + {"stale": " (the cast changed: to draw again)", "drawing": " (Rana is drawing it)"}.get(r["state"], "")
                      + f": {r['brief'][:80]}") for r in miss)
    how = f"Rana draws them first: hq assets {ep['id']} make."
    if any(r["state"] == "unlisted" for r in miss):
        how = (f"The script names them only in free text: list them first (Calina rewrites it with an `assets` list, or hq assets {ep['id']} "
               "add <backdrop|prop|costume> <id> \"brief\" --for <kit backdrop | character>), then hq assets %d make." % ep["id"])
    return (f"Episode #{ep['id']} needs its own art and it isn't all made yet: {what}. {how} To render anyway: hq assets {ep['id']} "
            "skip \"why\" (or rule render.require_assets off).")


def library_note(pid):
    """For Calina's task: the art already drawn for this channel, so she reuses the same ids."""
    lib = library(pid)
    rows = [f"- {e.get('kind')} '{k}'" + (f" (for {', '.join(e.get('for') or [])})" if e.get("for") else "") + f": {str(e.get('brief', ''))[:140]}"
            for k, e in sorted(lib.items()) if e.get("status") in ("ready", "weak")]
    return ("ART ALREADY DRAWN FOR THIS CHANNEL (reuse these ids in `assets`: the same id is the same drawing, no new one is made):\n"
            + ("\n".join(rows) if rows else "- (none yet: the kit is ancient Greek / Alexandria; any other world needs an `assets` list)"))


def add(eid, kind, aid, brief, for_=None, act="", by="Atlas"):
    """hq assets <episode> add: put one piece on the script's list (an old script with free-text kit_requests, or something forgotten)."""
    ep = cp.get_episode(int(eid))
    if not ep:
        raise ValueError(f"No episode {eid}.")
    if kind not in KINDS:
        raise ValueError(f"The kind is one of {', '.join(KINDS)}.")
    a = _norm({"id": aid, "kind": kind, "brief": brief, "for": for_ or [], "act": act})
    if not a["id"] or not a["brief"]:
        raise ValueError("Give an id and a brief.")
    d = ep["data"]
    items = [x for x in d.get("assets") or [] if slug((x or {}).get("id")) != a["id"]] + [{k: v for k, v in a.items() if v}]
    probs = script_problems({**d, "assets": items, "scenes": []})
    if probs:
        raise ValueError(" ".join(probs))
    d["assets"] = items
    cp.update_episode(ep["id"], data=d)
    cp.log(by, "asset_listed", None, {"episode": ep["id"], "id": a["id"], "kind": kind})
    return f"Episode #{ep['id']} lists {kind} '{a['id']}'." + (" (Its free-text kit_requests are no longer counted: list everything it needs.)"
                                                              if d.get("kit_requests") else "")


def override(eid, why, on=True, by="Atlas"):
    ep = cp.get_episode(int(eid))
    if not ep:
        raise ValueError(f"No episode {eid}.")
    d = ep["data"]
    if on:
        d["assets_override"] = (why or "rendered without its own art (Atlas's override)")[:300]
    else:
        d.pop("assets_override", None)
    cp.update_episode(ep["id"], data=d)
    cp.log(by, "assets_override" if on else "assets_override_off", None, {"episode": ep["id"], "why": (why or "")[:300]})
    return (f"Episode #{ep['id']} may be rendered without its own art ({d['assets_override']})." if on
            else f"Episode #{ep['id']} waits for its own art again before a render.")


# ---------------------------------------------------------------- the render side (animate.py, in the video tools' Python)
def render_art(ep):
    """What a render uses: {sets: {kit backdrop: asset id}, ready: {ids of made backdrops/props}, costumes: {who: id}, wardrobe: path or
    None, note: what Rana's bespoke scenes must reuse}."""
    d, pid = ep["data"], ep["project_id"]
    lib = library(pid)
    made = [a for a in needed(d) if state(pid, a, lib) == "made"]
    sets = {f: a["id"] for a in made if a["kind"] == "backdrop" for f in a["for"]}
    costumes = {a["for"][0]: a["id"] for a in made if a["kind"] == "costume" and a["for"]}
    ready = {a["id"] for a in made if a["kind"] in FILE}
    note = ""
    if made:
        note = ("\nTHIS STORY'S OWN ART (drawn once for this story: use it, never draw your own version of these):\n"
                "  import {Asset, Backdrop} from './assets';\n"
                + "".join(f"  <Backdrop id=\"{a['id']}\" frame={{frame}} tone=\"noon\" /> = {a['brief'][:120]} (the place: use it as this scene's background)\n"
                          for a in made if a["kind"] == "backdrop")
                + "".join(f"  <Asset id=\"{a['id']}\" x={{540}} y={{1430}} scale={{1}} frame={{frame}} at={{frame its animation starts, or null}} /> = "
                          f"{a['brief'][:120]}; its animation: {a['act'][:100] or 'none'} (drawn standing on (x, y), about 400 units tall at scale 1)\n"
                          for a in made if a["kind"] == "prop")
                + "".join(f"  <Character who=\"{w}\" costume=\"{c}\" .../> = how {w} is dressed in this story (always pass this costume)\n"
                          for w, c in costumes.items() if w != "crowd")
                + ("  <Crowd costume=\"%s\" .../> = the crowd's dress\n" % costumes["crowd"] if "crowd" in costumes else ""))
    wf = wardrobe_dir(pid) / "Character.jsx"
    return {"sets": sets, "ready": ready, "costumes": costumes, "wardrobe": wf if costumes and wf.exists() else None, "note": note}


def install_app(src, pid, ids):
    """Copy these backdrops/props next to the render's source (src/asset_<id>.jsx) and register them in src/generated_assets.js."""
    src = Path(src)
    for old in src.glob("asset_*.jsx"):
        old.unlink()
    lib = library(pid)
    found = {"backdrops": [], "props": []}
    for aid in sorted(ids):
        e = lib.get(aid) or {}
        f = base(pid) / aid / FILE.get(e.get("kind"), "-")
        if f.exists():
            shutil.copy2(f, src / f"asset_{aid}.jsx")
            found["backdrops" if e["kind"] == "backdrop" else "props"].append(aid)
    lines = [f"import a_{i} from './asset_{i}.jsx';" for k in found for i in found[k]]
    body = ", ".join(f"{k}: {{{', '.join(f'{i}: a_{i}' for i in found[k])}}}" for k in found)
    (src / "generated_assets.js").write_text("// written by assets.py at render time\n" + "\n".join(lines) + f"\nexport default {{{body}}};\n",
                                             encoding="utf-8")
    return found


# ---------------------------------------------------------------- Rana draws, Israa checks (in the office)
PIECE_SYSTEM = """You are Rana, the Designer & Animator of a small AI-run company that makes animated history videos for YouTube. Today you
draw ONE piece of a story's world that the company's kit doesn't have. It is drawn ONCE and then used in every shot of this story and
of every later episode set in the same world, so it must be right for the period, instantly readable, and in the house style.

THE KIT YOU MAY IMPORT (nothing else, no other packages, no other files):
  import React from 'react';
  import {spring, interpolate} from 'remotion';
  import {C, W, H, easeOut, easeInOut, clamp01, lerp, rnd} from './theme';   (rnd(i): a repeatable 0..1; never Math.random)

THE HOUSE STYLE: read house/Backdrops.jsx (the kit's own places), house/Extras.jsx and house/STYLE-GUIDE.md in your folder FIRST and match
them exactly: thin warm-brown outlines (#4A2C20, about 3.6 px), the muted sepia palette, flat soft shading, simple readable shapes.
house/Character.jsx is the cast that will stand in front of your drawing: match its look and scale.

RULES: deterministic (everything derives from `frame`; no Math.random, Date, timers, fetch, window, document); SVG only (no images, no
<image>, no foreignObject); under about 400 SVG elements; unique ids (include your piece's id) for any clipPath or gradient; no text on the
drawing unless the brief asks for it. True to the period and place in the brief: nothing from another culture or era (no Greek columns in
a Chinese hall, no European crown on a Han emperor, no palm beach unless the brief says so).
Answer with ONE ```jsx code block containing the complete file and nothing else."""

CONTRACT = {
    "backdrop": """THE FILE: export default function Backdrop({frame, tone}) { return <g>...</g>; }
  A full 1080 x 1920 picture (a <g>, not an <svg>). tone = 'noon' | 'sunset' | 'night' changes the light (night: a moon, never a sun).
  LAYOUT (the engine stages the people on it): the back wall or horizon ends and the floor starts at about y 1130; people stand with
  their feet at about y 1430 and are 600-700 px tall, so doors, pillars and furniture are at that scale. Keep x 200-880 between y 700
  and 1430 open floor (people stand there). y 1300-1600 lies under the captions (no important detail); y < 340 is sky or ceiling only
  (the title and callouts go there). A little life (a flame flickering, a banner moving) is welcome, slow and calm.""",
    "prop": """THE FILE: export default function Prop({frame, at}) { return <g>...</g>; }
  Drawn with its BOTTOM CENTRE at (0, 0): it stands on the ground and goes UP into negative y, about 400 units tall and at most 500
  wide (x -250..250). The engine places and scales it beside the people (a person is about 600 units tall at the same scale).
  `at` = the frame its animation starts (null = it stays at rest, never animate). Before `at` it is at rest; the animation takes at
  most 60 frames, then holds its end state, so the result stays visible. It is ONE design used in every shot: the same shape,
  colours and details every time.""",
}

COSTUME_SYSTEM = """You are Rana, the Designer & Animator of a small AI-run company that makes animated history videos for YouTube. Today you
DRESS THE CAST for a story set in another time and place.

Your folder holds Character.jsx (the project's cast + every costume drawn so far; React + SVG for Remotion): you change THIS file, in
place, and nothing else. theme.js, STYLE-GUIDE.md and CharacterSheet.jsx are there to read; do not change them.

THE JOB: give characters a COSTUME picked by a new prop: <Character ... costume="<id>"> (and <Head costume>, which the sheets draw on
their own, and <Crowd costume> if the crowd is dressed). Add `costume` to those components' props and pass it down to the drawing
functions that need it. When `costume` is an id you drew for that character, draw that costume; with no costume or an unknown id,
draw exactly what is drawn now.
IDENTITY STAYS: the face (eyes, nose, brows, all 9 mouth shapes, every expression), head shape, skin colour, hair and beard, body
build and height, and the rig stay EXACTLY as they are. Only the clothes, the headwear and what the character carries change (a robe
instead of a himation, a cap instead of a diadem; "no crown" means the crown is not drawn with this costume). True to the period in
the brief; nothing from another culture.
Keep every costume already in the file exactly as it is. Keep the RIG CONTRACT: every export with the same name and parameters, every
character id, pose, expression and mouth shape, the walk, blink and look; imports only from 'react', 'remotion' and './theme'; no
network, files, clock or randomness except the kit's seeded rnd. Same drawing style as the rest of the file.
Work with Edit, costume by costume, and check your JSX is valid (balanced tags and braces). When Israa's notes are given, fix exactly
those. End with one short paragraph: what you drew."""

REVIEW_SCHEMA = {"type": "object", "properties": {
    "verdict": {"type": "string", "enum": ["good", "weak"]},
    "summary": {"type": "string", "description": "One or two plain sentences"},
    "fixes": {"type": "array", "items": {"type": "string"}, "description": "Exact changes to the drawing (empty when good)"}},
    "required": ["verdict", "summary", "fixes"]}

REVIEW_TASK = {
    "backdrop": ("Rana drew this BACKDROP for a story: \"{brief}\". Open {files} (a person from the cast stands in it for scale). Judge: does it "
                 "show THAT place and period, with nothing from another culture or era (no Greek columns, sea, palms or lighthouse unless the "
                 "brief asks)? Is it in the same style as the person (thin warm-brown lines, muted palette, flat shading)? Is the scale right "
                 "for him (doors, pillars, furniture)? Is the floor where people stand clear, and the caption band (y 1300-1600) calm?"),
    "prop": ("Rana drew this PROP for a story: \"{brief}\"; its animation: \"{act}\". Open {files}: the first is the prop at rest, the second "
             "after its animation, beside a person from the cast for scale. Judge: is it that object, recognisable at a glance and right for "
             "the period? Does the animation read (the end state is visible)? Same style as the person? A sensible size beside him?"),
    "costume": ("Rana dressed a character of the cast for a story: \"{brief}\". Open {files}: the first is the character as he is, the second "
                "the SAME character in the costume. Judge strictly: is it the same person (face, eyes, hair and beard, skin, build, height)? "
                "Any change to who he is is a fault. Does the costume match the brief and the period, with nothing left from the old dress "
                "that the brief drops (a crown, a himation) and nothing from another culture? Same drawing style?"),
}

SIM_CODE = {"backdrop": "import React from 'react';\nexport default function Backdrop({frame, tone}) {\n  return <g><rect x=\"0\" y=\"0\" width=\"1080\" height=\"1130\" fill=\"#E9D6B0\" />"
                        "<rect x=\"0\" y=\"1130\" width=\"1080\" height=\"790\" fill=\"#B98E5E\" /></g>;\n}\n",
            "prop": "import React from 'react';\nexport default function Prop({frame, at}) {\n  const t = at === null || at === undefined ? 0 : Math.min(1, Math.max(0, (frame - at) / 30));\n"
                    "  return <g><rect x=\"-120\" y=\"-400\" width=\"240\" height=\"400\" rx=\"40\" fill=\"#8C6A3C\" stroke=\"#4A2C20\" strokeWidth=\"4\" />"
                    "<circle cx=\"0\" cy={-380 + 300 * t} r=\"18\" fill=\"#C9A050\" /></g>;\n}\n"}


def _house(kit, pid):
    """The kit's own drawings, copied where Rana can read them (her work folder; the program folder is never touched)."""
    h = Path(kit) / "house"
    h.mkdir(parents=True, exist_ok=True)
    src = ROOT / "animation" / "src"
    for f in ("Backdrops.jsx", "Extras.jsx", "theme.js"):
        shutil.copy2(src / f, h / f)
    shutil.copy2(ROOT / "animation" / "STYLE-GUIDE.md", h / "STYLE-GUIDE.md")
    shutil.copy2(cast_base(pid), h / "Character.jsx")


def validate_piece(code):
    import animator
    bad = animator.validate(code)
    for m in re.finditer(r"^\s*import\s[^;]*?from\s+['\"]([^'\"]+)['\"]", code, re.M):
        if m.group(1) not in ("react", "remotion", "./theme"):
            bad.append(f"It imports '{m.group(1)}': a piece of art imports only react, remotion and ./theme.")
    if "export default" not in code:
        bad.append("It must `export default function ...`.")
    return bad


def _idea(ep):
    p = cp.get_project(ep["project_id"], with_text=False)
    return p["idea_id"] if p else None


def _ask_piece(ep, a, notes, say):
    """Rana's file for one backdrop or prop (validated; a refused file goes back to her twice). Raises RuntimeError."""
    import animator
    task = (f"THE STORY: {ep['data'].get('storyline') or ep['title']} ({ep['data'].get('place', '')}, {ep['data'].get('year', '')})\n\n"
            f"Draw the {a['kind'].upper()} '{a['id']}': {a['brief']}\n" + (f"Its animation: {a['act']}\n" if a["kind"] == "prop" else "")
            + "\n" + CONTRACT[a["kind"]] + ("\n\nNotes on your previous drawing (fix exactly these, keep what was right):\n" + notes
                                             if notes else ""))
    problem, last = "", ""
    for attempt in range(3):
        t = task + (f"\n\nYour previous file was refused: {problem}\nFix exactly that; answer with the complete file.\n```jsx\n{last}\n```"
                    if problem else "")
        if _sim():
            text = "```jsx\n" + SIM_CODE[a["kind"]] + "```"
        else:
            kit = animator.ensure_kit()
            _house(kit, ep["project_id"])
            try:
                text, _ = workers.run(RANA, _idea(ep), PIECE_SYSTEM + animator.KIT_NOTE, t, tools=("Read", "Glob", "Grep"), max_turns=40,
                                      cwd=str(kit))
            except workers.Unavailable as e:
                raise RuntimeError(f"Rana couldn't run: {e}")
        last = animator.extract_code(str(text or ""))
        bad = validate_piece(last)
        if not bad:
            return last
        problem = "; ".join(bad)
        say(f"  Rana's {a['id']} was refused ({problem[:140]}); asking again ({attempt + 1}/2)")
    raise RuntimeError(f"Rana couldn't make a valid {a['kind']} '{a['id']}': {problem[:300]}")


def review(ep, a, files):
    """Israa looks at the rendered stills of one piece. Returns {verdict good|weak, summary, fixes}."""
    if not rules.get("review.assets"):
        return {"verdict": "good", "summary": "Not checked: Israa's check of new art is switched off (rule review.assets).", "fixes": []}
    if _sim():
        return {"verdict": "good", "summary": f"Simulated: {a['id']} fits the story.", "fixes": []}
    folder = workers.WORK / ISRAA.lower() / f"asset-{a['id']}"
    shutil.rmtree(folder, ignore_errors=True)
    folder.mkdir(parents=True, exist_ok=True)
    names = []
    for rel in files:
        shutil.copy2(ROOT / rel, folder / Path(rel).name)
        names.append(f"asset-{a['id']}/{Path(rel).name}")
    task = REVIEW_TASK[a["kind"]].format(brief=a["brief"][:600], act=a["act"][:200] or "none", files=", ".join(names))
    task += ("\nVerdict good only if it is right for this story and could stand in every shot as it is; otherwise weak, with exact fixes."
             f"\nThe story: {ep['data'].get('storyline') or ep['title']} ({ep['data'].get('place', '')}, {ep['data'].get('year', '')}).")
    system = quality.ISRAA_BASE.format(today=quality._today(), style="(Judge only this piece of art, not a script.)")
    try:
        got, _ = workers.run(ISRAA, _idea(ep), system, task, tools=("Read",), schema=REVIEW_SCHEMA, max_turns=20)
    except workers.Unavailable as e:
        return {"verdict": "weak", "summary": f"Not checked: Israa couldn't run ({str(e)[:160]}).", "fixes": []}
    return got if isinstance(got, dict) and got.get("verdict") in ("good", "weak") else \
        {"verdict": "weak", "summary": "Israa's answer couldn't be read.", "fixes": []}


def _notes(rv):
    return (rv.get("summary") or "") + ("\n- " + "\n- ".join(rv.get("fixes") or []) if rv.get("fixes") else "")


def _draw_piece(ep, a, animate, say):
    pid = ep["project_id"]
    folder = base(pid) / a["id"]
    folder.mkdir(parents=True, exist_ok=True)
    _update(pid, a["id"], kind=a["kind"], brief=a["brief"], **{"for": a["for"]}, act=a["act"], status="drawing",
            started=time.strftime("%Y-%m-%d %H:%M"), first_episode=ep["id"], why="")
    rounds, notes, rv, files = int(rules.get("assets.review_rounds")), "", None, []
    for rnd in range(rounds + 1):
        say(f"Rana is drawing {a['kind']} '{a['id']}' (round {rnd + 1})...")
        (folder / FILE[a["kind"]]).write_text(_ask_piece(ep, a, notes, say), encoding="utf-8")
        try:
            files = animate("asset-still", pid, a["id"]).get("files") or []
        except RuntimeError as e:
            notes, files = f"Your file failed to render: {str(e)[:600]}", []
            say(f"  {a['id']} didn't render ({str(e)[:140]}); back to Rana.")
            continue
        say(f"Israa is checking {a['kind']} '{a['id']}'...")
        rv = review(ep, a, files)
        if rv["verdict"] == "good":
            break
        notes = _notes(rv)
    status = "failed" if not files else "ready" if rv and rv["verdict"] == "good" else "weak"
    e = _update(pid, a["id"], status=status, review=rv, files=files, made=time.strftime("%Y-%m-%d %H:%M"),
                why="" if files else notes[:300], file=(folder / FILE[a["kind"]]).relative_to(ROOT).as_posix())
    cp.log(RANA, "asset_drawn" if files else "asset_failed", _idea(ep), {"episode": ep["id"], "id": a["id"], "kind": a["kind"], "status": status})
    return {"id": a["id"], "kind": a["kind"], "status": status, "israa": (rv or {}).get("summary", e.get("why", ""))}


def _ask_costumes(wd, ep, todo, notes):
    if _sim():
        f = wd / "Character.jsx"
        f.write_text(f.read_text(encoding="utf-8") + "".join(f"\n// costume (simulated): '{a['id']}'" for a in todo) + "\n", encoding="utf-8")
        return "Simulated: dressed the cast."
    task = (f"THE STORY: {ep['data'].get('storyline') or ep['title']} ({ep['data'].get('place', '')}, {ep['data'].get('year', '')})\n\n"
            "Draw these costumes in Character.jsx:\n" + "\n".join(f"- costume=\"{a['id']}\" for {a['for'][0]} ({quality.CAST_NAMES.get(a['for'][0], a['for'][0])}): "
                                                                  f"{a['brief']}" for a in todo)
            + (f"\n\nIsraa's notes on your previous version (fix exactly these, keep what she passed):\n{notes}" if notes else ""))
    try:
        text, _ = workers.run(RANA, _idea(ep), COSTUME_SYSTEM, task, tools=("Read", "Edit", "Write", "Glob", "Grep"), cwd=str(wd),
                              max_turns=120, timeout=5400)
    except workers.Unavailable as e:
        raise RuntimeError(f"Rana couldn't run: {e}")
    return str(text or "")[:1500]


def _costume_problem(wd, ids):
    import cast
    code = (wd / "Character.jsx").read_text(encoding="utf-8")
    bad = cast.validate(code, cast.KIT.read_text(encoding="utf-8"))
    if not bad:
        lost = [i for i in ids if f"'{i}'" not in code and f'"{i}"' not in code]
        bad = ("these costume ids aren't in the file: " + ", ".join(lost)) if lost else ""
    return bad


def _dress(ep, todo, animate, say):
    """Every costume in one wardrobe file on the project's current cast; each rendered beside the character as he is, checked by Israa."""
    pid = ep["project_id"]
    wd = wardrobe_dir(pid)
    wd.mkdir(parents=True, exist_ok=True)
    src, dig = cast_base(pid), _digest(cast_base(pid))
    meta = {}
    try:
        meta = json.loads((wd / "wardrobe.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        pass
    if not (wd / "Character.jsx").exists() or meta.get("base") != dig:   # a new cast: the costumes are drawn again on it
        if (wd / "Character.jsx").exists():
            shutil.move(str(wd / "Character.jsx"), str(wd / f"old-{meta.get('base') or 'cast'}.jsx"))
        shutil.copy2(src, wd / "Character.jsx")
        meta = {"base": dig, "cast": src.relative_to(ROOT).as_posix(), "costumes": []}
        todo = todo + [x for x in _stale(pid, todo)]
    for f in ("theme.js", "CharacterSheet.jsx"):
        shutil.copy2(ROOT / "animation" / "src" / f, wd / f)
    shutil.copy2(ROOT / "animation" / "STYLE-GUIDE.md", wd / "STYLE-GUIDE.md")
    for a in todo:
        _update(pid, a["id"], kind="costume", brief=a["brief"], **{"for": a["for"]}, act="", status="drawing",
                started=time.strftime("%Y-%m-%d %H:%M"), first_episode=ep["id"], why="")
    (wd / "wardrobe.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    before = (wd / "Character.jsx").read_text(encoding="utf-8")
    rounds, notes, left, out, said = int(rules.get("assets.review_rounds")), "", list(todo), [], ""
    keep = [k for k in meta.get("costumes", [])]
    for rnd in range(rounds + 1):
        say(f"Rana is dressing the cast: {', '.join(a['id'] for a in left)} (round {rnd + 1})...")
        said = _ask_costumes(wd, ep, left, notes) or said
        problem = _costume_problem(wd, [a["id"] for a in todo] + keep)
        if problem:
            _ask_costumes(wd, ep, left, f"Your Character.jsx was refused: {problem}. Fix that, keep the drawing.")
            problem = _costume_problem(wd, [a["id"] for a in todo] + keep)
        if problem:
            (wd / "Character.jsx").write_text(before, encoding="utf-8")   # the wardrobe stays as it was
            for a in todo:
                _update(pid, a["id"], status="failed", why=f"the wardrobe file was refused: {problem}"[:300])
            raise RuntimeError(f"Rana's costumes couldn't be used ({problem}).")
        weak, notes = [], ""
        for a in left:
            try:
                files = animate("asset-still", pid, a["id"]).get("files") or []
            except RuntimeError as e:
                weak.append(a)
                notes += f"\n{a['id']}: it failed to render: {str(e)[:400]}"
                _update(pid, a["id"], status="failed", why=f"render failed: {e}"[:300])
                continue
            say(f"Israa is checking costume '{a['id']}'...")
            rv = review(ep, a, files)
            _update(pid, a["id"], review=rv, files=files, status="ready" if rv["verdict"] == "good" else "weak", base=dig,
                    made=time.strftime("%Y-%m-%d %H:%M"), file=(wd / "Character.jsx").relative_to(ROOT).as_posix())
            if rv["verdict"] != "good":
                weak.append(a)
                notes += f"\n{a['id']} ({a['for'][0]}): " + _notes(rv)
        left = weak
        if not left:
            break
    meta["costumes"] = sorted(set(keep) | {a["id"] for a in todo})
    (wd / "wardrobe.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    lib = library(pid)
    for a in todo:
        e = lib.get(a["id"]) or {}
        cp.log(RANA, "asset_drawn" if e.get("status") in ("ready", "weak") else "asset_failed", _idea(ep),
               {"episode": ep["id"], "id": a["id"], "kind": "costume", "status": e.get("status")})
        out.append({"id": a["id"], "kind": "costume", "status": e.get("status"), "israa": (e.get("review") or {}).get("summary", e.get("why", ""))})
    return out, said


def _stale(pid, todo):
    """Costumes drawn on the old cast that this job doesn't already redraw (they must be redrawn too, or they'd be lost)."""
    have = {a["id"] for a in todo}
    return [_norm({"id": k, "kind": "costume", "brief": e.get("brief", ""), "for": e.get("for") or []})
            for k, e in library(pid).items() if e.get("kind") == "costume" and k not in have and e.get("status") in ("ready", "weak")]


def make(eid, animate, say=print):
    """hq assets <episode> make: Rana draws every listed piece that isn't made yet; Israa checks each. animate(*args) runs animate.py in
    the video tools' Python (server._animate). Returns a summary dict; raises RuntimeError when nothing could be done."""
    rules.apply_all()
    ep = cp.get_episode(int(eid))
    if not ep:
        raise RuntimeError(f"No episode {eid}.")
    pid, lib = ep["project_id"], library(ep["project_id"])
    wanted = needed(ep["data"])
    unlisted = [a for a in wanted if a["kind"] == "unlisted"]
    probs = script_problems(ep["data"])
    if probs:
        raise RuntimeError("Fix the script's asset list first: " + " ".join(probs))
    todo = [a for a in wanted if a["kind"] != "unlisted" and state(pid, a, lib) in ("missing", "stale", "drawing")]
    if not todo:
        if unlisted:
            raise RuntimeError(render_block(ep) or "The script names its art only in free text (kit_requests): list it first.")
        return {"episode": ep["id"], "made": [], "note": "Everything this script needs is already drawn."}
    cp.log(RANA, "assets_started", _idea(ep), {"episode": ep["id"], "ids": [a["id"] for a in todo]})
    done, failed = [], []
    for a in [x for x in todo if x["kind"] in FILE]:
        try:
            done.append(_draw_piece(ep, a, animate, say))
        except RuntimeError as e:
            _update(pid, a["id"], status="failed", why=str(e)[:300])
            failed.append(f"{a['id']}: {e}")
    said = ""
    costumes = [x for x in todo if x["kind"] == "costume"]
    if costumes:
        try:
            got, said = _dress(ep, costumes, animate, say)
            done += got
        except RuntimeError as e:
            failed.append(f"costumes: {e}")
    lib = library(pid)
    for a in wanted:
        if a["id"] in lib:
            lib[a["id"]]["uses"] = sorted(set(lib[a["id"]].get("uses") or []) | {ep["id"]})
    _save_library(pid, lib)
    left = [r for r in view(ep["id"])["missing"]]
    cp.log(RANA, "assets_ready" if not left else "assets_failed", _idea(ep),
           {"episode": ep["id"], "made": [d["id"] for d in done], "missing": [r["id"] or r["brief"][:60] for r in left]})
    return {"episode": ep["id"], "made": done, "failed": failed, "still_missing": left, "rana_says": said[:600]}
