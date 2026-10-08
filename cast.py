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
   Characters she fails go back to Rana with her notes: 2 rounds (`ROUNDS`, rule `cast.review_rounds`). Rule `cast.final_check`
   (on): if Character.jsx changed after Israa's last check (`_digest`), it is rendered and checked once more before installing.
   `check` (hq cast-check <project> v<K>): render + Israa's check of a version once more, no redraw.
6. Then it becomes the project's candidate: meta `cast` = {version, file}, the project's characters library points at v<K>, and
   the owner's approval is withdrawn until he approves this cast (Voice & characters, or his phone). Renders use the project's
   cast file (animate.cast_file) from then on; `cast-use <project> kit` goes back to the kit's characters.
Anything that fails leaves the project exactly as it was.

Resuming (Atlas's request 2026-10-08, "Rana is restarting the work again?"): cast.json keeps the step (draw / check / review /
install), the round, Israa's reviews and her feedback. A version that stops (an agent's allowance ran out, an error) is marked
`stopped` with the reason; one cut off by a restart is marked at the next start (`mark_cut_off`). It resumes from there: the saved
job after a restart (same pictures = same version), by itself when the allowance is back (`waiting`, server.cast_watch, rule
`cast.auto_resume`), or `hq cast-draw <project> --resume [v<K>]`. `--new` starts a fresh version (older unfinished ones are marked
stopped, "replaced by").
"""
import json
import re
import shutil
import time
from pathlib import Path

import control_plane as cp
import quality
import rules
import workers

ROOT = Path(__file__).parent
KIT = ROOT / "animation" / "src" / "Character.jsx"
RANA = "Rana"
ROUNDS = 2            # Israa may send characters back to Rana this many times (rule cast.review_rounds)
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
        out["versions"].append({"version": v.name, **{k: st.get(k) for k in ("status", "made", "note", "reviews_passed", "rounds", "step",
                                                                              "why", "wait_for", "stopped", "resumes", "checked") if st.get(k) not in (None, "")}})
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


def _folder(pid, k):
    return ROOT / "content" / f"project-{int(pid)}" / "cast" / f"v{int(k)}"


def _state(folder):
    try:
        return json.loads((folder / "cast.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _save(folder, state):
    (folder / "cast.json").write_text(json.dumps(state, indent=1), encoding="utf-8")


def _digest(folder):
    """A fingerprint of the version's Character.jsx: tells whether what Israa checked is what the file holds now."""
    import hashlib
    try:
        return hashlib.sha256((folder / "Character.jsx").read_bytes()).hexdigest()[:16]
    except OSError:
        return ""


def unfinished(pid):
    """Rana's versions that never finished, newest first: [(k, state)] ('drawing' = cut off, or 'stopped')."""
    return [(int(v.name[1:]), st) for v in reversed(versions(pid)) for st in [_state(v)] if st.get("status") in ("drawing", "stopped")]


def _all_states():
    for f in sorted((ROOT / "content").glob("project-*/cast/v*/cast.json")):
        pid, v = f.parent.parent.parent.name[8:], f.parent.name[1:]
        if pid.isdigit() and v.isdigit():
            yield int(pid), int(v), f.parent


def mark_stopped(pid, k, why, wait_for=""):
    """An unfinished version is 'stopped' with the reason (wait_for: the agent whose allowance it waits for); it can be resumed."""
    folder = _folder(pid, k)
    st = _state(folder)
    if not st or st.get("status") == "candidate":
        return
    st.update(status="stopped", why=str(why)[:400], wait_for=wait_for, stopped=time.strftime("%Y-%m-%d %H:%M"))
    _save(folder, st)
    cp.log(RANA, "cast_stopped", None, {"project": int(pid), "version": int(k), "step": st.get("step"), "why": str(why)[:300]})


def mark_cut_off():
    """At office start nothing is drawing yet: a version still 'drawing' was cut off. Returns ['project P vK', ...]."""
    out = []
    for pid, k, folder in _all_states():
        if _state(folder).get("status") == "drawing":
            mark_stopped(pid, k, "the office restarted (or closed) while Rana worked")
            out.append(f"project {pid} v{k}")
    return out


def waiting():
    """Stopped versions that wait for an agent's allowance: [(pid, k, state)] (server.cast_watch resumes them)."""
    return [(pid, k, st) for pid, k, folder in _all_states() for st in [_state(folder)]
            if st.get("status") == "stopped" and st.get("wait_for")]


def pick(pid, resume="", images=()):
    """Which version to continue, or None for a fresh one. resume: '' = an unfinished version made from the same pictures (else
    fresh), 'new', 'latest', or 'v<K>'. Raises RuntimeError when there is nothing to resume."""
    pid, r = int(pid), str(resume or "").strip().lower()
    names = sorted(Path(i).name for i in images)
    left = unfinished(pid)
    if r == "new":
        return None
    if r in ("", "auto"):
        return next((k for k, st in left if names and sorted(st.get("refs") or []) == names), None)
    if r == "latest":
        if not left:
            raise RuntimeError(f"Rana has no unfinished cast for project {pid} (see hq cast {pid}).")
        return left[0][0]
    if not r.lstrip("v").isdigit():
        raise RuntimeError("Say --resume, --resume v<K> or --new.")
    k = int(r.lstrip("v"))
    st = _state(_folder(pid, k))
    if not st:
        raise RuntimeError(f"Project {pid} has no cast v{k}.")
    if st.get("status") == "candidate":
        raise RuntimeError(f"v{k} is finished already (hq cast-use {pid} v{k} to use it).")
    return k


STEPS = {"draw": "Rana's drawing", "check": "the safety check and test clips", "review": "Israa's side-by-side review",
         "install": "installing"}


def draw(pid, images, notes, animate, say=print, resume=""):
    """The whole job. animate(*args) runs animate.py in the video tools' Python (server._animate). Returns the summary dict.
    Every step is saved in cast.json (step, round, Israa's reviews), so a stopped or cut-off version resumes where it was
    (`pick`): what Rana drew and the characters Israa passed are kept, only the unfinished steps run.
    Raises RuntimeError with the reason when it fails or stops; the project is then unchanged."""
    pid = int(pid)
    p = cp.get_project(pid, with_text=False)
    if not p:
        raise RuntimeError(f"No project {pid}.")
    refs = [Path(i) for i in images if Path(i).exists()]
    k = pick(pid, resume, refs)
    resumed = k is not None
    if not resumed:
        if not refs:
            raise RuntimeError("Name at least one reference image that exists (e.g. Atlas-HQ/review/uploads/<file>).")
        k = 1 + max([int(v.name[1:]) for v in versions(pid)] or [0])
        for old, _ in unfinished(pid):
            mark_stopped(pid, old, f"replaced by v{k} (a fresh start)")
        folder = _folder(pid, k)
        folder.mkdir(parents=True, exist_ok=True)
        base = current_cast(pid) or KIT
        shutil.copy2(base, folder / "Character.jsx")
        for f in ("theme.js", "CharacterSheet.jsx", "CharacterTest.jsx"):
            shutil.copy2(ROOT / "animation" / "src" / f, folder / f)
        shutil.copy2(ROOT / "animation" / "STYLE-GUIDE.md", folder / "STYLE-GUIDE.md")
        (folder / "refs").mkdir(exist_ok=True)
        for r in refs:
            shutil.copy2(r, folder / "refs" / r.name)
        state = {"status": "drawing", "made": time.strftime("%Y-%m-%d %H:%M"), "refs": [r.name for r in refs], "note": notes,
                 "round": 0, "rounds": 0, "step": "draw", "reviews": {}, "feedback": ""}
        cp.log(RANA, "cast_started", None, {"project": pid, "version": k, "refs": state["refs"]})
    else:
        folder = _folder(pid, k)
        state = _state(folder)
        state.setdefault("round", state.get("rounds", 0))   # versions from before 2.28.x: guess the step from what is on disk
        state.setdefault("step", "review" if (folder / "characters" / "library.json").exists() else "draw")
        state.setdefault("reviews", {})
        state.setdefault("feedback", "")
        if notes and notes not in (state.get("note") or ""):
            state["note"] = ((state.get("note") or "") + " " + notes).strip()
        state.update(status="drawing", why="", wait_for="", resumes=state.get("resumes", 0) + 1)
        cp.log(RANA, "cast_resumed", None, {"project": pid, "version": k, "step": state["step"], "round": state["round"]})
        say(f"Rana is picking up her cast v{k} at {STEPS.get(state['step'], state['step'])} (round {state['round'] + 1})...")
    _save(folder, state)
    try:
        return _run(pid, k, folder, state, animate, say, resumed and state["step"] == "draw")
    except Exception as e:
        if state.get("status") == "failed":
            raise
        m = re.match(r"(\w+)'s daily subscription allowance", str(e))
        step = STEPS.get(state.get("step"), state.get("step"))
        state.update(status="stopped", why=str(e)[:400], wait_for=m.group(1) if m else "", stopped=time.strftime("%Y-%m-%d %H:%M"))
        _save(folder, state)
        cp.log(RANA, "cast_stopped", None, {"project": pid, "version": k, "step": state.get("step"), "why": str(e)[:300]})
        then = (f"It picks up there by itself when {m.group(1)}'s allowance is back." if m and rules.get("cast.auto_resume")
                else f"Pick it up with hq cast-draw {pid} --resume v{k}.")
        raise RuntimeError(f"Rana's cast v{k} stopped at {step} (round {state.get('round', 0) + 1}): {e}. Nothing drawn is lost. {then}") from e


def _run(pid, k, folder, state, animate, say, continuing):
    rules.apply_all()   # cast.review_rounds as Atlas set it
    kit_code = KIT.read_text(encoding="utf-8")
    local_refs = sorted(f for f in (folder / "refs").glob("*") if f.is_file())
    notes = state.get("note") or ""
    task = ("Redraw the whole cast to match the owner's reference picture(s) in refs/: " + ", ".join(f"refs/{r.name}" for r in local_refs)
            + (f"\nNotes from the owner and Atlas: {notes}" if notes else "") + "\nChange Character.jsx in place.")
    reviews = state["reviews"]
    while state["step"] != "install":
        rnd = state["round"]
        state["rounds"] = rnd
        if state["step"] == "draw":
            say(f"Rana is drawing (round {rnd + 1})...")
            ask = task if not state["feedback"] else ("Fix exactly these problems in Character.jsx, keep everything that passed:\n"
                                                      + state["feedback"])
            if continuing:   # she was stopped halfway: her file holds the work so far
                ask = ("You were interrupted in the middle of this job. Character.jsx already holds your work so far: read it, keep "
                       "everything you already drew, and finish only what is left.\n\nThe job:\n" + ask)
                continuing = False
            state["rana_says"] = _ask(folder, ask)
            state["step"] = "check"
            _save(folder, state)
        if state["step"] == "check":
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
                    _save(folder, state)
                    raise RuntimeError(f"Rana's cast couldn't be used ({problem}). The project keeps its characters.")
                say(f"Rana's file didn't pass ({problem[:160]}); she fixes it.")
                _ask(folder, f"Your Character.jsx was refused: {problem}. Fix that, keep the drawing.")
            state.update(step="review", rendered=_digest(folder))
            _save(folder, state)
        if state["step"] == "review":
            say("Israa is comparing each character with its sheet and with the owner's picture...")
            weak_ids = None if not reviews else [w for w, r in reviews.items() if r.get("verdict") != "pass"]
            reviews.update(quality.review_characters(pid, lib_dir=folder / "characters", refs=local_refs, only=weak_ids))
            state["reviewed"] = state.get("rendered", "")
            weak = {w: r for w, r in reviews.items() if r.get("verdict") != "pass"}
            if not weak or rnd >= ROUNDS:
                state["step"] = "install"
                if rules.get("cast.final_check") and state["reviewed"] != _digest(folder):   # changed after her check: once more
                    say("Rana's last fixes were never rendered or checked: rendering them and Israa checks once more...")
                    state.update(step="check")
                    reviews.clear()
            else:
                state["feedback"] = "\n".join(f"- {quality.CAST_NAMES.get(w, w)}: {r.get('summary', '')} "
                                              + "; ".join(i for s in r.get("shots") or [] for i in (s.get("issues") or []))[:900]
                                              for w, r in weak.items())
                state.update(round=rnd + 1, step="draw")
            _save(folder, state)
    passed = sum(1 for r in reviews.values() if r.get("verdict") == "pass")
    install(pid, k)
    state.update(status="candidate", reviews_passed=f"{passed} of {len(reviews)}")
    _save(folder, state)
    cp.log(RANA, "cast_ready", None, {"project": pid, "version": k, "passed": state["reviews_passed"]})
    return {"version": k, "passed": passed, "total": len(reviews), "rana_says": state.get("rana_says", ""),
            "weak": [quality.CAST_NAMES.get(w, w) for w, r in reviews.items() if r.get("verdict") != "pass"]}


def check(pid, k, animate, say=print):
    """hq cast-check <project> v<K> (the owner's "why can't Israa test?"): render the version's sheets + test clips from its
    Character.jsx as it is now and run Israa's side-by-side check of every character once more. No redraw. If the project uses
    this version, its characters library is refreshed (the owner approves again). Returns the summary dict; raises RuntimeError."""
    pid, k = int(pid), int(str(k).lstrip("vV"))
    folder = _folder(pid, k)
    state = _state(folder)
    if not (folder / "Character.jsx").exists():
        raise RuntimeError(f"Project {pid} has no cast v{k}.")
    if state.get("status") == "drawing":
        raise RuntimeError(f"Rana is still working on v{k}; it is checked when she finishes.")
    problem = validate((folder / "Character.jsx").read_text(encoding="utf-8"), KIT.read_text(encoding="utf-8"))
    if problem:
        raise RuntimeError(f"v{k}'s Character.jsx doesn't pass the safety check ({problem}); nothing rendered.")
    say(f"Rendering v{k}'s reference sheets and test clips (about 40 minutes)...")
    try:
        animate("cast-test", pid, folder)
    except RuntimeError as e:
        raise RuntimeError(f"v{k}'s test render failed: {str(e)[:600]}") from e
    state["rendered"] = _digest(folder)
    say(f"Israa is comparing each character of v{k} with its sheet and with the owner's picture...")
    refs = sorted(f for f in (folder / "refs").glob("*") if f.is_file()) if (folder / "refs").exists() else []
    reviews = quality.review_characters(pid, lib_dir=folder / "characters", refs=refs)
    passed = sum(1 for r in reviews.values() if r.get("verdict") == "pass")
    state.update(reviews=reviews, reviewed=state["rendered"], reviews_passed=f"{passed} of {len(reviews)}",
                 checked=time.strftime("%Y-%m-%d %H:%M"))
    uses = ((cp.get_project(pid, with_text=False) or {}).get("meta") or {}).get("cast") or {}
    if uses.get("version") == k:
        install(pid, k)
    _save(folder, state)
    cp.log("Israa", "cast_checked", None, {"project": pid, "version": k, "passed": state["reviews_passed"]})
    return {"version": k, "passed": passed, "total": len(reviews), "in_use": uses.get("version") == k, "status": state.get("status", ""),
            "weak": [f"{quality.CAST_NAMES.get(w, w)}: {r.get('summary', '')}"[:200] for w, r in reviews.items() if r.get("verdict") != "pass"]}


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
