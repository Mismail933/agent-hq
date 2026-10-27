"""Real recorded sounds and real music for the story videos (2.55.0, the owner: "set up the animation first ... also for the sound
effects"; before this every effect and every chord was made from noise and sine waves in story_sample.py, and he heard the music
as "corrupted").

Sound effects: the Sonniss GDC 2026 Game Audio Bundle (gdc.sonniss.com: royalty-free, commercial use, monetised YouTube videos
allowed, no attribution required; not for AI training). The owner's Chrome downloads its five zips into Downloads (Sonniss' own
site blocks scripts with a bot check); `unpack` copies them into ~/.agent-hq-anim/sfx-library/sonniss-gdc2026 and `build_index`
lists every file with words from its folder, its name and its embedded description (BWF), its length and channels.

Music: Scott Buckley's library (scottbuckley.com.au, CC BY 4.0: credit in the video's description, which also keeps his Content ID
from claiming the video). TRACKS below = the tracks in ~/.agent-hq-anim/music/scott-buckley with the mood each one serves.

    python soundlib.py unpack          # the Sonniss zips from Downloads -> the library
    python soundlib.py index           # (re)build the index
    python soundlib.py find "ocean waves" [n]
    python soundlib.py music           # the tracks and moods
"""
import hashlib
import json
import re
import shutil
import struct
import subprocess
import sys
import zipfile
from pathlib import Path

import numpy as np

HOME = Path.home() / ".agent-hq-anim"
LIB = HOME / "sfx-library"
SONNISS = LIB / "sonniss-gdc2026"
INDEX = LIB / "index.json"
CACHE = LIB / "_cache"
MUSIC = HOME / "music" / "scott-buckley"
SR = 48000
EXTS = {".wav", ".flac", ".aif", ".aiff", ".mp3", ".ogg"}
SONNISS_CREDIT = "Sound effects: Sonniss GDC 2026 Game Audio Bundle (royalty-free)."

# Scott Buckley (CC BY 4.0). mood: the story_sample mood each serves (tense, sad, hope, facts, night, danger)
TRACKS = {
    "anabasis-i": {"title": "Anabasis I", "moods": ["tense", "night"], "note": "slow, atmospheric strings, suspenseful and eerie"},
    "katabasis-i": {"title": "Katabasis I", "moods": ["tense", "sad"], "note": "slow, dark, textural low strings"},
    "never-dying": {"title": "Never Dying", "moods": ["tense", "sad"], "note": "ambient orchestral, bittersweet tension"},
    "soul-searcher": {"title": "Soul Searcher", "moods": ["night", "tense"], "note": "haunting ambient, voices"},
    "eyes-in-the-void": {"title": "Eyes In The Void", "moods": ["danger"], "note": "dark, chaotic, high suspense"},
    "unraveling": {"title": "Unraveling", "moods": ["sad", "night"], "note": "ambient strings and synth, grief with a touch of hope"},
    "in-this-moment": {"title": "In This Moment", "moods": ["sad"], "note": "bittersweet solo piano"},
    "memories-of-stone": {"title": "Memories Of Stone", "moods": ["sad", "facts"], "note": "peaceful, bittersweet strings and brass"},
    "penumbra": {"title": "Penumbra", "moods": ["sad", "night"], "note": "bittersweet, glacial, atmospheric"},
    "convergence": {"title": "Convergence", "moods": ["hope"], "note": "melancholic but upbeat strings and synth"},
    "wildflowers": {"title": "Wildflowers", "moods": ["hope"], "note": "contemplative piano and strings, building"},
    "born-of-the-sky": {"title": "Born Of The Sky", "moods": ["hope"], "note": "short, uplifting, heroic"},
    "with-these-hands": {"title": "With These Hands", "moods": ["facts", "hope"], "note": "dreamy, contemplative piano, strings, synth"},
    "echoes-of-home": {"title": "Echoes Of Home", "moods": ["facts"], "note": "warm, nostalgic, gentle"},
}

# words that mean the same thing in sound-library names (UCS categories, common abbreviations)
SYN = {"ocean": ["sea", "surf", "waves", "wave", "shore", "coast"], "waves": ["wave", "surf", "swell", "lapping"],
       "underwater": ["submerged", "hydrophone", "subaquatic", "underwater"], "rain": ["rainfall", "drizzle", "downpour"],
       "metal": ["metallic", "steel", "iron"], "impact": ["hit", "crash", "thud", "slam", "bang"], "creak": ["creaking", "groan", "stress"],
       "water": ["liquid"], "bubbles": ["bubble", "bubbling", "gurgle"], "wind": ["gust", "breeze"],
       "engine": ["motor", "idle", "rumble"], "helicopter": ["heli", "chopper"], "airplane": ["aircraft", "plane", "prop plane", "propeller"],
       "jungle": ["rainforest", "tropical", "forest"], "crowd": ["walla", "people", "murmur"], "boat": ["ship", "vessel", "hull"],
       "rope": ["cable", "line", "winch"], "footsteps": ["footstep", "steps", "walk"], "thunder": ["storm", "lightning"],
       "whoosh": ["swoosh", "swish", "pass by"], "drip": ["drips", "dripping", "droplet"], "fire": ["flames", "burning", "crackle"],
       "radio": ["static", "transmission", "walkie"], "phone": ["telephone", "ring"], "heartbeat": ["heart", "pulse"]}


def say(*a):
    print(*a, flush=True)


# ───────────────────────── the library ─────────────────────────
def zips(where=None):
    dirs = [Path(where)] if where else [Path.home() / "Downloads", Path.home() / "Desktop", LIB / "zips"]
    out = []
    for d in dirs:
        if d.exists():
            out += sorted(d.glob("Sonniss.com-GDC2026-GameAudioBundle*of5*.zip"))
    return out


def unpack(where=None):
    """Every finished Sonniss zip into the library, once each (a zip still downloading has a .crdownload name, so it isn't seen)."""
    SONNISS.mkdir(parents=True, exist_ok=True)
    done_f = LIB / "unpacked.json"
    done = json.loads(done_f.read_text(encoding="utf-8")) if done_f.exists() else {}
    got = 0
    for z in zips(where):
        key = f"{z.name}:{z.stat().st_size}"
        if key in done:
            continue
        try:
            with zipfile.ZipFile(z) as zf:
                bad = zf.testzip()
                if bad:
                    say(f"{z.name}: damaged ({bad}); download it again")
                    continue
                for m in zf.infolist():
                    p = Path(m.filename)
                    if m.is_dir() or p.suffix.lower() not in EXTS or ".." in p.parts:
                        continue
                    dest = SONNISS / p
                    if len(str(dest)) > 230:   # Windows' 260-character path limit (some names are whole sentences)
                        dest = dest.parent / (p.stem[:90].rstrip() + "_" + hashlib.md5(p.stem.encode()).hexdigest()[:6] + p.suffix)
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    with zf.open(m) as src, open(dest, "wb") as out:
                        shutil.copyfileobj(src, out)
            done[key] = True
            done_f.write_text(json.dumps(done, indent=1), encoding="utf-8")
            got += 1
            say(f"unpacked {z.name}")
        except zipfile.BadZipFile:
            say(f"{z.name}: not a complete zip yet")
    return got


def _bext(path):
    """The Broadcast WAV description (sound libraries write the sound's description there), else ''."""
    try:
        with open(path, "rb") as fh:
            head = fh.read(12)
            if head[:4] != b"RIFF" or head[8:12] != b"WAVE":
                return ""
            while True:
                h = fh.read(8)
                if len(h) < 8:
                    return ""
                cid, size = h[:4], struct.unpack("<I", h[4:])[0]
                if cid == b"bext":
                    return fh.read(min(size, 256)).split(b"\0")[0].decode("latin-1", "replace").strip()
                fh.seek(size + (size & 1), 1)
    except OSError:
        return ""


# Universal Category System (the sound libraries' file-name prefix, e.g. "METLImpt_..." = metal, impact): the category's and the
# sub-category's plain words go into the index, so "metal impact" finds METLImpt files
UCS_CAT = {"AERO": "aircraft air", "AIR": "air", "ALRM": "alarm", "AMB": "ambience", "ANML": "animal", "ARCH": "archived", "BEEP": "beep",
           "BELL": "bell", "BIRD": "bird", "BOAT": "boat ship", "BUBL": "bubbles", "CART": "cartoon", "CERM": "ceramic", "CHAIN": "chain",
           "CHEM": "chemical", "CLOCK": "clock", "CLOTH": "cloth", "COMM": "communication", "COM": "communication", "CREA": "creature",
           "CRWD": "crowd", "DES": "designed", "DSGN": "designed", "DIRT": "dirt", "DOOR": "door", "DRWR": "drawer", "ELEC": "electric",
           "EQUI": "equipment", "EXPL": "explosion", "FARM": "farm", "FIGHT": "fight", "FGHT": "fight", "FIRE": "fire", "FIREWRK": "fireworks",
           "FOLY": "foley", "FOOD": "food", "FOOT": "footsteps", "GAME": "game", "GEAR": "gear", "GLAS": "glass", "GORE": "gore",
           "HMN": "human", "HORR": "horror", "HOUSE": "household", "ICE": "ice", "IMPT": "impact", "INSC": "insect", "LASR": "laser",
           "LEAT": "leather", "MACH": "machine", "MAGC": "magic", "MAG": "magic", "MECH": "mechanical", "METL": "metal", "MOTR": "motor engine",
           "MOVE": "movement", "MUSC": "music", "NATR": "nature", "OBJ": "object", "PAPR": "paper", "PLAS": "plastic", "RAIN": "rain",
           "ROCK": "rock stone", "ROBO": "robot", "ROPE": "rope", "RUBR": "rubber", "SCI": "scifi", "SNOW": "snow", "SPRT": "sport",
           "SWSH": "whoosh", "SWTH": "switch", "TOOL": "tool", "TOY": "toy", "TRAN": "transportation", "UI": "interface", "VEH": "vehicle",
           "VOX": "voice", "WATR": "water", "WEAP": "weapon", "WHSH": "whoosh", "WHST": "whistle", "WIND": "wind", "WINDW": "window",
           "WOOD": "wood", "WTHR": "weather", "WHOOSH": "whoosh", "BOOM": "boom impact", "HIT": "hit impact", "STING": "sting", "TRANS": "transition"}
UCS_SUB = {"Impt": "impact", "Mvmt": "movement", "Fric": "friction scrape", "Crkl": "crackle", "Dsgn": "designed", "Subn": "suburban",
           "Wave": "wave waves", "Surf": "surf waves ocean", "Lap": "lapping water", "Undwtr": "underwater", "Undr": "underwater",
           "Splsh": "splash", "Flow": "flow", "Drip": "drip", "Pour": "pour", "Bubl": "bubbles", "Rept": "reptile", "Int": "interior",
           "Ext": "exterior", "Brth": "breath", "Reac": "reaction", "Telph": "telephone", "Type": "typewriter", "Lug": "luggage",
           "Furn": "furniture", "Sea": "sea ocean", "Ocn": "ocean", "Rmbl": "rumble", "Crsh": "crash", "Crk": "creak", "Creak": "creak",
           "Strs": "stress creak", "Tens": "tension", "Drone": "drone", "Bass": "bass drop hit", "Jet": "jet", "Prop": "propeller",
           "Heli": "helicopter", "Tick": "tick", "Thndr": "thunder", "Rain": "rain", "Gust": "gust", "Hvy": "heavy", "Lt": "light",
           "Misc": "", "Natr": "nature", "Frst": "forest", "Jngl": "jungle", "Insc": "insects", "Bird": "birds", "Urbn": "city", "Rurl": "rural"}


def ucs_words(stem):
    """The plain words of a UCS file name's CatID ("METLImpt" -> metal impact), else []."""
    m = re.match(r"^([A-Z]{2,8}?)([A-Z][a-z]+)_", stem)
    if not m:
        return []
    cat, sub = m.group(1), m.group(2)
    return words_of(UCS_CAT.get(cat, cat.lower()) + " " + UCS_SUB.get(sub, sub.lower()))


def words_of(text):
    t = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)
    return [w for w in re.split(r"[^a-z0-9]+", t.lower()) if len(w) > 1 and not w.isdigit()]


def build_index():
    import soundfile as sf
    rows = []
    for p in sorted(LIB.rglob("*")):
        if p.suffix.lower() not in EXTS or CACHE in p.parents:
            continue
        try:
            info = sf.info(str(p))
            dur, ch, sr = info.duration, info.channels, info.samplerate
        except Exception:
            continue
        rel = p.relative_to(LIB).as_posix()
        desc = _bext(p) if p.suffix.lower() == ".wav" else ""
        # n: the words that MATCH (the file's own name and its UCS category); w: every word (folder, description) for ranking only.
        # Matching on the folder or the description picked forest crickets for "ocean" (its notes mention water) and a spray bottle
        # for "water"; a wrong sound is worse than the made-up one it replaces.
        own = re.sub(r"_[^_]*Audio.*$", "", p.stem)   # "METLImpt_Metal Bangs, Metal Hits_344 Audio_..." -> without the vendor tail
        rows.append({"f": rel, "d": round(dur, 2), "ch": ch, "sr": sr, "desc": desc,
                     "n": sorted(set(words_of(own.split("_", 1)[-1]) + ucs_words(p.stem))),
                     "w": sorted(set(words_of(" ".join(p.relative_to(LIB).parts[1:])) + words_of(desc) + ucs_words(p.stem)))})
    INDEX.write_text(json.dumps(rows, separators=(",", ":")), encoding="utf-8")
    say(f"indexed {len(rows)} sounds, {sum(r['d'] for r in rows) / 3600:.1f} hours")
    return rows


_IDX = None


def index():
    global _IDX
    if _IDX is None:
        _IDX = json.loads(INDEX.read_text(encoding="utf-8")) if INDEX.exists() else []
    return _IDX


def available():
    return bool(index())


def _expand(word):
    """A word and its synonyms, one way only: "ocean" also finds "sea"/"surf", but "splash" doesn't widen to every water sound."""
    w = word.lower()
    return {x for v in {w, *SYN.get(w, [])} for x in words_of(v)}


def find(query, n=5, min_s=0.0, max_s=1e9, avoid=(), seed=0):
    """The best-matching sounds for a description ("ocean waves calm", "metal impact heavy"): every word must match (or one of its
    synonyms); more matched words and a description that names them rank higher; files in `avoid` (used already) come last."""
    q = [w for w in words_of(query)]
    if not q:
        return []
    groups = [_expand(w) for w in q]
    nums = re.findall(r"(?<![a-z0-9])\d{2,}(?![a-z0-9])", query.lower())   # a take number ("Booms Vol2 214") names that file only
    out = []
    for r in index():
        if not (min_s <= r["d"] <= max_s):
            continue
        if nums and not all(re.search(rf"(?<!\d){n}(?!\d)", r["f"]) for n in nums):   # (words_of drops numbers: 214 used to give 011)
            continue
        ns, ws = set(r.get("n") or r["w"]), set(r["w"])
        if not all(g & ns for g in groups):
            continue
        name = r["f"].lower()
        score = sum(2 if q[i] in ns else 1 for i in range(len(q))) + 0.3 * sum(bool(g & ws) for g in groups) - (5 if r["f"] in avoid else 0)
        score -= 0.05 * len(ns)   # a sound named for exactly this beats one whose long name happens to contain the words
        score += 0.001 * (int(hashlib.md5((name + str(seed)).encode()).hexdigest()[:6], 16) % 100)   # a stable tie-break per story
        out.append((score, r))
    out.sort(key=lambda x: -x[0])
    return [r for _, r in out[:n]]


def _ffmpeg():
    try:
        import shorts
        return shorts.find_ffmpeg()
    except Exception:
        return shutil.which("ffmpeg") or "ffmpeg"


def load(rel_or_path, start=0.0, dur=None, mono=True):
    """A sound as float32 at 48 kHz (mono by default), decoded once and kept in the cache."""
    p = Path(rel_or_path)
    if not p.is_absolute():
        p = LIB / p
    key = hashlib.md5(f"{p}:{p.stat().st_mtime}:{mono}".encode()).hexdigest()[:16]
    CACHE.mkdir(parents=True, exist_ok=True)
    c = CACHE / f"{key}.npy"
    if c.exists():
        x = np.load(c)
    else:
        args = [_ffmpeg(), "-v", "error", "-i", str(p), "-f", "f32le", "-ac", "1" if mono else "2", "-ar", str(SR), "-"]
        raw = subprocess.run(args, capture_output=True, check=True,
                             creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)).stdout
        x = np.frombuffer(raw, dtype=np.float32).copy()
        if not mono:
            x = x.reshape(-1, 2)
        np.save(c, x)
    i0 = int(start * SR)
    i1 = len(x) if dur is None else min(len(x), i0 + int(dur * SR))
    return x[i0:i1]


# ───────────────────────── music ─────────────────────────
def tracks():
    return {k: {**v, "file": MUSIC / f"{k}.mp3"} for k, v in TRACKS.items() if (MUSIC / f"{k}.mp3").exists()}


def music_for(mood, seed=0, avoid=()):
    have = tracks()
    cands = [k for k, v in have.items() if mood in v["moods"]] or [k for k, v in have.items() if "tense" in v["moods"]]
    if not cands:
        return None
    fresh = [k for k in cands if k not in avoid] or cands
    return fresh[seed % len(fresh)]


def music_credit(names):
    t = [TRACKS[n]["title"] for n in names if n in TRACKS]
    if not t:
        return ""
    return ("Music: " + ", ".join(f'"{x}"' for x in t) + " by Scott Buckley (scottbuckley.com.au), released under CC BY 4.0 "
            "(creativecommons.org/licenses/by/4.0).")


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        print(__doc__)
    elif a[0] == "unpack":
        n = unpack(a[1] if len(a) > 1 else None)
        say(f"{n} zip(s) unpacked")
        if n:
            build_index()
    elif a[0] == "index":
        build_index()
    elif a[0] == "find":
        for r in find(a[1], int(a[2]) if len(a) > 2 else 8):
            say(f"{r['d']:6.1f}s  {r['f']}  {r['desc'][:80]}")
    elif a[0] == "music":
        for k, v in tracks().items():
            say(k, v["moods"], v["note"])
