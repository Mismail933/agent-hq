"""
Agent HQ live office.

    python server.py      starts the office and opens it in your browser

Keep this window open while you use the office; it is the engine.
Everything runs on your computer at http://localhost:8765.
"""
import json
import os
import sys
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8")
    except Exception:
        pass


def load_env():
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env()
import agents             # noqa: E402
import atlas_engine       # noqa: E402
import control_plane as cp  # noqa: E402
import settings           # noqa: E402

cp.init()
agents.register_all()
_n = cp.mark_interrupted()
if _n:
    cp.log("Atlas", "halted", None, {"reason": f"{_n} idea(s) were interrupted when the program last closed. Ask Atlas to retry."})

ATLAS = agents.Atlas()
CHAT = [{"from": "atlas", "ts": time.time(),
         "text": "Hi, I'm Atlas, your General Manager. Ask me for a briefing any time. Doulya scouts for ideas every day and "
                 "puts her top picks in your Idea Inbox; nothing gets researched until you approve it. "
                 "You can also pitch me your own idea."}]
STATE = {"busy": False}
LOCK = threading.Lock()
NEWS = []   # what the office posted in Atlas's name since his last reply; he hears about it with the next message


def friendly_error(e):
    name = type(e).__name__
    msg = str(e)
    if "Authentication" in name or "401" in msg:
        return "Your API key was rejected. Create a new key at console.anthropic.com → API Keys, delete the .env file in this folder, and double-click START-HERE again."
    if "PermissionDenied" in name or "credit" in msg.lower() or "billing" in msg.lower():
        return "The API refused the request. Check that your Anthropic account has credit (console.anthropic.com → Billing)."
    if "RateLimit" in name or "429" in msg:
        return "Too many requests right now. Wait a minute and try again."
    if "NotFound" in name and "model" in msg.lower():
        return f"A model name in settings.py isn't available on your account: {msg[:200]}"
    if "Connection" in name:
        return "I couldn't reach the Anthropic API. Check your internet connection."
    return f"Something went wrong: {name}: {msg[:300]}"


def atlas_says(text):
    with LOCK:
        CHAT.append({"from": "atlas", "ts": time.time(), "text": text})
        NEWS.append(text)


def run_scout(trigger):
    out = agents.doulya_scout(trigger)
    try:
        got = json.loads(out)
        items = got.get("new_inbox_ideas", [])
        if items:
            lines = "\n".join(f"- #{i['id']} {i['title']}" for i in items)
            atlas_says(f"Doulya just brought {len(items)} new idea{'s' if len(items) != 1 else ''} to your Idea Inbox:\n{lines}\n\n"
                       "Open the Inbox to read her pitches. Click **Research it** on any you like, or **Dismiss** with a reason "
                       "so she learns. Nothing is researched until you say so.")
        else:
            atlas_says("Doulya finished scouting but found nothing strong enough to pitch today.")
    except ValueError:
        atlas_says(f"Doulya couldn't finish scouting: {out}")


def announce_verdict(out):
    try:
        r = json.loads(out)
        v, idea = r["verdict"], cp.get_idea(r["idea_id"])
        atlas_says(f"**Verdict on #{idea['id']}: {idea['title']}**\n\nVera says **{v['verdict'].replace('_', ' ')}** (Path {v['path']}). "
                   f"{v.get('one_line_summary', '')}\n\nOpen it under Ideas → Judged for the scores, evidence and Sage's full brief.")
    except (ValueError, KeyError, TypeError):
        atlas_says(out)


def run_inbox_research(idea_id, notes=""):
    announce_verdict(agents.research_inbox_idea(idea_id, notes))


def run_pitch(idea, notes=""):
    announce_verdict(agents.route_idea(idea, notes))


def run_retry(idea_id):
    announce_verdict(agents.retry_idea(idea_id))


def scheduler():
    """Doulya scouts once a day while the engine is running."""
    time.sleep(20)
    while True:
        try:
            if getattr(settings, "SCOUT_AUTOMATICALLY", False) and not cp.STOP_FILE.exists() and not agents.scouted_today():
                run_scout("schedule")
        except Exception as e:
            print("scheduler:", repr(e), flush=True)
        time.sleep(600)


def ask_atlas(text):
    """Atlas in Claude Code when available; the small in-app Atlas on the API key otherwise."""
    with LOCK:
        news = NEWS[:]
        NEWS.clear()
    if atlas_engine.engine() == "claude_code":
        prompt = text
        if news:
            prompt = ("[Office updates the system posted in your name since your last reply; the owner has seen them]\n"
                      + "\n\n".join(news) + "\n\n[The owner's message]\n" + text)
        try:
            reply, info = atlas_engine.ask(prompt)
            cp.log("Atlas", "model_call", None, info)
            return reply
        except atlas_engine.Unavailable as e:
            cp.log("Atlas", "halted", None, {"reason": f"Claude Code unavailable, backup Atlas answered: {e}"})
            print("Atlas via Claude Code unavailable:", e, flush=True)
            return f"_(Backup Atlas answering: Claude Code isn't available right now. {e})_\n\n" + (ATLAS.chat(text) or "")
    return ATLAS.chat(text)


def run_chat(text):
    cp.log("Atlas", "chat_received", None, {"text": text[:200]})
    try:
        reply = ask_atlas(text) or "(no reply)"
    except Exception as e:  # API errors, network errors
        reply = friendly_error(e)
        print("ERROR:", repr(e), flush=True)
    with LOCK:
        CHAT.append({"from": "atlas", "ts": time.time(), "text": reply})
        STATE["busy"] = False
    cp.log("Atlas", "reply", None, {"chars": len(reply)})


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if "json" in ctype or "html" in ctype else ""))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _json_body(self):
        n = int(self.headers.get("Content-Length") or 0)
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return {}

    def do_GET(self):
        u = urlparse(self.path)
        if u.path in ("/", "/index.html"):
            return self._send(200, (ROOT / "office.html").read_bytes(), "text/html")
        if u.path == "/api/state":
            since = int(parse_qs(u.query).get("since", ["-1"])[0])
            with LOCK:
                chat, busy = list(CHAT), STATE["busy"]
            return self._send(200, {
                "events": cp.events_since(since),
                "agents": cp.agents_overview(),
                "ideas": cp.list_ideas(),
                "inbox": cp.list_inbox(),
                "scouting": agents.SCOUTING.locked(),
                "last_scout": cp.last_event_time("scout_done", "Doulya"),
                "chat": chat, "busy": busy, "atlas_engine": atlas_engine.engine(),
                "spend_today": round(cp.spend_today(), 4),
                "daily_cap": settings.DAILY_AI_BUDGET_USD,
                "idea_cap": settings.PER_IDEA_BUDGET_USD,
                "kill": cp.STOP_FILE.exists(),
                "simulated": os.environ.get("HQ_SIMULATE") == "1",
                "has_key": bool(os.environ.get("ANTHROPIC_API_KEY")) or os.environ.get("HQ_SIMULATE") == "1",
            })
        if u.path.startswith("/api/idea/"):
            try:
                idea = cp.get_idea(int(u.path.rsplit("/", 1)[1]))
            except ValueError:
                idea = None
            return self._send(200 if idea else 404, idea or {"error": "not found"})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        u = urlparse(self.path)
        if u.path == "/api/chat":
            text = str(self._json_body().get("text", "")).strip()[:2000]
            if not text:
                return self._send(400, {"error": "empty"})
            with LOCK:
                if STATE["busy"]:
                    return self._send(409, {"error": "Atlas is still working on your last message."})
                STATE["busy"] = True
                CHAT.append({"from": "you", "ts": time.time(), "text": text})
            threading.Thread(target=run_chat, args=(text,), daemon=True).start()
            return self._send(202, {"ok": True})
        if u.path == "/api/scout":
            if agents.SCOUTING.locked():
                return self._send(409, {"error": "Doulya is already scouting."})
            threading.Thread(target=run_scout, args=("owner",), daemon=True).start()
            return self._send(202, {"ok": True})
        if u.path.startswith("/api/inbox/"):
            parts = u.path.strip("/").split("/")   # api inbox <id> <action>
            try:
                idea_id, action = int(parts[2]), parts[3]
            except (IndexError, ValueError):
                return self._send(400, {"error": "bad request"})
            idea = cp.get_idea(idea_id)
            if not idea or idea["status"] != "inbox":
                return self._send(404, {"error": "That idea is no longer in the inbox."})
            if action == "research":
                if agents.PIPELINE.locked():
                    return self._send(409, {"error": "The team is busy with another idea. Try again when it finishes."})
                notes = str(self._json_body().get("notes", "")).strip()[:1000]
                threading.Thread(target=run_inbox_research, args=(idea_id, notes), daemon=True).start()
                return self._send(202, {"ok": True})
            if action == "dismiss":
                reason = str(self._json_body().get("reason", "")).strip()[:300]
                return self._send(200, {"ok": True, "message": agents.dismiss_inbox_idea(idea_id, reason)})
            return self._send(404, {"error": "unknown action"})
        if u.path == "/api/pitch":
            body = self._json_body()
            idea = str(body.get("idea", "")).strip()[:300]
            if not idea:
                return self._send(400, {"error": "No idea given."})
            if agents.PIPELINE.locked():
                return self._send(409, {"error": "The team is busy with another idea. Try again when it finishes."})
            threading.Thread(target=run_pitch, args=(idea, str(body.get("notes", ""))[:1000]), daemon=True).start()
            return self._send(202, {"ok": True})
        if u.path.startswith("/api/retry/"):
            try:
                idea = cp.get_idea(int(u.path.rsplit("/", 1)[1]))
            except ValueError:
                idea = None
            if not idea:
                return self._send(404, {"error": "No such idea."})
            if idea["verdict"]:
                return self._send(409, {"error": f"Idea #{idea['id']} already has a verdict."})
            if agents.PIPELINE.locked():
                return self._send(409, {"error": "The team is busy with another idea. Try again when it finishes."})
            threading.Thread(target=run_retry, args=(idea["id"],), daemon=True).start()
            return self._send(202, {"ok": True})
        if u.path == "/api/stop":
            cp.STOP_FILE.write_text("stop")
            cp.log("Owner", "kill_switch", None, {"on": True})
            return self._send(200, {"kill": True})
        if u.path == "/api/resume":
            cp.STOP_FILE.unlink(missing_ok=True)
            cp.log("Owner", "kill_switch", None, {"on": False})
            return self._send(200, {"kill": False})
        self._send(404, {"error": "not found"})


def prepare_atlas():
    if atlas_engine.engine() != "claude_code":
        return
    try:
        atlas_engine.setup()
        exe = atlas_engine.find_claude()
        if not exe:
            print("  Atlas: Claude Code not found, so the backup Atlas will answer.\n", flush=True)
            return
        if not atlas_engine.logged_in(exe):
            atlas_engine.offer_login(exe)
        print(f"  Atlas's folder: {atlas_engine.HOME}\n", flush=True)
    except Exception as e:
        print("  Atlas setup failed:", repr(e), flush=True)


def main():
    prepare_atlas()
    port = int(os.environ.get("HQ_PORT", "8765"))
    for p in range(port, port + 10):
        try:
            srv = ThreadingHTTPServer(("127.0.0.1", p), Handler)
            break
        except OSError:
            continue
    else:
        print("No free port found between", port, "and", port + 9); return
    url = f"http://localhost:{srv.server_port}"
    (ROOT / ".port").write_text(str(srv.server_port))   # hq.py finds the office here
    print(f"\n  Agent HQ is running at {url}")
    print("  Your browser should open by itself. If not, open that address.")
    print("  Keep this window open while you use the office (you can minimize it).")
    print("  Close this window to stop everything.\n", flush=True)
    threading.Thread(target=scheduler, daemon=True).start()
    if os.environ.get("HQ_NO_BROWSER") != "1":
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
