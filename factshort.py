"""Bassel's one-minute fact Shorts, remade (2026-11-13; his notes of 11-11 23:18: "the videos are very bad ... more movement, add real
videos or create your own ... a bit more fun ... dont use the same style ... use the voice of michael"; 23:19: "change the background
music"). Vertical 1080x1920, composition FactShort (maps/src/FactShort.jsx): moving footage in every shot, cut on the words.

script.json: {title, music: <file in ~/.agent-hq-anim/music/...>, music_lufs, speed, hook: {text: "LINE|LINE", dur},
              lines: [{text, say?, shots: [{src: "footage/x.mp4"|"photos/x.jpg", on?: cue word, from?, rate?, zoom?, fx?, fy?, ai?, tag?}],
                       pops: [{text, sub?, on: cue word, dur?, y?, color?, size?}]}]}
  src is relative to content/project-6/long/ (footage/, photos/, ai-clips/...). A shot runs from its cue to the next shot.
FREE voice only (Bassel 11-11: never a paid voice unless he asks): Kokoro am_michael. Captions take their times from faster-whisper.
    python factshort.py make <folder>     (shorts venv) -> voice.wav, voice.json, picture.mp4, short.mp4, sheet.png
"""
import difflib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import mapsample  # noqa: E402
import maplong  # noqa: E402

FPS = 30
SFX = ROOT / "content" / "audio-kit" / "sfx"
if not SFX.exists():   # run from the dev clone: the sound kit lives in the install
    SFX = Path.home() / "Downloads" / "agent-hq-core" / "agent-hq-core" / "content" / "audio-kit" / "sfx"


def _tok(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())


def align(folder, lines):
    """Script words at the times faster-whisper hears them (Kokoro's own times are spread evenly and drift)."""
    from faster_whisper import WhisperModel
    m = WhisperModel("base.en", device="cpu", compute_type="int8")
    segs, _ = m.transcribe(str(folder / "voice.wav"), word_timestamps=True, vad_filter=False, condition_on_previous_text=False)
    heard = [(w.word.strip(), w.start, w.end) for s in segs for w in s.words]
    script = [(w, l_i) for l_i, l in enumerate(lines) for w in l["text"].split()]
    A, B = [_tok(w) for w, _ in script], [_tok(h[0]) for h in heard]
    times = [None] * len(script)
    for blk in difflib.SequenceMatcher(None, A, B, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            times[blk.a + k] = (heard[blk.b + k][1], heard[blk.b + k][2])
    # unheard words: spread between their heard neighbours (inside their own line)
    out, i = [], 0
    for l_i, l in enumerate(lines):
        idx = [k for k, (_, li) in enumerate(script) if li == l_i]
        ws = []
        for j, k in enumerate(idx):
            if times[k] is None:
                prev = next((times[q][1] for q in reversed(idx[:j]) if times[q]), l["t0"])
                nxt = next((times[q][0] for q in idx[j + 1:] if times[q]), l["t1"])
                gap = [q for q in idx if q >= k and times[q] is None and q < (next((q2 for q2 in idx[j + 1:] if times[q2]), idx[-1] + 1))]
                step = (nxt - prev) / (len(gap) + 1)
                times[k] = (prev + step * 0.2, prev + step)
            ws.append([script[k][0], round(times[k][0], 3), round(times[k][1], 3)])
        l["words"] = ws
        out += ws
    print("ALIGN", sum(1 for t in times if t), "of", len(times), "words heard", flush=True)
    return out


def cue(line, word):
    w = _tok(word or "")
    for x in line["words"]:
        if w and _tok(x[0]).startswith(w):
            return x[1]
    return line["t0"]


def make(folder):
    folder = Path(folder)
    L = folder.parent
    spec = json.loads((folder / "script.json").read_text(encoding="utf-8"))
    vspec = {"story": [{"text": l["text"], **({"say": l["say"]} if l.get("say") else {}), **({"speed": l["speed"]} if l.get("speed") else {})}
                       for l in spec["lines"]], "story_speed": spec.get("speed", 1.1), "story_gap": spec.get("gap", 0.15)}
    lines, total = maplong.voice(vspec, folder)
    words = align(folder, lines)
    (folder / "voice.json").write_text(json.dumps({"lines": lines, "seconds": total}, indent=1), encoding="utf-8")
    animate = mapsample.ensure_app()
    pub = mapsample.APP / "public" / "fs"
    pub.mkdir(parents=True, exist_ok=True)
    shots, pops = [], []
    for s, l in zip(spec["lines"], lines):
        for j, sh in enumerate(s.get("shots") or []):
            src = L / sh["src"]
            dst = pub / src.name
            if not dst.exists() or dst.stat().st_size != src.stat().st_size:
                shutil.copy(src, dst)
            a = l["t0"] - 0.05 if (j == 0 and not sh.get("on")) else cue(l, sh.get("on"))
            shots.append({**{k: v for k, v in sh.items() if k not in ("src", "on")}, "src": f"fs/{src.name}", "a": round(max(0.0, a), 3),
                          "kind": "photo" if src.suffix.lower() in (".jpg", ".png") else "video"})
        for p in s.get("pops") or []:
            a = cue(l, p.get("on"))
            pops.append({**{k: v for k, v in p.items() if k not in ("on", "dur")}, "a": round(a, 3), "b": round(a + float(p.get("dur", 2.2)), 3)})
    shots.sort(key=lambda x: x["a"])
    shots[0]["a"] = 0.0
    for x, y in zip(shots, shots[1:]):
        x["b"] = y["a"]
    shots[-1]["b"] = total
    hook = spec.get("hook")
    props = {"seconds": total, "shots": shots, "pops": pops, "words": words, **({"hook": {"text": hook["text"], "b": hook.get("dur", 2.4)}} if hook else {})}
    pf = folder / "_props.json"
    pf.write_text(json.dumps(props), encoding="utf-8")
    (folder / "beats.json").write_text(json.dumps(props, indent=1), encoding="utf-8")
    pic = folder / "picture.mp4"
    if "--stills" in sys.argv:
        for t in [float(x) for x in sys.argv[sys.argv.index("--stills") + 1].split(",")]:
            mapsample._remotion(animate, ["still", "src/index.jsx", "FactShort", str(folder / f"still-{t:05.1f}.png"), f"--frame={int(t * FPS)}", "--props=" + str(pf)])
        print("STILLS done")
        return
    mapsample._remotion(animate, ["render", "src/index.jsx", "FactShort", str(pic), "--props=" + str(pf), "--concurrency=2", "--crf=18", "--muted"])
    mux(folder, spec, props, total)


def mux(folder, spec, props, total):
    import shorts
    ff = shorts.find_ffmpeg()
    music = Path(spec["music"]).expanduser()
    # a whoosh on every cut after the first, a pop on every pop; quiet, under the voice
    cues = [("whoosh", s["a"], -24) for s in props["shots"][1:]] + [("pop", p["a"], -20) for p in props["pops"]]
    ins = ["-i", str(folder / "picture.mp4"), "-i", str(folder / "voice.wav"), "-stream_loop", "-1", "-i", str(music)]
    flt = [f"[1:a]aresample=48000,loudnorm=I=-15:TP=-1.5,apad=whole_dur={total}[v]",
           f"[2:a]aresample=48000,atrim=0:{total},asetpts=N/SR/TB,afade=t=in:d=0.6,afade=t=out:st={total - 2.5}:d=2.5,loudnorm=I={spec.get('music_lufs', -27)}:TP=-6[m]"]
    mixin = ["[v]", "[m]"]
    for k, (name, t, db) in enumerate(cues):
        f = SFX / f"{name}.mp3"
        if not f.exists():
            continue
        ins += ["-i", str(f)]
        idx = sum(1 for x in ins if x == "-i") - 1
        ms = int(max(0, t - (0.15 if name == "whoosh" else 0.0)) * 1000)
        flt.append(f"[{idx}:a]aresample=48000,volume={db}dB,adelay={ms}|{ms}[x{k}]")
        mixin.append(f"[x{k}]")
    flt.append(f"{''.join(mixin)}amix=inputs={len(mixin)}:duration=first:normalize=0,alimiter=limit=0.95[a]")
    out = folder / "short.mp4"
    subprocess.run([ff, "-y", "-loglevel", "error", *ins, "-filter_complex", ";".join(flt), "-map", "0:v", "-map", "[a]", "-c:v", "copy",
                    "-c:a", "aac", "-b:a", "192k", "-t", str(total), str(out)], check=True)
    mapsample.sheet(out, folder / "sheet.png", every=2.0, cols=8)
    print("SHORT", out, round(total, 1), "s")


if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "make":
        make(a[1])
    elif a and a[0] == "mux":
        f = Path(a[1])
        spec = json.loads((f / "script.json").read_text(encoding="utf-8"))
        props = json.loads((f / "_props.json").read_text(encoding="utf-8"))
        mux(f, spec, props, props["seconds"])
    else:
        print(__doc__)
