"""
Animated Shorts (plan 3): an approved scene file -> a cartoon Short, ready for the owner to upload by hand.

    <video-tools python> animate.py render <episode id>      voice -> mouth cues -> Remotion -> short.mp4
    <video-tools python> animate.py check <episode id>
    <video-tools python> animate.py samples [project id]     the same line in several voices, for the owner to pick
    <video-tools python> animate.py setup                    install the animation tools (Node + Remotion), once

Runs in the same environment as shorts.py (~/.agent-hq-shorts: Kokoro, Piper, faster-whisper). The cartoon itself is the
Remotion project in animation/ (style guide: animation/STYLE-GUIDE.md). Node and Remotion live in ~/.agent-hq-anim, so
updates never touch them. Output goes to content/project-N/videos/ep-NNN/ as before.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
import wave
import zipfile
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))
import control_plane as cp  # noqa: E402
import production  # noqa: E402
import settings  # noqa: E402
import shorts  # noqa: E402
import elevenlabs  # noqa: E402
import quality  # noqa: E402
import rules  # noqa: E402
import sfx  # noqa: E402
from shorts import Blocked, say  # noqa: E402

FPS = 30
HOME = Path.home() / ".agent-hq-anim"
NODE_VERSION = "24.21.0"
NODE_DIR = HOME / "node"
APP = HOME / "app"
PIPER_DIR = HOME / "piper"
PIPER_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/"
LEAD, PAD, PAD_HOOK, OUTRO_SECONDS = 0.15, 0.2, 0.35, 4.5   # the end card holds while the music plays out (2.30.0)
SHORT_LIMIT = 178.0   # YouTube calls a vertical video of up to 3 minutes a Short: nothing is decided or refused here, the label just follows the length
VIDEO_CAP = 960.0     # only an absurd length (16 minutes) is refused; the story decides, Israa judges whether it earns its length
DISCLOSURE_V3 = "AI-assisted: script, voice and animation made with AI; facts sourced below."
BACKDROPS = set(quality.BACKDROPS)
CAMERAS = {"push_in", "pull_out", "pan_left", "pan_right", "pan_up", "pan_down", "drift"}
CAST = set(quality.ON_SCREEN)   # kit v2: the narrator is a voice only, never drawn
POSES = {"stand", "point", "explain", "amazed", "wave", "think", "present", "shrug", "cheer", "facepalm", "flinch"}
EXPRESSIONS = {"neutral", "happy", "surprised", "worried", "determined", "thinking", "laughing", "angry", "smug", "scared"}
REACTIONS = {"idle", "cheer", "gasp", "laugh", "murmur", "angry", "scared"}
NOFLAGS = getattr(subprocess, "CREATE_NO_WINDOW", 0)
GAP_LINE, GAP_SCENE = 0.16, 0.28   # breaths between two lines of one scene, and between scenes
# 2.30.0 (the owner: "monotone and boring", "starts and ends suddenly"; OverSimplified runs at ~151 wpm with a cold open,
# a title sting and a slow ending): the whole voice track is played a little faster (pitch kept), and after the cold-open
# sketch the picture holds a full-screen title card for TITLE_SECONDS while the music carries on.
NARR_TEMPO = 1.08
TITLE_SECONDS = 2.6
PRONOUNCE = "Syene=Sigh-EE-nee"   # live rule voice.pronounce: how the voices must say names they get wrong (captions keep the spelling)
TALK_POSES = ("explain", "present", "point")   # a character who speaks without a stage direction gestures with one of these

# voices the owner can pick from: id -> (engine, voice, label)
VOICES = {
    "kokoro-george": ("kokoro", "bm_george", "Kokoro: George (British man), slowed"),
    "kokoro-emma": ("kokoro", "bf_emma", "Kokoro: Emma (British woman), slowed"),
    "piper-alan": ("piper", "en_GB-alan-medium", "Piper: Alan (British man), slowed"),
    "piper-ryan": ("piper", "en_US-ryan-high", "Piper: Ryan (American man), slowed"),
}
DEFAULT_VOICE = "kokoro-george"
TARGET_WPM = 130   # measured over the whole narration INCLUDING the breaths between lines
ELEVEN_PREFIX = "eleven:"
ELEVEN_START_SPEED = 0.88   # ElevenLabs reads about 150 words a minute at 1.0; this lands near 130 without a second (billed) pass


def voice_spec(vid):
    """(engine, voice, label) for a voice id, including ElevenLabs voices ('eleven:<voice id>') and any Kokoro voice ('kokoro:am_adam')."""
    if vid in VOICES:
        return VOICES[vid]
    if str(vid).startswith(ELEVEN_PREFIX):
        return ("eleven", vid[len(ELEVEN_PREFIX):], "ElevenLabs voice")
    if str(vid).startswith("kokoro:"):
        return ("kokoro", vid[7:], f"Kokoro: {vid[7:]}")
    return VOICES[DEFAULT_VOICE]


# The free stand-ins when ElevenLabs isn't set up: a different Kokoro voice for each kind of character.
KOKORO_CAST = {"scholar": "kokoro:bm_lewis", "ruler": "kokoro:am_onyx", "citizen": "kokoro:am_puck", "woman": "kokoro:bf_isabella",
               "elder": "kokoro:bm_daniel", "merchant": "kokoro:am_eric", "guard": "kokoro:am_fenrir", "worker": "kokoro:am_michael"}
# What each character sounds like, to pick a voice from the owner's ElevenLabs account: (gender, ages, words in the description)
CAST_SOUND = {"scholar": ("male", ("old", "middle_aged", "middle aged"), ("wise", "warm", "raspy", "deep")),
              "ruler": ("male", ("middle_aged", "middle aged", "old"), ("deep", "confident", "authoritative", "strong")),
              "citizen": ("male", ("young",), ("casual", "friendly", "energetic")),
              "woman": ("female", ("young", "middle_aged", "middle aged"), ("confident", "warm", "expressive")),
              "elder": ("male", ("old",), ("raspy", "grumpy", "gravelly", "old")),
              "merchant": ("male", ("middle_aged", "middle aged"), ("casual", "friendly", "raspy")),
              "guard": ("male", ("young", "middle_aged", "middle aged"), ("strong", "deep", "intense")),
              "worker": ("male", ("young", "middle_aged", "middle aged"), ("casual", "gruff"))}


def cast_voices(project, speakers):
    """The voice of every speaker in a script: {who: voice id}. The narrator has the project's voice; each character has the voice the
    owner set for it (Voice & characters page, `cast_voices` in project meta) or, the first time, one picked from his ElevenLabs account
    by gender and age (and saved, so a character always sounds the same), or a free Kokoro voice."""
    meta = (project or {}).get("meta") or {}
    narrator, _ = voice_choice(project)
    chosen = dict(meta.get("cast_voices") or {})
    out, new = {"narrator": narrator}, {}
    taken = {narrator} | {v for v in chosen.values() if v}
    account = None
    for who in [w for w in speakers if w != "narrator"]:
        v = chosen.get(who)
        if v and (not str(v).startswith(ELEVEN_PREFIX) or elevenlabs.configured()):
            out[who] = v
            continue
        pick = None
        if elevenlabs.configured():
            try:
                account = account if account is not None else elevenlabs.account_voices()
            except elevenlabs.ElevenError as e:
                say(f"  Couldn't read your ElevenLabs voices ({str(e)[:120]}): free voices for the characters.")
                account = []
            gender, ages, words = CAST_SOUND.get(who, ("male", (), ()))

            def score(v):
                s = 10 if v["gender"] == gender else -50
                s += 4 if v["age"] in ages else 0
                s += sum(2 for w in words if w in (v["description"] + " " + v["use_case"]))
                return s - (30 if ELEVEN_PREFIX + v["id"] in taken else 0)
            best = max(account, key=score, default=None)
            if best and score(best) > 0:
                pick = ELEVEN_PREFIX + best["id"]
        pick = pick or KOKORO_CAST.get(who, "kokoro:am_michael")
        out[who] = new[who] = pick
        taken.add(pick)
    if new and project:
        cp.set_project_meta(project["id"], cast_voices={**chosen, **new})
        say("  Voices picked for: " + ", ".join(f"{k} ({v})" for k, v in new.items()) + " (change them on the Voice & characters page).")
    return out


# ---- tools: Node + Remotion ----------------------------------------------------------
def node_env():
    env = dict(os.environ)
    env["PATH"] = str(NODE_DIR) + os.pathsep + env.get("PATH", "")
    return env


def download(url, dest):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": shorts.UA}), timeout=180, context=shorts.TLS) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)


def cast_file(project_id):
    """The project's own cast drawn by Rana (cast.py), if it has one: content/project-N/cast/v<K>/Character.jsx, else None (the kit's)."""
    if project_id is None:
        return None
    p = cp.get_project(int(project_id), with_text=False) or {}
    f = ((p.get("meta") or {}).get("cast") or {}).get("file")
    return ROOT / f if f and (ROOT / f).exists() else None


def ensure_toolchain(project_id=None, cast=None):
    """Node (a private copy, so the owner's own Node never matters) and Remotion's packages. Safe to call every time."""
    HOME.mkdir(exist_ok=True)
    if not (NODE_DIR / "node.exe").exists():
        say(f"Installing the animation tools (Node {NODE_VERSION}), one time...")
        name = f"node-v{NODE_VERSION}-win-x64"
        zpath = HOME / "node.zip"
        download(f"https://nodejs.org/dist/v{NODE_VERSION}/{name}.zip", zpath)
        sums = shorts.fetch(f"https://nodejs.org/dist/v{NODE_VERSION}/SHASUMS256.txt")
        sums = sums.decode() if isinstance(sums, bytes) else sums
        want = next((l.split()[0] for l in sums.splitlines() if l.strip().endswith(name + ".zip")), None)
        got = hashlib.sha256(zpath.read_bytes()).hexdigest()
        if want != got:
            zpath.unlink(missing_ok=True)
            raise Blocked("The Node download didn't match its published checksum, so it was thrown away.")
        with zipfile.ZipFile(zpath) as z:
            z.extractall(HOME)
        shutil.rmtree(NODE_DIR, ignore_errors=True)
        (HOME / name).rename(NODE_DIR)
        zpath.unlink(missing_ok=True)
    # the cartoon's source ships with the program; copy it next to the packages
    src = ROOT / "animation"
    APP.mkdir(exist_ok=True)
    shutil.rmtree(APP / "src", ignore_errors=True)
    shutil.copytree(src / "src", APP / "src")
    changed = (APP / "package.json").read_bytes() != (src / "package.json").read_bytes() if (APP / "package.json").exists() else True
    shutil.copy2(src / "package.json", APP / "package.json")
    if (src / "package-lock.json").exists():
        shutil.copy2(src / "package-lock.json", APP / "package-lock.json")
    if changed or not (APP / "node_modules" / "remotion").exists():
        say("Installing Remotion (the animation engine), one time...")
        p = subprocess.run([str(NODE_DIR / "npm.cmd"), "install", "--no-audit", "--no-fund"], cwd=APP, env=node_env(),
                           capture_output=True, text=True, encoding="utf-8", errors="replace", creationflags=NOFLAGS)
        if p.returncode != 0:
            raise Blocked("Installing Remotion failed: " + (p.stderr or p.stdout).strip()[-300:])
    local_fonts()
    own = Path(cast) if cast else cast_file(project_id)
    if own:   # this project's cast, drawn by Rana, instead of the kit's characters (same exports, checked by cast.validate)
        shutil.copy2(own, APP / "src" / "Character.jsx")
        say(f"  Cast: {own.relative_to(ROOT).as_posix() if ROOT in own.parents else own.name}")


# The kit's two fonts (SIL Open Font Licence), downloaded once and baked into the bundle, so a render never waits on Google Fonts.
FONTS = {"head": ("LilitaOne-Regular.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/lilitaone/LilitaOne-Regular.ttf"),
         "body": ("Nunito-wght.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/Nunito%5Bwght%5D.ttf")}


def local_fonts():
    """Writes src/fonts.js with the fonts as data URLs. If they can't be had, the shipped fonts.js (null) keeps Google Fonts."""
    import base64
    folder = HOME / "fonts"
    folder.mkdir(exist_ok=True)
    urls = {}
    for key, (name, url) in FONTS.items():
        f = folder / name
        if not f.exists():
            try:
                download(url, f)
            except Exception as e:  # noqa: BLE001
                f.unlink(missing_ok=True)
                say(f"  Couldn't download the font {name} ({str(e)[:100]}): this render loads it from Google Fonts.")
                return
        data = f.read_bytes()
        if data[:4] not in (b"\x00\x01\x00\x00", b"true", b"OTTO"):
            f.unlink(missing_ok=True)
            say(f"  The font {name} wasn't a real font file, so it was thrown away: this render loads it from Google Fonts.")
            return
        urls[key] = "data:font/ttf;base64," + base64.b64encode(data).decode()
    (APP / "src" / "fonts.js").write_text("// written by animate.py: the kit's fonts, local\nexport const LOCAL_FONTS = "
                                          + json.dumps(urls) + ";\n", encoding="utf-8")


BROWSER_TIMEOUT_MS = 120000   # Remotion's default is 30 s; the headless browser on his PC sometimes needs longer to start
BROWSER_ERRORS = ("setting up the headless browser", "Session closed", "Target closed", "Protocol error",
                  "browser has disconnected", "Failed to launch the browser", "Browser closed", "connect to the browser")


def remotion(args, timeout=3000):
    """Runs Remotion's CLI. A headless-browser start/close error gets one automatic retry, and says so."""
    cli = APP / "node_modules" / "@remotion" / "cli" / "remotion-cli.js"
    args = [*args, f"--timeout={BROWSER_TIMEOUT_MS}"]
    for attempt in (1, 2):
        p = subprocess.run([str(NODE_DIR / "node.exe"), str(cli), *args], cwd=APP, env=node_env(), capture_output=True,
                           text=True, encoding="utf-8", errors="replace", timeout=timeout, creationflags=NOFLAGS)
        if p.returncode == 0:
            return p.stdout
        text = re.sub(r"\x1b\[[0-9;]*m", "", (p.stderr or "") + (p.stdout or "")).strip()
        k = text.find("Error:")
        detail = text[k:k + 900] if k >= 0 else text[-600:]
        browser = any(b.lower() in text.lower() for b in BROWSER_ERRORS)
        if browser and attempt == 1:
            say("  Remotion's headless browser failed to start or closed early; trying once more. (" + detail[:200] + ")")
            time.sleep(5)
            continue
        if browser:
            raise Blocked("Remotion failed twice because its headless browser didn't start or closed early (not a problem in the "
                          "scene file): " + detail)
        raise Blocked("Remotion failed: " + detail)


# ---- 1. checklist ---------------------------------------------------------------------
def is_animated(ep):
    return bool((ep.get("data") or {}).get("scenes"))


def narration(d):
    return [s.get("voice_line", "").strip() for s in d.get("scenes") or []]


def checklist(ep):
    d, problems = quality.sync_voice_lines(ep["data"]), []
    scenes = d.get("scenes") or []
    for s in scenes:   # dialogue (kit v2): every line has a known speaker, and every speaker but the narrator is on screen
        n = s.get("n", "?")
        here = {c.get("who") for c in s.get("characters") or []}
        for x in s.get("lines") or []:
            who = x.get("who")
            if who not in quality.SPEAKERS:
                problems.append(f"Scene {n}: '{who}' can't speak (speakers: {', '.join(quality.SPEAKERS)}).")
            elif who != "narrator" and who not in here:
                problems.append(f"Scene {n}: {who} speaks but isn't in the scene's characters.")
            if len((x.get("text") or "").split()) > quality.MAX_LINE_WORDS and len(quality._sentences(x.get("text"))) < 2:
                problems.append(f"Scene {n}: {who}'s line is one sentence over {quality.MAX_LINE_WORDS} words: split it.")
            if x.get("expression") and x["expression"] not in EXPRESSIONS:
                problems.append(f"Scene {n}: expression '{x['expression']}' isn't one of {', '.join(sorted(EXPRESSIONS))}.")
            if x.get("pose") and x["pose"] not in POSES:
                problems.append(f"Scene {n}: pose '{x['pose']}' isn't one of {', '.join(sorted(POSES))}.")
            if x.get("action") and (x["action"] not in quality.ACTIONS or who not in here):
                problems.append(f"Scene {n}: action '{x['action']}' needs an on-screen speaker and one of {', '.join(quality.ACTIONS)}.")
            if x.get("camera") and x["camera"] not in quality.CAM_HITS:
                problems.append(f"Scene {n}: camera hit '{x['camera']}' isn't one of {', '.join(quality.CAM_HITS)}.")
            for r in x.get("reacts") or []:
                if r.get("who") not in here or r.get("action") not in quality.ACTIONS:
                    problems.append(f"Scene {n}: the reaction {r.get('who')}/{r.get('action')} needs a character in the scene and one of {', '.join(quality.ACTIONS)}.")
        for c in s.get("characters") or []:
            if c.get("who") == "narrator":
                problems.append(f"Scene {n}: the narrator is a voice now, not a character on screen (and nobody holds a POV sign).")
            if c.get("action") and c["action"] not in quality.ACTIONS:
                problems.append(f"Scene {n}: action '{c['action']}' isn't one of {', '.join(quality.ACTIONS)}.")
        gag = s.get("gag")
        if gag:
            if gag.get("type") not in quality.GAGS:
                problems.append(f"Scene {n}: gag '{gag.get('type')}' isn't one of {', '.join(quality.GAGS)}.")
            elif gag["type"] == "freeze_label" and not (gag.get("text") or "").strip():
                problems.append(f"Scene {n}: a freeze-frame gag needs its label text.")
            elif gag["type"] == "interrupt" and gag.get("who") not in {x.get("who") for x in s.get("lines") or []} - {"narrator"}:
                problems.append(f"Scene {n}: an interrupt gag needs 'who': a character who speaks in that scene.")
        if s.get("transition") and s["transition"] not in quality.TRANSITIONS:
            problems.append(f"Scene {n}: transition '{s['transition']}' isn't one of {', '.join(quality.TRANSITIONS)}.")
        if (s.get("crowd") or {}).get("reaction", "idle") not in REACTIONS:
            problems.append(f"Scene {n}: crowd reaction '{s['crowd'].get('reaction')}' isn't one of {', '.join(sorted(REACTIONS))}.")
        for x in s.get("sfx") or []:
            if (x.get("name") if isinstance(x, dict) else x) not in sfx.MENU:
                problems.append(f"Scene {n}: sound effect '{x}' isn't in the menu.")
    if not quality.MIN_SCENES <= len(scenes) <= quality.MAX_SCENES:
        problems.append(f"The scene file has {len(scenes)} scenes; it should have {quality.MIN_SCENES}-{quality.MAX_SCENES}.")
    lines = narration(d)
    words = sum(len(l.split()) for l in lines)
    if not quality.MIN_WORDS <= words <= quality.MAX_WORDS:   # only absurd lengths: no fixed target, the story sets it
        problems.append(f"The narration is {words} words; the limits are {quality.MIN_WORDS}-{quality.MAX_WORDS} (live rules script.min_words / script.max_words).")
    for s in scenes:
        n = s.get("n", "?")
        if not (s.get("voice_line") or "").strip():
            problems.append(f"Scene {n} has no voice line.")
        elif s.get("lines"):
            pass   # dialogue scenes: checked line by line above
        elif len(s["voice_line"].split()) > quality.MAX_LINE_WORDS:
            problems.append(f"Scene {n}'s voice line is over {quality.MAX_LINE_WORDS} words and is a single sentence: split that sentence into two.")
        elif not re.search(r"[.!?]['\")]?$", s["voice_line"].strip()):
            problems.append(f"Scene {n}'s voice line isn't a finished sentence (it should end with . ! or ?).")
        if s.get("backdrop") not in BACKDROPS:
            problems.append(f"Scene {n}: backdrop '{s.get('backdrop')}' isn't one of {', '.join(sorted(BACKDROPS))}.")
        if s.get("camera") and s["camera"] not in CAMERAS:
            problems.append(f"Scene {n}: camera '{s['camera']}' isn't one of {', '.join(sorted(CAMERAS))}.")
        for c in s.get("characters") or []:
            if c.get("who") not in CAST or c.get("pose", "stand") not in POSES:
                problems.append(f"Scene {n}: character {c.get('who')}/{c.get('pose')} isn't in the cast.")
        if s.get("backdrop") == "map" and not (s.get("map") or {}).get("focus"):
            problems.append(f"Scene {n}: a map scene needs map.focus [lat, lon].")
        if not (s.get("source_note") or "").strip():
            problems.append(f"Scene {n} has no source note.")
    if len({s.get("backdrop") for s in scenes}) < 4:
        problems.append("Fewer than 4 different backdrops: it would look like one repeated scene.")
    if not [x for x in d.get("sources") or [] if str(x.get("url", "")).startswith("http") and x.get("quote")]:
        problems.append("No source with a link and a supporting quote.")
    project = cp.get_project(ep["project_id"], with_text=False)
    for field in ("title", "description", "hook"):
        left = shorts.PLACEHOLDER.findall(shorts.fill_placeholders(str(d.get(field) or ""), project))
        if left:
            problems.append(f"The {field} still has a placeholder: {', '.join(sorted(set(left)))}.")
    if ep["status"] not in ("approved", "rendered", "published"):
        problems.append(f"The script is {ep['status'].replace('_', ' ')}, not approved.")
    key = (str(d.get("place", "")).strip().lower(), str(d.get("year", "")).strip().lower())
    hook5 = " ".join((d.get("hook") or "").lower().split()[:5])
    for o in cp.list_episodes(ep["project_id"], limit=500):
        if o["id"] == ep["id"] or o["status"] == "rejected" or (o["data"] or {}).get("do_not_upload"):
            continue   # a retired or do-not-upload draft is not a repeat
        od = o["data"]
        if od.get("rebuild_of") == ep["id"] or d.get("rebuild_of") == o["id"]:
            continue   # a rebuild of an earlier script legitimately repeats it
        if key != ("", "") and (str(od.get("place", "")).strip().lower(), str(od.get("year", "")).strip().lower()) == key:
            problems.append(f"Same place and year as episode #{o['id']} ({o['title']}).")
        if hook5 and " ".join((od.get("hook") or "").lower().split()[:5]) == hook5:
            problems.append(f"The hook opens the same way as episode #{o['id']}: a repeated template.")
        # scene order must differ from the last Shorts: backdrop sequence
        a = [s.get("backdrop") for s in scenes]
        b = [s.get("backdrop") for s in od.get("scenes") or []]
        if b and a == b:
            problems.append(f"The scene order is identical to episode #{o['id']}.")
    return problems


# ---- 2. voice ---------------------------------------------------------------------------
def _resample(a, sr, to):
    import numpy as np
    if sr == to:
        return a
    n = int(len(a) * to / sr)
    return np.interp(np.linspace(0, len(a) - 1, n), np.arange(len(a)), a).astype("float32")


def piper_model(name):
    PIPER_DIR.mkdir(parents=True, exist_ok=True)
    onnx = PIPER_DIR / f"{name}.onnx"
    lang, rest = name.split("-", 1)
    voice, quality = rest.rsplit("-", 1)
    base = f"{PIPER_BASE}{lang}/{voice}/{quality}/{name}"
    for ext in (".onnx", ".onnx.json"):
        if not (PIPER_DIR / (name + ext)).exists():
            say(f"  downloading the {name} voice (one time)...")
            download(base + ext, PIPER_DIR / (name + ext))
    return onnx


def respell(text):
    """The text as the voice should say it: every word in PRONOUNCE ("Syene=Sigh-EE-nee; ...") replaced, punctuation kept."""
    pairs = {}
    for part in re.split(r"[;\n]", PRONOUNCE or ""):
        if "=" in part:
            k, v = part.split("=", 1)
            if k.strip() and v.strip():
                pairs[k.strip().lower()] = v.strip()
    if not pairs:
        return text

    def one(m):
        w = m.group(0)
        v = pairs.get(w.lower())
        return v if v else w
    return re.sub(r"[A-Za-zÀ-ɏ]+", one, text)   # "Syene's" -> "Sigh-EE-nee's"


class Speaker:
    """One voice. line(text) -> (float32 audio at SR, [(word, start, end)] relative to the line)."""
    SR = 24000

    def __init__(self, voice_id, speed):
        self.engine, self.voice, _ = voice_spec(voice_id)
        self.speed = speed
        self.chars = 0   # billed characters (ElevenLabs only)
        if self.engine == "eleven":
            pass
        elif self.engine == "kokoro":
            from kokoro import KPipeline
            self.pipe = KPipeline(lang_code=self.voice[0], repo_id="hexgrad/Kokoro-82M")
        else:
            from piper import PiperVoice
            self.model = PiperVoice.load(str(piper_model(self.voice)))

    def line(self, text, previous="", following="", tag=""):
        said = respell(text)
        if said == text:
            return self._line(text, previous, following, tag)
        a, words = self._line(said, previous, following, tag)
        if words:   # the timings name the respelled words: give them back their real spelling, word by word
            real = text.split()
            if len(real) == len(words):
                words = [[r, w[1], w[2]] for r, w in zip(real, words)]
        return a, words

    def _line(self, text, previous="", following="", tag=""):
        import numpy as np
        if self.engine == "eleven":
            a, words, n = elevenlabs.speak(self.voice, text, self.speed, previous, following, tag=tag)
            self.chars += n
            return a, words
        if self.engine == "kokoro":
            chunks, words, offset = [], [], 0.0
            for r in self.pipe(text, voice=self.voice, speed=self.speed):
                a = r.audio.numpy() if hasattr(r.audio, "numpy") else np.asarray(r.audio)
                for t in r.tokens or []:
                    if t.start_ts is None:
                        continue
                    if not re.search(r"\w", t.text):
                        if words:
                            words[-1][0] += t.text
                        continue
                    words.append([t.text, offset + t.start_ts, offset + t.end_ts])
                offset += len(a) / 24000
                chunks.append(a)
            return np.concatenate(chunks).astype("float32"), words
        from piper import SynthesisConfig
        pcm = []
        for ch in self.model.synthesize(text, syn_config=SynthesisConfig(length_scale=1.0 / self.speed)):
            pcm.append(ch.audio_float_array)
        a = _resample(np.concatenate(pcm).astype("float32"), self.model.config.sample_rate, self.SR)
        return a, None   # no word timings: faster-whisper times them below


def whisper_words(wav, script_words, secs):
    """Word timings for a line from faster-whisper, aligned to the words we know were said."""
    return [[t["w"], t["s"], t["e"]] for t in shorts.word_timings(shorts.find_ffmpeg(), wav, script_words, secs)]


def synth(voice_id, lines, wpm_target, folder, project_voice_speed=None):
    """Voice every scene's line, with a short breath between lines. Returns (audio path, per-scene starts, words, seconds,
    words per minute over the whole narration, billed characters)."""
    import numpy as np
    import soundfile as sf
    eleven = voice_spec(voice_id)[0] == "eleven"
    speed = project_voice_speed or (ELEVEN_START_SPEED if eleven else 0.85)
    chars = 0
    for attempt in range(1 if eleven else 2):   # ElevenLabs is billed per character: one pass only
        sp = Speaker(voice_id, speed)
        audio, starts, words = [np.zeros(int(LEAD * Speaker.SR), dtype="float32")], [], []
        t = LEAD
        for i, text in enumerate(lines):
            if eleven:
                a, w = sp.line(text, " ".join(lines[max(0, i - 2):i]), " ".join(lines[i + 1:i + 3]))
            else:
                a, w = sp.line(text)
            if w is None:
                tmp = folder / "_line.wav"
                sf.write(str(tmp), a, Speaker.SR)
                w = whisper_words(tmp, text.split(), len(a) / Speaker.SR)
                tmp.unlink(missing_ok=True)
            starts.append(t)
            words += [[x[0], t + x[1], t + x[2]] for x in w]
            audio.append(a)
            dur = len(a) / Speaker.SR
            pad = PAD_HOOK if i == 0 else PAD
            audio.append(np.zeros(int(pad * Speaker.SR), dtype="float32"))
            t += dur + pad
        chars += sp.chars
        wpm = sum(len(l.split()) for l in lines) / ((t - LEAD) / 60)   # the pace a viewer feels: pauses included
        if not eleven and attempt == 0 and abs(wpm - wpm_target) / wpm_target > 0.06:
            speed = max(0.55, min(1.3, speed * wpm_target / wpm))
            say(f"  reads at {wpm:.0f} words a minute: trying {speed:.2f}x to land near {wpm_target}")
            continue
        break
    wav = folder / "_voice_raw.wav"
    sf.write(str(wav), np.concatenate(audio), Speaker.SR)
    return wav, starts, words, t, wpm, chars


def utterances(d, project):
    """Every spoken line of a script in order: [{scene, who, text, tag, pose, expression, crowd}] (placeholders filled)."""
    out = []
    for i, s in enumerate(d.get("scenes") or []):
        for x in quality.scene_lines(s):
            out.append({**x, "scene": i, "text": shorts.fill_placeholders(x["text"], project)})
    return out


def synth_dialogue(items, voices, folder):
    """Voice every line in its speaker's voice, with a breath between lines (a longer one between scenes). Returns (audio path,
    per-scene starts, words [[word, start, end, who]], end time, words per minute, billed characters, segments [(start, end, who)])."""
    import numpy as np
    import soundfile as sf
    speakers, chars = {}, 0
    audio, words, segs, starts = [np.zeros(int(LEAD * Speaker.SR), dtype="float32")], [], [], {}
    t = LEAD
    for k, it in enumerate(items):
        vid = voices.get(it["who"]) or voices["narrator"]
        eleven = voice_spec(vid)[0] == "eleven"
        if vid not in speakers:
            speakers[vid] = Speaker(vid, 1.0 if eleven else 0.92)
        sp = speakers[vid]
        same = [x["text"] for x in items if x["who"] == it["who"]]
        idx = sum(1 for x in items[:k] if x["who"] == it["who"])
        a, w = sp.line(it["text"], " ".join(same[max(0, idx - 2):idx]), " ".join(same[idx + 1:idx + 3]), tag=it.get("tag") or "")
        if w is None:   # no timings came back: faster-whisper times the words
            tmp = folder / "_line.wav"
            sf.write(str(tmp), a, Speaker.SR)
            w = whisper_words(tmp, it["text"].split(), len(a) / Speaker.SR)
            tmp.unlink(missing_ok=True)
        starts.setdefault(it["scene"], t)
        dur = len(a) / Speaker.SR
        words += [[x[0], t + x[1], t + x[2], it["who"]] for x in w]
        segs.append((t, t + dur, it["who"]))
        audio.append(a)
        nxt = items[k + 1]["scene"] if k + 1 < len(items) else None
        pad = PAD_HOOK if k == 0 else GAP_SCENE if nxt != it["scene"] else GAP_LINE
        audio.append(np.zeros(int(pad * Speaker.SR), dtype="float32"))
        t += dur + pad
    chars = sum(s.chars for s in speakers.values())
    wpm = sum(len(x["text"].split()) for x in items) / max(1e-6, (t - LEAD) / 60)
    wav = folder / "_voice_raw.wav"
    sf.write(str(wav), np.concatenate(audio), Speaker.SR)
    n_scenes = max(x["scene"] for x in items) + 1 if items else 0
    scene_starts = []
    for i in range(n_scenes):   # a scene with no line of its own starts where the previous one ended
        scene_starts.append(starts.get(i, scene_starts[-1] if scene_starts else LEAD))
    return wav, scene_starts, words, t, wpm, chars, segs


def dialogue_cached(items, voices, folder):
    """synth_dialogue, but the voices made once for these exact lines, voices and model are reused: a retry costs no characters."""
    key = hashlib.sha1(json.dumps([[voices.get(x["who"]) or voices["narrator"], x["who"], respell(x["text"]), x.get("tag") or ""] for x in items]
                                  + [elevenlabs.model()]).encode("utf-8")).hexdigest()[:16]
    cdir = folder / "_voice-cache"
    wav_c, js_c = cdir / f"d-{key}.wav", cdir / f"d-{key}.json"
    raw = folder / "_voice_raw.wav"
    if wav_c.exists() and js_c.exists():
        j = json.loads(js_c.read_text(encoding="utf-8"))
        shutil.copy2(wav_c, raw)
        say("  Reusing the voices already made for these lines (no ElevenLabs characters used).")
        return raw, j["starts"], j["words"], j["t"], j["wpm"], 0, [tuple(x) for x in j["segs"]]
    out = synth_dialogue(items, voices, folder)
    cdir.mkdir(exist_ok=True)
    shutil.copy2(out[0], wav_c)
    js_c.write_text(json.dumps({"starts": out[1], "words": out[2], "t": out[3], "wpm": out[4], "segs": out[6]}), encoding="utf-8")
    return out


def cold_open_scenes(d):
    """How many scenes the cold open is: Calina's `cold_open_scenes`, else 1 when the first scene is a sketch (someone on screen
    talks in it), else 0 (the title card then opens the video)."""
    n = d.get("cold_open_scenes")
    if isinstance(n, int) and 0 <= n < len(d["scenes"]):
        return n
    first = d["scenes"][0] if d["scenes"] else {}
    return 1 if any((l.get("who") or "narrator") != "narrator" for l in first.get("lines") or []) else 0


def shape_timeline(ffmpeg, raw, starts, words, end, segs, d, ep, folder):
    """The voice track a little faster (NARR_TEMPO, pitch kept) and a silent gap of TITLE_SECONDS after the cold open, where the
    picture shows the title card. Every time (scene starts, words, line segments) is moved to match.
    Returns (raw, starts, words, end, segs, title {from_s, secs, text, place, year})."""
    import numpy as np
    import soundfile as sf
    tempo = max(0.8, min(1.4, float(NARR_TEMPO or 1.0)))
    out = folder / "_voice_shaped.wav"
    if abs(tempo - 1.0) > 0.005:
        shorts.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(raw), "-af", f"atempo={tempo:.4f}", str(out)])
    else:
        shutil.copy2(raw, out)
    a, sr = sf.read(str(out), dtype="float32")
    k = cold_open_scenes(d)
    gap = max(0.0, float(TITLE_SECONDS or 0))
    sc = lambda t: t / tempo   # noqa: E731
    at = sc(starts[k]) if 0 < k < len(starts) else LEAD
    at = max(0.0, at - (GAP_SCENE / tempo) / 2) if k else 0.0
    if gap > 0:
        cut = int(at * sr)
        a = np.concatenate([a[:cut], np.zeros(int(gap * sr), dtype="float32"), a[cut:]])
    sf.write(str(out), a, sr)
    raw.unlink(missing_ok=True)
    mv = lambda t: sc(t) + (gap if sc(t) >= at - 1e-6 else 0.0)   # noqa: E731
    starts = [mv(t) if i >= k else sc(t) for i, t in enumerate(starts)]
    words = [[w[0], mv(w[1]), mv(w[2])] + list(w[3:]) for w in words]
    segs = [(mv(x), mv(y), w) for x, y, w in segs]
    end = mv(end)
    title = {"from_s": at, "secs": gap, "text": ep.get("title") or "", "place": d.get("place") or "", "year": d.get("year") or ""} if gap > 0 else None
    return out, starts, words, end, segs, title


def speaker_frames(segs, total_frames):
    """Who is talking at every frame ('' = nobody): the mouths of everyone else stay shut."""
    who = [""] * total_frames
    for a, b, w in segs:
        for f in range(max(0, int(a * FPS)), min(total_frames, int(b * FPS) + 2)):
            who[f] = w
    return who


ACTION_POSE = {"facepalm": "facepalm", "shrug": "shrug", "flinch": "flinch"}   # actions that are also a pose for a moment
ACTION_FACE = {"flinch": "scared", "double_take": "surprised", "facepalm": "worried"}
ACTION_SFX = {"walk_in": "footsteps", "walk_out": "footsteps", "pace": "footsteps", "jump": "boing", "flinch": "gulp", "facepalm": "slap", "double_take": "whoosh"}
ACTION_HOLD = 30        # frames a pose-action is held before he goes back to his pose
WALK_OUT_LEAD = 36      # a character who leaves the scene starts walking this many frames before it ends
FREEZE_FRAMES = 48      # a freeze-frame label holds the picture this long (the voice carries on)
MUSIC_VOLUME = 0.16     # music under the voices (live rule sound.music_volume)
SFX_STING_LEVEL = 0.42  # a sound effect on a joke or a reveal (was 0.55 for everything, no fades)
SFX_AMBIENT_LEVEL = 0.16  # a background sound under a whole moment
SFX_AMBIENT = {"birds", "wind", "crowd_murmur"}
SFX_LEVEL = {"footsteps": 0.3, "scroll": 0.3, "coins": 0.32, "pop": 0.28, "tick": 0.3, "thinking": 0.3, "magic": 0.3,
             "crowd_cheer": 0.32, "crowd_laugh": 0.32, "crowd_gasp": 0.36, "crowd_boo": 0.32}
REFRAME_EVERY = 4.0     # seconds: a stretch with nothing planned gets a cut to another framing this often (2.30.0: was 2.8)


def _word_frame(words, start, end, target):
    """Frame (on the whole timeline) at which a named word is said inside [start, end), or None."""
    t = _norm(target or "")
    if not t:
        return None
    inside = [w for w in words if start <= round(w[1] * FPS) < end]
    hit = next((w for w in inside if _norm(w[0]) == t), None) or next(
        (w for w in inside if len(t) >= 4 and (_norm(w[0]).startswith(t[:4]) or t.startswith(_norm(w[0])[:4]))), None)
    return round(hit[1] * FPS) if hit else None


# the words that name each step of the Earth diagram, when Calina doesn't say (diagram.on_words) which word draws it
DIAGRAM_WORDS = {"beams": ("rays", "sunlight", "sunbeams", "parallel", "sun"), "rods": ("sticks", "stick", "rods"),
                 "centre": ("centre", "center", "middle"), "wedge": ("angle", "slice", "degrees", "curve", "curves"),
                 "label": ("fiftieth", "fifty", "1/50", "circle")}


def _first_word_frame(words, start, end, candidates):
    hits = [f for f in (_word_frame(words, start, end, c) for c in candidates if c) if f is not None]
    return min(hits) if hits else None


def diagram_steps(s, words, start, end):
    """Frame (from the scene's start) of each step of the Earth diagram: its own `on_words`, else the first word that names
    it; a step whose word is never said comes after the previous one (never before what it builds on)."""
    want = (s.get("diagram") or {}).get("on_words") or {}
    n = max(1, end - start)
    at, prev = {}, 0
    defaults = {"beams": 0.05, "rods": 0.25, "centre": 0.45, "wedge": 0.6, "label": 0.75}
    for step in ("beams", "rods", "centre", "wedge", "label"):
        own = want.get(step)
        f = _first_word_frame(words, start, end, [own] if own else DIAGRAM_WORDS[step])
        rel = (f - start) if f is not None else int(n * defaults[step])
        rel = max(prev, min(n - 1, rel))
        at[step] = rel
        prev = rel
    return at


def rod_steps(p, s, words, start, end):
    """A rod: its shadow grows on the word that reveals it (`reveal_word`, else the first "shadow" said in the scene), its sunbeam
    on `beam_word` (else "line", "sunbeam", "sunlight" or "angle"). Unsaid words: the shadow from the start, no beam."""
    p = dict(p)
    f = _first_word_frame(words, start, end, [p.get("reveal_word")] if p.get("reveal_word") else ["shadow", "shadows"])
    p["reveal_at"] = (f - start) if f is not None else 0
    g = _first_word_frame(words, start, end, [p.get("beam_word")] if p.get("beam_word") else ["line", "sunbeam", "sunlight", "angle"])
    p["beam_at"] = max(p["reveal_at"] + 20, g - start) if g is not None else None
    if not p.get("angle_label") and p["beam_at"] is not None:   # the angle the scene's callout names (e.g. "ABOUT 7.2°")
        m = re.search(r"\d+(?:\.\d+)?\s*°", s.get("callout") or "")
        if m:
            p["angle_label"] = m.group(0).replace(" ", "")
    return p


def card_steps(s, words, start, end):
    """Frame (from the scene's start) at which each line of a card appears: on its `on_word`, else evenly through the scene;
    never before the line above it."""
    lines = (s.get("card") or {}).get("lines") or []
    n = max(1, end - start)
    out, prev = [], 0
    for k, l in enumerate(lines):
        f = _word_frame(words, start, end, (l or {}).get("on_word"))
        rel = (f - start) if f is not None else int(n * (0.08 + 0.8 * k / max(1, len(lines))))
        rel = max(prev, min(n - 1, rel))
        out.append(rel)
        prev = rel + 6
    return out


def globe_steps(p, s, words, start, end):
    """A globe cut into slices when the scene talks about slices: `slices` (else 50 when "fifty" is said), on `slice_word`
    (else the first "slice"/"slices"/"pizza")."""
    p = dict(p)
    text = " ".join(l.get("text") or "" for l in s.get("lines") or []) or s.get("voice_line") or ""
    if not p.get("slices") and re.search(r"\bslices?\b|\bpizza\b", text, re.I):
        p["slices"] = 50 if re.search(r"\bfift(y|ieth)\b|\b50\b", text, re.I) else 12
    if p.get("slices"):
        f = _first_word_frame(words, start, end, [p.get("slice_word")] if p.get("slice_word") else ["slices", "slice", "pizza"])
        p["slice_at"] = (f - start) if f is not None else int((end - start) * 0.3)
    return p


def _action_beats(who, act, at, back, expression=None):
    """One action as beats: the action, a pose for a moment if it is one (then `back`), and the face that goes with it."""
    b = {"at": max(0, at), "who": who, "action": act}
    if ACTION_POSE.get(act):
        b["pose"] = ACTION_POSE[act]
    if expression or ACTION_FACE.get(act):
        b["expression"] = expression or ACTION_FACE[act]
    out = [b]
    if b.get("pose"):
        out.append({"at": max(0, at) + ACTION_HOLD, "who": who, "pose": back})
    return out


def scene_beats(d, items, segs, bounds, words=()):
    """Stage directions per scene, in frames from the scene's start: a speaker takes his line's pose and face when he starts (or a
    talking gesture if the line has none) and goes back to his own pose when he stops; the crowd reacts on the line that says so.
    Actions (2.22.1): a character's `action` opens the scene (walk_out: near its end), a line's `action` is the speaker's as he
    starts, and `reacts` are the others' reactions at the end of the line (or on their `on_word`)."""
    out = [[] for _ in d["scenes"]]
    gesture = {}
    for i, s in enumerate(d["scenes"]):
        n = bounds[i + 1] - bounds[i]
        for c in s.get("characters") or []:
            act = c.get("action")
            if act in quality.ACTIONS:
                at = max(0, n - WALK_OUT_LEAD) if act == "walk_out" else 0 if act == "walk_in" else 8
                out[i] += _action_beats(c["who"], act, at, c.get("pose") or "stand", c.get("expression"))
    for it, (a, b, who) in zip(items, segs):
        i = it["scene"]
        s = d["scenes"][i]
        here = {c.get("who"): c for c in s.get("characters") or []}
        at, end = round(a * FPS) - bounds[i], round(b * FPS) - bounds[i]
        act = it.get("action") if it.get("action") in quality.ACTIONS else None
        if who in here:
            base = here[who].get("pose") or "stand"
            pose = it.get("pose")
            if not pose and not ACTION_POSE.get(act):
                gesture[who] = (gesture.get(who, -1) + 1) % len(TALK_POSES)
                pose = TALK_POSES[gesture[who]] if base in ("stand", "think") else None
            out[i].append({"at": max(0, at), "who": who, **({"pose": pose} if pose else {}),
                           **({"expression": it["expression"]} if it.get("expression") else {})})
            if pose and pose != base and not it.get("pose"):
                out[i].append({"at": max(0, end + 4), "who": who, "pose": base})
            if act:
                out[i] += _action_beats(who, act, at, it.get("pose") or base, it.get("expression"))
        for r in it.get("reacts") or []:
            if r.get("who") in here and r.get("action") in quality.ACTIONS:
                wf = _word_frame(words, bounds[i] + max(0, at), bounds[i] + end + 1, r.get("on_word"))
                rat = (wf - bounds[i]) if wf is not None else end
                out[i] += _action_beats(r["who"], r["action"], rat, here[r["who"]].get("pose") or "stand", r.get("expression"))
        if it.get("crowd") and s.get("crowd"):
            out[i].append({"at": max(0, at), "who": "crowd", "reaction": it["crowd"]})
    for b in out:
        b.sort(key=lambda x: x["at"])
    return out


def comedy_and_pacing(d, items, segs, words, bounds, beats, own=False, script_cues=()):
    """The OverSimplified layer (2.22.1), worked out from the script and the real voice timings, per scene:
    - camera hits: a line's own `camera`; in a conversation, a punch-in on whoever speaks (shot / reverse shot) and a release when
      the narrator takes over; the gags' own hits; and a camera beat in any stretch where nothing else is planned, so the picture
      never sits still for more than about three seconds;
    - the gag the renderer draws (freeze-frame label, cutaway tag) with its frame;
    - sound effects that go with the actions, the whip-pans, the gags and the map's pins (never on top of the script's own);
    - quiet windows: the music stops for a freeze-frame and for a deadpan pause.
    Returns (hits per scene, gag per scene, cues [(seconds, effect)], quiet [(from s, to s)], pacing stats)."""
    hits_all, gags, cues, quiet = [], [], [], []
    longest, longest_at, changes = 0.0, "", 0
    lines_of = [[] for _ in d["scenes"]]
    if not own:
        for it, seg in zip(items, segs):
            lines_of[it["scene"]].append((it, seg))
    for i, s in enumerate(d["scenes"]):
        start, end = bounds[i], bounds[i + 1]
        n = max(1, end - start)
        here = {c.get("who") for c in s.get("characters") or []}
        hits, auto = [], []
        prev = None
        for it, (a, b, who) in lines_of[i]:
            at = max(0, round(a * FPS) - start)
            cam = it.get("camera") if it.get("camera") in quality.CAM_HITS else None
            if cam:
                hits.append({"at": at, "cam": cam, **({"who": who} if who in here else {})})
                if cam == "whip":
                    auto.append((a, "whoosh"))
            elif who in here and len(here) >= 2 and who != prev:
                hits.append({"at": at, "cam": "punch_in", "who": who})
            elif who == "narrator" and prev in here and len(here) >= 2:
                hits.append({"at": at, "cam": "release"})
            prev = who
        gag = s.get("gag") or {}
        out_gag = None
        if gag.get("type") in quality.GAGS:
            wf = _word_frame(words, start, end, gag.get("on_word"))
            at = (wf - start) if wf is not None else n // 2
            sec = (start + at) / FPS
            who_at = next((w for (x, y, w) in segs if x <= sec < y + 0.05), None) if not own else None
            if gag["type"] == "freeze_label":
                out_gag = {"type": "freeze_label", "text": str(gag.get("text") or "")[:44], "at": at, "frames": FREEZE_FRAMES,
                           **({"who": gag["who"]} if gag.get("who") in here else {})}
                auto.append((sec, "record_scratch"))
                quiet.append((sec, sec + FREEZE_FRAMES / FPS))
            elif gag["type"] == "deadpan":   # the camera stops dead, the music stops, then a punch-in on the punchline
                hits.append({"at": max(0, at - 30), "cam": "hold"})
                hits.append({"at": at, "cam": "punch_in", **({"who": who_at} if who_at in here else {})})
                quiet.append((max(0, sec - 1.0), sec + 0.6))
            elif gag["type"] == "interrupt":   # a character cuts in on the narrator: punch on him and a jolt
                first = next((round(a * FPS) - start for it, (a, b, w) in lines_of[i] if w == gag.get("who")), at)
                hits += [{"at": max(0, first), "cam": "punch_in", "who": gag.get("who")}, {"at": max(0, first), "cam": "shake"}]
                auto.append(((start + max(0, first)) / FPS, "pop"))
            elif gag["type"] == "cutaway":
                out_gag = {"type": "cutaway", "text": str(gag.get("text") or "MEANWHILE...")[:28]}
                auto.append((start / FPS + 0.05, "whoosh"))
        gags.append(out_gag)
        for bt in beats[i]:
            if ACTION_SFX.get(bt.get("action")):
                auto.append(((start + bt["at"]) / FPS, ACTION_SFX[bt["action"]]))
        if s.get("backdrop") == "map":
            for k, _ in enumerate(((s.get("map") or {}).get("pins") or [])[:4]):
                auto.append(((start + n * 0.5 + k * 7 + 4) / FPS, "pop"))
        # pacing: whatever is planned to change on screen; a long gap gets a camera beat (on whoever is speaking then)
        moving = s.get("backdrop") in ("map", "diagram") or bool(s.get("generated")) or i == len(d["scenes"]) - 1
        marks = sorted({0, n} | {h["at"] for h in hits} | {bt["at"] for bt in beats[i]} | ({out_gag["at"], out_gag["at"] + FREEZE_FRAMES} if out_gag and "at" in out_gag else set()))
        if not moving:
            fill = []
            for x, y in zip(marks, marks[1:]):
                k = int((y - x) / FPS // REFRAME_EVERY)
                before = [h["cam"] for h in sorted(hits, key=lambda h: h["at"]) if h["at"] <= x and h["cam"] in ("punch_in", "release", "whip")]
                zoomed = bool(before) and before[-1] == "punch_in"   # each beat does the opposite of where the camera is
                for j in range(1, k + 1):
                    f = x + round((y - x) * j / (k + 1))
                    sec = (start + f) / FPS
                    who = next((w for (p, q, w) in segs if p <= sec < q), None) if not own else None
                    zoomed = not zoomed
                    fill.append({"at": f, "cam": "punch_in", **({"who": who} if who in here else {})} if zoomed else {"at": f, "cam": "release"})
            hits += fill
        hits.sort(key=lambda h: h["at"])
        allmarks = sorted({0, n} | {h["at"] for h in hits} | set(marks))
        changes += len(allmarks) - 1
        if not moving:
            for x, y in zip(allmarks, allmarks[1:]):
                if (y - x) / FPS > longest:
                    longest, longest_at = (y - x) / FPS, f"scene {s.get('n', i + 1)}, {(start + x) / FPS:.1f}-{(start + y) / FPS:.1f} s"
        hits_all.append(hits)
        # at most five extra sounds a scene, never within 0.4 s of another sound (the script's own come first)
        taken = [c[0] for c in script_cues] + [c[0] for c in cues]
        kept = 0
        for t, name in sorted(auto):
            if kept >= 5 or any(abs(t - u) < 0.4 for u in taken):
                continue
            cues.append((t, name))
            taken.append(t)
            kept += 1
    return hits_all, gags, cues, quiet, {"longest_still_s": round(longest, 1), "longest_still_at": longest_at, "changes": changes}


def sfx_cues(d, words, bounds):
    """[(seconds, effect name)] for every sound effect in the script: on its word if it names one, else just after the scene starts."""
    out = []
    for i, s in enumerate(d["scenes"]):
        start, end = bounds[i], bounds[i + 1]
        inside = [w for w in words if start <= round(w[1] * FPS) < end]
        for x in s.get("sfx") or []:
            name = x.get("name") if isinstance(x, dict) else x
            if name not in sfx.MENU:
                continue
            target = _norm((x.get("on_word") if isinstance(x, dict) else "") or "")
            hit = next((w for w in inside if target and (_norm(w[0]) == target or (len(target) >= 4 and _norm(w[0]).startswith(target[:4])))), None)
            out.append((hit[1] if hit else start / FPS + 0.12, name))
    return out


def mix_audio(ffmpeg, voice, cues, music, seconds, dst, quiet=()):
    """The soundtrack: the voices, each sound effect at its moment, and the music quietly under everything, ducked while anyone
    speaks (sidechain compression), faded in and out, and stopped dead in the `quiet` windows [(from s, to s)] (a freeze-frame,
    a deadpan pause: the comic stop). Then normalised like the voice. Returns (dst, characters billed for new effects)."""
    inputs, filters, labels, billed = ["-i", str(voice)], [], ["[v]"], 0
    filters.append("[0:a]aresample=48000,asplit=4[v][sc][sca][scs]")
    n = 1
    if music:
        inputs += ["-stream_loop", "-1", "-i", str(music)]
        vol = f"{MUSIC_VOLUME:g}"
        if quiet:
            off = "+".join(f"between(t,{a:.2f},{b:.2f})" for a, b in quiet)
            vol = f"'if({off},0,{MUSIC_VOLUME:g})':eval=frame"
        filters.append(f"[{n}:a]aresample=48000,atrim=0:{seconds:.2f},volume={vol},afade=t=in:d=1.2,afade=t=out:st={max(0, seconds - 2.5):.2f}:d=2.5[mus]")
        filters.append("[mus][sc]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=450[m]")
        labels.append("[m]")
        n += 1
    else:
        filters.append("[sc]anullsink")
    # Effects (2.29.0, the owner: "sounds suddenly appear and don't make sense, should be smoother"): every effect fades in and
    # out instead of starting and stopping dead; background sounds (birds, wind, a murmuring crowd) play low, fade in slowly
    # and duck hard under the voices; everything else (stings, steps, pops) has its own level and ducks a little under speech.
    groups = {"amb": [], "fx": []}
    for at, name in cues:
        try:
            path, b = sfx.sfx_path(name)
        except (elevenlabs.ElevenError, OSError, KeyError) as e:
            say(f"  Sound effect '{name}' skipped: {str(e)[:120]}")
            continue
        billed += b
        inputs += ["-i", str(path)]
        ms = max(0, int(at * 1000))
        secs = sfx.MENU.get(name, ("", 1.0))[1]
        amb = name in SFX_AMBIENT
        fin, fout = (0.7, 0.9) if amb else (0.02, min(0.3, secs * 0.3))
        vol = SFX_LEVEL.get(name, SFX_AMBIENT_LEVEL if amb else SFX_STING_LEVEL)
        filters.append(f"[{n}:a]aresample=48000,volume={vol:g},afade=t=in:d={fin:g},afade=t=out:st={max(0.0, secs - fout):.2f}:d={fout:.2f},"
                       f"adelay={ms}|{ms}[s{n}]")
        groups["amb" if amb else "fx"].append(f"[s{n}]")
        n += 1
    for g, sc, duck in (("amb", "[sca]", "threshold=0.02:ratio=8:attack=40:release=700"), ("fx", "[scs]", "threshold=0.03:ratio=2.5:attack=10:release=300")):
        if groups[g]:
            mixed = "".join(groups[g]) + (f"amix=inputs={len(groups[g])}:duration=longest:normalize=0[{g}raw]" if len(groups[g]) > 1 else f"anull[{g}raw]")
            filters.append(mixed)
            filters.append(f"[{g}raw]{sc}sidechaincompress={duck}[{g}]")
            labels.append(f"[{g}]")
        else:
            filters.append(f"{sc}anullsink")
    filters.append("".join(labels) + f"amix=inputs={len(labels)}:duration=first:normalize=0,alimiter=limit=0.89[out]")
    raw = dst.with_name("_mix_raw.wav")
    shorts.run([ffmpeg, "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(filters), "-map", "[out]", "-ac", "1", str(raw)])
    normalise_voice(ffmpeg, raw, dst)
    raw.unlink(missing_ok=True)
    return dst, billed


def whisper_file_voice(ffmpeg, src, lines, folder):
    """The owner's own voice file (ElevenLabs, a recording...). Scene starts come from the aligned words."""
    wav = folder / "_voice_raw.wav"
    shorts.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(src), "-ac", "1", "-ar", "24000", str(wav)])
    secs = shorts.probe_seconds(ffmpeg, wav)
    script = [w for l in lines for w in l.split()]
    timed = shorts.word_timings(ffmpeg, wav, script, secs)
    words, starts, k = [], [], 0
    for l in lines:
        n = len(l.split())
        starts.append(max(0.0, timed[k]["s"] - LEAD))
        k += n
    words = [[t["w"], t["s"], t["e"]] for t in timed]
    return wav, starts, words, secs + 0.3, len(script) / (secs / 60)


def normalise_voice(ffmpeg, src, dst, target=-15.0, peak=-1.5):
    """Two-pass loudness normalisation (a single pass undershoots on short clips): integrated loudness near `target` LUFS,
    true peak under `peak` dBTP. Measured with ebur128, not guessed."""
    first = subprocess.run([ffmpeg, "-hide_banner", "-i", str(src), "-af", f"loudnorm=I={target}:TP={peak}:LRA=11:print_format=json",
                            "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace", creationflags=NOFLAGS)
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", first.stderr or "", re.S)
    af = f"loudnorm=I={target}:TP={peak}:LRA=11"
    if m:
        try:
            j = json.loads(m.group(0))
            af += (f":measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
                   f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
        except (ValueError, KeyError):
            pass
    shorts.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(src), "-af", af, "-ar", "48000", "-ac", "1", str(dst)])


def short_place(place):
    """The title card's place: the first named place only ("Alexandria and Syene (Aswan), Egypt" -> "ALEXANDRIA")."""
    first = re.split(r",| and |\(| & | / ", place or "")[0].strip()
    return (first[:26].rstrip() if first else (place or "")[:26]).upper()


RHUBARB_VERSION = "1.14.0"   # Rhubarb Lip Sync, MIT licence (commercial use allowed), https://github.com/DanielSWolf/rhubarb-lip-sync
RHUBARB_URL = f"https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v{RHUBARB_VERSION}/Rhubarb-Lip-Sync-{RHUBARB_VERSION}-Windows.zip"
RHUBARB_SHA256 = "62fa416a8d5e382a3828ee4bef358ce520d0b4cabdeaea75a7ac266d098d1fe3"
RHUBARB_DIR = HOME / "rhubarb"


def ensure_rhubarb():
    """Rhubarb Lip Sync, installed once into the animation tools folder. The download must match the pinned checksum."""
    exe = RHUBARB_DIR / f"Rhubarb-Lip-Sync-{RHUBARB_VERSION}-Windows" / "rhubarb.exe"
    if exe.exists():
        return exe
    RHUBARB_DIR.mkdir(parents=True, exist_ok=True)
    say(f"Installing Rhubarb Lip Sync {RHUBARB_VERSION} (the mouth-shape tool, MIT licence), one time...")
    z = RHUBARB_DIR / "rhubarb.zip"
    download(RHUBARB_URL, z)
    if hashlib.sha256(z.read_bytes()).hexdigest() != RHUBARB_SHA256:
        z.unlink(missing_ok=True)
        raise Blocked("The Rhubarb download didn't match its pinned checksum, so it was thrown away.")
    with zipfile.ZipFile(z) as zf:
        zf.extractall(RHUBARB_DIR)
    z.unlink(missing_ok=True)
    if not exe.exists():
        raise Blocked("Rhubarb didn't unpack where expected.")
    return exe


def rhubarb_cues(wav, dialog, folder):
    """[(start, end, shape)] for a voice track: Rhubarb listens to the audio, helped by the words that were said."""
    exe = ensure_rhubarb()
    d, out = folder / "_dialog.txt", folder / "_cues.json"
    d.write_text(dialog, encoding="utf-8")
    p = subprocess.run([str(exe), "-f", "json", "--extendedShapes", "GHX", "-d", str(d), "--quiet", "-o", str(out), str(wav)],
                       capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=1200, creationflags=NOFLAGS)
    if p.returncode != 0 or not out.exists():
        raise Blocked("Rhubarb failed: " + ((p.stderr or p.stdout).strip().splitlines() or ["no output"])[-1][:300])
    cues = [(c["start"], c["end"], c["value"]) for c in json.loads(out.read_text(encoding="utf-8"))["mouthCues"]]
    d.unlink(missing_ok=True)
    out.unlink(missing_ok=True)
    return cues


def rhubarb_frames(cues, total_frames):
    """One mouth letter (A-H, X) for every frame of the video."""
    letters, k = [], 0
    for f in range(total_frames):
        t = f / FPS
        while k < len(cues) - 1 and t >= cues[k][1]:
            k += 1
        letters.append(cues[k][2] if cues and cues[k][0] <= t < cues[k][1] else "X")
    # a very short rest between two spoken shapes ("I am here") is the recogniser losing a quick vowel: keep the mouth moving
    for f in range(1, len(letters) - 1):
        if letters[f] == "X":
            a = f
            while a > 0 and letters[a - 1] == "X":
                a -= 1
            b = f
            while b < len(letters) - 1 and letters[b + 1] == "X":
                b += 1
            if a > 0 and b < len(letters) - 1 and b - a < 6 and letters[a - 1] != "X" and letters[b + 1] != "X":
                for k in range(a, b + 1):
                    letters[k] = letters[b + 1] if k - a >= (b - a + 1) // 2 else letters[a - 1]
    return letters


def mouth_for(wav, words, lines, folder, total_frames):
    """The mouth of every frame: Rhubarb's nine shapes (from the audio and the script), or the old loudness cues if Rhubarb can't run."""
    if getattr(settings, "RHUBARB", True):
        try:
            return rhubarb_frames(rhubarb_cues(wav, " ".join(lines), folder), total_frames)
        except Blocked as e:
            say(f"  Rhubarb unavailable ({str(e)[:160]}): using the simple loudness mouths instead.")
        except (OSError, subprocess.SubprocessError) as e:
            say(f"  Rhubarb couldn't run ({str(e)[:160]}): using the simple loudness mouths instead.")
    return mouth_cues(wav, words, total_frames)


def _norm(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())


def callout_frame(scene, words, start, end):
    """Frames after the scene's start at which its callout should pop: the moment the named word is spoken.
    `callout_word` names it; without one, the callout comes in at the middle of the line."""
    inside = [w for w in words if start <= round(w[1] * FPS) < end]
    target = _norm(scene.get("callout_word") or "")
    hit = next((w for w in inside if target and _norm(w[0]) == target), None) if target else None
    if hit is None and target:   # "kilometres" vs "kilometers", "stadia" vs "stadion": the closest start
        hit = next((w for w in inside if len(target) >= 4 and (_norm(w[0]).startswith(target[:4]) or target.startswith(_norm(w[0])[:4]))), None)
    if hit is not None:
        return max(0, round(hit[1] * FPS) - start)
    if inside:
        return max(0, round(inside[len(inside) // 2][1] * FPS) - start)
    return max(0, (end - start) // 2)


def mouth_cues(wav, words, total_frames):
    """0 closed / 1 mid / 2 open per frame: the loudness of the voice, only while a word is being said."""
    import numpy as np
    import soundfile as sf
    a, sr = sf.read(str(wav), dtype="float32")
    if a.ndim > 1:
        a = a.mean(axis=1)
    hop = sr // FPS
    env = np.array([np.sqrt(np.mean(a[i * hop:(i + 1) * hop] ** 2)) if i * hop < len(a) else 0 for i in range(total_frames)])
    top = np.percentile(env[env > 0], 90) if (env > 0).any() else 1
    env = env / (top or 1)
    cue = []
    for f in range(total_frames):
        t = f / FPS
        inside = any(w[1] - 0.03 <= t <= w[2] + 0.04 for w in words)
        cue.append(0 if not inside or env[f] < 0.14 else 1 if env[f] < 0.5 else 2)
    out = list(cue)   # a median of three removes one-frame flicker
    for f in range(1, len(cue) - 1):
        out[f] = sorted(cue[f - 1:f + 2])[1]
    return out


def caption_chunks(words):
    """Up to 3 words at a time; a sentence, a comma or a new speaker ends a chunk. Frames. words: [word, start, end(, who)]."""
    chunks, cur, who = [], [], None
    for w in words:
        speaker = w[3] if len(w) > 3 else "narrator"
        if cur and speaker != who:
            chunks.append((who, cur))
            cur = []
        who = speaker
        cur.append({"w": w[0], "from": round(w[1] * FPS), "to": max(round(w[2] * FPS), round(w[1] * FPS) + 3)})
        if len(cur) == 3 or re.search(r"[.,!?;:]$", w[0]):
            chunks.append((who, cur))
            cur = []
    if cur:
        chunks.append((who, cur))
    out = []
    for i, (w, c) in enumerate(chunks):
        nxt = chunks[i + 1][1][0]["from"] if i + 1 < len(chunks) else None
        end = c[-1]["to"] + 8
        out.append({"from": c[0]["from"], "to": min(end, nxt) if nxt else end, "who": w, "words": c})
    return out


# ---- 3. the whole job -------------------------------------------------------------------
def voice_choice(project):
    meta = (project or {}).get("meta") or {}
    v = (meta.get("voice") or {})
    vid = v.get("id") or getattr(settings, "ANIM_VOICE", DEFAULT_VOICE)
    ok = vid in VOICES or (str(vid).startswith(ELEVEN_PREFIX) and elevenlabs.configured())
    return (vid if ok else DEFAULT_VOICE), v.get("speed")


def is_video(d):
    return (d or {}).get("format") == "video"


def synth_cached(vid, lines, folder, speed):
    """synth(), but an ElevenLabs voice made once for these exact words, this voice and this speed is reused: a retry (after a refused
    length check, a render that failed...) costs no characters. Returns the same tuple as synth."""
    if voice_spec(vid)[0] != "eleven":
        return synth(vid, lines, TARGET_WPM, folder, speed)
    key = hashlib.sha1((vid + "|" + str(speed) + "|" + "\n".join(lines)).encode("utf-8")).hexdigest()[:16]
    cdir = folder / "_voice-cache"
    wav_c, js_c = cdir / f"{key}.wav", cdir / f"{key}.json"
    raw = folder / "_voice_raw.wav"
    if wav_c.exists() and js_c.exists():
        j = json.loads(js_c.read_text(encoding="utf-8"))
        shutil.copy2(wav_c, raw)
        say("  Reusing the voice already made for these words (no ElevenLabs characters used).")
        return raw, j["starts"], j["words"], j["t"], j["wpm"], 0
    out = synth(vid, lines, TARGET_WPM, folder, speed)
    cdir.mkdir(exist_ok=True)
    shutil.copy2(out[0], wav_c)
    js_c.write_text(json.dumps({"starts": out[1], "words": out[2], "t": out[3], "wpm": out[4]}), encoding="utf-8")
    return out


def auto_split(ep):
    """Lines over the per-scene limit that are made of whole sentences are split into scenes (words unchanged) instead of refusing the
    render. Saved on the episode so the owner sees what was rendered. Returns the (possibly updated) episode."""
    d = ep["data"]
    if not rules.get("script.auto_split"):
        return ep
    scenes, n, spine = quality.split_long_lines(d.get("scenes") or [], d.get("spine"))
    if not n:
        return ep
    d["scenes"], d["spine"] = scenes, spine
    d["auto_split"] = (d.get("auto_split") or 0) + n
    cp.update_episode(ep["id"], data=d)
    cp.log("Calina", "lines_split", None, {"episode": ep["id"], "splits": n, "at": "render"})
    say(f"  Split {n} long voice line(s) at sentence boundaries into separate scenes (the words are unchanged).")
    return cp.get_episode(ep["id"])


def render_episode(eid, voice=None, suffix=""):
    """voice: an ElevenLabs/other voice id to use instead of the project's; suffix (e.g. '-1'): write a VARIANT beside the real Short
    (short-1.mp4, voice-1.wav) without changing the episode, so the owner can compare voices on a real story."""
    ep = cp.get_episode(int(eid))
    if not ep:
        raise Blocked(f"No episode {eid}.")
    ep = auto_split(ep)
    problems = checklist(ep)
    if problems:
        raise Blocked("The checklist blocked this script: " + " ".join(problems))
    d = ep["data"]
    project = cp.get_project(ep["project_id"], with_text=False)
    folder = production.episode_folder(ep)
    folder.mkdir(parents=True, exist_ok=True)
    ffmpeg = shorts.find_ffmpeg()
    t0 = time.time()
    say(f"Episode #{ep['id']}: {ep['title']}")
    ensure_toolchain(ep["project_id"])
    d = quality.sync_voice_lines(d)
    items = utterances(d, project)
    lines = [shorts.fill_placeholders(l, project) for l in narration(d)]
    # the owner's own voice file (e.g. voice.mp3 from ElevenLabs); never our own generated voice.wav / voice-N.wav
    own = None if voice else next((f for f in sorted(folder.glob("voice.*")) if f.suffix.lower() in production.AUDIO_EXT and f.name.lower() != "voice.wav"), None)
    say("Voices..." if not own else f"Voice: using your file {own.name}...")
    vid = "own"
    if own:
        raw, starts, words, voice_end, wpm = whisper_file_voice(ffmpeg, own, lines, folder)
        words = [w + ["narrator"] for w in words]
        segs = [(w[1], w[2], "narrator") for w in words]
        used = f"your own file ({own.name})"
    else:
        meta_v = (project.get("meta") or {})
        voices = cast_voices(project, sorted({x["who"] for x in items}))
        if voice:   # a variant: another narrator voice, the characters keep theirs
            voices["narrator"] = voice
        vid = voices["narrator"]
        reg = {ELEVEN_PREFIX + x["id"]: x["label"] for x in meta_v.get("eleven_voices") or []}
        label = reg.get(vid) or ((meta_v.get("voice") or {}).get("label") if not voice else None) or voice_spec(vid)[2]
        try:
            raw, starts, words, voice_end, wpm, chars, segs = dialogue_cached(items, voices, folder)
        except (elevenlabs.ElevenError, ImportError, OSError) as ex:
            if not any(voice_spec(v)[0] == "eleven" for v in voices.values()) or not getattr(settings, "ELEVEN_FALLBACK", True):
                raise Blocked(f"The voice failed: {ex}")
            say(f"  ElevenLabs failed ({str(ex)[:160]}): using the free Kokoro voices instead. They will sound more robotic.")
            free = {w: (KOKORO_CAST.get(w) or DEFAULT_VOICE) for w in voices}
            raw, starts, words, voice_end, wpm, chars, segs = synth_dialogue(items, free, folder)
            label = f"Kokoro (free fallback; ElevenLabs failed: {str(ex)[:120]})"
            vid = DEFAULT_VOICE
        used = label + (f" + {len(voices) - 1} character voice(s)" if len(voices) > 1 else "")
        if chars:
            cp.log("Calina", "voice_chars", None, {"engine": "elevenlabs", "chars": chars, "episode": ep["id"], "what": "short"})
            say(f"  ElevenLabs: {chars} characters used for the voices.")
    title = None
    if not own:
        raw, starts, words, voice_end, segs, title = shape_timeline(ffmpeg, raw, starts, words, voice_end, segs, d, ep, folder)
        wpm = wpm * NARR_TEMPO
    normalise_voice(ffmpeg, raw, folder / f"voice{suffix}.wav")
    raw.unlink(missing_ok=True)
    voice_secs = shorts.probe_seconds(ffmpeg, folder / f"voice{suffix}.wav")
    end_t = max(voice_secs, voice_end)
    total_secs = end_t + OUTRO_SECONDS
    if total_secs > VIDEO_CAP:
        raise Blocked(f"This would be {total_secs:.0f} s (over 16 minutes): that is a mistake, not a story. The voice is kept, so a retry costs nothing.")
    # nobody chooses Short or regular video: it follows from how long the finished piece is (YouTube's own rule for vertical video)
    kind = "video" if total_secs > SHORT_LIMIT else "short"
    if is_video(d) != (kind == "video"):
        if kind == "video":
            d["format"] = "video"
        else:
            d.pop("format", None)
        cp.update_episode(ep["id"], data=d)
        say(f"  {total_secs:.0f} s: this is a " + ("regular video, not a Short." if kind == "video" else "Short."))
    total = int(round(total_secs * FPS))
    say(f"  {voice_secs:.1f} s of speech at {wpm:.0f} words a minute ({used}); {total_secs:.1f} s with the end card")
    bounds = [0 if i == 0 else round(starts[i] * FPS) for i in range(len(starts))] + [round(end_t * FPS)]
    beats = scene_beats(d, items, segs, bounds, words) if not own else [[] for _ in d["scenes"]]
    # the OverSimplified layer: camera hits, gags, the sounds that go with them, where the music stops, and how still it ever gets
    script_cues = sfx_cues(d, words, bounds)
    hits, gags, auto_cues, quiet, pacing = comedy_and_pacing(d, items, segs, words, bounds, beats, own=bool(own), script_cues=script_cues)
    if pacing["longest_still_s"] > quality.STILL_MAX:
        say(f"  Pacing: the longest still stretch is {pacing['longest_still_s']} s ({pacing['longest_still_at']}).")
    scenes = []
    for i, s in enumerate(d["scenes"]):
        sc = {k: v for k, v in s.items() if k not in ("voice_line", "source_note", "n", "shows", "callout_word", "lines", "sfx", "link", "step_claim", "gag")}
        sc["from"] = bounds[i]
        sc["frames"] = max(12, bounds[i + 1] - bounds[i])
        sc["beats"] = beats[i]
        sc["hits"] = hits[i]
        if gags[i]:
            sc["gag"] = gags[i]
        if s.get("callout"):   # the callout appears on the word it belongs to, never before it is said
            sc["callout_from"] = callout_frame(s, words, bounds[i], bounds[i + 1])
        # 2.30.0: the picture follows the words. A diagram draws each step on the word that explains it; a rod's shadow and its
        # sunbeam appear when they are named (Israa on ep 23: the 7.2 deg wedge showed 30 s before it was said).
        if s.get("backdrop") == "diagram":
            sc["diagram"] = {**(s.get("diagram") or {}), "at": diagram_steps(s, words, bounds[i], bounds[i + 1])}
        if any((p or {}).get("type") == "rod" for p in s.get("props") or []):
            sc["props"] = [rod_steps(p, s, words, bounds[i], bounds[i + 1]) if (p or {}).get("type") == "rod" else p for p in s.get("props") or []]
        if s.get("backdrop") == "card" and (s.get("card") or {}).get("lines"):
            sc["card"] = {**s["card"], "at": card_steps(s, words, bounds[i], bounds[i + 1])}
        if any((p or {}).get("type") == "globe" for p in s.get("props") or []):
            sc["props"] = [globe_steps(p, s, words, bounds[i], bounds[i + 1]) if (p or {}).get("type") == "globe" else p for p in sc.get("props") or s.get("props") or []]
        if i == len(d["scenes"]) - 1:
            sc["ending"] = True   # the last scene: one slow push-in, no cuts, the music swells into the end card
        scenes.append(sc)
    # the soundtrack: voices + sound effects on their words + the project's music (if the owner picked one), ducked under speech
    music_id = (project.get("meta") or {}).get("music") or ""
    music = None
    if music_id and music_id != "none":
        try:
            music = sfx.music_path(music_id)
        except (OSError, ValueError) as ex:
            say(f"  The music couldn't be fetched ({str(ex)[:120]}): no music this time.")
    cues = sorted(script_cues + auto_cues + ([(title["from_s"] + 0.02, "whoosh")] if title else []))
    audio_name = f"voice{suffix}.wav"
    if music or cues:
        say(f"  Sound: {len(cues)} effect(s) ({len(auto_cues)} on actions and gags)" + (f", music: {sfx.MUSIC[music_id][0]}" if music else ", no music (none picked)"))
        _, billed = mix_audio(ffmpeg, folder / f"voice{suffix}.wav", cues, music, end_t + OUTRO_SECONDS, folder / f"mix{suffix}.wav", quiet=quiet)
        if billed:
            cp.log("Calina", "voice_chars", None, {"engine": "elevenlabs", "chars": billed, "episode": ep["id"], "what": "sound effects"})
            say(f"  ElevenLabs: {billed} characters for new sound effects (made once, reused in every later video).")
        audio_name = f"mix{suffix}.wav"
    ch = (project.get("meta") or {}).get("channel") or {}
    props = {
        "durationInFrames": total,
        "audio": audio_name,
        "mouth": mouth_for(folder / f"voice{suffix}.wav", words, [x["text"] for x in items] or lines, folder, total),
        "speaker": speaker_frames(segs, total),
        "intro": {"place": short_place(d.get("place") or ""), "year": (d.get("year") or "").upper()},
        "outro": {"channel": ch.get("name") or "POV Then History", "handle": ch.get("handle") or "@POVThenHistory"},
        "outro_from": round(end_t * FPS),
        **({"title": {"from": round(title["from_s"] * FPS), "frames": round(title["secs"] * FPS), "text": title["text"],
                      "place": short_place(title["place"]), "year": (title["year"] or "").upper()}} if title else {}),
        "caption_chunks": caption_chunks(words),
        "scenes": scenes,
        "pacing": pacing,
    }
    (folder / f"scene-props{suffix}.json").write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")
    say("Animating (this is the slow part: a few minutes)...")
    out = folder / f"short{suffix}.mp4"
    remotion(["render", "src/index.jsx", "Short", str(out), f"--props={folder / f'scene-props{suffix}.json'}",
              f"--public-dir={folder}", "--codec=h264", "--crf=20", "--log=warn", "--overwrite"], timeout=3600)
    if suffix:   # a voice variant: nothing else about the episode changes
        say(f"Variant done in {time.time() - t0:.0f}s: {out.name}")
        return {"id": vid, "label": used, "video": out.relative_to(ROOT).as_posix(), "seconds": round(total_secs, 1),
                "wpm": round(wpm), "audio": audio_name, "voice": f"voice{suffix}.wav", "props": f"scene-props{suffix}.json"}
    credits = ["Map data: Natural Earth (public domain). Cartoon characters and backgrounds: our own artwork."]
    if cues:
        credits.append(sfx.CREDIT_SFX)
    if music:
        credits.append(sfx.music_credit(music_id))
    description = shorts.fill_placeholders((d.get("description") or "").strip(), project)
    if "AI-assisted" not in description:
        description += f"\n\n{DISCLOSURE_V3}"
    if music and "Kevin MacLeod" not in description:   # the licence asks for this credit wherever the video is shown
        description += "\n\n" + sfx.music_credit(music_id)
    if d.get("hashtags"):
        tags = [t for t in d["hashtags"] if not (is_video(d) and t.lower() == "#shorts")]   # a regular video is not a Short
        description += "\n\n" + " ".join(tags)
    (folder / "title.txt").write_text(shorts.fill_placeholders(d.get("title", ""), project)[:100] + "\n", encoding="utf-8")
    (folder / "description.txt").write_text(description + "\n", encoding="utf-8")
    (folder / "sources.txt").write_text(
        "SCRIPT SOURCES\n" + "\n".join(f"- {x.get('publisher', '')} {x.get('url', '')}\n  \"{x.get('quote', '')}\"" for x in d.get("sources") or [])
        + "\n\nSOURCE PER SCENE\n" + "\n".join(f"{s.get('n', i + 1)}. \"{s.get('voice_line', '')}\"  <- {s.get('source_note', '')}" for i, s in enumerate(d["scenes"]))
        + "\n\nCREDITS\n" + "\n".join(credits) + "\n", encoding="utf-8")
    rel = folder.relative_to(ROOT).as_posix() + "/short.mp4"
    cp.update_episode(ep["id"], status="rendered", video_path=rel)
    say(f"Done in {time.time() - t0:.0f}s: {rel}")
    return {"episode": ep["id"], "title": ep["title"], "video": rel, "seconds": round(total_secs, 1), "images": len(scenes),
            "wpm": round(wpm), "voice": used}


def render_voices(eid, voices):
    """The same Short in two (or more) voices, as variants next to the real one, for the owner to compare and keep one."""
    out = []
    for i, v in enumerate(voices, 1):
        say(f"Voice {i} of {len(voices)}: {v}")
        out.append(render_episode(eid, voice=v, suffix=f"-{i}"))
    return {"episode": int(eid), "variants": out}


# ---- voice samples --------------------------------------------------------------------------
SAMPLE_LINE = ("With a stick and a shadow, you'll measure the whole Earth. Alexandria, two hundred forty B C E. "
               "You're Eratosthenes, the chief librarian. Down south in Syene, a strange thing happens once a year.")


def make_samples(project_id=3):
    """The same lines in each free voice, slowed to ~130 words a minute, for the owner to listen to and pick."""
    import numpy as np
    import soundfile as sf
    ffmpeg = shorts.find_ffmpeg()
    folder = shorts.CONTENT / f"project-{project_id}" / "voice-samples"
    folder.mkdir(parents=True, exist_ok=True)
    done = []
    candidates = {vid: (spec[0], spec[1], spec[2]) for vid, spec in VOICES.items()}
    if elevenlabs.configured():
        try:
            for v in elevenlabs.storytellers(4):
                candidates[ELEVEN_PREFIX + v["id"]] = ("eleven", v["id"], v["label"])
        except elevenlabs.ElevenError as e:
            say(f"  ElevenLabs voices unavailable: {e}")
        pr = cp.get_project(project_id, with_text=False) or {}
        for v in (pr.get("meta") or {}).get("eleven_voices") or []:   # the owner's own picks stay in every sample set
            candidates[ELEVEN_PREFIX + v["id"]] = ("eleven", v["id"], v["label"])
    for vid, (_, _, label) in candidates.items():
        say(f"Sample: {label}")
        try:
            tmp = folder / "_s"
            tmp.mkdir(exist_ok=True)
            raw, _, _, _, wpm, chars = synth(vid, [SAMPLE_LINE], TARGET_WPM, tmp)
            if chars:
                cp.log("Calina", "voice_chars", None, {"engine": "elevenlabs", "chars": chars, "what": "sample", "voice": label})
            out = folder / f"{vid}.mp3"
            shorts.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(raw), "-af", "loudnorm=I=-15:TP=-1.5:LRA=11", "-ar", "44100",
                        "-b:a", "128k", str(out)])
            done.append({"id": vid, "label": label, "wpm": round(wpm), "file": out.relative_to(ROOT).as_posix()})
            shutil.rmtree(tmp, ignore_errors=True)
        except Exception as e:   # one voice failing must not lose the others
            say(f"  skipped ({type(e).__name__}: {str(e)[:160]})")
            shutil.rmtree(folder / "_s", ignore_errors=True)
    (folder / "samples.json").write_text(json.dumps({"line": SAMPLE_LINE, "voices": done}, indent=2), encoding="utf-8")
    return done


TEST_SCRIPT = ("Hello! I am here to tell you a story. Two thousand years ago, a man looked at a shadow and asked a big question. "
               "How big is the world? He had no ship and no satellite. He had a stick, a well, and a very good idea. "
               "First he measured the angle of the shadow. Then he did the sums, step by careful step. "
               "And the answer he found was almost exactly right. Isn't that amazing? Now let me show you how he did it.")


def characters_folder(project_id):
    return shorts.CONTENT / f"project-{project_id}" / "characters"


def make_character_library(project_id=3, clips=True, root=None, cast=None):
    """Reference sheet + 30-second test clip for every character, saved once under content/project-N/characters/.
    The test clip uses the project's chosen voice, Rhubarb's mouth shapes and the whole rig (idle, blink, gestures, walk, expressions).
    root/cast (cast.py): test a candidate cast file of Rana's into its own folder, leaving the project's characters alone."""
    import numpy as np
    import soundfile as sf
    root = Path(root) if root else characters_folder(project_id)
    root.mkdir(parents=True, exist_ok=True)
    ensure_toolchain(project_id, cast)
    ffmpeg = shorts.find_ffmpeg()
    project = cp.get_project(project_id, with_text=False)
    lib = {"project": project_id, "kit": quality.KIT_VERSION, "made": time.strftime("%Y-%m-%d %H:%M"), "characters": []}
    shutil.rmtree(root / "narrator", ignore_errors=True)   # kit v1's on-screen narrator (with the POV sign) is gone
    voice = None
    if clips:
        vid, speed = voice_choice(project)
        say("Test voice (same words for every character)...")
        lines = [l.strip() for l in re.split(r"(?<=[.!?])\s+", TEST_SCRIPT) if l.strip()]
        raw, _, words, voice_end, wpm, chars = synth_cached(vid, lines, root, speed)   # made once: a remake costs no characters
        if chars:
            cp.log("Calina", "voice_chars", None, {"engine": "elevenlabs", "chars": chars, "what": "character test"})
        normalise_voice(ffmpeg, raw, root / "test-voice.wav")
        raw.unlink(missing_ok=True)
        secs = min(30.0, shorts.probe_seconds(ffmpeg, root / "test-voice.wav"))
        total = int(round(30 * FPS))
        mouth = mouth_for(root / "test-voice.wav", words, lines, root, total)
        voice = {"label": (voice_spec(vid)[2]), "seconds": round(secs, 1)}
    # resume (rule jobs.resume_steps): characters finished by a run that was cut off, with the same cast file, kit and voice, are kept
    cast_file = APP / "src" / "Character.jsx"
    sig = hashlib.sha1((cast_file.read_bytes() if cast_file.exists() else b"")
                       + f"|{quality.KIT_VERSION}|{clips}|{voice and voice['label']}".encode()).hexdigest()
    progress = root / "_progress.json"
    try:
        kept = json.loads(progress.read_text(encoding="utf-8")) if rules.get("jobs.resume_steps") else {}
    except (OSError, ValueError):
        kept = {}
    kept = kept.get("done", {}) if kept.get("sig") == sig else {}
    for who in list(quality.ON_SCREEN) + ["crowd"]:
        folder = root / who
        folder.mkdir(exist_ok=True)
        old = kept.get(who)
        if old and all((ROOT / old[k]).exists() for k in ("sheet", "clip") if k in old):
            say(f"Kept from the run that was cut off: {who}")
            lib["characters"].append(old)
            continue
        say(f"Reference sheet: {who}")
        props = folder / "_props.json"
        props.write_text(json.dumps({"who": who}), encoding="utf-8")
        remotion(["still", "src/index.jsx", "CharacterSheet", str(folder / "reference-sheet.png"), f"--props={props}", "--log=error",
                  "--overwrite"], timeout=900)
        entry = {"id": who, "sheet": (folder / "reference-sheet.png").relative_to(ROOT).as_posix()}
        if clips and who != "crowd":   # the crowd is a sheet only: its people are the cast's looks in other colours
            say(f"Test clip: {who} (30 s, three shots)")
            props.write_text(json.dumps({"who": who, "mouth": mouth, "audio": "test-voice.wav", "durationInFrames": total}), encoding="utf-8")
            remotion(["render", "src/index.jsx", "CharacterTest", str(folder / "test.mp4"), f"--props={props}", f"--public-dir={root}",
                      "--codec=h264", "--crf=24", "--scale=0.5", "--log=warn", "--overwrite"], timeout=3600)
            entry["clip"] = (folder / "test.mp4").relative_to(ROOT).as_posix()
        props.unlink(missing_ok=True)
        lib["characters"].append(entry)
        kept[who] = entry
        progress.write_text(json.dumps({"sig": sig, "done": kept}), encoding="utf-8")
    progress.unlink(missing_ok=True)
    if voice:
        lib["voice"] = voice
    # keep earlier reviews and the owner's approval across remakes
    old = {}
    try:
        old = json.loads((root / "library.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        pass
    if old.get("reviews") and not clips and old.get("kit") == quality.KIT_VERSION:
        lib["reviews"] = old["reviews"]
    (root / "library.json").write_text(json.dumps(lib, indent=2), encoding="utf-8")
    return lib


CAST_LINES = {   # one line per character, in character, to hear the cast's voices (about 80 characters each)
    "scholar": ("curious", "Patience, my friends. The shadow is telling us something... and I intend to listen."),
    "ruler": ("proud", "I am the KING. If anyone measures the world, it will be on my orders!"),
    "citizen": ("sarcastic", "Measure the whole Earth? With a stick? Sure. And I'll fly to the moon on a goat."),
    "woman": ("playful", "Oh, let him try. The last time you all laughed at him, he was right."),
    "elder": ("annoyed", "In my day, we didn't measure the Earth. We stood on it, and we were grateful."),
    "merchant": ("excited", "Fresh scrolls! Fine papyrus! Every great idea starts on my paper, I promise you!"),
    "guard": ("deadpan", "Sir, the man with the stick is back. He says it's science. Shall I let him in?"),
    "worker": ("chuckles", "Dig a well, they said. Easy work, they said. Now a scholar wants to stare into it."),
}


def make_cast_samples(project_id=3):
    """Each character says one line in its own voice (the voices the project gives them), for the owner to hear the cast."""
    project = cp.get_project(project_id, with_text=False)
    ffmpeg = shorts.find_ffmpeg()
    voices = cast_voices(project, list(quality.ON_SCREEN))
    folder = shorts.CONTENT / f"project-{project_id}" / "voice-samples" / "cast"
    folder.mkdir(parents=True, exist_ok=True)
    made, billed = [], 0
    for who in quality.ON_SCREEN:
        tag, text = CAST_LINES[who]
        tmp = folder / "_s"
        tmp.mkdir(exist_ok=True)
        try:
            raw, _, _, _, _, chars, _ = synth_dialogue([{"scene": 0, "who": who, "text": text, "tag": tag}], voices, tmp)
            billed += chars
            shorts.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(raw), "-af", "loudnorm=I=-15:TP=-1.5:LRA=11", "-ar", "44100",
                        "-b:a", "128k", str(folder / f"{who}.mp3")])
            made.append({"who": who, "voice": voices[who]})
        except Exception as e:   # one voice failing must not lose the others
            say(f"  {who}: skipped ({type(e).__name__}: {str(e)[:160]})")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    if billed:
        cp.log("Calina", "voice_chars", None, {"engine": "elevenlabs", "chars": billed, "what": "cast samples"})
    return {"made": made, "chars": billed}


def add_eleven_voice(project_id, voice_id, name=""):
    """Register any ElevenLabs voice id for a project: look it up (name, labels), make its sample, remember it. Returns the entry."""
    import soundfile as sf
    voice_id = (voice_id or "").strip()
    if voice_id.startswith(ELEVEN_PREFIX):
        voice_id = voice_id[len(ELEVEN_PREFIX):]
    try:
        info = elevenlabs.voice_info(voice_id)
    except elevenlabs.ElevenError as e:
        raise Blocked(str(e))
    labels = ", ".join(str(v) for k, v in (info["labels"] or {}).items() if k in ("accent", "gender", "age", "descriptive", "description", "use_case") and v)
    label = f"ElevenLabs: {name.strip() or info['name']}" + (f" ({labels})" if labels else "")
    vid = ELEVEN_PREFIX + info["id"]
    say(f"Sample: {label}")
    ffmpeg = shorts.find_ffmpeg()
    folder = shorts.CONTENT / f"project-{project_id}" / "voice-samples"
    folder.mkdir(parents=True, exist_ok=True)
    tmp = folder / "_s"
    tmp.mkdir(exist_ok=True)
    try:
        raw, _, _, _, wpm, chars = synth(vid, [SAMPLE_LINE], TARGET_WPM, tmp)
    except elevenlabs.ElevenError as e:
        shutil.rmtree(tmp, ignore_errors=True)
        raise Blocked(str(e))
    cp.log("Calina", "voice_chars", None, {"engine": "elevenlabs", "chars": chars, "what": "sample", "voice": label})
    out = folder / f"{vid}.mp3"
    shorts.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(raw), "-af", "loudnorm=I=-15:TP=-1.5:LRA=11", "-ar", "44100", "-b:a", "128k", str(out)])
    shutil.rmtree(tmp, ignore_errors=True)
    entry = {"id": vid, "label": label, "wpm": round(wpm), "file": out.relative_to(ROOT).as_posix()}
    sj = folder / "samples.json"
    try:
        data = json.loads(sj.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        data = {"line": SAMPLE_LINE, "voices": []}
    data["voices"] = [v for v in data.get("voices", []) if v["id"] != vid] + [entry]
    sj.write_text(json.dumps(data, indent=2), encoding="utf-8")
    pr = cp.get_project(project_id, with_text=False) or {}
    mine = [v for v in (pr.get("meta") or {}).get("eleven_voices") or [] if v["id"] != info["id"]] + [{"id": info["id"], "name": info["name"], "label": label}]
    cp.set_project_meta(project_id, eleven_voices=mine)
    return entry


# ---- Rana's design options (design.py, 2.27.0) -------------------------------------------------------------------------
LIGHT, DARK = "#F5F5F2", "#0B1220"


def design_render(folder):
    """Every option-k/ in folder: icon.svg -> icon-{light,dark}-{1024,256,64}.png, wordmark.svg -> wordmark-{light,dark}.png, and
    sheet.png (all of them on one page, the 64 px ones shown at real size and enlarged) for Israa and the owner."""
    import base64
    from PIL import Image, ImageDraw
    folder = Path(folder).resolve()   # Remotion runs in its own folder
    ensure_toolchain()
    made = []
    for opt in sorted(folder.glob("option-*")):
        props = opt / "_props.json"
        for part, (w, h) in (("icon", (1024, 1024)), ("wordmark", (1600, 480))):
            svg = (opt / f"{part}.svg").read_bytes()
            src = "data:image/svg+xml;base64," + base64.b64encode(svg).decode()
            for tone, bg in (("light", LIGHT), ("dark", DARK)):
                props.write_text(json.dumps({"src": src, "bg": bg, "w": w, "h": h}), encoding="utf-8")
                out = opt / f"{part}-{tone}{'-1024' if part == 'icon' else ''}.png"
                say(f"{opt.name}: {part} on {tone}")
                remotion(["still", "src/index.jsx", "SvgStill", str(out), f"--props={props}", "--log=error", "--overwrite"], timeout=900)
                if part == "icon":
                    big = Image.open(out).convert("RGB")
                    for size in (256, 64):
                        big.resize((size, size), Image.LANCZOS).save(opt / f"icon-{tone}-{size}.png")
        props.unlink(missing_ok=True)
        # the contact sheet: icon at 256 and 64 (real size, and 64 blown up 4x to show what survives) on light and dark, wordmarks
        sheet = Image.new("RGB", (1400, 830), "#FFFFFF")
        d = ImageDraw.Draw(sheet)
        d.text((24, 16), f"{opt.name}: icon at 256 px, at 64 px (real size), 64 px enlarged; wordmark. Light and dark.", fill="#111111")
        for row, tone in enumerate(("light", "dark")):
            y = 48 + row * 300
            sheet.paste(Image.open(opt / f"icon-{tone}-256.png"), (24, y))
            small = Image.open(opt / f"icon-{tone}-64.png")
            sheet.paste(small, (310, y + 96))
            sheet.paste(small.resize((256, 256), Image.NEAREST), (410, y))
            word = Image.open(opt / f"wordmark-{tone}.png")
            word.thumbnail((700, 256))
            sheet.paste(word, (690, y))
        for col, tone in enumerate(("light", "dark")):   # the wordmark small, as in a page header
            word = Image.open(opt / f"wordmark-{tone}.png")
            word.thumbnail((360, 108))
            sheet.paste(word, (24 + col * 400, 680))
        d.text((24, 800), "Wordmarks at header size (360 px wide).", fill="#111111")
        sheet.save(opt / "sheet.png")
        made.append(opt.name)
    return {"options": made}


def main():
    if len(sys.argv) > 3 and sys.argv[1] == "cast-test":   # animate.py cast-test <project> <version folder>: Rana's candidate cast
        cp.init()
        try:
            folder = Path(sys.argv[3]).resolve()
            print("RESULT " + json.dumps(make_character_library(int(sys.argv[2]), clips=True, root=folder / "characters", cast=folder / "Character.jsx")))
        except Blocked as e:
            print("BLOCKED " + str(e))
            sys.exit(2)
        return
    if len(sys.argv) > 2 and sys.argv[1] == "design-render":   # animate.py design-render <folder> (Rana's design options)
        cp.init()
        try:
            print("RESULT " + json.dumps(design_render(sys.argv[2])))
        except Blocked as e:
            print("BLOCKED " + str(e))
            sys.exit(2)
        return
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["render", "check", "samples", "setup", "characters", "sheets", "animator-test", "voice-add", "render-voices", "cast-samples"])
    ap.add_argument("arg", nargs="?", type=int)
    ap.add_argument("arg2", nargs="?")
    ap.add_argument("arg3", nargs="?")
    a = ap.parse_args()
    cp.init()
    try:
        if a.command == "setup":
            ensure_toolchain()
            print("RESULT " + json.dumps({"ok": True}))
        elif a.command == "check":
            ep = cp.get_episode(a.arg)
            problems = checklist(ep) if ep and is_animated(ep) else ["That episode has no scene file."]
            print(json.dumps({"ok": not problems, "problems": problems}))
        elif a.command == "animator-test":
            import animator
            print("RESULT " + json.dumps(animator.run_test(a.arg, int(a.arg2) if a.arg2 is not None else 6)))
        elif a.command == "voice-add":   # animate.py voice-add <project> <voice id> [name]
            print("RESULT " + json.dumps(add_eleven_voice(a.arg, a.arg2, a.arg3 or "")))
        elif a.command == "render-voices":   # animate.py render-voices <episode> <voice id,voice id>
            print("RESULT " + json.dumps(render_voices(a.arg, [v for v in (a.arg2 or "").split(",") if v])))
        elif a.command == "cast-samples":   # animate.py cast-samples <project>
            print("RESULT " + json.dumps(make_cast_samples(a.arg or 3)))
        elif a.command in ("characters", "sheets"):
            print("RESULT " + json.dumps(make_character_library(a.arg or 3, clips=a.command == "characters")))
        elif a.command == "samples":
            print("RESULT " + json.dumps({"voices": make_samples(a.arg or 3)}))
        else:
            print("RESULT " + json.dumps(render_episode(a.arg)))
    except Blocked as e:
        print("BLOCKED " + str(e))
        sys.exit(2)


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except Exception:
            pass
    rules.apply_all()   # the team's live rules (lengths, pace, voice, sound) as they are right now
    main()
