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
        """)


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
    if idea_id is not None:
        used = spend_for_idea(idea_id)
        if used >= settings.PER_IDEA_BUDGET_USD:
            raise Halt(f"Budget for this idea reached: ${used:.2f} of ${settings.PER_IDEA_BUDGET_USD:.2f}.")


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


def spend_today():
    with _db() as con:
        r = con.execute("SELECT COALESCE(SUM(usd),0) s FROM costs WHERE day=?", (date.today().isoformat(),)).fetchone()
    return r["s"]


def spend_for_idea(idea_id):
    with _db() as con:
        r = con.execute("SELECT COALESCE(SUM(usd),0) s FROM costs WHERE idea_id=?", (idea_id,)).fetchone()
    return r["s"]


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
def new_idea(title, source):
    with _db() as con:
        cur = con.execute("INSERT INTO ideas(ts,title,source,status) VALUES(?,?,?,?)",
                          (time.time(), title, source, "research"))
        return cur.lastrowid


def update_idea(idea_id, **fields):
    if "verdict" in fields and not isinstance(fields["verdict"], str):
        fields["verdict"] = json.dumps(fields["verdict"])
    cols = ", ".join(f"{k}=?" for k in fields)
    with _db() as con:
        con.execute(f"UPDATE ideas SET {cols} WHERE id=?", (*fields.values(), idea_id))


def list_ideas(limit=20):
    with _db() as con:
        rows = con.execute("SELECT * FROM ideas ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    out = []
    for r in rows:
        v = json.loads(r["verdict"]) if r["verdict"] else None
        out.append({"id": r["id"], "title": r["title"], "status": r["status"],
                    "verdict": v and v.get("verdict"), "path": v and v.get("path"),
                    "one_line": v and v.get("one_line_summary"),
                    "cost_usd": round(spend_for_idea(r["id"]), 3)})
    return out


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
    return {"id": r["id"], "title": r["title"], "status": r["status"],
            "verdict": json.loads(r["verdict"]) if r["verdict"] else None,
            "brief": brief, "cost_usd": round(spend_for_idea(idea_id), 3)}


def mark_interrupted():
    """Ideas left mid-pipeline when the program closed can never finish on their own."""
    with _db() as con:
        cur = con.execute("UPDATE ideas SET status='interrupted' WHERE status IN ('research','judgment')")
        return cur.rowcount
