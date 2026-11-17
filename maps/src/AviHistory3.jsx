// AviHistory3.jsx: History of aviation, Chapter 3 "Everyone on board" (commercial aviation to today) (client: Bassel), made with Fable.
// 1920x1080, 30 fps, 6 min 17 s, plays under the recorded narration (timing.json: 30 lines, word times). Same series as Chapters 1-2
// (ref/AviHistory2.jsx): the same look (deep navy, white, amber, flat infographics, gentle springs), the same helpers, year chip,
// MapPanel, picture frames, the Flyer and the airliner drawings. Real maps (geo.json + d3-geo). Every drawn aircraft uses REAL
// proportions (the client's rule): 10 px per metre at scale 1, the length:height (side) or span:length (top) ratio is in a comment
// next to each one, and aircraft shown together always share one scale. Captions are drawn by a wrapper along the bottom
// (y 935-1040): important things stay above y 900. Every frame is a pure function of the frame number; every animation is driven
// by the word times (helper at(lineIndex, 'word')).
import React from 'react';
import {AbsoluteFill, Sequence, OffthreadVideo, Img, staticFile, interpolate, spring, Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import {geoMercator, geoOrthographic, geoPath, geoGraticule10, geoInterpolate} from 'd3-geo';
import geo from './geo.json';   // Natural Earth (public domain): geo.world.features, properties.a3 = ISO3; geo.rivers

// the pictures. The Builder switches on the ones that exist; each has a drawn fallback. Files: av3-707-panam.jpg (three Pan Am 707s at
// the factory, b/w, PD), av3-787.jpg (the 787's first flight 2009, CC BY 2.0), av3-comet-boac.jpg, av3-747-1969.jpg, av3-concorde.jpg,
// av3-concorde2.jpg, av3-a300.jpg, av3-a320.jpg, av3-777.jpg, av3-707-cabin.jpg
const HAVE = {panam707: true, b787: true, comet: false, b747: false, concorde: false, concorde2: false, a300: false, a320: false,
  b777: false, cabin707: false};
const PIC = {panam707: 'av3-707-panam.jpg', b787: 'av3-787.jpg', comet: 'av3-comet-boac.jpg', b747: 'av3-747-1969.jpg', concorde: 'av3-concorde.jpg',
  concorde2: 'av3-concorde2.jpg', a300: 'av3-a300.jpg', a320: 'av3-a320.jpg', b777: 'av3-777.jpg', cabin707: 'av3-707-cabin.jpg'};
const CREDIT = {panam707: 'Public domain', b787: 'CC BY 2.0', comet: 'Public domain', b747: 'Public domain', concorde: 'Public domain',
  concorde2: 'Public domain', a300: 'Public domain', a320: 'Public domain', b777: 'Public domain', cabin707: 'Public domain'};
// the real film (tag "Real footage", cover, slow push). Available now (review 2): a380-dubai.mp4 (an Emirates A380 taxiing seen from a
// window, 0-60 s ONLY) -> line 20 from 24 s; takeoff-oak.mp4 (window view: 0-40 runway roll, 60-75 lift-off, 80-128 climb) -> line 27
// from 20 s. b747-takeoff-pae.mp4 belongs to Chapter 2 and is not used here. The rest sit behind FILMS (still downloading); each has
// an animated fallback when false. First 60 s unless told otherwise; the Builder checks the windows before the render.
const FILM = {dubai: 'a380-dubai.mp4', oak: 'takeoff-oak.mp4', concorde: 'concorde-helsinki-1985.mp4', b747sca: 'b747-sca-nasa.mp4',
  a300: 'a300-landing.mp4', b777: 'b777-takeoff.mp4', b787: 'b787-moon.mp4'};
const FILMS = {concorde: false, b747sca: false, a300: false, b777: false, b787: false};

const W = 1920, H = 1080;
const NAVY = '#0B1B33', NAVY2 = '#152C4F', WHITE = '#FFFFFF', AMBER = '#FFB547';
const SKY = '#7FB8E6', RED = '#FF5C5C', GREEN = '#6FD48F', LAND = '#2A4570', LAND2 = '#3D5C8E', SEA = '#0E2447';
const SAND = '#C9B27A', SAND2 = '#E2CF9A', PAPER = '#F1E8D2', INK = '#2B2416', SILVER = '#C9D3E0', STONE = '#8A8F9A';
const ORANGE = '#FF6A1A', BLACK = '#1C1C1C', EASY = '#FF8C1A', COPPER = '#C47A3A', STORMY = '#1A2238';
const BIG = "'Archivo Black', sans-serif", SMALL = "'Montserrat', sans-serif";
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
const XF = 5 / 30;   // crossfade between shots: 5 frames
const FULL = [0, 0, W, H];

// ---------- tiny pure helpers (Chapter 1-2's) ----------
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
// a polyline: its path, and the point at fraction u of its length
const polyD = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
const polyAt = (pts, u) => {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let d = clamp01(u) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= seg || i === pts.length - 1) { const v = seg > 0 ? Math.min(1, d / seg) : 0; return [lerp(pts[i - 1][0], pts[i][0], v), lerp(pts[i - 1][1], pts[i][1], v)]; }
    d -= seg;
  }
  return pts[pts.length - 1];
};
// a great circle between two lon/lat points, projected: n points; point and heading at fraction u
const greatCircle = (proj, A, B, n = 60) => {
  const ip = geoInterpolate(A, B);
  return Array.from({length: n}, (_, i) => proj(ip((i + 1) / n)));
};
const gcAt = (proj, A, B, u) => {
  const ip = geoInterpolate(A, B);
  const p = proj(ip(clamp01(u))), q = proj(ip(Math.min(1, clamp01(u) + 0.01)));
  return {x: p[0], y: p[1], ang: Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI};
};
// dots along a list of projected points up to fraction p
const dottedPts = (pts, p, color = AMBER, r = 4.5) => pts.map((q, i) => (q && (i + 1) / pts.length <= p ? <circle key={i} cx={q[0]} cy={q[1]} r={r} fill={color} opacity={0.9} /> : null));

// ---------- real geography ----------
const LAND_FC = geo.world;
// the detailed outlines (review 2): geo.detail.features, 95 countries (USA, CAN, GBR, FRA, ESP, ITA, ZAF, CHN, JPN, ...); the coarse
// world is the fallback when a shape is missing
const DETAIL_FC = geo.detail && geo.detail.features && geo.detail.features.length ? geo.detail : LAND_FC;
const GRAT = geoGraticule10();
const feats = (a3s) => {
  const d = DETAIL_FC.features.filter((f) => a3s.includes(f.properties.a3));
  return {type: 'FeatureCollection', features: d.length ? d : LAND_FC.features.filter((f) => a3s.includes(f.properties.a3))};
};
const fitBox = (ll, box, pad = 0) => geoMercator().fitExtent([[box[0] + pad, box[1] + pad], [box[0] + box[2] - pad, box[1] + box[3] - pad]],
  {type: 'MultiPoint', coordinates: [[ll[0], ll[1]], [ll[2], ll[1]], [ll[2], ll[3]], [ll[0], ll[3]]]});
const boxC = (box) => [box[0] + box[2] / 2, box[1] + box[3] / 2];
const MAP_W = [160, 90, 1600, 790];         // a wide map panel
const LL = {ATL_NY: [-82, 33, 12, 60], EUR: [-11, 34, 33, 61], USA: [-125, 24, -66, 50], WORLD: [-170, -55, 180, 75], LON_JNB: [-28, -38, 48, 62],
            MED: [4, 35.5, 20.5, 46], AUS: [112, -45, 155, -9], CANARY: [-18.6, 27.4, -13.2, 29.6], GB_FR: [-11, 41.5, 10, 60], USA_E: [-92, 30, -66, 46]};

// ---------- shared building blocks (Chapter 1-2's) ----------
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
// the captions layer owns y 935-1040; a soft darker band keeps drawings from fighting the words
function CaptionBand() {
  return <div style={{position: 'absolute', left: 0, top: 920, width: W, height: 160, background: 'linear-gradient(180deg, rgba(11,27,51,0) 0%, rgba(11,27,51,0.45) 30%, rgba(11,27,51,0.45) 80%, rgba(11,27,51,0.2) 100%)'}} />;
}
function Credit({t, a, children, x = 44, y = 36}) {
  return (
    <div style={{position: 'absolute', left: x, top: y, padding: '6px 14px', borderRadius: 8, background: 'rgba(11,27,51,0.6)', border: '1px solid rgba(255,255,255,0.25)',
                 fontFamily: SMALL, fontWeight: 700, fontSize: 20, color: WHITE, letterSpacing: 1, opacity: ease(t, a + 0.1, 0.3)}}>{children}</div>
  );
}
function Scene({t, a, children}) {
  return <AbsoluteFill style={{opacity: a <= 0 ? 1 : ease(t, a, XF, Easing.inOut(Easing.quad))}}>{children}</AbsoluteFill>;
}
// real footage, full frame (cover), a slow push-in; `a`..`b` in global seconds; `from` = seconds into the file
function Clip({src, from = 0, a, b, t, fps, zoom = [1.04, 1.14], fx = 50, fy = 50, dark = 0.3, rate = 1, credit = 'Real footage'}) {
  if (t < a || t > b + XF) return null;
  const p = lin(t, a, Math.max(0.1, b - a));
  const z = lerp(zoom[0], zoom[1], p);
  const style = {position: 'absolute', width: W, height: H, objectFit: 'cover', objectPosition: `${fx}% ${fy}%`, transform: `scale(${z})`, transformOrigin: `${fx}% ${fy}%`};
  const fade = a <= 0 ? 1 : interpolate(t, [a, a + XF], [0, 1], CL);
  return (
    <AbsoluteFill style={{opacity: fade, background: NAVY}}>
      <Sequence from={Math.round(a * fps)} durationInFrames={Math.max(1, Math.round((b - a + XF) * fps))} layout="none">
        <OffthreadVideo src={staticFile(`fs/${src}`)} muted startFrom={Math.round(from * fps)} playbackRate={rate} style={style} />
      </Sequence>
      <AbsoluteFill style={{background: `linear-gradient(180deg, rgba(11,27,51,${dark + 0.25}) 0%, rgba(11,27,51,${dark * 0.3}) 28%, rgba(11,27,51,${dark * 0.3}) 58%, rgba(11,27,51,${dark + 0.4}) 100%)`}} />
      <Credit t={t} a={a}>{credit}</Credit>
    </AbsoluteFill>
  );
}
// a picture: cover or contain on a dark backdrop, a slow push, a vignette, a light grain, credit tag
function Photo({src, id, a, b, t, box = FULL, fit = 'cover', zoom = [1.0, 1.1], fx = 50, fy = 50, dim = 0, gray = false, radius = 0, o = 1, credit = 'Public domain'}) {
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
      {credit ? <Credit t={t} a={a} x={box[0] + 24} y={box[1] + 24}>{credit}</Credit> : null}
    </AbsoluteFill>
  );
}
// a picture that may not exist: the real photo when HAVE[key] is true, otherwise a drawn fallback inside a framed panel
function Pic({have, id, a, b, t, fps, box, fit = 'contain', gray = true, dim = 0, fallback}) {
  if (HAVE[have]) return <Photo src={PIC[have]} id={id} a={a} b={b} t={t} box={box} fit={fit} radius={20} zoom={[1.0, 1.08]} gray={gray} dim={dim} credit={CREDIT[have]} />;
  if (t < a || t > b + XF) return null;
  const k = pop(t, a, fps, soft);
  const c = boxC(box);
  return (
    <svg width={W} height={H} style={{position: 'absolute'}}>
      <g transform={`translate(${c[0]}, ${c[1]}) scale(${0.92 + 0.08 * Math.min(1, k)}) translate(${-c[0]}, ${-c[1]})`} opacity={Math.min(1, k)}>
        <defs><clipPath id={`${id}-fclip`}><rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} rx={20} /></clipPath></defs>
        <rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} rx={20} fill={NAVY2} />
        <g clipPath={`url(#${id}-fclip)`}>{fallback ? fallback(k) : null}</g>
        <rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} rx={20} fill="none" stroke={AMBER} strokeWidth={3} opacity={0.6} />
      </g>
    </svg>
  );
}
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
const Lbl = ({x, y, children, anchor = 'middle', size = 22, color = WHITE, o = 1, weight = 800, rot = 0}) => (
  <text x={x} y={y} textAnchor={anchor} fontFamily={SMALL} fontWeight={weight} fontSize={size} fill={color} letterSpacing={2} opacity={o} transform={rot ? `rotate(${rot}, ${x}, ${y})` : undefined}>{children}</text>
);
function SvgPill({t, fps, a, x, y, children, bg = AMBER, fg = NAVY, w = 180, size = 22, o = 1, until, rot = 0}) {
  if (t < a || (until && t > until + 0.3)) return null;
  const k = pop(t, a, fps, soft);
  const out = until ? interpolate(t, [until, until + 0.3], [1, 0], CL) : 1;
  return (
    <g transform={`translate(${x}, ${y + (1 - k) * 20}) rotate(${rot}) scale(${0.8 + 0.2 * k})`} opacity={k * o * out}>
      <rect x={-w / 2} y={-22} width={w} height={44} rx={22} fill={bg} />
      <text y={8} textAnchor="middle" fontFamily={SMALL} fontWeight={800} fontSize={size} fill={fg} letterSpacing={2}>{children}</text>
    </g>
  );
}
function Pin({t, fps, a, pt, label, lx = 0, ly = -26, anchor = 'middle', color = AMBER, size = 22, o = 1, r = 11, sub}) {
  if (t < a || !pt) return null;
  const k = pop(t, a, fps, bouncy);
  return (
    <g transform={`translate(${pt[0]}, ${pt[1]})`} opacity={Math.min(1, k * 1.5) * o}>
      <circle r={2 * r * k} fill={color} opacity={0.25} />
      <circle r={r * k} fill={color} stroke={WHITE} strokeWidth={r > 8 ? 4 : 2.5} />
      <text x={lx} y={ly} textAnchor={anchor} fontFamily={SMALL} fontWeight={800} fontSize={size} fill={WHITE} letterSpacing={2} opacity={k}>{label}</text>
      {sub ? <text x={lx} y={ly + size * 0.95} textAnchor={anchor} fontFamily={SMALL} fontWeight={700} fontSize={size * 0.7} fill={AMBER} letterSpacing={1.5} opacity={k * 0.9}>{sub}</text> : null}
    </g>
  );
}
const Tick = ({x, y, k = 1, r = 44}) => (k <= 0 ? null : (
  <g transform={`translate(${x}, ${y}) scale(${k})`} opacity={Math.min(1, k)}>
    <circle r={r} fill={GREEN} />
    <path d={`M${-r * 0.45},${r * 0.05} L${-r * 0.12},${r * 0.4} L${r * 0.5},${-r * 0.4}`} stroke={NAVY} strokeWidth={r * 0.22} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </g>
));
const Cross = ({x, y, k = 1, r = 30, color = RED}) => (k <= 0 ? null : (
  <g transform={`translate(${x}, ${y}) scale(${Math.min(1, k)})`} opacity={Math.min(1, k)}>
    <line x1={-r} y1={-r} x2={r} y2={r} stroke={color} strokeWidth={r * 0.3} strokeLinecap="round" />
    <line x1={-r} y1={r} x2={r} y2={-r} stroke={color} strokeWidth={r * 0.3} strokeLinecap="round" />
  </g>
));
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
// speed chevrons streaming behind a point (to -x), n of them, k 0..1, len = spacing
const Chevrons = ({t, x, y, n = 3, k = 1, color = AMBER, len = 60, size = 26}) => (k <= 0 ? null : (
  <g opacity={k}>
    {Array.from({length: n}, (_, i) => {
      const ph = ((t * 1.2 + i / n) % 1);
      const cx = x - 20 - ph * len * n;
      return <path key={i} d={`M${cx},${y - size} L${cx + size * 0.8},${y} L${cx},${y + size}`} stroke={color} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={(1 - ph) * 0.9} />;
    })}
  </g>
));
// a map panel on the detailed outlines (review 2): a light coastline glow (its inland half is covered by the fills, so only the coast
// keeps it), every country filled with a thin border, the highlighted ones brighter with an amber edge, a subtle graticule
function MapPanel({proj, hi = [], box, k = 1, id, children, o = 1, rx = 28, hiColor = AMBER}) {
  if (k <= 0) return null;
  const path = geoPath(proj.clipExtent([[box[0], box[1]], [box[0] + box[2], box[1] + box[3]]]));
  const c = boxC(box);
  return (
    <g transform={`translate(${c[0]}, ${c[1]}) scale(${0.92 + 0.08 * Math.min(1, k)}) translate(${-c[0]}, ${-c[1]})`} opacity={Math.min(1, k) * o}>
      <defs><clipPath id={`${id}-clip`}><rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} rx={rx} /></clipPath></defs>
      <rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} rx={rx} fill={SEA} />
      <g clipPath={`url(#${id}-clip)`}>
        <path d={path(GRAT) || ''} stroke={WHITE} strokeWidth={1} fill="none" opacity={0.1} />
        <path d={path(DETAIL_FC) || ''} stroke={SKY} strokeWidth={4} fill="none" strokeLinejoin="round" opacity={0.28} />
        <path d={path(DETAIL_FC) || ''} fill={LAND} stroke={LAND2} strokeWidth={0.9} strokeLinejoin="round" />
        {hi.length ? <path d={path(feats(hi)) || ''} fill={LAND2} stroke={hiColor} strokeWidth={2} strokeLinejoin="round" opacity={0.95} /> : null}
        <path d={path(DETAIL_FC) || ''} fill="none" stroke={WHITE} strokeWidth={0.6} strokeLinejoin="round" opacity={0.35} />
        {children}
      </g>
      <rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} rx={rx} fill="none" stroke={WHITE} strokeWidth={2} opacity={0.25} />
    </g>
  );
}
function YearChip({t, fps, label, since}) {
  const k = Math.min(1, pop(t, since, fps, soft));
  return (
    <div style={{position: 'absolute', right: 44, top: 36, padding: '8px 20px', borderRadius: 999, background: 'rgba(11,27,51,0.72)', border: '1px solid rgba(255,181,71,0.7)',
                 fontFamily: SMALL, fontWeight: 800, fontSize: 24, letterSpacing: 2.5, color: AMBER, whiteSpace: 'nowrap', transform: `scaleY(${0.5 + 0.5 * k})`, opacity: 0.6 + 0.4 * k}}>{label}</div>
  );
}
// a person as a flat silhouette: head, shoulders, coat to the knee, two legs; 1.8 m tall at scale 1 (feet at y 0). pose 'stand' | 'arms' | 'wave'
const Man = ({x, y, s = 1, rot = 0, color = AMBER, o = 1, pose = 'stand', flap = 0, hat = 0}) => (
  <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
    <circle cx={0} cy={-15} r={3} fill={color} />
    {hat > 0 ? <g opacity={hat}><rect x={-2.6} y={-21} width={5.2} height={3.4} rx={0.6} fill={color} /><rect x={-4.4} y={-18} width={8.8} height={1} fill={color} /></g> : null}
    <path d="M-1.4,-12.5 L1.4,-12.5 L1.4,-11 L-1.4,-11 Z" fill={color} />
    <path d="M-3.8,-11 Q0,-12.2 3.8,-11 L5.6,-3 L-5.6,-3 Z" fill={color} />
    <rect x={-4.4} y={-3} width={2.8} height={3} fill={color} />
    <rect x={1.6} y={-3} width={2.8} height={3} fill={color} />
    {pose === 'arms' ? (
      <g>
        <path d={`M-3.5,-11 L-12,${-11.5 - 3.5 * flap} L-12,${-9.5 - 3.5 * flap} L-3,-9 Z`} fill={color} />
        <path d={`M3.5,-11 L12,${-11.5 - 3.5 * flap} L12,${-9.5 - 3.5 * flap} L3,-9 Z`} fill={color} />
      </g>
    ) : pose === 'wave' ? (
      <g>
        <path d="M-3.6,-11 L-5.8,-4.5 L-4.4,-4.2 L-2.4,-9.5 Z" fill={color} />
        <path d={`M3.5,-11 L${7 + 2 * flap},-18 L${8.6 + 2 * flap},-17.2 L5,-9.5 Z`} fill={color} />
      </g>
    ) : (
      <g>
        <path d="M-3.6,-11 L-5.8,-4.5 L-4.4,-4.2 L-2.4,-9.5 Z" fill={color} />
        <path d="M3.6,-11 L5.8,-4.5 L4.4,-4.2 L2.4,-9.5 Z" fill={color} />
      </g>
    )}
  </g>
);
// a seated silhouette facing +x (head, torso, thighs forward, shin down); 1.3 m tall seated at scale 1 (seat at y 0)
const Seated = ({x, y, s = 1, color = AMBER, o = 1, hat = 0}) => (
  <g transform={`translate(${x}, ${y}) scale(${s})`} opacity={o}>
    <circle cx={0} cy={-12.5} r={3} fill={color} />
    {hat > 0 ? <g opacity={hat}><rect x={-2.6} y={-18.6} width={5.2} height={3.4} rx={0.6} fill={color} /><rect x={-4.4} y={-15.6} width={8.8} height={1} fill={color} /></g> : null}
    <path d="M-4,-9.8 Q0,-11.2 4,-9.8 L4.4,0 L-4.4,0 Z" fill={color} />
    <rect x={-4.4} y={-1.2} width={10.5} height={2.8} rx={1} fill={color} />
    <rect x={3.8} y={0} width={2.3} height={6} fill={color} />
  </g>
);
// a crowd: n silhouettes in a row with a little jitter, k 0..1 fades them in from the middle outwards; amber = fraction lit amber (seeded)
const Crowd = ({x, y, n = 20, s = 5, k = 1, color = WHITE, spread = 40, seed = 0, amber = 0, t = 0}) => (
  <g>
    {Array.from({length: n}, (_, i) => {
      const u = i / Math.max(1, n - 1), d = Math.abs(u - 0.5) * 2;
      const kk = clamp01(k * 1.6 - d * 0.6);
      if (kk <= 0) return null;
      const lit = rnd(i + seed + 40) < amber;
      return <Man key={i} x={x + (u - 0.5) * spread * n + (rnd(i + seed) - 0.5) * 20} y={y + (rnd(i + seed + 7) - 0.5) * 8} s={s * (0.9 + 0.2 * rnd(i + seed + 3))} color={lit ? AMBER : color} o={kk * (lit ? 1 : 0.7 + 0.3 * rnd(i + seed + 9))} hat={0} />;
    })}
  </g>
);
const Bird = ({x, y, s = 1, ph = 0, color = WHITE, o = 1, rot = 0}) => {
  const wy = 14 * Math.sin(ph);
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
      <path d={`M-20,${wy} Q-10,${wy * 0.45} 0,0 Q10,${wy * 0.45} 20,${wy}`} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />
      <ellipse cx={0} cy={1} rx={6} ry={2.4} fill={color} />
    </g>
  );
};
const Wind = ({t, x0, y0, x1, y1, k = 1, n = 8, color = SKY, seed = 0}) => (k <= 0 ? null : (
  <g opacity={0.7 * k}>
    {Array.from({length: n}, (_, i) => {
      const y = y0 + rnd(i + seed) * (y1 - y0), len = 120 + rnd(i + seed + 50) * 160;
      const x = x0 + (((t * (300 + rnd(i + seed + 90) * 200) + rnd(i + seed + 20) * 2000) % (x1 - x0 + len)) - len);
      return <path key={i} d={`M${x},${y} q ${len * 0.4} -8 ${len} 0`} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />;
    })}
  </g>
));
const Puff = ({x, y, k, color = SAND2}) => (k <= 0 ? null : (
  <g transform={`translate(${x}, ${y})`} opacity={1 - k}>
    <ellipse rx={30 + 90 * k} ry={10 + 24 * k} fill={color} opacity={0.5} />
    {[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={(rnd(i + 30) - 0.5) * 200 * k} cy={-10 - rnd(i + 31) * 90 * k} r={5 + rnd(i + 32) * 6} fill={color} opacity={0.8} />)}
  </g>
));
// slow cloud tops (a row of soft bumps) across the frame at y, k 0..1
const CloudTops = ({t, y, k = 1, color = WHITE, o = 0.9}) => (k <= 0 ? null : (
  <g opacity={k * o}>
    <rect x={0} y={y} width={W} height={H - y} fill={color} opacity={0.9} />
    {Array.from({length: 16}, (_, i) => <ellipse key={i} cx={-100 + i * 140 + ((t * 12) % 140)} cy={y + 10} rx={110 + 40 * rnd(i + 300)} ry={40 + 30 * rnd(i + 301)} fill={color} />)}
  </g>
));
// a band of cloud (not filling down): soft bumps along y between x0 and x1
const CloudBand = ({t, y, x0 = 0, x1 = W, k = 1, color = WHITE, o = 0.5, n = 14}) => (k <= 0 ? null : (
  <g opacity={k * o}>
    {Array.from({length: n}, (_, i) => <ellipse key={i} cx={x0 + ((i * (x1 - x0) / n + (t * 10) % ((x1 - x0) / n)))} cy={y + 8 * Math.sin(i * 1.7)} rx={90 + 50 * rnd(i + 500)} ry={26 + 18 * rnd(i + 501)} fill={color} />)}
  </g>
));
// a sun with soft rays, for the sunset
const Sun = ({x, y, r = 90, k = 1}) => (k <= 0 ? null : (
  <g transform={`translate(${x}, ${y})`} opacity={k}>
    <circle r={r * 2.6} fill={AMBER} opacity={0.08} />
    <circle r={r * 1.6} fill={AMBER} opacity={0.12} />
    <circle r={r} fill="#FFD27A" />
  </g>
));
// a ruler between two points (horizontal) with end ticks, drawn to fraction k, and a pill with the length
function Ruler({t, fps, a, x0, x1, y, children, k = 1, w = 160, color = AMBER}) {
  if (k <= 0) return null;
  return (
    <g opacity={Math.min(1, k)}>
      <line x1={x0} y1={y} x2={lerp(x0, x1, Math.min(1, k))} y2={y} stroke={color} strokeWidth={3} />
      <line x1={x0} y1={y - 12} x2={x0} y2={y + 12} stroke={color} strokeWidth={3} />
      <line x1={x1} y1={y - 12} x2={x1} y2={y + 12} stroke={color} strokeWidth={3} opacity={k >= 0.98 ? 1 : 0} />
      <SvgPill t={t} fps={fps} a={a} x={(x0 + x1) / 2} y={y} w={w} size={22}>{children}</SvgPill>
    </g>
  );
}
// a clock face with hour and minute hands (h, m), k 0..1 pops it
const Clock = ({x, y, r = 110, h = 10, m = 30, k = 1, color = WHITE, face = NAVY2}) => (k <= 0 ? null : (
  <g transform={`translate(${x}, ${y}) scale(${Math.min(1, k)})`} opacity={Math.min(1, k)}>
    <circle r={r} fill={face} stroke={color} strokeWidth={5} />
    {Array.from({length: 12}, (_, i) => <line key={i} x1={0} y1={-r + 8} x2={0} y2={-r + (i % 3 ? 18 : 26)} stroke={color} strokeWidth={i % 3 ? 2 : 4} transform={`rotate(${i * 30})`} />)}
    <line x1={0} y1={10} x2={0} y2={-r * 0.55} stroke={color} strokeWidth={8} strokeLinecap="round" transform={`rotate(${(h % 12) * 30 + m * 0.5})`} />
    <line x1={0} y1={10} x2={0} y2={-r * 0.8} stroke={AMBER} strokeWidth={5} strokeLinecap="round" transform={`rotate(${m * 6})`} />
    <circle r={7} fill={AMBER} />
  </g>
));
// a speech bubble with a tail (flip = tail on the right)
const Bubble = ({x, y, k = 1, text, bg = WHITE, fg = NAVY, w = 200, flip = false, size = 28}) => (k <= 0 ? null : (
  <g transform={`translate(${x}, ${y}) scale(${Math.min(1, k)})`} opacity={Math.min(1, k)}>
    <rect x={-w / 2} y={-34} width={w} height={68} rx={22} fill={bg} />
    <path d={flip ? `M${w * 0.18},30 L${w * 0.3},64 L${w * 0.36},30 Z` : `M${-w * 0.18},30 L${-w * 0.3},64 L${-w * 0.36},30 Z`} fill={bg} />
    <text y={10} textAnchor="middle" fontFamily={SMALL} fontWeight={800} fontSize={size} fill={fg} letterSpacing={2}>{text}</text>
  </g>
));
// an airline tail (a plain fin shape with the name as text; no logos)
const TailFin = ({x, y, k = 1, color = AMBER, name, o = 1}) => (k <= 0 ? null : (
  <g transform={`translate(${x}, ${y}) scale(${Math.min(1, k)})`} opacity={Math.min(1, k) * o}>
    <path d="M0,0 L70,-120 L170,-120 L210,0 Z" fill={color} />
    <path d="M-40,0 L260,0 L260,20 L-40,20 Z" fill={WHITE} opacity={0.85} />
    <text x={290} y={-30} fontFamily={SMALL} fontWeight={800} fontSize={30} fill={WHITE} letterSpacing={3}>{name}</text>
  </g>
));
// a lightning bolt: a jagged line from (x0, y0) to (x1, y1), seeded, with a soft glow; k 0..1
const boltD = (x0, y0, x1, y1, seed, n = 7) => {
  let d = `M${x0.toFixed(1)},${y0.toFixed(1)}`;
  for (let i = 1; i < n; i++) {
    const u = i / n;
    d += ` L${(lerp(x0, x1, u) + (rnd(seed + i) - 0.5) * 70).toFixed(1)},${(lerp(y0, y1, u) + (rnd(seed + i + 20) - 0.5) * 24).toFixed(1)}`;
  }
  return d + ` L${x1.toFixed(1)},${y1.toFixed(1)}`;
};
const Bolt = ({x0, y0, x1, y1, seed = 0, k = 1, w = 6}) => (k <= 0 ? null : (
  <g opacity={Math.min(1, k)}>
    <path d={boltD(x0, y0, x1, y1, seed)} stroke={SKY} strokeWidth={w * 2.4} fill="none" strokeLinejoin="round" strokeLinecap="round" opacity={0.35} />
    <path d={boltD(x0, y0, x1, y1, seed)} stroke={WHITE} strokeWidth={w} fill="none" strokeLinejoin="round" strokeLinecap="round" />
  </g>
));
// a night storm: a dark wash, a cloud deck along the top, rain streaks, a distant flash now and then (seeded, no Math.random)
const Storm = ({t, seed = 0}) => {
  const slot = Math.floor(t / 0.6), frac = t / 0.6 - slot;
  const far = rnd(slot + seed) > 0.62, fx = 200 + 1500 * rnd(slot + seed + 9);
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill="#060C1A" opacity={0.55} />
      {far ? <Bolt x0={fx} y0={200} x1={fx + 40} y1={640} seed={slot + seed} k={0.3 * (1 - frac)} w={3} /> : null}
      <rect x={0} y={0} width={W} height={190} fill={STORMY} />
      {Array.from({length: 15}, (_, i) => <ellipse key={i} cx={-100 + i * 150 + ((t * 14) % 150)} cy={180 + 10 * Math.sin(i * 1.3)} rx={120 + 40 * rnd(i + 70)} ry={50 + 30 * rnd(i + 71)} fill={STORMY} />)}
      {Array.from({length: 40}, (_, i) => { const ph = ((t * 1.4 + rnd(i + 80)) % 1); const x = 20 + i * 48 + rnd(i) * 20, y = 230 + ph * 680; return <line key={i} x1={x} y1={y} x2={x - 6} y2={y + 34} stroke={SKY} strokeWidth={2} strokeLinecap="round" opacity={(1 - ph) * 0.35} />; })}
    </g>
  );
};
// =====================================================================================================================
// drawn aircraft, all at 10 px per metre at scale 1 (REAL proportions, the client's rule). Top views: nose to +x, origin at the
// centre of the fuselage. Side views: nose to +x, origin at the centre of the fuselage. The spec tables give the real dimensions.
// =====================================================================================================================
// a jet airliner seen from above. wingAt = the wing root's position (fraction from the nose), chord = root chord (m), taper = tip
// chord / root chord, sweep = how far back the tip sits (m), ogee = Concorde's curved delta leading edge, jets = [[x, y, len, buried,
// width]] (m) nacelles on pylons (buried = inside the wing root), hump = the 747's upper deck as a lighter patch, glow 0..1 lights
// the exhausts, dims draws the span and length dimension lines
const PlaneTop = ({x, y, s = 1, rot = 0, color = WHITE, o = 1, span, len, fw = 1.1, wingAt = 0.45, chord = 2, taper = 0.6, sweep = 0, ogee = false,
                   tailSpan = 0, tailChord = 1, jets = [], hump = false, glow = 0, dims = false, accent = AMBER, children}) => {
  const L = len * 10, S = span * 10, hw = fw * 5;
  const xw = L / 2 - wingAt * L, c = chord * 10, tc = c * taper, sw = sweep * 10;
  const le = xw + c * 0.6, te = xw - c * 0.4;
  const wing = ogee
    ? `M${le},${-hw} C${le - sw * 0.5},${-hw - S * 0.05} ${le - sw * 0.72},${-S * 0.5} ${le - sw},${-S / 2} L${le - sw - tc},${-S / 2} L${te},${-hw} L${te},${hw} L${le - sw - tc},${S / 2} L${le - sw},${S / 2} C${le - sw * 0.72},${S * 0.5} ${le - sw * 0.5},${hw + S * 0.05} ${le},${hw} Z`
    : closed([[le, -hw], [le - sw, -S / 2], [le - sw - tc, -S / 2], [te, -hw], [te, hw], [le - sw - tc, S / 2], [le - sw, S / 2], [le, hw]]);
  const TS = tailSpan * 10, tcr = tailChord * 10, xt = -L / 2 + tcr * 0.15;
  const tail = TS > 0 ? closed([[xt + tcr, -hw * 0.5], [xt + tcr * 0.45, -TS / 2], [xt, -TS / 2], [xt, hw * 0.5], [xt, TS / 2], [xt + tcr * 0.45, TS / 2], [xt + tcr, hw * 0.5]]) : '';
  const nose = `M${L / 2},0 C${L / 2},${-hw} ${L / 2 - hw * 1.6},${-hw} ${L / 2 - hw * 2.5},${-hw}`;
  const fus = `${nose} L${-L / 2 + hw * 1.5},${-hw * 0.55} L${-L / 2},${-hw * 0.2} L${-L / 2},${hw * 0.2} L${-L / 2 + hw * 1.5},${hw * 0.55} L${L / 2 - hw * 2.5},${hw} C${L / 2 - hw * 1.6},${hw} ${L / 2},${hw} ${L / 2},0 Z`;
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
      <path d={wing} fill={color} />
      {tail ? <path d={tail} fill={color} /> : null}
      <path d={fus} fill={color} />
      {hump ? <rect x={L / 2 - L * 0.36} y={-hw * 0.4} width={L * 0.28} height={hw * 0.8} rx={hw * 0.4} fill={NAVY} opacity={0.18} /> : null}
      <rect x={-L / 2} y={-1} width={Math.max(8, L * 0.16)} height={2} fill={accent} opacity={0.9} />
      <path d={`M${L / 2 - hw * 4.5},${-hw * 0.55} L${L / 2 - hw * 2.5},${-hw * 0.5} L${L / 2 - hw * 2.5},${hw * 0.5} L${L / 2 - hw * 4.5},${hw * 0.55} Z`} fill={NAVY} opacity={0.55} />
      {jets.map(([jx, jy, jl, buried, jw], i) => {
        const hh = (jw || 1.2) * 5;
        return (
          <g key={i} transform={`translate(${jx * 10}, ${jy * 10})`}>
            {buried ? <rect x={-jl * 5} y={-3.5} width={jl * 10} height={7} rx={2} fill={NAVY} opacity={0.8} /> : <rect x={-jl * 5} y={-hh} width={jl * 10} height={hh * 2} rx={hh * 0.8} fill={color} stroke={NAVY} strokeWidth={1.2} />}
            {glow > 0 ? <ellipse cx={-jl * 5 - 10 * glow} cy={0} rx={14 * glow} ry={hh * 0.7} fill={AMBER} opacity={0.9 * glow} /> : null}
            {glow > 0 ? <ellipse cx={-jl * 5 - 28 * glow} cy={0} rx={22 * glow} ry={hh * 0.5} fill={AMBER} opacity={0.4 * glow} /> : null}
          </g>
        );
      })}
      {dims ? (
        <g opacity={0.8}>
          <line x1={le + 16} y1={-S / 2} x2={le + 16} y2={S / 2} stroke={accent} strokeWidth={1.5 / s} />
          <line x1={le + 10} y1={-S / 2} x2={le + 22} y2={-S / 2} stroke={accent} strokeWidth={1.5 / s} />
          <line x1={le + 10} y1={S / 2} x2={le + 22} y2={S / 2} stroke={accent} strokeWidth={1.5 / s} />
          <text x={le + 26} y={5} fontFamily={SMALL} fontWeight={800} fontSize={16 / Math.sqrt(s)} fill={accent} letterSpacing={1}>{span} M</text>
          <line x1={-L / 2} y1={S / 2 + 16} x2={L / 2} y2={S / 2 + 16} stroke={accent} strokeWidth={1.5 / s} />
          <line x1={-L / 2} y1={S / 2 + 10} x2={-L / 2} y2={S / 2 + 22} stroke={accent} strokeWidth={1.5 / s} />
          <line x1={L / 2} y1={S / 2 + 10} x2={L / 2} y2={S / 2 + 22} stroke={accent} strokeWidth={1.5 / s} />
          <text x={0} y={S / 2 + 20 + 16 / Math.sqrt(s)} textAnchor="middle" fontFamily={SMALL} fontWeight={800} fontSize={16 / Math.sqrt(s)} fill={accent} letterSpacing={1}>{len} M</text>
        </g>
      ) : null}
      {children}
    </g>
  );
};
// the real aircraft seen from above (span x length in metres) with their layouts; the span:length ratio is the comment
const AC = {
  comet: {span: 35, len: 28.6, fw: 3.0, wingAt: 0.52, chord: 8.5, taper: 0.28, sweep: 6.5, tailSpan: 11, tailChord: 3, jets: [[1.6, -2.4, 5, 1], [1.6, -3.9, 5, 1], [1.6, 2.4, 5, 1], [1.6, 3.9, 5, 1]]},                // Comet 1: 35 x 28.6 (1.22:1), a wide-rooted 20-degree wing, four jets buried in the roots
  b707: {span: 44.4, len: 46.6, fw: 3.8, wingAt: 0.5, chord: 9.5, taper: 0.3, sweep: 15.5, tailSpan: 14, tailChord: 5, jets: [[3.2, -7.5, 5.5], [-0.6, -13.5, 5.5], [3.2, 7.5, 5.5], [-0.6, 13.5, 5.5]]},             // 707: 44.4 x 46.6 (0.95:1), four engines on pylons, a 35-degree swept wing
  b747: {span: 59.6, len: 70.6, fw: 6.5, wingAt: 0.5, chord: 16.5, taper: 0.25, sweep: 22.5, tailSpan: 22, tailChord: 8, hump: true, jets: [[4.6, -12, 7, 0, 2.5], [-1.9, -21.3, 7, 0, 2.5], [4.6, 12, 7, 0, 2.5], [-1.9, 21.3, 7, 0, 2.5]]},   // 747-100: 59.6 x 70.6 (0.84:1), four engines, 37.5-degree sweep
  concorde: {span: 25.6, len: 61.7, fw: 2.9, wingAt: 0.70, chord: 38, taper: 0.06, sweep: 34.8, ogee: true, tailSpan: 0, jets: [[-21, -5.0, 11, 0, 1.5], [-21, -6.6, 11, 0, 1.5], [-21, 5.0, 11, 0, 1.5], [-21, 6.6, 11, 0, 1.5]]},   // Concorde: 25.6 x 61.7 (0.41:1), a long slim ogival delta starting a third back from the needle nose and running to the tail, four engines in two paired boxes under the wing (review 2)
  a300: {span: 44.8, len: 54, fw: 5.6, wingAt: 0.5, chord: 11, taper: 0.3, sweep: 12, tailSpan: 16.9, tailChord: 6, jets: [[4.4, -8.2, 7, 0, 2.6], [4.4, 8.2, 7, 0, 2.6]]},                                            // A300: 44.8 x 54 (0.83:1), two engines, wide body, 28-degree sweep
  a320: {span: 35.8, len: 37.6, fw: 4, wingAt: 0.5, chord: 7, taper: 0.3, sweep: 8.5, tailSpan: 12.5, tailChord: 3, jets: [[6, -5.7, 4.6, 0, 2.0], [6, 5.7, 4.6, 0, 2.0]]},                                              // A320: 35.8 x 37.6 (0.95:1), 25-degree sweep
  b737: {span: 35.8, len: 39.5, fw: 3.8, wingAt: 0.5, chord: 7.5, taper: 0.3, sweep: 8.5, tailSpan: 14.3, tailChord: 3.5, jets: [[5.5, -5.0, 4.4, 0, 2.1], [5.5, 5.0, 4.4, 0, 2.1]]},                                      // 737-800: 35.8 x 39.5 (0.91:1), the engines close in under the wing
  b777: {span: 64.8, len: 73.9, fw: 6.2, wingAt: 0.5, chord: 14, taper: 0.25, sweep: 20, tailSpan: 21.5, tailChord: 7, jets: [[7, -9.9, 8, 0, 3.4], [7, 9.9, 8, 0, 3.4]]},                                               // 777-300ER: 64.8 x 73.9 (0.88:1), two huge engines (3.4 m), 31.6-degree sweep
  a380: {span: 79.8, len: 72.7, fw: 7.1, wingAt: 0.5, chord: 17.5, taper: 0.2, sweep: 26, tailSpan: 30.4, tailChord: 9, jets: [[6.4, -14.5, 8, 0, 3], [-0.8, -25.5, 8, 0, 3], [6.4, 14.5, 8, 0, 3], [-0.8, 25.5, 8, 0, 3]]},   // A380: 79.8 x 72.7 (1.10:1), four engines, 33.5-degree sweep
  b787: {span: 60.1, len: 56.7, fw: 5.8, wingAt: 0.5, chord: 12, taper: 0.18, sweep: 21, tailSpan: 19.8, tailChord: 6, jets: [[4.4, -9.6, 7, 0, 2.8], [4.4, 9.6, 7, 0, 2.8]]},                                           // 787-8: 60.1 x 56.7 (1.06:1), long raked wings
};
const Plane = ({ac, ...rest}) => <PlaneTop {...AC[ac]} {...rest} />;
// a jet airliner seen from the side, nose to +x, 10 px per metre. len = fuselage length, fh = fuselage height (so len/fh is the
// slenderness), fin = fin height ABOVE the fuselage top, finRoot = fin root chord as a fraction of len, wingAt = the wing root's
// position (fraction from the nose), chord = root chord, tipChord = tip/root, sweep = how far back the tip sits, dih = the tip's rise
// (dihedral, m), flex = extra rise of the tip (the 787's wings bending up in flight), jets = [[x from the centre, diameter, drop below
// the wing line, length]] pods under the wing (diameter 0 = buried in the wing root, the Comet), windows = a row of cabin windows
// (winRx rounds them: 0.5 = square-ish), decks 2 = a second row (the A380), hump = the 747's upper deck height (m), humpLen = its
// length as a fraction of len, noseLen = a long pointed nose (m), droop 0..1 droops it (Concorde), tailplane false = none (a delta)
const JetSide = ({x, y, s = 1, rot = 0, color = WHITE, o = 1, len, fh, fin, finRoot = 0.12, wingAt = 0.5, chord, tipChord = 0.25, sweep = 0, dih = 2, flex = 0,
                  jets = [], windows = 0, winRx = 0.3, decks = 1, hump = 0, humpLen = 0.3, noseLen = 0, needle = false, droop = 0, tailplane = true, glow = 0, accent = AMBER, children}) => {
  const L = len * 10, h = fh * 5, FIN = fin * 10, root = L * finRoot, C = chord * 10;
  const nl = noseLen ? noseLen * 10 : Math.min(L * 0.14, h * 2.2), tl = L * 0.24;
  const nx = L / 2 - nl, tx = -L / 2 + tl;
  const body = `M${nx + 3},${-h} L${tx},${-h} C${tx - tl * 0.45},${-h} ${-L / 2 + tl * 0.25},${-h * 0.8} ${-L / 2},${-h * 0.5} L${-L / 2},${-h * 0.18} C${-L / 2 + tl * 0.3},${h * 0.35} ${tx - tl * 0.35},${h} ${tx},${h} L${nx + 3},${h} Z`;
  const nose = needle
    ? `M${nx + 3},${-h} Q${L / 2 - nl * 0.35},${-h * 0.55} ${L / 2},0 Q${L / 2 - nl * 0.35},${h * 0.55} ${nx + 3},${h} Z`
    : `M${nx + 3},${-h} C${L / 2 - nl * 0.45},${-h} ${L / 2},${-h * 0.55} ${L / 2},0 C${L / 2},${h * 0.55} ${L / 2 - nl * 0.45},${h} ${nx + 3},${h} Z`;
  const HUMP = hump * 10;
  const humpD = hump > 0 ? `M${nx + nl * 0.45},${-h} C${nx + nl * 0.35},${-h - HUMP * 0.9} ${nx + nl * 0.1},${-h - HUMP} ${nx - nl * 0.3},${-h - HUMP} L${nx - L * humpLen * 0.55},${-h - HUMP} C${nx - L * humpLen * 0.8},${-h - HUMP} ${nx - L * humpLen * 0.92},${-h - HUMP * 0.3} ${nx - L * humpLen},${-h} Z` : '';
  const rootLE = -L / 2 + root, tipTE = -L / 2 + root * 0.06, tipLE = tipTE + root * 0.42;
  const finD = closed([[rootLE, -h * 0.9], [tipLE, -h - FIN], [tipTE, -h - FIN], [-L / 2, -h * 0.5]]);
  const tpY = -h * 0.15, tpRoot = root * 0.6;
  const tpD = closed([[-L / 2 + tpRoot, tpY - 2], [-L / 2 - root * 0.08, tpY + 1], [-L / 2 - root * 0.08, tpY + 5], [-L / 2 + tpRoot * 0.3, tpY + 2]]);
  const xw = L / 2 - wingAt * L, LE = xw + C * 0.55, TE = xw - C * 0.45;
  const wy = h * 0.45, th = Math.max(2, C * 0.07), sw = sweep * 10, rise = (dih + flex) * 10;
  const tipX = LE - sw, tipY = wy - rise, tc = C * tipChord, bow = flex * 8;
  const wingD = `M${LE},${wy - th} Q${lerp(LE, tipX, 0.5)},${lerp(wy - th, tipY - th * 0.4, 0.5) + bow} ${tipX},${tipY - th * 0.4} L${tipX - tc},${tipY + th * 0.3} Q${lerp(tipX - tc, TE, 0.5)},${lerp(tipY + th * 0.3, wy + th, 0.5) + bow} ${TE},${wy + th} Z`;
  const cockD = hump > 0
    ? closed([[nx + nl * 0.35, -h - HUMP * 0.1], [nx + nl * 0.2, -h - HUMP * 0.78], [nx - nl * 0.25, -h - HUMP * 0.88], [nx - nl * 0.25, -h - HUMP * 0.18]])
    : closed([[nx + nl * 0.18, -h * 0.92], [nx + nl * 0.5, -h * 0.7], [nx + nl * 0.42, -h * 0.38], [nx - nl * 0.2, -h * 0.38], [nx - nl * 0.2, -h * 0.92]]);
  const ww = Math.max(2, h * 0.14), wh = Math.max(2.5, h * 0.2), wx0 = nx - nl * 0.35, wx1 = tx + tl * 0.1;
  const rows = decks === 2 ? [-h * 0.55, -h * 0.02] : [-h * 0.4];
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
      <path d={finD} fill={color} />
      {tailplane ? <path d={tpD} fill={color} opacity={0.85} /> : null}
      <path d={body} fill={color} />
      {hump > 0 ? <path d={humpD} fill={color} /> : null}
      <g transform={`rotate(${droop * 12.5}, ${nx}, 0)`}><path d={nose} fill={color} /></g>
      <path d={cockD} fill={NAVY} opacity={0.6} />
      {windows > 0 ? rows.map((ry, r) => Array.from({length: windows}, (_, i) => <rect key={`${r}-${i}`} x={wx0 - i * ((wx0 - wx1) / windows)} y={ry - wh / 2} width={ww} height={wh} rx={wh * winRx} fill={NAVY} opacity={0.6} />)) : null}
      <rect x={-L / 2 + tl * 0.3} y={h * 0.08} width={nx - (-L / 2 + tl * 0.3)} height={Math.max(2, h * 0.07)} fill={accent} opacity={0.85} />
      <path d={wingD} fill={color} stroke={NAVY} strokeWidth={0.6} />
      {jets.map(([jx, dia, drop, jl], i) => {
        const cx = jx * 10, py = wy + drop * 10;
        if (dia <= 0) return (
          <g key={i}>
            <rect x={cx - jl * 5} y={wy - h * 0.3} width={jl * 10} height={h * 0.6} rx={h * 0.2} fill={color} stroke={NAVY} strokeWidth={0.8} />
            <ellipse cx={cx + jl * 5 - 1} cy={wy} rx={h * 0.1} ry={h * 0.26} fill={NAVY} opacity={0.6} />
            {glow > 0 ? <ellipse cx={cx - jl * 5 - h * 0.6 * glow} cy={wy} rx={h * 0.9 * glow} ry={h * 0.16} fill={AMBER} opacity={0.9 * glow} /> : null}
          </g>
        );
        return (
          <g key={i}>
            <path d={closed([[cx + jl * 2.5, wy], [cx - jl * 0.5, wy], [cx - jl * 1.5, py - dia * 3.5], [cx + jl * 3, py - dia * 3.5]])} fill={color} opacity={0.9} />
            <rect x={cx - jl * 5} y={py - dia * 5} width={jl * 10} height={dia * 10} rx={dia * 3.5} fill={color} stroke={NAVY} strokeWidth={0.8} />
            <ellipse cx={cx + jl * 5 - dia * 1.2} cy={py} rx={dia * 1.2} ry={dia * 4.3} fill={NAVY} opacity={0.55} />
            {glow > 0 ? <ellipse cx={cx - jl * 5 - dia * 4 * glow} cy={py} rx={dia * 6 * glow} ry={dia * 2.2} fill={AMBER} opacity={0.9 * glow} /> : null}
            {glow > 0 ? <ellipse cx={cx - jl * 5 - dia * 12 * glow} cy={py} rx={dia * 10 * glow} ry={dia * 1.4} fill={AMBER} opacity={0.4 * glow} /> : null}
          </g>
        );
      })}
      {children}
    </g>
  );
};
// the real side views (metres): length x fuselage height, so the slenderness is in the drawing, not in the eye
//   Comet 1      28.6 x 3.0  (9.5:1),  fin 4.5 m above the top, four jets buried in the wing roots, small square-ish windows
//   Boeing 707   46.6 x 3.8  (12.3:1), fin 6.3 m, four engines on pylons (two show from the side)
//   747-100      70.6 x 6.5  (10.9:1), the hump (upper deck) 2 m on top at the front, fin 8.5 m, four engines
//   Concorde     61.7 x 3.1  (19.9:1), pencil-thin, an 11 m needle nose that droops, a tall thin fin 6.2 m, no tailplane, the delta
//                starting a third back and running to the tail, the engine boxes under it (review 2)
//   Airbus A300  54 x 5.6    (9.6:1),  two engines, the wide body
//   Airbus A320  37.6 x 4.0  (9.4:1)
//   737-800      39.5 x 3.8  (10.4:1), the engines close under the wing
//   777-300ER    73.9 x 6.2  (11.9:1), two huge engines (3.4 m across)
//   A380         72.7 x 8.4  (8.7:1),  the full double deck (two window rows), fin 9.4 m, four engines
//   787-8        56.7 x 5.9  (9.6:1),  long raked wings that flex up (flex)
const SIDE = {
  comet: {len: 28.6, fh: 3.0, fin: 4.5, finRoot: 0.13, wingAt: 0.55, chord: 6.5, sweep: 7, dih: 1.4, windows: 12, winRx: 0.15, jets: [[1.0, 0, 0, 5.5]]},
  b707: {len: 46.6, fh: 3.8, fin: 6.3, finRoot: 0.12, wingAt: 0.5, chord: 9.5, sweep: 15, dih: 2.2, windows: 24, jets: [[3.2, 1.3, 1.1, 5.5], [-0.6, 1.3, 1.2, 5.5]]},
  b747: {len: 70.6, fh: 6.5, fin: 8.5, finRoot: 0.12, wingAt: 0.5, chord: 16, sweep: 22, dih: 3.0, windows: 34, hump: 2.0, humpLen: 0.3, jets: [[4.6, 2.5, 1.6, 7], [-1.9, 2.5, 1.9, 7]]},
  concorde: {len: 61.7, fh: 3.1, fin: 6.2, finRoot: 0.17, wingAt: 0.70, chord: 38, tipChord: 0.06, sweep: 34.8, dih: -0.8, windows: 24, noseLen: 11, needle: true, tailplane: false, jets: [[-21, 1.7, 1.0, 11]]},
  a300: {len: 54, fh: 5.6, fin: 7.5, finRoot: 0.12, wingAt: 0.5, chord: 11, sweep: 14, dih: 2.5, windows: 28, jets: [[4.4, 2.6, 1.7, 7]]},
  a320: {len: 37.6, fh: 4.0, fin: 5.9, finRoot: 0.13, wingAt: 0.5, chord: 7, sweep: 10, dih: 2, windows: 20, jets: [[6, 2.0, 1.4, 4.6]]},
  b737: {len: 39.5, fh: 3.8, fin: 6.2, finRoot: 0.13, wingAt: 0.5, chord: 7.5, sweep: 9, dih: 2, windows: 22, jets: [[5.5, 2.1, 1.1, 4.4]]},
  b777: {len: 73.9, fh: 6.2, fin: 8.7, finRoot: 0.12, wingAt: 0.5, chord: 14, sweep: 18, dih: 3.2, windows: 36, jets: [[7, 3.4, 2.3, 8]]},
  a380: {len: 72.7, fh: 8.4, fin: 9.4, finRoot: 0.12, wingAt: 0.5, chord: 17.5, sweep: 24, dih: 3.5, windows: 30, decks: 2, jets: [[6.4, 3.0, 2.0, 8], [-0.8, 3.0, 2.3, 8]]},
  b787: {len: 56.7, fh: 5.9, fin: 7.0, finRoot: 0.12, wingAt: 0.5, chord: 12, tipChord: 0.12, sweep: 21, dih: 3.0, windows: 28, jets: [[4.4, 2.8, 2.0, 7]]},
};
const Side = ({ac, ...rest}) => <JetSide {...SIDE[ac]} {...rest} />;
// a piston airliner seen from the side (Chapter 2's drawing): the Boeing 307 Stratoliner, 22.7 m long x 3.6 m tall (6.3:1), fin 6 m
// above the top, a thick straight low wing, four engines ahead of it; nose to +x, 10 px per metre
const PistonSide = ({x, y, s = 1, rot = 0, color = WHITE, o = 1, spin = 1}) => {
  const L = 227, h = 18, FIN = 60, root = L * 0.12, C = 50;
  const nl = Math.min(L * 0.16, h * 2.4), tl = L * 0.2, nx = L / 2 - nl, tx = -L / 2 + tl;
  const fus = `M${L / 2},0 C${L / 2},${-h * 0.5} ${L / 2 - nl * 0.45},${-h} ${nx},${-h} L${tx},${-h * 0.9} L${-L / 2},${-h * 0.22} L${-L / 2},${h * 0.1} L${tx},${h} L${nx},${h} C${L / 2 - nl * 0.45},${h} ${L / 2},${h * 0.5} ${L / 2},0 Z`;
  const rootLE = -L / 2 + root, tipTE = -L / 2 + root * 0.06, tipLE = tipTE + root * 0.42;
  const finD = closed([[rootLE, -h * 0.85], [tipLE, -h - FIN], [tipTE, -h - FIN], [-L / 2, -h * 0.22]]);
  const xw = 0, LE = xw + C * 0.6, TE = xw - C * 0.4, wy = h * 0.4, th = 5, dih = h * 0.5;
  const wingD = closed([[LE, wy - th * 0.5], [LE - 5, wy + dih - th * 0.25], [LE - 5 - C * 0.45, wy + dih + th * 0.25], [TE, wy + th * 0.5]]);
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
      <path d={finD} fill={color} />
      <path d={closed([[-L / 2 + root * 0.6, -h * 0.15 - 1.5], [-L / 2 - root * 0.05, -h * 0.15 + 1.5], [-L / 2 - root * 0.05, -h * 0.15 + 4.5], [-L / 2 + root * 0.18, -h * 0.15 + 1.5]])} fill={color} opacity={0.85} />
      <path d={fus} fill={color} />
      <path d={`M${nx + nl * 0.15},${-h * 0.92} L${nx + nl * 0.5},${-h * 0.75} L${nx + nl * 0.4},${-h * 0.35} L${nx - nl * 0.25},${-h * 0.35} L${nx - nl * 0.25},${-h * 0.92} Z`} fill={NAVY} opacity={0.6} />
      {Array.from({length: 10}, (_, i) => <rect key={i} x={nx - nl * 0.5 - i * ((nx - tx) * 0.78 / 10)} y={-h * 0.45} width={3} height={4} rx={1} fill={NAVY} opacity={0.6} />)}
      <path d={wingD} fill={color} stroke={NAVY} strokeWidth={0.6} />
      {[0.9, 0.5, 0.1, -0.3].map((ex, i) => (
        <g key={i} transform={`translate(${LE + ex * 10}, ${wy})`} opacity={1 - i * 0.12}>
          <rect x={-C * 0.9} y={-h * 0.3} width={C * 1.1} height={h * 0.95} rx={h * 0.3} fill={color} stroke={NAVY} strokeWidth={0.8} />
          <ellipse cx={C * 0.22} cy={h * 0.17} rx={1.5 + 1.5 * (1 - spin)} ry={h * 1.3 * (0.4 + 0.6 * spin)} fill={color} opacity={0.6} />
        </g>
      ))}
    </g>
  );
};
// the 1903 Wright Flyer seen from the side, nose to +x: 6.4 m long, two wings 1.8 m apart, canard ahead, rudder behind (Chapter 1-2's)
const FlyerSide = ({x, y, s = 1, rot = 0, color = WHITE, o = 1, pilot = 1, spin = 1}) => (
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
    <ellipse cx={-14} cy={-9} rx={1.2 + 1.5 * (1 - spin)} ry={12 * (0.4 + 0.6 * spin)} fill={color} opacity={0.7} />
    <g opacity={pilot}>
      <rect x={-8} y={-4.5} width={17} height={3} rx={1.5} fill={AMBER} />
      <circle cx={10} cy={-3.5} r={2} fill={AMBER} />
    </g>
    <rect x={2} y={-9} width={6} height={5} rx={1} fill={color} opacity={0.9} />
  </g>
);
// the beach at Kill Devil Hills: sand with ripples, the launch rail (Chapter 1-2's)
const Sand = ({t, y = 820, rail = null, wind = 1}) => (
  <g>
    <rect x={0} y={y} width={W} height={H - y} fill={SAND} />
    <path d={`M0,${y} ${Array.from({length: 18}, (_, i) => `q 54 ${-6 - 4 * Math.sin(i * 2.1)} 108 0`).join(' ')}`} stroke={SAND2} strokeWidth={5} fill="none" />
    <Wind t={t} x0={0} y0={140} x1={W} y1={y - 60} k={wind} n={16} seed={17} />
    {rail ? <line x1={rail[0]} y1={y - 3} x2={rail[1]} y2={y - 3} stroke={WHITE} strokeWidth={6} opacity={0.85} /> : null}
  </g>
);
// a cockpit seen from behind: the windscreen (sky in the panes), glareshield, panel with dials, the pedestal with two throttles, two
// seats with two pilots (heads and shoulders, silhouettes). 1,040 px wide at scale 1, centred at the pedestal
const Cockpit = ({x = 960, y = 560, s = 1, children}) => (
  <g transform={`translate(${x}, ${y}) scale(${s})`}>
    <path d="M-520,-380 L520,-380 L440,-150 L-440,-150 Z" fill={SKY} opacity={0.45} />
    <path d="M-520,-380 L520,-380 L440,-150 L-440,-150 Z" fill="none" stroke={WHITE} strokeWidth={8} opacity={0.7} />
    {[-150, 0, 150].map((px) => <line key={px} x1={px * 1.15} y1={-380} x2={px} y2={-150} stroke={WHITE} strokeWidth={8} opacity={0.7} />)}
    <rect x={-460} y={-150} width={920} height={40} rx={8} fill={NAVY2} stroke={WHITE} strokeWidth={2} />
    <rect x={-440} y={-110} width={880} height={160} rx={10} fill="#0A1628" stroke={WHITE} strokeWidth={2} opacity={0.95} />
    {[-330, -250, -170, 170, 250, 330].map((dx) => <circle key={dx} cx={dx} cy={-30} r={26} fill={NAVY} stroke={SILVER} strokeWidth={2} />)}
    <rect x={-60} y={50} width={120} height={220} rx={10} fill={NAVY2} stroke={WHITE} strokeWidth={2} />
    {[-18, 18].map((dx) => <g key={dx}><line x1={dx} y1={140} x2={dx} y2={90} stroke={SILVER} strokeWidth={6} /><circle cx={dx} cy={86} r={9} fill={AMBER} /></g>)}
    {[-1, 1].map((sg) => (
      <g key={sg} transform={`translate(${sg * 230}, 0)`}>
        <rect x={-90} y={-20} width={180} height={300} rx={26} fill={NAVY2} stroke={WHITE} strokeWidth={2} />
        <path d="M-70,110 Q0,40 70,110 L70,230 L-70,230 Z" fill={AMBER} />
        <circle cx={0} cy={30} r={42} fill={AMBER} />
      </g>
    ))}
    {children}
  </g>
);
// =====================================================================================================================
// THE SCENES, one per narration line
// =====================================================================================================================
// ---------- line 0: LONDON -> JOHANNESBURG on a real map (GBR to ZAF); the Comet 1 side view to scale with its square-ish windows on
// the right; passengers climb the stairs on "climb"; "2 MAY 1952" on "second"; the dotted route flies from "bound"; "FIRST JET
// AIRLINER SERVICE" on "first" ----------
function Scene0({t, at, fps, a, b}) {
  const london = at(0, 'London'), second = at(0, 'second'), climb = at(0, 'climb'), comet = at(0, 'Comet'), bound = at(0, 'bound'), jnb = at(0, 'Johannesburg'), first = at(0, 'first');
  const MB = [80, 90, 700, 790];
  const proj = fitBox(LL.LON_JNB, MB, 40);
  const A = [-0.45, 51.47], B = [28.24, -26.13];
  const pa = proj(A), pb = proj(B);
  const pts = greatCircle(proj, A, B, 60);
  const p = ease(t, bound, Math.max(1.5, b - 0.6 - bound), Easing.inOut(Easing.quad));
  const g = gcAt(proj, A, B, p);
  const S = 2.8, cx = 1330, cy = 470;            // the Comet side view: 28.6 m -> 800 px
  const gy = cy + 15 * S + 70;                     // the ground (the gear is ~2.5 m tall)
  const dx = cx + 143 * S - 40 * S;                // the forward door
  const kC = pop(t, a + 0.2, fps, soft);
  const walk = ease(t, climb, 2.6, Easing.inOut(Easing.quad));
  const pax = Array.from({length: 6}, (_, i) => {
    const u = clamp01(walk * 1.5 - i * 0.1);
    if (u <= 0) return null;
    const onStairs = u > 0.6, v = (u - 0.6) / 0.4;
    const x = onStairs ? lerp(dx + 130, dx + 10, v) : lerp(cx - 420, dx + 130, u / 0.6);
    const y = onStairs ? gy - 72 * v : gy;
    return <Man key={i} x={x} y={y} s={S} color={AMBER} o={u > 0.95 ? 1 - (u - 0.95) * 20 : 1} hat={i % 2 ? 1 : 0} />;
  });
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['GBR', 'ZAF']} box={MB} k={pop(t, a, fps, soft)} id="m0">
          {dottedPts(pts, p, AMBER, 4)}
          <Pin t={t} fps={fps} a={london} pt={pa} label="LONDON" lx={22} ly={10} anchor="start" />
          <Pin t={t} fps={fps} a={jnb} pt={pb} label="JOHANNESBURG" lx={0} ly={40} />
          {t >= bound && p < 1 ? <Plane ac="comet" x={g.x} y={g.y} s={0.45} rot={g.ang} glow={0.6} /> : null}
        </MapPanel>
        <SvgPill t={t} fps={fps} a={second} x={MB[0] + 180} y={MB[1] + 50} w={220} size={22}>2 MAY 1952</SvgPill>
        <g opacity={Math.min(1, kC)}>
          <line x1={880} y1={gy + 2} x2={1860} y2={gy + 2} stroke={WHITE} strokeWidth={3} opacity={0.35} />
          {[cx + 60 * S, cx - 20 * S].map((wx) => <g key={wx}><line x1={wx} y1={cy + 12 * S} x2={wx} y2={gy - 10} stroke={WHITE} strokeWidth={4} /><circle cx={wx} cy={gy - 9} r={9} fill={WHITE} /></g>)}
          <Side ac="comet" x={cx} y={cy} s={S} glow={0} />
          <path d={`M${dx + 130},${gy} L${dx + 10},${gy - 72} L${dx - 20},${gy - 72} L${dx - 20},${gy} Z`} fill={SILVER} opacity={0.85} />
          {[0.2, 0.4, 0.6, 0.8].map((u) => <line key={u} x1={lerp(dx + 130, dx + 10, u)} y1={gy - 72 * u} x2={lerp(dx + 130, dx + 10, u) - 18} y2={gy - 72 * u} stroke={NAVY} strokeWidth={2} opacity={0.5} />)}
          <rect x={dx - 4 * S} y={cy - 12 * S} width={6 * S} height={14 * S} rx={2} fill={NAVY} opacity={0.5} />
          <Lbl x={cx} y={gy + 52} size={18} o={0.6}>DH COMET 1 · 28.6 M LONG · 35 M SPAN · SIDE VIEW</Lbl>
        </g>
        {pax}
        <SvgPill t={t} fps={fps} a={first} x={cx} y={760} w={480} size={22}>FIRST JET AIRLINER SERVICE</SvgPill>
      </svg>
    </Scene>
  );
}
// ---------- line 1: the Comet climbs above the cloud tops on "higher" (an altitude axis on the left); chevrons on "faster"; a piston
// airliner stays low in the weather with "~6 KM" on "any airliner"; "~12 KM" for the Comet; rain under the clouds on "weather";
// "1952-1954" on "two years" ----------
function Scene1({t, at, fps, a, b}) {
  const higher = at(1, 'higher'), faster = at(1, 'faster'), any = at(1, 'any'), smooth = at(1, 'smooth'), above = at(1, 'above'), weather = at(1, 'weather'), two = at(1, 'two');
  const Y0 = 860, KM = 56;
  const yOf = (km) => Y0 - km * KM;
  const climb = ease(t, higher, 2.4, Easing.inOut(Easing.quad));
  const cy = lerp(yOf(6.5), yOf(12), climb), cx = lerp(1250, 1120, climb);
  const kIn = pop(t, a, fps, soft);
  const fast = ease(t, faster, 0.8), kP = pop(t, any, fps, soft);
  const cloudY = yOf(5) + 40 * ease(t, above, 1.2, Easing.inOut(Easing.quad));
  const rain = ease(t, weather, 0.6);
  const calm = ease(t, smooth, 1.0);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={Math.min(1, kIn)}>
          <line x1={260} y1={yOf(0)} x2={260} y2={yOf(12.5)} stroke={WHITE} strokeWidth={3} opacity={0.5} />
          {Array.from({length: 13}, (_, km) => (
            <g key={km}>
              <line x1={260} y1={yOf(km)} x2={km % 2 ? 276 : 292} y2={yOf(km)} stroke={WHITE} strokeWidth={km % 2 ? 2 : 3} opacity={0.6} />
              {km % 2 === 0 ? <Lbl x={244} y={yOf(km) + 8} anchor="end" size={18} o={0.6}>{km} KM</Lbl> : null}
            </g>
          ))}
        </g>
        <CloudBand t={t} y={cloudY} x0={330} x1={1920} k={1} color={SILVER} o={0.55} n={16} />
        {rain > 0 ? Array.from({length: 22}, (_, i) => {
          const ph = ((t * 1.6 + rnd(i + 90)) % 1);
          const x = 360 + i * 70 + rnd(i) * 30, y = cloudY + 40 + ph * 150;
          return <line key={i} x1={x} y1={y} x2={x - 4} y2={y + 22} stroke={SKY} strokeWidth={3} strokeLinecap="round" opacity={rain * (1 - ph) * 0.8} />;
        }) : null}
        <g opacity={Math.min(1, kP)}>
          <PistonSide x={560} y={yOf(6)} s={2.0} spin={1} />
          <SvgPill t={t} fps={fps} a={any} x={560} y={yOf(6) - 120} w={130} size={22} bg={WHITE}>~6 KM</SvgPill>
          <Lbl x={560} y={yOf(6) + 80} size={16} o={0.55}>PISTON AIRLINER · 22.7 M</Lbl>
        </g>
        <g opacity={Math.min(1, kIn)}>
          <Chevrons t={t} x={cx - 420} y={cy} n={5} k={fast} color={AMBER} len={70} size={24} />
          <Side ac="comet" x={cx} y={cy} s={2.8} rot={-9 * Math.sin(climb * Math.PI) * (1 - 0.6 * calm)} glow={0.9} />
          <Lbl x={cx} y={cy + 90} size={16} o={0.55}>COMET 1 · 28.6 M · SAME SCALE</Lbl>
          <SvgPill t={t} fps={fps} a={higher + 1.6} x={cx + 300} y={cy - 130} w={140} size={22}>~12 KM</SvgPill>
        </g>
        <SvgPill t={t} fps={fps} a={two} x={1640} y={140} w={220} size={22} bg={WHITE}>1952-1954</SvgPill>
      </svg>
    </Scene>
  );
}
// ---------- line 2: the Mediterranean on a real map; ELBA (JAN 1954) on "two", NAPLES (APR 1954) on "months", a soft ring on
// "break" / "apart"; the Comet on the right settles to the ground on "Every" and a calm GROUNDED stamp lands on "grounded"
// (no wreckage, no bodies) ----------
function Scene2({t, at, fps, a, b}) {
  const y1954 = at(2, '1954'), two = at(2, 'two'), brk = at(2, 'break'), months = at(2, 'months'), apart = at(2, 'apart'), every = at(2, 'Every'), grounded = at(2, 'grounded');
  const MB = [80, 90, 1040, 790];
  const proj = fitBox(LL.MED, MB, 40);
  const elba = proj([10.3, 42.78]), naples = proj([14.25, 40.85]);
  const S = 2.2, cx = 1500, gy = 700;
  const down = ease(t, every, 1.2, Easing.inOut(Easing.quad));
  const cy = lerp(430, gy - 15 * S - 55, down);
  const kG = pop(t, grounded, fps, bouncy);
  const ring = (since, pt) => (t >= since ? [0, 1].map((i) => { const ph = clamp01((t - since - i * 0.35) / 1.4); return ph > 0 && ph < 1 ? <circle key={i} cx={pt[0]} cy={pt[1]} r={10 + 70 * ph} fill="none" stroke={RED} strokeWidth={3 * (1 - ph)} opacity={(1 - ph) * 0.8} /> : null; }) : null);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['ITA']} box={MB} k={pop(t, a, fps, soft)} id="m2">
          {ring(brk, elba)}
          {ring(apart, naples)}
          <Pin t={t} fps={fps} a={two} pt={elba} label="ELBA" sub="JAN 1954" lx={-24} ly={-14} anchor="end" color={RED} />
          <Pin t={t} fps={fps} a={months} pt={naples} label="NAPLES" sub="APR 1954" lx={26} ly={10} anchor="start" color={RED} />
        </MapPanel>
        <SvgPill t={t} fps={fps} a={y1954} x={MB[0] + 150} y={MB[1] + 50} w={140} size={24}>1954</SvgPill>
        <g opacity={1 - 0.45 * Math.min(1, kG)}>
          <line x1={1180} y1={gy + 2} x2={1840} y2={gy + 2} stroke={WHITE} strokeWidth={3} opacity={0.35 * down} />
          <Side ac="comet" x={cx} y={cy} s={S} rot={-6 * (1 - down)} glow={0.8 * (1 - down)} />
          {down > 0.5 ? [cx + 60 * S, cx - 20 * S].map((wx) => <g key={wx} opacity={(down - 0.5) * 2}><line x1={wx} y1={cy + 12 * S} x2={wx} y2={gy - 8} stroke={WHITE} strokeWidth={3} /><circle cx={wx} cy={gy - 7} r={7} fill={WHITE} /></g>) : null}
        </g>
        {kG > 0 ? (
          <g transform={`translate(${cx}, ${cy - 10}) rotate(-12) scale(${Math.min(1.15, kG)})`} opacity={Math.min(1, kG)}>
            <rect x={-200} y={-44} width={400} height={88} rx={14} fill="none" stroke={RED} strokeWidth={8} />
            <text y={16} textAnchor="middle" fontFamily={BIG} fontSize={48} fill={RED} letterSpacing={4}>GROUNDED</text>
          </g>
        ) : null}
      </svg>
    </Scene>
  );
}
// ---------- line 3: a Comet fuselage in a giant water tank: the water rises on "water"; a pressure gauge cycles up and down from
// "pressurise" with a cycle counter from "again"; on "cracks" a magnifier shows a hairline crack growing from a window corner, a
// second corner on "corners", a roof opening on "roof", the window pulses on "windows" ----------
function Scene3({t, at, fps, a, b}) {
  const water = at(3, 'water'), press = at(3, 'pressurise'), again = at(3, 'again'), cracks = at(3, 'cracks'), corners = at(3, 'corners'), roof = at(3, 'roof'), windows = at(3, 'windows');
  const TB = [300, 150, 1180, 600];
  const kT = pop(t, a, fps, soft);
  const level = lerp(TB[1] + TB[3], TB[1] + 70, ease(t, water, 1.8, Easing.inOut(Easing.quad)));
  const phase = t >= press ? (t - press) * 1.1 : 0;
  const needle = -120 + 240 * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2));
  const cycles = t >= again ? Math.floor((t - again) * 1.1) + 1 : 0;
  const kG = pop(t, press, fps, soft), kN = pop(t, again, fps, bouncy);
  const k1 = pop(t, cracks, fps, soft), c1 = ease(t, cracks, 1.4), c2 = ease(t, corners, 1.0), kR = pop(t, roof, fps, soft), c3 = ease(t, roof, 1.2);
  const pulse = t >= windows ? 1 + 0.06 * Math.sin((t - windows) * 10) : 1;
  const crack = (sx, sy) => `M0,0 l${12 * sx},${-18 * sy} l${-5 * sx},${-14 * sy} l${15 * sx},${-20 * sy} l${-3 * sx},${-16 * sy} l${13 * sx},${-18 * sy} l${-4 * sx},${-12 * sy}`;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <defs><clipPath id="tank3"><rect x={TB[0]} y={TB[1]} width={TB[2]} height={TB[3]} rx={12} /></clipPath></defs>
        <g opacity={Math.min(1, kT)}>
          <rect x={TB[0]} y={TB[1]} width={TB[2]} height={TB[3]} rx={12} fill={NAVY2} opacity={0.7} />
          <g clipPath="url(#tank3)">
            <Side ac="comet" x={890} y={470} s={3.2} glow={0} />
            <path d={`M${TB[0]},${level} ${Array.from({length: 12}, (_, i) => `q 50 ${-7 * Math.sin(t * 3 + i)} 100 0`).join(' ')} L${TB[0] + TB[2]},${TB[1] + TB[3]} L${TB[0]},${TB[1] + TB[3]} Z`} fill={SKY} opacity={0.38} />
          </g>
          <rect x={TB[0]} y={TB[1]} width={TB[2]} height={TB[3]} rx={12} fill="none" stroke={SILVER} strokeWidth={8} />
          {Array.from({length: 14}, (_, i) => <circle key={i} cx={TB[0] + 40 + i * 84} cy={TB[1] + TB[3] - 16} r={4} fill={SILVER} opacity={0.7} />)}
          <Lbl x={890} y={TB[1] + TB[3] + 40} size={18} o={0.6}>COMET FUSELAGE · 28.6 M · IN A WATER TANK</Lbl>
        </g>
        <g transform={`translate(1700, 330) scale(${Math.min(1, kG)})`} opacity={Math.min(1, kG)}>
          <circle r={120} fill={NAVY2} stroke={SILVER} strokeWidth={6} />
          {Array.from({length: 13}, (_, i) => <line key={i} x1={0} y1={-104} x2={0} y2={i % 3 ? -94 : -84} stroke={WHITE} strokeWidth={i % 3 ? 2 : 4} transform={`rotate(${-120 + i * 20})`} opacity={0.8} />)}
          <path d="M-110,30 A118,118 0 0 1 110,30" stroke={RED} strokeWidth={6} fill="none" opacity={0.0} />
          <line x1={0} y1={14} x2={0} y2={-92} stroke={AMBER} strokeWidth={8} strokeLinecap="round" transform={`rotate(${needle})`} />
          <circle r={12} fill={AMBER} />
        </g>
        <g transform={`translate(1700, 520) scale(${Math.min(1, kN)})`} opacity={Math.min(1, kN)}>
          <text y={20} textAnchor="middle" fontFamily={BIG} fontSize={64} fill={AMBER}>{cycles}</text>
          <text y={56} textAnchor="middle" fontFamily={SMALL} fontWeight={800} fontSize={20} fill={WHITE} letterSpacing={3}>CYCLES</text>
        </g>
        <g transform={`translate(1240, 440) scale(${Math.min(1, k1) * pulse})`} opacity={Math.min(1, k1)}>
          <circle r={176} fill={NAVY} stroke={AMBER} strokeWidth={5} />
          <rect x={-60} y={-76} width={120} height={152} rx={4} fill={SKY} opacity={0.85} />
          <rect x={-60} y={-76} width={120} height={152} rx={4} fill="none" stroke={SILVER} strokeWidth={8} />
          <path d={crack(1, 1)} transform="translate(60, -76)" stroke={RED} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - c1} />
          <path d={crack(-1, -1)} transform="translate(-60, 76)" stroke={RED} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - c2} />
        </g>
        <g transform={`translate(560, 300) scale(${Math.min(1, kR)})`} opacity={Math.min(1, kR)}>
          <circle r={130} fill={NAVY} stroke={AMBER} strokeWidth={5} />
          <rect x={-70} y={-30} width={140} height={60} rx={4} fill={NAVY2} />
          <rect x={-70} y={-30} width={140} height={60} rx={4} fill="none" stroke={SILVER} strokeWidth={8} />
          <path d={crack(1, 1)} transform="translate(70, -30)" stroke={RED} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - c3} />
          <path d={crack(-1, 1)} transform="translate(-70, -30)" stroke={RED} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - c3} />
          <Lbl x={0} y={110} size={14} color={AMBER} o={0.9}>ROOF OPENING</Lbl>
        </g>
      </svg>
    </Scene>
  );
}
// ---------- line 4: a square-cornered window (1952) and a rounded one (now): the frames thicken on "stronger"; the stress lines flow
// round the rounded window on "rounded" and bunch red at the square's corners on "sharp corners"; "ROUNDED"; on "window" the
// rounded one shows a view (sky, a wing tip) ----------
function Scene4({t, at, fps, a, b}) {
  const stronger = at(4, 'stronger'), rounded = at(4, 'rounded'), sharp = at(4, 'sharp'), corners = at(4, 'corners'), look = at(4, 'look'), window = at(4, 'window');
  const kL = pop(t, a + 0.2, fps, soft), kR = pop(t, rounded, fps, soft);
  const frame = ease(t, stronger, 0.8, Easing.out(Easing.back(1.4)));
  const kSharp = ease(t, sharp, 0.6), flowL = ease(t, a + 0.6, 1.4), flowR = ease(t, rounded + 0.2, 1.4);
  const view = ease(t, window, 0.6);
  const pulse = t >= corners ? 0.5 + 0.5 * Math.sin((t - corners) * 8) : 0;
  const hw = 120, hh = 150;
  const flow = (round, color, kk) => {
    const out = [];
    for (let j = 0; j < 5; j++) {
      const gap = 10 + 8 * (4 - j);
      for (const sg of [-1, 1]) {
        const x0 = sg * (108 - 24 * j), X = sg * (hw + gap), Y = hh + gap, R = (round ? 70 : 0) + gap;
        const d = round
          ? `M${x0},-330 L${x0},${-Y} Q${X},${-Y} ${X},${-Y + R} L${X},${Y - R} Q${X},${Y} ${x0},${Y} L${x0},330`
          : `M${x0},-330 L${x0},${-Y} L${X},${-Y} L${X},${Y} L${x0},${Y} L${x0},330`;
        out.push(<path key={`${j}${sg}`} d={d} stroke={color} strokeWidth={3} fill="none" opacity={0.7} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - kk} />);
      }
    }
    for (let m = 0; m < 3; m++) for (const sg of [-1, 1]) {
      const x0 = sg * (hw + 62 + 36 * m);
      out.push(<line key={`o${m}${sg}`} x1={x0} y1={-330} x2={x0} y2={330} stroke={color} strokeWidth={3} opacity={0.35 * kk} />);
    }
    return out;
  };
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(560, 470) scale(${Math.min(1, kL)})`} opacity={Math.min(1, kL)}>
          {flow(false, WHITE, flowL)}
          <g opacity={kSharp}>{flow(false, RED, flowL)}</g>
          <rect x={-hw} y={-hh} width={2 * hw} height={2 * hh} rx={4} fill={SKY} opacity={0.9} />
          <rect x={-hw} y={-hh} width={2 * hw} height={2 * hh} rx={4} fill="none" stroke={SILVER} strokeWidth={6 + 10 * frame} />
          {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => <circle key={`${sx}${sy}`} cx={sx * hw} cy={sy * hh} r={22 + 10 * pulse} fill={RED} opacity={kSharp * (0.35 + 0.3 * pulse)} />)}
          <Lbl x={0} y={-350} size={20} o={0.7}>1952</Lbl>
        </g>
        <g transform={`translate(1360, 470) scale(${Math.min(1, kR)})`} opacity={Math.min(1, kR)}>
          {flow(true, GREEN, flowR)}
          <rect x={-hw} y={-hh} width={2 * hw} height={2 * hh} rx={70} fill={SKY} opacity={0.9} />
          <g opacity={view}>
            <defs><clipPath id="win4"><rect x={-hw} y={-hh} width={2 * hw} height={2 * hh} rx={70} /></clipPath></defs>
            <g clipPath="url(#win4)">
              <rect x={-hw} y={-hh} width={2 * hw} height={2 * hh} fill="#9CCBEE" />
              <ellipse cx={-30} cy={-70} rx={70} ry={22} fill={WHITE} opacity={0.8} />
              <ellipse cx={60} cy={-40} rx={50} ry={16} fill={WHITE} opacity={0.6} />
              <path d="M-130,80 L40,40 L60,20 L64,36 L130,22 L130,96 L-130,120 Z" fill={SILVER} />
            </g>
          </g>
          <rect x={-hw} y={-hh} width={2 * hw} height={2 * hh} rx={70} fill="none" stroke={SILVER} strokeWidth={6 + 10 * frame} />
          <Lbl x={0} y={-350} size={20} o={0.7}>NOW</Lbl>
        </g>
        <SvgPill t={t} fps={fps} a={rounded} x={1360} y={830} w={200} size={22} bg={GREEN}>ROUNDED</SvgPill>
        <SvgPill t={t} fps={fps} a={look} x={1360} y={110} w={300} size={20} bg={WHITE}>NEXT TIME YOU FLY</SvgPill>
      </svg>
    </Scene>
  );
}
// ---------- line 5: Australia on a small map (MELBOURNE on "Australian"), DAVID WARREN on his name; the recorder pops on
// "recorder", sound arcs flow into it on "voices", data dashes on "data" (FLIGHT DATA / COCKPIT VOICE plates); it is black until
// "orange" turns it orange with "PAINTED ORANGE"; locator rings on "found" ----------
function Scene5({t, at, fps, a, b}) {
  const australian = at(5, 'Australian'), david = at(5, 'David'), recorder = at(5, 'recorder'), voices = at(5, 'voices'), data = at(5, 'data'), black = at(5, 'black'), painted = at(5, 'painted'), orange = at(5, 'orange'), found = at(5, 'found');
  const MB = [80, 90, 520, 400];
  const proj = fitBox(LL.AUS, MB, 30);
  const mel = proj([144.96, -37.81]);
  const kBox = pop(t, recorder, fps, soft), kO = ease(t, orange, 0.8), kV = pop(t, voices, fps, soft), kD = pop(t, data, fps, soft);
  const bx = 1180, by = 460;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['AUS']} box={MB} k={pop(t, a, fps, soft)} id="m5">
          <Pin t={t} fps={fps} a={australian} pt={mel} label="MELBOURNE" lx={-22} ly={-16} anchor="end" r={9} size={20} />
        </MapPanel>
        <g transform="translate(700, 460)" opacity={Math.min(1, kBox)}>
          <path d="M-90,-60 C-40,-110 60,-110 110,-60 L110,60 L-90,60 Z" fill={NAVY2} stroke={WHITE} strokeWidth={3} />
          <path d="M-60,-66 L-10,-94 L40,-94 L50,-66 Z" fill={SKY} opacity={0.6} />
          <Man x={-20} y={50} s={5} color={AMBER} />
          <Man x={40} y={50} s={5} color={AMBER} />
          {kV > 0 ? [0, 1, 2].map((i) => { const ph = ((t - voices) * 0.9 + i * 0.33) % 1; return <path key={i} d={`M${130 + ph * 260},${-50} a 40 40 0 0 1 0 80`} stroke={WHITE} strokeWidth={4} fill="none" strokeLinecap="round" opacity={(1 - ph) * 0.9 * Math.min(1, kV)} />; }) : null}
          {kD > 0 ? [0, 1, 2, 3].map((i) => { const ph = ((t - data) * 0.9 + i * 0.25) % 1; return <rect key={i} x={120 + ph * 270} y={60 + (i % 2) * 14} width={22} height={8} rx={2} fill={AMBER} opacity={(1 - ph) * 0.9 * Math.min(1, kD)} />; }) : null}
        </g>
        <g transform={`translate(${bx}, ${by}) scale(${Math.min(1, kBox)})`} opacity={Math.min(1, kBox)}>
          {t >= found ? [0, 1, 2].map((i) => { const ph = ((t - found) * 0.7 + i * 0.33) % 1; return <rect key={i} x={-230 - 160 * ph} y={-140 - 110 * ph} width={460 + 320 * ph} height={280 + 220 * ph} rx={40 + 30 * ph} fill="none" stroke={ORANGE} strokeWidth={5 * (1 - ph)} opacity={(1 - ph) * 0.8} />; }) : null}
          <rect x={-210} y={-120} width={420} height={240} rx={26} fill={BLACK} stroke={WHITE} strokeWidth={3} />
          <rect x={-210} y={-120} width={420} height={240} rx={26} fill={ORANGE} stroke={WHITE} strokeWidth={3} opacity={kO} />
          <rect x={-190} y={-100} width={380} height={30} rx={8} fill={WHITE} opacity={0.18} />
          <g opacity={Math.min(1, kD)}>
            <rect x={-150} y={-62} width={300} height={56} rx={10} fill={NAVY} opacity={0.85} />
            <Lbl x={0} y={-26} size={22} color={WHITE}>FLIGHT DATA</Lbl>
          </g>
          <g opacity={Math.min(1, kV)}>
            <rect x={-150} y={14} width={300} height={56} rx={10} fill={NAVY} opacity={0.85} />
            <Lbl x={0} y={50} size={22} color={WHITE}>COCKPIT VOICE</Lbl>
          </g>
          {[-170, 170].map((dx) => <circle key={dx} cx={dx} cy={90} r={10} fill={SILVER} opacity={0.8} />)}
        </g>
        <SvgPill t={t} fps={fps} a={black} x={bx} y={by - 190} w={220} size={22} bg={BLACK} fg={WHITE} until={painted}>BLACK BOX</SvgPill>
        <SvgPill t={t} fps={fps} a={painted} x={bx} y={by - 190} w={300} size={22} bg={ORANGE} fg={NAVY}>PAINTED ORANGE</SvgPill>
      </svg>
      <Tag t={t} a={david} fps={fps} x={340} y={560}>David Warren</Tag>
    </Scene>
  );
}
// ---------- line 6: the Atlantic on a real map; "OCT 1958"; LONDON and NEW YORK pin on "Atlantic"; from "cross" a Comet 4 flies
// London -> New York, from "then" the 707 flies New York -> PARIS; the Pan Am 707 picture on "707"; two bars "~12 H" piston vs
// "~8 H" jet on "eight" / "twelve" ----------
function Scene6({t, at, fps, a, b}) {
  const october = at(6, 'October'), cross = at(6, 'cross'), atlantic = at(6, 'Atlantic'), comet = at(6, 'Comet'), then = at(6, 'then'), b707 = at(6, '707'), eight = at(6, 'eight'), twelve = at(6, 'twelve');
  const MB = [80, 90, 1100, 790], PB = [1220, 90, 620, 400];
  const proj = fitBox(LL.ATL_NY, MB, 40);
  const NY = [-73.78, 40.64], LON = [-0.45, 51.47], PAR = [2.55, 49.01];
  const p1 = ease(t, cross, Math.max(1.5, then - 0.2 - cross), Easing.inOut(Easing.quad));
  const p2 = ease(t, then, Math.max(1.5, eight - 0.4 - then), Easing.inOut(Easing.quad));
  const g1 = gcAt(proj, LON, NY, p1), g2 = gcAt(proj, NY, PAR, p2);
  const k8 = ease(t, eight, 1.0, Easing.inOut(Easing.quad)), k12 = ease(t, twelve, 1.0, Easing.inOut(Easing.quad));
  const BX = 1250, BW = 520;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['USA', 'GBR', 'FRA']} box={MB} k={1} id="m6">
          {dottedPts(greatCircle(proj, LON, NY, 60), p1, AMBER, 4)}
          {dottedPts(greatCircle(proj, NY, PAR, 60), p2, WHITE, 4)}
          <Pin t={t} fps={fps} a={atlantic} pt={proj(NY)} label="NEW YORK" lx={-22} ly={34} anchor="end" />
          <Pin t={t} fps={fps} a={atlantic} pt={proj(LON)} label="LONDON" lx={22} ly={-14} anchor="start" />
          <Pin t={t} fps={fps} a={b707} pt={proj(PAR)} label="PARIS" lx={22} ly={34} anchor="start" r={9} size={20} />
          {t >= cross ? <Plane ac="comet" x={g1.x} y={g1.y} s={0.5} rot={g1.ang} glow={p1 < 1 ? 0.8 : 0} /> : null}
          {t >= then ? <Plane ac="b707" x={g2.x} y={g2.y} s={0.5} rot={g2.ang} glow={p2 < 1 ? 0.8 : 0} /> : null}
        </MapPanel>
        <SvgPill t={t} fps={fps} a={october} x={MB[0] + 170} y={MB[1] + 50} w={200} size={22}>OCT 1958</SvgPill>
        <SvgPill t={t} fps={fps} a={comet} x={MB[0] + 170} y={MB[1] + 110} w={160} size={20} bg={WHITE}>COMET 4</SvgPill>
        <g opacity={k12 > 0 || k8 > 0 ? 1 : 0}>
          <g transform="translate(0, 640)">
            <PistonSide x={BX - 60} y={0} s={0.45} spin={1} />
            <rect x={BX} y={-14} width={BW} height={28} rx={14} fill={WHITE} opacity={0.12} />
            <rect x={BX} y={-14} width={BW * k12} height={28} rx={14} fill={WHITE} />
            <SvgPill t={t} fps={fps} a={twelve + 0.6} x={BX + BW - 70} y={0} w={120} size={20} bg={WHITE}>~12 H</SvgPill>
          </g>
          <g transform="translate(0, 780)">
            <Side ac="b707" x={BX - 60} y={0} s={0.45} />
            <rect x={BX} y={-14} width={BW} height={28} rx={14} fill={WHITE} opacity={0.12} />
            <rect x={BX} y={-14} width={BW * (8 / 12) * k8} height={28} rx={14} fill={AMBER} />
            <SvgPill t={t} fps={fps} a={eight + 0.6} x={BX + BW * (8 / 12) - 60} y={0} w={110} size={20}>~8 H</SvgPill>
          </g>
          <Lbl x={BX + BW / 2} y={860} size={16} o={0.55}>NEW YORK TO EUROPE · SAME SCALE ICONS</Lbl>
        </g>
      </svg>
      <Pic have="panam707" id="s6" a={b707} b={b} t={t} fps={fps} box={PB} fit="cover" fallback={() => (
        <g>
          <Plane ac="b707" x={PB[0] + PB[2] / 2 - 40} y={PB[1] + PB[3] / 2 + 10} s={0.75} rot={-90} dims glow={0.5} />
        </g>
      )} />
      <Tag t={t} a={b707} fps={fps} x={PB[0] + PB[2] / 2} y={PB[1] + PB[3] + 24} bg={WHITE}>Boeing 707</Tag>
    </Scene>
  );
}
// ---------- line 7: a 1958 cabin (the picture, or drawn): windows, seats with passengers in suits; hats pop on "dress up"; a steward
// walks the aisle with a tray on "meals"; china plates on the trays on "china"; sparkles on "glamorous", "$$$" on "expensive"; a row of
// a hundred silhouettes on "most people", only a few lit on "never"; "FEW HAD EVER FLOWN" ----------
function Scene7({t, at, fps, a, b}) {
  const glam = at(7, 'glamorous'), expensive = at(7, 'expensive'), dress = at(7, 'dress'), meals = at(7, 'meals'), china = at(7, 'china'), most = at(7, 'most'), never = at(7, 'never'), plane = at(7, 'plane');
  const PB = [160, 90, 1600, 560];
  const hat = ease(t, dress, 0.5), kM = pop(t, meals, fps, soft), kCh = pop(t, china, fps, bouncy);
  const walk = ease(t, meals, 4.0, Easing.inOut(Easing.quad));
  const sx = lerp(PB[0] + 1500, PB[0] + 560, walk), gy = PB[1] + 470;
  const sparkle = ease(t, glam, 0.5);
  const crowdK = ease(t, most, 1.2), lit = ease(t, never, 0.5);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <Pic have="cabin707" id="s7" a={a} b={b} t={t} fps={fps} box={PB} fit="cover" fallback={() => (
        <g>
          <rect x={PB[0]} y={PB[1]} width={PB[2]} height={PB[3]} fill={NAVY2} />
          <rect x={PB[0]} y={PB[1] + 30} width={PB[2]} height={110} fill={SILVER} opacity={0.12} />
          {Array.from({length: 12}, (_, i) => <rect key={i} x={PB[0] + 70 + i * 132} y={PB[1] + 50} width={64} height={84} rx={18} fill={SKY} opacity={0.85} />)}
          {sparkle > 0 ? Array.from({length: 8}, (_, i) => { const ph = ((t - glam) * 0.8 + rnd(i + 70)) % 1; const x = PB[0] + 120 + i * 200, y = PB[1] + 90 + 20 * rnd(i + 71); return <path key={i} d={`M${x},${y - 12} L${x + 3},${y - 3} L${x + 12},${y} L${x + 3},${y + 3} L${x},${y + 12} L${x - 3},${y + 3} L${x - 12},${y} L${x - 3},${y - 3} Z`} fill={WHITE} opacity={sparkle * Math.sin(ph * Math.PI)} />; }) : null}
          <rect x={PB[0]} y={gy} width={PB[2]} height={PB[3] - 470} fill={NAVY} opacity={0.5} />
          {Array.from({length: 6}, (_, i) => {
            const x = PB[0] + 200 + i * 250;
            return (
              <g key={i}>
                <rect x={x - 70} y={gy - 190} width={44} height={200} rx={14} fill={SILVER} opacity={0.85} />
                <rect x={x - 70} y={gy - 50} width={120} height={50} rx={12} fill={SILVER} opacity={0.85} />
                <Seated x={x - 14} y={gy - 50} s={11} color={AMBER} hat={i % 3 === 1 ? 0 : hat} />
                <rect x={x + 60} y={gy - 110} width={90} height={8} rx={3} fill={SILVER} opacity={0.9} />
                <g transform={`translate(${x + 105}, ${gy - 118}) scale(${Math.min(1, kCh)})`} opacity={Math.min(1, kCh)}>
                  <ellipse rx={30} ry={9} fill={WHITE} /><ellipse rx={18} ry={5} fill="none" stroke={SKY} strokeWidth={2} />
                </g>
              </g>
            );
          })}
          <g opacity={Math.min(1, kM)}>
            <Man x={sx} y={gy} s={11} color={WHITE} />
            <rect x={sx - 10} y={gy - 110} width={90} height={8} rx={3} fill={SILVER} />
            {[20, 56].map((dx) => <g key={dx} transform={`translate(${sx + dx}, ${gy - 118}) scale(${Math.min(1, kCh)})`} opacity={Math.min(1, kCh)}><ellipse rx={16} ry={5} fill={WHITE} /></g>)}
          </g>
          <Lbl x={PB[0] + PB[2] / 2} y={PB[1] + PB[3] - 22} size={16} o={0.55}>1958 · A JET CABIN</Lbl>
        </g>
      )} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <SvgPill t={t} fps={fps} a={expensive} x={1700} y={150} w={120} size={24} bg={RED} fg={WHITE}>$$$</SvgPill>
        <Crowd t={t} x={960} y={860} n={100} s={3.4} k={crowdK} color={WHITE} spread={16} seed={21} amber={0.03 * lit} />
        <Lbl x={960} y={720} size={18} color={AMBER} o={0.9 * ease(t, plane, 0.4)}>FEW HAD EVER FLOWN</Lbl>
      </svg>
    </Scene>
  );
}
// a cabin cross-section at 80 px per metre: the ring, the floor, seat blocks (e.g. [3, 4, 3]) filling in from `since`, the aisles dashed
const Section = ({x, y, dia, blocks, k, t, fps, since}) => {
  const r = dia * 40, wall = r * 0.08, seatW = 34, pad = 4, aisle = 36;
  const n = blocks.reduce((s, v) => s + v, 0);
  const total = n * (seatW + pad) + (blocks.length - 1) * aisle;
  const seats = [], aisles = [];
  let cx = -total / 2, idx = 0;
  blocks.forEach((bn, bi) => {
    for (let s = 0; s < bn; s++) {
      const kk = pop(t, since + idx * 0.06, fps, bouncy);
      seats.push(<g key={idx} transform={`translate(${cx + seatW / 2}, 0) scale(${Math.min(1, kk)})`} opacity={Math.min(1, kk)}><rect x={-seatW / 2} y={-10} width={seatW} height={30} rx={6} fill={AMBER} /><rect x={-seatW / 2} y={-58} width={seatW} height={50} rx={8} fill={AMBER} opacity={0.85} /></g>);
      cx += seatW + pad; idx++;
    }
    if (bi < blocks.length - 1) {
      aisles.push(<g key={`a${bi}`}><line x1={cx + aisle / 2} y1={-80} x2={cx + aisle / 2} y2={30} stroke={WHITE} strokeWidth={2} strokeDasharray="6 8" opacity={0.6} /><Lbl x={cx + aisle / 2} y={54} size={12} color={WHITE} o={0.7}>AISLE</Lbl></g>);
      cx += aisle;
    }
  });
  return (
    <g transform={`translate(${x}, ${y}) scale(${Math.min(1, k)})`} opacity={Math.min(1, k)}>
      <circle r={r} fill={SILVER} />
      <circle r={r - wall} fill={NAVY2} />
      <rect x={-(r - wall) * 0.95} y={30} width={(r - wall) * 1.9} height={8} fill={SILVER} opacity={0.6} />
      {seats}{aisles}
    </g>
  );
};
// ---------- line 8: the 707 side view, then the 747 pops in under it on "giant" at the SAME scale (the hump on top); "FEB 1969"; on
// "wide" both become cross-sections at one scale, the 747's two aisles dashed and its 3-4-3 seats filling on "two aisles" and
// "carry"; "350+" on "three" ----------
function Scene8({t, at, fps, a, b}) {
  const giant = at(8, 'giant'), feb = at(8, 'February'), flies = at(8, 'flies'), wide = at(8, 'wide'), two = at(8, 'two'), carry = at(8, 'carry'), three = at(8, 'three');
  const S = 2.0;
  const k707 = pop(t, a, fps, soft), k747 = pop(t, giant, fps, soft);
  const kX = ease(t, wide, 0.7, Easing.inOut(Easing.quad));
  const bob = Math.sin(t * 1.3) * 5;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={1 - kX}>
          <g opacity={Math.min(1, k707)}>
            <Side ac="b707" x={960} y={300 + bob} s={S} glow={0.6} />
            <SvgPill t={t} fps={fps} a={a + 0.2} x={1640} y={300} w={300} size={20} bg={WHITE}>BOEING 707 · 46.6 M</SvgPill>
          </g>
          <g opacity={Math.min(1, k747)}>
            <Side ac="b747" x={960} y={640 - bob} s={S} glow={ease(t, flies, 0.6)} />
            <SvgPill t={t} fps={fps} a={giant} x={1600} y={830} w={300} size={20}>BOEING 747 · 70.6 M</SvgPill>
          </g>
          <Lbl x={960} y={870} size={18} o={0.6 * Math.min(1, k747)}>SAME SCALE · SIDE VIEWS · THE HUMP IS THE UPPER DECK</Lbl>
          <SvgPill t={t} fps={fps} a={feb} x={300} y={130} w={200} size={22}>FEB 1969</SvgPill>
        </g>
        {kX > 0 ? (
          <g opacity={kX}>
            <Section x={440} y={540} dia={3.76} blocks={[3, 3]} k={1} t={t} fps={fps} since={two + 0.3} />
            <Section x={1180} y={480} dia={6.5} blocks={[3, 4, 3]} k={1} t={t} fps={fps} since={two} />
            <Lbl x={440} y={740} size={18} o={0.7}>707 · 3.8 M WIDE</Lbl>
            <Lbl x={1180} y={790} size={18} o={0.7}>747 · 6.5 M WIDE · SAME SCALE</Lbl>
          </g>
        ) : null}
      </svg>
      <Num t={t} a={three} fps={fps} x={1700} y={260} size={110} sub="seats">350+</Num>
      {HAVE.b747 ? <Photo src={PIC.b747} id="s8" a={flies} b={wide} t={t} box={[1420, 60, 420, 280]} fit="cover" radius={16} zoom={[1.0, 1.08]} gray credit={CREDIT.b747} /> : null}
    </Scene>
  );
}
// ---------- line 9: real film when FILMS.b747sca (NASA's 747 flying, file from 0 s), otherwise the 747 side view climbing through
// cloud with chevrons; "22 JAN 1970" on "January"; on "cost" a chart: seats per plane rise (707 -> 747 icons at one scale), the fare
// bar falls on "falls" and "fares"; on "ordinary" a crowd fills the bottom, most of them lit amber (the opposite of line 7) ----------
function Scene9({t, at, fps, a, b}) {
  const january = at(9, 'January'), cost = at(9, 'cost'), seat = at(9, 'seat'), falls = at(9, 'falls'), fares = at(9, 'fares'), ordinary = at(9, 'ordinary');
  const kIn = ease(t, cost, 0.5);
  const seats = ease(t, seat, 1.2, Easing.inOut(Easing.quad));
  const fare = 1 - 0.4 * ease(t, falls, 1.0, Easing.inOut(Easing.quad)) - 0.25 * ease(t, fares, 1.0, Easing.inOut(Easing.quad));
  const crowdK = ease(t, ordinary, 1.4);
  const BY = 760, BH = 480;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      {FILMS.b747sca ? <Clip src={FILM.b747sca} from={0} a={a} b={cost} t={t} fps={fps} zoom={[1.0, 1.08]} dark={0.2} /> : (t < cost + XF ? (
        <AbsoluteFill style={{opacity: 1 - ease(t, cost, 0.4)}}>
          <svg width={W} height={H} style={{position: 'absolute'}}>
            <CloudBand t={t} y={720} x0={0} x1={1920} k={1} color={SILVER} o={0.35} n={16} />
            <Chevrons t={t} x={lerp(700, 1100, lin(t, a, cost - a)) - 760} y={lerp(640, 420, ease(t, a, cost - a, Easing.inOut(Easing.quad)))} n={5} k={1} color={AMBER} len={80} size={26} />
            <Side ac="b747" x={lerp(700, 1100, lin(t, a, cost - a))} y={lerp(640, 420, ease(t, a, cost - a, Easing.inOut(Easing.quad)))} s={2.0} rot={-12} glow={1} />
          </svg>
        </AbsoluteFill>
      ) : null)}
      <Tag t={t} a={january} fps={fps} x={960} y={62} until={cost} bg="rgba(11,27,51,0.75)" fg={WHITE}>22 JAN 1970</Tag>
      {t >= cost ? (
        <AbsoluteFill style={{opacity: kIn}}>
          <Bg t={t} />
          <svg width={W} height={H} style={{position: 'absolute'}}>
            <line x1={240} y1={BY} x2={1680} y2={BY} stroke={WHITE} strokeWidth={3} opacity={0.4} />
            <g>
              <rect x={420} y={BY - BH * 0.38 * Math.min(1, seats * 2)} width={140} height={BH * 0.38 * Math.min(1, seats * 2)} rx={12} fill={WHITE} opacity={0.9} />
              <rect x={600} y={BY - BH * seats} width={140} height={BH * seats} rx={12} fill={AMBER} />
              <Side ac="b707" x={490} y={BY - BH * 0.38 * Math.min(1, seats * 2) - 50} s={0.5} o={Math.min(1, seats * 2)} />
              <Side ac="b747" x={670} y={BY - BH * seats - 70} s={0.5} o={clamp01(seats * 2 - 1)} />
              <Lbl x={580} y={BY + 40} size={18} o={0.7}>SEATS PER PLANE</Lbl>
              <Arrow x={820} y={BY - 60} len={200 * seats} dir="up" color={GREEN} k={seats} w={8} />
            </g>
            <g>
              <rect x={1180} y={BY - BH * fare} width={160} height={BH * fare} rx={12} fill={RED} opacity={0.9} />
              <Lbl x={1260} y={BY + 40} size={18} o={0.7}>FARE</Lbl>
              <Arrow x={1420} y={BY - BH + 40} len={BH * (1 - fare)} dir="down" color={GREEN} k={ease(t, falls, 0.5)} w={8} />
            </g>
            <Crowd t={t} x={960} y={880} n={60} s={3.4} k={crowdK} color={WHITE} spread={28} seed={33} amber={0.8} />
          </svg>
        </AbsoluteFill>
      ) : null}
    </Scene>
  );
}
// ---------- line 10: the 747 seen from above (same year), a small map of Britain and France lighting on their names; Concorde pops in
// beside it on "Concorde" at the SAME scale (the slender delta); "MACH 2" on "twice"; two speed bars "~900 KM/H" vs "~2,180 KM/H" ----------
function Scene10({t, at, fps, a, b}) {
  const britain = at(10, 'Britain'), france = at(10, 'France'), concorde = at(10, 'Concorde'), cruises = at(10, 'cruises'), twice = at(10, 'twice');
  const MB = [70, 80, 340, 240];
  const proj = fitBox(LL.GB_FR, MB, 16);
  const S = 0.95;
  const k7 = pop(t, a, fps, soft), kC = pop(t, concorde, fps, soft);
  const hi = [];
  if (t >= britain) hi.push('GBR');
  if (t >= france) hi.push('FRA');
  const k747 = ease(t, cruises, 1.0, Easing.inOut(Easing.quad)), kCon = ease(t, twice, 1.2, Easing.inOut(Easing.quad));
  const BX = 640, BW = 940;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={hi} box={MB} k={pop(t, britain, fps, soft)} id="m10" rx={18} />
        <g transform={`translate(1250, 520) scale(${Math.min(1, k7)})`} opacity={Math.min(1, k7)}>
          <Plane ac="b747" x={0} y={0} s={S} rot={-90} dims glow={0.3} />
        </g>
        <g transform={`translate(560, 520) scale(${Math.min(1, kC)})`} opacity={Math.min(1, kC)}>
          <Plane ac="concorde" x={0} y={0} s={S} rot={-90} dims glow={ease(t, cruises, 0.6)} />
        </g>
        <SvgPill t={t} fps={fps} a={a + 0.2} x={1250} y={150} w={200} size={22} bg={WHITE}>747 · 1969</SvgPill>
        <SvgPill t={t} fps={fps} a={concorde} x={560} y={190} w={300} size={22}>CONCORDE · 61.7 M</SvgPill>
        <SvgPill t={t} fps={fps} a={twice} x={560} y={870} w={160} size={24} bg={SKY}>MACH 2</SvgPill>
        <g opacity={k747 > 0 ? 1 : 0}>
          <rect x={BX} y={88} width={BW} height={22} rx={11} fill={WHITE} opacity={0.12} />
          <rect x={BX} y={88} width={BW * (900 / 2180) * k747} height={22} rx={11} fill={WHITE} />
          <Lbl x={BX + BW * (900 / 2180) + 16} y={106} anchor="start" size={18} o={0.9 * k747}>~900 KM/H · 747</Lbl>
          <rect x={BX} y={128} width={BW} height={22} rx={11} fill={WHITE} opacity={0.12} />
          <rect x={BX} y={128} width={BW * kCon} height={22} rx={11} fill={AMBER} />
          <Lbl x={BX + BW - 10} y={176} anchor="end" size={18} color={AMBER} o={0.9 * kCon}>~2,180 KM/H · CONCORDE</Lbl>
        </g>
        <Lbl x={960} y={880} size={18} o={0.6 * Math.min(1, kC)}>SAME SCALE · TOP VIEWS</Lbl>
      </svg>
    </Scene>
  );
}
// ---------- line 11: LONDON -> NEW YORK on a real map, Concorde flies it from "carries"; "~3.5 H" on "three"; a London clock at
// 10:30 on "London", a New York clock on "land" whose hands run back to 09:30 on "before"; "BY THE LOCAL CLOCK" on "local"; the
// Concorde side view below droops its nose on "land"; sound rings on "noisy", fuel drops on "thirsty", "$" on "expensive";
// "20 BUILT" on "twenty". When FILMS.concorde, real film (a BA Concorde at Helsinki, 1985) takes the frame from "But" ----------
function Scene11({t, at, fps, a, b}) {
  const y1976 = at(11, '1976'), concorde = at(11, 'Concorde'), carries = at(11, 'carries'), london = at(11, 'London'), ny = at(11, 'New'), three = at(11, 'three'), hours = at(11, 'hours'), land = at(11, 'land'), before = at(11, 'before'), local = at(11, 'local'), but = at(11, 'But'), noisy = at(11, 'noisy'), thirsty = at(11, 'thirsty'), expensive = at(11, 'expensive'), twenty = at(11, 'twenty');
  const MB = [80, 90, 1080, 560];
  const proj = fitBox(LL.ATL_NY, MB, 40);
  const LON = [-0.45, 51.47], NY = [-73.78, 40.64];
  const p = ease(t, carries, Math.max(1.5, hours + 0.3 - carries), Easing.inOut(Easing.quad));
  const g = gcAt(proj, LON, NY, p);
  const h = 3.5 * ease(t, three, Math.max(0.5, hours + 0.5 - three), Easing.out(Easing.quad));
  const back = ease(t, before, 0.9, Easing.inOut(Easing.quad));
  const nyMin = lerp(10.5 * 60, 9.5 * 60, back);
  const droop = ease(t, land, 0.8, Easing.inOut(Easing.quad));
  const kS = pop(t, concorde, fps, soft);
  const cx = 1000, cy = 790;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['USA', 'GBR']} box={MB} k={1} id="m11">
          {dottedPts(greatCircle(proj, LON, NY, 60), p, AMBER, 4)}
          <Pin t={t} fps={fps} a={london} pt={proj(LON)} label="LONDON" lx={22} ly={-14} anchor="start" />
          <Pin t={t} fps={fps} a={ny} pt={proj(NY)} label="NEW YORK" lx={-22} ly={34} anchor="end" />
          {t >= carries ? <Plane ac="concorde" x={g.x} y={g.y} s={0.5} rot={g.ang} glow={p < 1 ? 1 : 0} /> : null}
        </MapPanel>
        <SvgPill t={t} fps={fps} a={y1976} x={MB[0] + 150} y={MB[1] + 50} w={140} size={24}>1976</SvgPill>
        <Clock x={1360} y={250} r={105} h={10} m={30} k={pop(t, london, fps, soft)} />
        <Lbl x={1360} y={390} size={18} o={0.9 * ease(t, london, 0.4)}>LONDON · 10:30</Lbl>
        <Clock x={1680} y={250} r={105} h={Math.floor(nyMin / 60)} m={nyMin % 60} k={pop(t, land, fps, soft)} />
        <Lbl x={1680} y={390} size={18} o={0.9 * ease(t, land, 0.4)}>NEW YORK · {back >= 1 ? '09:30' : '10:30'}</Lbl>
        <SvgPill t={t} fps={fps} a={local} x={1520} y={450} w={340} size={20} bg={WHITE}>BY THE LOCAL CLOCK</SvgPill>
        <g opacity={Math.min(1, kS)}>
          <Side ac="concorde" x={cx} y={cy} s={1.5} droop={droop} glow={0.8} />
          <Lbl x={cx} y={cy + 72} size={16} o={0.55}>CONCORDE · 61.7 M LONG · 3.1 M TALL · THE NOSE DROOPS TO LAND</Lbl>
          {t >= noisy ? [0, 1, 2].map((i) => { const ph = ((t - noisy) * 0.8 + i * 0.33) % 1; return <path key={i} d={`M${cx - 200 - ph * 160},${cy - 60} a 60 60 0 0 0 0 120`} stroke={RED} strokeWidth={4 * (1 - ph)} fill="none" strokeLinecap="round" opacity={(1 - ph) * 0.8} />; }) : null}
          {t >= thirsty ? [0, 1, 2].map((i) => { const ph = ((t - thirsty) * 0.9 + i * 0.33) % 1; return <path key={i} d={`M${cx - 120 + i * 60},${cy + 30 + ph * 60} c -10,-14 -10,-26 0,-30 c 10,4 10,16 0,30 Z`} fill={SKY} opacity={(1 - ph) * 0.9} />; }) : null}
        </g>
        <SvgPill t={t} fps={fps} a={expensive} x={1600} y={cy - 40} w={90} size={26} bg={RED} fg={WHITE}>$</SvgPill>
      </svg>
      {FILMS.concorde ? <Clip src={FILM.concorde} from={30} a={but} b={b} t={t} fps={fps} zoom={[1.0, 1.08]} dark={0.25} /> : null}
      {FILMS.concorde ? <Tag t={t} a={but} fps={fps} x={960} y={62} bg="rgba(11,27,51,0.75)" fg={WHITE}>Concorde · 1985</Tag> : null}
      <Num t={t} a={three} fps={fps} x={MB[0] + MB[2] - 60} y={MB[1] + 60} size={80} align="right" until={FILMS.concorde ? but : undefined}>~{h.toFixed(1)} H</Num>
      <Num t={t} a={twenty} fps={fps} x={1520} y={520} size={90} color={WHITE}>20 BUILT</Num>
    </Scene>
  );
}
// ---------- line 12: Europe on a real map: France and Germany light on their names (1970), Britain (1979) and Spain (1971) on
// theirs, the dates small; "AIRBUS" on the name; the A300 seen from above pops on "A300" with its dimensions; "1972". When FILMS.a300,
// real film (an A300 landing at sunset) takes the frame from "Its first plane" ----------
function Scene12({t, at, fps, a, b}) {
  const y1970 = at(12, '1970'), french = at(12, 'French'), german = at(12, 'German'), british = at(12, 'British'), spanish = at(12, 'Spanish'), airbus = at(12, 'Airbus'), its = at(12, 'Its'), a300 = at(12, 'A300'), y1972 = at(12, '1972');
  const MB = [80, 90, 960, 790];
  const proj = fitBox(LL.EUR, MB, 30);
  const gp = geoPath(proj.clipExtent([[MB[0], MB[1]], [MB[0] + MB[2], MB[1] + MB[3]]]));
  const members = [['FRA', french, [2.5, 46.8], 'FRANCE', '1970'], ['DEU', german, [10.4, 51.2], 'GERMANY', '1970'], ['GBR', british, [-1.8, 53.2], 'BRITAIN', '1979'], ['ESP', spanish, [-3.7, 40.2], 'SPAIN', '1971']];
  const kA = pop(t, a300, fps, soft);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={[]} box={MB} k={pop(t, a, fps, soft)} id="m12">
          {members.map(([a3, since, ll, name, yr]) => {
            const k = ease(t, since, 0.7);
            if (k <= 0) return null;
            const c = proj(ll);
            return (
              <g key={a3}>
                <path d={gp(feats([a3])) || ''} fill={AMBER} stroke={AMBER} strokeWidth={2} opacity={0.15 + 0.3 * k} />
                <Lbl x={c[0]} y={c[1]} size={18} o={k}>{name}</Lbl>
                <Lbl x={c[0]} y={c[1] + 20} size={14} color={AMBER} o={k * 0.9}>{yr}</Lbl>
              </g>
            );
          })}
        </MapPanel>
        <SvgPill t={t} fps={fps} a={y1970} x={MB[0] + 150} y={MB[1] + 50} w={140} size={24}>1970</SvgPill>
        <SvgPill t={t} fps={fps} a={airbus} x={MB[0] + MB[2] / 2} y={MB[1] + MB[3] - 50} w={200} size={24} bg={WHITE}>AIRBUS</SvgPill>
        <g transform={`translate(1420, 480) scale(${Math.min(1, kA)})`} opacity={Math.min(1, kA)}>
          <Plane ac="a300" x={0} y={0} s={1.15} rot={-90} dims glow={0.4} />
        </g>
        <SvgPill t={t} fps={fps} a={a300} x={1420} y={110} w={220} size={22}>AIRBUS A300</SvgPill>
        <SvgPill t={t} fps={fps} a={y1972} x={1420} y={850} w={140} size={24} bg={WHITE}>1972</SvgPill>
      </svg>
      {FILMS.a300 ? <Clip src={FILM.a300} from={0} a={its} b={b} t={t} fps={fps} zoom={[1.0, 1.08]} dark={0.25} /> : null}
      {FILMS.a300 ? <Tag t={t} a={a300} fps={fps} x={960} y={62} bg="rgba(11,27,51,0.75)" fg={WHITE}>Airbus A300 · 1972</Tag> : null}
    </Scene>
  );
}
// ---------- line 13: 1977, calm and serious: a small map with TENERIFE; a runway draws on "ground"; two 747s seen from above roll
// toward each other from "two" and stop short; fog thickens on "foggy"; the whole runway dims respectfully after "collide"; "583"
// small on "five" (no fire, no wreckage) ----------
function Scene13({t, at, fps, a, b}) {
  const y1977 = at(13, '1977'), ground = at(13, 'ground'), two = at(13, 'two'), collide = at(13, 'collide'), foggy = at(13, 'foggy'), tenerife = at(13, 'Tenerife'), five = at(13, 'five');
  const MB = [80, 90, 520, 360];
  const proj = fitBox(LL.CANARY, MB, 30);
  const rodeos = proj([-16.34, 28.48]);
  const kRun = ease(t, ground, 1.2, Easing.inOut(Easing.quad));
  const roll = ease(t, two, Math.max(1.2, collide + 0.6 - two), Easing.inOut(Easing.quad));
  const fog = 0.2 * ease(t, two, 0.8) + 0.35 * ease(t, foggy, 1.0);
  const dim = ease(t, collide + 0.5, 1.2);
  const RY = 640;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['ESP']} box={MB} k={pop(t, a, fps, soft)} id="m13">
          <Pin t={t} fps={fps} a={tenerife} pt={rodeos} label="TENERIFE" lx={0} ly={-26} r={9} size={20} />
        </MapPanel>
        <SvgPill t={t} fps={fps} a={y1977} x={MB[0] + 150} y={MB[1] + 50} w={140} size={24}>1977</SvgPill>
        <g opacity={1 - 0.55 * dim}>
          <rect x={960 - 800 * kRun} y={RY - 50} width={1600 * kRun} height={100} fill={NAVY} opacity={0.92} />
          <line x1={960 - 800 * kRun} y1={RY} x2={960 + 800 * kRun} y2={RY} stroke={WHITE} strokeWidth={4} strokeDasharray="40 40" opacity={0.5} />
          {[0.1, 0.9].map((u) => <rect key={u} x={160 + 1600 * u - 5} y={RY - 42} width={10} height={84} fill={WHITE} opacity={0.3 * kRun} />)}
          {roll > 0 ? <Plane ac="b747" x={lerp(280, 700, roll)} y={RY} s={0.5} rot={0} o={0.95} /> : null}
          {roll > 0 ? <Plane ac="b747" x={lerp(1640, 1220, roll)} y={RY} s={0.5} rot={180} o={0.95} /> : null}
          <Lbl x={960} y={RY + 150} size={16} o={0.5 * roll}>TWO 747S · 70.6 M EACH · TOP VIEWS</Lbl>
        </g>
        {fog > 0 ? (
          <g opacity={fog}>
            <rect x={0} y={RY - 220} width={W} height={440} fill={WHITE} />
            {Array.from({length: 12}, (_, i) => <ellipse key={i} cx={((t * 30 + i * 190 + rnd(i + 600) * 100) % 2100) - 100} cy={RY - 120 + 240 * rnd(i + 601)} rx={200 + 80 * rnd(i + 602)} ry={60 + 30 * rnd(i + 603)} fill={WHITE} opacity={0.6} />)}
          </g>
        ) : null}
      </svg>
      <Num t={t} a={five} fps={fps} x={1300} y={270} size={64} color={WHITE}>583</Num>
    </Scene>
  );
}
// ---------- line 14: the cockpit from behind, two pilots; on "misunderstood" two red "?" bubbles and a tangled line between the
// seats; "TRAINED AS A TEAM" on "trained"; on "team" / "check" green bubbles CHECK and CONFIRM cross cleanly; the right bubble
// bounces on "speak up"; a tick on "saved" ----------
function Scene14({t, at, fps, a, b}) {
  const misunderstood = at(14, 'misunderstood'), trained = at(14, 'trained'), team = at(14, 'team'), check = at(14, 'check'), speak = at(14, 'speak'), saved = at(14, 'saved');
  const kQ = pop(t, misunderstood, fps, bouncy) * (1 - ease(t, team, 0.4));
  const kC1 = pop(t, team, fps, soft), kC2 = pop(t, check, fps, soft);
  const bump = t >= speak ? 1 + 0.12 * Math.sin(Math.min(Math.PI, (t - speak) * 6)) : 1;
  const cross = ease(t, check + 0.2, 0.8, Easing.inOut(Easing.quad));
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <Cockpit x={960} y={560} s={1}>
          {kQ > 0 ? (
            <g opacity={Math.min(1, kQ)}>
              <path d="M-170,-60 C-100,-140 -40,20 30,-70 C80,-130 120,-20 170,-60" stroke={RED} strokeWidth={5} fill="none" strokeDasharray="14 10" opacity={0.8} />
              <Bubble x={-230} y={-230} k={kQ} text="?" bg={RED} fg={WHITE} w={90} size={40} />
              <Bubble x={230} y={-230} k={kQ} text="?" bg={RED} fg={WHITE} w={90} size={40} flip />
            </g>
          ) : null}
          {cross > 0 ? (
            <g opacity={cross}>
              <line x1={-150} y1={-230} x2={lerp(-150, 150, cross)} y2={lerp(-230, -200, cross)} stroke={GREEN} strokeWidth={5} strokeLinecap="round" />
              <line x1={150} y1={-230} x2={lerp(150, -150, cross)} y2={lerp(-230, -200, cross)} stroke={GREEN} strokeWidth={5} strokeLinecap="round" />
            </g>
          ) : null}
          <Bubble x={-230} y={-250} k={kC1} text="CHECK" bg={GREEN} fg={NAVY} w={190} />
          <g transform={`translate(230, -250) scale(${bump}) translate(-230, 250)`}>
            <Bubble x={230} y={-250} k={kC2} text="CONFIRM" bg={GREEN} fg={NAVY} w={220} flip />
          </g>
        </Cockpit>
        <SvgPill t={t} fps={fps} a={trained} x={960} y={110} w={360} size={22}>TRAINED AS A TEAM</SvgPill>
        <Tick x={1720} y={300} k={pop(t, saved, fps, bouncy)} r={44} />
      </svg>
    </Scene>
  );
}
// ---------- line 15: 1978, the US on a real map; many new route lines draw between cities from "routes", a second wave on
// "Competition"; a fare tag drops on "cheap"; low-cost tails (plain shapes with the names as text) SOUTHWEST, RYANAIR, EASYJET on
// their names; a crowd on "millions" ----------
const US_CITIES = [[-74, 40.7], [-87.6, 41.9], [-118.2, 34], [-96.8, 32.8], [-95.4, 29.8], [-84.4, 33.7], [-80.2, 25.8], [-104.9, 39.7], [-122.3, 47.6], [-122.4, 37.8], [-112, 33.4], [-93.3, 45], [-83, 42.3], [-71, 42.4], [-77, 38.9], [-115.1, 36.1], [-90.2, 38.6], [-97.5, 35.5]];
function Scene15({t, at, fps, a, b}) {
  const y1978 = at(15, '1978'), routes = at(15, 'routes'), prices = at(15, 'prices'), competition = at(15, 'Competition'), cheap = at(15, 'cheap'), southwest = at(15, 'Southwest'), ryanair = at(15, 'Ryanair'), easyjet = at(15, 'easyJet'), millions = at(15, 'millions');
  const MB = [80, 90, 1120, 620];
  const proj = fitBox(LL.USA, MB, 30);
  const pts = US_CITIES.map((c) => proj(c));
  const pairs = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const r = rnd(i * 31 + j); if (r < 0.42) pairs.push([i, j, r]); }
  const drop = ease(t, cheap, 0.9, Easing.in(Easing.quad)), bounce = t >= cheap + 0.9 ? Math.abs(Math.sin((t - cheap - 0.9) * 6)) * 20 * Math.max(0, 1 - (t - cheap - 0.9)) : 0;
  const tagY = lerp(240, 560, drop) - bounce;
  const kTag = pop(t, prices, fps, soft);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['USA']} box={MB} k={1} id="m15">
          {pairs.map(([i, j, r], n) => {
            const since = r < 0.2 ? routes + (n % 7) * 0.12 : competition + (n % 9) * 0.08;
            const k = ease(t, since, 0.8);
            if (k <= 0) return null;
            return <line key={n} x1={pts[i][0]} y1={pts[i][1]} x2={lerp(pts[i][0], pts[j][0], k)} y2={lerp(pts[i][1], pts[j][1], k)} stroke={AMBER} strokeWidth={1.5} opacity={0.55} />;
          })}
          {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={5} fill={WHITE} opacity={0.9 * ease(t, a + 0.2 + i * 0.03, 0.3)} />)}
        </MapPanel>
        <SvgPill t={t} fps={fps} a={y1978} x={MB[0] + 150} y={MB[1] + 50} w={140} size={24}>1978</SvgPill>
        <g transform={`translate(1520, ${tagY}) scale(${Math.min(1, kTag)})`} opacity={Math.min(1, kTag)}>
          <path d="M-90,-50 L60,-50 L110,0 L60,50 L-90,50 Z" fill={AMBER} />
          <circle cx={70} cy={0} r={9} fill={NAVY} />
          <text x={-20} y={16} textAnchor="middle" fontFamily={BIG} fontSize={46} fill={NAVY}>$</text>
          <Arrow x={-150} y={-40} len={60 + 80 * drop} dir="down" color={GREEN} k={ease(t, cheap, 0.4)} w={8} />
        </g>
        <TailFin x={1290} y={690} k={pop(t, southwest, fps, soft)} color={AMBER} name="SOUTHWEST" />
        <TailFin x={1290} y={780} k={pop(t, ryanair, fps, soft)} color={SKY} name="RYANAIR" />
        <TailFin x={1290} y={870} k={pop(t, easyjet, fps, soft)} color={EASY} name="EASYJET" />
        <Crowd t={t} x={640} y={860} n={70} s={3.2} k={ease(t, millions, 1.4)} color={WHITE} spread={16} seed={44} amber={0.7} />
      </svg>
    </Scene>
  );
}
// ---------- line 16: a side-stick on the left tilts on "controls"; a pulse runs along a wire to a computer box on "send" (the box
// lights on "computers"), then on to the ailerons and elevator of the A320 seen from above (pops on "A320"); an old cable with
// pulleys below gets crossed out on "instead"; "FLY-BY-WIRE"; "1988" ----------
function Scene16({t, at, fps, a, b}) {
  const computers = at(16, 'computers'), y1988 = at(16, '1988'), a320 = at(16, 'A320'), controls = at(16, 'controls'), send = at(16, 'send'), comp2 = at(16, 'computers', 1), instead = at(16, 'instead'), fbw = at(16, 'fly-by-wire');
  const kS = pop(t, a + 0.2, fps, soft), kB = pop(t, computers, fps, soft), kP = pop(t, a320, fps, soft);
  const tilt = t >= controls ? Math.sin((t - controls) * 3) * 22 * ease(t, controls, 0.5) : 0;
  const lit = ease(t, comp2, 0.5);
  const cx = 1425, cy = 500, S = 1.3;
  const w1 = [[300, 640], [300, 720], [760, 720], [760, 520], [860, 520]];
  const w2 = [[960, 520], [1100, 520], [1100, 603], [cx - 232, 603]];
  const w3 = [[960, 520], [1100, 520], [1100, 790], [cx + 232, 790], [cx + 232, 603]];
  const w4 = [[960, 520], [1100, 520], [1100, 790], [cx, 790], [cx, 738]];
  const pulses = [];
  const flashes = [];
  if (t >= send) {
    const kk = Math.floor((t - send) / 0.9);
    for (let k = Math.max(0, kk - 1); k <= kk; k++) {
      const s0 = send + k * 0.9;
      const u1 = (t - s0) / 0.4, u2 = (t - s0 - 0.45) / 0.45;
      if (u1 >= 0 && u1 <= 1) { const q = polyAt(w1, u1); pulses.push(<circle key={`a${k}`} cx={q[0]} cy={q[1]} r={9} fill={AMBER} />); }
      if (u2 >= 0 && u2 <= 1) [w2, w3, w4].forEach((wr, i) => { const q = polyAt(wr, u2); pulses.push(<circle key={`b${k}${i}`} cx={q[0]} cy={q[1]} r={9} fill={AMBER} />); });
      if (u2 > 1 && u2 < 1.7) flashes.push(1 - (u2 - 1) / 0.7);
    }
  }
  const flash = flashes.length ? Math.max(...flashes) : 0;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={Math.min(1, kS)}>
          <path d={polyD(w1)} stroke={SKY} strokeWidth={4} fill="none" opacity={0.7} />
          <rect x={240} y={630} width={120} height={22} rx={6} fill={SILVER} />
          <g transform={`translate(300, 640) rotate(${tilt})`}>
            <rect x={-12} y={-180} width={24} height={180} rx={12} fill={WHITE} />
            <ellipse cx={0} cy={-178} rx={30} ry={22} fill={AMBER} />
          </g>
          <Lbl x={300} y={690} size={16} o={0.6}>SIDE-STICK</Lbl>
          <g opacity={1 - 0.6 * ease(t, instead, 0.6)}>
            <line x1={320} y1={830} x2={760} y2={830} stroke={SILVER} strokeWidth={3} strokeDasharray="10 8" opacity={0.7} />
            {[380, 540, 700].map((px) => <circle key={px} cx={px} cy={830} r={14} fill="none" stroke={SILVER} strokeWidth={3} />)}
            <Lbl x={540} y={875} size={14} o={0.6}>CABLES · PULLEYS</Lbl>
          </g>
          <Cross x={540} y={830} k={pop(t, instead, fps, bouncy)} r={26} />
        </g>
        <g opacity={Math.min(1, kP)}>
          <path d={polyD(w2)} stroke={SKY} strokeWidth={4} fill="none" opacity={0.7} />
          <path d={polyD(w3)} stroke={SKY} strokeWidth={4} fill="none" opacity={0.7} />
          <path d={polyD(w4)} stroke={SKY} strokeWidth={4} fill="none" opacity={0.7} />
        </g>
        <g transform={`translate(860, 520) scale(${Math.min(1, kB)})`} opacity={Math.min(1, kB)}>
          <rect x={-110} y={-90} width={200} height={170} rx={16} fill={NAVY2} stroke={lit > 0 ? AMBER : WHITE} strokeWidth={3 + 3 * lit} />
          <rect x={-90} y={-70} width={160} height={100} rx={8} fill="#07301F" opacity={0.9} />
          {[0, 1, 2].map((i) => <rect key={i} x={-76} y={-56 + i * 24} width={40 + 60 * rnd(i + Math.floor(t * 3))} height={8} rx={3} fill={GREEN} opacity={0.8} />)}
          <rect x={-76 + ((Math.floor(t * 2) % 2) * 0)} y={14} width={12} height={10} fill={GREEN} opacity={Math.floor(t * 2) % 2 ? 1 : 0.2} />
          <circle cx={0} cy={0} r={130} fill={AMBER} opacity={0.12 * lit} />
          <Lbl x={-10} y={66} size={14} color={AMBER} o={0.9}>FLIGHT COMPUTER</Lbl>
        </g>
        <g transform={`translate(${cx}, ${cy}) scale(${Math.min(1, kP)})`} opacity={Math.min(1, kP)}>
          <Plane ac="a320" x={0} y={0} s={S} rot={-90} glow={0.4}>
            <rect x={-82} y={-179} width={30} height={34} rx={3} fill={AMBER} opacity={0.2 + 0.8 * flash} />
            <rect x={-82} y={145} width={30} height={34} rx={3} fill={AMBER} opacity={0.2 + 0.8 * flash} />
            <rect x={-186} y={-50} width={14} height={100} rx={3} fill={AMBER} opacity={0.2 + 0.8 * flash} />
          </Plane>
        </g>
        {pulses}
        <SvgPill t={t} fps={fps} a={a320} x={cx} y={120} w={220} size={22}>AIRBUS A320</SvgPill>
        <SvgPill t={t} fps={fps} a={y1988} x={cx} y={176} w={140} size={22} bg={WHITE}>1988</SvgPill>
        <SvgPill t={t} fps={fps} a={fbw} x={860} y={330} w={260} size={22} bg={SKY}>FLY-BY-WIRE</SvgPill>
      </svg>
    </Scene>
  );
}
// ---------- line 17: the 737 and the A320 seen from above at the SAME scale, each on its name, "1967" under the 737; "10,000+"
// over each on "ten thousand"; on "moment" they fade to a world map; from "thousands" small plane dots (a dot and a short heading
// tick) spread along the real busy corridors in four waves (North America, Europe, East Asia, the North Atlantic); the map stays
// readable underneath (review 1) ----------
// the corridors: [from lon/lat, to lon/lat, wave, dots]
const CORRIDORS = [
  [[-74, 40.7], [-118.2, 34], 0, 12], [[-74, 40.7], [-87.6, 41.9], 0, 7], [[-87.6, 41.9], [-96.8, 32.8], 0, 6], [[-122.3, 47.6], [-122.4, 37.8], 0, 5],
  [[-80.2, 25.8], [-74, 40.7], 0, 7], [[-84.4, 33.7], [-104.9, 39.7], 0, 7], [[-118.2, 34], [-112, 33.4], 0, 4], [[-79.4, 43.7], [-95.4, 29.8], 0, 7],
  [[-0.45, 51.5], [8.6, 50.0], 1, 5], [[2.35, 48.9], [-3.7, 40.4], 1, 6], [[-0.45, 51.5], [12.5, 41.9], 1, 7], [[4.9, 52.4], [11.6, 48.1], 1, 5],
  [[-0.45, 51.5], [-6.3, 53.3], 1, 3], [[8.6, 50.0], [28.9, 41.0], 1, 7], [[18.1, 59.3], [12.6, 55.7], 1, 3], [[2.35, 48.9], [13.4, 52.5], 1, 5],
  [[139.7, 35.7], [126.8, 37.5], 2, 6], [[116.4, 39.9], [121.5, 31.2], 2, 6], [[121.5, 31.2], [114.2, 22.3], 2, 6], [[126.8, 37.5], [135.4, 34.4], 2, 4],
  [[121.5, 25.1], [139.7, 35.7], 2, 7], [[103.8, 1.4], [114.2, 22.3], 2, 8], [[126.8, 37.5], [126.5, 33.5], 2, 3], [[139.7, 35.7], [141.3, 43.1], 2, 4],
  [[-74, 40.7], [-0.45, 51.5], 3, 12], [[-71, 42.4], [2.35, 48.9], 3, 10], [[-79.4, 43.7], [-0.45, 51.5], 3, 9], [[-87.6, 41.9], [8.6, 50.0], 3, 11],
];
function Scene17({t, at, fps, a, b}) {
  const b737 = at(17, '737'), y1967 = at(17, '1967'), a320 = at(17, 'A320'), ten = at(17, 'ten'), moment = at(17, 'moment'), thousands = at(17, 'thousands');
  const S = 1.6;
  const k7 = pop(t, b737, fps, soft), kA = pop(t, a320, fps, soft);
  const kW = ease(t, moment, 0.8);
  const proj = fitBox(LL.WORLD, MAP_W, 10);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={1 - kW}>
          <g transform={`translate(520, 500) scale(${Math.min(1, k7)})`} opacity={Math.min(1, k7)}>
            <Plane ac="b737" x={0} y={0} s={S} rot={-90} dims glow={0.3} />
          </g>
          <g transform={`translate(1400, 500) scale(${Math.min(1, kA)})`} opacity={Math.min(1, kA)}>
            <Plane ac="a320" x={0} y={0} s={S} rot={-90} dims glow={0.3} />
          </g>
          <SvgPill t={t} fps={fps} a={b737} x={520} y={866} w={260} size={20} bg={WHITE}>BOEING 737-800</SvgPill>
          <SvgPill t={t} fps={fps} a={y1967} x={760} y={866} w={120} size={20}>1967</SvgPill>
          <SvgPill t={t} fps={fps} a={a320} x={1400} y={866} w={220} size={20} bg={WHITE}>AIRBUS A320</SvgPill>
          <Lbl x={960} y={60} size={18} o={0.6 * Math.min(1, kA)}>SAME SCALE · TOP VIEWS</Lbl>
        </g>
        <MapPanel proj={proj} hi={[]} box={MAP_W} k={kW} id="m17">
          {CORRIDORS.map(([A, B, wave, n], ci) => Array.from({length: n}, (_, i) => {
            const seed = ci * 40 + i;
            const k = pop(t, thousands + wave * 0.35 + rnd(seed) * 0.5, fps, soft);
            if (k <= 0) return null;
            const u = (i + 0.5) / n + (rnd(seed + 1) - 0.5) * 0.06;
            const g = gcAt(proj, A, B, clamp01(u));
            const jx = (rnd(seed + 2) - 0.5) * 14, jy = (rnd(seed + 3) - 0.5) * 14;
            const ang = (g.ang + (i % 2 ? 180 : 0)) * Math.PI / 180;
            return (
              <g key={seed} transform={`translate(${g.x + jx}, ${g.y + jy})`} opacity={Math.min(1, k) * 0.9}>
                <line x1={0} y1={0} x2={8 * Math.cos(ang)} y2={8 * Math.sin(ang)} stroke={AMBER} strokeWidth={2} strokeLinecap="round" />
                <circle r={3.2 * Math.min(1, k)} fill={AMBER} />
              </g>
            );
          }))}
        </MapPanel>
      </svg>
      <Num t={t} a={ten} fps={fps} x={520} y={100} size={84} until={moment}>10,000+</Num>
      <Num t={t} a={ten + 0.25} fps={fps} x={1400} y={100} size={84} until={moment}>10,000+</Num>
    </Scene>
  );
}
// ---------- line 18: a 747 seen from above crosses the ocean on a real map; on "two" only two of its engines stay lit; on "777" it
// crossfades into the 777 at the same scale, its two huge engines glowing; the four engine dots at top-left become two on
// "replacing"; "1995" on the chip. When FILMS.b777, real film (a 777 taking off) takes the frame from "Boeing", the engine dots
// staying on top ----------
function Scene18({t, at, fps, a, b}) {
  const two = at(18, 'two'), boeing = at(18, 'Boeing'), b777 = at(18, '777'), replacing = at(18, 'replacing');
  const proj = fitBox(LL.ATL_NY, MAP_W, 40);
  const p = ease(t, a, Math.max(3, b - a), Easing.inOut(Easing.quad));
  const x = lerp(MAP_W[0] + 260, MAP_W[0] + MAP_W[2] - 260, p), y = MAP_W[1] + 400 + 10 * Math.sin(t * 1.1);
  const sw = ease(t, boeing, 0.8, Easing.inOut(Easing.quad));
  const dimOuter = ease(t, two, 0.6);
  const twoLeft = ease(t, replacing, 0.6);
  const S = 0.4;   // half size on the map (review 2)
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={[]} box={MAP_W} k={1} id="m18">
          <g opacity={1 - sw}>
            <Plane ac="b747" x={x} y={y} s={S} rot={0} glow={0.9}>
              <rect x={-60} y={-240} width={120} height={40} rx={6} fill={SEA} opacity={0.75 * dimOuter} />
              <rect x={-60} y={200} width={120} height={40} rx={6} fill={SEA} opacity={0.75 * dimOuter} />
            </Plane>
          </g>
          {sw > 0 ? <Plane ac="b777" x={x} y={y} s={S} rot={0} glow={1} o={sw} /> : null}
        </MapPanel>
      </svg>
      {FILMS.b777 ? <Clip src={FILM.b777} from={0} a={boeing} b={b} t={t} fps={fps} zoom={[1.0, 1.08]} dark={0.25} /> : null}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform="translate(240, 150)">
          {[0, 1, 2, 3].map((i) => <circle key={i} cx={i * 50} cy={0} r={16} fill={AMBER} opacity={i === 0 || i === 3 ? 1 - 0.85 * twoLeft : 1} />)}
          <Lbl x={75} y={50} size={16} o={0.7}>ENGINES</Lbl>
        </g>
        <Lbl x={960} y={870} size={18} o={0.6}>{sw > 0.5 ? '777-300ER · 73.9 M · 64.8 M SPAN · 2 ENGINES' : '747 · 70.6 M · 59.6 M SPAN · 4 ENGINES'} · SAME SCALE</Lbl>
        <SvgPill t={t} fps={fps} a={b777} x={960} y={140} w={240} size={22}>BOEING 777</SvgPill>
      </svg>
      {HAVE.b777 ? <Photo src={PIC.b777} id="s18" a={b777} b={b} t={t} box={[1400, 560, 420, 280]} fit="cover" radius={16} zoom={[1.0, 1.08]} credit={CREDIT.b777} /> : null}
    </Scene>
  );
}
// ---------- line 19: calm. an airport (a terminal, a tower, a 737 at the gate) on "airports"; "11 SEP 2001" on "eleventh"; on
// "locked" three panels replace it: a cockpit door swings shut with a lock and LOCKED; a security arch with a silhouette walking
// through and a scan line on "security"; a small bottle "100 ML" on "liquids" ----------
function Scene19({t, at, fps, a, b}) {
  const eleventh = at(19, 'eleventh'), airports = at(19, 'airports'), locked = at(19, 'locked'), doors = at(19, 'doors'), security = at(19, 'security'), liquids = at(19, 'liquids'), small = at(19, 'small');
  const kAp = pop(t, airports, fps, soft) * (1 - ease(t, locked, 0.5));
  const kD = pop(t, locked, fps, soft), shut = ease(t, locked + 0.2, 0.9, Easing.inOut(Easing.quad)), kL = pop(t, doors, fps, bouncy);
  const kA = pop(t, security, fps, soft), walk = ease(t, security + 0.2, 2.4, Easing.inOut(Easing.quad));
  const kB = pop(t, liquids, fps, soft), fill = ease(t, liquids + 0.3, 0.8);
  const scan = t >= security ? ((t - security) * 0.6) % 1 : 0;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={Math.min(1, kAp)}>
          <rect x={360} y={560} width={1200} height={170} rx={10} fill={NAVY2} stroke={WHITE} strokeWidth={3} />
          {Array.from({length: 14}, (_, i) => <rect key={i} x={400 + i * 82} y={600} width={50} height={60} rx={4} fill={SKY} opacity={0.6} />)}
          <rect x={1420} y={300} width={60} height={270} fill={NAVY2} stroke={WHITE} strokeWidth={3} />
          <path d="M1400,300 L1500,300 L1490,250 L1410,250 Z" fill={SKY} opacity={0.8} />
          <rect x={700} y={500} width={30} height={70} fill={SILVER} opacity={0.8} />
          <Plane ac="b737" x={715} y={400} s={0.6} rot={-90} />
          <line x1={200} y1={732} x2={1720} y2={732} stroke={WHITE} strokeWidth={3} opacity={0.3} />
        </g>
        <g transform={`translate(420, 500) scale(${Math.min(1, kD)})`} opacity={Math.min(1, kD)}>
          <rect x={-170} y={-280} width={340} height={560} rx={10} fill={NAVY2} stroke={WHITE} strokeWidth={4} />
          <rect x={-150} y={-260} width={300} height={520} fill={NAVY} opacity={0.8} />
          <g transform={`translate(-150, 0) scale(${lerp(0.18, 1, shut)}, 1)`}>
            <rect x={0} y={-260} width={300} height={520} rx={6} fill={SILVER} />
            <circle cx={150} cy={-120} r={26} fill={NAVY} opacity={0.6} />
            <rect x={240} y={-10} width={36} height={10} rx={4} fill={NAVY} opacity={0.7} />
          </g>
          <g transform={`translate(0, 120) scale(${Math.min(1, kL)})`} opacity={Math.min(1, kL)}>
            <rect x={-44} y={-20} width={88} height={70} rx={12} fill={AMBER} />
            <path d="M-26,-20 L-26,-50 A26,26 0 0 1 26,-50 L26,-20" stroke={AMBER} strokeWidth={12} fill="none" />
            <circle cy={14} r={10} fill={NAVY} />
          </g>
        </g>
        <SvgPill t={t} fps={fps} a={doors} x={420} y={830} w={180} size={22}>LOCKED</SvgPill>
        <g transform={`translate(960, 500) scale(${Math.min(1, kA)})`} opacity={Math.min(1, kA)}>
          <path d="M-150,280 L-150,-260 Q-150,-290 -120,-290 L120,-290 Q150,-290 150,-260 L150,280" stroke={SILVER} strokeWidth={26} fill="none" />
          <rect x={-124} y={-264} width={248} height={544} fill={SKY} opacity={0.08} />
          <line x1={-120} y1={-250 + 520 * scan} x2={120} y2={-250 + 520 * scan} stroke={SKY} strokeWidth={4} opacity={0.8} />
          <Man x={lerp(-260, 260, walk)} y={280} s={16} color={AMBER} />
        </g>
        <g transform={`translate(1500, 500) scale(${Math.min(1, kB)})`} opacity={Math.min(1, kB)}>
          <rect x={-60} y={-80} width={120} height={240} rx={28} fill="none" stroke={WHITE} strokeWidth={6} />
          <rect x={-28} y={-150} width={56} height={70} rx={8} fill="none" stroke={WHITE} strokeWidth={6} />
          <rect x={-34} y={-170} width={68} height={26} rx={6} fill={AMBER} />
          <defs><clipPath id="bottle19"><rect x={-57} y={-77} width={114} height={234} rx={26} /></clipPath></defs>
          <rect x={-60} y={160 - 234 * 0.75 * fill} width={120} height={234 * 0.75 * fill} fill={SKY} opacity={0.8} clipPath="url(#bottle19)" />
        </g>
        <SvgPill t={t} fps={fps} a={small} x={1500} y={830} w={160} size={22} bg={SKY}>100 ML</SvgPill>
        <SvgPill t={t} fps={fps} a={eleventh} x={960} y={120} w={240} size={22} bg={WHITE}>11 SEP 2001</SvgPill>
      </svg>
    </Scene>
  );
}
// ---------- line 20: real film: the A380 taxiing seen from a window (dubai, file from 24 s, inside 0-60) until "largest"; then the 747
// and the A380 side views at ONE scale (the A380's full double deck: two window rows), "DOUBLE DECK" on "enters"; on "Four" real film
// of the 787 crossing the Moon when FILMS.b787, else the 787's picture (CC BY 2.0) or its drawing with the wings flexing up;
// "Carbon fibre" on "carbon"; "2007", "2011" on the chip ----------
function Scene20({t, at, fps, a, b}) {
  const airbus = at(20, 'Airbus'), largest = at(20, 'largest'), enters = at(20, 'enters'), four = at(20, 'Four'), b787 = at(20, '787'), body = at(20, 'body'), carbon = at(20, 'carbon');
  const S = 1.8;
  const kIn = ease(t, largest, 0.5), kB = ease(t, four, 0.6);
  const k7 = pop(t, largest, fps, soft), k8 = pop(t, largest + 0.5, fps, soft);
  const PB = [260, 90, 1400, 780];
  const flex = 2.5 * ease(t, body, 1.4, Easing.inOut(Easing.quad)) * (0.85 + 0.15 * Math.sin(t * 2));
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <Clip src={FILM.dubai} from={24} a={a} b={largest} t={t} fps={fps} zoom={[1.0, 1.08]} dark={0.2} />
      <Tag t={t} a={airbus} fps={fps} x={960} y={62} until={largest} bg="rgba(11,27,51,0.75)" fg={WHITE}>Airbus A380</Tag>
      {t >= largest ? (
        <AbsoluteFill style={{opacity: kIn * (1 - kB)}}>
          <Bg t={t} />
          <svg width={W} height={H} style={{position: 'absolute'}}>
            <g opacity={Math.min(1, k7)}>
              <Side ac="b747" x={960} y={330} s={S} glow={0.3} />
              <SvgPill t={t} fps={fps} a={largest} x={1720} y={250} w={220} size={20} bg={WHITE}>BOEING 747</SvgPill>
            </g>
            <g opacity={Math.min(1, k8)}>
              <Side ac="a380" x={960} y={700} s={S} glow={0.3} />
              <SvgPill t={t} fps={fps} a={largest + 0.5} x={1740} y={560} w={220} size={20}>AIRBUS A380</SvgPill>
            </g>
            <Lbl x={960} y={60} size={18} o={0.6 * Math.min(1, k8)}>SAME SCALE · SIDE VIEWS · 747-100 70.6 M · A380 72.7 M, 8.4 M TALL</Lbl>
            <SvgPill t={t} fps={fps} a={enters} x={960} y={856} w={260} size={22}>DOUBLE DECK</SvgPill>
          </svg>
        </AbsoluteFill>
      ) : null}
      {FILMS.b787 ? <Clip src={FILM.b787} from={0} a={four} b={b} t={t} fps={fps} zoom={[1.0, 1.06]} dark={0.2} /> : (
        <Pic have="b787" id="s20" a={four} b={b} t={t} fps={fps} box={PB} fit="cover" gray={false} fallback={() => (
          <g>
            <Side ac="b787" x={PB[0] + PB[2] / 2} y={PB[1] + PB[3] / 2 + 40} s={2.0} rot={-8} flex={flex} glow={0.9} />
            <Lbl x={PB[0] + PB[2] / 2} y={PB[1] + PB[3] - 60} size={18} o={0.6}>BOEING 787-8 · 56.7 M LONG · 60.1 M SPAN · THE WINGS FLEX UP</Lbl>
          </g>
        )} />
      )}
      <Tag t={t} a={b787} fps={fps} x={960} y={130} bg={WHITE}>Boeing 787</Tag>
      <Tag t={t} a={carbon} fps={fps} x={960} y={PB[1] + PB[3] - 60} bg={NAVY} fg={AMBER}>Carbon fibre</Tag>
    </Scene>
  );
}
// ---------- line 21: a real globe (orthographic) with satellites orbiting from "satellites", dashed links down to a small airliner
// that moves along its route from "find"; on "land" a runway in fog on the right, the glide path descending and the A320 side view
// following it down; "AUTOLAND" on "themselves"; two pilots in a small window on "pilots" ----------
function Scene21({t, at, fps, a, b}) {
  const find = at(21, 'find'), satellites = at(21, 'satellites'), land = at(21, 'land'), themselves = at(21, 'themselves'), fog = at(21, 'fog'), pilots = at(21, 'pilots');
  const cx = 460, cy = 470, R = 250;
  const ortho = geoOrthographic().rotate([34, -28]).scale(R).translate([cx, cy]).clipAngle(90);
  const gp = geoPath(ortho);
  const u = ease(t, find, 5.0, Easing.inOut(Easing.quad));
  const ip = geoInterpolate([-73.78, 40.64], [-0.45, 51.47]);
  const pp = ortho(ip(u)), pq = ortho(ip(Math.min(1, u + 0.02)));
  const ang = Math.atan2(pq[1] - pp[1], pq[0] - pp[0]) * 180 / Math.PI;
  const kSat = pop(t, satellites, fps, soft);
  const sats = [0, 1, 2, 3].map((i) => { const an = t * 0.5 + i * Math.PI / 2; return [cx + 350 * Math.cos(an), cy - 60 + 150 * Math.sin(an), Math.sin(an)]; });
  const kR = pop(t, land, fps, soft);
  const P0 = [1100, 420], P1 = [1640, 752];
  const d = ease(t, land, Math.max(1.5, fog + 0.6 - land), Easing.inOut(Easing.quad));
  const px = lerp(P0[0], P1[0], d), py = lerp(P0[1], P1[1], d);
  const kP = pop(t, pilots, fps, soft);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={Math.min(1, pop(t, a, fps, soft))}>
          <circle cx={cx} cy={cy} r={R} fill={SEA} stroke={WHITE} strokeWidth={2} strokeOpacity={0.3} />
          <path d={gp(GRAT) || ''} stroke={WHITE} strokeWidth={1} fill="none" opacity={0.12} />
          <path d={gp(LAND_FC) || ''} fill={LAND} stroke={LAND2} strokeWidth={1} />
          {u > 0 ? Array.from({length: 40}, (_, i) => { const v = (i + 1) / 40; if (v > u) return null; const q = ortho(ip(v)); return <circle key={i} cx={q[0]} cy={q[1]} r={3} fill={AMBER} opacity={0.8} />; }) : null}
          {kSat > 0 ? sats.map(([sx, sy, front], i) => (
            <g key={i} opacity={Math.min(1, kSat) * (front > 0 ? 1 : 0.5)}>
              <line x1={sx} y1={sy} x2={pp[0]} y2={pp[1]} stroke={SKY} strokeWidth={2} strokeDasharray="8 10" opacity={0.7} />
              <g transform={`translate(${sx}, ${sy}) rotate(${i * 30})`}>
                <rect x={-14} y={-10} width={28} height={20} rx={4} fill={WHITE} />
                <rect x={-60} y={-6} width={40} height={12} fill={SKY} /><rect x={20} y={-6} width={40} height={12} fill={SKY} />
              </g>
            </g>
          )) : null}
          <Plane ac="a320" x={pp[0]} y={pp[1]} s={0.3} rot={ang} color={AMBER} />
          <Lbl x={cx} y={cy + R + 50} size={16} o={0.55}>SATELLITES · THE PLANE KNOWS WHERE IT IS</Lbl>
        </g>
        <g opacity={Math.min(1, kR)}>
          <rect x={1060} y={560} width={860} height={240} fill={WHITE} opacity={0.3} />
          {Array.from({length: 8}, (_, i) => <ellipse key={i} cx={1080 + i * 120 + ((t * 20) % 120)} cy={600 + 120 * rnd(i + 900)} rx={150} ry={50} fill={WHITE} opacity={0.25} />)}
          <rect x={1080} y={752} width={800} height={14} rx={4} fill={NAVY} />
          {Array.from({length: 10}, (_, i) => <circle key={i} cx={1100 + i * 85} cy={759} r={4} fill={AMBER} opacity={0.5 + 0.5 * Math.sin(t * 6 + i)} />)}
          <line x1={P0[0]} y1={P0[1]} x2={P1[0]} y2={P1[1]} stroke={SKY} strokeWidth={3} strokeDasharray="12 12" opacity={0.8} />
          <Side ac="a320" x={px} y={py - 22} s={1.2} rot={d < 0.92 ? 12 : lerp(12, 0, (d - 0.92) / 0.08)} glow={0.5} />
          <g transform={`translate(1480, 300) scale(${Math.min(1, kP)})`} opacity={Math.min(1, kP)}>
            <rect x={-80} y={-40} width={160} height={80} rx={14} fill={NAVY2} stroke={WHITE} strokeWidth={3} />
            {[-30, 30].map((dx) => <g key={dx}><circle cx={dx} cy={-6} r={14} fill={AMBER} /><path d={`M${dx - 22},40 Q${dx},6 ${dx + 22},40 Z`} fill={AMBER} /></g>)}
          </g>
        </g>
        <SvgPill t={t} fps={fps} a={themselves} x={1480} y={200} w={220} size={22} bg={SKY}>AUTOLAND</SvgPill>
      </svg>
    </Scene>
  );
}
// ---------- line 22: a clean bar chart of passengers a year (review 1): 2015-2019 grow in from "carry" (2019 amber), the counter
// rises to 4.5 BILLION on "four"; the 2020 bar (red) drops in on "empties" / "falls" and the counter falls to 1.8; 2021-2024 climb back
// from "come back" and the counter follows. A light row of small plane icons along the top thins out in 2020 and refills ----------
const PAX = [[2015, 3.5], [2016, 3.8], [2017, 4.1], [2018, 4.3], [2019, 4.5], [2020, 1.8], [2021, 2.3], [2022, 3.3], [2023, 4.2], [2024, 4.6]];
function Scene22({t, at, fps, a, b}) {
  const carry = at(22, 'carry'), four = at(22, 'four'), passengers = at(22, 'passengers'), empties = at(22, 'empties'), falls = at(22, 'falls'), half = at(22, 'half'), come = at(22, 'come');
  const present = t < come ? lerp(1, 0.4, ease(t, empties, 1.4, Easing.inOut(Easing.quad))) : lerp(0.4, 1, ease(t, come, 1.4));
  let n = 4.5 * ease(t, four, Math.max(0.8, passengers + 0.4 - four), Easing.out(Easing.quad));
  if (t >= falls) n = lerp(4.5, 1.8, ease(t, falls, Math.max(0.5, half + 0.4 - falls), Easing.inOut(Easing.quad)));
  if (t >= come) n = lerp(1.8, 4.4, ease(t, come, 1.4, Easing.inOut(Easing.quad)));
  const X0 = 300, DX = 146, BW = 84, BY = 800, PX = 91;    // 91 px per billion
  const kRow = ease(t, carry, 1.2);
  const barK = (i) => (i < 5 ? ease(t, carry + i * 0.22, 0.8, Easing.out(Easing.cubic)) : i === 5 ? ease(t, empties, Math.max(0.6, half + 0.3 - empties), Easing.inOut(Easing.quad)) : ease(t, come + (i - 6) * 0.22, 0.8, Easing.out(Easing.cubic)));
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <line x1={X0 - 40} y1={BY} x2={X0 + DX * 9 + BW + 40} y2={BY} stroke={WHITE} strokeWidth={3} opacity={0.5} />
        {[1, 2, 3, 4].map((bn) => <g key={bn}><line x1={X0 - 40} y1={BY - bn * PX} x2={X0 + DX * 9 + BW + 40} y2={BY - bn * PX} stroke={WHITE} strokeWidth={1} opacity={0.12} /><Lbl x={X0 - 56} y={BY - bn * PX + 6} anchor="end" size={16} o={0.5}>{bn} B</Lbl></g>)}
        {PAX.map(([yr, v], i) => {
          const k = barK(i);
          const hgt = v * PX * k;
          const col = i === 4 ? AMBER : i === 5 ? RED : WHITE;
          return (
            <g key={yr}>
              <rect x={X0 + i * DX} y={BY - hgt} width={BW} height={hgt} rx={10} fill={col} opacity={i === 4 || i === 5 ? 0.95 : 0.75} />
              <Lbl x={X0 + i * DX + BW / 2} y={BY + 32} size={18} color={i === 4 ? AMBER : i === 5 ? RED : WHITE} o={0.4 + 0.5 * k}>{yr}</Lbl>
            </g>
          );
        })}
        {Array.from({length: 24}, (_, i) => {
          const show = rnd(i + 700) <= present;
          const k = clamp01(kRow * 2 - rnd(i + 701));
          if (!show || k <= 0) return null;
          return <Plane key={i} ac="a320" x={200 + i * 66} y={300 + 6 * Math.sin(t * 1.5 + i)} s={0.36 * k} rot={0} color={WHITE} o={0.7} />;
        })}
      </svg>
      <Num t={t} a={four} fps={fps} x={960} y={100} size={90} sub="passengers a year">{n.toFixed(1)} BILLION</Num>
    </Scene>
  );
}
// ---------- line 23 (review 2): a night storm: a dark cloud deck, rain, distant flashes; an A320 (real proportions) flies through it;
// on "struck" a bolt hits the NOSE with a frame flash; "~1 PER YEAR" on "once" ----------
const STORM_CX = 760, STORM_CY = 480, STORM_S = 2.2;   // the airliner's place in lines 23-24 (the same, so the cut is invisible)
// the A320 side view's skin as a polyline in its local coordinates (nose tip, nose top, roof, tail cone, tail end), see JetSide
const A320_SKIN = [[188, 0], [144, -20], [-98, -20], [-165.5, -16], [-188, -10], [-188, -3.6]];
const skinPts = () => A320_SKIN.map(([px, py]) => [STORM_CX + px * STORM_S, STORM_CY + py * STORM_S]);
const strikeK = (t, s) => (t >= s ? Math.max(0, 1 - (t - s) / 0.55) * (0.75 + 0.25 * Math.sin(t * 70)) : 0);
function Scene23({t, at, fps, a, b}) {
  const struck = at(23, 'struck'), once = at(23, 'once');
  const kIn = pop(t, a, fps, soft);
  const bob = 6 * Math.sin(t * 1.7);
  const nose = [STORM_CX + 188 * STORM_S, STORM_CY + bob];
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <Storm t={t} seed={3} />
        <g opacity={Math.min(1, kIn)}>
          <Side ac="a320" x={STORM_CX} y={STORM_CY + bob} s={STORM_S} rot={-2} glow={0.8} />
          <Lbl x={STORM_CX} y={STORM_CY + 120} size={16} o={0.5}>A320 · 37.6 M · SIDE VIEW</Lbl>
        </g>
        <Bolt x0={nose[0] + 90} y0={190} x1={nose[0]} y1={nose[1]} seed={11} k={strikeK(t, struck)} />
        <SvgPill t={t} fps={fps} a={once} x={1500} y={330} w={220} size={22}>~1 PER YEAR</SvgPill>
      </svg>
      <AbsoluteFill style={{background: WHITE, opacity: t >= struck ? 0.45 * Math.max(0, 1 - (t - struck) / 0.25) : 0, pointerEvents: 'none'}} />
    </Scene>
  );
}
// ---------- line 24 (review 2): the same storm and airliner. a bolt hits the NOSE on "hits", another the WINGTIP on "wingtip"; from
// "runs" the current runs along the skin as a bright line nose to tail and leaves from the TAIL on "leaves"; on "cage" a cutaway shows
// the passengers inside, calm, the current only on the outside (a tick on "safe"); on "carbon" a 787 skin panel with a fine copper
// mesh drawn into it on "mesh" ----------
function Scene24({t, at, fps, a, b}) {
  const hits = at(24, 'hits'), wingtip = at(24, 'wingtip'), runs = at(24, 'runs'), tail = at(24, 'tail'), leaves = at(24, 'leaves'), cage = at(24, 'cage'), safe = at(24, 'safe'), carbon = at(24, 'carbon'), mesh = at(24, 'mesh');
  const cx = STORM_CX, cy = STORM_CY, S = STORM_S;
  const skin = skinPts();
  const nose = skin[0], tailEnd = skin[5];
  const tip = [cx - 46.5 * S, cy - 11 * S];
  const run = ease(t, runs, Math.max(0.8, tail + 0.2 - runs), Easing.inOut(Easing.quad));
  const head = polyAt(skin, run);
  const kCut = ease(t, cage, 0.8), kPanel = pop(t, carbon, fps, soft), meshK = ease(t, mesh, 1.4);
  const flash = Math.max(strikeK(t, hits), strikeK(t, wingtip)) * 0.45;
  const seats = Array.from({length: 18}, (_, i) => <Seated key={i} x={cx + (120 - i * 15) * S} y={cy + 6 * S} s={S * 0.9} color={AMBER} />);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <Storm t={t} seed={5} />
        <Side ac="a320" x={cx} y={cy} s={S} rot={0} glow={0.8} />
        {kCut > 0 ? (
          <g opacity={kCut}>
            <rect x={cx - 150 * S} y={cy - 14 * S} width={280 * S} height={28 * S} rx={10 * S} fill={NAVY} opacity={0.92} />
            {seats}
            <Lbl x={cx} y={cy + 120} size={16} color={SKY} o={0.8}>THE CURRENT STAYS ON THE SKIN</Lbl>
          </g>
        ) : null}
        <Bolt x0={nose[0] + 90} y0={190} x1={nose[0]} y1={nose[1]} seed={21} k={strikeK(t, hits)} />
        <Bolt x0={tip[0] - 80} y0={190} x1={tip[0]} y1={tip[1]} seed={31} k={strikeK(t, wingtip)} w={5} />
        {run > 0 ? (
          <g>
            <path d={polyD(skin)} stroke={SKY} strokeWidth={14} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.35} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - run} />
            <path d={polyD(skin)} stroke={WHITE} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - run} />
            {run < 1 ? <circle cx={head[0]} cy={head[1]} r={12} fill={WHITE} opacity={0.9} /> : null}
          </g>
        ) : null}
        <Bolt x0={tailEnd[0]} y0={tailEnd[1]} x1={tailEnd[0] - 70} y1={880} seed={41} k={strikeK(t, leaves)} />
        <Tick x={cx + 150 * S + 60} y={cy - 60} k={pop(t, safe, fps, bouncy)} r={30} />
        <g transform={`translate(1540, 500) scale(${Math.min(1, kPanel)})`} opacity={Math.min(1, kPanel)}>
          <Side ac="b787" x={0} y={-260} s={0.5} flex={1.5} glow={0.5} />
          <rect x={-180} y={-170} width={360} height={340} rx={18} fill="#2B2F36" stroke={SILVER} strokeWidth={3} />
          <defs><clipPath id="panel24"><rect x={-180} y={-170} width={360} height={340} rx={18} /></clipPath></defs>
          <g clipPath="url(#panel24)">
            {Array.from({length: 26}, (_, i) => <line key={i} x1={-200 + i * 30} y1={-190} x2={-200 + i * 30 - 360} y2={190} stroke={WHITE} strokeWidth={1} opacity={0.12} />)}
            {Array.from({length: 26}, (_, i) => <line key={`b${i}`} x1={-200 + i * 30} y1={190} x2={-200 + i * 30 - 360} y2={-190} stroke={WHITE} strokeWidth={1} opacity={0.12} />)}
            {Array.from({length: 15}, (_, i) => <line key={`m${i}`} x1={-168 + i * 24} y1={-170} x2={-168 + i * 24} y2={170} stroke={COPPER} strokeWidth={1.5} opacity={0.9 * clamp01(meshK * 2 - i / 15)} />)}
            {Array.from({length: 15}, (_, i) => <line key={`n${i}`} x1={-180} y1={-158 + i * 24} x2={180} y2={-158 + i * 24} stroke={COPPER} strokeWidth={1.5} opacity={0.9 * clamp01(meshK * 2 - 1 - i / 15)} />)}
          </g>
          <Lbl x={0} y={210} size={16} o={0.7}>787 SKIN · CARBON FIBRE</Lbl>
          <Lbl x={0} y={236} size={16} color={COPPER} o={0.9 * ease(t, mesh, 0.4)}>COPPER MESH</Lbl>
        </g>
      </svg>
      <AbsoluteFill style={{background: WHITE, opacity: flash, pointerEvents: 'none'}} />
    </Scene>
  );
}
// ---------- line 25 (review 2), calm and respectful: the US east coast on a detailed map, "8 DEC 1963" on "December", a flash at
// ELKTON, MARYLAND on "lightning", a small 707 flies up the coast on "Pan Am" and stops there on "Maryland"; on the right a 707 wing
// cross-section with the fuel tank and vapour on "ignited", a spark on "vapour" (no fire, no crash drawn); "81" small on "eighty"; on
// "Since" today's tank: the spark crossed out on "spark", a SAFE tick on "can't" ----------
function Scene25({t, at, fps, a, b}) {
  const december = at(25, 'December'), lightning = at(25, 'lightning'), ignited = at(25, 'ignited'), vapour = at(25, 'vapour'), pan = at(25, 'Pan'), maryland = at(25, 'Maryland'), eighty = at(25, 'eighty'), since = at(25, 'Since'), spark = at(25, 'spark'), cant = at(25, 'can');
  const MB = [80, 90, 900, 790];
  const proj = fitBox(LL.USA_E, MB, 40);
  const ELK = [-75.83, 39.61], DCA = [-77.04, 38.85];
  const p = ease(t, pan, Math.max(1.2, maryland + 0.3 - pan), Easing.inOut(Easing.quad));
  const g = gcAt(proj, DCA, ELK, p);
  const elk = proj(ELK);
  const kSec = pop(t, ignited, fps, soft);
  const now = ease(t, since, 0.8, Easing.inOut(Easing.quad));
  const sparkOn = t >= vapour && t < vapour + 0.9 ? (Math.floor((t - vapour) / 0.15) % 2 === 0 ? 1 : 0.2) : 0;
  const glowK = t >= vapour ? Math.max(0, 1 - (t - vapour) / 1.6) : 0;
  const SX = 1440, SY = 400;
  const foil = 'M-300,0 C-300,-70 -120,-104 0,-92 C150,-80 300,-24 300,10 C200,32 -100,52 -300,0 Z';
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['USA']} box={MB} k={pop(t, a, fps, soft)} id="m25">
          <Bolt x0={elk[0] + 30} y0={elk[1] - 160} x1={elk[0]} y1={elk[1]} seed={51} k={strikeK(t, lightning)} w={4} />
          {t >= pan ? <Plane ac="b707" x={g.x} y={g.y} s={0.5} rot={g.ang} o={0.95} /> : null}
          <Pin t={t} fps={fps} a={maryland} pt={elk} label="ELKTON · MARYLAND" lx={22} ly={-16} anchor="start" r={9} size={20} />
        </MapPanel>
        <SvgPill t={t} fps={fps} a={december} x={MB[0] + 180} y={MB[1] + 50} w={220} size={22}>8 DEC 1963</SvgPill>
        <SvgPill t={t} fps={fps} a={pan} x={MB[0] + 180} y={MB[1] + 110} w={220} size={20} bg={WHITE}>PAN AM 707</SvgPill>
        <g transform={`translate(${SX}, ${SY}) scale(${Math.min(1, kSec)})`} opacity={Math.min(1, kSec)}>
          <path d={foil} fill={SILVER} />
          <path d={foil} fill="none" stroke={WHITE} strokeWidth={3} opacity={0.6} />
          <rect x={-200} y={-58} width={300} height={82} rx={14} fill={NAVY2} />
          <rect x={-200} y={-58} width={300} height={82} rx={14} fill={GREEN} opacity={0.35 * now} />
          <rect x={-200} y={-6} width={300} height={30} rx={8} fill={SKY} opacity={0.55} />
          {Array.from({length: 7}, (_, i) => { const ph = ((t * 0.5 + rnd(i + 120)) % 1); return <circle key={i} cx={-180 + i * 42 + 8 * Math.sin(t * 2 + i)} cy={-12 - ph * 36} r={3} fill={SKY} opacity={(1 - ph) * 0.8 * (1 - now)} />; })}
          <circle cx={-60} cy={-30} r={90} fill={RED} opacity={0.22 * glowK * (1 - now)} />
          <g transform="translate(-60, -30)">
            <path d="M0,-18 L4,-4 L18,0 L4,4 L0,18 L-4,4 L-18,0 L-4,-4 Z" fill={AMBER} opacity={Math.max(sparkOn, 0.35 * now)} />
            <Cross x={0} y={0} k={pop(t, spark, fps, bouncy)} r={22} />
          </g>
          <Lbl x={0} y={-130} size={16} o={0.7}>{now > 0.5 ? 'FUEL TANK · TODAY' : '707 WING · FUEL TANK · 1963'}</Lbl>
          <Lbl x={0} y={80} size={14} o={0.5}>WING CROSS-SECTION</Lbl>
        </g>
        <Tick x={SX + 200} y={SY - 90} k={pop(t, cant, fps, bouncy)} r={34} />
        <SvgPill t={t} fps={fps} a={cant} x={SX} y={SY + 150} w={140} size={22} bg={GREEN}>SAFE</SvgPill>
      </svg>
      <Num t={t} a={eighty} fps={fps} x={MB[0] + MB[2] - 60} y={MB[1] + 60} size={60} color={WHITE} align="right">81</Num>
    </Scene>
  );
}
// ---------- line 26 (the old line 23): a simple chart "RISK PER KM": one bar per decade, falling, no values; bars grow on "safest", a
// tick lands on each on "lesson"; TODAY on the chip ----------
function Scene26({t, at, fps, a, b}) {
  const safest = at(26, 'safest'), lesson = at(26, 'lesson');
  const decades = [1960, 1970, 1980, 1990, 2000, 2010, 2020];
  const hts = [460, 330, 230, 165, 110, 68, 42];
  const X0 = 500, DX = 134, BY = 800;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={ease(t, safest, 0.4)}>
          <rect x={X0 - 90} y={BY - 540} width={DX * 7 + 140} height={620} rx={20} fill={NAVY2} opacity={0.45} />
          <line x1={X0 - 40} y1={BY} x2={X0 + DX * 7} y2={BY} stroke={WHITE} strokeWidth={3} opacity={0.6} />
          {decades.map((yr, i) => {
            const k = ease(t, safest + i * 0.14, 0.8, Easing.out(Easing.cubic));
            return (
              <g key={yr}>
                <rect x={X0 + i * DX} y={BY - hts[i] * k} width={84} height={hts[i] * k} rx={12} fill={i < 3 ? RED : i < 5 ? AMBER : GREEN} opacity={0.9} />
                <Lbl x={X0 + i * DX + 42} y={BY + 32} size={16} o={0.7}>{yr}</Lbl>
                <Tick x={X0 + i * DX + 42} y={BY - hts[i] - 34} k={pop(t, lesson + i * 0.1, fps, bouncy)} r={14} />
              </g>
            );
          })}
          <Lbl x={X0 - 40} y={BY - 490} anchor="start" size={22} color={AMBER} o={0.95}>RISK PER KM</Lbl>
        </g>
      </svg>
    </Scene>
  );
}
// ---------- line 27 (the old line 24): real film from a window seat on the runway (oak, file from 20 s) until "climbs"; then the
// altitude ladder (Chapter 1's look): an A320 climbs the ladder to 10 km, "~10 KM" on "ten"; the air dots thin out upward on "thin";
// the engines glow on "engines" ----------
function Scene27({t, at, fps, a, b}) {
  const climbs = at(27, 'climbs'), ten = at(27, 'ten'), km = at(27, 'kilometres'), thin = at(27, 'thin'), engines = at(27, 'engines');
  const yOf = (k) => 840 - k * 55;
  const climb = ease(t, climbs, Math.max(1.6, km + 0.6 - climbs), Easing.inOut(Easing.quad));
  const px = lerp(760, 1250, climb), py = yOf(0.3 + 9.7 * climb);
  const kThin = ease(t, thin, 0.8), glow = 0.3 + 0.7 * ease(t, engines, 0.5);
  const kIn = ease(t, climbs, 0.5);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <Clip src={FILM.oak} from={20} a={a} b={climbs} t={t} fps={fps} zoom={[1.0, 1.08]} dark={0.25} />
      {t >= climbs ? (
        <AbsoluteFill style={{opacity: kIn}}>
          <Bg t={t} />
          <svg width={W} height={H} style={{position: 'absolute'}}>
            {kThin > 0 ? Array.from({length: 360}, (_, i) => {
              const col = i % 30, row = Math.floor(i / 30);
              const kmv = row * 1.0 + 0.4, y = yOf(kmv), x = 520 + col * 47 + (row % 2) * 23;
              return <circle key={i} cx={x} cy={y} r={2.5} fill={SKY} opacity={kThin * 0.6 * Math.max(0, 1 - kmv / 12.5)} />;
            }) : null}
            <line x1={380} y1={yOf(0)} x2={380} y2={yOf(12.5)} stroke={WHITE} strokeWidth={3} opacity={0.5} />
            {Array.from({length: 13}, (_, k) => (
              <g key={k}>
                <line x1={380} y1={yOf(k)} x2={k % 2 ? 396 : 412} y2={yOf(k)} stroke={WHITE} strokeWidth={k % 2 ? 2 : 3} opacity={0.6} />
                {k % 2 === 0 ? <Lbl x={364} y={yOf(k) + 8} anchor="end" size={18} o={0.6}>{k} KM</Lbl> : null}
              </g>
            ))}
            <CloudBand t={t} y={yOf(2.5)} x0={460} x1={1900} k={1} color={SILVER} o={0.4} n={16} />
            <path d={`M1480,${yOf(8.85)} L1520,${yOf(8.85) + 70} L1440,${yOf(8.85) + 70} Z`} fill={SILVER} opacity={0.7} />
            <Lbl x={1480} y={yOf(8.85) + 100} size={14} o={0.6}>EVEREST · 8.8 KM</Lbl>
            {climb > 0 ? Array.from({length: 30}, (_, i) => { const v = climb - i * 0.03; if (v < 0) return null; return <circle key={i} cx={lerp(760, 1250, v)} cy={yOf(0.3 + 9.7 * v)} r={3.5} fill={AMBER} opacity={0.8 * (1 - i / 30)} />; }) : null}
            <Side ac="a320" x={px} y={py} s={1.3} rot={-16 * Math.sin(climb * Math.PI)} glow={glow} />
            <SvgPill t={t} fps={fps} a={ten} x={1250} y={yOf(10) - 130} w={150} size={24}>~10 KM</SvgPill>
          </svg>
        </AbsoluteFill>
      ) : null}
    </Scene>
  );
}
// ---------- line 28 (the old line 27): a quick visual rewind in three shots: people watching birds (from the start), Eilmer's tower
// on "monk" with the monk leaping on "jumping", the Flyer on the beach on "twelve" with "12 S" on "seconds" ----------
function Scene28({t, at, fps, a, b}) {
  const monk = at(28, 'monk'), jumping = at(28, 'jumping'), twelve = at(28, 'twelve'), seconds = at(28, 'seconds'), north = at(28, 'North');
  const kA = 1 - ease(t, monk, 0.35), kM = ease(t, monk, 0.35) * (1 - ease(t, twelve, 0.35)), kF = ease(t, twelve, 0.35);
  const jump = ease(t, jumping, 1.6, Easing.inOut(Easing.quad));
  const mx = lerp(760, 1400, jump), my = lerp(352, 820, jump * jump) - 110 * Math.sin(jump * Math.PI);
  const flap = t >= jumping ? Math.sin((t - jumping) * 10) : 0;
  const lift = 40 * ease(t, seconds, 1.2);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      {kA > 0 ? (
        <AbsoluteFill style={{opacity: kA}}>
          <svg width={W} height={H} style={{position: 'absolute'}}>
            <ellipse cx={700} cy={900} rx={700} ry={110} fill={GREEN} opacity={0.25} />
            {[0, 1, 2, 3, 4, 5].map((i) => <Bird key={i} x={300 + ((t * 120 + i * 260) % 1700)} y={240 + 140 * rnd(i + 950) + 20 * Math.sin(t * 2 + i)} s={4} ph={t * 7 + i} rot={-6} />)}
            <Man x={700} y={820} s={14} color={AMBER} pose="wave" flap={0.5 + 0.5 * Math.sin(t * 3)} />
            <Man x={820} y={822} s={12} color={WHITE} />
          </svg>
        </AbsoluteFill>
      ) : null}
      {kM > 0 ? (
        <AbsoluteFill style={{opacity: kM}}>
          <svg width={W} height={H} style={{position: 'absolute'}}>
            <rect x={0} y={820} width={W} height={260} fill={GREEN} opacity={0.2} />
            <rect x={610} y={360} width={180} height={460} fill={STONE} />
            {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={610 + i * 40} y={330} width={24} height={30} fill={STONE} />)}
            {Array.from({length: 24}, (_, i) => <line key={i} x1={610} y1={400 + i * 18} x2={790} y2={400 + i * 18} stroke={NAVY} strokeWidth={1} opacity={0.25} />)}
            <path d="M680,820 L680,740 A20,20 0 0 1 720,740 L720,820 Z" fill={NAVY} opacity={0.7} />
            <g transform={`translate(${mx}, ${my}) rotate(${jump * 25})`}>
              <path d={`M-50,-150 Q-120,${-200 - 30 * flap} -190,${-150 - 50 * flap} L-40,-110 Z`} fill={PAPER} opacity={0.9} />
              <path d={`M50,-150 Q120,${-200 - 30 * flap} 190,${-150 - 50 * flap} L40,-110 Z`} fill={PAPER} opacity={0.9} />
              <Man x={0} y={0} s={12} color={AMBER} pose="arms" flap={flap} />
            </g>
            <Puff x={1400} y={820} k={lin(t, jumping + 1.5, 0.8)} color={SAND2} />
            <SvgPill t={t} fps={fps} a={monk} x={700} y={250} w={320} size={20} bg={WHITE}>MALMESBURY · ~1010</SvgPill>
          </svg>
        </AbsoluteFill>
      ) : null}
      {kF > 0 ? (
        <AbsoluteFill style={{opacity: kF}}>
          <svg width={W} height={H} style={{position: 'absolute'}}>
            <Sand t={t} y={820} rail={[500, 1500]} wind={0.6} />
            <FlyerSide x={960} y={820 - 24 - lift} s={6} rot={-4 * ease(t, seconds, 1.2)} pilot={1} spin={1} />
            <SvgPill t={t} fps={fps} a={seconds} x={960} y={560} w={120} size={24}>12 S</SvgPill>
            <SvgPill t={t} fps={fps} a={north} x={300} y={150} w={300} size={20} bg={WHITE}>KILL DEVIL HILLS</SvgPill>
            <SvgPill t={t} fps={fps} a={twelve} x={1620} y={150} w={220} size={20}>17 DEC 1903</SvgPill>
          </svg>
        </AbsoluteFill>
      ) : null}
    </Scene>
  );
}
// ---------- line 29 (the old line 28): a calm last beat. a 787 climbs into a sunset, wings flexed up, a slow push; fade to navy from
// "still" ----------
function Scene29({t, at, fps, a, b, seconds}) {
  const still = at(29, 'still');
  const k = ease(t, a, 5.0, Easing.inOut(Easing.quad));
  const out = ease(t, still, Math.max(0.5, seconds - still), Easing.inOut(Easing.quad));
  const px = lerp(560, 1000, k), py = lerp(620, 400, k);
  return (
    <Scene t={t} a={a}>
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${NAVY} 0%, #3A2E4F 45%, #B5602F 78%, ${AMBER} 100%)`}} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <Sun x={1360} y={760} r={110} k={1} />
        <rect x={0} y={790} width={W} height={300} fill="#2A1E36" opacity={0.9} />
        <CloudTops t={t} y={820} k={1} color="#5A3E58" o={0.8} />
        <g transform={`translate(960, 540) scale(${1 + 0.12 * k}) translate(-960, -540)`}>
          <Side ac="b787" x={px} y={py} s={1.9} rot={-12} flex={2.5} glow={1} />
        </g>
      </svg>
      <AbsoluteFill style={{background: NAVY, opacity: out, pointerEvents: 'none'}} />
    </Scene>
  );
}

// the running year chip: which label is showing at time t, and since when (the client's list)
const yearSchedule = (at, lines) => {
  const has = (i) => Boolean(lines[i]);
  const s = [[has(0) ? at(0, '1952') : 0, '1952']];
  if (has(2)) s.push([at(2, '1954'), '1954']);
  if (has(6)) s.push([at(6, '1958'), '1958']);
  if (has(8)) s.push([at(8, '1969'), '1969']);
  if (has(9)) s.push([at(9, '1970'), '1970']);
  if (has(11)) s.push([at(11, '1976'), '1976']);
  if (has(12)) s.push([at(12, '1970'), '1970']);
  if (has(13)) s.push([at(13, '1977'), '1977']);
  if (has(15)) s.push([at(15, '1978'), '1978']);
  if (has(16)) s.push([at(16, '1988'), '1988']);
  if (has(17)) s.push([at(17, '1967'), '1967 / 1988']);
  if (has(18)) s.push([at(18, '777'), '1995']);
  if (has(19)) s.push([at(19, '2001'), '2001']);
  if (has(20)) { s.push([at(20, '2007'), '2007']); s.push([at(20, 'Four'), '2011']); }
  if (has(22)) { s.push([at(22, '2019'), '2019']); s.push([at(22, 'next'), '2020']); }
  if (has(23)) s.push([at(23, 'lightning'), 'TODAY']);
  if (has(25)) s.push([at(25, '1963'), '1963']);
  if (has(26)) s.push([at(26, 'today'), 'TODAY']);
  return s;
};
const SCENES = [Scene0, Scene1, Scene2, Scene3, Scene4, Scene5, Scene6, Scene7, Scene8, Scene9, Scene10, Scene11, Scene12, Scene13, Scene14,
                Scene15, Scene16, Scene17, Scene18, Scene19, Scene20, Scene21, Scene22, Scene23, Scene24, Scene25, Scene26, Scene27, Scene28, Scene29];

export const AviHistory3 = ({lines = [], words = [], seconds = 376.9}) => {
  const {fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;
  const at = makeAt(lines);
  const T = (i) => (lines[i] ? lines[i].t0 : seconds);
  const scenes = SCENES.map((C, i) => [i === 0 ? 0 : T(i), i === SCENES.length - 1 ? seconds + 1 : T(i + 1), C]);
  const sched = yearSchedule(at, lines);
  let label = sched[0][1], since = sched[0][0];
  for (const [ts, lb] of sched) { if (t >= ts) { label = lb; since = ts; } }
  return (
    <AbsoluteFill style={{background: NAVY}}>
      {scenes.map(([a, b, C], i) => (t >= a && t < b + XF ? <C key={i} t={t} at={at} fps={fps} a={a} b={b} lines={lines} seconds={seconds} /> : null))}
      <CaptionBand />
      {t >= sched[0][0] ? <YearChip t={t} fps={fps} label={label} since={since} /> : null}
      <AbsoluteFill style={{background: NAVY, opacity: interpolate(t, [seconds - 0.4, seconds], [0, 1], CL), pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};
