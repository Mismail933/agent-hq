"""
Agent HQ live office.

    python server.py      starts the office and opens it in your browser

Keep this window open while you use the office; it is the engine.
Everything runs on your computer at http://localhost:8765.
"""
import json
import os
import re
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


def tool_dirs():
    """Folders every agent's shell needs: this Python (+ Scripts), Git's bash tools, our Node, FFmpeg."""
    import glob
    import shutil
    py = Path(sys.executable).parent
    out = [py, py / "Scripts"]
    git = shutil.which("git")
    roots = [Path(git).parent.parent] if git else []
    roots += [Path(os.environ.get(v, "")) / "Git" for v in ("ProgramFiles", "ProgramW6432", "LOCALAPPDATA") if os.environ.get(v)]
    roots += [Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Git"]
    for r in roots:
        if (r / "usr" / "bin").is_dir():
            out += [r / "cmd", r / "bin", r / "usr" / "bin"]
            break
    out.append(Path.home() / ".agent-hq-anim" / "node")
    out += [Path(p).parent for p in sorted(glob.glob(str(Path.home() / "AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg*/ffmpeg-*/bin/ffmpeg.exe")))[-1:]]
    if os.name != "nt":   # Mac (2.38.0): our Node's bin, Homebrew (ffmpeg, git), Claude Code's own installer folder
        out += [Path.home() / ".agent-hq-anim" / "node" / "bin", Path("/opt/homebrew/bin"), Path("/usr/local/bin"),
                Path.home() / ".local" / "bin", Path("/usr/bin"), Path("/bin")]
    return [str(d) for d in out if d.is_dir()]


TOOL_DIRS = tool_dirs()


def full_path(who=None):
    """Put the tool folders on the office's PATH (every agent it launches inherits it), and say so if python still isn't
    found (Atlas twice had a shell without python/grep right after a restart). Safe to call before every launch."""
    import shutil
    have = os.environ.get("PATH", "").split(os.pathsep)
    low = {p.lower().rstrip("\\/") for p in have}
    missing = [d for d in TOOL_DIRS if d.lower().rstrip("\\/") not in low]
    if missing:
        os.environ["PATH"] = os.pathsep.join(missing + [p for p in have if p])
    os.environ["HQ_PYTHON"] = sys.executable   # `hq` by absolute path: "$HQ_PYTHON" "$HQ_CLI" status
    os.environ["HQ_CLI"] = str(ROOT / "hq.py")
    if not shutil.which("python"):
        msg = f"python isn't on the PATH {who or 'the agents'} get, so `python hq.py` may fail; use \"$HQ_PYTHON\" \"$HQ_CLI\""
        print("  Warning:", msg, flush=True)
        return msg
    return ""


PATH_WARNING = full_path()
import agents             # noqa: E402
import atlas_engine       # noqa: E402
import atlas_cloud        # noqa: E402
import workers            # noqa: E402
import lnd                # noqa: E402
import elevenlabs         # noqa: E402
import production         # noqa: E402
import quality            # noqa: E402
import sfx                # noqa: E402
import ghassan            # noqa: E402
import phone              # noqa: E402
import clientbot          # noqa: E402
import remote             # noqa: E402
import studio             # noqa: E402
import design             # noqa: E402
import client             # noqa: E402
import cast               # noqa: E402
import assets             # noqa: E402
import omar               # noqa: E402
import youtube            # noqa: E402
import checkpoint         # noqa: E402
import rules              # noqa: E402
import control_plane as cp  # noqa: E402
import settings           # noqa: E402

cp.init()
if PATH_WARNING:
    cp.log("Office", "path_warning", None, {"warning": PATH_WARNING, "path": os.environ.get("PATH", "")[:2000]})
rules.apply_all()   # the team's live rules onto the settings they change (again before every job)
agents.register_all()
agents.setup_animated_projects()
CUT_IDEAS = cp.interrupted_ideas()   # picked up again after start (resume_jobs)
LEFTOVER_JOBS = cp.unfinished_jobs()   # noted NOW, before the office takes requests: a job started after this is never a leftover
_n = cp.mark_interrupted()
if _n:
    cp.log("Atlas", "halted", None, {"reason": f"{_n} idea(s) were interrupted when the program last closed. They are picked up again by themselves."})

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


def builder_note(text):
    """A note from the Builder chat for Atlas (2.31.3): what the Builder did in the office and why. It reaches Atlas with the
    owner's next message (NEWS), not the owner's phone, and shows in the office chat as from the Builder."""
    with LOCK:
        CHAT.append({"from": "atlas", "ts": time.time(), "text": "(Note from the Builder) " + text[:2000]})
        NEWS.append("NOTE FROM THE BUILDER (the engineer chat; it works in the office with the same hq tools, so its actions show "
                    "in the activity log under your name or the owner's): " + text[:2000])
    cp.log("Builder", "builder_note", None, {"text": text[:300]})


def atlas_says(text):
    with LOCK:
        CHAT.append({"from": "atlas", "ts": time.time(), "text": text})
        NEWS.append(text)
    phone.notify(text)


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


def run_batch(project_id, count, notes, topic=""):
    out = agents.calina_batch(project_id, count, notes, topic)
    try:
        r = json.loads(out)
        mark = {"pass": "passed Israa", "rework": "Israa still has doubts", "unreviewed": "NOT reviewed"}
        titles = "\n".join(f"- #{e['id']} {e['title']} ({mark.get(e.get('verdict'), 'not reviewed')}; {e.get('words', '?')} words counted, {e.get('scenes', '?')} scenes"
                            + (f", {e['split']} long line(s) split" if e.get("split") else "") + ")" for e in r["episodes"])
        dropped = f" She dropped {r['dropped_without_source']} script(s) she couldn't source." if r["dropped_without_source"] else ""
        if r.get("dropped_off_topic"):
            dropped += f" {r['dropped_off_topic']} script(s) were about a different story than the fixed topic, \"{r.get('topic', '')}\", and were rejected in code."
        g = r.get("review") or {}
        rev = (f"\n\nIsraa reviewed them: {g.get('passed', 0)} passed"
               + (f", {g['reworked']} sent back to Calina and rewritten" if g.get("reworked") else "")
               + (f", {g['still_weak']} still not good enough (her notes are on each script)" if g.get("still_weak") else "")
               + (f". {g['note']}" if g.get("note") else ".")) if g else ""
        atlas_says(f"**Calina's batch {r['batch']} is ready: {len(r['episodes'])} scripts.**{dropped}\n{titles}{rev}\n\n"
                   + (f"{r['batch_note']}\n\n" if r.get("batch_note") else "")
                   + "Open the project's Episodes page to read each script, its sources and Israa's verdict, then approve or reject it.")
    except (ValueError, KeyError, TypeError):
        atlas_says(out)


def run_scout_refs(project_id, notes=""):
    out = quality.scout_references(project_id, notes)
    try:
        r = json.loads(out)
        atlas_says(f"**The Scout's reference board is ready for project {r['project_id']}.** He found {r['references']} real examples "
                   f"({r['verified']} he could verify) and {len(r['options'])} directions to choose from: " + "; ".join(r["options"]) +
                   ".\n\nOpen the project's Reference board page, look at the examples, pick a direction and approve the board. Calina won't write anything until you do.")
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
    p = getattr(settings, "SHORTS_PYTHON", None) or Path.home() / ".agent-hq-shorts" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    return str(p) if Path(p).exists() else None


def voice_samples(p):
    """The voice samples the owner can listen to for an animated project, and which one is chosen."""
    f = ROOT / "content" / f"project-{p['id']}" / "voice-samples" / "samples.json"
    try:
        got = json.loads(f.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        got = {"line": "", "voices": []}
    chosen = ((p.get("meta") or {}).get("voice") or {}).get("id")
    return {"line": got.get("line", ""), "voices": got.get("voices", []), "chosen": chosen, "making": SAMPLING["pid"] == p["id"]}


SAMPLING = {"pid": None}
CHARMAKING = {"pid": None, "step": ""}
ANIMTEST = {"pid": None}
VOICEWORK = {"what": ""}


def _animate(*args, timeout=3600):
    """Run animate.py in the video tools' Python and return its RESULT json (or raise with the reason)."""
    py = shorts_python()
    if not py:
        raise RuntimeError("the video tools aren't set up on this computer (see SHORTS_PYTHON in settings.py)")
    p = subprocess.run([py, str(ROOT / "animate.py"), *map(str, args)], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace",
                       timeout=timeout, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    lines = (p.stdout or "").splitlines()
    res = next((l[7:] for l in lines if l.startswith("RESULT ")), None)
    if not res:
        blocked = next((l[8:] for l in lines if l.startswith("BLOCKED ")), None)
        raise RuntimeError(blocked or ((p.stderr or p.stdout or "no output").strip().splitlines() or ["?"])[-1][:300])
    return json.loads(res)


# ---- voice matcher, the cast's voices, music (2.20.0) ---------------------------------------
MATCHING = {"pid": None, "step": "", "recording": False, "secs": 0}
VM_ERRORS = {}   # project -> the last record/match failure, shown on the Voice page until the next try
ACCOUNT_VOICES = {"at": 0.0, "list": []}
CASTSAMPLING = {"pid": None}
KOKORO_OPTIONS = [("kokoro:bm_george", "Kokoro: George (British man, free)"), ("kokoro:bm_lewis", "Kokoro: Lewis (British man, free)"),
                  ("kokoro:bm_daniel", "Kokoro: Daniel (British man, free)"), ("kokoro:am_onyx", "Kokoro: Onyx (deep American man, free)"),
                  ("kokoro:am_puck", "Kokoro: Puck (young American man, free)"), ("kokoro:am_eric", "Kokoro: Eric (American man, free)"),
                  ("kokoro:am_fenrir", "Kokoro: Fenrir (American man, free)"), ("kokoro:am_michael", "Kokoro: Michael (American man, free)"),
                  ("kokoro:bf_isabella", "Kokoro: Isabella (British woman, free)"), ("kokoro:af_heart", "Kokoro: Heart (American woman, free)")]


def account_voices_cached():
    """The owner's ElevenLabs voices, read at most every 10 minutes (the office polls often)."""
    if elevenlabs.configured() and time.time() - ACCOUNT_VOICES["at"] > 600:
        ACCOUNT_VOICES["at"] = time.time()
        try:
            ACCOUNT_VOICES["list"] = elevenlabs.account_voices()
        except elevenlabs.ElevenError:
            pass
    return ACCOUNT_VOICES["list"]


def _tool(script, *args, timeout=3600):
    """Run one of our scripts (animate.py, voice_match.py) in the video tools' Python and return its RESULT json."""
    py = shorts_python()
    if not py:
        raise RuntimeError("the video tools aren't set up on this computer (see SHORTS_PYTHON in settings.py)")
    p = subprocess.run([py, str(ROOT / script), *map(str, args)], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace",
                       timeout=timeout, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    lines = (p.stdout or "").splitlines()
    res = next((l[7:] for l in lines if l.startswith("RESULT ")), None)
    if not res:
        blocked = next((l[8:] for l in lines if l.startswith("BLOCKED ")), None)
        raise RuntimeError(blocked or ((p.stderr or p.stdout or "no output").strip().splitlines() or ["?"])[-1][:300])
    return json.loads(res)


def voice_match_view(p):
    folder = ROOT / "content" / f"project-{p['id']}" / "voice-ref"
    try:
        m = json.loads((folder / "matches.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        m = None
    ref = folder / "reference.wav"
    busy = MATCHING["pid"] == p["id"]
    live = None
    if busy and MATCHING.get("recording"):   # the recorder's live level (voice_match.py writes it 4 times a second)
        try:
            live = json.loads((folder / "_level.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            live = {"elapsed": 0, "seconds": MATCHING.get("secs") or 40, "level": 0, "starting": True}
    return {"matches": m, "reference": ref.exists(), "reference_at": time.strftime("%Y-%m-%d %H:%M", time.localtime(ref.stat().st_mtime)) if ref.exists() else None,
            "busy": MATCHING["step"] if busy else "", "live": live, "error": "" if busy else VM_ERRORS.get(p["id"], "")}


def cast_view(p):
    meta = p.get("meta") or {}
    cast = meta.get("cast_voices") or {}
    opts = [{"id": "eleven:" + v["id"], "label": f"ElevenLabs: {v['name']}" + (f" ({', '.join(x for x in (v['gender'], v['age'], v['accent']) if x)})" if v["gender"] else "")}
            for v in account_voices_cached()] + [{"id": k, "label": l} for k, l in KOKORO_OPTIONS]
    folder = ROOT / "content" / f"project-{p['id']}" / "voice-samples" / "cast"
    return {"voices": cast, "options": opts, "samples": sorted(f.stem for f in folder.glob("*.mp3")) if folder.exists() else [],
            "making": CASTSAMPLING["pid"] == p["id"], "model": getattr(settings, "ELEVEN_MODEL", "")}


def music_view(p):
    lib = sfx.library()
    return {"choices": lib["music"], "chosen": (p.get("meta") or {}).get("music") or "", "sfx_made": sum(1 for x in lib["sfx"] if x["made"]),
            "sfx_total": len(lib["sfx"])}


def run_voice_match(pid, record_secs=0):
    VM_ERRORS.pop(pid, None)
    MATCHING.update(pid=pid, step="Recording: play the video now" if record_secs else "Comparing voices", recording=bool(record_secs), secs=record_secs)
    stage = "record" if record_secs else "match"
    try:
        if record_secs:
            (ROOT / "content" / f"project-{pid}" / "voice-ref" / "_level.json").unlink(missing_ok=True)
            cp.log("Owner", "voice_recording", None, {"project": pid, "seconds": record_secs})
            r = _tool("voice_match.py", "record", pid, record_secs, timeout=record_secs + 120)
            cp.log("Calina", "voice_recorded", None, {"project": pid, "seconds": r.get("seconds"), "device": r.get("device"), "file": r.get("file")})
            MATCHING.update(recording=False, step=f"Saved {r['seconds']:.0f} s from {r.get('device') or 'the speakers'}. Matching voices (a few minutes)")
            atlas_says(f"**Recorded {r['seconds']:.0f} s of the reference voice.** Now comparing it with the ElevenLabs Voice Library (a few minutes).")
            stage = "match"
        m = _tool("voice_match.py", "match", pid, timeout=3600)
        top = m.get("top") or []
        cp.log("Calina", "voice_matched", None, {"project": pid, "compared": m.get("compared"), "top": [t["name"] for t in top]})
        atlas_says("**Voice match ready.** The closest ElevenLabs voices to your reference: "
                   + "; ".join(f"{t['name']} ({round(t['score'] * 100)}%)" for t in top) +
                   ". Open the project's Voice & characters page to listen and add the one you like (free).")
    except Exception as ex:
        why = "it took too long" if isinstance(ex, subprocess.TimeoutExpired) else str(ex)
        VM_ERRORS[pid] = (f"The recording didn't work: {why}" if stage == "record" else f"The voice match didn't work: {why}")
        cp.log("Calina", "voice_record_failed" if stage == "record" else "voice_match_failed", None, {"project": pid, "error": why[:300]})
        atlas_says(VM_ERRORS[pid])
    finally:
        MATCHING.update(pid=None, step="", recording=False, secs=0)


def run_library_add(pid, owner_id, voice_id, name):
    VOICEWORK["what"] = "a Voice Library voice is being added"
    try:
        new_id = elevenlabs.add_shared_voice(owner_id, voice_id, name)
        e = _animate("voice-add", pid, new_id, name or "", timeout=900)
        cp.log("Owner", "library_voice_added", None, {"project": pid, "voice": name, "id": new_id})
        atlas_says(f"**Added to your ElevenLabs voices: {e['label']}.** Its sample is on the Voice & characters page; pick it as the narrator or give it to a character.")
    except Exception as ex:
        atlas_says(f"That voice couldn't be added: {ex}")
    finally:
        VOICEWORK["what"] = ""


def run_cast_samples(pid):
    CASTSAMPLING["pid"] = pid
    try:
        r = _animate("cast-samples", pid, timeout=1800)
        atlas_says(f"**The cast's voices are ready** ({len(r.get('made', []))} characters, one line each). Listen on the Voice & characters page.")
    except Exception as ex:
        atlas_says(f"The cast's voice samples couldn't be made: {ex}")
    finally:
        CASTSAMPLING["pid"] = None


# ---- Saved jobs (2.23.0): long work survives a restart -------------------------------------------------------------------
# Every long job is written to hq.db (cp.add_job) when it starts and marked done when it ends. A job still "running" at the
# next start was cut off (the window was closed, the PC slept, the office restarted): resume_jobs runs it again. While a
# restart is coming (RESTARTING), new jobs are saved as "queued" instead and run right after it.
RESTARTING = {"on": False}
RUNNING_JOBS = {}   # job id -> kind, running in this run of the office


def job_label(kind, a):
    a = list(a) + [None] * 4
    n = len(a[1]) if kind == "render_voices" and isinstance(a[1], list) else 0
    return {"render": "Video #{0}", "render_voices": "Video #{0} in %d voices" % n,
            "characters": "The characters for project {0}", "char_review": "Israa's check of project {0}'s characters",
            "animator_test": "Rana's test scene for episode {1}", "voice_match": "The voice match for project {0}",
            "library_add": "Adding the voice {3}", "voice_add": "Adding the voice {2}",
            "cast_samples": "The cast's voice samples for project {0}", "samples": "The narrator samples for project {0}",
            "batch": "Calina's scripts for project {0}", "scout_refs": "The Scout's reference board for project {0}",
            "review": "Calina's learning note for project {0}", "plan": "Serge's plan for idea #{0}",
            "israa_video": "Israa's review of video #{0}", "design": "Rana's {0} options", "cast_draw": "Rana's new cast for project {0}",
            "cast_check": "Israa's check of Rana's cast v{1} for project {0}", "assets": "Rana's art for video #{0}",
            "style_frames": "Rana's style frames for project {0}",
            "mv_render": "The music video {1} {2} of project {0}", "render_test": "The test render of video #{0}",
            "shorts_cut": "Omar's Shorts from {1}", "sound_review": "Tarek's sound review of {0}", "script_fix": "Calina's fixes to script #{0} ({1}'s notes)"}.get(kind, kind).format(*[x if x is not None else "" for x in a])


def journaled(kind, fn):
    def run(*args, _jid=None):
        if RESTARTING["on"] and _jid is None:
            cp.add_job(kind, list(args), "queued")
            atlas_says(f"**{job_label(kind, args)}** starts right after the office restarts into the new version (in a few minutes).")
            return
        jid = _jid or cp.add_job(kind, list(args))
        RUNNING_JOBS[jid] = kind
        checkpoint.begin(jid)   # the job's finished steps are saved under its row; a resumed job skips them
        rules.apply_all()   # live rules Atlas changed since the last job
        if _jid and checkpoint.resumed_from(jid):
            cp.set_job(jid, "running", checkpoint.resumed_from(jid))
        if kind != "cast_draw" and rules.get("jobs.allowance_check") != "off":   # (the cast checks its own, and can wait)
            short = allowance_short(JOB_NEEDS.get(kind, ()))
            if short:
                atlas_says(f"Heads-up: {job_label(kind, args)} is starting although " + "; ".join(w for _, w in short)
                           + ". It may stop halfway.")
        try:
            fn(*args)
            cp.set_job(jid, "done")
        except Exception as e:
            cp.set_job(jid, "failed", str(e)[:300])
            raise
        finally:
            RUNNING_JOBS.pop(jid, None)
            checkpoint.end()
    run.__name__ = fn.__name__
    return run


JOBS = {"cast_draw": "run_cast_draw", "cast_check": "run_cast_check","design": "run_design", "render": "run_render", "render_voices": "run_render_voices", "characters": "run_characters", "char_review": "run_char_review",
        "animator_test": "run_animator_test", "voice_match": "run_voice_match", "library_add": "run_library_add",
        "voice_add": "run_voice_add", "cast_samples": "run_cast_samples", "samples": "run_samples", "batch": "run_batch",
        "scout_refs": "run_scout_refs", "review": "run_review", "plan": "run_plan", "israa_video": "run_israa_video", "assets": "run_assets",
        "style_frames": "run_style_frames", "mv_render": "run_mv_render", "render_test": "run_test_render", "shorts_cut": "run_cut_shorts",
        "sound_review": "run_sound_review", "script_fix": "run_script_fix"}


LOGO_BRIEF = ("The logo of Agent HQ: the owner's AI company, a small team of AI agents (each with a name and a job) run by a manager, "
              "Atlas, for the owner. It finds, judges and builds legal online businesses. Square icon + wordmark; works on light and dark; "
              "readable at 64 px. The office's look is a calm sci-fi HUD (cyan, violet, deep navy), but the logo may go its own way.")


def first_logo():
    """The owner asked Rana for the company's logo (2026-10-08): she starts it by herself once, the first time the office runs with her."""
    time.sleep(150)
    marker = design.BRAND / ".logo-requested"
    if os.environ.get("HQ_SIMULATE") == "1" or marker.exists() or (design.BRAND / "logo").exists() or not shorts_python():
        return
    while anim_busy() or RESTARTING["on"] or cp.STOP_FILE.exists():
        time.sleep(60)
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.write_text(time.strftime("%Y-%m-%d %H:%M"), encoding="utf-8")
    atlas_says("**Rana is starting on the Agent HQ logo you asked for:** 3 options, each checked by Israa at 64 px and on light "
               "and dark. They come to your phone with a Use this button (about 20 minutes).")
    run_design("logo", LOGO_BRIEF)


def resume_job(which):
    """Atlas's `hq resume <job id | kind>`: run a saved job again; it skips the steps it finished (checkpoint.py). (ok, message)."""
    which = str(which).strip().lower()
    with cp._db() as con:
        j = (con.execute("SELECT * FROM jobs WHERE id=?", (int(which),)) if which.isdigit() else
             con.execute("SELECT * FROM jobs WHERE kind=? ORDER BY id DESC LIMIT 1", (which.replace("-", "_"),))).fetchone()
    if not j or j["kind"] not in JOBS:
        return False, f"No saved job '{which}'. Give its number or its kind ({', '.join(JOBS)}); hq status lists the recent ones."
    if j["id"] in RUNNING_JOBS:
        return False, f"Job {j['id']} ({job_label(j['kind'], json.loads(j['args'] or '[]'))}) is running now."
    if cp.STOP_FILE.exists():
        return False, "The kill switch is on: the owner (or hq resume with no job) turns it off first."
    a = json.loads(j["args"] or "[]")
    if j["kind"] == "cast_draw" and len(a) > 3 and a[3] == "new":   # continue the version it made, don't start another
        a[3] = ""
    step = checkpoint.resumed_from(j["id"])
    cp.set_job(j["id"], "running", step or "started again by Atlas")
    cp.log("Atlas", "job_resumed", None, {"job": j["id"], "kind": j["kind"], "from": step})
    threading.Thread(target=globals()[JOBS[j["kind"]]], args=a, kwargs={"_jid": j["id"]}, daemon=True).start()
    return True, f"Job {j['id']} ({job_label(j['kind'], a)}) is running again" + (f", {step}." if step else " (no finished step was saved, so from the start).")


def resume_jobs():
    """At start: run again what the last run of the office didn't finish, one after the other, and say so."""
    time.sleep(15)
    if CHARMAKING["pid"] is None:   # Rana's casts still "drawing" were cut off: marked stopped (the saved job below resumes its own)
        cut = cast.mark_cut_off()
        if cut:
            atlas_says("**Rana's unfinished cast(s) marked stopped** (the office restarted while she worked): " + ", ".join(cut)
                       + ". A saved cast job picks up its own version below; any other: hq cast-draw <project> --resume v<K>.")
    jobs, ideas = [j for j in LEFTOVER_JOBS if j["id"] not in RUNNING_JOBS], list(CUT_IDEAS)
    if not jobs and not ideas:
        return
    while cp.STOP_FILE.exists():   # the kill switch is on: wait for the owner's resume
        time.sleep(30)
    todo, said = [], []
    for j in jobs:
        a, label = j["args"], job_label(j["kind"], j["args"])
        if j["kind"] not in JOBS:
            cp.set_job(j["id"], "given_up", "unknown kind of job")
            continue
        tries = rules.get("jobs.resume_tries")
        if j["state"] == "running" and j["attempts"] >= tries:
            cp.set_job(j["id"], "given_up", f"cut off {tries + 1} times")
            said.append(f"- {label}: stopped {tries + 1} times in a row, so I'm not starting it again. Ask Atlas to look"
                        f" (hq resume {j['id']} starts it again from its last finished step).")
            continue
        if j["kind"] == "voice_match" and (a + [0, 0])[1]:   # it was recording the speakers: needs the owner to play the video again
            cp.set_job(j["id"], "given_up", "recording needs the owner")
            said.append(f"- {label}: it was recording your speakers. Press Record again and play the video.")
            continue
        step = checkpoint.resumed_from(j["id"])
        if j["kind"] == "batch" and not step:   # (a job from before checkpoints) only the scripts that weren't saved yet
            made = sum(1 for e in cp.list_episodes(a[0], limit=100) if e["ts"] >= j["ts"])
            if made and not a[1]:
                cp.set_job(j["id"], "done", f"{made} script(s) were saved before the restart")
                said.append(f"- {label}: {made} script(s) were saved before the restart. Ask Calina for more if you want.")
                continue
            if a[1]:
                a[1] = int(a[1]) - made
                if a[1] <= 0:
                    cp.set_job(j["id"], "done", "every script was saved before the restart")
                    continue
        if j["kind"] == "cast_draw" and len(a) > 3 and a[3] == "new":   # it made its version already: continue that one
            a[3] = ""
        cp.set_job(j["id"], "running", attempt=True)   # a queued one counts too, so nothing can loop forever
        todo.append((j, a))
        said.append(f"- {label}" + (" (it was waiting for the restart)" if j["state"] == "queued" else f" ({step})" if step else ""))
    said += [f"- Research and judgment of idea #{i}" + (" (resumed from Sage's saved brief: only Vera's judgment runs again)"
                                                          if (cp.get_idea(i) or {}).get("brief") else "") for i in ideas]
    if said:
        atlas_says("**The office restarted. Picking up where it stopped:**\n" + "\n".join(said))
    for j, a in todo:
        try:
            globals()[JOBS[j["kind"]]](*a, _jid=j["id"])
        except Exception as e:
            print("Resume:", j["kind"], repr(e), flush=True)
    for i in ideas:
        try:
            run_retry(i)
        except Exception as e:
            print("Resume idea:", i, repr(e), flush=True)


# ---- Ghassan, the in-house Builder (2.21.0), and the office restarting itself after the owner ships ----------------------
def office_idle():
    return not (anim_busy() or RENDERING["lock"].locked() or agents.PRODUCING.locked() or agents.PIPELINE.locked()
                or agents.PLANNING.locked() or STATE["busy"] or MATCHING["pid"] is not None or quality.REVIEWING.locked()
                or RUNNING_JOBS or agents.SCOUTING.locked() or ghassan.LOCK.locked())


def unblock(agent):
    """Atlas's `hq unblock <agent|all>`: clear what shows an agent as blocked when the cause is gone. Never stops real work: a flag is
    only cleared when no job of that kind is running. Returns what was cleared (lines)."""
    who = agent.strip().capitalize() if agent.strip().lower() != "all" else "all"
    kinds = set(RUNNING_JOBS.values())
    done = []
    if who in ("Calina", "Rana", "Animator", "all"):
        cp.log("Atlas", "block_cleared", None, {"agent": "Calina"})   # the office forgets old "video failed" blocks
        done.append("Calina: old video failures no longer show as a block (the next render shows the truth)")
        for flag, kind, what in ((CHARMAKING, "characters", "characters being made"), (ANIMTEST, "animator_test", "a test scene"),
                                 (CASTSAMPLING, "cast_samples", "cast voice samples"), (MATCHING, "voice_match", "a voice match")):
            if flag.get("pid") is not None and kind not in kinds and not (kind == "characters" and "char_review" in kinds):
                flag.update(pid=None, **({"step": ""} if "step" in flag else {}))
                done.append(f"cleared a stale '{what}' flag")
        if VOICEWORK["what"] and not kinds & {"voice_add", "library_add", "samples"}:
            VOICEWORK["what"] = ""
            done.append("cleared a stale voice-work flag")
    if who in ("Sage", "Vera", "all"):
        stuck = [i for i in cp.list_ideas(200) if not i.get("verdict") and i.get("status") in ("stopped", "error", "interrupted")]
        for i in stuck:
            cp.update_idea(i["id"], status="archived")
        if stuck:
            cp.log("Atlas", "block_cleared", None, {"agent": "Sage", "ideas": [i["id"] for i in stuck]})
            done.append(f"Sage: {len(stuck)} stopped idea(s) archived: " + ", ".join(f"#{i['id']}" for i in stuck)
                        + " (retry one with hq retry <id> if you still want it)")
    if who in ("Atlas", "all") and LIMIT_UNTIL[0]:
        LIMIT_UNTIL[0] = 0.0
        done.append("Atlas: the plan-limit pause is cleared; the next message tries Claude Code on this PC first")
    if who in ("Ghassan", "all") and not ghassan.LOCK.locked():
        ghassan.STATUS.update(state="idle", request="")
        back = ghassan.reopen_stale()
        done.append("Ghassan: status reset" + (f"; reopened: {'; '.join(back)}" if back else ""))
    if who not in ("Calina", "Rana", "Animator", "Sage", "Vera", "Atlas", "Ghassan", "all"):
        done.append(f"{agent}: nothing can be stuck for this agent outside a running job (their locks free themselves when the job ends)")
    return done or ["Nothing was blocked."]


def loaded_files():
    """The program files this office has imported: a change to one of them needs a restart."""
    out = set()
    for m in list(sys.modules.values()):
        f = getattr(m, "__file__", None)
        try:
            out.add(Path(f).resolve().relative_to(ROOT.resolve()).as_posix())
        except (TypeError, ValueError):
            pass
    return out


def after_ship():
    """Ghassan's change is on GitHub. If it only touches files the office doesn't hold in memory, they're copied in place and
    nothing restarts; otherwise the office restarts once nothing is running (new jobs wait for it)."""
    try:
        files = ghassan.install_hot(loaded_files())
    finally:
        SHIPPING["on"] = False
    if files is not None:
        if any(f.startswith("atlas/") for f in files):
            try:
                atlas_engine.setup()   # Atlas's role and controls in Atlas-HQ
            except Exception as e:
                print("Atlas setup after install:", repr(e), flush=True)
        atlas_says("**Installed without a restart.** Nothing that was running stopped." +
                   (" Refresh the office page to see the change." if "office.html" in files else ""))
        return
    restart_office()


def restart_office(why="the new version"):
    """Restart into the new version once nothing is running. The launcher (launch.py, 2.21.0+) updates and starts the office
    again when it exits with code 75; an older launcher gets a fresh START-HERE window instead. Saved jobs resume after it."""
    with RESTART_LOCK:
        if RESTARTING["on"]:
            return   # a restart is already waiting
        RESTARTING["on"] = True
    time.sleep(3)
    if not office_idle():
        busy = working_now()
        atlas_says(f"**The office restarts for {why} as soon as the running work is done**" + (": " + "; ".join(busy) if busy else "")
                   + ". Nothing is stopped; anything new you start meanwhile waits and runs right after the restart.")
    while not office_idle():
        time.sleep(20)
    print("Restarting the office to load the new version...", flush=True)
    end_run(f"restarted for {why}")
    if os.environ.get("HQ_LAUNCHER_LOOP") != "1":
        bat = ROOT / "START-HERE.bat"
        if bat.exists() and os.name == "nt":
            subprocess.Popen(["cmd", "/c", "start", "Agent HQ", str(bat)], cwd=ROOT, env=dict(os.environ, HQ_NO_BROWSER="1"))
    os._exit(75)


RESTART_LOCK = threading.Lock()
SHIPPING = {"on": False}   # the owner's Ship click is being installed: after_ship decides about that restart itself
FILE_TIMES = {}   # program file -> modified time, as first seen by restart_watch


def changed_program_files():
    """Imported program files that changed on disk since the office loaded them (the Builder chat or a hand copy)."""
    out = []
    for f in loaded_files():
        try:
            t = (ROOT / f).stat().st_mtime
        except OSError:
            continue
        if FILE_TIMES.setdefault(f, t) != t:
            out.append(f)
    return out


def newer_version():
    """The VERSION on GitHub when it differs from this one (and isn't the one the launcher holds back), else ''."""
    import launch   # its version check only; importing it starts nothing
    try:
        remote = launch.remote_version()
    except Exception:
        return ""   # offline: try again next time
    hold = ROOT / ".hold-version"
    if not remote or remote == launch.local_version() or (hold.exists() and hold.read_text().strip() == remote):
        return ""
    return remote


def restart_watch():
    """Every `office.update_check_minutes`: if the office's own program files changed, or GitHub has a new version (the Builder
    chat pushed), restart once nothing is running (`restart_office`; saved jobs resume). Off with the rule `office.auto_restart`."""
    time.sleep(120)   # let the office settle first
    changed_program_files()   # remember how the files look now
    while True:
        try:
            if rules.get("office.auto_restart") and not RESTARTING["on"] and not ghassan.LOCK.locked() and not SHIPPING["on"]:
                files, remote = changed_program_files(), newer_version()
                if files or remote:
                    why = f"version {remote}" if remote else "changed program files (" + ", ".join(files[:4]) + ")"
                    cp.log("Office", "auto_restart", None, {"version": remote, "files": files[:20]})
                    restart_office(why)
        except Exception as e:   # the loop must never die
            print("Restart watch:", repr(e), flush=True)
        time.sleep(60 * max(2, int(rules.get("office.update_check_minutes") or 10)))


def ghassan_loop():
    """Every few minutes: Ghassan takes the next open request from Atlas, if there is one, and builds it up to a checked change
    that waits for the owner's Ship click. Nothing ships by itself."""
    time.sleep(90)   # let the office settle first
    try:
        back = ghassan.reopen_stale()
        if back:
            atlas_says("**Ghassan picks up again what a restart cut off:** " + "; ".join(back))
    except Exception as e:
        print("Ghassan:", repr(e), flush=True)
    while True:
        rules.apply_all()   # Ghassan's on/off and pace are live rules
        try:
            if not RESTARTING["on"] and getattr(settings, "GHASSAN_ON", True) and os.environ.get("HQ_SIMULATE") != "1" and atlas_engine.find_claude():
                ghassan.turn(atlas_says, anim_free=lambda: not anim_busy())
        except Exception as e:   # the loop must never die
            print("Ghassan:", repr(e), flush=True)
        time.sleep(60 * getattr(settings, "GHASSAN_EVERY_MINUTES", 10))


def phone_cards():
    """More waiting cards for the phone (phone.PROVIDERS): voice versions to choose from, characters to approve, the music and
    the narrator's voice while they're still open. Each card carries its media (videos, sheets, audio) with buttons."""
    import html as H
    out = []
    for e in cp.list_episodes(limit=80):
        vs = (e["data"] or {}).get("voice_variants") or []
        if vs:
            rv = (e["data"] or {}).get("video_review") or {}
            out.append({"key": f"voices:{e['id']}:{len(vs)}", "text":
                        f"🎙 <b>Video #{e['id']} in {len(vs)} voices: {H.escape(e['title'])}</b>"
                        + (f"\n<b>Israa:</b> {H.escape(str(rv.get('verdict', '')))} ({rv.get('score', '?')}/10). {H.escape(str(rv.get('summary', ''))[:400])}" if rv else "")
                        + "\nWatch each version above and tap <b>Keep</b> under the one you want.",
                        "media": [{"kind": "video", "path": str(ROOT / v["video"]), "caption": v.get("label", ""),
                                   "buttons": [[(f"✅ Keep {v.get('label', '')[:40]}", f"KV:{e['id']}.{i}")]]}
                                  for i, v in enumerate(vs) if (ROOT / v["video"]).exists()],
                        "buttons": []})
    for pr in cp.list_projects(20):
        if pr["status"] != "approved" or (pr.get("meta") or {}).get("format") != "animated_v1":
            continue
        pid, meta = pr["id"], pr.get("meta") or {}
        name = (meta.get("channel") or {}).get("name") or f"project {pid}"
        lib = quality.load_library(pid) or {}
        chars = [c for c in lib.get("characters") or [] if c.get("clip")]
        if chars and not quality.characters_ready(pr) and (lib.get("kit") or "1") == quality.KIT_VERSION:
            revs = lib.get("reviews") or {}
            media, lines = [], []
            for c in chars:
                nm = quality.CAST_NAMES.get(c["id"], c["id"])
                r = revs.get(c["id"]) or {}
                verdict = r.get("verdict") or ("pass" if r.get("shots") and all(x.get("consistent") for x in r["shots"]) else "not checked" if not r else "problems")
                lines.append(f"• {H.escape(nm)}: Israa says {H.escape(str(verdict))}" + (f" ({H.escape(str(r.get('summary', ''))[:160])})" if r.get("summary") else ""))
                if c.get("sheet") and (ROOT / c["sheet"]).exists():
                    media.append({"kind": "photo", "path": str(ROOT / c["sheet"]), "caption": f"{nm}: reference sheet"})
                if (ROOT / c["clip"]).exists():
                    media.append({"kind": "video", "path": str(ROOT / c["clip"]), "caption": f"{nm}: test clip"})
            out.append({"key": f"characters:{pid}:{lib.get('made', '')}", "text":
                        f"🧑‍🎨 <b>The characters for {H.escape(name)} are ready for your approval</b> ({len(chars)}).\n" + "\n".join(lines)
                        + "\nNo animated video is made until you approve them.",
                        "media": media, "buttons": [[("✅ Approve the characters", f"CA:{pid}"), ("↩ Send back", f"CB:{pid}")]]})
        if not meta.get("music"):
            tracks = [m for m in sfx.library()["music"] if m["downloaded"]]
            if tracks:
                out.append({"key": f"music:{pid}", "text": f"🎵 <b>Pick the background music for {H.escape(name)}</b> (or none). Listen to each above.",
                            "media": [{"kind": "audio", "path": str(sfx.MUSIC_DIR / f"{m['id']}.mp3"), "caption": f"{m['title']} ({m['mood']})",
                                       "buttons": [[(f"✅ Use {m['title'][:40]}", f"MU:{pid}.{m['id']}"[:64])]]} for m in tracks],
                            "buttons": [[("🔇 No music", f"MU:{pid}.none")]]})
        vs = voice_samples(pr)
        if vs["voices"] and not vs["chosen"]:
            out.append({"key": f"voice:{pid}", "text": f"🗣 <b>Pick the narrator's voice for {H.escape(name)}</b>: the same lines in {len(vs['voices'])} voices above.",
                        "media": [{"kind": "audio", "path": str(ROOT / v["file"]), "caption": v.get("label", ""),
                                   "buttons": [[(f"✅ Use {v.get('label', '')[:40]}", f"VO:{pid}.{i}")]]}
                                  for i, v in enumerate(vs["voices"]) if v.get("file") and (ROOT / v["file"]).exists()],
                        "buttons": []})
    return out


def design_cards():
    out = []
    for d in design.open_designs():
        if d.get("status") != "ready":
            continue
        media = []
        for k, o in enumerate(d["options"], 1):
            r = o.get("review") or {}
            if o.get("sheet") and (ROOT / o["sheet"]).exists():
                media.append({"kind": "photo", "path": str(ROOT / o["sheet"]),
                              "caption": f"Option {k}: {o.get('name', '')}. {o.get('idea', '')}"
                                         + (f"\nIsraa: {r.get('verdict')}. {r.get('summary', '')}" if r else ""),
                              "buttons": [[(f"✅ Use option {k}", f"DZ:{d['slug']}.{d['version']}.{k}"[:64])]]})
        out.append({"key": f"design:{d['slug']}:{d['version']}", "text": f"🎨 <b>Rana's {d['what']} options are ready</b> ({len(media)}). "
                    "Each picture shows it at 256 and 64 px on light and dark. Tap <b>Use option</b> under the one you want.",
                    "media": media, "buttons": []})
    return out


def working_now():
    """Who is working right now, as short lines (the phone's /status)."""
    out = []
    if STATE["busy"]:
        out.append("Atlas is answering you")
    if agents.SCOUTING.locked():
        out.append("Doulya is scouting for ideas")
    if agents.PIPELINE.locked():
        out.append("Sage and Vera are researching and judging an idea")
    if agents.PLANNING.locked():
        out.append("Serge is writing a plan")
    if agents.PRODUCING.locked():
        out.append("Calina is writing scripts")
    if RENDERING["lock"].locked():
        out.append(f"Calina is making video #{RENDERING['episode']}")
    if quality.REVIEWING.locked():
        out.append("Israa is reviewing")
    if DESIGNING["what"]:
        out.append(f"Rana is drawing {DESIGNING['what']}")
    if ghassan.LOCK.locked():
        out.append("Ghassan is building: " + str(ghassan.STATUS.get("request") or "a request"))
    busy = anim_busy()
    if busy and not RENDERING["lock"].locked():
        out.append(str(busy))
    return out


def mark_healthy():
    """After a minute up, this version counts as good: the launcher can roll back to it if a later one doesn't start."""
    time.sleep(60)
    try:
        c = (ROOT / ".installed-commit").read_text(encoding="utf-8").strip()
        if c:
            (ROOT / ".last-good-commit").write_text(c + "\n", encoding="utf-8")
    except OSError:
        pass


def run_voice_add(pid, voice_id, name):
    VOICEWORK["what"] = "an ElevenLabs voice is being added"
    try:
        e = _animate("voice-add", pid, voice_id, name or "", timeout=900)
        atlas_says(f"**Voice added: {e['label']}.** Open the project's Voice & characters page to hear its sample; you can pick it, or have the next Short made in two voices to compare.")
    except Exception as ex:
        atlas_says(f"That voice couldn't be added: {ex}")
    finally:
        VOICEWORK["what"] = ""


def run_render_voices(eid, voices):
    """The same Short in several voices, as variants for the owner to compare. Nothing about the episode changes until he keeps one."""
    with RENDERING["lock"]:
        RENDERING["episode"] = eid
        try:
            r = checkpoint.get("versions made")   # resumed after the versions were made: only Israa's review is left
            if r is None:
                r = _animate("render-voices", eid, ",".join(voices), timeout=7200)
                e = cp.get_episode(eid)
                d = e["data"]
                d["voice_variants"] = r["variants"]
                cp.update_episode(eid, data=d)
                cp.log("Calina", "voice_variants_ready", None, {"episode": eid, "voices": [v["label"] for v in r["variants"]]})
                checkpoint.done("versions made", r)
            # review before the owner: the pictures are identical in every version, so Israa reviews version 1 (sheets, transcript,
            # stranger test) and her verdict covers all of them
            if not rules.get("review.voice_versions"):   # live rule: Israa doesn't review voice versions
                atlas_says(f"**Short #{eid} is ready in {len(r['variants'])} voices:** " + "; ".join(v["label"] for v in r["variants"])
                           + ". (Israa's review of voice versions is switched off.) Open the project's Episodes page and keep the one you like.")
                return
            atlas_says(f"**Short #{eid} is ready in {len(r['variants'])} voices.** Israa is reviewing it now (a few minutes); you'll get her verdict before you watch.")
            rv = quality.review_video(eid, version=1) or {}
            atlas_says(f"**Israa's review of Short #{eid}: {rv.get('verdict', 'unreviewed')}** ({rv.get('score', '?')}/10). {rv.get('summary', '')}\n\n"
                       "Open the project's Episodes page, watch each version, and click **Keep this voice** on the one you want: "
                       + "; ".join(v["label"] for v in r["variants"]) + ".")
        except Exception as ex:
            cp.log("Calina", "video_failed", None, {"episode": eid, "reason": str(ex)[:300]})
            atlas_says(f"Short #{eid} couldn't be made in those voices: {ex}")
        finally:
            RENDERING["episode"] = None


def keep_voice(eid, vid):
    """The owner keeps one variant: it becomes the Short, and its voice becomes the project's voice."""
    import shutil
    e = cp.get_episode(eid)
    v = next((x for x in (e["data"].get("voice_variants") or []) if x["id"] == vid), None) if e else None
    if not v:
        return None, "That voice isn't one of this Short's versions."
    folder = (ROOT / v["video"]).parent
    shutil.copy2(ROOT / v["video"], folder / "short.mp4")
    shutil.copy2(folder / (v.get("voice") or v["audio"]), folder / "voice.wav")
    if v.get("audio", "").startswith("mix"):   # the soundtrack with effects and music
        shutil.copy2(folder / v["audio"], folder / "mix.wav")
    shutil.copy2(folder / v["props"], folder / "scene-props.json")
    cp.set_project_meta(e["project_id"], voice={"id": vid, "label": v["label"]})
    d = e["data"]
    d.pop("voice_variants", None)
    cp.update_episode(eid, data=d, status="rendered", video_path=(folder / "short.mp4").relative_to(ROOT).as_posix())
    cp.log("Owner", "voice_kept", None, {"episode": eid, "voice": v["label"]})
    threading.Thread(target=run_israa_video, args=(eid,), daemon=True).start()
    return v, ""


def anim_busy():
    """Only one job at a time may use the animation tools (they share one working folder). Returns what is running, or ''."""
    if RENDERING["lock"].locked():
        return f"Calina is making Short #{RENDERING['episode']}"
    if CHARMAKING["pid"] is not None:
        return "the characters are being made"
    if ANIMTEST["pid"] is not None:
        return "Rana is writing a test scene"
    if SAMPLING["pid"] is not None:
        return "the voice samples are being made"
    if VOICEWORK["what"]:
        return VOICEWORK["what"]
    if CASTSAMPLING["pid"] is not None:
        return "the cast's voice samples are being made"
    if DESIGNING["what"]:
        return f"Rana is drawing {DESIGNING['what']}"
    if ASSETWORK["eid"] is not None:
        return f"Rana is drawing the art for video #{ASSETWORK['eid']} ({ASSETWORK['step']})"
    return ""


DESIGNING = {"what": "", "project": None}   # project: the client project whose style frames Rana is painting (2.68.3)
ASSETWORK = {"eid": None, "step": ""}


def run_assets(eid):
    """Rana draws the backdrops, props and costumes a script needs before its render (assets.py); Israa checks each piece."""
    ASSETWORK.update(eid=eid, step="starting")
    try:
        r = assets.make(eid, _animate, say=lambda m: ASSETWORK.update(step=str(m)[:160]))
        made = "; ".join(f"{x['kind']} '{x['id']}' ({x['status']}{': ' + x['israa'][:120] if x.get('israa') else ''})" for x in r.get("made") or [])
        left = r.get("still_missing") or []
        atlas_says((f"**Rana drew the art for video #{eid}:** {made}." if made else f"Video #{eid}: {r.get('note', 'nothing to draw.')}")
                   + (f"\n\nStill missing: {'; '.join((x['id'] or x['brief'][:60]) for x in left)}. See hq assets {eid}." if left else
                      f"\n\nEverything it needs exists now: it can be rendered (hq render {eid}).")
                   + (f"\n\nFailed: {'; '.join(r['failed'])[:500]}" if r.get("failed") else ""))
    except Exception as ex:
        cp.log("Rana", "assets_failed", None, {"episode": eid, "reason": str(ex)[:300]})
        atlas_says(f"Rana couldn't draw the art for video #{eid}: {ex}")
    finally:
        ASSETWORK.update(eid=None, step="")


def start_assets(eid):
    """Start Rana's drawing for an episode whose script needs art that isn't made (rule assets.auto_make). Returns what was done."""
    e = cp.get_episode(eid)
    if not e or not production.is_animated(e):
        return ""
    v = assets.view(eid)
    if not any(r["state"] in ("missing", "stale") for r in v["missing"]):
        return ""
    if ASSETWORK["eid"] == eid:
        return "Rana is already drawing it."
    if anim_busy():
        return f"Rana starts when the animation tools are free ({anim_busy()}): hq assets {eid} make."
    threading.Thread(target=run_assets, args=(eid,), daemon=True).start()
    return "Rana has started drawing what's missing; Israa checks each piece (about 10-20 minutes a piece)."


def allowance_short(agents):
    """[(agent, why)] for the agents (of these) out of today's subscription allowance, or under rule jobs.allowance_low_percent
    of it. Read only: the allowances are the owner's."""
    caps, pct, out = getattr(settings, "SUBSCRIPTION_DAILY_VALUE_USD", {}) or {}, rules.get("jobs.allowance_low_percent"), []
    for a in agents:
        cap = caps.get(a)
        # Rana, Israa and the Scout only run on the subscription; the others only count when their engine is Claude Code
        if cap and os.environ.get("HQ_SIMULATE") != "1" and (getattr(settings, "WORKER_ENGINE", {}) or {}).get(a, "claude_code") == "claude_code":
            used = cp.subscription_value_today(a)
            if cap - used <= cap * pct / 100:
                out.append((a, f"{a} has {max(0.0, 1 - used / cap):.0%} of today's allowance left (${used:.2f} of ${cap:.2f} used)"))
    return out


JOB_NEEDS = {"cast_draw": ("Rana", "Israa"), "cast_check": ("Israa",),"design": ("Rana", "Israa"), "char_review": ("Israa",), "israa_video": ("Israa",),
             "batch": ("Calina", "Israa"), "scout_refs": ("Scout",), "plan": ("Serge",), "assets": ("Rana", "Israa"),
             "style_frames": ("Rana", "Israa"), "shorts_cut": ("Omar",), "sound_review": ("Tarek",), "script_fix": ("Calina", "Israa")}   # the agents a long job can't finish without


def cast_watch():
    """A cast redraw that stopped on an agent's allowance picks up by itself once it is back (rule cast.auto_resume)."""
    if (not rules.get("cast.auto_resume") or RESTARTING["on"] or cp.STOP_FILE.exists() or anim_busy() or quality.REVIEWING.locked()
            or allowance_short(JOB_NEEDS["cast_draw"])):
        return
    for pid, k, st in cast.waiting():
        atlas_says(f"**Rana is picking up her cast v{k} for project {pid}** where it stopped ({cast.STEPS.get(st.get('step'), 'drawing')}): "
                   f"{st['wait_for']}'s allowance is back. Nothing she drew is redone.")
        threading.Thread(target=run_cast_draw, args=(pid, [], "", f"v{k}"), daemon=True).start()
        return


def run_cast_draw(pid, images, notes="", resume=""):
    """Rana redraws the project's cast from the owner's picture(s) (cast.py); the owner approves it like any characters.
    resume: '' (same pictures as an unfinished version = continue it), 'new', 'latest' or 'v<K>' (cast.pick)."""
    short = allowance_short(JOB_NEEDS["cast_draw"])
    if short and rules.get("jobs.allowance_check") == "wait":   # don't start what would stop halfway
        try:
            k = cast.pick(pid, resume, images)
        except RuntimeError:
            k = None
        if k:
            cast.mark_stopped(pid, k, short[0][1], wait_for=short[0][0])
        atlas_says(f"Rana's cast for project {pid} didn't start, so it can't stop halfway: " + "; ".join(w for _, w in short) + ". "
                   + (f"v{k} picks up where it was by itself when that's back." if k and rules.get("cast.auto_resume")
                      else "Ask again when it resets (or change the rule jobs.allowance_check)."))
        return
    if short and rules.get("jobs.allowance_check") == "warn":
        atlas_says(f"Heads-up: Rana's cast for project {pid} is starting although " + "; ".join(w for _, w in short)
                   + ". If it stops, it picks up where it stopped.")
    CHARMAKING.update(pid=pid, step="Rana is redrawing the cast from your picture, then the test clips are made and Israa compares (1-2 hours)")
    try:
        r = cast.draw(pid, images, notes, _animate, say=lambda m: CHARMAKING.update(step=m), resume=resume)
        weak = f" Israa still has doubts about: {', '.join(r['weak'])}." if r["weak"] else ""
        atlas_says(f"**Rana redrew the cast from your picture (version {r['version']}).** Israa passed {r['passed']} of {r['total']} "
                   f"characters side by side with your image.{weak}\n\n{r.get('rana_says', '')[:600]}\n\nWatch the test clips on the project's "
                   "Voice & characters page (or your phone) and approve them; no new video is made before you do. "
                   "To go back to the old characters: ask Atlas (hq cast-use <project> kit).")
    except Exception as ex:
        cp.log("Rana", "cast_failed", None, {"project": pid, "reason": str(ex)[:300]})
        atlas_says(f"Rana couldn't redraw the cast: {ex}")
    finally:
        CHARMAKING.update(pid=None, step="")


def run_cast_check(pid, k):
    """hq cast-check: render a version of Rana's cast as it is now and Israa checks it once more (cast.check), no redraw."""
    CHARMAKING.update(pid=pid, step=f"Rendering Rana's cast v{k} and Israa checks it once more")
    try:
        r = cast.check(pid, k, _animate, say=lambda m: CHARMAKING.update(step=m))
        weak = ("\n\nStill weak:\n" + "\n".join(f"- {w}" for w in r["weak"])) if r["weak"] else ""
        atlas_says(f"**Israa checked Rana's cast v{k} for project {pid} again** (freshly rendered): {r['passed']} of {r['total']} characters "
                   f"pass side by side with the owner's picture.{weak}\n\n"
                   + ("The project uses this cast: its test clips on Voice & characters are the new ones; the owner approves them there."
                      if r["in_use"] else f"The project doesn't use v{k}; to use it: hq cast-use {pid} v{k}."))
    except Exception as ex:
        cp.log("Israa", "cast_check_failed", None, {"project": pid, "version": k, "reason": str(ex)[:300]})
        atlas_says(f"Israa's check of Rana's cast v{k} didn't finish: {ex}")
    finally:
        CHARMAKING.update(pid=None, step="")


def run_design(what, brief="", name="", project=None):
    """Rana draws options, the engine renders them, Israa checks them (weak ones go back to Rana once), the owner picks."""
    DESIGNING["what"] = what
    try:
        drawn = checkpoint.get("options drawn")   # resumed: what Rana drew, rendered and Israa checked before the stop is kept
        if drawn is None:
            cp.log("Rana", "design_started", None, {"what": what})
            opts = design.ask_rana(what, brief, name=name)
            folder = design.save_options(what, opts)
            checkpoint.done("options drawn", {"opts": opts, "folder": str(folder)})
        else:
            opts, folder = drawn["opts"], Path(drawn["folder"])
        if checkpoint.get("options rendered") is None:
            _animate("design-render", folder, timeout=3600)
            checkpoint.done("options rendered")
        if project:   # 2.70.5: copied as soon as it is rendered (v2 of STRATA was rendered, then Israa hit the weekly limit, and no copy came)
            design.mirror(folder, project)
        checked = checkpoint.get("Israa's check")
        if checked is None:
            rv = design.review(folder, what, brief) if rules.get("review.design") else {}   # live rule: off = straight to the owner
            checkpoint.done("Israa's check", {"rv": rv})
        else:
            rv = {int(k): v for k, v in checked["rv"].items()}   # (JSON keys are text)
        weak = {k: r for k, r in rv.items() if r.get("verdict") == "weak"}
        if weak:
            notes = "\n".join(f"Option {k} ({opts[k - 1]['name'] if k <= len(opts) else ''}): {r.get('summary', '')} Fixes: {'; '.join(r.get('fixes') or [])}"
                               for k, r in weak.items())
            new = design.ask_rana(what, brief + f"\nRedraw only these {len(weak)} option(s), one each, fixing Israa's notes.", notes, name=name)
            for (k, _), o in zip(weak.items(), new):
                design.replace_option(folder, k, o)
            _animate("design-render", folder, timeout=3600)
            rv.update(design.review(folder, what, brief))
        state = design.write_state(folder, what, brief, "ready", rv)
        mirror = design.mirror(folder, project) if project else None
        good = sum(1 for o in state["options"] if (o.get("review") or {}).get("verdict") == "good")
        cp.log("Rana", "design_ready", None, {"what": what, "version": state["version"], "options": len(state["options"])})
        atlas_says(f"**Rana's {what} options are ready: {len(state['options'])}** "
                   + (f"({good} passed Israa's check at 64 px and on light and dark). " if rv else "(Israa's check is switched off.) ")
                   + "Look at them on the Today page or on your phone, and pick one with **Use this**."
                   + (f" A copy for project {project} (its client's bot can send these): {mirror}." if mirror else ""))
    except Exception as ex:
        cp.log("Rana", "design_failed", None, {"what": what, "reason": str(ex)[:300]})
        atlas_says(f"Rana couldn't finish the {what}: {ex}")
    finally:
        DESIGNING["what"] = ""


def run_style_frames(pid, extra=""):
    """A client's music video (client.py): Rana paints 3 looks as 16:9 scenes, the engine renders them with the 9:16 crop, Israa
    checks them (weak ones go back to Rana once), the owner picks one."""
    p = client.get(pid)
    name = p["meta"].get("name") or f"project {pid}"
    DESIGNING["what"] = f"style frames for {name}"
    DESIGNING["project"] = int(pid)
    try:
        drawn = checkpoint.get("frames painted")   # resumed: what was painted, rendered and checked before the stop is kept
        if drawn is None:
            cp.log("Rana", "style_frames_started", None, {"project": pid})
            v = client.save_frames(pid, client.ask_rana(p, extra))
            checkpoint.done("frames painted", {"folder": str(v)})
        else:
            v = Path(drawn["folder"])
        if checkpoint.get("frames rendered") is None:
            _animate("style-render", v, timeout=3600)
            checkpoint.done("frames rendered")
        checked = checkpoint.get("Israa's check")
        if checked is None:
            rv = client.review(p, v, extra) if rules.get("review.style_frames") else {}   # live rule: off = straight to the owner
            checkpoint.done("Israa's check", {"rv": rv})
        else:
            rv = {int(k): r for k, r in checked["rv"].items()}   # (JSON keys are text)
        weak = {k: r for k, r in rv.items() if r.get("verdict") == "weak"}
        if weak:
            notes = "\n".join(f"Look {i} (now frame-{i}.svg): {r.get('summary', '')} Fixes: {'; '.join(r.get('fixes') or [])}"
                               for i, (k, r) in enumerate(weak.items(), 1))
            new = client.ask_rana(p, extra + f"\nRepaint only these {len(weak)} look(s), one each, fixing Israa's notes.", notes, only=list(weak))
            for (k, _), (o, svg) in zip(weak.items(), new):
                client.write_option(v, k, o, svg)
            _animate("style-render", v, timeout=3600)
            rv.update(client.review(p, v, extra))
        state = client.write_state(pid, v, extra, "ready", rv)
        good = sum(1 for o in state["options"] if (o.get("review") or {}).get("verdict") == "good")
        cp.log("Rana", "style_frames_ready", None, {"project": pid, "version": state["version"], "options": len(state["options"])})
        atlas_says(f"**Rana's style frames for {name} are ready: {len(state['options'])} looks** "
                   + (f"({good} passed Israa's check: a real scene, the vertical crop works, safe for social media). " if rv else "(Israa's check is switched off.) ")
                   + ("Open the project's Style options page and pick one with **Use this look**." if client.is_client(p) else
                      "Sheets (`hq client " + str(pid) + "`): " + ", ".join(o.get("sheet") or "" for o in state["options"])
                      + ". The pick: `hq style-pick " + str(pid) + f" {state['version']} <option>` on the owner's word."))
    except Exception as ex:
        cp.log("Rana", "style_frames_failed", None, {"project": pid, "reason": str(ex)[:300]})
        atlas_says(f"Rana couldn't finish the style frames for {name}: {ex}")
    finally:
        DESIGNING["what"] = ""


MVRENDER = {"on": ""}   # one music video renders at a time (it uses every core)


def run_mv_render(pid, idea, version, about="", quick=False, vertical=False, by="Atlas"):
    """2.43.0: a client's music video from its edit plan (ideas/<idea>/edit.json) by musicvideo.py in the video tools' Python:
    versions/<version>/wide.mp4 (+ vertical.mp4), wide.phone.mp4 (720p, for Telegram) and review/sheet-NN.png (a frame every
    2 s, for Atlas's eyes). Its checks stop a render with a gap, a missing shot or a blank stretch, and say where."""
    p = client.get(pid)
    name = p["meta"].get("name") or f"project {pid}"
    MVRENDER["on"] = f"{name}, {idea}, {version}"
    try:
        ef = client.edit_path(pid, idea)
        out = ef.parent / "versions" / version
        py = shorts_python()
        if not py:
            raise RuntimeError("the video tools aren't set up on this computer (see SHORTS_PYTHON in settings.py)")
        cp.log(by, "mv_render_started", None, {"project": pid, "idea": ef.parent.name, "version": version, "quick": bool(quick)})
        r = subprocess.run([py, str(ROOT / "musicvideo.py"), "render", str(ef), str(out)] + (["--quick"] if quick else [])
                           + (["--vertical"] if vertical else []), cwd=ROOT, capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=4 * 3600, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        lines = (r.stdout or "").splitlines()
        res = next((l[7:] for l in lines if l.startswith("RESULT ")), None)
        if not res:
            raise RuntimeError(next((l[8:] for l in lines if l.startswith("BLOCKED ")), None)
                               or ((r.stderr or r.stdout or "no output").strip().splitlines() or ["?"])[-1][:300])
        res = json.loads(res)
        mf = out / "meta.json"
        meta = json.loads(mf.read_text(encoding="utf-8")) if mf.exists() else {}
        meta.update({"label": meta.get("label") or (f"{version}: quick test (half size)" if quick else version),
                     "made": time.strftime("%Y-%m-%d %H:%M"), "about": about or meta.get("about", ""), "by": by,
                     "seconds": res["seconds"], "video_shots": res["video_shots"], "picture_shots": res["picture_shots"]})
        mf.write_text(json.dumps(meta, indent=1, ensure_ascii=False), encoding="utf-8")
        cp.log(by, "mv_ready", None, {"project": pid, "idea": ef.parent.name, "version": version, "seconds": res["seconds"],
                                      "minutes": res["minutes"], "quick": bool(quick)})
        rel = Path(res["wide"]).relative_to(ROOT).as_posix()
        atlas_says(f"**Music video ready: {name}, {ef.parent.name}, {version}** ({res['seconds']:.0f} s: {res['video_shots']} Gemini "
                   f"videos + {res['picture_shots']} paintings; made in {res['minutes']} min"
                   + (", a QUICK TEST at half size" if quick else "") + "). Look at the frame sheets first ("
                   + ", ".join(Path(x).relative_to(ROOT).as_posix() for x in res["sheets"][:2]) + (" ..." if len(res["sheets"]) > 2 else "")
                   + f"), then send it: `hq send-phone {rel} \"caption\"`."
                   + ("\n\n**Measured:** " + res["motion"]["summary"] + "." if res.get("motion") else "")
                   + ("\n**Warnings (say these to the owner; don't call it fixed):**\n- " + "\n- ".join(res["motion"]["warnings"][:10])
                      if res.get("motion", {}).get("warnings") else ""))
    except Exception as ex:
        cp.log(by, "mv_failed", None, {"project": pid, "idea": idea, "version": version, "reason": str(ex)[:300]})
        atlas_says(f"The music video ({name}, {idea}, {version}) didn't render: {ex}")
    finally:
        MVRENDER["on"] = ""


CUTTING = {"on": ""}   # one set of Shorts is cut at a time


def shorts_source(ref):
    """The video `hq shorts` cuts from: an episode id (its finished video) or a file under content/. Returns (project id or None,
    path relative to the program folder)."""
    ref = str(ref or "").strip().strip('"')
    if ref.isdigit():
        e = cp.get_episode(int(ref))
        if not e or not e.get("video_path"):
            raise ValueError(f"Episode {ref} has no finished video yet.")
        return e.get("project_id"), Path(e["video_path"]).as_posix()
    p = Path(ref)
    p = (p if p.is_absolute() else ROOT / p).resolve()
    if (ROOT / "content").resolve() not in p.parents or p.suffix.lower() not in (".mp4", ".mov", ".mkv", ".webm") or not p.is_file():
        raise ValueError("Give an episode number or a video file under content/ (e.g. content/project-5/samples/juliane-v4.mp4).")
    m = re.match(r"content/project-(\d+)/", p.relative_to(ROOT).as_posix())
    return (int(m.group(1)) if m else None), p.relative_to(ROOT).as_posix()


SOUNDING = {"on": None}


def run_script_fix(eid, by="Builder"):
    """2.58.0 (the owner: "when any of you return with note she fixes those notes and not re-write it completely"): Calina fixes only
    the reviewer's notes (agents.fix_notes), Israa reviews the new version (her own notes go the same way), then the gate: both at
    rule script.min_score -> the owner sees it; else it waits for the next review. After rule script.gate_rounds fixes it stops."""
    e = cp.get_episode(eid)
    p = agents._project_context(e["project_id"])
    if len((e["data"] or {}).get("fix_history") or []) >= int(rules.get("script.gate_rounds")):
        cp.log("Calina", "script_stuck", None, {"episode": eid, "rounds": len(e["data"].get("fix_history") or [])})
        atlas_says(f"**Script #{eid} is stuck under the owner's score** after {rules.get('script.gate_rounds')} rounds of fixes. It stays hidden "
                   "from the owner; the Builder decides what next.")
        return
    notes = ((e["data"].get("builder_review") or {}).get("notes") or []) if by == "Builder" else ((e["data"].get("review") or {}).get("problems") or [])
    if not agents.fix_notes(eid, notes, by):
        cp.log("Calina", "script_stuck", None, {"episode": eid, "why": "no edit landed"})
        atlas_says(f"**Calina couldn't apply fixes to script #{eid}** ({by}'s notes): none of her edits matched the text. The Builder looks at it.")
        return
    quality.review_batch(p, [eid], lambda i, r: agents.fix_notes(i, r.get("problems") or [], "Israa"))
    st = agents.gate_check(eid)
    e = cp.get_episode(eid)
    if st["open"]:
        atlas_says(f"**Script #{eid} passed the gate** (Israa {st['israa']}/10, the Builder {st['builder']}/10, version {st['version']}): it is now "
                   "with the owner for approval.")
    else:
        atlas_says(f"**Calina fixed script #{eid}** ({by}'s notes; version {st['version']}). Israa now gives it {st['israa'] if st['israa'] is not None else 'no pass'}; "
                   + ("it waits for the Builder's review." if st["israa"] is not None and st["israa"] >= st["need"] else "it goes round again."))


def run_sound_review(sample, video=None, by="Atlas"):
    """2.56.0 (the owner: "can u get a professional sound and voice agent ... to critic or give advises or make it himself"): the
    sound & voice director Tarek listens to a story sample's mix through Earshot and the narrator's numbers, fixes what the sound settings can
    fix (levels, recordings, accents; rule sound.fix), rebuilds the mix and listens again (rule sound.rounds), and gives voice
    notes. Never re-voices, never touches the picture. The review: <sample folder>/sound-review.md (+ listen/review-N.json)."""
    import sound_agent
    SOUNDING["on"] = Path(sample).name
    try:
        r = sound_agent.review(ROOT / sample, (ROOT / video) if video else None, fix=bool(rules.get("sound.fix")))
        rel = (ROOT / sample).with_suffix("").relative_to(ROOT).as_posix() + "/sound-review.md"
        cp.log(sound_agent.AGENT, "sound_ready", None, {"sample": sample, "video": video, "verdict": (r or {}).get("verdict"), "review": rel, "by": by})
        notes = "".join(f"\n- line {v['line']}: {v['note']}" for v in (r or {}).get("voice_notes", [])[:6])
        atlas_says(f"**Tarek reviewed the sound of {Path(sample).name}** ({(r or {}).get('verdict')}): {(r or {}).get('summary', '')}"
                   + (f"\nVoice notes:{notes}" if notes else "") + f"\nThe full review: `{rel}`.")
    except Exception as ex:  # noqa: BLE001
        cp.log(sound_agent.AGENT, "sound_failed", None, {"sample": sample, "reason": str(ex)[:300]})
        atlas_says(f"**Tarek couldn't review the sound of {Path(sample).name}:** {str(ex)[:300]}")
    finally:
        SOUNDING["on"] = None


def run_cut_shorts(pid, video, count, by="Atlas"):
    """2.54.0 (Atlas's request; the owner: "let Omar make some shorts and show me"): Shorts cut from a finished video. The video's
    words are transcribed from its audio (clipper.py, once per video), Omar picks the strongest self-contained moments
    (omar.pick_moments, rules clips.*), clipper.py cuts them to 1080x1920 (the picture over a blurred copy, big captions, the
    video's own sound, an end card) into <video folder>/shorts/<video>/<time>/, and they go to the owner's phone for his OK.
    He uploads them himself."""
    src = ROOT / video
    CUTTING["on"] = src.name
    try:
        base = src.parent / "shorts" / src.stem
        tr = base / "transcript.json"
        if not tr.exists():
            _tool("clipper.py", "transcript", video, base.relative_to(ROOT).as_posix(), timeout=3 * 3600)
        transcript = json.loads(tr.read_text(encoding="utf-8"))
        low, high = float(rules.get("clips.min_seconds")), float(rules.get("clips.max_seconds"))
        moments = checkpoint.get("moments picked")
        if moments is None:
            moments = omar.pick_moments(pid, transcript, int(count), low, max(low + 5, high), src.stem)
            checkpoint.done("moments picked", moments)
        run_dir = checkpoint.get("folder") or (base / time.strftime("%Y%m%d-%H%M")).relative_to(ROOT).as_posix()
        checkpoint.done("folder", run_dir)
        out = ROOT / run_dir
        out.mkdir(parents=True, exist_ok=True)
        style = {"captions": rules.get("clips.captions"), "words": int(rules.get("clips.caption_words")),
                 "size": int(rules.get("clips.caption_size")), "highlight": bool(rules.get("clips.caption_highlight")),
                 "end_seconds": float(rules.get("clips.end_card_seconds")), "end_text": str(rules.get("clips.end_card_text")),
                 "channel": omar.name(pid) if pid else ""}
        plan = out / "plan.json"
        plan.write_text(json.dumps({"video": video, "words": tr.relative_to(ROOT).as_posix(), "moments": moments, "style": style},
                                   indent=1, ensure_ascii=False), encoding="utf-8")
        res = _tool("clipper.py", "cut", plan.relative_to(ROOT).as_posix(), timeout=2 * 3600)
        clips = res["clips"]
        for c in clips:
            m = next((x for x in moments if x["n"] == c["n"]), {})
            c.update(hook=m.get("hook", ""), why=m.get("why", ""))
        (out / "clips.json").write_text(json.dumps(clips, indent=1, ensure_ascii=False), encoding="utf-8")
        sent = 0
        if rules.get("clips.phone") and phone.owner_chat():
            for c in clips:
                try:
                    phone.send_file(c["file"], f"Short {c['n']} of {len(clips)} from {src.name} (Omar's pick, "
                                    f"{int(c['start'] // 60)}:{int(c['start'] % 60):02d}-{int(c['end'] // 60)}:{int(c['end'] % 60):02d})\n"
                                    f"Title: {c['title']}\n\nOK it? You upload it yourself.")
                    sent += 1
                except Exception as ex:
                    cp.log("Omar", "shorts_phone_failed", None, {"file": c["file"], "error": str(ex)[:200]})
        cp.log("Omar", "shorts_ready", None, {"project": pid, "video": video, "folder": run_dir, "clips": len(clips), "sent": sent, "by": by})
        atlas_says(f"**{len(clips)} Shorts cut from {src.name}** (Omar picked the moments; {run_dir}/):\n"
                   + "\n".join(f"- {c['n']}. \"{c['title']}\" ({c['seconds']:.0f} s, from {c['start']:.0f} s): {c['file']}" for c in clips)
                   + (f"\n{sent} sent to the owner's phone for his OK." if sent else
                      "\nNot sent to the phone (rule clips.phone off, or no phone paired): send them with `hq send-phone <file>`.")
                   + " Uploads stay the owner's.")
    except Exception as ex:
        cp.log("Omar", "shorts_failed", None, {"project": pid, "video": video, "reason": str(ex)[:300]})
        atlas_says(f"The Shorts from {src.name} couldn't be made: {ex}")
    finally:
        CUTTING["on"] = ""


def animator_test_view(p):
    try:
        return json.loads((ROOT / "content" / f"project-{p['id']}" / "animator-test" / "test.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def run_animator_test(pid, eid, index):
    """Rana writes one bespoke scene; it is rendered next to the kit's version for the owner to compare."""
    ANIMTEST["pid"] = pid
    try:
        py = shorts_python()
        if not py:
            raise RuntimeError("the video tools aren't set up on this computer (see SHORTS_PYTHON in settings.py)")
        p = subprocess.run([py, str(ROOT / "animate.py"), "animator-test", str(eid), str(index)], cwd=ROOT, capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=3600, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        lines = (p.stdout or "").splitlines()
        if not any(l.startswith("RESULT ") for l in lines):
            blocked = next((l[8:] for l in lines if l.startswith("BLOCKED ")), None)
            raise RuntimeError(blocked or ((p.stderr or p.stdout or "no output").strip().splitlines() or ["?"])[-1][:300])
        cp.log("Rana", "animator_test_ready", None, {"project": pid, "episode": eid, "scene": index})
        atlas_says("**Rana's test scene is ready.** Open the project's Voice & characters page (Rana's test scene) and watch the kit's version and the Animator's version side by side.")
    except Exception as ex:
        cp.log("Rana", "animator_test_failed", None, {"reason": str(ex)[:300]})
        atlas_says(f"Rana's test scene couldn't be made: {ex}")
    finally:
        ANIMTEST["pid"] = None


def characters_view(p):
    """The character library for an animated project: reference sheets, test clips, Israa's review, the owner's approval."""
    lib = quality.load_library(p["id"]) or {"characters": []}
    names = quality.CAST_NAMES
    return {"characters": [{"id": c["id"], "name": names.get(c["id"], c["id"]), "has_sheet": bool(c.get("sheet")), "has_clip": bool(c.get("clip")),
                            "review": (lib.get("reviews") or {}).get(c["id"])} for c in lib["characters"]],
            "made": lib.get("made"), "voice": (lib.get("voice") or {}).get("label"),
            "approved": quality.characters_ready(p), "kit": lib.get("kit") or "1", "current_kit": quality.KIT_VERSION,
            "making": CHARMAKING["step"] if CHARMAKING["pid"] == p["id"] else ""}


def run_characters(pid, clips=True):
    """Make the reference sheets (and the 30 s test clips), then Israa reviews them. Minutes, not seconds: the owner is told."""
    CHARMAKING.update(pid=pid, step="Making the characters' reference sheets and test clips (eight characters and a crowd sheet: about 40 minutes)")
    try:
        py = shorts_python()
        if not py:
            raise RuntimeError("the video tools aren't set up on this computer (see SHORTS_PYTHON in settings.py)")
        if checkpoint.get("characters made") is None:   # (animate.py itself keeps each finished character if it is cut off)
            p = subprocess.run([py, str(ROOT / "animate.py"), "characters" if clips else "sheets", str(pid)], cwd=ROOT, capture_output=True,
                               text=True, encoding="utf-8", errors="replace", timeout=5400, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            lines = (p.stdout or "").splitlines()
            if not any(l.startswith("RESULT ") for l in lines):
                blocked = next((l[8:] for l in lines if l.startswith("BLOCKED ")), None)
                raise RuntimeError(blocked or ((p.stderr or p.stdout or "no output").strip().splitlines() or ["?"])[-1][:300])
            cp.log("Calina", "characters_made", None, {"project": pid, "clips": clips})
            checkpoint.done("characters made")
        if clips:
            CHARMAKING["step"] = "Israa is checking each character against its reference sheet"
            try:
                rv = quality.review_characters(pid)
                bad = [k for k, v in rv.items() if v.get("verdict") != "pass"]
                atlas_says("**The character tests are ready.** " + ("Israa passed all of them." if not bad else
                           f"Israa wants fixes on: {', '.join(bad)} (her notes are on each character).") +
                           "\n\nOpen the project's Voice & characters page, watch each test clip and approve the characters. No new Short is made until you do.")
            except Exception as ex:
                atlas_says(f"**The character tests are made,** but Israa couldn't review them: {ex}\n\nOpen the project's Voice & characters page to watch them.")
        else:
            atlas_says("The character reference sheets are ready in the project's Voice & characters page.")
    except Exception as ex:
        cp.log("Calina", "characters_failed", None, {"reason": str(ex)[:300]})
        atlas_says(f"The characters couldn't be made: {ex}")
    finally:
        CHARMAKING.update(pid=None, step="")


def run_char_review(pid):
    CHARMAKING.update(pid=pid, step="Israa is checking each character against its reference sheet")
    try:
        quality.review_characters(pid)
        atlas_says("Israa has re-checked the characters: open the project's Voice & characters page.")
    except Exception as ex:
        atlas_says(f"Israa couldn't check the characters: {ex}")
    finally:
        CHARMAKING.update(pid=None, step="")


def run_israa_video(eid):
    quality.review_video(eid)


def run_samples(pid):
    """Make the same lines in each free voice (about 2 minutes), for the owner to pick from."""
    SAMPLING["pid"] = pid
    try:
        py = shorts_python()
        if not py:
            raise RuntimeError("the video tools aren't set up on this computer (see SHORTS_PYTHON in settings.py)")
        p = subprocess.run([py, str(ROOT / "animate.py"), "samples", str(pid)], cwd=ROOT, capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=1800, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        if not any(l.startswith("RESULT ") for l in (p.stdout or "").splitlines()):
            raise RuntimeError(((p.stderr or p.stdout or "no output").strip().splitlines() or ["?"])[-1][:300])
        atlas_says("**The voice samples are ready.** Open the project's Voice & characters page and listen to the same lines in each voice, then pick one.")
    except Exception as ex:
        atlas_says(f"The voice samples couldn't be made: {ex}")
    finally:
        SAMPLING["pid"] = None


def animate_run(py, args, timeout=3600):
    """animate.py <args> in the video tools' Python: the RESULT dict, or RuntimeError with what it said (BLOCKED or its last line)."""
    p = subprocess.run([py, str(ROOT / "animate.py")] + [str(a) for a in args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8",
                       errors="replace", timeout=timeout, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    lines = (p.stdout or "").splitlines()
    result = next((l[7:] for l in lines if l.startswith("RESULT ")), None)
    if not result:
        blocked = next((l[8:] for l in lines if l.startswith("BLOCKED ")), None)
        raise RuntimeError(blocked or ((p.stderr or p.stdout or "no output").strip().splitlines() or ["?"])[-1][:300])
    return json.loads(result)


def test_needed(e):
    """2.49.0 (rule render.test_first): an animated video's full render runs the quick test render first, unless one already passed
    on this program version and on the scenes as they are now."""
    import video_checks
    ver = (ROOT / "VERSION").read_text(encoding="utf-8").strip() if (ROOT / "VERSION").exists() else ""
    return bool(e and production.is_animated(e) and not production.is_story(e) and rules.get("render.test_first")
                and rules.get("check.video") != "off" and not video_checks.test_passed(e, ver))


def run_test_render(eid):
    """The quick test render alone (`hq render <id> --test`): a frame a second at a quarter size, same audio, the automatic checks."""
    with RENDERING["lock"]:
        RENDERING["episode"] = eid
        try:
            py = shorts_python()
            if not py:
                raise RuntimeError("the video tools aren't set up on this computer (see SHORTS_PYTHON in settings.py)")
            r = animate_run(py, ["render", eid, "--test"])
            # 2.53.0 (the owner: "review the video yourself before rendering"): Atlas reads the test's contact sheets first
            look = (f"Read its {len(r['sheets'])} contact sheet(s) first: `hq frames {eid} test`." if r.get("sheets")
                    else "No contact sheets were made: watch it before a full render.")
            atlas_says(f"**Test render of video #{eid} {'passed the checks' if r['ok'] else 'has faults (rule check.video is warn)'}** "
                       f"({r['seconds'] / 60:.1f} min; {r['checks']}). Watch it: {r.get('video') or 'test.mp4'}. {look} "
                       f"Then a full render (`hq render {eid}`) may go.")
        except Exception as ex:
            cp.log("Calina", "video_failed", None, {"episode": eid, "reason": str(ex)[:300], "test": True})
            atlas_says(f"**Test render of video #{eid} failed:** {ex}")
        finally:
            RENDERING["episode"] = None


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
            animated = bool(e and production.is_animated(e))
            story = bool(e and production.is_story(e))   # 2.48.0: a long narrated story (story.py, the owner's flat Fable look)
            mode = "assemble" if e and production.is_v2(e) else "render"
            script = "story.py" if story else "animate.py" if animated else "shorts.py"
            r = checkpoint.get("video made")   # resumed after the video was made: only Israa's review is left
            if r is None and checkpoint.get("test passed") is None and test_needed(e):   # 2.49.0: a quick test render first
                try:
                    t = animate_run(py, ["render", eid, "--test"])
                except RuntimeError as ex:
                    raise RuntimeError(f"the test render (done before every full render) failed, so the full render didn't start. {ex}")
                checkpoint.done("test passed", t)
                atlas_says(f"Video #{eid}: the test render passed the checks ({t['checks']}); the full render is starting.")
            if r is None:
                p = subprocess.run([py, str(ROOT / script), "render" if (animated or story) else mode, str(eid)], cwd=ROOT, capture_output=True,
                                   text=True, encoding="utf-8", errors="replace", timeout=4 * 3600 if story else 3600 if animated else 1800,
                                   creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
                lines = (p.stdout or "").splitlines()
                result = next((l[7:] for l in lines if l.startswith("RESULT ")), None)
                if not result:
                    blocked = next((l[8:] for l in lines if l.startswith("BLOCKED ")), None)
                    raise RuntimeError(blocked or ((p.stderr or p.stdout or "no output").strip().splitlines() or ["?"])[-1][:300])
                r = json.loads(result)
                cp.log("Calina", "video_ready", None, {"episode": eid, "title": r["title"], "seconds": r["seconds"]})
                checkpoint.done("video made", r)
            if story:   # 2.48.0: Israa reads the contact sheets and the shot plan of a story video
                try:
                    rv = quality.review_story_video(eid) if rules.get("review.video") else None
                except (workers.Unavailable, cp.Halt) as ex:
                    rv = {"verdict": "unreviewed", "summary": f"Israa couldn't review it: {str(ex)[:200]}", "problems": []}
                    cp.log("Israa", "halted", None, {"reason": str(ex)[:300], "episode": eid})
            else:
                rv = quality.review_video(eid) if rules.get("review.video") else None   # Israa looks at it before the owner does (live rule)
            pace = (f" The voice still reads at {r['wpm']} words a minute even after slowing it: lower the speed in OpenArt's "
                    "text-to-speech next time." if r.get("wpm", 0) > 158 else "")
            what = (f"{r['shots']} shots, narrator {r.get('voice', '')} ({r.get('wpm', '?')} wpm), measured: {r.get('motion') or 'n/a'}"
                    + (f"; warnings: {'; '.join(str(w) for w in r['warnings'][:3])}" if r.get("warnings") else "") if story else
                    f"{r['images']} animated scenes, voice: {r.get('voice', '')}" if animated else
                    f"{r['images']} clips" if mode == "assemble" else f"{r['images']} public-domain images")
            verdict = ""
            if rv:
                word = {"release": "she says it is good enough to publish", "redo": "she says it is NOT good enough and should be redone",
                        "unreviewed": "she couldn't review it"}.get(rv["verdict"], rv["verdict"])
                top = "; ".join(f"[{x.get('area', '')}] {x['issue']}" for x in (rv.get("problems") or [])[:3])
                verdict = (f"\n\n**Israa looked at it:** {word} ({rv.get('score', '?')}/10). {rv.get('summary', '')}"
                           + (f"\nHer main problems: {top}" if top and rv["verdict"] != "release" else ""))
            checks = f" Automatic checks: {r['checks']}." if r.get("checks") else ""   # 2.49.0 (video_checks.py)
            atlas_says(f"**{'Video' if story else 'Short'} #{eid} is ready:** {r['title']} ({r['seconds'] / 60:.1f} min, {what}).{checks}{pace}{verdict}\n\n"
                       "Watch it in the project's Episodes page. If it's good, upload it by hand with the title and description shown "
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


def studio_loop():
    """The Studio (2.41.0, studio.py): keep the Mac's instructions in the private repo and bring its results into the projects."""
    time.sleep(30)
    try:
        studio.publish_instructions()
    except Exception as e:
        studio.STATUS["error"] = str(e)[:300]
        print("Studio:", e, flush=True)
    while True:
        try:
            for jid, pid, folder, res in studio.collect():
                n, bad = len(res.get("files") or []), len(res.get("failed") or [])
                atlas_says(f"**The Mac's studio sent back job {jid}** (project {pid}): {n} file(s)" + (f", {bad} not made" if bad else "")
                           + f". They're in `{folder}`." + (f" Note from the Mac: {str(res.get('notes'))[:400]}" if res.get("notes") else ""))
            studio.STATUS["error"] = ""
        except Exception as e:
            studio.STATUS["error"] = str(e)[:300]
            print("Studio:", e, flush=True)
        time.sleep(60 * max(1, int(getattr(settings, "STUDIO_EVERY_MINUTES", 3))))


def omar_loop():
    """Omar (2.44.0, omar.py): the channel's numbers once a day and his weekly note, at the hours his rules set. After a failure he
    waits an hour before trying again (YouTube's daily quota)."""
    time.sleep(45)
    while True:
        rules.apply_all()
        try:   # reach reports (impressions/CTR) are set up as soon as a channel is connected: YouTube keeps nothing from before
            for msg in ([] if RESTARTING["on"] or cp.STOP_FILE.exists() else omar.reach_jobs()):
                atlas_says(f"**Omar:** {msg}")
        except Exception as e:
            print("Omar reach:", repr(e)[:300], flush=True)
        try:   # a channel that failed waits an hour (omar.due); the other channels go on (2.52.0)
            job = None if RESTARTING["on"] or cp.STOP_FILE.exists() else omar.due()
            if job:
                run_omar(*job)
        except Exception as e:
            print("Omar:", repr(e)[:300], flush=True)
        time.sleep(300)


def run_omar(what, pid=None):
    """One of Omar's jobs on one channel: daily (the numbers, a line to Atlas) or weekly (his note: Atlas, the phone, Calina)."""
    pid = int(pid or omar.project())
    if what == "daily":
        atlas_says(f"**Omar ({omar.name(pid)}):** " + omar.daily(pid))
        return
    headline, path = omar.weekly(pid)
    rel = str(path.relative_to(ROOT)).replace("\\", "/")
    atlas_says(f"**Omar's weekly note on {omar.name(pid)} is ready:** {headline}\n\nIt's in `{rel}`. Read it before you suggest the next batch.")
    if rules.get("omar.weekly_to_phone"):
        # Sent at once, not through phone.notify: in the calm mode notify only keeps a headline for the next morning's digest, so
        # the 2026-10-19 notes never reached him. Long notes are split by phone.send.
        try:
            ok = bool(phone.send("📈 " + path.read_text(encoding="utf-8")))
            err = "" if ok else "no phone paired"
        except Exception as e:
            ok, err = False, str(e)[:200]
        cp.log("Omar", "omar_weekly_phone", None, {"project": pid, "note": rel, "ok": ok, "error": err})
        if not ok:
            atlas_says(f"**Omar's weekly note on {omar.name(pid)} didn't reach the owner's phone** ({err}). Send it with `hq send-phone {rel}`.")
    if rules.get("omar.feed_calina"):
        if (cp.get_project(pid, with_text=False) or {}).get("status") == "approved":
            threading.Thread(target=run_review, args=(pid, omar.calina_stats(path, pid)), daemon=True).start()


def run_youtube_connect(pid):
    try:
        youtube.connect(pid)
    except Exception as e:
        atlas_says(f"**YouTube didn't connect for {omar.name(pid)}:** {youtube.STATE['error'].get(int(pid)) or e}")
        return
    cp.log("Owner", "youtube_connected", None, {"project": pid})
    try:
        run_omar("daily", pid)
    except Exception as e:
        atlas_says(f"**YouTube is connected for {omar.name(pid)},** but Omar's first look at the channel failed: {str(e)[:300]}")


def _omar_pid(body):
    """The channel a request is about: body/query 'project', else Omar's first channel. Only projects Omar looks after."""
    try:
        pid = int(body.get("project") or omar.project())
    except (TypeError, ValueError):
        pid = omar.project()
    if pid not in omar.projects():
        raise ValueError(f"Omar doesn't look after project {pid}'s channel (rule omar.projects = {rules.get('omar.projects')}).")
    return pid


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
        rules.apply_all()   # Doulya's schedule is a live rule
        try:
            if not RESTARTING["on"] and getattr(settings, "SCOUT_AUTOMATICALLY", False) and not cp.STOP_FILE.exists() and not agents.scouted_today():
                run_scout("schedule")
        except Exception as e:
            print("scheduler:", repr(e), flush=True)
        try:
            cast_watch()   # Rana's cast that waits for an allowance
        except Exception as e:
            print("cast watch:", repr(e), flush=True)
        time.sleep(600)


LIMIT_NOTE = [""]
LIMIT_UNTIL = [0.0]   # while Atlas's plan limit is reached, skip Claude Code on this computer until this time
CLOUD_REASONS = ("isn't installed", "isn't signed in")


def ask_atlas(text):
    """Atlas in Claude Code when available; when the plan limit is reached (or he's signed out) Atlas in the cloud on
    Sonnet; the small in-app Atlas on the API key only as the last resort."""
    with LOCK:
        news = NEWS[:]
        NEWS.clear()
    if atlas_engine.engine() != "claude_code":
        return ATLAS.chat(text)
    prompt = text
    if news:
        prompt = ("[Office updates the system posted in your name since your last reply; the owner has seen them]\n"
                  + "\n\n".join(news) + "\n\n[The owner's message]\n" + text)
    why = None
    if time.time() < LIMIT_UNTIL[0]:
        why = LIMIT_NOTE[0] or "Claude plan limit reached"
    else:
        warn = full_path("Atlas")
        if warn:
            cp.log("Atlas", "path_warning", None, {"warning": warn, "path": os.environ.get("PATH", "")[:2000]})
        try:
            reply, info = atlas_engine.ask(prompt)
            cp.log("Atlas", "model_call", None, info)
            return reply
        except atlas_engine.Unavailable as e:
            reset = atlas_cloud.limit_reset(str(e))
            if reset:
                LIMIT_UNTIL[0], LIMIT_NOTE[0] = reset, atlas_cloud.limit_note(str(e))
            if reset or any(r in str(e) for r in CLOUD_REASONS):
                why = LIMIT_NOTE[0] if reset else str(e)
            else:
                cp.log("Atlas", "halted", None, {"reason": f"Claude Code unavailable, backup Atlas answered: {e}"})
                print("Atlas via Claude Code unavailable:", e, flush=True)
                return f"_(Backup Atlas answering: Claude Code isn't available right now. {e})_\n\n" + (ATLAS.chat(text) or "")
            cp.log("Atlas", "halted", None, {"reason": f"Claude Code unavailable, cloud Atlas answers: {e}"})
            print("Atlas via Claude Code unavailable:", e, flush=True)
    if atlas_cloud.configured():
        try:
            reply, info = atlas_cloud.ask(prompt, why)
            cp.log("Atlas", "model_call", None, info)
            with LOCK:   # so the Atlas on this computer knows what happened while he was away
                NEWS.append("While your plan limit was reached, the cloud Atlas answered the owner.\nOwner: " + text[:600]
                            + "\nCloud Atlas: " + reply[:1500])
            return "_(Cloud Atlas answering: " + (why or "Claude Code isn't available") + ")_\n\n" + reply
        except atlas_cloud.CloudUnavailable as e:
            cp.log("Atlas", "halted", None, {"reason": f"Cloud Atlas unavailable, backup Atlas answered: {e}"})
            print("Cloud Atlas unavailable:", e, flush=True)
            return f"_(Backup Atlas answering: {why}. Cloud Atlas isn't available either: {e})_\n\n" + (ATLAS.chat(text) or "")
    return f"_(Backup Atlas answering: {why}. Cloud Atlas isn't set up yet.)_\n\n" + (ATLAS.chat(text) or "")


UPLOADS = atlas_engine.HOME / "review" / "uploads"   # images the owner attaches in the chat, where Atlas's Read can open them
MAX_UPLOAD = 8 * 1024 * 1024
MAX_UPLOADS = 4


def save_uploads(items):
    """The chat's attached images: [{name, data (base64 or data: URL)}] -> saved file names. Images only, checked by their bytes."""
    import base64
    import linkpeek
    names = []
    for it in (items or [])[:MAX_UPLOADS]:
        raw = str(it.get("data", ""))
        raw = raw.split(",", 1)[1] if raw.startswith("data:") else raw
        try:
            data = base64.b64decode(raw, validate=False)
        except ValueError:
            raise ValueError("One of the images couldn't be read.")
        if len(data) > MAX_UPLOAD:
            raise ValueError(f"Each image can be at most {MAX_UPLOAD // (1024 * 1024)} MB.")
        names.append(linkpeek.save_image(data, UPLOADS, Path(str(it.get("name") or "image")).stem).name)
    return names


# ---- Atlas autopilot (2.34.0, the owner's yes in the Builder chat, 2026-10-11) -----------------------------------------------
# The office wakes Atlas by itself: when work finishes or fails (WAKE_KINDS) and at least every atlas.autopilot_minutes while
# something waits. He acts within the owner's standing orders (atlas-journal.md). Quiet: his autopilot replies go to the office
# chat, never to the phone (he sends the owner something himself only when it matters). Rules in atlas/CLAUDE.md.
WAKE_KINDS = ("video_ready", "video_reviewed", "video_failed", "batch_ready", "script_reviewed", "halted", "bespoke_failed",
              "ready_to_ship", "ghassan_shipped", "job_given_up", "assets_ready", "assets_failed", "studio_ready", "studio_failed",
              "mv_ready", "mv_failed", "shorts_ready", "shorts_failed", "sound_ready", "sound_failed", "script_ready", "script_stuck")
AUTOPILOT = {"last_wake": 0.0, "last_event": 0, "wakes": 0}


def autopilot_brief(new_events):
    lines = [f"- {time.strftime('%H:%M', time.localtime(e['ts']))} {e['agent']} {e['kind']} {json.dumps(e.get('detail') or {})[:220]}"
             for e in new_events[-25:]]
    approve = ("You MAY approve a script whose Israa verdict is 'pass' and render it (`hq autopilot-approve <id>`, then `hq render <id>`)."
               if rules.get("atlas.autopilot_approve") else "You may NOT approve scripts: they wait for the owner.")
    return ("[AUTOPILOT: the office woke you by itself; the owner is not reading this. Act within his standing orders in your "
            "journal. Take the NEXT step only (start, retry, review, render, report); one thing at a time; never upload, never "
            "spend money, never change limits or the owner-only rules. " + approve + " If a video is finished AND Israa checked "
            "it, send it to the owner's phone with her verdict in one line. If nothing needs doing, answer only 'Nothing to do.']\n"
            "What happened since your last wake:\n" + ("\n".join(lines) if lines else "- nothing new"))


def autopilot_loop():
    time.sleep(90)
    while True:
        try:
            rules.apply_all()
            if rules.get("atlas.autopilot") and not RESTARTING["on"] and not cp.STOP_FILE.exists():
                with cp._db() as con:
                    rows = con.execute("SELECT id, ts, agent, kind, detail FROM events WHERE id > ? ORDER BY id",
                                       (AUTOPILOT["last_event"],)).fetchall()
                new = [{"id": r[0], "ts": r[1], "agent": r[2], "kind": r[3], "detail": json.loads(r[4] or "{}")} for r in rows]
                if not AUTOPILOT["last_event"]:   # first pass after a start: only what happens from now on
                    AUTOPILOT["last_event"] = new[-1]["id"] if new else 0
                    new = []
                wake = any(e["kind"] in WAKE_KINDS for e in new) or \
                    (time.time() - AUTOPILOT["last_wake"] > rules.get("atlas.autopilot_minutes") * 60 and (bool(new) or not office_idle()))
                with LOCK:
                    busy = STATE["busy"]
                if wake and not busy:
                    with LOCK:
                        STATE["busy"] = True
                    AUTOPILOT.update(last_wake=time.time(), last_event=new[-1]["id"] if new else AUTOPILOT["last_event"])
                    AUTOPILOT["wakes"] += 1
                    cp.log("Atlas", "autopilot_wake", None, {"events": len(new)})
                    try:
                        reply = ask_atlas(autopilot_brief([e for e in new if e["kind"] not in ("model_call", "autopilot_wake")]))
                    except Exception as e:  # noqa: BLE001
                        reply = f"(autopilot wake failed: {e})"
                    with LOCK:
                        if reply and reply.strip().rstrip(".").lower() != "nothing to do":
                            CHAT.append({"from": "atlas", "ts": time.time(), "text": "(Autopilot) " + reply})
                        STATE["busy"] = False
                    pending_new_chat()
        except Exception as e:  # noqa: BLE001
            print("autopilot:", repr(e), flush=True)
            with LOCK:
                STATE["busy"] = False
        time.sleep(60)


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
    phone.atlas_replied(reply)
    pending_new_chat()


# ---- A fresh Atlas chat (Atlas's request 2026-10-11: the conversation ran for days and lost details) -------------------------
NEW_CHAT = {}   # asked for while Atlas was answering (e.g. his own `hq atlas-new`): it starts right after that reply


def new_atlas_chat(by, why=""):
    """End Atlas's conversation and start a fresh one that first reads his journal (rule atlas.new_chat_note)."""
    with LOCK:
        if STATE["busy"]:
            NEW_CHAT.update(by=by, why=why)
            return "A fresh Atlas chat starts as soon as he finishes his current reply."
        STATE["busy"] = True
    threading.Thread(target=_fresh_chat, args=(by, why), daemon=True).start()
    return "Starting a fresh Atlas chat. He reads his journal first, then says where things stand."


def _fresh_chat(by, why):
    atlas_engine.new_conversation()   # the local Claude Code session
    ATLAS.messages.clear()            # the backup API Atlas
    who = "Owner" if by == "owner" else "Atlas"
    cp.log(who, "atlas_new_chat", None, {"why": str(why)[:300]})
    with LOCK:
        CHAT.append({"from": "atlas", "ts": time.time(),
                     "text": f"(New chat started by {'you' if by == 'owner' else 'Atlas'}{': ' + why[:200] if why else ''}. "
                             "Atlas is reading his journal.)"})
    run_chat(rules.get("atlas.new_chat_note") or rules.RULES["atlas.new_chat_note"]["default"])


def pending_new_chat():
    with LOCK:
        p = dict(NEW_CHAT)
        NEW_CHAT.clear()
    if p:
        new_atlas_chat(p["by"], p["why"])


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

    def _remote_gate(self):
        """Another computer (over Tailscale) that hasn't entered the access code: the sign-in page, nothing else (remote.py)."""
        u = urlparse(self.path)
        if self.command == "POST" and u.path == "/api/remote/sign-in":
            body = self._json_body()
            cookie, why = remote.sign_in(self, body.get("code"), body.get("label"))
            if not cookie:
                cp.log("Owner", "remote_sign_in_failed", None, {"ip": self.client_address[0]})
                return self._send(403, {"error": why})
            cp.log("Owner", "remote_signed_in", None, {"ip": self.client_address[0], "device": str(body.get("label") or "")[:80]})
            data = json.dumps({"ok": True}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Set-Cookie", cookie)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if self.command == "GET" and u.path in ("/", "/index.html"):
            return self._send(200, remote.LOGIN_PAGE.encode(), "text/html")
        return self._send(401, {"error": "Sign in with the office's access code first."})

    def do_GET(self):
        if not remote.allowed(self):
            return self._remote_gate()
        u = urlparse(self.path)
        if u.path == "/api/remote":   # Spend & limits -> Your other computers (the code only on this PC)
            return self._send(200, remote.view(self))
        if u.path == "/api/studio":   # the Mac's studio: open jobs and imported results (hq studio-status)
            return self._send(200, {"jobs": studio.jobs(), "error": studio.STATUS["error"], "repo_set": bool(studio.repo())})
        if u.path in ("/", "/index.html"):
            return self._send(200, (ROOT / "office.html").read_bytes(), "text/html")
        if u.path == "/api/phone":   # the office's 'Your phone' card (never the token)
            return self._send(200, phone.view())
        if u.path == "/api/clients":   # 2.67.0: clients' bots (never a token; the pairing code only on this PC)
            local = remote.is_local(self)
            return self._send(200, {"clients": clientbot.clients(local),
                                    "outbox": [o for o in clientbot.outbox() if o["state"] == "waiting"][-20:] if local else []})
        if u.path == "/api/omar":   # Omar and the YouTube connection (never the client secret or the token)
            return self._send(200, omar.view())
        if u.path == "/api/channel-stats":   # the newest snapshot of a channel (hq channel-stats [project])
            q = parse_qs(u.query)
            try:
                pid = _omar_pid({"project": (q.get("project") or [""])[0]})
            except ValueError as e:
                return self._send(400, {"error": str(e)})
            snaps = omar.snapshots(pid, n=1)
            return self._send(200, snaps[-1]) if snaps else self._send(404, {"error": f"No snapshot of {omar.name(pid)} yet: connect it, then hq omar now {pid}."})
        if u.path == "/api/rules":   # the team's live rules (Spend & limits -> Team rules; hq rule list)
            return self._send(200, {"rules": rules.view()})
        if u.path.startswith("/api/prompt/"):   # an agent's instructions as they are now
            a = u.path.rsplit("/", 1)[1].capitalize()
            if a not in rules.AGENTS:
                return self._send(404, {"error": f"Agents with instructions: {', '.join(rules.AGENTS)}"})
            own = rules.get(f"prompt.{a}")
            return self._send(200, {"agent": a, "replaced": bool(own.strip()), "text": own if own.strip() else rules.code_text(a),
                                    "extra": rules.get(f"prompt.{a}.extra"), "history": rules.history(f"prompt.{a}", 5)
                                    + rules.history(f"prompt.{a}.extra", 5)})
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
                "episodes": with_upload_text(cp.list_episodes(limit=40)), "producing": agents.PRODUCING.locked(), "producing_project": agents.PRODUCING_FOR[0],
                "rendering": RENDERING["episode"],
                "refboards": {p["id"]: cp.latest_refboard(p["id"]) for p in cp.list_projects(20) if p["status"] == "approved"},
                "board_unlocked": {p["id"]: bool(quality.style_bar(p["id"])) for p in cp.list_projects(20) if p["status"] == "approved"},
                "eleven": {"configured": elevenlabs.configured(), "chars_month": cp.eleven_chars_month(),
                           "limit": getattr(settings, "ELEVEN_MONTHLY_CHARS", 30000)},
                "characters": {p["id"]: characters_view(p) for p in cp.list_projects(20) if p["status"] == "approved" and (p.get("meta") or {}).get("format") == "animated_v1"},
                "animator_test": {p["id"]: dict(animator_test_view(p) or {}, making=ANIMTEST["pid"] == p["id"]) for p in cp.list_projects(20)
                                  if p["status"] == "approved" and (p.get("meta") or {}).get("format") == "animated_v1"},
                "scouting_refs": quality.SCOUTING.locked(), "reviewing": quality.REVIEWING.locked(),
                "lnd": cp.list_lnd_ideas(30), "lnd_status": lnd.STATUS, "lnd_report": lnd.REPORT,
                "omar": omar.view(),
                "voice_samples": {p["id"]: voice_samples(p) for p in cp.list_projects(20) if p["status"] == "approved" and (p.get("meta") or {}).get("format") == "animated_v1"},
                "designs": [d for d in design.open_designs() if d.get("status") == "ready"],
                "client": {p["id"]: client.view(p) for p in cp.list_projects(20) if client.is_client(p)},
                "designing": DESIGNING["what"],
                "designing_project": DESIGNING.get("project") if DESIGNING["what"] else None,
                "ghassan": dict(ghassan.STATUS, pending={k: v for k, v in (ghassan.pending() or {}).items() if k != "diff"} or None),
                "voice_match": {p["id"]: voice_match_view(p) for p in cp.list_projects(20) if p["status"] == "approved" and (p.get("meta") or {}).get("format") == "animated_v1"},
                "cast": {p["id"]: cast_view(p) for p in cp.list_projects(20) if p["status"] == "approved" and (p.get("meta") or {}).get("format") == "animated_v1"},
                "music": {p["id"]: music_view(p) for p in cp.list_projects(20) if p["status"] == "approved" and (p.get("meta") or {}).get("format") == "animated_v1"},
                "production": {p["id"]: agents.production_summary(p["id"]) for p in cp.list_projects(20) if p["status"] == "approved"},
                "usage": cp.usage_today(), "allowance": getattr(settings, "SUBSCRIPTION_DAILY_VALUE_USD", {}),
                "engines": {a: workers.engine(a) for a in cp.WORKERS},
                "limits": cp.limits_view(),
                "scouting": agents.SCOUTING.locked(),
                "last_scout": cp.last_event_time("scout_done", "Doulya"),
                "atlas_limit": {"until": LIMIT_UNTIL[0], "note": LIMIT_NOTE[0]} if time.time() < LIMIT_UNTIL[0] else None,
                "chat": chat, "busy": busy, "atlas_engine": atlas_engine.engine(), "atlas_cloud": atlas_cloud.configured(),
                "spend_today": round(cp.spend_today(), 4),
                "daily_cap": settings.DAILY_AI_BUDGET_USD,
                "idea_cap": settings.PER_IDEA_BUDGET_USD,
                "kill": cp.STOP_FILE.exists(),
                "version": (ROOT / "VERSION").read_text(encoding="utf-8").strip() if (ROOT / "VERSION").exists() else "",
                "simulated": os.environ.get("HQ_SIMULATE") == "1",
                "has_key": bool(os.environ.get("ANTHROPIC_API_KEY")) or os.environ.get("HQ_SIMULATE") == "1"
                           or (ROOT / ".no-api-key").exists(),   # subscription only by choice: no "no key" banner
            })
        if u.path.startswith("/api/variant/"):   # /api/variant/<episode>/<n>: one voice version of a Short
            try:
                eid, n = u.path.strip("/").split("/")[2:4]
                e = cp.get_episode(int(eid))
                path = ROOT / (e["data"].get("voice_variants") or [])[int(n)]["video"]
                ok = path.exists()
            except (ValueError, IndexError, KeyError, TypeError):
                ok = False
            if not ok:
                return self._send(404, {"error": "no such version"})
            return self._send_file(path, "video/mp4")
        if u.path.startswith("/api/video/"):
            try:
                e = cp.get_episode(int(u.path.rsplit("/", 1)[1]))
            except ValueError:
                e = None
            path = ROOT / e["video_path"] if e and e["video_path"] else None
            if not path or not path.exists():
                return self._send(404, {"error": "no video"})
            return self._send_file(path, "video/mp4")
        if u.path.startswith("/api/anim-file/"):   # /api/anim-file/<project>/<kit.mp4|animator.mp4|scene.jsx>
            try:
                pid, name = u.path.strip("/").split("/")[2:4]
                path = ROOT / "content" / f"project-{int(pid)}" / "animator-test" / Path(name).name
                ok = Path(name).name in ("kit.mp4", "animator.mp4") and path.exists()
            except (ValueError, IndexError):
                ok = False
            if not ok:
                return self._send(404, {"error": "no such file"})
            return self._send_file(path, "video/mp4")
        if u.path.startswith("/api/char-file/"):   # /api/char-file/<project>/<character>/<reference-sheet.png|test.mp4>
            try:
                pid, who, name = u.path.strip("/").split("/")[2:5]
                path = ROOT / "content" / f"project-{int(pid)}" / "characters" / Path(who).name / Path(name).name
                ok = Path(name).name in ("reference-sheet.png", "test.mp4") and path.exists()
            except (ValueError, IndexError):
                ok = False
            if not ok:
                return self._send(404, {"error": "no such file"})
            return self._send_file(path, "image/png" if path.suffix == ".png" else "video/mp4")
        if u.path == "/api/ghassan/diff":   # the full change waiting for the owner's Ship click
            p = ghassan.pending() or {}
            return self._send(200, {"title": p.get("title"), "stat": p.get("stat", ""), "diff": p.get("diff", ""), "cut": p.get("diff_cut")})
        if u.path == "/api/design":   # Rana's design options waiting for the owner, and the chosen ones
            return self._send(200, {"designs": design.open_designs()})
        if u.path.startswith("/api/brand/"):   # /api/brand/<slug>/v<N>/option-<k>/<file>.png: Rana's renders
            rel = u.path[len("/api/brand/"):]
            path = (design.BRAND / rel).resolve()
            if design.BRAND.resolve() not in path.parents or path.suffix.lower() != ".png" or not path.exists():
                return self._send(404, {"error": "no such image"})
            return self._send_file(path, "image/png")
        if u.path.startswith("/api/client/"):   # /api/client/<pid>/song | /api/client/<pid>/file/<path under the project's folder>.png
            parts = u.path.strip("/").split("/")
            try:
                pid = int(parts[2])
                client.get(pid)
            except (IndexError, ValueError):
                return self._send(404, {"error": "no such client project"})
            if parts[3:4] == ["song"]:
                f = client.song_file(pid)
                types = {".mp3": "audio/mpeg", ".wav": "audio/wav", ".flac": "audio/flac", ".ogg": "audio/ogg", ".m4a": "audio/mp4"}
                return self._send_file(f, types.get(f.suffix, "application/octet-stream")) if f else self._send(404, {"error": "no song yet"})
            if parts[3:4] == ["video"] and parts[4:5] in (["vertical"], ["wide"]):
                f = client.folder(pid) / "videos" / f"video-{parts[4]}.mp4"
                return self._send_file(f, "video/mp4") if f.exists() else self._send(404, {"error": "not made yet"})
            if parts[3:4] == ["idea"] and len(parts) == 7:   # /api/client/<pid>/idea/<idea>/<version>/<wide|vertical|clip-x>.mp4
                f = client.version_file(pid, parts[4], parts[5], parts[6])
                return self._send_file(f, "video/mp4") if f else self._send(404, {"error": "no such video"})
            if parts[3:4] == ["file"]:
                base = client.folder(pid).resolve()
                path = (base / "/".join(parts[4:])).resolve()
                if base not in path.parents or path.suffix.lower() != ".png" or not path.exists():
                    return self._send(404, {"error": "no such image"})
                return self._send_file(path, "image/png")
            return self._send(404, {"error": "not found"})
        if u.path.startswith("/api/upload/"):   # /api/upload/<file>: an image the owner attached in the chat
            name = Path(u.path.rsplit("/", 1)[1]).name
            path = UPLOADS / name
            types = {".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif"}
            if path.suffix.lower() not in types or not path.exists():
                return self._send(404, {"error": "no such image"})
            return self._send_file(path, types[path.suffix.lower()])
        if u.path.startswith("/api/voice-ref/"):   # /api/voice-ref/<project>: the recorded reference clip
            try:
                path = ROOT / "content" / f"project-{int(u.path.strip('/').split('/')[2])}" / "voice-ref" / "reference.wav"
            except (ValueError, IndexError):
                path = None
            if not path or not path.exists():
                return self._send(404, {"error": "no reference"})
            return self._send_file(path, "audio/wav")
        if u.path.startswith("/api/cast-sample/"):   # /api/cast-sample/<project>/<character>
            try:
                pid, who = u.path.strip("/").split("/")[2:4]
                path = ROOT / "content" / f"project-{int(pid)}" / "voice-samples" / "cast" / f"{Path(who).name}.mp3"
            except (ValueError, IndexError):
                path = None
            if not path or not path.exists():
                return self._send(404, {"error": "no sample"})
            return self._send_file(path, "audio/mpeg")
        if u.path.startswith("/api/music/"):   # /api/music/<track id>: downloaded once (free, credited)
            mid = u.path.rsplit("/", 1)[1]
            try:
                path = sfx.music_path(mid)
            except OSError:
                path = None
            if not path or not path.exists():
                return self._send(404, {"error": "no such track"})
            return self._send_file(path, "audio/mpeg")
        if u.path.startswith("/api/voice-sample/"):   # /api/voice-sample/<project>/<voice id>
            try:
                pid, vid = u.path.strip("/").split("/")[2:4]
                path = ROOT / "content" / f"project-{int(pid)}" / "voice-samples" / f"{Path(vid).name}.mp3"
            except (ValueError, IndexError):
                path = None
            if not path or not path.exists():
                return self._send(404, {"error": "no sample"})
            return self._send_file(path, "audio/mpeg")
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
        if not remote.allowed(self):
            return self._remote_gate()
        u = urlparse(self.path)
        if u.path == "/api/remote/new-code":   # this PC only: a fresh code, every other computer signed out
            if not remote.is_local(self):
                return self._send(403, {"error": "A new code can only be made on the PC itself."})
            c = remote.new_code()
            cp.log("Owner", "remote_new_code", None, {})
            return self._send(200, {"ok": True, "code": remote.pretty(c), "message": "New code made. Every other computer is signed out."})
        if u.path == "/api/studio":   # a job for the Mac's studio (hq studio ...; studio.py)
            body = self._json_body()
            by = "Owner" if body.get("by") == "owner" else "Atlas"
            try:
                job = studio.request(body.get("project"), body.get("kind"), body.get("count", 1), body.get("brief"),
                                     body.get("shape") or "9:16", body.get("refs") or [], by)
            except (studio.StudioError, ValueError, TypeError) as e:
                return self._send(400, {"error": str(e)})
            return self._send(200, {"ok": True, "job": job, "message": f"Studio job {job['id']} is waiting for the Mac: open Claude "
                                    "Code on the Mac in the Studio folder and say \"do the studio jobs\"."})
        if u.path == "/api/remote/sign-out":   # the computer you're on
            remote.sign_out(self)
            return self._send(200, {"ok": True, "message": "Signed out."})
        if u.path == "/api/chat":
            body = self._json_body()
            text, warning = clip(body.get("text", ""), "chat")
            if not text and not body.get("images"):
                return self._send(400, {"error": "empty"})
            with LOCK:
                busy_now = STATE["busy"]
            if busy_now:
                return self._send(409, {"error": "Atlas is still working on your last message."})
            try:
                images = save_uploads(body.get("images"))
            except ValueError as e:
                return self._send(400, {"error": str(e)})
            with LOCK:
                if STATE["busy"]:
                    return self._send(409, {"error": "Atlas is still working on your last message."})
                STATE["busy"] = True
                CHAT.append({"from": "you", "ts": time.time(), "text": text, **({"images": images} if images else {}),
                             **({"via": "phone"} if body.get("phone") else {})})
            prompt = text
            if body.get("phone"):   # from the owner's Telegram (phone.py): the reply is read on a phone screen
                prompt = "[Sent from the owner's phone. Your reply goes back to his phone, so keep it short and plain.]\n" + text
            if images:   # Atlas opens them with Read, which shows images
                prompt = ((prompt or "(no text, only images)") + f"\n\n[The owner attached {len(images)} image(s) in the chat. Open each with Read to SEE it before you answer: "
                          + ", ".join(str(UPLOADS / n) for n in images) + "]")
                cp.log("Owner", "chat_images", None, {"files": images})
            threading.Thread(target=run_chat, args=(prompt,), daemon=True).start()
            return self._send(202, accepted(warning))
        if u.path == "/api/atlas/new":   # a fresh Atlas chat: the office's New chat button (owner) or `hq atlas-new` (Atlas)
            body = self._json_body()
            by = "owner" if body.get("by") == "owner" else "atlas"
            return self._send(200, {"ok": True, "message": new_atlas_chat(by, str(body.get("why", ""))[:300])})
        if u.path == "/api/ghassan/now":   # check Atlas's requests now instead of at the next turn
            if ghassan.LOCK.locked():
                return self._send(409, {"error": f"Ghassan is already building: {ghassan.STATUS.get('request')}."})
            threading.Thread(target=ghassan.turn, args=(atlas_says,), kwargs={"anim_free": lambda: not anim_busy()}, daemon=True).start()
            return self._send(202, {"ok": True, "message": "Ghassan is checking Atlas's requests."})
        if u.path == "/api/ghassan/undo":   # the owner's /undo on the phone: roll the last ship back
            if self._json_body().get("by") != "owner":
                return self._send(403, {"error": "Only the owner undoes a ship."})
            SHIPPING["on"] = True
            ok, msg = ghassan.undo()
            if ok:
                threading.Thread(target=after_ship, daemon=True).start()
            else:
                SHIPPING["on"] = False
            return self._send(200 if ok else 409, {"ok": ok, "message": msg} if ok else {"error": msg})
        if u.path in ("/api/ghassan/ship", "/api/ghassan/discard"):   # the owner's click ships; Atlas too when the owner allowed it
            body = self._json_body()
            by = "owner" if body.get("by") == "owner" else "atlas"
            if by == "atlas" and not rules.get("atlas.ships"):
                return self._send(403, {"error": "Only the owner ships or discards Ghassan's changes (rule atlas.ships is off)."})
            if u.path.endswith("ship"):
                SHIPPING["on"] = True
                ok, msg = ghassan.ship(anim_free=lambda: not anim_busy(), by=by)
                if ok:
                    threading.Thread(target=after_ship, daemon=True).start()
                    if by == "atlas":
                        phone.notify(f"🚢 Atlas shipped a change by Ghassan: {msg} Reply /undo to roll it back.")
                else:
                    SHIPPING["on"] = False
            else:
                ok, msg = ghassan.discard(str(body.get("reason", ""))[:300])
            return self._send(200 if ok else 409, {"ok": ok, "message": msg} if ok else {"error": msg})
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
            if action == "voice":   # the owner picks the narrator's voice from the samples
                vid = str(self._json_body().get("id", ""))
                known = {v["id"]: v for v in voice_samples(cp.get_project(pid, with_text=False) or {"id": pid})["voices"]}
                if vid not in known:
                    return self._send(400, {"error": "Make the voice samples first, then pick one of them."})
                cp.set_project_meta(pid, voice={"id": vid, "label": known[vid]["label"]})
                cp.log("Owner", "voice_chosen", None, {"project": pid, "voice": vid})
                return self._send(200, {"ok": True, "message": f"Voice chosen: {known[vid]['label']}. It's used from the next Short."})
            if action == "cast-check":   # render a version of Rana's cast again and Israa checks it once more (no redraw)
                k = str(self._json_body().get("version", "")).lstrip("vV")
                if not k.isdigit() or not (cast._folder(pid, int(k)) / "Character.jsx").exists():
                    return self._send(400, {"error": f"Project {pid} has no cast v{k} (see hq cast {pid})."})
                if anim_busy() or quality.REVIEWING.locked():
                    return self._send(409, {"error": f"Busy: {anim_busy() or 'Israa is reviewing'}. Try again when it's done."})
                threading.Thread(target=run_cast_check, args=(pid, int(k)), daemon=True).start()
                return self._send(202, {"ok": True, "message": f"Rendering v{k}'s sheets and test clips, then Israa checks every character "
                                                               "side by side with the owner's picture (about an hour). No redraw."})
            if action in ("cast-draw", "cast-use"):   # Rana redraws the cast from the owner's picture(s) / which cast the project uses
                body = self._json_body()
                if action == "cast-use":
                    try:
                        return self._send(200, {"ok": True, "message": cast.use(pid, str(body.get("which", "")))})
                    except (ValueError, OSError) as e:
                        return self._send(400, {"error": str(e)})
                found = []
                for x in body.get("images") or []:
                    x = str(x)
                    for c in (Path(x), atlas_engine.HOME / x, ROOT / x):
                        if c.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp", ".gif") and c.exists():
                            found.append(str(c.resolve()))
                            break
                resume = str(body.get("resume", "") or "")[:12]
                if not found and resume in ("", "new"):
                    return self._send(400, {"error": "Name the owner's reference image(s), e.g. review/uploads/<file>.jpg."})
                try:
                    k = cast.pick(pid, resume, found)
                except RuntimeError as e:
                    return self._send(400, {"error": str(e)})
                if anim_busy() or quality.REVIEWING.locked():
                    return self._send(409, {"error": f"Busy: {anim_busy() or 'Israa is reviewing'}. Try again when it's done."})
                short = allowance_short(JOB_NEEDS["cast_draw"])
                if short and rules.get("jobs.allowance_check") == "wait":
                    return self._send(409, {"error": "Not started, so it can't stop halfway: " + "; ".join(w for _, w in short)
                                                     + ". Start it when that resets (rule jobs.allowance_check)."})
                threading.Thread(target=run_cast_draw, args=(pid, found, clip(body.get("notes", ""), "notes")[0], resume), daemon=True).start()
                if k:
                    return self._send(202, {"ok": True, "message": f"Rana is picking up her cast v{k} where it stopped "
                                                                   f"({cast.STEPS.get(cast._state(cast._folder(pid, k)).get('step'), 'drawing')}); "
                                                                   "what she drew and what Israa passed are kept."})
                return self._send(202, {"ok": True, "message": "Rana is redrawing the cast from the picture. Then the test clips are made and Israa compares "
                                                               "each character with it (1-2 hours). The owner approves it at the end."})
            if action == "characters":   # make | sheets | review | approve
                body = self._json_body()
                what = body.get("action", "make")
                if what == "approve":
                    lib = quality.load_library(pid)
                    if not lib or not any(c.get("clip") for c in lib["characters"]):
                        return self._send(409, {"error": "Make the character tests first, then watch them before approving."})
                    if (lib.get("kit") or "1") != quality.KIT_VERSION:
                        return self._send(409, {"error": "These test clips are from the old cast. Make the new characters first, then approve them."})
                    cp.set_project_meta(pid, characters_approved=quality.KIT_VERSION)
                    cp.log("Owner", "characters_approved", None, {"project": pid})
                    return self._send(200, {"ok": True, "message": "Characters approved. New Shorts can be made."})
                if what == "revoke":
                    cp.set_project_meta(pid, characters_approved=False)
                    return self._send(200, {"ok": True, "message": "Approval withdrawn."})
                if CHARMAKING["pid"] is not None or quality.REVIEWING.locked():
                    return self._send(409, {"error": "The characters are already being made or checked. Try again when it's done."})
                if what != "review" and anim_busy():
                    return self._send(409, {"error": f"The animation tools are busy: {anim_busy()}. Try again when it's done."})
                if what == "review":
                    threading.Thread(target=run_char_review, args=(pid,), daemon=True).start()
                    return self._send(202, {"ok": True, "message": "Israa is checking the characters (a few minutes)."})
                cp.set_project_meta(pid, characters_approved=False)   # new tests, new approval
                threading.Thread(target=run_characters, args=(pid, what != "sheets"), daemon=True).start()
                return self._send(202, {"ok": True, "message": "Making the characters: about 40 minutes (eight characters). You'll be told when they're ready."})
            if action == "animator-test":   # Rana writes one bespoke scene to compare with the kit's
                body = self._json_body()
                try:
                    eid, idx = int(body.get("episode")), int(body.get("scene", 6))
                except (TypeError, ValueError):
                    return self._send(400, {"error": "Give the episode and the scene number."})
                if anim_busy():
                    return self._send(409, {"error": f"The animation tools are busy: {anim_busy()}. Try again when it's done."})
                threading.Thread(target=run_animator_test, args=(pid, eid, idx), daemon=True).start()
                return self._send(202, {"ok": True, "message": "Rana is writing the scene: about 10 minutes."})
            if action == "voice-match":   # record | match | add (a Voice Library voice into the owner's account)
                body = self._json_body()
                what = body.get("action", "match")
                if what == "add":
                    if not elevenlabs.configured():
                        return self._send(409, {"error": "ElevenLabs isn't set up: restart START-HERE and paste the key when it asks."})
                    if anim_busy():
                        return self._send(409, {"error": f"The animation tools are busy: {anim_busy()}. Try again when it's done."})
                    threading.Thread(target=run_library_add, args=(pid, str(body.get("owner", "")), str(body.get("voice", "")),
                                                                    str(body.get("name", "")).strip()[:60]), daemon=True).start()
                    return self._send(202, {"ok": True, "message": "Adding the voice to your ElevenLabs account and making its sample: about a minute."})
                if MATCHING["pid"] is not None:
                    return self._send(409, {"error": f"The voice matcher is busy: {MATCHING['step']}."})
                if not elevenlabs.configured():
                    return self._send(409, {"error": "ElevenLabs isn't set up: the matcher searches its Voice Library."})
                if not shorts_python():
                    return self._send(409, {"error": "The video tools aren't set up on this computer, so the office can't record the speakers."})
                secs =max(15, min(90, int(body.get("seconds") or 40))) if what == "record" else 0
                threading.Thread(target=run_voice_match, args=(pid, secs), daemon=True).start()
                return self._send(202, {"ok": True, "message": f"Recording {secs} seconds: press play on the video NOW." if secs else "Comparing voices: a few minutes."})
            if action == "cast-voice":   # the voice of one character
                body = self._json_body()
                who, vid = str(body.get("who", "")), str(body.get("id", ""))
                if who not in quality.ON_SCREEN:
                    return self._send(400, {"error": "Unknown character."})
                if not (vid.startswith("eleven:") or vid.startswith("kokoro:")):
                    return self._send(400, {"error": "Pick one of the listed voices."})
                pr = cp.get_project(pid, with_text=False) or {}
                cp.set_project_meta(pid, cast_voices={**((pr.get("meta") or {}).get("cast_voices") or {}), who: vid})
                cp.log("Owner", "cast_voice_chosen", None, {"project": pid, "character": who, "voice": vid})
                return self._send(200, {"ok": True, "message": f"{quality.CAST_NAMES.get(who, who)} now has that voice (from the next video)."})
            if action == "cast-samples":
                if CASTSAMPLING["pid"] is not None or anim_busy():
                    return self._send(409, {"error": f"Busy: {anim_busy() or 'the cast samples are being made'}. Try again when it's done."})
                threading.Thread(target=run_cast_samples, args=(pid,), daemon=True).start()
                return self._send(202, {"ok": True, "message": "Each character is saying one line in its voice: about 2 minutes."})
            if action == "music":   # the background music of the project's videos (or none)
                mid = str(self._json_body().get("id", ""))
                if mid not in sfx.MUSIC and mid != "none":
                    return self._send(400, {"error": "Pick one of the listed tracks, or no music."})
                cp.set_project_meta(pid, music=mid)
                cp.log("Owner", "music_chosen", None, {"project": pid, "music": mid})
                return self._send(200, {"ok": True, "message": "No music from the next video." if mid == "none" else f"Music: {sfx.MUSIC[mid][0]} from the next video."})
            if action == "voice-add":   # register any ElevenLabs voice id for the project
                body = self._json_body()
                vid = str(body.get("id", "")).strip()
                if not vid:
                    return self._send(400, {"error": "Give the ElevenLabs voice id."})
                if not elevenlabs.configured():
                    return self._send(409, {"error": "ElevenLabs isn't set up: restart START-HERE and paste the key when it asks."})
                if anim_busy():
                    return self._send(409, {"error": f"The animation tools are busy: {anim_busy()}. Try again when it's done."})
                threading.Thread(target=run_voice_add, args=(pid, vid, str(body.get("name", "")).strip()[:60]), daemon=True).start()
                return self._send(202, {"ok": True, "message": "Looking the voice up and making its sample: about a minute."})
            if action == "voice-samples":
                if SAMPLING["pid"] is not None:
                    return self._send(409, {"error": "The voice samples are already being made."})
                if anim_busy():
                    return self._send(409, {"error": f"The animation tools are busy: {anim_busy()}. Try again when it's done."})
                threading.Thread(target=run_samples, args=(pid,), daemon=True).start()
                return self._send(202, {"ok": True, "message": "Making the voice samples: about 2-3 minutes (the first time it downloads two voices)."})
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
                if not quality.style_bar(pid):
                    return self._send(409, {"error": "Calina is locked until you've approved a reference board: have the Scout find what works first (the project's Reference board page (Find what works))."})
                if agents.PRODUCING.locked():
                    return self._send(409, {"error": "Calina is already writing a batch. Try again when it's done."})
                notes, warning = clip(body.get("notes", ""), "notes")
                topic = str(body.get("topic", "")).strip()[:300]
                threading.Thread(target=run_batch, args=(pid, body.get("count"), notes, topic), daemon=True).start()
                return self._send(202, accepted(warning))
            if action == "scout":   # the Scout finds what really works and makes a reference board
                if quality.SCOUTING.locked():
                    return self._send(409, {"error": "The Scout is already working. Try again when he's done."})
                notes, warning = clip(body.get("notes", ""), "notes")
                bad = quality.save_examples(pid, body.get("links", ""), bool(body.get("none")))
                if bad:
                    return self._send(409, {"error": bad})
                threading.Thread(target=run_scout_refs, args=(pid, notes), daemon=True).start()
                return self._send(202, {"ok": True, "message": "The Scout is researching what works on YouTube. It takes about 5-10 minutes.",
                                        **({"warning": warning} if warning else {})})
            if action == "board":   # the owner picks a direction and approves the board
                note, warning = clip(body.get("note", ""), "note")
                msg = quality.decide_board(pid, body.get("option"), body.get("likes"), note, body.get("decision", "approve"))
                ok = msg.startswith("Board ")
                return self._send(200 if ok else 409, {"ok": True, "message": msg} if ok else {"error": msg})
            if action == "board-note":   # Atlas, when the owner asks: change the note on the approved board
                note, warning = clip(body.get("note", ""), "note")
                msg = quality.set_board_note(pid, note)
                return self._send(200 if msg.startswith("Board") else 409, {"ok": True, "message": msg} if msg.startswith("Board") else {"error": msg})
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
                    if os.name == "nt":
                        os.startfile(str(folder))
                    else:   # Mac: Finder
                        subprocess.Popen(["open", str(folder)])
                except (AttributeError, OSError):
                    pass
                return self._send(200, {"ok": True, "message": f"Opened {folder}"})
            if action == "log":
                body = self._json_body()
                try:
                    msg = agents.log_production(eid, body.get("credits"), body.get("minutes"), body.get("retakes"))
                except ValueError:
                    return self._send(400, {"error": "Credits, minutes and retakes must be numbers."})
                return self._send(200, {"ok": True, "message": msg})
            if action == "keep-voice":
                v, err = keep_voice(eid, str(self._json_body().get("id", "")))
                return self._send(200 if v else 409, {"ok": True, "message": f"Kept: {v['label']}. It is now this Short and the project's voice."} if v else {"error": err})
            if action in ("do-not-upload", "allow-upload"):   # keep a made video from being uploaded (a duplicate, a superseded version)
                e = cp.get_episode(eid)
                if not e:
                    return self._send(404, {"error": "No such episode."})
                body = self._json_body()   # read the request once
                d = e["data"]
                if action == "do-not-upload":
                    d["do_not_upload"] = clip(body.get("reason", ""), "note")[0] or "Do not upload this one."
                else:
                    d.pop("do_not_upload", None)
                cp.update_episode(eid, data=d)
                cp.log("Owner" if body.get("by") == "owner" else "Atlas", action.replace("-", "_"), None, {"episode": eid, "reason": d.get("do_not_upload", "")})
                return self._send(200, {"ok": True, "message": f"Episode {eid}: " + (f"do not upload ({d['do_not_upload']})" if action == "do-not-upload" else "upload allowed again.")})
            if action == "assets":   # hq assets <episode> make | add | skip | unskip (the story's own art, assets.py)
                body = self._json_body()
                sub, by = str(body.get("action", "")), ("Owner" if body.get("by") == "owner" else "Atlas")
                try:
                    if sub == "make":
                        e = cp.get_episode(eid)
                        if not e:
                            return self._send(404, {"error": "No such episode."})
                        if ASSETWORK["eid"] is not None:
                            return self._send(409, {"error": f"Rana is already drawing the art for video #{ASSETWORK['eid']}."})
                        if anim_busy():
                            return self._send(409, {"error": f"The animation tools are busy: {anim_busy()}. Try again when it's done."})
                        if assets.script_problems(e["data"]):
                            return self._send(409, {"error": "Fix the script's asset list first: " + " ".join(assets.script_problems(e["data"]))})
                        todo = [r for r in assets.view(eid)["missing"] if r["state"] != "unlisted"]
                        if not todo:
                            return self._send(409, {"error": assets.render_block(e) or "Everything this script needs is already drawn."})
                        threading.Thread(target=run_assets, args=(eid,), daemon=True).start()
                        return self._send(202, {"ok": True, "message": f"Rana is drawing {len(todo)} piece(s) for video #{eid}: "
                                                + ", ".join(f"{r['kind']} '{r['id']}'" for r in todo) + ". Israa checks each one; the result comes in the office chat."})
                    if sub == "add":
                        msg = assets.add(eid, str(body.get("kind", "")), str(body.get("id", "")), clip(body.get("brief", ""), "note")[0],
                                         body.get("for") or [], clip(body.get("act", ""), "note")[0], by=by)
                    elif sub in ("skip", "unskip"):
                        msg = assets.override(eid, clip(body.get("why", ""), "note")[0], on=sub == "skip", by=by)
                    else:
                        return self._send(400, {"error": "action must be make, add, skip or unskip"})
                except ValueError as ex:
                    return self._send(400, {"error": str(ex)})
                return self._send(200, {"ok": True, "message": msg})
            if action == "check":   # 2.49.0: the automatic video checks again on the last video (hq check <id> [--test]); no render
                e = cp.get_episode(eid)
                if not e or not production.is_animated(e):
                    return self._send(409, {"error": "The automatic checks are for animated Shorts."})
                py = shorts_python()
                if not py:
                    return self._send(409, {"error": "The video tools aren't set up on this computer."})
                try:
                    r = animate_run(py, ["vcheck", eid] + (["--test"] if self._json_body().get("test") else []), timeout=540)
                except (RuntimeError, subprocess.TimeoutExpired) as ex:
                    return self._send(409, {"error": str(ex)[:600]})
                return self._send(200, {"ok": True, "message": ("Passed every check." if r["ok"] else f"{len(r['faults'])} fault(s): {r['checks']}"),
                                        "faults": r["faults"], "measured": r.get("measured")})
            if action == "builder-review":   # 2.58.0: hq script-review <id> <score> "note"...: the Builder's score + notes on a story script
                body = self._json_body()
                e = cp.get_episode(eid)
                if not e or not production.is_story(e):
                    return self._send(409, {"error": "The script gate is for long story scripts."})
                try:
                    score = float(body.get("score"))
                    if not 0 <= score <= 10:
                        raise ValueError
                except (TypeError, ValueError):
                    return self._send(400, {"error": "score must be a number from 0 to 10"})
                notes = [clip(n, "note")[0] for n in (body.get("notes") or []) if str(n).strip()][:20]
                agents.builder_review(eid, score, notes)
                need = float(rules.get("script.min_score"))
                if score >= need:
                    st = agents.gate_check(eid)
                    return self._send(200, {"ok": True, "gate": st, "message": ("The gate is open: the owner sees it now." if st["open"] else
                                            f"Saved. Waiting for Israa's pass on version {st['version']} (she gives {st['israa']}).")})
                if not notes:
                    return self._send(400, {"error": f"Under {need:g} the notes are what Calina fixes: give at least one."})
                threading.Thread(target=run_script_fix, args=(eid, "Builder"), daemon=True).start()
                return self._send(202, {"ok": True, "message": f"Calina is fixing {len(notes)} note(s) on script #{eid} (only those); Israa looks again after."})
            if action == "israa":   # ask Israa to review the video again
                e = cp.get_episode(eid)
                if not e or not e["video_path"]:
                    return self._send(409, {"error": "There's no video to review yet."})
                if quality.REVIEWING.locked():
                    return self._send(409, {"error": "Israa is busy reviewing something else."})
                threading.Thread(target=run_israa_video, args=(eid,), daemon=True).start()
                return self._send(202, {"ok": True, "message": "Israa is looking at the video. It takes a couple of minutes."})
            if action in ("render", "assemble"):
                e = cp.get_episode(eid)
                if not e or e["status"] not in ("approved", "rendered"):
                    return self._send(409, {"error": "Only an approved script can be made into a video."})
                body = self._json_body()   # read the request once
                voices = [str(v) for v in (body.get("voices") or []) if str(v)]
                if voices:
                    if not production.is_animated(e):
                        return self._send(409, {"error": "Comparing voices only works for animated Shorts."})
                    if len(voices) > 3:
                        return self._send(400, {"error": "Compare two or three voices at a time (each one costs ElevenLabs characters and a render)."})
                    known = {v["id"] for v in voice_samples(cp.get_project(e["project_id"], with_text=False) or {"id": e["project_id"]})["voices"]}
                    voices = [v if v in known or ":" in v else "eleven:" + v for v in voices]
                if production.is_story(e) and voices:   # 2.48.0: story videos have one narrator (voice versions are a Shorts thing)
                    return self._send(409, {"error": "Comparing voices only works for animated Shorts."})
                if production.is_animated(e):
                    pr = cp.get_project(e["project_id"], with_text=False) or {}
                    if not quality.characters_ready(pr):
                        return self._send(409, {"error": "You haven't approved the characters yet. Open the project's Voice & characters page, watch the test clips, then approve. No new Short is made before that."})
                    block = assets.render_block(e)   # 2.36.0: the story's own art first (rule render.require_assets)
                    if block:
                        started = start_assets(eid) if rules.get("assets.auto_make") else ""
                        return self._send(409, {"error": block + (f" {started}" if started else "")})
                if production.is_v2(e):
                    st = production.clip_status(e)
                    if not st["ready"]:
                        missing = [f"shot{i:02d}" for i in st["missing"]] + ([] if st["voice"] else ["voice.mp3"])
                        return self._send(409, {"error": "Still missing: " + ", ".join(missing) + f". Save them in {st['folder']}."})
                if RENDERING["lock"].locked():
                    return self._send(409, {"error": f"Calina is already making Short #{RENDERING['episode']}. Try again when it's done."})
                if anim_busy():
                    return self._send(409, {"error": f"The animation tools are busy: {anim_busy()}. Try again when it's done."})
                if voices:
                    threading.Thread(target=run_render_voices, args=(eid, voices), daemon=True).start()
                    return self._send(202, {"ok": True, "message": f"Calina is making the Short in {len(voices)} voices: about 10-15 minutes each."})
                if body.get("test"):   # 2.49.0: the quick test render alone (hq render <id> --test)
                    if not production.is_animated(e) or production.is_story(e):
                        return self._send(409, {"error": "The quick test render is for animated Shorts."})
                    threading.Thread(target=run_test_render, args=(eid,), daemon=True).start()
                    return self._send(202, {"ok": True, "message": "Calina is making the quick test render (a frame a second, same audio) with the automatic checks: a few minutes."})
                threading.Thread(target=run_render, args=(eid,), daemon=True).start()
                if test_needed(e):
                    return self._send(202, {"ok": True, "message": "A quick test render with the automatic checks runs first (a few minutes); the full render starts only if it passes."})
                wait = "about an hour" if production.is_story(e) else "10-15 minutes" if production.is_animated(e) else "2-3 minutes"
                return self._send(202, {"ok": True, "message": f"Calina is putting the Short together. It takes about {wait}."})
            if action == "published":
                msg = agents.mark_published(eid)
                ok = msg.startswith(f"Episode {eid} marked")
                return self._send(200 if ok else 409, {"ok": True, "message": msg} if ok else {"error": msg})
            body = self._json_body()
            if body.get("by") == "autopilot":   # 2.34.0: Atlas on autopilot may approve ONLY a script Israa passed (owner's rule)
                e0 = cp.get_episode(eid)
                if action != "approve" or not rules.get("atlas.autopilot_approve"):
                    return self._send(403, {"error": "The autopilot may only approve, and only while the owner allows it (rule atlas.autopilot_approve)."})
                if not e0 or ((e0["data"].get("review") or {}).get("verdict") != "pass"):
                    return self._send(409, {"error": "Not approved: Israa hasn't passed this script. It waits for the owner."})
                msg = agents.decide_episode(eid, "approve", "Approved by Atlas on autopilot (Israa passed it)", by="Atlas")
            else:
                msg = agents.decide_episode(eid, action, clip(body.get("note", ""), "note")[0])
            e = cp.get_episode(eid)
            ok = e is not None and e["status"] in ("approved", "rejected") and msg.startswith(f"Episode {eid} ")
            if ok and action == "approve" and rules.get("assets.auto_make"):   # its own art is drawn before anyone asks for the render
                started = start_assets(eid)
                msg += f" It needs its own art: {started}" if started else ""
            return self._send(200 if ok else 409, {"ok": True, "message": msg} if ok else {"error": msg})
        if u.path == "/api/youtube/client":   # the owner's OAuth client file (Desktop app JSON from Google Cloud), raw in the body
            n = int(self.headers.get("Content-Length") or 0)
            if n > 64 * 1024:
                return self._send(413, {"error": "That file is too big for an OAuth client file."})
            try:
                youtube.save_client(self.rfile.read(n))
            except ValueError as e:
                return self._send(400, {"error": str(e)})
            cp.log("Owner", "youtube_client_saved", None, {})
            return self._send(200, {"ok": True, "message": "Client file saved. Now press Connect YouTube."})
        if u.path in ("/api/youtube/connect", "/api/youtube/disconnect"):   # this PC only: Google's page opens in its browser
            if not remote.is_local(self):
                return self._send(403, {"error": "Connect YouTube on the PC itself: Google's sign-in page opens in its browser."})
            try:
                pid = _omar_pid(self._json_body())
            except ValueError as e:
                return self._send(400, {"error": str(e)})
            if u.path.endswith("disconnect"):
                youtube.disconnect(pid)
                cp.log("Owner", "youtube_disconnected", None, {"project": pid})
                return self._send(200, {"ok": True, "message": f"{omar.name(pid)} disconnected. Omar stops reading that channel."})
            if not youtube.status()["client"]:
                return self._send(409, {"error": "Add the OAuth client file first."})
            if youtube.STATE["connecting"]:
                return self._send(409, {"error": "Google's page is already open: finish it in the browser."})
            threading.Thread(target=run_youtube_connect, args=(pid,), daemon=True).start()
            return self._send(200, {"ok": True, "message": f"Google's sign-in page is opening in your browser. Choose the account, then the "
                                                           f"{omar.name(pid)} channel, and allow read-only access."})
        if u.path == "/api/omar/now":   # hq omar now [weekly] [project]: Omar runs now instead of at his hour
            body = self._json_body()
            what = "weekly" if body.get("what") == "weekly" else "daily"
            if omar.STATUS["running"]:
                return self._send(409, {"error": f"Omar is already on his {omar.STATUS['running']} job."})
            try:
                pid = _omar_pid(body)
            except ValueError as e:
                return self._send(400, {"error": str(e)})
            if not youtube.status(pid)["connected"]:
                return self._send(409, {"error": f"{omar.name(pid)} isn't connected yet (Spend & limits -> Your YouTube)."})
            threading.Thread(target=run_omar, args=(what, pid), daemon=True).start()
            return self._send(200, {"ok": True, "message": f"Omar is reading {omar.name(pid)}." if what == "daily" else
                                    f"Omar is writing his weekly note on {omar.name(pid)} (a minute or two); it comes to you and to the chat."})
        if u.path in ("/api/omar/watch", "/api/omar/unwatch"):   # hq omar watch|unwatch <channel> [--project N]: rivals, public numbers
            body = self._json_body()
            by = "Owner" if body.get("by") == "owner" else "Atlas"
            try:
                pid = _omar_pid(body)
                msg = (omar.watch if u.path.endswith("/watch") else omar.unwatch)(str(body.get("ref", ""))[:300], by, pid)
            except (ValueError, LookupError) as e:
                return self._send(400, {"error": str(e)})
            except Exception as e:
                return self._send(502, {"error": f"YouTube didn't answer: {type(e).__name__}: {str(e)[:200]}"})
            return self._send(200, {"ok": True, "message": msg})
        if u.path == "/api/sound":   # hq sound <sample.json> [video.mp4]: Tarek listens, fixes the mix, gives voice notes
            body = self._json_body()
            if SOUNDING["on"]:
                return self._send(409, {"error": f"Tarek is already on {SOUNDING['on']}. One at a time."})
            try:
                sample = str(body.get("sample") or "").replace("\\", "/")
                video = str(body.get("video") or "").replace("\\", "/") or None
                for f in [sample] + ([video] if video else []):
                    p = (ROOT / f).resolve()
                    if not f or not p.is_file() or ROOT / "content" not in p.parents:
                        raise ValueError(f"No such file under content/: {f}")
                if not sample.endswith(".json"):
                    raise ValueError("The sample is a story sample's .json (content/project-N/samples/<name>.json).")
            except (ValueError, TypeError) as e:
                return self._send(400, {"error": str(e)})
            by = "Owner" if body.get("by") == "owner" else "Atlas"
            threading.Thread(target=run_sound_review, args=(sample, video, by), daemon=True).start()
            return self._send(202, {"ok": True, "message": f"Tarek is listening to {Path(sample).name} (Earshot, then his judgement, "
                                    "then a rebuilt mix and a second listen: about 10-20 minutes). You'll be told when his review is ready."})
        if u.path == "/api/shorts":   # hq shorts <project> <video file|episode> [count]: Omar picks moments, the office cuts Shorts
            body = self._json_body()
            if CUTTING["on"]:
                return self._send(409, {"error": f"Shorts are being cut already (from {CUTTING['on']}). One at a time."})
            try:
                found, video = shorts_source(body.get("video"))
                pid = int(body.get("project") or found or omar.project())
                count = int(body.get("count") or rules.get("clips.count"))
                if not 1 <= count <= 8:
                    raise ValueError("Between 1 and 8 Shorts at a time.")
            except (ValueError, TypeError) as e:
                return self._send(400, {"error": str(e)})
            if not shorts_python():
                return self._send(409, {"error": "The video tools aren't set up on this computer, so nothing can be cut."})
            by = "Owner" if body.get("by") == "owner" else "Atlas"
            threading.Thread(target=run_cut_shorts, args=(pid, video, count, by), daemon=True).start()
            return self._send(202, {"ok": True, "message": f"Omar is picking {count} moments from {Path(video).name} and the office cuts them "
                                    "(transcribing first if needed: about 5-20 minutes). You'll be told when they're ready."})
        if u.path.startswith("/api/omar/suggest/"):   # hq omar suggest <episode>: packaging ideas before an upload
            try:
                eid = int(u.path.rsplit("/", 1)[1])
                got = omar.suggest(eid)
            except (ValueError, LookupError) as e:
                return self._send(400, {"error": str(e)})
            except (workers.Unavailable, cp.Halt) as e:
                return self._send(503, {"error": f"Omar couldn't run: {e}"})
            return self._send(200, {"ok": True, "suggestion": got, "message": f"Omar's suggestion is saved on episode {eid}."})
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
        if u.path == "/api/phone":   # the owner pastes the bot token from @BotFather; it goes only into .env
            t = str(self._json_body().get("token", "")).strip()
            if not t or len(t) > 100 or ":" not in t or any(c.isspace() for c in t):
                return self._send(400, {"error": "That doesn't look like a bot token. @BotFather gives one like 123456789:AA... ."})
            phone.save_token(t)
            phone.start(phone.STATE["port"])
            v = phone.view()
            if v["error"]:
                return self._send(409, {"error": "Telegram didn't accept that token: " + v["error"]})
            cp.log("Owner", "phone_token_set", None, {"bot": v["bot"]})
            return self._send(200, {"ok": True, "message": f"Connected to @{v['bot']}. Now pair your phone with the code.", **v})
        if u.path == "/api/rules":   # set | reset | undo a live rule: Atlas (hq rule ...) or the owner (Team rules card)
            body = self._json_body()
            by = "Owner" if body.get("by") == "owner" else "Atlas"
            key, action = str(body.get("key", "")), str(body.get("action", "set"))
            try:
                if action == "set":
                    old, new = rules.set(key, body.get("value"), by, str(body.get("why", ""))[:300])
                elif action in ("reset", "undo"):
                    old, new = (rules.reset if action == "reset" else rules.undo)(key, by)
                else:
                    return self._send(400, {"error": "action must be set, reset or undo"})
            except ValueError as e:
                return self._send(400, {"error": str(e)})
            short = lambda v: (v if len(v) <= 80 else v[:80] + f"... ({len(v):,} characters)") if isinstance(v, str) else v
            return self._send(200, {"ok": True, "message": f"{key}: {short(old)} → {short(new)}. Live now, no restart."})
        if u.path.startswith("/api/unblock/"):
            return self._send(200, {"ok": True, "message": "\n".join(unblock(u.path.rsplit("/", 1)[1]))})
        if u.path == "/api/jobs/resume":   # Atlas: hq resume <job id | kind> (from its last finished step)
            ok, msg = resume_job(self._json_body().get("job", ""))
            return self._send(202 if ok else 409, {"ok": ok, "message": msg} if ok else {"error": msg})
        if u.path == "/api/builder-note":   # the Builder chat tells Atlas what it did and why (local only, like every route)
            text = str(self._json_body().get("text", "")).strip()
            if not text:
                return self._send(400, {"error": "No text."})
            builder_note(text)
            return self._send(200, {"ok": True})
        if u.path == "/api/restart":   # Atlas: hq restart ["why"] (the same safe restart: waits for running work, jobs resume)
            body = self._json_body()
            by = "Owner" if body.get("by") == "owner" else "Atlas"
            if RESTARTING["on"]:
                return self._send(200, {"ok": True, "message": "A restart is already waiting for the running work to finish."})
            cp.log(by, "office_restart", None, {"why": str(body.get("why", ""))[:300]})
            threading.Thread(target=restart_office, args=(f"{by}'s restart",), daemon=True).start()
            busy = working_now()
            return self._send(202, {"ok": True, "message": "The office restarts " + ("once this is done: " + "; ".join(busy) if busy else "now")
                                    + ". It loads the newest version from GitHub; saved jobs resume after it (about 30 s)."})
        if u.path == "/api/channel/new":   # 2.47.0: a new channel by the owner's word: {name, format, brief, by} (hq channel-new)
            body = self._json_body()
            by = "Owner" if body.get("by") == "owner" else "Atlas"
            fmt = str(body.get("format") or agents.STORY_FORMAT)
            if fmt != agents.STORY_FORMAT:
                return self._send(400, {"error": f"Unknown channel format '{fmt}'. Known: {agents.STORY_FORMAT} (long narrated stories)."})
            try:
                pid = cp.new_channel_project(body.get("name", ""), fmt, clip(body.get("brief", ""), "notes")[0], by)
            except ValueError as e:
                return self._send(400, {"error": str(e)})
            atlas_says(f"**New channel project: {cp.get_project(pid, with_text=False)['title']}** (project {pid}, long narrated stories), "
                       f"made by {by}. Calina writes from guides/STORY-GUIDE.md (the study of The Infographics Show's 20 most-viewed videos). "
                       f"Next, the standing rule: the Scout's reference board (`hq refs {pid}`), the owner picks a direction, then `hq batch {pid}`.")
            return self._send(200, {"ok": True, "project": pid, "message": f"Project {pid} is open on the left rail."})
        if u.path == "/api/client/new":   # a client project by the owner's word: {name, kind, brief, by} (office or hq project-new)
            body = self._json_body()
            by = "Owner" if body.get("by") == "owner" else "Atlas"
            try:
                pr = client.create(body.get("name", ""), str(body.get("kind") or client.MUSIC_VIDEO), clip(body.get("brief", ""), "notes")[0], by)
            except ValueError as e:
                return self._send(400, {"error": str(e)})
            atlas_says(f"**New client project: {pr['title']}** (project {pr['id']}, {client.KINDS[pr['meta']['kind']]}), made by {by}. It is on "
                       "the left rail with its own pages: Brief, Song, Style options, Storyboard, Rana's work, Videos. "
                       f"Next: `hq style-frames {pr['id']}` for Rana's three looks.")
            return self._send(200, {"ok": True, "project": pr["id"], "message": f"Project {pr['id']} '{pr['title']}' is open on the left rail."})
        if u.path.startswith("/api/client/"):   # /api/client/<pid>/<brief|song|lyrics|style-frames|style-choose>
            parts = u.path.strip("/").split("/")
            try:
                pid, action = int(parts[2]), parts[3]
                pr = client.get(pid)
            except (IndexError, ValueError) as e:
                return self._send(400, {"error": f"bad request: {e}"})
            if action == "song":   # the raw file in the body (X-File-Name header), from the Song page
                n = int(self.headers.get("Content-Length") or 0)
                if n > client.MAX_SONG:
                    return self._send(413, {"error": f"The song can be at most {client.MAX_SONG // (1024 * 1024)} MB."})
                data = self.rfile.read(n)
                from urllib.parse import unquote
                try:
                    info = client.save_song(pid, data, unquote(self.headers.get("X-File-Name", "song")), "Owner")
                except ValueError as e:
                    return self._send(400, {"error": str(e)})
                atlas_says(f"**The client's song is here** for {pr['title']}: {info['name']} ({info['bytes'] // 1024:,} KB). "
                           "The music-video pipeline (cuts on the beat, scenes on the lyrics) is the Builder's next step.")
                return self._send(200, {"ok": True, "message": f"Saved {info['name']}."})
            body = self._json_body()
            by = "Owner" if body.get("by") == "owner" else "Atlas"
            try:
                if action == "brief":
                    client.set_brief(pid, body.get("brief"), body.get("rules"), by)
                    return self._send(200, {"ok": True, "message": "Brief saved."})
                if action == "lyrics":
                    client.save_lyrics(pid, body.get("text", ""), by)
                    return self._send(200, {"ok": True, "message": "Lyrics saved."})
                if action == "style-choose":
                    return self._send(200, {"ok": True, "message": client.choose(pid, int(body.get("version", 0)), int(body.get("option", 0)), by)})
                if action == "idea":   # another idea (story/animation) for the same song, saved for the Builder to make
                    idea = client.add_idea(pid, body.get("title"), body.get("story"), by)
                    atlas_says(f"**New idea for {pr['title']}: {idea['title']}.** It is saved under the song (Videos page) and waits for the "
                               "Builder chat, which makes the animation.")
                    return self._send(200, {"ok": True, "message": f"Saved idea {idea['n']}: {idea['title']}. The Builder makes it next."})
                if action == "version-note":   # the owner's rating and notes on one version
                    client.note_version(pid, body.get("idea"), body.get("version"), body.get("rating"), body.get("notes"), by)
                    return self._send(200, {"ok": True, "message": "Saved."})
            except (ValueError, OSError) as e:
                return self._send(400, {"error": str(e)})
            if action == "mv-shot":   # a finished clip becomes a shot's video: {idea, shot, file, from} (hq mv-shot)
                try:
                    return self._send(200, {"ok": True, "message": client.set_shot(pid, body.get("idea"), body.get("shot"), body.get("file"),
                                                                                 float(body.get("from") or 0), by)})
                except (ValueError, OSError) as e:
                    return self._send(400, {"error": str(e)})
            if action == "mv-render":   # render a version of a music video from its edit plan: {idea, version, about, quick, vertical}
                if MVRENDER["on"]:
                    return self._send(409, {"error": f"A music video is rendering already ({MVRENDER['on']}). One at a time."})
                try:
                    slug = client.idea_slug(pid, body.get("idea") or "")
                    client.edit_path(pid, slug)
                    quick = bool(body.get("quick"))
                    version = str(body.get("version") or ("test" if quick else client.next_version(pid, slug))).strip().lower()
                    if not re.match(r"^[a-z0-9-]{1,40}$", version):
                        raise ValueError("A version name is lower-case letters, numbers and dashes (e.g. v3).")
                    if not quick and (client.ideas_dir(pid) / slug / "versions" / version / "wide.mp4").exists():
                        raise ValueError(f"Version {version} exists already; pick a new name (versions are kept, never overwritten).")
                except ValueError as e:
                    return self._send(400, {"error": str(e)})
                threading.Thread(target=run_mv_render, args=(pid, slug, version, clip(body.get("about", ""), "notes")[0], quick,
                                                             bool(body.get("vertical")), by), daemon=True).start()
                return self._send(202, {"ok": True, "message": f"Rendering {slug} {version}" + (" as a quick test (half size, ~3-8 min)"
                                        if quick else " (full size, about 25-40 min for 2-4 minutes of video)") + ". You'll be told when it's ready."})
            if action == "style-frames":   # Rana paints 3 looks (the owner's button, or Atlas: hq style-frames)
                if anim_busy():
                    return self._send(409, {"error": f"The animation tools are busy: {anim_busy()}. Try again when it's done."})
                threading.Thread(target=run_style_frames, args=(pid, clip(body.get("brief", ""), "notes")[0]), daemon=True).start()
                return self._send(202, {"ok": True, "message": f"Rana is painting 3 looks for {pr['title']}: full 16:9 scenes with the 9:16 crop, "
                                                               "checked by Israa (about 20-40 minutes)."})
            return self._send(400, {"error": f"Unknown action '{action}'."})
        if u.path == "/api/design":   # Rana draws: {what, brief} (the owner, or Atlas: hq design)
            body = self._json_body()
            what = str(body.get("what", "")).strip()[:60]
            if not what:
                return self._send(400, {"error": "Say what to design, e.g. logo."})
            if anim_busy():
                return self._send(409, {"error": f"The animation tools are busy: {anim_busy()}. Try again when it's done."})
            project = int(body.get("project") or 0) or None   # 2.70.4: a client project's design is mirrored into its folder
            if project and not cp.get_project(project):
                return self._send(400, {"error": f"No project {project}."})
            threading.Thread(target=run_design, args=(what, clip(body.get("brief", ""), "notes")[0], str(body.get("name", "")).strip()[:40], project),
                             daemon=True).start()
            return self._send(202, {"ok": True, "message": f"Rana is drawing the {what}: 3 options, rendered and checked by Israa (about 15-25 minutes)."})
        if u.path == "/api/design/trace":   # 2.62.0: vtracer turns a picture into a vector {image, colors, bw} (Atlas: hq trace)
            body = self._json_body()
            try:
                got = design.trace(str(body.get("image", "")), int(body.get("colors") or 6), bool(body.get("bw")))
            except (ValueError, RuntimeError, OSError) as e:
                return self._send(400, {"error": f"Couldn't trace it: {e}"})
            cp.log(str(body.get("by") or "Atlas"), "design_traced", None, got)
            return self._send(200, {"ok": True, **got, "message": f"Traced: {got['svg']} ({got['paths']} shapes, {got['bytes']:,} bytes)"
                                    + (f", preview {got['preview']}" if got.get("preview") else "") + "."})
        if u.path.startswith("/api/design/"):   # /api/design/<slug>/<version>/choose {option}
            parts = u.path.strip("/").split("/")
            try:
                msg = design.choose(parts[2], int(parts[3]), int(self._json_body().get("option", 0)),
                                    "Owner" if len(parts) > 4 and parts[4] == "choose" else "Owner")
            except (ValueError, IndexError, OSError) as e:
                return self._send(400, {"error": f"Couldn't choose that: {e}"})
            return self._send(200, {"ok": True, "message": msg})
        if u.path == "/api/phone/resend":   # Atlas: hq phone-resend [kind]
            try:
                n = phone.resend(str(self._json_body().get("kind", "all")))
            except ValueError as e:
                return self._send(400, {"error": str(e)})
            except phone.TelegramError as e:
                return self._send(502, {"error": f"Telegram: {e}"})
            return self._send(200, {"ok": True, "message": f"Sent {n} card(s) to the owner's phone."})
        if u.path == "/api/phone/send":   # Atlas: hq send-phone <file> ["caption"]
            body = self._json_body()
            try:
                msg = phone.send_file(str(body.get("path", "")), str(body.get("caption", ""))[:900])
            except ValueError as e:
                return self._send(400, {"error": str(e)})
            return self._send(200, {"ok": True, "message": msg})
        if u.path.startswith("/api/clients/"):   # 2.67.0 (clientbot.py): new | <slug>/token | <slug>/say | <slug>/send | <slug>/unpair | outbox/<id>/send|drop
            parts = u.path.strip("/").split("/")
            try:
                if parts[2:3] == ["new"]:
                    b = self._json_body()
                    c = clientbot.new(b.get("name"), int(b.get("project") or 0), str(b.get("by") or "Owner"))
                    return self._send(200, {"ok": True, "message": f"{c['name']} is set up for project {c['project']}. Next: his bot's token "
                                                                  "(Spend & limits -> Clients).", **c})
                if parts[2:3] == ["outbox"] and len(parts) == 5:
                    b = self._json_body()
                    by = str(b.get("by") or "Owner").title()
                    msg = clientbot.deliver(parts[3], b.get("text"), by) if parts[4] == "send" else clientbot.drop(parts[3], by)
                    return self._send(200, {"ok": True, "message": msg})
                slug = parts[2] if len(parts) > 3 else ""
                if parts[3:4] == ["token"]:
                    if not remote.is_local(self):
                        return self._send(403, {"error": "A client's bot token can only be set on the PC itself."})
                    n = int(self.headers.get("Content-Length") or 0)
                    raw = self.rfile.read(min(n, 500)).decode("utf-8", "replace").strip() if n else ""
                    try:
                        raw = json.loads(raw).get("token", raw) if raw.startswith("{") else raw
                    except ValueError:
                        pass
                    c = clientbot.set_token(slug, raw)
                    return self._send(200, {"ok": True, "message": f"Connected to @{c['bot']}. Give {c['name']} the pairing code {c['code']}.", **c})
                if parts[3:4] == ["say"]:
                    b = self._json_body()
                    return self._send(200, {"ok": True, "message": clientbot.queue(slug, str(b.get("text") or ""), by=str(b.get("by") or "Atlas"))})
                if parts[3:4] == ["send"]:
                    b = self._json_body()
                    return self._send(200, {"ok": True, "message": clientbot.queue(slug, str(b.get("text") or ""), path=b.get("path"),
                                                                                   caption=str(b.get("caption") or ""), approve=b.get("approve"),
                                                                                   by=str(b.get("by") or "Atlas"))})
                if parts[3:4] == ["unpair"]:
                    c = clientbot.unpair(slug)
                    return self._send(200, {"ok": True, "message": f"{c['name']}'s Telegram is unpaired. New code: {c['code']}.", **c})
            except (ValueError, clientbot.TelegramError) as e:
                return self._send(400, {"error": str(e)})
            return self._send(404, {"error": "no such client route"})
        if u.path == "/api/phone/unpair":
            phone.unpair()
            cp.log("Owner", "phone_unpaired", None, {})
            return self._send(200, {"ok": True, "message": "Unpaired. A new code is shown to pair a phone again.", **phone.view()})
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
    finally:
        try:
            atlas_cloud.offer_setup()
        except Exception as e:
            print("  Cloud Atlas setup failed:", repr(e), flush=True)
        try:
            elevenlabs.offer_setup()
        except Exception as e:
            print("  ElevenLabs setup failed:", repr(e), flush=True)
        try:
            phone.offer_setup()
        except Exception as e:
            print("  Phone setup failed:", repr(e), flush=True)


for _kind, _name in JOBS.items():   # every long job is saved while it runs (see "Saved jobs" above)
    globals()[_name] = journaled(_kind, globals()[_name])


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
    if os.name != "nt":   # Mac (2.38.0): the process listening on the port, via lsof
        try:
            out = subprocess.run(["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-t"], capture_output=True, text=True, timeout=20).stdout
        except (OSError, subprocess.SubprocessError):
            print(f"  Another Agent HQ is already running on port {port}. Close it first.", flush=True)
            return
        pids = {int(x) for x in out.split() if x.isdigit()}
        import signal
        for pid in pids - {os.getpid()}:
            try:
                os.kill(pid, signal.SIGTERM)
                time.sleep(2)
                os.kill(pid, signal.SIGKILL)
            except OSError:
                pass   # already gone
    else:
        out = subprocess.run(["netstat", "-ano", "-p", "TCP"], capture_output=True, text=True).stdout
        pids = {int(line.split()[-1]) for line in out.splitlines()
                if f"127.0.0.1:{port} " in line and "LISTENING" in line and line.split()[-1].isdigit()}
        for pid in pids - {os.getpid()}:
            subprocess.run(["taskkill", "/PID", str(pid), "/F"], capture_output=True)
    if pids:
        print(f"  Closed {len(pids)} older copy(ies) of Agent HQ that were still running.", flush=True)
        print("  Their windows now say they stopped; you can close them.\n", flush=True)
        time.sleep(1)
    return bool(pids - {os.getpid()})


# Why the office went down (Atlas's request 2026-10-08: it vanished mid-render and nobody knew why). Each run writes this file;
# a clean end (restart, Ctrl+C, a crash Python could report) adds "ended". The next start logs `office_down` with the reason.
RUN_FILE = Path.home() / ".agent-hq" / "office-run.json"


def end_run(why):
    if os.environ.get("HQ_SIMULATE") == "1":
        return
    try:
        d = json.loads(RUN_FILE.read_text(encoding="utf-8"))
        if d.get("pid") == os.getpid() and not d.get("ended"):
            d.update(ended=why, ended_at=time.time())
            RUN_FILE.write_text(json.dumps(d), encoding="utf-8")
    except (OSError, ValueError):
        pass


def start_run(replaced):
    """Log how the last run ended (from its run file), then start this run's file."""
    if os.environ.get("HQ_SIMULATE") == "1":
        return
    try:
        last = json.loads(RUN_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        last = None
    if last and not last.get("ended"):
        jobs = [f"{j['kind']} (job {j['id']})" for j in LEFTOVER_JOBS if j["state"] == "running"]
        why = ("a new START-HERE closed the office that was still running" if replaced else
               "it stopped without warning: the black window was closed, the PC slept, shut down or restarted, or Python was killed")
        cp.log("Office", "office_down", None, {"why": why, "started": last.get("started"), "version": last.get("version"),
                                               "pid": last.get("pid"), "running": jobs})
        print(f"  The office last stopped because {why}." + (" It was running: " + ", ".join(jobs) + " (resumed below)." if jobs else ""),
              flush=True)
    try:
        RUN_FILE.parent.mkdir(parents=True, exist_ok=True)
        ver = (ROOT / "VERSION").read_text(encoding="utf-8").strip() if (ROOT / "VERSION").exists() else ""
        RUN_FILE.write_text(json.dumps({"pid": os.getpid(), "started": time.time(), "version": ver}), encoding="utf-8")
    except OSError as e:
        print("  Run file:", repr(e), flush=True)


def main():
    prepare_atlas()
    port = int(os.environ.get("HQ_PORT", "8765"))
    start_run(stop_old_office(port))
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
    threading.Thread(target=ghassan_loop, daemon=True).start()
    if os.environ.get("HQ_SIMULATE") != "1":
        threading.Thread(target=autopilot_loop, daemon=True).start()
    phone.STATUS_FN[0] = working_now
    phone.PROVIDERS.append(phone_cards)
    phone.PROVIDERS.append(design_cards)
    phone.start(srv.server_port)
    clientbot.start_all(srv.server_port)   # 2.67.0: each client's own Telegram bot, bound to his project
    remote.start(Server, Handler, srv.server_port)   # the same office on the owner's other computers, over Tailscale (2.39.0)
    threading.Thread(target=resume_jobs, daemon=True).start()
    threading.Thread(target=first_logo, daemon=True).start()
    if os.environ.get("HQ_SIMULATE") != "1":
        threading.Thread(target=mark_healthy, daemon=True).start()
        threading.Thread(target=restart_watch, daemon=True).start()
    if os.environ.get("HQ_NO_LND") != "1":
        threading.Thread(target=lnd_loop, daemon=True).start()
    if os.environ.get("HQ_SIMULATE") != "1" or os.environ.get("HQ_STUDIO") == "1":
        threading.Thread(target=studio_loop, daemon=True).start()
    if os.environ.get("HQ_SIMULATE") != "1" or os.environ.get("HQ_OMAR") == "1":
        threading.Thread(target=omar_loop, daemon=True).start()
    if os.environ.get("HQ_NO_BROWSER") != "1":
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        end_run("Ctrl+C in the black window")
    except BaseException as e:
        end_run(f"crashed: {e!r}"[:300])
        raise


if __name__ == "__main__":
    main()
