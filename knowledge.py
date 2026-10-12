"""
Knowledge pack (2.40.0, the owner: the PC and the Mac each run their own office; "I need especially the files and what I told him
about the new project regarding the video clip").

PC:  SEND-KNOWLEDGE-TO-MAC.bat  (= launch.py --knowledge) -> Desktop/AgentHQ-knowledge.zip, a few dozen MB. The owner puts it on
     his Drive and downloads it on the Mac.
Mac: the next START-HERE finds AgentHQ-knowledge*.zip in Downloads/Desktop (newest; a pack is loaded once, by its id) and asks
     before loading it.

In the pack: the company's memory, not its keys.
- program/hq.db: a consistent copy (SQLite backup) of the database: ideas, plans, projects and their settings (voices, cast,
  music, the client projects), episodes, Israa's reviews, the team rules and their history, limits, events. Jobs that were
  running or queued on the PC are marked given up in the copy (their files stay on the PC).
- program/briefs, plans, settings_local.py, and content/ without the heavy, re-makeable files (videos, voice caches, review
  frames). Kept: every drawing, style frame, cast file, asset, script, the sound-effect kit, voice samples, and everything of
  client projects (their song).
- atlas/: Atlas's journal, his requests to the Builder, Richard's approved list, review/uploads + review/refs (the images and the
  song the owner gave him) and from-the-pc/atlas-conversation.md: every conversation the owner had with Atlas on the PC, as text.
- claude-memory/: Atlas's own Claude Code memory notes.
Never in it: .env (keys), the phone pairing, Atlas's live session, Ghassan's clone, the PC's run files.

Loading replaces the Mac's own database (kept as hq.db.before-knowledge-<time>) and starts Atlas in a fresh chat that is told to
read the journal and the conversation first.
"""
import json
import re
import shutil
import sqlite3
import tempfile
import time
import zipfile
from pathlib import Path

NAME = "AgentHQ-knowledge.zip"
HEAVY = {".mp4", ".mov", ".wav", ".mp3", ".m4a", ".ogg", ".flac"}
KEEP_AUDIO_UNDER = ("content/audio-kit/", "/voice-samples/", "/song/")   # cost credits to remake, or the client's own file
SKIP_PARTS = {"_voice-cache", "review", "node_modules", "__pycache__", "_rana", ".git"}
MSG_CAP = 6000


def _say(msg=""):
    print("  " + msg, flush=True)


def claude_project_dir(folder):
    """Claude Code keeps a folder's chats and memory in ~/.claude/projects/<the path with every other character turned into ->."""
    return Path.home() / ".claude" / "projects" / re.sub(r"[^A-Za-z0-9]", "-", str(Path(folder).resolve()))


def _client_projects(db):
    try:
        con = sqlite3.connect(db)
        ids = [r[0] for r in con.execute("SELECT id, meta FROM projects") if r[1] and '"kind"' in r[1]]
        con.close()
        return ids
    except sqlite3.Error:
        return []


def _keep(rel, client_ids):
    parts = rel.split("/")
    if SKIP_PARTS & set(parts[:-1]):
        return False
    if Path(rel).suffix.lower() not in HEAVY:
        return True
    if any(rel.startswith(f"content/project-{i}/") for i in client_ids):
        return True   # a client project's song and its pieces
    return any(k in "/" + rel for k in KEEP_AUDIO_UNDER)


def _text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")
    return ""


def conversation(atlas_home):
    """Every Atlas chat on this PC as readable text (the owner's messages and Atlas's answers; tool calls left out), oldest first."""
    folder = claude_project_dir(atlas_home)
    chats = []
    for f in folder.glob("*.jsonl"):
        turns = []
        try:
            for line in f.open(encoding="utf-8"):
                try:
                    d = json.loads(line)
                except ValueError:
                    continue
                if d.get("type") not in ("user", "assistant") or d.get("isMeta"):
                    continue
                msg = d.get("message") or {}
                text = _text(msg.get("content")).strip()
                if not text or text.startswith("<"):   # tool results and system notes
                    continue
                who = "Atlas" if d["type"] == "assistant" else "To Atlas (the owner, or the office)"
                if len(text) > MSG_CAP:
                    text = text[:MSG_CAP] + " [...]"
                turns.append((d.get("timestamp", ""), who, text))
        except OSError:
            continue
        if turns:
            chats.append(turns)
    chats.sort(key=lambda t: t[0][0])
    out = ["# Atlas's conversations on the PC", "",
           "Everything the owner told Atlas on the Windows PC (and Atlas's answers), oldest first, copied for the Mac's Atlas.",
           "Tool calls are left out. Times are UTC.", ""]
    for i, turns in enumerate(chats, 1):
        out += [f"## Conversation {i} (from {turns[0][0][:16].replace('T', ' ')})", ""]
        for ts, who, text in turns:
            out += [f"**{who}** ({ts[:16].replace('T', ' ')}):", "", text, ""]
    return "\n".join(out)


def make(root, out_dir=None):
    """PC side. Returns the pack's path."""
    root, home = Path(root), Path.home()
    out = Path(out_dir) if out_dir else home / "Desktop"
    if not out.exists():
        out = root
    out = out / NAME
    atlas = home / "Atlas-HQ"
    _say(f"Packing what the team knows into {out} ...")
    tmp = Path(tempfile.gettempdir()) / "hq-knowledge.db"
    tmp.unlink(missing_ok=True)
    src, dst = sqlite3.connect(root / "hq.db"), sqlite3.connect(tmp)
    with dst:
        src.backup(dst)
        dst.execute("UPDATE jobs SET state='given_up', note='was running on the PC when its knowledge was packed; its files stay "
                    "on the PC' WHERE state IN ('running', 'queued')")
        try:
            dst.execute("DELETE FROM job_steps")
        except sqlite3.Error:
            pass
    src.close()
    dst.close()
    clients = _client_projects(tmp)
    pack_id = time.strftime("%Y%m%d-%H%M%S")
    n = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(tmp, "program/hq.db")
        for name in ("briefs", "plans", "content", "settings_local.py"):
            p = root / name
            files = [p] if p.is_file() else sorted(f for f in p.rglob("*") if f.is_file()) if p.exists() else []
            for f in files:
                rel = f.relative_to(root).as_posix()
                if _keep(rel, clients):
                    z.write(f, "program/" + rel)
                    n += 1
        for name in ("atlas-journal.md", "requests-for-builder.md", "richard-approved.md"):
            if (atlas / name).exists():
                z.write(atlas / name, "atlas/" + name)
                n += 1
        for sub in ("review/uploads", "review/refs"):
            for f in sorted((atlas / sub).rglob("*")) if (atlas / sub).exists() else []:
                if f.is_file():
                    z.write(f, "atlas/" + f.relative_to(atlas).as_posix())
                    n += 1
        z.writestr("atlas/from-the-pc/atlas-conversation.md", conversation(atlas))
        mem = claude_project_dir(atlas) / "memory"
        for f in sorted(mem.glob("*.md")) if mem.exists() else []:
            z.write(f, "claude-memory/" + f.name)
            n += 1
        z.writestr("manifest.json", json.dumps({"id": pack_id, "made": time.strftime("%Y-%m-%d %H:%M"), "files": n + 2}))
    tmp.unlink(missing_ok=True)
    _say(f"Done: {n + 2} files, {out.stat().st_size / 1e6:.0f} MB. No keys and no phone pairing are in it.")
    _say("Put it on your Drive. On the Mac, download it (it lands in Downloads), close Agent HQ and start it again:")
    _say("it asks before loading it.")
    return out


def find_pack():
    home = Path.home()
    found = [p for d in (home / "Downloads", home / "Desktop") if d.exists() for p in d.glob("AgentHQ-knowledge*.zip")]
    return max(found, key=lambda p: p.stat().st_mtime) if found else None


def load_if_found(root):
    """Mac side, at every START-HERE: a pack not loaded yet is offered (once per pack)."""
    root, home = Path(root), Path.home()
    pack = find_pack()
    if not pack:
        return
    try:
        with zipfile.ZipFile(pack) as z:
            info = json.loads(z.read("manifest.json"))
    except (OSError, KeyError, ValueError, zipfile.BadZipFile):
        return
    done = root / ".knowledge-loaded"
    if done.exists() and done.read_text().strip() == info.get("id"):
        return
    _say(f"Found the PC's knowledge pack, made {info.get('made')}: {pack.name}")
    _say("Loading it gives this computer the PC's ideas, plans, projects (the music video too), rules, Atlas's journal and")
    _say("your conversations with him. It replaces this computer's own company data (a backup copy is kept).")
    try:
        answer = input("  Press Enter to load it, or type N to skip: ").strip().lower()
    except EOFError:
        return
    if answer.startswith("n"):
        done.write_text(info.get("id", ""))   # don't ask again for this pack
        return
    if (root / "hq.db").exists():
        (root / "hq.db").rename(root / f"hq.db.before-knowledge-{time.strftime('%Y%m%d-%H%M%S')}")
    atlas = home / "Atlas-HQ"
    targets = {"program": root, "atlas": atlas, "claude-memory": claude_project_dir(atlas) / "memory"}
    n = 0
    with zipfile.ZipFile(pack) as z:
        for item in z.infolist():
            top, _, rest = item.filename.partition("/")
            base = targets.get(top)
            if base is None or not rest or item.is_dir():
                continue
            dest = (base / rest).resolve()
            if base.resolve() not in dest.parents:
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            with z.open(item) as s, open(dest, "wb") as o:
                shutil.copyfileobj(s, o)
            n += 1
    (atlas / ".atlas-session").unlink(missing_ok=True)   # a fresh chat; he reads the journal + conversation first
    journal = atlas / "atlas-journal.md"
    note = (f"\n\n## {time.strftime('%Y-%m-%d')}: this office now runs on the owner's Mac (loaded from the PC)\n"
            "The PC and the Mac each run their own office (separate data, separate phone bots); files go between them by hand "
            "via the owner's Drive. Before anything else read from-the-pc/atlas-conversation.md: everything the owner told "
            "you on the PC, including the client music video (project 4) and its song in review/uploads/.\n")
    with open(journal, "a", encoding="utf-8") as f:
        f.write(note)
    done.write_text(info.get("id", ""))
    _say(f"Loaded {n} files. Atlas starts a fresh chat and reads what you told him on the PC first.")
