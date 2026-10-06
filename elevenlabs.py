"""
ElevenLabs text-to-speech for the animated Shorts (standard library only, so the office and the video tools both use it).

The API key lives only in the owner's local .env (ELEVENLABS_API_KEY); START-HERE asks for it once. It is never written to
the repo, the logs or the chat. Every call is counted in characters so Atlas can track the monthly quota.
"""
import base64
import json
import os
import re
import ssl
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

import settings

ROOT = Path(__file__).parent
API = "https://api.elevenlabs.io/v1"
CREATOR_SKIP = ROOT / ".elevenlabs-skip"


class ElevenError(Exception):
    """The call failed; the message says why in plain words."""


def key():
    return os.environ.get("ELEVENLABS_API_KEY", "").strip()


def configured():
    return bool(key())


def _tls():
    try:
        import certifi   # the video tools' Python has it; Windows' own certificate store can be stale
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def _call(path, body=None, timeout=120, raw=False):
    if not configured():
        raise ElevenError("No ElevenLabs key: START-HERE asks for it once (or put ELEVENLABS_API_KEY=... in the .env file).")
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"xi-api-key": key(), "Content-Type": "application/json", "Accept": "application/json"},
                                 method="POST" if body is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_tls()) as r:
            data = r.read()
            return data if raw else json.loads(data)
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8", "replace")[:300]
        why = {401: "the key was refused (check it in .env)", 402: "the plan's credits are used up or a paid feature is needed",
               404: "that voice isn't in this ElevenLabs account (open it in the Voice Library and click Add to My Voices first)",
               422: "ElevenLabs didn't accept that voice id",
               429: "too many requests at once or the quota is used up"}.get(e.code, f"HTTP {e.code}")
        raise ElevenError(f"ElevenLabs: {why}. {text}")
    except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
        raise ElevenError(f"Couldn't reach ElevenLabs: {e}")


def save_key(k):
    env = ROOT / ".env"
    lines = [l for l in (env.read_text(encoding="utf-8").splitlines() if env.exists() else []) if not l.startswith("ELEVENLABS_API_KEY=")]
    lines.append(f"ELEVENLABS_API_KEY={k}")
    env.write_text("\n".join(lines) + "\n", encoding="utf-8")
    os.environ["ELEVENLABS_API_KEY"] = k


def offer_setup():
    """At startup, once, in the START-HERE window. Enter skips and it won't ask again."""
    if configured() or CREATOR_SKIP.exists():
        return
    print("  ElevenLabs gives the cartoon Shorts a human-sounding voice. Paste the API key from elevenlabs.io (profile -> API keys).")
    print("  It stays in the .env file on this computer. Press Enter to skip (the free voices are used).")
    try:
        k = input("  ElevenLabs key: ").strip()
    except EOFError:
        return
    if not k:
        CREATOR_SKIP.write_text("skipped", encoding="utf-8")
        print("  Skipped.\n", flush=True)
        return
    save_key(k)
    print("  Saved.\n", flush=True)


def storytellers(n=4):
    """Up to n calm, warm narrator voices (British and American) from the account, as [{id, name, label}]."""
    got = _call("/voices").get("voices", [])
    want_age = ("middle_aged", "middle aged", "old", "mature")

    def score(v):
        lab = {k: str(x).lower() for k, x in (v.get("labels") or {}).items()}
        s = 0
        s += 3 if lab.get("accent") in ("british", "american") else 0
        s += 2 if lab.get("accent") == "british" else 0
        s += 3 if any(w in lab.get("use_case", "") for w in ("narrat", "story")) else 0
        s += 2 if any(w in lab.get("descriptive", "") + lab.get("description", "") for w in ("calm", "warm", "deep", "confident", "wise", "articulate")) else 0
        s += 1 if lab.get("age") in want_age else 0
        s += 1 if lab.get("gender") == "male" else 0
        return s
    ranked = sorted((v for v in got if v.get("voice_id")), key=score, reverse=True)
    out, seen_accent = [], {}
    for v in ranked:   # a mix: at most 2 of the same accent and gender
        lab = v.get("labels") or {}
        k = (lab.get("accent"), lab.get("gender"))
        if seen_accent.get(k, 0) >= 2:
            continue
        seen_accent[k] = seen_accent.get(k, 0) + 1
        desc = ", ".join(x for x in (lab.get("accent"), lab.get("gender"), lab.get("description") or lab.get("descriptive")) if x)
        out.append({"id": v["voice_id"], "name": v.get("name", "voice"), "label": f"ElevenLabs: {v.get('name', 'voice')} ({desc})"})
        if len(out) == n:
            break
    return out


def _decode(audio, fmt):
    """Audio bytes -> float32 mono at 24 kHz (numpy)."""
    import numpy as np
    if fmt.startswith("pcm_24000"):
        return np.frombuffer(audio, dtype="<i2").astype("float32") / 32768.0
    from shorts import find_ffmpeg
    p = subprocess.run([find_ffmpeg(), "-v", "error", "-i", "pipe:0", "-f", "f32le", "-ar", "24000", "-ac", "1", "pipe:1"],
                       input=audio, capture_output=True, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if p.returncode != 0 or not p.stdout:
        raise ElevenError("Couldn't read the audio ElevenLabs sent back.")
    return np.frombuffer(p.stdout, dtype="<f4").astype("float32")


def speak(voice_id, text, speed=1.0, previous="", following=""):
    """One line of speech with word timings. Returns (float32 audio at 24 kHz, [[word, start, end]], characters billed)."""
    body = {"text": text, "model_id": getattr(settings, "ELEVEN_MODEL", "eleven_multilingual_v2"),
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.15, "use_speaker_boost": True,
                               "speed": max(0.7, min(1.2, float(speed)))}}
    if previous:
        body["previous_text"] = previous[-400:]
    if following:
        body["next_text"] = following[:400]
    fmt = "pcm_24000"
    try:
        out = _call(f"/text-to-speech/{voice_id}/with-timestamps?output_format={fmt}", body)
    except ElevenError as e:
        if "402" in str(e) or "paid feature" in str(e):   # PCM needs a higher plan on some accounts: ask for mp3 instead
            fmt = "mp3_44100_128"
            out = _call(f"/text-to-speech/{voice_id}/with-timestamps?output_format={fmt}", body)
        else:
            raise
    audio = _decode(base64.b64decode(out["audio_base64"]), fmt)
    al = out.get("alignment") or out.get("normalized_alignment") or {}
    chars, starts, ends = al.get("characters", []), al.get("character_start_times_seconds", []), al.get("character_end_times_seconds", [])
    words, cur, s0, e0 = [], "", None, None
    for ch, a, b in zip(chars, starts, ends):
        if ch.isspace():
            if cur:
                words.append([cur, s0, e0])
            cur, s0, e0 = "", None, None
            continue
        if not cur:
            s0 = a
        cur += ch
        e0 = b
    if cur:
        words.append([cur, s0, e0])
    return audio, words, len(text)


def voice_info(voice_id):
    """Name and labels of one voice in the account: {id, name, labels, description, category}."""
    if not re.fullmatch(r"[A-Za-z0-9]{12,40}", voice_id or ""):
        raise ElevenError("That doesn't look like an ElevenLabs voice id (letters and digits, about 20 characters).")
    v = _call(f"/voices/{voice_id}")
    return {"id": v.get("voice_id", voice_id), "name": v.get("name", "voice"), "labels": v.get("labels") or {},
            "description": v.get("description") or "", "category": v.get("category", "")}


def quota():
    """{used, limit} characters this billing period from ElevenLabs itself, or None if it can't be read."""
    try:
        s = _call("/user/subscription")
        return {"used": s.get("character_count"), "limit": s.get("character_limit")}
    except ElevenError:
        return None
