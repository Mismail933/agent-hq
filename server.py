"""
Agent HQ live office.

    python server.py      starts the office and opens it in your browser

Keep this window open while you use the office; it is the engine.
Everything runs on your computer at http://localhost:8765.
"""
import json
import os
import subprocess
import sys
import threading
import time
import urllib.request
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
import workers            # noqa: E402
import lnd                # noqa: E402
import production         # noqa: E402
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


# How much text the office accepts. Anything longer is cut visibly, never silently.
TEXT_LIMITS = {"chat": 12000, "notes": 12000, "idea": 300, "note": 4000, "reason": 1000}


def clip(text, kind):
    """(text, warning): the text cut to its limit with a visible marker, and a warning to pass back, or None."""
    text, n = str(text or "").strip(), TEXT_LIMITS[kind]
    if len(text) <= n:
        return text, None
    return (text[:n] + f"\n[cut off here: {len(text) - n:,} more characters did not fit]",
            f"Your {kind} were {len(text):,} characters, so only the first {n:,} were kept.")


def accepted(warning, **extra):
    body = {"ok": True, **extra}
    if warning:
        body["warning"] = warning
    return body


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


def run_batch(project_id, count, notes):
    out = agents.calina_batch(project_id, count, notes)
    try:
        r = json.loads(out)
        titles = "\n".join(f"- #{e['id']} {e['title']}" for e in r["episodes"])
        dropped = f" She dropped {r['dropped_without_source']} script(s) she couldn't source." if r["dropped_without_source"] else ""
        atlas_says(f"**Calina's batch {r['batch']} is ready: {len(r['episodes'])} scripts.**{dropped}\n{titles}\n\n"
                   + (f"{r['batch_note']}\n\n" if r.get("batch_note") else "")
                   + "Open Ideas → Content to read each script and its sources, then approve or reject it.")
    except (ValueError, KeyError, TypeError):
        atlas_says(out)


RENDERING = {"lock": threading.Lock(), "episode": None}


def with_upload_text(episodes):
    """Made videos carry their title and description, ready to copy into YouTube; shot lists carry their clip status."""
    for e in episodes:
        if production.is_v2(e) and e["status"] in ("approved", "rendered"):
            e["clips"] = production.clip_status(e)
        if e["video_path"]:
            folder = (ROOT / e["video_path"]).parent
            e["upload"] = {k: (folder / f"{k}.txt").read_text(encoding="utf-8").strip() if (folder / f"{k}.txt").exists() else ""
                           for k in ("title", "description")}
    return episodes


def shorts_python():
    p = getattr(settings, "SHORTS_PYTHON", None) or Path.home() / ".agent-hq-shorts" / "Scripts" / "python.exe"
    return str(p) if Path(p).exists() else None


def run_render(eid):
    """Calina runs the Shorts pipeline (shorts.py) on one approved script."""
    with RENDERING["lock"]:
        RENDERING["episode"] = eid
        e = cp.get_episode(eid)
        cp.log("Calina", "render_started", None, {"episode": eid, "title": e["title"] if e else ""})
        try:
            py = shorts_python()
            if not py:
                raise RuntimeError("the video tools aren't set up on this computer (see SHORTS_PYTHON in settings.py)")
            mode = "assemble" if e and production.is_v2(e) else "render"
            p = subprocess.run([py, str(ROOT / "shorts.py"), mode, str(eid)], cwd=ROOT, capture_output=True, text=True,
                               encoding="utf-8", errors="replace", timeout=1800,
                               creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            lines = (p.stdout or "").splitlines()
            result = next((l[7:] for l in lines if l.startswith("RESULT ")), None)
            if not result:
                blocked = next((l[8:] for l in lines if l.startswith("BLOCKED ")), None)
                raise RuntimeError(blocked or ((p.stderr or p.stdout or "no output").strip().splitlines() or ["?"])[-1][:300])
            r = json.loads(result)
            cp.log("Calina", "video_ready", None, {"episode": eid, "title": r["title"], "seconds": r["seconds"]})
            pace = (f" The voice still reads at {r['wpm']} words a minute even after slowing it: lower the speed in OpenArt's "
                    "text-to-speech next time." if r.get("wpm", 0) > 158 else "")
            what = f"{r['images']} clips" if mode == "assemble" else f"{r['images']} public-domain images"
            atlas_says(f"**Short #{eid} is ready:** {r['title']} ({r['seconds']:.0f} s, {what}).{pace}\n\n"
                       "Watch it in Ideas → Content. If it's good, upload it by hand with the title and description shown "
                       "there, turn on YouTube's altered/synthetic content setting, then click **Mark as published**.")
        except Exception as ex:
            cp.log("Calina", "video_failed", None, {"episode": eid, "reason": str(ex)[:300]})
            atlas_says(f"Short #{eid} couldn't be made: {ex}")
        finally:
            RENDERING["episode"] = None


def lnd_yes_to_atlas(idea_id):
    """Atlas first: an approved L&D idea goes to Atlas, who sets its priority with the owner before the Builder."""
    i = next((x for x in cp.list_lnd_ideas(200) if x["id"] == str(idea_id)), None)
    if not i:
        return
    d = i["data"]
    try:
        f = atlas_engine.HOME / "richard-approved.md"
        if not f.exists():
            f.write_text("# Richard's ideas the owner approved\n\nPrioritise each with the owner, then queue it in "
                         "requests-for-builder.md and mark it [queued] here.\n", encoding="utf-8")
        with f.open("a", encoding="utf-8") as out:
            out.write(f"\n## [new] {i['id']}: {d.get('title', '')}\nArea: {d.get('area', '')}. Effort: {d.get('effort', '')}.\n"
                      f"Problem: {d.get('problem', '')}\nProposal: {d.get('proposal', '')}\nGain: {d.get('gain', '')}\n"
                      f"Risks: {d.get('risks', '')}\nLinks: " + ", ".join(l.get("url", "") for l in d.get("links") or []) + "\n")
    except Exception as e:
        print("L&D note for Atlas failed:", e, flush=True)
    atlas_says(f"**You approved Richard's idea {i['id']}: {d.get('title', '')}** (effort {d.get('effort', '?')}).\n\n"
               "I'll look at where it fits in our priorities and suggest when to build it. It reaches the Builder once you agree.")


def lnd_loop():
    """Pick up Richard's ideas: at start, then every 30 minutes."""
    time.sleep(15)
    while True:
        try:
            if lnd.sync():
                atlas_says("**Richard has new ideas for the company.** Open Ideas → L&D to read them and say yes or no.")
        except Exception as e:
            print("L&D sync:", e, flush=True)
        time.sleep(1800)


def run_review(project_id, stats):
    text = agents.calina_review(project_id, stats)
    atlas_says(f"**Calina's learning note is ready.**\n\n{text[:1500]}" + ("…" if len(text) > 1500 else ""))


def run_plan(idea_id, notes=""):
    out = agents.serge_plan(idea_id, notes)
    try:
        r = json.loads(out)
        head = f"**Serge's plan for #{r['idea_id']}: {r['title']}**" + (f" (revision {r['revision']})" if r["revision"] else "")
        money = f"${r['one_off_usd']:.2f} one-off and ${r['monthly_usd']:.2f} a month"
        if r["status"] == "over_limit":
            atlas_says(f"{head} asks for {money}, which is over your limits even after he tried to cut it. "
                       "Open Ideas → Plans to read why, then ask for changes or reject it.")
        else:
            atlas_says(f"{head} is ready. Budget request: {money}.\n\n{r['summary'][:400]}\n\n"
                       "Open Ideas → Plans to approve it, ask for changes, or reject it. Nothing is bought: approving "
                       "only records that budget as this project's ceiling.")
    except (ValueError, KeyError, TypeError):
        atlas_says(out)


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

    def _send_file(self, path, ctype):
        """Serve a file, with Range support so the browser's video player can seek."""
        size = path.stat().st_size
        start, end, code = 0, size - 1, 200
        rng = self.headers.get("Range", "")
        if rng.startswith("bytes="):
            a, _, b = rng[6:].partition("-")
            start = int(a) if a else max(0, size - int(b))
            end = min(int(b), size - 1) if a and b else size - 1
            code = 206
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        if code == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        with open(path, "rb") as f:
            f.seek(start)
            left = end - start + 1
            while left > 0:
                chunk = f.read(min(1 << 16, left))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (ConnectionError, OSError):
                    return
                left -= len(chunk)

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
                "projects": cp.list_projects(20), "planning": agents.PLANNING.locked(),
                "episodes": with_upload_text(cp.list_episodes(limit=40)), "producing": agents.PRODUCING.locked(),
                "rendering": RENDERING["episode"],
                "lnd": cp.list_lnd_ideas(30), "lnd_status": lnd.STATUS,
                "production": {p["id"]: agents.production_summary(p["id"]) for p in cp.list_projects(20) if p["status"] == "approved"},
                "usage": cp.usage_today(), "allowance": getattr(settings, "SUBSCRIPTION_DAILY_VALUE_USD", {}),
                "engines": {a: workers.engine(a) for a in cp.WORKERS},
                "limits": cp.limits_view(),
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
        if u.path.startswith("/api/video/"):
            try:
                e = cp.get_episode(int(u.path.rsplit("/", 1)[1]))
            except ValueError:
                e = None
            path = ROOT / e["video_path"] if e and e["video_path"] else None
            if not path or not path.exists():
                return self._send(404, {"error": "no video"})
            return self._send_file(path, "video/mp4")
        if u.path.startswith("/api/episode/"):
            try:
                e = cp.get_episode(int(u.path.rsplit("/", 1)[1]))
            except ValueError:
                e = None
            if e and e["video_path"]:
                folder = (ROOT / e["video_path"]).parent
                e["upload"] = {k: (folder / f"{k}.txt").read_text(encoding="utf-8").strip() if (folder / f"{k}.txt").exists() else ""
                               for k in ("title", "description")}
                e["folder"] = str(folder)
            return self._send(200 if e else 404, e or {"error": "not found"})
        if u.path.startswith("/api/project/"):
            try:
                p = cp.get_project(int(u.path.rsplit("/", 1)[1]))
            except ValueError:
                p = None
            return self._send(200 if p else 404, p or {"error": "not found"})
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
            text, warning = clip(self._json_body().get("text", ""), "chat")
            if not text:
                return self._send(400, {"error": "empty"})
            with LOCK:
                if STATE["busy"]:
                    return self._send(409, {"error": "Atlas is still working on your last message."})
                STATE["busy"] = True
                CHAT.append({"from": "you", "ts": time.time(), "text": text})
            threading.Thread(target=run_chat, args=(text,), daemon=True).start()
            return self._send(202, accepted(warning))
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
                notes, warning = clip(self._json_body().get("notes", ""), "notes")
                threading.Thread(target=run_inbox_research, args=(idea_id, notes), daemon=True).start()
                return self._send(202, accepted(warning))
            if action == "dismiss":
                reason, _ = clip(self._json_body().get("reason", ""), "reason")
                return self._send(200, {"ok": True, "message": agents.dismiss_inbox_idea(idea_id, reason)})
            return self._send(404, {"error": "unknown action"})
        if u.path == "/api/pitch":
            body = self._json_body()
            idea, notes = str(body.get("idea", "")).strip(), str(body.get("notes", "")).strip()
            if not idea:
                return self._send(400, {"error": "No idea given."})
            if len(idea) > TEXT_LIMITS["idea"]:   # a long idea keeps a short title; the full text goes to Sage in the notes
                notes = f"The full idea: {idea}\n\n{notes}".strip()
                idea = idea[:TEXT_LIMITS["idea"]].rsplit(" ", 1)[0] + "…"
            notes, warning = clip(notes, "notes")
            if agents.PIPELINE.locked():
                return self._send(409, {"error": "The team is busy with another idea. Try again when it finishes."})
            threading.Thread(target=run_pitch, args=(idea, notes), daemon=True).start()
            return self._send(202, accepted(warning))
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
        if u.path.startswith("/api/plan/"):   # the owner asks Serge for a plan
            try:
                idea = cp.get_idea(int(u.path.rsplit("/", 1)[1]))
            except ValueError:
                idea = None
            if not idea:
                return self._send(404, {"error": "No such idea."})
            if (idea["verdict"] or {}).get("verdict") not in agents.PLANNABLE:
                return self._send(409, {"error": "Only ideas Vera approved can be planned."})
            existing = cp.project_for_idea(idea["id"])
            if existing and existing["status"] in ("planning", "awaiting_approval", "approved"):
                return self._send(409, {"error": f"This idea already has a plan ({existing['status'].replace('_', ' ')})."})
            if agents.PLANNING.locked():
                return self._send(409, {"error": "Serge is already working on a plan. Try again when it's done."})
            notes, warning = clip(self._json_body().get("notes", ""), "notes")
            threading.Thread(target=run_plan, args=(idea["id"], notes), daemon=True).start()
            return self._send(202, accepted(warning))
        if u.path.startswith("/api/project/"):   # the owner decides: approve | reject | changes
            parts = u.path.strip("/").split("/")
            try:
                pid, action = int(parts[2]), parts[3]
            except (IndexError, ValueError):
                return self._send(400, {"error": "bad request"})
            if action == "channel":   # the channel's name, handle and link, remembered on the project
                body = self._json_body()
                facts = {k: str(body.get(k, "")).strip()[:200] for k in ("name", "handle", "url") if str(body.get(k, "")).strip()}
                if not facts.get("name"):
                    return self._send(400, {"error": "Give at least the channel's name."})
                try:
                    meta = cp.set_project_meta(pid, channel=facts)
                except ValueError as e:
                    return self._send(404, {"error": str(e)})
                cp.log("Owner", "channel_set", None, {"project": pid, **facts})
                return self._send(200, {"ok": True, "message": f"Project {pid}'s channel: {cp.channel_line({'meta': meta})}"})
            if action == "changes" and agents.PLANNING.locked():
                return self._send(409, {"error": "Serge is busy with another plan. Try again when it's done."})
            msg = agents.decide_plan(pid, action, clip(self._json_body().get("note", ""), "note")[0])
            p = cp.get_project(pid, with_text=False)
            if msg == "changes_requested":
                threading.Thread(target=run_plan, args=(p["idea_id"],), daemon=True).start()
                return self._send(202, {"ok": True, "message": "Serge is revising the plan."})
            ok = p is not None and p["status"] in ("approved", "rejected")
            return self._send(200 if ok else 409, {"ok": ok, "message": msg} if ok else {"error": msg})
        if u.path.startswith("/api/content/"):   # api content <project id> batch|review
            parts = u.path.strip("/").split("/")
            try:
                pid, action = int(parts[2]), parts[3]
            except (IndexError, ValueError):
                return self._send(400, {"error": "bad request"})
            p = cp.get_project(pid, with_text=False)
            if not p or p["status"] != "approved":
                return self._send(409, {"error": "Calina only works on approved plans."})
            body = self._json_body()
            if action == "batch":
                if agents.PRODUCING.locked():
                    return self._send(409, {"error": "Calina is already writing a batch. Try again when it's done."})
                notes, warning = clip(body.get("notes", ""), "notes")
                threading.Thread(target=run_batch, args=(pid, body.get("count"), notes), daemon=True).start()
                return self._send(202, accepted(warning))
            if action == "review":
                stats, warning = clip(body.get("stats", ""), "notes")
                if not stats:
                    return self._send(400, {"error": "Paste the channel's stats first."})
                threading.Thread(target=run_review, args=(pid, stats), daemon=True).start()
                return self._send(202, accepted(warning))
            return self._send(404, {"error": "unknown action"})
        if u.path.startswith("/api/episode/"):   # api episode <id> approve|reject
            parts = u.path.strip("/").split("/")
            try:
                eid, action = int(parts[2]), parts[3]
            except (IndexError, ValueError):
                return self._send(400, {"error": "bad request"})
            if action == "folder":   # open the episode's clips folder in Explorer, for the owner to drop his OpenArt files
                e = cp.get_episode(eid)
                if not e:
                    return self._send(404, {"error": "No such episode."})
                folder = production.clips_folder(e)
                folder.mkdir(parents=True, exist_ok=True)
                try:
                    os.startfile(str(folder))   # Windows only
                except AttributeError:
                    pass
                return self._send(200, {"ok": True, "message": f"Opened {folder}"})
            if action == "log":
                body = self._json_body()
                try:
                    msg = agents.log_production(eid, body.get("credits"), body.get("minutes"), body.get("retakes"))
                except ValueError:
                    return self._send(400, {"error": "Credits, minutes and retakes must be numbers."})
                return self._send(200, {"ok": True, "message": msg})
            if action in ("render", "assemble"):
                e = cp.get_episode(eid)
                if not e or e["status"] not in ("approved", "rendered"):
                    return self._send(409, {"error": "Only an approved script can be made into a video."})
                if production.is_v2(e):
                    st = production.clip_status(e)
                    if not st["ready"]:
                        missing = [f"shot{i:02d}" for i in st["missing"]] + ([] if st["voice"] else ["voice.mp3"])
                        return self._send(409, {"error": "Still missing: " + ", ".join(missing) + f". Save them in {st['folder']}."})
                if RENDERING["lock"].locked():
                    return self._send(409, {"error": f"Calina is already making Short #{RENDERING['episode']}. Try again when it's done."})
                threading.Thread(target=run_render, args=(eid,), daemon=True).start()
                return self._send(202, {"ok": True, "message": "Calina is putting the Short together. It takes about 2-3 minutes."})
            if action == "published":
                msg = agents.mark_published(eid)
                ok = msg.startswith(f"Episode {eid} marked")
                return self._send(200 if ok else 409, {"ok": True, "message": msg} if ok else {"error": msg})
            msg = agents.decide_episode(eid, action, clip(self._json_body().get("note", ""), "note")[0])
            e = cp.get_episode(eid)
            ok = e is not None and e["status"] in ("approved", "rejected") and msg.startswith(f"Episode {eid} ")
            return self._send(200 if ok else 409, {"ok": True, "message": msg} if ok else {"error": msg})
        if u.path == "/api/lnd/sync":
            try:
                n = lnd.sync()
            except Exception as e:
                return self._send(502, {"error": f"Couldn't reach Richard's log on GitHub: {e}"})
            return self._send(200, {"ok": True, "message": f"{n} new idea(s) from Richard." if n else "No new ideas from Richard."})
        if u.path.startswith("/api/lnd/"):   # api lnd <idea id> yes|no
            parts = u.path.strip("/").split("/")
            if len(parts) != 4:
                return self._send(400, {"error": "bad request"})
            idea_id, decision = parts[2], parts[3]
            msg = lnd.decide(idea_id, decision, clip(self._json_body().get("reason", ""), "reason")[0])
            ok = msg.startswith(f"Idea {idea_id} ")
            if ok and decision == "yes":
                lnd_yes_to_atlas(idea_id)
            return self._send(200 if ok else 409, {"ok": True, "message": msg} if ok else {"error": msg})
        if u.path == "/api/limits":   # the owner in the office, or Atlas on the owner's word
            body = self._json_body()
            key, by = str(body.get("key", "")), ("Atlas" if body.get("by") == "Atlas" else "Owner")
            try:
                old, new = cp.set_limit(key, body.get("value"), by)
            except ValueError as e:
                return self._send(400, {"error": str(e)})
            fmt = lambda v: "no cap" if v is None else f"${v:.2f}" if isinstance(v, (int, float)) else str(v)
            return self._send(200, {"ok": True, "message": f"{cp.LIMITS[key][3]}: {fmt(old)} → {fmt(new)}"})
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


class Server(ThreadingHTTPServer):
    # The default lets a second office bind the same port on Windows; the old one then keeps answering with old code.
    allow_reuse_address = False
    daemon_threads = True


def stop_old_office(port):
    """Close an Agent HQ left running by an earlier START-HERE, so the freshly updated one takes over."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/state?since=999999999", timeout=3) as r:
            if "spend_today" not in json.loads(r.read()):
                return
    except Exception:
        return   # nothing there, or not ours
    if os.name != "nt":
        print(f"  Another Agent HQ is already running on port {port}. Close it first.", flush=True)
        return
    out = subprocess.run(["netstat", "-ano", "-p", "TCP"], capture_output=True, text=True).stdout
    pids = {int(line.split()[-1]) for line in out.splitlines()
            if f"127.0.0.1:{port} " in line and "LISTENING" in line and line.split()[-1].isdigit()}
    for pid in pids - {os.getpid()}:
        subprocess.run(["taskkill", "/PID", str(pid), "/F"], capture_output=True)
    if pids:
        print(f"  Closed {len(pids)} older copy(ies) of Agent HQ that were still running.", flush=True)
        print("  Their black windows now say they stopped; you can close them.\n", flush=True)
        time.sleep(1)


def main():
    prepare_atlas()
    port = int(os.environ.get("HQ_PORT", "8765"))
    stop_old_office(port)
    for p in range(port, port + 10):
        try:
            srv = Server(("127.0.0.1", p), Handler)
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
    if os.environ.get("HQ_NO_LND") != "1":
        threading.Thread(target=lnd_loop, daemon=True).start()
    if os.environ.get("HQ_NO_BROWSER") != "1":
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
