"""
clipper.py (2.54.0): Shorts cut from a finished video (Atlas's request 2026-10-18, the owner: "let Omar make some shorts and show me").
Runs in the video tools' Python (~/.agent-hq-shorts, like review_tools.py: faster-whisper, Pillow, FFmpeg). The office starts it
(server.run_cut_shorts); Omar picks the moments in between (omar.pick_moments).

    <video-tools python> clipper.py transcript <video> <folder>   -> <folder>/transcript.json (what is said, word by word, from the audio)
    <video-tools python> clipper.py cut <plan.json>               -> clip-1.mp4 ... beside the plan

The plan (written by the office) = {video, words, moments [{n, title, start, end}], style {captions on|off, words, size, highlight,
end_seconds, end_text, channel}}. Each clip is 1080x1920: the picture whole in the middle over a blurred, darkened copy of itself,
big captions from the transcript under it (no re-voicing: the video's own sound), then an end card "Full story on the channel".
Prints RESULT {json}.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))
import shorts  # noqa: E402

W, H, FPS = 1080, 1920, 30
NOFLAGS = getattr(subprocess, "CREATE_NO_WINDOW", 0)
FONTS = ("arialbd.ttf", "Arial Bold.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf", "DejaVuSans-Bold.ttf")


def _font(size):
    from PIL import ImageFont
    for f in FONTS:
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


def _run(cmd, cwd=None):
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace", creationflags=NOFLAGS)
    if p.returncode != 0:
        raise shorts.Blocked("FFmpeg failed: " + ((p.stderr or "").strip().splitlines() or ["?"])[-1][:300])


def _size(ffmpeg, video):
    ffprobe = str(Path(ffmpeg).with_name("ffprobe.exe" if ffmpeg.lower().endswith(".exe") else "ffprobe"))
    p = subprocess.run([ffprobe, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0",
                        str(video)], capture_output=True, text=True, creationflags=NOFLAGS)
    try:
        w, h = (int(x) for x in p.stdout.strip().split(",")[:2])
        return w, h
    except ValueError:
        raise shorts.Blocked(f"Can't read the picture size of {Path(video).name}.")


def transcript(video, folder):
    import review_tools
    folder.mkdir(parents=True, exist_ok=True)
    data = review_tools.transcribe(video, folder)
    return {"transcript": (folder / "transcript.json").relative_to(ROOT).as_posix(), "words": len(data["words"]),
            "seconds": data["seconds"]}


def _ass(words, start, end, style, top, path):
    """Captions for one clip: groups of style.words words, the spoken word yellow (style.highlight), times relative to the clip."""
    ws = [w for w in words if w["s"] >= start - 0.05 and w["e"] <= end + 0.3 and str(w["w"]).strip()]
    groups, cur = [], []
    for w in ws:
        if cur and (len(cur) >= style["words"] or re.search(r"[.!?;:,]$", cur[-1]["w"])):
            groups.append(cur)
            cur = []
        cur.append(w)
    if cur:
        groups.append(cur)
    clean = lambda t: re.sub(r"[{}\\]", "", str(t)).upper()
    lines = []
    for i, g in enumerate(groups):
        g_end = min(end, groups[i + 1][0]["s"] if i + 1 < len(groups) else g[-1]["e"] + 0.5) - start
        for k, w in enumerate(g):
            s = w["s"] - start
            e = (g[k + 1]["s"] - start) if k + 1 < len(g) else g_end
            if not style["highlight"]:
                if k:
                    break
                s, e = g[0]["s"] - start, g_end
            text = " ".join(("{\\c&H0000D7FF&}" + clean(x["w"]) + "{\\c&H00FFFFFF&}") if (j == k and style["highlight"]) else clean(x["w"])
                            for j, x in enumerate(g))
            if e > s:
                lines.append(f"Dialogue: 0,{shorts.ass_time(max(0, s))},{shorts.ass_time(e)},Cap,,0,0,0,,{text}")
    path.write_text("\n".join([
        "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}", "WrapStyle: 0", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
        "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, "
        "MarginV, Encoding",
        f"Style: Cap,Arial Black,{style['size']},&H00FFFFFF,&H000000FF,&H00101010,&H96000000,0,0,0,0,100,100,1,0,1,7,3,8,70,70,{top},1",
        "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text", *lines]) + "\n",
        encoding="utf-8-sig")
    return len(groups)


def _card(ffmpeg, video, at, style, out):
    """The end card: a frame of the video blurred and darkened, the card's words and the channel's name over it."""
    from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
    shot = out.with_suffix(".frame.jpg")
    _run([ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-ss", f"{max(0, at):.2f}", "-i", str(video), "-frames:v", "1", str(shot)])
    im = Image.open(shot).convert("RGB")
    k = max(W / im.width, H / im.height)
    im = im.resize((int(im.width * k) + 1, int(im.height * k) + 1))
    im = im.crop(((im.width - W) // 2, (im.height - H) // 2, (im.width - W) // 2 + W, (im.height - H) // 2 + H))
    im = ImageEnhance.Brightness(im.filter(ImageFilter.GaussianBlur(28))).enhance(0.45)
    d = ImageDraw.Draw(im)
    big, small = _font(96), _font(64)
    y = 760
    for line in _wrap(d, style["end_text"].upper(), big, W - 160):
        d.text((W // 2, y), line, font=big, fill=(255, 255, 255), anchor="mm", stroke_width=6, stroke_fill=(16, 16, 16))
        y += 116
    if style.get("channel"):
        d.text((W // 2, y + 70), style["channel"], font=small, fill=(255, 215, 0), anchor="mm", stroke_width=5, stroke_fill=(16, 16, 16))
    im.save(out)
    shot.unlink(missing_ok=True)


def _headline(text, band, out):
    """The top band's title: lines split at '|', white and yellow in turn, as big as fits, sitting just above the picture."""
    from PIL import Image, ImageDraw
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    lines = [x.strip().upper() for x in text.split("|") if x.strip()]
    size = 104
    while size > 48 and max(d.textlength(x, font=_font(size)) for x in lines) > W - 100:
        size -= 4
    font, step = _font(size), int(size * 1.18)
    y = band - 70 - step * (len(lines) - 1)
    for i, x in enumerate(lines):
        d.text((W // 2, y + i * step), x, font=font, fill=(255, 255, 255) if i % 2 == 0 else (255, 215, 0), anchor="mm",
               stroke_width=8, stroke_fill=(16, 16, 16))
    im.save(out)


def _wrap(d, text, font, width):
    lines, cur = [], ""
    for word in text.split():
        if cur and d.textlength(cur + " " + word, font=font) > width:
            lines.append(cur)
            cur = word
        else:
            cur = (cur + " " + word).strip()
    return lines + ([cur] if cur else [])


def cut(plan_path):
    plan_path = Path(plan_path)
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    folder, style = plan_path.parent, plan["style"]
    video = ROOT / plan["video"]
    ffmpeg = shorts.find_ffmpeg()
    vw, vh = _size(ffmpeg, video)
    words = json.loads((ROOT / plan["words"]).read_text(encoding="utf-8"))["words"]
    # the picture fills the width (or the height, if it is taller than 9:16) in the middle; captions start under it
    fh = min(H, round(W * vh / vw / 2) * 2)
    top = min(H - 360, (H + fh) // 2 + 50)
    caps = style["captions"] == "on" or (style["captions"] == "auto" and vw > vh)   # a vertical video has its own captions
    out = []
    for m in plan["moments"]:
        n, start, end = m["n"], float(m["start"]), float(m["end"])
        dur = end - start
        name = f"clip-{n}"
        vf = (f"[0:v]split=2[a][b];[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},boxblur=30:2,"
              f"eq=brightness=-0.18[bg];[b]scale={W}:{H}:force_original_aspect_ratio=decrease[fg];"
              f"[bg][fg]overlay=(W-w)/2:(H-h)/2,fps={FPS},setsar=1")
        if style.get("headline"):   # a title in the top band, for the whole clip (Israa on the Yamaguchi Short: no hook in the first seconds)
            _headline(style["headline"], (H - fh) // 2, folder / f"{name}-head.png")
            vf = vf.replace("[bg][fg]overlay=(W-w)/2:(H-h)/2,", f"[bg][fg]overlay=(W-w)/2:(H-h)/2[pic];[pic][{3 if float(style.get('end_seconds') or 0) > 0 else 1}:v]overlay=0:0,")
        if caps and _ass(words, start, end, style, top, folder / f"{name}.ass"):
            vf += f",subtitles={name}.ass"   # a plain name: the clip runs with cwd = its folder (Windows paths break the filter)
        vf += f",format=yuv420p[v0];[0:a]aresample=48000,aformat=channel_layouts=stereo,afade=t=out:st={max(0, dur - 0.35):.2f}:d=0.35[a0]"
        cmd = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-ss", f"{start:.2f}", "-t", f"{dur:.2f}", "-i", str(video)]
        card = float(style.get("end_seconds") or 0)
        if card > 0:
            _card(ffmpeg, video, end - 0.2, style, folder / f"{name}-card.png")
            cmd += ["-loop", "1", "-framerate", str(FPS), "-t", f"{card:.2f}", "-i", f"{name}-card.png",
                    "-f", "lavfi", "-t", f"{card:.2f}", "-i", "anullsrc=r=48000:cl=stereo"]
        if style.get("headline"):
            cmd += ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.2f}", "-i", f"{name}-head.png"]
            vf += (f";[1:v]scale={W}:{H},fps={FPS},setsar=1,format=yuv420p,fade=t=in:d=0.3[v1];"
                   "[2:a]aformat=channel_layouts=stereo[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]")
            maps = ["-map", "[v]", "-map", "[a]"]
        else:
            maps = ["-map", "[v0]", "-map", "[a0]"]
        _run(cmd + ["-filter_complex", vf, *maps, "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-c:a", "aac", "-b:a", "160k",
                    "-movflags", "+faststart", f"{name}.mp4"], cwd=folder)
        for junk in (folder / f"{name}-card.png", folder / f"{name}-head.png"):
            junk.unlink(missing_ok=True)
        f = folder / f"{name}.mp4"
        out.append({"n": n, "title": m.get("title", ""), "start": start, "end": end, "file": f.relative_to(ROOT).as_posix(),
                    "seconds": round(shorts.probe_seconds(ffmpeg, f), 1), "mb": round(f.stat().st_size / 1e6, 1)})
    return {"clips": out, "captions": caps}


def main():
    if len(sys.argv) >= 4 and sys.argv[1] == "transcript":
        print("RESULT " + json.dumps(transcript(ROOT / sys.argv[2], ROOT / sys.argv[3])))
        return 0
    if len(sys.argv) >= 3 and sys.argv[1] == "cut":
        print("RESULT " + json.dumps(cut(ROOT / sys.argv[2])))
        return 0
    print("BLOCKED use: clipper.py transcript <video> <folder> | cut <plan.json>")
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except shorts.Blocked as e:
        print(f"BLOCKED {e}")
        sys.exit(1)
