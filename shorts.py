"""
Shorts pipeline: turns an approved script into a finished YouTube Short, ready for the owner to upload by hand.

    <video-tools python> shorts.py render <episode id> [--voice bm_george]
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
import settings  # noqa: E402

UA = "AgentHQ-Shorts/1.0 (POV Then History channel; https://github.com/Mismail933/agent-hq)"
W, H, FPS = 1080, 1920, 30
MAX_SECONDS = 58.0
DISCLOSURE = "AI-assisted: script and voice made with AI; facts sourced below."
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
        "Style: Cap,Arial Black,86,&H00FFFFFF,&H000000FF,&H00101010,&H78000000,0,0,0,0,100,100,1,0,1,7,3,2,70,70,560,1",
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
    description = (d.get("description") or "").strip()
    if DISCLOSURE not in description:
        description += f"\n\n{DISCLOSURE}"
    description += "\n\nImages (public domain):\n" + "\n".join(credits)
    if d.get("hashtags"):
        description += "\n\n" + " ".join(d["hashtags"])
    (folder / "title.txt").write_text(d.get("title", "")[:100] + "\n", encoding="utf-8")
    (folder / "description.txt").write_text(description + "\n", encoding="utf-8")
    (folder / "sources.txt").write_text(
        "SCRIPT SOURCES\n" + "\n".join(f"- {s.get('publisher', '')} {s.get('url', '')}\n  \"{s.get('quote', '')}\"" for s in d.get("sources") or [])
        + "\n\nIMAGES\n" + "\n".join(credits) + "\n", encoding="utf-8")
    (folder / "images.json").write_text(json.dumps(images, indent=2, ensure_ascii=False), encoding="utf-8")
    rel = folder.relative_to(ROOT).as_posix() + "/short.mp4"
    cp.update_episode(ep["id"], status="rendered", video_path=rel)
    say(f"Done in {time.time() - t0:.0f}s: {rel}")
    return {"episode": ep["id"], "title": ep["title"], "video": rel, "seconds": round(secs, 1), "images": len(images)}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["render", "check"])
    ap.add_argument("episode", type=int)
    ap.add_argument("--voice", default=getattr(settings, "SHORTS_VOICE", "bm_george"))
    a = ap.parse_args()
    cp.init()
    try:
        if a.command == "check":
            ep = cp.get_episode(a.episode)
            problems = checklist(ep) if ep else [f"No episode {a.episode}."]
            print(json.dumps({"ok": not problems, "problems": problems}))
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
