"""Sound for Bassel's map chapters (the owner 2026-10-30: the homemade ship creak "sounded like a cow"; real era sounds only). One effects track the
length of the chapter, built from recordings in long/sfx-era (made with ElevenLabs' sound effects, each checked with Earshot against what it should be):
- a ship line (`ship`): the wooden ship under the crossing, slow fades;
- `fx` battles: musket and cannon battle sound;
- a line's own `sfx` [[kind, seconds at, seconds]]: ship, harbour, revolt, battle, cannon, coins, purse, quill.
Levels against the narrator's speech: beds 22 dB under, accents 15 dB under over their loudest 0.4 s, and the whole track ducks 6 dB more while he speaks,
so nothing reads over him (`report`). Run in the shorts venv (numpy, soundfile)."""
import json
import math
from pathlib import Path

import numpy as np

SR = 48000
BED_DB = -22.0
ACCENT_DB = -15.0
DUCK_DB = -6.0
BEDS = {"ship", "harbour", "revolt"}


def _db(x):
    return 20 * math.log10(max(x, 1e-9))


def voice_level(voice):
    blk = int(SR * 0.05)
    m = len(voice) // blk
    b = np.sqrt(np.mean(np.square(voice[:m * blk].reshape(m, blk), dtype=np.float64), axis=1))
    on = b[b > np.percentile(b, 50)]
    return float(np.sqrt(np.mean(on ** 2))) if len(on) else 0.05, b


def _load(folder, kind, cache={}):
    import soundfile as sf
    if kind not in cache:
        x, sr = sf.read(str(Path(folder) / f"{kind}.wav"), dtype="float32")
        if x.ndim > 1:
            x = x.mean(axis=1)
        cache[kind] = x
    return cache[kind]


def _loud(x):
    blk = int(SR * 0.4)
    m = max(1, len(x) // blk)
    return float(np.max(np.sqrt(np.mean(np.square(x[:m * blk].reshape(m, -1), dtype=np.float64), axis=1)))) + 1e-9


def _fit(x, dur, start=0.0):
    """dur seconds of x, looped with equal-power crossfades, faded in and out."""
    n, xf = int(SR * dur), int(SR * 1.5)
    if n <= len(x) - int(start * SR):
        out = x[int(start * SR):int(start * SR) + n].copy()
    else:
        out = np.zeros(n + xf, np.float32)
        w = np.sin(np.linspace(0, np.pi / 2, xf)).astype(np.float32)
        pos = 0
        while pos < n:
            seg = x.copy()
            seg[:xf] *= w
            seg[-xf:] *= w[::-1]
            e = min(len(out), pos + len(seg))
            out[pos:e] += seg[:e - pos]
            pos += len(seg) - xf
        out = out[:n]
    k = min(len(out) // 3, int(SR * 0.9))
    if k > 0:
        f = np.sin(np.linspace(0, np.pi / 2, k)).astype(np.float32) ** 2
        out[:k] *= f
        out[-k:] *= f[::-1]
    return out


def build(beats, total, voice, out, folder, seed=7):
    """beats: the lines (t0/t1, ship, fx, sfx with times). voice: 48 kHz mono. Writes `out` and returns what was placed."""
    import soundfile as sf
    rng = np.random.default_rng(seed)
    n = int(SR * total) + SR
    bus = np.zeros(n, np.float32)
    vl, blocks = voice_level(voice)
    placed = []

    def put(kind, at, dur, why):
        x = _load(folder, kind)
        start = float(rng.uniform(0, max(0.0, len(x) / SR - dur))) if len(x) / SR > dur else 0.0
        y = _fit(x, dur, start)
        g = vl * 10 ** ((BED_DB if kind in BEDS else ACCENT_DB) / 20) / _loud(x if kind in BEDS else y)
        i = max(0, int(at * SR))
        e = min(n, i + len(y))
        bus[i:e] += y[:e - i] * g
        placed.append({"t": round(at, 2), "kind": kind, "dur": round(dur, 1), "why": why})

    for i, b in enumerate(beats):
        nxt = beats[i + 1]["t0"] if i + 1 < len(beats) else total
        if b.get("ship"):
            put("ship", b["t0"] - 0.3, max(3.0, min(nxt + 0.5, total) - b["t0"]), f"line {i} crossing")
        for x in b.get("fx") or []:
            if x.get("kind") == "battle":
                put("battle", x["at"], max(2.5, x.get("dur", 3) + 0.8), f"line {i} battle")
        for kind, at, dur in b.get("sfx") or []:
            put(kind, at, dur, f"line {i}")
    blk = int(SR * 0.05)
    speaking = np.convolve((blocks > vl * 0.2).astype(np.float32), np.ones(5) / 5, "same")
    g = 1 - (1 - 10 ** (DUCK_DB / 20)) * np.clip(speaking * 1.6, 0, 1)
    gain = np.ones(n, np.float32)
    gs = np.repeat(g, blk)[:n].astype(np.float32)
    gain[:len(gs)] = gs
    mix = (bus * gain)[:int(SR * total)]
    peak = float(np.max(np.abs(mix))) if len(mix) else 0
    if peak > 0.95:
        mix *= 0.95 / peak
    sf.write(str(out), mix, SR, subtype="FLOAT")
    return placed


def report(voice, fx, out=None):
    """How far under the voice the effects sit: their loudest 0.4 s against his speech level, while he speaks and in his pauses."""
    vl, _ = voice_level(voice)
    blk = int(SR * 0.4)
    m = min(len(voice), len(fx)) // blk
    vv = np.sqrt(np.mean(np.square(voice[:m * blk].reshape(m, blk), dtype=np.float64), axis=1))
    ff = np.sqrt(np.mean(np.square(fx[:m * blk].reshape(m, blk), dtype=np.float64), axis=1))
    talk = vv > vl * 0.25
    r = {"fx_max_db_vs_voice_talking": round(_db(ff[talk].max() if talk.any() else 1e-9) - _db(vl), 1),
         "fx_max_db_vs_voice_pauses": round(_db(ff[~talk].max() if (~talk).any() else 1e-9) - _db(vl), 1),
         "fx_over_voice_windows": int(np.sum(ff[talk] > vv[talk]))}
    if out:
        Path(out).write_text(json.dumps(r, indent=1), encoding="utf-8")
    return r
