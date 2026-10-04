# POV Then History: animation style guide (minimum kit, v1)

One look for every Short. It is written down here so a human, Calina, or a video maker can reproduce it. The code in
`src/` is the source of truth; `src/theme.js` holds the same numbers as this file (change both together).
Preview: `animation/previews/style-sheet.png` (made from the `Sheet` still).

## Look
Flat, warm, hand-cut paper feel. Thick dark-brown outlines on everything. No gradients except skies. No photos.
Round shapes, big heads, simple faces. Everything moves a little (breathing, blinking, swaying palms, drifting clouds).

## Palette (6 colours + white for captions)
| Name | Hex | Used for |
| --- | --- | --- |
| Ink | `#2A1B14` | every outline, shadows, text on light |
| Parchment | `#F5E6C4` | land on maps, paper, robes, signs |
| Gold | `#E8A93A` | sun, crowns, highlights, the spoken word in captions |
| Terracotta | `#C8573A` | the POV sign, pins, accents, robes |
| Teal | `#1F6670` | water, the traveller's coat, night |
| Sky | `#9ACFD6` | sky, rivers, glass |
| White | `#FFFFFF` | caption text only |

Skin tones: light `#F0C9A0`, mid `#D9A06F`, dark `#9C6240`.

## Line
8 px outline at 1080 px wide (6 px on small details, 4-5 px inside faces). Round joins and caps. Outline colour is always Ink.

## Fonts (both free, SIL Open Font Licence, loaded from Google Fonts)
- **Lilita One**: captions, callouts, the POV stamp, map labels.
- **Nunito ExtraBold**: small labels only.

## Cast (SVG parts in `src/Character.jsx`: head, face, torso, two arms, held prop)
Front view, about 560 units tall, a prop in the left hand, the right arm does the gesturing.
- **narrator** ("the Traveller"): time-traveller with brass goggles on the forehead, teal coat, parchment scarf, satchel
  strap, holds the **POV sign**. The only one who speaks to the viewer. Mid skin.
- **scholar**: bald, white beard and brows, cream robe with a terracotta sash, holds a **scroll**. Light skin.
- **ruler**: gold crown, short dark beard, terracotta robe with gold collar, holds a **sceptre**. Dark skin.

**Poses** (4, named): `stand`, `point`, `explain`, `amazed`.
**Mouth shapes** (3, named): `closed`, `mid`, `open`.
Mouth shapes are driven by the voice: the loudness of the audio at 30 fps, only while a word is being said.

## Backdrops (layered, with parallax and ambient motion)
`court` (Alexandrian courtyard; tone `noon` / `sunset` / `night`), `library`, `nile`, `well`, `study`, `map`, `diagram`.
`map` is real geography (Natural Earth, public domain): give a latitude/longitude and the camera flies there from the
world view; pins drop in; an optional dashed route draws between two pins.
New backdrops are added only when a script needs one (Calina lists them in `kit_requests`).

## Camera
Every scene has one move: `push_in`, `pull_out`, `pan_left`, `pan_right`, `pan_up`, `pan_down`, `drift`.
Scene changes: a slide or a circular iris, 9 frames.

## Captions
Lilita One, 124 px, upper case, white with a thick Ink outline, 2-3 words at a time, the spoken word turns Gold.
They sit at 68% of the height, above YouTube's bottom buttons.

## Title card and end card
Opening stamp over the hook: **POV** on a terracotta plate, then a parchment ribbon with the place and year.
End card (1.7 s): "Follow for more history", the channel name and handle.

## Voice
About 130 words a minute, a breath between lines. The owner picks from samples in Ideas → Content (Kokoro, Piper).
A voice recorded elsewhere (ElevenLabs, a person) can replace it: save it as `voice.mp3` in the episode's folder.

## The scene file (what Calina writes, one per episode)
```json
{ "title": "...", "place": "Alexandria", "year": "c. 240 BCE", "hook": "...", "storyline": "...", "surprising_fact": "...",
  "scenes": [ {
      "n": 1, "voice_line": "At most 14 words.",
      "backdrop": "court", "tone": "noon", "camera": "push_in",
      "characters": [ {"who": "scholar", "pose": "point", "at": "right", "speaks": false} ],
      "props": [ {"type": "rod", "x": 300, "shadow": 0.6} ],
      "callout": "NO SHADOWS",
      "map": {"focus": [31.2, 29.9], "zoom": 62, "pins": [{"label": "ALEXANDRIA", "lat": 31.2, "lon": 29.9}], "route": [0, 1]},
      "source_note": "which source backs this scene's fact" } ],
  "sources": [ {"publisher": "...", "url": "https://...", "quote": "..."} ],
  "description": "...", "hashtags": ["#history", "#shorts"], "kit_requests": [] }
```
Rules the pipeline enforces: 7-16 scenes, 55-125 narration words, every scene has a source note, at least one linked and
quoted source, 4+ different backdrops, a different scene order from earlier Shorts, nothing over about 58 seconds.

## How it is made
`hq render <episode id>` (or the office's *Make the animated Short* button) → `animate.py`: voice (per scene line) →
word timings → mouth cues → props file → Remotion renders `src/index.jsx` → `short.mp4`, `title.txt`,
`description.txt`, `sources.txt` in `content/project-N/videos/ep-NNN/`. Remotion is free for companies of up to 3 people
(checked 2026-10-04, remotion.dev/docs/license/pricing). Node and Remotion live in `~/.agent-hq-anim`.
