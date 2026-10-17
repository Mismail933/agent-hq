"""Music videos for client projects (2.43.0): one edit file -> the finished video on the song, checked.

The plan of an idea is content/project-N/ideas/<idea>/edit.json (paths in it are relative to that idea's folder):
  {"song": "../../song/song.m4a", "song_from": 0, "end": 156.29, "fade_in": 1.6, "fade_out": 2.0,
   "lyrics": [{"in": 45.0, "out": 50.3, "text": "Wind moves low across the open plain"}, ...],
   "shots": [
     {"id": "01", "start": 0.0, "end": 13.54, "video": "shots/veo-01.mp4", "from": 0.0, "to": 10.0, "mirror": false},
     {"id": "06", "start": 55.16, "end": 60.95, "picture": "shots/06.jpg",
      "move": {"zoom": [1.04, 1.12], "focus": [0.80, 0.74], "drift": [0, 0]},
      "fx": {"dust": "warm", "n": 40, "fire": [0.80, 0.86, 230], "mist": [225, 232, 240], "mist_a": 0.3, "rain": false},
      "video_prompt": "what Gemini should make of the picture, when there is a video for it"}]}
A shot that starts before the previous one ends dissolves into it over the overlap; otherwise it is a cut on its start.
A video shot plays from `from` to `to` (default: as much as its slot needs at normal speed) stretched to its slot; slowing
it down uses motion interpolation. A picture shot gets a slow camera move and its effects (dust, mist, rain, firelight).

  python musicvideo.py render <edit.json> <out folder> [--quick] [--vertical] [--until S]
--quick: 960x540, no motion interpolation (a test in a few minutes). --vertical: also vertical.mp4 (9:16: the wide picture in
the middle over a blurred, darkened copy of itself, the lyrics under it). Writes wide.mp4, wide.phone.mp4 (720p, under
Telegram's 50 MB), review/sheet-NN.png (a frame every 2 s) and prints RESULT {json} or BLOCKED <reason>.
Runs in the video tools' Python (numpy, Pillow, certifi). The checks stop a render that has a gap, a missing shot, a blank stretch.
"""
import hashlib
import json
import math
import os
import random
import shutil
import ssl
import subprocess
import sys
import time
import urllib.request
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
FPS = 24
CODE = "mv-1"   # in every cache key: raise it when the look of a shot changes
WARM, COLD = (255, 214, 150), (215, 228, 255)
FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/oswald/Oswald%5Bwght%5D.ttf"   # SIL Open Font Licence
FONTS = Path.home() / ".agent-hq-anim" / "fonts"
MAX_SLOW, MAX_FAST, MAX_OVERLAP = 1.6, 0.5, 2.5


class Blocked(Exception):
    pass


def say(*a):
    print(*a, flush=True)


def ffmpeg():
    try:
        import shorts
        return shorts.find_ffmpeg()
    except Exception:   # noqa: BLE001
        hits = sorted(Path.home().glob("AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg*/ffmpeg-*/bin/ffmpeg.exe"))
        if hits:
            return str(hits[-1])
        p = shutil.which("ffmpeg")
        if not p:
            raise Blocked("FFmpeg isn't installed.")
        return p


FF = None
NOFLAGS = getattr(subprocess, "CREATE_NO_WINDOW", 0)


def run(args):
    p = subprocess.run([FF, "-v", "error", "-y", *map(str, args)], capture_output=True, text=True, encoding="utf-8",
                       errors="replace", creationflags=NOFLAGS)
    if p.returncode:
        raise Blocked("FFmpeg: " + (p.stderr or "failed").strip()[-300:])


def duration(path):
    probe = str(Path(FF).with_name("ffprobe" + (".exe" if FF.endswith(".exe") else "")))
    p = subprocess.run([probe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True, creationflags=NOFLAGS)
    try:
        return float(p.stdout.strip())
    except ValueError:
        raise Blocked(f"Can't read the length of {Path(path).name}.")


def fr(t):
    return int(round(float(t) * FPS))


# ---- the plan and its checks ------------------------------------------------------------------------------------
def load(edit_path):
    edit_path = Path(edit_path)
    plan = json.loads(edit_path.read_text(encoding="utf-8"))
    base = edit_path.parent
    shots = plan.get("shots") or []
    if not shots:
        raise Blocked("The edit has no shots.")
    problems = []
    end = float(plan.get("end") or max(s["end"] for s in shots))
    for s in shots:
        sid = s.get("id", "?")
        if not (s.get("video") or s.get("picture")):
            problems.append(f"shot {sid} has neither a video nor a picture")
            continue
        f = base / (s.get("video") or s.get("picture"))
        if not f.exists():
            problems.append(f"shot {sid}: {f.relative_to(base).as_posix()} is missing")
        if float(s["end"]) - float(s["start"]) < 0.4:
            problems.append(f"shot {sid} is shorter than 0.4 s")
    order = sorted(shots, key=lambda s: float(s["start"]))
    covered = np.zeros(fr(end), np.int8)
    for s in order:
        covered[max(0, fr(s["start"])):min(len(covered), fr(s["end"]))] += 1
    gaps = np.where(covered == 0)[0]
    if len(gaps):
        problems.append(f"nothing on screen at {gaps[0] / FPS:.2f} s" + (f" (and {len(gaps)} frames in all)" if len(gaps) > 1 else ""))
    if (covered > 2).any():
        problems.append(f"three shots overlap at {np.where(covered > 2)[0][0] / FPS:.2f} s")
    for a, b in zip(order, order[1:]):
        ov = float(a["end"]) - float(b["start"])
        if ov > MAX_OVERLAP:
            problems.append(f"shots {a.get('id')} and {b.get('id')} overlap for {ov:.1f} s (a dissolve is at most {MAX_OVERLAP} s)")
    return plan, base, order, end, problems


# ---- one shot -> its own clip at the output size ------------------------------------------------------------------------
def video_clip(job):
    s, base, out, W, H, quick = job
    src = base / s["video"]
    have = duration(src)
    slot = (fr(s["end"]) - fr(s["start"])) / FPS
    a = float(s.get("from", 0))
    b = float(s.get("to") or min(have, a + slot))
    b = min(b, have)
    if b - a < 0.3:
        raise Blocked(f"shot {s.get('id')}: the video has under 0.3 s left after {a} s")
    factor = slot / (b - a)
    if factor > MAX_SLOW or factor < MAX_FAST:
        raise Blocked(f"shot {s.get('id')}: its video would play at {1 / factor:.2f}x speed to fill {slot:.1f} s; give it a longer slot or another clip")
    vf = [f"trim=start={a}:end={b}", f"setpts=(PTS-STARTPTS)*{factor:.5f}"]
    if factor > 1.03 and not quick:
        vf.append(f"minterpolate=fps={FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1")
    if s.get("mirror"):
        vf.append("hflip")
    vf += [f"scale={W}:{H}:flags=lanczos", "unsharp=5:5:0.4", "format=yuv420p"]
    part = out.with_name(out.stem + ".part.mp4")   # renamed when complete: a stopped render never leaves a half clip in the cache
    run(["-i", src, "-an", "-vf", ",".join(vf), "-r", FPS, "-frames:v", fr(s["end"]) - fr(s["start"]),
         "-c:v", "libx264", "-crf", "16", "-preset", "veryfast" if quick else "medium", part])
    part.replace(out)
    return s.get("id")


def _color(v, default):
    if v in (None, False):
        return None
    if v == "warm" or v is True:
        return WARM
    if v == "cold":
        return COLD
    return tuple(v) if isinstance(v, (list, tuple)) else default


def picture_clip(job):
    s, base, out, W, H, quick = job
    frames = fr(s["end"]) - fr(s["start"])
    mv, fx = s.get("move") or {}, s.get("fx") or {}
    zoom, focus, drift = mv.get("zoom") or [1.0, 1.08], mv.get("focus") or [0.5, 0.5], mv.get("drift") or [0, 0]
    img = Image.open(base / s["picture"]).convert("RGB")
    iw, ih = img.size
    rnd = random.Random(int(hashlib.md5(str(s.get("id")).encode()).hexdigest()[:6], 16))
    dust = _color(fx.get("dust", "warm"), WARM)
    motes = [(rnd.random(), rnd.random(), 0.6 + rnd.random() * 1.8, rnd.random() * 6.28, 0.3 + rnd.random() * 0.7)
             for _ in range(int(fx.get("n", 40)))] if dust else []
    drops = [(rnd.random(), rnd.random(), 40 + rnd.random() * 50, 0.6 + rnd.random() * 0.8) for _ in range(220)] if fx.get("rain") else []
    k = W / 1920
    mist = None
    if fx.get("mist"):
        m = Image.new("L", (W * 2, H), 0)
        d = ImageDraw.Draw(m)
        for _ in range(70):
            x, y, r = rnd.random() * W * 2, H * (0.35 + rnd.random() * 0.6), (120 + rnd.random() * 260) * k
            d.ellipse([x - r * 1.8, y - r * 0.5, x + r * 1.8, y + r * 0.5], fill=int(60 + rnd.random() * 80))
        strength = float(fx.get("mist_a", 0.3))
        mist = m.filter(ImageFilter.GaussianBlur(70 * k)).point(lambda v: int(v * strength))
    part = out.with_name(out.stem + ".part.mp4")
    p = subprocess.Popen([FF, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-c:v", "libx264", "-crf", "16", "-preset", "veryfast" if quick else "medium", "-pix_fmt", "yuv420p", str(part)],
                         stdin=subprocess.PIPE, creationflags=NOFLAGS)
    for i in range(frames):
        u = i / max(1, frames - 1)
        e = u * u * (3 - 2 * u) * 0.5 + u * 0.5
        z = zoom[0] + (zoom[1] - zoom[0]) * e
        cw, ch = iw / z, ih / z
        cx, cy = focus[0] * iw + drift[0] * iw * e, focus[1] * ih + drift[1] * ih * e
        x0, y0 = min(max(cx - cw / 2, 0), iw - cw), min(max(cy - ch / 2, 0), ih - ch)
        sx, sy = cw / W, ch / H
        f = img.transform((W, H), Image.AFFINE, (sx, 0, x0, 0, sy, y0), resample=Image.BICUBIC)
        t = i / FPS
        if mist is not None:
            off = int((t * 28 * k) % W)
            f = Image.composite(Image.new("RGB", (W, H), _color(fx["mist"], COLD)), f, mist.crop((off, 0, off + W, H)))
        if fx.get("fire"):
            fxp, fyp, rr = fx["fire"]
            rr *= k
            kk = 0.5 + 0.5 * math.sin(i * 0.9) * math.sin(i * 0.37 + 1.3)
            glow = Image.new("L", (W, H), 0)
            gx, gy = (fxp * iw - x0) / sx, (fyp * ih - y0) / sy
            ImageDraw.Draw(glow).ellipse([gx - rr, gy - rr * 0.8, gx + rr, gy + rr * 0.8], fill=int(35 + 55 * kk))
            f = Image.composite(Image.blend(f, Image.new("RGB", (W, H), (255, 150, 60)), 0.35), f, glow.filter(ImageFilter.GaussianBlur(rr * 0.45)))
        if drops:
            layer = Image.new("L", (W, H), 0)
            d = ImageDraw.Draw(layer)
            for (rx, ry, ln, sp) in drops:
                y = (ry * H + t * 1400 * k * sp) % (H + 100 * k) - 50 * k
                x = (rx * W + t * 260 * k * sp) % W
                d.line([x, y, x - ln * k * 0.22, y - ln * k], fill=int(70 + 60 * sp), width=1)
            f = Image.composite(Image.new("RGB", (W, H), (205, 215, 230)), f, layer.filter(ImageFilter.GaussianBlur(0.6)))
        if motes:
            layer = Image.new("L", (W, H), 0)
            d = ImageDraw.Draw(layer)
            for (mx, my, r, ph, sp) in motes:
                x = (mx * W + t * 22 * k * sp + math.sin(t * 0.7 + ph) * 14 * k) % W
                y = (my * H - t * 9 * k * sp + math.cos(t * 0.5 + ph) * 8 * k) % H
                r *= max(0.6, k)
                d.ellipse([x - r, y - r, x + r, y + r], fill=max(0, int(90 + 80 * math.sin(t * 1.3 + ph))))
            f = Image.composite(Image.new("RGB", (W, H), dust), f, layer.filter(ImageFilter.GaussianBlur(1.1 * k)))
        p.stdin.write(f.tobytes())
    p.stdin.close()
    if p.wait():
        raise Blocked(f"shot {s.get('id')}: encoding its picture failed")
    part.replace(out)
    return s.get("id")


def shot_key(s, base, W, H, quick):
    src = base / (s.get("video") or s.get("picture"))
    st = src.stat()
    blob = json.dumps({k: v for k, v in s.items() if k not in ("note", "prompt", "video_prompt", "status")}, sort_keys=True)
    return hashlib.md5(f"{CODE}|{blob}|{st.st_size}|{int(st.st_mtime)}|{W}x{H}|{quick}|{fr(s['end']) - fr(s['start'])}".encode()).hexdigest()[:12]


# ---- lyrics ---------------------------------------------------------------------------------------------------------
def font_file():
    FONTS.mkdir(parents=True, exist_ok=True)
    f = FONTS / "Oswald-wght.ttf"
    if not f.exists():
        try:
            import certifi
            ctx = ssl.create_default_context(cafile=certifi.where())
        except Exception:   # noqa: BLE001
            ctx = None
        try:
            with urllib.request.urlopen(FONT_URL, timeout=60, context=ctx) as r:
                data = r.read()
            if data[:4] in (b"\x00\x01\x00\x00", b"true", b"OTTO"):
                f.write_bytes(data)
        except Exception as e:   # noqa: BLE001
            say(f"Couldn't download the lyrics font ({str(e)[:80]}); using a Windows font.")
    if f.exists():
        return f
    for alt in ("C:/Windows/Fonts/bahnschrift.ttf", "C:/Windows/Fonts/arialbd.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"):
        if Path(alt).exists():
            return Path(alt)
    return None


def line_image(text, size, max_w):
    """One lyric line as (rgb, alpha) numpy arrays: white capitals with letter spacing and a soft dark shadow."""
    ff = font_file()
    font = ImageFont.truetype(str(ff), size) if ff else ImageFont.load_default()
    try:
        font.set_variation_by_axes([600])
    except Exception:   # noqa: BLE001
        pass
    text = text.upper()
    sp = size * 0.05
    words = text.split()
    width = lambda s: sum(font.getlength(c) + sp for c in s) - sp   # noqa: E731
    lines, cur = [], ""
    for w in words:
        nxt = (cur + " " + w).strip()
        if width(nxt) > max_w and cur:
            lines.append(cur)
            cur = w
        else:
            cur = nxt
    lines.append(cur)
    lh = int(size * 1.3)
    pad = int(size * 0.8)
    Wd = int(max(width(l) for l in lines)) + pad * 2
    Hd = lh * len(lines) + pad * 2
    mask = Image.new("L", (Wd, Hd), 0)
    d = ImageDraw.Draw(mask)
    for n, l in enumerate(lines):
        x = (Wd - width(l)) / 2
        for c in l:
            d.text((x, pad + n * lh), c, font=font, fill=255)
            x += font.getlength(c) + sp
    shadow = np.asarray(mask.filter(ImageFilter.GaussianBlur(size * 0.28)), np.float32) / 255 * 0.85
    core = np.asarray(mask, np.float32) / 255
    alpha = np.clip(core + shadow * (1 - core), 0, 1)
    rgb = np.zeros((Hd, Wd, 3), np.float32)
    rgb[:] = 0
    rgb += (core / np.maximum(alpha, 1e-4))[..., None] * 255
    return rgb, alpha


def lyric_layers(lyrics, W, H, vertical=False):
    size = int((W * 0.06) if vertical else (H * 0.045))
    out = []
    for ln in lyrics:
        rgb, a = line_image(ln["text"], size, W * (0.86 if vertical else 0.84))
        out.append({"in": float(ln["in"]), "out": float(ln["out"]), "rgb": rgb, "a": a, "size": size})
    out.sort(key=lambda L: L["in"])
    for L, nxt in zip(out, out[1:] + [None]):   # a line is gone before the next one starts to appear: never two at once
        L["stop"] = min(L["out"] + 0.5, nxt["in"] - 0.35) if nxt else L["out"] + 0.5
    return out


def draw_lyrics(img, layers, t, W, H, bottom):
    for L in layers:
        stop = L.get("stop", L["out"] + 0.5)
        if L["in"] - 0.35 <= t <= stop:
            u = min(1.0, max(0.0, (t - (L["in"] - 0.35)) / 0.45))
            inn = u * u * (3 - 2 * u)
            fo = min(L["out"], stop - 0.2)   # the fade out starts when the line is sung, or earlier if the next line is close
            v = min(1.0, max(0.0, (t - fo) / max(0.05, stop - fo)))
            op = min(inn, 1 - v * v * (3 - 2 * v))
            if op <= 0.01:
                continue
            h, w = L["a"].shape
            x = int((W - w) / 2)
            y = int(H - bottom - h + L["size"] * 0.8 + (1 - inn) * L["size"] * 0.25)
            y0, y1, x0, x1 = max(0, y), min(H, y + h), max(0, x), min(W, x + w)
            if y1 <= y0 or x1 <= x0:
                continue
            a = (L["a"][y0 - y:y1 - y, x0 - x:x1 - x] * op)[..., None]
            img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * (1 - a) + L["rgb"][y0 - y:y1 - y, x0 - x:x1 - x] * a
    return img


# ---- the whole video ------------------------------------------------------------------------------------------------
def reader(path, W, H):
    return subprocess.Popen([FF, "-v", "error", "-i", str(path), "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-"],
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, creationflags=NOFLAGS)


def encoder(path, W, H, quick):
    return subprocess.Popen([FF, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                             "-c:v", "libx264", "-crf", "20", "-preset", "veryfast" if quick else "medium", "-pix_fmt", "yuv420p",
                             str(path)], stdin=subprocess.PIPE, creationflags=NOFLAGS)


def render(edit_path, out_dir, quick=False, vertical=False, until=None):
    global FF
    FF = ffmpeg()
    t0 = time.time()
    plan, base, shots, end, problems = load(edit_path)
    if until:
        end = min(end, float(until))
        shots = [s for s in shots if float(s["start"]) < end]
    if problems:
        raise Blocked("The edit isn't ready: " + "; ".join(problems[:6]))
    W, H = (960, 540) if quick else (1920, 1080)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    work = base / "_work"
    work.mkdir(exist_ok=True)
    segs, todo = [], []
    for s in shots:
        f = work / f"{s.get('id')}-{shot_key(s, base, W, H, quick)}.mp4"
        segs.append((s, fr(s["start"]), fr(s["end"]), f))
        if not f.exists():
            todo.append((video_clip if s.get("video") else picture_clip, (s, base, f, W, H, quick)))
    say(f"{len(shots)} shots, {len(todo)} to make, {len(shots) - len(todo)} kept from the last render")
    if todo:
        with Pool(min(4, os.cpu_count() or 2), initializer=_init_ff, initargs=(FF,)) as pool:
            for sid in pool.imap_unordered(_do, todo):
                say(f"  shot {sid} ready")
    total = fr(end)
    fade_in, fade_out = float(plan.get("fade_in", 1.6)), float(plan.get("fade_out", 2.0))
    lyrics = [l for l in (plan.get("lyrics") or []) if float(l["in"]) < end]
    lw = lyric_layers(lyrics, W, H)
    shade = np.zeros((H, 1, 1), np.float32)
    band = int(H * 0.28)
    shade[H - band:, 0, 0] = np.linspace(0, 0.55, band)
    shade_col = np.array([10, 4, 12], np.float32)
    silent_w = work / "_wide-silent.mp4"
    enc = encoder(silent_w, W, H, quick)
    VW, VH = (540, 960) if quick else (1080, 1920)
    if vertical:
        lv = lyric_layers(lyrics, VW, VH, vertical=True)
        silent_v = work / "_vertical-silent.mp4"
        encv = encoder(silent_v, VW, VH, quick)
        ph = int(VW * H / W)
        py = int((VH - ph) / 2 - VH * 0.04)
    open_r, last, dark = {}, {}, []
    size = W * H * 3
    for f in range(total):
        live = [sg for sg in segs if sg[1] <= f < sg[2]]
        frames = []
        for (s, a, b, src) in live:
            key = s.get("id")
            if key not in open_r:
                open_r[key] = reader(src, W, H)
            buf = open_r[key].stdout.read(size)
            if len(buf) == size:
                last[key] = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
            if key in last:
                frames.append((a, b, last[key]))
        for key in [k for k in open_r if not any(sg[0].get("id") == k for sg in live)]:
            open_r[key].stdout.close()
            open_r[key].wait()
            del open_r[key]
        if not frames:
            raise Blocked(f"no picture at {f / FPS:.2f} s")
        if len(frames) == 1:
            img = frames[0][2].astype(np.float32)
        else:
            (a1, b1, x1), (a2, b2, x2) = sorted(frames, key=lambda z: z[0])[:2]
            u = (f - a2 + 0.5) / max(1, b1 - a2)
            w = u * u * (3 - 2 * u)
            img = x1.astype(np.float32) * (1 - w) + x2.astype(np.float32) * w
        t = f / FPS
        if img.mean() < 6 and fade_in < t < end - fade_out:
            dark.append(t)
        g = max(0.0, min(1.0, t / fade_in if fade_in else 1, (end - t) / fade_out if fade_out else 1))
        clean = img
        img = img * (1 - shade) + shade_col * shade
        img = draw_lyrics(img, lw, t, W, H, H * 0.07)
        enc.stdin.write(np.clip(img * g, 0, 255).astype(np.uint8).tobytes())
        if vertical:
            small = Image.fromarray(np.clip(clean, 0, 255).astype(np.uint8))
            bg = small.resize((max(1, W // 16), max(1, H // 16)), Image.BILINEAR)
            cw = int(VH * W / H)
            bg = bg.resize((cw, VH), Image.BILINEAR).crop(((cw - VW) // 2, 0, (cw - VW) // 2 + VW, VH))
            v = np.asarray(bg, np.float32) * 0.45
            v[py:py + ph] = np.asarray(small.resize((VW, ph), Image.LANCZOS), np.float32)
            v = draw_lyrics(v, lv, t, VW, VH, VH * 0.17)
            encv.stdin.write(np.clip(v * g, 0, 255).astype(np.uint8).tobytes())
        if f % (FPS * 20) == 0:
            say(f"  {t:6.1f} s of {end:.1f}")
    for r in open_r.values():
        r.stdout.close()
        r.wait()
    enc.stdin.close()
    enc.wait()
    if vertical:
        encv.stdin.close()
        encv.wait()
    # blank stretches (over half a second of near-black outside the fades) stop the render
    runs, start, prev = [], None, None
    for t in dark:
        if prev is None or t - prev > 1.5 / FPS:
            if start is not None and prev - start >= 0.5:
                runs.append((start, prev))
            start = t
        prev = t
    if start is not None and prev - start >= 0.5:
        runs.append((start, prev))
    if runs:
        raise Blocked("blank picture at " + ", ".join(f"{a:.1f}-{b:.1f} s" for a, b in runs[:5]))
    song = (base / plan["song"]).resolve() if plan.get("song") else None
    if not song or not song.exists():
        raise Blocked("The song file isn't there: " + str(plan.get("song")))
    sf = float(plan.get("song_from", 0))
    af = f"apad,afade=t=out:st={max(0.0, end - fade_out):.2f}:d={fade_out:.2f}"   # apad: an edit longer than the song keeps its picture (silence after)
    outs = {}
    for name, silent in [("wide", silent_w)] + ([("vertical", silent_v)] if vertical else []):
        dst = out_dir / f"{name}.mp4"
        run(["-i", silent, "-ss", sf, "-t", f"{end:.3f}", "-i", song, "-map", "0:v", "-map", "1:a", "-af", af, "-c:v", "copy",
             "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", dst])
        outs[name] = dst
    phone = out_dir / "wide.phone.mp4"   # Telegram's bot limit is 50 MB, but a 43.7 MB file was refused: 720p sized for ~40 MB
    kb = int(min(2300, 40 * 8 * 1024 / max(end, 1) - 170))
    run(["-i", outs["wide"], "-vf", "scale=1280:720:flags=lanczos", "-c:v", "libx264", "-b:v", f"{kb}k", "-maxrate", f"{int(kb * 1.15)}k",
         "-bufsize", f"{kb * 2}k", "-preset", "medium", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", phone])
    rv = out_dir / "review"
    rv.mkdir(exist_ok=True)
    for old in rv.glob("sheet-*.png"):
        old.unlink()
    run(["-i", outs["wide"], "-vf", "fps=1/2,scale=384:-1,tile=5x4", rv / "sheet-%02d.png"])
    say("  measuring every frame (speed, stalls, cuts)...")
    motion = motion_report(outs["wide"], shots, end, rv)
    n_vid = sum(1 for s in shots if s.get("video"))
    res = {"ok": True, "wide": str(outs["wide"]), "vertical": str(outs.get("vertical", "")), "phone": str(phone),
           "seconds": round(end, 2), "shots": len(shots), "video_shots": n_vid, "picture_shots": len(shots) - n_vid,
           "made_now": len(todo), "quick": quick, "sheets": sorted(str(p) for p in rv.glob("sheet-*.png")),
           "minutes": round((time.time() - t0) / 60, 1), "motion": motion}
    return res


# ---- The motion report (2.46.0; the owner, 2026-10-17: "measure his work properly before telling me it's done") ----------------
MOTION_W, MOTION_H = 320, 180
STALL_RATIO, JUMP_RATIO, JOIN_RATIO = 0.45, 2.5, 1.8
FAST_MAX, SLOW_MIN = 1.15, 0.87         # a video shot played faster/slower than this is listed (sped-up clips looked fake to him)


def _motion_series(path, until):
    """Motion of every frame: optical flow (90th percentile, px/frame at 320 wide) when OpenCV is there, else frame difference."""
    try:
        import cv2
    except ImportError:
        cv2 = None
    p = subprocess.Popen([FF, "-v", "error", "-i", str(path), "-t", f"{until:.3f}", "-vf", f"scale={MOTION_W}:{MOTION_H}", "-f", "rawvideo",
                          "-pix_fmt", "gray", "-"], stdout=subprocess.PIPE)
    n = MOTION_W * MOTION_H
    prev, out = None, []
    while True:
        raw = p.stdout.read(n)
        if len(raw) < n:
            break
        cur = np.frombuffer(raw, np.uint8).reshape(MOTION_H, MOTION_W)
        if prev is not None:
            if cv2 is not None:
                f = cv2.calcOpticalFlowFarneback(prev, cur, None, 0.5, 3, 15, 3, 5, 1.2, 0)
                out.append(float(np.percentile(np.hypot(f[..., 0], f[..., 1]), 90)))
            else:
                out.append(float(np.abs(cur.astype(np.int16) - prev.astype(np.int16)).mean()) / 3.0)
        prev = cur
    p.wait()
    return np.array(out), ("optical flow" if cv2 is not None else "frame difference")


def motion_report(path, shots, end, rv, fps=None, series=None):
    """Speed curve of the finished video: per shot (median speed, unevenness, stalls), speed changes at cuts, sped-up or slowed shots.
    Writes review/motion.json + motion.png; returns {summary, warnings}. fps = the video's frame rate (the music videos' 24 if not
    given; the story videos are 30). series = an earlier run's per-frame motion, to redo the report without reading the video again."""
    fps = fps or FPS
    m, how = (np.array(series[0], float), series[1]) if series else _motion_series(path, end)
    if len(m) < 10:
        return {"summary": "too short to measure", "warnings": []}
    t = (np.arange(len(m)) + 1) / fps
    cuts = sorted({round(float(s["start"]), 3) for s in shots} | {round(float(s["end"]), 3) for s in shots})
    near_cut = lambda x: any(abs(x - c) < 1.5 / fps for c in cuts)
    def med(a, b):
        sel = m[(t >= a) & (t < b)]
        return float(np.median(sel)) if len(sel) else 0.0
    stalls, jumps = [], []
    for i in range(len(m)):
        nb = np.r_[m[max(0, i - 3):i], m[i + 1:i + 4]]
        ref = float(np.median(nb)) if len(nb) else 0.0
        if ref < 1.0 or near_cut(t[i]):
            continue
        if m[i] < STALL_RATIO * ref:
            stalls.append(round(float(t[i]), 2))
        elif m[i] > JUMP_RATIO * ref:
            jumps.append(round(float(t[i]), 2))
    per, joins, speed = [], [], []
    ordered = sorted(shots, key=lambda s: float(s["start"]))
    for k, s in enumerate(ordered):
        a, b = float(s["start"]), min(float(s["end"]), end)
        if k + 1 < len(ordered):
            b2 = min(b, float(ordered[k + 1]["start"]))   # leave out the dissolve into the next shot
        else:
            b2 = b
        sel = m[(t >= a + 0.1) & (t < b2 - 0.1)]
        lr = np.log(np.maximum(sel[1:], 0.05) / np.maximum(sel[:-1], 0.05)) if len(sel) > 2 else np.array([0.0])
        per.append({"id": s.get("id"), "start": round(a, 2), "end": round(b, 2), "speed_median": round(float(np.median(sel)), 2) if len(sel) else 0,
                    "unevenness": round(float(lr.std()), 3)})
        if s.get("video") and s.get("to") is not None:
            f = (float(s["to"]) - float(s.get("from", 0))) / max(1e-6, b - a) if b > a else 1.0
            if f > FAST_MAX or f < SLOW_MIN:
                speed.append({"id": s.get("id"), "at": round(a, 2), "factor": round(f, 2)})
        if k + 1 < len(ordered):
            c = float(ordered[k + 1]["start"])
            if c >= b - 1e-3 and c < end - 1:             # a straight cut (not a dissolve)
                l, r = med(c - 1.0, c - 0.1), med(c + 0.1, c + 1.0)
                if min(l, r) > 0.8 and max(l, r) / min(l, r) > JOIN_RATIO:
                    joins.append({"at": round(c, 2), "before": round(l, 2), "after": round(r, 2)})
    warns = []
    if stalls:
        warns.append(f"{len(stalls)} stall(s) (a frame that nearly stops while the picture moves): " + ", ".join(f"{x:.2f}s" for x in stalls[:8]))
    if jumps:
        warns.append(f"{len(jumps)} jump(s) inside a shot: " + ", ".join(f"{x:.2f}s" for x in jumps[:8]))
    for j in joins:
        warns.append(f"speed changes {max(j['before'], j['after']) / min(j['before'], j['after']):.1f}x at the cut {j['at']:.2f}s "
                     f"({j['before']} -> {j['after']})")
    for s in speed:
        warns.append(f"shot {s['id']} at {s['at']:.2f}s is played at {s['factor']}x ({'sped up' if s['factor'] > 1 else 'slowed'})")
    rough = [p for p in per if p["unevenness"] > 0.18 and p["speed_median"] > 1.0 and p["end"] - p["start"] > 1.5]
    for p in rough:
        warns.append(f"shot {p['id']} ({p['start']:.1f}-{p['end']:.1f}s) moves unevenly ({p['unevenness']}; a smooth clip is ~0.10)")
    summary = (f"measured every frame ({how}): median speed {float(np.median(m)):.2f}, {len(stalls)} stalls, {len(jumps)} jumps, "
               f"{len(joins)} speed changes at cuts, {len(speed)} sped-up/slowed shots, {len(rough)} uneven shots")
    (rv / "motion.json").write_text(json.dumps({"method": how, "summary": summary, "warnings": warns, "shots": per, "stalls": stalls,
                                                "jumps": jumps, "joins": joins, "speed": speed,
                                                "series": [round(float(x), 2) for x in m]}, indent=1), encoding="utf-8")
    try:   # the chart: speed of every frame, cuts as lines, problems marked
        Wc, Hc, L, B = 1600, 420, 50, 40
        im = Image.new("RGB", (Wc, Hc), (18, 18, 24))
        d = ImageDraw.Draw(im)
        top = max(6.0, float(np.percentile(m, 99)))
        X = lambda x: L + x / end * (Wc - L - 10)
        Y = lambda v: Hc - B - min(v, top) / top * (Hc - B - 20)
        for c in cuts:
            d.line([(X(c), 20), (X(c), Hc - B)], fill=(50, 50, 64))
        pts = [(X(x), Y(v)) for x, v in zip(t, m)]
        d.line(pts, fill=(120, 190, 255), width=1)
        for x in stalls:
            d.ellipse([X(x) - 6, Y(0.5) - 6, X(x) + 6, Y(0.5) + 6], outline=(255, 90, 90), width=2)
        for j in joins:
            d.line([(X(j["at"]), 20), (X(j["at"]), Hc - B)], fill=(255, 170, 60), width=2)
        for s in range(0, int(end) + 1, 15):
            d.text((X(s) - 10, Hc - B + 8), f"{s // 60}:{s % 60:02d}", fill=(200, 200, 200))
        d.text((L, 4), "speed of every frame; grey = cuts, orange = speed change at a cut, red = stall", fill=(220, 220, 220))
        im.save(rv / "motion.png")
    except Exception:
        pass
    return {"summary": summary, "warnings": warns}


def _init_ff(ff):
    global FF
    FF = ff


def _do(job):
    fn, args = job
    return fn(args)


def measure(edit_path, video, a=0.0, b=None):
    global FF
    FF = ffmpeg()
    plan, base, shots, end, problems = load(edit_path)
    rv = Path(video).parent / "review"
    rv.mkdir(exist_ok=True)
    return motion_report(video, shots, end if b is None else b, rv)


def main():
    if len(sys.argv) >= 4 and sys.argv[1] == "measure":
        print("RESULT " + json.dumps(measure(sys.argv[2], sys.argv[3])), flush=True)
        return 0
    if len(sys.argv) < 4 or sys.argv[1] != "render":
        print(__doc__)
        return 2
    args = sys.argv[2:]
    flags = {a for a in args if a.startswith("--")}
    pos = [a for a in args if not a.startswith("--")]
    until = None
    if "--until" in args:
        until = float(args[args.index("--until") + 1])
        pos = [p for p in pos if p != args[args.index("--until") + 1]]
    try:
        res = render(pos[0], pos[1], quick="--quick" in flags, vertical="--vertical" in flags, until=until)
    except Blocked as e:
        print("BLOCKED " + str(e), flush=True)
        return 1
    print("RESULT " + json.dumps(res), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
