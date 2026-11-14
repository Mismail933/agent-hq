# Honey Short, the owner's version, made with Fable

You are the animator. Write ONE React/Remotion file, `HoneyFable.jsx`, in this folder: a 1080x1920 vertical, 30 fps animated
explainer that plays under a narration that is already recorded. `timing.json` has every line of the narration with its start/end
seconds (t0, t1) and every word with its start time (words: [word, start, end]). Total length: `seconds` (about 80 s).

## What the owner wants (his words, 2026-11-14)
"I want the video to be more alive, I don't want to feel a slideshow. The part where you are explaining what the honey contains and the
pH and this, the whole time I am seeing a video of bees in the background but it's kind of useless. Make it more interactive... animate
something to explain the composition of honey."

So: the SCIENCE lines (lines 5-11 in timing.json: why honey lasts, 17% water, pH 3.9, hydrogen peroxide, crystallised, composition,
the lid) must be ANIMATION that explains the idea while it is said, not footage. Things move, build, react on the exact words:
- "basically a desert" / "17% water / bacteria dries out": a honey "desert", a bacterium cell that shrivels as water is pulled out
  of it (osmosis arrows), a 17% water gauge filling to 17.
- "acidic, pH 3.9, as sour as orange juice": an animated pH scale 0-14 with a marker sliding to 3.9 next to orange juice (~3.5).
- "an enzyme that slowly makes hydrogen peroxide": an enzyme (a friendly blob) turning glucose into H2O2 bubbles that pop bacteria.
- "turns solid and grainy ... crystallised": liquid honey turning into crystals, a STILL GOOD tick.
- "what is honey made of? 38% fructose, 31% glucose, plus maltose, acids, minerals, enzymes": molecules (hexagon/pentagon ring
  sketches labelled FRUCTOSE / GLUCOSE) fly into a jar and fill it in layers or a donut chart that builds slice by slice ON the
  words (fructose 38, glucose 31, water 17, maltose 7, other sugars 3, acids/minerals/enzymes 4).
- "keep the lid on ... great great grandchildren": a jar whose lid screws shut, a funny family tree of tiny bee or human faces.
The HISTORY lines (0-4: the oldest honey question, the tomb, 1922, not proven, Georgia 4,500 years) may use the real footage and
photos listed in assets.txt (files under `staticFile('fs/<name>')`; OffthreadVideo for .mp4 with `startFrom` in frames, Img for
.jpg), but also animate over them (a 100 / 200 / 1,000 counter that spins past to 3,000+, a timeline bar 2560 BC ... 1922, a map
pin for Georgia). Labelled AI clips: honey-drip-ai.mp4, honey-tomb-ai.mp4 (show a small "AI recreation" tag when used).

Never a static slide: every second something moves with purpose (an object builds, a number counts, a camera push on a drawing).
No random b-roll under the science. Style: warm honey palette (amber #F2B233, deep brown #1A0F05, cream #FAF0DC), flat, clean,
modern explainer look (think Kurzgesagt-lite), rounded shapes, gentle springs, nothing childish, nothing scary.

## Hard technical rules
- One file: `HoneyFable.jsx`, `export const HoneyFable = ({lines, words, seconds}) => ...` where lines/words come from timing.json
  (pass-through props; you may also import timing.json? NO: use the props). Use `useCurrentFrame()/fps` to get t in seconds and
  find what is being said; trigger every animation from the word times (e.g. a helper `at(lineIndex, 'word')`).
- Imports ONLY from 'react' and 'remotion' (AbsoluteFill, Sequence, OffthreadVideo, Img, staticFile, interpolate, spring, Easing,
  useCurrentFrame, useVideoConfig). Every frame a pure function of the frame number: no Math.random (use a seeded function of
  an index), no Date, no fetch, no state.
- 1080x1920. Keep y 1180-1440 EMPTY of important content: the captions are drawn there by another layer. Keep the top 0-120 clear
  too. Text in your drawings: font-family 'Archivo Black' for big words, 'Montserrat' for small ones (both are loaded).
- SVG for drawings is fine and preferred. Keep it under ~1500 lines.
- `ref/FactShort.jsx` is the current (rejected-as-too-static) version's component, for reference of the props and look only.

When done, write `NOTES.md`: one line per narration line saying what the viewer sees.
