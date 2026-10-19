"""Earshot's listening for the sound & voice agent (2.56.0, sound_agent.py). Runs in Earshot's own venv
(~/.agent-hq-anim/earshot/.venv, CPU only, MIT; models CLAP Apache-2.0 + AST BSD-3), one process so the models load once:

    <earshot venv python> -I earshot_probe.py job.json out.json

job: {"mix": wav, "video": mp4|None, "sheet": png|None, "stems": {name: wav}, "match": [{file, start, end, query, alts?, tag?}]}
out: measure (the mix), timeline (the mix, synced to the video's cuts), sheet, stem_<name> (a timeline per layer), matches.
Any step that fails says why in its own field; the rest still runs.
"""
import json
import sys


def main():
    job = json.load(open(sys.argv[1], encoding="utf-8"))
    from earshot import api
    out = {}

    def safe(name, fn):
        try:
            out[name] = fn()
        except Exception as e:  # noqa: BLE001
            out[name] = {"error": f"{type(e).__name__}: {e}"[:400]}
        return out[name]

    if job.get("mix"):
        safe("measure", lambda: api.measure(job["mix"]))
        tl = safe("timeline", lambda: api.timeline(job["mix"], video=job.get("video")))
        if job.get("sheet"):
            safe("sheet", lambda: api.sheet(job["mix"], job["sheet"], video=job.get("video"), tl=tl if isinstance(tl, dict) and "error" not in tl else None))
    from earshot.timeline import transcript
    if isinstance(out.get("timeline"), dict) and "error" not in out["timeline"]:
        safe("transcript", lambda: transcript(out["timeline"]))   # one line per event, gap and cut: what the agent "hears"
    for name, f in (job.get("stems") or {}).items():
        r = safe("stem_" + name, lambda f=f: api.timeline(f))
        if isinstance(r, dict) and "error" not in r:
            safe("transcript_" + name, lambda r=r: transcript(r))
    rows = []
    for m in job.get("match") or []:
        try:
            rows.append({**m, "result": api.match(m["file"], m["query"], alts=m.get("alts"), start=m.get("start"), end=m.get("end"))})
        except Exception as e:  # noqa: BLE001
            rows.append({**m, "error": f"{type(e).__name__}: {e}"[:300]})
    out["matches"] = rows
    with open(sys.argv[2], "w", encoding="utf-8") as fh:
        json.dump(out, fh, default=str)


if __name__ == "__main__":
    main()
