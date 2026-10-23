"""Map samples for a client's map channel (project 6, Bassel; 2026-10-23: "as many high-level visual samples as possible").

The same ~30 s opening ("France's longest border?": Germany 418 km, Spain 646 km, a flight across the Atlantic, the Brazil border on the
Oyapock drawing itself, ~730 km) in several looks, from REAL geography: Natural Earth 10m (public domain) in ~/.agent-hq-anim/geo,
drawn with d3-geo (ISC) in a small Remotion app (~/.agent-hq-anim/maps, node_modules shared with the animation kit).

    python mapsample.py kit [project]        # real-border SVGs for Rana: content/project-N/map-kit/
    python mapsample.py prep                 # geo.json for the app (simplified countries, the three borders, places)
    python mapsample.py still <look> <frame> <out.png>
    python mapsample.py render <look|all> [--every N]   # -> content/project-6/samples/maps/<look>.mp4 + sheet
Runs in the shorts venv (numpy, Pillow). Looks: maps/src/looks.js.
"""
import json
import math
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
HOME = Path.home() / ".agent-hq-anim"
GEO = HOME / "geo" / "natural-earth"
APP = HOME / "maps"
KIT = ROOT / "maps"
OUT = Path(os.environ.get("HQ_MAPS_OUT") or ROOT / "content" / "project-6" / "samples" / "maps")
FPS, W, H = 30, 1920, 1080
LOOKS = ["midnight", "paper", "globe", "editorial", "bold", "bassel"]

# countries drawn in detail (the rest of the world is a light backdrop)
DETAIL = {"FRA", "ESP", "DEU", "BEL", "LUX", "CHE", "ITA", "AND", "MCO", "GBR", "PRT", "NLD", "AUT", "IRL", "BRA", "SUR", "GUY", "VEN"}
OVERSEAS = {"MAF", "NCL", "SPM", "PYF", "ATF", "BLM", "WLF", "CLP"}   # France outside Europe (Natural Earth admin-0 units), drawn finely
PLACES = {"paris": [2.35, 48.86], "cayenne": [-52.33, 4.92], "kourou": [-52.65, 5.16]}


def _dp(pts, tol):
    """Douglas-Peucker on an (n, 2) array (degrees), iterative."""
    n = len(pts)
    if n < 3:
        return pts
    keep = np.zeros(n, bool)
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        seg = pts[b] - pts[a]
        L = math.hypot(*seg)
        mid = pts[a + 1:b]
        if L == 0:
            d = np.hypot(*(mid - pts[a]).T)
        else:
            d = np.abs(seg[0] * (mid[:, 1] - pts[a][1]) - seg[1] * (mid[:, 0] - pts[a][0])) / L
        i = int(np.argmax(d))
        if d[i] > tol:
            k = a + 1 + i
            keep[k] = True
            stack += [(a, k), (k, b)]
    return pts[keep]


def _area(p):
    x, y = p[:, 0], p[:, 1]
    return 0.5 * float(np.dot(x[:-1], y[1:]) - np.dot(x[1:], y[:-1]))


def _ring(r, tol, dec, hole=False):
    p = _dp(np.asarray(r, float), tol)
    if len(p) >= 4 and (_area(p) > 0) != hole:   # d3-geo: outer rings clockwise, holes anticlockwise (else it fills the rest of the globe)
        p = p[::-1]
    if len(p) < 4:
        return None
    p = np.round(p, dec)
    out = [p[0].tolist()]
    for q in p[1:]:
        if q.tolist() != out[-1]:
            out.append(q.tolist())
    if out[0] != out[-1]:
        out.append(out[0])
    return out if len(out) >= 4 else None


def _polys(geom):
    return [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]


def _simplify(geom, tol, dec, keep=None):
    polys = []
    for poly in _polys(geom):
        if keep and not keep(poly):
            continue
        rings = [_ring(r, tol, dec, hole=i > 0) for i, r in enumerate(poly)]
        if rings and rings[0]:
            polys.append([r for r in rings if r])
    return {"type": "MultiPolygon", "coordinates": polys} if polys else None


def _chain(lines):
    """Join line pieces end to end into as few ordered lines as possible."""
    segs = [list(map(tuple, l)) for l in lines]
    out = []
    while segs:
        cur = segs.pop(0)
        grown = True
        while grown:
            grown = False
            for i, s in enumerate(segs):
                if s[0] == cur[-1]:
                    cur += s[1:]
                elif s[-1] == cur[-1]:
                    cur += s[::-1][1:]
                elif s[-1] == cur[0]:
                    cur = s[:-1] + cur
                elif s[0] == cur[0]:
                    cur = s[::-1][:-1] + cur
                else:
                    continue
                segs.pop(i)
                grown = True
                break
        out.append(cur)
    return out


def _km(line):
    R, d = 6371.0, 0.0
    for (x1, y1), (x2, y2) in zip(line, line[1:]):
        p1, p2, dl = math.radians(y1), math.radians(y2), math.radians(x2 - x1)
        d += R * math.acos(min(1, math.sin(p1) * math.sin(p2) + math.cos(p1) * math.cos(p2) * math.cos(dl)))
    return d


def prep():
    countries = json.loads((GEO / "ne_10m_admin_0_countries.geojson").read_text(encoding="utf-8"))
    world, detail = [], []
    for f in countries["features"]:
        p = f["properties"]
        a3 = p.get("ADM0_A3") or p.get("ISO_A3")
        g = _simplify(f["geometry"], 0.08, 2)
        if g:
            world.append({"type": "Feature", "properties": {"a3": a3}, "geometry": g})
        if a3 in OVERSEAS:
            g = _simplify(f["geometry"], 0.003, 4)
            if g:
                detail.append({"type": "Feature", "properties": {"a3": a3}, "geometry": g})
        if a3 in DETAIL:
            if a3 == "FRA":   # metropolitan France (with Corsica), French Guiana, and the overseas departments (FRO) as their own shapes
                metro = lambda poly: -6 < poly[0][0][0] < 10 and 41 < poly[0][0][1] < 52
                guf = lambda poly: -55 < poly[0][0][0] < -51 and 1.5 < poly[0][0][1] < 6.5
                for key, keep in (("FRA", metro), ("GUF", guf), ("FRO", lambda poly: not metro(poly) and not guf(poly))):
                    g = _simplify(f["geometry"], 0.004 if key != "FRO" else 0.003, 4, keep)
                    detail.append({"type": "Feature", "properties": {"a3": key}, "geometry": g})
            else:
                g = _simplify(f["geometry"], 0.006 if a3 != "BRA" else 0.01, 4)
                if g:
                    detail.append({"type": "Feature", "properties": {"a3": a3}, "geometry": g})
    bl = json.loads((GEO / "ne_10m_admin_0_boundary_lines_land.geojson").read_text(encoding="utf-8"))
    borders = {}
    for key, other in (("deu", "DEU"), ("esp", "ESP"), ("bra", "BRA"), ("sur", "SUR")):
        pieces = []
        for f in bl["features"]:
            p = f["properties"]
            if {p.get("ADM0_A3_L"), p.get("ADM0_A3_R")} == {"FRA", other}:
                g = f["geometry"]
                pieces += [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
        lines = _chain(pieces)
        # draw-on direction: Germany from the north, Spain from the Atlantic, Brazil from the Oyapock's mouth (the coast)
        start = {"deu": lambda l: -l[0][1], "esp": lambda l: l[0][0], "bra": lambda l: -l[0][1], "sur": lambda l: -l[0][1]}[key]
        lines = [l if start(l) <= start(l[::-1]) else l[::-1] for l in lines]
        lines.sort(key=start)
        km = round(sum(_km(l) for l in lines))
        lines = [np.round(_dp(np.asarray(l, float), 0.0015), 4).tolist() for l in lines]
        borders[key] = {"type": "Feature", "properties": {"km_drawn": km},
                        "geometry": {"type": "MultiLineString", "coordinates": lines}}
        print(f"border {key}: {len(lines)} line(s), {sum(len(l) for l in lines)} points, {km} km along Natural Earth's line")
    data = {"world": {"type": "FeatureCollection", "features": world}, "detail": {"type": "FeatureCollection", "features": detail},
            "borders": borders, "places": PLACES,
            "credit": "Map data: Natural Earth (public domain)"}
    APP.mkdir(parents=True, exist_ok=True)
    (APP / "geo.json").write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    print("geo.json", round((APP / "geo.json").stat().st_size / 1e6, 2), "MB;", len(world), "world shapes,", len(detail), "detail shapes")

# views of the real-border kit for Rana's style frames (`kit`): centre [lon, lat], orthographic scale, label anchors
VIEWS = {
    "europe": {"name": "France and its European neighbours", "center": [2.4, 46.5], "scale": 3700,
               "labels": {"france": [2.5, 46.9], "germany": [10.4, 51.2], "spain": [-3.7, 40.1], "italy": [12.6, 43.2], "paris": [2.35, 48.86]}},
    "guiana": {"name": "French Guiana, Suriname and Brazil (the Oyapock border)", "center": [-53.15, 3.95], "scale": 8300,
               "labels": {"french_guiana": [-53.25, 4.15], "suriname": [-55.9, 4.3], "brazil": [-52.0, 1.35], "cayenne": [-52.33, 4.92],
                          "oyapock_mouth": [-51.6, 4.3]}},
    "atlantic": {"name": "The Atlantic globe from France to French Guiana", "center": [-25, 26], "scale": 440,
                 "labels": {"france": [2.5, 46.9], "french_guiana": [-53.2, 4.0], "atlantic": [-32, 28]}},
    "south-america": {"name": "South America (for an inset)", "center": [-58, -14], "scale": 1250, "graticule": False,
                      "labels": {"french_guiana": [-53.2, 4.0], "brazil": [-52, -10]}},
}


def kit(project=6):
    """content/project-N/map-kit/<view>.svg: real borders Rana copies verbatim (client.ask_rana gives them to her)."""
    animate = ensure_app()
    dst = Path(os.environ.get("HQ_ROOT") or ROOT) / "content" / f"project-{project}" / "map-kit"
    dst.mkdir(parents=True, exist_ok=True)
    (APP / "tools").mkdir(exist_ok=True)
    shutil.copy(KIT / "tools" / "region.mjs", APP / "tools" / "region.mjs")
    for name, v in VIEWS.items():
        vf = APP / "tools" / f"view-{name}.json"
        vf.write_text(json.dumps(v), encoding="utf-8")
        p = subprocess.run([str(animate.NODE_EXE), str(APP / "tools" / "region.mjs"), str(APP / "geo.json"), str(vf), str(dst / f"{name}.svg")],
                           cwd=APP, env=animate.node_env(), capture_output=True, text=True)
        if p.returncode:
            raise RuntimeError(p.stderr[-1500:])
        print(p.stdout.strip())
    (dst / "README.md").write_text(KIT_README, encoding="utf-8")
    return dst


KIT_README = """# Real borders (Natural Earth 10m, public domain)
Every SVG here is a 1920x1080 view already projected with d3-geo (orthographic). The shapes are exact: never redraw a coastline or a
border by hand. Copy the `d` of the paths you need VERBATIM into your frame; restyle them freely (fill, stroke, glow, shadow, dash), and
move or scale a whole group with a transform (e.g. the Guiana view as an inset lens). Ids: sea, graticule, w-<ISO3> (rest of the world),
c-<ISO3> (c-FRA = metropolitan France, c-GUF = French Guiana), b-fra-deu / b-fra-esp / b-fra-bra / b-fra-sur (France's land borders),
p-<place> (Paris, Cayenne, Kourou). Each file's comment lists label anchors (x, y). Numbers to print: Germany 418 km, Spain 646 km,
Brazil ~730 km (official lengths; the drawn line is simplified).
"""


def _noise():
    """A grain tile for the paper and film looks (made once, no download)."""
    from PIL import Image
    f = APP / "public" / "grain.png"
    if f.exists():
        return
    f.parent.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(7)
    a = rng.normal(128, 38, (512, 512)).clip(0, 255).astype(np.uint8)
    Image.fromarray(np.dstack([a, a, a, np.full_like(a, 255)]), "RGBA").save(f)


def ensure_app():
    import base64
    sys.path.insert(0, str(ROOT))
    import animate
    if not (APP / "geo.json").exists():
        prep()
    if (APP / "src").exists():
        shutil.rmtree(APP / "src")
    shutil.copytree(KIT / "src", APP / "src")
    shutil.copy(APP / "geo.json", APP / "src" / "geo.json")
    shutil.copy(ROOT / "story" / "package.json", APP / "package.json")
    if not (APP / "node_modules").exists():
        try:
            os.symlink(str(animate.APP / "node_modules"), str(APP / "node_modules"), target_is_directory=True)
        except OSError:
            subprocess.run(["cmd", "/c", "mklink", "/J", str(APP / "node_modules"), str(animate.APP / "node_modules")], capture_output=True)
    _noise()
    css = ""
    fonts = HOME / "fonts" / "logo"
    for family, folder in (("Playfair Display", "playfairdisplay"), ("Cormorant Garamond", "cormorantgaramond"), ("Montserrat", "montserrat"),
                           ("Space Grotesk", "spacegrotesk"), ("Archivo Black", "archivoblack"), ("Bebas Neue", "bebasneue"),
                           ("DM Serif Display", "dmserifdisplay")):
        for ttf in sorted((fonts / folder).glob("*.ttf"))[:1]:
            weight = "100 900" if "[" in ttf.name else "400"
            css += ("@font-face{font-family:'" + family + "';font-weight:" + weight + ";src:url(data:font/ttf;base64,"
                    + base64.b64encode(ttf.read_bytes()).decode() + ") format('truetype');}")
    (APP / "src" / "fonts.js").write_text("// written by mapsample.py\nexport const FONT_CSS = " + json.dumps(css) + ";\n", encoding="utf-8")
    return animate


def _remotion(animate, args):
    cli = animate.APP / "node_modules" / "@remotion" / "cli" / "remotion-cli.js"
    p = subprocess.run([str(animate.NODE_EXE), str(cli), *args, f"--timeout={animate.BROWSER_TIMEOUT_MS}"], cwd=APP, env=animate.node_env(),
                       capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=3 * 3600,
                       creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0) | getattr(subprocess, "BELOW_NORMAL_PRIORITY_CLASS", 0))
    if p.returncode != 0:
        raise RuntimeError(((p.stderr or "") + (p.stdout or ""))[-3000:])
    return p


def still(look, frame, out):
    animate = ensure_app()
    _remotion(animate, ["still", "src/index.jsx", "MapSample", str(Path(out).resolve()), f"--frame={frame}",
                        "--props=" + json.dumps({"look": look})])
    print(out)


def sheet(video, out, every=2.0, cols=4):
    """A contact sheet: a frame every `every` seconds, time under each."""
    from PIL import Image, ImageDraw
    sys.path.insert(0, str(ROOT))
    import shorts
    ff = shorts.find_ffmpeg()
    tmp = Path(out).with_suffix("")
    tmp.mkdir(parents=True, exist_ok=True)
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(video), "-vf", f"fps=1/{every},scale=480:-1", str(tmp / "f-%03d.png")], check=True)
    frames = sorted(tmp.glob("f-*.png"))
    tw, th = 480, 270
    rows = math.ceil(len(frames) / cols)
    img = Image.new("RGB", (cols * tw, rows * (th + 24)), "#111")
    d = ImageDraw.Draw(img)
    for i, f in enumerate(frames):
        x, y = i % cols * tw, i // cols * (th + 24)
        img.paste(Image.open(f).convert("RGB"), (x, y))
        d.text((x + 6, y + th + 4), f"{i * every:.0f} s", fill="#ddd")
    img.save(out)
    shutil.rmtree(tmp, ignore_errors=True)
    return out


def preview(look, every=45):
    """The whole clip in ~1 min: a small GIF of every Nth frame, laid out as a sheet."""
    from PIL import Image
    animate = ensure_app()
    OUT.mkdir(parents=True, exist_ok=True)
    gif = OUT / f"_preview-{look}.gif"
    _remotion(animate, ["render", "src/index.jsx", "MapSample", str(gif), "--props=" + json.dumps({"look": look}), "--codec=gif",
                        f"--every-nth-frame={every}", "--scale=0.4", "--concurrency=2"])
    im = Image.open(gif)
    tiles = []
    try:
        while True:
            tiles.append(im.convert("RGB").copy())
            im.seek(im.tell() + 1)
    except EOFError:
        pass
    cols = 5
    tw, th = tiles[0].size
    sheet_img = Image.new("RGB", (cols * tw, math.ceil(len(tiles) / cols) * th), "#000")
    for i, t in enumerate(tiles):
        sheet_img.paste(t, (i % cols * tw, i // cols * th))
    out = OUT / f"_preview-{look}.png"
    sheet_img.save(out)
    print(out, len(tiles), "frames, every", every)


def render(look, every=None):
    animate = ensure_app()
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"{look}.mp4"
    args = ["render", "src/index.jsx", "MapSample", str(out.with_suffix(".part.mp4")), "--props=" + json.dumps({"look": look}),
            "--concurrency=2", "--crf=18", "--muted"]
    _remotion(animate, args)
    os.replace(out.with_suffix(".part.mp4"), out)
    sheet(out, OUT / f"{look}-sheet.png")
    print("RENDERED", out)
    return out


# Bassel's short (2026-10-23): MapShort timed to a narrator's words (voice.json from ElevenLabs with word times)
CUE_WORDS = [("q", "which", 0), ("deu", "germany", 0), ("km418", "four", 0), ("esp", "spain", 0), ("km646", "six", 0), ("neither", "neither", 0),
             ("bel", "belgium", 0), ("lux", "luxembourg", 0), ("che", "switzerland", 0), ("ita", "italy", 0), ("mco", "monaco", 0),
             ("and", "andorra", 0), ("move", "but", 0), ("arrive", "south", 0), ("sur", "suriname", 0), ("bra", "brazil", 0),
             ("km730", "seven", 0), ("final", "france's", -1)]


# v2 (Bassel's notes of 14:35): lengths only on screen, the chart back with Brazil, France's lands outside Europe, the ending question.
# (key, word, which occurrence, seconds to add); a key may instead follow another key: (key, "@other", 0, offset)
CUE_WORDS_V2 = [("q", "which", 0, 0), ("deu", "germany", 0, 0), ("km418", "@deu", 0, 0.7), ("esp", "spain", 0, 0), ("km646", "@esp", 0, 0.7),
                ("neither", "neither", 0, 0), ("bel", "belgium", 0, 0), ("lux", "luxembourg", 0, 0), ("che", "switzerland", 0, 0),
                ("ita", "italy", 0, 0), ("mco", "monaco", 0, 0), ("and", "andorra", 0, 0), ("move", "but", 0, 0), ("arrive", "south", 0, 0),
                ("sur", "suriname", 0, 0), ("bra", "brazil", 0, 0), ("km730", "seven", 0, 0), ("bars", "that", 0, 0),
                ("final", "longer", 0, 0), ("more", "only", 0, -0.4), ("carib", "caribbean", 0, 0), ("gua", "guadeloupe", 0, 0),
                ("mtq", "martinique", 0, 0), ("maf", "martin", 0, 0), ("blm", "barthelemy", 0, 0), ("spmline", "off", 0, 0),
                ("spmn", "pierre", 0, 0), ("indian", "indian", 0, 0), ("reu", "reunion", 0, 0), ("myt", "mayotte", 0, 0),
                ("ker", "@myt", 0, 0.8), ("pacific", "pacific", 0, 0), ("ncl", "caledonia", 0, 0), ("wlf", "wallis", 0, 0),
                ("pyf", "polynesia", 0, 0), ("clp", "@pyf", 0, 0.8), ("q2", "so", 0, 0), ("still", "still", 0, 0), ("link", "find", 0, 0)]


def cues_v2(words):
    norm = [(re.sub(r"[^a-z]", "", w[0].lower()), float(w[1])) for w in words]
    out = {}
    for key, word, which, add in CUE_WORDS_V2:
        if word.startswith("@"):
            out[key] = round(out[word[1:]] + add, 3)
            continue
        hits = [t for w, t in norm if w == word]
        if len(hits) <= which:
            raise ValueError(f"the voice never says '{word}' (cue {key})")
        out[key] = round(hits[which] + add, 3)
    return out


def cues_from(words):
    norm = [(w[0].lower().strip(".,!?:;"), float(w[1])) for w in words]
    out = {}
    for key, word, which in CUE_WORDS:
        hits = [t for w, t in norm if w == word]
        if not hits:
            raise ValueError(f"the voice never says '{word}' (cue {key})")
        out[key] = hits[which]
    return out


def short(folder, music_db=-24.0):
    """folder holds voice.wav + voice.json; writes short.mp4 (voice + a light music bed) and sheet.png there."""
    import soundfile as sf
    sys.path.insert(0, str(ROOT))
    import shorts
    folder = Path(folder)
    meta = json.loads((folder / "voice.json").read_text(encoding="utf-8"))
    cues = cues_v2(meta["words"]) if meta.get("cue_set") == "v2" else cues_from(meta["words"])
    secs = round(float(meta["words"][-1][2]) + 2.8, 2)
    animate = ensure_app()
    pic = folder / "picture.mp4"
    _remotion(animate, ["render", "src/index.jsx", "MapShort", str(pic), "--props=" + json.dumps({"cues": cues, "seconds": secs}),
                        "--concurrency=2", "--crf=18", "--muted"])
    ff = shorts.find_ffmpeg()
    track = HOME / "music" / "scott-buckley" / "convergence.mp3"
    out = folder / "short.mp4"
    flt = (f"[1:a]loudnorm=I=-16:TP=-1.5,apad=whole_dur={secs}[v];"
           f"[2:a]atrim=4:{4 + secs},asetpts=N/SR/TB,afade=t=in:d=1.5,afade=t=out:st={secs - 2.5}:d=2.5,loudnorm=I={-16 + music_db}:TP=-6[m];"
           "[v][m]amix=inputs=2:duration=first:normalize=0[a]")
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(pic), "-i", str(folder / "voice.wav"), "-i", str(track), "-filter_complex", flt,
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", str(secs), str(out)], check=True)
    sheet(out, folder / "sheet.png", every=1.5, cols=4)
    (folder / "cues.json").write_text(json.dumps(cues, indent=1), encoding="utf-8")
    print("SHORT", out, secs, "s")
    return out


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        print(__doc__)
    elif a[0] == "prep":
        prep()
    elif a[0] == "short":
        short(a[1])
    elif a[0] == "kit":
        kit(int(a[1]) if len(a) > 1 else 6)
    elif a[0] == "preview":
        for lk in (LOOKS if a[1] == "all" else a[1].split(",")):
            preview(lk)
    elif a[0] == "still":
        still(a[1], int(a[2]), a[3])
    elif a[0] == "render":
        for lk in (LOOKS if a[1] == "all" else a[1].split(",")):
            render(lk)
