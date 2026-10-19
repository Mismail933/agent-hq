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
import hashlib
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
import soundlib   # noqa: E402

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
# the owner (2026-10-17): the even 0.92 read was "a bit boring"; he picked the sample read faster in action and calmer in sad
# moments. A line's pace: p.speed if given, else by its scene: action > base > emotional.
ACTION = {"lightning", "breakup", "falling", "shaking", "storm_window", "planes", "injuries", "snag", "flood", "sink"}


def pace_of(ln, base):
    p = ln.get("p") or {}
    if p.get("speed"):
        return float(p["speed"])
    if ln.get("shot") in ACTION or p.get("danger"):
        return round(base + 0.06, 2)
    if float(p.get("pause", 0)) >= 0.6 or ln.get("shot") in ("seats3", "mother") or p.get("expr") in ("sad", "grim"):
        return round(base - 0.07, 2)
    return base


# ElevenLabs (2.51.0; the owner after v1: the Kokoro voice is "soooo monotone and boring, no change of tone"; he picked Owen, the
# Voice Library voice closest to The Infographics Show's narrator by voice_match). Eleven v3 acts each line from a delivery tag:
# the line's own `tag`, else one from its scene and face. Each line is cached on its own (a re-render costs no characters).
TAGS = {"storm_window": "tense", "shaking": "urgent", "lightning": "dramatic", "mother": "quietly", "breakup": "intense", "falling": "intense",
        "wake": "softly", "title": "intrigued", "planes": "urgent", "injuries": "serious", "seats3": "somber", "count": "serious",
        "why": "curious", "end": "warm", "today": "warm", "quote": "thoughtful", "map": "conversational", "rule": "serious"}
FACE_TAGS = {"sad": "sad", "scared": "nervous", "shock": "surprised", "worried": "concerned", "smile": "warm", "grim": "somber",
             "determined": "determined"}


# a scene's music mood also sets the delivery (2.53.5: the sea scenes aren't in TAGS, so most of #2 was read "conversational")
MOOD_TAGS = {"tense": "tense", "sad": "somber", "hope": "warm", "facts": "conversational", "night": "quietly"}


def tag_of(ln):
    p = ln.get("p") or {}
    if ln.get("tag") is not None:
        return ln["tag"]
    if p.get("danger"):
        return "nervous"
    return FACE_TAGS.get(p.get("expr")) or TAGS.get(ln.get("shot")) or MOOD_TAGS.get(p.get("mood")) or "conversational"


PASSAGE_CHARS = 420   # one ElevenLabs take holds a few lines, so the delivery runs on across them


def passages(spec):
    """Consecutive lines read in one take: up to PASSAGE_CHARS, a new take when the day changes and around the title."""
    L, groups, cur, n = spec["lines"], [], [], 0
    for i, ln in enumerate(L):
        p = ln.get("p") or {}
        text = ln.get("eleven_say") or ln["text"]
        if cur and (n + len(text) > PASSAGE_CHARS or p.get("day") not in (None, "") or ln["shot"] == "title" or L[cur[-1]]["shot"] == "title"
                    or float(p.get("pause_before", 0)) > 0):
            groups.append(cur)
            cur, n = [], 0
        cur.append(i)
        n += len(text)
    if cur:
        groups.append(cur)
    return groups


def _rms_blocks(a, sr, ms=10):
    w = max(1, int(sr * ms / 1000))
    n = len(a) // w
    return np.sqrt(np.mean(a[:n * w].reshape(n, w) ** 2, 1) + 1e-12), w


def quiet_point(a, sr, t0, t1):
    """The quietest 20 ms between two times (where one line ends and the next begins), as a sample index."""
    i0, i1 = max(0, int(t0 * sr)), min(len(a), int(t1 * sr))
    w = int(0.02 * sr)
    if i1 - i0 <= w:
        return (i0 + i1) // 2
    e = np.convolve(a[i0:i1] ** 2, np.ones(w), "valid")
    return i0 + int(np.argmin(e)) + w // 2


def split_take(a, sr, words, counts):
    """A take (audio + its words) -> one clip per line. Lines get their words by count (the said text minus tags, split on spaces,
    as ElevenLabs' alignment is); the cut between two lines is the quietest moment of the pause between them. The take's own start
    and end are trimmed by LOUDNESS (never by the word times: they are a little off, and cutting by them ate word starts and ends)."""
    r, w = _rms_blocks(a, sr)
    loud = np.nonzero(r > 0.035 * r.max())[0]
    t_on = max(0.0, (loud[0] * w) / sr - 0.06) if len(loud) else 0.0
    t_off = min(len(a) / sr, ((loud[-1] + 1) * w) / sr + 0.22) if len(loud) else len(a) / sr
    cuts, k = [int(t_on * sr)], 0
    for c in counts[:-1]:
        k += c
        end_prev, start_next = words[k - 1][2], words[k][1]
        lo, hi = min(end_prev, start_next) - 0.12, max(end_prev, start_next) + 0.12
        cuts.append(quiet_point(a, sr, lo, hi))
    cuts.append(int(t_off * sr))
    clips, k = [], 0
    for j, c in enumerate(counts):
        s, e = cuts[j], max(cuts[j] + 1, cuts[j + 1])
        clip = a[s:e].astype("float32").copy()
        f = min(len(clip) // 4, int(0.008 * sr))
        if f > 1:
            clip[:f] *= np.linspace(0, 1, f)
            clip[-f:] *= np.linspace(1, 0, f) if j < len(counts) - 1 else 1.0
        if j == len(counts) - 1:   # the take's end: a soft 40 ms fade on the trailing breath
            g = min(len(clip) // 3, int(0.04 * sr))
            clip[-g:] *= np.linspace(1, 0, g)
        ws = [[x, max(0.0, s0 - s / sr), max(0.0, e0 - s / sr)] for x, s0, e0 in words[k:k + c]]
        clips.append((clip, ws))
        k += c
    tail_cut = float(np.sqrt(np.mean(a[-int(0.03 * sr):] ** 2)) / (np.sqrt(np.mean(a ** 2)) + 1e-9))
    return clips, tail_cut


def voice_eleven(spec, folder):
    """ElevenLabs, a passage per take (2.51.1). The raw takes are cached (`_voice-cache/t-<key>`), so re-cutting costs nothing."""
    import hashlib
    import elevenlabs
    import control_plane as cp
    vid = spec["voice"].split(":", 1)[1]
    stab = float(spec.get("stability", 0.5))
    elevenlabs.settings.ELEVEN_V3_STABILITY = stab
    cache = folder / "_voice-cache"
    cache.mkdir(parents=True, exist_ok=True)
    L = spec["lines"]
    out, billed = [None] * len(L), 0
    for gi, g in enumerate(passages(spec)):
        parts, prev, counts = [], None, []
        for i in g:
            text, tag = L[i].get("eleven_say") or L[i]["text"], tag_of(L[i])
            parts.append((f"[{tag}] " if tag and tag != prev else "") + text)
            prev = tag
            counts.append(len(text.split()))
        said = " ".join(parts)
        key = hashlib.sha1(f"take|{vid}|{elevenlabs.model()}|{stab}|{said}".encode()).hexdigest()[:16]
        cw, cj = cache / f"t-{key}.wav", cache / f"t-{key}.json"
        if cw.exists() and cj.exists():
            a, _ = sf.read(str(cw), dtype="float32")
            words = json.loads(cj.read_text(encoding="utf-8"))
            how = "cached"
        else:
            a, words, n = elevenlabs.speak(vid, said)
            billed += n
            if not words:
                raise SystemExit(f"ElevenLabs sent no word timings for passage {gi + 1}")
            sf.write(str(cw), a, 24000)
            cj.write_text(json.dumps(words), encoding="utf-8")
            how = f"{n} characters"
        if len(words) != sum(counts):   # the alignment split words differently: share them out by position in the text
            fl = [w for i in g for w in (L[i].get("eleven_say") or L[i]["text"]).split()]
            import difflib
            norm = lambda x: re.sub(r"[^a-z0-9]", "", x.lower())
            sm = difflib.SequenceMatcher(a=[norm(w[0]) for w in words], b=[norm(x) for x in fl], autojunk=False)
            owner = [None] * len(words)
            bounds = np.cumsum([0] + counts)
            for blk in sm.get_matching_blocks():
                for d in range(blk.size):
                    owner[blk.a + d] = int(np.searchsorted(bounds, blk.b + d, side="right") - 1)
            last = 0
            for q in range(len(owner)):
                owner[q] = last if owner[q] is None else owner[q]
                last = owner[q]
            counts = [owner.count(j) for j in range(len(g))]
            if 0 in counts:
                raise SystemExit(f"Passage {gi + 1}: couldn't find every line's words in the take")
        clips, tail = split_take(a, 24000, words, counts)
        say(f"  take {gi + 1} (lines {g[0] + 1}-{g[-1] + 1}): {how}, {len(a) / 24000:.1f} s" + (f"  (ends loud: {tail:.2f})" if tail > 0.3 else ""))
        for j, i in enumerate(g):
            clip, ws = clips[j]
            a48 = np.interp(np.arange(int(len(clip) * SR / 24000)) / SR, np.arange(len(clip)) / 24000, clip).astype("float32")
            out[i] = {"audio": a48, "words": ws, "secs": len(a48) / SR, "joined": j < len(g) - 1}
    if billed:
        cp.init()
        cp.log("Calina", "voice_chars", None, {"engine": "elevenlabs", "chars": billed, "what": "story sample " + folder.name, "voice": spec["voice"]})
        say(f"  ElevenLabs characters used: {billed}")
    return out


def voice_lines(spec, folder):
    if str(spec.get("voice", "")).startswith("eleven:"):
        return voice_eleven(spec, folder)
    from kokoro import KPipeline
    voice, speed = spec.get("voice", "am_michael"), float(spec.get("speed", 0.92))
    pipe = KPipeline(lang_code=voice[0], repo_id="hexgrad/Kokoro-82M")
    out = []
    cache = folder / "_voice-cache"
    cache.mkdir(parents=True, exist_ok=True)
    import hashlib
    for i, ln in enumerate(spec["lines"]):
        spoken = ln.get("say") or ln["text"]
        sp = pace_of(ln, speed) if spec.get("paced") else speed
        key = hashlib.sha1(f"{voice}|{sp}|{spoken}".encode()).hexdigest()[:16]
        cw, cj = cache / f"{key}.wav", cache / f"{key}.json"
        if cw.exists() and cj.exists():   # the same words in the same voice: reuse (Kokoro is slow on this PC)
            a48, _ = sf.read(str(cw), dtype="float32")
            words = json.loads(cj.read_text(encoding="utf-8"))
            out.append({"audio": a48, "words": words, "secs": len(a48) / SR})
            say(f"  line {i + 1}: cached, {len(a48) / SR:.1f} s")
            continue
        chunks, words, off = [], [], 0.0
        for r in pipe(spoken, voice=voice, speed=sp):
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


def text_words(text, words):
    """The script's own words on the voice's times: the captions must show "Hans-Wilhelm", not the "Hans Vilhelm" the voice was given.
    Matching words keep their time; a stretch said differently spreads the script's words over the time it took to say."""
    import difflib
    toks = text.split()
    norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower())
    if len(toks) == len(words):
        return [[t, s, e] for t, (_, s, e) in zip(toks, words)]
    out = []
    sm = difflib.SequenceMatcher(a=[norm(w) for w, _, _ in words], b=[norm(t) for t in toks], autojunk=False)
    for op, a0, a1, b0, b1 in sm.get_opcodes():
        if op == "equal":
            out += [[toks[b0 + k], words[a0 + k][1], words[a0 + k][2]] for k in range(a1 - a0)]
        elif b1 > b0:
            s = words[a0][1] if a1 > a0 else (out[-1][2] if out else (words[0][1] if words else 0.0))
            e = words[a1 - 1][2] if a1 > a0 else (words[a0][1] if a0 < len(words) else s + 0.3 * (b1 - b0))
            step = (e - s) / (b1 - b0)
            out += [[toks[b0 + k], s + k * step, s + (k + 1) * step] for k in range(b1 - b0)]
    return out


def timeline(spec, voiced):
    t, lines = LEAD, []
    gap, k = float(spec.get("gap", PAUSE)), float(spec.get("pause_scale", 1.0))   # the owner after v1: "a bit slow"
    for ln, v in zip(spec["lines"], voiced):
        start, end = t, t + v["secs"]
        lines.append({"shot": ln["shot"], "text": ln["text"], "t_start": start, "t_end": end, "p": ln.get("p") or {},
                      "words": [[w, start + s, start + e] for w, s, e in text_words(ln["text"], v["words"])]})
        t = end + (0.0 if v.get("joined") else gap) + (EXTRA.get(ln["shot"], 0) + float((ln.get("p") or {}).get("pause", 0))) * k
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


def bed(bus, t0, t1, chords, step, gain, fade=1.6):
    """Chords laid back to back with equal-power crossfades (sin/cos), so the level never dips or swells between chords. The old
    pad-per-scene restarted at every cut and its envelopes left a dip every few seconds: the owner heard the music as "corrupted"."""
    n = int((t1 - t0) * SR)
    if n <= 0:
        return
    tt = np.arange(n) / SR
    s = np.zeros(n)
    k = 0
    for c0 in np.arange(0.0, t1 - t0, step):
        a0, a1 = max(0.0, c0 - fade / 2), min(t1 - t0, c0 + step + fade / 2)
        i0, i1 = int(a0 * SR), int(a1 * SR)
        x = tt[i0:i1]
        e = np.ones(i1 - i0)
        up, dn = (x - (c0 - fade / 2)) / fade, ((c0 + step + fade / 2) - x) / fade
        e = np.where(up < 1, np.sin(np.pi / 2 * np.clip(up, 0, 1)), e)
        e = np.where(dn < 1, e * np.sin(np.pi / 2 * np.clip(dn, 0, 1)), e)
        notes = chords[k % len(chords)]
        for j, m in enumerate(notes):
            f0 = midi(m)
            s[i0:i1] += e * (np.sin(2 * np.pi * f0 * x + j) + 0.4 * np.sin(2 * np.pi * f0 * 1.002 * x + 2 * j)) / len(notes)
        k += 1
    edge = min(n // 2, int(1.5 * SR))
    put(bus, t0, s * env(n, edge, edge), gain)


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

    if any(l["shot"] in OPENING for l in lines):   # Juliane's opening (2.49.0); another story starts with its own scenes
        # music: a calm minor pad, tension from the storm, nothing but wind in the fall, a lonely figure in the jungle, a hit on the title
        calm = [(50, 53, 57, 62), (46, 50, 53, 58), (48, 52, 55, 60), (45, 49, 52, 57)]
        storm = T("storm_window") or total
        bed(music, 0.0, storm + 1.0, calm, 4.0, 0.10)
        tense = [(50, 53, 56, 62), (49, 52, 56, 61)]
        t, k = storm, 0
        breakup = T("breakup") or total
        bed(music, storm - 0.6, breakup + 0.3, tense, 2.0, 0.12)
        while t < breakup:
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
            idx = [l["shot"] for l in lines].index("title")
            title_end = lines[idx + 1]["t_start"] - 0.2 if idx + 1 < len(lines) else total + 0.5
            pad(music, ti, title_end, (50, 54, 57, 62), 0.12)
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
            put(sfx, w0, band(noise(w1 - w0), 4000, 9000) * (0.5 + 0.5 * np.sin(2 * np.pi * 6 * np.arange(m) / SR)) * env(m, SR, SR), 0.012)
            for j in range(3):   # a few birds, far away
                c = w0 + 0.8 + j * 1.6 + rng.uniform(0, 0.4)
                m2 = int(0.18 * SR)
                tt = np.arange(m2) / SR
                put(sfx, c, band(np.sin(2 * np.pi * np.cumsum(2600 + 1400 * np.sin(2 * np.pi * 9 * tt)) / SR), None, 3500) * env(m2, 400, 3000), 0.025)
        if T("title"):
            for wd in ("survived", "fall"):
                tw = word_t("title", wd)
                if tw:
                    m = int(0.5 * SR)
                    tt = np.arange(m) / SR
                    put(sfx, tw - 0.15, band(noise(0.5), 400, 4000) * np.sin(np.pi * tt / 0.5) ** 2, 0.25)
    scene_sound(lines, total, music, sfx)
    return music, sfx


OPENING = {"aerial", "cabin", "father", "storm_window", "shaking", "lightning", "mother", "breakup", "falling", "wake", "title"}
JUNGLE = {"jungle", "wade", "seats3", "hut", "planes", "today", "close", "quote"}
OCEAN_SURFACE = {"sea_open", "hoist", "snag"}             # Storygraphics #2 (ocean.jsx): waves, no gulls
OCEAN_DEEP = {"cabin_ball", "flood", "sink", "trapped"}   # under the water: a deep rumble
MOODS = {"tense": [(48, 51, 55, 60), (46, 50, 53, 58)], "night": [(45, 48, 52, 57), (44, 47, 50, 56)], "sad": [(45, 48, 52, 57), (41, 45, 48, 53)],
         "hope": [(48, 52, 55, 60), (53, 57, 60, 65), (50, 53, 57, 62), (55, 59, 62, 67)], "facts": [(50, 53, 57, 62), (48, 52, 55, 60)]}


def mood_of(l):
    p, s = l.get("p") or {}, l["shot"]
    if p.get("mood"):
        return p["mood"]
    if p.get("time") == "night" or (s == "close" and p.get("bg") == "night"):
        return "night"
    if s in ("seats3",):
        return "sad"
    if s in ("canoe", "hospital", "today", "end") or (s == "hut" and p.get("phase") == "men"):
        return "hope"
    if s in ("count", "map", "rule", "why", "search", "item"):
        return "facts"
    return "tense"


# ───────────── real sounds and music (2.54.0) ─────────────
# The owner heard the made-up music as "corrupted" and wanted fewer, better effects. When the sound library (Sonniss, unpacked by
# soundlib) and the music (Scott Buckley, CC BY 4.0) are on this PC, scenes get recorded sounds and real tracks; anything not found
# falls back to the old made-up sound. USED lists every file a video used (credits.txt, and no sound twice in a row).
USED = []
MOOD_TRACK = {}
TRACK_POS = {}
SEED = [0]


def _rms_of(x):
    return float(np.sqrt(np.mean(x * x) + 1e-12))


def lib_pick(queries, min_s=0.0, max_s=1e9):
    if not soundlib.available():
        return None
    for q in queries:
        r = soundlib.find(q, 3, min_s, max_s, avoid=set(USED[-6:]), seed=SEED[0])
        if r:
            return r[0]
    return None


def _strongest(x, dur, k=0):
    """The k-th strongest moment of a long recording (libraries put many hits in one file), dur seconds from just before it."""
    w = int(0.02 * SR)
    n = len(x) // w
    if n < 3:
        return x[:int(dur * SR)]
    e = np.sqrt(np.mean(x[:n * w].reshape(n, w) ** 2, 1))
    on = np.maximum(0, e[1:] - e[:-1] * 1.6)   # onsets: a block much louder than the one before
    order = np.argsort(-on)
    picks = []
    for i in order:   # well-separated hits, strongest first
        if all(abs(i - j) > int(1.0 / 0.02) for j in picks):
            picks.append(i)
        if len(picks) > k:
            break
    i0 = max(0, (picks[min(k, len(picks) - 1)] + 1) * w - int(0.03 * SR))
    return x[i0:i0 + int(dur * SR)]


def real(bus, t, queries, dur=None, gain=0.3, fade_in=0.02, fade_out=0.3, loop=False, hit=False, level=0.1, min_s=0.0, max_s=1e9, k=0):
    """A recorded sound at time t: an ambience (dur, looped with crossfades if the file is shorter, at RMS `level`) or a hit (the
    strongest moment of the file, at peak 1 x gain). False when the library has nothing for it (the caller then makes its own)."""
    r = lib_pick(queries, min_s, max_s)
    if not r:
        return False
    x = soundlib.load(r["f"])
    if hit:
        seg = _strongest(x, dur or 1.5, k)
        seg = seg / (np.max(np.abs(seg)) + 1e-9)
    else:
        need = int((dur or len(x) / SR) * SR)
        if len(x) >= need:
            off = int((len(x) - need) * ((hash((r["f"], SEED[0], round(t))) % 1000) / 1000.0))
            seg = x[off:off + need].copy()
        elif loop:
            xf = int(min(1.5, len(x) / SR / 4) * SR)
            seg = x.copy()
            while len(seg) < need:   # equal-power crossfade into the next copy
                a_ = np.cos(np.linspace(0, np.pi / 2, xf)) ; b_ = np.sin(np.linspace(0, np.pi / 2, xf))
                seg = np.concatenate([seg[:-xf], seg[-xf:] * a_ + x[:xf] * b_, x[xf:]])
            seg = seg[:need]
        else:
            seg = x.copy()
        seg = seg * (level / _rms_of(seg))
    n = len(seg)
    put(bus, t, seg * env(n, int(fade_in * SR), int(fade_out * SR)), gain)
    USED.append(r["f"])
    return True


def real_music(music, r0, r1, mood):
    """A real track under a run of lines with one mood: the same track for that mood all video long, carrying on where it left off,
    equal-power fades of 2.4 s so runs crossfade. False when there is no music on this PC."""
    have = soundlib.tracks()
    if not have:
        return False
    name = MOOD_TRACK.get(mood) or soundlib.music_for(mood, SEED[0], avoid=set(MOOD_TRACK.values()))
    if not name:
        return False
    MOOD_TRACK[mood] = name
    x = soundlib.load(have[name]["file"])
    if name not in TRACK_POS:   # start where the track is first properly playing (skip a silent lead-in)
        e = np.sqrt(np.convolve(x * x, np.ones(SR // 10) / (SR // 10), "same"))
        on = np.nonzero(e > 0.12 * e.max())[0]
        TRACK_POS[name] = (on[0] / SR) if len(on) else 0.0
    fade = 2.4
    t0, t1 = max(0.0, r0 - fade / 2), min(len(music) / SR, r1 + fade / 2)
    need = int((t1 - t0) * SR)
    pos = int(TRACK_POS[name] * SR)
    seg = np.zeros(need)
    got = 0
    while got < need:   # wrap round to the start if the track runs out
        take = min(need - got, len(x) - pos)
        if take <= 0:
            pos = int(10 * SR) if len(x) > 20 * SR else 0
            continue
        seg[got:got + take] = x[pos:pos + take]
        got += take
        pos += take
    TRACK_POS[name] = pos / SR
    nf = min(need // 2, int(fade * SR))
    e = np.ones(need)
    e[:nf] = np.sin(np.linspace(0, np.pi / 2, nf))
    e[need - nf:] = np.cos(np.linspace(0, np.pi / 2, nf))
    put(music, t0, seg * (0.09 / (_rms_of(seg) + 1e-9)) * e, 1.0)
    return True


def credits(folder):
    """credits.txt beside the video: what to paste into the description."""
    out = []
    mc = soundlib.music_credit(sorted(set(MOOD_TRACK.values())))
    if mc:
        out.append(mc)
    if USED:
        out.append(soundlib.SONNISS_CREDIT + " (no credit required)")
    (folder / "credits.txt").write_text("\n".join(out) + "\n", encoding="utf-8")
    (folder / "sounds-used.json").write_text(json.dumps({"music": MOOD_TRACK, "sounds": USED}, indent=1), encoding="utf-8")
    return out


def scene_sound(lines, total, music, sfx):
    """Sound for the story scenes after the opening: the jungle (insects, birds by day, crickets at night), water, rain, planes,
    a hit when the day changes, and a music mood per scene. Everything is held under the voice later (mix)."""
    day = None
    # music: one bed per run of lines with the same mood, the runs crossfading
    runs = []
    for i, l in enumerate(lines):
        if l["shot"] in OPENING:
            continue
        t0 = max(0.0, l["t_start"] - 0.2)
        t1 = (lines[i + 1]["t_start"] - 0.2) if i + 1 < len(lines) else total
        m = mood_of(l)
        if runs and runs[-1][2] == m and abs(runs[-1][1] - t0) < 0.5:
            runs[-1][1] = t1
        else:
            runs.append([t0, t1, m])
    for r0, r1, m in runs:
        if not real_music(music, r0, r1, m):
            bed(music, max(0.0, r0 - 1.0), min(total, r1 + 1.0), MOODS[m], 6.4, 0.075 if m != "hope" else 0.085, fade=2.4)
    # the jungle's hiss: continuous over runs of jungle lines
    jr = []
    for i, l in enumerate(lines):
        p = l.get("p") or {}
        if l["shot"] in OPENING or not (l["shot"] in JUNGLE and p.get("bg", "jungle") in ("jungle", "night")):
            continue
        t0 = max(0.0, l["t_start"] - 0.2)
        t1 = (lines[i + 1]["t_start"] - 0.2) if i + 1 < len(lines) else total
        nt = p.get("time") == "night" or p.get("bg") == "night"
        if jr and jr[-1][2] == nt and abs(jr[-1][1] - t0) < 0.5:
            jr[-1][1] = t1
        else:
            jr.append([t0, t1, nt])
    for r0, r1, nt in jr:
        d = r1 - r0
        n = int(d * SR)
        tt = np.arange(n) / SR
        put(sfx, r0, band(noise(d), 4000, 9000) * (0.6 + 0.4 * np.sin(2 * np.pi * (7 if nt else 3) * tt)) * env(n, int(1.2 * SR), int(1.2 * SR)), 0.012)
    for i, l in enumerate(lines):
        if l["shot"] in OPENING:
            continue
        p = l.get("p") or {}
        t0 = max(0.0, l["t_start"] - 0.2)
        t1 = (lines[i + 1]["t_start"] - 0.2) if i + 1 < len(lines) else total
        dur = max(0.1, t1 - t0)
        n = int(dur * SR)
        tt = np.arange(n) / SR
        fade = env(n, int(0.3 * SR), int(0.3 * SR))
        night = p.get("time") == "night" or p.get("bg") == "night"
        jungle = l["shot"] in JUNGLE and p.get("bg", "jungle") in ("jungle", "night")
        if jungle:
            if night:   # crickets: short soft pulses
                m = int(0.04 * SR)
                for c in np.arange(0.2, dur - 0.1, 0.5):
                    put(sfx, t0 + c, np.sin(2 * np.pi * 4600 * np.arange(m) / SR) * env(m, 120, 600), 0.012)
            elif i % 3 == 0 and dur > 3:   # now and then one far bird (the owner: "less sound effects ... especially the birds")
                m2 = int(0.16 * SR)
                t2 = np.arange(m2) / SR
                put(sfx, t0 + dur * 0.5 + rng.uniform(-0.5, 0.5), band(np.sin(2 * np.pi * np.cumsum(2400 + 1200 * np.sin(2 * np.pi * 8 * t2)) / SR), None, 3500) * env(m2, 400, 3000), 0.015)
        if l["shot"] in OCEAN_SURFACE:   # the open sea: recorded waves, else a made-up wash
            if not real(sfx, t0, ["ocean waves", "sea waves", "waves", "water lapping"], dur, 0.5, 0.6, 0.6, loop=True, level=0.06):
                put(sfx, t0, band(noise(dur), 90, 900) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.15 * tt)) * fade, 0.03)
        if l["shot"] in OCEAN_DEEP:   # under the water: a recorded underwater drone, else a deep, slow rumble
            if not real(sfx, t0, ["underwater", "underwater ambience", "drone dark", "low rumble"], dur, 0.5, 0.6, 0.6, loop=True, level=0.06):
                put(sfx, t0, band(noise(dur), 25, 160) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.1 * tt)) * fade, 0.06)
        wt = lambda w: next((s for x, s, e in l["words"] if re.sub(r"[^a-z0-9]", "", x.lower()).startswith(w)), None)
        if l["shot"] == "snag" and wt("rips") is not None:   # metal tearing, and a thump
            if not real(sfx, wt("rips") - 0.05, ["metal tear", "metal stress", "metal creak", "metal impact"], 1.6, 0.9, hit=True):
                m = int(0.5 * SR)
                th = np.arange(m) / SR
                put(sfx, wt("rips"), band(noise(0.5), 700, 6000) * np.exp(-th * 9), 0.25)
                put(sfx, wt("rips"), band(noise(0.5), 30, 220) * np.exp(-th * 6), 0.5)
        if l["shot"] == "flood" and wt("floods") is not None:   # the water rushing in
            s0 = wt("floods")
            d = max(0.5, min(dur - (s0 - t0), 3.5))
            if not real(sfx, s0 - 0.1, ["water rush", "water pour", "water splash", "water flow", "water gush"], d, 0.7, 0.15, 0.8, level=0.12):
                put(sfx, s0, band(noise(d), 200, 2600) * env(int(d * SR), int(0.3 * SR), int(0.8 * SR)), 0.1)
        if l["shot"] == "sink":
            if not real(sfx, t0 + 0.2, ["bubbles underwater", "bubbles", "water bubble"], max(0.5, dur - 0.6), 0.5, 0.3, 0.6, loop=True, level=0.05):
                for c in np.arange(0.3, dur - 0.3, 0.45):   # bubbles
                    m2 = int(0.08 * SR)
                    t2 = np.arange(m2) / SR
                    put(sfx, t0 + c + rng.uniform(0, 0.2), np.sin(2 * np.pi * (500 + 900 * t2 / 0.08) * t2) * env(m2, 60, 600), 0.015)
            hb = wt("bottom")
            if hb is not None:   # the hit on the seabed
                if not real(sfx, hb - 0.03, ["impact heavy", "bass drop", "boom", "impact"], 2.2, 1.0, hit=True):
                    m = int(1.4 * SR)
                    th = np.arange(m) / SR
                    put(sfx, hb, band(noise(1.4), 20, 180) * np.exp(-th * 2.6), 0.9)
                    put(sfx, hb + 0.05, band(noise(1.4), 300, 2500) * np.exp(-th * 4), 0.08)
        if l["shot"] == "trapped":   # a slow drip in the dark
            if not real(sfx, t0 + 0.6, ["water drip", "drip"], max(0.5, dur - 0.8), 0.5, 0.2, 0.5, loop=True, level=0.03):
                for c in np.arange(0.6, dur - 0.2, 1.7):
                    m2 = int(0.12 * SR)
                    t2 = np.arange(m2) / SR
                    put(sfx, t0 + c, np.sin(2 * np.pi * 1700 * t2) * np.exp(-t2 * 40), 0.02)
        if l["shot"] in ("p_title", "title") and not any(x in OPENING for x in (lines[0]["shot"],)):   # a low hit on the title's big word
            tw = wt(((p.get("top_on") or "") or "survived").lower()) or t0 + 0.3
            real(sfx, tw - 0.05, ["bass drop", "boom", "impact heavy"], 3.0, 0.9, hit=True)
        if l["shot"] in ("wade", "canoe", "hut") or p.get("water"):
            put(sfx, t0, band(noise(dur), 300, 2200) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.4 * tt)) * env(n, int(0.8 * SR), int(0.8 * SR)), 0.025)
        if p.get("rain"):
            put(sfx, t0, band(noise(dur), 1500, 7000) * env(n, int(0.8 * SR), int(0.8 * SR)), 0.03)
        if l["shot"] == "planes" or any(it.get("name") in ("plane", "heli") for it in (p.get("items") or [])):
            drone = (np.sin(2 * np.pi * 110 * tt) + 0.5 * np.sin(2 * np.pi * 220 * tt)) * np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 2
            put(sfx, t0, band(drone + band(noise(dur), 80, 600) * 0.6, 60, 900), 0.07)
        if p.get("day") not in (None, "") and p.get("day") != day and real(sfx, t0 - 0.05, ["bass drop", "boom", "impact heavy"], 2.4, 0.8, hit=True, k=1):
            pass
        elif p.get("day") not in (None, "") and p.get("day") != day:
            m = int(1.6 * SR)
            th = np.arange(m) / SR
            put(sfx, t0, np.sin(2 * np.pi * (60 - 20 * th) * th) * np.exp(-th * 3), 0.3)
            put(sfx, t0 - 0.25, band(noise(0.5), 400, 4000) * np.sin(np.pi * np.arange(int(0.5 * SR)) / (0.5 * SR)) ** 2, 0.1)
        if p.get("day") not in (None,):
            day = p.get("day")


# the owner (2026-10-17): "in some places the sound effects get louder than the narrator". The music and the effects are held
# under the voice by measurement, not by hand-set volumes: while the narrator speaks, effects stay UNDER_VOICE_DB below his level
# and music MUSIC_UNDER_DB below; in the pauses neither goes above the narrator's usual level. The mix reports the loudest moment.
UNDER_VOICE_DB = -14.0   # was -9 (the owner on v3: "less sound effects or make them lower")
MUSIC_UNDER_DB = -18.0
GAP_MAX_DB = -6.0


def _avg(x, win):
    """A centred moving average in O(n) (running sum); np.convolve is O(n*win) and takes hours on a 10-minute track."""
    win = max(1, int(win))
    c = np.cumsum(np.concatenate([[0.0], x]))
    h = win // 2
    idx = np.arange(len(x))
    a, b = np.clip(idx - h, 0, len(x)), np.clip(idx - h + win, 0, len(x))
    return (c[b] - c[a]) / np.maximum(1, b - a)


def _rms(x, win):
    return np.sqrt(_avg(x * x, win) + 1e-12)


def _smooth_gain(g, win):
    """The gain a moment needs, applied early enough: the lowest gain within half a window either side (in 10 ms blocks), so a
    sudden sound is already turned down when it starts (an average let the day-change hit through at +2.3 dB), then 30 ms smoothing."""
    block = int(0.01 * SR)
    n = len(g)
    nb = -(-n // block)
    gp = np.concatenate([g, np.ones(nb * block - n)])
    gb = gp.reshape(nb, block).min(1)
    k = max(1, (win // block) // 2)
    pad = np.concatenate([np.ones(k), gb, np.ones(k)])
    m = gb.copy()
    for s in range(1, k + 1):
        m = np.minimum(m, np.minimum(pad[k - s:k - s + nb], pad[k + s:k + s + nb]))
    m = np.minimum(m, _avg(m, 3))
    return np.repeat(m, block)[:n]


def hold_under(bus, voice_rms, speaking, voice_level, under_db, gap_db, win):
    r = _rms(bus, win)
    cap = np.where(speaking, voice_rms * 10 ** (under_db / 20), voice_level * 10 ** (gap_db / 20))
    g = np.minimum(1.0, cap / r)
    return bus * _smooth_gain(g, win)


def loudness_report(voice, music, sfx, win):
    """Per 0.4 s window: the effects (and music) against the voice, in dB. The worst moments, so 'never louder' is measured."""
    hop = win
    rows = []
    vr, mr, sr_ = _rms(voice, win), _rms(music, win), _rms(sfx, win)
    level = np.percentile(vr[vr > 1e-3], 70) if np.any(vr > 1e-3) else 1e-3
    for i in range(0, len(voice), hop):
        v = vr[i]
        ref = v if v > level * 0.25 else level   # in a pause, compare with the narrator's usual level
        rows.append((i / SR, 20 * np.log10((sr_[i] + 1e-9) / ref), 20 * np.log10((mr[i] + 1e-9) / ref), v > level * 0.25))
    worst_sfx = max(rows, key=lambda r: r[1])
    worst_music = max(rows, key=lambda r: r[2])
    return {"effects_max_db_vs_voice": round(float(worst_sfx[1]), 1), "effects_max_at_s": round(worst_sfx[0], 1),
            "music_max_db_vs_voice": round(float(worst_music[2]), 1), "music_max_at_s": round(worst_music[0], 1),
            "effects_over_voice_windows": int(sum(1 for r in rows if r[1] > 0))}


def mix(lines, voiced, music, sfx, folder):
    N = len(music)
    voice = np.zeros(N)
    for l, v in zip(lines, voiced):
        put(voice, l["t_start"], v["audio"])
    voice *= 0.7 / (np.max(np.abs(voice)) + 1e-9)   # ONE gain for the narration: each line used to be levelled on its own, so inside
    #                                                  a take a soft line jumped up to a loud one's level (it didn't sound continuous)
    win = int(0.4 * SR)
    vr = _rms(voice, win)
    speaking = vr > 0.02
    level = float(np.percentile(vr[speaking], 70)) if np.any(speaking) else 0.1
    # music: a STEADY level under his usual voice (it rose in every pause and dropped when he spoke: it pumped), slow gain only
    mr = _rms(music, int(1.5 * SR))
    vs = _rms(voice, int(1.5 * SR))   # a quiet line (the mother's words) takes the music down with it, slowly
    gm = np.minimum(1.0, level * 10 ** (MUSIC_UNDER_DB / 20) / mr)
    gm = np.minimum(gm, np.where(vs > 0.02, vs * 10 ** (-12.0 / 20) / mr, 1.0))
    music = music * _avg(_smooth_gain(gm, int(1.0 * SR)), int(1.5 * SR))
    # and a guard for short notes (the wake-up melody) that a 1.5 s average doesn't see: never within 9 dB of the voice while he
    # speaks (his level over 1 s, so it doesn't follow every syllable) nor above his usual level -8 dB in a pause
    v1 = _rms(voice, int(1.0 * SR))
    music = hold_under(music, v1, v1 > 0.02, level, -9.0, -8.0, win)
    sfx = hold_under(sfx, vr, speaking, level, UNDER_VOICE_DB, GAP_MAX_DB, win)
    report = loudness_report(voice, music, sfx, win)
    out = voice + music + sfx
    out /= np.max(np.abs(out)) / 0.9
    raw = folder / "_mix_raw.wav"
    sf.write(str(raw), np.stack([out, out], 1).astype("float32"), SR)
    wav = folder / "mix.wav"
    story.normalise(raw, wav)
    (folder / "loudness.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    say(f"   sound: effects at most {report['effects_max_db_vs_voice']} dB vs the voice (at {report['effects_max_at_s']} s), "
        f"music at most {report['music_max_db_vs_voice']} dB; windows with effects over the voice: {report['effects_over_voice_windows']}")
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
    ap.add_argument("--prep", action="store_true", help="voice, sound and props only (then a quick preview can be rendered)")
    a = ap.parse_args()
    spec_path = Path(a.sample).resolve()
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    folder = spec_path.with_suffix("")
    folder.mkdir(exist_ok=True)
    story.take_lock("sample " + folder.name)   # one heavy job at a time on this PC, from the first word voiced to the last frame
    try:
        run(a, spec, folder)
    finally:
        story.drop_lock()


def run(a, spec, folder):
    say("1. voice")
    voiced = voice_lines(spec, folder)
    lines, total = timeline(spec, voiced)
    say(f"   {sum(len(l['words']) for l in lines)} words, {total:.1f} s")
    say("2. sound")
    SEED[0] = int(hashlib.md5(str(spec.get("title", folder.name)).encode()).hexdigest()[:6], 16)
    music, sfx = make_sound(lines, total)
    for c in credits(folder):
        say("   " + c)
    wav = mix(lines, voiced, music, sfx, folder)
    srt(lines, folder / "subtitles.srt")
    story.ensure_app()
    shutil.copy(wav, story.APP / "public" / "opening-mix.wav")
    props = {"lines": [{**l, "words": [[w, int(round(s * FPS))] for w, s, e in l["words"]]} for l in lines], "audio": "opening-mix.wav",
             "frames": int(round(total * FPS))}
    (folder / "props.json").write_text(json.dumps(props, ensure_ascii=False, indent=1), encoding="utf-8")
    if a.prep:
        say("RESULT " + json.dumps({"props": str(folder / "props.json"), "seconds": round(total, 1)}))
        return
    if a.stills:
        say("3. stills")
        for i, l in enumerate(props["lines"]):
            fr = int((l["start"] + l["end"]) / 2)
            story.remotion(["still", "src/index.jsx", "Opening", str(folder / f"still-{i + 1:02d}-{l['shot']}.png"), f"--props={folder / 'props.json'}", f"--frame={fr}"], timeout=600)
        say("RESULT " + json.dumps({"stills": str(folder)}))
        return
    say("3. render")
    out = folder.parent / (folder.name + ".mp4")
    t0 = time.time()
    # the picture without sound, then our own measured mix added with ffmpeg: Remotion's audio step crashed on a 10-minute track
    # (its ffmpeg exited -2 after 24 minutes of frames, 2026-10-17)
    silent = folder / "_picture.mp4"
    story.remotion(["render", "src/index.jsx", "Opening", str(silent), f"--props={folder / 'props.json'}", f"--concurrency={story.CONCURRENCY}", "--codec=h264",
                    "--crf=18", "--muted", "--overwrite", "--log=error"])
    ff = shorts.find_ffmpeg()
    r = subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(silent), "-i", str(wav), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                        "-shortest", "-movflags", "+faststart", str(out)], capture_output=True, text=True)
    if r.returncode != 0 or not out.exists():
        raise story.Blocked("adding the sound failed: " + (r.stderr or "")[-400:])
    silent.unlink(missing_ok=True)
    say(f"   rendered in {(time.time() - t0) / 60:.1f} min")
    ffmpeg = shorts.find_ffmpeg()
    sheets = story.review_sheets(ffmpeg, out, folder, total)
    motion = None
    try:
        import musicvideo
        musicvideo.FF = ffmpeg
        cuts = [{"id": l["shot"], "start": l["cut"] / FPS, "end": (props["lines"][i + 1]["cut"] if i + 1 < len(lines) else l["until"]) / FPS} for i, l in enumerate(props["lines"])]
        motion = musicvideo.motion_report(str(out), cuts, total, folder / "review", fps=FPS)
    except Exception as ex:  # noqa: BLE001
        say(f"   (motion report skipped: {str(ex)[:160]})")
    try:
        loud = json.loads((folder / "loudness.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        loud = None
    say("RESULT " + json.dumps({"video": str(out), "seconds": round(total, 1), "sheets": [str(s) for s in sheets], "sound": loud,
                                "motion": (motion or {}).get("summary"), "warnings": (motion or {}).get("warnings")}))


if __name__ == "__main__":
    main()
