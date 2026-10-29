// Storygraphics #5, "You vs 11 km" (the Mariana Trench what-if): the vertical Short (2.74.0). The owner (10-28): "a catchy short
// that makes people click", "level up the animation". Built native 9:16 (not a wide video cropped): a fall is vertical, so the Short
// is one continuous dive the camera rides down. What the reference repos taught (lemo-opuscar DIRECTOR.md, xilo-opus-video
// craft-rules, mg-styles-15 rubric): a hook that moves in the first half second, the camera always moving, something new every 2-4
// s, anticipation before a hit and follow-through after it, one signature move (the zoom THROUGH the sea surface into the dive),
// springs in tiers (heavy for big type, lively for stickers), text held long enough to read, everything a pure function of the frame.
// The lines (shots): t_hook, t_float, t_dive, t_scale, t_end; line.p.* may move cue words. Words are the voice's own frames.
import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, Easing} from 'remotion';
import {noise2D} from '@remotion/noise';
import {INK, st, clamp, rng, Figure, OSWALD} from './tis';
import {FONT_CSS} from './fonts';

export const VW = 1080, VH = 1920;
const SURF = 260, FLOOR = 1250, KM = (FLOOR - SURF) / 11;   // the section: the sea surface, the floor of the Challenger Deep, px a km
const io = Easing.bezier(0.45, 0, 0.55, 1);
const L = (f, a, b, x, y, e = io) => interpolate(f, [a, b], [x, y], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e});
// a damped spring in closed form (xilo-opus-video craft-rules): no state between frames, so any frame renders alone
const spr = (x, w = 15, z = 0.72) => { if (x <= 0) return 0; const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x)); };
const S = {snap: [24, 0.8], card: [15, 0.72], heavy: [10, 0.92], sticker: [18, 0.45]};   // spring tiers, one per kind of thing
const sp = (f, at, tier = 'card') => spr((f - at) / 30, ...S[tier]);
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * clamp(t, 0, 1)).toString(16).padStart(2, '0')).join(''); };
const keys = (f, ks) => {   // a colour through [frame, colour] keys
  if (f <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) if (f <= ks[i][0]) return mix(ks[i - 1][1], ks[i][1], io((f - ks[i - 1][0]) / Math.max(1, ks[i][0] - ks[i - 1][0])));
  return ks[ks.length - 1][1];
};
const num = (f, ks) => interpolate(f, ks.map((k) => k[0]), ks.map((k) => k[1]), {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: io});

// the frame (absolute) of a word in the line with this shot; `frac` of the line if the word isn't there
const lineOf = (lines, shot) => {   // every line with this shot as one (a line split for a beat keeps its cues)
  const ls = lines.filter((l) => l.shot === shot);
  if (!ls.length) return {start: 0, end: 30, words: []};
  return {...ls[0], end: ls[ls.length - 1].end, words: ls.flatMap((l) => l.words || [])};
};
const wordAt = (l, word, frac = 0.5, nth = 0) => {
  const want = String(word).toLowerCase().replace(/[^a-z0-9']/g, '');
  const hits = (l.words || []).filter((w) => w[0].toLowerCase().replace(/[^a-z0-9']/g, '').startsWith(want));
  const h = hits[Math.min(nth, hits.length - 1)];
  return h ? h[1] : Math.round(l.start + (l.end - l.start) * frac);
};

// ───────────── shared pieces ─────────────
const wavePath = (f, y, amp, k, x0 = -60, x1 = VW + 60, bottom = VH + 60) => {
  let d = `M ${x0} ${bottom} L ${x0} ${y}`;
  for (let x = x0; x <= x1; x += 30) d += ` L ${x} ${(y + Math.sin(x / 120 + f * 0.06 + k) * amp + Math.sin(x / 47 + f * 0.1 + k * 2) * amp * 0.35).toFixed(1)}`;
  return d + ` L ${x1} ${bottom} Z`;
};
const waveLine = (f, y, amp, k, x0, x1) => {
  let d = '';
  for (let x = x0; x <= x1; x += 30) d += `${d ? ' L' : 'M'} ${x} ${(y + Math.sin(x / 120 + f * 0.06 + k) * amp + Math.sin(x / 47 + f * 0.1 + k * 2) * amp * 0.35).toFixed(1)}`;
  return d;
};
const Sun = ({x, y, r = 90, f, heat = 0}) => (
  <g>
    <circle cx={x} cy={y} r={r * (2.2 + 0.25 * heat + 0.05 * Math.sin(f * 0.1))} fill="#FFF3B0" opacity={0.35 + 0.25 * heat} />
    {[...Array(12)].map((_, i) => { const a = (i / 12) * Math.PI * 2 + f * 0.006; const r0 = r * 1.25, r1 = r * (1.65 + 0.15 * Math.sin(f * 0.15 + i));
      return <path key={i} d={`M ${x + Math.cos(a) * r0} ${y + Math.sin(a) * r0} L ${x + Math.cos(a) * r1} ${y + Math.sin(a) * r1}`} {...st(10)} stroke="#FDB813" />; })}
    <circle cx={x} cy={y} r={r} fill="#FFD23F" {...st(8)} />
    <path d={`M ${x - r * 0.45} ${y - r * 0.3} q ${r * 0.2} ${-r * 0.25} ${r * 0.45} ${-r * 0.2}`} stroke="#FFF7CC" strokeWidth={10} fill="none" strokeLinecap="round" />
  </g>
);
// floating specks: three depths of "marine snow" (parallax), moving up as you fall (rise = px the camera has fallen)
const Snow = ({rise = 0, op = 1, seed = 11, n = 70, f = 0}) => {
  const R = rng(seed);
  return <g>{[...Array(n)].map((_, i) => {
    const layer = i % 3, k = [0.35, 0.7, 1.25][layer], r = [2.5, 4, 7][layer];
    const x = R() * VW, y0 = R() * VH;
    const y = ((y0 - rise * k) % (VH + 40) + VH + 40) % (VH + 40) - 20;
    return <ellipse key={i} cx={x + Math.sin(f * 0.02 + i) * 8} cy={y} rx={r} ry={r} fill="#E6F4FF" opacity={op * [0.25, 0.4, 0.55][layer]} />;
  })}</g>;
};
// speed streaks: thin lines rushing up past the camera while the fall is fast
const Streaks = ({rise, speed, seed = 5}) => {
  if (speed < 0.05) return null;
  const R = rng(seed);
  return <g>{[...Array(18)].map((_, i) => { const x = 60 + R() * (VW - 120), y0 = R() * VH, len = 80 + R() * 160;
    const y = ((y0 - rise * 2.2) % (VH + 300) + VH + 300) % (VH + 300) - 150;
    return <path key={i} d={`M ${x} ${y} l 0 ${len * speed}`} stroke="#DCEFFF" strokeWidth={4} opacity={0.18 * speed} strokeLinecap="round" />; })}</g>;
};
const Bubbles = ({x, y, f, f0, n = 7, seed = 2, s = 1}) => {
  const R = rng(seed);
  return <g>{[...Array(n)].map((_, i) => { const t = ((f - f0) * (1.4 + R()) + i * 23) % 140; const r = (5 + R() * 9) * s;
    return <circle key={i} cx={x + Math.sin((f + i * 9) * 0.12) * 14 * s + (R() - 0.5) * 30 * s} cy={y - t * 4 * s} r={r} fill="none" stroke="#E6F7FF" strokeWidth={4} opacity={clamp(1 - t / 140, 0, 1) * 0.9} />; })}</g>;
};
const Chip = ({x, y, text, s = 1, fill = '#FFE11A', color = INK, size = 64, rot = -2, anchor = 'start'}) => {
  const w = String(text).length * size * 0.52 + 44, h = size * 1.22;
  const x0 = anchor === 'middle' ? -w / 2 : anchor === 'end' ? -w : 0;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} opacity={s > 0.02 ? 1 : 0}>
      <rect x={x0 + 8} y={10} width={w} height={h} fill="#000" opacity={0.35} />
      <rect x={x0} y={0} width={w} height={h} fill={fill} stroke={INK} strokeWidth={7} />
      <text x={x0 + w / 2} y={h * 0.8} textAnchor="middle" fontFamily={OSWALD} fontWeight={700} fontSize={size} fill={color} letterSpacing={1}>{text}</text>
    </g>
  );
};
const Bracket = ({x, y0, y1, k, side = 1, color = '#FFE11A'}) => {   // a measuring bracket that draws itself from y0 toward y1
  if (k <= 0) return null;
  const y = y0 + (y1 - y0) * clamp(k, 0, 1);
  return (
    <g>
      <path d={`M ${x - 22 * side} ${y0} L ${x} ${y0} L ${x} ${y} L ${x - 22 * side} ${y}`} fill="none" stroke={INK} strokeWidth={16} strokeLinejoin="round" strokeLinecap="round" />
      <path d={`M ${x - 22 * side} ${y0} L ${x} ${y0} L ${x} ${y} L ${x - 22 * side} ${y}`} fill="none" stroke={color} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );
};

// a wipe made of big bubbles rising across the screen (k 0 -> 1: in from the bottom, covering at ~0.5, gone off the top)
const BubbleWipe = ({k}) => {
  const R = rng(23);
  return <g>{[...Array(46)].map((_, i) => { const x = R() * VW, r = 70 + R() * 120, sp2 = 0.8 + R() * 0.5, off = R() * 0.25;
    const y = VH + 300 - (k * 1.6 * sp2 - off) * (VH + 600);
    return <circle key={i} cx={x + Math.sin(k * 9 + i) * 20} cy={y} r={r} fill="#E6F7FF" opacity={0.92} stroke="#B9E6FB" strokeWidth={6} />; })}</g>;
};

// ───────────── the cross-section: sky, sea, the trench, Everest standing on its floor ─────────────
const OCEAN_STOPS = [[0, '#47AEE2'], [0.2, '#2A8CC2'], [1, '#165287'], [4, '#0B2748'], [7, '#061730'], [11, '#030B18']];
const TRENCH = `M -40 ${SURF + 6.1 * KM} L 120 ${SURF + 6.0 * KM} C 220 ${SURF + 6.3 * KM} 250 ${SURF + 8.2 * KM} 330 ${FLOOR - 40} L 360 ${FLOOR}
  L 720 ${FLOOR} L 750 ${FLOOR - 40} C 830 ${SURF + 8.2 * KM} 860 ${SURF + 6.3 * KM} 960 ${SURF + 6.0 * KM} L 1120 ${SURF + 6.1 * KM} L 1120 ${VH + 400} L -40 ${VH + 400} Z`;
const EVEREST_H = 8.85 * KM;
const everest = (g) => {   // the mountain's outline, base on the floor, peak at the top (g = 0..1 how much has grown)
  const top = FLOOR - EVEREST_H * g, h = FLOOR - top;
  const p = (u, v) => `${540 + u * 400} ${FLOOR - v * h}`;
  return `M ${p(-1, 0)} L ${p(-0.78, 0.22)} L ${p(-0.62, 0.3)} L ${p(-0.45, 0.52)} L ${p(-0.33, 0.6)} L ${p(-0.16, 0.86)} L ${p(-0.06, 0.93)} L ${p(0, 1)}
    L ${p(0.08, 0.95)} L ${p(0.2, 0.8)} L ${p(0.3, 0.74)} L ${p(0.47, 0.5)} L ${p(0.6, 0.42)} L ${p(0.8, 0.18)} L ${p(1, 0)} Z`;
};
const snowcap = (g) => {
  const top = FLOOR - EVEREST_H * g, h = FLOOR - top;
  const p = (u, v) => `${540 + u * 400} ${FLOOR - v * h}`;
  return `M ${p(-0.16, 0.86)} L ${p(-0.06, 0.93)} L ${p(0, 1)} L ${p(0.08, 0.95)} L ${p(0.2, 0.8)} L ${p(0.12, 0.78)} L ${p(0.04, 0.84)} L ${p(-0.04, 0.8)} L ${p(-0.1, 0.83)} Z`;
};
function Section({f, grow = 0, dark = 0, sunHeat = 0, drop = 0, squash = 1, ruler = 1}) {
  const ocean = OCEAN_STOPS.map(([km, c]) => [km, mix(c, '#02060C', dark * (km < 0.3 ? 0.4 : 0.9))]);
  return (
    <g>
      <linearGradient id="v-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={mix('#5AA9E6', '#05080F', dark)} /><stop offset="1" stopColor={mix('#CDEBFF', '#16223A', dark)} /></linearGradient>
      <rect x={-600} y={-1200} width={VW + 1200} height={SURF + 1260} fill="url(#v-sky)" />
      {dark < 0.5 && <Sun x={74} y={212} r={32} f={f} heat={sunHeat} />}
      <linearGradient id="v-sea" gradientUnits="userSpaceOnUse" x1="0" y1={SURF} x2="0" y2={FLOOR}>
        {ocean.map(([km, c]) => <stop key={km} offset={km / 11} stopColor={c} />)}
      </linearGradient>
      <path d={wavePath(f, SURF, 7, 0, -600, VW + 600, VH + 600)} fill="url(#v-sea)" />
      <path d={waveLine(f, SURF, 7, 0, -600, VW + 600)} fill="none" stroke="#E0F4FF" strokeWidth={6} opacity={0.9} />
      {/* faint light from the surface, fading by the first kilometre */}
      {[...Array(6)].map((_, i) => <path key={i} d={`M ${60 + i * 190 + Math.sin(f * 0.02 + i) * 20} ${SURF} l 90 0 l 150 ${2.2 * KM} l -110 0 Z`} fill="#BFE6FF" opacity={0.1 * (1 - dark)} />)}
      <path d={TRENCH} fill={mix('#4A4F5C', '#14171E', dark)} stroke={INK} strokeWidth={7} strokeLinejoin="round" />
      {[0.4, 0.9, 1.5, 2.2].map((k, i) => <path key={i} d={`M -40 ${SURF + (6.1 + k) * KM} L ${150 + k * 40} ${SURF + (6.05 + k) * KM} M ${930 - k * 40} ${SURF + (6.05 + k) * KM} L 1120 ${SURF + (6.1 + k) * KM}`}
        stroke={mix('#363B47', '#0E1015', dark)} strokeWidth={12} opacity={0.8} strokeLinecap="round" />)}
      <path d={`M 360 ${FLOOR} L 720 ${FLOOR}`} stroke={mix('#5B6170', '#2A2E38', dark)} strokeWidth={10} />
      <linearGradient id="v-rock" gradientUnits="userSpaceOnUse" x1="0" y1={FLOOR} x2="0" y2={VH}><stop offset="0" stopColor="#000" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.55} /></linearGradient>
      <rect x={-600} y={FLOOR} width={VW + 1200} height={VH} fill="url(#v-rock)" />
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M -40 ${FLOOR + 90 + i * 110} C 300 ${FLOOR + 60 + i * 110} 700 ${FLOOR + 130 + i * 110} 1120 ${FLOOR + 80 + i * 110}`} stroke={mix('#3A3F4B', '#0E1015', dark)} strokeWidth={10} fill="none" opacity={0.7} />)}
      {grow > 0.001 && (
        <g transform={`translate(0 ${drop}) translate(540 ${FLOOR}) scale(${1 + (1 - squash) * 0.4} ${squash}) translate(-540 ${-FLOOR})`}>
          <path d={everest(grow)} fill="#C9D3DF" opacity={0.95} stroke={INK} strokeWidth={7} strokeLinejoin="round" />
          <path d={`M 540 ${FLOOR - EVEREST_H * grow} L ${540 + 0.08 * 400} ${FLOOR - 0.95 * EVEREST_H * grow} L ${540 + 0.2 * 400} ${FLOOR - 0.8 * EVEREST_H * grow} L ${540 + 0.3 * 400} ${FLOOR - 0.74 * EVEREST_H * grow} L ${540 + 0.47 * 400} ${FLOOR - 0.5 * EVEREST_H * grow} L ${540 + 0.6 * 400} ${FLOOR - 0.42 * EVEREST_H * grow} L ${540 + 0.8 * 400} ${FLOOR - 0.18 * EVEREST_H * grow} L 940 ${FLOOR} L 600 ${FLOOR} L 560 ${FLOOR - 0.5 * EVEREST_H * grow} Z`} fill="#8E9AAB" opacity={0.85} />
          <path d={everest(grow)} fill="none" stroke="#FFFFFF" strokeWidth={3} strokeDasharray="14 12" opacity={0.6} transform="translate(0 10)" />
          <path d={snowcap(grow)} fill="#FFFFFF" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          {[...Array(5)].map((_, i) => <path key={i} d={`M ${400 + i * 60} ${FLOOR - 40 - (i % 2) * 70} l 30 -60`} stroke="#AEB8C6" strokeWidth={6} opacity={grow} strokeLinecap="round" />)}
        </g>
      )}
      {/* the depth ruler down the left edge */}
      <g opacity={0.95 * ruler}>
        <path d={`M 34 ${SURF} L 34 ${FLOOR}`} stroke="#E6F2FF" strokeWidth={4} opacity={0.6} />
        {[...Array(12)].map((_, k) => <g key={k}><path d={`M 34 ${SURF + k * KM} l ${k % 5 ? 14 : 30} 0`} stroke="#E6F2FF" strokeWidth={k % 5 ? 4 : 7} opacity={0.8} />
          {k % 5 === 0 && k > 0 && <text x={72} y={SURF + k * KM + 16} fontFamily={OSWALD} fontWeight={700} fontSize={48} fill="#E6F2FF" stroke={INK} strokeWidth={6} paintOrder="stroke">{k} KM</text>}</g>)}
      </g>
    </g>
  );
}

// ───────────── you: the swimmer ─────────────
const You = ({f, pose = 'stand', expr = 'calm', rot = 0, x, y, s = 0.42, seed = 3, kick = 0}) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
    <Figure who="you" pose={pose} expr={expr} f={kick ? f * 2.2 : f} seed={seed} shadow={false} />
  </g>
);
// where a point of the figure (its own units: head centre 0,0; feet 0,1090) lands on screen
const place = (x, y, rot, s, px, py) => { const a = rot * Math.PI / 180; return [x + (px * Math.cos(a) - py * Math.sin(a)) * s, y + (px * Math.sin(a) + py * Math.cos(a)) * s]; };

// ───────────── the Short ─────────────
const HOLD_X = 540;
export const VShort = ({lines = [], captions = true}) => {
  const f = useCurrentFrame();
  const L1 = lineOf(lines, 't_hook'), L2 = lineOf(lines, 't_float'), L3 = lineOf(lines, 't_dive'), L4 = lineOf(lines, 't_scale'), L5 = lineOf(lines, 't_end');
  const p = (l) => l.p || {};
  // cue frames from the voice
  const cEverest = wordAt(L1, p(L1).everest_on || 'everest', 0.35), cTwo = wordAt(L1, p(L1).gap_on || 'two', 0.6), cNine = wordAt(L1, p(L1).height_on || 'nine', 0.9);
  const cSun = wordAt(L2, 'sun', 0.45), cSomething = wordAt(L2, 'something', 0.6), cTug = wordAt(L2, 'tugs', 0.7), cUnder = wordAt(L2, 'under', 0.95);
  const cGreen = wordAt(L3, 'green', 0.1), cBlue = wordAt(L3, 'blue', 0.18), cGrey = wordAt(L3, 'grey', 0.26), cPop = wordAt(L3, 'pop', 0.38),
    cKick = wordAt(L3, 'kick', 0.55), cDrop = wordAt(L3, 'dropping', 0.65), cDark = wordAt(L3, 'dark', 0.85), cDarker = wordAt(L3, 'darker', 0.95);
  const cEleven = wordAt(L4, 'eleven', 0.3), cDeepest = wordAt(L4, 'deepest', 0.6), cWay = wordAt(L4, 'way', 0.95);
  const cBottom = wordAt(L5, 'bottom', 0.4), cChannel = wordAt(L5, 'channel', 0.9), cWhat = wordAt(L5, "what's", 0.15), cWhole = wordAt(L5, 'whole', 0.6), cAt = wordAt(L5, 'at', 0.3);
  const tIn = Math.max(L1.end - 2, L2.start - 16), tDive = cUnder + 30, tOut = L4.start - 2, tEnd = L5.start - 2;
  const end = (lines[lines.length - 1] || {}).until || L5.end + 60;
  const hand = [noise2D('hx', f * 0.02, 0) * 10, noise2D('hy', 0, f * 0.02) * 8];   // a hand-held drift: the camera never sits dead still

  let world;
  if (f < tIn + 14) {
    // 1. THE HOOK: we start at the sun-lit surface and the camera plunges down the whole column in the first second and a half
    //    (motion from frame 0), settles on the full section, Everest grows up from the floor on its word, the two brackets measure.
    const LAND = 15;
    const drop = L(f, 0, LAND, -880, 0, Easing.in(Easing.quad));
    const squash = f >= LAND ? 1 - 0.07 * Math.sin(clamp((f - LAND) / 9, 0, 1) * Math.PI) : 1;
    const jolt = f >= LAND && f < LAND + 14 ? Math.sin((f - LAND) * 2.4) * (LAND + 14 - f) * 1.6 : 0;
    const push = L(f, LAND, tIn, 0, 1, (t) => t);
    const cy = 960 + jolt, cx0 = 540 + 30 * push;
    const z = 1.0 + 0.04 * push;
    const grow = 1;
    const b2 = sp(f, cTwo, 'snap'), b9 = sp(f, cNine, 'snap');
    // the zoom THROUGH the surface into the next scene (the signature move): from tIn the camera dives into the sea at x 540
    const zin = f >= tIn ? L(f, tIn, tIn + 14, 0, 1, Easing.in(Easing.quad)) : 0;
    const aim = L(f, tIn - 12, tIn + 2, 0, 1);
    const zz = z * (1 + zin * 7), ccx = cx0 + (240 - cx0) * aim + hand[0] * (1 - aim), ccy = cy + (SURF + 24 - cy) * aim + hand[1] * (1 - aim);
    world = (
      <g>
        <g transform={`translate(${VW / 2} ${VH / 2}) scale(${zz}) translate(${-ccx} ${-ccy})`}>
          <Section f={f} grow={grow} drop={drop} squash={squash} />
          {f >= 6 && f < 34 && <g opacity={1 - L(f, 22, 34, 0, 1)}>{[...Array(11)].map((_, i) => { const a = -Math.PI * (0.08 + 0.84 * i / 10), k = L(f, 6, 22, 0, 1, Easing.out(Easing.cubic));
            return <path key={i} d={`M ${540 + Math.cos(a) * 220} ${SURF} q ${Math.cos(a) * 120 * k} ${-170 * k} ${Math.cos(a) * 230 * k} ${-60 * k}`} stroke="#E6F7FF" strokeWidth={14} fill="none" strokeLinecap="round" />; })}</g>}
          {f >= LAND && f < LAND + 40 && [...Array(14)].map((_, i) => { const side = i % 2 ? 1 : -1, k = L(f, LAND, LAND + 40, 0, 1, Easing.out(Easing.cubic));
            return <circle key={i} cx={540 + side * (380 + k * (60 + i * 14))} cy={FLOOR - 20 - k * (20 + (i % 4) * 26)} r={30 + k * 40} fill="#8C8F96" opacity={0.7 * (1 - k)} />; })}
          <Bracket x={880} y0={SURF} y1={FLOOR - EVEREST_H} k={b2} side={1} />
          <Bracket x={215} y0={FLOOR} y1={FLOOR - EVEREST_H} k={b9} side={-1} color="#FFFFFF" />
        </g>
        {/* labels are drawn on the screen (they stay readable whatever the zoom) */}
        <g opacity={1 - L(f, tIn - 8, tIn, 0, 1)}>
          <Chip x={560} y={120} text="THE DEEPEST PLACE ON EARTH" s={1 + 0.03 * Math.sin(f * 0.15)} anchor="middle" rot={-1} size={52} fill="#FFFFFF" />
          {f >= LAND + 2 && <Chip x={600} y={860} text="MOUNT EVEREST" s={clamp(sp(f, LAND + 2, 'sticker'), 0, 1.1)} anchor="middle" fill="#FFFFFF" rot={-3} />}
          {f >= cTwo && <Chip x={860} y={300} text="2 KM OF WATER" s={clamp(sp(f, cTwo + 4, 'sticker'), 0, 1.1)} anchor="end" rot={2} size={58} />}
          {f >= cNine && <Chip x={600} y={960} anchor="middle" text="8.8 KM TALL" s={clamp(sp(f, cNine + 4, 'sticker'), 0, 1.1)} rot={-4} size={58} fill="#FFFFFF" />}
        </g>
      </g>
    );
    if (f >= tIn) world = <g>{world}<rect width={VW} height={VH} fill="#7FD0F5" opacity={L(f, tIn + 8, tIn + 14, 0, 1)} /></g>;
  } else if (f < tDive + 10) {
    // 2. FLOATING: a calm sea, the sun hot on your neck; a line rises out of the deep, takes your ankles; ANTICIPATION (the body lifts
    //    and stiffens for a few frames), the YANK, follow-through (the splash crown, the bubbles, the swing to feet-down)
    const g = f - tIn;
    const sea = 1040;
    const heat = L(f, cSun, cSun + 20, 0, 1) * (1 - L(f, cTug, cTug + 8, 0, 1));
    const ant = L(f, cTug - 2, cTug + 4, 0, 1) * (1 - L(f, cTug + 4, cTug + 10, 0, 1));   // the jolt
    const yank = L(f, cUnder - 2, cUnder + 14, 0, 1, Easing.bezier(0.55, 0, 0.9, 0.6));
    const camY = L(f, cUnder + 6, tDive, 0, 700, Easing.in(Easing.quad));   // the camera follows you under
    const s = 0.3, rot = -90 + 90 * yank - 12 * ant;
    const bx = 540 - 1090 * s / 2 + 30, by = sea - 14 + Math.sin(f * 0.08) * 5 - 30 * ant + yank * 820;
    const ankle = place(bx, by, rot, s, 0, 1080);
    const lineK = L(f, cSomething - 6, cTug, 0, 1);
    const zoomIn = 2.0 - 0.25 * L(g, 0, 40, 0, 1, Easing.out(Easing.cubic)) + 0.12 * L(f, cSomething, cTug, 0, 1) - 0.45 * L(f, cUnder, cUnder + 20, 0, 1);
    const shake = f >= cTug && f < cTug + 14 ? Math.sin((f - cTug) * 2.1) * (14 - (f - cTug)) * 1.4 : 0;
    world = (
      <g transform={`translate(${VW / 2 + shake} ${VH / 2}) scale(${zoomIn}) translate(${-560 + hand[0] * 0.6} ${-960 - camY + hand[1] * 0.6})`}>
        <linearGradient id="v-sky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4FA3E6" /><stop offset="1" stopColor="#D9F0FF" /></linearGradient>
        <rect x={-200} y={-200} width={VW + 400} height={sea + 260} fill="url(#v-sky2)" />
        <Sun x={660} y={690} r={56} f={f} heat={heat} />
        {heat > 0.05 && [...Array(4)].map((_, i) => <path key={i} d={`M ${300 + i * 60} ${880 - ((f * 2 + i * 20) % 60)} q 12 -14 0 -28 q -12 -14 0 -28`} fill="none" stroke="#FF8C42" strokeWidth={6} opacity={0.7 * heat} strokeLinecap="round" />)}
        <linearGradient id="v-under" gradientUnits="userSpaceOnUse" x1="0" y1={sea} x2="0" y2={sea + 1800}><stop offset="0" stopColor="#3FB0E8" /><stop offset="1" stopColor="#1C6EA8" /></linearGradient>
        <path d={wavePath(f, sea, 12, 0, -200, VW + 200, sea + 2400)} fill="url(#v-under)" stroke={INK} strokeWidth={6} />
        {[...Array(5)].map((_, i) => <path key={i} d={`M ${40 + i * 230 + Math.sin(f * 0.03 + i) * 25} ${sea + 10} l 70 0 l 160 1300 l -90 0 Z`} fill="#D6F1FF" opacity={0.13} />)}
        {/* the line from the deep (only a dark line: who is pulling is the full video's surprise) */}
        {lineK > 0 && <path d={`M ${ankle[0]} ${ankle[1]} C ${ankle[0] + 60 * (1 - ant)} ${ankle[1] + 300} ${ankle[0] - 40} ${sea + 900} ${ankle[0] + 10} ${sea + 2600}`}
          fill="none" stroke="#10151C" strokeWidth={9} strokeDasharray={`${3000 * lineK} 4000`} strokeLinecap="round" opacity={0.9} />}
        <You f={f} pose={yank > 0.3 ? 'wade' : 'lie'} expr={f >= cTug ? (yank > 0.2 ? 'scared' : 'shock') : 'calm'} rot={rot} x={bx} y={by} s={s} />
        {/* the front of the sea over the lower half of the floating body */}
        <path d={wavePath(f + 20, sea + 6, 9, 1.5, -200, VW + 200, sea + 140)} fill="#3FB0E8" opacity={0.9} />
        {yank < 0.2 && <path d={`M ${bx + 60} ${sea + 2} q 40 -10 80 0 q 40 10 80 0`} stroke="#E6F7FF" strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.85} />}
        {f >= cUnder && <g opacity={1 - L(f, cUnder + 10, cUnder + 30, 0, 1)}>
          {[...Array(9)].map((_, i) => { const a = -Math.PI * (0.15 + 0.7 * i / 8); const k = L(f, cUnder, cUnder + 16, 0, 1, Easing.out(Easing.cubic));
            return <path key={i} d={`M ${540 + Math.cos(a) * 40} ${sea} q ${Math.cos(a) * 80 * k} ${-140 * k} ${Math.cos(a) * 150 * k} ${-60 * k}`} stroke="#E6F7FF" strokeWidth={12} fill="none" strokeLinecap="round" />; })}
        </g>}
        {f >= cUnder && <Bubbles x={540} y={by + 120} f={f} f0={cUnder} n={14} seed={4} s={1.2} />}
        {f >= cTug && f < cUnder + 6 && <g transform={`translate(${bx - 20} ${by - 150}) scale(${clamp(sp(f, cTug, 'sticker'), 0, 1.2)}) rotate(-8)`}>
          <text x={0} y={0} fontFamily={OSWALD} fontWeight={700} fontSize={120} fill="#FDE047" stroke={INK} strokeWidth={10} paintOrder="stroke" textAnchor="middle">!?</text></g>}
      </g>
    );
    world = <g>{world}<rect width={VW} height={VH} fill="#7FD0F5" opacity={1 - L(f, tIn + 14, tIn + 18, 0, 1)} />
      {f > cUnder + 12 && <BubbleWipe k={L(f, cUnder + 12, tDive, 0, 0.45)} />}</g>;
  } else if (f < tOut) {
    // 3. THE DIVE: the camera rides down with you; green, then blue, then grey arrive on their words; the light closes in
    const col = keys(f, [[tDive, '#2C9AD4'], [cGreen + 6, '#2F8F7A'], [cBlue + 6, '#1C4E9E'], [cGrey + 6, '#3A4352'], [cDark + 6, '#11161D'], [cDarker + 10, '#04060A']]);
    const col2 = keys(f, [[tDive, '#1A6FA6'], [cGreen + 6, '#1D6153'], [cBlue + 6, '#11346E'], [cGrey + 6, '#262D38'], [cDark + 6, '#0A0D12'], [cDarker + 10, '#020305']]);
    const depth = num(f, [[tDive, 12], [cGreen, 60], [cBlue, 180], [cGrey, 420], [cPop, 560], [cKick, 720], [cDark, 950], [tOut + 16, 1300]]);
    const speed = clamp(0.4 + 0.6 * L(f, cKick, cDrop + 10, 0, 1) - 0.3 * L(f, cKick - 4, cKick + 10, 0, 1) * (1 - L(f, cKick + 10, cDrop, 0, 1)), 0, 1);
    const ramp = (x) => (x <= 0 ? 0 : x < 30 ? (x * x) / 60 : x - 15);   // a speed that grows over a second, never in one frame
    const rise = (f - tDive) * 9 + 8 * ramp(f - cDrop + 10);
    const rays = 1 - L(f, cGreen, cGrey + 10, 0, 1);
    const light = L(f, cGrey, cDarker + 10, 1, 0.15);
    const popK = f >= cPop ? L(f, cPop, cPop + 14, 0, 1, Easing.out(Easing.cubic)) : 0;
    const pushIn = L(f, cPop - 14, cPop + 1, 0, 1) * (1 - L(f, cKick - 6, cKick + 18, 0, 1));
    const pullOut = L(f, cDrop, cDark + 12, 0, 1);
    const z = 1 + 0.42 * pushIn - 0.22 * pullOut;
    const sway = Math.sin(f * 0.07) * 5 + (f < cKick ? Math.sin(f * 0.3) * 4 : 0);
    const kicking = f >= cKick - 2;
    const yx = 540, yy = 640 + 40 * Math.sin(f * 0.05) - 60 * L(f, cKick, cKick + 12, 0, 1) * (1 - L(f, cKick + 12, cDrop, 0, 1));   // the kick lifts you, for a moment
    const s = 0.42;
    const head = place(yx, yy, sway, s, 0, 0);
    const ankle = place(yx, yy, sway, s, 0, 1080);
    const camCx = 540 + hand[0], camCy = ((head[1] + 380 / z) * pushIn + 960 * (1 - pushIn)) + hand[1];   // pushed in: the head at ~40% height
    const fadeIn = L(f, tDive + 10, tDive + 20, 0, 1);
    world = (
      <g>
        <linearGradient id="v-dive" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={col} /><stop offset="1" stopColor={col2} /></linearGradient>
        <rect width={VW} height={VH} fill="url(#v-dive)" />
        {rays > 0.02 && [...Array(5)].map((_, i) => <path key={i} d={`M ${-40 + i * 260 + Math.sin(f * 0.025 + i) * 30} -40 l 90 0 l 220 ${VH + 80} l -120 0 Z`} fill="#D6F1FF" opacity={0.16 * rays} />)}
        <Snow rise={rise} f={f} op={0.6 + 0.4 * (1 - light)} />
        {f > cGreen - 10 && f < cGrey + 20 && [...Array(9)].map((_, i) => {   // a school of small fish crossing the green water
          const t = (f - cGreen + 10) / 50, x = -140 + t * 1400 - (i % 3) * 70, y = 1250 - Math.floor(i / 3) * 60 - t * 220 + (i % 2) * 24 - rise * 0.35 + 500;
          return <g key={i} transform={`translate(${x} ${y}) scale(${1 + (i % 2) * 0.2})`} opacity={0.75}><path d="M -26 0 C -10 -14 14 -14 26 0 C 14 14 -10 14 -26 0 Z M -26 0 L -42 -12 L -42 12 Z" fill="#0E3B33" /></g>; })}
        {f > cGrey && [...Array(14)].map((_, i) => { const R = rng(70 + i); const x = R() * VW, y = R() * VH, blink = Math.max(0, Math.sin(f * 0.18 + i * 1.7));
          return <circle key={i} cx={x} cy={(y - rise * 0.5) % VH + (y - rise * 0.5 < 0 ? VH : 0)} r={6 + 6 * blink} fill={i % 3 ? '#5EEAD4' : '#60A5FA'} opacity={0.75 * blink * L(f, cGrey, cGrey + 20, 0, 1)} />; })}
        {f > cDark - 30 && (() => { const t = (f - cDark + 30) / 80, x = 900 - t * 90, y = 1500 - t * 900;
          return <g transform={`translate(${x} ${y})`} opacity={L(f, cDark - 30, cDark, 0, 0.9)}>
            <circle cx={0} cy={0} r={90} fill="#67E8F9" opacity={0.12} />
            <path d="M -60 0 C -60 -60 60 -60 60 0 Z" fill="#A5F3FC" opacity={0.55} stroke="#CFFAFE" strokeWidth={4} />
            {[...Array(5)].map((_, k) => <path key={k} d={`M ${-44 + k * 22} 0 q ${8 * Math.sin(f * 0.2 + k)} 40 0 ${80 + k * 6} q ${-8 * Math.sin(f * 0.2 + k)} 30 0 50`} fill="none" stroke="#A5F3FC" strokeWidth={4} opacity={0.7} />)}
          </g>; })()}
        <Streaks rise={rise} speed={speed * L(f, cDrop - 10, cDrop + 10, 0.3, 1)} />
        <g transform={`translate(${VW / 2} ${VH / 2}) scale(${z}) translate(${-camCx} ${-camCy})`}>
          <path d={`M ${ankle[0]} ${ankle[1]} C ${ankle[0] + 20} ${ankle[1] + 300} ${ankle[0] - 30} ${ankle[1] + 700} ${ankle[0]} ${VH + 600}`} fill="none" stroke="#0A0E14" strokeWidth={9} strokeLinecap="round" />
          <You f={f} pose={kicking ? 'run' : 'flail'} expr={f >= cPop && f < cKick ? 'shock' : 'scared'} rot={sway} x={yx} y={yy} s={s} kick={kicking} />
          <Bubbles x={head[0] + 20} y={head[1] + 40} f={f} f0={tDive} n={6} seed={9} s={0.9} />
          {popK > 0 && popK < 1 && [-1, 1].map((sd) => <g key={sd}>
            {[0, 1, 2].map((r) => <circle key={r} cx={head[0] + sd * 64} cy={head[1] + 4} r={14 + popK * (50 + r * 26)} fill="none" stroke="#FFE11A" strokeWidth={8 - r * 2} opacity={1 - popK} />)}
          </g>)}
        </g>
        {/* the dark closes in: a hole of light around you that shrinks with depth */}
        <radialGradient id="v-dark" cx={0.5} cy={0.42} r={0.75 * light + 0.25}><stop offset="0.35" stopColor="#000" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.92} /></radialGradient>
        <rect width={VW} height={VH} fill="url(#v-dark)" opacity={1 - light * 0.8} />
        {f >= cPop - 4 && f < cPop + 34 && <Chip x={VW / 2 + (head[0] - camCx) * z + 90} y={VH / 2 + (head[1] - camCy) * z - 150} size={92} text="POP!" s={clamp(sp(f, cPop - 4, 'sticker'), 0, 1.15) * (1 - L(f, cPop + 24, cPop + 34, 0, 1))} rot={8} size={70} />}
        {/* the depth meter (top left, clear of the Shorts buttons) */}
        <g transform="translate(60 170)" opacity={fadeIn}>
          <rect x={0} y={0} width={360} height={150} fill="#0B1F3A" opacity={0.85} stroke={INK} strokeWidth={6} />
          <text x={22} y={44} fontFamily={OSWALD} fontWeight={600} fontSize={32} fill="#9CC9F0" letterSpacing={3}>DEPTH</text>
          <text x={22} y={126} fontFamily={OSWALD} fontWeight={700} fontSize={82} fill="#FDE047">{Math.round(depth).toLocaleString('en-US')} M</text>
        </g>
        {f < tDive + 14 && <BubbleWipe k={L(f, tDive, tDive + 14, 0.45, 1)} />}
      </g>
    );
  } else {
    // 4. THE SCALE: pull far back to the dark section; you are a glowing speck a kilometre and a bit down; the bracket measures the
    //    whole column, a pin marks the deepest point, and the speck keeps falling toward it. 5. the end card.
    const k = L(f, tOut, tOut + 56, 0, 1, Easing.inOut(Easing.cubic));
    const speckY = SURF + num(f, [[tOut, 1.2], [cWay, 1.7], [end, 2.4]]) * KM;
    const k2 = L(f, tOut + 18, tOut + 48, 0, 1);   // you stay in the middle while the camera pulls out, THEN the frame settles on the column
    const cy = speckY + (960 - speckY) * k2;   // the pull-back starts ON you and opens to the whole column
    const z = 10 - 9 * k + 0.08 * L(f, cDeepest, end, 0, 1);
    const b = sp(f, cEleven, 'snap');
    const pin = sp(f, cDeepest, 'sticker');
    const endK = f >= tEnd ? L(f, tEnd, tEnd + 12, 0, 1) : 0;
    const speckSy = VH / 2 + (speckY - cy - hand[1] * 0.5) * z;
    world = (
      <g>
        <g transform={`translate(${VW / 2} ${VH / 2}) scale(${z}) translate(${-540 - hand[0] * 0.5} ${-cy - hand[1] * 0.5})`}>
          <Section f={f} dark={0.97 - 0.12 * L(f, tOut + 30, tOut + 60, 0, 1)} ruler={L(f, tOut + 46, tOut + 58, 0, 1)} />
          <path d={`M 540 ${speckY} L 540 ${FLOOR - 30}`} stroke="#FDE047" strokeWidth={4} strokeDasharray="10 14" opacity={0.6 * L(f, tOut + 50, tOut + 62, 0, 1)} />
          {k < 0.7 && <g opacity={1 - L(f, tOut + 12, tOut + 22, 0, 1)}><You f={f} pose="kick" expr="scared" x={540} y={speckY - (250 / z) * (1 - k)} s={0.33 / z} kick /></g>}
          <g opacity={(1 - endK) * L(f, tOut + 22, tOut + 32, 0, 1)}><circle cx={540} cy={speckY} r={26 + 6 * Math.sin(f * 0.25)} fill="#FDE047" opacity={0.25} />
          <circle cx={540} cy={speckY} r={10} fill="#FFF7B0" stroke={INK} strokeWidth={4} /></g>
          <Bracket x={880} y0={SURF} y1={FLOOR} k={b} side={1} />
          {pin > 0.01 && <g transform={`translate(540 ${FLOOR}) scale(${clamp(pin, 0, 1.15)})`}>
            {[0, 1].map((r) => <circle key={r} cx={0} cy={0} r={26 + ((f * 1.2 + r * 30) % 50) * 0.9} fill="none" stroke="#EF4444" strokeWidth={6} opacity={1 - ((f * 1.6 + r * 40) % 80) / 80} />)}
            <path d="M 0 0 C -36 -50 -46 -76 -46 -100 A 46 46 0 1 1 46 -100 C 46 -76 36 -50 0 0 Z" fill="#EF4444" stroke={INK} strokeWidth={7} />
            <circle cx={0} cy={-100} r={17} fill="#FFFFFF" stroke={INK} strokeWidth={5} />
          </g>}
          {f >= cDeepest && <g opacity={1 - endK}><path d={`M 500 ${FLOOR - 120} L 470 ${FLOOR - 170}`} stroke="#FFFFFF" strokeWidth={6} />
            <Chip x={490} y={FLOOR - 250} text="CHALLENGER DEEP" s={clamp(sp(f, cDeepest + 5, 'sticker'), 0, 1.1)} fill="#EF4444" color="#FFFFFF" rot={-2} size={54} anchor="end" /></g>}
        </g>
        <rect width={VW} height={VH} fill="#04060A" opacity={0.75 * (1 - L(f, tOut, tOut + 14, 0, 1))} />
        <g opacity={1 - endK}>
          {f >= cEleven && <Chip x={860} y={680} text="10,935 M" s={clamp(sp(f, cEleven + 3, 'sticker'), 0, 1.1)} anchor="end" rot={-2} size={80} />}
          {f >= tOut + 50 && <Chip x={590} y={speckSy - 130} text="YOU" s={clamp(sp(f, tOut + 50, 'sticker'), 0, 1.1)} rot={-6} size={54} fill="#FDE047" />}
        </g>
        {endK > 0 && (
          <g>
            <rect width={VW} height={VH} fill="#02060C" opacity={endK} />
            <linearGradient id="v-beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#FDE047" stopOpacity={0.55} /><stop offset="1" stopColor="#FDE047" stopOpacity={0} /></linearGradient>
            <path d={`M ${470 + 30 * Math.sin(f * 0.04)} ${VH} L ${610 + 30 * Math.sin(f * 0.04)} ${VH} L ${760} 1240 L ${320} 1240 Z`} fill="url(#v-beam)" opacity={endK} />
            {[...Array(12)].map((_, i) => { const R2 = rng(600 + i); const x = 380 + R2() * 320, y = VH - ((f * (1 + R2()) * 2 + R2() * 600) % 640);
              return <circle key={i} cx={x} cy={y} r={3 + R2() * 4} fill="#FFF7B0" opacity={endK * 0.8} />; })}
            <g transform={`translate(540 380) scale(${clamp(spr((f - tEnd) / 30, 10, 0.9), 0, 1.05) * (1 + 0.04 * L(f, tEnd, end, 0, 1))})`}>
              <Chip x={-250} y={-60} text="YOU" size={120} fill="#FDE047" rot={-4} anchor="middle" />
              <text x={-40} y={60} fontFamily={OSWALD} fontWeight={700} fontSize={86} fill="#FFFFFF" textAnchor="middle" stroke={INK} strokeWidth={10} paintOrder="stroke">vs</text>
              <Chip x={190} y={-60} text="11 KM" size={120} fill="#FFFFFF" rot={3} anchor="middle" />
            </g>
            {f >= cWhat && <g transform={`translate(540 700) scale(${clamp(sp(f, cWhat, 'snap'), 0, 1.08)})`}><Chip x={0} y={-80} text="WHAT'S WAITING" size={90} fill="#FFFFFF" rot={-2} anchor="middle" /></g>}
            {f >= cAt && <g transform={`translate(540 840) scale(${clamp(sp(f, cAt, 'snap'), 0, 1.08)})`}><Chip x={0} y={-80} text="AT THE BOTTOM?" size={90} fill="#FDE047" rot={2} anchor="middle" /></g>}
            {f >= cWhole && <g transform={`translate(540 1010) scale(${clamp(sp(f, cWhole, 'sticker'), 0, 1.1)})`}><Chip x={0} y={0} text="THE WHOLE DIVE" size={66} fill="#EF4444" color="#FFFFFF" rot={-1} anchor="middle" /></g>}
            {f >= cChannel - 6 && <g transform={`translate(540 1130) scale(${clamp(sp(f, cChannel - 6, 'sticker'), 0, 1.1)})`}><Chip x={0} y={0} text="IS ON OUR CHANNEL" size={66} fill="#FFFFFF" rot={1} anchor="middle" /></g>}
          </g>
        )}
      </g>
    );
  }
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <style>{FONT_CSS}</style>
      <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`}>{world}</svg>
      {captions && <VCaptions lines={lines} stop={L5.start - 8} />}
    </AbsoluteFill>
  );
};

// the words, big, in the middle-low band a Short's viewers read (clear of the title at the top and the buttons at the bottom/right):
// up to 3 words at a time, the spoken one yellow, popping in on its own word
const chunks3 = (ws) => {
  const out = []; let cur = [];
  ws.forEach((w, i) => {
    let leftIncl = 0;   // this word and the rest of its sentence
    for (let j = i; j < ws.length; j++) { leftIncl++; if (/[.,!?;:]$/.test(ws[j][0])) break; }
    if (cur.length >= 2 && leftIncl === 3) { out.push(cur); cur = []; }
    cur.push(i);
    const stop = /[.,!?;:]$/.test(w[0]);
    const small = /^(a|an|the|of|to|and|or|on|in|at|is|if|so|that|your|its|toward|than|any)$/i.test(w[0].replace(/[^a-z']/gi, ''));
    const next = ws[i + 1], len = cur.map((k) => ws[k][0]).join(' ').length;
    const long = next && len + 1 + next[0].length > 18 && !small;
    let left = 0;   // words left in this sentence after this one
    for (let j = i + 1; j < ws.length; j++) { left++; if (/[.,!?;:]$/.test(ws[j][0])) break; }
    const tail = false && left;
    if (stop || long || tail || (cur.length >= 3 && !small) || cur.length >= 5) { out.push(cur); cur = []; }
  });
  if (cur.length) out.push(cur);
  return out;
};
const VCaptions = ({lines, stop = 1e9}) => {
  const frame = useCurrentFrame();
  if (frame >= stop) return null;   // the end card says its own words
  const ws = lines.flatMap((l) => l.words || []);
  if (!ws.length) return null;
  const ch = chunks3(ws);
  const ci = ch.findIndex((c, k) => frame >= ws[c[0]][1] - 2 && (k + 1 >= ch.length || frame < ws[ch[k + 1][0]][1] - 2));
  if (ci < 0) return null;
  const c = ch[ci];
  const lastEnd = ws[c[c.length - 1]][1] + 18;
  const nextStart = ci + 1 < ch.length ? ws[ch[ci + 1][0]][1] - 2 : 1e9;
  if (frame > lastEnd && nextStart - frame > 6) return null;
  const now = c.reduce((a, i) => (ws[i][1] <= frame ? i : a), c[0]);
  const s = 0.85 + 0.15 * clamp((frame - ws[c[0]][1] + 2) / 3, 0, 1);
  return (
    <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center', paddingTop: 1330}}>
      <div style={{width: 760, marginRight: 60, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 20, textAlign: 'center', transform: `scale(${s})`, fontFamily: OSWALD, fontWeight: 700, fontSize: 80, lineHeight: 1.08,
        textTransform: 'uppercase', letterSpacing: 1, WebkitTextStroke: '14px #0A0A0A', paintOrder: 'stroke fill', textShadow: '0 8px 0 rgba(0,0,0,0.45)'}}>
        {c.map((i, k) => <span key={i} style={{color: i === now ? '#FDE047' : '#FFFFFF'}}>{ws[i][0].replace(/[.,;:]$/, '')}</span>)}
      </div>
    </AbsoluteFill>
  );
};
