// AviHistory2.jsx: History of aviation, Chapter 2 "From the first flight to the jet age" (client: Bassel), made with Fable.
// 1920x1080, 30 fps, 6 min 16 s, plays under the recorded narration (timing.json: 31 lines, word times). Same series as Chapter 1
// (ref/AviHistory1.jsx): the same look (deep navy, white, amber, flat infographics, gentle springs), the same helpers, year chip,
// MapPanel, picture frames, the Flyer and airliner drawings. Real maps (geo.json + d3-geo). Every drawn aircraft uses REAL
// proportions (the client's rule): 10 px per metre at scale 1, and two aircraft shown together always share one scale.
// Captions are drawn by a wrapper along the bottom (y 935-1040): important things stay above y 900. Every frame is a pure function
// of the frame number; every animation is driven by the word times (helper at(lineIndex, 'word')).
import React from 'react';
import {AbsoluteFill, Sequence, OffthreadVideo, Img, staticFile, interpolate, spring, Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import {geoMercator, geoPath, geoGraticule10, geoInterpolate} from 'd3-geo';
import geo from './geo.json';   // Natural Earth (public domain): geo.world.features, properties.a3 = ISO3; geo.rivers

// the "possibly" pictures (still downloading while this was written). The Builder switches on the ones that exist; each has a drawn
// fallback. Files: av2-wilbur-lemans-1908.jpg, av2-santos-dumont-14bis.jpg, av2-bleriot-1909.jpg, av2-fokker-eindecker.jpg,
// av2-wwi-fighters.jpg, av2-alcock-brown-1919.jpg, av2-lindbergh-1927.jpg, av2-earhart-1932.jpg, av2-dc3.jpg, av2-hindenburg-1937.jpg,
// av2-he178.jpg, av2-spitfire.jpg, av2-p51.jpg, av2-me262.jpg, av2-b17-formation.jpg, av2-chicago-1944.jpg, av2-x1-1947.jpg, av2-comet-1949.jpg
const HAVE = {wilbur: true, santos: false, bleriot: true, fokker: true, camel: true, vimy: true, lindbergh: true, earhart: true,
  dc3: true, hindenburg: true, he178: true, spitfire: true, p51: true, me262: true, b17: true, chicago: false, x1: true, comet: false};
const PIC = {wilbur: 'av2-wilbur-lemans-1908.jpg', santos: 'av2-santos-dumont-14bis.jpg', bleriot: 'av2-bleriot-1909.jpg', fokker: 'av2-fokker-eindecker.jpg',
  camel: 'av2-wwi-fighters.jpg', vimy: 'av2-alcock-brown-1919.jpg', lindbergh: 'av2-lindbergh-1927.jpg', earhart: 'av2-earhart-1932.jpg', dc3: 'av2-dc3.jpg',
  hindenburg: 'av2-hindenburg-1937.jpg', he178: 'av2-he178.jpg', spitfire: 'av2-spitfire.jpg', p51: 'av2-p51.jpg', me262: 'av2-me262.jpg',
  b17: 'av2-b17-formation.jpg', chicago: 'av2-chicago-1944.jpg', x1: 'av2-x1-1947.jpg', comet: 'av2-comet-1949.jpg'};
const NEWSREEL = 'hindenburg-newsreel-1937.mp4';   // Universal Newsreel 1937, 1920x1440 (4:3, cropped to 16:9 by object-fit cover). Only 6-55 s and 68-105 s are used.
// real films that are always there (review 2)
const LINDBERGH = 'lindbergh-paris-1927.mp4';   // a 4:3 newsreel letterboxed in 1920x1080: ALWAYS zoom >= 1.35, focus left/down (the black bars and the AP logo top-right crop out)
const A380 = 'a380-takeoff-yyz.mp4';            // today: an A380 head-on in mist, 0-34 s, airborne from ~12 s
const B747 = 'b747-takeoff-pae.mp4';            // today: a 747-8 climbing past, 0-14 s
// real films still downloading (review 2): the Builder switches them on; each has an animated fallback. First 60 s of each are used.
const FILMS = {airDepot: false, junkers: false, ju52: false, p51: false, warbirds: false};
const FILM = {airDepot: 'air-depot-1918.mp4', junkers: 'junkers-f13-1922.mp4', ju52: 'ju52-flight.mp4', p51: 'p51-flyby.mp4', warbirds: 'warbirds-flyby.mp4'};

const W = 1920, H = 1080;
const NAVY = '#0B1B33', NAVY2 = '#152C4F', WHITE = '#FFFFFF', AMBER = '#FFB547';
const SKY = '#7FB8E6', RED = '#FF5C5C', GREEN = '#6FD48F', LAND = '#2A4570', LAND2 = '#3D5C8E', SEA = '#0E2447';
const SAND = '#C9B27A', SAND2 = '#E2CF9A', PAPER = '#F1E8D2', INK = '#2B2416', SILVER = '#C9D3E0', WOOD = '#8A6A3A';
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
// a word's time only if that line really says it, else never (the Builder 11-18: the merged video drops words some scenes listened for)
const said = (lines, li, word) => Boolean(lines[li] && lines[li].words.some((w) => cleanW(w[0]).startsWith(cleanW(word))));
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
// dots along a quadratic path up to fraction p
const dotted = (p0, c, p1, p, n = 40, color = AMBER, r = 4.5) => Array.from({length: n}, (_, i) => {
  const u = (i + 1) / n;
  if (u > p) return null;
  const q = qb(p0, c, p1, u);
  return <circle key={i} cx={q.x} cy={q.y} r={r} fill={color} opacity={0.9} />;
});
// dots along a list of projected points (a great circle) up to fraction p
const dottedPts = (pts, p, color = AMBER, r = 4.5) => pts.map((q, i) => (q && (i + 1) / pts.length <= p ? <circle key={i} cx={q[0]} cy={q[1]} r={r} fill={color} opacity={0.9} /> : null));
// a great circle between two lon/lat points, projected: n points; point and heading at fraction u
const greatCircle = (proj, A, B, n = 60) => {
  const ip = geoInterpolate(A, B);
  return Array.from({length: n}, (_, i) => proj(ip((i + 1) / n)));
};
const gcAt = (proj, A, B, u) => {
  const ip = geoInterpolate(A, B);
  const p = proj(ip(clamp01(u))), q = proj(ip(clamp01(u) + 0.01));
  return {x: p[0], y: p[1], ang: Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI};
};

// ---------- real geography ----------
const LAND_FC = geo.world;
const RIVERS = geo.rivers || null;
const GRAT = geoGraticule10();
// review 2: geo.detail holds DETAILED outlines for the countries the chapter shows; where one exists it replaces the world shape
const DETAIL_FC = geo.detail && geo.detail.features ? geo.detail : {type: 'FeatureCollection', features: []};
const DETAIL_SET = new Set(DETAIL_FC.features.map((f) => f.properties.a3));
const LAND_ALL = {type: 'FeatureCollection', features: LAND_FC.features.filter((f) => !DETAIL_SET.has(f.properties.a3)).concat(DETAIL_FC.features)};
const feats = (a3s) => ({type: 'FeatureCollection', features: LAND_ALL.features.filter((f) => a3s.includes(f.properties.a3))});
const COAST = '#6D8DBB', BORDER = '#4E6C9C', LAND_HI = '#4A6CA8';
const fitBox = (ll, box, pad = 0) => geoMercator().fitExtent([[box[0] + pad, box[1] + pad], [box[0] + box[2] - pad, box[1] + box[3] - pad]],
  {type: 'MultiPoint', coordinates: [[ll[0], ll[1]], [ll[2], ll[1]], [ll[2], ll[3]], [ll[0], ll[3]]]});
const camState = (p, c) => ({scale: p.scale(), center: p.invert(c)});
const camLerp = (A, B, k, c) => geoMercator()
  .scale(Math.exp(lerp(Math.log(A.scale), Math.log(B.scale), k)))
  .center([lerp(A.center[0], B.center[0], k), lerp(A.center[1], B.center[1], k)]).translate(c);
const boxC = (box) => [box[0] + box[2] / 2, box[1] + box[3] / 2];
const zoomBox = (ll0, ll1, box, k, pad = 0) => (k <= 0 ? fitBox(ll0, box, pad) : k >= 1 ? fitBox(ll1, box, pad) : camLerp(camState(fitBox(ll0, box, pad), boxC(box)), camState(fitBox(ll1, box, pad), boxC(box)), k, boxC(box)));
const MAP_W = [160, 90, 1600, 790];         // a wide map panel
const LL = {USA_E: [-100, 25, -66, 47], NC: [-78.5, 33.8, -74.2, 37.3], OHIO: [-85.8, 38.3, -80.3, 42.4], FRA: [-5, 42, 9, 51.5],
            CHANNEL: [-2.2, 49.6, 3.4, 52.2], ATL_N: [-62, 40, 2, 58], NLD: [2.5, 50.3, 8, 54], USA: [-125, 24, -66, 50],
            ATL_NY: [-82, 33, 12, 60], EUR: [-11, 34, 33, 61], SENG: [-6.5, 48.8, 4, 53.5], WORLD: [-170, -55, 180, 75]};

// ---------- shared building blocks (Chapter 1's) ----------
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
// a public-domain picture: cover or contain on a dark backdrop, a slow push, a vignette, a light grain, credit tag
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
// a picture that may not exist: the real photo when HAVE[key] is true, otherwise a drawn fallback inside a framed panel
function Pic({have, id, a, b, t, fps, box, fit = 'contain', gray = true, dim = 0, fallback}) {
  if (HAVE[have]) return <Photo src={PIC[have]} id={id} a={a} b={b} t={t} box={box} fit={fit} radius={20} zoom={[1.0, 1.08]} gray={gray} dim={dim} />;
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
const Tick = ({x, y, k = 1, r = 44}) => (k <= 0 ? null : (
  <g transform={`translate(${x}, ${y}) scale(${k})`} opacity={Math.min(1, k)}>
    <circle r={r} fill={GREEN} />
    <path d={`M${-r * 0.45},${r * 0.05} L${-r * 0.12},${r * 0.4} L${r * 0.5},${-r * 0.4}`} stroke={NAVY} strokeWidth={r * 0.22} fill="none" strokeLinecap="round" strokeLinejoin="round" />
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
// a map panel (review 2: a real-map look): sea with a subtle dot texture and graticule, the land from the detailed outlines where
// they exist (else the world shapes), a lighter coastline (a wide pale stroke under the fills), thin lighter-navy borders between
// countries, the highlighted countries in a brighter fill with an accent stroke
function MapPanel({proj, hi = [], box, k = 1, id, children, o = 1, rx = 28, rivers = 0, hiColor = AMBER}) {
  if (k <= 0) return null;
  const path = geoPath(proj.clipExtent([[box[0], box[1]], [box[0] + box[2], box[1] + box[3]]]));
  const c = boxC(box);
  const landD = path(LAND_ALL) || '';
  return (
    <g transform={`translate(${c[0]}, ${c[1]}) scale(${0.92 + 0.08 * Math.min(1, k)}) translate(${-c[0]}, ${-c[1]})`} opacity={Math.min(1, k) * o}>
      <defs>
        <clipPath id={`${id}-clip`}><rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} rx={rx} /></clipPath>
        <pattern id={`${id}-sea`} width={14} height={14} patternUnits="userSpaceOnUse"><circle cx={7} cy={7} r={1.1} fill={WHITE} opacity={0.5} /></pattern>
      </defs>
      <rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} rx={rx} fill={SEA} />
      <g clipPath={`url(#${id}-clip)`}>
        <rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} fill={`url(#${id}-sea)`} opacity={0.12} />
        <path d={path(GRAT) || ''} stroke={WHITE} strokeWidth={1} fill="none" opacity={0.1} />
        <path d={landD} fill="none" stroke={COAST} strokeWidth={3.5} strokeLinejoin="round" opacity={0.55} />
        <path d={landD} fill={LAND} stroke="none" />
        <path d={landD} fill="none" stroke={BORDER} strokeWidth={1} strokeLinejoin="round" opacity={0.9} />
        {hi.length ? <path d={path(feats(hi)) || ''} fill={LAND_HI} stroke={hiColor} strokeWidth={2} strokeLinejoin="round" opacity={0.95} /> : null}
        {rivers > 0 && RIVERS ? <path d={path(RIVERS) || ''} stroke={SKY} strokeWidth={rivers} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} /> : null}
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
// a person as a flat silhouette: head, shoulders, coat to the knee, two legs; 1.8 m tall at scale 1 (feet at y 0). pose 'stand' | 'arms' | 'lie' | 'wave'
const Man = ({x, y, s = 1, rot = 0, color = AMBER, o = 1, pose = 'stand', flap = 0}) => (
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
    )}
  </g>
);
// a crowd: n silhouettes in a row with a little jitter, k 0..1 fades them in from the middle outwards
const Crowd = ({x, y, n = 20, s = 5, k = 1, color = WHITE, spread = 40, seed = 0, wave = 0, t = 0}) => (
  <g>
    {Array.from({length: n}, (_, i) => {
      const u = i / Math.max(1, n - 1), d = Math.abs(u - 0.5) * 2;
      const kk = clamp01(k * 1.6 - d * 0.6);
      if (kk <= 0) return null;
      return <Man key={i} x={x + (u - 0.5) * spread * n + (rnd(i + seed) - 0.5) * 20} y={y + (rnd(i + seed + 7) - 0.5) * 8} s={s * (0.9 + 0.2 * rnd(i + seed + 3))} color={color} o={kk * (0.7 + 0.3 * rnd(i + seed + 9))}
                  pose={wave > 0 && i % 3 === 0 ? 'wave' : 'stand'} flap={Math.sin(t * 6 + i)} />;
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
// a sun with soft rays, for the sunset
const Sun = ({x, y, r = 90, k = 1, t = 0}) => (k <= 0 ? null : (
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

// =====================================================================================================================
// drawn aircraft, all at 10 px per metre at scale 1 (REAL proportions, the client's rule). Top views: nose to +x, origin at the
// centre of the fuselage. Dimensions in the spec table are the real ones (span x length in metres).
// =====================================================================================================================
// a generic monoplane / biplane seen from above. wingAt = the wing's position along the length (fraction from the nose), chord in
// metres, taper = tip chord / root chord, sweep = how far back the tip sits (m), ellip = elliptical wing (Spitfire), bi = extra wing
// layers (1 biplane, 2 triplane), props = [[x, y]] (m) propeller discs, jets = [[x, y, len, buried]] (m) jet nacelles / buried jets,
// canard = [x, span] a front elevator, glow 0..1 lights the jets' exhaust, dims shows the span and length dimension lines
const PlaneTop = ({x, y, s = 1, rot = 0, color = WHITE, o = 1, span, len, fw = 1.1, wingAt = 0.45, chord = 2, taper = 0.6, sweep = 0, ellip = false,
                   tailSpan = 0, tailChord = 1, props = [], jets = [], bi = 0, canard = null, bullet = false, glow = 0, dims = false, accent = AMBER, spin = 1, children}) => {
  const L = len * 10, S = span * 10, hw = fw * 5;
  const xw = L / 2 - wingAt * L, c = chord * 10, tc = c * taper, sw = sweep * 10;
  const le = xw + c * 0.6, te = xw - c * 0.4;
  const wing = ellip
    ? `M${le},${-hw} C${le},${-S * 0.34} ${le - c * 0.25},${-S / 2} ${xw},${-S / 2} C${te + c * 0.1},${-S / 2} ${te},${-S * 0.34} ${te},${-hw} L${te},${hw} C${te},${S * 0.34} ${te + c * 0.1},${S / 2} ${xw},${S / 2} C${le - c * 0.25},${S / 2} ${le},${S * 0.34} ${le},${hw} Z`
    : closed([[le, -hw], [le - sw, -S / 2], [le - sw - tc, -S / 2], [te, -hw], [te, hw], [le - sw - tc, S / 2], [le - sw, S / 2], [le, hw]]);
  const TS = tailSpan * 10, tcr = tailChord * 10, xt = -L / 2 + tcr * 0.15;
  const tail = TS > 0 ? closed([[xt + tcr, -hw * 0.5], [xt + tcr * 0.45, -TS / 2], [xt, -TS / 2], [xt, hw * 0.5], [xt, TS / 2], [xt + tcr * 0.45, TS / 2], [xt + tcr, hw * 0.5]]) : '';
  const nose = bullet ? `M${L / 2},0 C${L / 2},${-hw * 0.5} ${L / 2 - hw * 4},${-hw} ${L / 2 - hw * 5},${-hw}` : `M${L / 2},0 C${L / 2},${-hw} ${L / 2 - hw * 1.6},${-hw} ${L / 2 - hw * 2.5},${-hw}`;
  const fus = `${nose} L${-L / 2 + hw * 1.5},${-hw * 0.55} L${-L / 2},${-hw * 0.2} L${-L / 2},${hw * 0.2} L${-L / 2 + hw * 1.5},${hw * 0.55} L${L / 2 - hw * (bullet ? 5 : 2.5)},${hw} C${L / 2 - hw * (bullet ? 4 : 1.6)},${hw} ${L / 2},${hw} ${L / 2},0 Z`;
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
      {Array.from({length: bi}, (_, i) => <path key={i} d={wing} fill={color} opacity={0.45 - i * 0.12} transform={`translate(${-7 * (i + 1)}, 0)`} />)}
      <path d={wing} fill={color} />
      {bi > 0 ? [-0.44, -0.22, 0.22, 0.44].map((u) => <line key={u} x1={le - 2} y1={u * S} x2={te + 2} y2={u * S} stroke={NAVY} strokeWidth={1.2} opacity={0.5} />) : null}
      {tail ? <path d={tail} fill={color} /> : null}
      {canard ? <rect x={canard[0] * 10 - 5} y={-canard[1] * 5} width={10} height={canard[1] * 10} fill={color} opacity={0.9} /> : null}
      {canard ? [-3, 3].map((ry) => <rect key={ry} x={-L / 2 - 4} y={ry - 1.5} width={13} height={3} rx={1.5} fill={color} />) : null}{/* the twin rudders at the tail (the Builder, Bassel 11-18: 'circling backwards') */}
      {canard ? <line x1={canard[0] * 10} y1={0} x2={-L / 2 + 3} y2={0} stroke={color} strokeWidth={2.5} /> : null}
      <path d={fus} fill={color} />
      <rect x={-L / 2} y={-1} width={Math.max(8, L * 0.16)} height={2} fill={accent} opacity={0.9} />
      <path d={`M${L / 2 - hw * (bullet ? 7 : 4.5)},${-hw * 0.55} L${L / 2 - hw * (bullet ? 5 : 2.5)},${-hw * 0.5} L${L / 2 - hw * (bullet ? 5 : 2.5)},${hw * 0.5} L${L / 2 - hw * (bullet ? 7 : 4.5)},${hw * 0.55} Z`} fill={NAVY} opacity={0.55} />
      {props.map(([px, py], i) => (
        <g key={i} transform={`translate(${px * 10}, ${py * 10})`}>
          {py !== 0 ? <rect x={-22} y={-6} width={32} height={12} rx={5} fill={color} /> : null}
          <ellipse rx={2.5} ry={12 * (0.35 + 0.65 * spin)} fill={color} opacity={0.5 + 0.3 * (1 - spin)} />
          <circle r={2.2} fill={accent} />
        </g>
      ))}
      {jets.map(([jx, jy, jl, buried], i) => (
        <g key={i} transform={`translate(${jx * 10}, ${jy * 10})`}>
          {buried ? <rect x={-jl * 5} y={-3.5} width={jl * 10} height={7} rx={2} fill={NAVY} opacity={0.8} /> : <rect x={-jl * 5} y={-6} width={jl * 10} height={12} rx={5} fill={color} stroke={NAVY} strokeWidth={1.2} />}
          {glow > 0 ? <ellipse cx={-jl * 5 - 10 * glow} cy={0} rx={14 * glow} ry={3.5} fill={AMBER} opacity={0.9 * glow} /> : null}
          {glow > 0 ? <ellipse cx={-jl * 5 - 28 * glow} cy={0} rx={22 * glow} ry={2.5} fill={AMBER} opacity={0.4 * glow} /> : null}
        </g>
      ))}
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
// the real aircraft (span x length in metres) with their layouts
const AC = {
  flyer: {span: 12.3, len: 6.4, fw: 0.5, wingAt: 0.62, chord: 2.0, taper: 1, bi: 1, canard: [2.6, 4.6], props: [[-1.9, -1.6], [-1.9, 1.6]], tailSpan: 0},
  bleriot: {span: 7.8, len: 7.6, fw: 0.8, wingAt: 0.3, chord: 2.1, taper: 0.9, tailSpan: 2.9, tailChord: 1.3, props: [[3.8, 0]]},
  fokkerE: {span: 8.95, len: 6.75, fw: 0.9, wingAt: 0.34, chord: 1.8, taper: 0.85, tailSpan: 3.2, tailChord: 1.1, props: [[3.4, 0]]},
  dr1: {span: 7.2, len: 5.77, fw: 0.9, wingAt: 0.42, chord: 1.0, taper: 1, bi: 2, tailSpan: 2.6, tailChord: 1.0, props: [[2.9, 0]]},
  camel: {span: 8.5, len: 5.7, fw: 0.9, wingAt: 0.42, chord: 1.6, taper: 1, bi: 1, tailSpan: 2.6, tailChord: 1.0, props: [[2.85, 0]]},
  be2: {span: 11.2, len: 8.3, fw: 0.9, wingAt: 0.42, chord: 1.7, taper: 1, bi: 1, tailSpan: 3.6, tailChord: 1.3, props: [[4.15, 0]]},
  albatros: {span: 12.8, len: 8.2, fw: 1.0, wingAt: 0.44, chord: 1.7, taper: 1, bi: 1, tailSpan: 3.8, tailChord: 1.3, props: [[4.1, 0]]},
  vimy: {span: 20.5, len: 13, fw: 1.3, wingAt: 0.46, chord: 3.2, taper: 1, bi: 1, tailSpan: 4.8, tailChord: 1.6, props: [[1.4, -3.3], [1.4, 3.3]]},
  spirit: {span: 14, len: 8.4, fw: 1.0, wingAt: 0.32, chord: 2.1, taper: 1, tailSpan: 3.6, tailChord: 1.2, props: [[4.2, 0]]},
  vega: {span: 12.5, len: 8.4, fw: 1.3, wingAt: 0.36, chord: 2.6, taper: 0.5, tailSpan: 3.9, tailChord: 1.2, props: [[4.2, 0]]},
  fokkerF2: {span: 16.1, len: 11.6, fw: 1.3, wingAt: 0.34, chord: 3.0, taper: 0.6, tailSpan: 4.5, tailChord: 1.4, props: [[5.8, 0]]},
  dh4: {span: 13.2, len: 9.4, fw: 1.0, wingAt: 0.44, chord: 1.7, taper: 1, bi: 1, tailSpan: 4.2, tailChord: 1.3, props: [[4.7, 0]]},
  dc3: {span: 29, len: 19.7, fw: 2.3, wingAt: 0.46, chord: 4.3, taper: 0.3, sweep: 2.5, tailSpan: 8.0, tailChord: 2.4, props: [[5.2, -4.6], [5.2, 4.6]]},
  stratoliner: {span: 32.7, len: 22.7, fw: 3.6, wingAt: 0.46, chord: 5, taper: 0.3, sweep: 2, tailSpan: 10, tailChord: 2.6, props: [[6.0, -4.5], [6.0, 4.5], [5.4, -9.3], [5.4, 9.3]]},
  he178: {span: 7.2, len: 7.5, fw: 1.4, wingAt: 0.5, chord: 2.0, taper: 0.5, tailSpan: 2.6, tailChord: 1.0},
  spitfire: {span: 11.2, len: 9.1, fw: 1.0, wingAt: 0.44, chord: 2.5, ellip: true, tailSpan: 3.1, tailChord: 1.1, props: [[4.55, 0]]},
  bf109: {span: 9.9, len: 8.9, fw: 0.9, wingAt: 0.44, chord: 2.1, taper: 0.5, sweep: 0.5, tailSpan: 3.0, tailChord: 1.0, props: [[4.45, 0]]},
  p51: {span: 11.3, len: 9.8, fw: 1.0, wingAt: 0.44, chord: 2.6, taper: 0.5, sweep: 0.6, tailSpan: 4.0, tailChord: 1.2, props: [[4.9, 0]]},
  me262: {span: 12.5, len: 10.6, fw: 1.3, wingAt: 0.5, chord: 2.6, taper: 0.5, sweep: 2.2, tailSpan: 4.0, tailChord: 1.3, jets: [[0.4, -2.6, 3.6], [0.4, 2.6, 3.6]]},
  x1: {span: 8.5, len: 9.4, fw: 1.4, wingAt: 0.52, chord: 1.6, taper: 0.7, tailSpan: 3.4, tailChord: 1.0, bullet: true},
  comet: {span: 35, len: 28.6, fw: 3.0, wingAt: 0.52, chord: 6, taper: 0.3, sweep: 7, tailSpan: 11, tailChord: 3, jets: [[1.6, -2.4, 5, 1], [1.6, -3.9, 5, 1], [1.6, 2.4, 5, 1], [1.6, 3.9, 5, 1]]},
  b17: {span: 31.6, len: 22.7, fw: 2.3, wingAt: 0.46, chord: 5.5, taper: 0.4, sweep: 1.5, tailSpan: 13, tailChord: 2.8, props: [[4.6, -4.6], [4.6, 4.6], [4.2, -9.2], [4.2, 9.2]]},
  a320: {span: 35.8, len: 37.6, fw: 4, wingAt: 0.5, chord: 7, taper: 0.3, sweep: 10, tailSpan: 12.5, tailChord: 3, jets: [[6, -5.7, 4.6], [6, 5.7, 4.6]]},
};
const Plane = ({ac, ...rest}) => <PlaneTop {...AC[ac]} {...rest} />;
// a plane seen from the side, nose to +x, 10 px per metre (review 1: real side-view ratios, no toy bodies). All sizes in metres:
// len = fuselage length, fh = fuselage max height (so len/fh is the slenderness), fin = fin height ABOVE the fuselage top,
// finRoot = fin root chord as a fraction of len (narrow fins: 0.1-0.14), wingAt = the wing root's position (fraction from the nose),
// chord = root chord seen edge-on, sweep = how far back the tip sits, wing 'low' | 'mid' | 'high', engines = prop nacelles as x
// offsets (m) from the wing's leading edge (positive = ahead of it), jets = [[x from the centre (m), buried]], glow 0..1 lights the
// jet exhaust, bullet = a long ogive nose (the X-1), windows = a row of cabin windows, canopy = a fighter canopy bump
const PlaneSide = ({x, y, s = 1, rot = 0, color = WHITE, o = 1, len, fh = 2.4, fin = 3, finRoot = 0.13, wingAt = 0.45, chord = 3, sweep = 0, wing = 'low',
                    engines = [], jets = [], glow = 0, bullet = false, windows = 0, canopy = false, accent = AMBER, spin = 1}) => {
  const L = len * 10, h = fh * 5, FIN = fin * 10, root = L * finRoot, C = chord * 10;
  const nl = bullet ? L * 0.34 : Math.min(L * 0.16, h * 2.4);      // the nose length
  const tl = bullet ? L * 0.22 : L * 0.2;                             // the tail cone
  const nx = L / 2 - nl, tx = -L / 2 + tl;
  const fus = `M${L / 2},0 C${L / 2},${-h * 0.5} ${L / 2 - nl * 0.45},${-h} ${nx},${-h} L${tx},${-h * (bullet ? 0.7 : 0.9)} L${-L / 2},${-h * 0.22} L${-L / 2},${h * 0.1} L${tx},${h * (bullet ? 0.7 : 1)} L${nx},${h} C${L / 2 - nl * 0.45},${h} ${L / 2},${h * 0.5} ${L / 2},0 Z`;
  const rootLE = -L / 2 + root, tipTE = -L / 2 + root * 0.06, tipLE = tipTE + root * 0.42;
  const finD = closed([[rootLE, -h * 0.85], [tipLE, -h - FIN], [tipTE, -h - FIN], [-L / 2, -h * 0.22]]);
  const xw = L / 2 - wingAt * L, LE = xw + C * 0.6, TE = xw - C * 0.4;
  const wy = wing === 'high' ? -h * 0.72 : wing === 'mid' ? 0 : h * 0.4;
  const th = Math.max(2, C * 0.1), dih = h * 0.5, sw = sweep * 10;
  const wingD = closed([[LE, wy - th * 0.5], [LE - sw, wy + dih - th * 0.25], [LE - sw - C * 0.45, wy + dih + th * 0.25], [TE, wy + th * 0.5]]);
  const tpY = -h * 0.15, tpRoot = root * 0.6;
  const tailplaneD = closed([[-L / 2 + tpRoot, tpY - 1.5], [-L / 2 - root * 0.05, tpY + 1.5], [-L / 2 - root * 0.05, tpY + 4.5], [-L / 2 + tpRoot * 0.3, tpY + 1.5]]);
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
      <path d={finD} fill={color} />
      <path d={tailplaneD} fill={color} opacity={0.85} />
      <path d={fus} fill={color} />
      {canopy ? <path d={`M${nx - h * 0.2},${-h} Q${nx - h * 1.2},${-h * 1.9} ${nx - h * 2.6},${-h * 1.6} L${nx - h * 4},${-h} Z`} fill={color} /> : null}
      {canopy ? <path d={`M${nx - h * 0.4},${-h} Q${nx - h * 1.2},${-h * 1.7} ${nx - h * 2.5},${-h * 1.45} L${nx - h * 3.6},${-h} Z`} fill={NAVY} opacity={0.6} /> : null}
      {!canopy ? <path d={`M${nx + nl * 0.15},${-h * 0.92} L${nx + nl * 0.5},${-h * 0.75} L${nx + nl * 0.4},${-h * 0.35} L${nx - nl * 0.25},${-h * 0.35} L${nx - nl * 0.25},${-h * 0.92} Z`} fill={NAVY} opacity={0.6} /> : null}
      {windows > 0 ? Array.from({length: windows}, (_, i) => <rect key={i} x={nx - nl * 0.5 - i * ((nx - tx) * 0.78 / windows)} y={-h * 0.45} width={Math.max(2, h * 0.16)} height={Math.max(2.5, h * 0.22)} rx={1} fill={NAVY} opacity={0.6} />) : null}
      <path d={wingD} fill={color} stroke={NAVY} strokeWidth={0.6} />
      <rect x={-L / 2} y={h * 0.05} width={Math.max(8, L * 0.12)} height={Math.max(2, h * 0.12)} fill={accent} opacity={0.9} />
      {engines.map((ex, i) => (
        <g key={i} transform={`translate(${LE + ex * 10}, ${wy})`} opacity={1 - i * 0.12}>
          <rect x={-C * 0.9} y={-h * 0.3} width={C * 1.1} height={h * 0.95} rx={h * 0.3} fill={color} stroke={NAVY} strokeWidth={0.8} />
          <ellipse cx={C * 0.22} cy={h * 0.17} rx={1.5 + 1.5 * (1 - spin)} ry={h * 1.3 * (0.4 + 0.6 * spin)} fill={color} opacity={0.6} />
        </g>
      ))}
      {jets.map(([jx, buried], i) => (
        <g key={i} transform={`translate(${jx * 10}, ${buried ? wy : wy + h * 0.6})`}>
          {buried ? null : <rect x={-C * 0.45} y={-h * 0.35} width={C * 0.9} height={h * 0.7} rx={h * 0.3} fill={color} stroke={NAVY} strokeWidth={0.8} />}
          {glow > 0 ? <ellipse cx={-C * 0.45 - h * 0.8 * glow} cy={0} rx={h * 1.1 * glow} ry={h * 0.22} fill={AMBER} opacity={0.9 * glow} /> : null}
          {glow > 0 ? <ellipse cx={-C * 0.45 - h * 2.4 * glow} cy={0} rx={h * 1.8 * glow} ry={h * 0.14} fill={AMBER} opacity={0.4 * glow} /> : null}
        </g>
      ))}
    </g>
  );
};
// the real side views (metres): length x fuselage height, so the slenderness is in the drawing, not in the eye
//   Stratoliner 22.7 x 3.6 (6.3:1), fin ~6 m above the fuselage top, a thick straight low wing, four engines ahead of it
//   DC-3        19.7 x 2.6 (7.6:1), fin ~3 m, low wing, two engines
//   He 178       7.5 x 1.5 (5:1),   fin ~1.3 m, mid wing, the jet inside the fuselage (nose intake, tail exhaust)
//   Bell X-1     9.4 x 1.5 (6.3:1), a slim bullet, fin ~1.6 m, thin straight mid wing
//   Comet 1     28.6 x 3.0 (9.5:1), fin ~4.5 m, swept low wing with four buried jets at the roots
const SIDE = {
  stratoliner: {len: 22.7, fh: 3.6, fin: 6, finRoot: 0.12, wingAt: 0.5, chord: 5, sweep: 0.5, wing: 'low', engines: [0.9, 0.5, 0.1, -0.3], windows: 10},
  dc3: {len: 19.7, fh: 2.6, fin: 3, finRoot: 0.14, wingAt: 0.5, chord: 4.3, sweep: 1, wing: 'low', engines: [0.9, 0.4], windows: 7},
  he178: {len: 7.5, fh: 1.5, fin: 1.3, finRoot: 0.14, wingAt: 0.52, chord: 2, sweep: 0.3, wing: 'mid', jets: [[-3.5, true]], canopy: true},
  x1: {len: 9.4, fh: 1.5, fin: 1.6, finRoot: 0.12, wingAt: 0.55, chord: 1.6, sweep: 0, wing: 'mid', jets: [[-4.6, true]], bullet: true},
  comet: {len: 28.6, fh: 3.0, fin: 4.5, finRoot: 0.12, wingAt: 0.55, chord: 6, sweep: 5, wing: 'low', jets: [[1.5, true], [0.5, true]], windows: 14},
};
const Side = ({ac, ...rest}) => <PlaneSide {...SIDE[ac]} {...rest} />;
// the 1903 Wright Flyer seen from the side, nose to +x: 6.4 m long, two wings 1.8 m apart, canard ahead, rudder behind; pilot 0..1
// fades the prone pilot in; spin 0..1 blurs the propellers
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
// the Wright Flyer seen from behind: 12.3 m span, the wings 1.8 m apart with struts, the pilot in the middle, the engine beside him,
// two propellers (spin 0..1 blurs them), skids below. warp -1..1 twists the wing tips: one side's trailing edge down, the other's up
// (review 2) ONE connected wing cell: both wings are built from the same spanwise function, the struts run from the lower wing to the
// upper wing at every bay, the wires cross between consecutive struts with their ends ON the strut ends; warping moves the outer
// cell (wings, struts and wires together) and leans the struts with the local slope, so nothing floats apart
const FlyerFront = ({x, y, s = 1, rot = 0, color = WHITE, o = 1, spin = 0, warp = 0}) => {
  const smooth = (u) => { const v = clamp01(u); return v * v * (3 - 2 * v); };
  const off = (sx) => warp * 9 * Math.sign(sx) * smooth((Math.abs(sx) - 18) / 43.5);          // the cell's vertical shift at sx
  const slope = (sx) => (off(sx + 2) - off(sx - 2)) / 4;
  const camber = (sx) => -2.5 * (1 - (sx / 61.5) * (sx / 61.5));
  const wingY = (sx, base) => base + camber(sx) + off(sx);
  const wing = (base) => {
    const top = [], bot = [];
    for (let i = 0; i <= 24; i++) { const sx = -61.5 + i * (123 / 24); top.push([sx, wingY(sx, base) - 1.1]); bot.push([sx, wingY(sx, base) + 1.1]); }
    return closed(top.concat(bot.reverse()));
  };
  const bays = [-61, -43, -26, -9, 9, 26, 43, 61];
  const strut = (sx) => { const lean = slope(sx) * 10; return [[sx - lean, wingY(sx, 2)], [sx + lean, wingY(sx, -16)]]; };   // [bottom, top]
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
      {[-1, 1].map((sg) => <g key={sg} opacity={0.55}><ellipse cx={sg * 28} cy={-9} rx={2 + 11 * spin} ry={13} fill={color} /><line x1={sg * 28} y1={wingY(sg * 28, -16)} x2={sg * 28} y2={wingY(sg * 28, 2)} stroke={color} strokeWidth={1.2} /></g>)}
      {bays.slice(0, -1).map((sx, i) => {
        const a = strut(sx), b = strut(bays[i + 1]);
        return <g key={sx} opacity={0.65}><line x1={a[0][0]} y1={a[0][1]} x2={b[1][0]} y2={b[1][1]} stroke={color} strokeWidth={0.45} /><line x1={a[1][0]} y1={a[1][1]} x2={b[0][0]} y2={b[0][1]} stroke={color} strokeWidth={0.45} /></g>;
      })}
      {bays.map((sx) => { const p = strut(sx); return <line key={sx} x1={p[0][0]} y1={p[0][1]} x2={p[1][0]} y2={p[1][1]} stroke={color} strokeWidth={1.1} strokeLinecap="round" />; })}
      <path d={wing(-16)} fill={color} />
      <path d={wing(2)} fill={color} />
      <path d={`M-18,${wingY(-18, 2) + 1} L-18,9 L18,9 L18,${wingY(18, 2) + 1}`} stroke={color} strokeWidth={1.2} fill="none" />
      <rect x={-25} y={-10} width={50} height={1.6} fill={color} opacity={0.8} />
      <rect x={-9} y={-6} width={18} height={6} rx={3} fill={AMBER} />
      <circle cx={0} cy={-8} r={2.6} fill={AMBER} />
      <rect x={11} y={-8} width={8} height={8} rx={1.5} fill={color} opacity={0.85} />
    </g>
  );
};
// a modern airliner (A320 class) seen from the front: 35.8 m span with 5 degrees of dihedral, 4 m fuselage, the fin 12 m up,
// two engines under the wings, the tailplane behind; wheels on the ground at y 0
const AirlinerFront = ({x, y, s = 1, color = WHITE, o = 1, accent = AMBER}) => (
  <g transform={`translate(${x}, ${y}) scale(${s})`} opacity={o}>
    <path d="M-6,-32 L-2,-118 L8,-118 L12,-32 Z" fill={color} />
    <path d="M-62,-30 L62,-30 L62,-26 L-62,-26 Z" fill={color} opacity={0.85} />
    {[-1, 1].map((sg) => <path key={sg} d={`M${sg * 14},-18 L${sg * 179},${-33} L${sg * 179},${-29} L${sg * 14},-12 Z`} fill={color} />)}
    {[-1, 1].map((sg) => <ellipse key={sg} cx={sg * 57} cy={-12} rx={10} ry={9} fill={color} stroke={NAVY} strokeWidth={1.5} />)}
    {[-1, 1].map((sg) => <circle key={sg} cx={sg * 57} cy={-12} r={5} fill={NAVY} opacity={0.6} />)}
    <circle cx={0} cy={-26} r={20} fill={color} />
    <path d="M-12,-36 Q0,-40 12,-36 L10,-30 L-10,-30 Z" fill={NAVY} opacity={0.6} />
    <rect x={-23} y={-27} width={46} height={2} fill={accent} opacity={0.9} />
    {[-1, 1].map((sg) => <g key={sg}><line x1={sg * 30} y1={-10} x2={sg * 30} y2={-2} stroke={color} strokeWidth={3} /><circle cx={sg * 30} cy={0} r={3} fill={color} /></g>)}
    <line x1={0} y1={-6} x2={0} y2={-2} stroke={color} strokeWidth={3} /><circle cx={0} cy={0} r={3} fill={color} />
  </g>
);
// the Hindenburg seen from the side: 245 m long, 41 m across, four fins, the gondola under the nose third, four engine cars
const Airship = ({x, y, s = 1, o = 1, color = SILVER, len = 245, dia = 41}) => {
  const L = len * 10, D = dia * 10;
  return (
    <g transform={`translate(${x}, ${y}) scale(${s})`} opacity={o}>
      <path d={`M${L / 2},0 C${L / 2},${-D * 0.25} ${L * 0.3},${-D / 2} ${0},${-D / 2} L${-L * 0.28},${-D / 2} C${-L * 0.42},${-D * 0.44} ${-L * 0.48},${-D * 0.2} ${-L / 2},0 C${-L * 0.48},${D * 0.2} ${-L * 0.42},${D * 0.44} ${-L * 0.28},${D / 2} L0,${D / 2} C${L * 0.3},${D / 2} ${L / 2},${D * 0.25} ${L / 2},0 Z`} fill={color} />
      {Array.from({length: 14}, (_, i) => <line key={i} x1={L / 2 - 80 - i * (L * 0.9 / 14)} y1={-D / 2 + 6} x2={L / 2 - 80 - i * (L * 0.9 / 14)} y2={D / 2 - 6} stroke={NAVY} strokeWidth={1} opacity={0.18} />)}
      <path d={`M${-L * 0.3},${-D * 0.45} L${-L * 0.48},${-D * 0.95} L${-L * 0.5},${-D * 0.95} L${-L * 0.5},${-D * 0.1} Z`} fill={color} opacity={0.9} />
      <path d={`M${-L * 0.3},${D * 0.45} L${-L * 0.48},${D * 0.95} L${-L * 0.5},${D * 0.95} L${-L * 0.5},${D * 0.1} Z`} fill={color} opacity={0.9} />
      <rect x={L * 0.1} y={D / 2 - 4} width={L * 0.07} height={D * 0.12} rx={4} fill={NAVY2} stroke={color} strokeWidth={1} />
      {[-0.05, -0.22].map((u) => <rect key={u} x={L * u} y={D / 2 - 2} width={L * 0.035} height={D * 0.1} rx={4} fill={NAVY2} stroke={color} strokeWidth={1} />)}
    </g>
  );
};
// Santos-Dumont's 14-bis seen from the side, nose to +x (the box-kite canard sits ahead): 11.5 m span, 9.6 m long. The boxes are
// its signature: a big box-kite wing cell at the back, a small box cell on a long boom at the front, the engine and pusher propeller behind
const Bis14 = ({x, y, s = 1, rot = 0, color = WHITE, o = 1, spin = 1}) => (
  <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
    <rect x={-48} y={-22} width={30} height={22} fill="none" stroke={color} strokeWidth={2} />
    <line x1={-33} y1={-22} x2={-33} y2={0} stroke={color} strokeWidth={1} opacity={0.6} />
    <line x1={-48} y1={-11} x2={-18} y2={-11} stroke={color} strokeWidth={1} opacity={0.6} />
    <line x1={-18} y1={-12} x2={40} y2={-8} stroke={color} strokeWidth={2.5} />
    <rect x={38} y={-16} width={12} height={12} fill="none" stroke={color} strokeWidth={2} />
    <line x1={44} y1={-16} x2={44} y2={-4} stroke={color} strokeWidth={1} opacity={0.6} />
    <rect x={-30} y={-4} width={14} height={7} rx={2} fill={color} opacity={0.9} />
    <ellipse cx={-50} cy={-2} rx={1.5 + 2 * (1 - spin)} ry={12 * (0.4 + 0.6 * spin)} fill={color} opacity={0.6} />
    <circle cx={-10} cy={-15} r={2.6} fill={AMBER} />
    <rect x={-13} y={-13} width={6} height={9} rx={2} fill={AMBER} />
    {[-14, 6].map((sx) => <circle key={sx} cx={sx} cy={5} r={2.2} fill="none" stroke={color} strokeWidth={1.2} />)}
  </g>
);
// a bicycle (for the brothers' shop), ~1.8 m long at scale 1
const Bicycle = ({x, y, s = 1, color = WHITE, o = 1}) => (
  <g transform={`translate(${x}, ${y}) scale(${s})`} opacity={o}>
    <circle cx={-6} cy={0} r={3.4} fill="none" stroke={color} strokeWidth={0.8} />
    <circle cx={6} cy={0} r={3.4} fill="none" stroke={color} strokeWidth={0.8} />
    <path d="M-6,0 L-2,-5 L4,-5 L6,0 M-2,-5 L1,0 L-6,0 M4,-5 L2.5,-7 M-2,-5 L-3,-7 M-4.2,-7.2 L-1.8,-7.2" stroke={color} strokeWidth={0.8} fill="none" strokeLinejoin="round" />
  </g>
);
// Whittle's turbojet as a patent-style cutaway, nose to +x, ~3 m long at scale 1 (30 px = 1 m): intake cone, compressor rows,
// combustion chambers, turbine, exhaust nozzle. draw 0..1 draws it line by line (stroke dash), run 0..1 animates air in, flame, thrust out
const JetEngine = ({x, y, s = 1, draw = 1, run = 0, t = 0, color = WHITE, o = 1, labels = true}) => {
  const seg = (i, n) => clamp01(draw * n - i);   // the i-th of n strokes
  const dash = (k) => ({pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - k, opacity: k > 0 ? 1 : 0});
  return (
    <g transform={`translate(${x}, ${y}) scale(${s})`} opacity={o} fill="none" stroke={color} strokeWidth={2.5 / Math.sqrt(s)} strokeLinecap="round" strokeLinejoin="round">
      {run > 0 ? [0, 1, 2].map((i) => <path key={i} d={`M-270,${-18 + i * 18} L-150,${-14 + i * 14}`} stroke={SKY} strokeWidth={5} strokeDasharray="22 18" strokeDashoffset={-t * 300 - i * 13} opacity={0.9 * run} />) : null}
      <path d="M-140,-30 L-70,-42 L70,-42 L120,-30 L150,-30 L150,30 L120,30 L70,42 L-70,42 L-140,30 Z" {...dash(seg(0, 6))} />
      <path d="M-140,-30 C-120,-10 -120,10 -140,30" {...dash(seg(1, 6))} />
      <path d="M-100,-36 L-100,36 M-82,-38 L-82,38 M-64,-40 L-64,40 M-46,-40 L-46,40 M-28,-40 L-28,40" {...dash(seg(2, 6))} />
      <path d="M-10,-40 L50,-40 L50,-24 L-10,-24 Z M-10,-10 L50,-10 L50,10 L-10,10 Z M-10,24 L50,24 L50,40 L-10,40 Z" {...dash(seg(3, 6))} />
      <path d="M62,-36 L62,36 M72,-34 L72,34 M82,-32 L82,32" {...dash(seg(4, 6))} />
      <path d="M120,-30 L150,-30 M120,30 L150,30 M-140,0 L150,0" {...dash(seg(5, 6))} opacity={0.5 * (seg(5, 6) > 0 ? 1 : 0)} />
      {run > 0 ? (
        <g>
          {[0, 1, 2].map((i) => <ellipse key={i} cx={20} cy={-32 + i * 32} rx={22 + 4 * Math.sin(t * 20 + i)} ry={6} fill={AMBER} stroke="none" opacity={0.9 * run} />)}
          <path d={`M150,-22 L${150 + 120 * run},${-12} L${150 + 120 * run},12 L150,22 Z`} fill={AMBER} stroke="none" opacity={0.75 * run} />
          <path d={`M${150 + 120 * run},-10 L${150 + 200 * run},0 L${150 + 120 * run},10 Z`} fill={AMBER} stroke="none" opacity={0.4 * run} />
          <g transform={`translate(-55, 0) rotate(${t * 720})`} opacity={0.5 * run}><line x1={0} y1={-38} x2={0} y2={38} stroke={SKY} strokeWidth={3} /><line x1={-38} y1={0} x2={38} y2={0} stroke={SKY} strokeWidth={3} /></g>
        </g>
      ) : null}
      {labels ? (
        <g stroke="none" fill={AMBER} fontFamily={SMALL} fontWeight={800} fontSize={16 / Math.sqrt(s)} letterSpacing={1.5} textAnchor="middle">
          <text x={-150} y={62} opacity={seg(1, 6)}>INTAKE</text>
          <text x={-64} y={62} opacity={seg(2, 6)}>COMPRESSOR</text>
          <text x={20} y={62} opacity={seg(3, 6)}>COMBUSTION</text>
          <text x={72} y={-56} opacity={seg(4, 6)}>TURBINE</text>
          <text x={140} y={62} opacity={seg(5, 6)}>EXHAUST</text>
        </g>
      ) : null}
    </g>
  );
};
// a flag-like country dot (for the 52 countries): a small circle with a two-colour stripe, seeded
const FlagDot = ({x, y, i, k = 1}) => (k <= 0 ? null : (
  <g transform={`translate(${x}, ${y}) scale(${Math.min(1, k)})`} opacity={Math.min(1, k)}>
    <circle r={9} fill={[AMBER, WHITE, SKY, GREEN, RED][i % 5]} />
    <rect x={-9} y={-2} width={18} height={4} fill={[WHITE, NAVY, NAVY, NAVY, WHITE][i % 5]} opacity={0.7} />
  </g>
));

// =====================================================================================================================
// THE SCENES, one per narration line (some lines hold two shots)
// =====================================================================================================================
// the beach at Kill Devil Hills: sand with ripples, the launch rail; children sit on it
const Sand = ({t, y = 820, rail = null, wind = 1}) => (
  <g>
    <rect x={0} y={y} width={W} height={H - y} fill={SAND} />
    <path d={`M0,${y} ${Array.from({length: 18}, (_, i) => `q 54 ${-6 - 4 * Math.sin(i * 2.1)} 108 0`).join(' ')}`} stroke={SAND2} strokeWidth={5} fill="none" />
    <Wind t={t} x0={0} y0={140} x1={W} y1={y - 60} k={wind} n={16} seed={17} />
    {rail ? <line x1={rail[0]} y1={y - 3} x2={rail[1]} y2={y - 3} stroke={WHITE} strokeWidth={6} opacity={0.85} /> : null}
  </g>
);
// ---------- line 0: cold open. a real map of the US east coast zooms into North Carolina's coast on "North"; KILL DEVIL HILLS pins on
// "Kill"; wind streaks sweep the map on "freezing"; "30+ KM/H" on "thirty". The year chip reads "17 DEC 1903" from "seventeenth" ----------
function Scene0({t, at, fps, a, b}) {
  const kill = at(0, 'Kill'), north = at(0, 'North'), freezing = at(0, 'freezing'), thirty = at(0, 'thirty');
  const zk = ease(t, north, 1.8, Easing.inOut(Easing.cubic));
  const proj = zoomBox(LL.USA_E, LL.NC, MAP_W, zk, 60);
  const kdh = proj([-75.67, 36.02]), ncl = proj([-79.6, 35.5]);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['USA']} box={MAP_W} k={1} id="m0">
          <Wind t={t} x0={MAP_W[0]} y0={MAP_W[1] + 40} x1={MAP_W[0] + MAP_W[2]} y1={MAP_W[1] + MAP_W[3] - 60} k={ease(t, freezing, 0.6)} n={20} seed={1} />
          {zk > 0.6 ? <Lbl x={ncl[0]} y={ncl[1]} size={26} o={(zk - 0.6) * 2.5 * 0.7}>NORTH CAROLINA</Lbl> : null}
          <Pin t={t} fps={fps} a={kill} pt={kdh} label="KILL DEVIL HILLS" lx={26} ly={10} anchor="start" />
        </MapPanel>
        <SvgPill t={t} fps={fps} a={thirty} x={MAP_W[0] + MAP_W[2] - 220} y={MAP_W[1] + MAP_W[3] - 70} w={240} size={24} bg={SKY}>30+ KM/H</SvgPill>
      </svg>
    </Scene>
  );
}
// ---------- line 1: the Flyer drawn to scale (16 px per 0.1 m: 6.4 m = 1,072 px) on its rail on the sand; Orville fades in prone on
// the lower wing on "lies"; Wilbur stands by on his name; a bicycle on "bicycle"; the engine rings on "engine", "12 HP" on "horsepower" ----------
function Scene1({t, at, fps, a, b}) {
  const orville = at(1, 'Orville'), lies = at(1, 'lies'), wilbur = at(1, 'Wilbur'), bicycle = at(1, 'bicycle'), engine = at(1, 'engine'), hp = at(1, 'horsepower');
  const FS = 16, fx = 980, gy = 820, oy = gy - 4 * FS;
  const kIn = pop(t, a, fps, soft);
  const pilot = ease(t, lies, 0.6);
  const kW = pop(t, wilbur, fps, soft), kB = pop(t, bicycle, fps, bouncy) * (1 - ease(t, engine, 0.4)), kE = pop(t, engine, fps, soft);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <Sand t={t} y={gy} rail={[fx - 560, fx + 700]} />
        <g opacity={Math.min(1, kIn)}>
          <FlyerSide x={fx} y={oy} s={FS} pilot={pilot} spin={0} />
          <Lbl x={fx} y={gy + 70} size={18} o={0.6}>12.3 M SPAN · 6.4 M LONG</Lbl>
        </g>
        {kE > 0 ? <circle cx={fx + 5 * FS} cy={oy - 6.5 * FS} r={46 * Math.min(1, kE)} fill="none" stroke={AMBER} strokeWidth={4} opacity={Math.min(1, kE) * 0.9} /> : null}
        {kW > 0 ? <Man x={fx - 640} y={gy} s={16} color={WHITE} o={Math.min(1, kW)} pose="stand" /> : null}
        {kB > 0 ? <Bicycle x={fx - 820} y={gy - 4} s={14 * Math.min(1, kB)} o={Math.min(1, kB)} /> : null}
        <SvgPill t={t} fps={fps} a={orville} x={fx + 10 * FS} y={oy - 18 * FS - 50} w={170} size={22}>ORVILLE</SvgPill>
        <SvgPill t={t} fps={fps} a={wilbur} x={fx - 640} y={gy - 320} w={160} size={22} bg={WHITE}>WILBUR</SvgPill>
      </svg>
      <Num t={t} a={hp} fps={fps} x={fx + 5 * FS} y={oy - 6.5 * FS - 200} size={96}>12 HP</Num>
    </Scene>
  );
}
// ---------- line 2: the Flyer lifts off the rail on "lifts", a "S" timer runs to 12 on "seconds"; the camera pulls back on "stays"
// so the whole 37 m hop fits, a ruler "~37 M" on "thirty seven"; on "Less" it pulls back again and a modern airliner (A320, 35.8 m span)
// drawn from the front at the SAME scale sits under the ruler, its span bracket "35.8 M" on "wingspan" ----------
function Scene2({t, at, fps, a, b}) {
  const lifts = at(2, 'lifts'), stays = at(2, 'stays'), seconds = at(2, 'seconds'), thirty = at(2, 'thirty'), metres = at(2, 'metres'), less = at(2, 'Less'), wingspan = at(2, 'wingspan'), airliner = at(2, 'airliner');
  const z1 = ease(t, stays, 1.2, Easing.inOut(Easing.cubic)), z2 = ease(t, less, 1.0, Easing.inOut(Easing.cubic));
  const S = lerp(lerp(16, 3.6, z1), 2.2, z2);     // the drawing scale (FlyerSide s): 16 = the close-up of line 1
  const G = lerp(820, 520, z2), X0 = lerp(lerp(640, 360, z1), 400, z2);
  const p = ease(t, lifts, Math.max(0.5, metres - lifts), Easing.inOut(Easing.quad));
  const hm = 3 * Math.sin(p * Math.PI);
  const fx = X0 + 37 * p * 10 * S, fy = G - 4 * S - hm * 10 * S;
  const secs = 12 * lin(t, lifts, Math.max(0.5, seconds - lifts));
  const kA = pop(t, less, fps, soft);
  const cx = X0 + 185 * S, ay = 870;
  const P0 = [X0, G - 4 * S], C = [X0 + 185 * S, G - 4 * S - 60 * S], P1 = [X0 + 370 * S, G - 4 * S];
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <Sand t={t} y={G} rail={[X0 - 12 * S, X0 + 12 * S]} wind={0.6} />
        {p > 0 ? dotted(P0, C, P1, p, 40, AMBER, 3.5) : null}
        <FlyerSide x={fx} y={fy} s={S} rot={-8 * Math.sin(p * Math.PI)} spin={p > 0 && p < 1 ? 1 : 0} />
        <Ruler t={t} fps={fps} a={thirty} x0={X0} x1={X0 + 370 * S} y={G + 44} k={ease(t, thirty, 0.8)} w={150}>~37 M</Ruler>
        <g opacity={Math.min(1, kA)}>
          <line x1={0} y1={ay + 2} x2={W} y2={ay + 2} stroke={WHITE} strokeWidth={2} opacity={0.3} />
          <AirlinerFront x={cx} y={ay} s={S} />
          <Ruler t={t} fps={fps} a={wingspan} x0={cx - 179 * S} x1={cx + 179 * S} y={ay + 28} k={ease(t, wingspan, 0.8)} w={150}>35.8 M</Ruler>
          <SvgPill t={t} fps={fps} a={airliner} x={cx + 179 * S + 90} y={ay - 60} w={120} size={20} bg={WHITE}>A320</SvgPill>
        </g>
      </svg>
      <Num t={t} a={lifts} fps={fps} x={120} y={110} size={96} align="left">{Math.round(secs)} S</Num>
    </Scene>
  );
}
// ---------- line 3: 1901; a wind tunnel box (fan, streaming air) with small wing shapes cycling on the balance from "tested"; a counter
// "~200 WING SHAPES"; on "control" the Flyer seen from behind takes over: on "twisting" the wing tips twist (warp), on "bank" the plane
// banks, a bird banks the same way on "bird" ----------
function Scene3({t, at, fps, a, b}) {
  const y1901 = at(3, '1901'), wind = at(3, 'wind'), tested = at(3, 'tested'), two = at(3, 'two'), shapes = at(3, 'shapes'), control = at(3, 'control'), twisting = at(3, 'twisting'), tips = at(3, 'tips'), bank = at(3, 'bank'), bird = at(3, 'bird');
  const kT = pop(t, wind, fps, soft) * (1 - ease(t, control, 0.5));
  const n = Math.round(200 * ease(t, two, Math.max(0.5, shapes + 0.5 - two), Easing.out(Easing.quad)));
  const idx = Math.floor(Math.max(0, t - tested) * 8);
  const kC = ease(t, control, 0.6);
  // the Builder (Bassel 11-18: the twisting tips were 'not logical'): no moving parts, the whole plane simply banks into a turn from
  // "twisting" and slides towards the inside of the turn
  const warp = 0;
  const kTurn = ease(t, twisting, Math.max(1.2, bank - twisting + 0.6), Easing.inOut(Easing.quad));
  const roll = -22 * kTurn;
  const slide = -170 * ease(t, twisting + 0.4, Math.max(2, bird - twisting + 1.5), Easing.inOut(Easing.quad));
  const foil = (i, w) => { const cam = 0.25 + 0.5 * rnd(i), th = 0.06 + 0.12 * rnd(i + 1); return `M${-w},0 Q0,${-cam * w} ${w},0 Q0,${th * w} ${-w},0 Z`; };
  const kTips = ease(t, tips, 0.4);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(960, 470) scale(${0.9 + 0.1 * Math.min(1, kT)}) translate(-960, -470)`} opacity={Math.min(1, kT)}>
          <rect x={260} y={240} width={1400} height={460} rx={20} fill={NAVY2} stroke={WHITE} strokeWidth={3} strokeOpacity={0.5} />
          <g transform="translate(360, 470)">
            <circle r={150} fill={NAVY} stroke={WHITE} strokeWidth={3} opacity={0.9} />
            <g transform={`rotate(${t * 540})`}>{[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d="M0,-14 C-20,-60 -22,-110 -8,-140 C0,-144 8,-144 12,-136 C18,-100 14,-50 0,-14 Z" fill={SILVER} opacity={0.85} transform={`rotate(${i * 60})`} />)}</g>
            <circle r={18} fill={SILVER} />
          </g>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <path key={i} d={`M540,${300 + i * 56} L1620,${300 + i * 56}`} stroke={SKY} strokeWidth={4} strokeDasharray="40 30" strokeDashoffset={-t * 500 - i * 23} opacity={0.5} />)}
          <g transform="translate(1060, 470)">
            <line x1={0} y1={0} x2={0} y2={230} stroke={WHITE} strokeWidth={3} opacity={0.6} />
            <path d={foil(idx, 150)} fill={WHITE} stroke={AMBER} strokeWidth={3} />
            {t >= tested ? <Arrow x={0} y={-40} len={40 + 50 * rnd(idx + 2)} dir="up" color={AMBER} k={1} w={8} /> : null}
          </g>
          {[0, 1, 2, 3, 4].map((i) => (idx - i - 1 >= 0 ? <path key={i} d={foil(idx - i - 1, 40)} transform={`translate(${1420 + i * 44 - 90}, 640)`} fill={WHITE} opacity={0.5 - i * 0.08} /> : null))}
        </g>
        <g opacity={kC}>
          <g transform={`translate(${960 + slide}, ${560 + 40 * kTurn}) rotate(${roll})`}>
            <FlyerFront x={0} y={0} s={9} warp={warp} spin={1} />
          </g>
          {t >= bird ? <Bird x={1560} y={260} s={5} rot={roll} ph={(t - bird) * 7} o={ease(t, bird, 0.4)} /> : null}
          <Lbl x={960} y={840} size={18} o={0.6 * kC}>12.3 M SPAN · SEEN FROM BEHIND</Lbl>
        </g>
        <SvgPill t={t} fps={fps} a={y1901} x={400} y={150} w={140} size={24} until={control}>1901</SvgPill>
      </svg>
      <Num t={t} a={two} fps={fps} x={1700} y={110} size={80} align="right" sub="wing shapes" until={control}>~{n}</Num>
    </Scene>
  );
}
// ---------- line 4: four flight bars (12 s, 12 s, 15 s, 59 s) grow from "four"; the last grows on "fifty nine", "59 S · ~260 M" on
// "two hundred"; on "begun" the little Flyer at its end lifts away ----------
function Scene4({t, at, fps, a, b}) {
  const four = at(4, 'four'), last = at(4, 'last'), fifty = at(4, 'fifty'), seconds = at(4, 'seconds'), two = at(4, 'two'), begun = at(4, 'begun');
  const durs = [12, 12, 15, 59];
  const X0 = 300, X1 = 1680, Y0 = 250, dy = 150;
  const px = (s) => X0 + (X1 - X0) * s / 59;
  const up = ease(t, begun, 1.2, Easing.out(Easing.quad));
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <line x1={X0} y1={Y0 - 60} x2={X0} y2={Y0 + 3 * dy + 60} stroke={WHITE} strokeWidth={3} opacity={0.4} />
        {[0, 15, 30, 45, 59].map((s) => <g key={s}><line x1={px(s)} y1={Y0 + 3 * dy + 60} x2={px(s)} y2={Y0 + 3 * dy + 74} stroke={WHITE} strokeWidth={3} opacity={0.5} /><Lbl x={px(s)} y={Y0 + 3 * dy + 104} size={20} o={0.6}>{s} S</Lbl></g>)}
        {durs.map((d, i) => {
          const isLast = i === 3;
          const k = isLast ? ease(t, fifty, Math.max(0.6, seconds + 0.4 - fifty), Easing.inOut(Easing.quad)) : ease(t, four + i * 0.3, 0.9, Easing.out(Easing.cubic));
          const show = isLast ? pop(t, last, fps, soft) : pop(t, four + i * 0.3, fps, soft);
          if (show <= 0) return null;
          const y = Y0 + i * dy, xe = X0 + (px(d) - X0) * k;
          return (
            <g key={i} opacity={Math.min(1, show)}>
              <Lbl x={X0 - 40} y={y + 10} anchor="end" size={30} o={0.9}>{i + 1}</Lbl>
              <rect x={X0} y={y - 20} width={px(d) - X0} height={40} rx={20} fill={WHITE} opacity={0.1} />
              <rect x={X0} y={y - 20} width={Math.max(0, xe - X0)} height={40} rx={20} fill={isLast ? AMBER : WHITE} />
              <FlyerSide x={xe + 40 + (isLast ? 160 * up : 0)} y={y - 14 - (isLast ? 120 * up : 0)} s={2.6} rot={isLast ? -12 * up : 0} spin={k < 1 || isLast ? 1 : 0} />
              {!isLast && k >= 1 ? <SvgPill t={t} fps={fps} a={four + i * 0.3 + 0.9} x={xe + 200} y={y} w={110} size={22} bg={WHITE}>{d} S</SvgPill> : null}
            </g>
          );
        })}
        <SvgPill t={t} fps={fps} a={two} x={px(59) - 200} y={Y0 + 3 * dy - 56} w={270} size={22}>59 S · ~260 M</SvgPill>
      </svg>
    </Scene>
  );
}
// ---------- line 5: a map of Ohio (DAYTON on "Ohio"), a field on the right with a few onlookers (almost nobody); from "circle" the
// Flyer, seen from above, flies a dotted loop around the field; a "MIN" counter runs to 39 on "thirty nine"; "1905" on the year ----------
function Scene5({t, at, fps, a, b}) {
  const nobody = at(5, 'nobody'), ohio = at(5, 'Ohio'), y1905 = at(5, '1905'), circle = at(5, 'circle'), thirty = at(5, 'thirty'), minutes = at(5, 'minutes');
  const MB = [80, 110, 700, 760];
  const proj = fitBox(LL.OHIO, MB, 50);
  const dayton = proj([-84.19, 39.76]);
  const cx = 1340, cy = 500, rx = 380, ry = 230;
  // the Builder (Bassel 11-18: 'circling backwards'): the loop starts on the year, so it is seen for longer, with an arrow ahead of the
  // nose; the Flyer flies elevator first (it really had its elevator in front), the twin rudders at its tail
  const go = Math.min(circle, y1905 + 0.3);
  const ang = t >= go ? (t - go) * 1.1 + Math.PI : Math.PI;
  const pos = (an) => [cx + rx * Math.cos(an), cy + ry * Math.sin(an)];
  const q = pos(ang), head = Math.atan2(ry * Math.cos(ang), -rx * Math.sin(ang)) * 180 / Math.PI;
  const mins = 39 * ease(t, thirty, Math.max(0.6, minutes + 0.6 - thirty), Easing.out(Easing.quad));
  const kP = pop(t, nobody, fps, soft);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['USA']} box={MB} k={pop(t, a, fps, soft)} id="m5">
          <Pin t={t} fps={fps} a={ohio} pt={dayton} label="DAYTON · OHIO" ly={-28} />
        </MapPanel>
        <SvgPill t={t} fps={fps} a={y1905} x={MB[0] + MB[2] / 2} y={MB[1] + 50} w={140} size={24}>1905</SvgPill>
        <g opacity={Math.min(1, kP)}>
          <ellipse cx={cx} cy={cy + 40} rx={rx + 140} ry={ry + 150} fill={GREEN} opacity={0.14} />
          <ellipse cx={cx} cy={cy + 40} rx={rx + 140} ry={ry + 150} fill="none" stroke={GREEN} strokeWidth={3} opacity={0.4} strokeDasharray="10 14" />
          {[0, 1, 2].map((i) => <Man key={i} x={cx - 440 + i * 60} y={cy + 230} s={5} color={WHITE} o={0.7} />)}
          {t >= go ? Array.from({length: 50}, (_, i) => {
            const an = ang - i * 0.06;
            if (an < Math.PI) return null;
            const d = pos(an);
            return <circle key={i} cx={d[0]} cy={d[1]} r={3.5} fill={AMBER} opacity={0.9 * (1 - i / 50)} />;
          }) : null}
          <g transform={`translate(${q[0]}, ${q[1]}) rotate(${head})`}>
            <Plane ac="flyer" x={0} y={0} s={2.6} spin={t >= go ? 1 : 0} />
            {t >= go ? <path d="M104,-16 L124,0 L104,16" fill="none" stroke={AMBER} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={ease(t, go, 0.4)} /> : null}
          </g>
        </g>
      </svg>
      <Num t={t} a={thirty} fps={fps} x={cx} y={120} size={84}>{Math.round(mins)} MIN</Num>
    </Scene>
  );
}
// ---------- line 6: a map of France (PARIS on "Paris", "1906"); on the right the 14-bis, a box-kite plane, hops past a crowd on
// "flies" (or the photo); on "Two years later" LE MANS pins, Wilbur's picture or, drawn, the Flyer seen from above flying a smooth
// banking turn from "banking", a crowd watching ----------
function Scene6({t, at, fps, a, b}) {
  const y1906 = at(6, '1906'), santos = at(6, 'Santos'), flies = at(6, 'flies'), paris = at(6, 'Paris'), crowd = at(6, 'crowd'), two = at(6, 'Two'), wilbur = at(6, 'Wilbur'), france = at(6, 'France'), banking = at(6, 'banking');
  const MB = [80, 110, 620, 760], RB = [760, 110, 1080, 760];
  const proj = fitBox(LL.FRA, MB, 50);
  const parisPt = proj([2.35, 48.86]), lemans = proj([0.2, 48.0]);
  const hop = ease(t, flies, 3.2, Easing.inOut(Easing.quad));
  const bx = lerp(RB[0] + 220, RB[0] + RB[2] - 220, hop), by = RB[1] + RB[3] - 150 - 70 * Math.sin(hop * Math.PI);
  const c = boxC(RB), r = 250;
  const turn = ease(t, banking, 3.2, Easing.inOut(Easing.quad));
  const an = -Math.PI * 0.5 + turn * Math.PI * 1.6;
  const px = c[0] + r * Math.cos(an) * 1.5, py = c[1] - 60 + r * Math.sin(an) * 0.8;
  const head = Math.atan2(r * Math.cos(an) * 0.8, -r * Math.sin(an) * 1.5) * 180 / Math.PI;
  const bank = Math.sin(Math.min(1, turn) * Math.PI);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['FRA']} box={MB} k={pop(t, a, fps, soft)} id="m6">
          <Pin t={t} fps={fps} a={paris} pt={parisPt} label="PARIS" ly={-28} />
          <Pin t={t} fps={fps} a={france} pt={lemans} label="LE MANS" lx={-22} ly={36} anchor="end" r={9} size={20} />
        </MapPanel>
        <SvgPill t={t} fps={fps} a={y1906} x={MB[0] + MB[2] / 2} y={MB[1] + 50} w={140} size={24} until={two}>1906</SvgPill>
        <SvgPill t={t} fps={fps} a={two} x={MB[0] + MB[2] / 2} y={MB[1] + 50} w={140} size={24}>1908</SvgPill>
      </svg>
      <Pic have="santos" id="s6a" a={santos} b={two} t={t} fps={fps} box={RB} fallback={() => (
        <g>
          <line x1={RB[0]} y1={RB[1] + RB[3] - 80} x2={RB[0] + RB[2]} y2={RB[1] + RB[3] - 80} stroke={WHITE} strokeWidth={3} opacity={0.4} />
          <Crowd t={t} x={c[0]} y={RB[1] + RB[3] - 80} n={20} s={6} k={ease(t, crowd, 1.0)} spread={40} seed={5} wave={1} />
          <Bis14 x={bx} y={by} s={5} rot={-6 * Math.sin(hop * Math.PI)} spin={1} />
          <Lbl x={c[0]} y={RB[1] + 60} size={18} o={0.6}>14-BIS · 11.5 M SPAN</Lbl>
        </g>
      )} />
      <Pic have="wilbur" id="s6b" a={two} b={b} t={t} fps={fps} box={RB} fallback={() => (
        <g>
          <Crowd t={t} x={c[0]} y={RB[1] + RB[3] - 60} n={24} s={6} k={ease(t, wilbur, 1.0)} spread={40} seed={9} />
          {turn > 0 ? Array.from({length: 60}, (_, i) => {
            const u = turn - i * 0.012;
            if (u < 0) return null;
            const aa = -Math.PI * 0.5 + u * Math.PI * 1.6;
            return <circle key={i} cx={c[0] + r * Math.cos(aa) * 1.5} cy={c[1] - 60 + r * Math.sin(aa) * 0.8} r={3.5} fill={AMBER} opacity={0.9 * (1 - i / 60)} />;
          }) : null}
          <g transform={`translate(${px}, ${py}) rotate(${head}) scale(1, ${1 - 0.4 * bank})`}>
            <Plane ac="flyer" x={0} y={0} s={2.6} spin={1} />
          </g>
          <Lbl x={c[0]} y={RB[1] + 60} size={18} o={0.6}>12.3 M SPAN · SEEN FROM ABOVE</Lbl>
        </g>
      )} />
      <Tag t={t} a={santos} fps={fps} x={c[0]} y={RB[1] + RB[3] - 30} until={two}>Santos-Dumont</Tag>
      <Tag t={t} a={wilbur} fps={fps} x={c[0]} y={RB[1] + RB[3] - 30}>Wilbur Wright</Tag>
    </Scene>
  );
}
// ---------- line 7: the Channel on a real map; "25 JUL 1909"; CALAIS and DOVER pin on their names; from "flies" the Blériot XI
// (top view, to scale) crosses on a dotted line to Dover; a "MIN" counter runs to ~37; Blériot's picture at Dover (or the drawing,
// with its dimensions); Britain's highlight pulses on "Britain", the crossing becomes a solid line on "island" ----------
function Scene7({t, at, fps, a, b}) {
  const twenty = at(7, 'twenty'), bleriot = at(7, 'Blériot'), calais = at(7, 'Calais'), flies = at(7, 'flies'), dover = at(7, 'Dover'), thirty = at(7, 'thirty'), minutes = at(7, 'minutes'), britain = at(7, 'Britain'), island = at(7, 'island');
  const MB = [80, 90, 1140, 790], PB = [1260, 90, 580, 520];
  const proj = fitBox(LL.CHANNEL, MB, 40);
  const cal = proj([1.86, 50.92]), dov = proj([1.31, 51.13]);
  const C = [(cal[0] + dov[0]) / 2 + 30, Math.min(cal[1], dov[1]) - 70];
  const p = ease(t, flies, Math.max(0.8, dover + 0.3 - flies), Easing.inOut(Easing.quad));
  const q = qb(cal, C, dov, p);
  const mins = 37 * ease(t, thirty, Math.max(0.5, minutes + 0.6 - thirty), Easing.out(Easing.quad));
  const gp = geoPath(proj);
  const pulse = t >= britain ? 0.5 + 0.5 * Math.sin((t - britain) * 6) : 0;
  const solid = ease(t, island, 0.8);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['FRA']} box={MB} k={1} id="m7">
          {t >= britain ? <path d={gp(feats(['GBR'])) || ''} fill={AMBER} stroke={AMBER} strokeWidth={3} opacity={0.12 + 0.18 * pulse} /> : null}
          {p > 0 ? dotted(cal, C, dov, p, 36, AMBER, 4) : null}
          {solid > 0 ? <line x1={cal[0]} y1={cal[1]} x2={lerp(cal[0], dov[0], solid)} y2={lerp(cal[1], dov[1], solid)} stroke={WHITE} strokeWidth={6} strokeLinecap="round" opacity={0.9} /> : null}
          <Pin t={t} fps={fps} a={calais} pt={cal} label="CALAIS" lx={24} ly={10} anchor="start" />
          <Pin t={t} fps={fps} a={dover} pt={dov} label="DOVER" lx={-24} ly={-16} anchor="end" />
          {t >= flies && p < 1 ? <Plane ac="bleriot" x={q.x} y={q.y} s={1.4} rot={q.ang} /> : null}
        </MapPanel>
        <SvgPill t={t} fps={fps} a={twenty} x={MB[0] + 180} y={MB[1] + 50} w={220} size={22}>25 JUL 1909</SvgPill>
      </svg>
      <Pic have="bleriot" id="s7" a={dover} b={b} t={t} fps={fps} box={PB} fallback={() => (
        <g>
          <rect x={PB[0]} y={PB[1] + PB[3] - 90} width={PB[2]} height={90} fill={WHITE} opacity={0.85} />
          <rect x={PB[0]} y={PB[1] + PB[3] - 96} width={PB[2]} height={8} fill={GREEN} opacity={0.6} />
          <Plane ac="bleriot" x={PB[0] + PB[2] / 2 - 20} y={PB[1] + PB[3] / 2 - 60} s={4} rot={-90} dims />
        </g>
      )} />
      <Num t={t} a={thirty} fps={fps} x={MB[0] + MB[2] - 60} y={MB[1] + 60} size={80} align="right">~{Math.round(mins)} MIN</Num>
      <Tag t={t} a={bleriot} fps={fps} x={PB[0] + PB[2] / 2} y={PB[1] + PB[3] + 40}>Louis Blériot</Tag>
    </Scene>
  );
}

// ---------- line 8: 1914. two biplanes seen from above at the same scale (a British B.E.2, 11.2 m, and a German Albatros, 12.8 m)
// cruise past each other; trenches draw in below on "war"; a dotted line of sight down to the trenches on "watch"; little waves
// between the pilots on "wave"; short pistol-shot dashes on "shooting" (no hits, no blood) ----------
function Scene8({t, at, fps, a, b}) {
  const war = at(8, 'war'), atFirst = at(8, 'At'), watch = at(8, 'watch'), wave = at(8, 'wave'), shooting = at(8, 'shooting');
  const kDraw = FILMS.airDepot ? ease(t, atFirst, 0.4) : 1;   // with the air-depot film: the real 1918 aircraft open the line, the drawing follows on "At first"
  const kIn = pop(t, a, fps, soft);
  const drift = Math.sin(t * 0.6) * 24;
  const A = [640 + drift, 360], B = [1300 - drift, 440];
  const kT = ease(t, war, 1.2, Easing.inOut(Easing.quad));
  const kS = ease(t, watch, 0.8);
  const kWave = t >= wave && t < shooting ? 1 : 0;
  const zig = (y, seed) => `M-40,${y} ${Array.from({length: 26}, (_, i) => `L${i * 80 + 40},${y + (i % 2 ? 22 : -22) + rnd(i + seed) * 8}`).join(' ')}`;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      {FILMS.airDepot ? <Clip src={FILM.airDepot} from={0} a={a} b={atFirst} t={t} fps={fps} zoom={[1.04, 1.12]} dark={0.25} /> : null}
      <svg width={W} height={H} style={{position: 'absolute', opacity: kDraw}}>
        <g opacity={kT}>
          <rect x={0} y={740} width={W} height={180} fill={WOOD} opacity={0.25} />
          <path d={zig(790, 40)} stroke={WOOD} strokeWidth={10} fill="none" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - kT} />
          <path d={zig(860, 70)} stroke={WOOD} strokeWidth={10} fill="none" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - kT} opacity={0.8} />
          {Array.from({length: 24}, (_, i) => <ellipse key={i} cx={60 + i * 80} cy={776 + (i % 2 ? 22 : -22)} rx={14} ry={7} fill={SAND} opacity={0.5 * kT} />)}
        </g>
        {kS > 0 ? <line x1={A[0]} y1={A[1] + 40} x2={lerp(A[0], 900, kS)} y2={lerp(A[1] + 40, 790, kS)} stroke={SKY} strokeWidth={3} strokeDasharray="8 10" opacity={0.8} /> : null}
        {kS > 0 ? <ellipse cx={900} cy={790} rx={60 * kS} ry={18 * kS} fill="none" stroke={SKY} strokeWidth={3} opacity={0.6} /> : null}
        <g opacity={Math.min(1, kIn)}>
          <Plane ac="be2" x={A[0]} y={A[1]} s={4.4} rot={0}><circle cx={-2} cy={0} r={2.4} fill={AMBER} /></Plane>
          <Plane ac="albatros" x={B[0]} y={B[1]} s={4.4} rot={180}><circle cx={-4} cy={0} r={2.4} fill={AMBER} /></Plane>
          <Lbl x={A[0]} y={A[1] - 270} size={18} o={0.6}>11.2 M SPAN</Lbl>
          <Lbl x={B[0]} y={B[1] + 300} size={18} o={0.6}>12.8 M SPAN</Lbl>
        </g>
        {kWave ? [0, 1, 2].map((i) => {
          const ph = ((t - wave) * 1.2 + i * 0.33) % 1;
          return <g key={i} opacity={(1 - ph) * 0.9}><path d={`M${A[0] + 40 + ph * 60},${A[1] - 30 - ph * 30} a 22 22 0 0 1 30 0`} stroke={WHITE} strokeWidth={4} fill="none" strokeLinecap="round" /><path d={`M${B[0] - 70 - ph * 60},${B[1] - 30 - ph * 30} a 22 22 0 0 1 30 0`} stroke={WHITE} strokeWidth={4} fill="none" strokeLinecap="round" /></g>;
        }) : null}
        {t >= shooting ? [0, 1, 2, 3, 4, 5].map((i) => {
          const ti = shooting + i * 0.32, dt = t - ti;
          if (dt < 0 || dt > 0.5) return null;
          const fromA = i % 2 === 0;
          const x = fromA ? lerp(A[0] + 60, B[0] - 90, dt / 0.5) : lerp(B[0] - 60, A[0] + 90, dt / 0.5);
          const y = fromA ? lerp(A[1] - 10, B[1] - 30, dt / 0.5) : lerp(B[1] + 10, A[1] + 30, dt / 0.5);
          return <line key={i} x1={x} y1={y} x2={x + (fromA ? -30 : 30)} y2={y + (fromA ? -3 : 3)} stroke={AMBER} strokeWidth={4} strokeLinecap="round" opacity={0.9} />;
        }) : null}
      </svg>
    </Scene>
  );
}
// ---------- line 9: 1915. a machine gun behind a spinning two-blade propeller: the bullets (amber dashes) cross the disc only when the
// blades are horizontal, i.e. in the gaps (fired every 0.25 s, the prop at 2 turns a second). FOKKER E.I: the monoplane seen from above
// on "builds"; a tick on "without hitting it"; the fighter pulses on "born" ----------
function Scene9({t, at, fps, a, b}) {
  const fokker = at(9, 'Fokker'), builds = at(9, 'builds'), gun = at(9, 'gun'), fires = at(9, 'fires'), propeller = at(9, 'propeller'), hitting = at(9, 'hitting'), born = at(9, 'born');
  const cx = 600, cy = 500, R = 230, gy = cy - 76;
  const th = 720 * (t - fires);
  const kIn = pop(t, a, fps, soft), kP = pop(t, builds, fps, soft);
  const born_k = pop(t, born, fps, bouncy);
  const bullets = [];
  for (let i = 0; i < 40; i++) {
    const ti = fires + i * 0.25;
    if (t < ti) break;
    const x = 160 + (t - ti) * 1600;
    if (x > 1100) continue;
    bullets.push(<line key={i} x1={x - 22} y1={gy} x2={x} y2={gy} stroke={AMBER} strokeWidth={6} strokeLinecap="round" />);
  }
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={Math.min(1, kIn)}>
          <circle cx={cx} cy={cy} r={R} fill={WHITE} opacity={0.08} />
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={WHITE} strokeWidth={2} strokeDasharray="6 10" opacity={0.4} />
          <g transform={`translate(${cx}, ${cy}) rotate(${th})`}>
            {[0, 180].map((d) => <path key={d} d={`M0,-12 C-16,-60 -18,-150 -8,${-R + 8} C-2,${-R + 2} 6,${-R + 2} 10,${-R + 12} C18,-150 14,-60 0,-12 Z`} fill={SILVER} opacity={0.95} transform={`rotate(${d})`} />)}
            <circle r={26} fill={SILVER} stroke={NAVY} strokeWidth={3} />
          </g>
          <g opacity={ease(t, gun, 0.4)}>
            <rect x={60} y={gy - 12} width={120} height={24} rx={6} fill={WHITE} />
            <rect x={180} y={gy - 6} width={60} height={12} rx={4} fill={WHITE} />
            <rect x={80} y={gy + 12} width={40} height={40} rx={6} fill={WHITE} opacity={0.8} />
            <Lbl x={120} y={gy - 40} size={20} color={AMBER} o={0.9}>GUN</Lbl>
          </g>
          {bullets}
          <Lbl x={cx} y={cy + R + 48} size={20} color={AMBER} o={ease(t, propeller, 0.4) * 0.9}>PROPELLER · 2 BLADES</Lbl>
          <Tick x={cx + R + 90} y={cy - 150} k={pop(t, hitting, fps, bouncy)} r={44} />
        </g>
        <g transform={`translate(1420, 500) scale(${(0.9 + 0.1 * Math.min(1, kP)) * (1 + 0.08 * Math.sin(Math.min(1, born_k) * Math.PI))})`} opacity={Math.min(1, kP)}>
          <Plane ac="fokkerE" x={0} y={0} s={5} rot={-90} dims spin={1} />
        </g>
        <SvgPill t={t} fps={fps} a={fokker} x={1420} y={150} w={220} size={22}>FOKKER E.I</SvgPill>
      </svg>
      <Tag t={t} a={fokker} fps={fps} x={1420} y={860} bg={WHITE}>Anthony Fokker</Tag>
    </Scene>
  );
}
// ---------- line 10: the Red Baron. a Fokker triplane seen from above (7.2 m span, three wings), white, turns red on "Red"; a counter
// runs to 80 on "eighty"; on "shot down" the plane tips and sinks out of the frame with a thin smoke line; "1918" on the chip ----------
function Scene10({t, at, fps, a, b}) {
  const manfred = at(10, 'Manfred'), red = at(10, 'Red'), eighty = at(10, 'eighty'), victories = at(10, 'victories'), shot = at(10, 'shot');
  const kIn = pop(t, a, fps, soft);
  const redK = ease(t, red, 0.6);
  const n = 80 * ease(t, eighty, Math.max(0.6, victories + 0.5 - eighty), Easing.out(Easing.quad));
  const down = ease(t, shot, 1.6, Easing.in(Easing.quad));
  const px = 720 + 120 * down, py = 520 + Math.sin(t * 1.5) * 8 + 520 * down;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {down > 0 ? <path d={`M${px - 60},${py - 20} C${px - 160},${py - 120} ${px - 240},${py - 200} ${px - 300},${py - 380}`} stroke={WHITE} strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.35 * down} strokeDasharray="20 16" /> : null}
        <g transform={`translate(${px}, ${py}) rotate(${-90 + 50 * down}) scale(${1 - 0.3 * down})`} opacity={Math.min(1, kIn) * (1 - 0.6 * down)}>
          <Plane ac="dr1" x={0} y={0} s={8} color={WHITE} spin={1} />
          <Plane ac="dr1" x={0} y={0} s={8} color={RED} o={redK} spin={1} accent={NAVY} />
        </g>
        <Lbl x={720} y={860} size={18} o={0.6 * (1 - down)}>7.2 M SPAN · 3 WINGS</Lbl>
      </svg>
      <Num t={t} a={eighty} fps={fps} x={1440} y={330} size={220} color={RED} sub="victories">{Math.round(n)}</Num>
      <Tag t={t} a={manfred} fps={fps} x={1440} y={150}>Manfred von Richthofen</Tag>
      <Tag t={t} a={red} fps={fps} x={1440} y={215} bg={RED} fg={WHITE}>Red Baron</Tag>
    </Scene>
  );
}
// ---------- line 11: four years on a timeline (1914-1918) light up on "four years"; three rows: on "faster" a 1914 biplane with a short
// trail against a 1918 fighter with a long one and FASTER chevrons; on "stronger" a thin wing spar thickens into a beam under a weight;
// on "reliable" six engines each get a tick; on "thousands" the bottom fills with rows of tiny planes and pilots ----------
function Scene11({t, at, fps, a, b}) {
  const four = at(11, 'four'), faster = at(11, 'faster'), stronger = at(11, 'stronger'), reliable = at(11, 'reliable'), ends = at(11, 'ends'), thousands = at(11, 'thousands');
  const X0 = 300, X1 = 1620;
  const kF = ease(t, faster, 0.8), kS = ease(t, stronger, 0.9, Easing.out(Easing.back(1.2))), kR = pop(t, reliable, fps, soft);
  const kTh = ease(t, thousands, 1.4);
  const dim = 1 - 0.5 * kTh;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <line x1={X0} y1={180} x2={X1} y2={180} stroke={WHITE} strokeWidth={4} opacity={0.4} />
        {[1914, 1915, 1916, 1917, 1918].map((y, i) => {
          const k = pop(t, four + i * 0.15, fps, bouncy);
          const last = i === 4 && t >= ends;
          return (
            <g key={y} transform={`translate(${lerp(X0, X1, i / 4)}, 180)`} opacity={Math.min(1, k)}>
              <circle r={14 * Math.min(1, k) * (last ? 1.3 : 1)} fill={last ? AMBER : WHITE} />
              <Lbl x={0} y={-30} size={24} color={last ? AMBER : WHITE}>{y}</Lbl>
            </g>
          );
        })}
        <g opacity={dim}>
          <g transform="translate(0, 330)">
            <Plane ac="be2" x={420 + 40 * Math.sin(t * 2)} y={0} s={2.4} rot={0} />
            <Chevrons t={t} x={300 + 40 * Math.sin(t * 2)} y={0} n={2} k={1} color={WHITE} len={40} size={18} />
            <Plane ac="camel" x={1380 + 90 * kF} y={0} s={2.4} rot={0} />
            <Chevrons t={t} x={1260 + 90 * kF} y={0} n={5} k={kF} color={AMBER} len={70} size={24} />
            <rect x={620} y={-14} width={560} height={28} rx={14} fill={WHITE} opacity={0.12} />
            <rect x={620} y={-14} width={560 * kF} height={28} rx={14} fill={AMBER} />
            <Lbl x={900} y={-34} size={20} color={AMBER} o={kF}>FASTER</Lbl>
          </g>
          <g transform="translate(0, 500)">
            <rect x={X0} y={-3 - 11 * kS} width={X1 - X0} height={6 + 22 * kS} rx={6} fill={lerp(0, 1, kS) > 0.5 ? SILVER : WOOD} opacity={0.9} />
            {[0.2, 0.4, 0.6, 0.8].map((u) => <line key={u} x1={lerp(X0, X1, u)} y1={-14 * kS} x2={lerp(X0, X1, u)} y2={14 * kS} stroke={NAVY} strokeWidth={2} opacity={0.5 * kS} />)}
            <g transform={`translate(960, ${-20 - 14 * kS}) scale(${Math.min(1, pop(t, stronger, fps, soft))})`}>
              <path d="M-40,0 L40,0 L30,-50 L-30,-50 Z" fill={WHITE} />
              <rect x={-10} y={-62} width={20} height={12} rx={4} fill="none" stroke={WHITE} strokeWidth={4} />
            </g>
          </g>
          <g transform="translate(0, 640)">
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const x = lerp(X0 + 60, X1 - 60, i / 5), k = Math.min(1, pop(t, a + 0.2 + i * 0.05, fps, soft));
              return (
                <g key={i} transform={`translate(${x}, 0)`} opacity={k}>
                  <circle r={34} fill={NAVY2} stroke={WHITE} strokeWidth={3} />
                  <g transform={`rotate(${t * 400 + i * 40})`}>{[0, 90, 180, 270].map((d) => <rect key={d} x={-5} y={-30} width={10} height={24} rx={4} fill={WHITE} opacity={0.8} transform={`rotate(${d})`} />)}</g>
                  <Tick x={30} y={-30} k={pop(t, reliable + i * 0.1, fps, bouncy)} r={16} />
                </g>
              );
            })}
          </g>
        </g>
        {kTh > 0 && !FILMS.airDepot ? Array.from({length: 36}, (_, i) => {
          const col = i % 12, row = Math.floor(i / 12);
          const k = clamp01(kTh * 2.2 - (col + row * 12) / 36);
          return k > 0 ? <g key={i} opacity={k}><Plane ac="camel" x={200 + col * 130} y={760 + row * 48} s={0.9} rot={0} /><Man x={260 + col * 130} y={775 + row * 48} s={2.6} color={WHITE} /></g> : null;
        }) : null}
      </svg>
      {FILMS.airDepot ? <Clip src={FILM.airDepot} from={20} a={ends} b={b} t={t} fps={fps} zoom={[1.04, 1.12]} dark={0.25} /> : null}
    </Scene>
  );
}
// ---------- line 12: the Atlantic on a real map. "JUNE 1919"; ST JOHN'S (Newfoundland) and CLIFDEN (Ireland) pin on their names; the
// Vickers Vimy (20.5 m, two engines, drawn to scale in the frame on the right) flies the great circle from "fly"; an "H" counter runs
// to 16 on "sixteen"; on "bog" it noses down into a splash of mud ----------
function Scene12({t, at, fps, a, b}) {
  const june = at(12, 'June'), alcock = at(12, 'Alcock'), fly = at(12, 'fly'), newf = at(12, 'Newfoundland'), ireland = at(12, 'Ireland'), sixteen = at(12, 'sixteen'), bog = at(12, 'bog');
  const MB = [80, 90, 1110, 790], PB = [1230, 90, 610, 470];
  const proj = fitBox(LL.ATL_N, MB, 40);
  const A = [-52.72, 47.6], B = [-10.02, 53.49];
  const pts = greatCircle(proj, A, B, 60);
  const p = ease(t, fly, Math.max(1, ireland + 0.5 - fly), Easing.inOut(Easing.quad));
  const g = gcAt(proj, A, B, p);
  const hours = 16 * ease(t, sixteen, Math.max(0.5, bog - 0.3 - sixteen), Easing.out(Easing.quad));
  const bogK = ease(t, bog, 0.5);
  const pa = proj(A), pb = proj(B);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['GBR', 'IRL', 'CAN']} box={MB} k={1} id="m12">
          {dottedPts(pts, p, AMBER, 4)}
          <Pin t={t} fps={fps} a={newf} pt={pa} label="ST JOHN'S" lx={-22} ly={34} anchor="end" />
          <Pin t={t} fps={fps} a={ireland} pt={pb} label="CLIFDEN" lx={22} ly={34} anchor="start" />
          {t >= fly ? <Plane ac="vimy" x={g.x} y={g.y} s={1.4} rot={g.ang + 25 * bogK} spin={1} /> : null}
          <Puff x={pb[0]} y={pb[1]} k={lin(t, bog, 0.9)} color="#8C8A4A" />
        </MapPanel>
        <SvgPill t={t} fps={fps} a={june} x={MB[0] + 180} y={MB[1] + 50} w={200} size={22}>JUNE 1919</SvgPill>
      </svg>
      <Pic have="vimy" id="s12" a={a} b={b} t={t} fps={fps} box={PB} fallback={() => (
        <Plane ac="vimy" x={PB[0] + PB[2] / 2 - 30} y={PB[1] + PB[3] / 2 - 30} s={2.4} rot={-90} dims spin={1} />
      )} />
      <Num t={t} a={sixteen} fps={fps} x={MB[0] + MB[2] - 60} y={MB[1] + 60} size={80} align="right">~{Math.round(hours)} H</Num>
      <Tag t={t} a={alcock} fps={fps} x={PB[0] + PB[2] / 2} y={PB[1] + PB[3] + 40}>Alcock · Brown</Tag>
    </Scene>
  );
}
// ---------- line 13: the Netherlands on a real map, AMSTERDAM; on "begin" an early airliner (Fokker F.II class, 16 m) sets off on a
// dotted route; a big KLM pill on "KLM" with "1919"; on "still" a bar runs from 1919 to 2026 and "STILL FLYING" pops ----------
function Scene13({t, at, fps, a, b}) {
  const same = at(13, 'same'), begin = at(13, 'begin'), klm = at(13, 'KLM'), still = at(13, 'still');
  const MB = [80, 90, 900, 790];
  const proj = fitBox(LL.NLD, MB, 50);
  const ams = proj([4.9, 52.37]), lon = proj([-0.1, 51.5]);
  const C = [(ams[0] + lon[0]) / 2, Math.min(ams[1], lon[1]) - 120];
  const p = ease(t, begin, 2.4, Easing.inOut(Easing.quad));
  const q = qb(ams, C, lon, p);
  const kK = pop(t, klm, fps, bouncy);
  const bar = ease(t, still, 1.4, Easing.inOut(Easing.quad));
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['NLD']} box={MB} k={pop(t, a, fps, soft)} id="m13">
          {p > 0 ? dotted(ams, C, lon, p, 30, AMBER, 4) : null}
          <Pin t={t} fps={fps} a={a + 0.3} pt={ams} label="AMSTERDAM" lx={22} ly={10} anchor="start" />
          {t >= begin && p < 1 ? <Plane ac="fokkerF2" x={q.x} y={q.y} s={1.6} rot={q.ang} spin={1} /> : null}
        </MapPanel>
        <SvgPill t={t} fps={fps} a={same} x={MB[0] + 150} y={MB[1] + 50} w={140} size={24}>1919</SvgPill>
        <g transform={`translate(1420, 400) scale(${Math.min(1, kK)})`} opacity={Math.min(1, kK)}>
          <rect x={-260} y={-110} width={520} height={220} rx={40} fill={SKY} />
          <text y={40} textAnchor="middle" fontFamily={BIG} fontSize={130} fill={NAVY} letterSpacing={6}>KLM</text>
        </g>
        <Plane ac="fokkerF2" x={1420} y={660 + Math.sin(t * 2) * 6} s={3.2} rot={0} o={Math.min(1, pop(t, begin, fps, soft))} spin={1} />
        <g opacity={bar > 0 ? 1 : 0}>
          <rect x={1060} y={790} width={720} height={16} rx={8} fill={WHITE} opacity={0.12} />
          <rect x={1060} y={790} width={720 * bar} height={16} rx={8} fill={AMBER} />
          <Lbl x={1060} y={840} anchor="start" size={22} o={0.9}>1919</Lbl>
          <Lbl x={1780} y={840} anchor="end" size={22} o={bar >= 1 ? 0.9 : 0.3}>2026</Lbl>
        </g>
        <SvgPill t={t} fps={fps} a={still + 1.2} x={1420} y={760} w={240} size={22} bg={GREEN}>STILL FLYING</SvgPill>
      </svg>
    </Scene>
  );
}
// ---------- line 14: the US map; an envelope at NEW YORK on "mail"; from "fly" a mail plane (D.H.4, 13.2 m) follows the route west;
// the map darkens to night on "night"; on "chain" the beacons light one after another, each with a turning beam, to SAN FRANCISCO ----------
function Scene14({t, at, fps, a, b}) {
  const america = at(14, 'America'), mail = at(14, 'mail'), fly = at(14, 'fly'), night = at(14, 'night'), chain = at(14, 'chain');
  const proj = fitBox(LL.USA, MAP_W, 40);
  const route = [[-74, 40.7], [-81.7, 41.5], [-87.6, 41.9], [-91.5, 41.7], [-96, 41.3], [-100.8, 41.1], [-104.8, 41.1], [-109.2, 41.6], [-111.9, 40.8], [-115.8, 40.8], [-119.8, 39.5], [-122.4, 37.8]].map((c) => proj(c));
  const beacons = [];
  for (let i = 0; i < route.length - 1; i++) for (let j = 0; j < 2; j++) beacons.push([lerp(route[i][0], route[i + 1][0], j / 2), lerp(route[i][1], route[i + 1][1], j / 2)]);
  beacons.push(route[route.length - 1]);
  const p = ease(t, fly, Math.max(2, b - fly), Easing.inOut(Easing.quad));
  const seg = Math.min(route.length - 2, Math.floor(p * (route.length - 1))), u = p * (route.length - 1) - seg;
  const px = lerp(route[seg][0], route[seg + 1][0], u), py = lerp(route[seg][1], route[seg + 1][1], u);
  const ang = Math.atan2(route[seg + 1][1] - route[seg][1], route[seg + 1][0] - route[seg][0]) * 180 / Math.PI;
  const dark = ease(t, night, 1.0);
  const kM = pop(t, mail, fps, bouncy);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['USA']} box={MAP_W} k={1} id="m14">
          <rect x={MAP_W[0]} y={MAP_W[1]} width={MAP_W[2]} height={MAP_W[3]} fill={NAVY} opacity={0.55 * dark} />
          <path d={route.map((r, i) => `${i ? 'L' : 'M'}${r[0].toFixed(1)},${r[1].toFixed(1)}`).join(' ')} stroke={WHITE} strokeWidth={2} fill="none" strokeDasharray="6 10" opacity={0.35} />
          {beacons.map((bp, i) => {
            const k = pop(t, chain + i * 0.09, fps, bouncy);
            if (k <= 0) return null;
            return (
              <g key={i} transform={`translate(${bp[0]}, ${bp[1]})`} opacity={Math.min(1, k)}>
                <circle r={26 * Math.min(1, k)} fill={AMBER} opacity={0.18} />
                <g transform={`rotate(${t * 240 + i * 30})`} opacity={0.35}><path d="M0,0 L60,-10 L60,10 Z" fill={AMBER} /><path d="M0,0 L-60,-10 L-60,10 Z" fill={AMBER} /></g>
                <circle r={7} fill={AMBER} stroke={WHITE} strokeWidth={2} />
              </g>
            );
          })}
          <Pin t={t} fps={fps} a={america} pt={route[0]} label="NEW YORK" lx={22} ly={10} anchor="start" r={9} size={20} />
          <Pin t={t} fps={fps} a={chain + beacons.length * 0.09} pt={route[route.length - 1]} label="SAN FRANCISCO" lx={-22} ly={10} anchor="end" r={9} size={20} />
          <g transform={`translate(${route[0][0] - 10}, ${route[0][1] - 70}) scale(${Math.min(1, kM)})`} opacity={Math.min(1, kM)}>
            <rect x={-30} y={-20} width={60} height={40} rx={4} fill={PAPER} stroke={INK} strokeWidth={2} />
            <path d="M-30,-20 L0,4 L30,-20" stroke={INK} strokeWidth={2} fill="none" />
          </g>
          {t >= fly ? <Plane ac="dh4" x={px} y={py} s={1.6} rot={ang} spin={1} /> : null}
        </MapPanel>
      </svg>
    </Scene>
  );
}
// ---------- line 15: NEW YORK -> PARIS on a real map (great circle); the Spirit of St. Louis (14 m, drawn to scale on the right)
// flies it from "flies"; an "H" counter runs to 33.5 on "thirty three"; on "hundred thousand" a crowd blooms around Paris with
// "~100,000"; a tick at Paris on "lands". "MAY 1927" ----------
function Scene15({t, at, fps, a, b}) {
  const may = at(15, 'May'), charles = at(15, 'Charles'), flies = at(15, 'flies'), ny = at(15, 'New'), paris = at(15, 'Paris'), thirty = at(15, 'thirty'), hours = at(15, 'hours'), hundred = at(15, 'hundred'), lands = at(15, 'lands');
  const MB = [80, 90, 1160, 790], PB = [1280, 90, 560, 420];
  const proj = fitBox(LL.ATL_NY, MB, 40);
  const A = [-73.6, 40.73], B = [2.44, 48.97];
  const pts = greatCircle(proj, A, B, 70);
  const itW = at(15, 'It');   // the takeoff newsreel runs from "flies" to "It takes him"; the map crossing starts when it ends
  const p = ease(t, itW, Math.max(1.5, lands - 0.2 - itW), Easing.inOut(Easing.quad));
  const g = gcAt(proj, A, B, p);
  const h = 33.5 * ease(t, thirty, Math.max(0.5, hours + 0.6 - thirty), Easing.out(Easing.quad));
  const pa = proj(A), pb = proj(B);
  const crowdK = ease(t, hundred, 1.2);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['USA', 'FRA']} box={MB} k={1} id="m15">
          {dottedPts(pts, p, AMBER, 4)}
          {crowdK > 0 ? Array.from({length: 140}, (_, i) => {
            const r = 20 + 90 * Math.sqrt(rnd(i + 400)) * crowdK, an = rnd(i + 401) * Math.PI * 2;
            return <circle key={i} cx={pb[0] + Math.cos(an) * r} cy={pb[1] + Math.sin(an) * r * 0.6} r={3.5} fill={WHITE} opacity={0.8 * clamp01(crowdK * 2 - rnd(i + 402))} />;
          }) : null}
          <Pin t={t} fps={fps} a={ny} pt={pa} label="NEW YORK" lx={-22} ly={34} anchor="end" />
          <Pin t={t} fps={fps} a={paris} pt={pb} label="PARIS" lx={22} ly={-16} anchor="start" />
          {t >= itW ? <Plane ac="spirit" x={g.x} y={g.y} s={1.5} rot={g.ang} spin={p < 1 ? 1 : 0} /> : null}
          <Tick x={pb[0] + 50} y={pb[1] - 60} k={pop(t, lands, fps, bouncy)} r={30} />
        </MapPanel>
        <SvgPill t={t} fps={fps} a={may} x={MB[0] + 170} y={MB[1] + 50} w={190} size={22}>MAY 1927</SvgPill>
      </svg>
      <Pic have="lindbergh" id="s15" a={a} b={b} t={t} fps={fps} box={PB} fallback={() => (
        <Plane ac="spirit" x={PB[0] + PB[2] / 2 - 30} y={PB[1] + PB[3] / 2 - 20} s={3.2} rot={-90} dims spin={0} />
      )} />
      <Num t={t} a={thirty} fps={fps} x={MB[0] + MB[2] - 60} y={MB[1] + 60} size={80} align="right">{h.toFixed(1)} H</Num>
      <Tag t={t} a={charles} fps={fps} x={PB[0] + PB[2] / 2} y={PB[1] + PB[3] + 40}>Charles Lindbergh</Tag>
      <Clip src={LINDBERGH} from={12} a={flies} b={itW} t={t} fps={fps} zoom={[1.38, 1.46]} fx={42} fy={58} dark={0.2} credit="Newsreel, 1927" />
      <Clip src={LINDBERGH} from={122} a={hundred} b={b} t={t} fps={fps} zoom={[1.38, 1.46]} fx={42} fy={58} dark={0.25} credit="Newsreel, 1927" />
      <Num t={t} a={hundred} fps={fps} x={960} y={700} size={96} color={WHITE}>~100,000</Num>
    </Scene>
  );
}
// ---------- line 16: Earhart's picture (or her Lockheed Vega, 12.5 m, drawn to scale with a figure beside it); the Atlantic on a map,
// HARBOUR GRACE -> DERRY dotted from "solo"; "1932" ----------
function Scene16({t, at, fps, a, b}) {
  const five = at(16, 'Five'), amelia = at(16, 'Amelia'), solo = at(16, 'solo'), atlantic = at(16, 'Atlantic');
  const PB = [80, 90, 760, 790], MB = [880, 90, 960, 790];
  const proj = fitBox(LL.ATL_N, MB, 40);
  const A = [-53.2, 47.7], B = [-7.25, 55.0];
  const pts = greatCircle(proj, A, B, 50);
  const p = ease(t, solo, Math.max(1.2, b - solo), Easing.inOut(Easing.quad));
  const g = gcAt(proj, A, B, p);
  const pa = proj(A), pb = proj(B);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['GBR', 'IRL', 'CAN']} box={MB} k={pop(t, a, fps, soft)} id="m16">
          {dottedPts(pts, p, AMBER, 4)}
          <Pin t={t} fps={fps} a={solo} pt={pa} label="HARBOUR GRACE" lx={-22} ly={34} anchor="end" r={9} size={20} />
          <Pin t={t} fps={fps} a={atlantic} pt={pb} label="DERRY" lx={22} ly={34} anchor="start" r={9} size={20} />
          {t >= solo ? <Plane ac="vega" x={g.x} y={g.y} s={1.5} rot={g.ang} spin={1} /> : null}
        </MapPanel>
        <SvgPill t={t} fps={fps} a={five} x={MB[0] + 150} y={MB[1] + 50} w={140} size={24}>1932</SvgPill>
      </svg>
      <Pic have="earhart" id="s16" a={a} b={b} t={t} fps={fps} box={PB} fallback={() => (
        <g>
          <Plane ac="vega" x={PB[0] + PB[2] / 2 - 20} y={PB[1] + 360} s={5} rot={-90} dims spin={0} />
          <Man x={PB[0] + PB[2] / 2 + 230} y={PB[1] + 500} s={5} color={AMBER} />
          <Lbl x={PB[0] + PB[2] / 2} y={PB[1] + 720} size={18} o={0.6}>LOCKHEED VEGA · 12.5 M SPAN</Lbl>
        </g>
      )} />
      <Tag t={t} a={amelia} fps={fps} x={PB[0] + PB[2] / 2} y={PB[1] + 40}>Amelia Earhart</Tag>
    </Scene>
  );
}
// ---------- line 17: a wing cutaway: wooden ribs under fabric (WOOD, FABRIC on their words) is replaced by riveted aluminium on "metal";
// on "1935" the DC-3 seen from above (29 m, drawn to scale) takes the frame, propellers spinning on "takes"; 21 seats fill in on
// "twenty one"; "~21" on "passengers"; the seats turn amber on "money" ----------
function Scene17({t, at, fps, a, b}) {
  const metal = at(17, 'metal'), wood = at(17, 'wood'), fabric = at(17, 'fabric'), y1935 = at(17, '1935'), dc3 = at(17, 'DC-3'), takes = at(17, 'takes'), twenty = at(17, 'twenty'), passengers = at(17, 'passengers'), money = at(17, 'money');
  const andW = at(17, 'and', 1);   // "and it is the first airliner": the Ju 52 film (a 1930s metal airliner flying) from here
  const card = FILMS.junkers;      // with the Junkers F 13 film under it, the cutaway sits in a small card on the right
  const kCut = pop(t, a, fps, soft) * (1 - ease(t, y1935, 0.5));
  const al = ease(t, metal, 1.0, Easing.inOut(Easing.quad));
  const kD = pop(t, y1935, fps, soft);
  const paid = ease(t, money, 0.6);
  const seats = [];
  for (let r = 0; r < 7; r++) for (let c = 0; c < 3; c++) {
    const i = r * 3 + c, k = pop(t, twenty + i * 0.05, fps, bouncy);
    if (k > 0) seats.push(<circle key={i} cx={34 - r * 15} cy={(c - 1) * 6.5} r={2.3 * Math.min(1, k)} fill={paid > 0.5 ? AMBER : NAVY} opacity={0.9} />);
  }
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      {card ? <Clip src={FILM.junkers} from={0} a={a} b={y1935} t={t} fps={fps} zoom={[1.04, 1.12]} dark={0.25} /> : null}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(${card ? 1470 : 960}, 500) scale(${(card ? 0.45 : 1) * (0.9 + 0.1 * Math.min(1, kCut))})`} opacity={Math.min(1, kCut)}>
          {card ? <rect x={-800} y={-220} width={1600} height={440} rx={40} fill={NAVY} opacity={0.78} /> : null}
          <g transform="translate(-400, 0)">
            <path d="M-300,40 C-200,-100 100,-120 300,-40 C200,20 -100,70 -300,40 Z" fill={PAPER} opacity={0.35} />
            {[-240, -160, -80, 0, 80, 160, 240].map((x) => <path key={x} d={`M${x},${40 - (x + 300) * 0.12} C${x},${-60 + (x + 300) * 0.02} ${x + 10},${-70 + (x + 300) * 0.04} ${x + 20},${-50 + (x + 300) * 0.02}`} stroke={WOOD} strokeWidth={6} fill="none" />)}
            <path d="M-300,40 C-200,-100 100,-120 300,-40" stroke={WOOD} strokeWidth={8} fill="none" />
            <path d="M-300,40 C-200,-100 100,-120 300,-40 C200,20 -100,70 -300,40 Z" fill="none" stroke={PAPER} strokeWidth={3} strokeDasharray="10 8" />
            <SvgPill t={t} fps={fps} a={wood} x={-120} y={120} w={120} size={20} bg={WOOD} fg={WHITE}>WOOD</SvgPill>
            <SvgPill t={t} fps={fps} a={fabric} x={120} y={120} w={140} size={20} bg={PAPER} fg={INK}>FABRIC</SvgPill>
          </g>
          <Arrow x={-40} y={0} len={80 * al} dir="right" color={AMBER} k={al} w={10} />
          <g transform="translate(400, 0)" opacity={al}>
            <path d="M-300,40 C-200,-100 100,-120 300,-40 C200,20 -100,70 -300,40 Z" fill={SILVER} />
            {Array.from({length: 60}, (_, i) => { const x = -280 + (i % 15) * 40, y = -40 + Math.floor(i / 15) * 26 - (x + 300) * 0.1; return <circle key={i} cx={x} cy={y} r={2.5} fill={NAVY} opacity={0.5} />; })}
            <path d="M-300,40 C-200,-100 100,-120 300,-40 C200,20 -100,70 -300,40 Z" fill="none" stroke={NAVY} strokeWidth={3} />
            <SvgPill t={t} fps={fps} a={metal} x={0} y={120} w={190} size={20} bg={SILVER} fg={NAVY}>ALUMINIUM</SvgPill>
          </g>
        </g>
        <g transform={`translate(960, ${520 - 20 * ease(t, takes, 1.2)}) rotate(${-90 + 4 * Math.sin(t * 1.2) * ease(t, takes, 1)}) scale(${Math.min(1, kD)})`} opacity={Math.min(1, kD)}>
          <Plane ac="dc3" x={0} y={0} s={3.3} spin={t >= takes ? 1 : 0} dims>{seats}</Plane>
        </g>
        <SvgPill t={t} fps={fps} a={y1935} x={960} y={130} w={140} size={24}>1935</SvgPill>
      </svg>
      <Num t={t} a={passengers} fps={fps} x={1620} y={360} size={110} sub="seats" until={FILMS.ju52 ? andW : undefined}>~21</Num>
      <Tag t={t} a={dc3} fps={fps} x={960} y={870} bg={WHITE} until={FILMS.ju52 ? andW : undefined}>Douglas DC-3</Tag>
      {HAVE.dc3 ? <Photo src={PIC.dc3} id="s17" a={dc3} b={FILMS.ju52 ? andW : b} t={t} box={[80, 560, 420, 300]} fit="cover" radius={16} zoom={[1.0, 1.08]} gray /> : null}
      {FILMS.ju52 ? <Clip src={FILM.ju52} from={0} a={andW} b={b} t={t} fps={fps} zoom={[1.04, 1.12]} dark={0.2} /> : null}
    </Scene>
  );
}

// ---------- line 18: the newsreel, shown clean (review 1: nothing drawn over the film, only the small tag and the date). From the
// start the airship over New York (file 6 s on) until "bursts"; then the fire seen from a distance (file 68 s on, never past 105 s)
// until "and the age"; then, on navy, the size comparison: the Hindenburg (245 m) and a DC-3 (19.7 m), BOTH SIDE VIEWS at one scale,
// "245 M" / "19.7 M"; then "36" small on "over" ----------
function Scene18({t, at, fps, a, b}) {
  const y1937 = at(18, '1937'), bursts = at(18, 'bursts'), cmp = at(18, 'and'), over = at(18, 'over');
  const S = 0.6;   // 10 px per metre x 0.6: the airship 1,470 px long, the DC-3 118 px long
  const kA = pop(t, cmp, fps, soft), kD = pop(t, cmp + 0.6, fps, soft);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <Clip src={NEWSREEL} from={6} a={a} b={bursts} t={t} fps={fps} zoom={[1.0, 1.08]} dark={0.2} credit="Newsreel, 1937" />
      <Clip src={NEWSREEL} from={68} a={bursts} b={cmp} t={t} fps={fps} zoom={[1.0, 1.05]} dark={0.25} credit="Newsreel, 1937" />
      {t >= cmp ? (
        <AbsoluteFill style={{opacity: ease(t, cmp, 0.4)}}>
          <Bg t={t} />
          <svg width={W} height={H} style={{position: 'absolute'}}>
            <g transform={`translate(960, 380) scale(${0.92 + 0.08 * Math.min(1, kA)}) translate(-960, -380)`} opacity={Math.min(1, kA)}>
              <Airship x={960} y={380} s={S} />
              <Ruler t={t} fps={fps} a={cmp + 0.3} x0={960 - 1225 * S} x1={960 + 1225 * S} y={560} k={ease(t, cmp + 0.2, 0.9)} w={140}>245 M</Ruler>
              <SvgPill t={t} fps={fps} a={cmp} x={960} y={110} w={220} size={22} bg={WHITE}>HINDENBURG</SvgPill>
            </g>
            <g opacity={Math.min(1, kD)}>
              <Side ac="dc3" x={960} y={690} s={S} spin={0} />
              <Ruler t={t} fps={fps} a={cmp + 0.9} x0={960 - 98.5 * S} x1={960 + 98.5 * S} y={730} k={ease(t, cmp + 0.7, 0.6)} w={120}>19.7 M</Ruler>
              <SvgPill t={t} fps={fps} a={cmp + 0.6} x={300} y={690} w={120} size={22} bg={WHITE}>DC-3</SvgPill>
            </g>
            <Lbl x={960} y={840} size={18} o={0.6 * Math.min(1, kD)}>SAME SCALE · SIDE VIEWS</Lbl>
          </svg>
        </AbsoluteFill>
      ) : null}
      <Tag t={t} a={y1937} fps={fps} x={960} y={62} until={cmp} bg="rgba(11,27,51,0.75)" fg={WHITE}>May 1937</Tag>
      <Num t={t} a={over} fps={fps} x={1760} y={790} size={64} color={WHITE} align="right">36</Num>
    </Scene>
  );
}
// ---------- line 19: 1940. a cabin cross-section (a circle of fuselage, seats, two figures) with PRESSURISED on the word and pressure
// arrows pushing outward; on the right the Stratoliner (22.7 m, four engines, side view) climbs on "higher" above a bank of cloud tops
// that slides down on "above" ----------
function Scene19({t, at, fps, a, b}) {
  const y1940 = at(19, '1940'), boeing = at(19, 'Boeing'), strato = at(19, 'Stratoliner'), press = at(19, 'pressurised'), cabin = at(19, 'cabin'), higher = at(19, 'higher'), above = at(19, 'above'), weather = at(19, 'weather');
  const kC = pop(t, a + 0.2, fps, soft);
  const kP = pop(t, press, fps, bouncy);
  const climb = ease(t, higher, 2.0, Easing.inOut(Easing.quad));
  const cloudY = lerp(720, 860, ease(t, above, 1.2, Easing.inOut(Easing.quad)));
  const px = 1320 + 60 * climb, py = lerp(640, 330, climb);
  const kS = pop(t, strato, fps, soft);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(420, 500) scale(${Math.min(1, kC)})`} opacity={Math.min(1, kC)}>
          <circle r={250} fill={SILVER} />
          <circle r={222} fill={NAVY2} />
          <rect x={-222} y={40} width={444} height={10} fill={SILVER} opacity={0.6} />
          {[-150, -90, 90, 150].map((x) => <g key={x}><rect x={x - 26} y={-10} width={52} height={50} rx={8} fill={SKY} opacity={0.85} /><rect x={x - 26} y={-70} width={52} height={60} rx={10} fill={SKY} opacity={0.85} /></g>)}
          <Man x={-120} y={30} s={5} color={AMBER} />
          <Man x={120} y={30} s={5} color={AMBER} />
          {kP > 0 ? [0, 45, 90, 135, 180, 225, 270, 315].map((d) => <g key={d} transform={`rotate(${d})`}><Arrow x={0} y={-120} len={60 * Math.min(1, kP) * (0.8 + 0.2 * Math.sin(t * 4 + d))} dir="up" color={AMBER} k={Math.min(1, kP)} w={6} /></g>) : null}
          <SvgPill t={t} fps={fps} a={press} x={0} y={310} w={240} size={22}>PRESSURISED</SvgPill>
        </g>
        <CloudTops t={t} y={cloudY} k={1} o={0.9} />
        <g opacity={Math.min(1, kS)}>
          <Side ac="stratoliner" x={px} y={py} s={2.6} rot={-14 * climb * (1 - 0.5 * ease(t, weather, 0.8))} spin={1} />
          <Lbl x={px} y={py + 110} size={18} o={0.6}>BOEING 307 · 22.7 M LONG · 3.6 M TALL</Lbl>
        </g>
        <SvgPill t={t} fps={fps} a={y1940} x={420} y={150} w={140} size={24}>1940</SvgPill>
      </svg>
      <Tag t={t} a={boeing} fps={fps} x={1320} y={120} bg={WHITE}>Boeing 307 Stratoliner</Tag>
    </Scene>
  );
}
// ---------- line 20: a flashback: "1930" on the chip; Whittle's turbojet as a patent-style cutaway is drawn line by line from "patented"
// (INTAKE, COMPRESSOR, COMBUSTION, TURBINE, EXHAUST as it goes); on "nobody" the drawing dims and a tag of 1930 paper is all that is
// left of the idea ----------
function Scene20({t, at, fps, a, b}) {
  const y1930 = at(20, '1930'), frank = at(20, 'Frank'), patented = at(20, 'patented'), engine = at(20, 'engine'), nobody = at(20, 'nobody');
  const draw = ease(t, patented, Math.max(1.2, engine + 0.6 - patented), Easing.inOut(Easing.quad));
  const dim = ease(t, nobody, 1.2, Easing.inOut(Easing.quad));
  const kPaper = pop(t, y1930, fps, soft);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(960, 500) scale(${Math.min(1, kPaper)})`} opacity={Math.min(1, kPaper)}>
          <rect x={-760} y={-330} width={1520} height={660} rx={16} fill={PAPER} opacity={0.08 - 0.04 * dim} />
          <rect x={-760} y={-330} width={1520} height={660} rx={16} fill="none" stroke={PAPER} strokeWidth={2} opacity={0.35 - 0.2 * dim} />
          <Lbl x={-720} y={-290} anchor="start" size={20} color={PAPER} o={0.6 - 0.3 * dim}>PATENT · 1930</Lbl>
          <JetEngine x={0} y={0} s={3.4} draw={draw} run={0} t={t} o={1 - 0.55 * dim} />
        </g>
      </svg>
      <Tag t={t} a={frank} fps={fps} x={960} y={880}>Frank Whittle</Tag>
    </Scene>
  );
}
// ---------- line 21: the same engine runs: air drawn in, flame, thrust out (from "engine" / "propeller"); on "twenty seventh" the
// date; the Heinkel He 178 (7.2 m span, 7.5 m long, drawn to scale, side view) rolls and lifts off on "makes the first flight"; a
// picture of it (or the drawing with its dimensions) ----------
function Scene21({t, at, fps, a, b}) {
  const engine = at(21, 'engine'), propeller = at(21, 'propeller'), twenty = at(21, 'twenty'), heinkel = at(21, 'Heinkel'), makes = at(21, 'makes'), flight = at(21, 'flight'), jet = at(21, 'jet');
  const run = ease(t, engine, 1.2);
  const shrink = ease(t, heinkel, 1.0, Easing.inOut(Easing.cubic));
  const ex = lerp(960, 420, shrink), ey = lerp(500, 300, shrink), es = lerp(3.4, 1.6, shrink);
  const roll = ease(t, makes, Math.max(1.2, jet + 0.6 - makes), Easing.in(Easing.quad));
  const hx = lerp(760, 1700, roll), hy = 760 - 420 * clamp01((roll - 0.45) / 0.55) * clamp01((roll - 0.45) / 0.55);
  const kH = pop(t, heinkel, fps, soft);
  const PB = [1180, 110, 660, 380];
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <JetEngine x={ex} y={ey} s={es} draw={1} run={run} t={t} labels={shrink < 0.5} />
        <g opacity={Math.min(1, kH)}>
          <line x1={200} y1={766} x2={1800} y2={766} stroke={WHITE} strokeWidth={3} opacity={0.4} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x={240 + i * 200} y={774} width={100} height={6} fill={WHITE} opacity={0.25} />)}
          <Side ac="he178" x={hx} y={hy} s={5} rot={-16 * clamp01((roll - 0.45) / 0.3)} glow={run} />
          <Lbl x={hx} y={hy - 90} size={18} o={0.6}>HE 178 · 7.5 M LONG · 1.5 M TALL · 7.2 M SPAN</Lbl>
        </g>
        <SvgPill t={t} fps={fps} a={twenty} x={420} y={620} w={240} size={22}>27 AUG 1939</SvgPill>
      </svg>
      <Pic have="he178" id="s21" a={heinkel} b={b} t={t} fps={fps} box={PB} fallback={() => (
        <Plane ac="he178" x={PB[0] + PB[2] / 2 - 30} y={PB[1] + PB[3] / 2 - 10} s={3.6} rot={-90} dims><rect x={-37} y={-5} width={16} height={10} rx={3} fill={NAVY} opacity={0.8} /><ellipse cx={-48 - 10 * run} cy={0} rx={14 * run} ry={4} fill={AMBER} opacity={0.9 * run} /></Plane>
      )} />
      <Tag t={t} a={heinkel} fps={fps} x={PB[0] + PB[2] / 2} y={PB[1] + PB[3] + 30} bg={WHITE}>Heinkel He 178</Tag>
    </Scene>
  );
}
// ---------- line 22: a map of Europe, Poland highlighted on "Second"; "1 SEP 1939" on "Five days"; calm and serious: a slow push, a
// few small silhouettes crossing high on "sky" ----------
function Scene22({t, at, fps, a, b}) {
  const five = at(22, 'Five'), second = at(22, 'Second'), begins = at(22, 'begins'), sky = at(22, 'sky');
  const proj = fitBox(LL.EUR, MAP_W, 30);
  const pol = proj([19.4, 52.1]);
  const kP = ease(t, second, 0.8);
  const cam = 1 + 0.05 * lin(t, a, b - a);
  const pulse = t >= begins ? 0.5 + 0.5 * Math.sin((t - begins) * 3) : 0;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(960, 480) scale(${cam}) translate(-960, -480)`}>
          <MapPanel proj={proj} hi={kP > 0 ? ['POL'] : []} box={MAP_W} k={1} id="m22" hiColor={RED}>
            {kP > 0 ? <circle cx={pol[0]} cy={pol[1]} r={40 + 60 * pulse} fill="none" stroke={RED} strokeWidth={3} opacity={0.5 * (1 - pulse) * kP} /> : null}
            {kP > 0 ? <Lbl x={pol[0]} y={pol[1] + 8} size={22} color={WHITE} o={kP}>POLAND</Lbl> : null}
            {t >= sky ? [0, 1, 2, 3, 4].map((i) => <Plane key={i} ac="he178" x={MAP_W[0] + ((t - sky) * 160 + i * 120) % MAP_W[2]} y={MAP_W[1] + 60 + i * 28} s={0.9} rot={0} color={WHITE} o={0.5 * ease(t, sky, 0.6)} />) : null}
          </MapPanel>
        </g>
        <SvgPill t={t} fps={fps} a={five} x={MAP_W[0] + 170} y={MAP_W[1] + 50} w={200} size={22} bg={RED} fg={WHITE}>1 SEP 1939</SvgPill>
      </svg>
    </Scene>
  );
}
// ---------- line 23: southern England on a real map, "BATTLE OF BRITAIN 1940"; from "holds" contrails curve over the Channel, a
// Spitfire (11.2 m) leading the front one; the fight stays in the air: no ground drawing ----------
function Scene23({t, at, fps, a, b}) {
  const y1940 = at(23, '1940'), battle = at(23, 'Battle'), royal = at(23, 'Royal'), holds = at(23, 'holds'), southern = at(23, 'southern'), air = at(23, 'air');
  const proj = fitBox(LL.SENG, MAP_W, 30);
  const lon = proj([-0.12, 51.5]);
  const trails = [[[0.8, 50.4], [1.6, 51.2], [0.2, 51.9]], [[1.6, 50.1], [0.6, 50.9], [-0.9, 51.4]], [[2.4, 50.9], [1.0, 51.6], [-0.4, 52.1]], [[0.1, 50.0], [-0.6, 50.8], [-1.8, 51.0]], [[2.0, 50.3], [2.4, 51.4], [0.8, 52.0]]];
  const drawn = trails.map((tr, i) => ({pts: tr.map((c) => proj(c)), k: ease(t, holds + i * 0.35, 2.0, Easing.inOut(Easing.quad))}));
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <MapPanel proj={proj} hi={['GBR']} box={MAP_W} k={1} id="m23">
          <Pin t={t} fps={fps} a={southern} pt={lon} label="LONDON" lx={-22} ly={-14} anchor="end" r={9} size={20} />
          {drawn.map((d, i) => {
            if (d.k <= 0) return null;
            const q = qb(d.pts[0], d.pts[1], d.pts[2], d.k);
            return (
              <g key={i}>
                <path d={`M${d.pts[0][0]},${d.pts[0][1]} Q${d.pts[1][0]},${d.pts[1][1]} ${d.pts[2][0]},${d.pts[2][1]}`} stroke={WHITE} strokeWidth={5} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - d.k} opacity={0.7} />
                <Plane ac={i % 2 ? 'bf109' : 'spitfire'} x={q.x} y={q.y} s={1.1} rot={q.ang} color={WHITE} spin={1} />
              </g>
            );
          })}
        </MapPanel>
        <SvgPill t={t} fps={fps} a={battle} x={MAP_W[0] + 260} y={MAP_W[1] + 50} w={380} size={22}>BATTLE OF BRITAIN 1940</SvgPill>
        <SvgPill t={t} fps={fps} a={royal} x={MAP_W[0] + 260} y={MAP_W[1] + 110} w={120} size={22} bg={WHITE}>RAF</SvgPill>
      </svg>
    </Scene>
  );
}
// ---------- line 24: the Spitfire (11.2 m, elliptical wings) and the Mustang (11.3 m) seen from above at the same scale, each on its
// name; on "bombers" a formation of B-17s (31.6 m, the same scale) climbs through; a counter runs to ~300,000 on "three hundred
// thousand" with "US-BUILT AIRCRAFT 1940-45" ----------
function Scene24({t, at, fps, a, b}) {
  const spit = at(24, 'Spitfire'), must = at(24, 'Mustang'), bombers = at(24, 'bombers'), fill = at(24, 'fill'), factories = at(24, 'Factories'), three = at(24, 'three'), aircraft = at(24, 'aircraft');
  const wb = FILMS.warbirds;   // with the warbirds film: the real fighters open the line, the two drawings follow on "bombers"
  const kS = pop(t, wb ? bombers : spit, fps, soft), kM = pop(t, wb ? bombers + 0.2 : must, fps, soft);
  const bk = ease(t, bombers, 2.6, Easing.inOut(Easing.quad));
  const n = 300000 * ease(t, three, Math.max(0.8, aircraft + 0.6 - three), Easing.out(Easing.quad));
  const S = 4.2;
  const fade = wb ? 0.8 : 1 - 0.55 * ease(t, bombers, 1.0);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      {wb ? <Clip src={FILM.warbirds} from={0} a={a} b={bombers} t={t} fps={fps} zoom={[1.04, 1.12]} dark={0.2} /> : null}
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={fade}>
          <g transform={`translate(560, 470) scale(${Math.min(1, kS)})`} opacity={Math.min(1, kS)}>
            <Plane ac="spitfire" x={0} y={0} s={S} rot={-90} dims spin={1} />
          </g>
          <g transform={`translate(1360, 470) scale(${Math.min(1, kM)})`} opacity={Math.min(1, kM)}>
            <Plane ac="p51" x={0} y={0} s={S} rot={-90} dims spin={1} />
          </g>
          <SvgPill t={t} fps={fps} a={wb ? bombers : spit} x={560} y={150} w={190} size={22}>SPITFIRE</SvgPill>
          <SvgPill t={t} fps={fps} a={wb ? bombers + 0.2 : must} x={1360} y={150} w={240} size={22} bg={WHITE}>P-51 MUSTANG</SvgPill>
        </g>
        {bk > 0 ? [0, 1, 2, 3, 4].map((i) => {
          const col = i - 2, row = Math.abs(col);
          const y = lerp(1150, -250, bk) + row * 170, x = 960 + col * 330;
          return <Plane key={i} ac="b17" x={x} y={y} s={S * 0.5} rot={-90} spin={1} o={0.95} />;
        }) : null}
        <Lbl x={960} y={860} size={18} o={0.6 * bk}>B-17 · 31.6 M SPAN · SAME SCALE</Lbl>
      </svg>
      <Num t={t} a={three} fps={fps} x={960} y={300} size={160} sub="US-built aircraft 1940-45">~{fmt(n)}</Num>
      {HAVE.b17 ? <Photo src={PIC.b17} id="s24" a={bombers} b={b} t={t} box={[1380, 560, 460, 300]} fit="cover" radius={16} zoom={[1.0, 1.08]} gray /> : null}
    </Scene>
  );
}

// ---------- line 25: 1944. the Me 262 (12.5 m, two jets under swept wings) above a Mustang (11.3 m) at the same scale, both nose to
// the right; the jets glow on "jet"; "FIRST JET FIGHTER" on "first"; on "faster" the 262 pulls ahead with a long chevron trail, the
// Mustang barely moves ----------
function Scene25({t, at, fps, a, b}) {
  const germany = at(25, 'Germany'), first = at(25, 'first'), jet = at(25, 'jet'), messer = at(25, 'Messerschmitt'), faster = at(25, 'faster'), allies = at(25, 'Allies');
  const kJ = pop(t, germany, fps, soft), kM = pop(t, allies - 1.2, fps, soft);
  const glow = ease(t, jet, 0.6), fast = ease(t, faster, 1.4, Easing.inOut(Easing.quad));
  const S = 3.4;
  const jx = 1000 + 260 * fast, mx = 1000 + 50 * fast;
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={Math.min(1, kJ)}>
          <Chevrons t={t} x={jx - 190} y={330} n={6} k={fast} color={AMBER} len={80} size={26} />
          <Plane ac="me262" x={jx} y={330} s={S} rot={0} glow={glow} dims />
        </g>
        <g opacity={Math.min(1, kM)}>
          <Chevrons t={t} x={mx - 180} y={690} n={2} k={fast} color={WHITE} len={50} size={20} />
          <Plane ac="p51" x={mx} y={690} s={S} rot={0} spin={1} dims />
        </g>
        <line x1={200} y1={520} x2={1720} y2={520} stroke={WHITE} strokeWidth={2} strokeDasharray="8 12" opacity={0.2} />
        <SvgPill t={t} fps={fps} a={messer} x={300} y={330} w={160} size={22}>ME 262</SvgPill>
        <SvgPill t={t} fps={fps} a={allies} x={300} y={690} w={240} size={22} bg={WHITE}>P-51 MUSTANG</SvgPill>
        <SvgPill t={t} fps={fps} a={first} x={960} y={130} w={320} size={22} bg={RED} fg={WHITE}>FIRST JET FIGHTER</SvgPill>
      </svg>
      {HAVE.me262 ? <Photo src={PIC.me262} id="s25" a={messer} b={FILMS.p51 ? faster : b} t={t} box={[1400, 60, 440, 260]} fit="cover" radius={16} zoom={[1.0, 1.08]} gray /> : null}
      {FILMS.p51 ? <Clip src={FILM.p51} from={0} a={faster} b={b} t={t} fps={fps} zoom={[1.04, 1.12]} dark={0.2} /> : null}
    </Scene>
  );
}
// the 52 countries of the Chicago conference, as lon/lat points on the world map (capitals, roughly)
const CHICAGO_52 = [[-0.1, 51.5], [2.35, 48.86], [-3.7, 40.4], [12.5, 41.9], [-9.1, 38.7], [4.9, 52.4], [18.1, 59.3], [10.7, 59.9], [12.6, 55.7], [-6.3, 53.3], [28.9, 41], [31.2, 30.1],
  [35.2, 31.8], [51.4, 35.7], [77.2, 28.6], [121.5, 31.2], [116.4, 39.9], [120.9, 14.6], [151.2, -33.9], [174.8, -41.3], [-58.4, -34.6], [-43.2, -22.9], [-70.7, -33.4], [-77, -12],
  [-74.1, 4.7], [-66.9, 10.5], [-99.1, 19.4], [-90.5, 14.6], [-84.1, 9.9], [-82.4, 23.1], [-77.3, 25.1], [-61.5, 10.7], [-79.5, 9], [-87.2, 14.1], [-89.2, 13.7], [-86.3, 12.1],
  [-72.3, 18.5], [-69.9, 18.5], [-56.2, -34.9], [-57.6, -25.3], [-68.1, -16.5], [-78.5, -0.2], [-75.7, 45.4], [15.3, -4.3], [32.6, 15.6], [38.7, 9], [-17.4, 14.7], [3.4, 6.5],
  [36.8, -1.3], [28.0, -26.2], [-8.0, 31.6], [44.4, 33.3]];
// ---------- line 26: a radar scope on the left (a sweep, blips that light as it passes) on "radar"; a world map on the right with
// airfield dots popping on "airfields"; on "December 1944" the scope fades, CHICAGO pins on "Chicago", 52 country dots pop on "fifty
// two" and send thin lines to Chicago on "meet"; "52" ----------
function Scene26({t, at, fps, a, b}) {
  const radar = at(26, 'radar'), airfields = at(26, 'airfields'), december = at(26, 'December'), fifty = at(26, 'fifty'), countries = at(26, 'countries'), meet = at(26, 'meet'), chicago = at(26, 'Chicago');
  const MB = [980, 110, 860, 760];   // the map's box before "December": it widens to the whole frame as the radar fades
  const kR = pop(t, radar, fps, soft) * (1 - ease(t, december, 0.6));
  const sweep = (t - radar) * 200;
  const blips = [[0.5, 30], [0.75, 120], [0.35, 200], [0.85, 260], [0.6, 320]];
  const lines = ease(t, meet, 1.4, Easing.inOut(Easing.quad));
  const fields = [[-74, 40.7], [-0.4, 51.5], [2.5, 49], [-43, -22.9], [28, -26], [77, 28.6], [121, 31], [151, -33.9], [139.7, 35.7], [-99, 19.4], [36.8, -1.3], [55, 25], [-122, 37.8], [-157.9, 21.3], [172, -43]];
  const slide = ease(t, december, 1.0, Easing.inOut(Easing.cubic));
  const box = [lerp(MB[0], 160, slide), 110, lerp(MB[2], 1680, slide), 760];
  const pr = fitBox(LL.WORLD, box, 10);
  const chiP = pr([-87.6, 41.9]);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(520, 490) scale(${Math.min(1, kR)})`} opacity={Math.min(1, kR)}>
          <circle r={330} fill="#07301F" stroke={GREEN} strokeWidth={4} />
          {[110, 220].map((r) => <circle key={r} r={r} fill="none" stroke={GREEN} strokeWidth={1.5} opacity={0.5} />)}
          <line x1={-330} y1={0} x2={330} y2={0} stroke={GREEN} strokeWidth={1.5} opacity={0.4} /><line x1={0} y1={-330} x2={0} y2={330} stroke={GREEN} strokeWidth={1.5} opacity={0.4} />
          <path d={`M0,0 L${330 * Math.cos((sweep - 40) * Math.PI / 180)},${330 * Math.sin((sweep - 40) * Math.PI / 180)} A330,330 0 0 1 ${330 * Math.cos(sweep * Math.PI / 180)},${330 * Math.sin(sweep * Math.PI / 180)} Z`} fill={GREEN} opacity={0.35} />
          <line x1={0} y1={0} x2={330 * Math.cos(sweep * Math.PI / 180)} y2={330 * Math.sin(sweep * Math.PI / 180)} stroke={GREEN} strokeWidth={4} />
          {blips.map(([r, d], i) => {
            const since = (((sweep - d) % 360) + 360) % 360;
            const br = Math.max(0, 1 - since / 300);
            return <g key={i} transform={`translate(${330 * r * Math.cos(d * Math.PI / 180)}, ${330 * r * Math.sin(d * Math.PI / 180)})`} opacity={br}><Plane ac="b17" x={0} y={0} s={0.5} rot={d + 90} color={GREEN} /></g>;
          })}
        </g>
        <MapPanel proj={pr} hi={['USA']} box={box} k={1} id="m26">
          {fields.map((c, i) => {
            const p = pr(c), k = pop(t, airfields + i * 0.08, fps, bouncy);
            return p && k > 0 ? <g key={i} transform={`translate(${p[0]}, ${p[1]}) scale(${Math.min(1, k)})`} opacity={Math.min(1, k) * (1 - 0.6 * slide)}><rect x={-14} y={-3} width={28} height={6} rx={2} fill={WHITE} transform="rotate(-30)" /><rect x={-14} y={-3} width={28} height={6} rx={2} fill={WHITE} transform="rotate(40)" opacity={0.7} /></g> : null;
          })}
          {CHICAGO_52.map((c, i) => {
            const p = pr(c), k = pop(t, fifty + i * 0.03, fps, bouncy);
            if (!p || k <= 0) return null;
            return (
              <g key={i}>
                {lines > 0 ? <line x1={p[0]} y1={p[1]} x2={lerp(p[0], chiP[0], lines)} y2={lerp(p[1], chiP[1], lines)} stroke={AMBER} strokeWidth={1.2} opacity={0.5} /> : null}
                <FlagDot x={p[0]} y={p[1]} i={i} k={k} />
              </g>
            );
          })}
          <Pin t={t} fps={fps} a={chicago} pt={chiP} label="CHICAGO" lx={0} ly={-26} />
        </MapPanel>
        <SvgPill t={t} fps={fps} a={december} x={box[0] + 170} y={box[1] + 50} w={200} size={22}>DEC 1944</SvgPill>
      </svg>
      <Num t={t} a={fifty} fps={fps} x={300} y={330} size={200} color={AMBER}>52</Num>
      {HAVE.chicago ? <Photo src={PIC.chicago} id="s26" a={chicago} b={b} t={t} box={[80, 560, 440, 300]} fit="cover" radius={16} zoom={[1.0, 1.08]} gray /> : null}
    </Scene>
  );
}
// ---------- line 27: 1945, an airfield seen from above that fills the frame (review 1): 20 px per metre, a runway across the frame
// draws on "runways" (the visible stretch is ~90 m of it; the apron is what we see); a line of pilots walks out on "pilots"; six
// parked aircraft at one scale (a B-17 31.6 m, a DC-3 29 m, four P-51s 11.3 m) pop on "big ... planes" ----------
function Scene27({t, at, fps, a, b}) {
  const pilots = at(27, 'pilots'), runways = at(27, 'runways'), big = at(27, 'big'), planes = at(27, 'planes');
  const S = 2.0;
  const kRun = ease(t, runways, 1.6, Easing.inOut(Easing.quad));
  const walk = ease(t, pilots, 3.0, Easing.inOut(Easing.quad));
  const parked = [['b17', 400, 290, 0], ['dc3', 1250, 290, 1], ['p51', 1720, 300, 2], ['p51', 300, 760, 3], ['p51', 600, 760, 4], ['p51', 900, 760, 5]];
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <rect x={0} y={0} width={W} height={H} fill={GREEN} opacity={0.08} />
        <g opacity={kRun > 0 ? 1 : 0}>
          <rect x={0} y={520} width={W * kRun} height={80} fill={NAVY} opacity={0.92} />
          <line x1={0} y1={560} x2={W * kRun} y2={560} stroke={WHITE} strokeWidth={4} strokeDasharray="40 40" opacity={0.6} />
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((u) => <rect key={u} x={W * u - 4} y={526} width={8} height={68} fill={WHITE} opacity={0.25 * clamp01(kRun * 1.5 - u)} />)}
          <g transform="translate(1400, 560) rotate(-30)">
            <rect x={-900} y={-30} width={1800 * clamp01(kRun * 1.3 - 0.3)} height={60} fill={NAVY} opacity={0.92} transform={`translate(${-900 * (1 - clamp01(kRun * 1.3 - 0.3))}, 0)`} />
          </g>
          <rect x={0} y={640} width={W} height={10} fill={WHITE} opacity={0.15 * kRun} />
          <rect x={0} y={440} width={W} height={10} fill={WHITE} opacity={0.15 * kRun} />
        </g>
        {parked.map(([ac, x, y, i]) => {
          const k = pop(t, big + i * 0.12, fps, soft);
          return k > 0 ? <g key={i} transform={`translate(${x}, ${y}) scale(${Math.min(1, k)})`} opacity={Math.min(1, k)}><Plane ac={ac} x={0} y={0} s={S} rot={-90} spin={0} /></g> : null;
        })}
        {walk > 0 ? Array.from({length: 14}, (_, i) => <Man key={i} x={lerp(1000, 1500, walk) + i * 34 + (i % 2) * 8} y={790 + Math.sin(t * 8 + i) * 3} s={3} color={AMBER} o={0.9} />) : null}
        <Lbl x={960} y={60} size={18} o={0.6 * Math.min(1, pop(t, planes, fps, soft))}>SAME SCALE · B-17 31.6 M · DC-3 29 M · P-51 11.3 M</Lbl>
      </svg>
    </Scene>
  );
}
// ---------- line 28: 1947. the Bell X-1 (9.4 m, a bullet with thin wings) side on; chevrons on "faster", shock rings and a Mach cone on
// "sound" with "MACH 1"; on "July 1949" the de Havilland Comet seen from above (35 m span, drawn to scale) takes over, its four jets
// glowing in the wing roots on "jet engines", lifting on "takes off"; "27 JUL 1949" ----------
function Scene28({t, at, fps, a, b, lines}) {
  const NO = 1e9, cue = (w) => (said(lines, 28, w) ? at(28, w) : NO);   // the merged video's line 28 (Bassel 11-18) stops at Mach 1: no Comet
  const chuck = at(28, 'Chuck'), faster = at(28, 'faster'), sound = at(28, 'sound'), july = cue('July'), four = cue('four'), jet = cue('jet'), takes = cue('takes'), comet = cue('Comet');
  const kX = pop(t, a, fps, soft) * (1 - ease(t, july, 0.5));
  const fast = ease(t, faster, 1.0);
  const mach = ease(t, sound, 0.6);
  const shake = t >= faster && t < sound ? Math.sin(t * 50) * 3 * fast : 0;
  const xx = 900 + 160 * fast, xy = 470 + shake;
  const kC = pop(t, july, fps, soft);
  const glow = ease(t, jet, 0.7);
  const lift = ease(t, takes, 1.6, Easing.inOut(Easing.quad));
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={Math.min(1, kX)}>
          <Chevrons t={t} x={xx - 400} y={xy} n={6} k={fast} color={AMBER} len={80} size={28} />
          {mach > 0 ? <g opacity={mach}>
            <path d={`M${xx + 380},${xy} L${xx - 700},${xy - 560}`} stroke={SKY} strokeWidth={3} strokeDasharray="12 10" opacity={0.7} />
            <path d={`M${xx + 380},${xy} L${xx - 700},${xy + 560}`} stroke={SKY} strokeWidth={3} strokeDasharray="12 10" opacity={0.7} />
            {[0, 1, 2].map((i) => { const ph = ((t - sound) * 0.8 + i * 0.33) % 1; return <circle key={i} cx={xx + 380} cy={xy} r={20 + ph * 220} fill="none" stroke={SKY} strokeWidth={5 * (1 - ph)} opacity={(1 - ph) * 0.8} />; })}
          </g> : null}
          <Side ac="x1" x={xx} y={xy} s={8} glow={0.8} />
          <Lbl x={xx} y={xy + 110} size={18} o={0.6}>BELL X-1 · 9.4 M LONG · 1.5 M TALL · 8.5 M SPAN</Lbl>
          <SvgPill t={t} fps={fps} a={sound} x={xx + 380} y={xy - 140} w={150} size={24} bg={SKY}>MACH 1</SvgPill>
        </g>
        <g transform={`translate(960, ${520 - 60 * lift}) rotate(-90) scale(${Math.min(1, kC) * (1 + 0.1 * lift)})`} opacity={Math.min(1, kC)}>
          <Plane ac="comet" x={0} y={0} s={2.4} glow={glow} dims />
        </g>
        <SvgPill t={t} fps={fps} a={july} x={300} y={150} w={220} size={22}>27 JUL 1949</SvgPill>
      </svg>
      <Tag t={t} a={chuck} fps={fps} x={300} y={150} until={july}>Chuck Yeager</Tag>
      <Tag t={t} a={comet} fps={fps} x={960} y={880} bg={WHITE}>de Havilland Comet</Tag>
      {HAVE.x1 ? <Photo src={PIC.x1} id="s28a" a={chuck} b={july} t={t} box={[80, 560, 420, 300]} fit="cover" radius={16} zoom={[1.0, 1.08]} gray /> : null}
      {HAVE.comet ? <Photo src={PIC.comet} id="s28b" a={comet} b={b} t={t} box={[1420, 560, 420, 300]} fit="cover" radius={16} zoom={[1.0, 1.08]} gray /> : null}
    </Scene>
  );
}
// ---------- line 29: a timeline 1903 -> 1949; from "flight" the Flyer morphs step by step (a crossfade per step) through the Blériot,
// the Vimy, the Spirit, the DC-3, the He 178, the Me 262 into the Comet, all seen from above at ONE scale; "<50 YEARS" on "fifty",
// "12 S" at the left end on "twelve", "CONTINENTS" at the right end on "continents" ----------
const STEPS_ALL = [['flyer', 1903], ['bleriot', 1909], ['vimy', 1919], ['spirit', 1927], ['dc3', 1935], ['he178', 1939], ['me262', 1944], ['comet', 1949]];
function Scene29({t, at, fps, a, b, lines}) {
  const STEPS = said(lines, 28, 'Comet') ? STEPS_ALL : STEPS_ALL.slice(0, -1);   // the merged video: the Comet is Chapter 3's, not shown here
  const fifty = at(29, 'fifty'), flight = at(29, 'flight'), twelve = at(29, 'twelve'), jets = at(29, 'jets'), continents = at(29, 'continents');
  const X0 = 300, X1 = 1620, TY = 800;
  const step = Math.max(0.3, (jets - flight) / (STEPS.length - 1));
  const raw = t < flight ? 0 : Math.min(STEPS.length - 1, (t - flight) / step);
  const i = Math.floor(raw), f = ease(raw - i, 0, 0.6, Easing.inOut(Easing.quad));
  const S = 2.1;
  const kIn = pop(t, a, fps, soft);
  const xOf = (j) => lerp(X0, X1, j / (STEPS.length - 1));
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <Clip src={A380} from={11} a={jets} b={b} t={t} fps={fps} zoom={[1.0, 1.08]} dark={0.5} credit="Real footage · today" />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={Math.min(1, kIn)}>
          <line x1={X0} y1={TY} x2={X1} y2={TY} stroke={WHITE} strokeWidth={4} opacity={0.4} />
          <line x1={X0} y1={TY} x2={lerp(X0, X1, raw / (STEPS.length - 1))} y2={TY} stroke={AMBER} strokeWidth={4} />
          {STEPS.map(([ac, yr], j) => (
            <g key={yr} transform={`translate(${xOf(j)}, ${TY})`}>
              <circle r={raw >= j ? 12 : 8} fill={raw >= j ? AMBER : WHITE} opacity={raw >= j ? 1 : 0.5} />
              <Lbl x={0} y={44} size={20} color={raw >= j ? AMBER : WHITE} o={0.9}>{yr}</Lbl>
            </g>
          ))}
          <g transform="translate(960, 430)">
            {t >= flight || i === 0 ? <g opacity={i < STEPS.length - 1 ? 1 - f : 1} transform={`scale(${1 - 0.1 * f})`}><Plane ac={STEPS[i][0]} x={0} y={0} s={S} rot={-90} spin={1} glow={STEPS[i][0] === 'comet' ? 1 : 0} /></g> : null}
            {i < STEPS.length - 1 && f > 0 ? <g opacity={f} transform={`scale(${0.9 + 0.1 * f})`}><Plane ac={STEPS[i + 1][0]} x={0} y={0} s={S} rot={-90} spin={1} glow={STEPS[i + 1][0] === 'comet' ? 1 : 0} /></g> : null}
          </g>
          <Lbl x={960} y={720} size={18} o={0.6}>{STEPS[Math.min(STEPS.length - 1, Math.round(raw))][0] === 'comet' ? '35 M SPAN' : `${AC[STEPS[Math.min(STEPS.length - 1, Math.round(raw))][0]].span} M SPAN`} · ONE SCALE</Lbl>
        </g>
        <SvgPill t={t} fps={fps} a={fifty} x={960} y={130} w={200} size={22}>&lt;50 YEARS</SvgPill>
        <SvgPill t={t} fps={fps} a={twelve} x={X0} y={TY - 60} w={110} size={22} bg={WHITE}>12 S</SvgPill>
        <SvgPill t={t} fps={fps} a={continents} x={X1} y={TY - 60} w={220} size={22}>CONTINENTS</SvgPill>
      </svg>
    </Scene>
  );
}
// ---------- line 30 (from "Now" in line 29): a calm last beat on real footage of today (review 2): a 747-8 climbing past, a slow
// push, "Real footage · today"; fade to navy on "chapter" ----------
function Scene30({t, at, fps, a, b, seconds, lines}) {
  const chapter = lines && lines[30] ? at(30, 'chapter') : seconds + 10;   // no 'next chapter' line (the merged video): no fade
  const out = ease(t, chapter, Math.max(0.5, seconds - chapter), Easing.inOut(Easing.quad));
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <Clip src={B747} from={0} a={a} b={seconds} t={t} fps={fps} zoom={[1.0, 1.1]} dark={0.2} credit="Real footage · today" />
      <AbsoluteFill style={{background: NAVY, opacity: out, pointerEvents: 'none'}} />
    </Scene>
  );
}

// the running year chip: which label is showing at time t, and since when (the client's list, 1930 shown as a flashback)
const yearSchedule = (at, lines) => {
  const has = (i) => Boolean(lines[i]);
  const s = [[has(0) ? at(0, 'seventeenth') : 0, '17 DEC 1903']];
  if (has(5)) s.push([at(5, '1905'), '1905']);
  if (has(6)) { s.push([at(6, '1906'), '1906']); s.push([at(6, 'Two'), '1908']); }
  if (has(7)) s.push([at(7, '1909'), '1909']);
  if (has(8)) s.push([at(8, '1914'), '1914']);
  if (has(9)) s.push([at(9, '1915'), '1915']);
  if (has(10)) s.push([at(10, '1918'), '1918']);
  if (has(12)) s.push([at(12, '1919'), '1919']);
  if (has(14)) s.push([at(14, '1924'), '1924']);
  if (has(15)) s.push([at(15, '1927'), '1927']);
  if (has(16)) s.push([at(16, 'Five'), '1932']);
  if (has(17)) s.push([at(17, '1935'), '1935']);
  if (has(18)) s.push([at(18, '1937'), '1937']);
  if (has(19)) s.push([at(19, '1940'), '1940']);
  if (has(20)) s.push([at(20, '1930'), '1930']);
  if (has(21)) s.push([at(21, '1939'), '1939']);
  if (has(23)) s.push([at(23, '1940'), '1940']);
  if (has(25)) s.push([at(25, '1944'), '1944']);
  if (has(27)) s.push([at(27, '1945'), '1945']);
  if (has(28)) { s.push([at(28, '1947'), '1947']); if (said(lines, 28, '1949')) s.push([at(28, '1949'), '1949']); }
  return s;
};

export const AviHistory2 = ({lines = [], words = [], seconds = 376}) => {
  const {fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;
  const at = makeAt(lines);
  const T = (i) => (lines[i] ? lines[i].t0 : seconds);
  const now = lines[29] ? at(29, 'Now') : T(30);
  // the merged video (Bassel 11-19): line 0 is a bridge ("...it is time to put their machine to the test") instead of the Kill Devil
  // Hills opening, and there is no map before Orville on the wing: Orville's shot runs from the first frame through lines 0 and 1
  const bridge = lines[0] && !said(lines, 0, 'Kill');
  const scenes = [...(bridge ? [[0, T(2), Scene1]] : [[0, T(1), Scene0], [T(1), T(2), Scene1]]), [T(2), T(3), Scene2], [T(3), T(4), Scene3], [T(4), T(5), Scene4], [T(5), T(6), Scene5],
                  [T(6), T(7), Scene6], [T(7), T(8), Scene7], [T(8), T(9), Scene8], [T(9), T(10), Scene9], [T(10), T(11), Scene10], [T(11), T(12), Scene11],
                  [T(12), T(13), Scene12], [T(13), T(14), Scene13], [T(14), T(15), Scene14], [T(15), T(16), Scene15], [T(16), T(17), Scene16], [T(17), T(18), Scene17],
                  [T(18), T(19), Scene18], [T(19), T(20), Scene19], [T(20), T(21), Scene20], [T(21), T(22), Scene21], [T(22), T(23), Scene22], [T(23), T(24), Scene23],
                  [T(24), T(25), Scene24], [T(25), T(26), Scene25], [T(26), T(27), Scene26], [T(27), T(28), Scene27], [T(28), T(29), Scene28], [T(29), now, Scene29],
                  [now, seconds + 1, Scene30]];
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
