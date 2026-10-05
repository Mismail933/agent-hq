"""
Control plane: plain code, no AI.

Every agent action goes through here. It keeps the agent registry, the audit log,
cost tracking, budget caps, tool permissions and the kill switch. An agent cannot
talk its way past any of these checks because they are ordinary if-statements.
"""
import json
import sqlite3
import time
from datetime import date
from pathlib import Path

import settings

ROOT = Path(__file__).parent
DB_PATH = ROOT / "hq.db"
STOP_FILE = ROOT / "STOP"   # create this file to stop every agent immediately


class Halt(Exception):
    """Raised when a rule blocks an action. The message says which rule."""


def _db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init():
    with _db() as con:
        con.executescript("""
        CREATE TABLE IF NOT EXISTS agents (
            name TEXT PRIMARY KEY, dept TEXT, role TEXT, model TEXT,
            tools TEXT, status TEXT DEFAULT 'active');
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY, ts REAL, agent TEXT, kind TEXT,
            idea_id INTEGER, detail TEXT);
        CREATE TABLE IF NOT EXISTS costs (
            id INTEGER PRIMARY KEY, ts REAL, day TEXT, agent TEXT, model TEXT,
            idea_id INTEGER, input_tokens INTEGER, output_tokens INTEGER,
            searches INTEGER, usd REAL);
        CREATE TABLE IF NOT EXISTS ideas (
            id INTEGER PRIMARY KEY, ts REAL, title TEXT, source TEXT,
            status TEXT, brief_path TEXT, verdict TEXT);
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY, idea_id INTEGER, ts REAL, status TEXT, revision INTEGER DEFAULT 0,
            plan TEXT, plan_path TEXT, one_off_usd REAL, monthly_usd REAL, owner_note TEXT, decided_ts REAL);
        CREATE TABLE IF NOT EXISTS usage (
            id INTEGER PRIMARY KEY, ts REAL, day TEXT, agent TEXT, engine TEXT, model TEXT, idea_id INTEGER,
            input_tokens INTEGER, output_tokens INTEGER, cache_tokens INTEGER, searches INTEGER, turns INTEGER,
            secs REAL, value_usd REAL, ok INTEGER);
        CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, value TEXT, ts REAL, changed_by TEXT);
        CREATE TABLE IF NOT EXISTS lnd_ideas (
            id TEXT PRIMARY KEY, day TEXT, ts REAL, status TEXT, data TEXT, note TEXT, reason TEXT, decided_ts REAL);
        CREATE TABLE IF NOT EXISTS episodes (
            id INTEGER PRIMARY KEY, project_id INTEGER, batch INTEGER, ts REAL, status TEXT, title TEXT,
            data TEXT, owner_note TEXT, video_path TEXT);
        CREATE TABLE IF NOT EXISTS refboards (
            id INTEGER PRIMARY KEY, project_id INTEGER, ts REAL, status TEXT, data TEXT, choices TEXT, note TEXT,
            decided_ts REAL);
        """)
        cols = {r[1] for r in con.execute("PRAGMA table_info(ideas)")}
        if "pitch" not in cols:   # added in 2.2: Doulya's pitch for inbox ideas
            con.execute("ALTER TABLE ideas ADD COLUMN pitch TEXT")
        if "meta" not in {r[1] for r in con.execute("PRAGMA table_info(projects)")}:   # 2.9.1: facts like the channel name
            con.execute("ALTER TABLE projects ADD COLUMN meta TEXT")
    apply_limits()


# ---- Limits the owner changes in the office (or Atlas, when the owner asks) -------
# Stored in hq.db and applied on top of settings.py / settings_local.py, so they take effect at once and
# survive updates. Each one is validated against a sane range so a typo can't open the floodgates.
WORKERS = ("Doulya", "Sage", "Vera", "Serge", "Calina", "Scout", "Israa")
LIMITS = {
    "daily_api": ("usd", 0, 100, "Daily API cap, whole company"),
    "per_idea": ("usd", 0, 20, "API cap per idea (research + judgment)"),
    "project_one_off": ("usd", 0, 10000, "Budget per project, one-off"),
    "project_monthly": ("usd", 0, 5000, "Budget per project, monthly"),
}
for _a in WORKERS:
    LIMITS[f"engine.{_a}"] = ("choice", ("claude_code", "api"), None, f"{_a} runs on")
    LIMITS[f"model.{_a}"] = ("choice", ("sonnet", "opus", "haiku"), None, f"{_a}'s model on the subscription")
    LIMITS[f"allowance.{_a}"] = ("usd", 0, 100, f"{_a}'s daily plan allowance (API value)")
    LIMITS[f"api_cap.{_a}"] = ("usd_or_none", 0, 50, f"{_a}'s daily API cap")


def _target(key):
    name, _, agent = key.partition(".")
    return {"daily_api": (settings, "DAILY_AI_BUDGET_USD"), "per_idea": (settings, "PER_IDEA_BUDGET_USD"),
            "project_one_off": (settings.OWNER, "max_new_spend_per_project_usd"),
            "project_monthly": (settings.OWNER, "max_monthly_spend_per_project_usd"),
            "engine": (settings.WORKER_ENGINE, agent), "model": (settings.WORKER_MODELS, agent),
            "allowance": (settings.SUBSCRIPTION_DAILY_VALUE_USD, agent),
            "api_cap": (settings.AGENT_DAILY_BUDGET_USD, agent)}[name]


def get_limit(key):
    obj, field = _target(key)
    return obj.get(field) if isinstance(obj, dict) else getattr(obj, field)


def _put(key, value):
    obj, field = _target(key)
    if isinstance(obj, dict):
        if value is None:
            obj.pop(field, None)
        else:
            obj[field] = value
    else:
        setattr(obj, field, value)


def parse_limit(key, value):
    if key not in LIMITS:
        raise ValueError(f"Unknown limit '{key}'. Known: {', '.join(LIMITS)}")
    kind, low, high, label = LIMITS[key]
    if kind == "choice":
        v = str(value).strip().lower().replace("subscription", "claude_code")
        if v not in low:
            raise ValueError(f"{label} must be one of: {', '.join(low)}.")
        return v
    if kind == "usd_or_none" and str(value).strip().lower() in ("", "none", "no cap", "off"):
        return None
    try:
        v = round(float(str(value).strip().lstrip("$")), 2)
    except ValueError:
        raise ValueError(f"{label} must be a dollar amount.")
    if not low <= v <= high:
        raise ValueError(f"{label} must be between ${low} and ${high}.")
    return v


def set_limit(key, value, by="Owner"):
    v = parse_limit(key, value)
    old = get_limit(key)
    if v == old:
        return old, v
    with _db() as con:
        con.execute("INSERT OR REPLACE INTO limits(key,value,ts,changed_by) VALUES(?,?,?,?)",
                    (key, json.dumps(v), time.time(), by))
    _put(key, v)
    log(by, "limit_changed", None, {"key": key, "label": LIMITS[key][3], "old": old, "new": v})
    return old, v


def apply_limits():
    with _db() as con:
        rows = con.execute("SELECT key, value FROM limits").fetchall()
    for r in rows:
        try:
            _put(r["key"], parse_limit(r["key"], json.loads(r["value"]) if r["value"] != "null" else "none"))
        except (ValueError, KeyError):
            pass   # a limit that no longer exists or no longer fits its range


def limits_view():
    return {k: {"label": v[3], "kind": v[0], "value": get_limit(k),
                "options": list(v[1]) if v[0] == "choice" else None,
                "min": None if v[0] == "choice" else v[1], "max": v[2]} for k, v in LIMITS.items()}


# ---- Registry & permissions -------------------------------------------------
def register(name, dept, role, model, tools):
    with _db() as con:
        con.execute(
            "INSERT INTO agents(name,dept,role,model,tools) VALUES(?,?,?,?,?) "
            "ON CONFLICT(name) DO UPDATE SET dept=excluded.dept, role=excluded.role, "
            "model=excluded.model, tools=excluded.tools",
            (name, dept, role, model, json.dumps(tools)))


def check_tool(agent, tool):
    """Default deny: an agent may only use tools listed for it in the registry."""
    with _db() as con:
        row = con.execute("SELECT tools, status FROM agents WHERE name=?", (agent,)).fetchone()
    if row is None:
        raise Halt(f"{agent} is not a registered agent.")
    if row["status"] != "active":
        raise Halt(f"{agent} is {row['status']}.")
    if tool not in json.loads(row["tools"]):
        log(agent, "permission_denied", detail={"tool": tool})
        raise Halt(f"{agent} is not allowed to use {tool}.")


# ---- Kill switch & budgets --------------------------------------------------
def check_can_run(agent, idea_id=None):
    if STOP_FILE.exists():
        raise Halt("Kill switch is on (STOP file exists). Delete it to resume.")
    today = spend_today()
    if today >= settings.DAILY_AI_BUDGET_USD:
        raise Halt(f"Daily AI budget reached: ${today:.2f} of ${settings.DAILY_AI_BUDGET_USD:.2f}.")
    cap = getattr(settings, "AGENT_DAILY_BUDGET_USD", {}).get(agent)
    if cap is not None:
        used = spend_today(agent)
        if used >= cap:
            raise Halt(f"{agent}'s daily budget reached: ${used:.2f} of ${cap:.2f}.")
    if idea_id is not None:
        own = getattr(settings, "AGENT_IDEA_BUDGET_USD", {})   # agents with their own cap per idea (Serge's plans)
        if agent in own:
            used, cap, what = spend_for_idea(idea_id, agent=agent), own[agent], f"{agent}'s budget for this idea"
        else:
            used, cap, what = spend_for_idea(idea_id, exclude=tuple(own)), settings.PER_IDEA_BUDGET_USD, "Budget for this idea"
        if used >= cap:
            raise Halt(f"{what} reached: ${used:.2f} of ${cap:.2f}.")


def price(model, usage, searches):
    rate = next((v for k, v in settings.PRICES_PER_MTOK.items() if model.startswith(k)), (5.0, 25.0))
    tokens_in = (getattr(usage, "input_tokens", 0) or 0) \
        + (getattr(usage, "cache_creation_input_tokens", 0) or 0) \
        + (getattr(usage, "cache_read_input_tokens", 0) or 0)
    tokens_out = getattr(usage, "output_tokens", 0) or 0
    usd = tokens_in / 1e6 * rate[0] + tokens_out / 1e6 * rate[1] + searches * settings.WEB_SEARCH_PRICE_USD
    return tokens_in, tokens_out, usd


def record_cost(agent, model, usage, idea_id=None):
    stu = getattr(usage, "server_tool_use", None)
    searches = (getattr(stu, "web_search_requests", 0) or 0) if stu else 0
    tin, tout, usd = price(model, usage, searches)
    with _db() as con:
        con.execute(
            "INSERT INTO costs(ts,day,agent,model,idea_id,input_tokens,output_tokens,searches,usd) "
            "VALUES(?,?,?,?,?,?,?,?,?)",
            (time.time(), date.today().isoformat(), agent, model, idea_id, tin, tout, searches, usd))
    return usd


def spend_today(agent=None):
    q, args = "SELECT COALESCE(SUM(usd),0) s FROM costs WHERE day=?", [date.today().isoformat()]
    if agent:
        q += " AND agent=?"; args.append(agent)
    with _db() as con:
        r = con.execute(q, args).fetchone()
    return r["s"]


def spend_for_idea(idea_id, agent=None, exclude=()):
    q, args = "SELECT COALESCE(SUM(usd),0) s FROM costs WHERE idea_id=?", [idea_id]
    if agent:
        q += " AND agent=?"; args.append(agent)
    if exclude:
        q += f" AND agent NOT IN ({','.join('?' * len(exclude))})"; args += list(exclude)
    with _db() as con:
        r = con.execute(q, args).fetchone()
    return r["s"]


# ---- Subscription usage (workers running through Claude Code) ------------------------
# Not money: the subscription has no per-call price. value_usd is what the same work would cost on the API,
# the only meter Claude Code reports, used for each agent's daily allowance and the office's usage panel.
def record_usage(agent, engine, model, idea_id, usage, searches, turns, secs, value_usd, ok=True):
    u = usage or {}
    with _db() as con:
        con.execute("INSERT INTO usage(ts,day,agent,engine,model,idea_id,input_tokens,output_tokens,cache_tokens,searches,"
                    "turns,secs,value_usd,ok) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (time.time(), date.today().isoformat(), agent, engine, model, idea_id, u.get("input_tokens", 0) or 0,
                     u.get("output_tokens", 0) or 0,
                     (u.get("cache_read_input_tokens", 0) or 0) + (u.get("cache_creation_input_tokens", 0) or 0),
                     searches or 0, turns or 0, secs, value_usd or 0, 1 if ok else 0))


def usage_today(agent=None):
    q, args = ("SELECT agent, COUNT(*) runs, SUM(input_tokens+output_tokens+cache_tokens) tokens, SUM(output_tokens) out_tokens, "
               "SUM(searches) searches, ROUND(SUM(value_usd),4) value_usd FROM usage WHERE day=?"), [date.today().isoformat()]
    if agent:
        q += " AND agent=?"; args.append(agent)
    with _db() as con:
        rows = con.execute(q + " GROUP BY agent", args).fetchall()
    return {r["agent"]: dict(r) for r in rows}


def subscription_value_today(agent):
    return (usage_today(agent).get(agent) or {}).get("value_usd") or 0


# ---- Richard's L&D ideas (synced from the lnd branch by lnd.py) ----------------------
def add_lnd_idea(idea, day, note=""):
    """True if the idea is new."""
    with _db() as con:
        cur = con.execute("INSERT OR IGNORE INTO lnd_ideas(id,day,ts,status,data,note) VALUES(?,?,?,?,?,?)",
                          (str(idea["id"]), day, time.time(), "new", json.dumps(idea), note))
        return cur.rowcount > 0


def list_lnd_ideas(limit=40):
    with _db() as con:
        rows = con.execute("SELECT * FROM lnd_ideas ORDER BY day DESC, id LIMIT ?", (limit,)).fetchall()
    return [{"id": r["id"], "day": r["day"], "status": r["status"], "data": json.loads(r["data"] or "{}"),
             "note": r["note"], "reason": r["reason"], "decided_ts": r["decided_ts"]} for r in rows]


def decide_lnd_idea(idea_id, decision, reason=""):
    with _db() as con:
        r = con.execute("SELECT status, data FROM lnd_ideas WHERE id=?", (str(idea_id),)).fetchone()
    if not r:
        return f"No L&D idea {idea_id}."
    if r["status"] != "new":
        return f"Idea {idea_id} was already {r['status']}."
    status = {"yes": "approved", "no": "declined"}.get(decision)
    if not status:
        return f"Unknown decision '{decision}'."
    with _db() as con:
        con.execute("UPDATE lnd_ideas SET status=?, reason=?, decided_ts=? WHERE id=?",
                    (status, (reason or "")[:1000], time.time(), str(idea_id)))
    title = json.loads(r["data"]).get("title", "")
    log("Owner", f"lnd_{status}", None, {"idea": str(idea_id), "title": title, "reason": reason or ""})
    return f"Idea {idea_id} {status}: {title}"


# ---- Episodes: Calina's scripts for a content project ----------------------------------
# status: awaiting_approval -> approved | rejected; later rendered (video_path) -> published
def add_episode(project_id, batch, data):
    with _db() as con:
        return con.execute("INSERT INTO episodes(project_id,batch,ts,status,title,data) VALUES(?,?,?,?,?,?)",
                           (project_id, batch, time.time(), "awaiting_approval", data.get("title", "")[:300],
                            json.dumps(data))).lastrowid


def update_episode(eid, **fields):
    assert set(fields) <= {"status", "owner_note", "video_path", "data", "title"}, fields
    if isinstance(fields.get("data"), dict):
        fields["data"] = json.dumps(fields["data"])
    with _db() as con:
        con.execute(f"UPDATE episodes SET {', '.join(f'{k}=?' for k in fields)} WHERE id=?", (*fields.values(), eid))


def _episode_row(r):
    e = {k: r[k] for k in ("id", "project_id", "batch", "ts", "status", "title", "owner_note", "video_path")}
    e["data"] = json.loads(r["data"] or "{}")
    return e


def get_episode(eid):
    with _db() as con:
        r = con.execute("SELECT * FROM episodes WHERE id=?", (eid,)).fetchone()
    return _episode_row(r) if r else None


def list_episodes(project_id=None, limit=60):
    q, args = "SELECT * FROM episodes", []
    if project_id is not None:
        q += " WHERE project_id=?"; args.append(project_id)
    with _db() as con:
        rows = con.execute(q + " ORDER BY id DESC LIMIT ?", (*args, limit)).fetchall()
    return [_episode_row(r) for r in rows]


# ---- Reference boards: the Scout's evidence of what works, and the owner's choice ----------
# status: ready (waiting for the owner) -> approved | superseded
def add_refboard(project_id, data):
    with _db() as con:
        con.execute("UPDATE refboards SET status='superseded' WHERE project_id=? AND status='ready'", (project_id,))
        return con.execute("INSERT INTO refboards(project_id,ts,status,data) VALUES(?,?,?,?)",
                           (project_id, time.time(), "ready", json.dumps(data))).lastrowid


def _board_row(r):
    return {"id": r["id"], "project_id": r["project_id"], "ts": r["ts"], "status": r["status"], "data": json.loads(r["data"] or "{}"),
            "choices": json.loads(r["choices"]) if r["choices"] else {}, "note": r["note"] or "", "decided_ts": r["decided_ts"]}


def latest_refboard(project_id):
    with _db() as con:
        r = con.execute("SELECT * FROM refboards WHERE project_id=? AND status!='superseded' ORDER BY id DESC LIMIT 1",
                        (project_id,)).fetchone()
        if not r:
            r = con.execute("SELECT * FROM refboards WHERE project_id=? ORDER BY id DESC LIMIT 1", (project_id,)).fetchone()
    return _board_row(r) if r else None


def approved_refboard(project_id):
    with _db() as con:
        r = con.execute("SELECT * FROM refboards WHERE project_id=? AND status='approved' ORDER BY id DESC LIMIT 1",
                        (project_id,)).fetchone()
    return _board_row(r) if r else None


def decide_refboard(bid, status, choices, note):
    with _db() as con:
        con.execute("UPDATE refboards SET status=?, choices=?, note=?, decided_ts=? WHERE id=?",
                    (status, json.dumps(choices), note, time.time(), bid))


def next_batch(project_id):
    with _db() as con:
        r = con.execute("SELECT COALESCE(MAX(batch),0)+1 n FROM episodes WHERE project_id=?", (project_id,)).fetchone()
    return r["n"]


# ---- Projects: Serge's plans and the owner's decisions on them -------------------
PROJECT_FIELDS = ("status", "revision", "plan", "plan_path", "one_off_usd", "monthly_usd", "owner_note", "decided_ts")


def new_project(idea_id):
    with _db() as con:
        return con.execute("INSERT INTO projects(idea_id,ts,status,revision) VALUES(?,?,?,0)",
                           (idea_id, time.time(), "planning")).lastrowid


def update_project(pid, **fields):
    assert set(fields) <= set(PROJECT_FIELDS), fields
    if isinstance(fields.get("plan"), (dict, list)):
        fields["plan"] = json.dumps(fields["plan"])
    with _db() as con:
        con.execute(f"UPDATE projects SET {', '.join(f'{k}=?' for k in fields)} WHERE id=?", (*fields.values(), pid))


def _project_row(r, with_text=False):
    p = {k: r[k] for k in ("id", "idea_id", "ts", "status", "revision", "plan_path", "one_off_usd", "monthly_usd",
                           "owner_note", "decided_ts")}
    p["plan"] = json.loads(r["plan"]) if r["plan"] else None
    p["meta"] = json.loads(r["meta"]) if "meta" in r.keys() and r["meta"] else {}
    with _db() as con:
        t = con.execute("SELECT title FROM ideas WHERE id=?", (r["idea_id"],)).fetchone()
    p["title"] = t["title"] if t else f"Idea #{r['idea_id']}"
    if with_text:
        path = Path(r["plan_path"]) if r["plan_path"] else None
        if path and not path.is_absolute():
            path = ROOT / path
        p["text"] = path.read_text(encoding="utf-8") if path and path.exists() else ""
    return p


def set_project_meta(pid, **facts):
    """Facts the team must remember about a project (e.g. channel = {"name", "handle", "url"})."""
    p = get_project(pid, with_text=False)
    if not p:
        raise ValueError(f"No project {pid}.")
    meta = {**p["meta"], **facts}
    with _db() as con:
        con.execute("UPDATE projects SET meta=? WHERE id=?", (json.dumps(meta), pid))
    return meta


def channel_line(p):
    c = (p.get("meta") or {}).get("channel") or {}
    return f'{c.get("name", "")} ({c.get("handle", "")})'.replace(" ()", "") if c.get("name") else ""


def get_project(pid, with_text=True):
    with _db() as con:
        r = con.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    return _project_row(r, with_text) if r else None


def project_for_idea(idea_id):
    with _db() as con:
        r = con.execute("SELECT * FROM projects WHERE idea_id=? ORDER BY id DESC LIMIT 1", (idea_id,)).fetchone()
    return _project_row(r) if r else None


def list_projects(limit=20):
    with _db() as con:
        rows = con.execute("SELECT * FROM projects ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    out = []
    for r in rows:
        p = _project_row(r)
        plan = p.pop("plan") or {}
        p["summary"] = plan.get("summary", "")
        out.append(p)
    return out


# ---- Audit log ---------------------------------------------------------------
_listeners = []


def on_event(fn):
    """Subscribe to events (the CLI prints them; later the office view will animate them)."""
    _listeners.append(fn)


def log(agent, kind, idea_id=None, detail=None):
    ev = {"ts": time.time(), "agent": agent, "kind": kind, "idea_id": idea_id, "detail": detail or {}}
    with _db() as con:
        con.execute("INSERT INTO events(ts,agent,kind,idea_id,detail) VALUES(?,?,?,?,?)",
                    (ev["ts"], agent, kind, idea_id, json.dumps(ev["detail"])))
    for fn in _listeners:
        try:
            fn(ev)
        except Exception:
            pass


# ---- Ideas -------------------------------------------------------------------
def new_idea(title, source, status="research", pitch=None):
    with _db() as con:
        cur = con.execute("INSERT INTO ideas(ts,title,source,status,pitch) VALUES(?,?,?,?,?)",
                          (time.time(), title, source, status, json.dumps(pitch) if pitch else None))
        return cur.lastrowid


def update_idea(idea_id, **fields):
    for k in ("verdict", "pitch"):
        if k in fields and fields[k] is not None and not isinstance(fields[k], str):
            fields[k] = json.dumps(fields[k])
    cols = ", ".join(f"{k}=?" for k in fields)
    with _db() as con:
        con.execute(f"UPDATE ideas SET {cols} WHERE id=?", (*fields.values(), idea_id))


HIDDEN = ("inbox", "dismissed", "archived")


def list_ideas(limit=20):
    """Ideas that entered the pipeline (not Doulya's unreviewed or dismissed pitches)."""
    with _db() as con:
        rows = con.execute("SELECT * FROM ideas WHERE status NOT IN (?,?,?) ORDER BY id DESC LIMIT ?",
                           (*HIDDEN, limit)).fetchall()
    out = []
    for r in rows:
        v = json.loads(r["verdict"]) if r["verdict"] else None
        pr = project_for_idea(r["id"])
        out.append({"id": r["id"], "title": r["title"], "status": r["status"],
                    "plan_id": pr and pr["id"], "plan_status": pr and pr["status"],
                    "verdict": v and v.get("verdict"), "path": v and v.get("path"),
                    "one_line": v and v.get("one_line_summary"), "source": r["source"],
                    "cost_usd": round(spend_for_idea(r["id"]), 3)})
    return out


def list_inbox():
    """Doulya's pitches waiting for the owner's yes or no."""
    with _db() as con:
        rows = con.execute("SELECT * FROM ideas WHERE status='inbox' ORDER BY id ASC").fetchall()
    return [{"id": r["id"], "ts": r["ts"], "title": r["title"], "pitch": json.loads(r["pitch"] or "{}")} for r in rows]


def idea_memory(limit=60):
    """Every idea seen so far, plus why the owner dismissed some. Doulya reads this to avoid repeats."""
    with _db() as con:
        rows = con.execute("SELECT title,status,pitch FROM ideas ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    seen, dismissed = [], []
    for r in rows:
        seen.append(r["title"])
        if r["status"] == "dismissed":
            p = json.loads(r["pitch"] or "{}")
            dismissed.append({"title": r["title"], "owner_reason": p.get("dismiss_reason", "")})
    return seen, dismissed


def last_event_time(kind, agent=None):
    q, args = "SELECT ts FROM events WHERE kind=?", [kind]
    if agent:
        q += " AND agent=?"; args.append(agent)
    with _db() as con:
        r = con.execute(q + " ORDER BY id DESC LIMIT 1", args).fetchone()
    return r["ts"] if r else None


# ---- Live view helpers (used by server.py) ---------------------------------
def _event_row(r):
    return {"id": r["id"], "ts": r["ts"], "agent": r["agent"], "kind": r["kind"],
            "idea_id": r["idea_id"], "detail": json.loads(r["detail"] or "{}")}


def events_since(last_id, limit=200):
    with _db() as con:
        if last_id < 0:
            rows = con.execute("SELECT * FROM events ORDER BY id DESC LIMIT 60").fetchall()[::-1]
        else:
            rows = con.execute("SELECT * FROM events WHERE id>? ORDER BY id LIMIT ?", (last_id, limit)).fetchall()
    return [_event_row(r) for r in rows]


def agents_overview():
    day = date.today().isoformat()
    with _db() as con:
        agents = con.execute("SELECT * FROM agents ORDER BY rowid").fetchall()
        out = []
        for a in agents:
            c = con.execute("SELECT COALESCE(SUM(usd),0) usd, COUNT(*) calls FROM costs WHERE agent=? AND day=?",
                            (a["name"], day)).fetchone()
            t = con.execute("SELECT COUNT(*) n FROM events WHERE agent=? AND kind IN ('task_started','idea_routed')",
                            (a["name"],)).fetchone()
            out.append({"name": a["name"], "dept": a["dept"], "role": a["role"], "model": a["model"],
                        "tools": json.loads(a["tools"]), "status": a["status"],
                        "cost_today": round(c["usd"], 4), "calls_today": c["calls"], "tasks": t["n"]})
    return out


def get_idea(idea_id):
    with _db() as con:
        r = con.execute("SELECT * FROM ideas WHERE id=?", (idea_id,)).fetchone()
    if not r:
        return None
    brief = ""
    if r["brief_path"]:
        p = Path(r["brief_path"])
        if not p.is_absolute():
            p = ROOT / p
        if p.exists():
            brief = p.read_text(encoding="utf-8")
    return {"id": r["id"], "title": r["title"], "status": r["status"], "source": r["source"],
            "pitch": json.loads(r["pitch"]) if r["pitch"] else None,
            "verdict": json.loads(r["verdict"]) if r["verdict"] else None,
            "brief": brief, "cost_usd": round(spend_for_idea(idea_id), 3)}


def mark_interrupted():
    """Ideas left mid-pipeline when the program closed can never finish on their own."""
    with _db() as con:
        cur = con.execute("UPDATE ideas SET status='interrupted' WHERE status IN ('research','judgment')")
        return cur.rowcount
