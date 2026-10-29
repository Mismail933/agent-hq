// Storygraphics: the "deep" look (2.75.0). The owner (2026-10-29) after the trench video: "Learn from this video [TheBioGuys, Could
// you survive a nanosecond in the Mariana Trench?]. Add more realistic images and videos. Switch between cartoon and reality. Level up
// our cartoon to the level of cartoon he starts with. Make transitions like him." What that video does (studied from its captions and
// ~45 frames): one dark teal sea for the cartoon AND the real footage, so a cut between them feels like one world; a simple figure lit
// by its own soft glow in the dark, specks drifting past, light shafts near the surface, rock walls in silhouette, things looming out
// of the dark; real ROV footage about half the time, cut on the words; big white rounded words over the footage, thin spaced caps for
// labels; transitions made from the scene itself (a ring when you appear, a light flare into real footage, bubbles, a dip to dark).
// Shots (line.shot): dp_float, dp_yank, dp_real, dp_sink, dp_section, dp_close, dp_sub, dp_title. Real footage is line.p.footage
// (drawn under the svg by Opening's FootageLayer); every shot here is a pure function of the frame.
import React from 'react';
import {interpolate, Easing} from 'remotion';
import {noise2D} from '@remotion/noise';
import {W, H, INK, clamp, rng, Figure, OSWALD, at} from './tis';
import {YSub} from './trench2';

const NUN = "'Nunito', 'Arial Rounded MT Bold', sans-serif";
const io = Easing.bezier(0.45, 0, 0.55, 1);
const L = (f, a, b, x, y, e = io) => interpolate(f, [a, b], [x, y], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e});
// a damped spring in closed form (no state between frames); tiers: snappy labels, heavy big type and big objects
const spr = (x, w = 15, z = 0.72) => { if (x <= 0) return 0; const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x)); };
const TIER = {snap: [24, 0.8], card: [15, 0.72], heavy: [10, 0.9], bounce: [16, 0.5]};
const sp = (f, a, tier = 'card') => spr((f - a) / 30, ...TIER[tier]);
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * clamp(t, 0, 1)).toString(16).padStart(2, '0')).join(''); };
const P = (line) => line.p || {};

// ───────────── the water: colour by depth (metres), light from above that dies by ~1,000 m ─────────────
const DEPTH = [[0, '#5CC6E4', '#1E8DB8'], [30, '#2C9FC9', '#12688F'], [200, '#13668B', '#0A3E5E'], [1000, '#0A3349', '#052131'],
  [3000, '#061B28', '#030F17'], [11000, '#02090F', '#010406']];
const lg = (d) => Math.log10(Math.max(0, d) + 10);
export const water = (d) => {
  for (let i = 1; i < DEPTH.length; i++) {
    if (d <= DEPTH[i][0]) { const t = (lg(d) - lg(DEPTH[i - 1][0])) / (lg(DEPTH[i][0]) - lg(DEPTH[i - 1][0])); return [mix(DEPTH[i - 1][1], DEPTH[i][1], t), mix(DEPTH[i - 1][2], DEPTH[i][2], t)]; }
  }
  return [DEPTH[DEPTH.length - 1][1], DEPTH[DEPTH.length - 1][2]];
};
const sun = (d) => clamp(1 - lg(d) / lg(900), 0, 1);   // how much sunlight is left (1 at the surface, 0 by ~900 m)

// light shafts from the surface, soft (blurred), swaying
const Rays = ({f, k, id, x0 = 0, top = -40, n = 7, seed = 4, gain = 1}) => {
  if (k <= 0.01) return null;
  const R = rng(seed);
  return (
    <g filter={`url(#blur18-${id})`} style={{mixBlendMode: 'screen'}}>
      {[...Array(n)].map((_, i) => {
        const x = x0 + 120 + i * (W / n) + R() * 120 + Math.sin(f * 0.012 + i * 1.7) * 40, w0 = 50 + R() * 90, len = 700 + R() * 500, lean = 120 + R() * 160;
        return <path key={i} d={`M ${x} ${top} L ${x + w0} ${top} L ${x + w0 + lean + 160} ${top + len} L ${x + lean - 60} ${top + len} Z`} fill="#D8F6FF"
          opacity={gain * k * (0.07 + 0.06 * Math.sin(f * 0.03 + i * 2.1) ** 2)} />;
      })}
    </g>
  );
};
// marine snow: three depths of specks (the near ones bigger and soft), drifting up past you as you sink (rise = px fallen)
export const Specks = ({f, rise = 0, n = 90, op = 1, seed = 11, id}) => {
  const R = rng(seed);
  return (
    <g>
      {[...Array(n)].map((_, i) => {
        const layer = i % 3, k = [0.35, 0.75, 1.5][layer], r = [1.6, 2.8, 5.5][layer];
        const x0 = R() * W, y0 = R() * H, ph = R() * 100;
        const x = x0 + noise2D('sx' + seed, i * 0.37, f * 0.004) * 60;
        const y = ((y0 - rise * k - f * 0.25 * k) % (H + 60) + H + 60) % (H + 60) - 30;
        return <circle key={i} cx={x} cy={y} r={r} fill="#E8F7FF" opacity={op * [0.28, 0.45, 0.32][layer] * (0.7 + 0.3 * Math.sin(f * 0.05 + ph))}
          filter={layer === 2 ? `url(#blur3-${id})` : undefined} />;
      })}
    </g>
  );
};
// rock walls in silhouette at the sides (the trench closing in): k = how far in (0 none, 1 narrow), rise = scroll as you sink
const Walls = ({k, rise = 0, color, rim, seed = 9}) => {
  if (k <= 0.01) return null;
  const side = (s) => {
    const R = rng(seed + (s > 0 ? 7 : 0));
    const pts = [], step = 70, off = ((rise % (step * 30)) + step * 30) % (step * 30);
    for (let i = -2; i < 50; i++) {
      const y = i * step - off * 0.6;
      const jag = (R() - 0.5) * 70 + Math.sin(i * 0.7 + seed) * 50;
      pts.push([s < 0 ? 80 + 360 * k + jag : W - 80 - 360 * k - jag, y]);
    }
    const edge = pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ');
    const outer = s < 0 ? -40 : W + 40;
    return (
      <g key={s}>
        <path d={`M ${outer} -200 L ${edge} L ${outer} ${H + 400} Z`} fill={color} />
        <path d={`M ${edge}`} fill="none" stroke={rim} strokeWidth={4} opacity={0.5} />
      </g>
    );
  };
  return <g>{side(-1)}{side(1)}</g>;
};
// the defs every shot uses (ids carry the line index: two shots are on screen during a crossfade)
const Defs = ({id, d, glow = '#9FE3FF', gd = null}) => {
  const k = clamp(lg(gd != null ? gd : d) / lg(4000), 0, 1);   // gd: the cast's grade depth (a close-up deep down keeps a warmer skin)   // 0 at the surface, 1 from ~4 km down
  // water absorbs red first, then green: the cartoon's colours sink with you; a teal ambient keeps them readable
  const kr = 1 - 0.62 * k, kg = 1 - 0.36 * k, kb = 1 - 0.18 * k;
  return (
    <defs>
      <filter id={`blur18-${id}`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={18} /></filter>
      <filter id={`blur3-${id}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={2.2} /></filter>
      <filter id={`blur40-${id}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={40} /></filter>
      <filter id={`uw-${id}`} x="-20%" y="-20%" width="140%" height="140%">
        <feColorMatrix in="SourceGraphic" type="matrix" values={`${kr} 0 0 0 0  0 ${kg} 0 0 ${0.03 * k}  0 0 ${kb} 0 ${0.07 * k}  0 0 0 1 0`} result="col" />
        <feOffset in="SourceAlpha" dx={7} dy={7} result="off" />
        <feComposite in="SourceAlpha" in2="off" operator="out" result="rimA" />
        <feFlood floodColor={glow} floodOpacity={0.85} />
        <feComposite in2="rimA" operator="in" />
        <feGaussianBlur stdDeviation={1.6} result="rim" />
        <feOffset in="SourceAlpha" dx={-44} dy={0} result="sh0" />
        <feComposite in="SourceAlpha" in2="sh0" operator="out" result="shA" />
        <feFlood floodColor="#02121C" floodOpacity={0.42} />
        <feComposite in2="shA" operator="in" />
        <feGaussianBlur stdDeviation={9} />
        <feComposite in2="SourceAlpha" operator="in" result="shade" />
        <feMerge><feMergeNode in="col" /><feMergeNode in="shade" /><feMergeNode in="rim" /></feMerge>
      </filter>
      <filter id={`lit-${id}`} x="-20%" y="-20%" width="140%" height="140%">
        <feColorMatrix in="SourceGraphic" type="matrix" values="0.86 0 0 0 0  0 0.93 0 0 0.01  0 0 0.97 0 0.03  0 0 0 1 0" result="col" />
        <feOffset in="SourceAlpha" dx={7} dy={7} result="off" />
        <feComposite in="SourceAlpha" in2="off" operator="out" result="rimA" />
        <feFlood floodColor="#CFF2FF" floodOpacity={0.9} />
        <feComposite in2="rimA" operator="in" />
        <feGaussianBlur stdDeviation={1.6} result="rim" />
        <feOffset in="SourceAlpha" dx={0} dy={-60} result="sh0" />
        <feComposite in="SourceAlpha" in2="sh0" operator="out" result="shA" />
        <feFlood floodColor="#3A2A05" floodOpacity={0.38} />
        <feComposite in2="shA" operator="in" />
        <feGaussianBlur stdDeviation={10} />
        <feComposite in2="SourceAlpha" operator="in" result="shade" />
        <feMerge><feMergeNode in="col" /><feMergeNode in="shade" /><feMergeNode in="rim" /></feMerge>
      </filter>
      <filter id={`soft-${id}`} x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx={0} dy={6} stdDeviation={10} floodColor="#000" floodOpacity={0.55} /></filter>
      <radialGradient id={`glow-${id}`}><stop offset="0" stopColor={glow} stopOpacity={0.55} /><stop offset="0.35" stopColor={glow} stopOpacity={0.18} /><stop offset="1" stopColor={glow} stopOpacity={0} /></radialGradient>
      <radialGradient id={`vig-${id}`} cx="50%" cy="48%" r="75%"><stop offset="0.55" stopColor="#000" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.78} /></radialGradient>
    </defs>
  );
};
const Sea = ({f, d, id, rays = null, x0 = 0, h = H, d2 = null, gain = 1}) => {
  const [top, bot] = water(d);
  const deep = d2 != null ? water(d2)[1] : bot;
  return (
    <g>
      <linearGradient id={`sea-${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={h}>
        <stop offset="0" stopColor={top} /><stop offset={H / h} stopColor={bot} /><stop offset="1" stopColor={deep} /></linearGradient>
      <rect x={-200} y={-200} width={W + 400} height={h + 400} fill={`url(#sea-${id})`} />
      <Rays f={f} k={rays != null ? rays : sun(d)} id={id} x0={x0} gain={gain} />
    </g>
  );
};
const Glow = ({x, y, r = 380, a = 1, id}) => <circle cx={x} cy={y} r={r} fill={`url(#glow-${id})`} opacity={a} />;
const Vignette = ({id, a = 1}) => <rect x={-10} y={-10} width={W + 20} height={H + 20} fill={`url(#vig-${id})`} opacity={a} />;

// ───────────── type: big rounded words on their spoken word, thin spaced caps for labels ─────────────
// words: [{t, on (cue word), color, nth}] laid out in one line from x (anchor start|middle), each popping in with a heavy spring
// one <text> laid out by the browser (no overlaps), every word in place from the start but shown on its own word
export const BigWords = ({f, line, words, x = W / 2, y = 470, size = 150, anchor = 'middle', id, off = null}) => {
  const end = off != null ? at(line, off, 1) : 1e9;
  const out = clamp((f - end) / 8, 0, 1);
  const as = words.map((w) => (w.on != null ? at(line, w.on, w.frac != null ? w.frac : 0.1) - 3 : 0));
  if (f < as[0] - 1 || out >= 1) return null;
  const rise = 1 - sp(f, as[0], 'heavy');
  return (
    <g filter={`url(#soft-${id})`} opacity={1 - out}>
      <text x={x} y={y + rise * 34} textAnchor={anchor} fontFamily={NUN} fontWeight={900} fontSize={size} letterSpacing={-1} style={{textTransform: 'uppercase'}}>
        {words.map((w, i) => (
          <tspan key={i} fill={w.color || '#FFFFFF'} opacity={clamp((f - as[i]) / 5, 0, 1) * (0.6 + 0.4 * clamp(sp(f, as[i], 'heavy'), 0, 1))}>{(i ? ' ' : '') + w.t}</tspan>
        ))}
      </text>
    </g>
  );
};
export const Tag = ({f, a = 0, x, y, text, size = 36, anchor = 'start', color = '#FFFFFF', rule = true, b = 1e9}) => {
  const k = clamp((f - a) / 10, 0, 1) * (1 - clamp((f - b) / 8, 0, 1));
  if (k <= 0) return null;
  const w = String(text).length * size * 0.62 + (String(text).length - 1) * 8;
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return (
    <g opacity={k}>
      {rule && <path d={`M ${x0} ${y - size - 14} l ${70 * k} 0`} stroke="#FFD25A" strokeWidth={4} />}
      <text x={x0 + (1 - k) * -14} y={y} fontFamily={OSWALD} fontWeight={600} fontSize={size} fill={color} letterSpacing={8} style={{textTransform: 'uppercase'}}
        stroke="#02101A" strokeOpacity={0.6} strokeWidth={7} paintOrder="stroke" strokeLinejoin="round">{text}</text>
    </g>
  );
};
const fmt = (m) => Math.round(m).toLocaleString('en-US');
// the running depth bar (his recurring timeline bar, ours in metres): thin track, gold fill, ticks every 1,000 m, the reading at its end
export const DepthBar = ({f, d, a = 0, x0 = 360, x1 = 1560, y = 110, max = 11000, op = 1, value = true}) => {
  const k = clamp((f - a) / 12, 0, 1) * op;
  if (k <= 0) return null;
  const p = clamp(d / max, 0, 1), xm = x0 + (x1 - x0) * p;
  return (
    <g opacity={k}>
      <text x={x0} y={y - 24} fontFamily={OSWALD} fontWeight={600} fontSize={30} fill="#FFFFFF" letterSpacing={8} stroke="#02101A" strokeOpacity={0.6} strokeWidth={6} paintOrder="stroke">DEPTH</text>
      {value && <text x={x1} y={y - 24} textAnchor="end" fontFamily={OSWALD} fontWeight={600} fontSize={34} fill="#FFFFFF" letterSpacing={4} stroke="#02101A" strokeOpacity={0.6} strokeWidth={6} paintOrder="stroke">{fmt(d)} M</text>}
      <rect x={x0} y={y - 3} width={x1 - x0} height={6} rx={3} fill="#FFFFFF" opacity={0.18} />
      <rect x={x0} y={y - 3} width={xm - x0} height={6} rx={3} fill="#FFC23D" />
      {[...Array(12)].map((_, i) => <path key={i} d={`M ${x0 + (x1 - x0) * (i * 1000 / max)} ${y + 8} l 0 ${i % 5 ? 8 : 16}`} stroke="#FFFFFF" strokeWidth={2} opacity={0.45} />)}
      <circle cx={xm} cy={y} r={11} fill="#FFE08A" />
      <circle cx={xm} cy={y} r={26} fill="#FFC23D" opacity={0.25} />
    </g>
  );
};
const Credit = ({text, right = false}) => text ? (
  <text x={right ? W - 44 : 44} y={right ? H - 150 : 56} textAnchor={right ? 'end' : 'start'} fontFamily={OSWALD} fontWeight={500} fontSize={24} fill="#FFFFFF" opacity={0.78} letterSpacing={4} style={{textTransform: 'uppercase'}}>{text}</text>
) : null;

// you, lit and coloured by the water
const You = ({f, id, x, y, s = 0.4, rot = 0, pose = 'stand', expr = 'calm', seed = 3, look = 0}) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} filter={`url(#uw-${id})`}>
    <Figure who="you" pose={pose} expr={expr} f={f} seed={seed} shadow={false} look={look} />
  </g>
);
const Bubbles = ({x, y, f, f0, n = 9, seed = 2, s = 1, op = 1}) => {
  if (f < f0) return null;
  const R = rng(seed);
  return <g>{[...Array(n)].map((_, i) => { const t = (f - f0) * (1.6 + R() * 1.2) + i * 6; const r = (5 + R() * 12) * s;
    return <g key={i} opacity={op * clamp(1 - t / 220, 0, 1)}>
      <circle cx={x + Math.sin((f + i * 9) * 0.12) * 16 * s + (R() - 0.5) * 50 * s} cy={y - t * 4.2 * s} r={r} fill="#D9F4FF" fillOpacity={0.12} stroke="#E8F9FF" strokeWidth={3} />
    </g>; })}</g>;
};

// ───────────── dp_float: you, eyes closed, floating at the surface, seen from just under it ─────────────
const SURF_Y = 300;
const Surface = ({f, y, id, bright = 1}) => {
  let d = `M -500 -400 L -500 ${y}`;
  for (let x = -500; x <= W + 500; x += 30) d += ` L ${x} ${(y + Math.sin(x / 110 + f * 0.05) * 9 + Math.sin(x / 41 + f * 0.09) * 4).toFixed(1)}`;
  d += ` L ${W + 500} -400 Z`;
  return (
    <g>
      <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E9FBFF" /><stop offset="1" stopColor="#8EDBF2" /></linearGradient>
      <path d={d} fill={`url(#sky-${id})`} opacity={bright} />
      {/* the sun through the surface, and the bright ripples it throws on the underside */}
      <circle cx={1450} cy={y - 60} r={260} fill="#FFFBE0" opacity={0.55 * bright} filter={`url(#blur40-${id})`} />
      {[...Array(9)].map((_, i) => <path key={i} d={`M ${-100 + i * 260 + Math.sin(f * 0.03 + i) * 30} ${y + 18 + (i % 3) * 16} q 60 ${-14 + Math.sin(f * 0.07 + i) * 10} 130 0`}
        stroke="#E9FBFF" strokeWidth={4} fill="none" opacity={0.35 * bright} strokeLinecap="round" />)}
    </g>
  );
};
function Float({f, len, line}) {
  const id = 'f' + line.idx, p = P(line);
  const warm = at(line, p.warm || 'warm', 0.3), pac = at(line, p.pac || 'pacific', 0.5), eyes = at(line, p.eyes || 'eyes', 0.75), sunW = at(line, p.sun || 'sun', 0.88);
  // the camera: close on you, a slow pull back on 'the Pacific' (endless water), in close on your face for 'eyes closed', back out
  const zz = f < pac ? L(f, 0, pac, 1.12, 1.18) : f < eyes - 4 ? L(f, pac, eyes - 4, 1.18, 0.86) : L(f, eyes - 4, eyes + 14, 0.86, 2.3);
  const z = f > sunW + 6 ? L(f, sunW + 6, len, zz, zz * 0.9) : zz;
  const hx = 700, bob = Math.sin(f * 0.06) * 7, hy = SURF_Y - 44 + bob;   // your head: face and chest above the water
  const fx = f >= eyes - 4 ? L(f, eyes - 4, eyes + 14, W / 2, hx) : W / 2, fy = f >= eyes - 4 ? L(f, eyes - 4, eyes + 14, H / 2, hy + 10) : H / 2;
  const glint = f >= warm ? clamp(1 - Math.abs(f - warm - 12) / 22, 0, 1) : 0;
  const flare = f >= sunW - 4 ? clamp(1 - Math.abs(f - sunW - 10) / 26, 0, 1) : 0;
  const creep = L(f, Math.max(0, len - 110), len, 0, 1);   // the shadow below, rising into the last seconds
  return (
    <g>
      <Defs id={id} d={40} glow="#FFF6D6" />
      <g transform={`translate(${fx} ${fy}) scale(${z}) translate(${-fx} ${-fy})`}>
        <Sea f={f} d={160} id={id} rays={1} gain={2.4} />
        <Surface f={f} y={SURF_Y} id={id} bright={0.92} />
        <Specks f={f} id={id} n={70} op={0.75} />
        {/* the shadow in the deep, and one pale eye, creeping up toward the end */}
        <ellipse cx={1250} cy={H + 260 - creep * 200} rx={720} ry={300} fill="#021019" opacity={0.75 * creep} filter={`url(#blur40-${id})`} />
        <circle cx={1150} cy={H + 120 - creep * 200} r={14} fill="#CFF6E8" opacity={creep * (0.45 + 0.3 * Math.sin(f * 0.2))} />
        <Glow x={hx + 220} y={hy + 40} r={560} id={id} a={0.55} />
        {flare > 0 && <g style={{mixBlendMode: 'screen'}}><circle cx={1500 - flare * 200} cy={140} r={420} fill="#FFF3C8" opacity={0.55 * flare} filter={`url(#blur40-${id})`} />
          <path d={`M 1500 140 L ${700 - flare * 80} 760`} stroke="#FFF8E0" strokeWidth={60} opacity={0.12 * flare} filter={`url(#blur18-${id})`} /></g>}
        <You f={f} id={id} x={hx} y={hy} s={0.44} rot={-84 + Math.sin(f * 0.05) * 2} pose="backfloat" expr={p.expr || 'closed'} />
        {/* the water across him: what is under the surface takes the sea's colour */}
        <rect x={-400} y={SURF_Y + 4 + Math.sin(f * 0.05) * 3} width={W + 800} height={H} fill={water(160)[0]} opacity={0.38} />
        {/* sun glints on the water around you on 'warm' */}
        {glint > 0 && [...Array(9)].map((_, i) => { const R = rng(40 + i); const gx = 300 + R() * 1400, gy = SURF_Y + 6 + R() * 26;
          return <path key={i} d={`M ${gx - 18} ${gy} L ${gx} ${gy - 5} L ${gx + 18} ${gy} L ${gx} ${gy + 5} Z`} fill="#FFFFFF" opacity={glint * (0.5 + 0.5 * Math.sin(f * 0.6 + i))} />; })}
      </g>
      <Vignette id={id} a={0.85} />
      {p.big && <BigWords f={f} line={line} id={id} words={p.big} x={p.big_x || W / 2} y={p.big_y || 640} size={p.big_size || 150} off={p.big_off} />}
      {p.tag && <Tag f={f} a={at(line, p.tag_on || '', 0.4)} b={eyes - 6} x={120} y={980 - 120} text={p.tag} />}
    </g>
  );
}

// ───────────── dp_yank: something grabs your ankle and pulls you under ─────────────
// a tapered limb along a cubic curve (base width w0, tip w1), as one filled outline
const limb = (p0, p1, p2, p3, w0, w1, n = 24) => {
  const pt = (t) => { const u = 1 - t; return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]); };
  const L1 = [], R1 = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y] = pt(t), [x2, y2] = pt(Math.min(1, t + 0.01)), [x0, y0] = pt(Math.max(0, t - 0.01));
    const dx = x2 - x0, dy = y2 - y0, m = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * t) / 2;
    L1.push([x - dy / m * w, y + dx / m * w]); R1.push([x + dy / m * w, y - dx / m * w]);
  }
  return 'M ' + [...L1, ...R1.reverse()].map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ') + ' Z';
};
function Yank({f, len, line}) {
  const id = 'y' + line.idx, p = P(line);
  const g = at(line, p.grab || 'grabs', 0.4), pull = at(line, p.pull || 'pulls', 0.65);
  const reach = L(f, g - 22, g + 2, 0, 1, Easing.out(Easing.cubic));
  const loom = L(f, 0, g, 0.25, 1);
  const yank = L(f, pull - 2, pull + 10, 0, 1, Easing.in(Easing.cubic));
  const after = clamp((f - pull - 10) / 36, 0, 1);
  const cam = yank * 440 + after * 860;   // the camera follows you down: the surface leaves the top of the frame
  const shake = f >= pull && f < pull + 16 ? noise2D('yk', f * 0.6, 0) * 16 * (1 - (f - pull) / 16) : 0;
  const s = 0.44, yx = 700, yy0 = SURF_Y - 44 + Math.sin(f * 0.06) * 6 * (1 - reach);
  const rot = -86 + 86 * yank;
  const drag = yank * 520 + after * 900;   // how far you are pulled down
  // the ankle (figure units 0, 1040) on screen
  const ar = rot * Math.PI / 180, yy = yy0 + drag, ax = yx - 1040 * s * Math.sin(ar), ay = yy + 1040 * s * Math.cos(ar);
  const tug = f >= g ? Math.sin((f - g) * 0.5) * 6 * (1 - yank) : 0;
  const tip = [ax + 6 + tug, ay + 6];
  const base = [ax + 520, H + 900 + drag * 0.2];
  const tipNow = [base[0] + (tip[0] - base[0]) * reach, base[1] + (tip[1] - base[1]) * reach];
  const c1 = [base[0] - 80, base[1] - 380], c2 = [tipNow[0] + 260, tipNow[1] + 220];
  return (
    <g>
      <Defs id={id} d={4 + after * 80} />
      <g transform={`translate(${shake} ${-cam + shake * 0.5})`}>
        <Sea f={f} d={6} id={id} rays={1} gain={1.7} h={H + 2600} d2={600} />
        <Surface f={f} y={SURF_Y} id={id} />
        <Specks f={f} id={id} n={45} op={0.6} rise={cam * 0.4} />
        {/* something huge in the dark below, never seen whole: a shadow and one pale eye */}
        <ellipse cx={1420} cy={H + 40 + drag * 0.15} rx={760} ry={300} fill="#02101A" opacity={0.8 * loom} filter={`url(#blur40-${id})`} />
        <circle cx={1330} cy={H - 190 + drag * 0.15} r={16} fill="#CFF6E8" opacity={loom * (0.5 + 0.3 * Math.sin(f * 0.2))} />
        <circle cx={1330} cy={H - 190 + drag * 0.15} r={46} fill="#CFF6E8" opacity={0.18 * loom} filter={`url(#blur3-${id})`} />
        {reach > 0.01 && <path d={limb(base, c1, c2, tipNow, 92, 10)} fill="#031722" opacity={0.95} />}
        {reach > 0.01 && <path d={limb(base, c1, c2, tipNow, 92, 10)} fill="none" stroke="#2C7FA0" strokeWidth={2} opacity={0.35} />}
        <g opacity={1 - clamp((f - (len - 22)) / 8, 0, 1)}><You f={f} id={id} x={yx} y={yy} s={s} rot={rot} pose={yank > 0.2 ? 'flail' : 'backfloat'} expr={f > g ? 'shock' : 'closed'} /></g>
        <Bubbles x={yx + 60} y={yy0 + 120} f={f} f0={pull} n={26} s={1.7} seed={7} />
      </g>
      {f > len - 26 && (() => { const k = clamp((f - (len - 26)) / 26, 0, 1), R = rng(77);
        return <g>{[...Array(60)].map((_, i) => { const x = R() * W, r = 30 + R() * 90, y = H + 200 - (k * 1.4 + R() * 0.4) * (H + 400);
          return <circle key={i} cx={x + Math.sin(k * 7 + i) * 20} cy={y} r={r} fill="#E2F6FF" fillOpacity={0.35} stroke="#F2FBFF" strokeWidth={5} opacity={0.9} />; })}</g>; })()}
      <Vignette id={id} a={0.75 + 0.25 * after} />
    </g>
  );
}

// ───────────── dp_real: real footage under the svg, with big words, a label and the credit ─────────────
function Real({f, len, line}) {
  const id = 'r' + line.idx, p = P(line), v = p.footage || {};
  const flash = p.flash ? clamp(1 - (f - 8) / 9, 0, 1) * (f >= 8 ? 1 : f / 8) : 0;   // a light flare into the footage (matches a lamp switching on)
  return (
    <g>
      <Defs id={id} d={2000} />
      <Vignette id={id} a={v.vignette != null ? v.vignette : 0.8} />
      {p.big && <BigWords f={f} line={line} id={id} words={p.big} y={p.big_y || 560} size={p.big_size || 150} x={p.big_x || W / 2} anchor={p.big_anchor || 'middle'} off={p.big_off} />}
      {p.tag && <Tag f={f} a={at(line, p.tag_on || '', 0.2)} x={p.tag_x || 120} y={p.tag_y || 860} text={p.tag} />}
      {p.depth != null && <DepthBar f={f} d={p.depth} />}
      {p.marks && (() => { const mk = p.marks.map(([w, m]) => [at(line, w, 0.5), m]); let dd = p.from != null ? p.from : 1000;
        for (const [a, m] of mk) dd = dd + (m - dd) * L(f, a - 12, a, 0, 1);
        const k = mk.findIndex(([a]) => f < a), cur = k < 0 ? mk.length - 1 : k - 1;
        return <g>
          <DepthBar f={f} d={dd} a={0} value={cur < 0} />
          {cur >= 0 && <text x={1500} y={600} textAnchor="middle" fontFamily={NUN} fontWeight={900} fontSize={150} fill="#FFFFFF" opacity={clamp((f - mk[cur][0] + 4) / 9, 0, 1)} filter={`url(#soft-${id})`}>{fmt(mk[cur][1])} M</text>}
        </g>; })()}
      <Credit text={v.credit} right={!!(p.marks || p.depth != null)} />
      {flash > 0 && <g style={{mixBlendMode: 'screen'}}>
        <radialGradient id={`fl-${id}`}><stop offset="0" stopColor="#FFFFFF" stopOpacity={1} /><stop offset="0.25" stopColor="#FFF4D6" stopOpacity={0.85} /><stop offset="1" stopColor="#FFD98A" stopOpacity={0} /></radialGradient>
        <circle cx={W / 2} cy={470} r={300 + Math.min(f, 8) * 140} fill={`url(#fl-${id})`} opacity={flash} />
      </g>}
      {p.pin && (() => { const a = at(line, p.pin.on || '', 0.3), k = sp(f, a, 'bounce'); if (f < a) return null;
        const px = p.pin.x || W / 2, py = p.pin.y || H / 2, ring = ((f - a) % 40) / 40;
        return <g>
          <circle cx={px} cy={py} r={18 + ring * 70} fill="none" stroke="#FFC23D" strokeWidth={5} opacity={1 - ring} />
          <circle cx={px} cy={py} r={14 * clamp(k, 0, 1.3)} fill="#FFC23D" stroke="#FFFFFF" strokeWidth={4} />
          {p.pin.label && <Tag f={f} a={a + 6} x={px + 40} y={py - 30} text={p.pin.label} size={30} rule={false} />}
        </g>; })()}
    </g>
  );
}

// ───────────── dp_sink: you sinking through the dark, the depth counting up on its words ─────────────
function Sink({f, len, line}) {
  const id = 's' + line.idx, p = P(line);
  const marks = (p.marks || []).map(([w, m]) => [at(line, w, 0.5), m]);
  const push = p.push_on ? at(line, p.push_on, 0.6) : 1e9;
  const pz = f > push ? L(f, push, len, 1, 1.22) : 1;
  let d = p.from != null ? p.from : 1000;
  if (p.to != null && !marks.length) d = L(f, 0, len, d, p.to, (x) => x);
  for (const [a, m] of marks) d = d + (m - d) * L(f, a - 12, a, 0, 1);
  const rise = f * 14;
  const wOn = p.walls_on ? at(line, p.walls_on, 0.8) : 0;
  const walls = p.walls1 ? L(f, wOn, wOn ? wOn + 30 : len, p.walls0 || 0, p.walls1) : 0;
  const [, bot] = water(d);
  const sway = Math.sin(f * 0.04) * 14;
  const k = marks.findIndex(([a]) => f < a), cur = k < 0 ? marks.length - 1 : k - 1;
  const dark = p.dip ? clamp((f - (len - 14)) / 12, 0, 1) : 0;   // a dip to dark into the next shot
  const numOut = p.num_off ? clamp((f - at(line, p.num_off, 0.4) - 6) / 10, 0, 1) : 0;
  const lightOut = p.dark_on ? L(f, at(line, p.dark_on, 0.5), at(line, p.dark_on, 0.5) + 14, 1, 0.15) : 1;
  return (
    <g>
      <Defs id={id} d={d} />
      <Sea f={f} d={d} id={id} />
      <Walls k={walls} rise={rise} color={mix(bot, '#000000', 0.45)} rim={mix(bot, '#BFEFFF', 0.7)} />
      <g transform={`translate(${W / 2} ${H / 2}) scale(${pz}) translate(${-W / 2} ${-H / 2})`}>
      <Specks f={f} id={id} rise={rise} n={110} op={f > push ? L(f, push, len, 1, 2.2) : 1} />
      {p.surface && <g><Surface f={f} y={L(f, 0, len, 190, -30)} id={id} bright={L(f, 0, len, 1, 0.5)} /><Rays f={f} k={1} id={id} top={L(f, 0, len, 190, -30)} gain={1.5} /></g>}
      <Glow x={800 + sway} y={500} r={520} id={id} a={0.95 * lightOut} />
      {/* a slow tumble around his middle (the absolute clock, so it carries from shot to shot) */}
      <g transform={`translate(${800 + sway} ${p.surface ? L(f, 0, len, 560, 500) : 500}) rotate(${40 + ((f + (line.start || 0)) * 0.2) % 100})`}>
        <You f={f} id={id} x={0} y={-545 * (p.surface ? L(f, 0, len, 0.5, 0.42) : 0.5)} s={p.surface ? L(f, 0, len, 0.5, 0.42) : 0.5} pose={p.pose || 'star'} expr={p.expr || 'worried'} />
      </g>
      {[0, 40, 80, 120, 160].map((o) => <Bubbles key={o} x={800 + sway} y={360} f={f} f0={o - 30} n={3} s={0.8} seed={3 + o} op={0.7} />)}
      </g>
      <Vignette id={id} />
      <DepthBar f={f} d={d} a={0} value={cur < 0} />
      {cur >= 0 && (() => { const [a, m] = marks[cur]; const kk = sp(f, a - 2, 'heavy');
        return <text x={1500} y={600 + (1 - kk) * 26} textAnchor="middle" fontFamily={NUN} fontWeight={900} fontSize={150} fill="#FFFFFF" opacity={clamp((f - a + 4) / 9, 0, 1) * (1 - numOut)}
          filter={`url(#soft-${id})`}>{fmt(m)} M</text>; })()}
      {dark > 0 && <rect x={0} y={0} width={W} height={H} fill="#000" opacity={dark} />}
    </g>
  );
}

// ───────────── dp_section: the trench in cross-section, Everest dropped into it ─────────────
const SY = 130, FL = 800, KMP = (FL - SY) / 11;   // the surface, the Challenger Deep's floor, px a km
const EV = 8.85 * KMP;
function Section({f, len, line}) {
  const id = 'x' + line.idx, p = P(line);
  const drop = at(line, p.drop || 'dropped', 0.35), two = at(line, p.two || 'two', 0.7);
  const fall = L(f, drop, drop + 16, -1200, 0, Easing.in(Easing.quad));
  const land = f >= drop + 16 ? f - drop - 16 : -1;
  const squash = land >= 0 ? 1 - 0.06 * Math.exp(-land / 5) * Math.cos(land * 0.8) : 1;
  const shake = land >= 0 && land < 16 ? noise2D('ev', land * 0.7, 0) * 10 * (1 - land / 16) : 0;
  const z = L(f, 0, len, 1.0, 1.05);
  const cx = 960;
  // the trench profile: plains at ~6 km either side, walls down to the floor
  const trench = `M -60 ${SY + 6.0 * KMP} L 360 ${SY + 5.8 * KMP} C 520 ${SY + 6.0 * KMP} 600 ${SY + 8.6 * KMP} 700 ${FL - 30} L 740 ${FL} L 1180 ${FL} L 1220 ${FL - 30}
    C 1320 ${SY + 8.6 * KMP} 1400 ${SY + 6.0 * KMP} 1560 ${SY + 5.8 * KMP} L ${W + 60} ${SY + 6.0 * KMP} L ${W + 60} ${H + 60} L -60 ${H + 60} Z`;
  const ev = (g) => { const h = EV * g; const q = (u, v) => `${cx + u * 330} ${FL - v * h}`;
    return `M ${q(-1, 0)} L ${q(-0.74, 0.24)} L ${q(-0.58, 0.31)} L ${q(-0.4, 0.55)} L ${q(-0.3, 0.6)} L ${q(-0.14, 0.86)} L ${q(-0.05, 0.94)} L ${q(0, 1)} L ${q(0.08, 0.95)}
      L ${q(0.2, 0.8)} L ${q(0.32, 0.73)} L ${q(0.48, 0.5)} L ${q(0.62, 0.41)} L ${q(0.82, 0.17)} L ${q(1, 0)} Z`; };
  const peakY = FL - EV;
  const k2 = sp(f, two, 'card');
  const pulse = 0.5 + 0.5 * Math.sin(f * 0.15);
  return (
    <g>
      <Defs id={id} d={3000} />
      <g transform={`translate(${shake} 0) translate(${W / 2} ${H / 2}) scale(${z}) translate(${-W / 2} ${-H / 2})`}>
        <linearGradient id={`col-${id}`} gradientUnits="userSpaceOnUse" x1="0" y1={SY} x2="0" y2={FL}>
          {[0, 200, 1000, 3000, 6000, 11000].map((m) => <stop key={m} offset={m / 11000} stopColor={water(m)[0]} />)}
        </linearGradient>
        <rect x={-100} y={-100} width={W + 200} height={SY + 100} fill="#0B1C2A" />
        <rect x={-100} y={SY} width={W + 200} height={H} fill={`url(#col-${id})`} />
        <Rays f={f} k={0.6} id={id} top={SY} n={6} />
        <path d={`M -100 ${SY} L ${W + 100} ${SY}`} stroke="#BFF0FF" strokeWidth={3} opacity={0.7} />
        <linearGradient id={`rock-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1F3442" /><stop offset="1" stopColor="#070D12" /></linearGradient>
        <path d={trench} fill={`url(#rock-${id})`} />
        <path d={trench} fill="none" stroke="#7FD3EE" strokeWidth={2.5} opacity={0.35} />
        {/* Everest, dropped in: lit from the left, the snow catching the light */}
        <g transform={`translate(0 ${fall}) translate(${cx} ${FL}) scale(${2 - squash} ${squash}) translate(${-cx} ${-FL})`} opacity={f >= drop - 1 ? 1 : 0}>
          <path d={ev(1)} fill="#5B6B78" />
          <path d={`M ${cx} ${peakY} L ${cx + 0.08 * 330} ${FL - 0.95 * EV} L ${cx + 0.2 * 330} ${FL - 0.8 * EV} L ${cx + 0.32 * 330} ${FL - 0.73 * EV} L ${cx + 0.48 * 330} ${FL - 0.5 * EV}
            L ${cx + 0.62 * 330} ${FL - 0.41 * EV} L ${cx + 0.82 * 330} ${FL - 0.17 * EV} L ${cx + 330} ${FL} L ${cx + 40} ${FL} L ${cx + 10} ${FL - 0.6 * EV} Z`} fill="#33414C" />
          <path d={`M ${cx - 0.14 * 330} ${FL - 0.86 * EV} L ${cx - 0.05 * 330} ${FL - 0.94 * EV} L ${cx} ${peakY} L ${cx + 0.08 * 330} ${FL - 0.95 * EV} L ${cx + 0.2 * 330} ${FL - 0.8 * EV}
            L ${cx + 0.1 * 330} ${FL - 0.79 * EV} L ${cx + 0.02 * 330} ${FL - 0.85 * EV} L ${cx - 0.06 * 330} ${FL - 0.8 * EV} Z`} fill="#E8F3FA" />
          <path d={ev(1)} fill="none" stroke="#A9DDF0" strokeWidth={2} opacity={0.45} />
        </g>
        {land >= 0 && land < 40 && [...Array(14)].map((_, i) => { const a = (i / 13) * Math.PI, r = 40 + land * 9;
          return <circle key={i} cx={cx + Math.cos(a) * r * 1.6 * (i % 2 ? 1 : -1)} cy={FL - Math.sin(a) * r * 0.35} r={30 + land * 1.5} fill="#5E7685" opacity={0.35 * (1 - land / 40)} filter={`url(#blur18-${id})`} />; })}
        {/* the water still above the peak: the bracket and its reading */}
        {k2 > 0.01 && (
          <g>
            <path d={`M ${cx + 120} ${SY + 6} L ${cx + 150} ${SY + 6} L ${cx + 150} ${SY + 6 + (peakY - SY - 12) * clamp(k2, 0, 1)} L ${cx + 120} ${SY + 6 + (peakY - SY - 12) * clamp(k2, 0, 1)}`}
              fill="none" stroke="#FFC23D" strokeWidth={5} />
            <text x={cx + 180} y={(SY + peakY) / 2 + 14} fontFamily={NUN} fontWeight={900} fontSize={64} fill="#FFFFFF" opacity={clamp(k2, 0, 1)} filter={`url(#soft-${id})`}>2 KM</text>
            <text x={cx + 182} y={(SY + peakY) / 2 + 60} fontFamily={OSWALD} fontWeight={600} fontSize={38} fill="#FFFFFF" letterSpacing={4} opacity={clamp(k2, 0, 1)} stroke="#02101A" strokeOpacity={0.6} strokeWidth={6} paintOrder="stroke">OF WATER STILL ABOVE IT</text>
          </g>
        )}
        {/* the ruler */}
        <g opacity={0.8}>
          <path d={`M 70 ${SY} L 70 ${FL}`} stroke="#CFEFFF" strokeWidth={2} opacity={0.5} />
          {[...Array(12)].map((_, i) => <g key={i}><path d={`M 70 ${SY + i * KMP} l ${i % 2 ? 10 : 22} 0`} stroke="#CFEFFF" strokeWidth={2} />
            {i % 2 === 0 && i > 0 && <text x={104} y={SY + i * KMP + 13} fontFamily={OSWALD} fontWeight={600} fontSize={38} fill="#FFFFFF" letterSpacing={3} stroke="#02101A" strokeOpacity={0.6} strokeWidth={6} paintOrder="stroke">{i} KM</text>}</g>)}
        </g>
        <Tag f={f} a={drop + 18} x={cx - 300} y={FL - 0.18 * EV} text="MOUNT EVEREST" anchor="end" size={40} rule={false} />
        <path d={`M ${cx + 180} ${FL + 4} L ${cx + 180} ${FL + 34}`} stroke="#FFFFFF" strokeWidth={3} opacity={0.85} />
        <Tag f={f} a={0} x={cx + 180} y={FL + 84} text="CHALLENGER DEEP · 10,935 M" size={40} rule={false} anchor="middle" />
        <circle cx={cx - 300} cy={SY + 6.3 * KMP} r={9} fill="#FFE08A" opacity={pulse} />
        <circle cx={cx - 300} cy={SY + 6.3 * KMP} r={22} fill="#FFC23D" opacity={0.25 * pulse} />
        <text x={cx - 330} y={SY + 6.3 * KMP - 30} textAnchor="end" fontFamily={OSWALD} fontWeight={600} fontSize={28} fill="#FFE08A" letterSpacing={6} stroke="#02101A" strokeOpacity={0.6} strokeWidth={6} paintOrder="stroke">YOU · 6,000 M</text>
      </g>
      <Vignette id={id} a={0.6} />
    </g>
  );
}

// ───────────── dp_close: you, close, in the dark (an honest aside; the air running out) ─────────────
function Close({f, len, line}) {
  const id = 'c' + line.idx, p = P(line);
  const air = p.mode === 'air';
  const a0 = at(line, p.air_on || 'air', 0.2), a1 = at(line, p.air_off || 'metres', 0.7);
  const left = air ? L(f, a0, a1, 1, 0, Easing.inOut(Easing.quad)) : 1;
  const push = p.push_on ? at(line, p.push_on, 0.3) : -1;
  const z = push >= 0 ? (f < push ? L(f, 0, push, 1.0, 1.04) : L(f, push, push + 24, 1.04, 1.22)) : L(f, 0, len, 1.04, 1.12);
  const sway = Math.sin(f * 0.035) * 16, lift = Math.sin(f * 0.05) * 12;
  const expr = air ? (left < 0.35 ? 'shock' : 'scared') : (p.expr || 'worried');
  const puff = air ? a0 : -999;
  return (
    <g>
      <Defs id={id} d={p.depth || 300} gd={500} glow="#AFE6FF" />
      <g transform={`translate(${W / 2} ${H / 2}) scale(${z}) translate(${-W / 2} ${-H / 2})`}>
        <Sea f={f} d={p.depth || 300} id={id} />
        <Specks f={f} id={id} rise={f * 4} n={80} />
        <Glow x={820 + sway} y={500} r={560} id={id} a={1} />
        <You f={f} id={id} x={820 + sway} y={250 + lift} s={1.0} rot={5 + Math.sin(f * 0.025) * 5} pose="backfloat" expr={expr} look={p.look_on && f >= at(line, p.look_on, 0.3) ? 1 : 0} />
        <Bubbles x={826 + sway} y={350 + lift} f={f} f0={puff} n={18} s={1.4} seed={4} />
        {air && f > puff && <Bubbles x={826 + sway} y={350 + lift} f={f} f0={puff + 26} n={10} s={1.1} seed={9} />}
      </g>
      <Vignette id={id} />
      {air && (() => {
        const R0 = 120, cx = 1520, cy = 470, ang = left * 2 * Math.PI;
        const ex = cx + R0 * Math.sin(ang), ey = cy - R0 * Math.cos(ang);
        const col = left > 0.35 ? '#7FE3FF' : '#FF6B5B';
        return (
          <g opacity={clamp((f - a0 + 6) / 8, 0, 1)}>
            <circle cx={cx} cy={cy} r={R0} fill="none" stroke="#FFFFFF" strokeWidth={10} opacity={0.15} />
            {left > 0.001 && <path d={left > 0.999 ? `M ${cx} ${cy - R0} A ${R0} ${R0} 0 1 1 ${cx - 0.01} ${cy - R0}` : `M ${cx} ${cy - R0} A ${R0} ${R0} 0 ${left > 0.5 ? 1 : 0} 1 ${ex} ${ey}`}
              fill="none" stroke={col} strokeWidth={10} strokeLinecap="round" />}
            <text x={cx} y={cy + 22} textAnchor="middle" fontFamily={NUN} fontWeight={900} fontSize={64} fill="#FFFFFF">{Math.round(left * 100)}%</text>
            <text x={cx} y={cy + R0 + 64} textAnchor="middle" fontFamily={OSWALD} fontWeight={500} fontSize={30} fill="#CFEFFF" letterSpacing={8}>AIR</text>
          </g>
        );
      })()}
      {p.tag && <Tag f={f} a={at(line, p.tag_on || '', 0.3)} x={1260} y={780} text={p.tag} />}
      {p.bar_on && (() => { const a = at(line, p.bar_on, 0.8); if (f < a - 4) return null; const k = L(f, a, a + 10, 0.08, 1, Easing.out(Easing.cubic));
        return <g opacity={clamp((f - a + 4) / 5, 0, 1)}>
          <rect x={300} y={600} width={1320} height={230} rx={22} fill="#000000" opacity={0.45} />
          <rect x={360} y={780} width={1200} height={16} rx={8} fill="#FFFFFF" opacity={0.35} />
          <rect x={360} y={780} width={1200 * k} height={16} rx={8} fill="#FF2D2D" />
          <circle cx={360 + 1200 * k} cy={788} r={26} fill="#FF2D2D" />
          <path d="M 372 640 l 50 32 l -50 32 Z" fill="#FFFFFF" />
          <text x={450} y={694} fontFamily={OSWALD} fontWeight={600} fontSize={60} fill="#FFFFFF">{k >= 1 ? '0:03 / 0:03' : '0:01 / 0:03'}</text>
        </g>; })()}
    </g>
  );
}

// ───────────── dp_sub: the cheat. A ring, and a little submarine is around you; its lamps come on ─────────────
function Sub({f, len, line}) {
  const id = 'b' + line.idx, p = P(line);
  const ring = at(line, p.ring || 'cheat', 0.2), win = at(line, p.win || 'window', 0.5), seat = at(line, p.seat || 'seat', 0.85);
  const r = f - ring;
  const d = p.depth || 2500;
  const bx = 960, by = 560 + Math.sin(f * 0.05) * 8;
  const form = clamp(sp(f, ring + 3, 'bounce'), 0, 1.2);
  const youK = 1 - L(f, ring, ring + 10, 0, 1);
  // 'a window': the camera goes in on the porthole with your face in it
  const zin = L(f, win - 14, win + 4, 1, 3.2);
  const px = bx + 13 * 1.3, py = by - 8 * 1.3;
  const out = f >= seat - 3;   // the window view
  if (out) {
    const lit = clamp((f - seat) / 6, 0, 1), flick = f - seat < 10 ? (Math.sin((f - seat) * 2.4) > -0.2 ? 1 : 0.35) : 1;
    return (
      <g>
        <Defs id={id} d={d} glow="#FFF1B8" />
        <Sea f={f} d={d} id={id} />
        <Specks f={f} id={id} rise={f * 3} n={70} op={0.6} />
        <g opacity={lit * flick} style={{mixBlendMode: 'screen'}}>
          <radialGradient id={`bm-${id}`} cx="50%" cy="100%" r="100%"><stop offset="0" stopColor="#FFF4D2" stopOpacity={0.85} /><stop offset="0.6" stopColor="#FFE9B0" stopOpacity={0.35} /><stop offset="1" stopColor="#FFE9B0" stopOpacity={0} /></radialGradient>
          <path d={`M ${W / 2 - 150} 870 L ${W / 2 - 520} 140 L ${W / 2 - 60} 140 L ${W / 2 - 40} 870 Z`} fill={`url(#bm-${id})`} filter={`url(#blur18-${id})`} />
          <path d={`M ${W / 2 + 150} 870 L ${W / 2 + 520} 140 L ${W / 2 + 60} 140 L ${W / 2 + 40} 870 Z`} fill={`url(#bm-${id})`} filter={`url(#blur18-${id})`} />
          {[...Array(22)].map((_, i) => { const R = rng(90 + i); const side = i % 2 ? 1 : -1, t = R(), y = 860 - ((f * (1.2 + R()) + R() * 700) % 720);
            const spread = 40 + (860 - y) * 0.55 * R(); return <circle key={i} cx={W / 2 + side * (60 + spread)} cy={y} r={3 + t * 5} fill="#FFF7E0" opacity={0.85} />; })}
        </g>
        {/* the porthole's rim around the frame */}
        <path d={`M -10 -10 L ${W + 10} -10 L ${W + 10} ${H + 10} L -10 ${H + 10} Z M ${W / 2 - 400} 470 a 400 400 0 1 0 800 0 a 400 400 0 1 0 -800 0 Z`} fill="#05090D" fillRule="evenodd" />
        <circle cx={W / 2} cy={470} r={400} fill="none" stroke="#9CA3AF" strokeWidth={34} />
        <circle cx={W / 2} cy={470} r={400} fill="none" stroke="#CBD5E1" strokeWidth={6} opacity={0.6} />
        {[...Array(12)].map((_, i) => { const t = (i / 12) * Math.PI * 2; return <circle key={i} cx={W / 2 + Math.cos(t) * 400} cy={470 + Math.sin(t) * 400} r={8} fill="#5B6773" />; })}
        <path d={`M ${W / 2 - 280} 250 q 110 -90 260 -100`} stroke="#FFFFFF" strokeWidth={12} fill="none" opacity={0.18} strokeLinecap="round" />
        {p.tag && <Tag f={f} a={seat + 4} x={W / 2} y={170} text={p.tag} anchor="middle" rule={false} />}
      </g>
    );
  }
  return (
    <g>
      <Defs id={id} d={d} glow="#FFF1B8" />
      <g transform={`translate(${px} ${py}) scale(${zin}) translate(${-px} ${-py})`}>
        <Sea f={f} d={d} id={id} />
        <Specks f={f} id={id} rise={f * 3} n={80} />
        <Glow x={bx} y={by} r={560} id={id} a={0.9} />
        {youK > 0.01 && <g opacity={youK}><You f={f} id={id} x={bx} y={by - 240 + (1 - youK) * 200} s={0.46 * (0.4 + 0.6 * youK)} pose="stand" expr="worried" /></g>}
        {r >= 0 && r < 26 && <circle cx={bx} cy={by} r={60 + r * 32} fill="none" stroke="#FFFFFF" strokeWidth={14 * (1 - r / 26)} opacity={1 - r / 26} />}
        {r >= 0 && r < 8 && <circle cx={bx} cy={by} r={300} fill="#FFFFFF" opacity={0.5 * (1 - r / 8)} filter={`url(#blur40-${id})`} />}
        {r >= 0 && <g filter={`url(#lit-${id})`}><YSub T={f} x={bx} y={by} s={1.3 * form} beam={0} cup={1} bag={false} solo={!p.pip} youExpr={f > win - 10 ? 'smile' : 'worried'} pipExpr="smile" /></g>}
      </g>
      <Vignette id={id} />
    </g>
  );
}

// ───────────── dp_title: YOU vs 11 KM ─────────────
function Title({f, len, line}) {
  const id = 't' + line.idx, p = P(line);
  // p.slam 'none' = the title doesn't land in this line (a question line before the answer line); the scene runs on the absolute
  // clock, so two title lines in a row join without a jump
  const slam = p.slam === 'none' ? 1e9 : at(line, p.slam || 'find', 0.6);
  const k = sp(f, slam, 'heavy'), k2 = sp(f, slam + 8, 'heavy'), k3 = sp(f, slam + 16, 'card');
  const d = 4000, F = f + (line.start || 0);
  const bx = 960, by = 760 + Math.sin(F * 0.05) * 8;
  return (
    <g>
      <Defs id={id} d={d} glow="#FFF1B8" />
      <Sea f={F} d={d} id={id} />
      <Walls k={0.45} rise={F * 6} color="#02070B" rim="#2F6F86" />
      <Specks f={F} id={id} rise={F * 6} n={110} />
      <g style={{mixBlendMode: 'screen'}}>
        <linearGradient id={`tb-${id}`} gradientUnits="userSpaceOnUse" x1={bx - 150} y1={by} x2={-200} y2={by}><stop offset="0" stopColor="#FFF4D2" stopOpacity={0.75} /><stop offset="1" stopColor="#FFE9B0" stopOpacity={0} /></linearGradient>
        <path d={`M ${bx - 150} ${by + 8} L -200 ${by - 330} L -200 ${by + 470} Z`} fill={`url(#tb-${id})`} filter={`url(#blur18-${id})`} />
        <clipPath id={`tbc-${id}`}><path d={`M ${bx - 150} ${by + 8} L -200 ${by - 330} L -200 ${by + 470} Z`} /></clipPath>
        <g clipPath={`url(#tbc-${id})`}><Specks f={F} id={id} rise={F * 6} n={140} op={2.2} seed={57} /></g>
      </g>
      <g filter={`url(#lit-${id})`}><YSub T={F} x={bx} y={by} s={0.62} beam={0} cup={1} bag={false} solo={!p.pip} youExpr="determined" pipExpr="smile" /></g>
      <circle cx={bx - 236 * 0.62} cy={by + 12} r={18} fill="#FFFBE6" />
      <circle cx={bx - 236 * 0.62} cy={by + 12} r={70} fill="#FFF3C4" opacity={0.35} filter={`url(#blur18-${id})`} />
      <Vignette id={id} />
      <g filter={`url(#soft-${id})`}>
        <text x={W / 2 - 70} y={420 + (1 - k) * 40} textAnchor="end" fontFamily={NUN} fontWeight={900} fontSize={230} fill="#FFFFFF" opacity={clamp(k * 1.5, 0, 1)}>YOU</text>
        <text x={W / 2} y={392} textAnchor="middle" fontFamily={OSWALD} fontWeight={600} fontSize={92} fill="#FFC23D" letterSpacing={4} opacity={clamp(k2 * 1.5, 0, 1)}>VS</text>
        <text x={W / 2 + 70} y={420 + (1 - k2) * 40} fontFamily={NUN} fontWeight={900} fontSize={230} fill="#FFC23D" opacity={clamp(k2 * 1.5, 0, 1)}>11 KM</text>
      </g>
      <Tag f={f} a={slam + 16} x={W / 2} y={530} text="THE MARIANA TRENCH" anchor="middle" size={36} rule={false} />
      <DepthBar f={f} d={L(f, slam + 16, Math.max(slam + 40, len - 36), 0, 10935)} a={slam + 16} y={900} op={clamp(k3, 0, 1)} />
    </g>
  );
}

// ───────────── dp_snow: a magnifier on one speck of marine snow (dead plankton, a faecal pellet), then 'not the fun kind' ─────────────
function SnowLens({f, len, line}) {
  const id = 'n' + line.idx, p = P(line);
  const open = at(line, p.open || 'bits', 0.1), poop = at(line, p.poop || 'poop', 0.5), fun = at(line, p.fun || 'fun', 0.75);
  const k = clamp(sp(f, open - 4, 'card'), 0, 1.1);
  const lx = 1180, ly = 470, R0 = 330;
  const sx = 640, sy = 560;   // the speck under the lens
  const R = rng(5);
  return (
    <g>
      <Defs id={id} d={1200} />
      <Sea f={f} d={1200} id={id} />
      <Specks f={f} id={id} rise={f * 2} n={110} op={1.1} />
      <circle cx={sx} cy={sy} r={7} fill="#F1F7FA" />
      {/* the lens: a ring, a handle, a line from the speck */}
      <g opacity={clamp(k * 1.4, 0, 1)}>
        <path d={`M ${sx + 10} ${sy - 6} L ${lx - R0 * k * 0.92} ${ly + 40}`} stroke="#E6F6FF" strokeWidth={3} strokeDasharray="10 8" opacity={0.6} />
        <clipPath id={`lens-${id}`}><circle cx={lx} cy={ly} r={R0 * k} /></clipPath>
        <circle cx={lx} cy={ly} r={R0 * k} fill="#0B2E40" />
        <g clipPath={`url(#lens-${id})`}>
          {/* a clump: bits of dead plankton (diatom discs, a copepod's empty shell, threads) stuck together */}
          <g transform={`translate(${lx} ${ly}) rotate(${f * 0.15}) scale(${0.85 + 0.15 * k})`}>
            <path d="M -170 -40 C -120 -120 40 -150 130 -80 C 200 -20 170 90 80 130 C -30 170 -170 120 -190 30 Z" fill="#9FB7A6" opacity={0.55} />
            {[...Array(9)].map((_, i) => <circle key={i} cx={-120 + R() * 240} cy={-90 + R() * 180} r={16 + R() * 18} fill="#C9D9C4" stroke="#7E9C88" strokeWidth={4} opacity={0.9} />)}
            {[...Array(9)].map((_, i) => <circle key={'d' + i} cx={-110 + R() * 220} cy={-80 + R() * 160} r={4} fill="#5F7D6A" />)}
            <path d="M -40 -30 C -10 -70 50 -60 60 -20 C 66 10 40 40 0 36 C -36 32 -56 0 -40 -30 Z" fill="none" stroke="#E2D7B8" strokeWidth={5} />
            <path d="M 60 -20 L 120 -60 M 58 -10 L 126 -30 M -40 -30 L -100 -80" stroke="#E2D7B8" strokeWidth={4} />
            {[...Array(6)].map((_, i) => <path key={'t' + i} d={`M ${-150 + i * 50} ${80 + (i % 2) * 20} q 30 -40 60 0`} stroke="#B5C9BD" strokeWidth={3} fill="none" />)}
            {/* the faecal pellet */}
            <g opacity={f >= poop - 2 ? 1 : 0.6}><ellipse cx={95} cy={60} rx={46} ry={22} fill="#7A5230" stroke="#4A3018" strokeWidth={5} transform="rotate(-24 95 60)" /></g>
          </g>
        </g>
        <circle cx={lx} cy={ly} r={R0 * k} fill="none" stroke="#DCE7EE" strokeWidth={16} />
        <path d={`M ${lx + R0 * k * 0.72} ${ly + R0 * k * 0.72} l ${120 * k} ${120 * k}`} stroke="#9AA6B2" strokeWidth={34} strokeLinecap="round" />
      </g>
      {f >= open + 6 && <g opacity={clamp((f - open - 6) / 6, 0, 1)}>
        <path d={`M ${lx - R0 - 40} ${ly - 150} L ${lx - 80} ${ly - 40}`} stroke="#FFFFFF" strokeWidth={5} />
        <text x={lx - R0 - 50} y={ly - 166} textAnchor="end" fontFamily={NUN} fontWeight={900} fontSize={58} fill="#FFFFFF" filter={`url(#soft-${id})`}>DEAD PLANKTON</text>
      </g>}
      {f >= poop - 3 && <g opacity={clamp((f - poop + 3) / 6, 0, 1)}>
        <path d={`M ${lx - 40} ${ly + R0 + 26} L ${lx + 60} ${ly + 110}`} stroke="#FFC23D" strokeWidth={5} />
        <text x={lx - 60} y={ly + R0 + 92} textAnchor="middle" fontFamily={NUN} fontWeight={900} fontSize={58} fill="#FFC23D" filter={`url(#soft-${id})`}>FISH POOP</text>
      </g>}
      {/* 'not the fun kind of snow': a snowflake, crossed out */}
      {f >= fun - 3 && (() => { const kk = clamp(sp(f, fun - 3, 'bounce'), 0, 1.2); return (
        <g transform={`translate(1660 190) scale(${kk * 0.8})`} opacity={clamp(kk, 0, 1)}>
          {[0, 60, 120].map((a) => <path key={a} d="M 0 -90 L 0 90 M -22 -62 L 0 -40 L 22 -62 M -22 62 L 0 40 L 22 62" stroke="#FFFFFF" strokeWidth={12} strokeLinecap="round" fill="none" transform={`rotate(${a})`} />)}
          <circle r={128} fill="none" stroke="#FF5A4E" strokeWidth={18} />
          <path d="M -90 90 L 90 -90" stroke="#FF5A4E" strokeWidth={18} strokeLinecap="round" />
        </g>); })()}
      <Vignette id={id} />
    </g>
  );
}

export const DEEP_SHOTS = {dp_snow: SnowLens, dp_float: Float, dp_yank: Yank, dp_real: Real, dp_sink: Sink, dp_section: Section, dp_close: Close, dp_sub: Sub, dp_title: Title};
