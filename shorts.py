"""
Shorts pipeline: turns an approved script into a finished YouTube Short, ready for the owner to upload by hand.

    <video-tools python> shorts.py assemble <episode id>   v2: the owner's OpenArt clips + voice -> Short (default)
    <video-tools python> shorts.py render <episode id>     v1 (legacy): Kokoro voice + archive stills
    <video-tools python> shorts.py check <episode id>

It runs in its own environment (~/.agent-hq-shorts, see settings.SHORTS_PYTHON) because the voice model needs
PyTorch. The office starts it; you rarely run it by hand.

  1. checklist   blocks a script with no linked, quoted source, a wrong length, or a repeat of another episode
  2. voice       Kokoro-82M (Apache-2.0), with a timing for every word
  3. images      public-domain only, from Wikimedia Commons (which also hosts the Library of Congress's and the Met's
                 public-domain collections; the Met's own search API is gone), licence logged per image
  4. render      FFmpeg: 1080x1920, slow zoom on each image, burned-in captions, under 60 seconds
  5. output      content/project-N/videos/ep-NNN/: short.mp4, title.txt, description.txt, sources.txt
"""
import argparse
import json
import re
import shutil
import ssl
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))
import control_plane as cp  # noqa: E402
import production  # noqa: E402
import settings  # noqa: E402

UA = "AgentHQ-Shorts/1.0 (POV Then History channel; https://github.com/Mismail933/agent-hq)"
W, H, FPS = 1080, 1920, 30
MAX_SECONDS = 58.0
DISCLOSURE = "AI-assisted: script and voice made with AI; facts sourced below."
DISCLOSURE_V2 = "AI-assisted: script, voice and visuals made with AI; facts sourced below."
TARGET_WPM, MAX_WPM = 145, 158   # the owner found the first voice too fast
PD_PREFIXES = ("public domain", "cc0", "pd-", "pd ", "no restrictions")
CONTENT = ROOT / "content"


class Blocked(Exception):
    """The episode can't be rendered; the message says why."""


def say(msg):
    print(msg, flush=True)


def _tls():
    # Windows' own certificate store can be out of date for Python; certifi (installed with the voice model) is current.
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


TLS = _tls()


def fetch(url, timeout=40):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout, context=TLS) as r:
        return r.read()


def fetch_json(url):
    return json.loads(fetch(url))


def strip_html(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s or "")).strip()


PLACEHOLDER = re.compile(r"\[[A-Z][A-Z _/-]{2,}\]")


def fill_placeholders(text, project):
    """Put the channel's real name and handle where a script still says [CHANNEL NAME] / [HANDLE]."""
    c = (project or {}).get("meta", {}).get("channel") or {}
    if c.get("name"):
        text = re.sub(r"\[CHANNEL(?: NAME)?\]", c["name"], text, flags=re.I)
    if c.get("handle"):
        text = re.sub(r"\[(?:CHANNEL )?HANDLE\]", c["handle"], text, flags=re.I)
    return text


# ---- 1. checklist --------------------------------------------------------------
def checklist(ep):
    d, problems = ep["data"], []
    words = len((d.get("script") or "").split())
    if not d.get("script"):
        problems.append("No script text.")
    elif not 70 <= words <= 160:
        problems.append(f"The script is {words} words; it should be about 110-130 to fit 30-50 seconds.")
    if not d.get("hook"):
        problems.append("No hook.")
    if not [s for s in d.get("sources") or [] if str(s.get("url", "")).startswith("http") and s.get("quote")]:
        problems.append("No source with a link and a supporting quote.")
    project = cp.get_project(ep["project_id"], with_text=False)
    for field in ("title", "description", "script", "hook"):
        left = PLACEHOLDER.findall(fill_placeholders(str(d.get(field) or ""), project))
        if left:
            problems.append(f"The {field} still has a placeholder: {', '.join(sorted(set(left)))}.")
    if ep["status"] not in ("approved", "rendered", "published"):
        problems.append(f"The script is {ep['status'].replace('_', ' ')}, not approved.")
    key = (str(d.get("place", "")).strip().lower(), str(d.get("year", "")).strip().lower())
    hook5 = " ".join((d.get("hook") or "").lower().split()[:5])
    for o in cp.list_episodes(ep["project_id"], limit=500):
        if o["id"] == ep["id"] or o["status"] == "rejected":
            continue
        od = o["data"]
        if key != ("", "") and (str(od.get("place", "")).strip().lower(), str(od.get("year", "")).strip().lower()) == key:
            problems.append(f"Same place and year as episode #{o['id']} ({o['title']}).")
        if hook5 and " ".join((od.get("hook") or "").lower().split()[:5]) == hook5:
            problems.append(f"The hook opens the same way as episode #{o['id']}: a repeated template.")
    return problems


# ---- 2. voice ------------------------------------------------------------------
def make_voice(text, wav, voice):
    import numpy as np
    import soundfile as sf
    from kokoro import KPipeline
    pipe = KPipeline(lang_code=voice[0], repo_id="hexgrad/Kokoro-82M")

    def run(speed):
        chunks, words, offset = [], [], 0.0
        for r in pipe(text, voice=voice, speed=speed):
            a = r.audio.numpy() if hasattr(r.audio, "numpy") else np.asarray(r.audio)
            for t in r.tokens or []:
                if t.start_ts is None:
                    continue
                if not re.search(r"\w", t.text):   # punctuation joins the word before it
                    if words:
                        words[-1]["w"] += t.text
                    continue
                words.append({"w": t.text, "s": offset + t.start_ts, "e": offset + t.end_ts})
            offset += len(a) / 24000
            chunks.append(a)
        return np.concatenate(chunks), words, offset

    audio, words, secs = run(1.0)
    if secs > MAX_SECONDS - 0.5:   # too long for a Short: read it a little faster, up to 1.25x
        speed = min(1.25, secs / (MAX_SECONDS - 1.0))
        say(f"  {secs:.1f}s is too long; re-reading at {speed:.2f}x")
        audio, words, secs = run(speed)
    sf.write(str(wav), audio, 24000)
    return secs, words


# ---- 3. images -----------------------------------------------------------------
def wikimedia(query, n):
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "generator": "search", "gsrnamespace": 6,
        "gsrsearch": f"{query} filetype:bitmap", "gsrlimit": 15, "prop": "imageinfo",
        "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 1800,
        "iiextmetadatafilter": "LicenseShortName|Artist|Credit|DateTimeOriginal"})
    pages = (fetch_json(url).get("query") or {}).get("pages") or {}
    out = []
    for p in sorted(pages.values(), key=lambda p: p.get("index", 99)):
        ii = (p.get("imageinfo") or [{}])[0]
        meta = ii.get("extmetadata") or {}
        licence = strip_html((meta.get("LicenseShortName") or {}).get("value"))
        if not licence.lower().startswith(PD_PREFIXES) or ii.get("mime") not in ("image/jpeg", "image/png"):
            continue
        if min(ii.get("width", 0), ii.get("height", 0)) < 500:
            continue
        if re.search(r"\b(LRO|crater|NASA|ESA|Hubble|JPL|Apollo \d+)\b", p["title"]):   # a namesake on the Moon, not the man
            continue
        out.append({"url": ii.get("thumburl") or ii.get("url"), "page": ii.get("descriptionurl"), "licence": licence,
                    "creator": strip_html((meta.get("Artist") or {}).get("value")) or "Unknown",
                    "title": p["title"].removeprefix("File:"), "archive": "Wikimedia Commons", "query": query})
        if len(out) >= n:
            break
    return out


def met(query, n):
    found = fetch_json("https://collectionapi.metmuseum.org/public/collection/v1/search?"
                       + urllib.parse.urlencode({"hasImages": "true", "q": query})).get("objectIDs") or []
    out = []
    for oid in found[:12]:
        try:
            o = fetch_json(f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{oid}")
        except Exception:
            continue
        if o.get("isPublicDomain") and (o.get("primaryImage") or o.get("primaryImageSmall")):
            out.append({"url": o.get("primaryImage") or o["primaryImageSmall"], "page": o.get("objectURL"),
                        "licence": "Public domain (The Met Open Access, CC0)", "creator": o.get("artistDisplayName") or "Unknown",
                        "title": o.get("title") or f"Met object {oid}", "archive": "The Metropolitan Museum of Art", "query": query})
            if len(out) >= n:
                break
    return out


def clean_query(q):
    """Calina sometimes names the archive in the query; the search wants only the subject."""
    q = re.sub(r"(?i)\b(wikimedia|commons|library of congress|met open access|public domain|cc0|image|photo)\b", " ", q)
    return re.sub(r"\s+", " ", q).strip() or q


def cover(img, w, h):
    from PIL import ImageOps
    return ImageOps.fit(img.convert("RGB"), (w, h), method=3, centering=(0.5, 0.42))


def gather_images(queries, folder, need):
    from PIL import Image
    folder.mkdir(parents=True, exist_ok=True)
    picked, seen = [], set()
    for round_ in range(2):   # first pass: the best match per query; second pass: fill up
        for q in queries:
            if len(picked) >= need:
                break
            for query in dict.fromkeys([clean_query(q), " ".join(clean_query(q).split()[:2])]):
                try:
                    cands = wikimedia(query, 3)
                except Exception as e:
                    say(f"  image search failed for '{query}': {type(e).__name__}")
                    continue
                cands = [c for c in cands if c["url"] not in seen][round_:round_ + 1] or [c for c in cands if c["url"] not in seen][:1]
                if not cands:
                    continue
                c = cands[0]
                seen.add(c["url"])
                try:
                    path = folder / f"{len(picked) + 1:02d}.jpg"
                    raw = folder / "_download"
                    raw.write_bytes(fetch(c["url"], timeout=60))
                    img = Image.open(raw)
                    img.load()
                    cover(img, int(W * 1.2), int(H * 1.2)).save(path, quality=92)
                    raw.unlink(missing_ok=True)
                    c["file"] = path.name
                    picked.append(c)
                    say(f"  image {len(picked)}: {c['title'][:70]} ({c['archive']}, {c['licence']})")
                    break
                except Exception as e:
                    say(f"  skipped an image ({type(e).__name__})")
    return picked


def fallback_card(folder, d):
    """No usable public-domain image: a plain sepia card with the place and year."""
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new("RGB", (int(W * 1.2), int(H * 1.2)), (52, 36, 20))
    dr = ImageDraw.Draw(img)
    font = ImageFont.truetype(r"C:\Windows\Fonts\georgiab.ttf", 120)
    dr.text((img.width / 2, img.height * 0.4), f"{d.get('place', '')}\n{d.get('year', '')}", font=font,
            fill=(233, 203, 140), anchor="mm", align="center")
    path = folder / "01.jpg"
    img.save(path, quality=92)
    return [{"file": path.name, "title": "Title card", "archive": "made by Agent HQ", "licence": "Own work", "creator": "Agent HQ",
             "page": "", "url": "", "query": ""}]


# ---- 4. render -----------------------------------------------------------------
def find_ffmpeg():
    p = getattr(settings, "FFMPEG", None) or shutil.which("ffmpeg")
    if p:
        return p
    hits = sorted(Path.home().glob("AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg*/ffmpeg-*/bin/ffmpeg.exe"))
    if hits:
        return str(hits[-1])
    raise Blocked("FFmpeg isn't installed. Run: winget install -e --id Gyan.FFmpeg")


def ass_time(t):
    t = max(0.0, t)
    return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"


def captions(words, path, total):
    """Groups of up to 3 words (14 characters), shown in time with the voice."""
    groups, cur = [], []
    for w in words:
        if cur and (len(cur) == 3 or len(" ".join(x["w"] for x in cur + [w])) > 14 or re.search(r"[.!?;:]$", cur[-1]["w"])):
            groups.append(cur)
            cur = []
        cur.append(w)
    if cur:
        groups.append(cur)
    lines = []
    for i, g in enumerate(groups):
        start = g[0]["s"]
        end = groups[i + 1][0]["s"] if i + 1 < len(groups) else min(total, g[-1]["e"] + 0.6)
        text = " ".join(x["w"] for x in g).upper().replace("{", "(").replace("}", ")")
        lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Cap,,0,0,0,,{text}")
    path.write_text("\n".join([
        "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}", "WrapStyle: 0", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
        "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, "
        "MarginV, Encoding",
        "Style: Cap,Arial Black,98,&H00FFFFFF,&H000000FF,&H00101010,&H96000000,0,0,0,0,100,100,1,0,1,8,4,2,60,60,600,1",
        "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text", *lines]) + "\n",
        encoding="utf-8-sig")


def render(ffmpeg, folder, images, secs):
    seg_dir = folder / "_segments"
    seg_dir.mkdir(exist_ok=True)
    total = secs + 0.5
    each = total / len(images)
    frames = max(1, int(each * FPS) + 1)
    step = 0.15 / frames
    listing = []
    for i, im in enumerate(images):
        z = f"min(1+{step:.6f}*on,1.15)" if i % 2 == 0 else f"max(1.15-{step:.6f}*on,1)"
        seg = seg_dir / f"seg{i:02d}.mp4"
        run([ffmpeg, "-y", "-loglevel", "error", "-loop", "1", "-framerate", str(FPS), "-i", str(folder / "images" / im["file"]),
             "-vf", f"scale={int(W * 1.5)}:{int(H * 1.5)},zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={FPS},"
                    f"eq=saturation=0.85,format=yuv420p",
             "-frames:v", str(frames), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", str(seg)])
        listing.append(f"file '{seg.name}'")
    (seg_dir / "list.txt").write_text("\n".join(listing) + "\n", encoding="utf-8")
    run([ffmpeg, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "../_video.mp4"],
        cwd=seg_dir)
    run([ffmpeg, "-y", "-loglevel", "error", "-i", "_video.mp4", "-i", "voice.wav",
         "-vf", "subtitles=captions.ass", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "160k", "-t", f"{min(total, 59.5):.2f}", "-movflags", "+faststart", "short.mp4"], cwd=folder)
    shutil.rmtree(seg_dir, ignore_errors=True)
    (folder / "_video.mp4").unlink(missing_ok=True)


def run(cmd, cwd=None):
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace",
                       creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if p.returncode != 0:
        raise Blocked("FFmpeg failed: " + (p.stderr or p.stdout).strip()[-400:])


# ---- 5. the whole job ----------------------------------------------------------
def render_episode(eid, voice):
    ep = cp.get_episode(int(eid))
    if not ep:
        raise Blocked(f"No episode {eid}.")
    problems = checklist(ep)
    if problems:
        raise Blocked("The checklist blocked this script: " + " ".join(problems))
    d = ep["data"]
    folder = CONTENT / f"project-{ep['project_id']}" / "videos" / f"ep-{ep['id']:03d}"
    folder.mkdir(parents=True, exist_ok=True)
    ffmpeg = find_ffmpeg()
    t0 = time.time()
    say(f"Episode #{ep['id']}: {ep['title']}")
    say("Voice...")
    secs, words = make_voice(d["script"], folder / "voice.wav", voice)
    say(f"  {secs:.1f} seconds, {len(words)} words")
    say("Images...")
    need = max(3, min(6, round(secs / 8)))
    images = gather_images(d.get("image_queries") or [f"{d.get('place', '')} {d.get('year', '')}"], folder / "images", need)
    if not images:
        say("  no public-domain image found: using a title card")
        images = fallback_card(folder / "images", d)
    captions(words, folder / "captions.ass", secs)
    say("Render...")
    render(ffmpeg, folder, images, secs)
    credits = [f"- {i['title']}, {i['creator']} ({i['archive']}, {i['licence']}) {i['page']}".rstrip() for i in images]
    project = cp.get_project(ep["project_id"], with_text=False)
    description = fill_placeholders((d.get("description") or "").strip(), project)
    if DISCLOSURE not in description:
        description += f"\n\n{DISCLOSURE}"
    description += "\n\nImages (public domain):\n" + "\n".join(credits)
    if d.get("hashtags"):
        description += "\n\n" + " ".join(d["hashtags"])
    (folder / "title.txt").write_text(fill_placeholders(d.get("title", ""), project)[:100] + "\n", encoding="utf-8")
    (folder / "description.txt").write_text(description + "\n", encoding="utf-8")
    (folder / "sources.txt").write_text(
        "SCRIPT SOURCES\n" + "\n".join(f"- {s.get('publisher', '')} {s.get('url', '')}\n  \"{s.get('quote', '')}\"" for s in d.get("sources") or [])
        + "\n\nIMAGES\n" + "\n".join(credits) + "\n", encoding="utf-8")
    (folder / "images.json").write_text(json.dumps(images, indent=2, ensure_ascii=False), encoding="utf-8")
    rel = folder.relative_to(ROOT).as_posix() + "/short.mp4"
    cp.update_episode(ep["id"], status="rendered", video_path=rel)
    say(f"Done in {time.time() - t0:.0f}s: {rel}")
    return {"episode": ep["id"], "title": ep["title"], "video": rel, "seconds": round(secs, 1), "images": len(images)}


# ---- v2: assemble the owner's OpenArt clips ------------------------------------------
def narration_words(d):
    return [w for s_ in d.get("shots") or [] for w in (s_.get("voice_line") or "").split()]


def checklist_v2(ep):
    d, problems = ep["data"], []
    shots = d.get("shots") or []
    if not 6 <= len(shots) <= 12:
        problems.append(f"The shot list has {len(shots)} shots; it should have 8-10.")
    words = len(narration_words(d))
    if not 60 <= words <= 140:
        problems.append(f"The narration is {words} words; it should be about 85-115 for 35-45 seconds.")
    if not [x for x in d.get("sources") or [] if str(x.get("url", "")).startswith("http") and x.get("quote")]:
        problems.append("No source with a link and a supporting quote.")
    project = cp.get_project(ep["project_id"], with_text=False)
    for field in ("title", "description"):
        left = PLACEHOLDER.findall(fill_placeholders(str(d.get(field) or ""), project))
        if left:
            problems.append(f"The {field} still has a placeholder: {', '.join(sorted(set(left)))}.")
    if ep["status"] not in ("approved", "rendered", "published"):
        problems.append(f"The script is {ep['status'].replace('_', ' ')}, not approved.")
    st = production.clip_status(ep)
    if st["missing"]:
        problems.append("Missing clips: " + ", ".join(f"shot{i:02d}" for i in st["missing"]) + f" (in {st['folder']}).")
    if not st["voice"]:
        problems.append(f"Missing the voice: save it as voice.mp3 (or voice01.mp3 ... per shot) in {st['folder']}.")
    return problems


def probe_seconds(ffmpeg, path):
    ffprobe = str(Path(ffmpeg).with_name("ffprobe.exe" if ffmpeg.lower().endswith(".exe") else "ffprobe"))
    p = subprocess.run([ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
                       capture_output=True, text=True, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    try:
        return float(p.stdout.strip())
    except ValueError:
        raise Blocked(f"Can't read {Path(path).name}: is it a real video or audio file?")


def build_voice(ffmpeg, ep, folder, words_count):
    """One clean voice.wav, slowed down if it's faster than the owner can follow. Returns (seconds, tempo applied)."""
    mode, src = production.find_voice(ep)
    raw = folder / "_voice_raw.wav"
    if mode == "one":
        run([ffmpeg, "-y", "-loglevel", "error", "-i", str(src), "-ac", "1", "-ar", "48000", str(raw)])
    else:   # one file per shot: join them with a short breath between lines
        listing = folder / "_voices.txt"
        parts = []
        for i in sorted(src):
            part = folder / f"_v{i:02d}.wav"
            run([ffmpeg, "-y", "-loglevel", "error", "-i", str(src[i]), "-ac", "1", "-ar", "48000",
                 "-af", "apad=pad_dur=0.18", str(part)])
            parts.append(f"file '{part.name}'")
        listing.write_text("\n".join(parts) + "\n", encoding="utf-8")
        run([ffmpeg, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listing.name, "-c", "copy", raw.name], cwd=folder)
    secs = probe_seconds(ffmpeg, raw)
    wpm = words_count / (secs / 60)
    tempo = 1.0
    if wpm > MAX_WPM:
        tempo = max(0.85, TARGET_WPM / wpm)
        say(f"  the voice reads at {wpm:.0f} words a minute: slowing it to {wpm * tempo:.0f}")
    run([ffmpeg, "-y", "-loglevel", "error", "-i", str(raw), "-af", f"atempo={tempo:.3f},loudnorm=I=-16:TP=-1.5:LRA=11",
         "-ar", "48000", str(folder / "voice.wav")])
    for f in folder.glob("_v*.wav"):
        f.unlink(missing_ok=True)
    raw.unlink(missing_ok=True)
    (folder / "_voices.txt").unlink(missing_ok=True)
    return probe_seconds(ffmpeg, folder / "voice.wav"), tempo, wpm


def norm(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())


def word_timings(ffmpeg, wav, script_words, secs):
    """A start/end for every script word. faster-whisper when installed; otherwise pauses + word length."""
    heard = []
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel("base.en", device="cpu", compute_type="int8")
        segments, _ = model.transcribe(str(wav), language="en", word_timestamps=True, vad_filter=False)
        heard = [(w.word.strip(), w.start, w.end) for seg in segments for w in (seg.words or [])]
        say(f"  timed {len(heard)} heard words with faster-whisper")
    except ImportError:
        say("  faster-whisper isn't installed: timing captions from the voice's pauses")
    except Exception as e:
        say(f"  faster-whisper failed ({type(e).__name__}): timing captions from the voice's pauses")
    out = [None] * len(script_words)
    if heard:
        import difflib
        a, b = [norm(w) for w in script_words], [norm(w) for w, _, _ in heard]
        for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
            for k in range(blk.size):
                _, st, en = heard[blk.b + k]
                out[blk.a + k] = [st, en]
    if not any(out):   # no recogniser: spread words over the speech, anchored on the pauses
        out = spread_by_pauses(ffmpeg, wav, script_words, secs)
    # fill words the recogniser missed, between their neighbours
    known = [i for i, t in enumerate(out) if t]
    for i in range(len(out)):
        if out[i]:
            continue
        prev = max([k for k in known if k < i], default=None)
        nxt = min([k for k in known if k > i], default=None)
        t0 = out[prev][1] if prev is not None else 0.0
        t1 = out[nxt][0] if nxt is not None else secs
        gap = [k for k in range((prev if prev is not None else -1) + 1, nxt if nxt is not None else len(out))]
        step = (t1 - t0) / max(1, len(gap))
        for j, k in enumerate(gap):
            out[k] = [t0 + j * step, t0 + (j + 1) * step]
        known = [i for i, t in enumerate(out) if t]
    return [{"w": w, "s": t[0], "e": t[1]} for w, t in zip(script_words, out)]


def spread_by_pauses(ffmpeg, wav, script_words, secs):
    p = subprocess.run([ffmpeg, "-i", str(wav), "-af", "silencedetect=noise=-35dB:d=0.22", "-f", "null", "-"],
                       capture_output=True, text=True, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", p.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", p.stderr)]
    speech, t = [], 0.0
    for a, b in zip(starts, ends):
        if a - t > 0.15:
            speech.append([t, a])
        t = b
    if secs - t > 0.15:
        speech.append([t, secs])
    speech = speech or [[0.0, secs]]
    total_speech = sum(b - a for a, b in speech)
    weights = [len(w) + 2 for w in script_words]
    per_unit = total_speech / sum(weights)
    out, seg, pos = [], 0, speech[0][0]
    for w in weights:
        dur = w * per_unit
        while seg < len(speech) - 1 and pos + dur > speech[seg][1] + 0.05:
            seg += 1
            pos = max(pos, speech[seg][0])
        out.append([pos, pos + dur])
        pos += dur
    return out


def cut_clip(ffmpeg, src, dst, seconds):
    """Fit one OpenArt clip to its narration: trim it, or stretch it (up to 1.3x) and hold the last frame."""
    length = probe_seconds(ffmpeg, src)
    k = 1.0 if length >= seconds else min(1.3, seconds / length)
    hold = max(0.0, seconds - length * k)
    vf = (f"setpts={k:.4f}*PTS,scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},format=yuv420p"
          + (f",tpad=stop_mode=clone:stop_duration={hold:.3f}" if hold > 0.01 else ""))
    run([ffmpeg, "-y", "-loglevel", "error", "-i", str(src), "-an", "-vf", vf, "-t", f"{seconds:.3f}",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", str(dst)])


def assemble_episode(eid):
    ep = cp.get_episode(int(eid))
    if not ep:
        raise Blocked(f"No episode {eid}.")
    if not production.is_v2(ep):
        raise Blocked("This script has no shot list: it's a v1 script (use render).")
    problems = checklist_v2(ep)
    if problems:
        raise Blocked(" ".join(problems))
    d = ep["data"]
    folder = production.episode_folder(ep)
    ffmpeg = find_ffmpeg()
    t0 = time.time()
    shots = sorted(d["shots"], key=lambda x: x.get("n", 0))
    words = narration_words(d)
    say(f"Episode #{ep['id']}: {ep['title']} ({len(shots)} shots, {len(words)} words)")
    say("Voice...")
    secs, tempo, wpm = build_voice(ffmpeg, ep, folder, len(words))
    if secs > MAX_SECONDS:
        raise Blocked(f"The narration is {secs:.0f} seconds at a clear pace; a Short must stay under 60. Shorten the script.")
    timed = word_timings(ffmpeg, folder / "voice.wav", words, secs)
    # each shot runs from its first word to the next shot's first word
    starts, i = [], 0
    for sh in shots:
        starts.append(timed[i]["s"] if i < len(timed) else secs)
        i += len((sh.get("voice_line") or "").split())
    starts[0] = 0.0
    total = min(secs + 0.5, 59.5)
    bounds = starts + [total]
    say("Clips...")
    clips = production.find_clips(ep)
    seg_dir = folder / "_segments"
    seg_dir.mkdir(exist_ok=True)
    listing = []
    for k, sh in enumerate(shots):
        dur = max(0.4, bounds[k + 1] - bounds[k])
        seg = seg_dir / f"seg{k:02d}.mp4"
        cut_clip(ffmpeg, clips[k + 1], seg, dur)
        listing.append(f"file '{seg.name}'")
    (seg_dir / "list.txt").write_text("\n".join(listing) + "\n", encoding="utf-8")
    run([ffmpeg, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "../_video.mp4"], cwd=seg_dir)
    captions(timed, folder / "captions.ass", secs)
    say("Assemble...")
    run([ffmpeg, "-y", "-loglevel", "error", "-i", "_video.mp4", "-i", "voice.wav", "-vf", "subtitles=captions.ass",
         "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
         "-t", f"{total:.2f}", "-movflags", "+faststart", "short.mp4"], cwd=folder)
    shutil.rmtree(seg_dir, ignore_errors=True)
    (folder / "_video.mp4").unlink(missing_ok=True)

    project = cp.get_project(ep["project_id"], with_text=False)
    description = fill_placeholders((d.get("description") or "").strip(), project).replace(DISCLOSURE, "").rstrip()
    if DISCLOSURE_V2 not in description:
        description += f"\n\n{DISCLOSURE_V2}"
    if d.get("hashtags") and not all(h in description for h in d["hashtags"]):
        description += "\n\n" + " ".join(d["hashtags"])
    (folder / "title.txt").write_text(fill_placeholders(d.get("title", ""), project)[:100] + "\n", encoding="utf-8")
    (folder / "description.txt").write_text(description + "\n", encoding="utf-8")
    (folder / "sources.txt").write_text(
        "SCRIPT SOURCES\n" + "\n".join(f"- {x.get('publisher', '')} {x.get('url', '')}\n  \"{x.get('quote', '')}\"" for x in d.get("sources") or [])
        + "\n\nVISUALS\nAI-generated by the owner in OpenArt (images + Kling 3.0 image-to-video) from these prompts:\n"
        + "\n".join(f"{sh.get('n')}. IMAGE: {sh.get('image_prompt', '')}\n   MOTION: {sh.get('motion_prompt', '')}" for sh in shots) + "\n",
        encoding="utf-8")
    prod = d.get("production") or {}
    log = folder.parent.parent / "production-log.csv"
    if not log.exists():
        log.write_text("date,episode,title,seconds,shots,words_per_minute,voice_tempo,credits,minutes,retakes\n", encoding="utf-8")
    with log.open("a", encoding="utf-8") as f:
        f.write(f"{time.strftime('%Y-%m-%d')},{ep['id']},\"{ep['title'].replace(chr(34), '')}\",{secs:.1f},{len(shots)},"
                f"{wpm * tempo:.0f},{tempo:.2f},{prod.get('credits', '')},{prod.get('minutes', '')},{prod.get('retakes', '')}\n")
    rel = folder.relative_to(ROOT).as_posix() + "/short.mp4"
    cp.update_episode(ep["id"], status="rendered", video_path=rel)
    say(f"Done in {time.time() - t0:.0f}s: {rel}")
    return {"episode": ep["id"], "title": ep["title"], "video": rel, "seconds": round(secs, 1), "images": len(shots),
            "wpm": round(wpm * tempo), "tempo": round(tempo, 2)}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["assemble", "render", "check"])
    ap.add_argument("episode", type=int)
    ap.add_argument("--voice", default=getattr(settings, "SHORTS_VOICE", "bm_george"))
    a = ap.parse_args()
    cp.init()
    try:
        if a.command == "check":
            ep = cp.get_episode(a.episode)
            problems = (checklist_v2(ep) if production.is_v2(ep) else checklist(ep)) if ep else [f"No episode {a.episode}."]
            print(json.dumps({"ok": not problems, "problems": problems}))
            return
        if a.command == "assemble":
            print("RESULT " + json.dumps(assemble_episode(a.episode)))
            return
        print("RESULT " + json.dumps(render_episode(a.episode, a.voice)))
    except Blocked as e:
        print("BLOCKED " + str(e))
        sys.exit(2)


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except Exception:
            pass
    main()
