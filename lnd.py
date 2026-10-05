"""
Richard's L&D inbox on this computer.

Richard runs every morning as a cloud agent (Anthropic's cloud, not this PC) and writes his ideas to the `lnd` branch
of the GitHub repo. This module keeps a local clone of that branch (~/.agent-hq/lnd), copies new ideas into hq.db for
the office's L&D tab, and pushes the owner's yes/no decisions back as feedback.json so Richard learns from them.
Git needs no setup to read (the repo is public); pushing uses the owner's normal git sign-in.
"""
import json
import subprocess
import threading
import time
from pathlib import Path

import control_plane as cp

REPO = "https://github.com/Mismail933/agent-hq.git"
BRANCH = "lnd"
CLONE = Path.home() / ".agent-hq" / "lnd"
LOCK = threading.Lock()
STATUS = {"last_sync": None, "error": None, "pending_push": False}
REPORT = {}   # Richard's latest day report (focus, research counts, what he checked, repo watch)


def _git(*args, cwd=None, timeout=120):
    p = subprocess.run(["git", *args], cwd=cwd or CLONE, capture_output=True, text=True, encoding="utf-8", errors="replace",
                       timeout=timeout, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if p.returncode != 0:
        raise RuntimeError((p.stderr or p.stdout).strip()[-300:] or f"git {args[0]} failed")
    return p.stdout


def _ensure_clone():
    if (CLONE / ".git").exists():
        return
    CLONE.parent.mkdir(parents=True, exist_ok=True)
    _git("clone", "--quiet", "--branch", BRANCH, "--single-branch", REPO, str(CLONE), cwd=CLONE.parent)


def sync():
    """Pull Richard's latest ideas into hq.db, then push any pending decisions. Returns how many ideas were new."""
    with LOCK:
        try:
            _ensure_clone()
            _git("pull", "--quiet", "--rebase", "--autostash")
            new = 0
            for f in sorted((CLONE / "ideas").glob("20*.json")):
                try:
                    day = json.loads(f.read_text(encoding="utf-8"))
                except ValueError:
                    continue
                for idea in day.get("ideas") or []:
                    if idea.get("id") and cp.add_lnd_idea(idea, day.get("date", f.stem), day.get("note", "")):
                        new += 1
            _load_report()
            if new:
                cp.log("Richard", "lnd_ideas_arrived", None, {"count": new})
            if STATUS["pending_push"]:
                _push_feedback()
            STATUS.update(last_sync=time.time(), error=None)
            return new
        except Exception as e:
            STATUS["error"] = str(e)[:300]
            raise


def _load_report():
    try:
        day = json.loads((CLONE / "ideas" / "latest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return
    keep = ("date", "focus", "focus_set_at", "note", "research", "new_today", "checked", "repo_watch")
    REPORT.clear()
    REPORT.update({k: day[k] for k in keep if k in day})
    REPORT["idea_count"] = len(day.get("ideas") or [])


def _push_feedback():
    decided = [{"id": i["id"], "decision": "yes" if i["status"] == "approved" else "no", "reason": i["reason"] or "",
                "ts": i["decided_ts"]} for i in cp.list_lnd_ideas(limit=1000) if i["status"] in ("approved", "declined")]
    (CLONE / "feedback.json").write_text(json.dumps(decided, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if not _git("status", "--porcelain", "feedback.json").strip():
        STATUS["pending_push"] = False
        return
    _git("add", "feedback.json")
    _git("commit", "--quiet", "-m", "Owner's decisions on Richard's ideas")
    try:
        _git("push", "--quiet", "origin", BRANCH)
    except RuntimeError:
        _git("pull", "--quiet", "--rebase")
        _git("push", "--quiet", "origin", BRANCH)
    STATUS["pending_push"] = False


def set_focus(topic):
    """A topic for Richard's next morning run (Atlas, when the owner asks). It goes to the lnd branch as focus.json, which
    Richard reads first. The next report carries it in its `focus`, so the L&D tab shows it was picked up."""
    topic = (topic or "").strip()
    if not topic:
        return "Give the topic, e.g. hq lnd-focus \"how can we make Calina a better writer?\""
    topic = topic[:1500]
    with LOCK:
        try:
            _ensure_clone()
            _git("pull", "--quiet", "--rebase", "--autostash")
            stamp = time.strftime("%Y-%m-%dT%H:%M:%S%z")
            (CLONE / "focus.json").write_text(json.dumps({"topic": topic, "set_at": stamp, "set_by": "owner via Atlas"}, indent=2,
                                                         ensure_ascii=False) + "\n", encoding="utf-8")
            _git("add", "focus.json")
            _git("commit", "--quiet", "-m", "Owner's focus topic for Richard")
            try:
                _git("push", "--quiet", "origin", BRANCH)
            except RuntimeError:
                _git("pull", "--quiet", "--rebase")
                _git("push", "--quiet", "origin", BRANCH)
        except Exception as e:
            return f"Couldn't hand Richard the topic: {str(e)[:200]}"
    cp.log("Atlas", "lnd_focus_set", None, {"topic": topic})
    return f"Richard will research this on his next run (07:00 Beirut in summer): {topic}"


def decide(idea_id, decision, reason=""):
    """The owner's yes/no. It is saved at once; the push to GitHub happens in the background."""
    msg = cp.decide_lnd_idea(idea_id, decision, reason)
    if msg.startswith("Idea"):
        STATUS["pending_push"] = True
        threading.Thread(target=_safe_sync, daemon=True).start()
    return msg


def _safe_sync():
    try:
        sync()
    except Exception as e:
        print("L&D sync:", e, flush=True)
