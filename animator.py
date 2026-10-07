"""
Rana, the Designer & Animator (was "the Animator" until 2.27.0): for a scene that needs more than the kit can draw, an Opus run writes a bespoke React/SVG component (Remotion)
that acts out the step the voice is explaining: rays sweeping, a shadow growing, the dive into the well. It reuses the saved
characters and the style kit so the look stays the same.

Safety: the generated file is only ever bundled into the Remotion render; it may import nothing but the kit, is scanned for
anything that could touch the network, the disk or the clock, is test-rendered at three frames before the real render, and if
any step fails the scene falls back to the kit version (the Short is never held up by it).

    <video-tools python> animate.py animator-test <episode id> <scene index>
        writes content/project-N/animator-test/: kit.mp4 (the kit's scene), animator.mp4 (the bespoke scene), the code,
        the words and the audio of that scene, so the owner can watch them side by side.
"""
import json
import re
import shutil
import subprocess
from pathlib import Path

import control_plane as cp
import settings
import shorts
import workers
from shorts import Blocked, say

AGENT = "Rana"   # the Designer & Animator (the owner named her, 2026-10-08)
ALLOWED_IMPORTS = {"react", "remotion", "./theme", "./Character", "./Backdrops", "./Extras"}
BANNED = [r"\brequire\s*\(", r"\bimport\s*\(", r"\bfetch\b", r"XMLHttpRequest", r"\beval\b", r"\bFunction\s*\(", r"\bwindow\b", r"\bdocument\b",
          r"\bprocess\b", r"\bglobalThis\b", r"\blocalStorage\b", r"\bsessionStorage\b", r"\bindexedDB\b", r"WebSocket", r"\bsetTimeout\b",
          r"\bsetInterval\b", r"requestAnimationFrame", r"Math\.random", r"Date\.now", r"new Date", r"\bperformance\b", r"<foreignObject",
          r"<script", r"<iframe", r"dangerouslySetInnerHTML", r"https?://", r"\bchild_process\b", r"\bfs\b", r"<image", r"<img"]
MAX_BYTES = 40000

API = """THE KIT YOU MAY IMPORT (nothing else, no other packages, no other files):
  import React from 'react';
  import {spring, interpolate, useVideoConfig} from 'remotion';
  import {C, W, H, HEAD, BODY, LINE, ink, easeOut, easeInOut, clamp01, lerp, rnd} from './theme';
     C = palette {ink '#2A1B14', parchment '#F5E6C4', gold '#E8A93A', terracotta '#C8573A', teal '#1F6670', sky '#9ACFD6', white};
     W = 1080, H = 1920; HEAD / BODY = font families (Lilita One / Nunito: use fontFamily={HEAD} for big text);
     LINE = 8 (outline thickness); ink = {stroke, strokeWidth, strokeLinejoin, strokeLinecap} spread on shapes for the house outline;
     easeOut/easeInOut/clamp01 take 0..1; lerp(a, b, t); rnd(i) = a repeatable "random" number 0..1 (never use Math.random).
  import {Character} from './Character';
     <Character who="narrator|scholar|ruler" pose="stand|point|explain|amazed|wave|think|present" poseTo="..." blend={0..1}
        expression="neutral|happy|surprised|worried|determined|thinking" look={[dx, dy]} mouth={letter A-H or X} noProp
        x={feet x} y={feet y} scale={0.6-1.3} frame={frame} enterAt={0} seed={0} walking />
     The figure is about 560 units tall at scale 1 (feet at y); use mouth={mouth[frame]} for the speaking character.
  import {BACKDROPS} from './Backdrops';  // BACKDROPS.court | library | nile | well | study | street | desert, each <Back frame={frame} tone="noon|sunset|night" />
  import {Rod, Globe, Callout} from './Extras';  // <Rod x y shadow={0..1} frame /> <Globe x y r frame /> <Callout text frame y />

YOUR FILE MUST: export default function Scene({frame, frames, words, mouth}) { return <g>...</g>; }
  frame = the frame inside THIS scene (0 .. frames-1, 30 per second); frames = this scene's length; words = [{w, from, to}] frame
  offsets inside the scene of each spoken word (sync to them); mouth = an array with one Rhubarb mouth letter per scene frame.
  Return SVG elements for a 1080 x 1920 canvas (a <g>, not an <svg>). The caller adds captions and the title card.
"""

SYSTEM = """You are Rana, the Designer & Animator of a small AI-run company that makes animated history Shorts for YouTube. You write ONE React
component for Remotion that animates ONE scene from scratch, in SVG. The stock template for this scene already exists (a fixed
backdrop with a character standing in it); your job is to do much better: make the OBJECTS act out the step the voice is
explaining, so a viewer who knows nothing understands the step from the picture alone, with the sound off.

""" + API + """
HOW A GOOD SCENE LOOKS
- It shows the step, in order, as it is said: build the idea on screen piece by piece (the sun's rays arriving, the stick, the
  shadow growing, the angle drawn, the label appearing), timed to the words (use `words`: when a key word starts, its thing
  appears). By the last second the whole explanation is on screen and holds until the scene ends.
- Something moves in every second; use springs/easing, anticipation and overshoot; keep it calm and readable, never frantic.
- Same look as the rest of the Short: flat shapes, thick dark-brown outlines (spread `ink`), the six palette colours, rounded
  forms, the same fonts. Characters, when used, are the saved cast (<Character>), same scale rules as elsewhere.
- Text on screen: big (56 px or more), at most about 22 characters a line, only the words that matter (names, numbers, labels).
- Keep everything the viewer must see inside a 60 px margin on every side. The captions occupy y 1300-1600 and the title/callout
  band is y < 340: put nothing important there (backgrounds may fill it).
- Deterministic: everything derives from `frame`. No Math.random (use rnd), no Date, timers, fetch, window, document. Do not import
  anything outside the kit. No images or external assets; draw everything as SVG. Keep it under about 400 SVG elements.
- Make clip ids unique (include 'scene' in the id) if you use clipPath/gradients.
Answer with ONE ```jsx code block containing the complete file and nothing else."""


def task_text(story, scene, frames, words, kit_note):
    ws = " ".join(f"{w['w']}@{w['from']}" for w in words)
    return (f"THE STORY: {story}\n\nTHIS SCENE ({frames} frames = {frames / 30:.1f} s)\n"
            f"Voice line: \"{scene.get('voice_line', '')}\"\nWhat it must show: {scene.get('shows', '') or '(show the step the voice explains)'}\n"
            f"Bespoke idea from the writer: {scene.get('bespoke', '') or '(none: use your own judgment)'}\n"
            f"The stock version would be: {kit_note}\n\n"
            f"Word timings (word@frame inside the scene): {ws}\n\n"
            "Write the component now.")


def extract_code(text):
    m = re.search(r"```(?:jsx|js|javascript|tsx)?\s*\n(.*?)```", text, re.S)
    return (m.group(1) if m else text).strip()


def validate(code):
    """A list of problems; empty means the file may be rendered."""
    problems = []
    if len(code.encode("utf-8")) > MAX_BYTES:
        problems.append(f"The file is over {MAX_BYTES} bytes.")
    if not re.search(r"export\s+default\s+(async\s+)?(function\s+Scene\b|Scene\b|\()", code) and "export default" not in code:
        problems.append("It must `export default function Scene({frame, frames, words, mouth})`.")
    for m in re.finditer(r"^\s*import\s[^;]*?from\s+['\"]([^'\"]+)['\"]", code, re.M):
        if m.group(1) not in ALLOWED_IMPORTS:
            problems.append(f"It imports '{m.group(1)}', which is not in the kit.")
    if re.search(r"^\s*import\s+['\"]", code, re.M):
        problems.append("Bare side-effect imports are not allowed.")
    for pat in BANNED:
        if re.search(pat, code):
            problems.append(f"It uses something that isn't allowed ({pat.strip(chr(92)).strip('b')}).")
    return problems


def install(folder, ids):
    """Copy the generated scene files next to the render's source (the program folder is never touched) and register them."""
    import animate
    src = animate.APP / "src"
    gen = src / "generated"
    for old in src.glob("gen_*.jsx"):
        old.unlink()
    shutil.rmtree(gen, ignore_errors=True)
    gen.mkdir(parents=True, exist_ok=True)
    lines = []
    for i in ids:
        shutil.copy2(folder / f"{i}.jsx", src / f"gen_{i}.jsx")   # beside theme.js, so the file's own './theme' imports resolve
        lines.append(f"import {i} from '../gen_{i}.jsx';")
    (gen / "index.js").write_text("\n".join(lines) + "\nexport default {" + ", ".join(ids) + "};\n", encoding="utf-8")


def write_scene(project_id, story, scene, frames, words, kit_note, folder, name, idea_id=None, repairs=2):
    """Ask the Animator for the scene's code, validate it, and test-render it. Returns the scene id, or raises Blocked."""
    problem, last = None, ""
    for attempt in range(repairs + 1):
        task = task_text(story, scene, frames, words, kit_note)
        if problem:
            task += (f"\n\nYour previous file was rejected: {problem}\nFix exactly that and answer with the complete corrected file.\n"
                     f"Your previous file was:\n```jsx\n{last}\n```")
        try:
            text, _ = workers.run(AGENT, idea_id, SYSTEM, task, max_turns=3)
        except workers.Unavailable as e:
            raise Blocked(f"Rana couldn't run: {e}")
        last = extract_code(text)
        bad = validate(last)
        if bad:
            problem = "; ".join(bad)
            say(f"  Rana's file rejected ({problem[:140]}); asking again ({attempt + 1}/{repairs})")
            continue
        (folder / f"{name}.jsx").write_text(last, encoding="utf-8")
        err = test_render(folder, name, scene, frames)
        if not err:
            return name
        problem = f"it failed to render: {err[:600]}"
        say(f"  Rana's file didn't render ({err[:140]}); asking again ({attempt + 1}/{repairs})")
    raise Blocked(f"Rana couldn't produce a scene that renders: {problem[:300]}")


def test_render(folder, name, scene, frames):
    """Render three frames of the scene in the sandbox. Returns '' if all three work, else the error text."""
    import animate
    install(folder, [name])
    props = {"durationInFrames": frames, "mouth": ["X"] * frames, "caption_chunks": [], "intro": None, "outro": None,
             "scenes": [{"from": 0, "frames": frames, "backdrop": "court", "generated": name, "words": []}]}
    pf = folder / "_test-props.json"
    pf.write_text(json.dumps(props), encoding="utf-8")
    try:
        for f in (0, frames // 2, frames - 1):
            try:
                animate.remotion(["still", "src/index.jsx", "Short", str(folder / "_test.png"), f"--props={pf}", f"--frame={f}", "--log=error",
                                  "--overwrite"], timeout=300)
            except Blocked as e:
                return str(e)
    finally:
        pf.unlink(missing_ok=True)
        (folder / "_test.png").unlink(missing_ok=True)
    return ""


# ---------------------------------------------------------------- the first test: one scene, kit next to bespoke
def scene_words(props, scene):
    """The caption words that fall inside a scene, as frame offsets from the scene's start."""
    a, b = scene["from"], scene["from"] + scene["frames"]
    out = []
    for c in props.get("caption_chunks", []):
        for w in c["words"]:
            if a <= w["from"] < b:
                out.append({"w": w["w"], "from": w["from"] - a, "to": min(w["to"], b) - a})
    return out


# the first test's brief (in production Calina writes `bespoke` and `shows` for the scenes that need it)
TEST_BRIEF = (
    "The Earth-measuring diagram, built up step by step as the voice speaks: the Earth as a big circle seen from the side; parallel sun rays "
    "arriving from the right (they are parallel, say so with a label); a stick standing up at Syene with NO shadow (sun straight overhead) "
    "and a stick at Alexandria, a little further round the curve, with a shadow; the two sticks' lines drawn down to the Earth's centre so they "
    "meet at an angle; that angle highlighted as 7.2 degrees, then shown as one fiftieth of the whole circle (a pie slice that repeats around "
    "the circle fifty times). Label SYENE and ALEXANDRIA. Everything appears in the order the words are spoken.")


def run_test(eid, index, bespoke=TEST_BRIEF):
    import animate
    ep = cp.get_episode(int(eid))
    if not ep:
        raise Blocked(f"No episode {eid}.")
    src = animate.production.episode_folder(ep)
    pp = src / "scene-props.json"
    if not pp.exists():
        raise Blocked("That episode hasn't been rendered yet (no scene-props.json), so there are no word timings to sync to.")
    props = json.loads(pp.read_text(encoding="utf-8"))
    scene = props["scenes"][int(index)]
    data_scene = (ep["data"].get("scenes") or [])[int(index)]
    a, n = scene["from"], scene["frames"]
    out = shorts.CONTENT / f"project-{ep['project_id']}" / "animator-test"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True, exist_ok=True)
    animate.ensure_toolchain()
    ffmpeg = shorts.find_ffmpeg()
    say("Cutting this scene's voice...")
    shorts.run([ffmpeg, "-y", "-loglevel", "error", "-ss", f"{a / animate.FPS:.3f}", "-t", f"{n / animate.FPS:.3f}", "-i", str(src / "voice.wav"),
                str(out / "voice.wav")])
    words = scene_words(props, scene)
    chunks = [{"from": c["from"] - a, "to": min(c["to"], a + n) - a, "words": [{**w, "from": w["from"] - a, "to": min(w["to"], a + n) - a} for w in c["words"]]}
              for c in props.get("caption_chunks", []) if a <= c["from"] < a + n]
    base = {"durationInFrames": n, "audio": "voice.wav", "mouth": props["mouth"][a:a + n], "caption_chunks": chunks, "intro": None, "outro": None}
    story = ep["data"].get("storyline") or ep["title"]
    kit_note = f"a '{scene.get('backdrop')}' scene" + (f" with this diagram spec: {json.dumps(scene.get('diagram'))}" if scene.get("diagram") else "") + \
               ((", characters: " + ", ".join(f"{c['who']} ({c.get('pose')})" for c in scene.get("characters", []))) if scene.get("characters") else "")
    # 1. the kit version
    kit_props = {**base, "scenes": [{**scene, "from": 0}]}
    (out / "kit-props.json").write_text(json.dumps(kit_props), encoding="utf-8")
    say("Rendering the kit version of the scene...")
    animate.remotion(["render", "src/index.jsx", "Short", str(out / "kit.mp4"), f"--props={out / 'kit-props.json'}", f"--public-dir={out}", "--codec=h264",
                      "--crf=22", "--log=warn", "--overwrite"], timeout=1800)
    # 2. the bespoke version
    say("Rana is writing the scene (Opus, a few minutes)...")
    name = f"scene_{ep['id']}_{int(index)}"
    project = cp.get_project(ep["project_id"], with_text=False)
    write_scene(ep["project_id"], story, {**data_scene, "bespoke": bespoke or "A bespoke animation that makes the explanation visible."}, n, words, kit_note, out, name,
                project["idea_id"] if project else None)
    install(out, [name])
    anim_props = {**base, "scenes": [{"from": 0, "frames": n, "backdrop": "court", "generated": name, "words": words}]}
    (out / "animator-props.json").write_text(json.dumps(anim_props), encoding="utf-8")
    say("Rendering Rana's version...")
    animate.remotion(["render", "src/index.jsx", "Short", str(out / "animator.mp4"), f"--props={out / 'animator-props.json'}", f"--public-dir={out}",
                      "--codec=h264", "--crf=22", "--log=warn", "--overwrite"], timeout=1800)
    for f in ("kit-props.json", "animator-props.json"):
        (out / f).unlink(missing_ok=True)
    meta = {"episode": ep["id"], "scene": int(index), "voice_line": data_scene.get("voice_line"), "seconds": round(n / animate.FPS, 1),
            "kit": (out / "kit.mp4").relative_to(animate.ROOT).as_posix(), "animator": (out / "animator.mp4").relative_to(animate.ROOT).as_posix(),
            "code": (out / f"{name}.jsx").relative_to(animate.ROOT).as_posix(), "scene_id": name}
    (out / "test.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta
