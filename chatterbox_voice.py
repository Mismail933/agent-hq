"""
Chatterbox, the free storytelling voice (2.64.0; the owner 2026-10-21, after 8 samples of the Megalodon opening: "go with chatter box
am micheal"). Chatterbox Nano (Resemble AI, MIT; github.com/resemble-ai/chatterbox, model ResembleAI/chatterbox-nano) runs on this PC's
CPU in its own Python (~/.agent-hq-anim/chatterbox/.venv: chatterbox-tts 0.1.7, torch 2.6 CPU, setuptools<81 for its watermarker).
It copies a voice from a ~10 s clip; our clips are made with our own Kokoro voices (Apache 2.0, synthetic), so no real person's voice
is copied. Every take carries Resemble's inaudible Perth watermark (marks it as AI-made; never removed).

    python chatterbox_voice.py setup      the venv + the Nano files (~2 GB of model, ~1 GB of tools; ask the owner before a fresh one)
    python chatterbox_voice.py ref <kokoro voice>     the reference clip (video tools' Python: Kokoro)

story_sample.py (spec "voice": "chatterbox:<kokoro voice>") calls `speak(jobs, out_dir, ref)`, which runs chatter_tts.py in the venv.
Speed on this PC (i7-8550U): ~5x slower than real time, so a 20-minute narration takes ~2 hours.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
HOME = Path.home() / ".agent-hq-anim" / "chatterbox"
VENV = HOME / ".venv"
MODEL = HOME / "models" / "nano"
REFS = HOME / "refs"
REPO = "ResembleAI/chatterbox-nano"
FILES = ["t3_nano_v1.safetensors", "t3_nano_v1.yaml", "s3gen_meanflow.safetensors", "ve.safetensors", "conds.pt", "*.json", "merges.txt",
         "README.md"]
PACKAGES = ["chatterbox-tts==0.1.7", "setuptools<81"]
MODEL_TAG = "nano-v1"   # part of every take's cache key: a new model = new takes
REF_TEXT = ("For thousands of years, sailors have told stories about the deep. Some of those stories were wrong. "
            "But a few of them, it turns out, were closer to the truth than anyone believed.")
REF_SPEED = 0.95


class NotReady(RuntimeError):
    pass


def python():
    return VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def ready():
    return python().exists() and (MODEL / "t3_nano_v1.safetensors").exists() and (MODEL / "s3gen_meanflow.safetensors").exists()


def setup():
    """Make the venv and fetch the model files. Downloads ~3 GB: only when the owner said yes."""
    if not python().exists():
        HOME.mkdir(parents=True, exist_ok=True)
        subprocess.run([sys.executable, "-m", "venv", str(VENV)], check=True)
        subprocess.run([str(python()), "-m", "pip", "install", "--disable-pip-version-check", "-q", *PACKAGES], check=True)
    if not ready():
        code = ("from huggingface_hub import snapshot_download; import sys, json; "
                "snapshot_download(repo_id=sys.argv[1], local_dir=sys.argv[2], allow_patterns=json.loads(sys.argv[3]))")
        subprocess.run([str(python()), "-I", "-c", code, REPO, str(MODEL), json.dumps(FILES)], check=True)
    return ready()


def ensure_ref(voice):
    """The ~10 s reference clip in one of our Kokoro voices (made once; needs Kokoro, i.e. the video tools' Python)."""
    f = REFS / f"{voice}.wav"
    if f.exists():
        return f
    import numpy as np
    import soundfile as sf
    from kokoro import KPipeline
    REFS.mkdir(parents=True, exist_ok=True)
    pipe = KPipeline(lang_code=voice[0], repo_id="hexgrad/Kokoro-82M")
    audio = np.concatenate([np.asarray(a, dtype=np.float32) for _, _, a in pipe(REF_TEXT, voice=voice, speed=REF_SPEED)])
    sf.write(f, audio, 24000)
    return f


def speak(jobs, out_dir, ref, say=print):
    """jobs [{key, text, seed}] -> out_dir/<key>.wav (24 kHz). One process for the whole batch (the model loads once, ~20 s)."""
    if not ready():
        raise NotReady("Chatterbox isn't set up on this computer: `python chatterbox_voice.py setup` (downloads ~3 GB; ask the owner first)")
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    jf = out_dir / "_jobs.json"
    jf.write_text(json.dumps(jobs, ensure_ascii=False), encoding="utf-8")
    p = subprocess.Popen([str(python()), "-I", str(ROOT / "chatter_tts.py"), str(MODEL), str(jf), str(out_dir), str(ref)],
                         stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
                         creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    tail = []
    for line in p.stdout:
        line = line.rstrip()
        if line.startswith(("VOICED", "LOADED")):
            say("    " + line)
        elif line and not any(w in line.lower() for w in ("warn", "deprecat", "pkg_resources", "symlink")):
            tail = (tail + [line])[-8:]
    if p.wait() != 0:
        raise RuntimeError("Chatterbox stopped: " + " | ".join(tail)[-500:])
    jf.unlink(missing_ok=True)
    missing = [j["key"] for j in jobs if not (out_dir / f"{j['key']}.wav").exists()]
    if missing:
        raise RuntimeError(f"Chatterbox made no audio for {len(missing)} line(s)")


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["setup"]:
        print("RESULT " + json.dumps({"ready": setup()}))
    elif a[:1] == ["ref"] and len(a) > 1:
        print("RESULT " + json.dumps({"ref": str(ensure_ref(a[1]))}))
    else:
        print(__doc__)
