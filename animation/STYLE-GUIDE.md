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

## Cast (kit v3: SVG parts in `src/Character.jsx`)
The owner's reference (2026-10-07, five Greek men queuing by a voting urn) and his rule: **not a funny cartoon**. So: natural
adults about 6.5-7 heads tall with normal hands and limbs; thin warm dark-brown outlines (`#4A2C20`, heavier on the silhouette,
light fold lines inside), not Ink-black; calm natural faces (small almond eyes, gentle mouths, a real straight nose, beards and
hair in flowing curls); flowing drapery with fold lines (a himation wrapped over the left shoulder and across the tunic, cloaks
that hang behind and are pinned with a brooch); a muted sepia/terracotta palette (peach skin, cream and linen tunics, soft brown,
grey and terracotta cloaks) with flat soft shading; different builds, heights, ages and hair. About 600 units tall, front view,
the head drawn in its own units and scaled by `HEAD_K`, a prop in the left hand, the right arm gestures (a pointing finger on
`point`). There is **no on-screen narrator and no POV sign**: the narrator is a voice only.
- **scholar**: bald crown, white hair at the sides, long flowing white beard, cream tunic, grey himation, **scroll**.
- **ruler**: tall, heavy-set, brown curls and full beard, thin gold diadem, plum himation with a gold edge, **sceptre**.
- **citizen**: young man, thick brown curls, clean-shaven, short cream tunic.
- **woman**: auburn bun with a band, long sage dress, linen shawl, small earrings.
- **elder**: receding grey hair, full white beard, linen tunic, soft brown himation, **staff**.
- **merchant**: heavy, bald, short black beard, linen tunic, ochre himation, **coin purse**.
- **guard**: bronze helmet with a red crest, bronze cuirass, red cloak, **spear**.
- **worker**: short brown hair and beard, plain short tunic, grey cloak pinned at the shoulder.
- **crowd**: townspeople made from those looks with their own seeded colours and hair; they react together
  (`idle`, `cheer`, `gasp`, `laugh`, `murmur`, `angry`, `scared`).

**Poses** (9): `stand`, `point`, `explain`, `amazed`, `wave`, `think`, `present`, `shrug`, `cheer`; they blend.
**Expressions** (10): `neutral`, `happy`, `surprised`, `worried`, `determined`, `thinking`, `laughing`, `angry`, `smug`, `scared`.
**Mouths**: Rhubarb Lip Sync's nine shapes from the voice track; only the character who is talking moves its mouth (the props
carry a `speaker` per frame). The others look at the speaker. A speaker without a stage direction gestures on his line.
The owner approves the cast per kit version (`quality.KIT_VERSION`); an approval of an older kit doesn't count.

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
Opening stamp over the hook: **POV** on a terracotta plate (the channel's name), then a parchment ribbon with the place and year.
End card (1.7 s): "Follow for more history", the channel name and handle.

## Voices, sound and music (2.20.0)
- The narrator and every character have their own voice (project meta `voice` and `cast_voices`). ElevenLabs **v3** acts each
  line from its delivery tag (`[excited]`, `[whispers]`, `[sarcastic]`...); no fixed pace. Free Kokoro voices stand in without
  ElevenLabs. Captions of a character's own line are tinted sky blue.
- Sound effects from a fixed menu (`sfx.MENU`) land on a word; each is made once with ElevenLabs and saved in
  `content/audio-kit/sfx/`. Music: one free Kevin MacLeod track per project (the owner picks), ducked while anyone speaks,
  credited in the description.
- The voice matcher (`voice_match.py`) ranks ElevenLabs library voices against a reference narrator.

## The scene file (what Calina writes, one per episode)
```json
{ "title": "...", "place": "Alexandria", "year": "c. 240 BCE", "hook": "...", "storyline": "...", "surprising_fact": "...",
  "cast_roles": {"scholar": "Eratosthenes", "ruler": "King Ptolemy III"},
  "scenes": [ {
      "n": 1, "backdrop": "court", "tone": "noon", "camera": "push_in",
      "characters": [ {"who": "scholar", "pose": "think", "at": "right", "expression": "neutral"} ],
      "lines": [ {"who": "narrator", "text": "Two thousand years ago, a man measured the planet... with a stick.", "tag": "mischievously"},
                 {"who": "scholar", "text": "It's a very GOOD stick.", "tag": "deadpan", "pose": "present", "expression": "smug"} ],
      "crowd": {"size": 5, "reaction": "murmur"},
      "sfx": [ {"name": "dun_dun", "on_word": "stick"} ],
      "props": [ {"type": "rod", "x": 300, "shadow": 0.6} ],
      "callout": "ONE STICK", "callout_word": "stick",
      "source_note": "which source backs this scene's fact" } ],
  "sources": [ {"publisher": "...", "url": "https://...", "quote": "..."} ],
  "description": "...", "hashtags": ["#history", "#shorts"], "kit_requests": [] }
```
`voice_line` is filled in by code (everything said in the scene). Old scene files with one `voice_line` per scene still render.
Rules the pipeline enforces: 7-20 scenes, a sourced fact per scene, at least one linked and quoted source, 4+ backdrops, a
different scene order from earlier videos, one spoken line at most 34 words, a speaker other than the narrator must be in the
scene. No length target: the story sets it.

## How it is made
`hq render <episode id>` (or the office's *Make the animated Short* button) → `animate.py`: voice (per scene line) →
word timings → mouth cues → props file → Remotion renders `src/index.jsx` → `short.mp4`, `title.txt`,
`description.txt`, `sources.txt` in `content/project-N/videos/ep-NNN/`. Remotion is free for companies of up to 3 people
(checked 2026-10-04, remotion.dev/docs/license/pricing). Node and Remotion live in `~/.agent-hq-anim`.
