"""
Rana draws the cast (2.28.0, Atlas's request "Make the Animator the company's character artist").

    hq cast-draw <project> <image path...> ["notes"]      hq cast <project>      hq cast-use <project> kit|v<K>

Before this, the cast was code inside the program (animation/src/Character.jsx), so every redraw needed a Builder. Now:
1. A new version folder content/project-N/cast/v<K>/ gets a copy of the cast the project uses now (its own, or the kit's), the
   kit's theme and style guide to read, and the owner's reference images (refs/).
2. Rana (Opus on the subscription) LOOKS at the images and redraws Character.jsx IN THAT FOLDER ONLY (Read/Edit/Write there; she
   never touches program files). Same rig contract: every export the kit has, the same ids, poses, expressions, mouths.
3. `validate` (the same rules as her scenes: kit-only imports, no network/disk/clock/eval, size cap, every export kept). A failure
   goes back to her with the reason (one repair round).
4. animate.py `cast-test` renders reference sheets + 30-second test clips of the candidate into v<K>/characters/ (the project's own
   characters are not touched). A render error goes back to her too.
5. Israa compares each character with its sheet AND, side by side, with the owner's picture (`quality.review_characters(refs=...)`).
   Characters she fails go back to Rana with her notes: 2 rounds (`ROUNDS`).
6. Then it becomes the project's candidate: meta `cast` = {version, file}, the project's characters library points at v<K>, and
   the owner's approval is withdrawn until he approves this cast (Voice & characters, or his phone). Renders use the project's
   cast file (animate.cast_file) from then on; `cast-use <project> kit` goes back to the kit's characters.
Anything that fails leaves the project exactly as it was.
"""
import json
import re
import shutil
import time
from pathlib import Path

import control_plane as cp
import quality
import workers

ROOT = Path(__file__).parent
KIT = ROOT / "animation" / "src" / "Character.jsx"
RANA = "Rana"
ROUNDS = 2            # Israa may send characters back to Rana this many times
MAX_BYTES = 200000
ALLOWED_IMPORTS = {"react", "remotion", "./theme"}
BANNED = [r"\brequire\s*\(", r"\bimport\s*\(", r"\bfetch\b", r"XMLHttpRequest", r"\beval\b", r"\bFunction\s*\(", r"\bwindow\b",
          r"\bdocument\b", r"\blocalStorage\b", r"\bDate\b", r"Math\.random", r"\bprocess\b", r"\bglobalThis\b", r"WebSocket",
          r"\bstaticFile\b", r"https?://"]

SYSTEM = """You are Rana, the Designer & Animator of a small AI-run company that makes animated history videos for YouTube. Today you
are the CHARACTER ARTIST: you redraw the company's whole cast so it matches the owner's reference picture.

Your working folder holds:
- Character.jsx: the cast as it is now (React + SVG for Remotion). You change THIS file, in place, and nothing else.
- theme.js, STYLE-GUIDE.md, CharacterSheet.jsx, CharacterTest.jsx: read them to understand the kit; do not change them.
- refs/: the owner's reference image(s). Open every one with Read FIRST and study it: proportions (head-to-body), line colour and
  weight, faces and eyes, hair and beards, clothes and folds, palette, shading.

The RIG CONTRACT (other code depends on it, so it must not break):
- Keep every export with the same name and the same parameters (POSES, ACTIONS, MOUTHS, EXPRESSIONS, HEAD_Y, CAST_IDS, CAST_INFO,
  castOf, crowdLook, reach, Head, Character, REACTIONS, Crowd, and any other export in the file).
- Keep every character id, every pose, every expression and all 9 mouth shapes (A-H and X: Rhubarb's), the walk, blink, look.
- Imports only from 'react', 'remotion' and './theme'. No network, no files, no clock, no randomness except the kit's seeded rnd.
- Draw with SVG primitives. Keep it fast: no filters on every frame, no huge path counts.
Work like this: read, plan the look, then edit the drawing functions character by character. Check your JSX is valid (balanced
tags, braces). When Israa's notes are given, fix exactly those and keep what she passed.
Answer at the end with one short paragraph for the owner: what you changed and why it now matches his picture."""


def kit_exports(code):
    return set(re.findall(r"^export\s+(?:const|function|let)\s+(\w+)", code, re.M))


def validate(code, kit_code):
    """'' when the file is safe and keeps the rig contract, else the reason."""
    if len(code.encode()) > MAX_BYTES:
        return f"the file is {len(code.encode()):,} bytes (at most {MAX_BYTES:,})"
    for m in re.finditer(r"^\s*import\s+[^;]*?from\s+['\"]([^'\"]+)['\"]", code, re.M):
        if m.group(1) not in ALLOWED_IMPORTS:
            return f"it imports '{m.group(1)}' (only react, remotion and ./theme)"
    for pat in BANNED:
        if re.search(pat, code):
            return f"it uses something not allowed ({pat.strip(chr(92) + 'b')})"
    missing = kit_exports(kit_code) - kit_exports(code)
    if missing:
        return "it dropped exports other code needs: " + ", ".join(sorted(missing))
    if code.count("{") != code.count("}") or code.count("(") != code.count(")"):
        return "its braces or brackets don't balance"
    return ""


def current_cast(pid):
    """The project's own cast file (as animate.cast_file, without importing the video tools), or None."""
    p = cp.get_project(int(pid), with_text=False) or {}
    f = ((p.get("meta") or {}).get("cast") or {}).get("file")
    return ROOT / f if f and (ROOT / f).exists() else None


def versions(pid):
    base = ROOT / "content" / f"project-{int(pid)}" / "cast"
    return sorted((p for p in base.glob("v*") if p.name[1:].isdigit()), key=lambda p: int(p.name[1:])) if base.exists() else []


def status(pid):
    p = cp.get_project(int(pid), with_text=False) or {}
    cur = (p.get("meta") or {}).get("cast") or {}
    out = {"uses": f"v{cur['version']}" if cur.get("version") else "the kit's characters", "approved": quality.characters_ready(p),
           "versions": []}
    for v in versions(pid):
        try:
            st = json.loads((v / "cast.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            st = {}
        out["versions"].append({"version": v.name, **{k: st.get(k) for k in ("status", "made", "note", "reviews_passed", "rounds")}})
    return out


def _sim():
    import os
    return os.environ.get("HQ_SIMULATE") == "1"


def _ask(folder, task):
    if _sim():
        f = folder / "Character.jsx"
        f.write_text(f.read_text(encoding="utf-8").replace("// ", "// (Rana, simulated) ", 1), encoding="utf-8")
        return "Simulated: redrew the cast."
    text, _ = workers.run(RANA, None, SYSTEM, task, tools=("Read", "Edit", "Write", "Glob", "Grep"), cwd=str(folder),
                          max_turns=120, timeout=5400)
    return str(text or "")[:2000]


def draw(pid, images, notes, animate, say=print):
    """The whole job. animate(*args) runs animate.py in the video tools' Python (server._animate). Returns the summary dict.
    Raises RuntimeError with the reason when it fails; the project is then unchanged."""
    pid = int(pid)
    p = cp.get_project(pid, with_text=False)
    if not p:
        raise RuntimeError(f"No project {pid}.")
    refs = [Path(i) for i in images if Path(i).exists()]
    if not refs:
        raise RuntimeError("Name at least one reference image that exists (e.g. Atlas-HQ/review/uploads/<file>).")
    k = 1 + max([int(v.name[1:]) for v in versions(pid)] or [0])
    folder = ROOT / "content" / f"project-{pid}" / "cast" / f"v{k}"
    folder.mkdir(parents=True, exist_ok=True)
    base = current_cast(pid) or KIT
    shutil.copy2(base, folder / "Character.jsx")
    for f in ("theme.js", "CharacterSheet.jsx", "CharacterTest.jsx"):
        shutil.copy2(ROOT / "animation" / "src" / f, folder / f)
    shutil.copy2(ROOT / "animation" / "STYLE-GUIDE.md", folder / "STYLE-GUIDE.md")
    (folder / "refs").mkdir(exist_ok=True)
    local_refs = []
    for r in refs:
        shutil.copy2(r, folder / "refs" / r.name)
        local_refs.append(folder / "refs" / r.name)
    kit_code = KIT.read_text(encoding="utf-8")
    state = {"status": "drawing", "made": time.strftime("%Y-%m-%d %H:%M"), "refs": [r.name for r in refs], "note": notes, "rounds": 0}

    def save():
        (folder / "cast.json").write_text(json.dumps(state, indent=1), encoding="utf-8")
    save()
    cp.log(RANA, "cast_started", None, {"project": pid, "version": k, "refs": state["refs"]})
    task = ("Redraw the whole cast to match the owner's reference picture(s) in refs/: " + ", ".join(f"refs/{r.name}" for r in refs)
            + (f"\nNotes from the owner and Atlas: {notes}" if notes else "") + "\nChange Character.jsx in place.")
    feedback, reviews = "", {}
    for rnd in range(ROUNDS + 1):
        state["rounds"] = rnd
        save()
        say(f"Rana is drawing (round {rnd + 1})...")
        state["rana_says"] = _ask(folder, task if not feedback else
                                  "Fix exactly these problems in Character.jsx, keep everything that passed:\n" + feedback)
        for attempt in range(2):   # the safety scan and the test render: a failure goes back to her once
            problem = validate((folder / "Character.jsx").read_text(encoding="utf-8"), kit_code)
            if not problem:
                try:
                    say("Rendering the reference sheets and test clips (about 40 minutes)...")
                    animate("cast-test", pid, folder)
                except RuntimeError as e:
                    problem = f"the test render failed: {str(e)[:600]}"
            if not problem:
                break
            if attempt == 1:
                state["status"] = "failed"
                state["why"] = problem
                save()
                raise RuntimeError(f"Rana's cast couldn't be used ({problem}). The project keeps its characters.")
            say(f"Rana's file didn't pass ({problem[:160]}); she fixes it.")
            _ask(folder, f"Your Character.jsx was refused: {problem}. Fix that, keep the drawing.")
        say("Israa is comparing each character with its sheet and with the owner's picture...")
        weak_ids = None if rnd == 0 else [w for w, r in reviews.items() if r.get("verdict") != "pass"]
        reviews.update(quality.review_characters(pid, lib_dir=folder / "characters", refs=local_refs, only=weak_ids))
        weak = {w: r for w, r in reviews.items() if r.get("verdict") != "pass"}
        if not weak or rnd == ROUNDS:
            break
        feedback = "\n".join(f"- {quality.CAST_NAMES.get(w, w)}: {r.get('summary', '')} "
                             + "; ".join(i for s in r.get("shots") or [] for i in (s.get("issues") or []))[:900] for w, r in weak.items())
    passed = sum(1 for r in reviews.values() if r.get("verdict") == "pass")
    install(pid, k)
    state.update(status="candidate", reviews_passed=f"{passed} of {len(reviews)}")
    save()
    cp.log(RANA, "cast_ready", None, {"project": pid, "version": k, "passed": state["reviews_passed"]})
    return {"version": k, "passed": passed, "total": len(reviews), "rana_says": state.get("rana_says", ""),
            "weak": [quality.CAST_NAMES.get(w, w) for w, r in reviews.items() if r.get("verdict") != "pass"]}


def install(pid, k):
    """Make v<K> the project's cast: its library becomes the project's characters library (the old one is kept as
    library-before-v<K>.json) and the owner's approval waits for this cast."""
    folder = ROOT / "content" / f"project-{int(pid)}" / "cast" / f"v{int(k)}"
    lib = json.loads((folder / "characters" / "library.json").read_text(encoding="utf-8"))
    lib["cast"] = int(k)
    target = quality.characters_dir(pid)
    target.mkdir(parents=True, exist_ok=True)
    if (target / "library.json").exists():
        shutil.copy2(target / "library.json", target / f"library-before-v{int(k)}.json")
    (target / "library.json").write_text(json.dumps(lib, indent=2), encoding="utf-8")
    cp.set_project_meta(int(pid), cast={"version": int(k), "file": (folder / "Character.jsx").relative_to(ROOT).as_posix()},
                        characters_approved=False)


def use(pid, which):
    """cast-use <project> kit | v<K>: which cast the project's videos use (the owner approves it again)."""
    pid = int(pid)
    if which == "kit":
        target = quality.characters_dir(pid)
        before = sorted(target.glob("library-before-v*.json"))
        cp.set_project_meta(pid, cast=None, characters_approved=False)
        return ("The project uses the kit's characters again. Make their test clips again (Voice & characters) before the next video."
                + (" (The kit's earlier test clips are kept in " + before[0].name + ".)" if before else ""))
    k = int(str(which).lstrip("v"))
    folder = ROOT / "content" / f"project-{pid}" / "cast" / f"v{k}"
    if not (folder / "characters" / "library.json").exists():
        raise ValueError(f"v{k} has no test clips.")
    install(pid, k)
    return f"The project uses Rana's cast v{k} now. The owner approves it in Voice & characters (or on his phone) before the next video."
