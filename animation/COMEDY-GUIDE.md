# How OverSimplified builds a funny history video (and how we use it)

Studied 2026-10-08 by the Builder at the owner's request: the full captions of *The First Punic War (Part 1)* and *The Pig War*,
plus frames from both, watched in the browser (nothing downloaded). These are the patterns, in our own words. We copy the
*craft*, never their jokes, lines or characters.

## 1. The rhythm: fact, sketch, deadpan
The whole video is a loop of three beats:
1. **The narrator states the fact**, plainly, in 1-3 sentences.
2. **A short sketch acts it out** (3-8 quick lines between characters). The sketch exaggerates a personality, not the fact.
3. **The narrator comes back flat and confirms it**, often with one short dry sentence that lands the joke
   (pattern: a character promises not to do the bad thing, everyone laughs, then the narrator: "They then did the bad thing.").

The facts are never changed for a joke. The joke is in *how people react* to the true thing.

## 2. Joke shapes that come back again and again
- **The doubter is proven wrong.** A character mocks the strange new idea, at length, while the audience can see it. Then it
  works (one sound, one shot). Then the narrator calmly explains how it works, in two or three short visual steps.
  This is THE shape for any invention or discovery story.
- **Expectation, then the flip.** "You would think X. You would think wrong." / "Surely now they were free to... ". "No."
- **The rule of three, then a callback.** A catchphrase or reaction happens three times in a row early on, then comes back
  once much later as the payoff (the audience remembers it). One running gag per video is enough.
- **Escalating repetition.** The same line rephrased a few times, each sillier, until someone cuts it off.
- **The honest undercut.** A character says the reasonable thing, then immediately says what he really wants.
- **Modern comparison.** A short everyday analogy for an ancient situation (a neighbour, a school, a job interview), said by the
  narrator in one sentence. One or two per video, never instead of the fact.
- **The narrator is a character.** Short asides to the viewer: checking his notes, admitting something is silly, talking to
  the viewer as "you". Self-aware, never smug.
- **Side characters talk too.** While the main exchange happens, a bystander gets one short aside (a whisper, a complaint,
  a "what's wrong with him?"). It adds life without stopping the story.
- **The reveal behind.** Someone brags; something walks into the frame behind him (an army, the boss, the thing he dismissed).

## 3. Sketch lines
- Very short, spoken, modern-casual words. Two to eight words is normal. Names on screen are simple.
- Characters have one clear trait each (the proud one, the nervous one, the one who doesn't care) and stay in it.
- A sketch ends on a punch: the last line or a reaction, then cut. No line after the punch.

## 4. Sound
- In their captions the effects are rare and named: a gasp, a crowd cheering, a gunshot, a clock ticking, a crash.
- Every effect is something you can SEE happen on screen at that moment, or the button on a punchline. Nothing random.
- Many lines have no effect at all. The voice carries the joke; the effect lands it.

## 5. Picture and cuts
- **Cuts, not transitions.** A scene ends, the next one starts. The movement lives inside the shot: a slow push-in, a map
  that pans from place to place, a character walking in from the edge.
- **Close framing.** Characters are big in the frame (knee-up, waist-up). A punchline gets a tight close-up on the reacting
  face, held for a beat, then cut.
- **Two people talking stand side by side, close, never overlapping**, facing each other. Groups are staged in depth: the back
  row higher in the picture and smaller, every face visible. A crowd reacts as one (all angry, all cheering).
- **Maps are characters too.** Little figures and flags stand on the map; a country can "say" one line.
- **Simple demonstrations.** When something must be understood (how the machine works), the picture becomes a clean side view
  that shows one step per sentence.

## 6. How this maps onto our tools
| Their move | Ours |
| --- | --- |
| Fact, sketch, deadpan | narrator line -> 2-6 character `lines` -> a short narrator line with tag `deadpan` |
| Doubter proven wrong | the doubter's lines + `reacts` (double_take, facepalm) + one `sfx` on the moment it works |
| Close-up on the punch | `camera: punch_in` on the line or reaction that is the punchline |
| Deadpan beat | scene `gag: {type: deadpan}` (the camera holds, the music stops) |
| Side-character aside | a one-line `lines` entry by a bystander (`crowd` reaction or a second character) |
| Reveal behind | a character with `action: walk_in` timed on the line (the engine walks him in) |
| Cut | the default; `transition: whip` only into a cutaway |
| Sound on what you see | `sfx` with `on_word` on the visible moment; at most 2 per scene |

## 7. Second study (2026-10-10): *The Second Punic War (Part 1)*, for the owner's four complaints about ep 23
The owner: "still monotone and boring"; "never a time where the narrator talks and the background is just the people waiting";
"it starts and ends suddenly"; "the camera zooms in a weird way in dialogue and the characters shake when they talk".
- **Narration is always illustrated.** While the narrator talks, the picture shows what each sentence says and changes every
  4-5 seconds: a map with little figures on it, the event itself (a battle), a plain white card with a simple drawing (a money
  bag handed over), the map exploding. Characters never stand and wait while the narrator speaks. A sketch (dialogue) is a
  separate shot that starts when the characters start talking.
- **The opening is a cold-open sketch** (about a minute: a place-and-date card on black, a wide establishing shot with a
  banner, then a scene that escalates to a punchline), then a music sting and a fast cut into the title card, then the
  narrator begins with the context. The video never starts on a cold line.
- **The ending slows down**: the narrator's last lines are calm and ominous, the camera pushes in slowly on the hero, the
  music swells, then a black end card holds while the music plays out (about 15 seconds). Never a sudden stop.
- **Dialogue camera = cuts between still framings, never zooms.** Two-shot -> cut to a tighter two-shot as it heats up ->
  cut to a single of whoever has the punchline -> cut back wide for the reaction -> cut to a close-up for the payoff line.
  Each framing holds still or drifts very slowly.
- **Characters don't sway while talking.** The speaker makes one clear gesture per line (arms up for a rant), the listener
  turns his head or reacts once. Otherwise they are still, and the mouth carries the talking.
- **Pace**: about 151 words a minute over the whole video, including the joke pauses (ours was 136, on a slowed Kokoro voice).
- **Music** runs under everything, with stings on the cold open, the title and the ending.
