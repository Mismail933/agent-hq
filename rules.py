"""
Live team rules (2.24.0, the full list in 2.25.0): behaviour settings Atlas changes with `hq rule set <key> <value> "why"`, so no
Builder and no restart is needed. Every change is logged (`rule_changed`: who, why, old, new), kept in `rules_history` (versions)
and can be undone. The office shows them in Spend & limits -> Team rules.

How a rule takes effect:
- rules with a `target` (module, attribute[, dict key]) are written onto that setting: by the office at start, before every job
  and right after a change (`apply_all`), and by the tools that run as their own process (animate.py) when they start;
- the others are read where they act, with `rules.get(key)` (fresh every time).

Money (caps, allowances, API spend), keys, hires, uploads, the safety scan and the off-limits list are NOT rules: they stay the
owner's (`control_plane.LIMITS`, changed by Atlas only on the owner's explicit word).

STANDING RULE (the owner, 2026-10-08): whatever Atlas can't change himself that is a team rule, a setting, an unblock or an agent
instruction becomes a rule here, not a one-off fix. To add one: a line in RULES (+ `rules.get` where it acts, if it has no target).
"""
import json
import string
import sys
import time

import control_plane as cp

AGENTS = ("Doulya", "Sage", "Vera", "Serge", "Calina", "Scout", "Israa", "Rana")
# The agents' own instructions: the code's text, replaceable as a whole (`hq prompt <agent> set --file ...`)
PROMPT_TARGET = {"Doulya": ("agents", "DOULYA_SYSTEM"), "Sage": ("agents", "SAGE_SYSTEM"), "Vera": ("agents", "VERA_SYSTEM"),
                 "Serge": ("agents", "SERGE_SYSTEM"), "Calina": ("agents", "CALINA_SYSTEM_V3"), "Scout": ("quality", "SCOUT_SYSTEM"),
                 "Israa": ("quality", "ISRAA_BASE"), "Rana": ("animator", "SYSTEM")}
NOT_FORMATTED = {"Rana"}   # used as is (its braces are code examples, not placeholders)


def _r(group, kind, default, low, high, label, target=None, scale=1):
    return {"group": group, "kind": kind, "default": default, "low": low, "high": high, "label": label, "target": target, "scale": scale}


RULES = {
    # VIDEO & RENDER
    "video.short_max_seconds": _r("Video & render", "float", 178.0, 30, 600, "A finished video up to this long is labelled a Short (#shorts); longer = a regular video. A label only, never a refusal", ("animate", "SHORT_LIMIT")),
    "video.hard_cap_minutes": _r("Video & render", "float", 16.0, 1, 60, "Only a video longer than this is refused", ("animate", "VIDEO_CAP"), 60),
    "script.min_words": _r("Video & render", "int", 50, 10, 500, "A script shorter than this (narration words) is sent back", ("quality", "MIN_WORDS")),
    "script.max_words": _r("Video & render", "int", 1800, 100, 9000, "A script longer than this is sent back (about 130 words a minute)", ("quality", "MAX_WORDS")),
    "script.min_scenes": _r("Video & render", "int", 7, 1, 60, "Fewest scenes in an animated script", ("quality", "MIN_SCENES")),
    "script.max_scenes": _r("Video & render", "int", 20, 3, 120, "Most scenes in an animated script", ("quality", "MAX_SCENES")),
    "script.max_line_words": _r("Video & render", "int", 34, 8, 200, "Longest single spoken line (longer lines of whole sentences are split)", ("quality", "MAX_LINE_WORDS")),
    "script.max_scene_words": _r("Video & render", "int", 60, 10, 400, "Most words in one dialogue scene before it is split", ("quality", "MAX_SCENE_WORDS")),
    "script.auto_split": _r("Video & render", "bool", True, None, None, "Split over-long lines into scenes by themselves (off = send them back to Calina)"),
    "render.browser_timeout_s": _r("Video & render", "int", 120, 30, 900, "Seconds the cartoon's headless browser may take to start", ("animate", "BROWSER_TIMEOUT_MS"), 1000),
    "voice.words_per_minute": _r("Video & render", "int", 130, 90, 200, "Narration pace the voice is fitted to", ("animate", "TARGET_WPM")),
    "voice.eleven_start_speed": _r("Video & render", "float", 0.88, 0.7, 1.2, "ElevenLabs reading speed (1.0 = its normal pace)", ("animate", "ELEVEN_START_SPEED")),
    "voice.eleven_model": _r("Video & render", "choice", "eleven_v3", ("eleven_v3", "eleven_multilingual_v2"), None, "ElevenLabs model (v3 acts the lines)", ("settings", "ELEVEN_MODEL")),
    "voice.eleven_v3_stability": _r("Video & render", "choice", "0.5", ("0.0", "0.5", "1.0"), None, "ElevenLabs v3 stability: 0.0 creative, 0.5 natural, 1.0 robust", ("settings", "ELEVEN_V3_STABILITY")),
    # PACING & SOUND
    "pace.still_max_s": _r("Pacing & sound", "float", 4.0, 1, 20, "Longest stretch with nothing changing on screen before Israa flags it", ("quality", "STILL_MAX")),
    "pace.reframe_every_s": _r("Pacing & sound", "float", 2.8, 1, 15, "A stretch with nothing planned gets a camera beat this often (seconds)", ("animate", "REFRAME_EVERY")),
    "pace.freeze_frames": _r("Pacing & sound", "int", 48, 10, 240, "How long a freeze-frame label holds (frames, 30 a second)", ("animate", "FREEZE_FRAMES")),
    "pace.action_hold_frames": _r("Pacing & sound", "int", 30, 5, 180, "How long a pose-action (facepalm, shrug) is held (frames)", ("animate", "ACTION_HOLD")),
    "sound.music_volume": _r("Pacing & sound", "float", 0.16, 0, 1, "Music volume under the voices (0-1; it also ducks while anyone speaks)", ("animate", "MUSIC_VOLUME")),
    # REVIEW & QUALITY
    "review.rounds": _r("Review & quality", "int", 2, 0, 6, "Times Israa may send a script back to Calina", ("quality", "REVIEW_ROUNDS")),
    "check.spine": _r("Review & quality", "bool", True, None, None, "The story-spine check blocks a script (off = advice only)"),
    "check.ear": _r("Review & quality", "bool", True, None, None, "The ear check (hard-to-say lines) blocks a script (off = advice only)"),
    "check.length": _r("Review & quality", "bool", True, None, None, "The word/scene limits block a script (off = advice only)"),
    "check.stranger_script": _r("Review & quality", "bool", True, None, None, "The stranger test on scripts (off = not run)"),
    "check.stranger_video": _r("Review & quality", "bool", True, None, None, "The stranger test on finished videos (off = not run)"),
    "review.video": _r("Review & quality", "bool", True, None, None, "Israa reviews every finished video before the owner sees it"),
    "review.voice_versions": _r("Review & quality", "bool", True, None, None, "Israa reviews voice versions before the owner compares them"),
    # TEAM & SCHEDULES
    "team.doulya_daily": _r("Team & schedules", "bool", True, None, None, "Doulya scouts once a day by herself", ("settings", "SCOUT_AUTOMATICALLY")),
    "team.doulya_picks": _r("Team & schedules", "int", 2, 1, 6, "Ideas Doulya puts in the inbox each round", ("settings", "DOULYA_PICKS")),
    "team.doulya_searches": _r("Team & schedules", "int", 6, 1, 20, "Web searches per scouting round", ("settings", "DOULYA_MAX_SEARCHES")),
    "team.ghassan_on": _r("Team & schedules", "bool", True, None, None, "Ghassan builds Atlas's requests by himself", ("settings", "GHASSAN_ON")),
    "team.ghassan_every_minutes": _r("Team & schedules", "int", 10, 2, 240, "How often Ghassan looks for a new request", ("settings", "GHASSAN_EVERY_MINUTES")),
    # PHONE
    "phone.send": _r("Phone", "choice", "decisions", ("decisions", "everything", "nothing"), None,
                     "What reaches the phone at once: decisions (things that need the owner + finished videos), everything, or nothing"),
    "phone.group_minutes": _r("Phone", "int", 15, 0, 240, "Things that need the owner are grouped: at most one phone alert per this many minutes"),
    "phone.quiet_from": _r("Phone", "int", 23, 0, 23, "Quiet hours start (hour, PC time): nothing is sent unless the owner wrote first"),
    "phone.quiet_to": _r("Phone", "int", 8, 0, 23, "Quiet hours end (hour, PC time)"),
    "phone.digest_hour": _r("Phone", "int", 9, -1, 23, "Hour of the daily phone digest of office news (-1 = no digest)"),
}
for _a in AGENTS:   # agent instructions: a standing note added to every run, and the whole text replaceable
    RULES[f"prompt.{_a}.extra"] = _r("Agent instructions", "text", "", None, None,
                                     f"Standing instructions added to every {_a} run (style notes, banned words, tone, what to do differently)")
    RULES[f"prompt.{_a}"] = _r("Agent instructions", "text", "", None, None,
                               f"{_a}'s whole instructions, replacing the code's (empty = the code's own). Keep its {{placeholders}}",
                               PROMPT_TARGET[_a])

ORIGINAL = {}   # (module, attr) -> the code's own value, captured the first time a rule is applied in this process


def _init():
    with cp._db() as con:
        con.execute("CREATE TABLE IF NOT EXISTS rules (key TEXT PRIMARY KEY, value TEXT, ts REAL, changed_by TEXT, why TEXT)")
        con.execute("CREATE TABLE IF NOT EXISTS rules_history (id INTEGER PRIMARY KEY, key TEXT, value TEXT, ts REAL, changed_by TEXT, why TEXT)")


def parse(key, value):
    if key not in RULES:
        near = [k for k in RULES if key.split(".")[0] in k][:12]
        raise ValueError(f"Unknown rule '{key}'." + (f" Did you mean: {', '.join(near)}" if near else " See `hq rule list`."))
    r = RULES[key]
    kind, low, high = r["kind"], r["low"], r["high"]
    if kind == "text":
        s = "" if value is None else str(value)
        if len(s) > 60000:
            raise ValueError(f"{key} is too long (60,000 characters at most).")
        if r["target"] and s.strip():
            _placeholders_ok(key, s)
        return s
    s = str(value).strip()
    if kind == "choice":
        if s.lower() not in low:
            raise ValueError(f"{key} must be one of: {', '.join(low)}.")
        return s.lower()
    if kind == "bool":
        if s.lower() in ("on", "yes", "true", "1"):
            return True
        if s.lower() in ("off", "no", "false", "0"):
            return False
        raise ValueError(f"{key} must be on or off.")
    try:
        v = int(float(s)) if kind == "int" else float(s)
    except ValueError:
        raise ValueError(f"{key} must be a number.")
    if not low <= v <= high:
        raise ValueError(f"{key} must be between {low} and {high}.")
    return v


def _fields(text):
    return {f for _, f, _, _ in string.Formatter().parse(text) if f}


def code_text(agent):
    """The agent's instructions as written in the program (read from the file, so nothing has to be imported)."""
    import ast
    from pathlib import Path
    mod, attr = PROMPT_TARGET[agent]
    tree = ast.parse((Path(__file__).parent / f"{mod}.py").read_text(encoding="utf-8"))
    names = {t.id: n.value for n in tree.body if isinstance(n, ast.Assign) for t in n.targets if isinstance(t, ast.Name)}

    def val(node, depth=0):   # string literals, + and other module-level names (e.g. SYSTEM = """...""" + API)
        if depth > 10:
            raise ValueError("too deep")
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            return node.value
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
            return val(node.left, depth + 1) + val(node.right, depth + 1)
        if isinstance(node, ast.Name) and node.id in names:
            return val(names[node.id], depth + 1)
        raise ValueError("not plain text")
    try:
        return val(names[attr])
    except (KeyError, ValueError):
        return ORIGINAL.get((mod, attr)) or getattr(sys.modules.get(mod), attr, "") or ""


def _placeholders_ok(key, text):
    """A replaced prompt must keep the code's {placeholders} and add none (else the agent's run would break)."""
    if key.split(".")[1] in NOT_FORMATTED:
        return
    orig = code_text(key.split(".")[1])
    try:
        new = _fields(text)
    except ValueError as e:
        raise ValueError(f"{key}: the text has a stray brace ({e}). Write literal braces as {{{{ and }}}}.")
    if orig is not None:
        old = _fields(orig)
        if new - old or old - new:
            raise ValueError(f"{key} must keep exactly these placeholders: {', '.join('{' + f + '}' for f in sorted(old))}"
                             + (f" (missing: {', '.join(sorted(old - new))})" if old - new else "")
                             + (f" (unknown: {', '.join(sorted(new - old))})" if new - old else ""))


def _stored():
    _init()
    with cp._db() as con:
        return {r["key"]: json.loads(r["value"]) for r in con.execute("SELECT key, value FROM rules")}


def get(key):
    """The rule's current value: the stored one, else the default. Read fresh every time (no restart needed)."""
    try:
        s = _stored()
        return parse(key, s[key]) if key in s else RULES[key]["default"]
    except (ValueError, TypeError, KeyError):
        return RULES[key]["default"]


def _write(key, v, by, why):
    _init()
    with cp._db() as con:
        if v == RULES[key]["default"]:
            con.execute("DELETE FROM rules WHERE key=?", (key,))
        else:
            con.execute("INSERT OR REPLACE INTO rules(key,value,ts,changed_by,why) VALUES(?,?,?,?,?)",
                        (key, json.dumps(v), time.time(), by, str(why)[:300]))
        con.execute("INSERT INTO rules_history(key,value,ts,changed_by,why) VALUES(?,?,?,?,?)",
                    (key, json.dumps(v), time.time(), by, str(why)[:300]))


def _short(v):
    s = json.dumps(v) if not isinstance(v, str) else v
    return s if len(s) <= 300 else s[:300] + f"... ({len(s):,} characters)"


def set(key, value, by="Atlas", why=""):   # noqa: A001 (rules.set reads well at the call sites)
    """Returns (old, new). Logged with who and why; applied at once in this process."""
    v = parse(key, value)
    old = get(key)
    _write(key, v, by, why)
    cp.log(by, "rule_changed", None, {"key": key, "old": _short(old), "new": _short(v), "why": str(why)[:300]})
    apply_all()
    return old, v


def reset(key, by="Atlas", why=""):
    if key not in RULES:
        raise ValueError(f"Unknown rule '{key}'.")
    return set(key, RULES[key]["default"], by, why or "back to the default")


def undo(key, by="Atlas"):
    """Put back the value before the last change (from rules_history; full texts too)."""
    if key not in RULES:
        raise ValueError(f"Unknown rule '{key}'.")
    _init()
    with cp._db() as con:
        rows = con.execute("SELECT value FROM rules_history WHERE key=? ORDER BY id DESC LIMIT 2", (key,)).fetchall()
    if not rows:
        raise ValueError(f"{key} was never changed.")
    before = json.loads(rows[1]["value"]) if len(rows) > 1 else RULES[key]["default"]
    return set(key, before, by, "undo")


def history(key, n=10):
    _init()
    with cp._db() as con:
        rows = con.execute("SELECT * FROM rules_history WHERE key=? ORDER BY id DESC LIMIT ?", (key, n)).fetchall()
    return [{"when": time.strftime("%Y-%m-%d %H:%M", time.localtime(r["ts"])), "by": r["changed_by"], "why": r["why"],
             "value": _short(json.loads(r["value"]))} for r in rows]


def apply_all():
    """Write every targeted rule onto its setting in the modules this process has loaded. Cheap; safe to call often."""
    try:
        stored = _stored()
    except Exception:
        return
    for key, r in RULES.items():
        t = r["target"]
        if not t or t[0] not in sys.modules:
            continue
        mod = sys.modules[t[0]]
        if (t[0], t[1]) not in ORIGINAL:
            ORIGINAL[(t[0], t[1])] = getattr(mod, t[1], None)
        try:
            v = parse(key, stored[key]) if key in stored else None
        except ValueError:
            v = None
        if r["kind"] == "text":   # a prompt: empty = the code's own text
            val = v if v and v.strip() else ORIGINAL[(t[0], t[1])]
        elif v is None:
            val = ORIGINAL[(t[0], t[1])] if ORIGINAL[(t[0], t[1])] is not None else r["default"] * r["scale"] if r["kind"] in ("int", "float") else r["default"]
        else:
            val = v * r["scale"] if r["kind"] in ("int", "float") else (float(v) if key == "voice.eleven_v3_stability" else v)
        if val is not None:
            setattr(mod, t[1], val)


def extra(agent):
    """The standing instructions Atlas added for this agent ('' if none), as a block to put after its system prompt."""
    key = f"prompt.{agent}.extra"
    if key not in RULES:
        return ""
    t = (get(key) or "").strip()
    return ("\n\nSTANDING INSTRUCTIONS FROM THE OWNER AND ATLAS (they override anything above that contradicts them):\n" + t) if t else ""


def view():
    s = _stored()
    with cp._db() as con:
        meta = {r["key"]: (r["changed_by"], r["why"], r["ts"]) for r in con.execute("SELECT key, changed_by, why, ts FROM rules")}
    out = []
    for k, r in RULES.items():
        v = get(k)
        out.append({"key": k, "group": r["group"], "value": _short(v) if r["kind"] == "text" else v,
                    "default": r["default"] if r["kind"] != "text" else "(the code's own)" if r["target"] else "",
                    "changed": k in s, "label": r["label"],
                    "allowed": list(r["low"]) if r["kind"] == "choice" else [r["low"], r["high"]] if r["kind"] in ("int", "float")
                    else "on/off" if r["kind"] == "bool" else "text",
                    "by": meta.get(k, ("", "", 0))[0], "why": meta.get(k, ("", "", 0))[1],
                    "when": time.strftime("%Y-%m-%d %H:%M", time.localtime(meta[k][2])) if k in meta else ""})
    return out
