# Storygraphics Shorts: what a Short must get right

Learned on the trench Short (Storygraphics #5, 2026-10-29): Israa's two rounds (redo 6, then 7), Tarek's two rounds, the Builder's own
frame checks, and the owner's words ("a catchy short that makes people click", "level up the animation", "the sound should not be slow
then fast"). Read this before making the next Short; the reviewers check every point.

## Shape
- **Native 9:16.** Build the Short as its own vertical composition (`trench.jsx` `VShort` is the model), never a wide video cropped.
  A story that moves up or down (a fall, a climb, a dive, a launch) is made for vertical: one continuous camera ride beats cuts.
- **Frame 1 is the hook.** The most striking picture is on screen in the first half second (Everest dropping into the sea), with the
  headline already full size. No plain background, no growing-from-nothing caption, no slow pan into the subject.
- **One signature move** that only animation can do (the zoom through the sea surface), and a payoff picture the whole Short builds to.
- **The end card says its own words** on the voice's words; burned-in captions stop before it (no doubled text). It keeps moving
  (a slow push), and nothing from the scene behind shows through it.
- 45-60 s. The last line points to the full video ("The whole dive is on our channel") and is posted after the full video is public,
  with the full video set as the Related video.

## Safe zones (1080 x 1920)
- Top ~6%: the Shorts top bar (search, camera). Headlines start at about y 110.
- Right edge x > ~950, from ~45% to ~85% of the height: like / dislike / comment / share. No tags or numbers there.
- Bottom ~20%: channel name, title, music. Nothing important below ~80% (y 1536); a diagram's floor sits at ~65%.
- Captions at ~70% of the height (y ~1330), centred, max width 900.
- Check every tag on the LAST frame of any push-in, not the first (a slow push carries tags off the edge).

## Real footage (the deep look, 2026-10-29: Israa's three looks at the Mariana Short, redo 7.5 -> 8 -> release 8.5)
- Build the Short natively (`deepv.jsx` `VDeep`): each scene through its own 9:16 window; never the wide video in a strip with
  blurred bands (that cut got redo 5.5: "a reposted clip, not a channel's own upload").
- Every real clip carries a tag with what it is, the place and the year when the source states them (say only what the source
  says: "filmed by NOAA" when it gives no place or date), on a dark plate, and it must not contradict the words or numbers over it
  (a seabed from a 2 km-deep gulf under "6,000 M" did). Prefer a clip from the place the story is in.
- Crop the clip to 9:16 round its subject (follow a moving animal with a keyframed `vfocus`); check burned-in source subtitles,
  logos and title cards (crop or skip them); keep a world map covering the whole phone at every frame.
- Check every tag on the LAST frame of its push-in: the animal moves into it.

## Captions
- 3 words at a time (a sentence's last 3 words get their own chunk, never a lone last word), big Oswald with a thick outline, the
  spoken word yellow. Readable from the first frame: start at 85% size, full in 3 frames.
- A caption never crosses the character. A push-in is anchored high (the head at ~40% of the height) so the body stays above them.

## Motion
- Everything is a function of the frame (closed-form springs in tiers: snap for small tags, card for boxes, heavy for big type,
  sticker for playful pops). No dead frames: the camera always drifts (noise), and something new arrives every 2-4 s.
- Anticipation before a hit (the jolt before the yank), follow-through after (splash, bubbles, a bounce on landing).
- Every zoom eases in AND out over 0.4-0.8 s; no snap back. Labels fade out before a fast move, not smeared through it.
- Transitions from the world itself (a bubble wipe under water, a zoom through the surface), never a crossfade that leaves a ghost.
- A pull-back starts from the character at the size it had (it shrinks into the dot), never from an empty frame.
- Run `musicvideo.motion_report` (story_sample does) and read its stalls and jumps before calling it done.

## Sound and voice
- The voice: one continuous Eleven v4 take for the whole Short (`voice_model` eleven_v4, `passage_chars` 3000), style `even` (one
  tempo for everything). Written as flowing sentences; a short beat (line `p.pause` 0.5-0.6) only where the picture needs it.
- Music 16-20 dB under the voice; no beds unless the library has one that really sounds like the place (Tarek: the sea bed sounds
  like wind, the deep bed like booms). Two or three accents only, each on something seen (a landing, a splash, the end card).
- Measure, then listen: the loudness report, Whisper's heard-words share (95%+), and Earshot via Tarek.

## Reviews before the owner
Israa (`scratchpad israa_sample.py <sample> "" <note>` with `vsheets.py` 1-frame-a-second sheets) and Tarek (`hq sound <spec> <video>`)
both, then the Builder's own dense tile of the opening, the transitions and the end.

## What the big Shorts channels do (studied 2026-10-31: Squire Explains, Zack D. Films, History Matters, Simple History)

Read in the browser: titles, views, captions and picture sheets, nothing downloaded. The voice's sound wasn't measured.

- **Topic:** one person or one question. A plain title that says it ("Stuck In The Sky With Balloons", "Why was Napoleon exiled to Elba?").
  Pace is free: hits run 152-231 wpm (table in VOICE-TONE.md).
- **First line:** the whole paradox or danger, not a mood.
- **A new picture on nearly every sentence:** the 3.4M Squire Short changes picture about once a second. New place, new prop, new colour.
- **Props that explain:** a route on a map, a stamped form, a document, a clock.
- **Sharpness:** Squire Explains and Zack D. Films upload 2160p at 30 fps, History Matters 1080p. A vector cartoon can render at 4K for free
  (spec `render_scale: 2`, `crf: 16`): crisp lines, and YouTube tends to serve 4K uploads at a higher bitrate. 60 fps isn't needed.
- **Captions:** 1-3 bold words, no box, at about 70% of the height, never over a face.
- **No blur or haze:** it washed out our Roman test. Get depth from layers and colour.
- **Check the silhouette:** a dark fringe, a small moustache and German banners read as Hitler (our first spy, caught on stills). Look at
  every historical character at thumbnail size before rendering.

