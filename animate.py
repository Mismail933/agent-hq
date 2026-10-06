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
from shorts import Blocked, say  # noqa: E402

FPS = 30
HOME = Path.home() / ".agent-hq-anim"
NODE_VERSION = "24.21.0"
NODE_DIR = HOME / "node"
APP = HOME / "app"
PIPER_DIR = HOME / "piper"
PIPER_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/"
LEAD, PAD, PAD_HOOK, OUTRO_SECONDS = 0.15, 0.2, 0.35, 1.7
MAX_TOTAL = 178.0   # YouTube's limit for a Short is 3 minutes; there is no other cap: the story decides, Israa judges whether it earns its length
DISCLOSURE_V3 = "AI-assisted: script, voice and animation made with AI; facts sourced below."
BACKDROPS = {"court", "library", "nile", "well", "study", "map", "diagram"}
CAMERAS = {"push_in", "pull_out", "pan_left", "pan_right", "pan_up", "pan_down", "drift"}
CAST = {"narrator", "scholar", "ruler"}
POSES = {"stand", "point", "explain", "amazed"}
NOFLAGS = getattr(subprocess, "CREATE_NO_WINDOW", 0)

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
    """(engine, voice, label) for a voice id, including ElevenLabs voices ('eleven:<voice id>')."""
    if vid in VOICES:
        return VOICES[vid]
    if str(vid).startswith(ELEVEN_PREFIX):
        return ("eleven", vid[len(ELEVEN_PREFIX):], "ElevenLabs voice")
    return VOICES[DEFAULT_VOICE]


# ---- tools: Node + Remotion ----------------------------------------------------------
def node_env():
    env = dict(os.environ)
    env["PATH"] = str(NODE_DIR) + os.pathsep + env.get("PATH", "")
    return env


def download(url, dest):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": shorts.UA}), timeout=180, context=shorts.TLS) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)


def ensure_toolchain():
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


def remotion(args, timeout=3000):
    cli = APP / "node_modules" / "@remotion" / "cli" / "remotion-cli.js"
    p = subprocess.run([str(NODE_DIR / "node.exe"), str(cli), *args], cwd=APP, env=node_env(), capture_output=True,
                       text=True, encoding="utf-8", errors="replace", timeout=timeout, creationflags=NOFLAGS)
    if p.returncode != 0:
        text = re.sub(r"\x1b\[[0-9;]*m", "", (p.stderr or "") + (p.stdout or "")).strip()
        k = text.find("Error:")
        raise Blocked("Remotion failed: " + (text[k:k + 900] if k >= 0 else text[-600:]))
    return p.stdout


# ---- 1. checklist ---------------------------------------------------------------------
def is_animated(ep):
    return bool((ep.get("data") or {}).get("scenes"))


def narration(d):
    return [s.get("voice_line", "").strip() for s in d.get("scenes") or []]


def checklist(ep):
    d, problems = ep["data"], []
    scenes = d.get("scenes") or []
    if not quality.MIN_SCENES <= len(scenes) <= quality.MAX_SCENES:
        problems.append(f"The scene file has {len(scenes)} scenes; it should have 9-16.")
    lines = narration(d)
    words = sum(len(l.split()) for l in lines)
    if not quality.MIN_WORDS <= words <= quality.MAX_WORDS:   # only absurd lengths: no fixed target, the story sets it
        problems.append(f"The narration is {words} words: too short to tell a story, or too long for a Short (the limit is 3 minutes).")
    for s in scenes:
        n = s.get("n", "?")
        if not (s.get("voice_line") or "").strip():
            problems.append(f"Scene {n} has no voice line.")
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

    def line(self, text, previous="", following=""):
        import numpy as np
        if self.engine == "eleven":
            a, words, n = elevenlabs.speak(self.voice, text, self.speed, previous, following)
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
    """Up to 3 words at a time; a sentence or comma ends a chunk. Frames."""
    chunks, cur = [], []
    for w in words:
        cur.append({"w": w[0], "from": round(w[1] * FPS), "to": max(round(w[2] * FPS), round(w[1] * FPS) + 3)})
        if len(cur) == 3 or re.search(r"[.,!?;:]$", w[0]):
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    out = []
    for i, c in enumerate(chunks):
        nxt = chunks[i + 1][0]["from"] if i + 1 < len(chunks) else None
        end = c[-1]["to"] + 8
        out.append({"from": c[0]["from"], "to": min(end, nxt) if nxt else end, "words": c})
    return out


# ---- 3. the whole job -------------------------------------------------------------------
def voice_choice(project):
    meta = (project or {}).get("meta") or {}
    v = (meta.get("voice") or {})
    vid = v.get("id") or getattr(settings, "ANIM_VOICE", DEFAULT_VOICE)
    ok = vid in VOICES or (str(vid).startswith(ELEVEN_PREFIX) and elevenlabs.configured())
    return (vid if ok else DEFAULT_VOICE), v.get("speed")


def auto_split(ep):
    """Lines over the per-scene limit that are made of whole sentences are split into scenes (words unchanged) instead of refusing the
    render. Saved on the episode so the owner sees what was rendered. Returns the (possibly updated) episode."""
    d = ep["data"]
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
    ensure_toolchain()
    lines = [shorts.fill_placeholders(l, project) for l in narration(d)]
    # the owner's own voice file (e.g. voice.mp3 from ElevenLabs); never our own generated voice.wav / voice-N.wav
    own = None if voice else next((f for f in sorted(folder.glob("voice.*")) if f.suffix.lower() in production.AUDIO_EXT and f.name.lower() != "voice.wav"), None)
    say("Voice..." if not own else f"Voice: using your file {own.name}...")
    if own:
        raw, starts, words, voice_end, wpm = whisper_file_voice(ffmpeg, own, lines, folder)
        used = f"your own file ({own.name})"
    else:
        vid, speed = (voice, None) if voice else voice_choice(project)
        meta_v = (project.get("meta") or {})
        reg = {ELEVEN_PREFIX + x["id"]: x["label"] for x in meta_v.get("eleven_voices") or []}
        label = reg.get(vid) or ((meta_v.get("voice") or {}).get("label") if not voice else None) or voice_spec(vid)[2]
        try:
            raw, starts, words, voice_end, wpm, chars = synth(vid, lines, TARGET_WPM, folder, speed)
        except (elevenlabs.ElevenError, ImportError, OSError) as ex:
            if voice_spec(vid)[0] != "eleven" or not getattr(settings, "ELEVEN_FALLBACK", True):
                raise Blocked(f"The voice failed: {ex}")
            say(f"  ElevenLabs failed ({str(ex)[:160]}): using the free Kokoro voice instead. It will sound more robotic.")
            raw, starts, words, voice_end, wpm, chars = synth(DEFAULT_VOICE, lines, TARGET_WPM, folder, None)
            label = f"Kokoro (free fallback; ElevenLabs failed: {str(ex)[:120]})"
            vid = DEFAULT_VOICE
        used = label
        if chars:
            cp.log("Calina", "voice_chars", None, {"engine": "elevenlabs", "chars": chars, "episode": ep["id"], "what": "short"})
            say(f"  ElevenLabs: {chars} characters used for this Short.")
    normalise_voice(ffmpeg, raw, folder / f"voice{suffix}.wav")
    raw.unlink(missing_ok=True)
    voice_secs = shorts.probe_seconds(ffmpeg, folder / f"voice{suffix}.wav")
    end_t = max(voice_secs, voice_end)
    total_secs = end_t + OUTRO_SECONDS
    if total_secs > MAX_TOTAL:
        raise Blocked(f"The Short would be {total_secs:.0f} s, over YouTube's 3-minute limit for a Short. Split the story or tighten it.")
    total = int(round(total_secs * FPS))
    say(f"  {voice_secs:.1f} s of speech at {wpm:.0f} words a minute ({used}); {total_secs:.1f} s with the end card")
    bounds = [0 if i == 0 else round(starts[i] * FPS) for i in range(len(starts))] + [round(end_t * FPS)]
    scenes = []
    for i, s in enumerate(d["scenes"]):
        sc = {k: v for k, v in s.items() if k not in ("voice_line", "source_note", "n", "shows", "callout_word")}
        sc["from"] = bounds[i]
        sc["frames"] = max(12, bounds[i + 1] - bounds[i])
        if s.get("callout"):   # the callout appears on the word it belongs to, never before it is said
            sc["callout_from"] = callout_frame(s, words, bounds[i], bounds[i + 1])
        scenes.append(sc)
    ch = (project.get("meta") or {}).get("channel") or {}
    props = {
        "durationInFrames": total,
        "audio": f"voice{suffix}.wav",
        "mouth": mouth_for(folder / f"voice{suffix}.wav", words, lines, folder, total),
        "intro": {"place": short_place(d.get("place") or ""), "year": (d.get("year") or "").upper()},
        "outro": {"channel": ch.get("name") or "POV Then History", "handle": ch.get("handle") or "@POVThenHistory"},
        "outro_from": round(end_t * FPS),
        "caption_chunks": caption_chunks(words),
        "scenes": scenes,
    }
    (folder / f"scene-props{suffix}.json").write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")
    say("Animating (this is the slow part: a few minutes)...")
    out = folder / f"short{suffix}.mp4"
    remotion(["render", "src/index.jsx", "Short", str(out), f"--props={folder / f'scene-props{suffix}.json'}",
              f"--public-dir={folder}", "--codec=h264", "--crf=20", "--log=warn", "--overwrite"], timeout=3600)
    if suffix:   # a voice variant: nothing else about the episode changes
        say(f"Variant done in {time.time() - t0:.0f}s: {out.name}")
        return {"id": vid if not own else "own", "label": used, "video": out.relative_to(ROOT).as_posix(), "seconds": round(total_secs, 1),
                "wpm": round(wpm), "audio": f"voice{suffix}.wav", "props": f"scene-props{suffix}.json"}
    credits = ["Map data: Natural Earth (public domain). Cartoon characters and backgrounds: our own artwork."]
    description = shorts.fill_placeholders((d.get("description") or "").strip(), project)
    if "AI-assisted" not in description:
        description += f"\n\n{DISCLOSURE_V3}"
    if d.get("hashtags"):
        description += "\n\n" + " ".join(d["hashtags"])
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


def make_character_library(project_id=3, clips=True):
    """Reference sheet + 30-second test clip for every character, saved once under content/project-N/characters/.
    The test clip uses the project's chosen voice, Rhubarb's mouth shapes and the whole rig (idle, blink, gestures, walk, expressions)."""
    import numpy as np
    import soundfile as sf
    root = characters_folder(project_id)
    root.mkdir(parents=True, exist_ok=True)
    ensure_toolchain()
    ffmpeg = shorts.find_ffmpeg()
    project = cp.get_project(project_id, with_text=False)
    lib = {"project": project_id, "made": time.strftime("%Y-%m-%d %H:%M"), "characters": []}
    voice = None
    if clips:
        vid, speed = voice_choice(project)
        say("Test voice (same words for every character)...")
        lines = [l.strip() for l in re.split(r"(?<=[.!?])\s+", TEST_SCRIPT) if l.strip()]
        raw, _, words, voice_end, wpm, chars = synth(vid, lines, TARGET_WPM, root, speed)
        if chars:
            cp.log("Calina", "voice_chars", None, {"engine": "elevenlabs", "chars": chars, "what": "character test"})
        normalise_voice(ffmpeg, raw, root / "test-voice.wav")
        raw.unlink(missing_ok=True)
        secs = min(30.0, shorts.probe_seconds(ffmpeg, root / "test-voice.wav"))
        total = int(round(30 * FPS))
        mouth = mouth_for(root / "test-voice.wav", words, lines, root, total)
        voice = {"label": (voice_spec(vid)[2]), "seconds": round(secs, 1)}
    for who in sorted(CAST):
        folder = root / who
        folder.mkdir(exist_ok=True)
        say(f"Reference sheet: {who}")
        props = folder / "_props.json"
        props.write_text(json.dumps({"who": who}), encoding="utf-8")
        remotion(["still", "src/index.jsx", "CharacterSheet", str(folder / "reference-sheet.png"), f"--props={props}", "--log=error",
                  "--overwrite"], timeout=900)
        entry = {"id": who, "sheet": (folder / "reference-sheet.png").relative_to(ROOT).as_posix()}
        if clips:
            say(f"Test clip: {who} (30 s, three shots)")
            props.write_text(json.dumps({"who": who, "mouth": mouth, "audio": "test-voice.wav", "durationInFrames": total}), encoding="utf-8")
            remotion(["render", "src/index.jsx", "CharacterTest", str(folder / "test.mp4"), f"--props={props}", f"--public-dir={root}",
                      "--codec=h264", "--crf=24", "--scale=0.5", "--log=warn", "--overwrite"], timeout=3600)
            entry["clip"] = (folder / "test.mp4").relative_to(ROOT).as_posix()
        props.unlink(missing_ok=True)
        lib["characters"].append(entry)
    if voice:
        lib["voice"] = voice
    # keep earlier reviews and the owner's approval across remakes
    old = {}
    try:
        old = json.loads((root / "library.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        pass
    if old.get("reviews") and not clips:
        lib["reviews"] = old["reviews"]
    (root / "library.json").write_text(json.dumps(lib, indent=2), encoding="utf-8")
    return lib


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


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["render", "check", "samples", "setup", "characters", "sheets", "animator-test", "voice-add", "render-voices"])
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
    main()
