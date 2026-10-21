"""
Real type and logo checks for Rana's designs (2.62.0; the owner: "make Rana a great logo maker", free tools only).

Runs in the video tools' Python (~/.agent-hq-shorts: fontTools, Pillow, vtracer, certifi). design.py and animate.py call it.

- FAMILIES: 20 Google Fonts display families (SIL Open Font License: free for logos and commercial use; each folder keeps its
  OFL.txt), downloaded once into ~/.agent-hq-anim/fonts/logo/<folder>/ from google/fonts at a pinned commit (`ensure_fonts`).
- `prep(folder, name)`: what Rana looks at before drawing: specimen.png (the brand name in every family) and measures.txt (its
  width and cap height per family and weight, in em), so she lays type out by numbers, not guesses.
- `outline(svg)`: every <text> (and <tspan>, <textPath>) in her SVG becomes real letter outlines from the font it names
  (font-family, font-weight, font-size, letter-spacing, text-anchor, dominant-baseline, x/y/dx/dy; kerning from the font).
  The finished files hold no live text, so every screen shows the same letters.
- `finish(option folder)`: outline icon.svg and wordmark.svg (her originals kept as *.text.svg), fit the wordmark's viewBox to
  what is drawn (+ clear space), scale an icon that runs off its canvas back in, and audit both with the logo-design skill's
  svg_audit.py -> audit.json.
- The skill: kaankiziltug/logo-design-skill (MIT), cloned at a pinned commit into ~/.agent-hq-anim/logo-skill WITHOUT its
  library folder (other companies' trademarks). Rana reads its method; its stdlib svg_audit.py checks her files.
- `trace(image, out)`: vtracer (MIT) turns a picture (e.g. a FLUX painting from the Mac Studio) into a vector.

    python logo.py fonts                      download the fonts (once)
    python logo.py prep <folder> <name>       specimen.png + measures.txt for Rana
    python logo.py finish <option folder>     outline + fit + audit
    python logo.py outline <in.svg> <out.svg>
    python logo.py trace <image> <out.svg> [--colors N] [--bw]
    python logo.py still <in.svg> <out.png>    the renderer's picture of an SVG
"""
import json
import math
import os
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

HOME = Path.home() / ".agent-hq-anim"
FONT_DIR = HOME / "fonts" / "logo"
SKILL_DIR = HOME / "logo-skill"
SKILL_REPO = "https://github.com/kaankiziltug/logo-design-skill"
SKILL_SHA = "734090317a2155c5bf1ae8bd4cc85c6848a0128f"
SKILL = SKILL_DIR / "skills" / "logo-design"
GF_COMMIT = "47d54ca1ebb14fd864695f1d39dc734f39017c33"   # google/fonts, 2026-10-21
GF_RAW = "https://raw.githubusercontent.com/google/fonts/" + GF_COMMIT + "/ofl/{folder}/{file}"
SVG_NS = "http://www.w3.org/2000/svg"
XLINK = "http://www.w3.org/1999/xlink"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", XLINK)

# name: (google/fonts folder, files (roman only), kind, what it says)
FAMILIES = {
    "Cinzel": ("cinzel", ["Cinzel[wght].ttf"], "serif", "Roman inscription capitals: epic, historical, cinematic"),
    "Cinzel Decorative": ("cinzeldecorative", ["CinzelDecorative-Regular.ttf", "CinzelDecorative-Bold.ttf", "CinzelDecorative-Black.ttf"],
                          "serif", "Cinzel with flourished capitals: ceremonial, film title"),
    "Cormorant Garamond": ("cormorantgaramond", ["CormorantGaramond[wght].ttf"], "serif", "old-style Garamond, high contrast: literary, refined"),
    "Playfair Display": ("playfairdisplay", ["PlayfairDisplay[wght].ttf"], "serif", "high-contrast transitional serif: editorial, luxury"),
    "Marcellus": ("marcellus", ["Marcellus-Regular.ttf"], "serif", "flared Roman capitals, Trajan-like but softer: classical, calm"),
    "Bodoni Moda": ("bodonimoda", ["BodoniModa[opsz,wght].ttf"], "serif", "Didone with hairline serifs: fashion, drama (hairlines vanish small)"),
    "DM Serif Display": ("dmserifdisplay", ["DMSerifDisplay-Regular.ttf"], "serif", "bold high-contrast display serif: confident, warm"),
    "Abril Fatface": ("abrilfatface", ["AbrilFatface-Regular.ttf"], "serif", "heavy Didone headline face: loud, poster"),
    "Italiana": ("italiana", ["Italiana-Regular.ttf"], "serif", "thin airy capitals: delicate, upscale (too thin for small sizes)"),
    "Forum": ("forum", ["Forum-Regular.ttf"], "serif", "antique Roman letters: ancient, stately"),
    "Montserrat": ("montserrat", ["Montserrat[wght].ttf"], "sans", "geometric sans, 9 weights: modern, clean, versatile"),
    "Bebas Neue": ("bebasneue", ["BebasNeue-Regular.ttf"], "sans", "tall condensed capitals: film posters, bold headlines (caps only)"),
    "Oswald": ("oswald", ["Oswald[wght].ttf"], "sans", "condensed gothic: strong, compact, news and posters"),
    "Archivo Black": ("archivoblack", ["ArchivoBlack-Regular.ttf"], "sans", "heavy grotesque: punchy, sturdy"),
    "Syne": ("syne", ["Syne[wght].ttf"], "sans", "quirky wide display sans: art, culture, contemporary"),
    "Unbounded": ("unbounded", ["Unbounded[wght].ttf"], "sans", "wide rounded geometric: playful tech, bold"),
    "Space Grotesk": ("spacegrotesk", ["SpaceGrotesk[wght].ttf"], "sans", "grotesk with technical quirks: tech, science"),
    "Josefin Sans": ("josefinsans", ["JosefinSans[wght].ttf"], "sans", "elegant geometric, 1920s vintage: stylish, light"),
    "Michroma": ("michroma", ["Michroma-Regular.ttf"], "sans", "wide square extended: sci-fi, engineering"),
    "Big Shoulders Display": ("bigshouldersdisplay", ["BigShouldersDisplay[wght].ttf"], "sans", "condensed industrial: civic, strong, vertical"),
}
FALLBACK = {"serif": "Cormorant Garamond", "sans": "Montserrat"}
SERIFISH = re.compile(r"serif(?!\s*-?\s*sans)|georgia|times|garamond|didot|bodoni|trajan|roman|baskerville|caslon|palatino", re.I)
FONT_PROPS = {"font-family", "font-size", "font-weight", "font-style", "letter-spacing", "word-spacing", "text-anchor",
              "dominant-baseline", "alignment-baseline", "font-variant", "font-stretch", "text-rendering", "kerning",
              "font", "writing-mode", "xml:space", "white-space", "text-transform"}
INHERIT = ("font-family", "font-size", "font-weight", "letter-spacing", "word-spacing", "text-anchor", "dominant-baseline", "text-transform")


def say(msg):
    print(msg, flush=True)


# ---- downloads (once) ------------------------------------------------------------------------
def _ssl():
    import ssl
    try:
        import certifi   # Python's Windows certificate store is stale on the owner's PC
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def _fetch(url, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    part = dst.with_name(dst.name + ".part")
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "agent-hq"}), timeout=90, context=_ssl()) as r, \
            open(part, "wb") as f:
        shutil.copyfileobj(r, f)
    part.replace(dst)


def ensure_fonts():
    """Download any missing font file (and each family's OFL.txt). Returns the families that are complete."""
    ok = []
    for name, (folder, files, _, _) in FAMILIES.items():
        try:
            for fn in files + ["OFL.txt"]:
                dst = FONT_DIR / folder / fn
                if not dst.exists() or dst.stat().st_size == 0:
                    say(f"downloading {name}: {fn}")
                    _fetch(GF_RAW.format(folder=folder, file=urllib.parse.quote(fn)), dst)
            ok.append(name)
        except OSError as e:
            say(f"couldn't download {name}: {e}")
    return ok


def ensure_skill():
    """The logo-design skill at its pinned commit, without assets/library (trademarks). Returns its folder or None."""
    if (SKILL / "SKILL.md").exists() and (SKILL / "scripts" / "svg_audit.py").exists():
        return SKILL
    git = shutil.which("git")
    if not git:
        return None
    shutil.rmtree(SKILL_DIR, ignore_errors=True)
    run = lambda *a: subprocess.run([git, *a], cwd=SKILL_DIR if SKILL_DIR.exists() else HOME, capture_output=True, text=True, timeout=600,
                                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    HOME.mkdir(parents=True, exist_ok=True)
    run("clone", "-q", "--filter=blob:none", "--no-checkout", SKILL_REPO, str(SKILL_DIR))
    if not SKILL_DIR.exists():
        return None
    run("sparse-checkout", "init", "--no-cone")
    (SKILL_DIR / ".git" / "info" / "sparse-checkout").write_text(
        "/LICENSE\n/README.md\n/TRADEMARKS.md\n/skills/logo-design/*\n!/skills/logo-design/assets/library/\n", encoding="utf-8")
    run("checkout", "-q", SKILL_SHA)
    return SKILL if (SKILL / "SKILL.md").exists() else None


# ---- fonts -----------------------------------------------------------------------------------
_FONTS = {}


def family_of(spec):
    """'Cinzel, serif' / "'Bodoni Moda'" -> (a family we have, note or '')."""
    names = [n.strip().strip("'\"") for n in (spec or "").split(",") if n.strip()]
    for n in names:
        for fam in FAMILIES:
            if n.lower().replace(" ", "") == fam.lower().replace(" ", ""):
                return fam, ""
    first = names[0] if names else ""
    fam = FALLBACK["serif" if SERIFISH.search(spec or "") else "sans"]
    return fam, f"font '{first or '(none)'}' isn't in the logo fonts: set in {fam}"


def weight_of(v):
    v = str(v or "400").strip().lower()
    return {"normal": 400, "bold": 700, "bolder": 800, "lighter": 300}.get(v) or (int(float(v)) if re.fullmatch(r"\d+(\.\d+)?", v) else 400)


def weights(family):
    """The weights a family really has: (min, max) for a variable font, else the static files' weights."""
    from fontTools.ttLib import TTFont
    folder, files, _, _ = FAMILIES[family]
    out = []
    for fn in files:
        f = TTFont(FONT_DIR / folder / fn, lazy=True)
        if "fvar" in f:
            ax = next((a for a in f["fvar"].axes if a.axisTag == "wght"), None)
            return (int(ax.minValue), int(ax.maxValue)) if ax else (400, 400)
        out.append(f["OS/2"].usWeightClass)
    return tuple(sorted(out))


def font(family, weight=400):
    """A TTFont of that family at (the nearest) weight; variable fonts are cut at it (optical size at its display end)."""
    from fontTools.ttLib import TTFont
    folder, files, _, _ = FAMILIES[family]
    paths = [FONT_DIR / folder / fn for fn in files]
    if len(paths) == 1 and "[" in paths[0].name:
        f = TTFont(paths[0])
        axes = {a.axisTag: a for a in f["fvar"].axes}
        w = min(max(weight, axes["wght"].minValue), axes["wght"].maxValue) if "wght" in axes else None
        key = (family, w)
        if key not in _FONTS:
            from fontTools.varLib import instancer
            loc = {t: a.defaultValue for t, a in axes.items()}
            if w is not None:
                loc["wght"] = w
            if "opsz" in axes:
                loc["opsz"] = axes["opsz"].maxValue
            _FONTS[key] = instancer.instantiateVariableFont(f, loc)
        return _FONTS[key]
    best = min(paths, key=lambda p: abs(TTFont(p, lazy=True)["OS/2"].usWeightClass - weight))
    key = (family, best.name)
    if key not in _FONTS:
        _FONTS[key] = TTFont(best)
    return _FONTS[key]


class _Kern:
    """Pair kerning from the font's GPOS 'kern' feature (pair adjustment, formats 1 and 2), else the old 'kern' table."""

    def __init__(self, f):
        self.lookups, self.old = [], {}
        if "GPOS" in f and f["GPOS"].table.FeatureList:
            t = f["GPOS"].table
            idx = sorted({i for fr in t.FeatureList.FeatureRecord if fr.FeatureTag == "kern" for i in fr.Feature.LookupListIndex})
            for i in idx:
                lk = t.LookupList.Lookup[i]
                subs = []
                for st in lk.SubTable:
                    if lk.LookupType == 9:
                        st = st.ExtSubTable
                    if getattr(st, "LookupType", lk.LookupType) != 2:
                        continue
                    if st.Format == 1:
                        pairs = {}
                        for g1, ps in zip(st.Coverage.glyphs, st.PairSet):
                            for r in ps.PairValueRecord:
                                pairs[(g1, r.SecondGlyph)] = getattr(r.Value1, "XAdvance", 0) or 0 if r.Value1 else 0
                        subs.append((1, set(st.Coverage.glyphs), pairs))
                    elif st.Format == 2:
                        subs.append((2, set(st.Coverage.glyphs), (st.ClassDef1.classDefs, st.ClassDef2.classDefs, st.Class1Record)))
                if subs:
                    self.lookups.append(subs)
        elif "kern" in f:
            for kt in f["kern"].kernTables:
                if getattr(kt, "format", 0) == 0:
                    self.old.update(kt.kernTable)

    def __call__(self, a, b):
        if not a or not b:
            return 0
        if self.old:
            return self.old.get((a, b), 0)
        total = 0
        for subs in self.lookups:
            for fmt, cov, data in subs:
                if a not in cov:
                    continue
                if fmt == 1:
                    if (a, b) in data:
                        total += data[(a, b)]
                        break
                    continue
                c1, c2, rec = data
                v = rec[c1.get(a, 0)].Class2Record[c2.get(b, 0)].Value1
                total += (getattr(v, "XAdvance", 0) or 0) if v else 0
                break
        return total


_KERN = {}


def kern_of(f):
    if id(f) not in _KERN:
        _KERN[id(f)] = _Kern(f)
    return _KERN[id(f)]


def metrics(f):
    """Cap height, x-height, ascender and descender in em."""
    upm = f["head"].unitsPerEm
    os2 = f["OS/2"]
    cap = getattr(os2, "sCapHeight", 0) or 0
    xh = getattr(os2, "sxHeight", 0) or 0
    if not cap:
        from fontTools.pens.boundsPen import BoundsPen
        gs = f.getGlyphSet()
        g = f.getBestCmap().get(ord("H"))
        if g:
            bp = BoundsPen(gs)
            gs[g].draw(bp)
            cap = bp.bounds[3] if bp.bounds else 0.7 * upm
    return {"cap": cap / upm, "x": (xh or cap * 0.7) / upm, "asc": os2.sTypoAscender / upm, "desc": os2.sTypoDescender / upm}


def advance(text, f, spacing_em=0.0):
    """Width of a line of text in em (kerning in, letter-spacing between letters, not after the last)."""
    upm = f["head"].unitsPerEm
    cmap, hmtx, kern = f.getBestCmap(), f["hmtx"], kern_of(f)
    w, prev = 0, None
    for ch in text:
        g = cmap.get(ord(ch)) or cmap.get(ord(ch.upper()))
        if not g:
            continue
        w += kern(prev, g) + hmtx[g][0]
        prev = g
    return w / upm + spacing_em * max(0, len(text) - 1)


# ---- <text> -> outlines ---------------------------------------------------------------------
def _local(tag):
    return tag.split("}")[-1]


def _style(el):
    out = {}
    for part in (el.get("style") or "").split(";"):
        if ":" in part:
            k, v = part.split(":", 1)
            out[k.strip().lower()] = v.strip()
    return out


def _prop(el, key):
    return _style(el).get(key) or el.get(key)


def _num(v, size=16.0, default=0.0):
    if v is None:
        return default
    v = str(v).strip().split()[0].split(",")[0]
    try:
        if v.endswith("em"):
            return float(v[:-2]) * size
        if v.endswith("%"):
            return float(v[:-1]) / 100 * size
        return float(re.sub(r"[a-z]+$", "", v))
    except ValueError:
        return default


def _props(el, parent):
    p = dict(parent)
    font_short = _prop(el, "font")
    if font_short:   # "700 120px Cinzel"
        m = re.match(r"\s*(?:(\w+)\s+)?(\d+(?:\.\d+)?)px\s+(.+)", font_short)
        if m:
            if m.group(1):
                p["font-weight"] = m.group(1)
            p["font-size"], p["font-family"] = m.group(2), m.group(3)
    for k in INHERIT:
        v = _prop(el, k)
        if v is not None:
            p[k] = v
    return p


class _Flat:
    """A path flattened to points: length, point and angle at a distance (for <textPath>)."""

    def __init__(self, d):
        from fontTools.pens.basePen import BasePen
        from fontTools.svgLib.path import parse_path
        pts = []

        class P(BasePen):
            def _moveTo(self, p):
                pts.append([p])

            def _lineTo(self, p):
                pts[-1].append(p)

            def _curveToOne(self, a, b, c):
                p0 = pts[-1][-1]
                for i in range(1, 25):
                    t = i / 24
                    u = 1 - t
                    pts[-1].append((u ** 3 * p0[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t ** 3 * c[0],
                                    u ** 3 * p0[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t ** 3 * c[1]))

            def _qCurveToOne(self, a, b):
                p0 = pts[-1][-1]
                for i in range(1, 17):
                    t = i / 16
                    u = 1 - t
                    pts[-1].append((u * u * p0[0] + 2 * u * t * a[0] + t * t * b[0], u * u * p0[1] + 2 * u * t * a[1] + t * t * b[1]))

            def _closePath(self):
                if pts and pts[-1]:
                    pts[-1].append(pts[-1][0])

        parse_path(d, P(None))
        self.pts = pts[0] if pts else [(0, 0), (1, 0)]
        self.cum = [0.0]
        for a, b in zip(self.pts, self.pts[1:]):
            self.cum.append(self.cum[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
        self.length = self.cum[-1]

    def at(self, s):
        s = min(max(s, 0), self.length)
        import bisect
        i = min(max(bisect.bisect_right(self.cum, s) - 1, 0), len(self.pts) - 2)
        a, b = self.pts[i], self.pts[i + 1]
        seg = (self.cum[i + 1] - self.cum[i]) or 1e-9
        t = (s - self.cum[i]) / seg
        return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), math.atan2(b[1] - a[1], b[0] - a[0])


def _runs(el, props, out, first=True):
    """Flatten <text>/<tspan>/<textPath> into runs: {text, props, el (the paint source), x, y, dx, dy, path}."""
    tag = _local(el.tag)
    p = _props(el, props)
    path = None
    if tag == "textPath":
        href = el.get("href") or el.get(f"{{{XLINK}}}href") or ""
        path = {"href": href.lstrip("#"), "offset": el.get("startOffset") or "0"}
    pos = {"x": el.get("x") if tag != "textPath" else None, "y": el.get("y") if tag != "textPath" else None,
           "dx": el.get("dx"), "dy": el.get("dy")}
    if el.text:
        out.append({"text": el.text, "props": p, "el": el, "path": path, **pos})
        pos = {"x": None, "y": None, "dx": None, "dy": None}
    elif any(pos.values()) or path:
        out.append({"text": "", "props": p, "el": el, "path": path, **pos})
    for ch in el:
        if _local(ch.tag) in ("tspan", "textPath"):
            sub = len(out)
            _runs(ch, p, out, False)
            if path:
                for r in out[sub:]:
                    r["path"] = r["path"] or path
        if ch.tail:
            out.append({"text": ch.tail, "props": p, "el": el, "path": path, "x": None, "y": None, "dx": None, "dy": None})
    return out


PAINT = ("fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-linejoin", "stroke-linecap",
         "stroke-miterlimit", "opacity", "paint-order", "filter", "mask", "clip-path", "class", "vector-effect")


def _paint_attrs(el):
    a = {k: v for k, v in el.attrib.items() if _local(k) in PAINT}
    st = {k: v for k, v in _style(el).items() if k not in FONT_PROPS}
    if st:
        a["style"] = ";".join(f"{k}:{v}" for k, v in st.items())
    return a


def _fmt(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def _glyph_d(f, gname, tr):
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    gs = f.getGlyphSet()
    pen = SVGPathPen(gs, _fmt)
    gs[gname].draw(TransformPen(pen, tr))
    return pen.getCommands()


def outline_text(text_el, paths, notes, fonts_used):
    """One <text> element -> a <g> of <path>s (same paint, same transform). Returns the new element."""
    from fontTools.misc.transform import Transform
    runs = _runs(text_el, {"font-size": "16", "font-family": "", "font-weight": "400"}, [])
    g = ET.Element(f"{{{SVG_NS}}}g", {k: v for k, v in text_el.attrib.items() if _local(k) in ("transform", "id")})
    g.attrib.update(_paint_attrs(text_el))
    for i, r in enumerate(runs):   # whitespace like SVG: newlines/tabs -> spaces, runs of spaces collapse
        t = re.sub(r"\s+", " ", r["text"])
        if (r["props"].get("text-transform") or "").lower() == "uppercase":
            t = t.upper()
        if t.startswith(" ") and i and runs[i - 1]["text"].endswith(" "):
            t = t[1:]
        r["text"] = t
    chunks, cx, cy = [], 0.0, 0.0
    for r in runs:   # a new chunk starts where a run sets an absolute x or y, or goes onto a path
        size = _num(r["props"].get("font-size"), 16, 16)
        if r["x"] is not None or r["y"] is not None or not chunks or (r["path"] and chunks[-1]["path"] != r["path"]):
            cx = _num(r["x"], size, cx) if r["x"] is not None else cx
            cy = _num(r["y"], size, cy) if r["y"] is not None else cy
            chunks.append({"x": cx, "y": cy, "anchor": r["props"].get("text-anchor", "start"), "path": r["path"], "glyphs": [],
                           "pen": 0.0, "dy": 0.0})
        ch = chunks[-1]
        fam, note = family_of(r["props"].get("font-family"))
        if note and note not in notes:
            notes.append(note)
        wt = weight_of(r["props"].get("font-weight"))
        f = font(fam, wt)
        fonts_used.add(f"{fam} {wt}")
        s = size / f["head"].unitsPerEm
        ls, ws = r["props"].get("letter-spacing"), r["props"].get("word-spacing")
        spacing = _num(ls, size, 0.0) if ls not in (None, "normal") else 0.0
        wspace = _num(ws, size, 0.0) if ws not in (None, "normal") else 0.0
        base = (r["props"].get("dominant-baseline") or "").lower()
        m = metrics(f)
        shift = {"middle": m["cap"] / 2, "central": m["cap"] / 2, "hanging": m["cap"], "text-before-edge": m["asc"],
                 "mathematical": m["cap"] / 2}.get(base, 0) * size
        ch["pen"] += _num(r["dx"], size, 0)
        ch["dy"] += _num(r["dy"], size, 0)
        cmap, kern = f.getBestCmap(), kern_of(f)
        prev = None
        for c in r["text"]:
            gname, f2 = cmap.get(ord(c)), f
            if not gname:
                alt = FALLBACK[FAMILIES[fam][2]]
                fb = font(alt, wt)
                gname = fb.getBestCmap().get(ord(c))
                note = f"'{c}' isn't in {fam}: drawn from {alt}" if gname else f"'{c}' has no letter in {fam}: left out"
                if note not in notes:
                    notes.append(note)
                if not gname:
                    continue
                f2 = fb
            s2 = size / f2["head"].unitsPerEm
            if prev and f2 is f:
                ch["pen"] += kern(prev, gname) * s
            adv = f2["hmtx"][gname][0] * s2
            ch["glyphs"].append({"f": f2, "g": gname, "c": c, "x": ch["pen"], "adv": adv, "s": s2, "y": ch["dy"] + shift, "run": r})
            ch["pen"] += adv + spacing + (wspace if c == " " else 0)
            prev = gname if f2 is f else None
    for ch in chunks:
        gl = ch["glyphs"]
        while gl and gl[0]["c"] == " ":   # spaces at the ends of a line don't move it
            gone = gl.pop(0)
            shift = (gl[0]["x"] - gone["x"]) if gl else 0
            for x in gl:
                x["x"] -= shift
        while gl and gl[-1]["c"] == " ":
            gl.pop()
        if not gl:
            continue
        width = gl[-1]["x"] + gl[-1]["adv"] - gl[0]["x"]   # letter-spacing after the last letter doesn't count
        off = {"middle": -width / 2, "end": -width}.get(ch["anchor"], 0.0)
        flat = None
        if ch["path"]:
            src = paths.get(ch["path"]["href"])
            if src is None:
                notes.append(f"text on path '#{ch['path']['href']}': no such path, set on a straight line")
            else:
                flat = _Flat(src)
                o = ch["path"]["offset"].strip()
                start = float(o[:-1]) / 100 * flat.length if o.endswith("%") else _num(o, 16, 0)
                off += start
        by_run = {}
        for x in gl:
            if x["c"] == " ":
                continue
            if flat:
                (px, py), ang = flat.at(off + x["x"] + x["adv"] / 2)
                tr = Transform().translate(px, py).rotate(ang).translate(-x["adv"] / 2, x["y"]).scale(x["s"], -x["s"])
            else:
                tr = Transform().translate(ch["x"] + off + x["x"], ch["y"] + x["y"]).scale(x["s"], -x["s"])
            d = _glyph_d(x["f"], x["g"], tr)
            if d:
                by_run.setdefault(id(x["run"]), (x["run"], []))[1].append(d)
        for r, ds in by_run.values():
            attrs = _paint_attrs(r["el"]) if r["el"] is not text_el else {}
            attrs.setdefault("fill-rule", "nonzero")   # variable fonts' letters are overlapping pieces: nonzero fills them whole
            attrs["d"] = "".join(ds)
            ET.SubElement(g, f"{{{SVG_NS}}}path", attrs)
    return g


def outline(svg_text):
    """Every <text> in the SVG -> outlines. Returns (new svg text, notes, fonts used)."""
    root = ET.fromstring(svg_text)
    parents = {c: p for p in root.iter() for c in p}
    paths = {el.get("id"): el.get("d") for el in root.iter() if _local(el.tag) == "path" and el.get("id")}
    guides = {(el.get("href") or el.get(f"{{{XLINK}}}href") or "").lstrip("#") for el in root.iter() if _local(el.tag) == "textPath"}
    notes, used = [], set()
    for el in [e for e in root.iter() if _local(e.tag) == "text"]:
        par = parents[el]
        i = list(par).index(el)
        new = outline_text(el, paths, notes, used)
        new.tail = el.tail
        par.remove(el)
        par.insert(i, new)
    # a path that only carried text goes into <defs>: it draws nothing, and nothing measures it as artwork
    guide_els = [el for el in root.iter() if _local(el.tag) == "path" and el.get("id") in guides]
    if guide_els:
        defs = next((el for el in root if _local(el.tag) == "defs"), None)
        if defs is None:
            defs = ET.Element(f"{{{SVG_NS}}}defs")
            root.insert(0, defs)
        parents = {c: p for p in root.iter() for c in p}
        for el in guide_els:
            par = parents[el]
            if _local(par.tag) != "defs":
                par.remove(el)
                defs.append(el)
    return ET.tostring(root, encoding="unicode"), notes, sorted(used)


# ---- fitting and the audit ------------------------------------------------------------------
def audit(path, bg=None):
    """The logo-design skill's svg_audit.py on one file -> its JSON (score, findings, content_bbox...) or None."""
    s = ensure_skill()
    if not s:
        return None
    path = Path(path).resolve()
    cmd = [sys.executable, "-I", str(s / "scripts" / "svg_audit.py"), "--json", str(path)] + (["--bg", bg] if bg else [])
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120, cwd=str(path.parent),
                       creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    try:
        got = json.loads(p.stdout)
        return got[0] if got and "error" not in got[0] else None
    except ValueError:
        return None


def _vb(root):
    return [float(v) for v in re.split(r"[\s,]+", root.get("viewBox").strip())]


def _unpainted(el):
    st = {**{k: v for k, v in el.attrib.items()}, **_style(el)}
    if st.get("display") == "none" or st.get("visibility") == "hidden" or str(st.get("opacity", "1")).strip() in ("0", "0.0"):
        return True
    return (st.get("fill") or "").strip() in ("none", "transparent") and (st.get("stroke") or "none").strip() in ("none", "transparent")


def audit_drawn(path, bg=None):
    """The audit of what is really drawn: a copy without invisible shapes (a fill="none" frame Rana left) and <defs>."""
    import tempfile
    root = ET.fromstring(Path(path).read_text(encoding="utf-8"))
    parents = {c: p for p in root.iter() for c in p}
    for el in list(root.iter()):
        if el is not root and el in parents and (_local(el.tag) in ("defs", "clipPath", "mask", "title", "desc") or _unpainted(el)):
            parents[el].remove(el)
    with tempfile.TemporaryDirectory() as tmp:
        f = Path(tmp) / "drawn.svg"
        f.write_text(ET.tostring(root, encoding="unicode"), encoding="utf-8")
        return audit(f, bg)


def drawn_bbox(path):
    """The box of what is really drawn (the skill's geometry), or None."""
    return (audit_drawn(path) or {}).get("content_bbox")


def fit_wordmark(path, pad=0.08):
    """The wordmark's viewBox = what is drawn + clear space (pad x its height) on every side. Returns the new viewBox or None."""
    bb = drawn_bbox(path)
    if not bb:
        return None
    x0, y0, x1, y1 = bb
    if x1 - x0 < 1 or y1 - y0 < 1:
        return None
    m = (y1 - y0) * pad
    vb = [x0 - m, y0 - m, (x1 - x0) + 2 * m, (y1 - y0) + 2 * m]
    root = ET.fromstring(Path(path).read_text(encoding="utf-8"))
    root.set("viewBox", " ".join(_fmt(v) for v in vb))
    for k in ("width", "height"):
        root.attrib.pop(k, None)
    Path(path).write_text(ET.tostring(root, encoding="unicode"), encoding="utf-8")
    return vb


def contain_icon(path, margin=0.04):
    """An icon whose artwork runs off its canvas is scaled back in around the canvas centre. Returns the scale or None."""
    bb = drawn_bbox(path)
    if not bb:
        return None
    root = ET.fromstring(Path(path).read_text(encoding="utf-8"))
    x, y, w, h = _vb(root)
    bx0, by0, bx1, by1 = bb
    if bx0 >= x - 0.01 * w and by0 >= y - 0.01 * h and bx1 <= x + w * 1.01 and by1 <= y + h * 1.01:
        return None
    cx, cy = x + w / 2, y + h / 2
    half = max(cx - bx0, bx1 - cx, cy - by0, by1 - cy)
    k = (min(w, h) / 2 * (1 - margin)) / half
    g = ET.Element(f"{{{SVG_NS}}}g", {"transform": f"translate({_fmt(cx)} {_fmt(cy)}) scale({k:.4f}) translate({_fmt(-cx)} {_fmt(-cy)})"})
    for c in [c for c in root if _local(c.tag) not in ("defs", "title", "desc", "style")]:
        root.remove(c)
        g.append(c)
    root.append(g)
    Path(path).write_text(ET.tostring(root, encoding="unicode"), encoding="utf-8")
    return round(k, 3)


def _brief_audit(a):
    if not a:
        return None
    keep = [f for f in a.get("findings", []) if f["level"] in ("FAIL", "WARN")]
    return {"score": a.get("score"), "colors": a.get("colors"), "anchors": a.get("anchors"), "margins": a.get("margins"),
            "findings": [f"{f['level']} {f['code']}: {f['message'][:240]}" for f in keep]}


def finish(opt):
    """One option folder: real outlines, fitted, audited. Writes audit.json and returns it."""
    opt = Path(opt)
    out = {"notes": [], "fonts": []}
    for part in ("icon", "wordmark"):
        f, src = opt / f"{part}.svg", opt / f"{part}.text.svg"
        raw = f.read_text(encoding="utf-8")
        if "<text" in raw:
            src.write_text(raw, encoding="utf-8")   # Rana's own file, with live text
            svg, notes, used = outline(raw)
            f.write_text(svg, encoding="utf-8")
            out["notes"] += [f"{part}: {n}" for n in notes]
            out["fonts"] = sorted(set(out["fonts"]) | set(used))
        if part == "wordmark":
            vb = fit_wordmark(f)
            if vb:
                out["wordmark_viewbox"] = [round(v, 1) for v in vb]
        else:
            k = contain_icon(f)
            if k:
                out["notes"].append(f"icon: its artwork ran off the canvas; scaled to {k} to fit")
        out[part] = _brief_audit(audit_drawn(f))
    (opt / "audit.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    return out


# ---- what Rana sees before drawing ---------------------------------------------------------
def prep(folder, name, allowed=None):
    """folder/specimen.png (the name in every family) + folder/measures.txt. Returns the families shown."""
    from PIL import Image, ImageDraw, ImageFont
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    ensure_fonts()
    fams = [f for f in FAMILIES if (not allowed or f in allowed) and all((FONT_DIR / FAMILIES[f][0] / fn).exists() for fn in FAMILIES[f][1])]
    name = (name or "Brand").strip()[:40]
    cols, row_h, col_w = 2, 132, 960
    rows = (len(fams) + cols - 1) // cols
    img = Image.new("RGB", (col_w * cols, 56 + rows * row_h), "#FFFFFF")
    d = ImageDraw.Draw(img)
    label = _pil_font(ImageFont, "Montserrat", 400, 18)
    d.text((16, 14), f"'{name}' in each logo font: weight 400, the heaviest, and Title Case. All are free for logos (SIL OFL).",
           fill="#111111", font=label)
    lines = [f"Width of '{name}' in em (multiply by font-size; add letter-spacing x {max(0, len(name) - 1)} gaps), cap height in em:"]
    for i, fam in enumerate(fams):
        x0, y0 = (i % cols) * col_w + 16, 56 + (i // cols) * row_h
        lo, hi = weights(fam)[0], weights(fam)[-1]
        d.text((x0, y0), f"{i + 1}. {fam} ({FAMILIES[fam][2]}; weights {lo}-{hi}): {FAMILIES[fam][3]}", fill="#555555", font=label)
        x = x0
        for wt, text in ((400 if lo <= 400 <= hi else lo, name), (hi, name), (400 if lo <= 400 <= hi else lo, name.title())):
            pf = _pil_font(ImageFont, fam, wt, 60)
            d.text((x, y0 + 30), text, fill="#111111", font=pf)
            x += int(d.textlength(text, font=pf)) + 36
        ms = []
        for wt in sorted({lo, 400 if lo <= 400 <= hi else lo, 700 if lo <= 700 <= hi else hi, hi}):
            f = font(fam, wt)
            m = metrics(f)
            ms.append(f"{wt}: {advance(name, f):.3f} em, caps {m['cap']:.3f}")
        lines.append(f"- {fam}: " + "; ".join(ms))
    img.save(folder / "specimen.png")
    (folder / "measures.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return fams


def _pil_font(ImageFont, fam, wt, size):
    folder, files, _, _ = FAMILIES[fam]
    paths = [FONT_DIR / folder / fn for fn in files]
    if len(paths) == 1 and "[" in paths[0].name:
        pf = ImageFont.truetype(str(paths[0]), size)
        try:
            axes = pf.get_variation_axes()
            vals = []
            for ax in axes:
                nm = (ax.get("name") or b"")
                nm = nm.decode() if isinstance(nm, bytes) else str(nm)
                if nm.lower().startswith("weight"):
                    vals.append(min(max(wt, ax["minimum"]), ax["maximum"]))
                elif nm.lower().startswith("optical"):
                    vals.append(ax["maximum"])
                else:
                    vals.append(ax.get("default", ax["minimum"]))
            pf.set_variation_by_axes(vals)
        except (OSError, AttributeError, KeyError):
            pass
        return pf
    from fontTools.ttLib import TTFont
    best = min(paths, key=lambda p: abs(TTFont(p, lazy=True)["OS/2"].usWeightClass - wt))
    return ImageFont.truetype(str(best), size)


# ---- picture -> vector ---------------------------------------------------------------------
def trace(image, out, colors=6, bw=False):
    """vtracer: a picture -> SVG. colors: the picture is first reduced to this many colours (cleaner shapes). Returns facts."""
    import tempfile
    import vtracer
    from PIL import Image
    image, out = Path(image), Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    img = Image.open(image).convert("RGB")
    img.thumbnail((1400, 1400))
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "in.png"
        (img.convert("L").point(lambda v: 255 if v > 128 else 0) if bw else img.quantize(colors=max(2, min(int(colors), 32))).convert("RGB")).save(src)
        vtracer.convert_image_to_svg_py(str(src), str(out), colormode="binary" if bw else "color", hierarchical="stacked", mode="spline",
                                        filter_speckle=8, color_precision=6, layer_difference=24, corner_threshold=60,
                                        length_threshold=4.0, max_iterations=10, splice_threshold=45, path_precision=2)
    svg = out.read_text(encoding="utf-8")
    m = re.search(r'<svg[^>]*?width="(\d+)"[^>]*?height="(\d+)"', svg)
    if m and "viewBox" not in svg[:400]:   # scalable: a viewBox instead of a fixed size
        svg = svg.replace(m.group(0), m.group(0).replace(f'width="{m.group(1)}"', f'viewBox="0 0 {m.group(1)} {m.group(2)}"')
                          .replace(f'height="{m.group(2)}"', ""), 1)
        out.write_text(svg, encoding="utf-8")
    return {"svg": str(out), "bytes": len(svg), "paths": svg.count("<path"), "size": list(img.size)}


def still(svg, out, size=1200, bg="#F5F5F2"):
    """The renderer's picture of an SVG (Remotion's SvgStill, as design-render uses), size px on its longer side."""
    import base64
    import animate
    animate.ensure_toolchain()
    svg, out = Path(svg).resolve(), Path(out).resolve()
    m = re.search(r'viewBox="[^"]*?([\d.]+)\s+([\d.]+)"', svg.read_text(encoding="utf-8")[:2000])
    w, h = (float(m.group(1)), float(m.group(2))) if m else (1.0, 1.0)
    k = size / max(w, h)
    props = out.with_name(out.stem + ".props.json")
    props.write_text(json.dumps({"src": "data:image/svg+xml;base64," + base64.b64encode(svg.read_bytes()).decode(), "bg": bg,
                                 "w": int(w * k) // 2 * 2, "h": int(h * k) // 2 * 2}), encoding="utf-8")
    try:
        animate.remotion(["still", "src/index.jsx", "SvgStill", str(out), f"--props={props}", "--log=error", "--overwrite"], timeout=900)
    finally:
        props.unlink(missing_ok=True)
    return {"png": str(out)}


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # the skill's findings hold arrows and dashes
    a = sys.argv[1:]
    if not a:
        print(__doc__)
        return
    if a[0] == "fonts":
        print("RESULT " + json.dumps({"families": ensure_fonts(), "skill": bool(ensure_skill())}))
    elif a[0] == "prep":
        allowed = [x.strip() for x in (a[3] if len(a) > 3 else "").split(",") if x.strip()] or None
        print("RESULT " + json.dumps({"families": prep(a[1], a[2], allowed), "skill": str(ensure_skill() or "")}))
    elif a[0] == "finish":
        ensure_fonts()
        print("RESULT " + json.dumps(finish(a[1]), ensure_ascii=False))
    elif a[0] == "outline":
        svg, notes, used = outline(Path(a[1]).read_text(encoding="utf-8"))
        Path(a[2]).write_text(svg, encoding="utf-8")
        print("RESULT " + json.dumps({"notes": notes, "fonts": used}))
    elif a[0] == "still":
        print("RESULT " + json.dumps(still(a[1], a[2])))
    elif a[0] == "trace":
        colors = int(a[a.index("--colors") + 1]) if "--colors" in a else 6
        print("RESULT " + json.dumps(trace(a[1], a[2], colors, "--bw" in a)))
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
