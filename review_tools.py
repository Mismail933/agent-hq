"""
Eyes and ears for finished videos. Runs in the video tools' Python (~/.agent-hq-shorts, see settings.SHORTS_PYTHON) because
it needs Pillow and faster-whisper.

    <video-tools python> review_tools.py <episode id>

Writes next to the video, in content/project-N/videos/ep-NNN/review/:
    transcript.json   what is actually SAID, word by word, transcribed from the rendered audio (not from the script)
    sheet-01.png ...  contact sheets: one frame every second plus one at every scene change, each with its time and the
                      words spoken around it
Prints RESULT {json} with the paths. Anyone who can read images and text (Israa, Atlas) can then see and hear the video.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))
import control_plane as cp  # noqa: E402
import production  # noqa: E402
import shorts  # noqa: E402

NOFLAGS = getattr(subprocess, "CREATE_NO_WINDOW", 0)
COLS, ROWS = 5, 3          # frames per sheet: 15, so a 60 s video is 4-5 sheets
TILE_W, TILE_H, TEXT_H = 204, 362, 74


def scene_changes(ffmpeg, video):
    p = subprocess.run([ffmpeg, "-hide_banner", "-i", str(video), "-vf", "select='gt(scene,0.3)',showinfo", "-an", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace", creationflags=NOFLAGS)
    return [float(m) for m in re.findall(r"pts_time:([\d.]+)", p.stderr or "")]


def frame_times(secs, cuts):
    """Every second (at its midpoint) plus every scene change, closest duplicates merged. [(time, is_cut)]"""
    pts = [(i + 0.5, False) for i in range(int(secs))] + [(c + 0.1, True) for c in cuts if c < secs - 0.1]
    pts.sort()
    out = []
    for t, cut in pts:
        if out and t - out[-1][0] < 0.35:
            if cut:
                out[-1] = (out[-1][0], True)
            continue
        out.append((t, cut))
    return out


def transcribe(video, folder):
    from faster_whisper import WhisperModel
    model = WhisperModel("base.en", device="cpu", compute_type="int8")
    segs, info = model.transcribe(str(video), word_timestamps=True, language="en", vad_filter=False)
    words, text = [], []
    for s in segs:
        text.append(s.text.strip())
        for w in s.words or []:
            words.append({"w": w.word.strip(), "s": round(w.start, 2), "e": round(w.end, 2)})
    data = {"text": " ".join(text).strip(), "words": words, "seconds": round(info.duration, 1)}
    (folder / "transcript.json").write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    return data


def make_sheets(ffmpeg, video, folder, secs, words):
    from PIL import Image, ImageDraw, ImageFont
    for old in list(folder.glob("sheet-*.png")) + list(folder.glob("_f*.jpg")):
        old.unlink()
    times = frame_times(secs, scene_changes(ffmpeg, video))
    try:
        font = ImageFont.truetype("arialbd.ttf", 15)
        small = ImageFont.truetype("arial.ttf", 13)
    except OSError:
        font = small = ImageFont.load_default()
    tiles = []
    for t, cut in times:
        f = folder / f"_f{len(tiles):03d}.jpg"
        subprocess.run([ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", str(video), "-frames:v", "1",
                        "-vf", f"scale={TILE_W}:{TILE_H}", "-q:v", "3", str(f)], capture_output=True, creationflags=NOFLAGS)
        if f.exists():
            said = " ".join(w["w"] for w in words if t - 0.6 <= (w["s"] + w["e"]) / 2 <= t + 0.6)
            tiles.append((t, cut, f, said))
    per = COLS * ROWS
    sheets = []
    for n in range(0, len(tiles), per):
        chunk = tiles[n:n + per]
        sheet = Image.new("RGB", (COLS * (TILE_W + 6) + 6, ROWS * (TILE_H + TEXT_H + 6) + 6), (24, 24, 28))
        d = ImageDraw.Draw(sheet)
        for i, (t, cut, f, said) in enumerate(chunk):
            x, y = 6 + (i % COLS) * (TILE_W + 6), 6 + (i // COLS) * (TILE_H + TEXT_H + 6)
            sheet.paste(Image.open(f), (x, y))
            d.text((x + 2, y + TILE_H + 3), f"{t:5.1f}s" + ("  CUT" if cut else ""), font=font, fill=(255, 210, 90) if cut else (230, 230, 230))
            line, ty = "", y + TILE_H + 22
            for word in (said or "(silence)").split():
                if d.textlength(line + " " + word, font=small) > TILE_W - 4:
                    d.text((x + 2, ty), line.strip(), font=small, fill=(200, 220, 255))
                    line, ty = word, ty + 15
                    if ty > y + TILE_H + TEXT_H - 12:
                        line = ""
                        break
                else:
                    line += " " + word
            if line:
                d.text((x + 2, ty), line.strip(), font=small, fill=(200, 220, 255))
        out = folder / f"sheet-{n // per + 1:02d}.png"
        sheet.save(out)
        sheets.append(out)
    for _, _, f, _ in tiles:
        f.unlink(missing_ok=True)
    return sheets, len(tiles)


def main():
    ep = cp.get_episode(int(sys.argv[1]))
    if not ep or not ep["video_path"]:
        print("BLOCKED no video for that episode")
        return 1
    video = ROOT / ep["video_path"]
    folder = production.episode_folder(ep) / "review"
    folder.mkdir(parents=True, exist_ok=True)
    ffmpeg = shorts.find_ffmpeg()
    secs = shorts.probe_seconds(ffmpeg, video)
    data = transcribe(video, folder)
    sheets, n = make_sheets(ffmpeg, video, folder, secs, data["words"])
    print("RESULT " + json.dumps({"episode": ep["id"], "seconds": round(secs, 1), "frames": n, "words": len(data["words"]),
                                  "transcript": (folder / "transcript.json").relative_to(ROOT).as_posix(),
                                  "sheets": [s.relative_to(ROOT).as_posix() for s in sheets]}))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except shorts.Blocked as e:
        print(f"BLOCKED {e}")
        sys.exit(1)
