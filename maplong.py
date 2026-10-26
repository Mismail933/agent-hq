"""Bassel's long version (2026-10-26): parts of ~3 minutes, each a script.json (content/project-6/long/part-N/):
  short: [lines] = the validated short, re-voiced, WITHOUT its on-screen ending (MapShort noEnd), only in part 1
  story: [{text, view [lon, lat, scale], date, pins [[label, lon, lat, cue word]], fill [ISO3], river, arc, label}] = MapStory
FREE voice (Bassel: free only for now): Kokoro am_michael, line by line, word times from the assembly.
    python maplong.py part <folder>      (shorts venv) -> voice.wav, voice.json, short.mp4 / story.mp4, part.mp4, sheet.png
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import mapsample  # noqa: E402

SR = 24000
GAP_SHORT = {1: 1.0, 2: 1.1, 3: 0.55, 5: 0.35, 6: 0.3, 7: 0.7, 8: 0.45, 12: 0.5, 13: 0.25}
GAP_STORY = 0.45
MUSIC = Path.home() / ".agent-hq-anim" / "music" / "scott-buckley" / "convergence.mp3"


def voice(spec, folder):
    """Every line in Kokoro am_michael (cached per line), assembled with pauses; word times spread over each line's voiced span."""
    from kokoro import KPipeline
    pipe = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
    cache = folder / "_lines"
    cache.mkdir(exist_ok=True)
    texts = list(spec.get("short") or []) + [s["text"] for s in spec["story"]]
    n_short = len(spec.get("short") or [])
    seq, t, lines = [np.zeros(int(SR * 0.3), np.float32)], 0.3, []
    import hashlib
    for i, text in enumerate(texts):
        f = cache / (hashlib.sha1(("am_michael|1.0|" + text).encode()).hexdigest()[:16] + ".wav")
        if not f.exists():
            a = np.concatenate([np.asarray(r.audio, dtype=np.float32) for r in pipe(text, voice="am_michael", speed=1.0)])
            sf.write(f, a, SR)
        a, _ = sf.read(f, dtype="float32")
        env = np.convolve(np.abs(a), np.ones(240) / 240, mode="same")
        on = np.where(env > 0.01 * env.max())[0]
        a0, a1 = (max(0, on[0] - 600), min(len(a), on[-1] + 1200)) if len(on) else (0, len(a))
        a = a[a0:a1]
        dur = len(a) / SR
        lead = (on[0] - a0) / SR if len(on) else 0
        tail = (a1 - on[-1]) / SR if len(on) else 0
        toks = text.split()
        w = np.array([len(x) + 2 for x in toks], float)
        edges = np.concatenate([[0], np.cumsum(w) / w.sum()]) * (dur - lead - tail) + t + lead
        words = [[x, round(float(edges[k]), 3), round(float(edges[k + 1]), 3)] for k, x in enumerate(toks)]
        pause = 0.22 + (GAP_SHORT.get(i, 0) if i < n_short else GAP_STORY)
        if i == n_short - 1:
            pause = 0.9   # the short's last question, then the history begins
        lines.append({"text": text, "t0": round(t, 3), "t1": round(t + dur, 3), "words": words, "short": i < n_short})
        seq += [a, np.zeros(int(SR * pause), np.float32)]
        t += dur + pause
    seq.append(np.zeros(int(SR * 1.5), np.float32))
    sf.write(folder / "voice.wav", np.concatenate(seq), SR)
    (folder / "voice.json").write_text(json.dumps({"lines": lines, "seconds": round(t + 1.5, 2)}, indent=1), encoding="utf-8")
    return lines, t + 1.5


def _cue_time(line, word):
    w = re.sub(r"[^a-z]", "", (word or "").lower())
    for x in line["words"]:
        if w and re.sub(r"[^a-z]", "", x[0].lower()).startswith(w):
            return x[1]
    return line["t0"] + 0.3


def part(folder):
    folder = Path(folder)
    spec = json.loads((folder / "script.json").read_text(encoding="utf-8"))
    lines, total = voice(spec, folder)
    short = [l for l in lines if l["short"]]
    story = [l for l in lines if not l["short"]]
    animate = mapsample.ensure_app()
    clips = []
    if short:
        split = story[0]["t0"] - 0.3
        words = [w for l in short for w in l["words"]]
        cues = mapsample.cues_v2(words, {"move": "also", "arrive": "borders", "clp": "uninhabited", "link": "still"})
        props = {"cues": cues, "seconds": split, "km": {"deu": 448, "esp": 623, "bra": 730},
                 "source": "Lengths: Frontieres de la France (Wikipedia, French)", "unnamed": ["ker", "clp"], "noEnd": True}
        mapsample._remotion(animate, ["render", "src/index.jsx", "MapShort", str(folder / "short.mp4"), "--props=" + json.dumps(props),
                                      "--concurrency=2", "--crf=18", "--muted"])
        clips.append(folder / "short.mp4")
    else:
        split = 0.0
    beats = []
    for s, l in zip(spec["story"], story):
        b = {k: v for k, v in s.items() if k not in ("text", "pins")}
        b["t0"], b["t1"] = round(l["t0"] - split, 3), round(l["t1"] - split, 3)
        b["pins"] = [{"label": p[0], "ll": [p[1], p[2]], "at": round(_cue_time(l, p[3]) - split, 3)} for p in s.get("pins", [])]
        if s.get("label"):
            b["label"] = [s["label"][0], s["label"][1], s["label"][2]]
        beats.append(b)
    beats[0]["t0"] = 0.0
    secs = round(total - split, 2)
    mapsample._remotion(animate, ["render", "src/index.jsx", "MapStory", str(folder / "story.mp4"),
                                  "--props=" + json.dumps({"lines": beats, "seconds": secs}), "--concurrency=2", "--crf=18", "--muted"])
    clips.append(folder / "story.mp4")
    import shorts
    ff = shorts.find_ffmpeg()
    pic = folder / "picture.mp4"
    if len(clips) > 1:
        lst = folder / "_concat.txt"
        lst.write_text("".join(f"file '{c.as_posix()}'\n" for c in clips), encoding="utf-8")
        subprocess.run([ff, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(pic)], check=True)
    else:
        pic = clips[0]
    out = folder / "part.mp4"
    flt = (f"[1:a]loudnorm=I=-16:TP=-1.5,apad=whole_dur={total}[v];"
           f"[2:a]aloop=loop=-1:size=2e9,atrim=4:{4 + total},asetpts=N/SR/TB,afade=t=in:d=1.5,afade=t=out:st={total - 3}:d=3,loudnorm=I=-40:TP=-10[m];"
           "[v][m]amix=inputs=2:duration=first:normalize=0[a]")
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(pic), "-i", str(folder / "voice.wav"), "-i", str(MUSIC), "-filter_complex", flt,
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", str(total), str(out)], check=True)
    mapsample.sheet(out, folder / "sheet.png", every=3.0, cols=5)
    (folder / "beats.json").write_text(json.dumps(beats, indent=1), encoding="utf-8")
    print("PART", out, round(total, 1), "s")


if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "part":
        part(a[1])
    else:
        print(__doc__)
