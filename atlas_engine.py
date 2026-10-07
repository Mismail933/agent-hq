"""
Atlas through Claude Code.

The office chat box talks to Claude Code running in the owner's Atlas-HQ folder, so Atlas is the full Claude, on the
owner's Claude subscription (never the API key). Atlas's role and rules are atlas/CLAUDE.md, copied into that folder
on every start together with his controls (hq.py) and his permissions. If Claude Code is not available, server.py
falls back to the small in-app Atlas from agents.py.
"""
import json
import os
import re
import shutil
import subprocess
import time
from pathlib import Path

import settings

ROOT = Path(__file__).parent
HOME = Path(os.environ.get("HQ_ATLAS_HOME") or Path.home() / "Atlas-HQ")
SESSION_FILE = HOME / ".atlas-session"

SHIM = '''# Atlas's controls. Agent HQ rewrites this file on every start, so edits here are lost.
import runpy
import sys

sys.argv[0] = "hq.py"
runpy.run_path({path!r}, run_name="__main__")
'''

STARTERS = {
    "atlas-journal.md": "# Atlas journal\n\nDecisions, preferences and important events. Newest at the bottom. Keep it short.\n",
    "requests-for-builder.md": "# Requests for the Builder\n\nAtlas adds work that needs code here. The Builder chat picks it up and marks it done.\n"
                               "Format: `## [open] YYYY-MM-DD: title`, then what the owner wants and why.\n",
}


class Unavailable(Exception):
    """Claude Code can't answer right now; the message says why."""


def engine():
    return os.environ.get("HQ_ATLAS_ENGINE") or ("api" if os.environ.get("HQ_SIMULATE") == "1"
                                                  else getattr(settings, "ATLAS_ENGINE", "claude_code"))


def _rule_path(p):
    """C:\\Users\\x -> //c/Users/x, the form Claude Code permission rules use for absolute paths."""
    s = str(Path(p).resolve()).replace("\\", "/")
    if re.match(r"^[A-Za-z]:", s):
        s = "/" + s[0].lower() + s[2:]
    return "/" + s


ALLOW = ["Bash(python hq.py)", "Bash(python hq.py *)", "Read", "WebFetch", "WebSearch",   # 2.20.1: Atlas may look at links (as data)
         "Edit(./atlas-journal.md)", "Edit(./requests-for-builder.md)"]


def deny():
    return ["Bash(git *)", "Bash(rm *)", "Bash(del *)", "Bash(curl *)", "Bash(yt-dlp *)",
            f"Edit({_rule_path(ROOT)}/**)", "Edit(./CLAUDE.md)", "Edit(./hq.py)", "Edit(./.claude/**)"]


def _write(path, text):
    if not path.exists() or path.read_text(encoding="utf-8") != text:
        path.write_text(text, encoding="utf-8")


def setup():
    """Create or refresh the Atlas-HQ folder. Program-owned files are rewritten; Atlas's own notes are never touched."""
    HOME.mkdir(parents=True, exist_ok=True)
    role = (ROOT / "atlas" / "CLAUDE.md").read_text(encoding="utf-8")
    role += (f"\n## Where things are on this computer\n"
             f"- The company program and its data (read only for you): `{ROOT}`\n"
             f"- Sage's briefs: `{ROOT / 'briefs'}`\n"
             f"- Settings: `{ROOT / 'settings.py'}`, overridden by `{ROOT / 'settings_local.py'}` if it exists\n")
    _write(HOME / "CLAUDE.md", role)
    _write(HOME / "hq.py", SHIM.format(path=str(ROOT / "hq.py")))
    # For the Atlas chat in the Claude app. The office passes the same rules on the command line (see _run),
    # because Claude Code ignores a folder's allow rules until someone accepts its trust dialog.
    perms = {"permissions": {"allow": ALLOW, "deny": deny(), "additionalDirectories": [str(ROOT)]}}
    (HOME / ".claude").mkdir(exist_ok=True)
    _write(HOME / ".claude" / "settings.json", json.dumps(perms, indent=2) + "\n")
    for name, text in STARTERS.items():
        if not (HOME / name).exists():
            (HOME / name).write_text(text, encoding="utf-8")


def find_claude():
    """The Claude Code program: a configured path, the `claude` command, or the copy that ships with the Claude app."""
    p = os.environ.get("HQ_CLAUDE_PATH") or getattr(settings, "ATLAS_CLAUDE_PATH", None)
    if p and Path(p).exists():
        return str(p)
    found = shutil.which("claude")
    if found:
        return found
    cands = list(Path.home().glob(".local/bin/claude.exe"))

    def ver(exe):
        return tuple(int(x) for x in re.findall(r"\d+", exe.parent.parent.name)[:3])
    # The Claude desktop app ships Claude Code. The Microsoft Store version keeps its AppData in a package folder
    # that programs outside the app (like START-HERE) can only reach by its real path.
    bundled = list((Path(os.environ.get("APPDATA", "")) / "Claude" / "claude-code").glob("*/*/claude.exe"))
    bundled += Path(os.environ.get("LOCALAPPDATA", "")).glob(
        "Packages/Claude_*/LocalCache/Roaming/Claude/claude-code/*/*/claude.exe")
    cands += sorted(bundled, key=ver, reverse=True)
    return str(cands[0]) if cands else None


def _env():
    # Atlas must run on the Claude subscription, never on the company's API key.
    return {k: v for k, v in os.environ.items() if k not in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")}


def logged_in(exe):
    try:
        p = subprocess.run([exe, "auth", "status", "--json"], env=_env(), capture_output=True, text=True, timeout=60,
                           creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        return bool(json.loads(p.stdout).get("loggedIn"))
    except Exception:
        return False


def offer_login(exe):
    """At startup, in the START-HERE window: Claude Code needs one sign-in to the owner's Claude account."""
    print("  Atlas runs on your Claude subscription and needs a one-time sign-in to your Claude account.")
    try:
        answer = input("  Press Enter to open the sign-in page in your browser, or type S to skip for now: ").strip().lower()
    except EOFError:
        return
    if answer.startswith("s"):
        print("  Skipped. The backup Atlas will answer until you sign in.\n", flush=True)
        return
    subprocess.call([exe, "auth", "login", "--claudeai"], env=_env())
    print("  Signed in. Atlas is ready.\n" if logged_in(exe) else "  Not signed in. The backup Atlas will answer for now.\n",
          flush=True)


def _run(exe, prompt, model, resume):
    cmd = [exe, "-p", "--output-format", "json", "--max-turns", str(getattr(settings, "ATLAS_MAX_TURNS", 20)),
           "--add-dir", str(ROOT), "--allowedTools", *ALLOW, "--disallowedTools", *deny()]
    if model:
        cmd += ["--model", model]
    if resume:
        cmd += ["--resume", resume]
    try:
        p = subprocess.run(cmd, input=prompt, cwd=HOME, env=_env(), capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=getattr(settings, "ATLAS_TIMEOUT_SECONDS", 300),
                           creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    except subprocess.TimeoutExpired:
        raise Unavailable("Claude Code took too long to answer.")
    try:
        out = json.loads(p.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        raise Unavailable((p.stderr or p.stdout or f"Claude Code exited with code {p.returncode}").strip()[:300])
    if out.get("is_error") or out.get("subtype") != "success":
        msg = str(out.get("result") or out.get("subtype") or "unknown error")[:300]
        if "login" in msg.lower() or "logged in" in msg.lower():
            msg = "Atlas isn't signed in to your Claude account yet. Close the black window, double-click START-HERE and sign in when it asks."
        raise Unavailable(msg)
    return out


def ask(prompt):
    """Send one message to Atlas and return (reply, details). Raises Unavailable when Claude Code can't answer."""
    exe = find_claude()
    if not exe:
        raise Unavailable("Claude Code isn't installed on this computer.")
    setup()
    model = getattr(settings, "ATLAS_CLAUDE_MODEL", "opus")
    resume = SESSION_FILE.read_text().strip() if SESSION_FILE.exists() else None
    t0 = time.time()
    try:
        out = _run(exe, prompt, model, resume)
    except Unavailable as e:
        msg = str(e).lower()
        if re.search(r"limit|resets?\s+\d|usage|quota|overloaded", msg):
            raise                                      # plan limit: the conversation is fine, the caller switches to the cloud
        if resume and ("session" in msg or "conversation" in msg):
            SESSION_FILE.unlink(missing_ok=True)       # the old conversation is gone: start a new one
            out = _run(exe, prompt, model, None)
        elif model and "model" in msg:
            out = _run(exe, prompt, None, resume)      # that model isn't on this plan: use the default
        else:
            raise
    if out.get("session_id"):
        SESSION_FILE.write_text(out["session_id"])
    info = {"engine": "claude_code", "turns": out.get("num_turns"), "secs": round(time.time() - t0, 1)}
    blocked = [d.get("tool_name") for d in out.get("permission_denials") or [] if isinstance(d, dict)]
    if blocked:
        info["blocked_tools"] = blocked
    return (out.get("result") or "").strip(), info


def new_conversation():
    """Forget the current Atlas conversation; his journal keeps what matters."""
    SESSION_FILE.unlink(missing_ok=True)
