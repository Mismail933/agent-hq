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
import time
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).parent
REPO = "Mismail933/agent-hq"
BRANCH = "main"

# Never overwritten by an update: your key, your data, and the launcher itself
KEEP = {".env", "hq.db", "briefs", "plans", "content", ".installed", "START-HERE.bat", "STOP", "settings_local.py", ".atlas-cloud-skip", ".elevenlabs-skip",
        ".installed-commit", ".last-good-commit", ".hold-version", ".rolled-back", "START-HERE.command", ".rosetta-skip", ".gcm-skip", ".want-blackhole"}
MAC = sys.platform == "darwin"
PACK_NAME = "AgentHQ-for-Mac.zip"   # the company's data, carried from the PC to the Mac (2.38.0)
RESTART = 75   # the office exits with this code to be updated and started again (after the owner ships Ghassan's change)


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
    hold = ROOT / ".hold-version"
    if hold.exists() and hold.read_text().strip() == remote:
        say(f"Version {remote} didn't start last time, so it is skipped until a newer one is out (version {local_version()} stays).")
        return
    say(f"Updating Agent HQ: version {local_version()} -> {remote} ...")
    install_zip(f"https://github.com/{REPO}/archive/refs/heads/{BRANCH}.zip")


def install_zip(url):
    """Download a GitHub archive and copy its program files over these (data and private files are kept). GitHub writes the
    commit id in the zip's comment: it is remembered so the launcher knows which version is installed."""
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            data = r.read()
        zf = zipfile.ZipFile(io.BytesIO(data))
        commit = zf.comment.decode("ascii", "ignore").strip()
        if commit:
            (ROOT / ".installed-commit").write_text(commit + "\n")
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
    say("(Cmd+V to paste, then press Enter)" if MAC else "(right-click in this window to paste, then press Enter)")
    key = input("  API key: ").strip()
    if not key:
        say("No key entered. Run START-HERE again when you have one.")
        input("  Press Enter to close.")
        sys.exit(1)
    env.write_text(f"ANTHROPIC_API_KEY={key}\n")
    say("Key saved in the .env file on this computer only.")


def video_tools():
    """Mac (2.38.0): the video tools' own Python (~/.agent-hq-shorts: Kokoro, faster-whisper, ...), made and kept up to date from
    requirements-video.txt. On Windows it was set up by hand and is left alone."""
    if not MAC:
        return
    venv = Path.home() / ".agent-hq-shorts"
    py = venv / "bin" / "python"
    req = ROOT / "requirements-video.txt"
    if not req.exists():
        return
    digest = hashlib.sha256(req.read_bytes()).hexdigest()
    marker = venv / ".installed"
    if py.exists() and marker.exists() and marker.read_text().strip() == digest:
        return
    say("Installing the video tools (voices, word timings, pictures). The first time takes 5-10 minutes...")
    if not py.exists() and subprocess.call([sys.executable, "-m", "venv", str(venv)]) != 0:
        say("Couldn't make the video tools' Python. The office still runs; videos can't be made until this works.")
        return
    subprocess.call([str(py), "-m", "pip", "install", "--quiet", "--disable-pip-version-check", "--upgrade", "pip"])
    code = subprocess.call([str(py), "-m", "pip", "install", "--quiet", "--disable-pip-version-check", "-r", str(req)])
    if code != 0:
        say("Installing the video tools failed (the error is above). The office still runs; send the error to Claude.")
        return
    # Piper (two of the free sample voices) is optional: without it those samples are skipped
    if subprocess.call([str(py), "-m", "pip", "install", "--quiet", "--disable-pip-version-check", "piper-tts==1.8.0"]) != 0:
        say("(Piper voices aren't available on this Mac; the other voices work.)")
    marker.write_text(digest)
    say("Video tools installed.")


def _pack_items():
    """(path on this PC, name in the zip) for everything that is the company and not the program."""
    home = Path.home()
    items = [(ROOT / n, "program/" + n) for n in (".env", "briefs", "plans", "content", "settings_local.py",
                                                  ".atlas-cloud-skip", ".elevenlabs-skip", ".telegram-skip")]
    items.append((home / "Atlas-HQ", "atlas"))
    items.append((home / ".agent-hq" / "telegram.json", "home/.agent-hq/telegram.json"))
    return [(p, name) for p, name in items if p.exists()]


def pack():
    """PC side (PACK-FOR-MAC.bat): the company's data in one zip on the Desktop. The database is copied with SQLite's own
    backup, so it is consistent even while the office runs. Nothing is deleted or changed here."""
    import sqlite3
    import tempfile
    out = Path.home() / "Desktop" / PACK_NAME
    if not out.parent.exists():
        out = ROOT / PACK_NAME
    say(f"Packing Agent HQ's data for the Mac into {out} ...")
    stored = {".mp4", ".mp3", ".wav", ".m4a", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".zip", ".ogg"}   # already compressed
    tmp = Path(tempfile.gettempdir()) / "hq-pack.db"
    src = sqlite3.connect(ROOT / "hq.db")
    dst = sqlite3.connect(tmp)
    with dst:
        src.backup(dst)
    src.close()
    dst.close()
    n = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, allowZip64=True) as z:
        z.write(tmp, "program/hq.db")
        for path, name in _pack_items():
            files = [path] if path.is_file() else [f for f in path.rglob("*") if f.is_file()]
            for f in files:
                arc = name if f == path else name + "/" + f.relative_to(path).as_posix()
                if "/.git/" in arc or "__pycache__" in arc or arc == "atlas/.atlas-session":   # Atlas's chat lives on this PC's Claude Code
                    continue
                z.write(f, arc, zipfile.ZIP_STORED if f.suffix.lower() in stored else zipfile.ZIP_DEFLATED)
                n += 1
                if n % 500 == 0:
                    say(f"  {n} files...")
    tmp.unlink(missing_ok=True)
    say(f"Done: {n + 1} files, {out.stat().st_size / 1e9:.1f} GB.")
    say("It holds your keys (.env): copy it to the Mac yourself (USB drive, AirDrop or your own cloud drive), never share it.")
    say(f"On the Mac, put {PACK_NAME} in Downloads, then double-click START-HERE.command: it brings everything in.")


def unpack_if_found():
    """Mac side: a fresh install (no hq.db yet) with AgentHQ-for-Mac.zip in Downloads/Desktop brings the company in."""
    if (ROOT / "hq.db").exists():
        return
    home = Path.home()
    found = [p for p in (home / "Downloads" / PACK_NAME, home / "Desktop" / PACK_NAME, ROOT / PACK_NAME, ROOT.parent / PACK_NAME)
             if p.exists()]
    if not found:
        return
    pack_file = found[0]
    say(f"Found your company's data from the PC: {pack_file}")
    try:
        answer = input("  Press Enter to bring it in, or type N to start empty: ").strip().lower()
    except EOFError:
        return
    if answer.startswith("n"):
        return
    targets = {"program": ROOT, "atlas": home / "Atlas-HQ", "home": home}
    n = 0
    with zipfile.ZipFile(pack_file) as z:
        for info in z.infolist():
            top, _, rest = info.filename.partition("/")
            base = targets.get(top)
            if base is None or not rest or info.is_dir():
                continue
            dest = (base / rest).resolve()
            if base.resolve() not in dest.parents:   # never write outside the three places
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            with z.open(info) as src, open(dest, "wb") as out:
                shutil.copyfileobj(src, out)
            n += 1
            if n % 500 == 0:
                say(f"  {n} files...")
    for f in (ROOT / ".env", home / ".agent-hq" / "telegram.json"):
        if f.exists():
            f.chmod(0o600)   # keys: readable by this user only
    say(f"Brought in {n} files. You can delete {pack_file.name} now (it holds your keys).")
    say("Run the office on ONE computer at a time: the PC and the Mac don't share their data.")


def main():
    print()
    say("Agent HQ")
    say("--------")
    if "--pack" in sys.argv:
        pack()
        return
    if "--no-update" not in sys.argv:
        update()
    unpack_if_found()
    install()
    video_tools()
    ensure_key()
    say("")
    say("Opening the office in your browser. Keep this window open while you use it;")
    say("close it to stop everything.")
    print(flush=True)
    # run the freshly updated server in a new process so new code is used. Exit code 75 = update and start again;
    # a crash within 90 s of a new version = put the last good version back and start that.
    env = dict(os.environ, HQ_LAUNCHER_LOOP="1")
    while True:
        started = time.time()
        code = subprocess.call([sys.executable, str(ROOT / "server.py")], env=env)
        if code == RESTART:
            say("Restarting to load the new version...")
            update()
            install()
            video_tools()
            env["HQ_NO_BROWSER"] = "1"   # the office page is already open: it reconnects by itself
            continue
        if code != 0 and time.time() - started < 90 and roll_back():
            env["HQ_NO_BROWSER"] = "1"
            continue
        sys.exit(code)


def roll_back():
    """The new version stopped right after starting: install the last version that ran for a minute, and skip the broken one."""
    good = (ROOT / ".last-good-commit").read_text().strip() if (ROOT / ".last-good-commit").exists() else ""
    now = (ROOT / ".installed-commit").read_text().strip() if (ROOT / ".installed-commit").exists() else ""
    if not good or good == now:
        return False
    bad = local_version()
    say(f"Version {bad} stopped right after starting. Putting the last good version back...")
    install_zip(f"https://github.com/{REPO}/archive/{good}.zip")
    (ROOT / ".hold-version").write_text(bad + "\n")
    (ROOT / ".rolled-back").write_text(json.dumps({"bad_version": bad, "bad_commit": now, "good_commit": good}))
    return True


if __name__ == "__main__":
    main()
