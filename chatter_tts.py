"""Chatterbox Nano worker (runs inside ~/.agent-hq-anim/chatterbox/.venv, started by chatterbox_voice.speak).

    python -I chatter_tts.py <model dir> <jobs.json> <out dir> <reference.wav>

jobs: [{key, text, seed}] -> <out dir>/<key>.wav at the model's 24 kHz, watermarked (Perth) like every Chatterbox take.
chatterbox-tts 0.1.7 (PyPI) has no Nano switch yet; this loads it the way the GitHub version does: the GPT2_small backbone,
t3_nano_v1.safetensors and the shared meanflow decoder."""
import copy
import json
import sys
import time
from pathlib import Path

import torch
import torchaudio as ta
from safetensors.torch import load_file

import chatterbox.models.t3.llama_configs as lc
from chatterbox.models.s3gen import S3Gen
from chatterbox.models.t3 import T3
from chatterbox.models.t3.modules.t3_config import T3Config
from chatterbox.models.voice_encoder import VoiceEncoder
from chatterbox.tts_turbo import ChatterboxTurboTTS, Conditionals
from transformers import AutoTokenizer

if "GPT2_small" not in lc.LLAMA_CONFIGS:
    small = copy.deepcopy(lc.GPT2_MEDIUM_CONFIG)
    small.update({"n_embd": 768, "hidden_size": 768, "n_head": 12, "n_layer": 12})
    lc.LLAMA_CONFIGS["GPT2_small"] = small


def load(ckpt):
    ve = VoiceEncoder()
    ve.load_state_dict(load_file(ckpt / "ve.safetensors"))
    ve.eval()
    hp = T3Config(text_tokens_dict_size=50276)
    hp.llama_config_name = "GPT2_small"
    hp.speech_tokens_dict_size = 6563
    hp.input_pos_emb = None
    hp.speech_cond_prompt_len = 375
    hp.use_perceiver_resampler = False
    hp.emotion_adv = False
    t3 = T3(hp)
    st = load_file(ckpt / "t3_nano_v1.safetensors")
    if "model" in st.keys():
        st = st["model"][0]
    t3.load_state_dict(st)
    del t3.tfmr.wte
    t3.eval()
    s3 = S3Gen(meanflow=True)
    s3.load_state_dict(load_file(ckpt / "s3gen_meanflow.safetensors"), strict=True)
    s3.eval()
    tok = AutoTokenizer.from_pretrained(ckpt)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    conds = Conditionals.load(ckpt / "conds.pt", map_location=torch.device("cpu")) if (ckpt / "conds.pt").exists() else None
    return ChatterboxTurboTTS(t3, s3, ve, tok, "cpu", conds=conds)


def main():
    ckpt, jobs_file, out, ref = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), sys.argv[4]
    torch.set_num_threads(max(1, (torch.get_num_threads() or 4)))
    t0 = time.time()
    model = load(ckpt)
    model.prepare_conditionals(ref)   # the voice: copied once from the reference clip, kept for every line
    print(f"LOADED in {time.time() - t0:.0f} s", flush=True)
    jobs = json.loads(jobs_file.read_text(encoding="utf-8"))
    for n, j in enumerate(jobs, 1):
        t = time.time()
        torch.manual_seed(int(j.get("seed", 0)))
        with torch.inference_mode():
            wav = model.generate(j["text"], temperature=float(j.get("temperature", 0.8)))
        f = out / f"{j['key']}.wav"
        ta.save(str(f.with_suffix(".part.wav")), wav, model.sr)
        f.with_suffix(".part.wav").replace(f)
        print(f"VOICED {n}/{len(jobs)} {wav.shape[-1] / model.sr:.1f} s of speech in {time.time() - t:.0f} s", flush=True)


if __name__ == "__main__":
    main()
