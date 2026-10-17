"""
Automatic video checks (2.49.0, Atlas's "Stop trial and error", the owner: "trial and error is too costly at this point").

Plain code, no AI, no cost. They run on every animated render (`animate.render_episode`) and on the quick test render
(`animate.py render <id> --test`, `hq render <id> --test`), BEFORE a video is called ready. A fault stops the render and names the
time and the fault; the report is saved beside the video as checks.json (checks-test.json for a test) and on the episode
(`data.video_checks`). `hq check <episode>` runs them again on the last video. Israa only sees videos that passed.

What is checked (rules in group "Review & quality": check.video block|warn|off, check.still_max_seconds,
check.min_drawn_percent, check.opening_character):
- the script's data, before anything is drawn: every line's speaker is in his scene; the first frame shows a character; no card is
  a lone title; a rod is planted by the one the story says; no number label shows twice at once in a diagram;
- the sound: every caption is over voice (no silent captions), every scene with words has voice, the sound lasts to the end card;
- the captions: the words and numbers are exactly the script's (no "7 .2", no extra or missing words);
- the picture, a frame a second: no blank or near-blank frame (a lone title is blank), no still stretch over N seconds.
REGRESSION: the faults found on ep 28 (blank Syene card, silent ending, broken numbers, empty opening, the wrong person planting the
stick, the 7.2 degree label twice) each have a check here, named in its fault text, so they can't come back unseen.
Not measured here: whether a speaker is cut by the frame's edge. That is enforced by the camera code (Camera.cameraFrame keeps the
speaker's box inside rule video.frame_margin_px); this checks that he is in the scene at all. Where labels sit on the diagram is
Diagram.jsx's (2.36.3); this checks only that the callout can hide when the close-up comes up.
"""
import difflib
import hashlib
import json
import re
import subprocess
import tempfile
import time
from pathlib import Path

import rules

FPS = 30
CAST_FREE = ("map", "diagram", "card")   # backdrops with no people on purpose
STILL_DIFF = 1.0   # mean pixel change (0-255, at 270x480) under which two frames a second apart count as the same picture


def _t(frame):
    return round(frame / FPS, 1)


def _mmss(t):
    return f"{int(t // 60)}:{t % 60:04.1f}"


def _tok(w):
    """A word as compared: lower case, no punctuation, but a decimal point or thousands comma inside a number is kept."""
    w = re.sub(r"\[[^\]]*\]", "", str(w)).lower()
    w = re.sub(r"(?<=\d)[.,](?=\d)", "#", w)
    return re.sub(r"[^a-z0-9#]", "", w).replace("#", ".")


def scenes_hash(d):
    """Fingerprint of a script's scenes: a passed test render counts only for the scenes it was made from."""
    return hashlib.sha256(json.dumps(d.get("scenes") or [], sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]


# ---- 1. the script's data -------------------------------------------------------------------
def data_faults(props, d, items, cast, script_by=None):
    """props: the render's scene-props; d: the staged script (animate.stage_speakers); items: animate.utterances; cast: the
    characters that can be on screen; script_by: {scene index: the rod's `by` the script/staging chose}."""
    out = []
    scenes = props.get("scenes") or []
    if rules.get("check.opening_character") and scenes:
        s0 = scenes[0]
        title = props.get("title") or {}
        if title and title.get("from", 1) <= 0:
            out.append((0.0, "the video opens on the title card, not on a character (ep 28's empty opening)"))
        elif not s0.get("generated") and not s0.get("characters") and not s0.get("crowd"):
            out.append((0.0, "the first frame shows no character (ep 28's empty opening)"))
    for i, sc in enumerate(scenes):
        src = (d.get("scenes") or [])[i] if i < len(d.get("scenes") or []) else {}
        t0 = _t(sc.get("from", 0))
        back = sc.get("backdrop")
        here = {c.get("who") for c in sc.get("characters") or []}
        if back not in CAST_FREE and not sc.get("generated"):
            for l in src.get("lines") or []:
                if l.get("who") in cast and l.get("who") not in here:
                    out.append((t0, f"scene {i + 1}: {l.get('who')} speaks but is not on screen"))
                    break
        if back == "card":
            card = sc.get("card") or {}
            if not any(str((x or {}).get("text") or "").strip() for x in card.get("lines") or []):
                out.append((t0, f"scene {i + 1}: a card with nothing written on it" + (f" but its title \"{card.get('title')}\"" if card.get("title") else "")
                            + " (a lone title is a blank picture; ep 28's Syene card)"))
        for p in sc.get("props") or []:
            if (p or {}).get("type") == "rod" and p.get("plant_at") is not None:
                want = (script_by or {}).get(i)
                if p.get("by") not in here:
                    out.append((t0, f"scene {i + 1}: the stick is planted by {p.get('by')}, who isn't in the scene (ep 28's wrong planter)"))
                elif want and want in here and p.get("by") != want:
                    out.append((t0, f"scene {i + 1}: the stick is planted by {p.get('by')}, the story says {want} (ep 28's wrong planter)"))
        if back == "diagram" and sc.get("callout") and not ((sc.get("diagram") or {}).get("at") or {}):
            # the callout hides when the close-up panel comes up (Short.jsx, from the diagram's step frames); without them the
            # callout and the diagram's own angle label both sit on the picture
            label = re.findall(r"\d+(?:\.\d+)?", str((sc.get("diagram") or {}).get("angle_label") or ""))
            if label and label[0] in re.findall(r"\d+(?:\.\d+)?", sc["callout"]):
                out.append((t0, f"scene {i + 1}: the {label[0]} label would show twice (callout and diagram, no step timings; ep 28's overlapping labels)"))
    return out


# ---- 2. the sound and the captions -----------------------------------------------------------
def speech(ffmpeg, wav):
    """[(start, end)] seconds where the voice track has sound, and its length."""
    p = subprocess.run([ffmpeg, "-hide_banner", "-i", str(wav), "-af", "silencedetect=noise=-40dB:d=0.3", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace", creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", p.stderr)
    secs = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)) if m else 0.0
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", p.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", p.stderr)]
    out, t = [], 0.0
    for k, a in enumerate(starts):
        if a > t + 0.02:
            out.append((t, a))
        t = ends[k] if k < len(ends) else secs
    if secs > t + 0.02:
        out.append((t, secs))
    return out, secs


def _voiced(spans, a, b):
    return sum(max(0.0, min(b, y) - max(a, x)) for x, y in spans)


def sound_faults(props, items, ffmpeg, voice, audio):
    out = []
    spans, vsecs = speech(ffmpeg, voice)
    for c in props.get("caption_chunks") or []:
        a, b = c["from"] / FPS, c["to"] / FPS
        if _voiced(spans, a - 0.1, b + 0.1) < 0.05:
            out.append((_t(c["from"]), "caption \"" + " ".join(w["w"] for w in c["words"]) + "\" over silence (no voice under it)"))
    scenes = props.get("scenes") or []
    said = {it["scene"] for it in items if str(it.get("text") or "").strip()}
    for i, sc in enumerate(scenes):
        if i in said:
            a = sc["from"] / FPS
            if _voiced(spans, a, a + sc["frames"] / FPS) < 0.3:
                out.append((_t(sc["from"]), f"scene {i + 1} has lines but no voice" + (" (ep 28's silent ending)" if i == len(scenes) - 1 else "")))
    need = props.get("outro_from", 0) / FPS
    asecs = speech(ffmpeg, audio)[1] if Path(audio) != Path(voice) else need   # (a voice-only track ends with the last word)
    if asecs + 0.3 < need:
        out.append((round(asecs, 1), f"the sound stops at {_mmss(asecs)} but the story runs to {_mmss(need)} (ep 28's silent ending)"))
    return out


def caption_faults(props, items):
    """The captions are the script's words and numbers, exactly, in order."""
    out = []
    shown = [(w["w"], w["from"]) for c in props.get("caption_chunks") or [] for w in c["words"]]
    for k, (w, f) in enumerate(shown):
        nxt = shown[k + 1][0] if k + 1 < len(shown) else ""
        if re.match(r"^[.,]\d", str(w)) or (re.search(r"\d$", str(w)) and re.match(r"^[.,]\d", str(nxt))):
            out.append((_t(f), f"a number is broken in the captions: \"{w} {nxt}\" (ep 28's \"7 .2\")"))
    script = [_tok(w) for it in items for w in str(it.get("text") or "").split()]
    script = [w for w in script if w]
    cap = [(_tok(w), f) for w, f in shown]
    cap = [x for x in cap if x[0]]
    a, b = script, [x[0] for x in cap]
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op == "equal" or "".join(a[i1:i2]) == "".join(b[j1:j2]):   # "two-thirds" split differently is the same words
            continue
        f = cap[j1][1] if j1 < len(cap) else (cap[-1][1] if cap else 0)
        if op == "insert":
            out.append((_t(f), "captions show words that aren't in the script: \"" + " ".join(b[j1:j2])[:80] + "\""))
        elif op == "delete":
            out.append((_t(f), "script words missing from the captions: \"" + " ".join(a[i1:i2])[:80] + "\""))
        else:
            out.append((_t(f), "captions say \"" + " ".join(b[j1:j2])[:60] + "\" where the script says \"" + " ".join(a[i1:i2])[:60] + "\""))
    return out


# ---- 3. the picture --------------------------------------------------------------------------
def frame_faults(props, ffmpeg, video, work=None):
    """A frame a second of the finished video (or the test render): blank frames and still stretches. Returns (faults, measured)."""
    try:
        from PIL import Image, ImageChops, ImageStat
        import animator
    except ImportError:
        return [], {"frames": "not measured (Pillow isn't installed here)"}
    out = []
    skip = []   # the title card and the end card are meant to be simple
    if props.get("title"):
        skip.append((props["title"]["from"] / FPS - 0.5, (props["title"]["from"] + props["title"]["frames"]) / FPS + 0.5))
    skip.append((props.get("outro_from", 10 ** 9) / FPS - 0.5, 10 ** 9))
    low, still_max = int(rules.get("check.min_drawn_percent")), float(rules.get("check.still_max_seconds"))
    with tempfile.TemporaryDirectory(dir=work) as tmp:
        subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(video), "-vf", "fps=1,scale=" + ("480:270" if props.get("shape") == "wide" else "270:480"), str(Path(tmp) / "f-%05d.png")],
                       capture_output=True, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        frames = sorted(Path(tmp).glob("f-*.png"))
        prev, run_from, longest, lows = None, None, (0, 0), []
        for k, png in enumerate(frames):
            t = float(k)
            ok_skip = any(a <= t <= b for a, b in skip)
            share = animator.drawn_share(png)
            im = Image.open(png).convert("L")
            if not ok_skip and share is not None and share < low:
                lows.append(t)
            if prev is not None and not ok_skip and ImageStat.Stat(ImageChops.difference(im, prev)).mean[0] < STILL_DIFF:
                run_from = t - 1 if run_from is None else run_from
                if t - run_from > longest[0]:
                    longest = (t - run_from, run_from)
            else:
                run_from = None
            prev = im
    # blank frames: one fault per stretch
    for k, t in enumerate(lows):
        if k == 0 or t - lows[k - 1] > 1.5:
            end = t
            while end + 1 in lows:
                end += 1
            out.append((t, f"blank or near-blank picture from {_mmss(t)} to {_mmss(end + 1)} (under {low}% drawn; ep 28's blank card)"))
    if longest[0] > still_max:
        out.append((longest[1], f"nothing changes on screen for {longest[0]:.0f} s (the bar is {still_max:.0f} s)"))
    return out, {"frames": len(frames), "blank_seconds": len(lows), "longest_still_s": longest[0], "longest_still_at": _mmss(longest[1])}


# ---- the whole check -------------------------------------------------------------------------
def report(faults, measured, test, d=None):
    """d: unused (kept so callers read alike); the scenes' fingerprint is taken from the stored episode when it is saved."""
    faults = sorted(faults, key=lambda x: x[0])
    return {"ok": not faults, "test": bool(test), "faults": [{"t": t, "at": _mmss(t), "what": w} for t, w in faults],
            "measured": measured, "mode": rules.get("check.video"), "ts": time.time()}


def test_passed(ep, version):
    """True if this episode's latest test render passed, on this program version and on the scenes as they are now."""
    t = (ep.get("data") or {}).get("test_render") or {}
    return bool(t.get("ok") or t.get("mode") == "warn") and t.get("version") == version and t.get("scenes_hash") == scenes_hash(ep.get("data") or {})


def summary(rep, n=6):
    """One line: 'passed' or the first faults with their times."""
    if rep["ok"]:
        return "passed every check"
    more = len(rep["faults"]) - n
    return "; ".join(f"{f['at']} {f['what']}" for f in rep["faults"][:n]) + (f"; and {more} more" if more > 0 else "")
