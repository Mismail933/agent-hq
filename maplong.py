"""Bassel's long version (2026-10-26): parts of ~3 minutes, each a script.json (content/project-6/long/part-N/):
  short: [lines] = the validated short, re-voiced, WITHOUT its on-screen ending (MapShort noEnd), only in part 1
  story: [{text, view [lon, lat, scale], date, pins [[label, lon, lat, cue word]], fill [ISO3], river, arc, label, ship, follow, event,
          hold}] = MapStory (hold = seconds of silence after the line, e.g. while an event scene plays)
FREE voice (Bassel: free only for now): Kokoro am_michael, line by line, word times from the assembly.
    python maplong.py part <folder>      (shorts venv) -> voice.wav, voice.json, short.mp4 / story.mp4, part.mp4, sheet.png
"""
import json
import os
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
GAP_SHORT = {1: 0.75, 2: 0.8, 3: 0.55, 5: 0.35, 6: 0.3, 7: 0.7, 8: 0.45, 12: 0.5, 13: 0.25}
# Bassel (10-27 11:34): the borders opening took 1:10 in the long version against 1:03 in his short: shorter pauses, the questions
# barely slowed, the rest a touch quicker
SHORT_GAP_SCALE = 0.55
SHORT_SPEED = 1.03
SHORT_Q_SPEED = 0.95
STORY_SPEED = 1.08
GAP_STORY = 0.32   # Bassel (10-26 20:50): the story a little faster
MUSIC = Path.home() / ".agent-hq-anim" / "music" / "scott-buckley" / "convergence.mp3"


def voice(spec, folder):
    """Every line in Kokoro am_michael (cached per line), assembled with pauses; word times spread over each line's voiced span."""
    from kokoro import KPipeline
    pipe = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
    cache = folder / "_lines"
    cache.mkdir(exist_ok=True)
    texts = list(spec.get("short") or []) + [s["text"] for s in spec["story"]]
    says = list(spec.get("short") or []) + [s.get("say") or s["text"] for s in spec["story"]]   # `say`: a respelling for Kokoro (names)
    n_short = len(spec.get("short") or [])
    holds = [0.0] * n_short + [float(s.get("hold") or 0) for s in spec["story"]]   # silence after a line, e.g. while an event scene plays
    seq, t, lines = [np.zeros(int(SR * 0.3), np.float32)], 0.3, []
    import hashlib
    for i, text in enumerate(texts):
        # Tarek (part 1): questions and the closing line were rushed: read them a little slower
        speed = SHORT_Q_SPEED if text.rstrip().endswith("?") else SHORT_SPEED
        if i >= n_short:   # the story (not the approved short): Bassel asked for a slightly faster pace
            speed = 0.96 if i == len(texts) - 1 else STORY_SPEED
            speed = float(spec["story"][i - n_short].get("speed") or speed)   # a line's own pace (Tarek: short key lines read too fast)
        f = cache / (hashlib.sha1(f"am_michael|{speed}|{says[i]}".encode()).hexdigest()[:16] + ".wav")
        if not f.exists():
            a = np.concatenate([np.asarray(r.audio, dtype=np.float32) for r in pipe(says[i], voice="am_michael", speed=speed)])
            sf.write(f, a, SR)
        a, _ = sf.read(f, dtype="float32")
        env = np.convolve(np.abs(a), np.ones(240) / 240, mode="same")
        on = np.where(env > 0.01 * env.max())[0]
        a0, a1 = (max(0, on[0] - 1900), min(len(a), on[-1] + 1900)) if len(on) else (0, len(a))   # 80 ms of air: no clipped first word
        a = a[a0:a1]
        dur = len(a) / SR
        lead = (on[0] - a0) / SR if len(on) else 0
        tail = (a1 - on[-1]) / SR if len(on) else 0
        toks = text.split()
        w = np.array([len(x) + 2 for x in toks], float)
        edges = np.concatenate([[0], np.cumsum(w) / w.sum()]) * (dur - lead - tail) + t + lead
        words = [[x, round(float(edges[k]), 3), round(float(edges[k + 1]), 3)] for k, x in enumerate(toks)]
        pause = 0.2 + (GAP_SHORT.get(i, 0) * SHORT_GAP_SCALE if i < n_short else GAP_STORY) + holds[i]
        if i == n_short - 1:
            pause = 0.7   # the short's last question, then the history begins
        lines.append({"text": text, "t0": round(t, 3), "t1": round(t + dur, 3), "words": words, "short": i < n_short})
        seq += [a, np.zeros(int(SR * pause), np.float32)]
        t += dur + pause
    seq.append(np.zeros(int(SR * 1.5), np.float32))
    sf.write(folder / "voice.wav", np.concatenate(seq), SR)
    (folder / "voice.json").write_text(json.dumps({"lines": lines, "seconds": round(t + 1.5, 2)}, indent=1), encoding="utf-8")
    return lines, t + 1.5


def _cue_time(line, word):
    # digits count too: a cue like "1976" used to become "" and fall back to the line's start (dates showed too early)
    w = re.sub(r"[^a-z0-9]", "", (word or "").lower())
    for x in line["words"]:
        if w and re.sub(r"[^a-z0-9]", "", x[0].lower()).startswith(w):
            return x[1]
    return line["t0"] + 0.3


def mix(folder):
    """Only the sound and the sheet again, on the already rendered picture.mp4 (or story.mp4)."""
    folder = Path(folder)
    v = json.loads((folder / "voice.json").read_text(encoding="utf-8"))
    pic = folder / "picture.mp4" if (folder / "picture.mp4").exists() else folder / "story.mp4"
    _mux(folder, pic, v["seconds"], v["lines"])


SWELL = 1.5   # the music x2.5 (+8 dB) where the narrator is silent for over 2 s (an event scene plays): Tarek, the 'holes'


def _mux(folder, pic, total, lines=()):
    import shorts
    ff = shorts.find_ffmpeg()
    out = folder / "part.mp4"
    gaps = [(a["t1"] + 0.3, b["t0"] - 0.2) for a, b in zip(lines, lines[1:]) if b["t0"] - a["t1"] > 2.0]
    lift = "+".join(f"clip(min(t-{a:.2f},{b:.2f}-t)/1.2,0,1)" for a, b in gaps) or "0"
    # the track is 3:40: two copies crossfaded make a seamless bed (it used to restart abruptly at 3:36)
    flt = (f"[1:a]loudnorm=I=-16:TP=-1.5,apad=whole_dur={total}[v];"
           "[2:a][3:a]acrossfade=d=6:c1=tri:c2=tri[ml];"
           f"[ml]atrim=4:{4 + total},asetpts=N/SR/TB,highpass=f=120,afade=t=in:d=1.5,afade=t=out:st={total - 3}:d=3,loudnorm=I=-40:TP=-9,"
           f"volume='1+{SWELL}*({lift})':eval=frame[m];"
           "[v][m]amix=inputs=2:duration=first:normalize=0[a]")
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(pic), "-i", str(folder / "voice.wav"), "-i", str(MUSIC), "-i", str(MUSIC),
                    "-filter_complex", flt, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", str(total), str(out)],
                   check=True)
    mapsample.sheet(out, folder / "sheet.png", every=3.0, cols=5)
    print("PART", out, round(total, 1), "s")


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
    if short and os.environ.get("HQ_KEEP_SHORT") == "1" and (folder / "short.mp4").exists():   # only the story section changed
        clips.append(folder / "short.mp4")
    elif short:
        words = [w for l in short for w in l["words"]]
        cues = mapsample.cues_v2(words, {"move": "also", "arrive": "borders", "clp": "uninhabited", "link": "still", "bars": "spanning", "final": "frances"}, missing_ok=True)
        props = {"cues": cues, "seconds": split, "km": {"deu": 448, "esp": 623, "bra": 730},
                 "source": "Lengths: Frontieres de la France (Wikipedia, French)", "unnamed": ["ker", "clp"], "noEnd": True}
        mapsample._remotion(animate, ["render", "src/index.jsx", "MapShort", str(folder / "short.mp4"), "--props=" + json.dumps(props),
                                      "--concurrency=2", "--crf=18", "--muted"])
        clips.append(folder / "short.mp4")
    else:
        split = 0.0
    # the part's real pictures (content/project-N/long/photos + credits.json) go into the app; each photo carries its size and credit
    import shutil
    from PIL import Image
    pdir = folder.parent / "photos"
    credits = json.loads((pdir / "credits.json").read_text(encoding="utf-8")) if (pdir / "credits.json").exists() else {}
    (mapsample.APP / "public" / "photos").mkdir(parents=True, exist_ok=True)
    icons = mapsample.APP / "public" / "icons"   # Microsoft Fluent Emoji, flat (MIT), for fx/shake
    icons.mkdir(parents=True, exist_ok=True)
    for name, dst in (("Crossed swords/Flat/crossed_swords_flat.svg", "crossed-swords.svg"), ("Handshake/Flat/handshake_flat.svg", "handshake.svg")):
        srcf = Path.home() / ".agent-hq-anim" / "fluent-emoji" / "assets" / name
        if srcf.exists() and not (icons / dst).exists():
            shutil.copy(srcf, icons / dst)
    beats = []
    for s, l in zip(spec["story"], story):
        cue = lambda w: round(_cue_time(l, w) - split, 3)
        b = {k: v for k, v in s.items() if k not in ("text", "pins")}
        b["t0"], b["t1"] = round(l["t0"] - split, 3), round(l["t1"] - split, 3)
        # pins [label, lon, lat, cue, offset?, until-cue?]; dates [[cue, text]]; labels [[text, lon, lat, cue]]; views [[cue, view]]
        b["pins"] = [{"label": p[0], "ll": [p[1], p[2]], "at": cue(p[3]), **({"off": p[4]} if len(p) > 4 and p[4] else {}),
                      **({"until": cue(p[5])} if len(p) > 5 else {})} for p in s.get("pins", [])]
        if s.get("dates"):
            b["dates"] = [[cue(w), txt] for w, txt in s["dates"]]
        if s.get("labels"):
            b["labels"] = [{"text": x[0], "ll": [x[1], x[2]], "at": cue(x[3])} for x in s["labels"]]
        if s.get("views"):
            b["views"] = [{"at": cue(w), "view": v} for w, v in s["views"]]
        if s.get("label"):
            b["label"] = [s["label"][0], s["label"][1], s["label"][2]]
        if s.get("tints"):   # [[cue, "HTI:free"]]: a filled place changes colour on its word
            b["tints"] = [{"at": cue(w), "code": c} for w, c in s["tints"]]
        if s.get("fx"):   # [["battle", cue, seconds, [[lon, lat], ...]]]: battles flare on the map while the narrator goes on
            b["fx"] = [{"kind": k, "at": cue(w), "dur": d, "pts": pts} for k, w, d, pts in s["fx"]]
        if s.get("shake"):   # {ll, flags, on}: a handshake over the area with both flags
            b["shake"] = {**s["shake"], "at": cue(s["shake"]["on"])}
        if s.get("ghost") and s["ghost"].get("on"):   # a country's outline carried inside another, on its word
            b["ghost"] = {**s["ghost"], "at": cue(s["ghost"]["on"])}
        if s.get("event"):   # an animated event scene (story app, FranceEvent) made beforehand into long/events/<key>.mp4
            src = folder.parent / "events" / f"{s['event']['key']}.mp4"
            (mapsample.APP / "public" / "events").mkdir(parents=True, exist_ok=True)
            shutil.copy(src, mapsample.APP / "public" / "events" / src.name)
        for slot in ("photo", "photo2"):   # photo2: a second print on its word (e.g. Saint-Louis after Pondicherry)
            if not s.get(slot):
                continue
            key = s[slot]["key"]
            src = pdir / f"{key}.jpg"
            shutil.copy(src, mapsample.APP / "public" / "photos" / src.name)
            c = credits.get(key, {})
            who = re.sub(r"\s+", " ", c.get("author") or "").strip()[:60]
            b[slot] = {"key": key, "caption": s[slot]["caption"], "size": list(Image.open(src).size), "side": s[slot].get("side", "right"),
                       "credit": f"{who + ', ' if who else ''}{c.get('licence', '')}, via Wikimedia Commons",
                       **({"at": cue(s[slot]["on"])} if s[slot].get("on") else {}), **({"until": cue(s[slot]["off"])} if s[slot].get("off") else {})}
        beats.append(b)
    beats[0]["t0"] = 0.0
    secs = round(total - split, 2)
    if os.environ.get("HQ_KEEP_STORY") == "1" and (folder / "story.mp4").exists():   # only the short section changed
        pass
    else:
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
    (folder / "beats.json").write_text(json.dumps(beats, indent=1), encoding="utf-8")
    _mux(folder, pic, total, lines)


if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "part":
        part(a[1])
    elif a and a[0] == "mix":
        mix(a[1])
    else:
        print(__doc__)
