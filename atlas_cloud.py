"""
Atlas in the cloud: the stand-in when his Claude Code on this computer can't answer (plan limit reached, signed out).

It works like Richard's cloud routine, with a private GitHub repo as the mailbox (the company repo is public, so nothing
about the company ever goes there):
  1. The office writes a fresh snapshot of the company (status, inbox, spend, plans, briefs, his journal) and the owner's
     message into the private repo, and pushes it.
  2. It starts Atlas's cloud routine through the routine's API trigger (URL + token in .env, kept on this computer only).
  3. The routine (a full Claude Code session on Sonnet in Anthropic's cloud, rules in atlas/CLOUD.md) reads the snapshot,
     answers, and pushes outbox/<id>.json: his reply, the actions he wants, and journal notes.
  4. The office shows the reply and runs the actions itself through `hq.py`, so the same guardrails apply.
"""
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

import atlas_engine
import settings

ROOT = Path(__file__).parent
CLONE = Path.home() / ".agent-hq" / "atlas-cloud"
LOCK = threading.Lock()
STATUS = {"last_ok": None, "error": None, "session_url": None}

# Commands the cloud Atlas may order. Reading commands are not here: he reads the snapshot instead.
ACTIONS = {"research", "dismiss", "pitch", "scout", "retry", "plan", "approve", "reject", "changes", "batch",
           "approve-episode", "reject-episode", "review", "render", "assemble", "published", "channel", "voice",
           "voice-samples", "prodlog", "lnd-sync", "lnd-yes", "lnd-no", "limit", "stop", "resume"}
SNAPSHOT_CMDS = {"status": ["status"], "inbox": ["inbox"], "spend": ["spend"], "activity": ["activity", "40"],
                 "plans": ["plans"], "episodes": ["episodes"], "lnd": ["lnd"], "limits": ["limits"]}


class CloudUnavailable(Exception):
    """Cloud Atlas can't answer right now; the message says why."""


def _repo():
    return os.environ.get("HQ_ATLAS_CLOUD_REPO") or os.environ.get("ATLAS_CLOUD_REPO") or getattr(settings, "ATLAS_CLOUD_REPO", "")


def _fire_url():
    return os.environ.get("ATLAS_CLOUD_URL", "")


def configured():
    if not getattr(settings, "ATLAS_CLOUD", True):
        return False
    if os.environ.get("HQ_ATLAS_CLOUD_FAKE") == "1":
        return bool(_repo())
    return bool(_repo() and _fire_url() and os.environ.get("ATLAS_CLOUD_TOKEN"))


def _git(*args, timeout=120):
    p = subprocess.run(["git", *args], cwd=CLONE, capture_output=True, text=True, encoding="utf-8", errors="replace",
                       timeout=timeout, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if p.returncode != 0:
        raise CloudUnavailable((p.stderr or p.stdout).strip()[-300:] or f"git {args[0]} failed")
    return p.stdout


def _ensure_clone():
    if not (CLONE / ".git").exists():
        CLONE.parent.mkdir(parents=True, exist_ok=True)
        p = subprocess.run(["git", "clone", "--quiet", _repo(), str(CLONE)], capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=180,
                           creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        if p.returncode != 0:
            raise CloudUnavailable("Couldn't reach the private Atlas repo: " + (p.stderr or p.stdout).strip()[-200:])
    for k, v in (("user.name", "Agent HQ"), ("user.email", "agent-hq@users.noreply.github.com")):
        _git("config", k, v)
    try:
        _git("pull", "--quiet", "--rebase", "--autostash")
    except CloudUnavailable:
        pass    # a brand-new empty repo has nothing to pull yet


def _run_hq(args, timeout=60):
    p = subprocess.run([sys.executable, str(ROOT / "hq.py"), *args], cwd=ROOT, capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=timeout,
                       creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    return (p.stdout or p.stderr or "").strip()


def _copy_notes(dst):
    (dst / "journal").mkdir(parents=True, exist_ok=True)
    for name in atlas_engine.STARTERS:
        f = atlas_engine.HOME / name
        if f.exists():
            shutil.copy2(f, dst / "journal" / name)
    for folder, keep in (("briefs", 15), ("plans", 20)):
        src = ROOT / folder
        if src.exists():
            (dst / folder).mkdir(exist_ok=True)
            files = sorted(src.glob("*.md"), key=lambda f: f.stat().st_mtime, reverse=True)[:keep]
            for f in files:
                if f.stat().st_size < 200_000:
                    shutil.copy2(f, dst / folder / f.name)


def _write_snapshot():
    snap = CLONE / "snapshot"
    shutil.rmtree(snap, ignore_errors=True)
    snap.mkdir(parents=True)
    for name, args in SNAPSHOT_CMDS.items():
        try:
            (snap / f"{name}.txt").write_text(_run_hq(args), encoding="utf-8")
        except Exception as e:
            (snap / f"{name}.txt").write_text(f"(couldn't read: {e})", encoding="utf-8")
    (snap / "taken-at.txt").write_text(time.strftime("%Y-%m-%d %H:%M:%S %z"), encoding="utf-8")
    shutil.rmtree(CLONE / "briefs", ignore_errors=True)
    shutil.rmtree(CLONE / "plans", ignore_errors=True)
    _copy_notes(CLONE)
    role = (ROOT / "atlas" / "CLAUDE.md").read_text(encoding="utf-8")
    (CLONE / "ROLE.md").write_text(role, encoding="utf-8")
    (CLONE / "CLOUD.md").write_text((ROOT / "atlas" / "CLOUD.md").read_text(encoding="utf-8"), encoding="utf-8")


def _conversation_path():
    return CLONE / "conversation.md"


def _trim_conversation(keep=24):
    f = _conversation_path()
    if not f.exists():
        return
    parts = f.read_text(encoding="utf-8").split("\n\n### ")
    if len(parts) > keep + 1:
        f.write_text("\n\n### ".join([parts[0]] + parts[-keep:]), encoding="utf-8")


def _commit_push(msg):
    _git("add", "-A")
    if not _git("status", "--porcelain").strip():
        return
    _git("commit", "--quiet", "-m", msg)
    try:
        _git("push", "--quiet", "origin", "HEAD")
    except CloudUnavailable:
        _git("pull", "--quiet", "--rebase")
        _git("push", "--quiet", "origin", "HEAD")


def _fire(msg_id):
    if os.environ.get("HQ_ATLAS_CLOUD_FAKE") == "1":
        threading.Thread(target=_fake_routine, args=(msg_id,), daemon=True).start()
        return "fake"
    body = json.dumps({"text": json.dumps({"id": msg_id})}).encode()
    req = urllib.request.Request(_fire_url(), data=body, method="POST", headers={
        "Authorization": "Bearer " + os.environ["ATLAS_CLOUD_TOKEN"], "anthropic-beta": "experimental-cc-routine-2026-04-01",
        "anthropic-version": "2023-06-01", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read() or b"{}").get("claude_code_session_url") or ""
    except urllib.error.HTTPError as e:
        why = {401: "the token was rejected (make a new one in claude.ai/code/routines)", 429: "too many runs this hour"}.get(
            e.code, f"HTTP {e.code}")
        raise CloudUnavailable(f"Couldn't start cloud Atlas: {why}.")
    except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
        raise CloudUnavailable(f"Couldn't reach Claude's cloud: {e}")


def _fake_routine(msg_id):
    """Practice mode only: stands in for the cloud routine so the whole path can be tested for free."""
    time.sleep(2)
    msg = json.loads((CLONE / "inbox" / f"{msg_id}.json").read_text(encoding="utf-8"))["message"]
    out = {"reply": f"(practice cloud Atlas) I read the snapshot and your message: {msg[:80]}", "actions": [],
           "journal_append": "", "requests_append": ""}
    if "scout" in msg.lower():
        out["actions"] = ["scout"]
    outbox = CLONE / "outbox"
    outbox.mkdir(exist_ok=True)
    (outbox / f"{msg_id}.json").write_text(json.dumps(out), encoding="utf-8")
    _commit_push("practice reply")


def _wait_for_reply(msg_id):
    path = CLONE / "outbox" / f"{msg_id}.json"
    deadline = time.time() + getattr(settings, "ATLAS_CLOUD_TIMEOUT_SECONDS", 600)
    time.sleep(5)
    while time.time() < deadline:
        try:
            _git("pull", "--quiet", "--rebase", "--autostash")
        except CloudUnavailable:
            pass
        if path.exists():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except ValueError:
                pass    # still being written
        time.sleep(8)
    raise CloudUnavailable("Cloud Atlas didn't answer in time. His reply may still arrive; check the Claude app's session list.")


def _append(path, text):
    if text and text.strip():
        with open(path, "a", encoding="utf-8") as f:
            f.write("\n" + text.strip() + "\n")


def _apply(out):
    """Run the actions cloud Atlas asked for, through hq.py (same guardrails). Returns lines to show the owner."""
    done = []
    for raw in (out.get("actions") or [])[:8]:
        try:
            args = shlex.split(str(raw))
        except ValueError:
            continue
        if not args or args[0].lower() not in ACTIONS:
            done.append(f"- Skipped `{raw}` (not an allowed action).")
            continue
        try:
            result = _run_hq(args)
        except Exception as e:
            result = f"failed: {e}"
        done.append(f"- `{raw}` → {result[:300]}")
    atlas_engine.setup()
    _append(atlas_engine.HOME / "atlas-journal.md", out.get("journal_append"))
    _append(atlas_engine.HOME / "requests-for-builder.md", out.get("requests_append"))
    return done


def ask(prompt, why=""):
    """Send one message to the cloud Atlas. Returns (reply, info). Raises CloudUnavailable."""
    if not configured():
        raise CloudUnavailable("Cloud Atlas isn't set up yet.")
    with LOCK:
        t0 = time.time()
        msg_id = time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:4]
        try:
            _ensure_clone()
            _write_snapshot()
            (CLONE / "inbox").mkdir(exist_ok=True)
            (CLONE / "inbox" / f"{msg_id}.json").write_text(
                json.dumps({"id": msg_id, "ts": time.time(), "message": prompt, "why_cloud": why}, ensure_ascii=False, indent=1),
                encoding="utf-8")
            _commit_push(f"Message {msg_id}")
            url = _fire(msg_id)
            STATUS["session_url"] = url
            out = _wait_for_reply(msg_id)
        except CloudUnavailable as e:
            STATUS["error"] = str(e)
            raise
        except subprocess.TimeoutExpired:
            STATUS["error"] = "GitHub took too long."
            raise CloudUnavailable("GitHub took too long to answer.")
        reply = (out.get("reply") or "").strip()
        done = _apply(out)
        if done:
            reply += "\n\n**Done just now**\n" + "\n".join(done)
        with open(_conversation_path(), "a", encoding="utf-8") as f:
            f.write(f"\n\n### {time.strftime('%Y-%m-%d %H:%M')}\nOwner: {prompt}\n\nAtlas: {out.get('reply', '')}\n")
        _trim_conversation()
        try:
            _commit_push(f"Reply {msg_id} applied")
        except CloudUnavailable:
            pass
        STATUS.update(last_ok=time.time(), error=None)
        return reply, {"engine": "cloud", "secs": round(time.time() - t0, 1), "session": url, "actions": len(done)}


def save_setup(url, token):
    """Keep the routine's URL and token in the .env on this computer, never in the repo."""
    env = ROOT / ".env"
    lines = [l for l in (env.read_text(encoding="utf-8").splitlines() if env.exists() else [])
             if not l.startswith(("ATLAS_CLOUD_URL=", "ATLAS_CLOUD_TOKEN="))]
    lines += [f"ATLAS_CLOUD_URL={url}", f"ATLAS_CLOUD_TOKEN={token}"]
    env.write_text("\n".join(lines) + "\n", encoding="utf-8")
    os.environ["ATLAS_CLOUD_URL"], os.environ["ATLAS_CLOUD_TOKEN"] = url, token


def offer_setup():
    """At startup, in the START-HERE window, once: the two values cloud Atlas needs. Enter skips; it won't ask again."""
    skip = ROOT / ".atlas-cloud-skip"
    if configured() or not _repo() or skip.exists():
        return
    print("  Cloud Atlas takes over when your Claude plan limit is reached. It needs the routine's URL and token")
    print("  (claude.ai/code/routines -> Atlas -> API trigger). They stay in the .env file on this computer.")
    try:
        url = input("  Paste the routine URL (or press Enter to skip): ").strip()
        if not url:
            skip.write_text("skipped", encoding="utf-8")
            print("  Skipped. The backup Atlas answers on the API key at those times.\n", flush=True)
            return
        token = input("  Paste the token: ").strip()
    except EOFError:
        return
    if url and token:
        save_setup(url, token)
        print("  Saved. Cloud Atlas is ready.\n", flush=True)


def limit_note(msg):
    """Short plain text for the chat banner: 'Claude plan limit reached (resets 2:20pm (Asia/Beirut))'."""
    m = re.search(r"resets?\s+\d{1,2}(?::\d\d)?\s*(?:am|pm)?\s*(?:\([^)]+\))?", msg, re.I)
    return "Claude plan limit reached" + (f" ({m.group(0)})" if m else "")


def limit_reset(msg):
    """When the Claude plan limit in an error message ends, as a timestamp, or None if it isn't a limit message."""
    if not re.search(r"(session|usage|rate|plan) limit|limit reached|hit your limit|resets\s+\d", msg, re.I):
        return None
    m = re.search(r"resets?\s+(\d{1,2})(?::(\d\d))?\s*(am|pm)?\s*(?:\(([^)]+)\))?", msg, re.I)
    if m:
        try:
            from datetime import datetime, timedelta
            from zoneinfo import ZoneInfo
            h, mi, ap, tz = int(m.group(1)), int(m.group(2) or 0), (m.group(3) or "").lower(), m.group(4)
            if ap == "pm" and h < 12:
                h += 12
            if ap == "am" and h == 12:
                h = 0
            now = datetime.now(ZoneInfo(tz)) if tz else datetime.now().astimezone()
            at = now.replace(hour=h % 24, minute=mi, second=0, microsecond=0)
            if at <= now:
                at += timedelta(days=1)
            return at.timestamp()
        except Exception:
            pass
    return time.time() + 1800
