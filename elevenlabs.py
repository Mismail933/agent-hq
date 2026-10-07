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
import urllib.parse
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


def _call(path, body=None, timeout=120, raw=False, data=None, content_type="application/json"):
    """body: JSON to POST; data: raw bytes to POST (a multipart form) with its content_type. raw: return the bytes (audio)."""
    if not configured():
        raise ElevenError("No ElevenLabs key: START-HERE asks for it once (or put ELEVENLABS_API_KEY=... in the .env file).")
    payload = data if data is not None else json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=payload,
                                 headers={"xi-api-key": key(), "Content-Type": content_type, "Accept": "*/*" if raw else "application/json"},
                                 method="POST" if payload is not None else "GET")
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


V3 = "eleven_v3"


def model():
    return getattr(settings, "ELEVEN_MODEL", V3)


def _words_from_alignment(al):
    """[[word, start, end]] from ElevenLabs' character timings, without the [audio tags] (they are directions, not words)."""
    chars, starts, ends = al.get("characters", []), al.get("character_start_times_seconds", []), al.get("character_end_times_seconds", [])
    words, cur, s0, e0, tag = [], "", None, None, False
    for ch, a, b in zip(chars, starts, ends):
        if ch == "[":
            tag = True
        if tag:
            if ch == "]":
                tag = False
            continue
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
    return words


def speak(voice_id, text, speed=1.0, previous="", following="", tag="", model_id=None):
    """One line of speech with word timings. Returns (float32 audio at 24 kHz, [[word, start, end]] or None, characters billed).
    With Eleven v3 (the default since 2.20.0) `tag` is a delivery direction sent as an audio tag ([excited] ...), so the read is
    acted, not flat. If v3 refuses (an old plan, a voice v3 can't use), the line is read with multilingual v2 at a livelier setting."""
    mid = model_id or model()
    said = (f"[{tag}] " if tag and mid == V3 else "") + text
    if mid == V3:   # v3: stability is 0 (creative), 0.5 (natural) or 1 (robust); no speed, no previous/next text
        body = {"text": said, "model_id": V3, "voice_settings": {"stability": float(getattr(settings, "ELEVEN_V3_STABILITY", 0.5)),
                                                                 "similarity_boost": 0.75, "use_speaker_boost": True}}
    else:
        body = {"text": said, "model_id": mid,
                "voice_settings": {"stability": 0.35, "similarity_boost": 0.75, "style": 0.45, "use_speaker_boost": True,
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
            try:
                out = _call(f"/text-to-speech/{voice_id}/with-timestamps?output_format={fmt}", body)
            except ElevenError as e2:
                return _v3_fallback(mid, e2, voice_id, text, speed, previous, following)
        elif mid == V3 and any(c in str(e) for c in ("HTTP 400", "HTTP 422", "model", "didn't accept")):
            return _v3_fallback(mid, e, voice_id, text, speed, previous, following)
        else:
            raise
    audio = _decode(base64.b64decode(out["audio_base64"]), fmt)
    words = _words_from_alignment(out.get("alignment") or out.get("normalized_alignment") or {})
    return audio, (words or None), len(said)


def _v3_fallback(mid, err, voice_id, text, speed, previous, following):
    if mid != V3:
        raise err
    return speak(voice_id, text, speed, previous, following, model_id="eleven_multilingual_v2")


def voice_info(voice_id):
    """Name and labels of one voice in the account: {id, name, labels, description, category}."""
    if not re.fullmatch(r"[A-Za-z0-9]{12,40}", voice_id or ""):
        raise ElevenError("That doesn't look like an ElevenLabs voice id (letters and digits, about 20 characters).")
    v = _call(f"/voices/{voice_id}")
    return {"id": v.get("voice_id", voice_id), "name": v.get("name", "voice"), "labels": v.get("labels") or {},
            "description": v.get("description") or "", "category": v.get("category", "")}


def account_voices():
    """Every voice in the owner's account: [{id, name, gender, age, accent, use_case, description}]."""
    out = []
    for v in _call("/voices").get("voices", []):
        lab = {k: str(x).lower() for k, x in (v.get("labels") or {}).items()}
        out.append({"id": v.get("voice_id"), "name": v.get("name", "voice"), "gender": lab.get("gender", ""), "age": lab.get("age", ""),
                    "accent": lab.get("accent", ""), "use_case": lab.get("use_case", ""), "category": v.get("category", ""),
                    "description": lab.get("description") or lab.get("descriptive") or ""})
    return [v for v in out if v["id"]]


def _shared(v):
    return {"voice_id": v.get("voice_id"), "public_owner_id": v.get("public_owner_id"), "name": v.get("name", "voice"),
            "gender": v.get("gender", ""), "age": v.get("age", ""), "accent": v.get("accent", ""), "descriptive": v.get("descriptive", ""),
            "use_case": v.get("use_case", ""), "category": v.get("category", ""), "description": (v.get("description") or "")[:240],
            "preview_url": v.get("preview_url", ""), "language": v.get("language", ""), "cloned_by_count": v.get("cloned_by_count"),
            "library_url": f"https://elevenlabs.io/app/voice-library?voiceId={v.get('voice_id')}"}


def shared_voices(**filters):
    """Search the public Voice Library (free; no characters). filters: gender, age, accent, language, use_cases, descriptives, search,
    page_size, page. Returns [voice dicts with preview_url]."""
    q = {"page_size": 100, "language": "en"}
    q.update({k: v for k, v in filters.items() if v not in (None, "")})
    path = "/shared-voices?" + "&".join(f"{k}={urllib.parse.quote(str(v))}" for k, v in q.items())
    return [_shared(v) for v in _call(path).get("voices", [])]


def similar_voices(audio_bytes, filename="reference.mp3", top_k=40):
    """ElevenLabs' own matcher: Voice Library voices that sound like this clip (free to call). Returns [voice dicts]."""
    boundary = "----agenthq" + base64.b16encode(os.urandom(8)).decode().lower()
    parts = []
    for name, val in (("top_k", str(top_k)),):
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{val}\r\n".encode())
    parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"audio_file\"; filename=\"{filename}\"\r\n"
                 "Content-Type: application/octet-stream\r\n\r\n".encode() + audio_bytes + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    got = _call("/similar-voices", data=b"".join(parts), content_type=f"multipart/form-data; boundary={boundary}", timeout=180)
    return [_shared(v) for v in got.get("voices", [])]


def add_shared_voice(public_owner_id, voice_id, name):
    """Add a Voice Library voice to the owner's account (it then works in every render). Returns the new voice id in his account."""
    if not re.fullmatch(r"[A-Za-z0-9]{8,80}", public_owner_id or "") or not re.fullmatch(r"[A-Za-z0-9]{12,40}", voice_id or ""):
        raise ElevenError("That isn't a Voice Library voice.")
    got = _call(f"/voices/add/{public_owner_id}/{voice_id}", {"new_name": (name or "Library voice")[:60]})
    return got.get("voice_id") or voice_id


def quota():
    """{used, limit} characters this billing period from ElevenLabs itself, or None if it can't be read."""
    try:
        s = _call("/user/subscription")
        return {"used": s.get("character_count"), "limit": s.get("character_limit")}
    except ElevenError:
        return None
