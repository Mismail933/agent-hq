"""
story_sample.py (2.49.0): a short hand-directed sample of a story video (the owner's rule: show a 30-60 s sample at the reference's
level before making anything long). Runs in the shorts venv.

  python story_sample.py <sample.json> [--stills]

sample.json = {title, voice, speed, lines: [{shot, text}]}; every `shot` is a scene in story/src/Opening.jsx. Steps: Kokoro voices each
line on its own (so the picture and the words line up exactly) -> timeline (a pause after each line, the picture cuts a little before
the voice) -> music and sound effects made in code (numpy, no downloads) -> mix (-16 LUFS) -> Remotion render (one heavy job at a time)
-> <sample>.mp4, <sample>.srt (exact subtitles for YouTube), review/sheet-NN.png, motion report.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))
import story   # noqa: E402
import shorts   # noqa: E402

FPS = 30
SR = 48000
LEAD = 0.5
PAUSE = 0.45
EXTRA = {"aerial": 1.2, "cabin": 0.3, "father": 0.3, "storm_window": 0.5, "shaking": 0.3, "lightning": 0.7, "mother": 0.8, "breakup": 0.6,
         "falling": 0.9, "wake": 0.9, "title": 2.4}
LEADIN = 0.2   # the picture cuts this much before its line is spoken


def say(m):
    print(m, flush=True)


# ---- voice ------------------------------------------------------------------------------
def voice_lines(spec, folder):
    from kokoro import KPipeline
    voice, speed = spec.get("voice", "am_michael"), float(spec.get("speed", 0.92))
    pipe = KPipeline(lang_code=voice[0], repo_id="hexgrad/Kokoro-82M")
    out = []
    cache = folder / "_voice-cache"
    cache.mkdir(parents=True, exist_ok=True)
    import hashlib
    for i, ln in enumerate(spec["lines"]):
        key = hashlib.sha1(f"{voice}|{speed}|{ln['text']}".encode()).hexdigest()[:16]
        cw, cj = cache / f"{key}.wav", cache / f"{key}.json"
        if cw.exists() and cj.exists():   # the same words in the same voice: reuse (Kokoro is slow on this PC)
            a48, _ = sf.read(str(cw), dtype="float32")
            words = json.loads(cj.read_text(encoding="utf-8"))
            out.append({"audio": a48, "words": words, "secs": len(a48) / SR})
            say(f"  line {i + 1}: cached, {len(a48) / SR:.1f} s")
            continue
        chunks, words, off = [], [], 0.0
        for r in pipe(ln["text"], voice=voice, speed=speed):
            a = r.audio.numpy() if hasattr(r.audio, "numpy") else np.asarray(r.audio)
            for tok in r.tokens or []:
                if tok.start_ts is None:
                    continue
                if not re.search(r"\w", tok.text):
                    if words:
                        words[-1][0] += tok.text
                    continue
                words.append([tok.text, off + tok.start_ts, off + tok.end_ts])
            off += len(a) / 24000
            chunks.append(a)
        a = np.concatenate(chunks)
        a48 = np.interp(np.arange(int(len(a) * SR / 24000)) / SR, np.arange(len(a)) / 24000, a).astype("float32")
        sf.write(str(cw), a48, SR)
        cj.write_text(json.dumps(words), encoding="utf-8")
        out.append({"audio": a48, "words": words, "secs": len(a48) / SR})
        say(f"  line {i + 1}: {len(words)} words, {len(a48) / SR:.1f} s")
    return out


def timeline(spec, voiced):
    t, lines = LEAD, []
    for ln, v in zip(spec["lines"], voiced):
        start, end = t, t + v["secs"]
        lines.append({"shot": ln["shot"], "text": ln["text"], "t_start": start, "t_end": end,
                      "words": [[w, start + s, start + e] for w, s, e in v["words"]]})
        t = end + PAUSE + EXTRA.get(ln["shot"], 0)
    total = t
    for i, l in enumerate(lines):
        l["cut"] = 0 if i == 0 else int(round((l["t_start"] - LEADIN) * FPS))
        l["start"] = int(round(l["t_start"] * FPS))
        l["end"] = int(round(l["t_end"] * FPS))
    lines[-1]["until"] = int(round(total * FPS))
    return lines, total


# ---- sound, made in code ------------------------------------------------------------------
rng = np.random.default_rng(7)


def band(x, lo=None, hi=None):
    X = np.fft.rfft(x)
    fr = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(fr)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(fr, 1)) ** 4)
    if hi:
        m *= 1 / (1 + (fr / hi) ** 4)
    return np.fft.irfft(X * m, n=len(x))


def env(n, a, r):
    e = np.ones(n)
    a, r = min(a, n), min(r, n)
    if a:
        e[:a] = np.linspace(0, 1, a)
    if r:
        e[n - r:] *= np.linspace(1, 0, r)
    return e


def put(bus, t, sig, gain=1.0):
    i0 = int(t * SR)
    if i0 >= len(bus):
        return
    i1 = min(len(bus), i0 + len(sig))
    bus[i0:i1] += sig[:i1 - i0] * gain


def noise(sec):
    return rng.standard_normal(int(sec * SR))


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def pad(bus, t0, t1, notes, gain):
    n = int((t1 - t0) * SR)
    if n <= 0:
        return
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for k, m in enumerate(notes):
        f0 = midi(m)
        s += (np.sin(2 * np.pi * f0 * tt) + 0.5 * np.sin(2 * np.pi * f0 * 1.003 * tt + k) + 0.15 * np.sin(2 * np.pi * f0 * 2 * tt)) / len(notes)
    put(bus, t0, s * env(n, int(1.2 * SR), int(1.2 * SR)), gain)


def make_sound(lines, total):
    N = int((total + 1) * SR)
    music, sfx = np.zeros(N), np.zeros(N)
    by = {l["shot"]: l for l in lines}
    T = lambda shot, k="t_start": by[shot][k] if shot in by else None

    def word_t(shot, word, frac=0.3):
        l = by.get(shot)
        if not l:
            return None
        for w, s, e in l["words"]:
            if re.sub(r"[^a-z]", "", w.lower()).startswith(word):
                return s
        return l["t_start"] + (l["t_end"] - l["t_start"]) * frac

    # music: a calm minor pad, tension from the storm, nothing but wind in the fall, a lonely figure in the jungle, a hit on the title
    calm = [(50, 53, 57, 62), (46, 50, 53, 58), (48, 52, 55, 60), (45, 49, 52, 57)]
    t, k = 0.0, 0
    storm = T("storm_window") or total
    while t < storm:
        pad(music, t, min(storm + 1, t + 4.2), calm[k % 4], 0.10)
        t += 4.0
        k += 1
    tense = [(50, 53, 56, 62), (49, 52, 56, 61)]
    t, k = storm, 0
    breakup = T("breakup") or total
    while t < breakup:
        pad(music, t, min(breakup + 0.3, t + 2.2), tense[k % 2], 0.13)
        n = int(0.5 * SR)
        for b in np.arange(t, min(breakup, t + 2.0), 0.5):   # a low pulse, like a heartbeat
            put(music, b, np.sin(2 * np.pi * 55 * np.arange(n) / SR) * np.exp(-np.arange(n) / SR * 7), 0.22)
        t += 2.0
        k += 1
    wake = T("wake") or total
    if T("wake"):
        for j, m in enumerate([74, 77, 81, 79, 77, 74]):
            n = int(1.6 * SR)
            tt = np.arange(n) / SR
            put(music, wake + 0.6 + j * 0.8, np.sin(2 * np.pi * midi(m) * tt) * np.exp(-tt * 2.4), 0.06)
        pad(music, wake, T("title") or total, (50, 57, 62), 0.05)
    if T("title"):
        ti = T("title")
        n = int(1.8 * SR)
        tt = np.arange(n) / SR
        put(music, word_t("title", "survived") or ti, np.sin(2 * np.pi * (50 - 20 * tt) * tt) * np.exp(-tt * 2.5), 0.6)
        pad(music, ti, total + 0.5, (50, 54, 57, 62), 0.12)
    # sound effects
    eng_end = breakup
    n = int(eng_end * SR)
    if n > 0:
        hum = band(noise(eng_end), 60, 400) * 0.06 + np.sin(2 * np.pi * 96 * np.arange(n) / SR) * 0.02
        put(sfx, 0, hum * env(n, SR, int(0.3 * SR)))
    rain0 = T("storm_window")
    if rain0:
        r_end = T("falling") or total
        n = int((r_end - rain0) * SR)
        put(sfx, rain0, band(noise(r_end - rain0), 1500, 7000) * env(n, int(2 * SR), int(0.5 * SR)), 0.05)
        for tt0 in (rain0 + 2.0, (T("shaking") or rain0) + 0.3):   # thunder
            m = int(3 * SR)
            put(sfx, tt0, band(noise(3), 20, 180) * np.exp(-np.arange(m) / SR * 1.2) * env(m, int(0.15 * SR), 0), 0.9)
    if T("shaking"):
        s0 = T("shaking")
        for j, dt in enumerate([0.5, 0.9, 1.4, 1.8, 2.3, 2.8]):   # bags and presents landing
            m = int(0.25 * SR)
            put(sfx, s0 + dt, band(noise(0.25), 60, 900) * np.exp(-np.arange(m) / SR * 25), 0.5)
    fl = word_t("lightning", "flash")
    if fl:
        m = int(0.6 * SR)
        put(sfx, fl, band(noise(0.6), 2000, 12000) * np.exp(-np.arange(m) / SR * 9), 0.9)
        m = int(4 * SR)
        put(sfx, fl + 0.15, band(noise(4), 20, 160) * np.exp(-np.arange(m) / SR * 0.9), 1.2)
    br = word_t("breakup", "breaks")
    if br:
        m = int(1.2 * SR)
        tt = np.arange(m) / SR
        tear = np.sin(2 * np.pi * np.cumsum(300 - 200 * tt / 1.2 + 40 * np.sin(2 * np.pi * 13 * tt)) / SR) * env(m, 800, int(0.3 * SR))
        put(sfx, br - 0.2, tear, 0.25)
        m = int(3 * SR)
        put(sfx, br, band(noise(3), 20, 300) * np.exp(-np.arange(m) / SR * 1.4), 1.4)
    if T("falling"):
        f0, f1 = T("falling"), T("falling", "t_end") + EXTRA["falling"]
        m = int((f1 - f0) * SR)
        wind = band(noise(f1 - f0), 200, 2500) * np.linspace(0.4, 1.0, m) * env(m, int(0.4 * SR), int(0.2 * SR))
        put(sfx, f0 - 0.3, wind, 0.35)
    if T("wake"):
        w0, w1 = T("wake"), (T("title") or total)
        m = int((w1 - w0) * SR)
        put(sfx, w0, band(noise(w1 - w0), 4000, 9000) * (0.5 + 0.5 * np.sin(2 * np.pi * 6 * np.arange(m) / SR)) * env(m, SR, SR), 0.025)
        for j in range(7):   # birds
            c = w0 + 0.8 + j * 0.62 + rng.uniform(0, 0.3)
            m2 = int(0.18 * SR)
            tt = np.arange(m2) / SR
            put(sfx, c, np.sin(2 * np.pi * np.cumsum(2600 + 1400 * np.sin(2 * np.pi * 9 * tt)) / SR) * env(m2, 200, 2000), 0.08)
    if T("title"):
        for wd in ("survived", "fall"):
            tw = word_t("title", wd)
            if tw:
                m = int(0.5 * SR)
                tt = np.arange(m) / SR
                put(sfx, tw - 0.15, band(noise(0.5), 400, 4000) * np.sin(np.pi * tt / 0.5) ** 2, 0.25)
    return music, sfx


def mix(lines, voiced, music, sfx, folder):
    N = len(music)
    voice = np.zeros(N)
    for l, v in zip(lines, voiced):
        put(voice, l["t_start"], v["audio"] / (np.max(np.abs(v["audio"])) + 1e-9) * 0.7)
    venv = np.convolve(np.abs(voice), np.ones(int(0.25 * SR)) / (0.25 * SR), mode="same")
    duck = 1 - 0.55 * np.clip(venv / 0.12, 0, 1)
    out = voice + music * duck * 0.8 + sfx * (0.6 + 0.4 * duck)
    out /= np.max(np.abs(out)) / 0.9
    raw = folder / "_mix_raw.wav"
    sf.write(str(raw), np.stack([out, out], 1).astype("float32"), SR)
    wav = folder / "mix.wav"
    story.normalise(raw, wav)
    return wav


def srt(lines, path):
    def ts(s):
        h, m = int(s // 3600), int(s % 3600 // 60)
        return f"{h:02d}:{m:02d}:{s % 60:06.3f}".replace(".", ",")
    out = []
    for i, l in enumerate(lines, 1):
        out += [str(i), f"{ts(l['t_start'])} --> {ts(l['t_end'] + 0.2)}", l["text"], ""]
    path.write_text("\n".join(out), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sample")
    ap.add_argument("--stills", action="store_true", help="one still per shot instead of the video")
    a = ap.parse_args()
    spec_path = Path(a.sample).resolve()
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    folder = spec_path.with_suffix("")
    folder.mkdir(exist_ok=True)
    say("1. voice")
    voiced = voice_lines(spec, folder)
    lines, total = timeline(spec, voiced)
    say(f"   {sum(len(l['words']) for l in lines)} words, {total:.1f} s")
    say("2. sound")
    music, sfx = make_sound(lines, total)
    wav = mix(lines, voiced, music, sfx, folder)
    srt(lines, folder / "subtitles.srt")
    story.ensure_app()
    shutil.copy(wav, story.APP / "public" / "opening-mix.wav")
    props = {"lines": [{**l, "words": [[w, int(round(s * FPS))] for w, s, e in l["words"]]} for l in lines], "audio": "opening-mix.wav",
             "frames": int(round(total * FPS))}
    (folder / "props.json").write_text(json.dumps(props, ensure_ascii=False, indent=1), encoding="utf-8")
    if a.stills:
        say("3. stills")
        for i, l in enumerate(props["lines"]):
            fr = int((l["start"] + l["end"]) / 2)
            story.remotion(["still", "src/index.jsx", "Opening", str(folder / f"still-{i + 1:02d}-{l['shot']}.png"), f"--props={folder / 'props.json'}", f"--frame={fr}"], timeout=600)
        say("RESULT " + json.dumps({"stills": str(folder)}))
        return
    say("3. render")
    out = folder.parent / (folder.name + ".mp4")
    story.take_lock("sample " + folder.name)
    t0 = time.time()
    try:
        story.remotion(["render", "src/index.jsx", "Opening", str(out), f"--props={folder / 'props.json'}", f"--concurrency={story.CONCURRENCY}", "--codec=h264",
                        "--crf=18", "--audio-codec=aac", "--overwrite", "--log=error"])
    finally:
        story.drop_lock()
    say(f"   rendered in {(time.time() - t0) / 60:.1f} min")
    ffmpeg = shorts.find_ffmpeg()
    sheets = story.review_sheets(ffmpeg, out, folder, total)
    motion = None
    try:
        import musicvideo
        musicvideo.FF = ffmpeg
        cuts = [{"id": l["shot"], "start": l["cut"] / FPS, "end": (props["lines"][i + 1]["cut"] if i + 1 < len(lines) else l["until"]) / FPS} for i, l in enumerate(props["lines"])]
        motion = musicvideo.motion_report(str(out), cuts, total, folder / "review")
    except Exception as ex:  # noqa: BLE001
        say(f"   (motion report skipped: {str(ex)[:160]})")
    say("RESULT " + json.dumps({"video": str(out), "seconds": round(total, 1), "sheets": [str(s) for s in sheets],
                                "motion": (motion or {}).get("summary"), "warnings": (motion or {}).get("warnings")}))


if __name__ == "__main__":
    main()
