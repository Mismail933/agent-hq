"""
Live team rules (2.24.0): behaviour settings Atlas changes with `hq rule set <key> <value>`, read fresh by every job, so no
Builder and no restart is needed. Every change is logged (`rule_changed`: who, why, old, new) and can be undone.

Money (caps, allowances, API spend), keys, hires, uploads and the safety scan are NOT rules: they stay the owner's
(`control_plane.LIMITS`, changed by Atlas only on the owner's explicit word).

To add a rule: one line in RULES, then read it with `rules.get("<key>")` where the behaviour lives.
"""
import json
import time

import control_plane as cp

# key: (kind, default, low or choices, high, label)
RULES = {
    "phone.send": ("choice", "decisions", ("decisions", "everything", "nothing"), None,
                   "What reaches the phone at once: decisions (things that need the owner + finished videos), everything, or nothing"),
    "phone.group_minutes": ("int", 15, 0, 240, "Things that need the owner are grouped: at most one phone alert per this many minutes"),
    "phone.quiet_from": ("int", 23, 0, 23, "Quiet hours start (hour, PC time): nothing is sent unless the owner wrote first"),
    "phone.quiet_to": ("int", 8, 0, 23, "Quiet hours end (hour, PC time)"),
    "phone.digest_hour": ("int", 9, -1, 23, "Hour of the daily phone digest of office news (-1 = no digest)"),
}


def _init():
    with cp._db() as con:
        con.execute("CREATE TABLE IF NOT EXISTS rules (key TEXT PRIMARY KEY, value TEXT, ts REAL, changed_by TEXT, why TEXT)")


def parse(key, value):
    if key not in RULES:
        raise ValueError(f"Unknown rule '{key}'. Known: {', '.join(RULES)}")
    kind, _, low, high, label = RULES[key]
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
    if kind in ("int", "float"):
        try:
            v = int(float(s)) if kind == "int" else float(s)
        except ValueError:
            raise ValueError(f"{key} must be a number.")
        if not low <= v <= high:
            raise ValueError(f"{key} must be between {low} and {high}.")
        return v
    if len(s) > 20000:
        raise ValueError(f"{key} is too long (20,000 characters at most).")
    return s


def get(key):
    """The rule's current value: the stored one, else the default. Read fresh every time (no restart needed)."""
    kind, default = RULES[key][0], RULES[key][1]
    try:
        _init()
        with cp._db() as con:
            r = con.execute("SELECT value FROM rules WHERE key=?", (key,)).fetchone()
        return parse(key, json.loads(r["value"])) if r else default
    except (ValueError, TypeError):
        return default


def set(key, value, by="Atlas", why=""):
    """Returns (old, new). Logged with who and why."""
    v = parse(key, value)
    old = get(key)
    _init()
    with cp._db() as con:
        con.execute("INSERT OR REPLACE INTO rules(key,value,ts,changed_by,why) VALUES(?,?,?,?,?)",
                    (key, json.dumps(v), time.time(), by, str(why)[:300]))
    cp.log(by, "rule_changed", None, {"key": key, "old": old, "new": v, "why": str(why)[:300]})
    return old, v


def reset(key, by="Atlas", why=""):
    if key not in RULES:
        raise ValueError(f"Unknown rule '{key}'.")
    old = get(key)
    _init()
    with cp._db() as con:
        con.execute("DELETE FROM rules WHERE key=?", (key,))
    cp.log(by, "rule_changed", None, {"key": key, "old": old, "new": RULES[key][1], "why": str(why or "back to the default")[:300]})
    return old, RULES[key][1]


def undo(key, by="Atlas"):
    """Put back the value before the last change."""
    if key not in RULES:
        raise ValueError(f"Unknown rule '{key}'.")
    with cp._db() as con:
        rows = con.execute("SELECT detail FROM events WHERE kind='rule_changed' ORDER BY id DESC LIMIT 400").fetchall()
    for r in rows:
        d = json.loads(r["detail"] or "{}")
        if d.get("key") == key:
            return set(key, d.get("old"), by, "undo")
    raise ValueError(f"{key} was never changed.")


def view():
    return [{"key": k, "value": get(k), "default": v[1], "label": v[4],
             "allowed": list(v[2]) if v[0] == "choice" else ([v[2], v[3]] if v[0] in ("int", "float") else v[0])}
            for k, v in RULES.items()]
