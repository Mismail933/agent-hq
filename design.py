"""
Rana's design jobs (2.27.0): logos and other brand art as SVG options, checked by Israa, picked by the owner.

    hq design <what> ["brief"]        e.g. hq design logo "Agent HQ: a small team of AI agents run by a manager, Atlas"

1. Rana (Opus on the subscription, she may Read the reference images the brief names) draws 3 options, each a square icon and a
   wordmark, as plain SVG (`DESIGN_SCHEMA`). `clean_svg` refuses scripts, links, embedded files and other risky parts.
2. animate.py `design-render <folder>` (the video tools' Python: Remotion's browser + Pillow) turns each SVG into PNGs: the icon at
   1024/256/64 px on light and dark, the wordmark on light and dark, and one contact sheet per option.
3. Israa looks at the sheets (`quality.review_design`): readable at 64 px, works on light and dark, matches the brief. Weak options go
   back to Rana once with her notes.
4. The owner sees the sheets in the office (Ideas -> Design) and on his phone, and taps "Use this". The choice is copied to
   content/brand/<what>/chosen/.
Files: content/brand/<what>/v<N>/option-<k>/ (icon.svg, wordmark.svg, PNGs, sheet.png) + design.json (status ready|chosen).
"""
import json
import re
import shutil
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import control_plane as cp
import workers

ROOT = Path(__file__).parent
BRAND = ROOT / "content" / "brand"
RANA = "Rana"
MAX_SVG = 60000
SAFE_FONTS = "Arial Black, Arial, Georgia, Verdana, Trebuchet MS, Impact, Segoe UI, Tahoma, Times New Roman"
# 2.62.0 (the owner: "make Rana a great logo maker"): real fonts (logo.py; rule design.real_type) and the logo-design skill's method
# (rule design.logo_method). Rana still writes SVG <text>; animate.py design-render turns it into the font's own outlines.
FONT_RULES = """- LETTERING: write every word as an SVG <text> element (it may hold <tspan>s, or a <textPath> for type on a circle or arc)
  whose font-family is one of these real fonts. Afterwards our code replaces it with the exact letter outlines of that font, with
  its kerning, at any weight the family has (font-weight 100-900 within its range). So your type is real typography:
{fonts}
  Open fonts/specimen.png with Read: it shows the name in every one of them; choose by eye, deliberately (what does the face say?).
  fonts/measures.txt gives the name's width in em per family and weight: width in px = font-size x em + letter-spacing x (letters - 1).
  Lay type out by those numbers. letter-spacing (px or em), text-anchor (start/middle/end), dominant-baseline="middle", x/y/dx/dy
  and textPath's startOffset work as in a browser. text-transform doesn't: type capitals as capitals.
  The wordmark's viewBox is fitted to what you draw afterwards (with even clear space). Keep the icon inside its 512 x 512 canvas."""
SAFE_RULES = """- The WORDMARK sets the name in a font from this list only (the renderer has no others): """ + SAFE_FONTS + """. Use
  text-anchor and letter-spacing deliberately; pair it with a small version of the icon if that helps."""
METHOD = """
YOUR METHOD is the logo-design skill (MIT licence, by kaankiziltug), copied into logo-skill/. Before you draw, Read
logo-skill/SKILL.md, then logo-skill/references/principles.md, mark-types.md, typography.md, visual-techniques.md,
svg-construction.md and testing-checklist.md (and color.md when colour carries the idea). Then work through its phases yourself:
the brief (exact name, what they do, audience, 3-5 adjectives, where it must work), the category's cliches (off-limits unless you
give them a fresh form), a word map, 8-12 one-sentence concepts across at least two mark types, and build the three strongest and
most different. Test each in your head at 16 px, in one colour and reversed, and do its craft pass (letter test, junctions,
literalness). Put your concepts in `longlist` (one line each, the three you built marked) and each option's mark type in `mark_type`.
Where the skill differs from this job, this job wins: you can't run its scripts and there is no logo library (our code renders your
files, sets the type, runs its audit, and Israa reviews them); don't ask questions or stop at a checkpoint (answer now; the owner
picks from your three); the icon canvas is 512 x 512; and <text> IS how you set type here (the skill's "no live text" is done by
our code, which outlines it before anyone sees it)."""

SYSTEM = """You are Rana, the Designer & Animator of a small AI-run company (Agent HQ). Today you design brand art.

You draw in plain SVG, by hand, like a senior brand designer:
- A strong, simple idea first; then shape. Few elements, clear silhouette, generous negative space, 1-3 colours plus neutrals.
- The square ICON must read at 64 px (no thin hairlines, no small text, no detail that disappears when small) and work on BOTH a
  light (#F5F5F2) and a dark (#0B1220) background: test it in your head on both.
{lettering}
- Both are self-contained SVG 1.1: a viewBox, no width/height in % , no <script>, no <foreignObject>, no <image>, no links or
  external files, no CSS @import, no filters that blur text. Gradients and simple shapes are fine. Under 20 KB each.
- Three options that are really different from each other (different idea, not three colours of one idea).
- Never copy or imitate an existing brand's logo. Original work only.

Reference images named in the brief: open each with Read and look at it before you draw.
{method}
Answer only with the structured output."""

DESIGN_SCHEMA = {"type": "object", "properties": {
    "longlist": {"type": "array", "items": {"type": "string"}, "description": "Your 8-12 one-sentence concepts (the three you built marked)"},
    "options": {"type": "array", "minItems": 2, "maxItems": 4, "items": {
    "type": "object", "properties": {
        "name": {"type": "string", "description": "2-4 words"},
        "mark_type": {"type": "string", "description": "wordmark, monogram, letterform, pictorial, abstract, emblem, mascot or combination"},
        "idea": {"type": "string", "description": "The idea in one or two plain sentences for the owner"},
        "colors": {"type": "array", "items": {"type": "string"}},
        "icon_svg": {"type": "string", "description": "Square icon, viewBox 0 0 512 512"},
        "wordmark_svg": {"type": "string", "description": "Wordmark, viewBox about 0 0 1200 360"}},
    "required": ["name", "idea", "icon_svg", "wordmark_svg"]}}}, "required": ["options"]}

BANNED_TAGS = {"script", "foreignObject", "image", "iframe", "object", "embed", "audio", "video", "use"}


def clean_svg(svg, limit=MAX_SVG):
    """The SVG if it is safe and parses, else raises ValueError with the reason. limit: bigger for a full scene (client.py)."""
    s = (svg or "").strip()
    s = re.sub(r"^```(?:svg|xml)?\s*|\s*```$", "", s)
    if not s.startswith("<svg") and "<svg" in s:
        s = s[s.index("<svg"):]
    if len(s) > limit:
        raise ValueError(f"the SVG is {len(s):,} characters (at most {limit:,})")
    if re.search(r"(javascript:|https?://(?!www\.w3\.org)|@import|<!ENTITY|<!DOCTYPE)", s, re.I):
        raise ValueError("it links to something outside itself")
    try:
        root = ET.fromstring(s)
    except ET.ParseError as e:
        raise ValueError(f"it isn't valid SVG ({e})")
    if not root.tag.endswith("svg") or not root.get("viewBox"):
        raise ValueError("it needs an <svg> root with a viewBox")
    for el in root.iter():
        tag = el.tag.split("}")[-1]
        if tag in BANNED_TAGS:
            raise ValueError(f"<{tag}> isn't allowed")
        if any(k.split("}")[-1].lower().startswith("on") for k in el.attrib):
            raise ValueError("event handlers aren't allowed")
        if any(k.split("}")[-1] == "href" and not v.startswith("#") for k, v in el.attrib.items()):
            raise ValueError("links aren't allowed")
    return s


def _slug(what):
    return re.sub(r"[^a-z0-9]+", "-", what.lower()).strip("-")[:40] or "design"


def _sim_options():
    icons = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect x="56" y="56" width="400" height="400" rx="96" fill="#22D3EE"/><text x="256" y="320" font-family="Arial Black" font-size="200" text-anchor="middle" fill="#0B1220">HQ</text></svg>',
             '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="200" fill="#A78BFA"/><circle cx="256" cy="256" r="80" fill="#F5F5F2"/></svg>',
             '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 48 464 448H48Z" fill="#FB923C"/></svg>']
    word = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 360"><text x="600" y="230" font-family="Arial Black" font-size="150" text-anchor="middle" fill="#22D3EE">Agent HQ</text></svg>'
    return [{"name": f"Simulated {i + 1}", "idea": "Simulated option.", "colors": [], "icon_svg": s, "wordmark_svg": word} for i, s in enumerate(icons)]


def _refs(brief):
    """Reference images the brief names (Atlas-HQ/review/uploads or refs, or content/...): copied where Rana's Read can open them."""
    import atlas_engine
    folder = workers.WORK / RANA.lower() / "refs"
    shutil.rmtree(folder, ignore_errors=True)
    names = []
    for rel in sorted(set(re.findall(r"[\w./\\:-]*?(?:review/(?:uploads|refs)|content)/[\w./-]+\.(?:png|jpe?g|webp|gif)", brief or "", re.I))):
        rel = rel.replace("\\", "/")
        src = next((c for c in (Path(rel), atlas_engine.HOME / rel[rel.find("review/"):] if "review/" in rel else None,
                                ROOT / rel[rel.find("content/"):] if "content/" in rel else None) if c and c.exists()), None)
        if src:
            folder.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, folder / src.name)
            names.append(f"refs/{src.name}")
    return names


def _shorts_python():
    import os
    import settings
    p = getattr(settings, "SHORTS_PYTHON", None) or Path.home() / ".agent-hq-shorts" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    return str(p) if Path(p).exists() else None


def _logo(*args, timeout=600):
    """Run logo.py in the video tools' Python (fontTools, Pillow, vtracer). Returns its RESULT json; raises RuntimeError."""
    import subprocess
    py = _shorts_python()
    if not py:
        raise RuntimeError("the video tools aren't set up on this computer")
    p = subprocess.run([py, str(ROOT / "logo.py"), *map(str, args)], cwd=ROOT, capture_output=True, text=True, encoding="utf-8",
                       errors="replace", timeout=timeout, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    res = next((l[7:] for l in (p.stdout or "").splitlines() if l.startswith("RESULT ")), None)
    if not res:
        raise RuntimeError(((p.stderr or p.stdout or "no output").strip().splitlines() or ["?"])[-1][:300])
    return json.loads(res)


def trace(image, colors=6, bw=False):
    """vtracer (logo.py): a picture from Atlas-HQ/review/uploads|refs or content/ -> content/brand/traced/<stem>-<time>/trace.svg and
    preview.png (rendered on light). A starting point or reference for a mark, never a finished logo by itself. Returns facts."""
    import atlas_engine
    p = Path(image.replace("\\", "/"))
    cands = [p, ROOT / image, atlas_engine.HOME / image]
    for key, base in (("review/", atlas_engine.HOME), ("content/", ROOT)):
        if key in image.replace("\\", "/"):
            s = image.replace("\\", "/")
            cands.append(base / s[s.find(key):])
    src = next((c.resolve() for c in cands if c.is_file()), None)
    if not src:
        raise ValueError(f"no such picture: {image}")
    roots = [(atlas_engine.HOME / "review").resolve(), (ROOT / "content").resolve()]
    if not any(r in src.parents for r in roots) or src.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
        raise ValueError("only a PNG/JPG/WEBP from Atlas-HQ/review/ or content/ can be traced")
    out = BRAND / "traced" / f"{_slug(src.stem)}-{time.strftime('%Y%m%d-%H%M%S')}"
    got = _logo("trace", src, out / "trace.svg", "--colors", max(2, min(int(colors), 32)), *(["--bw"] if bw else []), timeout=900)
    got["svg"] = (out / "trace.svg").relative_to(ROOT).as_posix()
    try:
        _logo("still", out / "trace.svg", out / "preview.png", timeout=900)
        got["preview"] = (out / "preview.png").relative_to(ROOT).as_posix()
    except RuntimeError as e:
        got["preview_error"] = str(e)[:200]
    return got


def name_of(what, brief, name=""):
    """The name to set: the one given, else the first word in capitals in the brief (EPOCH), else the thing designed."""
    if name.strip():
        return name.strip()[:40]
    for w in re.findall(r"\b[A-Z][A-Z0-9&'-]{2,}\b", brief or ""):
        if w not in ("THE", "AND", "FOR", "NOT", "NEW", "LOGO", "ICON", "SVG", "PNG", "AN", "YOUTUBE", "FILM", "STUDIO"):
            return w
    return what.strip().title()[:40]


def allowed_fonts():
    import logo
    import rules
    got = [logo.family_of(x.strip())[0] for x in (rules.get("design.fonts") or "").split(",") if x.strip()]
    return [f for f in logo.FAMILIES if not got or f in got]


def _prepare(name):
    """Rana's work folder for a design job: the font sheet + measures and the skill's method, as the live rules say.
    Returns (system prompt, the files she should open, notes for the log)."""
    import logo
    import rules
    folder = workers.WORK / RANA.lower()
    lettering, method, opens, notes = SAFE_RULES, "", [], []
    if rules.get("design.real_type"):
        fams = allowed_fonts()
        try:
            shutil.rmtree(folder / "fonts", ignore_errors=True)
            _logo("prep", folder / "fonts", name, ",".join(fams))
            lines = "\n".join(f"    {f} ({logo.FAMILIES[f][2]}): {logo.FAMILIES[f][3]}" for f in fams)
            lettering = FONT_RULES.format(fonts=lines)
            opens += ["fonts/specimen.png", "fonts/measures.txt"]
        except (RuntimeError, OSError, ValueError) as e:
            notes.append(f"the font sheet couldn't be made ({e}); Rana used the system fonts")
    if rules.get("design.logo_method"):
        skill = logo.ensure_skill()
        if skill:
            dst = folder / "logo-skill"
            shutil.rmtree(dst, ignore_errors=True)
            (dst / "references").mkdir(parents=True, exist_ok=True)
            shutil.copy2(skill / "SKILL.md", dst / "SKILL.md")
            for f in (skill / "references").glob("*.md"):
                if f.name != "library-guide.md":   # the library (other brands' logos) isn't here
                    shutil.copy2(f, dst / "references" / f.name)
            method = METHOD
            opens.append("logo-skill/SKILL.md")
        else:
            notes.append("the logo-design skill isn't on this computer (git missing?); Rana drew without its method")
    return SYSTEM.replace("{lettering}", lettering).replace("{method}", method), opens, notes


def ask_rana(what, brief, notes="", name=""):
    """Rana draws the options. Returns the list of option dicts (SVGs cleaned); unusable options are dropped with a reason."""
    import os
    if os.environ.get("HQ_SIMULATE") == "1":
        got = {"options": _sim_options()}
    else:
        refs = _refs(brief)
        nm = name_of(what, brief, name)
        system, opens, why = _prepare(nm)
        for w in why:
            cp.log(RANA, "design_note", None, {"what": what, "note": w})
        task = (f"Design: {what}\nThe name to set: {nm}\nBrief from the owner and Atlas: {brief or '(none)'}\n"
                + (f"\nOpen first: {', '.join(opens)}\n" if opens else "")
                + (f"\nReference images (open each with Read first): {', '.join(refs)}\n" if refs else "")
                + (f"\nIsraa's notes on your last attempt (fix exactly these, keep what she liked):\n{notes}\n" if notes else "")
                + "\nDraw three options.")
        got, _ = workers.run(RANA, None, system, task, tools=("Read",) if (refs or opens) else (), schema=DESIGN_SCHEMA,
                             max_turns=40 if opens else 12)
        if got.get("longlist"):
            cp.log(RANA, "design_longlist", None, {"what": what, "concepts": got["longlist"][:12]})
    out = []
    for o in got.get("options") or []:
        try:
            o["icon_svg"], o["wordmark_svg"] = clean_svg(o.get("icon_svg")), clean_svg(o.get("wordmark_svg"))
            out.append(o)
        except ValueError as e:
            cp.log(RANA, "design_option_dropped", None, {"name": o.get("name", ""), "why": str(e)[:200]})
    if not out:
        raise RuntimeError("Rana's options couldn't be used (each was refused by the safety check).")
    return out


def save_options(what, options, version=None):
    """Write the options into content/brand/<what>/v<N>/. Returns the version folder."""
    base = BRAND / _slug(what)
    if version is None:
        version = 1 + max([int(p.name[1:]) for p in base.glob("v*") if p.name[1:].isdigit()] or [0])
    folder = base / f"v{version}"
    for k, o in enumerate(options, 1):
        f = folder / f"option-{k}"
        f.mkdir(parents=True, exist_ok=True)
        (f / "icon.svg").write_text(o["icon_svg"], encoding="utf-8")
        (f / "wordmark.svg").write_text(o["wordmark_svg"], encoding="utf-8")
        (f / "meta.json").write_text(json.dumps({k2: v for k2, v in o.items() if not k2.endswith("_svg")}, indent=1), encoding="utf-8")
    return folder


REVIEW_TASK = """Review {n} logo options Rana drew for: {what}. Brief: {brief}

Each option has one contact sheet (open each with Read): the icon at 256 px, at 64, 32 and 16 px real size and the 64 px enlarged,
on light and dark; the wordmark large and at header size, on light and dark.
{sheets}
{facts}
For each option judge, strictly, like a senior brand designer:
1. Legible small: does the icon's shape survive at 64 and 32 px (a YouTube avatar) and still say something at 16? Is any text in it
   readable? Thin lines that vanish = fail.
2. Works on light AND dark backgrounds (contrast, no part disappearing).
3. The wordmark reads at header size; the typeface fits the brief; spacing and weight are deliberate; every letter reads as itself.
4. The idea: one sentence, not a category cliche, relevant but not literal; original (not an imitation of a known brand); simple
   and memorable.
5. Craft: clean junctions, consistent weights, no accidental shapes; the audit's FAIL/WARN lines are facts to weigh (near-miss angles
   and tiny details inside letters are normal for type).
Verdict good or weak, and a score 1-10. For weak: exact, drawable fixes (what to thicken, enlarge, recolour, remove, which font)."""

REVIEW_SCHEMA = {"type": "object", "properties": {"options": {"type": "array", "items": {"type": "object", "properties": {
    "option": {"type": "integer"}, "verdict": {"type": "string", "enum": ["good", "weak"]},
    "score": {"type": "integer", "minimum": 1, "maximum": 10},
    "legible_64": {"type": "boolean"}, "light_and_dark": {"type": "boolean"}, "summary": {"type": "string"},
    "fixes": {"type": "array", "items": {"type": "string"}}},
    "required": ["option", "verdict", "legible_64", "light_and_dark", "summary"]}}}, "required": ["options"]}


def review(folder, what, brief):
    """Israa checks every option's contact sheet. Returns {option number: review}."""
    import os
    import quality
    opts = sorted(folder.glob("option-*"), key=lambda p: int(p.name.split("-")[1]))
    if os.environ.get("HQ_SIMULATE") == "1":
        return {int(o.name.split("-")[1]): {"verdict": "good" if i else "weak", "legible_64": bool(i), "light_and_dark": True,
                                             "summary": "Simulated review.", "fixes": [] if i else ["Simulated: thicken the strokes"]}
                for i, o in enumerate(opts)}
    stage = workers.WORK / quality.ISRAA.lower() / "design"
    shutil.rmtree(stage, ignore_errors=True)
    stage.mkdir(parents=True, exist_ok=True)
    names, facts = [], []
    for o in opts:
        shutil.copy2(o / "sheet.png", stage / f"{o.name}.png")
        names.append(f"  - option {o.name.split('-')[1]}: design/{o.name}.png")
        try:   # 2.62.0: the real fonts used and the logo-design skill's audit of each file
            au = json.loads((o / "audit.json").read_text(encoding="utf-8"))
            meta = json.loads((o / "meta.json").read_text(encoding="utf-8"))
            line = [f"Option {o.name.split('-')[1]} ({meta.get('name', '')}; {meta.get('mark_type') or 'mark type not given'}): "
                    f"fonts {', '.join(au.get('fonts') or []) or 'none'}"]
            for part in ("icon", "wordmark"):
                a = au.get(part) or {}
                if a:
                    line.append(f"  {part} audit {a.get('score')}/100, colours {', '.join(a.get('colors') or [])}"
                                + "".join(f"\n    {x}" for x in (a.get("findings") or [])[:6]))
            line += [f"  note: {n}" for n in (au.get("notes") or [])[:4]]
            facts.append("\n".join(line))
        except (OSError, ValueError):
            pass
    import rules
    critique = ""
    if rules.get("design.logo_method"):
        import logo
        skill = logo.ensure_skill()
        if skill:
            for ref in ("critique.md", "testing-checklist.md"):
                shutil.copy2(skill / "references" / ref, stage / ref)
            critique = ("\nFirst Read design/critique.md and design/testing-checklist.md (the logo-design skill's critique and tests, MIT): "
                        "judge by them. Ignore their script names.\n")
    fact_text = critique + ("\nMeasured by code (the skill's svg_audit on each finished file):\n" + "\n".join(facts) + "\n" if facts else "")
    system = quality.ISRAA_BASE.format(today=time.strftime("%B %d, %Y"),
                                       style="(Judge brand design: legibility at small sizes, light and dark, originality, the brief.)")
    got, _ = workers.run(quality.ISRAA, None, system, REVIEW_TASK.format(n=len(opts), what=what, brief=brief or "(none)", sheets="\n".join(names),
                                                                         facts=fact_text),
                         tools=("Read",), schema=REVIEW_SCHEMA, max_turns=30)
    out = {int(r["option"]): r for r in got.get("options") or [] if str(r.get("option", "")).isdigit() or isinstance(r.get("option"), int)}
    for k, r in out.items():
        cp.log(quality.ISRAA, "design_reviewed", None, {"what": what, "option": k, "verdict": r.get("verdict")})
    return out


def replace_option(folder, k, o):
    f = folder / f"option-{k}"
    for old in [*f.glob("*.png"), *f.glob("*.text.svg"), f / "audit.json"]:
        old.unlink(missing_ok=True)
    (f / "icon.svg").write_text(o["icon_svg"], encoding="utf-8")
    (f / "wordmark.svg").write_text(o["wordmark_svg"], encoding="utf-8")
    (f / "meta.json").write_text(json.dumps({k2: v for k2, v in o.items() if not k2.endswith("_svg")}, indent=1), encoding="utf-8")


def write_state(folder, what, brief, status="ready", review=None):
    opts = []
    for f in sorted(folder.glob("option-*"), key=lambda p: int(p.name.split("-")[1])):
        meta = json.loads((f / "meta.json").read_text(encoding="utf-8"))
        try:   # the real type and the skill's audit (2.62.0)
            au = json.loads((f / "audit.json").read_text(encoding="utf-8"))
            meta["audit"] = {"fonts": au.get("fonts"), "icon": (au.get("icon") or {}).get("score"),
                             "wordmark": (au.get("wordmark") or {}).get("score")}
        except (OSError, ValueError):
            pass
        opts.append({**meta, "folder": f.relative_to(ROOT).as_posix(), "sheet": (f / "sheet.png").relative_to(ROOT).as_posix()
                     if (f / "sheet.png").exists() else "", "review": (review or {}).get(int(f.name.split("-")[1]))})
    state = {"what": what, "brief": brief, "version": int(folder.name[1:]), "status": status, "made": time.strftime("%Y-%m-%d %H:%M"),
             "options": opts}
    (folder / "design.json").write_text(json.dumps(state, indent=1), encoding="utf-8")
    return state


def open_designs():
    """Designs that wait for the owner's pick (newest version per kind)."""
    out = []
    for base in BRAND.glob("*"):
        vs = sorted((p for p in base.glob("v*") if (p / "design.json").exists()), key=lambda p: int(p.name[1:]) if p.name[1:].isdigit() else 0)
        if vs:
            d = json.loads((vs[-1] / "design.json").read_text(encoding="utf-8"))
            d["slug"] = base.name
            out.append(d)
    return out


def choose(slug, version, option, by="Owner"):
    """The owner picked one: copy its files to content/brand/<slug>/chosen/. Returns a message."""
    folder = BRAND / slug / f"v{int(version)}"
    state = json.loads((folder / "design.json").read_text(encoding="utf-8"))
    src = folder / f"option-{int(option)}"
    if not src.exists():
        raise ValueError("No such option.")
    dst = BRAND / slug / "chosen"
    shutil.rmtree(dst, ignore_errors=True)
    shutil.copytree(src, dst)
    state["status"], state["chosen"] = "chosen", int(option)
    (folder / "design.json").write_text(json.dumps(state, indent=1), encoding="utf-8")
    name = state["options"][int(option) - 1].get("name", f"option {option}")
    cp.log(by, "design_chosen", None, {"what": state["what"], "version": int(version), "option": int(option), "name": name})
    return f"Chosen: {name}. Its files are in content/brand/{slug}/chosen/."
