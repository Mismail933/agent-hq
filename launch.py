"""
Agent HQ launcher: update, install, ask for the key once, start the office.

START-HERE.bat runs this. It:
  1. checks GitHub for a newer version and updates the program files
     (never touches your key, your data, or your own settings in settings_local.py)
  2. installs the Anthropic library if needed
  3. asks for your API key the first time
  4. starts the office in your browser
"""
import hashlib
import io
import json
import os
import shutil
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).parent
REPO = "Mismail933/agent-hq"
BRANCH = "main"

# Never overwritten by an update: your key, your data, and the launcher itself
KEEP = {".env", "hq.db", "briefs", "plans", "content", ".installed", "START-HERE.bat", "STOP", "settings_local.py", ".atlas-cloud-skip", ".elevenlabs-skip"}


def say(msg=""):
    print("  " + msg, flush=True)


def local_version():
    p = ROOT / "VERSION"
    return p.read_text().strip() if p.exists() else "0"


def remote_version():
    """GitHub's API answers with the newest VERSION; raw.githubusercontent.com can serve an old one for minutes."""
    try:
        api = f"https://api.github.com/repos/{REPO}/contents/VERSION?ref={BRANCH}"
        req = urllib.request.Request(api, headers={"Accept": "application/vnd.github.raw", "User-Agent": "agent-hq-launcher"})
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.read().decode().strip()
    except Exception:   # API limit reached or unreachable: fall back to the raw file
        with urllib.request.urlopen(f"https://raw.githubusercontent.com/{REPO}/{BRANCH}/VERSION", timeout=8) as r:
            return r.read().decode().strip()


def update():
    try:
        remote = remote_version()
    except Exception:
        say("Couldn't check for updates (offline, or the GitHub repo isn't set up yet). Using this version.")
        return
    if remote == local_version():
        say(f"Agent HQ is up to date (version {remote}).")
        return
    say(f"Updating Agent HQ: version {local_version()} -> {remote} ...")
    try:
        with urllib.request.urlopen(f"https://github.com/{REPO}/archive/refs/heads/{BRANCH}.zip", timeout=60) as r:
            data = r.read()
        zf = zipfile.ZipFile(io.BytesIO(data))
        prefix = zf.namelist()[0].split("/")[0] + "/"
        for name in zf.namelist():
            rel = name[len(prefix):]
            if not rel or rel.split("/")[0] in KEEP:
                continue
            dest = ROOT / rel
            if name.endswith("/"):
                dest.mkdir(parents=True, exist_ok=True)
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(name) as src, open(dest, "wb") as out:
                shutil.copyfileobj(src, out)
        say("Updated.")
    except Exception as e:
        say(f"Update failed ({type(e).__name__}). Using the current version.")


def install():
    req = (ROOT / "requirements.txt").read_bytes()
    digest = hashlib.sha256(req).hexdigest()
    marker = ROOT / ".installed"
    if marker.exists() and marker.read_text().strip() == digest:
        return
    say("Installing the libraries the agents need (first run or after an update)...")
    code = subprocess.call([sys.executable, "-m", "pip", "install", "--quiet", "--disable-pip-version-check", "-r",
                            str(ROOT / "requirements.txt")])
    if code != 0:
        say("Install failed. Copy the error above and send it to Claude.")
        input("  Press Enter to close.")
        sys.exit(1)
    marker.write_text(digest)


def ensure_key():
    env = ROOT / ".env"
    if env.exists() and "ANTHROPIC_API_KEY=" in env.read_text():
        return
    say("Paste your Anthropic API key from https://console.anthropic.com/settings/keys")
    say("(right-click in this window to paste, then press Enter)")
    key = input("  API key: ").strip()
    if not key:
        say("No key entered. Run START-HERE again when you have one.")
        input("  Press Enter to close.")
        sys.exit(1)
    env.write_text(f"ANTHROPIC_API_KEY={key}\n")
    say("Key saved in the .env file on this computer only.")


def main():
    print()
    say("Agent HQ")
    say("--------")
    if "--no-update" not in sys.argv:
        update()
    install()
    ensure_key()
    say("")
    say("Opening the office in your browser. Keep this window open while you use it;")
    say("close it to stop everything.")
    print(flush=True)
    # run the freshly updated server in a new process so new code is used
    sys.exit(subprocess.call([sys.executable, str(ROOT / "server.py")]))


if __name__ == "__main__":
    main()
