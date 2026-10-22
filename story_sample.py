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
    limit = int(spec.get("passage_chars", PASSAGE_CHARS))   # 2.66.0: a whole opening in one take (one continuous read)
    for i, ln in enumerate(L):
        p = ln.get("p") or {}
        text = ln.get("eleven_say") or ln["text"]
        if cur and (n + len(text) > limit or p.get("day") not in (None, "") or ln["shot"] == "title" or L[cur[-1]]["shot"] == "title"
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


CHATTER_TRIES = 3       # a Chatterbox take that drops or invents words is made again with another seed, the best of these kept
CHATTER_GOOD = 0.92     # share of the line's words Whisper must hear in a take to keep it without a retake
CHATTER_LEVEL = 0.1     # every take's speech brought to this RMS (~ -20 dBFS), so separately made lines sound equally loud


def _trim(a, sr, thr_db=-40.0, pad=0.05):
    """A take without its silent ends (by loudness on 10 ms blocks, never by word times). Returns (audio, seconds cut at the start)."""
    blk = max(1, sr // 100)
    n = len(a) // blk
    if n < 3:
        return a, 0.0
    r = np.sqrt((a[:n * blk].reshape(n, blk) ** 2).mean(axis=1) + 1e-12)
    on = np.where(20 * np.log10(r / (r.max() + 1e-12)) > thr_db)[0]
    if not len(on):
        return a, 0.0
    i0 = max(0, on[0] * blk - int(pad * sr))
    i1 = min(len(a), (on[-1] + 1) * blk + int(pad * sr))
    return a[i0:i1], i0 / sr


def _level(a, sr):
    blk = max(1, sr // 100)
    n = len(a) // blk
    if n < 3:
        return a
    r = np.sqrt((a[:n * blk].reshape(n, blk) ** 2).mean(axis=1) + 1e-12)
    act = r[20 * np.log10(r / (r.max() + 1e-12)) > -30]
    rms = float(np.sqrt((act ** 2).mean())) if len(act) else float(r.mean())
    g = CHATTER_LEVEL / max(rms, 1e-6)
    return np.clip(a * min(g, 8.0), -0.98, 0.98).astype("float32")


_WHISPER = [None]


def _heard(a, sr):
    """Whisper's words with their times (faster-whisper base.en, as review_tools hears a finished video)."""
    from faster_whisper import WhisperModel
    if _WHISPER[0] is None:
        _WHISPER[0] = WhisperModel("base.en", device="cpu", compute_type="int8")
    a16 = np.interp(np.arange(int(len(a) * 16000 / sr)) / 16000, np.arange(len(a)) / sr, a).astype("float32")
    segs, _ = _WHISPER[0].transcribe(a16, word_timestamps=True, vad_filter=False, condition_on_previous_text=False, language="en")
    return [[w.word.strip(), float(w.start), float(w.end)] for sg in segs for w in (sg.words or []) if w.word.strip()]


NUM_WORDS = {"zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen",
             "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy",
             "eighty", "ninety", "hundred", "thousand", "million", "point"}


def _hear_files(files):
    """Whisper on each take in ITS OWN process (2.65.0): with faster-whisper loaded here, Chatterbox's next load crashed (0xC0000005)
    on this 8 GB PC. Returns each file's heard words."""
    if not files:
        return []
    lst = Path(files[0]).parent / "_hear.json"
    lst.write_text(json.dumps([str(f) for f in files]), encoding="utf-8")
    subprocess.run([sys.executable, str(Path(__file__).resolve()), "--hear", str(lst)], check=True, capture_output=True,
                   creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    lst.unlink(missing_ok=True)
    return [json.loads(Path(str(f) + ".heard.json").read_text(encoding="utf-8")) for f in files]


def _take_score(spoken, heard):
    """(share of the line's words heard, words heard that aren't in the line). Numbers are left out of both sides: Whisper writes
    "1918" where the line says "nineteen eighteen", which isn't a slip (it made 3 false retakes on the Megalodon opening)."""
    import difflib
    us = lambda w: re.sub(r"tre(s?)$", r"ter\1", re.sub(r"our(s?)$", r"or\1", w))   # metres/meters, colour/color: Whisper spells American
    tok = lambda t: [us(w) for w in re.findall(r"[a-z']+", t.lower()) if w and w not in NUM_WORDS]
    want, got = tok(spoken), tok(" ".join(w for w, _, _ in heard))
    if not want:
        return 1.0, 0
    sm = difflib.SequenceMatcher(None, want, got, autojunk=False)
    hit = sum(b.size for b in sm.get_matching_blocks())
    extra = sum(j2 - j1 for op, i1, i2, j1, j2 in sm.get_opcodes() if op == "insert")
    return hit / len(want), extra


def _tempo(a, sr, f):
    """The take a little faster or slower (ffmpeg atempo, pitch kept): the 'paced' read for a voice that has no speed setting."""
    import tempfile
    ff = shorts.find_ffmpeg()
    with tempfile.TemporaryDirectory() as tmp:
        i, o = Path(tmp) / "i.wav", Path(tmp) / "o.wav"
        sf.write(str(i), a, sr)
        subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(i), "-filter:a", f"atempo={f:.4f}", str(o)], check=True)
        b, _ = sf.read(str(o), dtype="float32")
    return b


# 2.65.0 (the owner on the 2.64.0 opening: "Why is it rushing", then "Can we play with the tone?"). Measured: Chatterbox read the
# lines at ~174 words a minute (short ones up to 194; the Kokoro opening 148) with the old 0.35 s gaps made for Kokoro. Now every
# line is fitted to a storytelling pace, sentences get a breath inside a line, short dramatic lines a beat after them. The style's
# numbers are the defaults; rules voice.story_* (Atlas) and the video's sound.voice (Tarek, or a sample's spec) override them.
TONES = {
    # 2.66.0 (the owner after all five openings: "this sound boring"): measured 6 reference narrators from their own caption timing
    # (The Infographics Show, RealLifeLore and Brew on the same seafloor-survivor story, MrBallen, Zack D. Films, LEMMiNO): all talk
    # 191-264 wpm inside phrases and 157-203 overall, with 0.3-7 pauses of a second or more a minute; ours stopped 12-18 times a
    # minute (114-134 overall). "story" = the natural pace of the take (no fitting), lines run on, a long pause only on the beats.
    "story": {"wpm": 0, "gap": 0.15, "sentence_pause": 0.0, "comma_pause": 0.0, "beat_pause": 0.0, "temperature": 0.8,
              "ref_speed": 0.95, "pace_spread": 0.0, "max_pause": 0.45, "min_wpm": 150},
    "calm": {"wpm": 135, "gap": 0.85, "sentence_pause": 0.45, "comma_pause": 0.12, "beat_pause": 0.7, "temperature": 0.7,
             "ref_speed": 0.85, "pace_spread": 0.5, "max_pause": 0.0},
    "between": {"wpm": 148, "gap": 0.65, "sentence_pause": 0.32, "comma_pause": 0.08, "beat_pause": 0.5, "temperature": 0.8,
                "ref_speed": 0.9, "pace_spread": 1.0, "max_pause": 0.0},
    "dramatic": {"wpm": 152, "gap": 0.55, "sentence_pause": 0.38, "comma_pause": 0.05, "beat_pause": 1.0, "temperature": 0.9,
                 "ref_speed": 0.9, "pace_spread": 1.8, "max_pause": 0.0},
}
TEMPO_MIN = 0.78   # the most a take is slowed (atempo); a take that would need more is made again (another seed reads at another pace)
TONE_RULES = {"wpm": "voice.story_wpm", "gap": "voice.story_gap", "sentence_pause": "voice.story_sentence_pause",
              "temperature": "voice.story_temperature"}
BEAT_WORDS = 6   # a line whose last sentence is this short is a dramatic beat ("Then another.")


def _rule(key, default):
    try:
        import rules
        return rules.get(key)
    except Exception:  # noqa: BLE001  (no office database: the style's numbers)
        return default


def tone_of(spec):
    """The voice's settings for this video: the style's numbers <- the rules <- the video's own sound.voice."""
    own = (spec.get("sound") or {}).get("voice") or {}
    style = own.get("style") or _rule("voice.story_style", "between") or "between"
    t = dict(TONES.get(style, TONES["between"]), style=style)
    for k, r in TONE_RULES.items():
        v = _rule(r, 0)
        if v:
            t[k] = float(v)
    for k, v in own.items():
        if k in t and k != "style" and isinstance(v, (int, float)):
            t[k] = float(v)
    return t


def _quiet_at(a, sr, t0, t1):
    """The quietest 20 ms point between t0 and t1 (seconds): where a pause goes in without cutting a sound."""
    i0, i1 = max(0, int(t0 * sr)), min(len(a), int(t1 * sr))
    if i1 - i0 < int(0.02 * sr):
        return (t0 + t1) / 2
    w = int(0.02 * sr)
    e = np.convolve(a[i0:i1] ** 2, np.ones(w) / w, mode="valid")
    return (i0 + int(np.argmin(e)) + w // 2) / sr


def _breathe(a, sr, words, sentence, comma):
    """Silence added after each sentence (and a little after commas) inside a take, at the quietest point between the words;
    every later word moves with it. Returns (audio, words)."""
    if not words or (sentence <= 0 and comma <= 0):
        return a, words
    cuts = []
    for k in range(len(words) - 1):
        w = words[k][0].strip()
        add = sentence if w.endswith((".", "!", "?")) else comma if w.endswith((",", ";", ":")) else 0
        if add > 0:
            cuts.append((_quiet_at(a, sr, words[k][2] - 0.03, words[k + 1][1] + 0.03), add))
    if not cuts:
        return a, words
    parts, last, shift, out = [], 0, [], []
    for t, add in cuts:
        i = int(t * sr)
        parts += [a[last:i], np.zeros(int(add * sr), dtype=a.dtype)]
        last = i
        shift.append((t, add))
    parts.append(a[last:])
    for w, s0, e0 in words:
        d = sum(add for t, add in shift if t <= s0)
        out.append([w, s0 + d, e0 + d])
    return np.concatenate(parts), out


def _tighten(a, sr, words, max_pause):
    """Every silence inside a take longer than max_pause shortened to it (the middle is cut; an editor's 'tighten'), later words moved
    up. Eleven v3 in its creative mode held 1-2 s after almost every sentence (14.5 long pauses a minute; the references 0.3-7)."""
    if max_pause <= 0 or len(a) < sr:
        return a, words
    blk = max(1, sr // 100)
    n = len(a) // blk
    r = np.sqrt((a[:n * blk].reshape(n, blk) ** 2).mean(axis=1) + 1e-12)
    quiet = 20 * np.log10(r / (r.max() + 1e-12)) < -38
    keep, cuts, i = [], [], 0
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]:
                j += 1
            dur = (j - i) * blk / sr
            if i == 0 or j == n:   # a line's own ends: at most half the pause each (the gap between lines makes up the rest)
                if dur > max_pause / 2:
                    cut = int((dur - max_pause / 2) * sr)
                    cuts.append((0, cut) if i == 0 else (n * blk - cut, cut))
            elif dur > max_pause:
                cut = int((dur - max_pause) * sr)
                mid = (i * blk + j * blk) // 2
                cuts.append((mid - cut // 2, cut))
            i = j
        else:
            i += 1
    if not cuts:
        return a, words
    parts, last = [], 0
    for at, cut in cuts:
        parts.append(a[last:at])
        last = at + cut
    parts.append(a[last:])
    out = []
    for w, s0, e0 in words:
        d = sum(c for at, c in cuts if at + c <= s0 * sr + blk) / sr
        out.append([w, max(0.0, s0 - d), max(0.0, e0 - d)])
    return np.concatenate(parts), out


def _is_beat(text):
    last = re.split(r"(?<=[.!?])\s+", text.strip())[-1]
    return len(re.findall(r"[A-Za-z0-9']+", last)) <= BEAT_WORDS


def voice_chatterbox(spec, folder):
    """2.64.0 (the owner's pick 2026-10-21: "go with chatter box am micheal"): Chatterbox Nano (MIT, free, on this PC), the voice copied
    from a clip of our own Kokoro voice (chatterbox_voice.ensure_ref). One take per line, cached in _voice-cache/c-<key>.wav/.json;
    Whisper hears each new take for its word times, and a take that drops or invents words is made again with another seed
    (CHATTER_TRIES), the best kept. 'paced' = pace_of as a small tempo change of the finished take (spec 'speed' = the base tempo)."""
    import hashlib
    import chatterbox_voice as cv
    ref_voice = spec["voice"].split(":", 1)[1] or "am_michael"
    tone = tone_of(spec)
    spec["_tone"] = tone
    say(f"  tone: {json.dumps(tone)}")
    ref = cv.ref_path(ref_voice, tone["ref_speed"])
    if not ref.exists():   # made in its own process: Kokoro kept in this one left too little memory for Chatterbox (it crashed)
        subprocess.run([sys.executable, str(ROOT / "chatterbox_voice.py"), "ref", ref_voice, str(tone["ref_speed"])], check=True,
                       capture_output=True, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    refsig = hashlib.sha1(ref.read_bytes()).hexdigest()[:8]
    temp = round(float(tone["temperature"]), 2)
    tries = int(spec.get("retakes", CHATTER_TRIES))
    cache = folder / "_voice-cache"
    cache.mkdir(parents=True, exist_ok=True)
    L = spec["lines"]
    spoken = [ln.get("say") or ln["text"] for ln in L]
    keys = [hashlib.sha1(f"chatterbox|{cv.MODEL_TAG}|{ref_voice}|{refsig}|{t}".encode() + (f"|t{temp}".encode() if temp != 0.8 else b"")).hexdigest()[:16]
            for t in spoken]
    have = lambda i: (cache / f"c-{keys[i]}.wav").exists() and (cache / f"c-{keys[i]}.json").exists()
    nwords = [_words_eq(ln["text"]) for ln in L]
    want_wpm = [tone["wpm"] * (1 + (pace_of(ln, 1.0) - 1) * tone["pace_spread"]) for ln in L]
    too_fast = lambda i, secs: 60.0 * nwords[i] / max(0.5, secs) > want_wpm[i] / TEMPO_MIN + 4   # can't be slowed enough cleanly
    def stale(i):   # cached before 2.65.0's pace check and too fast to fit: once more
        try:
            m = json.loads((cache / f"c-{keys[i]}.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return True
        if "fast" in m:
            return False
        secs = sf.info(str(cache / f"c-{keys[i]}.wav")).duration
        return too_fast(i, secs)
    todo = [i for i in range(len(L)) if not have(i) or stale(i)]
    if todo:
        say(f"  Chatterbox: {len(todo)} of {len(L)} lines to voice (~{sum(len(spoken[i].split()) for i in todo) / 150 * 5:.0f} min on this PC)")
        raw = cache / "_chatter-raw"
        best = {}
        for attempt in range(tries):
            left = [i for i in todo if i not in best or best[i]["score"] < CHATTER_GOOD or best[i]["extra"] > 2 or best[i]["fast"]]
            if not left:
                break
            if attempt:
                say(f"  retake {attempt}: {len(left)} line(s) dropped or added words, or too fast to slow down cleanly")
            jobs = [{"key": f"{keys[i]}-{attempt}", "text": spoken[i], "seed": 1009 * attempt + i, "temperature": temp} for i in left]
            need = [j for j in jobs if not (raw / f"{j['key']}.wav").exists()]   # a take made before a stop is kept
            if need:
                _WHISPER[0] = None   # 8 GB PC: Whisper out of memory while Chatterbox (~2.5 GB) loads (a retake died silently)
                import gc
                gc.collect()
                try:
                    cv.speak(need, raw, ref, say=say)
                except RuntimeError as ex:
                    say(f"  Chatterbox stopped ({str(ex)[:160]}); once more")
                    cv.speak([j for j in need if not (raw / f"{j['key']}.wav").exists()], raw, ref, say=say)
            takes = {}
            for i, j in zip(left, jobs):
                a, sr = sf.read(str(raw / f"{j['key']}.wav"), dtype="float32")
                a = a.mean(axis=1) if a.ndim > 1 else a
                a, _ = _trim(a, sr)
                a = _level(a, sr)
                proc = raw / f"{j['key']}.proc.wav"
                sf.write(str(proc), a, sr)
                takes[i] = (a, sr, proc)
            heard_all = dict(zip(takes, _hear_files([takes[i][2] for i in takes])))
            for i in takes:
                a, sr, _ = takes[i]
                heard = heard_all[i]
                score, extra = _take_score(spoken[i], heard)
                fast = too_fast(i, len(a) / sr)
                rank = score - 0.03 * extra - (0.05 if fast else 0)
                if i not in best or rank > best[i]["rank"]:
                    best[i] = {"audio": a, "sr": sr, "words": heard, "score": score, "extra": extra, "try": attempt, "fast": fast, "rank": rank}
        for i in todo:
            b = best[i]
            a48 = np.interp(np.arange(int(len(b["audio"]) * SR / b["sr"])) / SR, np.arange(len(b["audio"])) / b["sr"], b["audio"]).astype("float32")
            sf.write(str(cache / f"c-{keys[i]}.wav"), a48, SR)
            (cache / f"c-{keys[i]}.json").write_text(json.dumps({"words": b["words"], "heard": round(b["score"], 3), "extra": b["extra"],
                                                                 "try": b["try"], "fast": b["fast"]}), encoding="utf-8")
            if b["score"] < CHATTER_GOOD:
                say(f"  line {i + 1}: best take heard {b['score']:.0%} of its words: listen to it")
        shutil.rmtree(raw, ignore_errors=True)
    out = []
    for i, ln in enumerate(L):
        a48, _ = sf.read(str(cache / f"c-{keys[i]}.wav"), dtype="float32")
        meta = json.loads((cache / f"c-{keys[i]}.json").read_text(encoding="utf-8"))
        v, own, f = _tone_line(ln, a48, meta["words"], tone)
        out.append(v)
        say(f"  line {i + 1}: {v['secs']:.1f} s, {own:.0f} -> {own * f:.0f} wpm, heard {meta['heard']:.0%}"
            + (f" (take {meta['try'] + 1})" if meta.get("try") else "") + (f", beat +{v['after']:.2f} s" if v["after"] else ""))
    return out


def _syllables(text):
    """Syllables in a line, roughly (vowel groups per word, a silent final e dropped; a number counts per digit)."""
    n = 0
    for w in re.findall(r"[A-Za-z']+|\d+", text.lower()):
        if w.isdigit():
            n += 2 * len(w)
            continue
        g = len(re.findall(r"[aeiouy]+", w))
        if w.endswith("e") and not w.endswith(("le", "ee", "ye")) and g > 1:
            g -= 1
        n += max(1, g)
    return n


def _words_eq(text):
    """The line's length in average English words (1.45 syllables each): "They race back to port" is 5 words but short ones, so a pace
    counted in plain words called a normal read 'rushed' (2.65.3: both ElevenLabs voices measured 230-290 'wpm' on that line)."""
    return _syllables(text) / 1.45


def _tone_line(ln, a48, words, tone):
    """One voiced line in the video's tone: fitted to its pace, a breath after each sentence, a beat after a short dramatic line.
    Returns (voiced line, its own wpm, the tempo factor used)."""
    n = _words_eq(ln["text"])
    own = 60.0 * n / max(0.5, len(a48) / SR)   # the take's own pace (in average-length words)
    want = tone["wpm"] * (1 + (pace_of(ln, 1.0) - 1) * tone["pace_spread"])   # action faster, sad/long-pause lines slower
    f = max(TEMPO_MIN, min(TEMPO_MAX, want / own)) if want > 0 else 1.0   # atempo beyond these sounds processed; 0 = the take's own pace
    if want <= 0 and tone.get("min_wpm") and own < tone["min_wpm"]:   # story: a line read slower than this is lifted a little
        f = min(1.15, tone["min_wpm"] / own)
    if abs(f - 1.0) > 0.01:
        a48 = _tempo(a48, SR, f)
        words = [[w, s0 / f, e0 / f] for w, s0, e0 in words]
    a48, words = _tighten(a48, SR, words, float((ln.get("p") or {}).get("max_pause", tone.get("max_pause", 0.0))))   # a line may keep a longer pause
    a48, words = _breathe(a48, SR, words, tone["sentence_pause"], tone["comma_pause"])
    after = tone["beat_pause"] if _is_beat(ln["text"]) else 0.0
    return ({"audio": a48, "words": words or [[ln["text"].split()[0], 0.0, len(a48) / SR]], "secs": len(a48) / SR, "after": after},
            own, f)


def _line_files(spec, folder, out):
    """A line's own take made separately (2.65.3): line "voice_file" = a wav next to the spec (+ the same name .json = its words
    [[word, start, end]]) used instead of that line's voice, e.g. one line re-read calmer without paying for its whole passage again."""
    for i, ln in enumerate(spec["lines"]):
        vf = ln.get("voice_file")
        if not vf:
            continue
        f = (folder.parent / vf).resolve()
        a, sr = sf.read(str(f), dtype="float32")
        a = a.mean(axis=1) if a.ndim > 1 else a
        a48 = np.interp(np.arange(int(len(a) * SR / sr)) / SR, np.arange(len(a)) / sr, a).astype("float32") if sr != SR else a
        words = json.loads(f.with_suffix(".json").read_text(encoding="utf-8"))
        out[i] = {"audio": a48, "words": words, "secs": len(a48) / SR, "joined": False}
        if i:
            out[i - 1]["joined"] = False
        say(f"  line {i + 1}: its own take {f.name} ({len(a48) / SR:.1f} s)")
    return out


def voice_lines(spec, folder):
    if str(spec.get("voice", "")).startswith("eleven:"):
        out = _line_files(spec, folder, voice_eleven(spec, folder))
        if (spec.get("sound") or {}).get("voice"):   # 2.65.2: the same tone as the Chatterbox voice (the owner compares them by ear)
            tone = tone_of(spec)
            spec["_tone"] = tone
            say(f"  tone: {json.dumps(tone)}")
            for i, ln in enumerate(spec["lines"]):
                v, own, f = _tone_line(ln, out[i]["audio"], out[i]["words"], tone)
                out[i] = v
                say(f"  line {i + 1}: {v['secs']:.1f} s, {own:.0f} -> {own * f:.0f} wpm" + (f", beat +{v['after']:.2f} s" if v["after"] else ""))
        return out
    if str(spec.get("voice", "")).startswith("chatterbox:"):
        return voice_chatterbox(spec, folder)
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


REVEAL_HOLD = 1.5   # 2.66.3: a picture that pops on one of the line's last words stays this long before the cut (spec "reveal_hold")
HOLD_OVERLAP = 0.9  # 2.66.5: up to this much of that hold is the PICTURE staying while the next line already speaks (the reference
                    # narrators never stop for a picture: holding the voice made 12-15 long pauses a minute again)
TEMPO_MAX = 1.15    # the most a dragging line is sped up when the pace is fitted


def _triggers(p):
    """The spoken words a scene's pictures pop on (labels' "on" and every *_on), normalised."""
    out = [x.get("on") for x in p.get("labels") or [] if isinstance(x, dict)] + [v for k, v in p.items() if k.endswith("_on")]
    return {re.sub(r"[^a-z0-9]", "", str(w).lower()) for w in out if isinstance(w, str) and w}


def _late_pop(line_words, p):
    """When this line's last picture pops (seconds, the last spoken match of a trigger word), or None."""
    trig = _triggers(p)
    hits = [s0 for w, s0, e0 in line_words if re.sub(r"[^a-z0-9]", "", w.lower()) in trig]
    return max(hits) if hits else None


def timeline(spec, voiced):
    t, lines = LEAD, []
    hold = float(spec.get("reveal_hold", REVEAL_HOLD))
    gap, k = float(spec.get("gap", PAUSE)), float(spec.get("pause_scale", 1.0))   # the owner after v1: "a bit slow"
    if spec.get("_tone"):   # 2.65.0: the Chatterbox voice's own pauses (the old gap/pause_scale were set for Kokoro)
        gap, k = float(spec["_tone"]["gap"]), 1.0
    for ln, v in zip(spec["lines"], voiced):
        start, end = t, t + v["secs"]
        lines.append({"shot": ln["shot"], "text": ln["text"], "t_start": start, "t_end": end, "p": ln.get("p") or {},
                      "words": [[w, start + s, start + e] for w, s, e in text_words(ln["text"], v["words"])]})
        t = end + (0.0 if v.get("joined") else gap) + (EXTRA.get(ln["shot"], 0) + float((ln.get("p") or {}).get("pause", 0))) * k + v.get("after", 0.0)
        pop = _late_pop(lines[-1]["words"], lines[-1]["p"])   # the owner: the "as long as your hand" tooth went by too fast
        if pop is not None and (t - LEADIN) - pop < hold:
            need = pop + hold - (t - LEADIN)
            lines[-1]["hold_until"] = pop + hold   # the next cut waits for this (into the next line by up to HOLD_OVERLAP)
            t += max(0.0, need - HOLD_OVERLAP)
    total = t
    for i, l in enumerate(lines):
        cut_t = l["t_start"] - LEADIN
        if i and lines[i - 1].get("hold_until"):
            cut_t = min(max(cut_t, lines[i - 1]["hold_until"]), l["t_start"] + HOLD_OVERLAP)
        l["cut"] = 0 if i == 0 else int(round(cut_t * FPS))
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
    music, sfx = np.zeros(N, dtype=np.float32), np.zeros(N, dtype=np.float32)   # float32: a 20-minute track is 230 MB a bus, not 460
    AMB[0] = np.zeros(N, dtype=np.float32)   # the calm beds (2.55.2), mixed at a steady level under the narrator
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
OCEAN_SURFACE = {"sea_open", "hoist", "snag", "m_boat", "m_flee"}         # Storygraphics #2 (ocean.jsx) and #3 (meg.jsx): waves, no gulls
OCEAN_DEEP = {"cabin_ball", "flood", "sink", "trapped", "m_rise", "m_take"}   # under the water: a deep rumble
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


# ───────────── real sounds and music (2.55.0) ─────────────
# The owner heard the made-up music as "corrupted" and wanted fewer, better effects. When the sound library (Sonniss, unpacked by
# soundlib) and the music (Scott Buckley, CC BY 4.0) are on this PC, scenes get recorded sounds and real tracks; anything not found
# falls back to the old made-up sound. USED lists every file a video used (credits.txt, and no sound twice in a row).
USED = []
NEED = [None]      # what the next placed sound must sound like, in plain words (Tarek checks it with Earshot), set by its caller
PLACED = []        # every recorded sound placed: {t, dur, role bed|accent, for (what it was searched for), file} (2.56.0: the sound agent's map)
SOUND = {}         # the spec's "sound" settings (2.56.0): the sound agent's fixes, read by scene_sound and mix
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


KEEP = {}


def real(bus, t, queries, dur=None, gain=0.3, fade_in=0.02, fade_out=0.3, loop=False, hit=False, level=0.1, min_s=0.0, max_s=1e9, k=0,
         keep=False, band_hz=None):
    """A recorded sound at time t: an ambience (dur, looped with crossfades if the file is shorter, at RMS `level`) or a hit (the
    strongest moment of the file, at peak 1 x gain). keep: the same recording every time for these queries (a place sounds the
    same all video); band_hz (lo, hi): soften it (no hiss on top, no rumble below). False when the library has nothing for it."""
    key = tuple(queries)
    r = KEEP.get(key) if keep else None
    r = r or lib_pick(queries, min_s, max_s)
    if not r:
        return False
    if keep:
        KEEP[key] = r
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
        if band_hz:
            seg = band(seg, band_hz[0], band_hz[1])
        seg = seg * (level / _rms_of(seg))
    n = len(seg)
    put(bus, t, seg * env(n, int(fade_in * SR), int(fade_out * SR)), gain)
    USED.append(r["f"])
    PLACED.append({"t": round(t, 2), "dur": round(n / SR, 2), "role": "accent" if hit else "bed", "for": queries[0], "file": r["f"],
                   "need": NEED[0] or queries[0]})
    NEED[0] = None
    return True


def real_music(music, r0, r1, mood):
    """A real track under a run of lines with one mood: the same track for that mood all video long, carrying on where it left off,
    equal-power fades of 2.4 s so runs crossfade. False when there is no music on this PC."""
    have = soundlib.tracks()
    if not have:
        return False
    pick = (SOUND.get("music") or {}).get(mood)   # 2.61.0: the spec (or Tarek) may choose the track for a mood
    name = MOOD_TRACK.get(mood) or (pick if pick in have else None) or soundlib.music_for(mood, SEED[0], avoid=set(MOOD_TRACK.values()))
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


PHOTO_CREDITS = []


def install_photos(spec, folder):
    """Real pictures of real events (2.60.0): every line's p.photo.src ("photos/<file>") is copied from the project's photos/ folder
    (content/project-N/photos/, beside samples/) into the story app's public/photos/, and its credit (photos/credits.json, written when
    the picture was chosen: public domain or CC BY only) goes into credits.txt."""
    PHOTO_CREDITS.clear()
    src_dir = folder.parent.parent / "photos"
    cred = {}
    if (src_dir / "credits.json").exists():
        cred = json.loads((src_dir / "credits.json").read_text(encoding="utf-8"))
    for ln in spec["lines"]:
        ph = (ln.get("p") or {}).get("photo") or {}
        name = Path(str(ph.get("src", ""))).name
        if not name:
            continue
        if not (src_dir / name).exists():
            raise SystemExit(f"photo {name} not found in {src_dir}")
        (story.APP / "public" / "photos").mkdir(parents=True, exist_ok=True)
        shutil.copy(src_dir / name, story.APP / "public" / "photos" / name)
        c = (cred.get(name) or {}).get("credit")
        if c and c not in PHOTO_CREDITS:
            PHOTO_CREDITS.append(c)


def credits(folder):
    """credits.txt beside the video: what to paste into the description."""
    out = []
    mc = soundlib.music_credit(sorted(set(MOOD_TRACK.values())))
    if mc:
        out.append(mc)
    if USED:
        out.append(soundlib.SONNISS_CREDIT)
    out += PHOTO_CREDITS
    (folder / "credits.txt").write_text("\n".join(out) + "\n", encoding="utf-8")
    (folder / "sounds-used.json").write_text(json.dumps({"music": MOOD_TRACK, "sounds": USED}, indent=1), encoding="utf-8")
    return out


def scene_sound(lines, total, music, sfx):
    """Sound for the story scenes after the opening: a music mood per run of scenes, one calm recorded bed per kind of place, and a
    few accents on the story's events (2.55.2). Everything is held under the voice later (mix)."""
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
    # ── the background (2.55.2). The owner on the first real-sound opening: the music is better, but "the sound of the stuff is
    # louder and annoying i keep hearing noises ... it should be background noises who are relaxing ... dont wanna make it crowded
    # with noise". So: ONE recorded bed per kind of place (the same recording for every line set there, continuous across them,
    # softened), on its own bus that the mix keeps a steady AMB_UNDER_DB under the narrator (it never swells in a pause), and only a
    # few accents where the story has an event. No made-up hiss, crickets, birds, bubbles, drips or drones: silence under the
    # music is better than a noisy bed.
    kinds = []
    for i, l in enumerate(lines):
        if l["shot"] in OPENING:
            continue
        k = bed_kind(l)
        if not k:
            continue
        t0 = max(0.0, l["t_start"] - 0.2)
        t1 = (lines[i + 1]["t_start"] - 0.2) if i + 1 < len(lines) else total
        if kinds and kinds[-1][2] == k and abs(kinds[-1][1] - t0) < 0.6:
            kinds[-1][1] = t1
        else:
            kinds.append([t0, t1, k])
    for r0, r1, k in kinds:
        q, lo, hi = BEDS[k]
        if k in (SOUND.get("no_beds") or []):
            continue
        q = (SOUND.get("beds") or {}).get(k) or q   # the sound agent may ask for another recording for a place
        a0 = max(0.0, r0 - 0.8)
        NEED[0] = NEEDS.get("bed:" + k)
        real(AMB[0], a0, q, min(total, r1 + 0.8) - a0, 1.0, 2.0, 2.0, loop=True, level=0.1, keep=True, band_hz=(lo, hi))
    last = -9.0
    for i, l in enumerate(lines):
        if l["shot"] in OPENING:
            continue
        p = l.get("p") or {}
        t0 = max(0.0, l["t_start"] - 0.2)
        t1 = (lines[i + 1]["t_start"] - 0.2) if i + 1 < len(lines) else total
        dur = max(0.1, t1 - t0)
        wt = lambda w: next((s for x, s, e in l["words"] if re.sub(r"[^a-z0-9]", "", x.lower()).startswith(w)), None)
        acc = None   # at most one accent a line, two seconds apart at least
        if l["shot"] == "snag" and wt("rips") is not None:
            acc = (wt("rips") - 0.02, ["metal impact", "heavy hit"], 1.2, 0.8, {})
        elif l["shot"] == "flood" and wt("floods") is not None:
            acc = (wt("floods") - 0.1, ["water submerge", "water splash"], 2.2, 0.8, {})
        elif l["shot"] == "sink" and wt("bottom") is not None:
            acc = (wt("bottom") - 0.03, ["heavy hit", "impact heavy", "boom"], 2.2, 0.9, {})
        elif l["shot"] == "m_rise" and wt((p.get("rise_on") or "rises")) is not None:   # Storygraphics #3: the shark rises
            acc = (wt((p.get("rise_on") or "rises")) - 0.1, ["low rumble", "boom", "impact heavy"], 3.0, 0.7, {})
        elif l["shot"] == "m_take" and wt((p.get("pull_on") or "drags")) is not None:   # the jaws take the trap
            acc = (wt((p.get("pull_on") or "drags")) - 0.05, ["water splash", "water submerge"], 2.0, 0.7, {})
        elif l["shot"] in ("p_title", "title", "m_title") and lines[0]["shot"] not in OPENING:
            acc = ((wt(((p.get("top_on") or "") or "survived").lower()) or t0 + 0.3) - 0.05, ["bass drop", "boom", "impact heavy"], 3.0, 0.8, {})
        elif p.get("day") not in (None, "") and p.get("day") != day:
            acc = (t0 - 0.05, ["bass drop", "boom", "impact heavy"], 2.4, 0.7, {"k": 1})
        elif l["shot"] == "planes" or any(it.get("name") in ("plane", "heli") for it in (p.get("items") or [])):
            acc = (t0 + 0.3, ["helicopter"] if any(it.get("name") == "heli" for it in (p.get("items") or [])) else ["airplane", "propeller"], min(4.0, dur), 0.6, {})
        if p.get("accent") is False:   # 2.61.1: this line has no accent (Tarek dropped the rumble on "What was it?" by its time, which moves)
            acc = None
        if acc and (SOUND.get("accents") or {}).get(l["shot"]):   # another search for this scene's accent
            acc = (acc[0], SOUND["accents"][l["shot"]], acc[2], acc[3], acc[4])
        if acc and any(abs(acc[0] - float(d)) < 0.6 for d in (SOUND.get("drop_accents") or []) if not isinstance(d, str)):
            acc = None
        if acc and l["shot"] in [d for d in (SOUND.get("drop_accents") or []) if isinstance(d, str)]:
            acc = None
        if acc and acc[0] - last >= 2.0:
            NEED[0] = NEEDS.get("day" if (p.get("day") not in (None, "") and l["shot"] not in NEEDS) else l["shot"])
            if real(sfx, acc[0], acc[1], acc[2], acc[3] * float(SOUND.get("accent_gain", 1.0)), hit=True, **acc[4]):
                last = acc[0]
                ACCENTS.append(round(acc[0], 2))
        if p.get("day") not in (None,):
            day = p.get("day")
    for x in SOUND.get("add_accents") or []:   # accents the sound agent adds: {line (1-based), word, for, gain}
        try:
            l = lines[int(x["line"]) - 1]
        except (KeyError, ValueError, IndexError):
            continue
        w = re.sub(r"[^a-z0-9]", "", str(x.get("word", "")).lower())
        at_ = next((s for wd, s, e in l["words"] if w and re.sub(r"[^a-z0-9]", "", wd.lower()).startswith(w)), l["t_start"] + 0.2)
        NEED[0] = x.get("need") or NEEDS.get(l["shot"])
        if real(sfx, at_ - 0.03, [x.get("for") or "impact"], float(x.get("dur", 2.0)), float(x.get("gain", 0.7)), hit=True):
            ACCENTS.append(round(at_, 2))


# what each sound must SOUND like, in plain words (2.56.2: Tarek's Earshot check; file-name searches like "StairWellDoor" scored low
# against themselves even when the sound was right)
NEEDS = {"snag": "a metal hatch being ripped open", "flood": "water rushing in", "sink": "a heavy metal object hitting the seabed",
         "p_title": "a deep cinematic hit", "title": "a deep cinematic hit", "m_title": "a deep cinematic hit",
         "m_rise": "a deep low rumble rising from below", "m_take": "a big splash of water", "day": "a deep cinematic hit", "planes": "a plane flying overhead",
         "bed:sea": "calm ocean waves", "bed:deep": "a deep calm underwater ambience", "bed:jungle": "a calm rainforest ambience",
         "bed:night": "crickets at night", "bed:river": "a calm river", "bed:rain": "steady rain", "bed:cabin": "inside a plane in flight"}
# the calm beds: kind of place -> (searches, softening band in Hz). "deep" is the sea's own sound muffled, as it is under water.
BEDS = {"sea": (["ocean waves", "sea waves", "water lapping"], 120, 5000), "deep": (["underwater", "ocean waves"], 30, 300),
        "jungle": (["jungle", "rainforest", "forest birds"], 150, 6000), "night": (["jungle night", "crickets", "night insects"], 150, 6000),
        "river": (["river", "stream", "water lapping"], 120, 5000), "rain": (["rain"], 150, 6000), "cabin": (["airplane interior"], 60, 3000)}
AMB = [None]
ACCENTS = []


def bed_kind(l):
    p, s = l.get("p") or {}, l["shot"]
    if s in OCEAN_SURFACE:
        return "sea"
    if s in OCEAN_DEEP:
        return "deep"
    if p.get("rain"):
        return "rain"
    if s in ("wade", "canoe", "hut") or p.get("water"):
        return "river"
    if s in JUNGLE and p.get("bg", "jungle") in ("jungle", "night"):
        return "night" if (p.get("time") == "night" or p.get("bg") == "night") else "jungle"
    return None


# the owner (2026-10-17): "in some places the sound effects get louder than the narrator". The music and the effects are held
# under the voice by measurement, not by hand-set volumes: while the narrator speaks, effects stay UNDER_VOICE_DB below his level
# and music MUSIC_UNDER_DB below; in the pauses neither goes above the narrator's usual level. The mix reports the loudest moment.
UNDER_VOICE_DB = -16.0   # accents while he speaks (was -14; -9 before the owner's "less sound effects or make them lower" on v3)
MUSIC_UNDER_DB = -18.0
GAP_MAX_DB = -10.0       # accents in a pause (was -6: the 2.55.1 opening's hits came within 7.7 dB of his voice in the gaps)
AMB_UNDER_DB = -28.0     # the background beds, steady, all the time (2.55.2: "background noises who are relaxing")
MUSIC_PEAK_DB = -15.0    # 2.61.0: a short swell of the music never within 15 dB of the voice while he speaks (was 9: after the Megalodon
MUSIC_PEAK_GAP_DB = -14.0   # title it came within 12.8 dB, Tarek's target is 16-20) nor above his usual level -14 dB in a pause (was 8)


BLK = SR // 100   # 2.59.1: every level is measured on 10 ms blocks (a 20-minute mix at 48 kHz ran out of memory sample by sample)


def _avg(x, win):
    """A centred moving average in O(n) (running sum); np.convolve is O(n*win) and takes hours on a 10-minute track."""
    win = max(1, int(win))
    c = np.cumsum(np.concatenate([[0.0], x]))
    h = win // 2
    idx = np.arange(len(x))
    a, b = np.clip(idx - h, 0, len(x)), np.clip(idx - h + win, 0, len(x))
    return (c[b] - c[a]) / np.maximum(1, b - a)


def _ms(x):
    """The mean square of every 10 ms block, read in chunks (no full-length float64 copy of the track)."""
    n = -(-len(x) // BLK)
    out = np.empty(n)
    step = BLK * 10000
    for i in range(0, len(x), step):
        seg = np.asarray(x[i:i + step], dtype=np.float64)
        k = -(-len(seg) // BLK)
        if k * BLK > len(seg):
            seg = np.concatenate([seg, np.zeros(k * BLK - len(seg))])
        out[i // BLK:i // BLK + k] = np.mean((seg * seg).reshape(k, BLK), 1)
    return out


def _rms(x, win):
    """The RMS over `win` samples, one value per 10 ms block."""
    return np.sqrt(_avg(_ms(x), max(1, win // BLK)) + 1e-12)


def _smooth_gain(g, win):
    """The gain a moment needs (one per 10 ms block), applied early enough: the lowest gain within half a window either side, so a
    sudden sound is already turned down when it starts (an average let the day-change hit through at +2.3 dB), then 30 ms smoothing."""
    nb = len(g)
    k = max(1, (win // BLK) // 2)
    pad = np.concatenate([np.ones(k), g, np.ones(k)])
    m = np.array(g, dtype=np.float64)
    for s in range(1, k + 1):
        m = np.minimum(m, np.minimum(pad[k - s:k - s + nb], pad[k + s:k + s + nb]))
    return np.minimum(m, _avg(m, 3))


def _apply(bus, gb):
    """bus *= the block gains (eased from block to block), in place and in chunks."""
    n = len(bus)
    xs = (np.arange(len(gb)) + 0.5) * BLK
    step = BLK * 10000
    for i in range(0, n, step):
        j = min(n, i + step)
        bus[i:j] *= np.interp(np.arange(i, j, dtype=np.float64), xs, gb).astype(bus.dtype)
    return bus


def _held_level(voice, block=0.1, thr=0.02):
    """The narrator's speech level (RMS over 1.5 s of voiced 100 ms blocks only), carried through every pause unchanged; one value
    per 10 ms block."""
    ms = _ms(voice)
    w = max(1, int(block * SR) // BLK)
    n = -(-len(ms) // w)
    x = np.concatenate([ms, np.zeros(n * w - len(ms))]).reshape(n, w)
    r = np.sqrt(np.mean(x, 1) + 1e-12)
    on = r > thr
    lvl = np.zeros(n)
    k = max(1, int(1.5 / block))
    last = 0.0
    hist = []
    for i in range(n):
        if on[i]:
            hist.append(r[i])
            hist = hist[-k:]
            last = float(np.sqrt(np.mean(np.square(hist))))
        lvl[i] = last
    first = np.argmax(on) if on.any() else n
    lvl[:first] = lvl[first] if first < n else 0.0   # before he first speaks: his first line's level
    return np.repeat(lvl, w)[:len(ms)]


def hold_under(bus, voice_rms, speaking, voice_level, under_db, gap_db, win):
    r = _rms(bus, win)
    cap = np.where(speaking, voice_rms * 10 ** (under_db / 20), voice_level * 10 ** (gap_db / 20))
    g = np.minimum(1.0, cap / r)
    return _apply(bus, _smooth_gain(g, win))


def loudness_report(voice, music, sfx, win):
    """Per 0.4 s window: the effects (and music) against the voice, in dB. The worst moments, so 'never louder' is measured."""
    hop = max(1, win // BLK)
    rows = []
    vr, mr, sr_ = _rms(voice, win), _rms(music, win), _rms(sfx, win)
    level = np.percentile(vr[vr > 1e-3], 70) if np.any(vr > 1e-3) else 1e-3
    for i in range(0, len(vr), hop):
        v = vr[i]
        ref = v if v > level * 0.5 else level   # in a pause or a word's fading tail, compare with the narrator's usual level (2.61.0: at
        #   0.25 a soft word's tail made the music read 12.8 dB under the voice where it sat 25 dB under his usual level)
        rows.append((i * BLK / SR, 20 * np.log10((sr_[i] + 1e-9) / ref), 20 * np.log10((mr[i] + 1e-9) / ref), v > level * 0.25))
    worst_sfx = max(rows, key=lambda r: r[1])
    worst_music = max(rows, key=lambda r: r[2])
    return {"effects_max_db_vs_voice": round(float(worst_sfx[1]), 1), "effects_max_at_s": round(worst_sfx[0], 1),
            "music_max_db_vs_voice": round(float(worst_music[2]), 1), "music_max_at_s": round(worst_music[0], 1),
            "effects_over_voice_windows": int(sum(1 for r in rows if r[1] > 0))}


def mix(lines, voiced, music, sfx, folder):
    N = len(music)
    voice = np.zeros(N, dtype=np.float32)
    for l, v in zip(lines, voiced):
        put(voice, l["t_start"], v["audio"])
    voice *= 0.7 / (np.max(np.abs(voice)) + 1e-9)   # ONE gain for the narration: each line used to be levelled on its own, so inside
    #                                                  a take a soft line jumped up to a loud one's level (it didn't sound continuous)
    win = int(0.4 * SR)
    vr = _rms(voice, win)   # 2.59.1: levels are one value per 10 ms block (BLK); gains are applied to the buses in place
    speaking = vr > 0.02
    level = float(np.percentile(vr[speaking], 70)) if np.any(speaking) else 0.1
    # music: a STEADY level under his usual voice (it rose in every pause and dropped when he spoke: it pumped), slow gain only
    mr = _rms(music, int(1.5 * SR))
    vs = _held_level(voice)   # a quiet line (the mother's words) takes the music down with it, slowly
    # 2.56.2 (Tarek's catch on the Pisces opening): this used a 1.5 s average of the voice, so every line's end and pause looked like a
    # "quiet line" and the music dropped 4-9 dB in every pause ("the narration may feel chopped"). Now the level of SPEECH only,
    # held through the pauses: the music stays steady between lines.
    gm = np.minimum(1.0, level * 10 ** (MUSIC_UNDER_DB / 20) / mr)
    gm = np.minimum(gm, np.where(vs > 0.02, vs * 10 ** (-12.0 / 20) / mr, 1.0))
    _apply(music, _avg(_smooth_gain(gm, int(1.0 * SR)), int(1.5 * SR) // BLK))
    if SOUND.get("music_gain_db"):   # the sound agent's nudge (only down: the steady -18 dB is the ceiling)
        music *= np.float32(10 ** (min(0.0, float(SOUND["music_gain_db"])) / 20))
    # and a guard for short notes (the wake-up melody) that a 1.5 s average doesn't see: never within 9 dB of the voice while he
    # speaks (his level over 1 s, so it doesn't follow every syllable) nor above his usual level -8 dB in a pause
    v1 = _rms(voice, int(1.0 * SR))
    hold_under(music, v1, v1 > 0.02, level, MUSIC_PEAK_DB, MUSIC_PEAK_GAP_DB, win)
    hold_under(sfx, vr, speaking, level, float(SOUND.get("accent_under_db", UNDER_VOICE_DB)), float(SOUND.get("accent_gap_db", GAP_MAX_DB)), win)
    amb = AMB[0] if AMB[0] is not None and len(AMB[0]) == N else np.zeros(N, dtype=np.float32)
    amb_under = float(SOUND.get("bed_under_db", AMB_UNDER_DB))
    ams = _ms(amb)
    on = ams > 1e-14
    amb_db = None
    if on.any():   # one steady gain: the beds sit AMB_UNDER_DB under his usual level whether he speaks or not (no swelling)
        amb *= np.float32(level * 10 ** (amb_under / 20) / float(np.sqrt(np.mean(ams[on]))))
        hold_under(amb, vr, speaking, level, amb_under + 6, amb_under + 6, win)   # and no loud moment in a recording
        amb_db = round(20 * np.log10(float(np.sqrt(np.mean(_ms(amb)[on]))) / level), 1)
    report = loudness_report(voice, music, sfx, win)
    report["background_db_vs_voice"] = amb_db
    report["accents"] = len(ACCENTS)
    stems = folder / "stems"   # 2.56.0: each layer on its own, so the sound agent can listen to one at a time
    stems.mkdir(exist_ok=True)
    for name, x in (("voice", voice), ("music", music), ("beds", amb), ("accents", sfx)):
        sf.write(str(stems / f"{name}.wav"), np.clip(x, -1, 1).astype("float32"), SR, subtype="PCM_16")
    (folder / "placed.json").write_text(json.dumps({"level_rms": round(level, 5), "accents_at": ACCENTS, "placed": PLACED, "settings": SOUND},
                                                   indent=1), encoding="utf-8")
    out = voice + music + sfx + amb
    out *= np.float32(0.9 / np.max(np.abs(out)))
    raw = folder / "_mix_raw.wav"
    sf.write(str(raw), np.stack([out, out], 1).astype("float32"), SR)
    wav = folder / "mix.wav"
    story.normalise(raw, wav)
    (folder / "loudness.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    say(f"   background beds at {amb_db} dB under the voice (steady); accents placed: {report['accents']}")
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
    if sys.argv[1:2] == ["--hear"]:   # internal: Whisper on the files listed, each -> <file>.heard.json (see _hear_files)
        for f in json.loads(Path(sys.argv[2]).read_text(encoding="utf-8")):
            a, sr = sf.read(f, dtype="float32")
            Path(f + ".heard.json").write_text(json.dumps(_heard(a.mean(axis=1) if a.ndim > 1 else a, sr)), encoding="utf-8")
        return
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
    SOUND.clear()
    SOUND.update(spec.get("sound") or {})
    if SOUND:
        say("   the sound agent's settings: " + json.dumps(SOUND)[:300])
    SEED[0] = int(hashlib.md5(str(spec.get("title", folder.name)).encode()).hexdigest()[:6], 16)
    music, sfx = make_sound(lines, total)
    story.ensure_app()
    install_photos(spec, folder)
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
