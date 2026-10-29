"""Sound for Bassel's map chapters (the owner 2026-10-29: "sound design: waves and creaking ships on crossings, cannons in fights, a calm
bed per place, music 16-20 dB under the voice"). One effects track the length of the chapter, built in numpy from the chapter's beats:
- a ship line (`ship`): the Sonniss sea recording under the crossing, slow fades, wooden creaks every few seconds;
- battles (`fx` battle, battle events): distant cannon, each made here (a crack, a low thump, a rumble, a short room), never two at once;
- an event or footage of a place: its calm bed (sea, forest birds, a rocket's rumble);
- a line may name its own: `sfx` [[kind, cue, seconds]] with kind sea|creak|cannon|birds|rumble.
Levels are set against the narrator: beds 26 dB under his speech, accents 13 dB under, and the whole track ducks 6 dB more while he
speaks (`duck`), so nothing reads over him. `report` measures it. Recordings: the Sonniss GDC bundle (soundlib); the rest is made here.
Run in the shorts venv (numpy, soundfile)."""
import json
import math
from pathlib import Path

import numpy as np

SR = 48000
BED_DB = -26.0      # a bed's level under the narrator's speech
ACCENT_DB = 0.0     # a cannon / creak at its PEAK, against his speech RMS: a shot is mostly crack, so over 0.4 s it sits ~16 dB under him once ducked (measured)
DUCK_DB = -6.0      # everything, while he speaks
BATTLE_EVENTS = {"algiers1830": 4, "samori1890s": 3, "vietnam1880s": 3, "madagascar1895": 4}   # event key -> cannon shots
EVENT_BEDS = {"settle-1608": ["sea", "birds"], "sugar-1700s": ["birds"], "quebec1608": ["sea"], "prison1864": ["sea"], "newcal1853": ["sea"]}
FOOTAGE_BEDS = {"tall-ship": ["sea", "creak"], "guadeloupe-soufriere": ["birds"], "reunion-aerial": ["sea"], "kourou-launch": ["rumble"],
                "sugar-museum": ["birds"]}
QUERIES = {"sea": "ocean waves", "birds": "birds"}


def _rms(x):
    return float(np.sqrt(np.mean(np.square(x, dtype=np.float64)) + 1e-12))


def _db(x):
    return 20 * math.log10(max(x, 1e-9))


def _lp(x, hz):   # one-pole low-pass, both ways (no phase smear)
    a = math.exp(-2 * math.pi * hz / SR)
    y = np.empty_like(x)
    acc = 0.0
    for _ in range(2):
        acc = 0.0
        for i in range(len(x)):
            acc = (1 - a) * x[i] + a * acc
            y[i] = acc
        x = y[::-1].copy()
    return x


def _lp_fast(x, hz):   # the same filter on long signals, in blocks of numpy (scipy is not in the venv)
    try:
        from scipy.signal import lfilter
        a = math.exp(-2 * math.pi * hz / SR)
        y = lfilter([1 - a], [1, -a], x)
        return lfilter([1 - a], [1, -a], y[::-1])[::-1].astype(np.float32)
    except Exception:
        k = max(1, int(SR / (hz * 2.2)))
        ker = np.ones(k, np.float32) / k
        return np.convolve(np.convolve(x, ker, "same"), ker, "same").astype(np.float32)


def cannon(rng, far=True):
    """A cannon shot, about 2.5 s: a sharp crack, a low thump falling in pitch, a rumble, and a short room."""
    n = int(SR * 2.6)
    t = np.arange(n) / SR
    crack = rng.standard_normal(n).astype(np.float32) * np.exp(-t / 0.012)
    f0 = 58 * np.exp(-t / 0.5) + 32
    thump = np.sin(2 * np.pi * np.cumsum(f0) / SR) * np.exp(-t / 0.28) * 1.6
    rumble = _lp_fast(rng.standard_normal(n).astype(np.float32), 140) * np.exp(-t / 0.9) * 9
    x = crack * 0.5 + thump + rumble
    # a short room: a few late copies, darker
    for d, g in ((0.07, 0.35), (0.16, 0.22), (0.33, 0.14)):
        k = int(SR * d)
        x[k:] += _lp_fast(x[:-k], 900) * g
    if far:
        x = _lp_fast(x, 1400)
    return (x / (np.max(np.abs(x)) + 1e-9)).astype(np.float32)


def creak(rng):
    """A wooden creak, 0.5-1 s: stick-slip pulses (a rate that bends up and down) through a few resonances of a hull."""
    dur = rng.uniform(0.5, 1.0)
    n = int(SR * dur)
    t = np.arange(n) / SR
    rate = rng.uniform(35, 70) * (1 + 0.45 * np.sin(np.pi * t / dur) + 0.15 * rng.standard_normal() * t)
    ph = np.cumsum(rate) / SR
    pulses = (np.diff(np.floor(ph), prepend=0) > 0).astype(np.float32) * (0.6 + 0.4 * rng.random(n).astype(np.float32))
    y = np.zeros(n, np.float32)
    for fr, q in ((rng.uniform(320, 420), 0.012), (rng.uniform(700, 900), 0.008), (rng.uniform(1500, 1900), 0.004)):
        ker_t = np.arange(int(SR * 0.05)) / SR
        ker = (np.sin(2 * np.pi * fr * ker_t) * np.exp(-ker_t / q)).astype(np.float32)
        y += np.convolve(pulses, ker)[:n]
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.7
    y = y * env
    return (y / (np.max(np.abs(y)) + 1e-9)).astype(np.float32)


def rumble(rng, dur):
    """A far rocket launch: a low roar swelling in and away."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    x = _lp_fast(rng.standard_normal(n).astype(np.float32), 90) * 6 + _lp_fast(rng.standard_normal(n).astype(np.float32), 400) * 0.6
    env = np.clip(t / 1.5, 0, 1) * np.clip((dur - t) / 2.0, 0, 1)
    x = x * env
    return (x / (_rms(x) + 1e-9) * 0.1).astype(np.float32)


_REC = {}


def recording(kind, dur, seed=0):
    """A recorded bed of `dur` seconds (looped with equal-power crossfades), or None when the library has none."""
    import soundlib
    if kind not in _REC:
        hits = soundlib.find(QUERIES[kind], n=3, min_s=20)
        _REC[kind] = soundlib.load(hits[0]["f"]) if hits else None
    src = _REC[kind]
    if src is None:
        return None
    src = np.asarray(src, np.float32)
    n, xf = int(SR * dur), int(SR * 1.5)
    out = np.zeros(n + xf, np.float32)
    pos, start = 0, (seed * 7919) % max(1, len(src) - SR * 10)
    while pos < n:
        seg = src[start:start + min(len(src) - start, n - pos + xf)]
        if len(seg) < xf * 2:
            start = 0
            continue
        seg = seg.copy()
        w = np.sin(np.linspace(0, np.pi / 2, xf)).astype(np.float32)
        seg[:xf] *= w
        seg[-xf:] *= w[::-1]
        out[pos:pos + len(seg)] += seg
        pos += len(seg) - xf
        start = 0
    out = out[:n]
    return out / (_rms(out) + 1e-9)


def _place(bus, x, t, gain=1.0):
    i = int(t * SR)
    if i >= len(bus) or i + len(x) <= 0:
        return
    a = max(0, -i)
    x = x[a:len(bus) - i] if i + len(x) > len(bus) else x[a:]
    bus[max(0, i):max(0, i) + len(x)] += x * gain


def _fade(x, s=1.2):
    k = min(len(x) // 2, int(SR * s))
    if k > 0:
        w = np.sin(np.linspace(0, np.pi / 2, k)).astype(np.float32) ** 2
        x[:k] *= w
        x[-k:] *= w[::-1]
    return x


def voice_level(voice):
    """The narrator's speech level: the RMS of his loud half (pauses don't pull it down)."""
    blk = int(SR * 0.05)
    m = len(voice) // blk
    b = np.sqrt(np.mean(np.square(voice[:m * blk].reshape(m, blk), dtype=np.float64), axis=1))
    on = b[b > np.percentile(b, 50)]
    return float(np.sqrt(np.mean(on ** 2))) if len(on) else 0.05, b


def build(beats, total, voice, out, seed=7):
    """beats: the chapter's lines as the renderer gets them (t0/t1 in seconds, ship, fx, event, footage, sfx with `at` times).
    voice: the narrator's track (48 kHz mono). Writes `out` (48 kHz mono float wav) and returns what was placed."""
    import soundfile as sf
    rng = np.random.default_rng(seed)
    n = int(SR * total) + SR
    beds, acc = np.zeros(n, np.float32), np.zeros(n, np.float32)
    vl, blocks = voice_level(voice)
    bed_g, acc_g = vl * 10 ** (BED_DB / 20), vl * 10 ** (ACCENT_DB / 20)
    placed = []
    last_boom = [-9.0]

    def bed(kind, a, b, gain=1.0, why=""):
        dur = max(1.0, b - a)
        if kind == "creak":
            t = a + rng.uniform(0.6, 1.8)
            while t < b - 0.8:
                c = creak(rng)
                _place(acc, c * acc_g * rng.uniform(0.55, 0.85) * gain, t)
                placed.append({"t": round(t, 2), "kind": "creak", "why": why})
                t += rng.uniform(2.6, 4.6)
            return
        x = rumble(rng, dur) / 0.1 if kind == "rumble" else recording(kind, dur, seed=len(placed))
        if x is None:
            return
        if kind == "birds":
            x = x * 0.7
        _place(beds, _fade(x.copy()) * bed_g * gain, a)
        placed.append({"t": round(a, 2), "kind": kind, "dur": round(dur, 1), "why": why})

    def boom(t, why, gain=1.0):
        if t - last_boom[0] < 0.9:   # never two at once
            t = last_boom[0] + 0.9
        _place(acc, cannon(rng) * acc_g * gain * rng.uniform(0.8, 1.0), t)
        last_boom[0] = t
        placed.append({"t": round(t, 2), "kind": "cannon", "why": why})

    for i, b in enumerate(beats):
        t0, t1 = b["t0"], b["t1"]
        nxt = beats[i + 1]["t0"] if i + 1 < len(beats) else total
        if b.get("ship"):
            bed("sea", t0 - 0.4, min(nxt + 0.6, total), 1.0, f"line {i} crossing")
            bed("creak", t0, nxt, 1.0, f"line {i} crossing")
        for x in b.get("fx") or []:
            if x.get("kind") == "battle":
                for k in range(min(4, max(2, int(x.get("dur", 3) / 1.2)))):
                    boom(x["at"] + 0.2 + k * rng.uniform(0.9, 1.5), f"line {i} battle", 0.8)
        ev = b.get("event")
        if ev:
            a = t0 + (ev.get("delay") or 0)
            e = a + (ev.get("dur") or 8)
            for kind in EVENT_BEDS.get(ev["key"], []):
                bed(kind, a, e, 1.15, f"event {ev['key']}")
            if ev["key"] == "settle-1608":
                bed("creak", a, a + min(10.0, e - a), 1.0, "event settle-1608")
            for k in range(BATTLE_EVENTS.get(ev["key"], 0)):
                boom(a + 1.2 + k * (e - a - 2.5) / max(1, BATTLE_EVENTS[ev["key"]]), f"event {ev['key']}")
        v = b.get("footage")
        if v:
            for kind in FOOTAGE_BEDS.get(v["key"], []):
                bed(kind, v["at"], v["at"] + v.get("dur", 5), 1.2, f"footage {v['key']}")
        for kind, at, dur in b.get("sfx") or []:
            if kind == "cannon":
                boom(at, f"line {i} sfx")
            else:
                bed(kind, at, at + dur, 1.0, f"line {i} sfx")
    # duck under the voice: 6 dB while he speaks (block level over a fifth of his speech level), eased over 0.25 s
    blk = int(SR * 0.05)
    speaking = (blocks > vl * 0.2).astype(np.float32)
    k = 5
    speaking = np.convolve(speaking, np.ones(k) / k, "same")
    g = 1 - (1 - 10 ** (DUCK_DB / 20)) * np.clip(speaking * 1.6, 0, 1)
    gain = np.ones(n, np.float32)
    gs = np.repeat(g, blk)[:n].astype(np.float32)
    gain[:len(gs)] = gs
    mix = (beds + acc) * gain
    mix = mix[:int(SR * total)]
    peak = float(np.max(np.abs(mix))) if len(mix) else 0
    if peak > 0.95:
        mix *= 0.95 / peak
    sf.write(str(out), mix, SR, subtype="FLOAT")
    return placed


def report(voice, fx, out=None):
    """How far under the voice the effects sit: their loudest 0.4 s against his speech level, while he speaks and in his pauses."""
    vl, vb = voice_level(voice)
    blk = int(SR * 0.4)
    m = min(len(voice), len(fx)) // blk
    vv = np.sqrt(np.mean(np.square(voice[:m * blk].reshape(m, blk), dtype=np.float64), axis=1))
    ff = np.sqrt(np.mean(np.square(fx[:m * blk].reshape(m, blk), dtype=np.float64), axis=1))
    talk = vv > vl * 0.25
    r = {"fx_max_db_vs_voice_talking": round(_db(ff[talk].max() if talk.any() else 1e-9) - _db(vl), 1),
         "fx_max_db_vs_voice_pauses": round(_db(ff[~talk].max() if (~talk).any() else 1e-9) - _db(vl), 1),
         "fx_over_voice_windows": int(np.sum(ff > vv * 1.0 * talk + 1e9 * (~talk)))}
    if out:
        Path(out).write_text(json.dumps(r, indent=1), encoding="utf-8")
    return r
