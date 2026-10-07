"""
Sound effects and background music for the animated videos (2.20.0). Standard library only (the office and the video tools both use it).

Effects: a fixed menu Calina picks from (`MENU`). Each effect is made ONCE with ElevenLabs' sound-effects model (11 characters per second
of sound, so the whole menu is about 600 characters, once) and saved in content/audio-kit/sfx/<name>.mp3; every later video reuses the
file. Nothing is made until a video asks for it.

Music: free tracks by Kevin MacLeod (incompetech.com, Creative Commons Attribution 4.0: free for commercial use with a credit line,
which the description gets automatically). The owner picks one per project from `MUSIC` (or none); it is downloaded once into
content/audio-kit/music/ and plays quietly under the voices, ducked while anyone speaks.
"""
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

import elevenlabs

ROOT = Path(__file__).parent
KIT = ROOT / "content" / "audio-kit"
SFX_DIR = KIT / "sfx"
MUSIC_DIR = KIT / "music"

# name -> (what ElevenLabs is asked for, seconds). Cartoon-style, short, no voices saying words.
MENU = {
    "whoosh": ("fast cartoon whoosh, air swish", 1.0),
    "pop": ("cartoon bubble pop", 0.5),
    "ding": ("bright single bell ding, idea moment", 1.0),
    "boing": ("cartoon spring boing", 1.0),
    "drum_hit": ("dramatic single timpani hit with cymbal", 1.5),
    "dun_dun": ("dramatic cartoon reveal sting, two low orchestral hits, dun dun", 2.0),
    "record_scratch": ("vinyl record scratch, comedic stop", 1.0),
    "sad_trombone": ("comedic sad trombone, wah wah wah", 2.5),
    "tada": ("short cheerful fanfare, ta-da", 2.0),
    "crowd_gasp": ("small crowd of people gasping in surprise, no words", 1.5),
    "crowd_cheer": ("ancient town crowd cheering and clapping, no words", 3.0),
    "crowd_laugh": ("small crowd laughing heartily, no words", 2.5),
    "crowd_murmur": ("crowd murmuring in a marketplace, indistinct, no words", 3.0),
    "crowd_boo": ("small crowd booing, no words", 2.0),
    "footsteps": ("sandals walking on stone, a few quick steps", 1.5),
    "scroll": ("parchment scroll unrolling, paper rustle", 1.0),
    "coins": ("handful of ancient coins clinking", 1.0),
    "thud": ("heavy cartoon thud, something falls", 0.8),
    "splash": ("water splash into a well", 1.2),
    "wind": ("desert wind gust", 2.0),
    "birds": ("seagulls and small birds by the sea", 2.5),
    "camel": ("camel grunt", 1.0),
    "horse": ("horse neigh", 1.5),
    "sword": ("metal sword drawn from a sheath", 1.0),
    "tick": ("clock ticking, three ticks", 1.5),
    "magic": ("sparkle magic chime shimmer", 1.5),
    "thinking": ("short comedic thinking hum music cue, plucked strings", 2.0),
    "gulp": ("cartoon nervous gulp", 0.6),
    "slap": ("cartoon face palm slap", 0.5),
}
CREDIT_SFX = "Sound effects: made with ElevenLabs."

# id -> (title, mood). Kevin MacLeod, incompetech.com, CC BY 4.0.
MUSIC = {
    "sneaky-snitch": ("Sneaky Snitch", "playful, sneaky, comedic (the classic funny-explainer bed)"),
    "scheming-weasel": ("Scheming Weasel faster", "bouncy comedic pizzicato, a bit cheeky"),
    "investigations": ("Investigations", "curious, light mystery, good for 'how did he figure it out'"),
    "minstrel-guild": ("Minstrel Guild", "old-world lute and flute, gentle period feel"),
}
MUSIC_BASE = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/"


def music_credit(mid):
    title = MUSIC.get(mid, ("", ""))[0]
    return (f'Music: "{title}" by Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0 '
            "License, http://creativecommons.org/licenses/by/4.0/") if title else ""


def music_path(mid):
    """The track on disk (downloaded once). None for an unknown id."""
    if mid not in MUSIC:
        return None
    MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    dest = MUSIC_DIR / f"{mid}.mp3"
    if not dest.exists() or dest.stat().st_size < 50_000:
        url = MUSIC_BASE + urllib.parse.quote(MUSIC[mid][0]) + ".mp3"
        req = urllib.request.Request(url, headers={"User-Agent": "AgentHQ/1.0 (music for our own videos, credited)"})
        with urllib.request.urlopen(req, timeout=120, context=elevenlabs._tls()) as r:
            data = r.read()
        if len(data) < 50_000:
            raise OSError(f"The music file for {MUSIC[mid][0]} came back empty.")
        dest.write_bytes(data)
    return dest


def menu_text():
    return ", ".join(f"{k} ({v[0].split(',')[0]})" for k, v in MENU.items())


def sfx_path(name):
    """The effect on disk, made with ElevenLabs the first time it is needed. Returns (path, characters billed now)."""
    if name not in MENU:
        raise KeyError(name)
    SFX_DIR.mkdir(parents=True, exist_ok=True)
    dest = SFX_DIR / f"{name}.mp3"
    if dest.exists() and dest.stat().st_size > 1000:
        return dest, 0
    prompt, secs = MENU[name]
    audio = elevenlabs._call("/sound-generation?output_format=mp3_44100_128",
                             {"text": prompt, "duration_seconds": secs, "prompt_influence": 0.6}, timeout=120, raw=True)
    if len(audio) < 1000:
        raise elevenlabs.ElevenError(f"ElevenLabs sent back an empty sound for '{name}'.")
    dest.write_bytes(audio)
    billed = int(round(secs * 11))   # ElevenLabs: 11 credits per second when the duration is set
    log = SFX_DIR / "made.json"
    try:
        made = json.loads(log.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        made = []
    made.append({"name": name, "prompt": prompt, "seconds": secs, "credits": billed, "at": time.strftime("%Y-%m-%d %H:%M")})
    log.write_text(json.dumps(made, indent=1), encoding="utf-8")
    return dest, billed


def library():
    """What the office shows: every effect, whether it exists yet, and the music choices."""
    return {"sfx": [{"name": k, "what": v[0], "seconds": v[1], "made": (SFX_DIR / f"{k}.mp3").exists()} for k, v in MENU.items()],
            "music": [{"id": k, "title": v[0], "mood": v[1], "downloaded": (MUSIC_DIR / f"{k}.mp3").exists()} for k, v in MUSIC.items()]}
