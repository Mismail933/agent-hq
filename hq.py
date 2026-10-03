"""
Atlas's controls for Agent HQ.

    python hq.py status | inbox | idea <id> | research <id> ["notes"] | dismiss <id> "reason"
                 pitch "idea" ["notes"] | scout | retry <id> | spend | activity [n] | stop | resume

Reading comes straight from hq.db. Actions go through the running office, so they show up live there and pass the
same guardrails (budgets, one idea at a time, kill switch).
"""
import json
import os
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8")
    except Exception:
        pass

import agents             # noqa: E402
import control_plane as cp  # noqa: E402
import settings           # noqa: E402

NOT_RUNNING = "The office isn't running, so nothing can be ordered right now. Ask the owner to double-click START-HERE."


def show(obj):
    print(obj if isinstance(obj, str) else json.dumps(obj, indent=2, ensure_ascii=False))


def office(path, body=None):
    """POST to the running office. Returns (status code, reply)."""
    port_file = ROOT / ".port"
    port = port_file.read_text().strip() if port_file.exists() else os.environ.get("HQ_PORT", "8765")
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", data=json.dumps(body or {}).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")
    except (urllib.error.URLError, ConnectionError, TimeoutError):
        sys.exit(NOT_RUNNING)


def order(path, body, started):
    code, reply = office(path, body)
    show(started if code < 300 else f"Not done: {reply.get('error') or reply}")


def status():
    s = json.loads(agents.company_status())
    s["spend_today_by_agent"] = _by_agent(date.today().isoformat())
    show(s)


def inbox():
    items = cp.list_inbox()
    if not items:
        return show("The Idea Inbox is empty.")
    show([{"id": i["id"], "pitched": datetime.fromtimestamp(i["ts"]).strftime("%Y-%m-%d"), "title": i["title"],
           **{k: v for k, v in i["pitch"].items() if k != "title"}} for i in items])


def idea(idea_id):
    i = cp.get_idea(int(idea_id))
    if not i:
        return show(f"No idea with id {idea_id}.")
    brief = i.pop("brief")
    show(i)
    if brief:
        print("\n---- Sage's brief ----\n" + (brief if len(brief) < 8000 else brief[:8000] + "\n[... brief cut short]"))


def _by_agent(day):
    with cp._db() as con:
        rows = con.execute("SELECT agent, ROUND(SUM(usd),4) usd, SUM(searches) s FROM costs WHERE day=? GROUP BY agent",
                           (day,)).fetchall()
    return {r["agent"]: {"usd": r["usd"], "web_searches": r["s"]} for r in rows}


def spend():
    today = cp.spend_today()
    cap = settings.DAILY_AI_BUDGET_USD
    with cp._db() as con:
        week = con.execute("SELECT day, ROUND(SUM(usd),3) usd FROM costs GROUP BY day ORDER BY day DESC LIMIT 7").fetchall()
        total = con.execute("SELECT COALESCE(SUM(usd),0) s FROM costs").fetchone()["s"]
    show({"api_spend_today_usd": round(today, 3), "daily_cap_usd": cap, "used_pct": round(100 * today / cap) if cap else None,
          "by_agent_today": _by_agent(date.today().isoformat()),
          "agent_daily_caps_usd": getattr(settings, "AGENT_DAILY_BUDGET_USD", {}),
          "per_idea_cap_usd": settings.PER_IDEA_BUDGET_USD,
          "last_7_days": {r["day"]: r["usd"] for r in week}, "all_time_usd": round(total, 3),
          "note": "API spend only (Doulya, Sage, Vera, backup Atlas). Atlas in Claude Code runs on the Claude subscription."})


def activity(n=25):
    for e in cp.events_since(-1)[-int(n):]:
        d = e["detail"]
        brief = ", ".join(f"{k}={str(v)[:80]}" for k, v in d.items()) if isinstance(d, dict) else str(d)[:120]
        idea_ref = f" #{e['idea_id']}" if e["idea_id"] else ""
        print(f"{datetime.fromtimestamp(e['ts']).strftime('%m-%d %H:%M')}  {e['agent']:<7} {e['kind']}{idea_ref}  {brief}")


def main(argv):
    cp.init()
    cmd, args = (argv[0].lower(), argv[1:]) if argv else ("help", [])
    try:
        if cmd == "status":
            status()
        elif cmd == "inbox":
            inbox()
        elif cmd == "idea":
            idea(args[0])
        elif cmd == "spend":
            spend()
        elif cmd == "activity":
            activity(args[0] if args else 25)
        elif cmd == "research":
            order(f"/api/inbox/{int(args[0])}/research", {"notes": " ".join(args[1:])},
                  f"Idea #{args[0]} sent to Sage, then Vera. It takes a few minutes; the verdict will appear in the office "
                  "chat and in `hq status`.")
        elif cmd == "dismiss":
            code, reply = office(f"/api/inbox/{int(args[0])}/dismiss", {"reason": " ".join(args[1:])})
            show(reply.get("message") if code < 300 else f"Not done: {reply.get('error')}")
        elif cmd == "pitch":
            order("/api/pitch", {"idea": args[0], "notes": " ".join(args[1:])},
                  "Idea sent to Sage, then Vera. The verdict will appear in the office chat and in `hq status`.")
        elif cmd == "scout":
            order("/api/scout", {}, "Doulya is scouting. Her picks will land in the Idea Inbox in a few minutes.")
        elif cmd == "retry":
            order(f"/api/retry/{int(args[0])}", {}, f"Retrying idea #{args[0]}. The verdict will appear in the office chat.")
        elif cmd == "stop":
            office("/api/stop"); show("Kill switch ON. Every agent stops before its next step.")
        elif cmd == "resume":
            office("/api/resume"); show("Kill switch OFF. The team can work again.")
        else:
            show(__doc__)
    except (IndexError, ValueError):
        show(f"Missing or wrong arguments for '{cmd}'.\n{__doc__}")


if __name__ == "__main__":
    main(sys.argv[1:])
