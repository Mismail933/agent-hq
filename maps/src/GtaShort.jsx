// GtaShort.jsx: Bassel's GTA VI Short (2026-11-24, his GO 2026-11-21: "why it took so long", a YouTube Short, under 3 minutes,
// no copyright claims). Written by Ocean (Opus). NO Rockstar footage, artwork, logos, fonts or music: Rockstar's policy allows its
// material only for non-commercial use, so everything here is our own animation of the real, sourced numbers (Take-Two press
// releases, Guinness, Bloomberg, court reports). A Vice-City-at-sunset look (synthwave sky, palms, neon) that is ours, not theirs.
// 1080x1920, 30 fps, plays under the narration; things arrive on the spoken words (at(line, 'word')). Captions are drawn by another
// layer at y 1180-1440: scenes keep that band empty; top 0-120 and the right edge from 45-85% of the height stay clear of key items.
// Every frame is a pure function of the frame number.
import React from 'react';
import {AbsoluteFill, interpolate, spring, Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import {geoMercator, geoPath} from 'd3-geo';
import geo from './geo.json';

const W = 1080, H = 1920;
const NIGHT = '#120624', PURPLE = '#2B0F45', PINK = '#FF4FA3', TEAL = '#2DE2E6', ORANGE = '#FF9E3D', YELLOW = '#FFD23F';
const WHITE = '#FFFFFF', GREEN = '#58E07A', RED = '#FF4D5E', INK = '#0D0318';
const BIG = "'Archivo Black', sans-serif", SMALL = "'Montserrat', sans-serif";
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
const XF = 6 / 30;

const lerp = (a, b, p) => a + (b - a) * p;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (t, a, d = 0.4, e = Easing.out(Easing.cubic)) => interpolate(t, [a, a + d], [0, 1], {...CL, easing: e});
const rnd = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const pop = (t, a, fps, cfg) => (t < a ? 0 : spring({frame: Math.round((t - a) * fps), fps, config: cfg || {damping: 12, stiffness: 170, mass: 0.7}}));
const heavy = {damping: 14, stiffness: 120, mass: 1.1};
const snap = {damping: 18, stiffness: 260, mass: 0.5};
const cleanW = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, '');
const makeAt = (lines) => (li, word, nth = 0) => {
  const L = lines[li];
  if (!L) return 0;
  const target = cleanW(word);
  let k = 0;
  for (const w of L.words) { if (cleanW(w[0]).startsWith(target)) { if (k === nth) return w[1]; k++; } }
  return L.t0;
};

// ---------- the world: a synthwave sunset over the sea, palms, a moving grid ----------
function Sky({t, mood = 'sunset'}) {
  const top = mood === 'night' ? '#05010D' : NIGHT, mid = mood === 'night' ? '#1B0838' : '#4A1270', low = mood === 'night' ? '#3A0F5C' : '#C2306E';
  const sunY = 1150 + 4 * Math.sin(t * 0.6);
  return (
    <svg width={W} height={H} style={{position: 'absolute'}}>
      <defs>
        <linearGradient id="gsky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} /><stop offset="0.45" stopColor={mid} /><stop offset="0.62" stopColor={low} /><stop offset="0.64" stopColor="#2A0B40" /><stop offset="1" stopColor={INK} />
        </linearGradient>
        <linearGradient id="gsun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={YELLOW} /><stop offset="1" stopColor={PINK} /></linearGradient>
        <clipPath id="gsunc"><rect x="0" y="0" width={W} height="1228" /></clipPath>
      </defs>
      <rect width={W} height={H} fill="url(#gsky)" />
      {Array.from({length: 60}, (_, i) => <circle key={i} cx={rnd(i) * W} cy={rnd(i + 99) * 700} r={1 + rnd(i + 7) * 2} fill={WHITE} opacity={(mood === 'night' ? 0.7 : 0.35) * (0.5 + 0.5 * Math.sin(t * 2 + i))} />)}
      {mood !== 'night' ? (
        <g clipPath="url(#gsunc)" opacity={0.95}>
          <circle cx={540} cy={sunY} r={190} fill="url(#gsun)" opacity={0.9} />
          {[0, 1, 2].map((i) => <rect key={i} x={340} y={sunY + 20 + i * 22} width={400} height={5 + i * 3} fill="#5A1660" />)}
        </g>
      ) : null}
      <rect x={0} y={1228} width={W} height={H - 1228} fill="#1A0630" />
      {Array.from({length: 14}, (_, i) => { const y = 1228 + Math.pow((i + ((t * 0.8) % 1)) / 14, 2) * 692; return <line key={'h' + i} x1={0} y1={y} x2={W} y2={y} stroke={PINK} strokeOpacity={0.35} strokeWidth={2} />; })}
      {Array.from({length: 19}, (_, i) => { const x = (i - 9) * 140; return <line key={'v' + i} x1={540 + x * 0.15} y1={1228} x2={540 + x * 2.2} y2={H} stroke={PINK} strokeOpacity={0.3} strokeWidth={2} />; })}
      <Palm x={70} y={1240} s={1.15} t={t} />
      <Palm x={1010} y={1250} s={1.0} t={t + 1.3} flip />
    </svg>
  );
}
const Palm = ({x, y, s = 1, t = 0, flip = false}) => {
  const sway = 2.5 * Math.sin(t * 0.9);
  return (
    <g transform={`translate(${x}, ${y}) scale(${flip ? -s : s}, ${s}) rotate(${sway})`} fill={INK}>
      <path d="M-8,0 C-4,-120 10,-260 30,-380 L42,-378 C24,-260 12,-120 10,0 Z" />
      {[-150, -110, -60, -20, 25, 70].map((a, i) => (
        <path key={i} transform={`translate(36,-380) rotate(${a})`} d="M0,0 C40,-14 110,-10 160,28 C112,8 50,8 0,10 Z" />
      ))}
    </g>
  );
};

// a scene: fades in, and the camera always drifts a little
function Scene({t, a, b, children, drift = 0.035}) {
  const o = a <= 0 ? 1 : ease(t, a, XF, Easing.inOut(Easing.quad));
  const k = 1 + drift * clamp01((t - a) / Math.max(1, b - a));
  return <AbsoluteFill style={{opacity: o, transform: `scale(${k})`, transformOrigin: '50% 40%'}}>{children}</AbsoluteFill>;
}
// big neon text block (HTML, centred)
function Big({t, a, fps, y, children, size = 120, color = WHITE, glow = PINK, until, cfg = heavy}) {
  const k = pop(t, a, fps, cfg) * (until !== undefined ? 1 - ease(t, until, 0.3) : 1);
  if (k <= 0.001) return null;
  return (
    <div style={{position: 'absolute', left: 40, right: 40, top: y, textAlign: 'center', fontFamily: BIG, fontSize: size, lineHeight: 1.02, color,
      transform: `scale(${0.6 + 0.4 * k})`, opacity: Math.min(1, k * 1.4), WebkitTextStroke: `${Math.max(4, size / 22)}px ${INK}`, paintOrder: 'stroke fill',
      textShadow: `0 0 26px ${glow}, 0 0 60px ${glow}88`}}>{children}</div>
  );
}
function Pill({t, a, fps, x = 540, y, children, bg = TEAL, fg = INK, size = 34, until}) {
  const k = pop(t, a, fps, snap) * (until !== undefined ? 1 - ease(t, until, 0.25) : 1);
  if (k <= 0.001) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${0.5 + 0.5 * k})`, opacity: Math.min(1, k * 1.5), background: bg, color: fg,
      fontFamily: BIG, fontSize: size, padding: '10px 26px', borderRadius: 14, whiteSpace: 'nowrap', boxShadow: `0 0 24px ${bg}99`}}>{children}</div>
  );
}
// a number that counts on its word
function Count({t, a, d = 1.4, from = 0, to, x = 540, y, size = 150, color = YELLOW, pre = '', post = '', fmtFn = fmt, fps, glow = ORANGE}) {
  const p = ease(t, a, d, Easing.out(Easing.cubic));
  const k = pop(t, a, fps, heavy);
  if (k <= 0.001) return null;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center', fontFamily: BIG, fontSize: size, color, transform: `scale(${0.7 + 0.3 * k})`,
      WebkitTextStroke: `${size / 20}px ${INK}`, paintOrder: 'stroke fill', textShadow: `0 0 30px ${glow}, 0 0 70px ${glow}77`}}>{pre}{fmtFn(lerp(from, to, p))}{post}</div>
  );
}

// ---------- props, drawn ----------
const Bill = ({x, y, r = 0, s = 1, o = 1}) => (
  <g transform={`translate(${x}, ${y}) rotate(${r}) scale(${s})`} opacity={o}>
    <rect x={-60} y={-28} width={120} height={56} rx={6} fill="#3FAE5A" stroke="#1E6B33" strokeWidth={4} />
    <circle cx={0} cy={0} r={17} fill="#2E8C47" /><text x={0} y={9} textAnchor="middle" fontFamily={BIG} fontSize={26} fill="#CFF5D6">$</text>
  </g>
);
const Calendar = ({x, y, s = 1, top = 'DAY', num = '1', topFill = RED}) => (
  <g transform={`translate(${x}, ${y}) scale(${s})`}>
    <rect x={-110} y={-120} width={220} height={240} rx={22} fill={WHITE} />
    <rect x={-110} y={-120} width={220} height={70} rx={22} fill={topFill} /><rect x={-110} y={-70} width={220} height={20} fill={topFill} />
    <text x={0} y={-72} textAnchor="middle" fontFamily={BIG} fontSize={36} fill={WHITE}>{top}</text>
    <text x={0} y={70} textAnchor="middle" fontFamily={BIG} fontSize={num.length > 3 ? 74 : 110} fill={INK}>{num}</text>
  </g>
);
const GameCase = ({x, y, s = 1, label = 'GTA V', sub = '', color = '#1E7FD8'}) => (
  <g transform={`translate(${x}, ${y}) scale(${s})`}>
    <rect x={-80} y={-105} width={160} height={210} rx={10} fill={color} stroke={WHITE} strokeWidth={5} />
    <rect x={-66} y={-60} width={132} height={110} rx={6} fill="#0B0F1E" />
    <circle cx={30} cy={-5} r={34} fill={ORANGE} /><rect x={-60} y={10} width={120} height={36} fill="#26102F" />
    <text x={0} y={-74} textAnchor="middle" fontFamily={BIG} fontSize={26} fill={WHITE}>{label}</text>
    <text x={0} y={86} textAnchor="middle" fontFamily={SMALL} fontWeight={900} fontSize={22} fill={WHITE}>{sub}</text>
  </g>
);
const Person = ({x, y, s = 1, fill = TEAL, o = 1}) => (
  <g transform={`translate(${x}, ${y}) scale(${s})`} opacity={o} fill={fill}>
    <circle cx={0} cy={-34} r={14} /><path d="M-20,0 C-20,-22 20,-22 20,0 Z" />
  </g>
);
const PinIcon = ({x, y, s = 1, fill = PINK}) => (
  <g transform={`translate(${x}, ${y}) scale(${s})`}><path d="M0,0 C-22,-30 -22,-58 0,-58 C22,-58 22,-30 0,0 Z" fill={fill} stroke={INK} strokeWidth={4} /><circle cx={0} cy={-38} r={8} fill={INK} /></g>
);

// ---------- map (Natural Earth, public domain) ----------
const AMERICAS = new Set(['USA', 'CAN', 'MEX', 'GTM', 'BLZ', 'HND', 'SLV', 'NIC', 'CRI', 'PAN', 'COL', 'VEN', 'GUY', 'SUR', 'GUF', 'ECU', 'PER', 'BRA', 'BOL', 'PRY', 'CHL', 'ARG', 'URY', 'CUB', 'HTI', 'DOM', 'JAM', 'BHS', 'PRI', 'GRL']);
const WORLD = geo.world.features;
const AM = WORLD.filter((f) => AMERICAS.has(f.properties.a3));
const USA = WORLD.filter((f) => f.properties.a3 === 'USA');
const MAPBOX = [[60, 170], [1020, 1150]];
const viewOf = (b) => geoMercator().fitExtent(MAPBOX, {type: 'MultiPoint', coordinates: [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]});
const V_AM = [-130, -50, -30, 58], V_FL = [-89, 23.5, -78.5, 31.5];
const camera = (k) => {
  const A = viewOf(V_AM), B = viewOf(V_FL);
  const ca = A.invert([540, 660]), cb = B.invert([540, 660]);
  return geoMercator().scale(Math.exp(lerp(Math.log(A.scale()), Math.log(B.scale()), k))).center([lerp(ca[0], cb[0], k), lerp(ca[1], cb[1], k)]).translate([540, 660]);
};

// ======================= the scenes (one per narration line) =======================
// 0: $3.79 BILLION on day one, bills raining
function S0({t, at, fps, a, b}) {
  const made = at(0, 'made'), bil = at(0, 'billion'), first = at(0, 'first');
  return (
    <Scene t={t} a={a} b={b}>
      <Sky t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {Array.from({length: 26}, (_, i) => { const st = made + rnd(i) * 1.6; if (t < st) return null; const y = -80 + (t - st) * (420 + rnd(i + 3) * 260); return y > 1150 ? null : <Bill key={i} x={60 + rnd(i + 5) * 960} y={y} r={(t - st) * (60 + rnd(i) * 120) * (i % 2 ? 1 : -1)} s={0.8 + rnd(i + 9) * 0.5} />; })}
      </svg>
      <Count t={t} a={0} d={0.9} from={0} to={3.79} pre="$" post="B" fmtFn={(v) => v.toFixed(2)} y={330} size={210} fps={fps} />
      <Big t={t} a={0} fps={fps} y={170} size={110} color={WHITE} glow={PINK}>GTA VI</Big>
      <Pill t={t} a={first} fps={fps} y={640} bg={PINK} fg={WHITE} size={46}>IN ONE DAY</Pill>
      <Pill t={t} a={first + 0.5} fps={fps} y={730} bg={INK} fg={TEAL} size={24}>19 NOV 2026 · TAKE-TWO FIGURE</Pill>
    </Scene>
  );
}
// 1: 4,811 days, the calendar flips
function S1({t, at, fps, a, b}) {
  const four = at(1, 'four'), days = at(1, 'days');
  const p = ease(t, four, Math.max(1, days - four + 0.2), Easing.inOut(Easing.cubic));
  const n = Math.round(lerp(1, 4811, p));
  const flip = (t * 6) % 1;
  return (
    <Scene t={t} a={a} b={b}>
      <Sky t={t} mood="night" />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(540, 560) scale(${1.6 + 0.08 * Math.sin(t * 3)})`}><Calendar x={0} y={0} num={fmt(n)} top="DAYS" /></g>
        {p > 0 && p < 1 ? <g transform={`translate(540, ${560 - 120 * 1.6}) scale(1.6, ${1.6 * (1 - flip)})`} opacity={0.7}><rect x={-110} y={0} width={220} height={120} rx={22} fill={WHITE} /></g> : null}
      </svg>
      <Pill t={t} a={four} fps={fps} y={290} bg={TEAL} size={38}>17 SEP 2013</Pill>
      <Pill t={t} a={days} fps={fps} y={880} bg={PINK} fg={WHITE} size={38}>19 NOV 2026</Pill>
      <Pill t={t} a={days + 0.2} fps={fps} y={980} bg={INK} fg={YELLOW} size={30}>GTA V → GTA VI</Pill>
    </Scene>
  );
}
// 2: 13 YEARS? slams in on a timeline
function S2({t, at, fps, a, b}) {
  const th = at(2, 'thirteen');
  const shake = t > th && t < th + 0.35 ? Math.sin(t * 80) * 10 * (1 - (t - th) / 0.35) : 0;
  return (
    <Scene t={t} a={a} b={b}>
      <Sky t={t} />
      <div style={{position: 'absolute', inset: 0, transform: `translate(${shake}px, ${shake / 2}px)`}}>
        <Big t={t} a={th} fps={fps} y={360} size={210} color={YELLOW} glow={ORANGE} cfg={snap}>13</Big>
        <Big t={t} a={th + 0.12} fps={fps} y={590} size={110} color={WHITE} glow={PINK}>YEARS?</Big>
      </div>
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <line x1={120} y1={900} x2={120 + 840 * ease(t, a, 1.2)} y2={900} stroke={TEAL} strokeWidth={10} strokeLinecap="round" />
        {[2013, 2018, 2022, 2026].map((y, i) => { const x = 120 + 840 * (y - 2013) / 13; const k = ease(t, a + 0.2 + i * 0.25, 0.3); return <g key={y} opacity={k}><circle cx={x} cy={900} r={16} fill={i === 3 ? PINK : WHITE} /><text x={x} y={970} textAnchor="middle" fontFamily={BIG} fontSize={34} fill={WHITE}>{y}</text></g>; })}
      </svg>
    </Scene>
  );
}
// 3-4: GTA V kept selling: three console generations, 235 million copies
function S3({t, at, fps, a, b}) {
  const stop = at(3, 'stop'), bil = at(4, 'billion'), three = at(4, 'three'), copies = at(4, 'copies'), gens = at(4, 'generations');
  const gensK = [gens, gens + 0.35, gens + 0.7];
  return (
    <Scene t={t} a={a} b={b}>
      <Sky t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {[['2013', 'PS3 · 360', '#1E7FD8'], ['2014', 'PS4 · ONE', '#7A3FD8'], ['2022', 'PS5 · SERIES', '#D83F8C']].map(([yr, sub, c], i) => {
          const k = pop(t, i === 0 ? a : gensK[i - 1] , fps, heavy);
          const x = 200 + i * 340, y = 820 - 24 * Math.sin(t * 2 + i);
          return k > 0.001 ? <g key={yr} opacity={Math.min(1, k * 1.4)} transform={`translate(${x}, ${y}) scale(${0.5 + 0.5 * k}) translate(${-x}, ${-y})`}><GameCase x={x} y={y} s={1.75} label="GTA V" sub={sub} color={c} /><text x={x} y={y + 240} textAnchor="middle" fontFamily={BIG} fontSize={40} fill={YELLOW}>{yr}</text></g> : null;
        })}
        {t > stop ? Array.from({length: 18}, (_, i) => { const st = stop + i * 0.12; if (t < st) return null; const y = 1140 - (t - st) * 300; return y < 980 ? null : <Bill key={i} x={120 + rnd(i) * 840} y={y} r={rnd(i + 1) * 40 - 20} s={0.7} o={clamp01((y - 980) / 80)} />; }) : null}
      </svg>
      <Count t={t} a={bil} d={0.9} from={0} to={1} pre="$" post="B" fmtFn={(v) => v.toFixed(1)} y={190} size={130} fps={fps} />
      <Pill t={t} a={three} fps={fps} y={400} bg={PINK} fg={WHITE} size={38} until={copies - 0.2}>IN 3 DAYS · 2013</Pill>
      <Count t={t} a={copies - 0.6} d={1.3} from={0} to={235} post="M" y={360} size={130} color={TEAL} glow={TEAL} fps={fps} />
      <Pill t={t} a={copies} fps={fps} y={540} bg={INK} fg={WHITE} size={30}>COPIES SOLD (NEARLY)</Pill>
    </Scene>
  );
}
// 5: GTA Online, a money machine
function S5({t, at, fps, a, b}) {
  const online = at(5, 'online'), half = at(5, 'half'), year = at(5, 'year');
  const run = t > online ? (t - online) : 0;
  return (
    <Scene t={t} a={a} b={b}>
      <Sky t={t} mood="night" />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform={`translate(540, ${700 + 6 * Math.sin(t * 14) * (run > 0 ? 1 : 0)}) scale(1.35)`}>
          <rect x={-250} y={-200} width={500} height={330} rx={30} fill="#3B1460" stroke={TEAL} strokeWidth={8} />
          <rect x={-190} y={-150} width={380} height={120} rx={14} fill={INK} />
          <text x={0} y={-72} textAnchor="middle" fontFamily={BIG} fontSize={54} fill={GREEN}>ONLINE</text>
          {[0, 1, 2].map((i) => <circle key={i} cx={-120 + i * 120} cy={40} r={26} fill={[PINK, YELLOW, TEAL][i]} opacity={0.5 + 0.5 * Math.sin(t * 8 + i * 2)} />)}
          <rect x={-200} y={120} width={400} height={26} rx={8} fill={INK} />
        </g>
        {run > 0 ? Array.from({length: 22}, (_, i) => { const st = online + i * 0.18; if (t < st) return null; const u = t - st; const y = 846 + u * 380; return y > 1140 ? null : <Bill key={i} x={540 + (rnd(i) - 0.5) * 300 + Math.sin(u * 3 + i) * 40} y={y} r={u * 120 * (i % 2 ? 1 : -1)} s={0.75} />; }) : null}
      </svg>
      <Count t={t} a={half - 0.3} d={1} from={0} to={500} pre="~$" post="M" y={190} size={130} fps={fps} />
      <Pill t={t} a={year} fps={fps} y={380} bg={PINK} fg={WHITE} size={36}>A YEAR · REPORTED ESTIMATE</Pill>
    </Scene>
  );
}
// 6: Red Dead Redemption 2 took every studio
function S6({t, at, fps, a, b}) {
  const red = at(6, 'red'), every = at(6, 'every'), out = at(6, 'came');
  const studios = 10;
  return (
    <Scene t={t} a={a} b={b}>
      <Sky t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {Array.from({length: studios}, (_, i) => {
          const ang = (i / studios) * Math.PI * 2 - Math.PI / 2, r = 330;
          const pull = ease(t, every + i * 0.06, 0.7, Easing.in(Easing.cubic));
          const x = lerp(540 + r * Math.cos(ang), 540, pull), y = lerp(720 + r * Math.sin(ang), 720, pull);
          return <g key={i} opacity={pop(t, a + i * 0.05, fps, snap) * (1 - pull * 0.9)}><rect x={x - 38} y={y - 30} width={76} height={60} rx={6} fill={TEAL} /><rect x={x - 12} y={y} width={24} height={30} fill={INK} /></g>;
        })}
        <g transform={`translate(540, 720) scale(${0.4 + 0.6 * pop(t, red, fps, heavy)})`} opacity={clamp01(pop(t, red, fps, heavy) * 1.5)}>
          <circle r={150} fill="#7A1020" stroke={YELLOW} strokeWidth={8} />
          <path d="M-110,-10 C-110,-60 -60,-70 0,-70 C60,-70 110,-60 110,-10 L150,0 L150,18 L-150,18 L-150,0 Z" fill={INK} />
          <path d="M-60,-70 C-50,-120 50,-120 60,-70 Z" fill={INK} />
          <text y={95} textAnchor="middle" fontFamily={BIG} fontSize={44} fill={WHITE}>RDR2</text>
        </g>
      </svg>
      <Big t={t} a={red} fps={fps} y={200} size={66} color={WHITE} glow={RED}>RED DEAD REDEMPTION 2</Big>
      <Pill t={t} a={out} fps={fps} y={1020} bg={YELLOW} size={44}>2018</Pill>
    </Scene>
  );
}
// 7: planning from 2015, a plane to Miami
function S7({t, at, fps, a, b}) {
  const plan = at(7, 'planning'), y15 = at(7, '2015'), miami = at(7, 'miami');
  const fly = ease(t, y15, Math.max(1, miami - y15 + 0.4), Easing.inOut(Easing.cubic));
  const px = lerp(140, 760, fly), py = lerp(820, 520, fly) - 120 * Math.sin(fly * Math.PI);
  return (
    <Scene t={t} a={a} b={b}>
      <Sky t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <path d={`M140,820 Q450,${420} 760,520`} fill="none" stroke={WHITE} strokeWidth={6} strokeDasharray="18 16" strokeDashoffset={-t * 60} opacity={0.6 * ease(t, y15, 0.4)} />
        <g transform={`translate(${px}, ${py}) rotate(${-25 + 50 * fly}) scale(1.4)`} opacity={ease(t, y15, 0.3)}>
          <path d="M-70,0 L60,-8 C80,-8 90,0 80,6 L-70,10 Z" fill={WHITE} /><path d="M-10,-4 L-40,-60 L-20,-60 L20,-4 Z M-10,6 L-40,60 L-20,60 L20,6 Z" fill={WHITE} /><path d="M-64,0 L-80,-30 L-68,-30 L-52,0 Z" fill={WHITE} />
        </g>
        <g opacity={pop(t, miami, fps, snap)}><PinIcon x={760} y={560} s={2} /></g>
      </svg>
      <Pill t={t} a={plan} fps={fps} y={260} bg={TEAL} size={44}>PLANNING BEGINS</Pill>
      <Big t={t} a={y15} fps={fps} y={330} size={150} color={YELLOW} glow={ORANGE}>2015</Big>
      <Pill t={t} a={miami} fps={fps} x={760} y={650} bg={PINK} fg={WHITE} size={44}>MIAMI</Pill>
    </Scene>
  );
}
// 8: SIGNATURE MOVE: the Americas light up, then the camera dives into Florida = LEONIDA (real geography)
function S8({t, at, fps, a, b}) {
  const north = at(8, 'north'), cut = at(8, 'cut'), one = at(8, 'one'), leo = at(8, 'leonida'), flo = at(8, 'florida');
  const k = ease(t, cut, Math.max(1.2, one - cut + 0.6), Easing.inOut(Easing.cubic));
  const proj = camera(k), path = geoPath(proj);
  const lit = ease(t, north, 1.2);
  const dim = ease(t, cut, 0.8);
  const fl = [[-87.6, 24.4], [-80.0, 31.0]].map((p) => proj(p));
  const miami = proj([-80.19, 25.76]);
  return (
    <Scene t={t} a={a} b={b} drift={0}>
      <AbsoluteFill style={{background: '#08031A'}} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <defs><clipPath id="gfl"><rect x={fl[0][0]} y={fl[1][1]} width={fl[1][0] - fl[0][0]} height={fl[0][1] - fl[1][1]} /></clipPath>
          <filter id="gglow"><feGaussianBlur stdDeviation="8" /></filter></defs>
        <rect x={0} y={0} width={W} height={1170} fill="#0E1640" />
        {WORLD.map((f, i) => <path key={i} d={path(f) || ''} fill="#24214D" stroke="#3A3570" strokeWidth={1} />)}
        {AM.map((f, i) => <path key={'a' + i} d={path(f) || ''} fill={PINK} opacity={lit * (1 - 0.85 * dim)} />)}
        <g clipPath="url(#gfl)" opacity={ease(t, cut + 0.3, 0.6)}>
          {USA.map((f, i) => <path key={'g' + i} d={path(f) || ''} fill={PINK} filter="url(#gglow)" />)}
          {USA.map((f, i) => <path key={'u' + i} d={path(f) || ''} fill={PINK} stroke={YELLOW} strokeWidth={3} />)}
        </g>
        {t > leo ? <g opacity={pop(t, leo + 0.3, fps, snap)}><circle cx={miami[0]} cy={miami[1]} r={16} fill={YELLOW} stroke={INK} strokeWidth={4} /><circle cx={miami[0]} cy={miami[1]} r={16 + 40 * ((t * 1.2) % 1)} fill="none" stroke={YELLOW} strokeWidth={3} opacity={1 - ((t * 1.2) % 1)} /></g> : null}
        <rect x={0} y={1170} width={W} height={H - 1170} fill="#08031A" />
      </svg>
      <Pill t={t} a={north} fps={fps} y={230} bg={INK} fg={PINK} size={34} until={cut}>NORTH + SOUTH AMERICA?</Pill>
      <Big t={t} a={leo} fps={fps} y={190} size={120} color={WHITE} glow={PINK}>LEONIDA</Big>
      {t > leo ? <Pill t={t} a={leo + 0.3} fps={fps} x={Math.min(820, miami[0])} y={miami[1] + 70} bg={YELLOW} size={30}>VICE CITY</Pill> : null}
      <Pill t={t} a={flo} fps={fps} y={1080} bg={TEAL} size={36}>= FLORIDA</Pill>
    </Scene>
  );
}
// 9: the pandemic: a motion-capture suit freezes
function S9({t, at, fps, a, b}) {
  const pan = at(9, 'pandemic'), halt = at(9, 'halt');
  const frozen = t > halt;
  const ph = frozen ? halt : t;
  const arm = 40 * Math.sin(ph * 5), leg = 25 * Math.sin(ph * 5 + 1);
  const dots = [[0, -230], [-40, -120], [40, -120], [-40 - arm, -40], [40 + arm, -40], [-30, 60], [30, 60], [-30 - leg, 180], [30 + leg, 180]];
  return (
    <Scene t={t} a={a} b={b}>
      <Sky t={t} mood="night" />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g transform="translate(540, 740) scale(2.0)">
          <circle cx={0} cy={-230} r={44} fill="#222" stroke={TEAL} strokeWidth={4} />
          <path d={`M0,-186 L0,60 M-40,-120 L40,-120 M-40,-120 L${-40 - arm},-40 M40,-120 L${40 + arm},-40 M0,60 L${-30 - leg},180 M0,60 L${30 + leg},180`} stroke="#222" strokeWidth={34} strokeLinecap="round" />
          {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={9} fill={frozen ? RED : TEAL} opacity={frozen ? 0.6 + 0.4 * Math.sin(t * 10) : 1} />)}
        </g>
        {Array.from({length: 7}, (_, i) => { const k = pop(t, pan + i * 0.12, fps, snap); const x = 140 + rnd(i) * 800, y = 330 + rnd(i + 4) * 700; return k > 0.01 ? <g key={i} transform={`translate(${x}, ${y}) rotate(${t * 40 + i * 30}) scale(${k})`}><circle r={30} fill={GREEN} opacity={0.85} />{[0, 1, 2, 3, 4, 5].map((j) => <line key={j} x1={0} y1={0} x2={46 * Math.cos(j)} y2={46 * Math.sin(j)} stroke={GREEN} strokeWidth={8} strokeLinecap="round" />)}</g> : null; })}
      </svg>
      <Pill t={t} a={pan} fps={fps} y={240} bg={GREEN} size={44}>2020</Pill>
      <Big t={t} a={halt} fps={fps} y={1010} size={70} color={RED} glow={RED} cfg={snap}>PAUSED</Big>
    </Scene>
  );
}
// 10: the hacker in a hotel room: TV, phone, Fire Stick, 90 clips fly out
function S10({t, at, fps, a, b}) {
  const y22 = at(10, '2022'), seven = at(10, 'seventeen'), bail = at(10, 'bail'), tv = at(10, 'tv'), phone = at(10, 'phone'), fire = at(10, 'fire'), leaked = at(10, 'leaked'), ninety = at(10, 'ninety');
  const n = Math.round(90 * ease(t, ninety, 1.2));
  return (
    <Scene t={t} a={a} b={b}>
      <Sky t={t} mood="night" />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={pop(t, a, fps, heavy)}>
          <rect x={250} y={480} width={580} height={340} rx={16} fill={INK} stroke={WHITE} strokeWidth={8} />
          <rect x={272} y={502} width={536} height={296} fill="#06121C" />
          {Array.from({length: 9}, (_, i) => <text key={i} x={292} y={540 + i * 30} fontFamily="monospace" fontSize={22} fill={GREEN} opacity={clamp01((t - a) * 1.5 - i * 0.3)}>{['> connect slack', '> auth ok', '> /dev/build', '> dump clips', '> 01001101', '> upload...', '> 90 files', '> done', '> _'][i]}</text>)}
          <rect x={500} y={820} width={80} height={60} fill="#555" />
        </g>
        <g opacity={pop(t, phone, fps, snap)} transform="translate(180, 900)"><rect x={-45} y={-80} width={90} height={160} rx={16} fill="#111" stroke={TEAL} strokeWidth={5} /><rect x={-36} y={-64} width={72} height={120} fill={TEAL} opacity={0.35} /></g>
        <g opacity={pop(t, fire, fps, snap)} transform="translate(880, 900) rotate(-12)"><rect x={-70} y={-22} width={140} height={44} rx={10} fill="#111" stroke={ORANGE} strokeWidth={5} /><rect x={70} y={-12} width={22} height={24} fill="#888" /></g>
        {t > leaked ? Array.from({length: 24}, (_, i) => { const st = leaked + i * 0.1; if (t < st) return null; const u = t - st; const x = 540 + (rnd(i) - 0.5) * 120 + (rnd(i + 2) - 0.5) * 900 * u, y = 640 - u * 260 - 40 * Math.sin(u * 3 + i); return y < 200 ? null : <g key={i} transform={`translate(${x}, ${y}) rotate(${(rnd(i) - 0.5) * 30})`} opacity={clamp01(1.4 - u * 0.5)}><rect x={-46} y={-30} width={92} height={60} rx={6} fill={PURPLE} stroke={PINK} strokeWidth={4} /><path d="M-10,-14 L16,0 L-10,14 Z" fill={WHITE} /></g>; }) : null}
      </svg>
      <Pill t={t} a={y22} fps={fps} y={230} bg={TEAL} size={40} until={ninety}>SEPTEMBER 2022</Pill>
      <Pill t={t} a={seven} fps={fps} y={320} bg={PINK} fg={WHITE} size={40} until={tv}>HACKER, AGE 17</Pill>
      <Pill t={t} a={bail} fps={fps} y={400} bg={YELLOW} size={34} until={tv}>OUT ON BAIL</Pill>
      <Count t={t} a={ninety} d={1.2} from={0} to={90} y={200} size={170} color={YELLOW} fps={fps} />
      <Pill t={t} a={ninety + 0.4} fps={fps} y={410} bg={INK} fg={PINK} size={36}>CLIPS LEAKED</Pill>
      {t > fire ? <Pill t={t} a={fire + 0.1} fps={fps} x={830} y={1000} bg={ORANGE} size={26}>FIRE STICK</Pill> : null}
    </Scene>
  );
}
// 11: $5 million, then seven years
function S11({t, at, fps, a, b}) {
  const five = at(11, 'five'), sent = at(11, 'sentenced'), seven = at(11, 'seven');
  const bars = ease(t, sent, 0.6, Easing.out(Easing.bounce));
  return (
    <Scene t={t} a={a} b={b}>
      <Sky t={t} mood="night" />
      <Count t={t} a={a} d={Math.max(1, five - a + 0.6)} from={0} to={5000000} pre="$" y={260} size={120} color={GREEN} glow={GREEN} fps={fps} />
      <Pill t={t} a={five + 0.4} fps={fps} y={440} bg={INK} fg={WHITE} size={30}>WHAT ROCKSTAR SAID THE LEAK COST</Pill>
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={pop(t, sent - 0.3, fps, heavy)}>
          <rect x={280} y={560} width={520} height={480} rx={20} fill="#1A0A2E" stroke={WHITE} strokeWidth={6} />
          <text x={540} y={850} textAnchor="middle" fontFamily={BIG} fontSize={170} fill={YELLOW} opacity={pop(t, seven, fps, snap)}>7</text>
          <text x={540} y={940} textAnchor="middle" fontFamily={BIG} fontSize={64} fill={WHITE} opacity={pop(t, seven, fps, snap)}>YEARS</text>
          {Array.from({length: 7}, (_, i) => <rect key={i} x={300 + i * 75} y={560 - 480 * (1 - bars)} width={16} height={480 * bars} fill="#9AA3B5" />)}
        </g>
      </svg>
      <Pill t={t} a={sent} fps={fps} y={1100} bg={PINK} fg={WHITE} size={32}>SENTENCED · NOVEMBER 2026</Pill>
    </Scene>
  );
}
// 12: trailer 1: 90 million views in 24 hours, a world record
function S12({t, at, fps, a, b}) {
  const first = at(12, 'first'), ninety = at(12, 'ninety'), hours = at(12, 'hours'), rec = at(12, 'record');
  const clock = clamp01((t - ninety) / Math.max(1, hours - ninety + 0.5));
  return (
    <Scene t={t} a={a} b={b}>
      <Sky t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <g opacity={pop(t, first, fps, heavy)} transform="translate(540, 700)">
          <rect x={-300} y={-170} width={600} height={340} rx={30} fill={INK} stroke={PINK} strokeWidth={8} />
          <circle r={80} fill={RED} /><path d="M-26,-40 L44,0 L-26,40 Z" fill={WHITE} />
          <rect x={-260} y={130} width={520} height={10} rx={5} fill="#444" /><rect x={-260} y={130} width={520 * clock} height={10} rx={5} fill={RED} />
        </g>
        <g transform="translate(860, 960)" opacity={ease(t, ninety, 0.3)}><circle r={70} fill={WHITE} /><line x1={0} y1={0} x2={50 * Math.sin(clock * Math.PI * 4)} y2={-50 * Math.cos(clock * Math.PI * 4)} stroke={INK} strokeWidth={8} strokeLinecap="round" /><text y={110} textAnchor="middle" fontFamily={BIG} fontSize={34} fill={WHITE}>24 H</text></g>
      </svg>
      <Pill t={t} a={first} fps={fps} y={230} bg={TEAL} size={40}>TRAILER 1 · DEC 2023</Pill>
      <Count t={t} a={ninety} d={Math.max(1, hours - ninety)} from={0} to={90421491} y={300} size={104} color={YELLOW} fps={fps} />
      <Pill t={t} a={rec} fps={fps} x={360} y={1000} bg={YELLOW} size={40}>WORLD RECORD</Pill>
    </Scene>
  );
}
// 13: trailer 2: 475 million in a day, the bar towers over trailer 1
function S13({t, at, fps, a, b}) {
  const four = at(13, 'four'), day = at(13, 'day'), every = at(13, 'every');
  const g1 = ease(t, a, 0.6), g2 = ease(t, four, Math.max(1, day - four + 0.4), Easing.out(Easing.cubic));
  const H475 = 760;
  return (
    <Scene t={t} a={a} b={b}>
      <Sky t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <rect x={210} y={1110 - H475 * 90 / 475 * g1} width={240} height={H475 * 90 / 475 * g1} rx={12} fill={TEAL} />
        <text x={330} y={1100 - H475 * 90 / 475 * g1 - 20} textAnchor="middle" fontFamily={BIG} fontSize={44} fill={WHITE} opacity={g1}>90M</text>
        <rect x={630} y={1110 - H475 * g2} width={240} height={H475 * g2} rx={12} fill={PINK} />
        <text x={330} y={1160} textAnchor="middle" fontFamily={BIG} fontSize={30} fill={WHITE}>TRAILER 1</text>
        <text x={750} y={1160} textAnchor="middle" fontFamily={BIG} fontSize={30} fill={WHITE}>TRAILER 2</text>
      </svg>
      <Count t={t} a={four} d={Math.max(1, day - four + 0.4)} from={0} to={475} post="M" x={750} y={180} size={130} color={YELLOW} fps={fps} />
      <Pill t={t} a={every} fps={fps} y={1050} x={330} bg={INK} fg={TEAL} size={26}>MAY 2025 · ALL PLATFORMS</Pill>
    </Scene>
  );
}
// 14: two delays: dates crossed out, the last one stamped
function S14({t, at, fps, a, b}) {
  const two = at(14, 'two'), y25 = at(14, '2025'), may = at(14, 'may'), nov = at(14, 'november'), pol = at(14, 'polish');
  const rows = [['2025', y25 + 0.5], ['MAY 26, 2026', nov - 0.1], ['NOV 19, 2026', null]];
  return (
    <Scene t={t} a={a} b={b}>
      <Sky t={t} mood="night" />
      {rows.map(([txt, cross], i) => {
        const appear = [y25, may, nov][i];
        const k = pop(t, appear, fps, heavy);
        const c = cross !== null ? ease(t, cross, 0.25) : 0;
        return k > 0.001 ? (
          <div key={i} style={{position: 'absolute', left: 120, right: 120, top: 330 + i * 230, height: 170, borderRadius: 24, background: i === 2 ? GREEN : '#2A1745', border: `6px solid ${i === 2 ? WHITE : PINK}`,
            transform: `scale(${0.6 + 0.4 * k})`, opacity: Math.min(1, k * 1.4), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: BIG, fontSize: 76, color: i === 2 ? INK : WHITE}}>
            {txt}
            {c > 0 ? <div style={{position: 'absolute', left: '6%', top: '48%', height: 14, width: `${88 * c}%`, background: RED, borderRadius: 7, transform: 'rotate(-6deg)'}} /> : null}
            {i === 2 && t > pol ? <div style={{position: 'absolute', right: -20, top: -40, transform: `rotate(12deg) scale(${pop(t, pol, fps, snap)})`, background: YELLOW, color: INK, fontSize: 34, padding: '6px 16px', borderRadius: 10}}>RELEASED</div> : null}
          </div>
        ) : null;
      })}
      <Big t={t} a={a} fps={fps} y={160} size={92} color={RED} glow={RED}>2 DELAYS</Big>
    </Scene>
  );
}
// 15: staff doubled: 2,441 -> 4,711 people, 12 studios
function S15({t, at, fps, a, b}) {
  const dbl = at(15, 'doubled'), four = at(15, 'four'), twelve = at(15, 'twelve');
  const p = ease(t, dbl, Math.max(1, four - dbl + 1), Easing.inOut(Easing.cubic));
  const shown = Math.round(lerp(24, 47, p));
  return (
    <Scene t={t} a={a} b={b}>
      <Sky t={t} />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {Array.from({length: shown}, (_, i) => { const col = i % 8, row = Math.floor(i / 8); return <Person key={i} x={190 + col * 100} y={560 + row * 100} s={1.6} fill={i < 24 ? TEAL : PINK} o={i < 24 ? 1 : clamp01((p * 47 - i) + 1)} />; })}
        {t > twelve ? Array.from({length: 12}, (_, i) => <g key={i} opacity={pop(t, twelve + i * 0.05, fps, snap)}><PinIcon x={120 + (i % 6) * 168} y={1130 - Math.floor(i / 6) * 0} s={0.9} fill={i % 2 ? YELLOW : PINK} /></g>) : null}
      </svg>
      <Count t={t} a={dbl} d={Math.max(1, four - dbl + 1)} from={2441} to={4711} y={240} size={140} color={YELLOW} fps={fps} />
      <Pill t={t} a={dbl} fps={fps} y={440} bg={INK} fg={WHITE} size={30}>ROCKSTAR STAFF · 2018 → 2026</Pill>
      <Pill t={t} a={twelve} fps={fps} y={1060} bg={TEAL} size={34}>12 STUDIOS</Pill>
    </Scene>
  );
}
// 16: the budget: a stack of money past $1B, ESTIMATE
function S16({t, at, fps, a, b}) {
  const budget = at(16, 'budget'), never = at(16, 'never'), over = at(16, 'over');
  const h = ease(t, budget, Math.max(1.2, over - budget + 0.6), Easing.out(Easing.cubic));
  return (
    <Scene t={t} a={a} b={b}>
      <Sky t={t} mood="night" />
      <svg width={W} height={H} style={{position: 'absolute'}}>
        {Array.from({length: Math.round(22 * h)}, (_, i) => <Bill key={i} x={540 + (i % 2 ? 8 : -8)} y={1100 - i * 32} s={2.2} />)}
        <line x1={160} y1={1100 - 16 * 32} x2={920} y2={1100 - 16 * 32} stroke={YELLOW} strokeWidth={6} strokeDasharray="20 14" opacity={ease(t, over - 0.4, 0.3)} />
        <text x={170} y={1100 - 16 * 32 - 18} fontFamily={BIG} fontSize={44} fill={YELLOW} opacity={ease(t, over - 0.4, 0.3)}>$1 BILLION</text>
      </svg>
      <Pill t={t} a={never} fps={fps} y={250} bg={RED} fg={WHITE} size={40}>NEVER REVEALED</Pill>
      <Big t={t} a={over} fps={fps} y={330} size={120} color={YELLOW} glow={ORANGE}>$1B+?</Big>
      <Pill t={t} a={over + 0.3} fps={fps} y={510} bg={INK} fg={WHITE} size={28}>ANALYSTS' ESTIMATE</Pill>
    </Scene>
  );
}
// 17: the recap tiles
function S17({t, at, fps, a, b}) {
  const tiles = [['13', 'YEARS', at(17, 'thirteen'), YELLOW], ['1', 'GIANT LEAK', at(17, 'leak'), PINK], ['2', 'DELAYS', at(17, 'delays'), RED], ['$3.79B', 'BIGGEST LAUNCH', at(17, 'biggest'), GREEN]];
  return (
    <Scene t={t} a={a} b={b}>
      <Sky t={t} />
      {tiles.map(([n, l, at0, c], i) => {
        const k = pop(t, at0, fps, heavy);
        return k > 0.001 ? (
          <div key={i} style={{position: 'absolute', left: i % 2 ? 560 : 80, top: 300 + Math.floor(i / 2) * 380, width: 440, height: 330, borderRadius: 28, background: '#1E0B36', border: `7px solid ${c}`,
            transform: `scale(${0.5 + 0.5 * k}) rotate(${(1 - k) * (i % 2 ? 8 : -8)}deg)`, opacity: Math.min(1, k * 1.4), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 40px ${c}66`}}>
            <div style={{fontFamily: BIG, fontSize: n.length > 3 ? 92 : 150, color: c, lineHeight: 1}}>{n}</div>
            <div style={{fontFamily: BIG, fontSize: 36, color: WHITE, marginTop: 14}}>{l}</div>
          </div>
        ) : null;
      })}
    </Scene>
  );
}
// 18: worth the wait? YES / NO and a comment bubble
function S18({t, at, fps, a, b, seconds}) {
  const worth = at(18, 'worth'), wait = at(18, 'wait');
  return (
    <Scene t={t} a={a} b={b}>
      <Sky t={t} />
      <Big t={t} a={a} fps={fps} y={300} size={130} color={WHITE} glow={PINK}>WORTH THE WAIT?</Big>
      {[['YES', GREEN, 220], ['NO', RED, 600]].map(([s, c, x], i) => {
        const k = pop(t, wait + 0.2 + i * 0.15, fps, snap);
        return k > 0.001 ? <div key={s} style={{position: 'absolute', left: x, top: 720, width: 260, height: 150, borderRadius: 30, background: c, transform: `scale(${(0.5 + 0.5 * k) * (1 + 0.04 * Math.sin(t * 6 + i * 3))})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: BIG, fontSize: 80, color: INK}}>{s}</div> : null;
      })}
      <Pill t={t} a={wait + 0.6} fps={fps} y={1010} bg={INK} fg={YELLOW} size={36}>TELL US IN THE COMMENTS</Pill>
    </Scene>
  );
}

export const GtaPiece = ({lines = [], words = [], seconds = 120}) => {
  const {fps} = useVideoConfig();
  const t = useCurrentFrame() / fps;
  const at = makeAt(lines);
  const T = (i) => (lines[i] ? lines[i].t0 : seconds);
  const scenes = [[0, T(1), S0], [T(1), T(2), S1], [T(2), T(3), S2], [T(3), T(5), S3], [T(5), T(6), S5], [T(6), T(7), S6], [T(7), T(8), S7], [T(8), T(9), S8],
                  [T(9), T(10), S9], [T(10), T(11), S10], [T(11), T(12), S11], [T(12), T(13), S12], [T(13), T(14), S13], [T(14), T(15), S14],
                  [T(15), T(16), S15], [T(16), T(17), S16], [T(17), T(18), S17], [T(18), seconds + 1, S18]];
  return (
    <AbsoluteFill style={{background: NIGHT}}>
      {scenes.map(([a, b, C], i) => (t >= a - 0.01 && t < b + XF ? <C key={i} t={t} at={at} fps={fps} a={a} b={b} seconds={seconds} /> : null))}
      <AbsoluteFill style={{background: NIGHT, opacity: interpolate(t, [seconds - 0.5, seconds], [0, 1], CL), pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};
