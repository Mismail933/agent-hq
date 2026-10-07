"""
Voice matcher (2.20.0): find the ElevenLabs Voice Library voices that sound most like a reference narrator, by measurement, not by ear.

    <video-tools python> voice_match.py record <project> [seconds]   record what this PC is playing (the owner plays the video)
    <video-tools python> voice_match.py match <project> [clip file]  rank library voices against the reference clip

How it decides:
1. The reference: content/project-N/voice-ref/reference.wav (recorded here) or any audio file the owner drops in that folder. We
   never download from YouTube: the owner plays the video himself while the office records his speakers for 40 seconds.
2. Candidates: ElevenLabs' own "similar voices" search with the clip, plus Voice Library searches for narration/storytelling voices
   of the same gender (both free: browsing and previews cost no characters).
3. Every candidate's preview and the reference are turned into speaker embeddings with Microsoft's WavLM speaker-verification
   model (microsoft/wavlm-base-plus-sv, MIT licence, run locally with Hugging Face transformers): cosine similarity says how alike
   the VOICES are. The WAY OF TALKING is measured too: pitch, how much the pitch moves (expressiveness) and pace.
4. Score = 75% voice + 25% way of talking. The top 5 go to content/project-N/voice-ref/matches.json with their library links and
   preview sounds; the owner listens, adds one to his account with one click, and a sample is made in our usual line.
"""
import json
import os
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))
import elevenlabs  # noqa: E402
import shorts  # noqa: E402
from shorts import Blocked, say  # noqa: E402

SR = 16000
MODEL = "microsoft/wavlm-base-plus-sv"
NOFLAGS = getattr(subprocess, "CREATE_NO_WINDOW", 0)
AUDIO_EXT = (".wav", ".mp3", ".m4a", ".ogg", ".flac", ".webm", ".aac")


def ref_dir(pid):
    return shorts.CONTENT / f"project-{int(pid)}" / "voice-ref"


# ---- 1. the reference -----------------------------------------------------------------
def level_file(pid):
    return ref_dir(pid) / "_level.json"   # live progress for the office's meter ("_" files are never the reference)


def record(pid, seconds=40):
    """Record what the PC's speakers play for `seconds` (every output device at once; the loudest one wins). The owner starts the
    video right after clicking. Records in small chunks (wall clock, so a silent device can't hang it) and writes the live level to
    voice-ref/_level.json for the office's meter. Saves voice-ref/reference.wav, trimmed of the silence before he pressed play."""
    try:
        import soundcard as sc
    except ImportError:
        p = subprocess.run([sys.executable, "-m", "pip", "install", "-q", "soundcard==0.4.5"], capture_output=True, text=True, creationflags=NOFLAGS)
        try:
            import soundcard as sc
        except ImportError:
            raise Blocked("Couldn't install the speaker recorder (soundcard): " + ((p.stderr or p.stdout or "").strip().splitlines() or ["no internet?"])[-1][:200])
    import warnings
    import numpy as np
    import soundfile as sf
    warnings.filterwarnings("ignore")   # soundcard warns about discontinuities on loopback; harmless here
    folder = ref_dir(pid)
    folder.mkdir(parents=True, exist_ok=True)
    try:
        devices = [m for m in sc.all_microphones(include_loopback=True) if m.isloopback]
    except Exception as e:
        raise Blocked(f"Couldn't list the speakers to record from: {str(e)[:200]}")
    if not devices:
        raise Blocked("This PC has no speaker output that can be recorded (no loopback device). Plug in or turn on speakers/headphones and try again.")
    got, errors, live = {}, {}, {}
    start = time.time()

    def grab(m):
        if os.name == "nt":   # each recording thread needs COM on Windows
            try:
                import ctypes
                ctypes.windll.ole32.CoInitializeEx(None, 0)
            except Exception:
                pass
        chunks = []
        try:
            with m.recorder(samplerate=48000, channels=1) as r:
                while time.time() - start < seconds:
                    try:
                        c = r.record(numframes=None)   # whatever has arrived; nothing while the device is silent
                    except TypeError:
                        c = r.record(numframes=4800)
                    if c is None or not len(c):
                        time.sleep(0.02)
                        continue
                    c = np.asarray(c, dtype="float32").reshape(-1)
                    chunks.append(c)
                    live[m.name] = float(np.sqrt(np.mean(c ** 2)))
            got[m.name] = np.concatenate(chunks) if chunks else np.zeros(0, dtype="float32")
        except Exception as e:   # one odd device must not stop the others
            errors[m.name] = str(e)[:160]
            say(f"  {m.name}: {str(e)[:100]}")
    say(f"Recording {seconds} s from the speakers ({len(devices)} output device(s)): play the video now.")
    threads = [threading.Thread(target=grab, args=(m,), daemon=True) for m in devices]
    for t in threads:
        t.start()
    peak = {}
    while any(t.is_alive() for t in threads) and time.time() - start < seconds + 20:
        now = list(live.items())   # the recording threads add to `live` while we read it
        for k, v in now:
            peak[k] = max(peak.get(k, 0.0), v)
        top = max(now,key=lambda kv: peak.get(kv[0], 0), default=(None, 0.0))
        try:
            level_file(pid).write_text(json.dumps({"elapsed": round(min(time.time() - start, seconds), 1), "seconds": seconds,
                                                   "level": round(min(1.0, top[1] * 4), 3), "device": top[0], "heard": max(peak.values(), default=0) >= 0.003,
                                                   "failed": len(errors), "devices": len(devices)}), encoding="utf-8")
        except OSError:
            pass
        time.sleep(0.25)
    rms = lambda a: float(np.sqrt(np.mean(a ** 2))) if len(a) else 0.0
    best = max(got.items(), key=lambda kv: rms(kv[1]), default=(None, None))
    if best[1] is None:
        raise Blocked("Recording failed on every speaker output: " + ("; ".join(f"{k}: {v}" for k, v in errors.items())[:300] or "no answer from the sound system"))
    if rms(best[1]) < 0.003:
        raise Blocked("Nothing was playing while I recorded. Click Record, then press play on the video within a couple of seconds "
                      "(and check the video isn't muted).")
    a = best[1].reshape(-1).astype("float32")
    env = np.abs(a)
    loud = np.nonzero(env > 0.02)[0]
    a = a[max(0, loud[0] - 4800):loud[-1] + 4800] if len(loud) else a
    out = folder / "reference.wav"
    sf.write(str(out), a, 48000)
    say(f"  Saved {len(a) / 48000:.0f} s from {best[0]}.")
    return {"file": out.relative_to(ROOT).as_posix(), "seconds": round(len(a) / 48000, 1), "device": best[0]}


def reference_file(pid, given=None):
    if given:
        p = Path(given)
        p = p if p.is_absolute() else ROOT / p
        if not p.exists():
            raise Blocked(f"There is no file {given}.")
        return p
    folder = ref_dir(pid)
    files = sorted((f for f in folder.glob("*") if f.suffix.lower() in AUDIO_EXT and not f.name.startswith("_")),
                   key=lambda f: -f.stat().st_mtime) if folder.exists() else []   # the newest clip is the reference
    if not files:
        raise Blocked(f"No reference clip yet: record one (the Record button) or put an audio file in {folder.relative_to(ROOT).as_posix()}/.")
    return files[0]


def load(path, seconds=None, offset=0.0):
    """Any audio file -> float32 mono at 16 kHz, voice band only (80-7500 Hz), via FFmpeg."""
    import numpy as np
    ff = shorts.find_ffmpeg()
    cmd = [ff, "-v", "error", "-ss", f"{offset:.2f}", "-i", str(path)] + (["-t", f"{seconds:.2f}"] if seconds else []) + \
          ["-af", "highpass=f=80,lowpass=f=7500", "-ac", "1", "-ar", str(SR), "-f", "f32le", "pipe:1"]
    p = subprocess.run(cmd, capture_output=True, creationflags=NOFLAGS)
    if p.returncode != 0 or not p.stdout:
        raise Blocked(f"Couldn't read {Path(path).name}.")
    return np.frombuffer(p.stdout, dtype="<f4").astype("float32")


# ---- 2. measuring ---------------------------------------------------------------------------
_MODEL = {}


def embedder():
    if not _MODEL:
        from transformers import AutoFeatureExtractor, WavLMForXVector
        say("  Loading the speaker model (WavLM, about 360 MB the first time)...")
        _MODEL["fe"] = AutoFeatureExtractor.from_pretrained(MODEL)
        _MODEL["m"] = WavLMForXVector.from_pretrained(MODEL).eval()
    return _MODEL["fe"], _MODEL["m"]


def embed(a):
    """One speaker embedding for a clip: the mean of embeddings of up to six 6-second windows (normalised)."""
    import numpy as np
    import torch
    fe, m = embedder()
    win = 6 * SR
    parts = [a[i:i + win] for i in range(0, max(1, len(a) - win // 2), win)][:6] or [a]
    vecs = []
    for part in parts:
        if len(part) < SR:
            continue
        x = fe(part, sampling_rate=SR, return_tensors="pt")
        with torch.no_grad():
            v = m(**x).embeddings[0].numpy()
        vecs.append(v / (np.linalg.norm(v) + 1e-9))
    if not vecs:
        raise Blocked("The clip is too short (under a second of sound).")
    v = np.mean(vecs, axis=0)
    return v / (np.linalg.norm(v) + 1e-9)


def style(a):
    """The way of talking, measured: median pitch (Hz), pitch movement (semitones, standard deviation: flat vs lively), pace
    (syllable-like loudness peaks a second) and how much of the time is speech."""
    import numpy as np
    hop, n = SR // 100, int(SR * 0.04)
    f0 = []
    for i in range(0, len(a) - n, hop):
        fr = a[i:i + n]
        if np.sqrt(np.mean(fr ** 2)) < 0.01:
            continue
        fr = fr - fr.mean()
        ac = np.correlate(fr, fr, "full")[n - 1:]
        lo, hi = SR // 400, SR // 70   # 70-400 Hz
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] > 0.35 * ac[0]:
            f0.append(SR / k)
    f0 = np.array(f0)
    env = np.array([np.sqrt(np.mean(a[i:i + hop] ** 2)) for i in range(0, len(a) - hop, hop)])
    sm = np.convolve(env, np.ones(5) / 5, "same")
    thr = np.percentile(sm, 60) if len(sm) else 0
    peaks = sum(1 for i in range(1, len(sm) - 1) if sm[i] > thr and sm[i] >= sm[i - 1] and sm[i] > sm[i + 1])
    voiced = float((sm > thr * 0.5).mean()) if len(sm) else 0
    secs = len(a) / SR
    if len(f0) < 20:
        return {"pitch": None, "movement": None, "pace": round(peaks / max(secs, 1e-6), 2), "voiced": round(voiced, 2)}
    semis = 12 * np.log2(f0 / np.median(f0))
    return {"pitch": round(float(np.median(f0)), 1), "movement": round(float(np.std(semis)), 2),
            "pace": round(peaks / max(secs, 1e-6), 2), "voiced": round(voiced, 2)}


def style_closeness(r, c):
    """0..1: how alike two ways of talking are (pitch within ~3 semitones, movement, pace)."""
    import math
    parts = []
    if r.get("pitch") and c.get("pitch"):
        parts.append(max(0.0, 1 - abs(12 * math.log2(c["pitch"] / r["pitch"])) / 6))
    if r.get("movement") is not None and c.get("movement") is not None:
        parts.append(max(0.0, 1 - abs(c["movement"] - r["movement"]) / max(1.5, r["movement"])))
    if r.get("pace") and c.get("pace"):
        parts.append(max(0.0, 1 - abs(c["pace"] - r["pace"]) / max(1.0, r["pace"])))
    return sum(parts) / len(parts) if parts else 0.5


# ---- 3. candidates and ranking ----------------------------------------------------------------
def candidates(clip_bytes, ref_style):
    """Voice Library voices to compare: ElevenLabs' own similar-voice search + narration voices of the same gender. All free."""
    seen, out, notes = set(), [], []
    try:
        sim = elevenlabs.similar_voices(clip_bytes, top_k=40)
        for rank, v in enumerate(sim, 1):
            v["eleven_rank"] = rank
        out += sim
        notes.append(f"ElevenLabs' similar-voice search returned {len(sim)}.")
    except elevenlabs.ElevenError as e:
        notes.append(f"ElevenLabs' similar-voice search failed: {str(e)[:160]}")
    gender = "male" if (ref_style.get("pitch") or 120) < 165 else "female"
    for q in ({"use_cases": "narrative_story"}, {"use_cases": "narrative_story", "search": "storyteller"},
              {"search": "documentary"}, {"search": "energetic narrator"}, {"search": "youtube"}):
        try:
            got = elevenlabs.shared_voices(gender=gender, page_size=40, **q)
            out += got
        except elevenlabs.ElevenError as e:
            notes.append(f"Library search {q} failed: {str(e)[:120]}")
    uniq = []
    for v in out:
        if v.get("voice_id") and v["voice_id"] not in seen and v.get("preview_url"):
            seen.add(v["voice_id"])
            uniq.append(v)
    return uniq, notes, gender


def fetch_preview(v, folder):
    dest = folder / f"{v['voice_id']}.mp3"
    if not dest.exists() or dest.stat().st_size < 2000:
        req = urllib.request.Request(v["preview_url"], headers={"User-Agent": shorts.UA})
        with urllib.request.urlopen(req, timeout=60, context=elevenlabs._tls()) as r:
            dest.write_bytes(r.read())
    return dest


def match(pid, clip=None, top=5):
    """Rank library voices against the reference clip. Writes voice-ref/matches.json and returns it."""
    import numpy as np
    src = reference_file(pid, clip)
    say(f"Reference: {src.name}")
    a = load(src, seconds=60)
    if len(a) < SR * 8:
        raise Blocked("The reference clip is under 8 seconds: record 20-40 seconds of the narrator talking.")
    ref_vec, ref_style = embed(a), style(a)
    say(f"  Reference: pitch {ref_style['pitch']} Hz, movement {ref_style['movement']} semitones, pace {ref_style['pace']}/s")
    clip_bytes = subprocess.run([shorts.find_ffmpeg(), "-v", "error", "-i", str(src), "-t", "40", "-ac", "1", "-ar", "22050", "-b:a", "96k",
                                 "-f", "mp3", "pipe:1"], capture_output=True, creationflags=NOFLAGS).stdout
    cands, notes, gender = candidates(clip_bytes, ref_style)
    say(f"  {len(cands)} library voices to compare ({gender}).")
    folder = ref_dir(pid) / "_previews"
    folder.mkdir(parents=True, exist_ok=True)
    scored = []
    for i, v in enumerate(cands):
        try:
            b = load(fetch_preview(v, folder))
            if len(b) < SR * 2:
                continue
            sim = float(np.dot(ref_vec, embed(b)))
            st = style(b)
            close = style_closeness(ref_style, st)
            scored.append({**v, "voice": round(sim, 3), "way_of_talking": round(close, 3), "score": round(0.75 * sim + 0.25 * close, 3), "style": st})
        except Exception as e:   # one bad preview must not stop the ranking
            say(f"  skipped {v.get('name')}: {str(e)[:80]}")
        if (i + 1) % 10 == 0:
            say(f"  compared {i + 1} of {len(cands)}")
    scored.sort(key=lambda x: x["score"], reverse=True)
    result = {"made": time.strftime("%Y-%m-%d %H:%M"), "reference": src.relative_to(ROOT).as_posix() if src.is_relative_to(ROOT) else src.name,
              "reference_style": ref_style, "compared": len(scored), "gender": gender, "notes": notes, "model": MODEL,
              "how": "score = 75% voice similarity (WavLM speaker embeddings, cosine) + 25% way of talking (pitch, pitch movement, pace). "
                     "The same voice scores about 0.95-1.0 on voice similarity; different voices of the same kind can reach 0.9, so listen to the top few.",
              "cost": "Free: browsing the Voice Library and its previews uses no ElevenLabs characters.",
              "top": scored[:top], "next": [{k: x[k] for k in ("name", "voice_id", "score")} for x in scored[top:top + 10]]}
    (ref_dir(pid) / "matches.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    pid = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    try:
        if cmd == "record":
            try:
                print("RESULT " + json.dumps(record(pid, int(sys.argv[3]) if len(sys.argv) > 3 else 40)))
            finally:
                level_file(pid).unlink(missing_ok=True)
        elif cmd == "match":
            print("RESULT " + json.dumps(match(pid, sys.argv[3] if len(sys.argv) > 3 else None)))
        else:
            print("BLOCKED usage: voice_match.py record|match <project> [seconds|clip]")
            return 2
    except Blocked as e:
        print("BLOCKED " + str(e))
        return 2
    except elevenlabs.ElevenError as e:
        print("BLOCKED " + str(e))
        return 2
    return 0


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except Exception:
            pass
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    sys.exit(main())
