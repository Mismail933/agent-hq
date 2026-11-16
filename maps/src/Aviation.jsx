// Aviation.jsx: three SAMPLE Shorts for the aviation series (brief 2026-11-16, client notes applied; review 1 applied: real geography
// from geo.json + d3-geo, Routes ends on the footage alone, the coffin-corner chart rebuilt, a real jet engine, real pilots).
// 1080x1920, 30 fps, each plays under its recorded narration. Animated explainer: things build, move and react on the spoken words
// (helper at(line, 'word')). Real footage where it shows the real thing, drawings where it explains; no title words, only numbers,
// real information and labels that name something in a drawing. Captions are drawn by another layer at y 1180-1440 (kept empty
// here); top 0-120 and x<40, x>1040 are kept clear too. Every frame is a pure function of the frame number.
import React from 'react';
import {AbsoluteFill, Sequence, OffthreadVideo, staticFile, interpolate, spring, Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import {geoOrthographic, geoMercator, geoPath, geoInterpolate, geoGraticule10} from 'd3-geo';
import geo from './geo.json';   // Natural Earth (public domain): geo.world.features, properties.a3 = ISO3

const W = 1080, H = 1920;
const NAVY = '#0B1B33', NAVY2 = '#152C4F', WHITE = '#FFFFFF', AMBER = '#FFB547';
const SKY = '#7FB8E6', RED = '#FF5C5C', GREEN = '#6FD48F', SICK = '#9BC53D', LAND = '#2A4570', LAND2 = '#3D5C8E', SEA = '#0E2447';
const BIG = "'Archivo Black', sans-serif", SMALL = "'Montserrat', sans-serif";
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
const XF = 5 / 30;   // crossfade between shots: 5 frames

// ---------- tiny pure helpers (same family as HoneyFable) ----------
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
// closed path through screen points [[x,y],...]
const closed = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z';
// a quadratic bezier: point and heading at u (used for the drawn, non-geographic arcs)
const qb = (p0, c, p1, u) => {
  const x = (1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * c[0] + u * u * p1[0];
  const y = (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * c[1] + u * u * p1[1];
  const dx = 2 * (1 - u) * (c[0] - p0[0]) + 2 * u * (p1[0] - c[0]);
  const dy = 2 * (1 - u) * (c[1] - p0[1]) + 2 * u * (p1[1] - c[1]);
  return {x, y, ang: Math.atan2(dy, dx) * 180 / Math.PI};
};

// ---------- real geography (review 1) ----------
const LAND_FC = geo.world;
const GRAT = geoGraticule10();
// points along the great circle a -> b (lon/lat), up to fraction `upTo`
const gcPts = (a, b, upTo = 1, n = 48) => { const ip = geoInterpolate(a, b); const out = []; for (let i = 0; i <= n; i++) out.push(ip(upTo * i / n)); return out; };
const lineD = (path, coords) => path({type: 'LineString', coordinates: coords}) || '';
// screen position and heading of a plane at fraction u along the great circle a -> b (null when on the far side of a globe)
const gcPose = (proj, a, b, u) => {
  const ip = geoInterpolate(a, b);
  const p = proj(ip(u)), p0 = proj(ip(Math.max(0, u - 0.01))), p1 = proj(ip(Math.min(1, u + 0.01)));
  if (!p || !p0 || !p1) return null;
  return {x: p[0], y: p[1], ang: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180 / Math.PI};
};
// a Mercator camera: each region (lon0, lat0, lon1, lat1) is fitted into the safe area once; between regions the camera eases its
// log-scale and centre, so moves read as one continuous zoom, not a swap
const MAP_EXT = [[90, 280], [990, 1120]];   // centre (540, 700)
const fitRegion = (box) => {
  const p = geoMercator().fitExtent(MAP_EXT, {type: 'MultiPoint', coordinates: [[box[0], box[1]], [box[2], box[3]], [box[0], box[3]], [box[2], box[1]]]});
  return {scale: p.scale(), center: p.invert([540, 700])};
};
const camera = (A, B, k) => geoMercator()
  .scale(Math.exp(lerp(Math.log(A.scale), Math.log(B.scale), k)))
  .center([lerp(A.center[0], B.center[0], k), lerp(A.center[1], B.center[1], k)])
  .translate([540, 700]).clipExtent([[0, 0], [W, H]]);

// ---------- shared building blocks ----------
// deep navy sky with a faint dot grid and slow clouds (never a flat still)
function Bg({t}) {
  const dots = [];
  for (let r = 0; r < 24; r++) for (let c = 0; c < 14; c++) dots.push(<circle key={r * 14 + c} cx={40 + c * 77} cy={60 + r * 80} r={2} fill={WHITE} opacity={0.06 + 0.04 * Math.sin(t * 0.8 + r * 0.7 + c * 0.4)} />);
  const clouds = [[0, 420, 1.3], [1, 1000, 1.0], [2, 300, 0.8]].map(([i, y, s]) => {
    const x = ((t * 18 * s + rnd(i) * 1400) % 1500) - 300;
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

// the captions layer owns y 1180-1440; a soft darker band keeps drawings from fighting the words
function CaptionBand() {
  return <div style={{position: 'absolute', left: 0, top: 1180, width: W, height: 260, background: 'linear-gradient(180deg, rgba(11,27,51,0) 0%, rgba(11,27,51,0.4) 25%, rgba(11,27,51,0.4) 75%, rgba(11,27,51,0) 100%)'}} />;
}

// small credit tag top-left ("Real footage" / "AI recreation")
function Credit({t, a, children}) {
  return (
    <div style={{position: 'absolute', left: 44, top: 136, padding: '7px 14px', borderRadius: 8, background: 'rgba(11,27,51,0.6)', border: '1px solid rgba(255,255,255,0.25)',
                 fontFamily: SMALL, fontWeight: 700, fontSize: 22, color: WHITE, letterSpacing: 1, opacity: ease(t, a + 0.1, 0.3)}}>{children}</div>
  );
}

// a scene wrapper: fades in over XF seconds on top of the previous scene
function Scene({t, a, children}) {
  return <AbsoluteFill style={{opacity: a <= 0 ? 1 : ease(t, a, XF, Easing.inOut(Easing.quad))}}>{children}</AbsoluteFill>;
}

// real footage, full frame (cover), a slow push-in; `a`..`b` in global seconds; the Sequence starts at the shot's start
function Clip({src, from = 0, a, b, t, fps, zoom = [1.04, 1.14], fx = 50, fy = 50, dark = 0.3, rate = 1, ai = false}) {
  if (t < a || t > b + XF) return null;
  const p = lin(t, a, Math.max(0.1, b - a));
  const z = lerp(zoom[0], zoom[1], p);
  const style = {position: 'absolute', width: W, height: H, objectFit: 'cover', objectPosition: `${fx}% ${fy}%`, transform: `scale(${z})`, transformOrigin: `${fx}% ${fy}%`};
  const fade = interpolate(t, [a, a + XF], [0, 1], CL);
  return (
    <AbsoluteFill style={{opacity: fade, background: NAVY}}>
      <Sequence from={Math.round(a * fps)} durationInFrames={Math.max(1, Math.round((b - a + XF) * fps))} layout="none">
        <OffthreadVideo src={staticFile(`fs/${src}`)} muted startFrom={Math.round(from * fps)} playbackRate={rate} style={style} />
      </Sequence>
      <AbsoluteFill style={{background: `linear-gradient(180deg, rgba(11,27,51,${dark + 0.25}) 0%, rgba(11,27,51,${dark * 0.3}) 28%, rgba(11,27,51,${dark * 0.3}) 58%, rgba(11,27,51,${dark + 0.4}) 100%)`}} />
      <Credit t={t} a={a}>{ai ? 'AI recreation' : 'Real footage'}</Credit>
    </AbsoluteFill>
  );
}

// a number (Archivo Black) with a small unit label beneath; pops on its word; anchored on x
function Num({t, a, fps, x = 540, y, size = 110, color = AMBER, children, sub, subColor = WHITE, until, align = 'center'}) {
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
function Tag({t, a, fps, x, y, children, bg = AMBER, fg = NAVY, size = 24, dy = 20, until}) {
  if (t < a || (until && t > until + 0.3)) return null;
  const k = pop(t, a, fps, soft);
  const out = until ? interpolate(t, [until, until + 0.3], [1, 0], CL) : 1;
  return (
    <div style={{position: 'absolute', left: x, top: y, padding: '7px 20px', borderRadius: 999, background: bg, color: fg, textAlign: 'center',
                 fontFamily: SMALL, fontWeight: 800, fontSize: size, letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap',
                 opacity: k * out, transform: `translate(-50%, ${(1 - k) * dy}px) scale(${0.8 + 0.2 * k})`, boxShadow: '0 6px 18px rgba(0,0,0,0.3)'}}>{children}</div>
  );
}
// SVG label (uppercase, small) for use inside maps
const Lbl = ({x, y, children, anchor = 'middle', size = 22, color = WHITE, o = 1, weight = 800}) => (
  <text x={x} y={y} textAnchor={anchor} fontFamily={SMALL} fontWeight={weight} fontSize={size} fill={color} letterSpacing={2} opacity={o}>{children}</text>
);

// a plane seen from above, nose to +x, about 90 px long at scale 1
const PlaneTop = ({x, y, s = 1, rot = 0, color = WHITE, o = 1}) => (
  <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
    <path d="M44,0 L24,-5 L4,-6 L-6,-44 L-16,-44 L-14,-6 L-30,-5 L-36,-20 L-42,-20 L-40,-4 L-44,0 L-40,4 L-42,20 L-36,20 L-30,5 L-14,6 L-16,44 L-6,44 L4,6 L24,5 Z" fill={color} />
  </g>
);
// a plane seen from the side, nose to +x, about 110 px long at scale 1
const PlaneSide = ({x, y, s = 1, rot = 0, color = WHITE, o = 1, accent = AMBER}) => (
  <g transform={`translate(${x}, ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
    <path d="M52,0 C46,-10 30,-13 10,-13 L-34,-13 L-42,-36 L-52,-36 L-50,-13 L-56,-10 L-56,8 C-40,12 -10,13 10,13 C30,13 46,9 52,0 Z" fill={color} />
    <path d="M-2,2 L-28,26 L-12,26 L18,2 Z" fill={color} opacity={0.9} />
    <rect x={-14} y={11} width={26} height={12} rx={6} fill={accent} />
    <path d="M30,-9 L40,-9 L36,-4 L28,-4 Z" fill={NAVY} opacity={0.6} />
  </g>
);
// a dot pin on a map with its name; `pt` is the projected [x, y] (null when off the globe)
function Pin({t, fps, a, pt, label, lx = 0, ly = -26, anchor = 'middle', color = AMBER, size = 22, o = 1}) {
  if (t < a || !pt) return null;
  const k = pop(t, a, fps, bouncy);
  return (
    <g transform={`translate(${pt[0]}, ${pt[1]})`} opacity={Math.min(1, k * 1.5) * o}>
      <circle r={22 * k} fill={color} opacity={0.25} />
      <circle r={11 * k} fill={color} stroke={WHITE} strokeWidth={4} />
      <text x={lx} y={ly} textAnchor={anchor} fontFamily={SMALL} fontWeight={800} fontSize={size} fill={WHITE} letterSpacing={2} opacity={k}>{label}</text>
    </g>
  );
}
// a green tick badge
const Tick = ({x, y, k = 1, r = 44}) => (
  <g transform={`translate(${x}, ${y}) scale(${k})`} opacity={Math.min(1, k)}>
    <circle r={r} fill={GREEN} />
    <path d={`M${-r * 0.45},${r * 0.05} L${-r * 0.12},${r * 0.4} L${r * 0.5},${-r * 0.4}`} stroke={NAVY} strokeWidth={r * 0.22} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </g>
);
// an SVG pill label (same look as Tag) for use inside an <svg>
function SvgPill({t, fps, a, x, y, children, bg = AMBER, fg = NAVY, w = 180, size = 22, o = 1}) {
  if (t < a) return null;
  const k = pop(t, a, fps, soft);
  return (
    <g transform={`translate(${x}, ${y + (1 - k) * 20}) scale(${0.8 + 0.2 * k})`} opacity={k * o}>
      <rect x={-w / 2} y={-22} width={w} height={44} rx={22} fill={bg} />
      <text y={8} textAnchor="middle" fontFamily={SMALL} fontWeight={800} fontSize={size} fill={fg} letterSpacing={2}>{children}</text>
    </g>
  );
}

// a meal tray, 220 wide, centred on (0,0). dish: 'steak' | 'omelette' | 'fish' | 'chicken' | '?' | 'none'. sick 0..1 turns it green and
// wobbly; tick 0..1 pops a tick; dishK 0..1 pops the dish on its own.
function Tray({x, y, s = 1, k = 1, dish = 'none', dishK = 1, sick = 0, tick = 0, t = 0}) {
  if (k <= 0) return null;
  const wob = sick > 0 ? Math.sin(t * 28) * 4 * sick : 0;
  const px = -42, py = 0;
  const dishEl = (() => {
    if (dish === 'steak') return (
      <g>
        <path d="M-28,-18 C-10,-30 20,-26 28,-10 C34,6 20,22 0,22 C-20,22 -36,8 -28,-18 Z" fill="#8B4A2B" />
        <path d="M-16,-10 L12,14 M-4,-18 L20,2" stroke="#4F2614" strokeWidth={4} strokeLinecap="round" />
      </g>);
    if (dish === 'omelette') return (
      <g>
        <path d="M-32,8 C-32,-16 -8,-26 12,-22 C28,-18 34,0 32,12 Z" fill="#F6C945" />
        <path d="M-32,8 L32,12" stroke="#E0A92B" strokeWidth={4} />
        {[-18, -2, 14].map((dx) => <rect key={dx} x={dx} y={-4} width={10} height={8} rx={2} fill="#F28FA0" />)}
      </g>);
    if (dish === 'fish') return (
      <g>
        <ellipse cx={-4} cy={0} rx={26} ry={13} fill="#D6DEE8" />
        <path d="M18,0 L34,-12 L34,12 Z" fill="#D6DEE8" />
        <circle cx={-16} cy={-3} r={2.5} fill={NAVY} />
        <circle cx={24} cy={-14} r={9} fill="#F6E27A" stroke="#E0C13C" strokeWidth={2} />
      </g>);
    if (dish === 'chicken') return (
      <g transform="rotate(-25)">
        <ellipse cx={-6} cy={0} rx={22} ry={15} fill="#C8803C" />
        <rect x={12} y={-3} width={20} height={6} rx={3} fill="#F2EEE6" />
        <circle cx={32} cy={-4} r={4} fill="#F2EEE6" /><circle cx={32} cy={4} r={4} fill="#F2EEE6" />
      </g>);
    if (dish === '?') return <text y={14} textAnchor="middle" fontFamily={BIG} fontSize={40} fill={NAVY} opacity={0.7}>?</text>;
    return null;
  })();
  return (
    <g transform={`translate(${x}, ${y}) rotate(${wob}) scale(${s * k})`} opacity={Math.min(1, k)}>
      <rect x={-110} y={-60} width={220} height={120} rx={16} fill="#E6ECF5" />
      <rect x={-110} y={-60} width={220} height={120} rx={16} fill="none" stroke="#B8C4D6" strokeWidth={3} />
      <circle cx={px} cy={py} r={44} fill={WHITE} stroke="#C9D3E2" strokeWidth={4} />
      <circle cx={60} cy={-22} r={16} fill={AMBER} /><circle cx={60} cy={-22} r={10} fill="#C98A2E" />
      <rect x={52} y={10} width={6} height={40} rx={3} fill="#9AA8BC" /><rect x={66} y={10} width={6} height={40} rx={3} fill="#9AA8BC" />
      <g transform={`translate(${px}, ${py}) scale(${dishK})`} opacity={dishK}>{dishEl}</g>
      {sick > 0 ? (
        <g>
          <circle cx={px} cy={py} r={46} fill={SICK} opacity={0.55 * sick} />
          {[0, 1, 2].map((i) => {
            const ph = ((t * 0.9 + rnd(i + 40)) % 1);
            return <path key={i} d={`M${px - 24 + i * 24 + Math.sin(ph * 6 + i) * 4} ${py - 40 - ph * 70} q 6 -10 0 -20 t 0 -20`} stroke={SICK} strokeWidth={4} fill="none" strokeLinecap="round" opacity={sick * (1 - ph)} />;
          })}
        </g>
      ) : null}
      {tick > 0 ? <Tick x={78} y={-56} k={tick} r={30} /> : null}
    </g>
  );
}

// a pilot seen from behind: shoulders with gold stripes on the epaulettes, head, peaked cap. local: shoulders at y 0, cap top ~ -130
function Pilot({stripes = 4, skin = '#C98B63', hair = '#2B1A0E', t = 0, seed = 0}) {
  const bob = Math.sin(t * 1.4 + seed) * 2;
  return (
    <g transform={`translate(0, ${bob})`}>
      {/* shoulders / jacket */}
      <path d="M-150,70 L-120,0 Q0,-24 120,0 L150,70 Z" fill="#17294A" />
      <path d="M-120,0 Q0,-24 120,0 L120,12 Q0,-10 -120,12 Z" fill="#223A66" />
      {[-1, 1].map((sgn) => (
        <g key={sgn} transform={`translate(${sgn * 88}, -4) rotate(${sgn * 8})`}>
          <rect x={-38} y={-10} width={76} height={22} rx={6} fill={NAVY} />
          {Array.from({length: stripes}, (_, i) => <rect key={i} x={-32 + i * (64 / stripes)} y={-6} width={Math.min(12, 64 / stripes - 4)} height={14} fill={AMBER} />)}
        </g>
      ))}
      {/* neck and head */}
      <rect x={-18} y={-50} width={36} height={40} rx={10} fill={skin} />
      <circle cx={0} cy={-78} r={46} fill={skin} />
      <path d="M-46,-80 Q-44,-118 0,-122 Q44,-118 46,-80 Q30,-96 0,-98 Q-30,-96 -46,-80 Z" fill={hair} />
      {/* peaked cap, from behind: crown, band, a touch of the visor at the sides */}
      <ellipse cx={0} cy={-122} rx={58} ry={22} fill={WHITE} />
      <path d="M-58,-122 Q-60,-100 -50,-96 L50,-96 Q60,-100 58,-122 Z" fill="#17294A" />
      <rect x={-50} y={-104} width={100} height={8} fill={AMBER} opacity={0.9} />
      <path d="M-62,-98 L-50,-96 L-48,-90 L-66,-92 Z" fill="#0B1B33" /><path d="M62,-98 L50,-96 L48,-90 L66,-92 Z" fill="#0B1B33" />
    </g>
  );
}

// a cockpit seen from behind the two seats: windshield with a moving horizon, dashboard, two pilots (caps, gold stripes), a tray beside
// each seat. local coords: windshield top at y -130, trays at y 400 (about 760 wide, 560 tall)
function Cockpit({t, fps, labelL, labelR, trayAt, dishL = 'none', dishR = 'none', dishAt, sickL = 0, tickR = 0, id = 'ck'}) {
  const kTray = trayAt === undefined ? 0 : pop(t, trayAt, fps, soft);
  const kDish = dishAt === undefined ? 1 : pop(t, dishAt, fps, bouncy);
  const horizon = 30 + Math.sin(t * 0.6) * 6;
  return (
    <g>
      <defs>
        <clipPath id={`${id}-win`}><path d="M-370,-130 Q-380,-130 -376,-120 L-300,90 L300,90 L376,-120 Q380,-130 370,-130 Z" /></clipPath>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2F6FB5" /><stop offset="100%" stopColor="#9CCBF0" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id}-win)`}>
        <rect x={-400} y={-140} width={800} height={240} fill={`url(#${id}-sky)`} />
        <rect x={-400} y={horizon} width={800} height={100} fill="#4C7A4E" />
        <rect x={-400} y={horizon} width={800} height={5} fill={WHITE} opacity={0.5} />
        {[0, 1, 2, 3].map((i) => {
          const x = ((t * (25 + i * 8) + rnd(i + 11) * 900) % 1000) - 500;
          return <ellipse key={i} cx={x} cy={-60 + rnd(i + 12) * 70} rx={60 + rnd(i + 13) * 40} ry={14 + rnd(i + 14) * 8} fill={WHITE} opacity={0.75} />;
        })}
      </g>
      <path d="M-370,-130 Q-380,-130 -376,-120 L-300,90 L300,90 L376,-120 Q380,-130 370,-130 Z" fill="none" stroke="#1F3357" strokeWidth={16} strokeLinejoin="round" />
      <rect x={-14} y={-130} width={28} height={220} fill="#1F3357" />
      {/* dashboard */}
      <rect x={-400} y={90} width={800} height={80} rx={10} fill="#1A2D4E" />
      {[-300, -240, -180, 180, 240, 300].map((x) => <circle key={x} cx={x} cy={130} r={20} fill="#0B1B33" stroke="#4F6A94" strokeWidth={3} />)}
      {[-300, -240, -180, 180, 240, 300].map((x, i) => <line key={x} x1={x} y1={130} x2={x + Math.cos(t * 1.2 + i) * 14} y2={130 + Math.sin(t * 1.2 + i) * 14} stroke={AMBER} strokeWidth={3} strokeLinecap="round" />)}
      <rect x={-80} y={104} width={160} height={52} rx={6} fill="#0B1B33" stroke="#4F6A94" strokeWidth={3} />
      {[-60, -30, 0, 30].map((x, i) => <rect key={x} x={x} y={112 + (i % 2) * 10} width={20} height={30 - (i % 2) * 14} fill={i % 2 ? SKY : GREEN} opacity={0.8} />)}
      {/* seats, pilots above the seat backs */}
      {[-1, 1].map((sgn) => (
        <g key={sgn} transform={`translate(${sgn * 200}, 0)`}>
          <Pilot stripes={sgn < 0 ? 4 : 3} skin={sgn < 0 ? '#C98B63' : '#8D5B3C'} hair={sgn < 0 ? '#2B1A0E' : '#111'} t={t} seed={sgn} />
          <rect x={-110} y={150} width={220} height={200} rx={26} fill="#24395E" />
          <rect x={-110} y={150} width={220} height={200} rx={26} fill="none" stroke="#3B5582" strokeWidth={4} />
          <path d="M-96,330 Q0,300 96,330 L96,360 L-96,360 Z" fill="#24395E" />
          <rect x={-150} y={230} width={46} height={120} rx={14} fill="#2E4B78" /><rect x={104} y={230} width={46} height={120} rx={14} fill="#2E4B78" />
        </g>
      ))}
      <Tray x={-200} y={420} s={0.95} k={kTray} dish={dishL} dishK={kDish} sick={sickL} t={t} />
      <Tray x={200} y={420} s={0.95} k={kTray} dish={dishR} dishK={kDish} tick={tickR} t={t} />
      {labelL}{labelR}
    </g>
  );
}
// an airline tail fin (plain shape, the NAME as text, no logo). local: base at y 0, 300 wide, 240 tall
function Fin({t, fps, a, x, y, lines, fill = WHITE, fg = NAVY}) {
  if (t < a) return null;
  const k = pop(t, a, fps, soft);
  return (
    <g transform={`translate(${x}, ${y + (1 - k) * 40}) scale(${0.85 + 0.15 * k})`} opacity={k}>
      <path d="M0,0 L300,0 L300,-50 L190,-240 L110,-240 Z" fill={fill} />
      <path d="M-40,-8 L70,-8 L50,-44 L-40,-44 Z" fill={fill} opacity={0.8} />
      <path d="M0,0 L300,0" stroke={fg} strokeWidth={6} opacity={0.25} />
      {lines.map((ln, i) => <text key={i} x={175} y={-96 + i * 30} textAnchor="middle" fontFamily={SMALL} fontWeight={800} fontSize={24} fill={fg} letterSpacing={2}>{ln}</text>)}
    </g>
  );
}

// =====================================================================================================================
// SAMPLE 1: MEALS (6 lines, ~39.7 s)
// =====================================================================================================================
const TOKYO_LL = [139.7, 35.7], ANCH_LL = [-149.9, 61.2], CPH_LL = [12.6, 55.7];
const GLOBE_ROT = [-160, -70];   // orthographic view centred on lon 160E, lat 70N: the polar route reads as the real one (tune here)
const GLOBE_R = 470, GLOBE_C = [540, 700];

// the 343-seat cabin: 10 across (3-4-3), 35 rows; which 196 fall sick and in what order is seeded
const SEATS = [];
for (let i = 0; i < 343; i++) {
  const row = Math.floor(i / 10), col = i % 10;
  SEATS.push({x: 257 + col * 54 + (col >= 3 ? 40 : 0) + (col >= 7 ? 40 : 0), y: 290 + row * 23, row});
}
const SICK_RANK = (() => {
  const idx = SEATS.map((_, i) => i).sort((a, b) => rnd(a + 700) - rnd(b + 700));
  const rank = new Array(343).fill(-1);
  idx.slice(0, 196).forEach((seat, r) => { rank[seat] = r; });
  return rank;
})();

// ---------- line 0: the hook. A380 taxiing seen through the cabin window; two question-mark trays pop on "pilots" / "eating" ----------
function SceneM0({t, at, fps, a, b}) {
  const pilots = at(0, 'pilots'), eating = at(0, 'eating');
  return (
    <Scene t={t} a={a}>
      <Clip src="a380-dubai.mp4" from={10} a={a} b={b} t={t} fps={fps} zoom={[1.04, 1.14]} dark={0.3} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <Tray x={400} y={560} s={1.1} k={pop(t, pilots, fps, bouncy)} dish="?" t={t} />
        <Tray x={690} y={560} s={1.1} k={pop(t, eating, fps, bouncy)} dish="?" t={t} />
      </svg>
    </Scene>
  );
}

// ---------- line 1: captain and co-pilot, different meals. AI recreation of the two pilots eating (or a drawn cockpit); CAPTAIN /
// CO-PILOT labels on their words; "AIRLINE POLICY" on "law" (it is policy, not law) ----------
function SceneM1({t, at, fps, a, b, hasAiMeals}) {
  const captain = at(1, 'captain'), copilot = at(1, 'co-pilot'), served = at(1, 'served'), different = at(1, 'different'), law = at(1, 'law');
  if (hasAiMeals) {
    return (
      <Scene t={t} a={a}>
        <Clip src="pilots-meals-ai.mp4" from={0} a={a} b={b} t={t} fps={fps} ai zoom={[1.0, 1.06]} dark={0.22} />
        <Tag t={t} a={captain} fps={fps} x={300} y={560}>Captain</Tag>
        <Tag t={t} a={copilot} fps={fps} x={780} y={560} bg={WHITE}>Co-pilot</Tag>
        <Tag t={t} a={law} fps={fps} x={540} y={1060} bg="rgba(11,27,51,0.75)" fg={WHITE} size={22}>Airline policy</Tag>
      </Scene>
    );
  }
  const cam = 1 + 0.05 * lin(t, a, b - a);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(540, 640) scale(${1.05 * cam})`}>
          <Cockpit id="ck1" t={t} fps={fps} trayAt={served} dishAt={different} dishL="fish" dishR="chicken"
                   labelL={<SvgPill t={t} fps={fps} a={captain} x={-200} y={-170} w={170}>CAPTAIN</SvgPill>}
                   labelR={<SvgPill t={t} fps={fps} a={copilot} x={200} y={-170} w={190} bg={WHITE}>CO-PILOT</SvgPill>} />
        </g>
      </svg>
      <Tag t={t} a={law} fps={fps} x={540} y={300} bg="rgba(11,27,51,0.75)" fg={WHITE} size={22}>Airline policy</Tag>
    </Scene>
  );
}

// ---------- line 2: 1975. a real globe seen from over the Arctic (geo.json, orthographic), slowly turning; the polar route
// Tokyo > Anchorage > Copenhagen is flown as great circles on "charter flight to Copenhagen", pins on the cities; a ham omelette
// tray pops on "ham", turns sick-green on "food poisoning" ----------
function SceneM2({t, at, fps, a, b}) {
  const year = at(2, '1975'), charter = at(2, 'charter'), cph = at(2, 'Copenhagen'), ham = at(2, 'ham'), poison = at(2, 'food');
  const proj = geoOrthographic().rotate([GLOBE_ROT[0] + (t - a) * 1.5, GLOBE_ROT[1], 0]).scale(GLOBE_R).translate(GLOBE_C).clipAngle(90);
  const path = geoPath(proj);
  const draw = ease(t, a, 0.9);
  const p = ease(t, charter, 1.35, Easing.inOut(Easing.quad));   // 0..1 along Tokyo>Anchorage>Copenhagen, lands on "Copenhagen"
  const leg1 = clamp01(p * 2), leg2 = clamp01(p * 2 - 1);
  const pose = p < 0.5 ? gcPose(proj, TOKYO_LL, ANCH_LL, leg1) : gcPose(proj, ANCH_LL, CPH_LL, leg2);
  const sick = ease(t, poison, 0.5);
  const tokyo = proj(TOKYO_LL), anch = proj(ANCH_LL), cphP = proj(CPH_LL);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <defs>
          <radialGradient id="globe-sea" cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#1B3A6B" /><stop offset="70%" stopColor={SEA} /><stop offset="100%" stopColor="#06122A" />
          </radialGradient>
          <radialGradient id="globe-rim" cx="50%" cy="50%" r="50%">
            <stop offset="88%" stopColor={WHITE} stopOpacity={0} /><stop offset="100%" stopColor={WHITE} stopOpacity={0.55} />
          </radialGradient>
        </defs>
        <g opacity={draw} transform={`translate(${GLOBE_C[0]}, ${GLOBE_C[1]}) scale(${0.9 + 0.1 * draw}) translate(${-GLOBE_C[0]}, ${-GLOBE_C[1]})`}>
          <circle cx={GLOBE_C[0]} cy={GLOBE_C[1]} r={GLOBE_R + 26} fill={WHITE} opacity={0.06} />
          <circle cx={GLOBE_C[0]} cy={GLOBE_C[1]} r={GLOBE_R} fill="url(#globe-sea)" />
          <path d={path(GRAT) || ''} stroke={WHITE} strokeWidth={1} fill="none" opacity={0.12} />
          <path d={path(LAND_FC) || ''} fill={LAND} stroke={LAND2} strokeWidth={1.5} strokeLinejoin="round" />
          <circle cx={GLOBE_C[0]} cy={GLOBE_C[1]} r={GLOBE_R} fill="url(#globe-rim)" />
          <circle cx={GLOBE_C[0]} cy={GLOBE_C[1]} r={GLOBE_R} fill="none" stroke={WHITE} strokeWidth={3} opacity={0.5} />
          {/* the route: two great-circle legs, drawn as the plane flies them */}
          {leg1 > 0 ? <path d={lineD(path, gcPts(TOKYO_LL, ANCH_LL, leg1))} stroke={AMBER} strokeWidth={6} fill="none" strokeLinecap="round" /> : null}
          {leg2 > 0 ? <path d={lineD(path, gcPts(ANCH_LL, CPH_LL, leg2))} stroke={AMBER} strokeWidth={6} fill="none" strokeLinecap="round" /> : null}
          <Pin t={t} fps={fps} a={a + 0.4} pt={tokyo} label="TOKYO" ly={48} />
          <Pin t={t} fps={fps} a={charter + 0.62} pt={anch} label="ANCHORAGE" lx={28} ly={10} anchor="start" />
          <Pin t={t} fps={fps} a={cph} pt={cphP} label="COPENHAGEN" ly={-30} />
          {t >= charter && pose ? <PlaneTop x={pose.x} y={pose.y} rot={pose.ang} s={0.75} /> : null}
        </g>
        {/* the ham omelette, bottom-left outside the globe */}
        <Tray x={170} y={980} s={1.0} k={pop(t, ham, fps, bouncy)} dish="omelette" sick={sick} t={t} />
      </svg>
      <Num t={t} a={year} fps={fps} x={60} y={140} size={96} color={WHITE} align="left">1975</Num>
    </Scene>
  );
}

// ---------- line 3: 196 of 343. the cabin builds seat by seat; the number counts to 196 on the words; "/ 343" on "three hundred";
// 196 seats turn sick-green one by one through "passengers fell sick" ----------
function SceneM3({t, at, fps, a, b}) {
  const one = at(3, 'One'), three = at(3, 'three'), pass = at(3, 'passengers'), sickW = at(3, 'sick');
  const n = 196 * ease(t, one, 1.05, Easing.out(Easing.quad));
  const k343 = pop(t, three, fps, bouncy);
  const pulse = 1 + 0.12 * (1 - ease(t, sickW, 0.4));
  const body = ease(t, a, 0.6);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <path d="M240,330 Q240,190 540,190 Q840,190 840,330 L840,1110 Q840,1140 810,1140 L270,1140 Q240,1140 240,1110 Z" fill={NAVY2} stroke={WHITE} strokeWidth={4} strokeOpacity={0.35} opacity={body} />
        <path d="M240,520 L60,700 L60,760 L240,660 Z" fill={NAVY2} stroke={WHITE} strokeWidth={4} strokeOpacity={0.35} opacity={body} />
        <path d="M840,520 L1020,700 L1020,760 L840,660 Z" fill={NAVY2} stroke={WHITE} strokeWidth={4} strokeOpacity={0.35} opacity={body} />
        {SEATS.map((s, i) => {
          const appear = ease(t, a + 0.1 + (s.row / 35) * 0.9, 0.25);
          if (appear <= 0) return null;
          const r = SICK_RANK[i];
          const turn = r < 0 ? 0 : ease(t, pass + (r / 196) * 2.6, 0.2, Easing.out(Easing.back(2)));
          return (
            <g key={i} transform={`translate(${s.x}, ${s.y}) scale(${appear * (1 + 0.5 * turn * (1 - turn))})`}>
              <rect x={-9} y={-9} width={18} height={18} rx={4} fill={turn > 0.5 ? SICK : WHITE} opacity={turn > 0.5 ? 1 : 0.8} />
            </g>
          );
        })}
      </svg>
      {t >= one ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 132, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 18, transform: `scale(${pulse})`}}>
          <div style={{fontFamily: BIG, fontSize: 120, lineHeight: 1, color: SICK, textShadow: '0 8px 24px rgba(0,0,0,0.45)'}}>{Math.round(n)}</div>
          <div style={{fontFamily: BIG, fontSize: 64, lineHeight: 1, color: WHITE, opacity: k343, transform: `scale(${0.6 + 0.4 * k343})`}}>/ 343</div>
        </div>
      ) : null}
    </Scene>
  );
}

// ---------- line 4: the pilots had eaten steak. real lift-off through the window; two trays pop on "pilots", steaks land on "steak",
// ticks on "fine" ----------
function SceneM4({t, at, fps, a, b}) {
  const pilots = at(4, 'pilots'), steak = at(4, 'steak'), fine = at(4, 'fine');
  return (
    <Scene t={t} a={a}>
      <Clip src="takeoff-oak.mp4" from={62} a={a} b={b} t={t} fps={fps} zoom={[1.06, 1.16]} dark={0.35} />
      <Tag t={t} a={pilots} fps={fps} x={330} y={610}>Captain</Tag>
      <Tag t={t} a={pilots + 0.12} fps={fps} x={750} y={610} bg={WHITE}>Co-pilot</Tag>
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <Tray x={330} y={780} s={1.15} k={pop(t, pilots, fps, bouncy)} dish="steak" dishK={pop(t, steak, fps, bouncy)} tick={pop(t, fine, fps, bouncy)} t={t} />
        <Tray x={750} y={780} s={1.15} k={pop(t, pilots + 0.12, fps, bouncy)} dish="steak" dishK={pop(t, steak + 0.1, fps, bouncy)} tick={pop(t, fine + 0.15, fps, bouncy)} t={t} />
      </svg>
    </Scene>
  );
}

// ---------- line 5: today. two tail fins (names only) pop on "British Airways" / "Virgin Atlantic"; the drawn cockpit (two pilots with
// caps and stripes) arrives on "make", labels on "two pilots", trays on "eat", different dishes on "different"; one dish goes bad on
// "bad", the other pilot's tick on "both". Then a calm last beat: the horizon drifts, a slow push ----------
function SceneM5({t, at, fps, a, b}) {
  const british = at(5, 'British'), virgin = at(5, 'Virgin'), make = at(5, 'make'), two = at(5, 'two'), pilots = at(5, 'pilots'), eat = at(5, 'eat'), different = at(5, 'different'), bad = at(5, 'bad'), both = at(5, 'both');
  const kCk = pop(t, make, fps, soft);
  const cam = 1 + 0.04 * lin(t, both, Math.max(0.5, b - both));
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <Fin t={t} fps={fps} a={british} x={150} y={520} lines={['BRITISH', 'AIRWAYS']} fill={WHITE} />
        <Fin t={t} fps={fps} a={virgin} x={620} y={520} lines={['VIRGIN', 'ATLANTIC']} fill={AMBER} />
        <g transform={`translate(540, ${760 + (1 - kCk) * 60}) scale(${0.85 * cam * (0.9 + 0.1 * kCk)})`} opacity={kCk}>
          <Cockpit id="ck5" t={t} fps={fps} trayAt={eat} dishAt={different} dishL="fish" dishR="chicken" sickL={ease(t, bad, 0.5)} tickR={pop(t, both, fps, bouncy)}
                   labelL={<SvgPill t={t} fps={fps} a={two} x={-200} y={-170} w={170}>CAPTAIN</SvgPill>}
                   labelR={<SvgPill t={t} fps={fps} a={pilots} x={200} y={-170} w={190} bg={WHITE}>CO-PILOT</SvgPill>} />
        </g>
      </svg>
    </Scene>
  );
}

export const AviMeals = ({lines = [], words = [], seconds = 40, hasAiMeals = true}) => {
  const {fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;
  const at = makeAt(lines);
  const T = (i) => (lines[i] ? lines[i].t0 : seconds);
  const scenes = [[0, T(1), SceneM0], [T(1), T(2), SceneM1], [T(2), T(3), SceneM2], [T(3), T(4), SceneM3], [T(4), T(5), SceneM4], [T(5), seconds + 1, SceneM5]];
  return (
    <AbsoluteFill style={{background: NAVY}}>
      {scenes.map(([a, b, C], i) => (t >= a && t < b + XF ? <C key={i} t={t} at={at} fps={fps} a={a} b={b} lines={lines} hasAiMeals={hasAiMeals} /> : null))}
      <CaptionBand />
      <AbsoluteFill style={{background: NAVY, opacity: interpolate(t, [seconds - 0.4, seconds], [0, 1], CL), pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

// =====================================================================================================================
// SAMPLE 2: ROUTES (5 lines, ~33.2 s)
// =====================================================================================================================
// a route line that draws on (progress 0..1) with a soft glow and a pulse once drawn
function Route({d, p, t, color = AMBER, width = 7, glow = true, o = 1}) {
  if (p <= 0 || !d) return null;
  const pulse = p >= 1 ? 1 + 0.25 * Math.sin(t * 5) : 1;
  return (
    <g opacity={o}>
      {glow ? <path d={d} stroke={color} strokeWidth={width * 3.4} fill="none" strokeLinecap="round" opacity={0.16 * pulse} /> : null}
      <path d={d} stroke={color} strokeWidth={width * pulse} fill="none" strokeLinecap="round" />
    </g>
  );
}
// a red cross-out over a point
function Cross({pt, k, r = 40}) {
  if (k <= 0 || !pt) return null;
  return (
    <g transform={`translate(${pt.x}, ${pt.y})`}>
      <line x1={-r} y1={-r} x2={-r + 2 * r * clamp01(k * 2)} y2={-r + 2 * r * clamp01(k * 2)} stroke={RED} strokeWidth={12} strokeLinecap="round" />
      <line x1={r} y1={-r} x2={r - 2 * r * clamp01(k * 2 - 1)} y2={-r + 2 * r * clamp01(k * 2 - 1)} stroke={RED} strokeWidth={12} strokeLinecap="round" />
    </g>
  );
}
// a rank badge (number in a circle)
const Badge = ({pt, k, dx = 0, dy = 0, children}) => (k <= 0 || !pt ? null : (
  <g transform={`translate(${pt.x + dx}, ${pt.y + dy}) scale(${k})`} opacity={Math.min(1, k)}>
    <circle r={28} fill={AMBER} stroke={NAVY} strokeWidth={4} />
    <text y={11} textAnchor="middle" fontFamily={BIG} fontSize={30} fill={NAVY}>{children}</text>
  </g>
));
// little planes shuttling both ways along a great circle once the route exists
function Shuttle({t, proj, a, b, start, n = 4, seed = 1, o = 1}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const s0 = start + i * 0.2;
    if (t < s0) continue;
    const fwd = i % 2 === 0;
    const u0 = ((t - s0) / 2.2 + rnd(i + seed * 7)) % 1;
    const q = gcPose(proj, a, b, fwd ? u0 : 1 - u0);
    if (!q) continue;
    out.push(<PlaneTop key={i} x={q.x} y={q.y} rot={fwd ? q.ang : q.ang + 180} s={0.3} o={ease(t, s0, 0.4) * o} color={i % 3 ? WHITE : AMBER} />);
  }
  return <g>{out}</g>;
}

// the four map regions (lon0, lat0, lon1, lat1), fitted once; the camera eases between them on the words
const REG = {atl: fitRegion([-85, 22, 60, 62]), kor: fitRegion([124, 32.8, 131.6, 43]), jpn: fitRegion([128.5, 30.5, 146.5, 46]), hkt: fitRegion([112, 20.5, 123.5, 27])};
const NYC = [-73.78, 40.64], LHR = [-0.45, 51.47], DXB = [55.36, 25.25];
const GMP = [126.80, 37.56], CJU = [126.49, 33.51];
const HND = [139.78, 35.55], CTS = [141.69, 42.78], FUK = [130.45, 33.59];
const HKG = [113.92, 22.31], TPE = [121.23, 25.08];

// ---------- line 0: the hook. A380 taking off head-on in mist, footage only (the question is in the narration) ----------
function SceneR0({t, at, fps, a, b}) {
  return (
    <Scene t={t} a={a}>
      <Clip src="a380-takeoff-yyz.mp4" from={8} a={a} b={b} t={t} fps={fps} zoom={[1.02, 1.12]} dark={0.3} />
    </Scene>
  );
}

// ---------- lines 1-4 on ONE real map (geo.json, Mercator) with a camera that eases between regions:
// Atlantic: NEW YORK -> LONDON arc on "York", crossed out on the second "Not"; LONDON -> DUBAI on "Dubai", crossed out.
// Camera to Korea on "It's": the Gimpo-Jeju line and one hopping plane on "hop", SEOUL · GIMPO on "Seoul", JEJU on "Jeju";
// "2025 · OAG" on "twenty"; shuttling planes from "offered"; 14.4 MILLION counts on "fourteen million seats"; ≈ 39,000 a day on
// "thirty nine thousand"; 200+ flights on "two hundred". Camera to Japan on "The": TOKYO · HANEDA, SAPPORO (2), FUKUOKA (3) with
// their great circles. Camera to the Taiwan Strait on "busiest": HONG KONG, the arc flown on "to", TAIPEI, 6.8 MILLION seats ----------
function SceneRMap({t, at, fps, a, b}) {
  const ny = at(1, 'New'), york = at(1, 'York'), london = at(1, 'London'), not2 = at(1, 'Not', 1), dubai = at(1, 'Dubai');
  const its = at(1, "It's"), hop = at(1, 'hop'), seoul = at(1, 'Seoul'), jeju = at(1, 'Jeju');
  const y2025 = at(2, 'twenty'), offered = at(2, 'offered'), fourteen = at(2, 'fourteen'), thirty = at(2, 'thirty'), two = at(2, 'two');
  // at() prefix-matches, and "Tokyo" starts with "to": the two "to"s of line 3 are matches 1 and 3
  const theJ = at(3, 'The'), tokyo = at(3, 'Tokyo'), to1 = at(3, 'to', 1), sapporo = at(3, 'Sapporo'), to2 = at(3, 'to', 3), fukuoka = at(3, 'Fukuoka');
  const busiest = at(4, 'busiest'), hong = at(4, 'Hong'), toH = at(4, 'to'), taipei = at(4, 'Taipei');
  // the camera
  const k1 = ease(t, its, 1.0, Easing.inOut(Easing.cubic)), k2 = ease(t, theJ, 1.0, Easing.inOut(Easing.cubic)), k3 = ease(t, busiest, 1.0, Easing.inOut(Easing.cubic));
  const proj = k3 > 0 ? camera(REG.jpn, REG.hkt, k3) : k2 > 0 ? camera(REG.kor, REG.jpn, k2) : camera(REG.atl, REG.kor, k1);
  const path = geoPath(proj);
  const oAtl = 1 - k1, oKor = 1 - k2, oJpn = k2 > 0 ? 1 - k3 : 0, oHk = k3 > 0 ? 1 : 0;
  // Atlantic
  const p1 = ease(t, york, 0.6), p2 = ease(t, dubai, 0.55);
  const x1 = ease(t, not2, 0.35), x2 = ease(t, dubai + 0.3, 0.35);
  // Korea
  const G = proj(GMP), J = proj(CJU);
  const line = ease(t, hop, 0.8), hopP = ease(t, hop, 1.0, Easing.inOut(Easing.quad));
  const korPlanes = [];
  if (G && J && oKor > 0) {
    const dx = J[0] - G[0], dy = J[1] - G[1], L = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx) * 180 / Math.PI;
    const nx = -dy / L, nyy = dx / L;
    const along = (u, side) => [G[0] + dx * u + nx * side, G[1] + dy * u + nyy * side];
    if (t >= hop && hopP < 1) { const h = along(hopP, 0); korPlanes.push(<PlaneTop key="hop" x={h[0]} y={h[1]} rot={ang} s={0.5} />); }
    for (let i = 0; i < 12; i++) {
      const start = offered + i * 0.15;
      if (t < start) continue;
      const toJeju = i % 2 === 0;
      const u0 = ((t - start) / 2.4 + rnd(i + 30)) % 1;
      const pos = along(toJeju ? u0 : 1 - u0, (toJeju ? 1 : -1) * (12 + rnd(i + 31) * 16));
      korPlanes.push(<PlaneTop key={i} x={pos[0]} y={pos[1]} rot={toJeju ? ang : ang + 180} s={0.34} o={ease(t, start, 0.4)} color={i % 3 ? WHITE : AMBER} />);
    }
  }
  const millions = 14.4 * ease(t, fourteen, 1.3, Easing.out(Easing.quad));
  const perDay = 39000 * ease(t, thirty, 1.0, Easing.out(Easing.quad));
  // Japan
  const pj1 = ease(t, to1, 0.7), pj2 = ease(t, to2, 0.7);
  // Hong Kong - Taipei
  const ph = ease(t, toH, 1.1, Easing.inOut(Easing.quad));
  const hkPose = gcPose(proj, HKG, TPE, ph);
  return (
    <Scene t={t} a={a}>
      <Bg t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {/* the world, real shapes, one navy fill */}
        <path d={path(GRAT) || ''} stroke={WHITE} strokeWidth={1} fill="none" opacity={0.1 * oAtl} />
        <path d={path(LAND_FC) || ''} fill={LAND} stroke={LAND2} strokeWidth={1.5} strokeLinejoin="round" />
        {/* Atlantic: the two long arcs, crossed out */}
        {oAtl > 0 ? (
          <g opacity={oAtl}>
            <Route d={lineD(path, gcPts(NYC, LHR, p1))} p={p1} t={t} color={WHITE} glow={false} />
            <Route d={lineD(path, gcPts(LHR, DXB, p2))} p={p2} t={t} color={WHITE} glow={false} />
            <Pin t={t} fps={fps} a={ny} pt={proj(NYC)} label="NEW YORK" ly={46} color={WHITE} />
            <Pin t={t} fps={fps} a={london} pt={proj(LHR)} label="LONDON" ly={-30} color={WHITE} />
            <Pin t={t} fps={fps} a={dubai} pt={proj(DXB)} label="DUBAI" ly={46} color={WHITE} />
            <Cross pt={gcPose(proj, NYC, LHR, 0.5)} k={x1} />
            <Cross pt={gcPose(proj, LHR, DXB, 0.5)} k={x2} />
          </g>
        ) : null}
        {/* Korea: Gimpo - Jeju */}
        {G && J && oKor > 0 ? (
          <g opacity={oKor}>
            <Route d={`M${G[0]},${G[1]} L${G[0] + (J[0] - G[0]) * line},${G[1] + (J[1] - G[1]) * line}`} p={line} t={t} />
            {korPlanes}
            <Pin t={t} fps={fps} a={seoul} pt={G} label="SEOUL · GIMPO" lx={-26} ly={8} anchor="end" />
            <Pin t={t} fps={fps} a={jeju} pt={J} label="JEJU" ly={54} />
          </g>
        ) : null}
        {/* Japan: Haneda - Sapporo (2), Haneda - Fukuoka (3) */}
        {oJpn > 0 ? (
          <g opacity={oJpn}>
            <Route d={lineD(path, gcPts(HND, CTS, pj1))} p={pj1} t={t} />
            <Route d={lineD(path, gcPts(HND, FUK, pj2))} p={pj2} t={t} />
            <Shuttle t={t} proj={proj} a={HND} b={CTS} start={sapporo} seed={1} />
            <Shuttle t={t} proj={proj} a={HND} b={FUK} start={fukuoka} seed={2} />
            <Pin t={t} fps={fps} a={tokyo} pt={proj(HND)} label="TOKYO · HANEDA" lx={26} ly={46} anchor="start" />
            <Pin t={t} fps={fps} a={sapporo} pt={proj(CTS)} label="SAPPORO" lx={30} ly={8} anchor="start" />
            <Pin t={t} fps={fps} a={fukuoka} pt={proj(FUK)} label="FUKUOKA" ly={52} />
            <Badge pt={gcPose(proj, HND, CTS, 0.5)} dx={44} k={pop(t, sapporo, fps, bouncy)}>2</Badge>
            <Badge pt={gcPose(proj, HND, FUK, 0.5)} dy={-44} k={pop(t, fukuoka, fps, bouncy)}>3</Badge>
          </g>
        ) : null}
        {/* Hong Kong - Taipei */}
        {oHk > 0 ? (
          <g>
            <Route d={lineD(path, gcPts(HKG, TPE, ph))} p={ph} t={t} />
            {t >= toH && ph < 1 && hkPose ? <PlaneTop x={hkPose.x} y={hkPose.y} rot={hkPose.ang} s={0.6} /> : null}
            <Pin t={t} fps={fps} a={hong} pt={proj(HKG)} label="HONG KONG" ly={50} />
            <Pin t={t} fps={fps} a={taipei} pt={proj(TPE)} label="TAIPEI" ly={-30} />
          </g>
        ) : null}
      </svg>
      {/* the Korea numbers (OAG 2025), gone when the camera leaves for Japan */}
      <Tag t={t} a={y2025} fps={fps} x={540} y={140} bg={WHITE} size={22} until={theJ}>2025 · OAG</Tag>
      <Num t={t} a={fourteen} fps={fps} x={540} y={196} size={84} sub="seats" until={theJ}>{millions.toFixed(1)} MILLION</Num>
      <Num t={t} a={thirty} fps={fps} x={975} y={500} size={72} color={WHITE} sub="seats a day" align="right" until={theJ}>≈ {fmt(perDay)}</Num>
      <Num t={t} a={two} fps={fps} x={975} y={740} size={72} color={WHITE} sub="flights a day" align="right" until={theJ}>200+</Num>
      {/* Hong Kong - Taipei: OAG 2025 */}
      <Num t={t} a={toH} fps={fps} x={540} y={196} size={84} sub="seats · 2025">6.8 MILLION</Num>
    </Scene>
  );
}

// ---------- the calm last beat: a Cargolux 747 freighter climbing past the camera, footage alone ----------
function SceneR4({t, at, fps, a, b}) {
  return (
    <Scene t={t} a={a}>
      <Clip src="b747-takeoff-pae.mp4" from={1} a={a} b={b} t={t} fps={fps} zoom={[1.03, 1.13]} dark={0.3} />
    </Scene>
  );
}

export const AviRoutes = ({lines = [], words = [], seconds = 34}) => {
  const {fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;
  const at = makeAt(lines);
  const T = (i) => (lines[i] ? lines[i].t0 : seconds);
  const lastBeat = lines[4] ? lines[4].t1 : seconds - 2;
  const scenes = [[0, T(1), SceneR0], [T(1), lastBeat, SceneRMap], [lastBeat, seconds + 1, SceneR4]];
  return (
    <AbsoluteFill style={{background: NAVY}}>
      {scenes.map(([a, b, C], i) => (t >= a && t < b + XF ? <C key={i} t={t} at={at} fps={fps} a={a} b={b} lines={lines} /> : null))}
      <CaptionBand />
      <AbsoluteFill style={{background: NAVY, opacity: interpolate(t, [seconds - 0.4, seconds], [0, 1], CL), pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

// =====================================================================================================================
// SAMPLE 3: ALTITUDE (6 lines, ~35.4 s)
// =====================================================================================================================
const LY = (h) => 1100 - h * 45;   // the altitude ladder: 0 km at y 1100, 20 km at y 200
// an arrow with its head at the far end; dir 'left' or 'up'; len in px
const Arrow = ({x, y, len, dir = 'left', color = RED, k = 1, w = 10}) => {
  if (k <= 0 || len <= 0) return null;
  const ex = dir === 'left' ? x - len : x, ey = dir === 'up' ? y - len : y;
  const rot = dir === 'left' ? -Math.PI / 2 : 0;
  return (
    <g opacity={k}>
      <line x1={x} y1={y} x2={ex} y2={ey} stroke={color} strokeWidth={w} strokeLinecap="round" />
      <polygon points={polyPts(ex, ey, w * 2.2, 3, rot - Math.PI / 2)} fill={color} />
    </g>
  );
};
// the sky ladder with the air thinning upward, Everest and Concorde for scale, the plane at height h (km) with optional drag / lift arrows
function Ladder({t, fps, a, h, tilt = 0, drag = 0, dragK = 0, lift = 0, liftK = 0, everestAt, concordeAt}) {
  const y = LY(h) + Math.sin(t * 2) * 4;
  const px = 640;
  const kE = everestAt === undefined ? 0 : pop(t, everestAt, fps, soft);
  const kC = concordeAt === undefined ? 0 : ease(t, concordeAt, 0.6);
  const dots = [];
  for (let i = 0; i < 300; i++) {
    const dy = 200 + rnd(i) * 900, hgt = (1100 - dy) / 45;
    if (rnd(i + 500) > Math.exp(-hgt / 7)) continue;
    dots.push(<circle key={i} cx={420 + rnd(i + 900) * 620 + Math.sin(t * 1.3 + i) * 5} cy={dy + Math.cos(t * 1.1 + i * 0.7) * 4} r={4.5} fill={WHITE} opacity={0.42} />);
  }
  return (
    <g>
      {/* sea */}
      <rect x={0} y={1100} width={W} height={90} fill={SEA} />
      <path d={`M0,1100 ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `q 54 ${-7 * Math.sin(t * 3 + i)} 108 0`).join(' ')}`} stroke={SKY} strokeWidth={4} fill="none" opacity={0.6} />
      {/* ladder */}
      <line x1={150} y1={200} x2={150} y2={1100} stroke={WHITE} strokeWidth={4} opacity={0.5} />
      {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((k) => (
        <g key={k}>
          <line x1={150} y1={LY(k)} x2={k % 10 === 0 ? 186 : 170} y2={LY(k)} stroke={WHITE} strokeWidth={4} opacity={0.6} />
          {k % 5 === 0 ? <Lbl x={132} y={LY(k) + 8} anchor="end" size={22} o={0.85}>{k} km</Lbl> : null}
        </g>
      ))}
      {/* air molecules, thinning with height */}
      {dots}
      {/* Everest for scale (on the right, clear of the drag arrows behind the plane) */}
      <g transform={`translate(900, 1100) scale(1, ${kE}) translate(-900, -1100)`} opacity={kE}>
        <polygon points={`770,1100 900,${LY(8.85)} 1030,1100`} fill={LAND2} />
        <polygon points={`866,${LY(8.85) + 70} 900,${LY(8.85)} 934,${LY(8.85) + 70} 920,${LY(8.85) + 60} 908,${LY(8.85) + 76} 892,${LY(8.85) + 62} 880,${LY(8.85) + 74}`} fill={WHITE} opacity={0.9} />
      </g>
      {kE > 0 ? <Lbl x={900} y={LY(8.85) - 22} size={20} o={kE}>EVEREST 8.8 km</Lbl> : null}
      {/* Concorde for scale */}
      <g opacity={kC * 0.6}>
        <line x1={420} y1={LY(18)} x2={1040} y2={LY(18)} stroke={WHITE} strokeWidth={3} strokeDasharray="12 14" />
        <PlaneSide x={960} y={LY(18) - 2} s={0.8} />
        <Lbl x={430} y={LY(18) - 14} anchor="start" size={20}>CONCORDE ~18 km</Lbl>
      </g>
      {/* the airliner */}
      <line x1={px - 150} y1={y + 4} x2={px - 420} y2={y + 10} stroke={WHITE} strokeWidth={10} strokeLinecap="round" opacity={0.18} />
      <PlaneSide x={px} y={y} s={2.2} rot={-tilt} />
      {/* drag: backward arrows behind the plane */}
      {dragK > 0 ? (
        <g>
          <Arrow x={px - 140} y={y - 26} len={60 + 140 * drag} dir="left" color={RED} k={dragK} />
          <Arrow x={px - 140} y={y + 30} len={60 + 140 * drag} dir="left" color={RED} k={dragK} />
          <Lbl x={px - 140 - (60 + 140 * drag) / 2} y={y + 80} size={22} color={RED} o={dragK}>DRAG</Lbl>
        </g>
      ) : null}
      {/* lift: upward arrows from the wing */}
      {liftK > 0 ? (
        <g>
          <Arrow x={px - 20} y={y - 36} len={50 + 130 * lift} dir="up" color={AMBER} k={liftK} />
          <Arrow x={px + 60} y={y - 36} len={50 + 130 * lift} dir="up" color={AMBER} k={liftK} />
          <Lbl x={px + 20} y={y - 36 - (50 + 130 * lift) - 18} size={22} color={AMBER} o={liftK}>LIFT</Lbl>
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
      <Clip src="takeoff-oak.mp4" from={88} a={a} b={b} t={t} fps={fps} zoom={[1.04, 1.14]} dark={0.3} />
      <Num t={t} a={ten} fps={fps} x={540} y={470} size={150} color={AMBER}>10 km</Num>
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {[0, 1, 2].map((i) => {
          const ph = ((t - ten) * 0.8 + i * 0.33) % 1;
          return t >= ten ? <path key={i} d={`M490,${440 - ph * 120} L540,${400 - ph * 120} L590,${440 - ph * 120}`} stroke={AMBER} strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={k * (1 - ph) * 0.9} /> : null;
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
        <g transform={`translate(540, 650) scale(${cam}) translate(-540, -650)`}>
          <Ladder t={t} fps={fps} a={a} h={h} tilt={8 * (1 - ease(t, a + 0.9, 0.6))} everestAt={a + 0.5} concordeAt={a + 0.9} drag={drag} dragK={ease(t, thinner, 0.35)} />
          {/* density pill near the plane, and the sea-level reference */}
          <SvgPill t={t} fps={fps} a={third} x={640} y={yPlane - 120} w={290} size={22}>~1/3 AIR DENSITY</SvgPill>
          <SvgPill t={t} fps={fps} a={sea} x={640} y={1060} w={200} size={22} bg={WHITE}>SEA LEVEL</SvgPill>
          {/* fuel burn bar */}
          <g transform={`translate(300, 1000) scale(${kFuel})`} opacity={kFuel}>
            <rect x={-30} y={-28} width={44} height={56} rx={8} fill={WHITE} />
            <rect x={-22} y={-20} width={28} height={18} rx={3} fill={NAVY} />
            <path d="M14,-12 q 18 0 18 18 L32,10 q 0 10 -8 10" stroke={WHITE} strokeWidth={6} fill="none" strokeLinecap="round" />
            <rect x={48} y={-14} width={260} height={28} rx={14} fill={WHITE} opacity={0.18} />
            <rect x={48} y={-14} width={260 * fuel} height={28} rx={14} fill={AMBER} />
            <Lbl x={48} y={-30} anchor="start" size={20} o={0.9}>FUEL BURN</Lbl>
          </g>
        </g>
      </svg>
    </Scene>
  );
}

// a jet engine seen from the front: nacelle lip, spinning fan with blades, spinner; cold air (blue streaks) drawn into it. local: centre (0,0), r ~120
function Engine({t, k, cold}) {
  if (k <= 0) return null;
  const blades = Array.from({length: 18}, (_, i) => (
    <path key={i} d="M0,-14 C-14,-40 -16,-70 -8,-92 C-2,-96 4,-96 8,-90 C12,-70 10,-40 0,-14 Z" fill="#B7C5DA" opacity={0.9} transform={`rotate(${i * 20}) skewX(14)`} />
  ));
  return (
    <g transform={`scale(${k})`} opacity={Math.min(1, k)}>
      {/* cold air streaks curving into the intake */}
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

// ---------- line 2: -50 °C. real climb over Dubai from the window; on a soft dark scrim, a thermometer drains to -54 °C on "minus fifty";
// a jet engine (front fan) pops on "jet" and breathes in blue cold air on "cold" ----------
function SceneA2({t, at, fps, a, b}) {
  const minus = at(2, 'minus'), jet = at(2, 'jet'), cold = at(2, 'cold');
  const v = lerp(15, -54, ease(t, minus, 1.1, Easing.inOut(Easing.cubic)));
  const ty = (val) => 300 + ((20 - val) / 80) * 560;
  const col = v > 0 ? RED : SKY;
  const kTh = pop(t, a + 0.2, fps, soft);
  const kEng = pop(t, jet, fps, bouncy);
  const kCold = ease(t, cold, 0.4);
  return (
    <Scene t={t} a={a}>
      <Clip src="a380-dubai.mp4" from={104} a={a} b={b} t={t} fps={fps} zoom={[1.04, 1.14]} dark={0.3} fy={45} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {/* soft scrims so the drawings read over the footage */}
        <rect x={480} y={240} width={560} height={740} rx={40} fill={NAVY} opacity={0.55 * kTh} />
        <rect x={40} y={760} width={560} height={420} rx={40} fill={NAVY} opacity={0.55 * Math.min(1, kEng)} />
        <g transform={`translate(940, 600) scale(${kTh}) translate(-940, -600)`} opacity={kTh}>
          <rect x={916} y={286} width={48} height={620} rx={24} fill="rgba(11,27,51,0.55)" stroke={WHITE} strokeWidth={4} />
          <rect x={928} y={ty(v)} width={24} height={900 - ty(v)} rx={12} fill={col} />
          <circle cx={940} cy={900} r={46} fill={col} stroke={WHITE} strokeWidth={4} />
          {[20, 0, -20, -40, -60].map((val) => (
            <g key={val}>
              <line x1={896} y1={ty(val)} x2={912} y2={ty(val)} stroke={WHITE} strokeWidth={3} opacity={0.8} />
              <Lbl x={886} y={ty(val) + 7} anchor="end" size={20} o={0.8}>{val > 0 ? `+${val}` : val}</Lbl>
            </g>
          ))}
          {v < -40 ? [0, 1, 2, 3, 4].map((i) => {
            const ph = ((t * 0.7 + rnd(i + 70)) % 1);
            const ang = rnd(i + 71) * 6.28;
            return <polygon key={i} points={polyPts(940 + Math.cos(ang) * (60 + ph * 70), 900 + Math.sin(ang) * (60 + ph * 70), 10 * Math.sin(ph * Math.PI), 6)} fill={WHITE} opacity={0.9} />;
          }) : null}
        </g>
        <g transform="translate(380, 970)">
          <Engine t={t} k={kEng} cold={kCold} />
        </g>
      </svg>
      <Num t={t} a={minus} fps={fps} x={860} y={540} size={110} color={v > 0 ? WHITE : SKY} align="right">{Math.round(v)} °C</Num>
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
        <g transform={`translate(540, 650) scale(${cam}) translate(-540, -650)`}>
          <Ladder t={t} fps={fps} a={a} h={h} tilt={6 * up * (1 - sag) + 10 * sag + Math.sin(t * 9) * 2 * sag} everestAt={a - 1} concordeAt={a - 1} lift={lift} liftK={ease(t, gives, 0.35)} />
        </g>
      </svg>
    </Scene>
  );
}

// ---------- lines 4-5: the flight envelope. a speed/altitude chart: the airliner sits at 10 km with room on both sides; on "too high" a
// ghost plane climbs towards the corner; the STALL SPEED line (leaning right) draws from the bottom on "the speed at which the wing
// stalls rises"; the MAX SPEED line (leaning left) draws to meet it on "to meet the plane's top speed"; the amber envelope between
// them narrows to a point = COFFIN CORNER (~14.5 km) on "coffin corner". Line 5: the ghost fades on "ten", a tick on the 10 km plane
// on "sweet", the "10 km" pill on "spot", then a calm last beat with a slow push ----------
function SceneA4({t, at, fps, a, b}) {
  const too = at(4, 'too'), speed = at(4, 'speed'), stalls = at(4, 'stalls'), meet = at(4, 'meet'), top = at(4, 'top'), coffin = at(4, 'coffin');
  const ten = at(5, 'ten'), sweet = at(5, 'sweet'), spot = at(5, 'spot');
  const cy = (h) => 1080 - h * 44, xs = (h) => 290 + 24 * h, xt = (h) => 920 - 19.45 * h;
  const HM = (920 - 290) / (24 + 19.45), XM = xs(HM), YM = cy(HM);
  const mid = (h) => (xs(h) + xt(h)) / 2;
  const axes = ease(t, a, 0.6);
  const pS = ease(t, speed, 1.9, Easing.inOut(Easing.quad)), pT = ease(t, meet, 1.3, Easing.inOut(Easing.quad));
  const kCC = pop(t, coffin, fps, bouncy);
  // the ghost: climbs from 10 km to the corner on "too high", shivers there, fades on "ten"
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
            <line x1={200} y1={1080} x2={200 + 780 * axes} y2={1080} stroke={WHITE} strokeWidth={4} opacity={0.6} />
            <line x1={200} y1={1080} x2={200} y2={1080 - 840 * axes} stroke={WHITE} strokeWidth={4} opacity={0.6} />
            <polygon points={polyPts(985, 1080, 14, 3, 0)} fill={WHITE} opacity={0.6} />
            <polygon points={polyPts(200, 235, 14, 3, -Math.PI / 2)} fill={WHITE} opacity={0.6} />
            {[0, 5, 10, 15].map((k) => (
              <g key={k}>
                <line x1={186} y1={cy(k)} x2={214} y2={cy(k)} stroke={WHITE} strokeWidth={4} opacity={0.6} />
                <Lbl x={172} y={cy(k) + 8} anchor="end" size={22} o={0.85}>{k} km</Lbl>
              </g>
            ))}
            <Lbl x={980} y={1124} anchor="end" size={20} o={0.7}>SPEED</Lbl>
            <Lbl x={200} y={206} size={20} o={0.7}>ALTITUDE</Lbl>
            <line x1={214} y1={cy(10)} x2={980} y2={cy(10)} stroke={WHITE} strokeWidth={2} strokeDasharray="8 12" opacity={0.25} />
          </g>
          {/* the envelope between the two lines */}
          {band ? <path d={band} fill={AMBER} opacity={0.14} /> : null}
          <path d={stallD} stroke={RED} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - pS} opacity={pS > 0 ? 1 : 0} />
          <path d={topD} stroke={SKY} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - pT} opacity={pT > 0 ? 1 : 0} />
          {t >= stalls ? <Lbl x={xs(1.5) + 18} y={cy(1.5) - 10} anchor="start" size={22} color={RED} o={ease(t, stalls, 0.3)}>STALL SPEED</Lbl> : null}
          {t >= top ? <Lbl x={xt(1.5) - 18} y={cy(1.5) - 10} anchor="end" size={22} color={SKY} o={ease(t, top, 0.3)}>MAX SPEED</Lbl> : null}
          {/* the ghost climbing into the corner */}
          {ghostO > 0 ? <PlaneSide x={mid(hg) + shake} y={cy(hg)} s={1.1} color={SKY} accent={SKY} o={ghostO} rot={-8 * climb * (1 - climb) * 4} /> : null}
          {/* the airliner at 10 km, inside the envelope */}
          <PlaneSide x={mid(10)} y={yP} s={1.1} />
          {/* the coffin corner */}
          <g transform={`translate(${XM}, ${YM})`}>
            {t >= coffin ? [0, 1].map((i) => {
              const ph = ((t - coffin) * 0.9 + i * 0.5) % 1;
              return <circle key={i} r={30 + ph * 90} fill="none" stroke={RED} strokeWidth={6 * (1 - ph)} opacity={(1 - ph) * 0.8} />;
            }) : null}
            <circle r={24 * kCC} fill={RED} stroke={WHITE} strokeWidth={5} opacity={Math.min(1, kCC)} />
          </g>
          {kCC > 0 ? <Lbl x={XM} y={YM - 52} size={26} color={RED} o={Math.min(1, kCC)}>COFFIN CORNER</Lbl> : null}
          {/* line 5: the sweet spot */}
          <Tick x={mid(10)} y={yP - 110} k={pop(t, sweet, fps, bouncy)} r={50} />
          <SvgPill t={t} fps={fps} a={spot} x={mid(10)} y={yP + 92} w={150} size={24}>10 km</SvgPill>
        </g>
      </svg>
    </Scene>
  );
}

export const AviAltitude = ({lines = [], words = [], seconds = 36}) => {
  const {fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;
  const at = makeAt(lines);
  const T = (i) => (lines[i] ? lines[i].t0 : seconds);
  const scenes = [[0, T(1), SceneA0], [T(1), T(2), SceneA1], [T(2), T(3), SceneA2], [T(3), T(4), SceneA3], [T(4), seconds + 1, SceneA4]];
  return (
    <AbsoluteFill style={{background: NAVY}}>
      {scenes.map(([a, b, C], i) => (t >= a && t < b + XF ? <C key={i} t={t} at={at} fps={fps} a={a} b={b} lines={lines} /> : null))}
      <CaptionBand />
      <AbsoluteFill style={{background: NAVY, opacity: interpolate(t, [seconds - 0.4, seconds], [0, 1], CL), pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};
