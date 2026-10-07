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
import atlas_cloud        # noqa: E402
import workers            # noqa: E402
import lnd                # noqa: E402
import elevenlabs         # noqa: E402
import production         # noqa: E402
import quality            # noqa: E402
import control_plane as cp  # noqa: E402
import settings           # noqa: E402

cp.init()
agents.register_all()
agents.setup_animated_projects()
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
                   + "Open Ideas → Content to read each script, its sources and Israa's verdict, then approve or reject it.")
    except (ValueError, KeyError, TypeError):
        atlas_says(out)


def run_scout_refs(project_id, notes=""):
    out = quality.scout_references(project_id, notes)
    try:
        r = json.loads(out)
        atlas_says(f"**The Scout's reference board is ready for project {r['project_id']}.** He found {r['references']} real examples "
                   f"({r['verified']} he could verify) and {len(r['options'])} directions to choose from: " + "; ".join(r["options"]) +
                   ".\n\nOpen Ideas → Content, look at the examples, pick a direction and approve the board. Calina won't write anything until you do.")
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


def run_voice_add(pid, voice_id, name):
    VOICEWORK["what"] = "an ElevenLabs voice is being added"
    try:
        e = _animate("voice-add", pid, voice_id, name or "", timeout=900)
        atlas_says(f"**Voice added: {e['label']}.** Open Ideas → Content → Narrator voice to hear its sample; you can pick it, or have the next Short made in two voices to compare.")
    except Exception as ex:
        atlas_says(f"That voice couldn't be added: {ex}")
    finally:
        VOICEWORK["what"] = ""


def run_render_voices(eid, voices):
    """The same Short in several voices, as variants for the owner to compare. Nothing about the episode changes until he keeps one."""
    with RENDERING["lock"]:
        RENDERING["episode"] = eid
        try:
            r = _animate("render-voices", eid, ",".join(voices), timeout=7200)
            e = cp.get_episode(eid)
            d = e["data"]
            d["voice_variants"] = r["variants"]
            cp.update_episode(eid, data=d)
            cp.log("Calina", "voice_variants_ready", None, {"episode": eid, "voices": [v["label"] for v in r["variants"]]})
            atlas_says(f"**Short #{eid} is ready in {len(r['variants'])} voices.** Open Ideas → Content, watch each, and click **Keep this voice** on the one you want: "
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
    shutil.copy2(folder / v["audio"], folder / "voice.wav")
    shutil.copy2(folder / v["props"], folder / "scene-props.json")
    cp.set_project_meta(e["project_id"], voice={"id": vid, "label": v["label"]})
    d = e["data"]
    d.pop("voice_variants", None)
    cp.update_episode(eid, data=d, status="rendered", video_path=(folder / "short.mp4").relative_to(ROOT).as_posix())
    cp.log("Owner", "voice_kept", None, {"episode": eid, "voice": v["label"]})
    threading.Thread(target=quality.review_video, args=(eid,), daemon=True).start()
    return v, ""


def anim_busy():
    """Only one job at a time may use the animation tools (they share one working folder). Returns what is running, or ''."""
    if RENDERING["lock"].locked():
        return f"Calina is making Short #{RENDERING['episode']}"
    if CHARMAKING["pid"] is not None:
        return "the characters are being made"
    if ANIMTEST["pid"] is not None:
        return "the Animator is writing a test scene"
    if SAMPLING["pid"] is not None:
        return "the voice samples are being made"
    if VOICEWORK["what"]:
        return VOICEWORK["what"]
    return ""


def animator_test_view(p):
    try:
        return json.loads((ROOT / "content" / f"project-{p['id']}" / "animator-test" / "test.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def run_animator_test(pid, eid, index):
    """The Animator writes one bespoke scene; it is rendered next to the kit's version for the owner to compare."""
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
        cp.log("Animator", "animator_test_ready", None, {"project": pid, "episode": eid, "scene": index})
        atlas_says("**The Animator's test scene is ready.** Open Ideas → Content → Animator test and watch the kit's version and the Animator's version side by side.")
    except Exception as ex:
        cp.log("Animator", "animator_test_failed", None, {"reason": str(ex)[:300]})
        atlas_says(f"The Animator's test scene couldn't be made: {ex}")
    finally:
        ANIMTEST["pid"] = None


def characters_view(p):
    """The character library for an animated project: reference sheets, test clips, Israa's review, the owner's approval."""
    lib = quality.load_library(p["id"]) or {"characters": []}
    names = {"narrator": "The Traveller", "scholar": "The Scholar", "ruler": "The Ruler"}
    return {"characters": [{"id": c["id"], "name": names.get(c["id"], c["id"]), "has_sheet": bool(c.get("sheet")), "has_clip": bool(c.get("clip")),
                            "review": (lib.get("reviews") or {}).get(c["id"])} for c in lib["characters"]],
            "made": lib.get("made"), "voice": (lib.get("voice") or {}).get("label"),
            "approved": bool((p.get("meta") or {}).get("characters_approved")),
            "making": CHARMAKING["step"] if CHARMAKING["pid"] == p["id"] else ""}


def run_characters(pid, clips=True):
    """Make the reference sheets (and the 30 s test clips), then Israa reviews them. Minutes, not seconds: the owner is told."""
    CHARMAKING.update(pid=pid, step="Making the characters' reference sheets and test clips (about 15 minutes)")
    try:
        py = shorts_python()
        if not py:
            raise RuntimeError("the video tools aren't set up on this computer (see SHORTS_PYTHON in settings.py)")
        p = subprocess.run([py, str(ROOT / "animate.py"), "characters" if clips else "sheets", str(pid)], cwd=ROOT, capture_output=True,
                           text=True, encoding="utf-8", errors="replace", timeout=5400, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        lines = (p.stdout or "").splitlines()
        if not any(l.startswith("RESULT ") for l in lines):
            blocked = next((l[8:] for l in lines if l.startswith("BLOCKED ")), None)
            raise RuntimeError(blocked or ((p.stderr or p.stdout or "no output").strip().splitlines() or ["?"])[-1][:300])
        cp.log("Calina", "characters_made", None, {"project": pid, "clips": clips})
        if clips:
            CHARMAKING["step"] = "Israa is checking each character against its reference sheet"
            try:
                rv = quality.review_characters(pid)
                bad = [k for k, v in rv.items() if v.get("verdict") != "pass"]
                atlas_says("**The character tests are ready.** " + ("Israa passed all of them." if not bad else
                           f"Israa wants fixes on: {', '.join(bad)} (her notes are on each character).") +
                           "\n\nOpen Ideas → Content → Characters, watch each test clip and approve the characters. No new Short is made until you do.")
            except Exception as ex:
                atlas_says(f"**The character tests are made,** but Israa couldn't review them: {ex}\n\nOpen Ideas → Content → Characters to watch them.")
        else:
            atlas_says("The character reference sheets are ready in Ideas → Content → Characters.")
    except Exception as ex:
        cp.log("Calina", "characters_failed", None, {"reason": str(ex)[:300]})
        atlas_says(f"The characters couldn't be made: {ex}")
    finally:
        CHARMAKING.update(pid=None, step="")


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
        atlas_says("**The voice samples are ready.** Open Ideas → Content and listen to the same lines in each voice, then pick one.")
    except Exception as ex:
        atlas_says(f"The voice samples couldn't be made: {ex}")
    finally:
        SAMPLING["pid"] = None


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
            mode = "assemble" if e and production.is_v2(e) else "render"
            script = "animate.py" if animated else "shorts.py"
            p = subprocess.run([py, str(ROOT / script), "render" if animated else mode, str(eid)], cwd=ROOT, capture_output=True,
                               text=True, encoding="utf-8", errors="replace", timeout=3600 if animated else 1800,
                               creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            lines = (p.stdout or "").splitlines()
            result = next((l[7:] for l in lines if l.startswith("RESULT ")), None)
            if not result:
                blocked = next((l[8:] for l in lines if l.startswith("BLOCKED ")), None)
                raise RuntimeError(blocked or ((p.stderr or p.stdout or "no output").strip().splitlines() or ["?"])[-1][:300])
            r = json.loads(result)
            cp.log("Calina", "video_ready", None, {"episode": eid, "title": r["title"], "seconds": r["seconds"]})
            rv = quality.review_video(eid)   # Israa looks at it before the owner does
            pace = (f" The voice still reads at {r['wpm']} words a minute even after slowing it: lower the speed in OpenArt's "
                    "text-to-speech next time." if r.get("wpm", 0) > 158 else "")
            what = (f"{r['images']} animated scenes, voice: {r.get('voice', '')}" if animated else
                    f"{r['images']} clips" if mode == "assemble" else f"{r['images']} public-domain images")
            verdict = ""
            if rv:
                word = {"release": "she says it is good enough to publish", "redo": "she says it is NOT good enough and should be redone",
                        "unreviewed": "she couldn't review it"}.get(rv["verdict"], rv["verdict"])
                top = "; ".join(f"[{x.get('area', '')}] {x['issue']}" for x in (rv.get("problems") or [])[:3])
                verdict = (f"\n\n**Israa looked at it:** {word} ({rv.get('score', '?')}/10). {rv.get('summary', '')}"
                           + (f"\nHer main problems: {top}" if top and rv["verdict"] != "release" else ""))
            atlas_says(f"**Short #{eid} is ready:** {r['title']} ({r['seconds']:.0f} s, {what}).{pace}{verdict}\n\n"
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
                "refboards": {p["id"]: cp.latest_refboard(p["id"]) for p in cp.list_projects(20) if p["status"] == "approved"},
                "board_unlocked": {p["id"]: bool(quality.style_bar(p["id"])) for p in cp.list_projects(20) if p["status"] == "approved"},
                "eleven": {"configured": elevenlabs.configured(), "chars_month": cp.eleven_chars_month(),
                           "limit": getattr(settings, "ELEVEN_MONTHLY_CHARS", 30000)},
                "characters": {p["id"]: characters_view(p) for p in cp.list_projects(20) if p["status"] == "approved" and (p.get("meta") or {}).get("format") == "animated_v1"},
                "animator_test": {p["id"]: dict(animator_test_view(p) or {}, making=ANIMTEST["pid"] == p["id"]) for p in cp.list_projects(20)
                                  if p["status"] == "approved" and (p.get("meta") or {}).get("format") == "animated_v1"},
                "scouting_refs": quality.SCOUTING.locked(), "reviewing": quality.REVIEWING.locked(),
                "lnd": cp.list_lnd_ideas(30), "lnd_status": lnd.STATUS, "lnd_report": lnd.REPORT,
                "voice_samples": {p["id"]: voice_samples(p) for p in cp.list_projects(20) if p["status"] == "approved" and (p.get("meta") or {}).get("format") == "animated_v1"},
                "production": {p["id"]: agents.production_summary(p["id"]) for p in cp.list_projects(20) if p["status"] == "approved"},
                "usage": cp.usage_today(), "allowance": getattr(settings, "SUBSCRIPTION_DAILY_VALUE_USD", {}),
                "engines": {a: workers.engine(a) for a in cp.WORKERS},
                "limits": cp.limits_view(),
                "scouting": agents.SCOUTING.locked(),
                "last_scout": cp.last_event_time("scout_done", "Doulya"),
                "chat": chat, "busy": busy, "atlas_engine": atlas_engine.engine(), "atlas_cloud": atlas_cloud.configured(),
                "spend_today": round(cp.spend_today(), 4),
                "daily_cap": settings.DAILY_AI_BUDGET_USD,
                "idea_cap": settings.PER_IDEA_BUDGET_USD,
                "kill": cp.STOP_FILE.exists(),
                "simulated": os.environ.get("HQ_SIMULATE") == "1",
                "has_key": bool(os.environ.get("ANTHROPIC_API_KEY")) or os.environ.get("HQ_SIMULATE") == "1",
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
            if action == "voice":   # the owner picks the narrator's voice from the samples
                vid = str(self._json_body().get("id", ""))
                known = {v["id"]: v for v in voice_samples(cp.get_project(pid, with_text=False) or {"id": pid})["voices"]}
                if vid not in known:
                    return self._send(400, {"error": "Make the voice samples first, then pick one of them."})
                cp.set_project_meta(pid, voice={"id": vid, "label": known[vid]["label"]})
                cp.log("Owner", "voice_chosen", None, {"project": pid, "voice": vid})
                return self._send(200, {"ok": True, "message": f"Voice chosen: {known[vid]['label']}. It's used from the next Short."})
            if action == "characters":   # make | sheets | review | approve
                body = self._json_body()
                what = body.get("action", "make")
                if what == "approve":
                    lib = quality.load_library(pid)
                    if not lib or not any(c.get("clip") for c in lib["characters"]):
                        return self._send(409, {"error": "Make the character tests first, then watch them before approving."})
                    cp.set_project_meta(pid, characters_approved=True)
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
                    def go():
                        CHARMAKING.update(pid=pid, step="Israa is checking each character against its reference sheet")
                        try:
                            quality.review_characters(pid)
                            atlas_says("Israa has re-checked the characters: open Ideas → Content → Characters.")
                        except Exception as ex:
                            atlas_says(f"Israa couldn't check the characters: {ex}")
                        finally:
                            CHARMAKING.update(pid=None, step="")
                    threading.Thread(target=go, daemon=True).start()
                    return self._send(202, {"ok": True, "message": "Israa is checking the characters (a few minutes)."})
                cp.set_project_meta(pid, characters_approved=False)   # new tests, new approval
                threading.Thread(target=run_characters, args=(pid, what != "sheets"), daemon=True).start()
                return self._send(202, {"ok": True, "message": "Making the characters: about 15 minutes. You'll be told when they're ready."})
            if action == "animator-test":   # the Animator writes one bespoke scene to compare with the kit's
                body = self._json_body()
                try:
                    eid, idx = int(body.get("episode")), int(body.get("scene", 6))
                except (TypeError, ValueError):
                    return self._send(400, {"error": "Give the episode and the scene number."})
                if anim_busy():
                    return self._send(409, {"error": f"The animation tools are busy: {anim_busy()}. Try again when it's done."})
                threading.Thread(target=run_animator_test, args=(pid, eid, idx), daemon=True).start()
                return self._send(202, {"ok": True, "message": "The Animator is writing the scene: about 10 minutes."})
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
                    return self._send(409, {"error": "Calina is locked until you've approved a reference board: have the Scout find what works first (Ideas -> Content -> Find what works)."})
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
            if action == "israa":   # ask Israa to review the video again
                e = cp.get_episode(eid)
                if not e or not e["video_path"]:
                    return self._send(409, {"error": "There's no video to review yet."})
                if quality.REVIEWING.locked():
                    return self._send(409, {"error": "Israa is busy reviewing something else."})
                threading.Thread(target=quality.review_video, args=(eid,), daemon=True).start()
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
                if production.is_animated(e):
                    pr = cp.get_project(e["project_id"], with_text=False) or {}
                    if not (pr.get("meta") or {}).get("characters_approved"):
                        return self._send(409, {"error": "You haven't approved the characters yet. Open Ideas → Content → Characters, watch the test clips, then approve. No new Short is made before that."})
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
                threading.Thread(target=run_render, args=(eid,), daemon=True).start()
                wait = "10-15 minutes" if production.is_animated(e) else "2-3 minutes"
                return self._send(202, {"ok": True, "message": f"Calina is putting the Short together. It takes about {wait}."})
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
    finally:
        try:
            atlas_cloud.offer_setup()
        except Exception as e:
            print("  Cloud Atlas setup failed:", repr(e), flush=True)
        try:
            elevenlabs.offer_setup()
        except Exception as e:
            print("  ElevenLabs setup failed:", repr(e), flush=True)


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
