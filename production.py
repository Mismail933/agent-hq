"""
Where the owner's hand-made clips go, and what is still missing. Standard library only: both the office (server.py)
and the Shorts pipeline (shorts.py, in its own environment) use it.

For an episode with a shot list (pipeline v2, OpenArt), the owner saves into
    content/project-N/videos/ep-NNN/clips/
        shot01.mp4 ... shotNN.mp4     one clip per shot (any of .mp4 .mov .webm .mkv)
        voice.mp3                      the whole narration (or voice01.mp3 ... one per shot; .wav .m4a also work)
"""
import re
from pathlib import Path

ROOT = Path(__file__).parent
CONTENT = ROOT / "content"
VIDEO_EXT = (".mp4", ".mov", ".webm", ".mkv")
AUDIO_EXT = (".mp3", ".wav", ".m4a", ".aac", ".ogg")


def episode_folder(ep):
    return CONTENT / f"project-{ep['project_id']}" / "videos" / f"ep-{ep['id']:03d}"


def clips_folder(ep):
    return episode_folder(ep) / "clips"


def is_v2(ep):
    return bool((ep.get("data") or {}).get("shots"))


def _numbered(folder, prefix, exts):
    found = {}
    if folder.exists():
        for f in folder.iterdir():
            m = re.fullmatch(rf"{prefix}[ _-]?0*(\d+)", f.stem, re.I)
            if m and f.suffix.lower() in exts:
                found.setdefault(int(m.group(1)), f)
    return found


def clip_status(ep):
    """What the owner has delivered so far for a v2 episode."""
    folder = clips_folder(ep)
    n = len(ep["data"].get("shots") or [])
    clips = _numbered(folder, "shot", VIDEO_EXT)
    voice_one = next((f for f in sorted(folder.glob("voice.*")) if f.suffix.lower() in AUDIO_EXT), None) if folder.exists() else None
    voice_per_shot = _numbered(folder, "voice", AUDIO_EXT)
    have_voice = bool(voice_one) or all(i in voice_per_shot for i in range(1, n + 1))
    return {"folder": str(folder), "shots": n, "clips": sorted(i for i in clips if 1 <= i <= n),
            "missing": [i for i in range(1, n + 1) if i not in clips], "voice": have_voice,
            "voice_mode": "one file" if voice_one else "per shot" if have_voice else "",
            "ready": n > 0 and all(i in clips for i in range(1, n + 1)) and have_voice}


def find_clips(ep):
    return _numbered(clips_folder(ep), "shot", VIDEO_EXT)


def find_voice(ep):
    """('one', path) or ('per_shot', {n: path}) or (None, None)."""
    folder = clips_folder(ep)
    one = next((f for f in sorted(folder.glob("voice.*")) if f.suffix.lower() in AUDIO_EXT), None) if folder.exists() else None
    if one:
        return "one", one
    per = _numbered(folder, "voice", AUDIO_EXT)
    n = len(ep["data"].get("shots") or [])
    if n and all(i in per for i in range(1, n + 1)):
        return "per_shot", per
    return None, None
