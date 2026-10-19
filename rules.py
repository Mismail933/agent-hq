"""
Live team rules (2.24.0, the full list in 2.25.0): behaviour settings Atlas changes with `hq rule set <key> <value> "why"`, so no
Builder and no restart is needed. Every change is logged (`rule_changed`: who, why, old, new), kept in `rules_history` (versions)
and can be undone. The office shows them in Spend & limits -> Team rules.

How a rule takes effect:
- rules with a `target` (module, attribute[, dict key]) are written onto that setting: by the office at start, before every job
  and right after a change (`apply_all`), and by the tools that run as their own process (animate.py) when they start;
- the others are read where they act, with `rules.get(key)` (fresh every time).

Money (caps, allowances, API spend), keys, hires, uploads, the safety scan and the off-limits list are NOT rules: they stay the
owner's (`control_plane.LIMITS`, changed by Atlas only on the owner's explicit word).

STANDING RULE (the owner, 2026-10-08): whatever Atlas can't change himself that is a team rule, a setting, an unblock or an agent
instruction becomes a rule here, not a one-off fix. To add one: a line in RULES (+ `rules.get` where it acts, if it has no target).
"""
import json
import string
import sys
import time

import control_plane as cp

AGENTS = ("Doulya", "Sage", "Vera", "Serge", "Calina", "Scout", "Israa", "Rana", "Omar", "Tarek")
# The agents' own instructions: the code's text, replaceable as a whole (`hq prompt <agent> set --file ...`)
PROMPT_TARGET = {"Doulya": ("agents", "DOULYA_SYSTEM"), "Sage": ("agents", "SAGE_SYSTEM"), "Vera": ("agents", "VERA_SYSTEM"),
                 "Serge": ("agents", "SERGE_SYSTEM"), "Calina": ("agents", "CALINA_SYSTEM_V3"), "Scout": ("quality", "SCOUT_SYSTEM"),
                 "Israa": ("quality", "ISRAA_BASE"), "Rana": ("animator", "SYSTEM"), "Omar": ("omar", "OMAR_SYSTEM"),
                 "Tarek": ("sound_agent", "SYSTEM")}
NOT_FORMATTED = {"Rana", "Tarek"}   # used as is (its braces are code examples, not placeholders)


def _r(group, kind, default, low, high, label, target=None, scale=1):
    return {"group": group, "kind": kind, "default": default, "low": low, "high": high, "label": label, "target": target, "scale": scale}


RULES = {
    # VIDEO & RENDER
    "video.short_max_seconds": _r("Video & render", "float", 178.0, 30, 600, "A finished video up to this long is labelled a Short (#shorts); longer = a regular video. A label only, never a refusal", ("animate", "SHORT_LIMIT")),
    "video.hard_cap_minutes": _r("Video & render", "float", 16.0, 1, 60, "Only a video longer than this is refused", ("animate", "VIDEO_CAP"), 60),
    "script.min_words": _r("Video & render", "int", 50, 10, 500, "A script shorter than this (narration words) is sent back", ("quality", "MIN_WORDS")),
    "script.max_words": _r("Video & render", "int", 1800, 100, 9000, "A script longer than this is sent back (about 130 words a minute)", ("quality", "MAX_WORDS")),
    "script.min_scenes": _r("Video & render", "int", 7, 1, 60, "Fewest scenes in an animated script", ("quality", "MIN_SCENES")),
    "script.max_scenes": _r("Video & render", "int", 20, 3, 120, "Most scenes in an animated script", ("quality", "MAX_SCENES")),
    "script.max_line_words": _r("Video & render", "int", 34, 8, 200, "Longest single spoken line (longer lines of whole sentences are split)", ("quality", "MAX_LINE_WORDS")),
    "script.max_scene_words": _r("Video & render", "int", 60, 10, 400, "Most words in one dialogue scene before it is split", ("quality", "MAX_SCENE_WORDS")),
    "script.auto_split": _r("Video & render", "bool", True, None, None, "Split over-long lines into scenes by themselves (off = send them back to Calina)"),
    "render.require_assets": _r("Video & render", "bool", True, None, None, "A video isn't rendered while art its script needs (its own backdrops, props, costumes) isn't drawn yet (off = render with the kit anyway; one episode: hq assets <id> skip)"),
    "render.kit_requests_block": _r("Video & render", "bool", True, None, None, "An older script that names missing art only in free text (kit_requests) is refused too, until the art is listed and drawn (off = only listed assets count)"),
    "assets.auto_make": _r("Video & render", "bool", True, None, None, "When a script that needs its own art is approved (or its render is refused for it), Rana starts drawing it by herself"),
    "assets.review_rounds": _r("Review & quality", "int", 1, 0, 4, "Times Israa may send a backdrop, prop or costume back to Rana"),
    "review.assets": _r("Review & quality", "bool", True, None, None, "Israa checks every backdrop, prop and costume Rana draws for a story (off = used as drawn)"),
    "voice.drop_repeats": _r("Video & render", "bool", True, None, None, "A word the voice says twice by mistake ('are are', 'heads. heads.', 'repaid raid') or a stray number it adds is cut out of the voice track before the video is made"),
    "voice.line_check": _r("Video & render", "bool", True, None, None, "Every voiced line is measured before anything is animated: a silent line is re-voiced (or an earlier take of the same words reused), a line where the voice repeats a word or adds one is voiced again; still silent = the render stops and names the line"),
    "voice.silent_level": _r("Video & render", "float", -45.0, -70, -20, "For that check, a line with less voice than this (dB, 20 ms windows) counts as silent"),
    "voice.line_retakes": _r("Video & render", "int", 1, 0, 2, "How many times one bad line (silent, or a word said twice) is voiced again by ElevenLabs before the render goes on (or stops, if silent)"),
    "video.card_as_insert": _r("Video & render", "bool", True, None, None, "A text card is a short insert over the last scene with people (its lines one at a time, big), never the whole picture (off = full-screen cards as before)"),
    "video.card_insert_seconds": _r("Video & render", "float", 4.0, 1, 15, "Each line of a card insert stays up at most this long (or until the next line)"),
    "video.wide_person_height": _r("Video & render", "float", 0.55, 0, 0.9, "In a wide (16:9) picture everyone stands at this share of the picture's height, the same in every room, so the room shows above them and a cut to the speaker cuts in (0 = the old way: as tall as fits)"),
    "video.place_from_words": _r("Video & render", "bool", True, None, None, "A kit scene whose words name the Nile is shown at the Nile; a narrated line about travel to a far place (Europe, Cairo, Mecca...) is shown on a map"),
    "video.freeze_flash": _r("Video & render", "bool", False, None, None, "A freeze-frame label starts with a short white flash (off = no flash: on ep 31 it read as blank, washed-out frames)"),
    "rana.bespoke_dialogue": _r("Review & quality", "bool", False, None, None, "Rana may draw scenes where two or more people talk (off = the kit draws them: it cuts to each speaker and only his mouth moves)"),
    "render.browser_timeout_s": _r("Video & render", "int", 120, 30, 900, "Seconds the cartoon's headless browser may take to start", ("animate", "BROWSER_TIMEOUT_MS"), 1000),
    "voice.words_per_minute": _r("Video & render", "int", 130, 90, 200, "Narration pace the voice is fitted to", ("animate", "TARGET_WPM")),
    "voice.eleven_start_speed": _r("Video & render", "float", 0.88, 0.7, 1.2, "ElevenLabs reading speed (1.0 = its normal pace)", ("animate", "ELEVEN_START_SPEED")),
    "voice.eleven_model": _r("Video & render", "choice", "eleven_v3", ("eleven_v3", "eleven_multilingual_v2"), None, "ElevenLabs model (v3 acts the lines)", ("settings", "ELEVEN_MODEL")),
    "voice.eleven_v3_stability": _r("Video & render", "choice", "0.5", ("0.0", "0.5", "1.0"), None, "ElevenLabs v3 stability: 0.0 creative, 0.5 natural, 1.0 robust", ("settings", "ELEVEN_V3_STABILITY")),
    # PACING & SOUND
    "pace.still_max_s": _r("Pacing & sound", "float", 4.0, 1, 20, "Longest stretch with nothing changing on screen before Israa flags it", ("quality", "STILL_MAX")),
    "pace.reframe_every_s": _r("Pacing & sound", "float", 4.0, 1, 15, "A stretch with nothing planned gets a cut to another framing this often (seconds)", ("animate", "REFRAME_EVERY")),
    "voice.tempo": _r("Video & render", "float", 1.08, 0.8, 1.4, "The whole voice track is played this much faster (pitch kept; 1.0 = as made)", ("animate", "NARR_TEMPO")),
    "voice.pronounce": _r("Video & render", "text", "Syene=sigh-ee-nee; Eratosthenes=erra-toss-thuh-neez; Beta=bay-tuh", None, None, "How the voices must say names they get wrong: Word=respelling; Word2=respelling2 (captions keep the real spelling; one word each, syllables joined by hyphens; `hq say` edits one word)", ("animate", "PRONOUNCE")),
    "video.title_seconds": _r("Video & render", "float", 2.6, 0, 8, "The title card after the cold open holds this long (0 = no title card)", ("animate", "TITLE_SECONDS")),
    "video.end_card_seconds": _r("Video & render", "float", 4.5, 1, 20, "The end card holds this long while the music plays out", ("animate", "OUTRO_SECONDS")),
    "video.end_hold_seconds": _r("Video & render", "float", 2.0, 0, 8, "After the last word the last shot (pushed in on the people) holds this long before the end card", ("animate", "END_HOLD")),
    "video.end_fade_seconds": _r("Video & render", "float", 1.0, 0.1, 5, "The end card fades in over the last shot this slowly (seconds)", ("animate", "END_FADE")),
    "video.shape": _r("Video & render", "text", "3=wide", None, None, "The picture's shape per project: N=wide (1920x1080, a regular YouTube video) or N=vertical (1080x1920, a Short); several with ';' (3=wide; 6=vertical). A project not listed is vertical. Layout, captions, title and end cards, framing and Rana's drawings follow it"),
    "video.frame_margin_px": _r("Video & render", "int", 60, 0, 200, "Safe margin at the picture's edges (px of 1080): whoever speaks stays fully inside it; people half cut by the edge in a close shot are left out of it", ("animate", "FRAME_MARGIN")),
    "video.speaker_min_height": _r("Video & render", "float", 0.40, 0, 0.9, "Whoever talks fills at least this share of the picture's height (a wide shot cuts in on him; 0 = off)", ("animate", "SPEAKER_MIN_H")),
    "captions.heard_words": _r("Video & render", "bool", True, None, None, "Captions are timed to where the voice really says each word (the words and numbers are always the script's; off = the script's own timings). Words over silence are never captioned"),
    "pace.freeze_frames": _r("Pacing & sound", "int", 48, 10, 240, "How long a freeze-frame label holds (frames, 30 a second)", ("animate", "FREEZE_FRAMES")),
    "pace.action_hold_frames": _r("Pacing & sound", "int", 30, 5, 180, "How long a pose-action (facepalm, shrug) is held (frames)", ("animate", "ACTION_HOLD")),
    "sound.music_volume": _r("Pacing & sound", "float", 0.16, 0, 1, "Music volume under the voices (0-1; it also ducks while anyone speaks)", ("animate", "MUSIC_VOLUME")),
    # REVIEW & QUALITY
    "review.rounds": _r("Review & quality", "int", 2, 0, 6, "Times Israa may send a script back to Calina", ("quality", "REVIEW_ROUNDS")),
    # THE SCRIPT GATE (2.58.0, the owner: "you and israa both review it; ill only receive when you both give it 8 at least; when any of you
    # return with note she fixes those notes and not re-write it completely")
    "script.min_score": _r("Review & quality", "int", 8, 5, 10, "A long story script reaches the owner only when Israa AND the Builder both give it at least this (out of 10)"),
    "script.builder_review": _r("Review & quality", "bool", True, None, None, "The Builder chat reviews every long story script too, after Israa (off = Israa's score alone opens the gate)"),
    "script.fix_mode": _r("Review & quality", "choice", "notes", ("notes", "rewrite"), None, "When a reviewer sends a story script back: notes = Calina fixes only what the notes say (edits; every other sentence stays as it was), rewrite = she writes it again"),
    "script.gate_rounds": _r("Review & quality", "int", 4, 1, 8, "Fix rounds a story script may take before the gate stops and tells Atlas it is stuck (it never goes to the owner under the score)"),
    "check.spine": _r("Review & quality", "bool", True, None, None, "The story-spine check blocks a script (off = advice only)"),
    "check.ear": _r("Review & quality", "bool", True, None, None, "The ear check (hard-to-say lines) blocks a script (off = advice only)"),
    "check.length": _r("Review & quality", "bool", True, None, None, "The word/scene limits block a script (off = advice only)"),
    "jobs.calina_timeout_minutes": _r("Team & schedules", "int", 40, 10, 120, "How long one of Calina's script runs may take on Claude Code (Fable writes slower)"),
    "calina.api_fallback_scenes": _r("Team & schedules", "bool", False, None, None, "Let Calina fall back to the paid API for animated scene files (off: they are too long for it and fail)"),
    "atlas.autopilot": _r("Team & schedules", "bool", False, None, None, "Autopilot: the office wakes Atlas by itself (when work finishes, and every few minutes) so work keeps moving while the owner is away"),
    "atlas.autopilot_minutes": _r("Team & schedules", "int", 20, 5, 240, "Autopilot: wake Atlas at least this often (minutes) while there is something to move"),
    "atlas.new_chat_note": _r("Team & schedules", "text", "[NEW CHAT: the owner or you started a fresh conversation; the old one is gone. "
                              "First read atlas-journal.md (your standing orders, decisions and the latest handoff) and "
                              "requests-for-builder.md, run `hq status`, then tell the owner in 3 short lines where things stand.]",
                              None, None, "What a fresh Atlas chat (office New chat button, hq atlas-new) is told first"),
    "atlas.autopilot_approve": _r("Team & schedules", "bool", False, None, None, "Autopilot may approve a script Israa PASSED and render it (OWNER ONLY; nothing is ever uploaded without the owner)"),
    "atlas.ships": _r("Team & schedules", "bool", False, None, None, "Atlas may ship Ghassan's checked changes without the owner's click (OWNER ONLY; never money, keys, limits, uploads, the updater or the guardrails; /undo on the phone)"),
    "rana.bespoke": _r("Review & quality", "bool", True, None, None, "Rana draws the scenes Calina marks 'bespoke' before a render (off = the kit draws them)"),
    "rana.min_drawn_percent": _r("Review & quality", "int", 25, 0, 90, "A scene Rana draws must have something drawn in at least this % of the picture at its end (else it goes back to her once, then the kit draws it; 0 = no check)"),
    "check.narration": _r("Review & quality", "bool", True, None, None, "A scene where the narrator talks at length while characters just stand there blocks a script (off = advice only)"),
    "check.video": _r("Review & quality", "choice", "block", ("block", "warn", "off"), None, "Automatic video checks on every render (no AI: voice under every caption, captions = the script, no blank frames, speakers on screen, no long still, a character first): block = a fault stops the render and names the time, warn = reported only, off = not run"),
    "check.still_max_seconds": _r("Review & quality", "float", 8.0, 2, 60, "The automatic checks stop a video where nothing changes on screen for longer than this (seconds; title and end card excepted)"),
    "check.min_drawn_percent": _r("Review & quality", "int", 8, 0, 60, "The automatic checks call a frame blank when less than this % of the picture has anything drawn (title and end card excepted; 0 = no check)"),
    "check.card_max_seconds": _r("Review & quality", "float", 6.0, 2, 60, "The automatic checks stop a video where a text card fills the whole picture for longer than this (seconds)"),
    "check.dialogue_cut_seconds": _r("Review & quality", "float", 8.0, 2, 60, "The automatic checks stop a video where two or more people talk in one shot with no cut to the speaker for longer than this (seconds)"),
    "check.heads_in_frame": _r("Review & quality", "bool", True, None, None, "The test render marks every frame where someone's head is cut by the top of the picture, and the checks stop on it"),
    "check.voice_repeats": _r("Review & quality", "bool", True, None, None, "The automatic checks listen to the finished voice track (test and full render, the same audio) and stop on a word it says twice or adds ('Literally. Literally.', 'repaid raid', '1324. 4.'); the test's transcript then shows what is really heard"),
    "rana.redraw": _r("Review & quality", "text", "", None, None, "Rana redraws one of her scenes with a note, once, at the next render (test or full): episode:scene=note, several with ';' (31:22=the quill draws the king, throne and crown in clean separate strokes). She gets her old drawing and the note; the new drawing then replaces the old one for good, so clear the line after"),
    "check.opening_character": _r("Review & quality", "bool", True, None, None, "The automatic checks require the very first frame to show a character (not a title or an empty set)"),
    "render.test_first": _r("Video & render", "bool", True, None, None, "Every full render of an animated video runs the quick test render first (a frame a second, same audio, the automatic checks) and stops if it fails; skipped when a test already passed on this version and these scenes"),
    "check.stranger_script": _r("Review & quality", "bool", True, None, None, "The stranger test on scripts (off = not run)"),
    "check.stranger_video": _r("Review & quality", "bool", True, None, None, "The stranger test on finished videos (off = not run)"),
    "review.video": _r("Review & quality", "bool", True, None, None, "Israa reviews every finished video before the owner sees it"),
    # THE SOUND & VOICE DIRECTOR (2.56.0, sound_agent.py)
    "sound.rounds": _r("Tarek: sound & voice", "int", 2, 1, 4, "Times Tarek listens, fixes the mix by its settings and listens again", ("sound_agent", "ROUNDS")),
    "sound.fix": _r("Tarek: sound & voice", "bool", True, None, None, "Tarek fixes the mix himself (levels, recordings, accents; off = notes only)"),
    "review.design": _r("Review & quality", "bool", True, None, None, "Israa checks Rana's design options before the owner sees them (off = straight to the owner)"),
    "review.style_frames": _r("Review & quality", "bool", True, None, None, "Israa checks Rana's style frames for a client's music video before the owner sees them (off = straight to the owner)"),
    "review.voice_versions": _r("Review & quality", "bool", True, None, None, "Israa reviews voice versions before the owner compares them"),
    "cast.review_rounds": _r("Review & quality", "int", 2, 0, 6, "Times Israa may send Rana's redrawn cast characters back to her", ("cast", "ROUNDS")),
    "cast.final_check": _r("Review & quality", "bool", True, None, None, "Before a redrawn cast reaches the owner, its final drawing is always rendered and checked by Israa once more (if it changed after her last check)"),
    # TEAM & SCHEDULES
    "team.doulya_daily": _r("Team & schedules", "bool", True, None, None, "Doulya scouts once a day by herself", ("settings", "SCOUT_AUTOMATICALLY")),
    "team.doulya_picks": _r("Team & schedules", "int", 2, 1, 6, "Ideas Doulya puts in the inbox each round", ("settings", "DOULYA_PICKS")),
    "team.doulya_searches": _r("Team & schedules", "int", 6, 1, 20, "Web searches per scouting round", ("settings", "DOULYA_MAX_SEARCHES")),
    "team.ghassan_on": _r("Team & schedules", "bool", True, None, None, "Ghassan builds Atlas's requests by himself", ("settings", "GHASSAN_ON")),
    "team.ghassan_every_minutes": _r("Team & schedules", "int", 10, 2, 240, "How often Ghassan looks for a new request", ("settings", "GHASSAN_EVERY_MINUTES")),
    "office.auto_restart": _r("Team & schedules", "bool", True, None, None, "The office restarts by itself (once nothing is running) when its program files change or a new version is on GitHub"),
    "office.update_check_minutes": _r("Team & schedules", "int", 10, 2, 240, "How often the office checks for changed program files and a new version"),
    "cast.auto_resume": _r("Team & schedules", "bool", True, None, None, "A cast redraw that stopped because an agent's daily allowance ran out picks up by itself where it stopped once the allowance is back"),
    "jobs.allowance_check": _r("Team & schedules", "choice", "wait", ("wait", "warn", "off"), None,
                               "Before a long job (Rana's cast or design, Israa's reviews, Calina's batch): if an agent it needs is out of today's allowance, wait = don't start it and tell Atlas, warn = start and tell Atlas, off = no check"),
    "jobs.resume_steps": _r("Team & schedules", "bool", True, None, None, "Long jobs save each finished step (scripts written, Israa's verdicts, a made video, drawn options, finished characters) and after a restart, a crash or an allowance stop continue from the last one (off = start over)"),
    "jobs.resume_tries": _r("Team & schedules", "int", 2, 0, 10, "A job cut off more than this many times in a row is given up instead of started again (so a job that crashes the office can't loop)"),
    "jobs.allowance_low_percent": _r("Team & schedules", "int", 10, 0, 90, "For that check, an agent with less than this % of today's allowance left counts as out (a check only; the allowance itself is the owner's)"),
    # OMAR (2.44.0): the YouTube channel, read-only
    "omar.enabled": _r("Omar & the channel", "bool", True, None, None, "Omar reads the YouTube channel every day and writes a weekly note (needs YouTube connected in Spend & limits)"),
    "omar.projects": _r("Omar & the channel", "text", "3,5", None, None, "The projects whose YouTube channels Omar looks after, in order (3 = POV Then History, 5 = Storygraphics); each needs its own Connect in Spend & limits -> Your YouTube, and its snapshots go to content/project-N/channel/"),
    "omar.daily_hour": _r("Omar & the channel", "int", 9, 0, 23, "Hour (PC time) of Omar's daily look at the channel"),
    "omar.top_countries": _r("Omar & the channel", "int", 5, 0, 25, "How many countries Omar names in his daily line (where viewers are from, by views, with watch time; 0 = leave them out of the line, they stay in the snapshot and the weekly note)"),
    "omar.reach_reports": _r("Omar & the channel", "bool", True, None, None, "Omar reads impressions and click-through rate per video from YouTube's reach report (Reporting API; he sets up the report once per channel and downloads the new daily files each morning; YouTube starts the files a day or two after the setup)"),
    "omar.weekly_day": _r("Omar & the channel", "choice", "mon", ("mon", "tue", "wed", "thu", "fri", "sat", "sun"), None, "Day of Omar's weekly note (or the first day after it the office runs)"),
    "omar.phone_weekly": _r("Omar & the channel", "bool", True, None, None, "Omar's weekly note is sent to the owner's phone"),
    "omar.feed_calina": _r("Omar & the channel", "bool", True, None, None, "Omar's weekly note goes into Calina's next learning note (what to write differently)"),
    # SHORTS CUT FROM A FINISHED VIDEO (2.54.0: hq shorts; Omar picks, the office cuts, the owner uploads by hand)
    "clips.count": _r("Shorts from a video", "int", 3, 1, 8, "How many Shorts Omar cuts from a video when Atlas doesn't say"),
    "clips.min_seconds": _r("Shorts from a video", "float", 30.0, 5, 170, "A picked moment shorter than this is left out"),
    "clips.max_seconds": _r("Shorts from a video", "float", 55.0, 10, 175, "A picked moment is cut to at most this long (the end card comes on top; keep the total under 180 s for a Short)"),
    "clips.end_card_seconds": _r("Shorts from a video", "float", 2.0, 0, 8, "Length of the end card after each clip (0 = no end card)"),
    "clips.end_card_text": _r("Shorts from a video", "text", "Full story on the channel", None, None, "The end card's words (the channel's name goes under them)"),
    "clips.captions": _r("Shorts from a video", "choice", "auto", ("auto", "on", "off"), None, "Big captions from the video's audio: auto = only for a wide video (a vertical one has its own)"),
    "clips.caption_words": _r("Shorts from a video", "int", 3, 1, 8, "Words shown at a time in the captions"),
    "clips.caption_size": _r("Shorts from a video", "int", 92, 40, 160, "Caption size (pixels on the 1080x1920 picture)"),
    "clips.caption_highlight": _r("Shorts from a video", "bool", True, None, None, "The word being spoken is yellow in the captions"),
    "clips.phone": _r("Shorts from a video", "bool", True, None, None, "The finished clips are sent to the owner's phone for his OK (he uploads them himself)"),
    # PHONE
    "phone.send": _r("Phone", "choice", "decisions", ("decisions", "everything", "nothing"), None,
                     "What reaches the phone at once: decisions (things that need the owner + finished videos), everything, or nothing"),
    "phone.group_minutes": _r("Phone", "int", 15, 0, 240, "Things that need the owner are grouped: at most one phone alert per this many minutes"),
    "phone.quiet_from": _r("Phone", "int", 23, 0, 23, "Quiet hours start (hour, PC time): nothing is sent unless the owner wrote first"),
    "phone.quiet_to": _r("Phone", "int", 8, 0, 23, "Quiet hours end (hour, PC time)"),
    "phone.digest_hour": _r("Phone", "int", 9, -1, 23, "Hour of the daily phone digest of office news (-1 = no digest)"),
}
for _a in AGENTS:   # agent instructions: a standing note added to every run, and the whole text replaceable
    RULES[f"prompt.{_a}.extra"] = _r("Agent instructions", "text", "", None, None,
                                     f"Standing instructions added to every {_a} run (style notes, banned words, tone, what to do differently)")
    RULES[f"prompt.{_a}"] = _r("Agent instructions", "text", "", None, None,
                               f"{_a}'s whole instructions, replacing the code's (empty = the code's own). Keep its {{placeholders}}",
                               PROMPT_TARGET[_a])

ORIGINAL = {}   # (module, attr) -> the code's own value, captured the first time a rule is applied in this process


def _init():
    with cp._db() as con:
        con.execute("CREATE TABLE IF NOT EXISTS rules (key TEXT PRIMARY KEY, value TEXT, ts REAL, changed_by TEXT, why TEXT)")
        con.execute("CREATE TABLE IF NOT EXISTS rules_history (id INTEGER PRIMARY KEY, key TEXT, value TEXT, ts REAL, changed_by TEXT, why TEXT)")


def parse(key, value):
    if key not in RULES:
        near = [k for k in RULES if key.split(".")[0] in k][:12]
        raise ValueError(f"Unknown rule '{key}'." + (f" Did you mean: {', '.join(near)}" if near else " See `hq rule list`."))
    r = RULES[key]
    kind, low, high = r["kind"], r["low"], r["high"]
    if kind == "text":
        s = "" if value is None else str(value)
        if len(s) > 60000:
            raise ValueError(f"{key} is too long (60,000 characters at most).")
        if r["target"] and s.strip() and key.startswith("prompt.") and key.split(".")[1] in PROMPT_TARGET:
            _placeholders_ok(key, s)
        if key == "video.shape":
            _shapes(s)
        if key == "rana.redraw":
            _redraws(s)
        if key == "omar.projects" and not all(x.strip().isdigit() for x in s.replace(";", ",").split(",") if x.strip()):
            raise ValueError("omar.projects must be project numbers separated by commas, like 3,5.")
        return s
    s = str(value).strip()
    if kind == "choice":
        if s.lower() not in low:
            raise ValueError(f"{key} must be one of: {', '.join(low)}.")
        return s.lower()
    if kind == "bool":
        if s.lower() in ("on", "yes", "true", "1"):
            return True
        if s.lower() in ("off", "no", "false", "0"):
            return False
        raise ValueError(f"{key} must be on or off.")
    try:
        v = int(float(s)) if kind == "int" else float(s)
    except ValueError:
        raise ValueError(f"{key} must be a number.")
    if not low <= v <= high:
        raise ValueError(f"{key} must be between {low} and {high}.")
    return v


def _shapes(text):
    """video.shape's text -> {project id: 'wide'|'vertical'}; a malformed entry is refused (ValueError)."""
    out = {}
    for part in [p.strip() for p in str(text or "").replace(",", ";").split(";") if p.strip()]:
        pid, _, shape = part.partition("=")
        if not pid.strip().isdigit() or shape.strip().lower() not in ("wide", "vertical"):
            raise ValueError(f"video.shape: '{part}' must look like 3=wide or 3=vertical.")
        out[int(pid)] = shape.strip().lower()
    return out


def video_shape(project_id):
    """'wide' (1920x1080) or 'vertical' (1080x1920) for this project, from rule video.shape (2.50.0). Not listed = vertical."""
    try:
        return _shapes(get("video.shape")).get(int(project_id or 0), "vertical")
    except (ValueError, TypeError):
        return "vertical"


def _redraws(text):
    """rana.redraw's text -> {(episode, scene number from 1): note}; a malformed entry is refused (ValueError)."""
    out = {}
    for part in [p.strip() for p in str(text or "").split(";") if p.strip()]:
        where, _, note = part.partition("=")
        ep, _, sc = where.partition(":")
        if not (ep.strip().isdigit() and sc.strip().isdigit() and note.strip()):
            raise ValueError(f"rana.redraw: '{part[:60]}' must look like 31:22=what to draw differently (no ';' inside a note).")
        out[(int(ep), int(sc))] = note.strip()
    return out


def redraw_notes(episode_id):
    """{scene number from 1: note} for this episode, from rule rana.redraw (2.53.3)."""
    try:
        return {sc: n for (ep, sc), n in _redraws(get("rana.redraw")).items() if ep == int(episode_id)}
    except (ValueError, TypeError):
        return {}


def _fields(text):
    return {f for _, f, _, _ in string.Formatter().parse(text) if f}


def code_text(agent):
    """The agent's instructions as written in the program (read from the file, so nothing has to be imported)."""
    import ast
    from pathlib import Path
    mod, attr = PROMPT_TARGET[agent]
    tree = ast.parse((Path(__file__).parent / f"{mod}.py").read_text(encoding="utf-8"))
    names = {t.id: n.value for n in tree.body if isinstance(n, ast.Assign) for t in n.targets if isinstance(t, ast.Name)}

    def val(node, depth=0):   # string literals, + and other module-level names (e.g. SYSTEM = """...""" + API)
        if depth > 10:
            raise ValueError("too deep")
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            return node.value
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
            return val(node.left, depth + 1) + val(node.right, depth + 1)
        if isinstance(node, ast.Name) and node.id in names:
            return val(names[node.id], depth + 1)
        raise ValueError("not plain text")
    try:
        return val(names[attr])
    except (KeyError, ValueError):
        return ORIGINAL.get((mod, attr)) or getattr(sys.modules.get(mod), attr, "") or ""


def _placeholders_ok(key, text):
    """A replaced prompt must keep the code's {placeholders} and add none (else the agent's run would break)."""
    if key.split(".")[1] in NOT_FORMATTED:
        return
    orig = code_text(key.split(".")[1])
    try:
        new = _fields(text)
    except ValueError as e:
        raise ValueError(f"{key}: the text has a stray brace ({e}). Write literal braces as {{{{ and }}}}.")
    if orig is not None:
        old = _fields(orig)
        if new - old or old - new:
            raise ValueError(f"{key} must keep exactly these placeholders: {', '.join('{' + f + '}' for f in sorted(old))}"
                             + (f" (missing: {', '.join(sorted(old - new))})" if old - new else "")
                             + (f" (unknown: {', '.join(sorted(new - old))})" if new - old else ""))


def _stored():
    _init()
    with cp._db() as con:
        return {r["key"]: json.loads(r["value"]) for r in con.execute("SELECT key, value FROM rules")}


def get(key):
    """The rule's current value: the stored one, else the default. Read fresh every time (no restart needed)."""
    try:
        s = _stored()
        return parse(key, s[key]) if key in s else RULES[key]["default"]
    except (ValueError, TypeError, KeyError):
        return RULES[key]["default"]


def _write(key, v, by, why):
    _init()
    with cp._db() as con:
        if v == RULES[key]["default"]:
            con.execute("DELETE FROM rules WHERE key=?", (key,))
        else:
            con.execute("INSERT OR REPLACE INTO rules(key,value,ts,changed_by,why) VALUES(?,?,?,?,?)",
                        (key, json.dumps(v), time.time(), by, str(why)[:300]))
        con.execute("INSERT INTO rules_history(key,value,ts,changed_by,why) VALUES(?,?,?,?,?)",
                    (key, json.dumps(v), time.time(), by, str(why)[:300]))


def _short(v):
    s = json.dumps(v) if not isinstance(v, str) else v
    return s if len(s) <= 300 else s[:300] + f"... ({len(s):,} characters)"


OWNER_ONLY = {"atlas.autopilot_approve", "atlas.ships"}   # 2.34.0: delegations only the owner grants or takes back


def set(key, value, by="Atlas", why=""):   # noqa: A001 (rules.set reads well at the call sites)
    """Returns (old, new). Logged with who and why; applied at once in this process."""
    if key in OWNER_ONLY and by != "Owner":
        raise ValueError(f"Only the owner can change {key} (a delegation he grants himself).")
    v = parse(key, value)
    old = get(key)
    _write(key, v, by, why)
    cp.log(by, "rule_changed", None, {"key": key, "old": _short(old), "new": _short(v), "why": str(why)[:300]})
    apply_all()
    return old, v


def reset(key, by="Atlas", why=""):
    if key not in RULES:
        raise ValueError(f"Unknown rule '{key}'.")
    return set(key, RULES[key]["default"], by, why or "back to the default")


def undo(key, by="Atlas"):
    """Put back the value before the last change (from rules_history; full texts too)."""
    if key not in RULES:
        raise ValueError(f"Unknown rule '{key}'.")
    _init()
    with cp._db() as con:
        rows = con.execute("SELECT value FROM rules_history WHERE key=? ORDER BY id DESC LIMIT 2", (key,)).fetchall()
    if not rows:
        raise ValueError(f"{key} was never changed.")
    before = json.loads(rows[1]["value"]) if len(rows) > 1 else RULES[key]["default"]
    return set(key, before, by, "undo")


def history(key, n=10):
    _init()
    with cp._db() as con:
        rows = con.execute("SELECT * FROM rules_history WHERE key=? ORDER BY id DESC LIMIT ?", (key, n)).fetchall()
    return [{"when": time.strftime("%Y-%m-%d %H:%M", time.localtime(r["ts"])), "by": r["changed_by"], "why": r["why"],
             "value": _short(json.loads(r["value"]))} for r in rows]


def apply_all():
    """Write every targeted rule onto its setting in the modules this process has loaded. Cheap; safe to call often."""
    try:
        stored = _stored()
    except Exception:
        return
    for key, r in RULES.items():
        t = r["target"]
        if not t or t[0] not in sys.modules:
            continue
        mod = sys.modules[t[0]]
        if (t[0], t[1]) not in ORIGINAL:
            ORIGINAL[(t[0], t[1])] = getattr(mod, t[1], None)
        try:
            v = parse(key, stored[key]) if key in stored else None
        except ValueError:
            v = None
        if r["kind"] == "text":   # a prompt: empty = the code's own text
            val = v if v and v.strip() else ORIGINAL[(t[0], t[1])]
        elif v is None:
            val = ORIGINAL[(t[0], t[1])] if ORIGINAL[(t[0], t[1])] is not None else r["default"] * r["scale"] if r["kind"] in ("int", "float") else r["default"]
        else:
            val = v * r["scale"] if r["kind"] in ("int", "float") else (float(v) if key == "voice.eleven_v3_stability" else v)
        if val is not None:
            setattr(mod, t[1], val)


def extra(agent):
    """The standing instructions Atlas added for this agent ('' if none), as a block to put after its system prompt."""
    key = f"prompt.{agent}.extra"
    if key not in RULES:
        return ""
    t = (get(key) or "").strip()
    return ("\n\nSTANDING INSTRUCTIONS FROM THE OWNER AND ATLAS (they override anything above that contradicts them):\n" + t) if t else ""


def view():
    s = _stored()
    with cp._db() as con:
        meta = {r["key"]: (r["changed_by"], r["why"], r["ts"]) for r in con.execute("SELECT key, changed_by, why, ts FROM rules")}
    out = []
    for k, r in RULES.items():
        v = get(k)
        out.append({"key": k, "group": r["group"], "value": _short(v) if r["kind"] == "text" else v,
                    "default": r["default"] if r["kind"] != "text" else "(the code's own)" if r["target"] else "",
                    "changed": k in s, "label": r["label"],
                    "allowed": list(r["low"]) if r["kind"] == "choice" else [r["low"], r["high"]] if r["kind"] in ("int", "float")
                    else "on/off" if r["kind"] == "bool" else "text",
                    "by": meta.get(k, ("", "", 0))[0], "why": meta.get(k, ("", "", 0))[1],
                    "when": time.strftime("%Y-%m-%d %H:%M", time.localtime(meta[k][2])) if k in meta else ""})
    return out
