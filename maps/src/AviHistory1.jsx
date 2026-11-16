// AviHistory1.jsx: History of aviation, Chapter 1 "Before the first flight" (client: Bassel), made with Fable.
// 1920x1080, 30 fps, 6 min 9 s, plays under the recorded narration (timing.json: 33 lines, word times). Lines 0-8 are the client's
// approved "why ~10 km" Short (ref/Aviation.jsx, AviAltitude) re-laid for 16:9: same content, same beats, same footage windows.
// Lines 9-32 are the chapter: the honey/aviation look (deep navy, white, amber, flat infographics, gentle springs) mixed with real
// public-domain period pictures and real maps (geo.json + d3-geo). Every drawn aircraft uses REAL proportions (client's rule):
// airliner 37.6 m long / 4 m tall fuselage / 35.8 m span; Wright Flyer 12.3 m span, 6.4 m long, wings 1.8 m apart; Lilienthal glider
// ~7 m span; the 1783 Montgolfier balloon ~23 m tall, ~15 m wide. Drawings are 10 px per metre at scale 1.
// Captions are drawn by a wrapper along the bottom (y 900-1040): important things stay above y 880. Every frame is a pure function
// of the frame number; every animation is driven by the word times (helper at(lineIndex, 'word')).
import React from 'react';
import {AbsoluteFill, Sequence, OffthreadVideo, Img, staticFile, interpolate, spring, Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import {geoMercator, geoPath, geoGraticule10} from 'd3-geo';
import geo from './geo.json';   // Natural Earth (public domain): geo.world.features, properties.a3 = ISO3

// the "possibly" pictures: still downloading while this was written. The Builder switches on the ones that exist
// (files: av-langley-model.jpg, av-langley-boat.jpg, av-langley-crash.jpg, av-icarus.jpg, av-leonardo-ornithopter.jpg, av-montgolfier-1783.jpg).
const HAVE = {langleyModel: true, langleyBoat: true, langleyCrash: false, icarus: false, ornithopter: true, montgolfier: true};

const W = 1920, H = 1080;
const NAVY = '#0B1B33', NAVY2 = '#152C4F', WHITE = '#FFFFFF', AMBER = '#FFB547';
const SKY = '#7FB8E6', RED = '#FF5C5C', GREEN = '#6FD48F', LAND = '#2A4570', LAND2 = '#3D5C8E', SEA = '#0E2447';
const SAND = '#C9B27A', SAND2 = '#E2CF9A', PAPER = '#F1E8D2', INK = '#2B2416';
const BIG = "'Archivo Black', sans-serif", SMALL = "'Montserrat', sans-serif";
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
const XF = 5 / 30;   // crossfade between shots: 5 frames
const FULL = [0, 0, W, H];

// ---------- tiny pure helpers ----------
const lerp = (a, b, p) => a + (b - a) * p;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (t, a, d = 0.4, e = Easing.out(Easing.cubic)) => interpolate(t, [a, a + d], [0, 1], {...CL, easing: e});
const lin = (t, a, d) => interpolate(t, [a, a + d], [0, 1], CL);
const rnd = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // seeded, no Math.random
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const pop = (t, a, fps, cfg) => (t < a ? 0 : spring({frame: Math.round((t - a) * fps), fps, config: cfg || {damping: 12, stiffness: 160, mass: 0.7}}));
const soft = {damping: 16, stiffness: 120, mass: 0.9};
const bouncy = {damping: 9, stiffness: 180, mass: 0.6};
// word lookup: at(lineIndex, 'word', nth) -> start time of that word in the narration (prefix match, punctuation ignored)
const cleanW = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, '');
const makeAt = (lines) => (li, word, nth = 0) => {
  const L = lines[li];
  if (!L) return 0;
  const target = cleanW(word);
  let k = 0;
  for (const w of L.words) { if (cleanW(w[0]).startsWith(target)) { if (k === nth) return w[1]; k++; } }
  return L.t0;
};
const polyPts = (cx, cy, r, n, rot = -Math.PI / 2) => {
  const p = [];
  for (let i = 0; i < n; i++) { const a = rot + Math.PI * 2 / n * i; p.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`); }
  return p.join(' ');
};
const closed = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z';
// a quadratic bezier: point and heading at u
const qb = (p0, c, p1, u) => {
  const x = (1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * c[0] + u * u * p1[0];
  const y = (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * c[1] + u * u * p1[1];
  const dx = 2 * (1 - u) * (c[0] - p0[0]) + 2 * u * (p1[0] - c[0]);
  const dy = 2 * (1 - u) * (c[1] - p0[1]) + 2 * u * (p1[1] - c[1]);
  return {x, y, ang: Math.atan2(dy, dx) * 180 / Math.PI};
};
// a cubic bezier point at u
const cb = (p0, c1, c2, p1, u) => {
  const w = 1 - u;
  return [w * w * w * p0[0] + 3 * w * w * u * c1[0] + 3 * w * u * u * c2[0] + u * u * u * p1[0],
          w * w * w * p0[1] + 3 * w * w * u * c1[1] + 3 * w * u * u * c2[1] + u * u * u * p1[1]];
};
// dots along a quadratic path up to fraction p
const dotted = (p0, c, p1, p, n = 40, color = AMBER, r = 4.5) => Array.from({length: n}, (_, i) => {
  const u = (i + 1) / n;
  if (u > p) return null;
  const q = qb(p0, c, p1, u);
  return <circle key={i} cx={q.x} cy={q.y} r={r} fill={color} opacity={0.9} />;
});

// ---------- real geography ----------
const LAND_FC = geo.world;
const RIVERS = geo.rivers || null;   // Natural Earth river centrelines (review 1): the Seine through Paris, the Potomac
const GRAT = geoGraticule10();
const feats = (a3s) => ({type: 'FeatureCollection', features: LAND_FC.features.filter((f) => a3s.includes(f.properties.a3))});
// a Mercator projection fitted so the lon/lat box [lon0, lat0, lon1, lat1] fills the screen box [x, y, w, h] (minus a padding)
const fitBox = (ll, box, pad = 0) => geoMercator().fitExtent([[box[0] + pad, box[1] + pad], [box[0] + box[2] - pad, box[1] + box[3] - pad]],
  {type: 'MultiPoint', coordinates: [[ll[0], ll[1]], [ll[2], ll[1]], [ll[2], ll[3]], [ll[0], ll[3]]]});
// a camera move between two fitted projections: log-scale and centre ease, so a zoom reads as one continuous move
const camState = (p, c) => ({scale: p.scale(), center: p.invert(c)});
const camLerp = (A, B, k, c) => geoMercator()
  .scale(Math.exp(lerp(Math.log(A.scale), Math.log(B.scale), k)))
  .center([lerp(A.center[0], B.center[0], k), lerp(A.center[1], B.center[1], k)]).translate(c);
const boxC = (box) => [box[0] + box[2] / 2, box[1] + box[3] / 2];
// an eased zoom from lon/lat box ll0 to ll1 inside the screen box, k 0..1
const zoomBox = (ll0, ll1, box, k, pad = 0) => (k <= 0 ? fitBox(ll0, box, pad) : k >= 1 ? fitBox(ll1, box, pad) : camLerp(camState(fitBox(ll0, box, pad), boxC(box)), camState(fitBox(ll1, box, pad), boxC(box)), k, boxC(box)));

// ---------- shared building blocks ----------
// deep navy sky with a faint dot grid and slow clouds (never a flat still)
function Bg({t}) {
  const dots = [];
  for (let r = 0; r < 14; r++) for (let c = 0; c < 25; c++) dots.push(<circle key={r * 25 + c} cx={40 + c * 77} cy={60 + r * 80} r={2} fill={WHITE} opacity={0.06 + 0.04 * Math.sin(t * 0.8 + r * 0.7 + c * 0.4)} />);
  const clouds = [[0, 220, 1.3], [1, 700, 1.0], [2, 420, 0.8]].map(([i, y, s]) => {
    const x = ((t * 18 * s + rnd(i) * 2400) % 2500) - 300;
    return (
      <g key={i} transform={`translate(${x}, ${y}) scale(${s})`} opacity={0.07}>
        <ellipse cx={0} cy={0} rx={150} ry={40} fill={WHITE} />
        <ellipse cx={-60} cy={-20} rx={70} ry={45} fill={WHITE} />
        <ellipse cx={50} cy={-25} rx={90} ry={55} fill={WHITE} />
      </g>
    );
  });
  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${NAVY} 0%, ${NAVY2} 55%, ${NAVY} 100%)`}}>
      <svg width={W} height={H} style={{position: 'absolute'}}>{dots}{clouds}</svg>
    </AbsoluteFill>
  );
}
// the captions layer owns y 900-1040; a soft darker band keeps drawings from fighting the words
function CaptionBand() {
  return <div style={{position: 'absolute', left: 0, top: 890, width: W, height: 160, background: 'linear-gradient(180deg, rgba(11,27,51,0) 0%, rgba(11,27,51,0.45) 30%, rgba(11,27,51,0.45) 80%, rgba(11,27,51,0.2) 100%)'}} />;
}
// small credit tag top-left ("Real footage" / "Public domain")
function Credit({t, a, children, x = 44, y = 36}) {
  return (
    <div style={{position: 'absolute', left: x, top: y, padding: '6px 14px', borderRadius: 8, background: 'rgba(11,27,51,0.6)', border: '1px solid rgba(255,255,255,0.25)',
                 fontFamily: SMALL, fontWeight: 700, fontSize: 20, color: WHITE, letterSpacing: 1, opacity: ease(t, a + 0.1, 0.3)}}>{children}</div>
  );
}
// a scene wrapper: fades in over XF seconds on top of the previous scene
function Scene({t, a, children}) {
  return <AbsoluteFill style={{opacity: a <= 0 ? 1 : ease(t, a, XF, Easing.inOut(Easing.quad))}}>{children}</AbsoluteFill>;
}
// real footage, full frame (cover), a slow push-in; `a`..`b` in global seconds; the Sequence starts at the shot's start
function Clip({src, from = 0, a, b, t, fps, zoom = [1.04, 1.14], fx = 50, fy = 50, dark = 0.3, rate = 1}) {
  if (t < a || t > b + XF) return null;
  const p = lin(t, a, Math.max(0.1, b - a));
  const z = lerp(zoom[0], zoom[1], p);
  const style = {position: 'absolute', width: W, height: H, objectFit: 'cover', objectPosition: `${fx}% ${fy}%`, transform: `scale(${z})`, transformOrigin: `${fx}% ${fy}%`};
  const fade = a <= 0 ? 1 : interpolate(t, [a, a + XF], [0, 1], CL);   // at frame 0 the footage is simply there (review 1)
  return (
    <AbsoluteFill style={{opacity: fade, background: NAVY}}>
      <Sequence from={Math.round(a * fps)} durationInFrames={Math.max(1, Math.round((b - a + XF) * fps))} layout="none">
        <OffthreadVideo src={staticFile(`fs/${src}`)} muted startFrom={Math.round(from * fps)} playbackRate={rate} style={style} />
      </Sequence>
      <AbsoluteFill style={{background: `linear-gradient(180deg, rgba(11,27,51,${dark + 0.25}) 0%, rgba(11,27,51,${dark * 0.3}) 28%, rgba(11,27,51,${dark * 0.3}) 58%, rgba(11,27,51,${dark + 0.4}) 100%)`}} />
      <Credit t={t} a={a}>Real footage</Credit>
    </AbsoluteFill>
  );
}
// a public-domain picture: cover or contain on a dark backdrop, a slow push (Ken Burns), a soft vignette, a light film grain
// (seeded per frame), credit tag top-left. `box` = [x, y, w, h] on screen, `dim` darkens it so drawings can sit in front.
function Photo({src, id, a, b, t, box = FULL, fit = 'cover', zoom = [1.0, 1.1], fx = 50, fy = 50, dim = 0, gray = false, radius = 0, o = 1, credit = true}) {
  if (t < a || t > b + XF) return null;
  const p = lin(t, a, Math.max(0.1, b - a));
  const z = lerp(zoom[0], zoom[1], p);
  return (
    <AbsoluteFill style={{opacity: interpolate(t, [a, a + XF], [0, 1], CL) * o}}>
      <div style={{position: 'absolute', left: box[0], top: box[1], width: box[2], height: box[3], overflow: 'hidden', borderRadius: radius, background: '#06101F', boxShadow: radius ? '0 20px 60px rgba(0,0,0,0.5)' : 'none'}}>
        <Img src={staticFile(`fs/${src}`)} style={{position: 'absolute', width: '100%', height: '100%', objectFit: fit, objectPosition: `${fx}% ${fy}%`, transform: `scale(${z})`, transformOrigin: `${fx}% ${fy}%`, filter: gray ? 'grayscale(1) contrast(1.05)' : 'contrast(1.02)'}} />
        <div style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)'}} />
        <svg width={box[2]} height={box[3]} style={{position: 'absolute', left: 0, top: 0}}>
          <filter id={`grain-${id}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={1} seed={Math.floor(t * 30) % 97} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width={box[2]} height={box[3]} filter={`url(#grain-${id})`} opacity={0.08} style={{mixBlendMode: 'overlay'}} />
        </svg>
        {dim > 0 ? <div style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', background: NAVY, opacity: dim}} /> : null}
      </div>
      {credit ? <Credit t={t} a={a} x={box[0] + 24} y={box[1] + 24}>Public domain</Credit> : null}
    </AbsoluteFill>
  );
}
// a number (Archivo Black) with a small unit label beneath; pops on its word; anchored on x
function Num({t, a, fps, x = 960, y, size = 110, color = AMBER, children, sub, subColor = WHITE, until, align = 'center'}) {
  if (t < a || (until && t > until + 0.25)) return null;
  const k = pop(t, a, fps, bouncy);
  const out = until ? interpolate(t, [until, until + 0.25], [1, 0], CL) : 1;
  const tx = align === 'center' ? '-50%' : align === 'left' ? '0%' : '-100%';
  return (
    <div style={{position: 'absolute', left: x, top: y, textAlign: align, whiteSpace: 'nowrap', opacity: out, transform: `translateX(${tx}) scale(${0.6 + 0.4 * k})`, transformOrigin: align === 'center' ? '50% 50%' : align === 'left' ? '0% 50%' : '100% 50%'}}>
      <div style={{fontFamily: BIG, fontSize: size, lineHeight: 1, color, letterSpacing: -1, textShadow: '0 8px 24px rgba(0,0,0,0.45)'}}>{children}</div>
      {sub ? <div style={{fontFamily: SMALL, fontWeight: 800, fontSize: Math.max(22, size * 0.22), color: subColor, letterSpacing: 3, marginTop: 6, textTransform: 'uppercase', opacity: 0.9}}>{sub}</div> : null}
    </div>
  );
}
// small Montserrat label in a pill, centred on x; names something in the drawing
function Tag({t, a, fps, x, y, children, bg = AMBER, fg = NAVY, size = 22, dy = 20, until, italic = false}) {
  if (t < a || (until && t > until + 0.3)) return null;
  const k = pop(t, a, fps, soft);
  const out = until ? interpolate(t, [until, until + 0.3], [1, 0], CL) : 1;
  return (
    <div style={{position: 'absolute', left: x, top: y, padding: '7px 20px', borderRadius: 999, background: bg, color: fg, textAlign: 'center',
                 fontFamily: SMALL, fontWeight: italic ? 500 : 800, fontStyle: italic ? 'italic' : 'normal', fontSize: size, letterSpacing: italic ? 0.5 : 1.5, textTransform: italic ? 'none' : 'uppercase', whiteSpace: 'nowrap',
                 opacity: k * out, transform: `translate(-50%, ${(1 - k) * dy}px) scale(${0.8 + 0.2 * k})`, boxShadow: '0 6px 18px rgba(0,0,0,0.3)'}}>{children}</div>
  );
}
// SVG label (uppercase, small) for use inside drawings and maps
const Lbl = ({x, y, children, anchor = 'middle', size = 22, color = WHITE, o = 1, weight = 800, rot = 0}) => (
  <text x={x} y={y} textAnchor={anchor} fontFamily={SMALL} fontWeight={weight} fontSize={size} fill={color} letterSpacing={2} opacity={o} transform={rot ? `rotate(${rot}, ${x}, ${y})` : undefined}>{children}</text>
);
// an SVG pill label (same look as Tag) for use inside an <svg>
function SvgPill({t, fps, a, x, y, children, bg = AMBER, fg = NAVY, w = 180, size = 22, o = 1, until}) {
  if (t < a || (until && t > until + 0.3)) return null;
  const k = pop(t, a, fps, soft);
  const out = until ? interpolate(t, [until, until + 0.3], [1, 0], CL) : 1;
  return (
    <g transform={`translate(${x}, ${y + (1 - k) * 20}) scale(${0.8 + 0.2 * k})`} opacity={k * o * out}>
      <rect x={-w / 2} y={-22} width={w} height={44} rx={22} fill={bg} />
      <text y={8} textAnchor="middle" fontFamily={SMALL} fontWeight={800} fontSize={size} fill={fg} letterSpacing={2}>{children}</text>
    </g>
  );
}
// a dot pin on a map with its name; `pt` is the projected [x, y]
function Pin({t, fps, a, pt, label, lx = 0, ly = -26, anchor = 'middle', color = AMBER, size = 22, o = 1, r = 11}) {
  if (t < a || !pt) return null;
  const k = pop(t, a, fps, bouncy);
  return (
    <g transform={`translate(${pt[0]}, ${pt[1]})`} opacity={Math.min(1, k * 1.5) * o}>
      <circle r={2 * r * k} fill={color} opacity={0.25} />
      <circle r={r * k} fill={color} stroke={WHITE} strokeWidth={r > 8 ? 4 : 2.5} />
      <text x={lx} y={ly} textAnchor={anchor} fontFamily={SMALL} fontWeight={800} fontSize={size} fill={WHITE} letterSpacing={2} opacity={k}>{label}</text>
    </g>
  );
}
// a green tick badge
const Tick = ({x, y, k = 1, r = 44}) => (k <= 0 ? null : (
  <g transform={`translate(${x}, ${y}) scale(${k})`} opacity={Math.min(1, k)}>
    <circle r={r} fill={GREEN} />
    <path d={`M${-r * 0.45},${r * 0.05} L${-r * 0.12},${r * 0.4} L${r * 0.5},${-r * 0.4}`} stroke={NAVY} strokeWidth={r * 0.22} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </g>
));
// a red cross over a point
const Cross = ({x, y, k = 1, r = 30}) => (k <= 0 ? null : (
  <g transform={`translate(${x}, ${y})`}>
    <line x1={-r} y1={-r} x2={-r + 2 * r * clamp01(k * 2)} y2={-r + 2 * r * clamp01(k * 2)} stroke={RED} strokeWidth={10} strokeLinecap="round" />
    <line x1={r} y1={-r} x2={r - 2 * r * clamp01(k * 2 - 1)} y2={-r + 2 * r * clamp01(k * 2 - 1)} stroke={RED} strokeWidth={10} strokeLinecap="round" />
  </g>
));
// an arrow with its head at the far end; dir 'left' | 'right' | 'up' | 'down'; len in px
const Arrow = ({x, y, len, dir = 'left', color = RED, k = 1, w = 10}) => {
  if (k <= 0 || len <= 0) return null;
  const ex = dir === 'left' ? x - len : dir === 'right' ? x + len : x, ey = dir === 'up' ? y - len : dir === 'down' ? y + len : y;
  const rot = dir === 'left' ? -Math.PI / 2 : dir === 'right' ? Math.PI / 2 : dir === 'down' ? Math.PI : 0;
  return (
    <g opacity={k}>
      <line x1={x} y1={y} x2={ex} y2={ey} stroke={color} strokeWidth={w} strokeLinecap="round" />
      <polygon points={polyPts(ex, ey, w * 2.2, 3, rot - Math.PI / 2)} fill={color} />
    </g>
  );
};
// a map panel: rounded box of sea, the real land (all countries), highlighted countries, the graticule; children are drawn in map space
function MapPanel({proj, hi = [], box, k = 1, id, children, o = 1, rx = 28, rivers = 0}) {
  if (k <= 0) return null;
  const path = geoPath(proj.clipExtent([[box[0], box[1]], [box[0] + box[2], box[1] + box[3]]]));
  const c = boxC(box);
  return (
    <g transform={`translate(${c[0]}, ${c[1]}) scale(${0.92 + 0.08 * Math.min(1, k)}) translate(${-c[0]}, ${-c[1]})`} opacity={Math.min(1, k) * o}>
      <defs><clipPath id={`${id}-clip`}><rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} rx={rx} /></clipPath></defs>
      <rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} rx={rx} fill={SEA} />
      <g clipPath={`url(#${id}-clip)`}>
        <path d={path(GRAT) || ''} stroke={WHITE} strokeWidth={1} fill="none" opacity={0.08} />
        <path d={path(LAND_FC) || ''} fill={LAND} stroke={LAND2} strokeWidth={1.2} strokeLinejoin="round" />
        {hi.length ? <path d={path(feats(hi)) || ''} fill={LAND2} stroke={AMBER} strokeWidth={2} strokeLinejoin="round" opacity={0.95} /> : null}
        {rivers > 0 && RIVERS ? <path d={path(RIVERS) || ''} stroke={SKY} strokeWidth={rivers} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} /> : null}
        {children}
      </g>
      <rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} rx={rx} fill="none" stroke={WHITE} strokeWidth={2} opacity={0.25} />
    </g>
  );
}
// the running year chip, small, top-right; flips on each change
function YearChip({t, fps, label, since}) {
  const k = Math.min(1, pop(t, since, fps, soft));
  return (
    <div style={{position: 'absolute', right: 44, top: 36, padding: '8px 20px', borderRadius: 999, background: 'rgba(11,27,51,0.72)', border: '1px solid rgba(255,181,71,0.7)',
                 fontFamily: SMALL, fontWeight: 800, fontSize: 24, letterSpacing: 2.5, color: AMBER, whiteSpace: 'nowrap', transform: `scaleY(${0.5 + 0.5 * k})`, opacity: 0.6 + 0.4 * k}}>{label}</div>
  );
}

// ---------- drawn aircraft and figures, all at 10 px per metre at scale 1 (REAL proportions, the client's rule) ----------
// a modern airliner (A320 / 737 class) seen from the side, nose to +x: fuselage 37.6 m long, 4 m tall (10:1), the fin swept up
// off the tail, the wing seen edge-on as a thin slanted line, two engines slung under it
const AirlinerSide = ({x, y, s = 1, rot = 0, color = WHITE, o = 1, accent = AMBER}) => (
  <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
    <path d="M14,-4 L-62,-22 L-72,-20 L-4,-1 Z" fill={color} opacity={0.45} />
    <path d="M188,0 C187,-11 174,-20 150,-20 L-120,-20 L-188,-9 L-188,-3 L-100,20 L150,20 C174,20 187,11 188,0 Z" fill={color} />
    <path d="M-104,-20 L-160,-84 L-186,-84 L-150,-20 Z" fill={color} />
    <path d="M-150,-10 L-206,-20 L-208,-15 L-156,-4 Z" fill={color} opacity={0.85} />
    <path d="M160,-14 L178,-13 L172,-6 L150,-6 Z" fill={NAVY} opacity={0.7} />
    {Array.from({length: 24}, (_, i) => <rect key={i} x={118 - i * 10} y={-10} width={4} height={5} rx={1} fill={NAVY} opacity={0.45} />)}
    <rect x={-150} y={-2} width={290} height={5} rx={2} fill={accent} opacity={0.9} />
    <path d="M34,6 L-46,24 L-58,22 L10,2 Z" fill={color} />
    <rect x={-22} y={12} width={44} height={20} rx={9} fill={color} opacity={0.75} stroke={NAVY} strokeWidth={2} />
    <rect x={4} y={18} width={46} height={22} rx={10} fill={color} stroke={NAVY} strokeWidth={2} />
    <circle cx={6} cy={29} r={8} fill={NAVY} opacity={0.5} />
  </g>
);
// the same airliner seen from above, nose to +x: span 35.8 m vs length 37.6 m, wings swept 25 degrees, slender fuselage, tailplane
// 12.5 m, two engines ahead of the wing. hiWing / hiTail / hiEng 0..1 light those parts amber
const AirlinerTop = ({x, y, s = 1, rot = 0, color = WHITE, o = 1, hiWing = 0, hiTail = 0, hiEng = 0}) => {
  const col = (k) => (k > 0.5 ? AMBER : color);
  const glow = (k) => (k > 0 ? {stroke: AMBER, strokeWidth: 3 + 5 * k, strokeOpacity: 0.5 * k, strokeLinejoin: 'round'} : {});
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
      {[-1, 1].map((sg) => <path key={sg} d={`M44,${sg * 20} L-30,${sg * 179} L-45,${sg * 179} L-20,${sg * 20} Z`} fill={col(hiWing)} {...glow(hiWing)} />)}
      {[-1, 1].map((sg) => <path key={sg} d={`M-150,${sg * 18} L-178,${sg * 62} L-190,${sg * 62} L-184,${sg * 18} Z`} fill={col(hiTail)} {...glow(hiTail)} />)}
      <path d="M188,0 C188,-12 176,-20 150,-20 L-150,-20 L-188,-7 L-188,7 L-150,20 L150,20 C176,20 188,12 188,0 Z" fill={color} />
      <rect x={-186} y={-2.5} width={84} height={5} fill={col(hiTail)} opacity={hiTail > 0.5 ? 1 : 0.5} />
      <path d="M166,-10 L182,-9 L182,9 L166,10 Z" fill={NAVY} opacity={0.6} />
      {[-1, 1].map((sg) => <rect key={sg} x={20} y={sg * 57 - 11} width={46} height={22} rx={10} fill={col(hiEng)} stroke={hiEng > 0 ? AMBER : NAVY} strokeWidth={hiEng > 0 ? 3 + 4 * hiEng : 2} strokeOpacity={hiEng > 0 ? 0.6 : 1} />)}
    </g>
  );
};
// the 1903 Wright Flyer seen from the side, nose to +x: 6.4 m long, two wings of 2 m chord 1.8 m apart, canard ahead, rudder behind,
// the pilot prone on the lower wing. A long thin biplane: in side view the wings are short bars (their chord)
const FlyerSide = ({x, y, s = 1, rot = 0, color = WHITE, o = 1}) => (
  <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
    <path d="M-10,-18 Q0,-21.5 12,-18 L12,-16 Q0,-19.5 -10,-16 Z" fill={color} />
    <path d="M-10,0 Q0,-3.5 12,0 L12,2 Q0,-1.5 -10,2 Z" fill={color} />
    {[-8, 10].map((sx) => <line key={sx} x1={sx} y1={-16} x2={sx} y2={0} stroke={color} strokeWidth={1} />)}
    <line x1={-8} y1={-16} x2={10} y2={0} stroke={color} strokeWidth={0.5} opacity={0.6} />
    <path d="M-12,4 L34,2 M-12,4 L-12,-16 M34,2 L34,-14" stroke={color} strokeWidth={1} fill="none" />
    <rect x={24} y={-15} width={12} height={1.6} fill={color} />
    <rect x={24} y={-7} width={12} height={1.6} fill={color} />
    <path d="M-12,-14 L-32,-13 M-12,-2 L-32,-3" stroke={color} strokeWidth={0.8} />
    <rect x={-33} y={-16} width={2} height={16} fill={color} />
    <ellipse cx={-14} cy={-9} rx={1.2} ry={12} fill={color} opacity={0.7} />
    <rect x={-8} y={-4.5} width={17} height={3} rx={1.5} fill={AMBER} />
    <circle cx={10} cy={-3.5} r={2} fill={AMBER} />
  </g>
);
// the Wright Flyer seen from the front: 12.3 m span, the wings 1.8 m apart with struts, the pilot lying in the middle, the engine beside
// him, two propellers behind (spin 0..1 turns them into discs), skids below, the canard ahead as a thin bar
const FlyerFront = ({x, y, s = 1, color = WHITE, o = 1, spin = 0}) => (
  <g transform={`translate(${x}, ${y}) scale(${s})`} opacity={o}>
    {[-1, 1].map((sg) => <g key={sg} opacity={0.55}><ellipse cx={sg * 28} cy={-9} rx={2 + 11 * spin} ry={13} fill={color} /><line x1={sg * 28} y1={-22} x2={sg * 28} y2={4} stroke={color} strokeWidth={1.2} /></g>)}
    <path d="M-61.5,-16 Q0,-21 61.5,-16 L61.5,-14 Q0,-19 -61.5,-14 Z" fill={color} />
    <path d="M-61.5,2 Q0,-3 61.5,2 L61.5,4 Q0,-1 -61.5,4 Z" fill={color} />
    {[-52, -35, -18, 18, 35, 52].map((sx) => <line key={sx} x1={sx} y1={-16 + Math.abs(sx) * 0.05} x2={sx} y2={2 + Math.abs(sx) * 0.05} stroke={color} strokeWidth={1} />)}
    {[-52, -18, 18].map((sx) => <line key={sx} x1={sx} y1={-14} x2={sx + 17} y2={2} stroke={color} strokeWidth={0.5} opacity={0.6} />)}
    <path d="M-18,4 L-18,9 L18,9 L18,4" stroke={color} strokeWidth={1.2} fill="none" />
    <rect x={-25} y={-10} width={50} height={1.6} fill={color} opacity={0.8} />
    <rect x={-9} y={-6} width={18} height={6} rx={3} fill={AMBER} />
    <circle cx={0} cy={-8} r={2.6} fill={AMBER} />
    <rect x={11} y={-8} width={8} height={8} rx={1.5} fill={color} opacity={0.85} />
  </g>
);
// Lilienthal's glider seen from the front: ~7 m span, a cambered bird-like wing with raised tips, the pilot hanging by his arms;
// swing (degrees) swings his body to steer
const GliderFront = ({x, y, s = 1, rot = 0, color = WHITE, o = 1, swing = 0}) => (
  <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
    <path d="M-35,-2 Q-18,-12 0,-10 Q18,-12 35,-2 L35,0 Q18,-9.5 0,-7.5 Q-18,-9.5 -35,0 Z" fill={color} />
    {[-28, -21, -14, -7, 7, 14, 21, 28].map((sx) => <line key={sx} x1={sx} y1={-10.5 + Math.abs(sx) * 0.09} x2={sx} y2={-8 + Math.abs(sx) * 0.1} stroke={NAVY} strokeWidth={0.6} opacity={0.5} />)}
    <path d="M-5,-8 L-5,-3 L5,-3 L5,-8" stroke={color} strokeWidth={0.8} fill="none" />
    <g transform={`rotate(${swing}, 0, -6)`}>
      <line x1={-4} y1={-7} x2={-2.5} y2={0} stroke={AMBER} strokeWidth={1.6} strokeLinecap="round" />
      <line x1={4} y1={-7} x2={2.5} y2={0} stroke={AMBER} strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={0} cy={-3.5} r={2.3} fill={AMBER} />
      <rect x={-2.6} y={-1} width={5.2} height={8} rx={2} fill={AMBER} />
      <line x1={-1.4} y1={7} x2={-2} y2={14} stroke={AMBER} strokeWidth={2} strokeLinecap="round" />
      <line x1={1.4} y1={7} x2={2} y2={14} stroke={AMBER} strokeWidth={2} strokeLinecap="round" />
    </g>
  </g>
);
// a Montgolfier balloon, origin at the neck: ~23 m tall, ~15 m wide when full; fill 0..1 inflates it; basket 'none' | 'cage' | 'gallery'
const Balloon = ({x, y, s = 1, o = 1, fill = 1, basket = 'none', color = '#3C66B0', trim = AMBER}) => {
  const w = 75 * (0.3 + 0.7 * fill), h = 200 * (0.18 + 0.82 * fill);
  const d = `M-15,0 C-45,${-h * 0.12} ${-w},${-h * 0.42} ${-w},${-h * 0.62} C${-w},${-h * 0.88} ${-w * 0.52},${-h} 0,${-h} C${w * 0.52},${-h} ${w},${-h * 0.88} ${w},${-h * 0.62} C${w},${-h * 0.42} 45,${-h * 0.12} 15,0 Z`;
  return (
    <g transform={`translate(${x}, ${y}) scale(${s})`} opacity={o}>
      <path d={d} fill={color} stroke={trim} strokeWidth={2} />
      {[-0.55, -0.2, 0.2, 0.55].map((f) => <path key={f} d={`M${f * 15},0 C${f * 45},${-h * 0.12} ${f * w},${-h * 0.42} ${f * w},${-h * 0.62} C${f * w},${-h * 0.88} ${f * w * 0.52},${-h} 0,${-h}`} stroke={trim} strokeWidth={1.2} fill="none" opacity={0.5} />)}
      <ellipse cx={0} cy={-h * 0.62} rx={w * 0.98} ry={9 * fill} fill="none" stroke={trim} strokeWidth={3} opacity={0.8} />
      {basket === 'gallery' ? <ellipse cx={0} cy={-2} rx={34} ry={7} fill="none" stroke={trim} strokeWidth={5} /> : null}
      {basket === 'cage' ? (
        <g>
          {[-14, 14].map((sx) => <line key={sx} x1={sx} y1={0} x2={sx * 0.9} y2={30} stroke={trim} strokeWidth={1.5} />)}
          <rect x={-16} y={30} width={32} height={22} rx={4} fill="#8A6A2A" stroke={trim} strokeWidth={2} />
          {[-10, -3, 4, 11].map((sx) => <line key={sx} x1={sx} y1={30} x2={sx} y2={52} stroke={trim} strokeWidth={1} opacity={0.6} />)}
        </g>
      ) : null}
    </g>
  );
};
// a flying bird, nose to +x, about 4 m span at scale 1 (ph = wing-beat phase in radians, real pigeon-like beat is ~3-4 Hz)
const Bird = ({x, y, s = 1, ph = 0, color = WHITE, o = 1, rot = 0}) => {
  const wy = 14 * Math.sin(ph);
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
      <path d={`M-20,${wy} Q-10,${wy * 0.45} 0,0 Q10,${wy * 0.45} 20,${wy}`} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />
      <ellipse cx={0} cy={1} rx={6} ry={2.4} fill={color} />
    </g>
  );
};
// a person as a flat silhouette (review 1): head, shoulders, a robe / coat to the knee, two legs; 1.8 m tall at scale 1 (feet at y 0).
// pose 'stand' | 'arms' (arms spread) | 'lie'. wings 0..1: feathered wings on the arms; flap -1..1 lifts them
const Man = ({x, y, s = 1, rot = 0, color = AMBER, o = 1, pose = 'stand', wings = 0, flap = 0}) => (
  <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
    {pose === 'lie' ? (
      <g>
        <path d="M-12,-6 L4,-7 L5,-1 L-12,0 Z" fill={color} />
        <path d="M-12,-5 L-17,-4 L-17,-1 L-12,0 Z" fill={color} />
        <circle cx={8} cy={-4} r={3} fill={color} />
      </g>
    ) : (
      <g>
        <circle cx={0} cy={-15} r={3} fill={color} />
        <path d="M-1.4,-12.5 L1.4,-12.5 L1.4,-11 L-1.4,-11 Z" fill={color} />
        <path d="M-3.8,-11 Q0,-12.2 3.8,-11 L5.6,-3 L-5.6,-3 Z" fill={color} />
        <rect x={-4.4} y={-3} width={2.8} height={3} fill={color} />
        <rect x={1.6} y={-3} width={2.8} height={3} fill={color} />
        {pose === 'arms' ? (
          <g>
            {wings > 0 ? [-1, 1].map((sg) => <path key={sg} d={`M${sg * 3},-11 Q${sg * 16},${-19 - 7 * flap} ${sg * 36},${-10 - 9 * flap} Q${sg * 20},${-6 - 2 * flap} ${sg * 4.5},-6 Z`} fill={color} opacity={0.8 * wings} />) : null}
            <path d={`M-3.5,-11 L-12,${-11.5 - 3.5 * flap} L-12,${-9.5 - 3.5 * flap} L-3,-9 Z`} fill={color} />
            <path d={`M3.5,-11 L12,${-11.5 - 3.5 * flap} L12,${-9.5 - 3.5 * flap} L3,-9 Z`} fill={color} />
          </g>
        ) : (
          <g>
            <path d="M-3.6,-11 L-5.8,-4.5 L-4.4,-4.2 L-2.4,-9.5 Z" fill={color} />
            <path d="M3.6,-11 L5.8,-4.5 L4.4,-4.2 L2.4,-9.5 Z" fill={color} />
          </g>
        )}
      </g>
    )}
  </g>
);
// a tower (abbey / castle) with battlements, base at y 0, h px tall, w wide
const Tower = ({x, y, w = 60, h = 220, color = NAVY2, o = 1, church = false}) => (
  <g transform={`translate(${x}, ${y})`} opacity={o}>
    {church ? <path d={`M${w / 2},0 L${w / 2 + 150},0 L${w / 2 + 150},${-90} L${w / 2 + 75},${-130} L${w / 2},${-90} Z`} fill={color} stroke={WHITE} strokeWidth={2} strokeOpacity={0.4} /> : null}
    <rect x={-w / 2} y={-h} width={w} height={h} fill={color} stroke={WHITE} strokeWidth={2} strokeOpacity={0.4} />
    {[0, 1, 2, 3].map((i) => <rect key={i} x={-w / 2 + i * (w / 3.5)} y={-h - 14} width={w / 7} height={14} fill={color} stroke={WHITE} strokeWidth={2} strokeOpacity={0.4} />)}
    <path d={`M0,${-h * 0.75} a${w * 0.12},${w * 0.12} 0 0 1 ${w * 0.24},0 L${w * 0.24},${-h * 0.55} L0,${-h * 0.55} Z`} transform={`translate(${-w * 0.12}, 0)`} fill={AMBER} opacity={0.7} />
    {church ? <path d={`M0,${-h - 14} L0,${-h - 40} M-8,${-h - 32} L8,${-h - 32}`} stroke={WHITE} strokeWidth={3} /> : null}
  </g>
);
// Cayley's 1853 glider seen from the side, nose to +x: a kite-like wing above, a boat-shaped car under it, a cruciform tail behind
const CayleyGlider = ({x, y, s = 1, rot = 0, color = WHITE, o = 1, man = true}) => (
  <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
    <path d="M-28,-16 Q0,-26 30,-16 L30,-13 Q0,-22 -28,-13 Z" fill={color} />
    <path d="M-18,0 L24,0 L20,8 L-12,8 Z" fill={color} opacity={0.9} />
    {[-14, 0, 14].map((sx) => <line key={sx} x1={sx} y1={-14} x2={sx} y2={0} stroke={color} strokeWidth={1.2} />)}
    <path d="M-18,-4 L-50,-6" stroke={color} strokeWidth={1.5} />
    <path d="M-44,-16 L-56,-16 L-56,4 L-44,4 Z" fill="none" stroke={color} strokeWidth={1.4} />
    <path d="M-56,-6 L-66,-6" stroke={color} strokeWidth={1.2} />
    {man ? <g><circle cx={4} cy={-5} r={2.6} fill={AMBER} /><rect x={1} y={-3} width={6} height={6} rx={2} fill={AMBER} /></g> : null}
    {[-10, 14].map((sx) => <circle key={sx} cx={sx} cy={10} r={2.5} fill="none" stroke={color} strokeWidth={1} />)}
  </g>
);
// Langley's Aerodrome (tandem wings, ~14.6 m span, ~16 m long) seen from a low three-quarter: the frame, two pairs of wings with
// dihedral (each pair reads as a wide shallow V), a cruciform tail, two propellers between the wings; fold 0..1 folds the wings
const Aerodrome = ({x, y, s = 1, rot = 0, color = WHITE, o = 1, fold = 0, man = true}) => (
  <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
    {[55, -45].map((wx) => (
      <g key={wx} transform={`translate(${wx}, 0)`}>
        <path d={`M0,0 L${-14 - 20 * fold},${-18 + 30 * fold} L${-6 - 20 * fold},${-18 + 30 * fold} L8,0 Z`} fill={color} opacity={0.9} />
        <path d={`M0,0 L${16 + 20 * fold},${-10 + 24 * fold} L${22 + 20 * fold},${-10 + 24 * fold} L8,0 Z`} fill={color} opacity={0.7} />
        <path d="M-68,-2 L68,-2 L68,1 L-68,1 Z" transform={`scale(${1 - fold * 0.7}, 1)`} fill={color} opacity={0.55} />
      </g>
    ))}
    <rect x={-80} y={-2} width={160} height={4} rx={2} fill={color} />
    <path d="M-80,-2 L-96,-12 L-96,8 L-80,2 Z" fill={color} opacity={0.8} />
    {[-1, 1].map((sg) => <ellipse key={sg} cx={5} cy={sg * 10 - 4} rx={2} ry={9} fill={color} opacity={0.6} />)}
    {man ? <g><circle cx={0} cy={-8} r={2.6} fill={AMBER} /><rect x={-3} y={-6} width={6} height={6} rx={2} fill={AMBER} /></g> : null}
    <rect x={-10} y={-6} width={20} height={8} rx={2} fill={color} opacity={0.5} />
  </g>
);
// a simple kite (Chinese, a rectangle with a long tail), origin at the bridle point
const Kite = ({x, y, s = 1, rot = 0, o = 1, t = 0}) => (
  <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
    <rect x={-22} y={-34} width={44} height={60} rx={4} fill={RED} stroke={AMBER} strokeWidth={2} />
    <line x1={-22} y1={-34} x2={22} y2={26} stroke={AMBER} strokeWidth={1.5} opacity={0.7} />
    <line x1={22} y1={-34} x2={-22} y2={26} stroke={AMBER} strokeWidth={1.5} opacity={0.7} />
    <path d={`M0,26 ${[1, 2, 3, 4, 5].map((i) => `q 8 ${10 * Math.sin(t * 6 + i)} 0 20`).join(' ')}`} stroke={AMBER} strokeWidth={2.5} fill="none" strokeLinecap="round" />
  </g>
);
// the sheep, duck and rooster of Versailles, drawn simply (each ~40 px tall at scale 1)
const Sheep = ({x, y, s = 1, k = 1}) => (k <= 0 ? null : (
  <g transform={`translate(${x}, ${y}) scale(${s * k})`} opacity={Math.min(1, k)}>
    <ellipse cx={0} cy={0} rx={22} ry={14} fill="#E9E4D8" />
    {[-14, -5, 4, 13].map((sx) => <circle key={sx} cx={sx} cy={-8} r={7} fill="#E9E4D8" />)}
    <rect x={14} y={-12} width={14} height={11} rx={5} fill={INK} />
    {[-12, -4, 6, 14].map((sx) => <line key={sx} x1={sx} y1={12} x2={sx} y2={22} stroke={INK} strokeWidth={3} strokeLinecap="round" />)}
  </g>
));
const Duck = ({x, y, s = 1, k = 1}) => (k <= 0 ? null : (
  <g transform={`translate(${x}, ${y}) scale(${s * k})`} opacity={Math.min(1, k)}>
    <ellipse cx={0} cy={4} rx={18} ry={10} fill="#E9E4D8" />
    <path d="M-18,4 L-28,-4 L-16,-1 Z" fill="#E9E4D8" />
    <rect x={8} y={-14} width={7} height={18} rx={3} fill="#E9E4D8" />
    <circle cx={12} cy={-16} r={6} fill="#2E7D4F" />
    <path d="M17,-16 L27,-14 L17,-12 Z" fill={AMBER} />
    <circle cx={14} cy={-17} r={1.2} fill={INK} />
  </g>
));
const Rooster = ({x, y, s = 1, k = 1}) => (k <= 0 ? null : (
  <g transform={`translate(${x}, ${y}) scale(${s * k})`} opacity={Math.min(1, k)}>
    <path d="M-10,10 Q-30,-12 -40,-22 Q-24,-14 -20,0 Z" fill="#2E7D4F" />
    <ellipse cx={0} cy={6} rx={16} ry={10} fill="#8B3A2A" />
    <rect x={8} y={-14} width={7} height={20} rx={3} fill="#C1572D" />
    <circle cx={12} cy={-16} r={6} fill="#C1572D" />
    <path d="M8,-22 L11,-26 L14,-22 L17,-26 L19,-21 Z" fill={RED} />
    <path d="M17,-16 L25,-14 L17,-12 Z" fill={AMBER} />
    <circle cx={14} cy={-17} r={1.2} fill={INK} />
    {[-5, 5].map((sx) => <line key={sx} x1={sx} y1={14} x2={sx} y2={22} stroke={AMBER} strokeWidth={2.5} strokeLinecap="round" />)}
  </g>
));
// a greek-vase style silhouette with wings (black-figure on terracotta); flap 0..1
const VaseFigure = ({x, y, s = 1, flap = 0, o = 1, color = INK}) => (
  <g transform={`translate(${x}, ${y}) scale(${s})`} opacity={o}>
    {[-1, 1].map((sg) => <path key={sg} d={`M${sg * 6},-18 Q${sg * 40},${-50 - 24 * flap} ${sg * 78},${-34 - 30 * flap} Q${sg * 60},${-20 - 8 * flap} ${sg * 8},-6 Z`} fill={color} />)}
    {[-1, 1].map((sg) => [0, 1, 2, 3].map((i) => <path key={`${sg}-${i}`} d={`M${sg * (14 + i * 15)},${-14 - i * 4 - flap * (6 + i * 4)} q ${sg * 4} 8 0 16`} stroke="#C8773A" strokeWidth={1.4} fill="none" opacity={0.7} />))}
    <circle cx={0} cy={-30} r={7} fill={color} />
    <path d="M-5,-24 L5,-24 L7,0 L3,0 L0,-10 L-3,0 L-7,0 Z" fill={color} />
    <path d="M-5,-22 L-14,-14 M5,-22 L14,-14" stroke={color} strokeWidth={3} strokeLinecap="round" />
    <path d="M-3,0 L-6,14 M3,0 L6,14" stroke={color} strokeWidth={3.5} strokeLinecap="round" />
  </g>
);

// =====================================================================================================================
// LINES 0-8: the opener = the approved "why ~10 km" Short (AviAltitude), re-laid for 16:9. Ladder on the left, the plane and
// labels in the open space, the coffin-corner chart larger, the photo / print endings in the same spirit
// =====================================================================================================================
const LY = (h) => 860 - h * 32;   // the altitude ladder: 0 km at y 860, 20 km at y 220
const PX = 820;                   // the airliner's x on the ladder
// the sky ladder with the air thinning upward, Everest and Concorde for scale, the airliner at height h (km), drag / lift arrows
function Ladder({t, fps, h, tilt = 0, drag = 0, dragK = 0, lift = 0, liftK = 0, everestAt, concordeAt}) {
  const y = LY(h) + Math.sin(t * 2) * 4;
  const kE = everestAt === undefined ? 0 : pop(t, everestAt, fps, soft);
  const kC = concordeAt === undefined ? 0 : ease(t, concordeAt, 0.6);
  const dots = [];
  for (let i = 0; i < 360; i++) {
    const dy = 220 + rnd(i) * 640, hgt = (860 - dy) / 32;
    if (rnd(i + 500) > Math.exp(-hgt / 7)) continue;
    dots.push(<circle key={i} cx={330 + rnd(i + 900) * 1520 + Math.sin(t * 1.3 + i) * 5} cy={dy + Math.cos(t * 1.1 + i * 0.7) * 4} r={4.5} fill={WHITE} opacity={0.4} />);
  }
  const peak = LY(8.85);
  return (
    <g>
      <rect x={0} y={860} width={W} height={60} fill={SEA} />
      <path d={`M0,860 ${Array.from({length: 18}, (_, i) => `q 54 ${-7 * Math.sin(t * 3 + i)} 108 0`).join(' ')}`} stroke={SKY} strokeWidth={4} fill="none" opacity={0.6} />
      <line x1={200} y1={220} x2={200} y2={860} stroke={WHITE} strokeWidth={4} opacity={0.5} />
      {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((k) => (
        <g key={k}>
          <line x1={200} y1={LY(k)} x2={k % 10 === 0 ? 236 : 220} y2={LY(k)} stroke={WHITE} strokeWidth={4} opacity={0.6} />
          {k % 5 === 0 ? <Lbl x={182} y={LY(k) + 8} anchor="end" size={22} o={0.85}>{k} km</Lbl> : null}
        </g>
      ))}
      {dots}
      <g transform={`translate(1480, 860) scale(1, ${kE}) translate(-1480, -860)`} opacity={kE}>
        <polygon points={`1300,860 1480,${peak} 1660,860`} fill={LAND2} />
        <polygon points={`1442,${peak + 70} 1480,${peak} 1518,${peak + 70} 1502,${peak + 60} 1490,${peak + 76} 1472,${peak + 62} 1458,${peak + 74}`} fill={WHITE} opacity={0.9} />
      </g>
      {kE > 0 ? <Lbl x={1480} y={peak - 22} size={20} o={kE}>EVEREST 8.8 km</Lbl> : null}
      <g opacity={kC * 0.6}>
        <line x1={420} y1={LY(18)} x2={1860} y2={LY(18)} stroke={WHITE} strokeWidth={3} strokeDasharray="12 14" />
        <AirlinerSide x={1720} y={LY(18) - 4} s={0.4} />
        <Lbl x={430} y={LY(18) - 14} anchor="start" size={20}>CONCORDE ~18 km</Lbl>
      </g>
      <line x1={PX - 190} y1={y + 4} x2={PX - 520} y2={y + 10} stroke={WHITE} strokeWidth={10} strokeLinecap="round" opacity={0.18} />
      <AirlinerSide x={PX} y={y} s={0.9} rot={-tilt} />
      {dragK > 0 ? (
        <g>
          <Arrow x={PX - 200} y={y - 22} len={60 + 140 * drag} dir="left" color={RED} k={dragK} />
          <Arrow x={PX - 200} y={y + 26} len={60 + 140 * drag} dir="left" color={RED} k={dragK} />
          <Lbl x={PX - 200 - (60 + 140 * drag) / 2} y={y + 76} size={22} color={RED} o={dragK}>DRAG</Lbl>
        </g>
      ) : null}
      {liftK > 0 ? (
        <g>
          <Arrow x={PX - 40} y={y - 36} len={50 + 130 * lift} dir="up" color={AMBER} k={liftK} />
          <Arrow x={PX + 70} y={y - 36} len={50 + 130 * lift} dir="up" color={AMBER} k={liftK} />
          <Lbl x={PX + 15} y={y - 36 - (50 + 130 * lift) - 18} size={22} color={AMBER} o={liftK}>LIFT</Lbl>
        </g>
      ) : null}
    </g>
  );
}

// ---------- line 0: the hook. real climb over the city from the window; "10 km" with a rising chevron on "ten" ----------
function SceneA0({t, at, fps, a, b}) {
  const ten = at(0, 'ten');
  const k = pop(t, ten, fps, bouncy);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <Clip src="takeoff-oak.mp4" from={88} a={a} b={b} t={t} fps={fps} zoom={[1.04, 1.14]} dark={0.3} />
      <Num t={t} a={ten} fps={fps} x={960} y={420} size={170} color={AMBER}>10 km</Num>
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {[0, 1, 2].map((i) => {
          const ph = ((t - ten) * 0.8 + i * 0.33) % 1;
          return t >= ten ? <path key={i} d={`M900,${380 - ph * 120} L960,${330 - ph * 120} L1020,${380 - ph * 120}`} stroke={AMBER} strokeWidth={12} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={k * (1 - ph) * 0.9} /> : null;
        })}
      </svg>
    </Scene>
  );
}
// ---------- line 1: the plane climbs the ladder to 10 km; Everest pops for scale; "~1/3 AIR DENSITY" on "third", SEA LEVEL on
// "sea level"; DRAG arrows appear on "Thinner" and shrink on "less drag"; a fuel bar pops on "burns" and shrinks on "less fuel" ----------
function SceneA1({t, at, fps, a, b}) {
  const third = at(1, 'third'), sea = at(1, 'sea'), thinner = at(1, 'Thinner'), less1 = at(1, 'less'), burns = at(1, 'burns'), less2 = at(1, 'less', 1);
  const h = 10 * ease(t, a, 1.3, Easing.out(Easing.cubic));
  const drag = 1 - 0.7 * ease(t, less1, 0.6, Easing.inOut(Easing.cubic));
  const kFuel = pop(t, burns, fps, soft);
  const fuel = 1 - 0.45 * ease(t, less2, 0.7, Easing.inOut(Easing.cubic));
  const cam = 1 + 0.05 * lin(t, a, b - a);
  const yPlane = LY(h);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(960, 540) scale(${cam}) translate(-960, -540)`}>
          <Ladder t={t} fps={fps} h={h} tilt={8 * (1 - ease(t, a + 0.9, 0.6))} everestAt={a + 0.5} concordeAt={a + 0.9} drag={drag} dragK={ease(t, thinner, 0.35)} />
          <SvgPill t={t} fps={fps} a={third} x={PX} y={yPlane - 130} w={290} size={22}>~1/3 AIR DENSITY</SvgPill>
          <SvgPill t={t} fps={fps} a={sea} x={1100} y={836} w={200} size={22} bg={WHITE}>SEA LEVEL</SvgPill>
          <g transform={`translate(1180, 300) scale(${kFuel})`} opacity={kFuel}>
            <rect x={-30} y={-28} width={44} height={56} rx={8} fill={WHITE} />
            <rect x={-22} y={-20} width={28} height={18} rx={3} fill={NAVY} />
            <path d="M14,-12 q 18 0 18 18 L32,10 q 0 10 -8 10" stroke={WHITE} strokeWidth={6} fill="none" strokeLinecap="round" />
            <rect x={48} y={-14} width={300} height={28} rx={14} fill={WHITE} opacity={0.18} />
            <rect x={48} y={-14} width={300 * fuel} height={28} rx={14} fill={AMBER} />
            <Lbl x={48} y={-30} anchor="start" size={20} o={0.9}>FUEL BURN</Lbl>
          </g>
        </g>
      </svg>
    </Scene>
  );
}
// a jet engine seen from the front: nacelle lip, spinning fan, spinner; cold air (blue streaks) drawn into it. local: centre (0,0), r ~126
function Engine({t, k, cold}) {
  if (k <= 0) return null;
  const blades = Array.from({length: 18}, (_, i) => (
    <path key={i} d="M0,-14 C-14,-40 -16,-70 -8,-92 C-2,-96 4,-96 8,-90 C12,-70 10,-40 0,-14 Z" fill="#B7C5DA" opacity={0.9} transform={`rotate(${i * 20}) skewX(14)`} />
  ));
  return (
    <g transform={`scale(${k})`} opacity={Math.min(1, k)}>
      {[0, 1, 2, 3, 4].map((i) => {
        const y0 = -150 + i * 75;
        return <path key={i} d={`M-360,${y0} C-260,${y0} -220,${y0 * 0.45} -150,${y0 * 0.35}`} stroke={SKY} strokeWidth={8} fill="none" strokeLinecap="round"
                     strokeDasharray="34 26" strokeDashoffset={-t * 260 - i * 17} opacity={cold * 0.9} />;
      })}
      <circle r={126} fill="#E3E9F2" />
      <circle r={126} fill="none" stroke="#9FB0C8" strokeWidth={3} />
      <circle r={108} fill="#6F7F99" />
      <circle r={98} fill="#0A1426" />
      <g transform={`rotate(${t * 900})`}>{blades}</g>
      <circle r={22} fill="#E3E9F2" />
      <path d={`M0,0 L${Math.cos(t * 15.7) * 20},${Math.sin(t * 15.7) * 20}`} stroke={NAVY} strokeWidth={6} strokeLinecap="round" />
      <circle r={98} fill="none" stroke="#B7C5DA" strokeWidth={4} opacity={0.6} />
    </g>
  );
}
// ---------- line 2: -50 °C. real climb over Dubai; a thermometer (right) drains to -54 °C on "minus fifty"; a jet engine (left) pops
// on "jet" and breathes in blue cold air on "cold" ----------
function SceneA2({t, at, fps, a, b}) {
  const minus = at(2, 'minus'), jet = at(2, 'jet'), cold = at(2, 'cold');
  const v = lerp(15, -54, ease(t, minus, 1.1, Easing.inOut(Easing.cubic)));
  const ty = (val) => 220 + ((20 - val) / 80) * 540;
  const col = v > 0 ? RED : SKY;
  const kTh = pop(t, a + 0.2, fps, soft);
  const kEng = pop(t, jet, fps, bouncy);
  const kCold = ease(t, cold, 0.4);
  return (
    <Scene t={t} a={a}>
      <Clip src="a380-dubai.mp4" from={104} a={a} b={b} t={t} fps={fps} zoom={[1.04, 1.14]} dark={0.3} fy={45} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <rect x={1160} y={150} width={620} height={700} rx={40} fill={NAVY} opacity={0.55 * kTh} />
        <rect x={160} y={280} width={720} height={560} rx={40} fill={NAVY} opacity={0.55 * Math.min(1, kEng)} />
        <g transform={`translate(1560, 500) scale(${kTh}) translate(-1560, -500)`} opacity={kTh}>
          <rect x={1536} y={206} width={48} height={580} rx={24} fill="rgba(11,27,51,0.55)" stroke={WHITE} strokeWidth={4} />
          <rect x={1548} y={ty(v)} width={24} height={780 - ty(v)} rx={12} fill={col} />
          <circle cx={1560} cy={780} r={46} fill={col} stroke={WHITE} strokeWidth={4} />
          {[20, 0, -20, -40, -60].map((val) => (
            <g key={val}>
              <line x1={1516} y1={ty(val)} x2={1532} y2={ty(val)} stroke={WHITE} strokeWidth={3} opacity={0.8} />
              <Lbl x={1506} y={ty(val) + 7} anchor="end" size={20} o={0.8}>{val > 0 ? `+${val}` : val}</Lbl>
            </g>
          ))}
          {v < -40 ? [0, 1, 2, 3, 4].map((i) => {
            const ph = ((t * 0.7 + rnd(i + 70)) % 1);
            const ang = rnd(i + 71) * 6.28;
            return <polygon key={i} points={polyPts(1560 + Math.cos(ang) * (60 + ph * 70), 780 + Math.sin(ang) * (60 + ph * 70), 10 * Math.sin(ph * Math.PI), 6)} fill={WHITE} opacity={0.9} />;
          }) : null}
        </g>
        <g transform="translate(560, 560)">
          <Engine t={t} k={kEng} cold={kCold} />
        </g>
      </svg>
      <Num t={t} a={minus} fps={fps} x={1470} y={420} size={110} color={v > 0 ? WHITE : SKY} align="right">{Math.round(v)} °C</Num>
    </Scene>
  );
}
// ---------- line 3: why not higher? the plane climbs past 10 km on "higher"; LIFT arrows appear on "gives" and shrink on "less lift",
// the plane sags and noses up ----------
function SceneA3({t, at, fps, a, b}) {
  const higher = at(3, 'higher'), gives = at(3, 'gives'), less = at(3, 'less');
  const up = ease(t, higher, 1.1, Easing.inOut(Easing.cubic));
  const sag = ease(t, less, 0.8, Easing.inOut(Easing.quad));
  const h = lerp(10, 14.5, up) - 0.8 * sag;
  const lift = 1 - 0.65 * ease(t, less, 0.6, Easing.inOut(Easing.cubic));
  const cam = 1 + 0.05 * lin(t, a, b - a);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(960, 540) scale(${cam}) translate(-960, -540)`}>
          <Ladder t={t} fps={fps} h={h} tilt={6 * up * (1 - sag) + 10 * sag + Math.sin(t * 9) * 2 * sag} everestAt={a - 1} concordeAt={a - 1} lift={lift} liftK={ease(t, gives, 0.35)} />
        </g>
      </svg>
    </Scene>
  );
}
// ---------- lines 4-5: the flight envelope, larger. a speed/altitude chart: the airliner sits at 10 km with room on both sides; on
// "too high" a ghost plane climbs towards the corner; the STALL SPEED line draws on "the speed at which the wing stalls rises"; the
// MAX SPEED line draws to meet it on "to meet the plane's top speed"; the amber envelope narrows to a point = COFFIN CORNER on
// "coffin corner". Line 5: the ghost fades on "ten", a tick on the 10 km plane on "sweet", the "10 km" pill on "spot", a slow push ----------
function SceneA4({t, at, fps, a, b}) {
  const too = at(4, 'too'), speed = at(4, 'speed'), stalls = at(4, 'stalls'), meet = at(4, 'meet'), top = at(4, 'top'), coffin = at(4, 'coffin');
  const ten = at(5, 'ten'), sweet = at(5, 'sweet'), spot = at(5, 'spot');
  const cy = (h) => 840 - h * 44, xs = (h) => 620 + 34 * h, xt = (h) => 1500 - 28 * h;
  const HM = (1500 - 620) / (34 + 28), XM = xs(HM), YM = cy(HM);
  const mid = (h) => (xs(h) + xt(h)) / 2;
  const axes = ease(t, a, 0.6);
  const pS = ease(t, speed, 1.9, Easing.inOut(Easing.quad)), pT = ease(t, meet, 1.3, Easing.inOut(Easing.quad));
  const kCC = pop(t, coffin, fps, bouncy);
  const climb = ease(t, too, 1.5, Easing.inOut(Easing.quad));
  const hg = lerp(10, HM - 0.3, climb);
  const ghostO = (t >= too ? 0.55 : 0) * (1 - ease(t, ten, 0.5));
  const shake = Math.sin(t * 40) * 4 * (climb >= 1 ? 1 : 0) * ghostO;
  const pts = [];
  for (let i = 0; i <= 30; i++) pts.push(HM * i / 30);
  const stallD = pts.map((h, i) => `${i ? 'L' : 'M'}${xs(h).toFixed(1)},${cy(h).toFixed(1)}`).join(' ');
  const topD = pts.map((h, i) => `${i ? 'L' : 'M'}${xt(h).toFixed(1)},${cy(h).toFixed(1)}`).join(' ');
  const hb = HM * Math.min(pS, pT);
  const band = hb > 0 ? closed([[xs(0), cy(0)], [xs(hb), cy(hb)], [xt(hb), cy(hb)], [xt(0), cy(0)]]) : '';
  const cam = 1 + 0.04 * lin(t, sweet, Math.max(0.5, b - sweet));
  const yP = cy(10) + Math.sin(t * 2) * 4;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(${mid(10)}, ${cy(10)}) scale(${cam}) translate(${-mid(10)}, ${-cy(10)})`}>
          <g opacity={axes}>
            <line x1={520} y1={840} x2={520 + 1040 * axes} y2={840} stroke={WHITE} strokeWidth={4} opacity={0.6} />
            <line x1={520} y1={840} x2={520} y2={840 - 650 * axes} stroke={WHITE} strokeWidth={4} opacity={0.6} />
            <polygon points={polyPts(1565, 840, 14, 3, 0)} fill={WHITE} opacity={0.6} />
            <polygon points={polyPts(520, 185, 14, 3, -Math.PI / 2)} fill={WHITE} opacity={0.6} />
            {[0, 5, 10, 15].map((k) => (
              <g key={k}>
                <line x1={506} y1={cy(k)} x2={534} y2={cy(k)} stroke={WHITE} strokeWidth={4} opacity={0.6} />
                <Lbl x={492} y={cy(k) + 8} anchor="end" size={22} o={0.85}>{k} km</Lbl>
              </g>
            ))}
            <Lbl x={1560} y={876} anchor="end" size={20} o={0.7}>SPEED</Lbl>
            <Lbl x={520} y={160} size={20} o={0.7}>ALTITUDE</Lbl>
            <line x1={534} y1={cy(10)} x2={1560} y2={cy(10)} stroke={WHITE} strokeWidth={2} strokeDasharray="8 12" opacity={0.25} />
          </g>
          {band ? <path d={band} fill={AMBER} opacity={0.14} /> : null}
          <path d={stallD} stroke={RED} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - pS} opacity={pS > 0 ? 1 : 0} />
          <path d={topD} stroke={SKY} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - pT} opacity={pT > 0 ? 1 : 0} />
          {t >= stalls ? <Lbl x={xs(1.5) + 18} y={cy(1.5) - 10} anchor="start" size={22} color={RED} o={ease(t, stalls, 0.3)}>STALL SPEED</Lbl> : null}
          {t >= top ? <Lbl x={xt(1.5) - 18} y={cy(1.5) - 10} anchor="end" size={22} color={SKY} o={ease(t, top, 0.3)}>MAX SPEED</Lbl> : null}
          {ghostO > 0 ? <AirlinerSide x={mid(hg) + shake} y={cy(hg)} s={0.5} color={SKY} accent={SKY} o={ghostO} rot={-8 * climb * (1 - climb) * 4} /> : null}
          <AirlinerSide x={mid(10)} y={yP} s={0.5} />
          <g transform={`translate(${XM}, ${YM})`}>
            {t >= coffin ? [0, 1].map((i) => {
              const ph = ((t - coffin) * 0.9 + i * 0.5) % 1;
              return <circle key={i} r={30 + ph * 90} fill="none" stroke={RED} strokeWidth={6 * (1 - ph)} opacity={(1 - ph) * 0.8} />;
            }) : null}
            <circle r={24 * kCC} fill={RED} stroke={WHITE} strokeWidth={5} opacity={Math.min(1, kCC)} />
          </g>
          {kCC > 0 ? <Lbl x={XM} y={YM - 52} size={26} color={RED} o={Math.min(1, kCC)}>COFFIN CORNER</Lbl> : null}
          <Tick x={mid(10)} y={yP - 110} k={pop(t, sweet, fps, bouncy)} r={50} />
          <SvgPill t={t} fps={fps} a={spot} x={mid(10)} y={yP + 92} w={150} size={24}>10 km</SvgPill>
        </g>
      </svg>
    </Scene>
  );
}
// ---------- line 6: "planes didn't start up here". the ladder again; on "didn't" the plane slides down to the sea, nose down; on
// "here" the camera dives into the bottom of the ladder ----------
function SceneA6({t, at, fps, a, b}) {
  const didnt = at(6, "didn't"), here = at(6, 'here');
  const down = ease(t, didnt, 1.2, Easing.inOut(Easing.cubic));
  const h = lerp(10, 0.1, down);
  const dive = 1 + 5 * ease(t, here, Math.max(0.5, b + XF - here), Easing.in(Easing.quad));
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(${PX}, 860) scale(${dive}) translate(${-PX}, -860)`}>
          <Ladder t={t} fps={fps} h={h} tilt={-14 * Math.sin(down * Math.PI)} everestAt={a - 1} concordeAt={a - 1} />
        </g>
      </svg>
    </Scene>
  );
}
const LYM = (m) => 860 - m * 32;   // the metres ladder: 0 m at y 860, 20 m at y 220 (32 px per metre)
// ---------- line 7: the ladder's first metres. a 0-20 m ladder over sand; the Wright Flyer (drawn to scale: 32 px per metre, 6.4 m
// long, wings 1.8 m apart) glides in on "first flew" and hovers at ~3 M (pill on "three"); "1903" top-left on the year; on "sand" the
// 1903 photo takes over, KILL DEVIL HILLS · NC on "North" ----------
function SceneA7({t, at, fps, a, b}) {
  const first = at(7, 'first'), year = at(7, '1903'), three = at(7, 'three');
  const zoomIn = 1.5 - 0.5 * ease(t, a, 0.9, Easing.out(Easing.cubic));
  const fly = ease(t, first, 1.1, Easing.out(Easing.cubic));
  const fx = lerp(-300, PX, fly), fy = LYM(3) - 13 + Math.sin(t * 2.2) * 5;
  const kThree = pop(t, three, fps, soft);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(${PX}, 860) scale(${zoomIn}) translate(${-PX}, -860)`}>
          <rect x={0} y={860} width={W} height={60} fill={SAND} />
          <path d={`M0,860 ${Array.from({length: 18}, (_, i) => `q 54 ${-6 - 4 * Math.sin(i * 2.1)} 108 0`).join(' ')}`} stroke={SAND2} strokeWidth={5} fill="none" />
          <line x1={200} y1={220} x2={200} y2={860} stroke={WHITE} strokeWidth={4} opacity={0.5} />
          {Array.from({length: 21}, (_, m) => (
            <g key={m}>
              <line x1={200} y1={LYM(m)} x2={m % 5 === 0 ? 236 : 218} y2={LYM(m)} stroke={WHITE} strokeWidth={m % 5 === 0 ? 4 : 2} opacity={0.6} />
              {m % 5 === 0 ? <Lbl x={182} y={LYM(m) + 8} anchor="end" size={22} o={0.85}>{m} m</Lbl> : null}
            </g>
          ))}
          <line x1={264} y1={LYM(3)} x2={1860} y2={LYM(3)} stroke={AMBER} strokeWidth={3} strokeDasharray="10 14" opacity={0.6 * kThree} />
          <line x1={PX} y1={860} x2={PX} y2={LYM(3) + 30} stroke={AMBER} strokeWidth={3} opacity={0.5 * kThree} strokeDasharray="4 8" />
          <FlyerSide x={fx} y={fy} s={3.2} rot={-3 + 4 * Math.sin(t * 1.7)} />
          <SvgPill t={t} fps={fps} a={three} x={PX} y={LYM(3) - 130} w={140} size={24}>~3 M</SvgPill>
          <Lbl x={PX + 140} y={LYM(3) + 30} anchor="start" size={18} o={0.6 * kThree}>12.3 M SPAN · 6.4 M LONG</Lbl>
        </g>
      </svg>
      <Num t={t} a={year} fps={fps} x={60} y={120} size={100} color={WHITE} align="left">1903</Num>
    </Scene>
  );
}
function SceneA7p({t, at, fps, a, b}) {
  const north = at(7, 'North');
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <Photo src="wright-first-flight-1903.jpg" id="a7" a={a} b={b} t={t} zoom={[1.0, 1.06]} fy={55} gray />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <SvgPill t={t} fps={fps} a={a - 1} x={960} y={560} w={140} size={24}>~3 M</SvgPill>
      </svg>
      <Num t={t} a={a - 1} fps={fps} x={60} y={120} size={100} color={WHITE} align="left">1903</Num>
      <Tag t={t} a={north} fps={fps} x={960} y={830} bg="rgba(11,27,51,0.75)" fg={WHITE} size={22}>Kill Devil Hills · NC</Tag>
    </Scene>
  );
}
// the small framed print the photo shrinks into on line 8: lower left, clear of the captions
const PRINT_BOX = [60, 520, 540, 340];
const printBox = (sh) => [lerp(0, PRINT_BOX[0], sh), lerp(0, PRINT_BOX[1], sh), lerp(W, PRINT_BOX[2], sh), lerp(H, PRINT_BOX[3], sh)];
// ---------- line 8: on "how" the photo shrinks into a small framed print lower left; on the clean navy beside it a split ladder: the
// bottom part (0-20 m) holds the Flyer at 3 M, the top part (10,000 M) holds the jet; on "climb" the top part slides up and the break
// between them stretches, a dotted climb joining the two; "3 M" on "three", "10,000 M" counts on "ten thousand"; then hold, calm ----------
function SceneA8({t, at, fps, a, b}) {
  const how = at(8, 'how'), climbW = at(8, 'climb'), three = at(8, 'three'), ten = at(8, 'ten');
  const sh = ease(t, how, 1.0, Easing.inOut(Easing.cubic));
  const box = printBox(sh);
  const split = ease(t, climbW, 2.0, Easing.inOut(Easing.cubic));
  const AX = 1000, botTop = 720, flyerY = 839;
  const topBase = lerp(640, 330, split);
  const jetY = topBase - 100;
  const metres = 10000 * ease(t, ten, 0.9, Easing.out(Easing.quad));
  const zig = [];
  for (let i = 0; i < 4; i++) zig.push(`L${AX + (i % 2 ? 14 : -14)},${botTop - 12 - i * 10}`);
  const cam = 1 + 0.04 * lin(t, ten, Math.max(0.5, b - ten));
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <Photo src="wright-first-flight-1903.jpg" id="a8" a={a - 1} b={b} t={t} zoom={[1.06, 1.1]} fy={55} gray box={box} radius={18 * sh} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <Lbl x={68} y={500} anchor="start" size={22} o={sh * 0.9}>1903</Lbl>
        <g transform={`translate(${AX + 200}, 600) scale(${cam}) translate(${-(AX + 200)}, -600)`} opacity={sh}>
          <line x1={AX} y1={860} x2={AX} y2={botTop} stroke={WHITE} strokeWidth={5} opacity={0.85} />
          {[0, 10, 20].map((m) => <line key={m} x1={AX - 16} y1={860 - m * 7} x2={AX + 16} y2={860 - m * 7} stroke={WHITE} strokeWidth={4} opacity={0.7} />)}
          <Lbl x={AX - 28} y={868} anchor="end" size={20} o={0.7}>0 m</Lbl>
          <Lbl x={AX - 28} y={botTop + 8} anchor="end" size={20} o={0.7}>20 m</Lbl>
          <line x1={AX} y1={flyerY} x2={AX + 160} y2={flyerY} stroke={AMBER} strokeWidth={3} strokeDasharray="8 10" opacity={0.7} />
          <FlyerSide x={AX + 250} y={flyerY - 5} s={1.2} />
          <path d={`M${AX},${botTop} ${zig.join(' ')} L${AX},${botTop - 60}`} stroke={WHITE} strokeWidth={5} fill="none" strokeLinejoin="round" opacity={0.85} />
          <line x1={AX} y1={botTop - 60} x2={AX} y2={topBase + 50} stroke={WHITE} strokeWidth={3} strokeDasharray="6 18" opacity={0.5 * split} />
          <path d={`M${AX},${topBase + 50} L${AX + 14},${topBase + 38} L${AX - 14},${topBase + 26} L${AX + 14},${topBase + 14} L${AX},${topBase}`} stroke={WHITE} strokeWidth={5} fill="none" strokeLinejoin="round" opacity={0.85 * split} />
          <line x1={AX} y1={topBase} x2={AX} y2={topBase - 200} stroke={WHITE} strokeWidth={5} opacity={0.85} />
          <line x1={AX - 16} y1={jetY} x2={AX + 16} y2={jetY} stroke={WHITE} strokeWidth={4} opacity={0.7} />
          <line x1={AX} y1={jetY} x2={AX + 160} y2={jetY} stroke={AMBER} strokeWidth={3} strokeDasharray="8 10" opacity={0.7} />
          <AirlinerSide x={AX + 300} y={jetY + Math.sin(t * 2) * 4} s={0.55} />
          {Array.from({length: 40}, (_, i) => {
            const u = (i + 1) / 40;
            if (u > split) return null;
            const q = cb([AX + 250, flyerY - 40], [AX + 420, lerp(flyerY, jetY, 0.3)], [AX + 120, lerp(flyerY, jetY, 0.7)], [AX + 250, jetY + 40], u);
            return <circle key={i} cx={q[0]} cy={q[1]} r={4.5} fill={AMBER} opacity={0.9} />;
          })}
          <SvgPill t={t} fps={fps} a={three} x={AX + 420} y={flyerY - 12} w={120} size={24}>3 M</SvgPill>
        </g>
      </svg>
      <div style={{opacity: sh}}>
        <Num t={t} a={ten} fps={fps} x={AX + 300} y={jetY - 150} size={64} color={AMBER}>{fmt(metres)} M</Num>
      </div>
    </Scene>
  );
}

// =====================================================================================================================
// LINES 9-32: the chapter
// =====================================================================================================================
const MAP_L = [80, 120, 780, 720];          // the usual map panel, left
const MAP_W = [160, 100, 1600, 760];        // a wide map panel
const LL = {GRC: [19, 34, 29.5, 42], CHN: [73, 18, 135, 54], IBERIA: [-10, 35.5, 4, 44], ENG: [-6, 49.8, 2, 55.8], FRA: [-5, 42, 9, 51.5],
            PARIS: [2.0, 48.6, 2.7, 49.0], DEU: [5, 47, 16, 55.5], ATL: [-100, 25, 20, 62], USA: [-125, 24, -66, 50],
            POTOMAC: [-77.7, 38.3, -76.3, 39.3], NCOH: [-85.5, 33.5, -74.5, 42.5], WORLD: [-170, -55, 180, 75]};
// a dust puff at an impact: rings and grains, k 0..1
const Puff = ({x, y, k, color = SAND2}) => (k <= 0 ? null : (
  <g transform={`translate(${x}, ${y})`} opacity={1 - k}>
    <ellipse rx={30 + 90 * k} ry={10 + 24 * k} fill={color} opacity={0.5} />
    {[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={(rnd(i + 30) - 0.5) * 200 * k} cy={-10 - rnd(i + 31) * 90 * k} r={5 + rnd(i + 32) * 6} fill={color} opacity={0.8} />)}
  </g>
));
// streaming wind lines across a region (x0..x1, y0..y1), k = strength 0..1
const Wind = ({t, x0, y0, x1, y1, k = 1, n = 8, color = SKY, seed = 0}) => (k <= 0 ? null : (
  <g opacity={0.7 * k}>
    {Array.from({length: n}, (_, i) => {
      const y = y0 + rnd(i + seed) * (y1 - y0), len = 120 + rnd(i + seed + 50) * 160;
      const x = x0 + (((t * (300 + rnd(i + seed + 90) * 200) + rnd(i + seed + 20) * 2000) % (x1 - x0 + len)) - len);
      return <path key={i} d={`M${x},${y} q ${len * 0.4} -8 ${len} 0`} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />;
    })}
  </g>
));
// a flickering fire at (x, y): three tongues of flame, k 0..1
const Fire = ({t, x, y, k = 1, s = 1}) => (k <= 0 ? null : (
  <g transform={`translate(${x}, ${y}) scale(${s * k})`} opacity={Math.min(1, k)}>
    <rect x={-50} y={0} width={100} height={12} rx={4} fill="#5A3A1E" />
    {[0, 1, 2].map((i) => {
      const f = 1 + 0.25 * Math.sin(t * (9 + i * 2) + i * 2);
      return <path key={i} d={`M${-30 + i * 30},0 Q${-22 + i * 30},${-40 * f} ${-15 + i * 30 + Math.sin(t * 7 + i) * 8},${-80 * f} Q${-8 + i * 30},${-40 * f} ${i * 30},0 Z`} fill={i === 1 ? AMBER : RED} opacity={0.9} />;
    })}
    {[0, 1, 2, 3].map((i) => {
      const ph = ((t * 0.5 + rnd(i + 60)) % 1);
      return <path key={i} d={`M${-30 + i * 20},-70 q 10 -30 0 -60 t 0 -60`} stroke={WHITE} strokeWidth={3} fill="none" opacity={0.25 * (1 - ph)} transform={`translate(0, ${-ph * 120})`} />;
    })}
  </g>
));

// ---------- line 9: rewind. on "before" a small year counter (top centre) and the chip run back 1903 -> 1000 (four-digit years only),
// then ANTIQUITY, small; on "people" a figure looks up; on "watched the birds" a big flock crosses the frame with real wing beats
// (~3.5 Hz): the birds are the hero of the shot (review 1) ----------
function Scene9({t, at, fps, a, b}) {
  const before = at(9, 'before'), very = at(9, 'very'), people = at(9, 'people'), watched = at(9, 'watched');
  const k = ease(t, before, Math.max(0.8, very - before), Easing.in(Easing.cubic));
  const yr = Math.round(lerp(1903, 1000, k));
  const label = k >= 1 ? 'ANTIQUITY' : `${yr}`;
  const kMan = pop(t, people, fps, soft);
  const fly = lin(t, watched, 3.0);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={Math.min(1, kMan)}>
          <ellipse cx={360} cy={822} rx={90} ry={10} fill={WHITE} opacity={0.12} />
          <Man x={360} y={820} s={10} pose="stand" color={WHITE} />
        </g>
        {t >= watched ? Array.from({length: 15}, (_, i) => {
          const row = Math.ceil(i / 2), side = i % 2 ? -1 : 1;
          const x = lerp(-500, 2500, fly) - row * 120 + rnd(i + 5) * 30;
          const y = 460 + row * side * 62 + Math.sin(t * 1.4 + i) * 12;
          return <Bird key={i} x={x} y={y} s={3.4 - row * 0.12} ph={t * Math.PI * 2 * 3.5 + i * 0.6} rot={-4} />;
        }) : null}
      </svg>
      <div style={{position: 'absolute', left: 0, right: 0, top: 110, textAlign: 'center', fontFamily: BIG, fontSize: k >= 1 ? 48 : 88, lineHeight: 1, color: k > 0 && k < 1 ? AMBER : WHITE, letterSpacing: k >= 1 ? 8 : -1, textShadow: '0 8px 24px rgba(0,0,0,0.45)', opacity: 1 - 0.4 * ease(t, watched, 0.6)}}>{label}</div>
    </Scene>
  );
}
// ---------- line 10: Icarus. a myth panel (Greek-vase style: black figures on terracotta, a meander border, MYTH tag) on "stories";
// a real map of Greece with CRETE on "Crete"; Daedalus and Icarus pop on their names, flapping; on "flew" Icarus rises to the sun,
// wax drips on "close", feathers fall on "sun" ----------
function Scene10({t, at, fps, a, b}) {
  const stories = at(10, 'stories'), greeks = at(10, 'Greeks'), daed = at(10, 'Daedalus'), icar = at(10, 'Icarus'), crete = at(10, 'Crete'), flew = at(10, 'flew'), close = at(10, 'close'), sun = at(10, 'sun');
  const kPanel = pop(t, stories, fps, soft);
  const kMap = pop(t, greeks, fps, soft);
  const proj = fitBox(LL.GRC, MAP_L, 50);
  const cretePt = proj([24.9, 35.2]);
  const rise = ease(t, flew, 1.7, Easing.inOut(Easing.quad));
  const ix = lerp(1450, 1640, rise), iy = lerp(600, 330, rise);
  const flap = (ph) => 0.5 + 0.5 * Math.sin(ph);
  const box = [980, 120, 840, 720];
  const kD = pop(t, daed, fps, bouncy), kI = pop(t, icar, fps, bouncy);
  const dripK = ease(t, close, 0.3);
  const melt = ease(t, sun, 1.0);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      {HAVE.icarus ? <Photo src="av-icarus.jpg" id="s10" a={stories} b={b} t={t} box={box} fit="contain" radius={24} dim={0.25} zoom={[1.0, 1.06]} /> : null}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['GRC']} box={MAP_L} k={kMap} id="m10">
          <Pin t={t} fps={fps} a={crete} pt={cretePt} label="CRETE" ly={44} />
        </MapPanel>
        <g transform={`translate(${box[0] + box[2] / 2}, ${box[1] + box[3] / 2}) scale(${0.9 + 0.1 * Math.min(1, kPanel)}) translate(${-(box[0] + box[2] / 2)}, ${-(box[1] + box[3] / 2)})`} opacity={Math.min(1, kPanel)}>
          {HAVE.icarus ? null : (
            <g>
              <rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} rx={24} fill="#B5532A" />
              <rect x={box[0] + 18} y={box[1] + 18} width={box[2] - 36} height={box[3] - 36} rx={14} fill="none" stroke={INK} strokeWidth={10} strokeDasharray="26 12" opacity={0.85} />
              <g transform="translate(1700, 240)">
                <circle r={54} fill={AMBER} />
                {Array.from({length: 12}, (_, i) => <line key={i} x1={0} y1={-66} x2={0} y2={-86 - 6 * Math.sin(t * 3 + i)} stroke={AMBER} strokeWidth={5} strokeLinecap="round" transform={`rotate(${i * 30})`} />)}
              </g>
              <ellipse cx={1200} cy={790} rx={160} ry={14} fill={INK} opacity={0.5} />
            </g>
          )}
          <g opacity={Math.min(1, kD)} transform={`translate(1200, ${700 - 40 * ease(t, daed, 1.2)}) scale(${0.8 + 0.2 * Math.min(1, kD)})`}>
            <VaseFigure x={0} y={0} s={1.5} flap={t >= daed ? flap((t - daed) * 5) : 0} color={HAVE.icarus ? WHITE : INK} />
          </g>
          <g opacity={Math.min(1, kI)} transform={`translate(${ix}, ${iy}) scale(${(0.8 + 0.2 * Math.min(1, kI)) * (1 - 0.15 * melt)}) rotate(${-10 * melt})`}>
            <VaseFigure x={0} y={0} s={1.2} flap={t >= icar ? flap((t - icar) * 6) * (1 - melt) : 0} color={HAVE.icarus ? WHITE : INK} />
          </g>
          {dripK > 0 ? [0, 1, 2, 3, 4].map((i) => {
            const ph = ((t - close) * 0.9 + rnd(i + 80)) % 1;
            const sx = ix + (rnd(i + 81) - 0.5) * 150;
            return <ellipse key={i} cx={sx} cy={iy - 20 + ph * 180} rx={5} ry={9 + 6 * ph} fill={AMBER} opacity={dripK * (1 - ph) * 0.95} />;
          }) : null}
          {melt > 0 ? [0, 1, 2, 3, 4, 5, 6].map((i) => {
            const ph = ((t - sun) * 0.45 + rnd(i + 90)) % 1;
            const sx = ix + (rnd(i + 91) - 0.5) * 220 + Math.sin(t * 2 + i) * 30;
            return <path key={i} d="M0,0 q 6 -10 14 0 q -6 10 -14 0 Z" transform={`translate(${sx}, ${iy + ph * 420}) rotate(${Math.sin(t * 3 + i) * 50})`} fill={HAVE.icarus ? WHITE : INK} opacity={melt * (1 - ph)} />;
          }) : null}
          <SvgPill t={t} fps={fps} a={stories} x={box[0] + 110} y={box[1] + 58} w={130} size={22} bg={INK} fg={PAPER}>MYTH</SvgPill>
          <SvgPill t={t} fps={fps} a={daed} x={1200} y={760} w={190} size={20} bg={INK} fg={PAPER}>DAEDALUS</SvgPill>
          <SvgPill t={t} fps={fps} a={icar} x={ix} y={iy + 70} w={150} size={20} bg={INK} fg={PAPER}>ICARUS</SvgPill>
        </g>
      </svg>
    </Scene>
  );
}
// ---------- line 11: China. on "tried" the little figure flaps his arms; a real map (CHN) on "China"; a kite rises on its line from
// "kites", "2,000+ YEARS AGO" on "two thousand"; wind streams across on "ride the wind" ----------
function Scene11({t, at, fps, a, b}) {
  const tried = at(11, 'tried'), china = at(11, 'China'), kites = at(11, 'kites'), two = at(11, 'two'), ride = at(11, 'ride');
  const box = [560, 110, 1240, 740];
  const proj = fitBox(LL.CHN, box, 60);
  const ground = proj([117, 36]);
  const up = ease(t, kites, 2.2, Easing.out(Easing.quad));
  const kx = ground[0] + 140 * up + Math.sin(t * 1.3) * 18, ky = ground[1] - 330 * up + Math.sin(t * 2.1) * 10;
  const kMan = 1 - ease(t, china, 0.4);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={kMan}>
          <ellipse cx={360} cy={822} rx={90} ry={10} fill={WHITE} opacity={0.12} />
          <Man x={360} y={820 - (t >= tried ? Math.abs(Math.sin((t - tried) * 8)) * 24 : 0)} s={10} color={WHITE} pose={t >= tried ? 'arms' : 'stand'} flap={t >= tried ? Math.sin((t - tried) * 16) : 0} />
        </g>
        <MapPanel proj={proj} hi={['CHN']} box={box} k={pop(t, china, fps, soft)} id="m11">
          <Wind t={t} x0={box[0]} y0={box[1] + 60} x1={box[0] + box[2]} y1={box[1] + box[3] - 100} k={ease(t, ride, 0.5)} n={10} seed={3} />
          {t >= kites ? (
            <g>
              <path d={`M${ground[0]},${ground[1]} Q${lerp(ground[0], kx, 0.5) - 30 * up},${lerp(ground[1], ky, 0.55) + 40 * up} ${kx},${ky + 10}`} stroke={WHITE} strokeWidth={2} fill="none" opacity={0.8} />
              <Man x={ground[0]} y={ground[1] + 2} s={2.6} color={WHITE} pose="arms" flap={0.6} />
              <Kite x={kx} y={ky} s={1 + 0.3 * up} rot={-20 + Math.sin(t * 1.7) * 8} t={t} />
            </g>
          ) : null}
        </MapPanel>
        <SvgPill t={t} fps={fps} a={two} x={box[0] + box[2] / 2} y={box[1] + 50} w={330} size={22}>2,000+ YEARS AGO</SvgPill>
      </svg>
    </Scene>
  );
}
// ---------- lines 12-13: Córdoba. a real map of Iberia (ESP, PRT) with CÓRDOBA and "9TH CENTURY"; on the right a feathered figure on
// a tower (feathers on "covered", wings on "strapped"), jumps on "jumped", glides on a curve, lands hard on "landed" (dust, a shake);
// on "tail" a bird diagram with the missing tail flashing in red (birds steer with their tails); the story is tagged SAID TO ----------
function Scene12({t, at, fps, a, b}) {
  const ninth = at(12, 'ninth'), cord = at(12, 'Córdoba'), abbas = at(12, 'Abbas'), said = at(12, 'said'), covered = at(12, 'covered'), strapped = at(12, 'strapped'), jumped = at(12, 'jumped');
  const glided = at(13, 'glided'), landed = at(13, 'landed'), hard = at(13, 'hard'), tail = at(13, 'tail');
  const MB = [60, 140, 600, 600];
  const proj = fitBox(LL.IBERIA, MB, 50);
  const cordPt = proj([-4.78, 37.88]);
  const kMap = pop(t, a, fps, soft);
  const kMan = pop(t, a + 0.3, fps, soft);
  const wings = ease(t, covered, 1.2) * 0.5 + ease(t, strapped, 0.6) * 0.5;
  const p = ease(t, jumped, Math.max(1, landed - jumped), Easing.inOut(Easing.quad));
  const P0 = [800, 440], C = [1300, 300], P1 = [1760, 816];
  const q = qb(P0, C, P1, p);
  const down = t >= hard ? 1 : 0;
  const shake = t >= landed && t < landed + 0.4 ? Math.sin((t - landed) * 60) * 8 * (1 - (t - landed) / 0.4) : 0;
  const puff = lin(t, landed, 0.8);
  const kBird = pop(t, tail, fps, soft);
  const blink = 0.5 + 0.5 * Math.sin((t - tail) * 14);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['ESP', 'PRT']} box={MB} k={kMap} id="m12">
          <Pin t={t} fps={fps} a={cord} pt={cordPt} label="CÓRDOBA" ly={-28} />
        </MapPanel>
        <SvgPill t={t} fps={fps} a={ninth} x={360} y={190} w={240} size={22}>9TH CENTURY</SvgPill>
        <g transform={`translate(0, ${shake})`}>
          <line x1={700} y1={820} x2={1880} y2={820} stroke={WHITE} strokeWidth={3} opacity={0.35} />
          <Tower x={800} y={820} w={100} h={380} o={Math.min(1, kMan)} />
          {p > 0 ? dotted(P0, C, P1, p, 44, AMBER, 4) : null}
          <Puff x={1760} y={816} k={puff} />
          <g transform={`translate(${t >= jumped ? q.x : P0[0]}, ${t >= jumped ? q.y : P0[1]}) rotate(${t >= jumped ? q.ang * 0.6 : 0})`} opacity={Math.min(1, kMan)}>
            {down ? <Man x={0} y={4} s={8} pose="lie" /> : <Man x={0} y={0} s={8} pose={t >= covered ? 'arms' : 'stand'} wings={wings} flap={t >= glided && p < 1 ? 0.3 + 0.3 * Math.sin((t - glided) * 2) : t >= covered ? Math.sin((t - covered) * 5) * 0.5 : 0} />}
          </g>
          {t >= covered && t < jumped ? [0, 1, 2, 3, 4, 5].map((i) => {
            const ph = ((t - covered) * 0.6 + rnd(i + 120)) % 1;
            return <path key={i} d="M0,0 q 7 -11 15 0 q -7 11 -15 0 Z" transform={`translate(${740 + rnd(i + 121) * 120}, ${330 + ph * 160}) rotate(${Math.sin(t * 3 + i) * 40})`} fill={WHITE} opacity={0.8 * (1 - ph)} />;
          }) : null}
        </g>
        <g transform={`translate(1250, 250) scale(${Math.min(1, kBird)})`} opacity={Math.min(1, kBird)}>
          <rect x={-280} y={-150} width={560} height={300} rx={24} fill={NAVY} stroke={WHITE} strokeWidth={2} strokeOpacity={0.3} />
          <Bird x={0} y={-30} s={8} ph={(t - tail) * 6} color={WHITE} />
          <path d="M-36,10 L0,90 L36,10 Z" fill="none" stroke={RED} strokeWidth={5} strokeDasharray="10 10" opacity={0.3 + 0.7 * blink} />
          <Lbl x={0} y={128} size={24} color={RED} o={0.4 + 0.6 * blink}>NO TAIL</Lbl>
        </g>
      </svg>
      <Tag t={t} a={abbas} fps={fps} x={1700} y={150} until={tail - 0.1}>Abbas ibn Firnas</Tag>
      <Tag t={t} a={said} fps={fps} x={1700} y={215} bg={WHITE} until={tail - 0.1}>Said to</Tag>
    </Scene>
  );
}
// ---------- line 14: Eilmer. a real map of England (GBR) with MALMESBURY and "c. 1010"; an abbey tower, the monk with wings jumps on
// "jumped", a long glide path across the right half, a ruler "~200 M" on "two hundred", the crash on "crashed" ----------
function Scene14({t, at, fps, a, b}) {
  const y1010 = at(14, '1010'), eilmer = at(14, 'Eilmer'), malm = at(14, 'Malmesbury'), tried = at(14, 'tried'), jumped = at(14, 'jumped'), two = at(14, 'two'), crashed = at(14, 'crashed'), broke = at(14, 'broke');
  const MB = [60, 140, 560, 600];
  const proj = fitBox(LL.ENG, MB, 50);
  const malmPt = proj([-2.098, 51.584]);
  const kMap = pop(t, a, fps, soft);
  const P0 = [760, 280], C = [1250, 240], P1 = [1800, 816];
  const p = ease(t, jumped, Math.max(1, crashed - jumped), Easing.inOut(Easing.quad));
  const q = qb(P0, C, P1, p);
  const puff = lin(t, crashed, 0.8);
  const kRule = pop(t, two, fps, soft);
  const wings = ease(t, tried, 0.6);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['GBR']} box={MB} k={kMap} id="m14">
          <Pin t={t} fps={fps} a={malm} pt={malmPt} label="MALMESBURY" ly={-28} />
        </MapPanel>
        <SvgPill t={t} fps={fps} a={y1010} x={340} y={190} w={170} size={22}>c. 1010</SvgPill>
        <line x1={660} y1={820} x2={1880} y2={820} stroke={WHITE} strokeWidth={3} opacity={0.35} />
        <Tower x={760} y={820} w={110} h={540} church o={Math.min(1, kMap)} />
        {p > 0 ? dotted(P0, C, P1, p, 50, AMBER, 4) : null}
        <Puff x={1800} y={816} k={puff} />
        <g transform={`translate(${t >= jumped ? q.x : P0[0]}, ${t >= jumped ? q.y : P0[1]}) rotate(${t >= jumped && p < 1 ? q.ang * 0.5 : 0})`} opacity={Math.min(1, kMap)}>
          {t >= broke ? <Man x={0} y={4} s={8} pose="lie" /> : <Man x={0} y={0} s={8} pose={t >= tried ? 'arms' : 'stand'} wings={wings} flap={t >= jumped && p < 1 ? 0.3 + 0.3 * Math.sin((t - jumped) * 2.5) : 0} />}
        </g>
        <g opacity={Math.min(1, kRule)}>
          <line x1={760} y1={856} x2={760 + 1040 * Math.min(1, kRule)} y2={856} stroke={AMBER} strokeWidth={3} />
          <line x1={760} y1={844} x2={760} y2={868} stroke={AMBER} strokeWidth={3} />
          <line x1={1800} y1={844} x2={1800} y2={868} stroke={AMBER} strokeWidth={3} opacity={kRule >= 0.98 ? 1 : 0} />
          <SvgPill t={t} fps={fps} a={two} x={1280} y={856} w={260} size={22}>~200 M · 1 FURLONG</SvgPill>
        </g>
      </svg>
      <Tag t={t} a={eilmer} fps={fps} x={1500} y={150}>Eilmer of Malmesbury</Tag>
    </Scene>
  );
}
// ---------- line 15: tower jumpers. a row of towers, a figure leaps from each (staggered from "tower") and falls out of the frame (no
// gore); on "Wings" a winged man flaps, a red cross on "not"; a strength bar: HUMAN ARMS vs NEEDED TO FLAP, a clear gap, on
// "muscles" / "weak"; a weight on "weight" ----------
function Scene15({t, at, fps, a, b}) {
  const tower = at(15, 'tower'), wingsW = at(15, 'Wings'), not = at(15, 'not'), muscles = at(15, 'muscles'), weak = at(15, 'weak'), weight = at(15, 'weight');
  const towers = [[200, 300], [430, 420], [660, 340], [890, 460]];
  const kChart = pop(t, wingsW, fps, soft);
  const b1 = ease(t, muscles, 0.6), b2 = ease(t, weak, 1.0, Easing.out(Easing.quad));
  const kW = pop(t, weight, fps, bouncy);
  const kX = ease(t, not, 0.4);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <line x1={60} y1={820} x2={1040} y2={820} stroke={WHITE} strokeWidth={3} opacity={0.35} />
        {towers.map(([x, h], i) => {
          const j = tower + i * 0.45;
          const f = t >= j ? t - j : 0;
          const fx = x + 40 + 160 * f, fy = 820 - h - 12 + 420 * f * f - 60 * f;
          return (
            <g key={i}>
              <Tower x={x} y={820} w={84} h={h} o={0.9} />
              {fy < 1150 ? <Man x={fx} y={fy} s={7} pose={f > 0 ? 'arms' : 'stand'} wings={0.8} flap={Math.sin(f * 14) * 0.6} rot={Math.min(80, f * 60)} /> : null}
            </g>
          );
        })}
        <g transform={`translate(1080, 240) scale(${Math.min(1, kChart)})`} opacity={Math.min(1, kChart)}>
          <g transform="translate(90, 20)">
            <Man x={0} y={0} s={11} pose="arms" wings={1} flap={Math.sin((t - wingsW) * 10) * 0.6} />
            <Cross x={0} y={-95} k={kX} r={100} />
          </g>
          <Lbl x={0} y={210} anchor="start" size={22} o={0.9}>HUMAN ARM MUSCLE</Lbl>
          <rect x={0} y={226} width={720} height={44} rx={22} fill={WHITE} opacity={0.12} />
          <rect x={0} y={226} width={80 * b1} height={44} rx={22} fill={WHITE} />
          <Lbl x={0} y={346} anchor="start" size={22} color={AMBER} o={0.9}>NEEDED TO FLAP</Lbl>
          <rect x={0} y={362} width={720} height={44} rx={22} fill={WHITE} opacity={0.12} />
          <rect x={0} y={362} width={720 * b2} height={44} rx={22} fill={AMBER} />
          {b2 >= 1 && b1 >= 1 ? (
            <g opacity={0.9}>
              <line x1={90} y1={316} x2={710} y2={316} stroke={RED} strokeWidth={3} strokeDasharray="8 8" />
              <Lbl x={400} y={308} size={20} color={RED}>GAP</Lbl>
            </g>
          ) : null}
          <g transform={`translate(620, 80) scale(${1.3 * kW})`} opacity={Math.min(1, kW)}>
            <path d="M-50,40 L50,40 L36,-30 L-36,-30 Z" fill={WHITE} />
            <rect x={-14} y={-46} width={28} height={16} rx={6} fill="none" stroke={WHITE} strokeWidth={6} />
            <Lbl x={0} y={14} size={18} color={NAVY}>WEIGHT</Lbl>
          </g>
        </g>
      </svg>
    </Scene>
  );
}
// ---------- line 16: Leonardo. the open codex (av-leonardo-codex2) full frame; on "notebook" a page (av-leonardo-codex) contained on
// the left; "c. 1505" on the year; on "sketches" a bird's wing drawn over in thin amber lines, flapping gently on "wings" ----------
function Scene16({t, at, fps, a, b}) {
  const leo = at(16, 'Leonardo'), y1505 = at(16, '1505'), notebook = at(16, 'notebook'), sketches = at(16, 'sketches'), wingsW = at(16, 'wings');
  const draw = ease(t, sketches, 1.6, Easing.inOut(Easing.quad));
  const flap = t >= wingsW ? Math.sin((t - wingsW) * 2.5) * 8 : 0;
  const kPage = ease(t, notebook, 0.6);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <Photo src="av-leonardo-codex2.jpg" id="s16a" a={a} b={notebook + 0.3} t={t} zoom={[1.0, 1.1]} dim={0.1} />
      <Photo src="av-leonardo-codex.jpg" id="s16b" a={notebook} b={b} t={t} box={[120, 50, 940, 800]} fit="contain" radius={20} zoom={[1.0, 1.08]} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(1480, 460) rotate(${-flap}, -200, 60)`} opacity={kPage}>
          <path d="M-220,60 C-160,-60 20,-120 220,-80 C120,-60 60,-10 40,40 C-20,60 -120,90 -220,60 Z" stroke={AMBER} strokeWidth={2.5} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const u = i / 7, k = clamp01(draw * 1.6 - u * 0.6);
            const x0 = lerp(-180, 30, u), y0 = lerp(30, 20, u) - 30 * Math.sin(u * 3);
            return <path key={i} d={`M${x0},${y0} C${x0 + 30},${y0 + 30} ${x0 + 70},${y0 + 70} ${x0 + 110 - 60 * u},${y0 + 130 - 40 * u}`} stroke={AMBER} strokeWidth={1.5} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - k} opacity={0.85} />;
          })}
          <path d="M-220,60 C-180,20 -100,0 0,-20" stroke={AMBER} strokeWidth={1.2} fill="none" strokeDasharray="4 6" opacity={0.7 * draw} />
        </g>
        <SvgPill t={t} fps={fps} a={y1505} x={1480} y={160} w={160} size={22}>c. 1505</SvgPill>
        <SvgPill t={t} fps={fps} a={sketches} x={1480} y={700} w={330} size={20} bg="rgba(11,27,51,0.75)" fg={WHITE} o={kPage}>CODEX ON THE FLIGHT OF BIRDS</SvgPill>
      </svg>
      <Tag t={t} a={leo} fps={fps} x={960} y={820}>Leonardo da Vinci</Tag>
    </Scene>
  );
}
// ---------- line 17: the machines. the ornithopter drawn after his sketch (or the picture, if present): a pilot prone in a wooden
// frame, two huge bat-like wings that flap on "flap" with arm and leg lines; the aerial screw picture on "aerial" with a thin spiral
// overlay spinning on "spinning"; "NEVER FLEW" on "none"; everything dims on "hidden" ----------
function Scene17({t, at, fps, a, b}) {
  const orni = at(17, 'ornithopter'), flapW = at(17, 'flap'), arms = at(17, 'arms'), legs = at(17, 'legs'), aerial = at(17, 'aerial'), spinning = at(17, 'spinning'), none = at(17, 'none'), hidden = at(17, 'hidden');
  const kO = pop(t, orni, fps, soft);
  const fl = t >= flapW ? Math.sin((t - flapW) * 2 * Math.PI * 0.7) : 0;
  const kS = pop(t, spinning, fps, soft);
  const dark = ease(t, hidden, 1.2, Easing.inOut(Easing.quad));
  const boxL = [100, 100, 860, 740], boxR = [1000, 100, 820, 740];
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      {HAVE.ornithopter ? <Photo src="av-leonardo-ornithopter.jpg" id="s17a" a={orni} b={b} t={t} box={boxL} fit="contain" radius={20} zoom={[1.0, 1.08]} /> : null}
      <Photo src="av-leonardo-screw.jpg" id="s17b" a={aerial} b={b} t={t} box={boxR} fit="contain" radius={20} zoom={[1.0, 1.08]} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {HAVE.ornithopter ? null : (
          <g transform={`translate(530, 470) scale(${0.85 + 0.15 * Math.min(1, kO)})`} opacity={Math.min(1, kO)}>
            <rect x={-430} y={-370} width={860} height={740} rx={20} fill={PAPER} opacity={0.08} />
            {[-1, 1].map((sg) => (
              <g key={sg} transform={`rotate(${sg * -18 * fl}, ${sg * 40}, 0)`}>
                <path d={`M${sg * 40},0 C${sg * 120},-60 ${sg * 260},-90 ${sg * 380},-60 C${sg * 330},-30 ${sg * 300},10 ${sg * 290},40 C${sg * 240},30 ${sg * 200},50 ${sg * 180},80 C${sg * 140},60 ${sg * 100},60 ${sg * 60},70 Z`} fill="#8A6A3A" opacity={0.35} stroke="#C9A24A" strokeWidth={2.5} />
                {[0.25, 0.5, 0.75].map((u) => <line key={u} x1={sg * 40} y1={0} x2={sg * lerp(60, 380, u)} y2={lerp(70, -60, u)} stroke="#C9A24A" strokeWidth={2} opacity={0.8} />)}
                {t >= arms ? <line x1={sg * 30} y1={-10} x2={sg * 120} y2={-30} stroke={AMBER} strokeWidth={3} strokeDasharray="6 6" opacity={0.9} /> : null}
                {t >= legs ? <line x1={sg * 20} y1={70} x2={sg * 90} y2={40} stroke={AMBER} strokeWidth={3} strokeDasharray="6 6" opacity={0.9} /> : null}
              </g>
            ))}
            <rect x={-70} y={-16} width={140} height={32} rx={8} fill="none" stroke="#C9A24A" strokeWidth={3} />
            <line x1={-70} y1={0} x2={-110} y2={-60} stroke="#C9A24A" strokeWidth={3} />
            <line x1={70} y1={0} x2={110} y2={-60} stroke="#C9A24A" strokeWidth={3} />
            <line x1={-110} y1={-60} x2={110} y2={-60} stroke="#C9A24A" strokeWidth={3} />
            <Man x={0} y={10} s={8} pose="lie" />
            <Lbl x={0} y={250} size={20} color={AMBER} o={0.9}>ORNITHOPTER · AFTER HIS SKETCH</Lbl>
          </g>
        )}
        <g transform={`translate(1410, 440) scale(${Math.min(1, kS)})`} opacity={Math.min(1, kS) * 0.9}>
          {Array.from({length: 60}, (_, i) => {
            const u = i / 59, ang = u * Math.PI * 6 + (t - spinning) * 4;
            const x = Math.cos(ang) * 150, y = -200 + u * 300 + Math.sin(ang) * 30;
            return <circle key={i} cx={x} cy={y} r={3 + 2 * Math.sin(ang)} fill={AMBER} opacity={0.4 + 0.5 * (0.5 + 0.5 * Math.sin(ang))} />;
          })}
          <line x1={0} y1={-230} x2={0} y2={130} stroke={AMBER} strokeWidth={3} opacity={0.6} />
        </g>
      </svg>
      <Tag t={t} a={none} fps={fps} x={960} y={820} bg={RED} fg={WHITE}>Never flew</Tag>
      <AbsoluteFill style={{background: NAVY, opacity: 0.85 * dark, pointerEvents: 'none'}} />
    </Scene>
  );
}
// ---------- line 18: Annonay. "don't flap, float": a flapping man crossed out, a balloon icon rises; a real map of France (FRA) with
// ANNONAY and JUNE 1783; on the right a hot-air balloon fills over a fire (real shape, ~23 m tall) and rises on "filled with hot air" ----------
function Scene18({t, at, fps, a, b}) {
  const dont = at(18, "don't"), flapW = at(18, 'flap'), floatW = at(18, 'float'), june = at(18, 'June'), annonay = at(18, 'Annonay'), joseph = at(18, 'Joseph'), sent = at(18, 'sent'), huge = at(18, 'huge'), filled = at(18, 'filled');
  const kIdea = pop(t, dont, fps, soft) * (1 - ease(t, june, 0.4));
  const kFloat = pop(t, floatW, fps, soft);
  const MB = [60, 140, 600, 600];
  const proj = fitBox(LL.FRA, MB, 50);
  const annPt = proj([4.67, 45.24]);
  const kMap = pop(t, june, fps, soft);
  const fill = ease(t, huge, 1.8, Easing.out(Easing.quad));
  const rise = ease(t, filled, 2.6, Easing.inOut(Easing.quad));
  const by = 780 - 170 * rise;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={Math.min(1, kIdea)}>
          <g transform="translate(760, 640)">
            <Man x={0} y={0} s={12} pose="arms" wings={1} flap={Math.sin((t - dont) * 9) * 0.6} />
            <Cross x={0} y={-100} k={ease(t, flapW, 0.35)} r={110} />
          </g>
          <g transform={`translate(1300, ${700 - 120 * ease(t, floatW, 1.4, Easing.out(Easing.quad))}) scale(${Math.min(1, kFloat)})`} opacity={Math.min(1, kFloat)}>
            <Balloon x={0} y={0} s={1.2} basket="gallery" />
            <Tick x={150} y={-120} k={kFloat} r={44} />
          </g>
        </g>
        <MapPanel proj={proj} hi={['FRA']} box={MB} k={kMap} id="m18">
          <Pin t={t} fps={fps} a={annonay} pt={annPt} label="ANNONAY" lx={22} ly={10} anchor="start" />
        </MapPanel>
        <SvgPill t={t} fps={fps} a={june} x={360} y={190} w={200} size={22}>JUNE 1783</SvgPill>
        <g opacity={Math.min(1, kMap)}>
          <line x1={700} y1={820} x2={1880} y2={820} stroke={WHITE} strokeWidth={3} opacity={0.35} />
          <Fire t={t} x={1350} y={810} k={ease(t, sent, 0.5)} s={1.6} />
          {t >= huge ? (
            <g>
              {[-40, 0, 40].map((dx, i) => <path key={dx} d={`M${1350 + dx},${by + 10} q 10 -40 0 -80 t 0 -80`} stroke={AMBER} strokeWidth={3} fill="none" opacity={0.35 * fill * (1 - rise)} transform={`translate(0, ${-((t * 60 + i * 40) % 120)})`} />)}
              <Balloon x={1350} y={by} s={2.6} fill={fill} color="#C9A24A" trim="#7A5A20" />
              {[-1, 1].map((sg) => <line key={sg} x1={1350 + sg * 40} y1={by} x2={1350 + sg * 110} y2={lerp(810, by + 80, rise * 0.3)} stroke={WHITE} strokeWidth={2} opacity={0.5 * (1 - rise)} />)}
            </g>
          ) : null}
          <Man x={1130} y={820} s={8} color={WHITE} pose="stand" />
          <Man x={1580} y={820} s={8} color={WHITE} pose="arms" flap={0.5} />
        </g>
      </svg>
      <Tag t={t} a={joseph} fps={fps} x={1400} y={60}>Joseph · Étienne Montgolfier</Tag>
    </Scene>
  );
}
// ---------- line 19: Versailles. SEPT 1783, VERSAILLES on the map; the balloon with a wicker cage rises on "sent up", a close-up
// of the cage shows the sheep, the duck and the rooster popping on their words; the balloon comes down on "down", three ticks on "alive" ----------
function Scene19({t, at, fps, a, b}) {
  const sept = at(19, 'September'), vers = at(19, 'Versailles'), louis = at(19, 'Louis'), sent = at(19, 'sent'), sheep = at(19, 'sheep'), duck = at(19, 'duck'), rooster = at(19, 'rooster'), down = at(19, 'down'), alive = at(19, 'alive');
  const proj = fitBox(LL.FRA, MAP_L, 60);
  const annPt = proj([4.67, 45.24]), versPt = proj([2.12, 48.80]);
  const up = ease(t, sent, 3.0, Easing.inOut(Easing.quad)) - ease(t, down, 1.2, Easing.inOut(Easing.quad));
  const by = 700 - 150 * up;
  const kIn = pop(t, sheep - 0.3, fps, soft);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      {HAVE.montgolfier ? <Photo src="av-montgolfier-1783.jpg" id="s19" a={a} b={b} t={t} box={[940, 60, 920, 800]} fit="contain" radius={20} dim={0.45} zoom={[1.0, 1.06]} /> : null}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['FRA']} box={MAP_L} k={1} id="m19">
          <Pin t={t} fps={fps} a={a - 1} pt={annPt} label="ANNONAY" lx={22} ly={10} anchor="start" o={0.6} r={8} size={18} />
          <Pin t={t} fps={fps} a={vers} pt={versPt} label="VERSAILLES" ly={-28} />
        </MapPanel>
        <SvgPill t={t} fps={fps} a={sept} x={MAP_L[0] + MAP_L[2] / 2} y={MAP_L[1] + 50} w={200} size={22}>SEPT 1783</SvgPill>
        <line x1={960} y1={800} x2={1340} y2={800} stroke={WHITE} strokeWidth={3} opacity={0.35} />
        <Balloon x={1150} y={by} s={1.4} basket="cage" />
        {[0, 1, 2, 3, 4].map((i) => <Man key={i} x={980 + i * 80} y={800} s={6} color={WHITE} pose={i === 2 ? 'arms' : 'stand'} flap={0.4} />)}
        <g transform={`translate(1620, 560) scale(${Math.min(1, kIn)})`} opacity={Math.min(1, kIn)}>
          <line x1={-190} y1={-40} x2={-440} y2={by + 50 - 560} stroke={AMBER} strokeWidth={2} strokeDasharray="6 8" opacity={0.7} />
          <circle r={190} fill={NAVY2} stroke={AMBER} strokeWidth={4} />
          <path d="M-150,40 L150,40 L150,120 L-150,120 Z" fill="#8A6A2A" opacity={0.9} />
          {[-120, -80, -40, 0, 40, 80, 120].map((sx) => <line key={sx} x1={sx} y1={40} x2={sx} y2={120} stroke="#5A3A1E" strokeWidth={3} />)}
          <Sheep x={-80} y={16} s={1.5} k={pop(t, sheep, fps, bouncy)} />
          <Duck x={10} y={22} s={1.4} k={pop(t, duck, fps, bouncy)} />
          <Rooster x={100} y={14} s={1.4} k={pop(t, rooster, fps, bouncy)} />
          <Tick x={-80} y={-70} k={pop(t, alive, fps, bouncy)} r={26} />
          <Tick x={10} y={-70} k={pop(t, alive + 0.15, fps, bouncy)} r={26} />
          <Tick x={100} y={-70} k={pop(t, alive + 0.3, fps, bouncy)} r={26} />
        </g>
      </svg>
      <Tag t={t} a={louis} fps={fps} x={1410} y={150}>Louis XVI</Tag>
    </Scene>
  );
}
// ---------- line 20a: 21 NOV 1783. the fan print of the flight from La Muette (av-rozier-1783), the two names on their words ----------
function Scene20a({t, at, fps, a, b}) {
  const twenty = at(20, 'twenty'), pil = at(20, 'Pilâtre'), marq = at(20, 'Marquis');
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <Photo src="av-rozier-1783.jpg" id="s20a" a={a} b={b} t={t} box={[460, 40, 1000, 840]} fit="contain" radius={20} zoom={[1.0, 1.08]} />
      <Tag t={t} a={twenty} fps={fps} x={960} y={62}>21 Nov 1783</Tag>
      <Tag t={t} a={pil} fps={fps} x={240} y={440}>Pilâtre de Rozier</Tag>
      <Tag t={t} a={marq} fps={fps} x={1680} y={440} bg={WHITE}>Marquis d'Arlandes</Tag>
    </Scene>
  );
}
// ---------- line 20b: over Paris. the map zooms from France into Paris; a dotted ~9 KM path from La Muette to the Butte-aux-Cailles
// draws under a small balloon on "stayed up ... nine kilometres"; a ~25 MIN timer counts on "twenty five"; FIRST PEOPLE TO FLY on "first" ----------
function Scene20b({t, at, fps, a, b}) {
  const paris = at(20, 'Paris'), stayed = at(20, 'stayed'), twenty5 = at(20, 'twenty', 1), nine = at(20, 'nine'), first2 = at(20, 'first', 1);
  const zk = ease(t, paris, 1.6, Easing.inOut(Easing.cubic));
  const proj = zoomBox(LL.FRA, LL.PARIS, MAP_W, zk, 60);
  const parisPt = proj([2.35, 48.86]);
  const A = proj([2.270, 48.862]), B = proj([2.351, 48.828]);
  const C = [(A[0] + B[0]) / 2 + 40, (A[1] + B[1]) / 2 - 60];
  const p = ease(t, stayed, Math.max(1, nine + 0.8 - stayed), Easing.inOut(Easing.quad));
  const q = qb(A, C, B, p);
  const mins = 25 * ease(t, twenty5, 1.2, Easing.out(Easing.quad));
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['FRA']} box={MAP_W} k={1} id="m20" rivers={zk >= 0.9 ? 6 : zk > 0.5 ? 2 : 0}>
          {zk < 0.9 ? <Pin t={t} fps={fps} a={a - 1} pt={parisPt} label="PARIS" ly={-28} o={1 - zk} /> : null}
          {zk >= 0.9 ? (
            <g opacity={(zk - 0.9) * 10}>
              <circle cx={parisPt[0]} cy={parisPt[1]} r={150} fill="none" stroke={WHITE} strokeWidth={2} strokeDasharray="6 10" opacity={0.3} />
              <Lbl x={parisPt[0]} y={parisPt[1] - 172} size={26} o={0.9}>PARIS</Lbl>
              {RIVERS ? <Lbl x={proj([2.47, 48.81])[0]} y={proj([2.47, 48.81])[1]} anchor="start" size={20} color={SKY} o={0.9}>SEINE</Lbl> : null}
              {p > 0 ? dotted(A, C, B, p, 40, AMBER, 4) : null}
              <Pin t={t} fps={fps} a={stayed} pt={A} label="LA MUETTE" ly={-26} r={9} size={18} />
              <Pin t={t} fps={fps} a={nine} pt={B} label="BUTTE-AUX-CAILLES" ly={40} r={9} size={18} />
              {t >= stayed ? <Balloon x={q.x} y={q.y - 30} s={0.4} basket="gallery" /> : null}
              <SvgPill t={t} fps={fps} a={nine} x={C[0]} y={C[1] - 60} w={140} size={22}>~9 KM</SvgPill>
            </g>
          ) : null}
        </MapPanel>
      </svg>
      <Num t={t} a={twenty5} fps={fps} x={1700} y={200} size={72} color={AMBER} align="right">{Math.round(mins)} MIN</Num>
      <Tag t={t} a={first2} fps={fps} x={1540} y={800}>First people to fly</Tag>
    </Scene>
  );
}

// ---------- line 21: hydrogen. Charles and Robert's balloon over the Tuileries (av-charles-1783), 1 DEC 1783, the name, H2 on
// "hydrogen"; the old collector cards (av-early-flight) on "Balloons spread across Europe"; on "wherever the wind" a drawn balloon is
// pushed off course by streaming wind ----------
function Scene21({t, at, fps, a, b}) {
  const ten = at(21, 'ten'), jacques = at(21, 'Jacques'), hydrogen = at(21, 'hydrogen'), balloons = at(21, 'Balloons'), wherever = at(21, 'wherever'), wind = at(21, 'wind');
  const kB = pop(t, wherever, fps, soft);
  const drift = ease(t, wherever, 2.0, Easing.inOut(Easing.quad));
  const bx = lerp(1250, 1700, drift) + Math.sin(t * 1.5) * 10, by = lerp(560, 420, drift);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <Photo src="av-charles-1783.jpg" id="s21a" a={a} b={balloons + 0.3} t={t} box={[460, 40, 1000, 840]} fit="contain" radius={20} zoom={[1.0, 1.08]} />
      <Photo src="av-early-flight.jpg" id="s21b" a={balloons} b={b} t={t} zoom={[1.0, 1.12]} dim={0.2} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <Wind t={t} x0={900} y0={300} x1={1920} y1={700} k={ease(t, wind, 0.5)} n={12} seed={7} />
        <g transform={`translate(${bx}, ${by}) rotate(${14 * drift + Math.sin(t * 2) * 3}) scale(${Math.min(1, kB)})`} opacity={Math.min(1, kB)}>
          <Balloon x={0} y={0} s={0.9} basket="cage" color="#C84B3A" trim={AMBER} />
        </g>
        {t >= wherever ? dotted([1250, 560], [1450, 540], [bx, by], 1, 24, WHITE, 3) : null}
      </svg>
      <Tag t={t} a={ten} fps={fps} x={960} y={62} until={balloons}>1 Dec 1783</Tag>
      <Tag t={t} a={jacques} fps={fps} x={240} y={440} until={balloons}>Jacques Charles</Tag>
      <Tag t={t} a={hydrogen} fps={fps} x={1680} y={440} bg={SKY} until={balloons}>H2 · Hydrogen</Tag>
    </Scene>
  );
}
// ---------- line 22: Cayley's disc. on "wings" a glider pops; 1799; the portrait (av-cayley-portrait) on "English"; the silver disc
// drawn as a coin with his layout engraved on "engraved": WING on "wing", TAIL on "tail", PADDLES on "push"; on "That" a modern
// airliner from above (real proportions) lights up the same three parts ----------
function Scene22({t, at, fps, a, b}) {
  const wingsW = at(22, 'wings'), y1799 = at(22, '1799'), english = at(22, 'English'), george = at(22, 'George'), engraved = at(22, 'engraved');
  const wing = at(22, 'wing', 1), tail = at(22, 'tail'), push = at(22, 'push'), that = at(22, 'That'), basic = at(22, 'basic'), layout = at(22, 'layout'), airplane = at(22, 'airplane');
  const kG = pop(t, wingsW, fps, bouncy) * (1 - ease(t, y1799, 0.4));
  const kCoin = pop(t, engraved, fps, soft);
  const draw = ease(t, engraved, 1.5, Easing.inOut(Easing.quad));
  const swap = ease(t, that, 0.6, Easing.inOut(Easing.quad));
  const kJet = pop(t, that, fps, soft);
  const hiW = ease(t, basic, 0.3), hiT = ease(t, layout, 0.3), hiE = ease(t, airplane, 0.3);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <Photo src="av-cayley-portrait.jpg" id="s22" a={english} b={b} t={t} box={[100, 60, 760, 800]} fit="contain" radius={20} zoom={[1.0, 1.08]} o={1 - swap} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <defs>
          <radialGradient id="coin" cx="40%" cy="35%" r="70%"><stop offset="0%" stopColor="#F4F6FA" /><stop offset="60%" stopColor="#C3CAD6" /><stop offset="100%" stopColor="#8F99A8" /></radialGradient>
        </defs>
        {kG > 0 ? <CayleyGlider x={960 + 60 * ease(t, wingsW, 1.0)} y={480 + Math.sin(t * 2) * 6} s={4} o={Math.min(1, kG)} /> : null}
        <g transform={`translate(1380, 470) scale(${Math.min(1, kCoin) * (1 - swap)})`} opacity={Math.min(1, kCoin) * (1 - swap)}>
          <circle r={240} fill="url(#coin)" stroke="#6F7A8C" strokeWidth={6} />
          <circle r={222} fill="none" stroke="#7F8A9C" strokeWidth={2} strokeDasharray="4 6" opacity={0.7} />
          <g stroke={INK} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M-150,-30 Q-20,-70 130,-40" strokeWidth={6} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01(draw * 2)} />
            <path d="M-150,-30 Q-20,-62 130,-40" strokeWidth={2} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01(draw * 2)} opacity={0.6} />
            <path d="M-20,-52 L-20,30 M-60,30 Q-20,60 40,30 L40,0" strokeWidth={5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01(draw * 2 - 0.5)} />
            <path d="M-20,20 L-130,30 M-150,8 L-110,52 M-150,52 L-110,8" strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01(draw * 2 - 0.8)} />
            <path d="M60,40 L130,80 M60,40 L130,0 M110,70 Q140,80 150,100 M110,10 Q140,0 150,-20" strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp01(draw * 2 - 1)} />
          </g>
          <path d="M-150,-30 Q-20,-70 130,-40" stroke={AMBER} strokeWidth={10} fill="none" strokeLinecap="round" opacity={0.8 * ease(t, wing, 0.3)} />
          <path d="M-20,20 L-130,30 M-150,8 L-110,52 M-150,52 L-110,8" stroke={AMBER} strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.8 * ease(t, tail, 0.3)} />
          <path d="M60,40 L130,80 M60,40 L130,0" stroke={AMBER} strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.8 * ease(t, push, 0.3)} />
          <Lbl x={0} y={-130} size={22} color={INK} o={ease(t, wing, 0.3)}>WING · LIFT</Lbl>
          <Lbl x={-150} y={100} size={22} color={INK} o={ease(t, tail, 0.3)}>TAIL · STEER</Lbl>
          <Lbl x={120} y={150} size={22} color={INK} o={ease(t, push, 0.3)}>PADDLES · PUSH</Lbl>
          <Lbl x={0} y={210} size={18} color={INK} o={0.7 * draw}>1799</Lbl>
        </g>
        <g transform={`translate(960, 470) scale(${Math.min(1, kJet)}) rotate(-90)`} opacity={Math.min(1, kJet)}>
          <AirlinerTop x={0} y={0} s={1.5} hiWing={hiW} hiTail={hiT} hiEng={hiE} />
        </g>
        <g opacity={Math.min(1, kJet)}>
          <Lbl x={1330} y={520} anchor="start" size={24} color={AMBER} o={hiW}>WING · LIFT</Lbl>
          <Lbl x={960} y={790} size={24} color={AMBER} o={hiT}>TAIL · STEER</Lbl>
          <Lbl x={590} y={360} anchor="end" size={24} color={AMBER} o={hiE}>ENGINES · PUSH</Lbl>
          <Lbl x={960} y={130} size={18} o={0.6 * kJet}>37.6 M LONG · 35.8 M SPAN</Lbl>
        </g>
      </svg>
      <Tag t={t} a={george} fps={fps} x={480} y={835} until={that}>George Cayley</Tag>
      <Tag t={t} a={y1799} fps={fps} x={480} y={62} until={engraved}>1799</Tag>
    </Scene>
  );
}
// ---------- line 23a: the four forces on a glider: LIFT / WEIGHT / THRUST / DRAG, each arrow on its word ----------
function Scene23a({t, at, fps, a, b}) {
  const lift = at(23, 'lift'), weight = at(23, 'weight'), thrust = at(23, 'thrust'), drag = at(23, 'drag');
  const kL = pop(t, lift, fps, soft), kW = pop(t, weight, fps, soft), kT = pop(t, thrust, fps, soft), kD = pop(t, drag, fps, soft);
  const bob = Math.sin(t * 2) * 6;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(960, ${480 + bob})`}>
          <CayleyGlider x={0} y={0} s={5} />
          <Arrow x={0} y={-110} len={200 * Math.min(1, kL)} dir="up" color={AMBER} k={Math.min(1, kL)} w={12} />
          <Arrow x={20} y={60} len={200 * Math.min(1, kW)} dir="down" color={WHITE} k={Math.min(1, kW)} w={12} />
          <Arrow x={190} y={-30} len={220 * Math.min(1, kT)} dir="right" color={GREEN} k={Math.min(1, kT)} w={12} />
          <Arrow x={-300} y={-30} len={220 * Math.min(1, kD)} dir="left" color={RED} k={Math.min(1, kD)} w={12} />
          <Lbl x={0} y={-340} size={26} color={AMBER} o={Math.min(1, kL)}>LIFT</Lbl>
          <Lbl x={20} y={300} size={26} color={WHITE} o={Math.min(1, kW)}>WEIGHT</Lbl>
          <Lbl x={440} y={-60} size={26} color={GREEN} o={Math.min(1, kT)}>THRUST</Lbl>
          <Lbl x={-550} y={-60} size={26} color={RED} o={Math.min(1, kD)}>DRAG</Lbl>
        </g>
      </svg>
    </Scene>
  );
}
// ---------- line 23b: 1853. AGED 79 on "seventy nine"; his glider design (av-cayley-glider) on "gliders"; a valley crossing with a
// coachman aboard from "carried" to "Yorkshire"; on "quit" the coachman hops out and walks off ----------
function Scene23b({t, at, fps, a, b}) {
  const seventy = at(23, 'seventy'), gliders = at(23, 'gliders'), carried = at(23, 'carried'), york = at(23, 'Yorkshire'), fright = at(23, 'frightened'), quit = at(23, 'quit');
  const p = ease(t, carried, Math.max(1, york + 0.3 - carried), Easing.inOut(Easing.quad));
  const P0 = [230, 470], C = [560, 620], P1 = [880, 540];
  const q = qb(P0, C, P1, p);
  const walk = ease(t, quit, 1.6, Easing.inOut(Easing.quad));
  const kV = pop(t, carried - 0.4, fps, soft);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <Photo src="av-cayley-glider.jpg" id="s23" a={gliders} b={b} t={t} box={[1000, 60, 860, 800]} fit="contain" radius={20} zoom={[1.0, 1.08]} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={Math.min(1, kV)}>
          <path d="M80,540 Q200,480 300,520 Q420,700 560,790 Q700,700 820,560 Q900,520 980,560 L980,880 L80,880 Z" fill={LAND2} opacity={0.8} />
          <path d="M80,540 Q200,480 300,520 Q420,700 560,790 Q700,700 820,560 Q900,520 980,560" stroke={GREEN} strokeWidth={4} fill="none" opacity={0.5} />
          {p > 0 ? dotted(P0, C, P1, p, 40, AMBER, 3.5) : null}
          <g transform={`translate(${q.x}, ${q.y}) rotate(${q.ang * 0.5})`}>
            <CayleyGlider x={0} y={0} s={2.8} man={walk <= 0} />
          </g>
          {walk > 0 ? <Man x={880 - 200 * walk} y={548 + 20 * Math.sin(Math.min(1, walk * 3) * Math.PI)} s={6} pose="stand" /> : null}
          {t >= fright ? <Lbl x={walk > 0 ? 880 - 200 * walk : q.x + 10} y={walk > 0 ? 470 : q.y - 60} size={44} color={AMBER} weight={900}>!</Lbl> : null}
          <Lbl x={560} y={850} size={22} o={ease(t, york, 0.3) * 0.9}>YORKSHIRE</Lbl>
        </g>
      </svg>
      <Tag t={t} a={seventy} fps={fps} x={530} y={150}>Aged 79</Tag>
    </Scene>
  );
}
// ---------- line 24: 1842. the Aerial Steam Carriage print (av-henson-carriage), the two names; on "Pictures ... around the world"
// small copies pop on a world map; on "Steam engines were far too heavy" a balance tips under an engine block, TOO HEAVY ----------
function Scene24({t, at, fps, a, b}) {
  const william = at(24, 'William'), john = at(24, 'John'), aerial = at(24, 'Aerial'), pictures = at(24, 'Pictures'), around = at(24, 'around'), steam3 = at(24, 'steam', 2), heavy = at(24, 'heavy');
  const box = [960, 120, 900, 560];
  const proj = fitBox(LL.WORLD, box, 10);
  const cities = [[-0.1, 51.5], [2.35, 48.86], [-74.0, 40.7], [72.8, 19.1], [151.2, -33.9], [18.4, -33.9], [-43.2, -22.9]];
  const kMap = pop(t, pictures, fps, soft) * (1 - ease(t, steam3, 0.4));
  const kScale = pop(t, steam3, fps, soft);
  const tip = 18 * ease(t, heavy, 0.9, Easing.out(Easing.back(1.5)));
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <Photo src="av-henson-carriage.jpg" id="s24" a={a} b={b} t={t} box={[100, 60, 760, 800]} fit="contain" radius={20} zoom={[1.0, 1.1]} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['GBR']} box={box} k={kMap} id="m24">
          {cities.map((c, i) => {
            const pt = proj(c), k = pop(t, around + i * 0.14, fps, bouncy);
            return pt && k > 0 ? (
              <g key={i} transform={`translate(${pt[0]}, ${pt[1]}) scale(${Math.min(1, k)})`} opacity={Math.min(1, k)}>
                <rect x={-26} y={-20} width={52} height={40} rx={3} fill={PAPER} stroke={INK} strokeWidth={1.5} />
                <rect x={-20} y={-14} width={40} height={16} rx={2} fill={LAND2} />
                {[0, 1].map((j) => <rect key={j} x={-20} y={6 + j * 6} width={30 - j * 10} height={3} fill={INK} opacity={0.4} />)}
              </g>
            ) : null;
          })}
        </MapPanel>
        <g transform={`translate(1400, 640) scale(${Math.min(1, kScale)})`} opacity={Math.min(1, kScale)}>
          <path d="M-40,60 L40,60 L0,-20 Z" fill={WHITE} opacity={0.9} />
          <g transform={`rotate(${tip})`}>
            <rect x={-300} y={-28} width={600} height={12} rx={6} fill={WHITE} />
            <g transform="translate(-260, -22)">
              <line x1={0} y1={0} x2={-40} y2={70} stroke={WHITE} strokeWidth={3} /><line x1={0} y1={0} x2={40} y2={70} stroke={WHITE} strokeWidth={3} />
              <path d="M-60,70 Q0,100 60,70 Z" fill={WHITE} opacity={0.9} />
              <rect x={-44} y={14} width={88} height={56} rx={6} fill={INK} />
              <rect x={14} y={-14} width={16} height={30} fill={INK} />
              <circle cx={-18} cy={42} r={14} fill="none" stroke={AMBER} strokeWidth={4} />
              <Lbl x={0} y={120} size={18} o={0.9}>STEAM ENGINE</Lbl>
            </g>
            <g transform="translate(260, -22)">
              <line x1={0} y1={0} x2={-40} y2={70} stroke={WHITE} strokeWidth={3} /><line x1={0} y1={0} x2={40} y2={70} stroke={WHITE} strokeWidth={3} />
              <path d="M-60,70 Q0,100 60,70 Z" fill={WHITE} opacity={0.9} />
              <path d="M-50,66 Q0,40 50,60 Q0,56 -50,66 Z" fill={AMBER} />
              <Lbl x={0} y={120} size={18} o={0.9}>WING</Lbl>
            </g>
          </g>
        </g>
      </svg>
      <Tag t={t} a={william} fps={fps} x={1400} y={62} until={pictures}>William Henson</Tag>
      <Tag t={t} a={john} fps={fps} x={1400} y={62} bg={WHITE}>{t >= pictures ? 'Henson · Stringfellow' : 'John Stringfellow'}</Tag>
      <Tag t={t} a={aerial} fps={fps} x={480} y={835}>Aerial Steam Carriage</Tag>
      <Tag t={t} a={heavy} fps={fps} x={1400} y={820} bg={RED} fg={WHITE}>Too heavy</Tag>
    </Scene>
  );
}
// ---------- line 25: Lilienthal mid-glide (av-lilienthal-1), the name; "1891-1896"; a counter to ~2,000 GLIDES on "two thousand";
// his hill (av-lilienthal-hill) on "hill", BERLIN on a small map on "Berlin" ----------
function Scene25({t, at, fps, a, b}) {
  const otto = at(25, 'Otto'), y1891 = at(25, '1891'), two = at(25, 'two'), hill = at(25, 'hill'), berlin = at(25, 'Berlin');
  const n = 2000 * ease(t, two, 1.4, Easing.out(Easing.quad));
  const mbox = [1480, 500, 380, 360];
  const proj = fitBox(LL.DEU, mbox, 30);
  const berlinPt = proj([13.33, 52.42]);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <Photo src="av-lilienthal-1.jpg" id="s25a" a={a} b={hill + 0.3} t={t} zoom={[1.0, 1.1]} gray dim={0.1} />
      <Photo src="av-lilienthal-hill.jpg" id="s25b" a={hill} b={b} t={t} zoom={[1.0, 1.1]} gray dim={0.1} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <SvgPill t={t} fps={fps} a={y1891} x={960} y={90} w={240} size={22}>1891 - 1896</SvgPill>
        <MapPanel proj={proj} hi={['DEU']} box={mbox} k={pop(t, berlin, fps, soft)} id="m25" rx={20}>
          <Pin t={t} fps={fps} a={berlin} pt={berlinPt} label="BERLIN" ly={-24} r={9} size={20} />
        </MapPanel>
      </svg>
      <Num t={t} a={two} fps={fps} x={1860} y={150} size={96} color={AMBER} align="right" sub="glides">~{fmt(n)}</Num>
      <Tag t={t} a={otto} fps={fps} x={960} y={820}>Otto Lilienthal</Tag>
    </Scene>
  );
}
// a newspaper-like card: the picture on top, grey text lines below (HTML, so the photo can be reused)
function NewsCard({x, y, k, w = 200, h = 150, rot = 0, src = 'av-lilienthal-2.jpg'}) {
  if (k <= 0) return null;
  return (
    <div style={{position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, background: PAPER, borderRadius: 4, overflow: 'hidden', transform: `rotate(${rot}deg) scale(${Math.min(1, k)})`, opacity: Math.min(1, k), boxShadow: '0 10px 30px rgba(0,0,0,0.45)'}}>
      <div style={{position: 'absolute', left: 8, top: 8, width: w - 16, height: h * 0.55, overflow: 'hidden', background: '#000'}}>
        <Img src={staticFile(`fs/${src}`)} style={{width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(1) contrast(1.1)'}} />
      </div>
      {[0, 1, 2].map((i) => <div key={i} style={{position: 'absolute', left: 8, top: h * 0.55 + 16 + i * 10, width: (w - 16) * (1 - i * 0.18), height: 4, background: INK, opacity: 0.35}} />)}
    </div>
  );
}
// ---------- line 26: the photographs spread. av-lilienthal-2 in the centre; on "printed" it multiplies into newspaper-like cards that
// scatter over a map of the Atlantic world; on "two brothers" a line draws from Berlin across the Atlantic to OHIO ----------
function Scene26({t, at, fps, a, b}) {
  const printed = at(26, 'printed'), two = at(26, 'two'), ohio = at(26, 'Ohio');
  const proj = fitBox(LL.ATL, MAP_W, 40);
  const berlinPt = proj([13.4, 52.5]), dayton = proj([-84.19, 39.76]);
  const spots = [[-0.1, 51.5], [2.35, 48.86], [13.4, 52.5], [-74.0, 40.7], [-87.6, 41.9], [-71.1, 42.4], [-3.7, 40.4], [-43.2, -22.9]];
  const sh = ease(t, printed, 0.9, Easing.inOut(Easing.cubic));
  const big = [lerp(960, 960, sh), lerp(480, 480, sh)];
  const kLine = ease(t, two, Math.max(0.8, ohio + 0.3 - two), Easing.inOut(Easing.quad));
  const C = [(berlinPt[0] + dayton[0]) / 2, Math.min(berlinPt[1], dayton[1]) - 160];
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['DEU', 'USA']} box={MAP_W} k={1} id="m26" />
      </svg>
      <Photo src="av-lilienthal-2.jpg" id="s26" a={a} b={b} t={t} box={[big[0] - lerp(440, 120, sh), big[1] - lerp(300, 80, sh), lerp(880, 240, sh), lerp(600, 160, sh)]} fit="cover" radius={10} zoom={[1.0, 1.06]} gray credit={sh < 0.5} />
      {spots.map((c, i) => {
        const pt = proj(c);
        return pt ? <NewsCard key={i} x={pt[0]} y={pt[1]} k={pop(t, printed + 0.3 + i * 0.12, fps, soft)} rot={(rnd(i + 200) - 0.5) * 16} w={170} h={130} /> : null;
      })}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {kLine > 0 ? dotted(berlinPt, C, dayton, kLine, 60, AMBER, 4) : null}
        <Pin t={t} fps={fps} a={ohio} pt={dayton} label="OHIO" ly={44} />
      </svg>
    </Scene>
  );
}
// ---------- line 27a: the fall. the glider diagram: on "swinging" the pilot's body swings to steer; AUG 1896; on "gust" wind hits,
// the glider rears up (stall), on "fell" it drops ~15 M (a ruler on "fifteen") to the ground ----------
function Scene27a({t, at, fps, a, b}) {
  const swinging = at(27, 'swinging'), august = at(27, 'August'), stalled = at(27, 'stalled'), gust = at(27, 'gust'), fell = at(27, 'fell'), fifteen = at(27, 'fifteen');
  const swing = t >= swinging && t < gust ? 18 * Math.sin((t - swinging) * 3) : 0;
  const rear = ease(t, stalled, 0.6, Easing.out(Easing.quad)) * (1 - ease(t, fell, 0.5));
  const drop = ease(t, fell, 0.9, Easing.in(Easing.quad));
  const gy = 330 - 40 * rear + 330 * drop;   // the pilot's feet hang 140 px below: from y 470 to the ground at 800
  const kR = pop(t, fifteen, fps, soft);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <line x1={100} y1={800} x2={1820} y2={800} stroke={WHITE} strokeWidth={3} opacity={0.35} />
        <Wind t={t} x0={1000} y0={150} x1={1920} y1={650} k={ease(t, gust, 0.4) * (1 - ease(t, fell + 0.5, 0.8))} n={14} seed={11} />
        <GliderFront x={860} y={gy} s={10} rot={-22 * rear + 30 * drop} swing={swing + 40 * drop} />
        <Puff x={860} y={796} k={lin(t, fell + 0.9, 0.8)} />
        <g opacity={Math.min(1, kR)}>
          <line x1={1500} y1={470} x2={1500} y2={470 + 330 * Math.min(1, kR)} stroke={AMBER} strokeWidth={3} />
          <line x1={1488} y1={470} x2={1512} y2={470} stroke={AMBER} strokeWidth={3} />
          <line x1={1488} y1={800} x2={1512} y2={800} stroke={AMBER} strokeWidth={3} opacity={kR >= 0.98 ? 1 : 0} />
          <SvgPill t={t} fps={fps} a={fifteen} x={1500} y={635} w={130} size={22}>~15 M</SvgPill>
        </g>
        <SvgPill t={t} fps={fps} a={august} x={860} y={110} w={190} size={22}>AUG 1896</SvgPill>
        <Lbl x={860} y={gy - 150} size={18} o={0.5 * (1 - drop)}>~7 M SPAN</Lbl>
      </svg>
    </Scene>
  );
}
// ---------- line 27b: a quiet black-and-white hold on his photo; his reported last words in small italic type, gently ----------
function Scene27b({t, at, fps, a, b}) {
  const sacrifices = at(27, 'sacrifices');
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <Photo src="av-lilienthal-1.jpg" id="s27" a={a} b={b} t={t} zoom={[1.0, 1.05]} gray dim={0.35} />
      <Tag t={t} a={sacrifices} fps={fps} x={960} y={790} bg="rgba(11,27,51,0.75)" fg={WHITE} size={28} italic dy={10}>“Sacrifices must be made”</Tag>
    </Scene>
  );
}
// ---------- line 28: Langley 1896. a USA map that zooms to the Potomac on "Potomac"; WASHINGTON on "Smithsonian"; an inset with the
// steam model flying its ~1 KM loop over the river from "flew" (or the picture, if present); NO ONE ON BOARD on "no" ----------
function Scene28({t, at, fps, a, b}) {
  const samuel = at(28, 'Samuel'), smith = at(28, 'Smithsonian'), flew = at(28, 'flew'), potomac = at(28, 'Potomac'), km = at(28, 'kilometre'), no = at(28, 'no');
  const zk = ease(t, potomac, 1.6, Easing.inOut(Easing.cubic));
  const proj = zoomBox(LL.USA, LL.POTOMAC, MAP_W, zk, 60);
  const dc = proj([-77.04, 38.9]);
  const river = [[-77.25, 38.98], [-77.06, 38.90], [-77.03, 38.82], [-77.08, 38.72], [-77.03, 38.62], [-77.08, 38.52], [-77.30, 38.42], [-77.28, 38.36], [-77.15, 38.30], [-76.95, 38.22]].map((c) => proj(c));
  const riverD = river.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const quantico = proj([-77.32, 38.40]);
  const kIn = pop(t, flew, fps, soft);
  const fl = ease(t, flew, Math.max(1, km + 1.0 - flew), Easing.inOut(Easing.quad));
  const ang = fl * Math.PI * 2 * 1.4;
  const mx = 120 * Math.cos(ang) * fl, my = -40 - 80 * Math.sin(ang) * fl - 40 * fl;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['USA']} box={MAP_W} k={1} id="m28" rivers={zk > 0.5 ? 2 + 5 * zk : 0}>
          {RIVERS ? null : <path d={riverD} stroke={SEA} strokeWidth={10 + 60 * zk} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={zk} />}
          {RIVERS ? null : <path d={riverD} stroke={SKY} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.5 * zk} />}
          <Pin t={t} fps={fps} a={smith} pt={dc} label="WASHINGTON" lx={22} ly={10} anchor="start" />
          {zk > 0.8 ? <Lbl x={river[5][0] + 60} y={river[5][1]} anchor="start" size={20} color={SKY} o={(zk - 0.8) * 5}>POTOMAC RIVER</Lbl> : null}
          {zk > 0.8 ? <Pin t={t} fps={fps} a={flew} pt={quantico} label="QUANTICO" ly={40} r={8} size={18} o={(zk - 0.8) * 5} /> : null}
        </MapPanel>
        {HAVE.langleyModel ? null : (
          <g transform={`translate(1460, 520) scale(${Math.min(1, kIn)})`} opacity={Math.min(1, kIn)}>
            <circle r={230} fill={NAVY2} stroke={AMBER} strokeWidth={4} />
            <defs><clipPath id="s28-clip"><circle r={226} /></clipPath></defs>
            <g clipPath="url(#s28-clip)">
              <rect x={-230} y={60} width={460} height={170} fill={SEA} />
              <path d={`M-230,60 ${Array.from({length: 6}, (_, i) => `q 40 ${-6 * Math.sin(t * 3 + i)} 80 0`).join(' ')}`} stroke={SKY} strokeWidth={3} fill="none" opacity={0.6} />
              <rect x={-200} y={20} width={120} height={40} rx={4} fill="#5A3A1E" />
              <rect x={-180} y={-20} width={70} height={40} rx={3} fill="#8A6A3A" />
              <line x1={-200} y1={-20} x2={-60} y2={-30} stroke={WHITE} strokeWidth={3} />
              {fl > 0 ? Array.from({length: 50}, (_, i) => {
                const u = (i + 1) / 50;
                if (u > fl) return null;
                const an = u * Math.PI * 2 * 1.4;
                return <circle key={i} cx={120 * Math.cos(an) * u} cy={-40 - 80 * Math.sin(an) * u - 40 * u} r={3} fill={AMBER} opacity={0.8} />;
              }) : null}
              <Aerodrome x={t >= flew ? mx : -130} y={t >= flew ? my : -34} s={0.6} rot={t >= flew ? Math.cos(ang) * 12 : 0} man={false} />
            </g>
            <SvgPill t={t} fps={fps} a={km} x={0} y={170} w={130} size={22}>~1 KM</SvgPill>
            <Lbl x={0} y={-250} size={18} o={0.7}>STEAM MODEL · 1896</Lbl>
          </g>
        )}
      </svg>
      {HAVE.langleyModel ? <Photo src="av-langley-model.jpg" id="s28p" a={flew} b={b} t={t} box={[1120, 140, 740, 560]} fit="contain" radius={20} zoom={[1.0, 1.08]} /> : null}
      {HAVE.langleyModel ? <Tag t={t} a={km} fps={fps} x={1490} y={720}>~1 km</Tag> : null}
      <Tag t={t} a={samuel} fps={fps} x={420} y={150}>Samuel Langley</Tag>
      <Tag t={t} a={smith} fps={fps} x={420} y={215} bg={WHITE}>Smithsonian</Tag>
      <Tag t={t} a={no} fps={fps} x={1490} y={820} bg={RED} fg={WHITE}>No one on board</Tag>
    </Scene>
  );
}
// the full-size Aerodrome's two launches off the houseboat: position, pitch and fold as a function of time
const aeroPose = (t, L, D, F) => {
  if (t < L) return {x: 820, y: 470, rot: 0, fold: 0, sunk: 0};
  const run = ease(t, L, Math.max(0.6, D - L), Easing.out(Easing.quad));
  const x = lerp(820, 1380, run);
  const sag = 60 * lin(t, L + 0.5, Math.max(0.3, D - L - 0.5));
  const fold = F === undefined ? 0 : ease(t, F, 0.5, Easing.in(Easing.quad));
  if (t < D) return {x, y: 470 + sag, rot: 6 * run - 10 * fold, fold, sunk: 0};
  const f = ease(t, D, 0.75, Easing.in(Easing.quad));
  return {x: 1380 + 40 * f, y: 470 + sag + 230 * f, rot: 6 - 10 * fold + 55 * f, fold, sunk: ease(t, D + 0.75, 1.5)};
};
// ---------- line 29: 7 OCT 1903 and 8 DEC 1903. With the real houseboat picture: the photo alone (slow push, "7 OCT 1903") until "it
// was launched", then a cut to the drawing (review 1). The drawing: the houseboat with its roof-top rail, the Aerodrome (tandem wings,
// ~14.6 m span) launched on "launched", dropping into the Potomac on "dropped"; a second Aerodrome on "On the eighth", launched on
// "tried", wings fold on "broke", into the water on "fell"; the pilot swims to the boat on "pulled": PILOT SURVIVED ----------
function Scene29({t, at, fps, a, b}) {
  const aero = at(29, 'Aerodrome'), petrol = at(29, 'petrol'), october = at(29, 'October'), it = at(29, 'it'), launched = at(29, 'launched'), dropped = at(29, 'dropped');
  const on = at(29, 'On'), eighth = at(29, 'eighth'), tried = at(29, 'tried'), broke = at(29, 'broke'), fell = at(29, 'fell'), charles = at(29, 'Charles'), pulled = at(29, 'pulled');
  const cut = HAVE.langleyBoat ? it : a;   // the drawing starts here
  const p1 = aeroPose(t, launched, dropped), p2 = aeroPose(t, tried, fell, broke);
  const k1 = pop(t, Math.max(aero, cut), fps, soft) * (1 - p1.sunk), k2 = pop(t, on, fps, soft) * (1 - p2.sunk);
  const splash1 = lin(t, dropped + 0.75, 0.9), splash2 = lin(t, fell + 0.75, 0.9);
  const swim = ease(t, pulled, 1.6, Easing.inOut(Easing.quad));
  const kMan = pop(t, pulled - 0.3, fps, soft);
  const kDraw = cut > a ? ease(t, cut, 0.3) : 1;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      {HAVE.langleyBoat ? <Photo src="av-langley-boat.jpg" id="s29b" a={a} b={cut} t={t} zoom={[1.0, 1.08]} gray dim={0.1} /> : null}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={kDraw}>
          <rect x={0} y={700} width={W} height={220} fill={SEA} opacity={0.9} />
          <path d={`M0,700 ${Array.from({length: 18}, (_, i) => `q 54 ${-8 * Math.sin(t * 3 + i)} 108 0`).join(' ')}`} stroke={SKY} strokeWidth={4} fill="none" opacity={0.6} />
          <g>
            <path d="M240,690 L960,690 L930,742 L270,742 Z" fill="#5A3A1E" />
            <rect x={290} y={570} width={620} height={120} rx={6} fill="#8A6A3A" />
            {[340, 440, 540, 640, 740, 840].map((x) => <rect key={x} x={x} y={606} width={44} height={44} rx={4} fill={NAVY} opacity={0.6} />)}
            <rect x={290} y={520} width={620} height={50} rx={4} fill="#6E5430" />
            <line x1={320} y1={500} x2={1060} y2={500} stroke={WHITE} strokeWidth={7} />
            <line x1={320} y1={510} x2={1060} y2={510} stroke={WHITE} strokeWidth={3} opacity={0.5} />
            {[380, 500, 620, 740, 860, 980].map((x) => <line key={x} x1={x} y1={510} x2={x} y2={520} stroke={WHITE} strokeWidth={3} />)}
            <Lbl x={600} y={560} size={18} o={0.8}>HOUSEBOAT</Lbl>
          </g>
          {t >= petrol && t < launched ? [0, 1, 2].map((i) => { const ph = ((t - petrol) * 0.8 + i * 0.33) % 1; return <circle key={i} cx={840 + ph * 60} cy={440 - ph * 100} r={8 + ph * 14} fill={WHITE} opacity={0.4 * (1 - ph)} />; }) : null}
          {k1 > 0 ? <Aerodrome x={p1.x} y={p1.y} s={2.2} rot={p1.rot} fold={p1.fold} o={Math.min(1, k1)} /> : null}
          {k2 > 0 && t >= on ? <Aerodrome x={p2.x} y={p2.y} s={2.2} rot={p2.rot} fold={p2.fold} o={Math.min(1, k2)} /> : null}
          <Puff x={1420} y={712} k={splash1} color={SKY} />
          <Puff x={1420} y={712} k={splash2} color={SKY} />
          {kMan > 0 ? <g opacity={Math.min(1, kMan)}><Man x={lerp(1400, 1000, swim)} y={760 + Math.sin(t * 4) * 5} s={7} pose="arms" flap={Math.sin(t * 6) * 0.5} /><ellipse cx={lerp(1400, 1000, swim)} cy={742} rx={60} ry={14} fill="none" stroke={SKY} strokeWidth={2} opacity={0.5} /></g> : null}
          <Lbl x={300} y={440} anchor="start" size={18} o={0.6 * Math.min(1, k1 + k2)}>AERODROME · 14.6 M SPAN · 16 M LONG</Lbl>
        </g>
        <SvgPill t={t} fps={fps} a={october} x={1500} y={170} w={200} size={22}>7 OCT 1903</SvgPill>
        <SvgPill t={t} fps={fps} a={eighth} x={1500} y={240} w={200} size={22}>8 DEC 1903</SvgPill>
      </svg>
      {HAVE.langleyCrash ? <Photo src="av-langley-crash.jpg" id="s29c" a={fell} b={b} t={t} box={[1200, 300, 660, 380]} fit="contain" radius={20} zoom={[1.0, 1.08]} /> : null}
      <Tag t={t} a={charles} fps={fps} x={1500} y={300} bg={WHITE}>Charles Manly</Tag>
      <Tag t={t} a={pulled} fps={fps} x={960} y={820} bg={GREEN}>Pilot survived</Tag>
    </Scene>
  );
}
// ---------- line 30: newspapers. three paper columns pop on "Newspapers", shake on "laughed"; the middle one grows on "wrote";
// "1 - 10 MILLION YEARS" is highlighted on "one" (no masthead, no other quoted words) ----------
function Scene30({t, at, fps, a, b}) {
  const news = at(30, 'Newspapers'), laughed = at(30, 'laughed'), wrote = at(30, 'wrote'), one = at(30, 'one'), million = at(30, 'million');
  const cols = [[300, 0.8], [960, 1], [1620, 0.8]];
  const shake = t >= laughed && t < laughed + 1 ? Math.sin((t - laughed) * 30) * 3 * (1 - (t - laughed)) : 0;
  const grow = 1 + 0.12 * ease(t, wrote, 0.6);
  const kH = pop(t, one, fps, bouncy);
  const pulse = 1 + 0.06 * Math.sin((t - million) * 10) * (t >= million ? 1 : 0);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {cols.map(([x, s], i) => {
          const k = pop(t, news + i * 0.15, fps, soft);
          const mid = i === 1;
          return (
            <g key={i} transform={`translate(${x}, 480) rotate(${shake * (i - 1 || 1)}) scale(${Math.min(1, k) * s * (mid ? grow : 1)})`} opacity={Math.min(1, k) * (mid ? 1 : 0.6)}>
              <rect x={-200} y={-370} width={400} height={740} rx={6} fill={PAPER} />
              {Array.from({length: 30}, (_, j) => {
                const wv = 320 - rnd(j + i * 40) * 80, y = -340 + j * 23;
                const hi = mid && j === 14;
                return hi ? null : <rect key={j} x={-170} y={y} width={j % 9 === 0 ? 200 : wv} height={j % 9 === 0 ? 10 : 6} rx={3} fill={INK} opacity={j % 9 === 0 ? 0.6 : 0.28} />;
              })}
              {mid ? (
                <g transform={`translate(0, -18) scale(${pulse})`} opacity={Math.min(1, kH)}>
                  <rect x={-178} y={-20} width={356} height={40} rx={6} fill={AMBER} transform={`scale(${Math.min(1, kH)}, 1)`} />
                  <Lbl x={0} y={9} size={24} color={NAVY} weight={900}>1 - 10 MILLION YEARS</Lbl>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>
      <Tag t={t} a={wrote} fps={fps} x={960} y={62} bg="rgba(11,27,51,0.75)" fg={WHITE}>New York Times · 1903</Tag>
    </Scene>
  );
}
// the beach at Kill Devil Hills: sand, wind, the rail and the Flyer (front view, real proportions) waiting on it
function Beach({t, fps, flyerAt, wind, fx = 1290, fs = 9.5, k = 1}) {
  const kF = pop(t, flyerAt, fps, soft);
  const top = -21 * fs;   // the upper wing
  return (
    <g opacity={k}>
      <rect x={0} y={800} width={W} height={120} fill={SAND} />
      <path d={`M0,800 ${Array.from({length: 18}, (_, i) => `q 54 ${-6 - 4 * Math.sin(i * 2.1)} 108 0`).join(' ')}`} stroke={SAND2} strokeWidth={5} fill="none" />
      <Wind t={t} x0={700} y0={160} x1={1920} y1={760} k={ease(t, wind, 0.5)} n={16} seed={17} />
      <g transform={`translate(${fx}, ${800 - 9 * fs}) scale(${Math.min(1, kF)})`} opacity={Math.min(1, kF)}>
        <line x1={-12 * fs} y1={9 * fs} x2={12 * fs} y2={9 * fs} stroke={WHITE} strokeWidth={5} opacity={0.8} />
        <FlyerFront x={0} y={0} s={fs} />
        <line x1={-61.5 * fs} y1={top - 40} x2={61.5 * fs} y2={top - 40} stroke={AMBER} strokeWidth={2} opacity={0.6} />
        <line x1={-61.5 * fs} y1={top - 52} x2={-61.5 * fs} y2={top - 28} stroke={AMBER} strokeWidth={2} opacity={0.6} />
        <line x1={61.5 * fs} y1={top - 52} x2={61.5 * fs} y2={top - 28} stroke={AMBER} strokeWidth={2} opacity={0.6} />
        <Lbl x={0} y={top - 56} size={20} color={AMBER} o={0.8}>12.3 M SPAN</Lbl>
      </g>
    </g>
  );
}
// ---------- line 31: 17 DEC 1903. a map with KILL DEVIL HILLS and DAYTON, OHIO; "9 DAYS LATER"; wind across the beach on "windy";
// the Wright Flyer waiting on its rail on "beach"; the two brothers on their names ----------
function Scene31({t, at, fps, a, b}) {
  const nine = at(31, 'nine'), cold = at(31, 'cold'), windy = at(31, 'windy'), beach = at(31, 'beach'), north = at(31, 'North'), two = at(31, 'two'), ohio = at(31, 'Ohio'), wilbur = at(31, 'Wilbur'), orville = at(31, 'Orville');
  const box = [40, 120, 620, 620];
  const proj = fitBox(LL.NCOH, box, 40);
  const kdh = proj([-75.67, 36.02]), dayton = proj([-84.19, 39.76]);
  const kLine = ease(t, ohio, 1.0, Easing.inOut(Easing.quad));
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <Beach t={t} fps={fps} flyerAt={beach} wind={windy} />
        <MapPanel proj={proj} hi={['USA']} box={box} k={pop(t, a, fps, soft)} id="m31">
          {kLine > 0 ? dotted(dayton, [(dayton[0] + kdh[0]) / 2, Math.min(dayton[1], kdh[1]) - 60], kdh, kLine, 30, WHITE, 3) : null}
          <Pin t={t} fps={fps} a={north} pt={kdh} label="KILL DEVIL HILLS" ly={-28} />
          <Pin t={t} fps={fps} a={ohio} pt={dayton} label="DAYTON · OHIO" ly={-28} r={9} size={20} />
        </MapPanel>
        <SvgPill t={t} fps={fps} a={nine} x={350} y={170} w={230} size={22}>9 DAYS LATER</SvgPill>
        <SvgPill t={t} fps={fps} a={cold} x={350} y={230} w={220} size={22} bg={WHITE}>17 DEC 1903</SvgPill>
        {t >= two ? <Man x={1000} y={800} s={8} pose="stand" /> : null}
        {t >= two ? <Man x={1600} y={800} s={8} pose="stand" /> : null}
      </svg>
      <Tag t={t} a={wilbur} fps={fps} x={1000} y={826} bg={WHITE}>Wilbur</Tag>
      <Tag t={t} a={orville} fps={fps} x={1600} y={826} bg={WHITE}>Orville</Tag>
    </Scene>
  );
}
// ---------- line 32: a calm last beat. the map and the brothers are gone, a slow push on the Flyer waiting in the wind, fade to navy ----------
function Scene32({t, at, fps, a, b, seconds}) {
  const begins = at(32, 'begins');
  const k = ease(t, a, 3.0, Easing.inOut(Easing.quad));
  const out = ease(t, begins, Math.max(0.5, seconds - begins), Easing.inOut(Easing.quad));
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(${lerp(1290, 960, k)}, 714) scale(${lerp(1, 1.22, k)}) translate(-1290, -714)`}>
          <Beach t={t} fps={fps} flyerAt={a - 1} wind={a - 1} />
        </g>
      </svg>
      <AbsoluteFill style={{background: NAVY, opacity: out, pointerEvents: 'none'}} />
    </Scene>
  );
}

// the running year chip: which label is showing at time t, and since when
const yearSchedule = (at, lines, T) => {
  const has = (i) => Boolean(lines[i]);
  const s = [[T(9), '1903']];
  if (has(9)) s.push([at(9, 'very'), 'ANTIQUITY']);
  if (has(12)) s.push([at(12, 'ninth'), '9TH CENTURY']);
  if (has(14)) s.push([at(14, '1010'), 'c. 1010']);
  if (has(16)) s.push([at(16, '1505'), 'c. 1505']);
  if (has(18)) s.push([at(18, 'June'), 'JUNE 1783']);
  if (has(19)) s.push([at(19, 'September'), 'SEPT 1783']);
  if (has(20)) s.push([at(20, 'November'), 'NOV 1783']);
  if (has(21)) s.push([at(21, 'ten'), 'DEC 1783']);
  if (has(22)) s.push([at(22, '1799'), '1799']);
  if (has(23)) s.push([at(23, '1853'), '1853']);
  if (has(24)) s.push([at(24, '1842'), '1842']);
  if (has(25)) s.push([at(25, '1891'), '1891 - 1896']);
  if (has(27)) s.push([at(27, 'August'), 'AUG 1896']);
  if (has(28)) s.push([at(28, '1896'), '1896']);
  if (has(29)) s.push([at(29, 'October'), 'OCT 1903']);
  if (has(29)) s.push([at(29, 'eighth'), 'DEC 1903']);
  if (has(31)) s.push([at(31, 'cold'), '17 DEC 1903']);
  return s;
};

export const AviHistory1 = ({lines = [], words = [], seconds = 369}) => {
  const {fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;
  const at = makeAt(lines);
  const T = (i) => (lines[i] ? lines[i].t0 : seconds);
  const sand = lines[7] ? at(7, 'sand') : T(8);
  const paris = lines[20] ? at(20, 'Paris') : T(21);
  const in23 = lines[23] ? at(23, 'In') : T(24);
  const died = lines[27] ? at(27, 'died') : T(28);
  const scenes = [[0, T(1), SceneA0], [T(1), T(2), SceneA1], [T(2), T(3), SceneA2], [T(3), T(4), SceneA3], [T(4), T(6), SceneA4], [T(6), T(7), SceneA6],
                  [T(7), sand, SceneA7], [sand, T(8), SceneA7p], [T(8), T(9), SceneA8],
                  [T(9), T(10), Scene9], [T(10), T(11), Scene10], [T(11), T(12), Scene11], [T(12), T(14), Scene12], [T(14), T(15), Scene14],
                  [T(15), T(16), Scene15], [T(16), T(17), Scene16], [T(17), T(18), Scene17], [T(18), T(19), Scene18], [T(19), T(20), Scene19],
                  [T(20), paris, Scene20a], [paris, T(21), Scene20b], [T(21), T(22), Scene21], [T(22), T(23), Scene22], [T(23), in23, Scene23a],
                  [in23, T(24), Scene23b], [T(24), T(25), Scene24], [T(25), T(26), Scene25], [T(26), T(27), Scene26], [T(27), died, Scene27a],
                  [died, T(28), Scene27b], [T(28), T(29), Scene28], [T(29), T(30), Scene29], [T(30), T(31), Scene30], [T(31), T(32), Scene31],
                  [T(32), seconds + 1, Scene32]];
  // the year chip
  const sched = yearSchedule(at, lines, T);
  let label = sched[0][1], since = sched[0][0];
  for (const [ts, lb] of sched) { if (t >= ts) { label = lb; since = ts; } }
  if (lines[9]) {
    const before = at(9, 'before'), very = at(9, 'very');
    if (t >= before && t < very) {
      const k = ease(t, before, Math.max(0.8, very - before), Easing.in(Easing.cubic));
      const yr = Math.round(lerp(1903, 1000, k));
      label = k >= 1 ? 'ANTIQUITY' : `${yr}`; since = before;
    }
  }
  return (
    <AbsoluteFill style={{background: NAVY}}>
      {scenes.map(([a, b, C], i) => (t >= a && t < b + XF ? <C key={i} t={t} at={at} fps={fps} a={a} b={b} lines={lines} seconds={seconds} /> : null))}
      <CaptionBand />
      {t >= T(9) ? <YearChip t={t} fps={fps} label={label} since={since} /> : null}
      <AbsoluteFill style={{background: NAVY, opacity: interpolate(t, [seconds - 0.4, seconds], [0, 1], CL), pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};
