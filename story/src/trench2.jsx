// Storygraphics #5, "You vs 11 km", the full video (2.74.2): the wide scenes. Most of the story is ONE world: the water column at a
// depth that keeps falling line after line (p.from -> p.to metres, read on the line's absolute clock so specks, light and the depth
// meter carry across every cut), with Pip's yellow sub, the creatures of each zone passing the window, and the numbers popping on
// their words. Around it: the cross-section, the surface, the cabin, the 1960 and 2019 flashbacks, the pressure stamp, the fish line,
// the floor, the cup. The reference repos' rules hold here too: the camera always drifts, something new every 2-4 s, springs in
// tiers, anticipation before a hit. Every scene takes {f, len, line}; line.start + f = the absolute frame.
import React from 'react';
import {interpolate, Easing} from 'remotion';
import {noise2D} from '@remotion/noise';
import {W, H, INK, ST, st, clamp, lin, pop, rng, Bust, Head, Box, Label, Figure, at, Labels, OSWALD} from './tis';
import {Whale} from './meg2';

const P = (line) => line.p || {};
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * clamp(t, 0, 1)).toString(16).padStart(2, '0')).join(''); };
const spr = (x, w = 15, z = 0.72) => { if (x <= 0) return 0; const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x)); };
const TIER = {snap: [24, 0.8], card: [15, 0.72], heavy: [10, 0.92], sticker: [18, 0.45]};
const sp = (f, a, tier = 'card') => clamp(spr((f - a) / 30, ...TIER[tier]), 0, 1.15);
const io = Easing.bezier(0.45, 0, 0.55, 1);
const hand = (T, k = 1) => [noise2D('hx', T * 0.02, 0) * 14 * k, noise2D('hy', 0, T * 0.02) * 10 * k];
const fmtM = (m) => `${Math.round(m).toLocaleString('en-US')} M`;
const cupAt = (m) => 1 - 0.58 * clamp(m / 11000, 0, 1);   // the foam cup in the mesh bag shrinks as the pressure grows (0.42 at the bottom)

// the water's colour by depth (metres): sunlit blue -> twilight -> black
const DEPTH = [[0, '#47AEE2'], [100, '#2B8BC4'], [200, '#1F6FA8'], [600, '#14477D'], [1000, '#0C2C52'], [4000, '#071A34'], [6000, '#050F22'], [11000, '#020812']];
export const waterAt = (m) => {
  if (m <= DEPTH[0][0]) return DEPTH[0][1];
  for (let i = 1; i < DEPTH.length; i++) if (m <= DEPTH[i][0]) return mix(DEPTH[i - 1][1], DEPTH[i][1], (m - DEPTH[i - 1][0]) / (DEPTH[i][0] - DEPTH[i - 1][0]));
  return DEPTH[DEPTH.length - 1][1];
};
// the depth of a line now: from p.from to p.to over the line (its words' span), eased
const depthOf = (line, f, len) => { const p = P(line); const a = p.from != null ? p.from : 0, b = p.to != null ? p.to : a; return a + (b - a) * io(clamp(f / Math.max(1, len), 0, 1)); };

// ───────────── the water itself ─────────────
function Water({m, T, glow = 0, uid = ''}) {
  const R = rng(17);
  const light = clamp(1 - m / 900, 0, 1);
  const rise = T * 1.6;
  return (
    <g>
      <linearGradient id={`tw-water${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={waterAt(Math.max(0, m - 250))} /><stop offset="1" stopColor={waterAt(m + 250)} /></linearGradient>
      <rect x={-200} y={-200} width={W + 400} height={H + 400} fill={`url(#tw-water${uid})`} />
      {light > 0.02 && [...Array(6)].map((_, i) => <path key={i} d={`M ${120 + i * 330 + Math.sin(T * 0.02 + i) * 30} -40 l 110 0 l 260 ${H + 80} l -140 0 Z`} fill="#D6F1FF" opacity={0.14 * light} />)}
      {[...Array(90)].map((_, i) => { const layer = i % 3, k = [0.4, 0.8, 1.4][layer], r = [2.5, 4, 6.5][layer];
        const x = R() * W, y0 = R() * H, y = ((y0 - rise * k) % (H + 40) + H + 40) % (H + 40) - 20;
        return <circle key={i} cx={x + Math.sin(T * 0.02 + i) * 8} cy={y} r={r} fill="#E6F4FF" opacity={[0.22, 0.34, 0.5][layer] * (0.7 + 0.3 * (1 - light))} />; })}
      {glow > 0 && [...Array(22)].map((_, i) => { const Q = rng(90 + i); const x = Q() * W, y = Q() * H * 0.95, b = Math.max(0, Math.sin(T * 0.13 + i * 1.9));
        return <circle key={'g' + i} cx={x} cy={((y - rise * 0.6) % H + H) % H} r={(5 + 7 * b) * (glow > 1 ? 1.9 : 1)} fill={i % 3 ? '#5EEAD4' : '#60A5FA'} opacity={Math.min(1, 0.8 * b * glow)} />; })}
    </g>
  );
}

// ───────────── Pip's yellow sub (TIS look), with the cup in its mesh bag ─────────────
export function YSub({T, x = 0, y = 0, s = 1, beam = 0, cup = 1, pipExpr = 'smile', youExpr = 'worried', hatchOpen = 0, flip = false, youOut = false, bag = true, solo = false}) {
  const prop = T * 0.4;
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      {beam > 0 && <path d="M -260 30 L -1500 -380 L -1500 520 Z" fill="#FFF6C8" opacity={0.22 * beam} />}
      {/* the mesh bag on its clip, the cup inside (cup = its size, 1 = new) */}
      {bag && <path d="M 60 120 L 60 170" stroke={INK} strokeWidth={6} />}
      {bag && <g transform="translate(60 230)">
        <path d="M -48 -60 L 48 -60 L 40 50 L -40 50 Z" fill="none" stroke="#E5E7EB" strokeWidth={4} />
        {[...Array(5)].map((_, i) => <path key={i} d={`M ${-46 + i * 23} -60 L ${-38 + i * 19} 50`} stroke="#E5E7EB" strokeWidth={3} />)}
        {[...Array(4)].map((_, i) => <path key={'h' + i} d={`M -46 ${-34 + i * 22} L 46 ${-34 + i * 22}`} stroke="#E5E7EB" strokeWidth={3} />)}
        <g transform={`translate(0 ${30 - 34 * cup}) scale(${cup})`}>
          <path d="M -28 -36 L 28 -36 L 20 34 L -20 34 Z" fill="#FFFFFF" {...st(4)} />
          <path d="M -14 -6 q 8 -10 14 0 q 6 10 14 0" stroke="#2563EB" strokeWidth={4} fill="none" />
        </g>
      </g>}
      {/* skids, fins, propeller */}
      <path d="M -170 118 L 170 118" stroke={INK} strokeWidth={10} strokeLinecap="round" />
      <path d="M -110 80 L -130 118 M 110 80 L 130 118" stroke={INK} strokeWidth={8} />
      <path d="M 200 -10 L 260 -60 L 270 60 L 210 20 Z" fill="#E0A82E" {...st(6)} />
      <g transform="translate(272 0)"><ellipse rx={12} ry={70 * Math.abs(Math.cos(prop))} fill="#475569" {...st(5)} /></g>
      <ellipse cx={0} cy={0} rx={240} ry={118} fill="#FACC15" {...st(8)} />
      <path d="M -200 50 C -120 100 120 104 210 46 C 140 120 -140 120 -200 50 Z" fill="#E0A82E" />
      {/* the hatch on top */}
      <g transform="translate(-20 -112)"><rect x={-56} y={-34} width={112} height={42} rx={12} fill="#FACC15" {...st(7)} />
        <g transform={`translate(-56 -34) rotate(${-110 * hatchOpen})`}><rect x={0} y={-12} width={112} height={14} rx={6} fill="#E0A82E" {...st(5)} /></g></g>
      {/* two portholes: Pip (front) and you */}
      {[[-130, 'pip', pipExpr], [10, 'you', youExpr]].map(([px, who, ex]) => (
        <g key={who} transform={`translate(${px} -6)`}>
          <circle r={58} fill="#9CA3AF" {...st(7)} />
          <circle r={46} fill="#BFE6FF" />
          <clipPath id={`tw-port-${who}`}><circle r={46} /></clipPath>
          <g clipPath={`url(#tw-port-${who})`}>{!(who === 'you' && youOut) && !(who === 'pip' && solo) && <g transform="translate(0 16) scale(0.26)"><Head who={who} expr={ex} f={T} seed={who === 'pip' ? 2 : 5} /></g>}</g>
          <path d="M -28 -30 q 16 -12 34 -8" stroke="#fff" strokeWidth={6} fill="none" opacity={0.6} strokeLinecap="round" />
        </g>
      ))}
      {beam > 0 && <circle cx={-236} cy={20} r={16} fill="#FFF6C8" {...st(5)} />}
    </g>
  );
}

// ───────────── the creatures ─────────────
const Snailfish = ({s = 1, T = 0, flip = false}) => (
  <g transform={`scale(${flip ? -s : s} ${s})`} opacity={0.92}>
    <path d={`M -120 0 C -150 ${-10 + Math.sin(T * 0.2) * 14} -190 ${Math.sin(T * 0.2) * 22} -210 ${Math.sin(T * 0.2) * 26} C -170 30 -120 30 -60 34 C 20 40 70 34 80 0 C 74 -40 30 -52 -20 -46 C -70 -40 -100 -20 -120 0 Z`} fill="#F9C6D3" stroke="#BE6B83" strokeWidth={5} opacity={0.88} />
    <path d="M -40 -44 C -60 -70 -110 -60 -150 -20" fill="none" stroke="#F4A3B8" strokeWidth={6} opacity={0.8} />
    <path d="M -40 34 C -70 60 -120 50 -160 22" fill="none" stroke="#F4A3B8" strokeWidth={6} opacity={0.8} />
    <ellipse cx={-10} cy={-6} rx={40} ry={22} fill="#E88AA4" opacity={0.35} />
    <circle cx={46} cy={-12} r={8} fill={INK} />
  </g>
);
const Jelly = ({s = 1, T = 0}) => (
  <g transform={`scale(${s})`}>
    <circle r={110} fill="#67E8F9" opacity={0.12} />
    <path d="M -70 0 C -70 -70 70 -70 70 0 Z" fill="#A5F3FC" opacity={0.6} stroke="#CFFAFE" strokeWidth={4} />
    {[...Array(6)].map((_, k) => <path key={k} d={`M ${-55 + k * 22} 0 q ${10 * Math.sin(T * 0.2 + k)} 46 0 ${90 + k * 6} q ${-10 * Math.sin(T * 0.2 + k)} 34 0 56`} fill="none" stroke="#A5F3FC" strokeWidth={4} opacity={0.7} />)}
  </g>
);
const Worm = ({s = 1, T = 0}) => (
  <g transform={`scale(${s})`}>
    <path d={`M -80 40 C -60 0 -20 ${10 + Math.sin(T * 0.1) * 6} 20 10 C 60 10 80 -20 110 -30`} fill="none" stroke="#E879A0" strokeWidth={26} strokeLinecap="round" />
    <path d="M 108 -30 C 140 -60 180 -50 176 -20 C 172 6 140 0 120 -18" fill="#F9A8C4" {...st(5)} />
  </g>
);
export const Amphipod = ({s = 1, T = 0, flip = false}) => (
  <g transform={`scale(${flip ? -s : s} ${s})`}>
    <path d="M -50 10 C -40 -26 30 -34 54 -6 C 40 6 10 18 -50 10 Z" fill="#F5E6C8" stroke="#A8916A" strokeWidth={4} />
    {[...Array(5)].map((_, i) => <path key={i} d={`M ${-30 + i * 16} 10 l ${-6 + Math.sin(T * 0.5 + i) * 6} 18`} stroke="#A8916A" strokeWidth={3} />)}
    <path d="M 50 -8 q 30 -20 44 -10 M 50 -4 q 28 -4 40 8" stroke="#A8916A" strokeWidth={3} fill="none" />
    <circle cx={42} cy={-12} r={4} fill={INK} />
  </g>
);
const Fish = ({s = 1}) => <g transform={`scale(${s})`}><path d="M -30 0 C -12 -16 16 -16 30 0 C 16 16 -12 16 -30 0 Z M -30 0 L -50 -14 L -50 14 Z" fill="#0E3B33" opacity={0.85} /></g>;
const Turtle = ({s = 1, T = 0}) => (
  <g transform={`scale(${s})`}>
    <ellipse cx={0} cy={0} rx={70} ry={44} fill="#4D7C3A" {...st(5)} />
    <path d="M -40 -20 L 0 -36 L 40 -20 L 36 20 L 0 34 L -36 20 Z" fill="#6B9E4F" stroke="#3A5E2B" strokeWidth={4} />
    <ellipse cx={86} cy={-4} rx={26} ry={18} fill="#9BBF7A" {...st(5)} /><circle cx={96} cy={-8} r={4} fill={INK} />
    <path d={`M 20 -36 q 30 ${-30 + Math.sin(T * 0.12) * 14} 60 -30`} stroke="#9BBF7A" strokeWidth={18} strokeLinecap="round" fill="none" />
    <path d={`M 20 36 q 30 ${30 - Math.sin(T * 0.12) * 14} 60 30`} stroke="#9BBF7A" strokeWidth={18} strokeLinecap="round" fill="none" />
  </g>
);
const CREATURES = {
  whale: (T, s) => <g transform={`scale(${s})`}><Whale len={760} f={T} /></g>,
  snailfish: (T, s) => <Snailfish s={s} T={T} />, jelly: (T, s) => <Jelly s={s} T={T} />, worm: (T, s) => <Worm s={s} T={T} />,
  amphipod: (T, s) => <g>{[0, 1, 2, 3, 4].map((i) => <g key={i} transform={`translate(${i * 90 - 180} ${Math.sin(T * 0.1 + i * 2) * 30 + (i % 2) * 50})`}><Amphipod s={s * (0.8 + (i % 3) * 0.2)} T={T + i * 9} /></g>)}</g>,
  fish: (T, s) => <g>{[...Array(12)].map((_, i) => <g key={i} transform={`translate(${(i % 4) * 70 - (Math.floor(i / 4)) * 30} ${Math.floor(i / 4) * 54 + Math.sin(T * 0.15 + i) * 6})`}><Fish s={s} /></g>)}</g>,
  turtle: (T, s) => <Turtle s={s} T={T} />,
};
// p.see = [{what, on (word), dir 1 left->right / -1, y, s, dur (frames to cross)}]
const Passers = ({line, f, T}) => (P(line).see || []).map((c, i) => {
  const a = at(line, c.on || '', 0.1 + 0.2 * i) - (c.lead != null ? c.lead : 45);
  const dur = c.dur || 220;
  if (f < a - 2 || f > a + dur) return null;
  const k = (f - a) / dur, dir = c.dir || -1;
  const x = dir > 0 ? -400 + k * (W + 800) : W + 400 - k * (W + 800);
  const y = (c.y || 700) + Math.sin(T * 0.03 + i) * 20;
  const draw = CREATURES[c.what];
  return draw ? <g key={i} transform={`translate(${x} ${y}) scale(${dir > 0 ? -1 : 1} 1)`}>{draw(T, c.s || 1)}</g> : null;
});

// ───────────── shared screen pieces ─────────────
const People = ({line, f, T, x0 = 1640, y0 = 560, down = false}) => (P(line).people || []).map(([who, on, name], i) => {
  const a = at(line, on || '', 0.1 + 0.2 * i);
  if (f < a) return null;
  const s = sp(f, a, 'card');
  return (
    <g key={who} transform={`translate(${down ? x0 : x0 - i * 330} ${down ? y0 + i * 330 : y0}) scale(${s})`}>
      <circle r={150} fill="#F5E6C8" {...st(8)} />
      <clipPath id={`tw-pp-${who}`}><circle r={142} /></clipPath>
      <g clipPath={`url(#tw-pp-${who})`}><Bust who={who} x={0} y={-10} s={0.62} expr="calm" f={T} arms="rest" /></g>
      <g transform="translate(0 150)"><Box x={-(String(name).length * 17 + 40) / 2} y={0} w={String(name).length * 17 + 40} h={54} text={name} fill="#FFFFFF" rot={-2} /></g>
    </g>
  );
});

const Meter = ({m, f, x = W - 60, op = 1}) => (
  <g transform={`translate(${x} 40)`} opacity={op}>
    <rect x={-330} y={0} width={330} height={128} fill="#0B1F3A" opacity={0.88} stroke={INK} strokeWidth={6} />
    <text x={-310} y={38} fontFamily={OSWALD} fontWeight={600} fontSize={28} fill="#9CC9F0" letterSpacing={3}>DEPTH</text>
    <text x={-310} y={108} fontFamily={OSWALD} fontWeight={700} fontSize={70} fill="#FDE047">{fmtM(m)}</text>
  </g>
);
const Card = ({line, f, y = 300}) => {   // p.card = {head, big, sub, on, fill}: a fact card that pops on its word (heavy spring for the big number)
  const c = P(line).card;
  if (!c) return null;
  const a = at(line, c.on || '', 0.25);
  if (f < a) return null;
  const s = sp(f, a, 'heavy'), s2 = sp(f, a + 6, 'sticker');
  const wBig = Math.max(420, String(c.big).length * 76 + 80);
  return (
    <g transform={`translate(960 ${y})`}>
      {c.head && <g transform={`scale(${s2})`}><Box x={-(String(c.head).length * 28 + 60) / 2} y={-186} w={String(c.head).length * 28 + 60} h={80} text={c.head} fill="#FFFFFF" rot={-2} /></g>}
      <g transform={`scale(${s})`}><Box x={-wBig / 2} y={-90} w={wBig} h={150} text={c.big} fill={c.fill || '#FFE11A'} rot={1} /></g>
      {c.sub && <g transform={`scale(${s2})`}><Box x={-(String(c.sub).length * 30 + 60) / 2} y={90} w={String(c.sub).length * 30 + 60} h={84} text={c.sub} fill="#0B1F3A" color="#FFFFFF" rot={-1} /></g>}
    </g>
  );
};
const Chips = ({line, f, y0 = 230}) => (P(line).chips || []).map((c, i) => {   // p.chips = [[text, on, fill]]: stacked answers / options
  const [text, on, fill] = c;
  const a = at(line, on || '', 0.2 + i * 0.2);
  if (f < a) return null;
  const w = String(text).length * 30 + 70;
  return <g key={i} transform={`translate(960 ${y0 + i * 112}) scale(${sp(f, a, 'sticker')})`}><Box x={-w / 2} y={-44} w={w} h={88} text={text} fill={fill || '#FFFFFF'} rot={i % 2 ? 1.5 : -1.5} /></g>;
});

// ───────────── 1. the dive: the sub falling through the column ─────────────
function Dive({f, len, line}) {
  const p = P(line), T = line.start + f;
  const m = depthOf(line, f, len);
  const [hx, hy] = hand(T);
  const glow = p.blink ? 2 : m > 250 && m < 7000 ? clamp((m - 250) / 300, 0, 1) * (p.glow === false ? 0 : 1) : 0;
  const bob = Math.sin(T * 0.05) * 10;
  const cup = p.cup != null ? p.cup : cupAt(m);
  const beam = p.beam != null ? p.beam : (m > 900 ? 1 : 0);
  const v = Math.abs(Math.round(line.start / 7)) % 4;   // a camera per line: four framings in turn
  const push = lin(f, 0, len, p.z0 || [1.0, 1.12, 1.0, 1.08][v], p.z1 || [1.08, 1.0, 1.1, 1.0][v]);
  const subX = p.subx || [900, 700, 1120, 820][v];
  return (
    <g>
      <g transform={`translate(${W / 2 + hx} ${H / 2 + hy}) scale(${push}) translate(${-W / 2} ${-H / 2})`}>
        <Water m={m} T={T} glow={glow} uid={line.start} />
        {!(p.see || []).some((c) => c.front) && <Passers line={line} f={f} T={T} />}
        {!p.alone && <YSub T={T} x={subX} y={(p.suby || (p.card ? 600 : 470)) + bob} s={p.s || 1.15} beam={beam} cup={cup} pipExpr={p.pip || 'smile'} youExpr={p.you || 'worried'} />}
        {p.alone && <g transform={`translate(960 ${300 + bob}) rotate(${Math.sin(T * 0.07) * 7}) scale(0.5)`}><Figure who="you" pose="kick" expr="scared" f={T * 2} seed={3} shadow={false} /></g>}
        {p.alone && <path d={`M 960 ${860 + bob} C 980 940 940 1000 960 ${H + 60}`} fill="none" stroke="#0A0E14" strokeWidth={8} />}
        {(p.see || []).some((c) => c.front) && <Passers line={line} f={f} T={T} />}
        {m > 3000 && <rect x={-200} y={-200} width={W + 400} height={H + 400} fill="url(#tw-vig)" />}
        <radialGradient id="tw-vig" cx={0.5} cy={0.45} r={0.7}><stop offset="0.45" stopColor="#000" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.7} /></radialGradient>
      </g>
      <Card line={line} f={f} />
      <Chips line={line} f={f} />
      <People line={line} f={f} T={T} />
      <Labels line={line} f={f} x0={80} y0={60} />
      {p.meter !== false && <Meter m={m} f={f} />}
    </g>
  );
}

// ───────────── 2. the cross-section ─────────────
const SURF = 150, FLOOR = 880, KM = (FLOOR - SURF) / 11, CX = 960;
const ZONES = [['SUNLIGHT', 0, 0.2, '#47AEE2'], ['TWILIGHT', 0.2, 1, '#1F6FA8'], ['MIDNIGHT', 1, 4, '#0C2C52'], ['ABYSS', 4, 6, '#071A34'], ['HADAL', 6, 11, '#04101F']];
const everestPath = (g) => {
  const h = 8.85 * KM * g, q = (u, v) => `${CX + u * 330} ${FLOOR - v * h}`;
  return `M ${q(-1, 0)} L ${q(-0.78, 0.22)} L ${q(-0.62, 0.3)} L ${q(-0.45, 0.52)} L ${q(-0.33, 0.6)} L ${q(-0.16, 0.86)} L ${q(-0.06, 0.93)} L ${q(0, 1)} L ${q(0.08, 0.95)} L ${q(0.2, 0.8)} L ${q(0.3, 0.74)} L ${q(0.47, 0.5)} L ${q(0.6, 0.42)} L ${q(0.8, 0.18)} L ${q(1, 0)} Z`;
};
function Section(props) {
  return <g><SectionArt {...props} /><Labels line={props.line} f={props.f} x0={180} y0={190} /></g>;
}
function SectionArt({f, len, line}) {
  const p = P(line), T = line.start + f;
  const [hx, hy] = hand(T, 0.6);
  const grow = p.everest ? clamp(spr((f - at(line, p.everest_on || 'everest', 0.2)) / 30, 9, 0.9), 0, 1.03) : 0;
  const z = lin(f, 0, len, p.z0 || 1.0, p.z1 || 1.04);
  const zone = ZONES.find((x) => x[0] === p.zone);
  const za = at(line, p.zone_on || '', 0.1);
  const youM = p.you != null ? p.you + (p.you_to != null ? (p.you_to - p.you) * io(clamp(f / len, 0, 1)) : 0) : null;
  const pin = p.pin ? sp(f, at(line, p.pin_on || '', 0.4), 'sticker') : 0;
  const R = rng(4);
  return (
    <g transform={`translate(${W / 2 + hx} ${H / 2 + hy}) scale(${z}) translate(${-W / 2} ${-H / 2})`}>
      <linearGradient id="tw-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5AA9E6" /><stop offset="1" stopColor="#CDEBFF" /></linearGradient>
      <rect x={-200} y={-200} width={W + 400} height={SURF + 200} fill="url(#tw-sky)" />
      <linearGradient id="tw-sec" gradientUnits="userSpaceOnUse" x1="0" y1={SURF} x2="0" y2={FLOOR}>
        {DEPTH.map(([mm, c]) => <stop key={mm} offset={mm / 11000} stopColor={c} />)}
      </linearGradient>
      <rect x={-200} y={SURF} width={W + 400} height={H + 200} fill="url(#tw-sec)" />
      <path d={`M -200 ${SURF} ${[...Array(60)].map((_, i) => `L ${-200 + i * 40} ${SURF + Math.sin(i * 0.9 + T * 0.08) * 5}`).join(' ')}`} fill="none" stroke="#E0F4FF" strokeWidth={5} />
      {zone && f >= za && <g opacity={lin(f, za, za + 10, 0, 1)}>
        <rect x={-200} y={SURF + zone[1] * KM} width={W + 400} height={Math.max(8, (zone[2] - zone[1]) * KM)} fill="#FDE047" opacity={0.18} />
        <path d={`M -200 ${SURF + zone[1] * KM} L ${W + 200} ${SURF + zone[1] * KM} M -200 ${SURF + zone[2] * KM} L ${W + 200} ${SURF + zone[2] * KM}`} stroke="#FDE047" strokeWidth={4} strokeDasharray="18 12" />
      </g>}
      <path d={`M -200 ${SURF + 6.1 * KM} L 520 ${SURF + 6 * KM} C 640 ${SURF + 6.4 * KM} 680 ${SURF + 8.6 * KM} 760 ${FLOOR - 24} L 790 ${FLOOR} L 1130 ${FLOOR} L 1160 ${FLOOR - 24} C 1240 ${SURF + 8.6 * KM} 1280 ${SURF + 6.4 * KM} 1400 ${SURF + 6 * KM} L ${W + 200} ${SURF + 6.1 * KM} L ${W + 200} ${H + 200} L -200 ${H + 200} Z`}
        fill="#4A4F5C" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
      {[...Array(10)].map((_, i) => <path key={i} d={`M ${R() * W} ${SURF + (6.3 + R() * 0.8) * KM} l ${60 + R() * 80} 0`} stroke="#363B47" strokeWidth={8} strokeLinecap="round" />)}
      {grow > 0.001 && <g>
        <path d={everestPath(grow)} fill="#C9D3DF" opacity={0.95} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        <path d={`M ${CX} ${FLOOR - 8.85 * KM * grow} L ${CX + 0.08 * 330} ${FLOOR - 0.95 * 8.85 * KM * grow} L ${CX + 0.3 * 330} ${FLOOR - 0.74 * 8.85 * KM * grow} L ${CX + 0.6 * 330} ${FLOOR - 0.42 * 8.85 * KM * grow} L ${CX + 330} ${FLOOR} L ${CX + 40} ${FLOOR} Z`} fill="#8E9AAB" opacity={0.8} />
        <path d={`M ${CX - 0.16 * 330} ${FLOOR - 0.86 * 8.85 * KM * grow} L ${CX} ${FLOOR - 8.85 * KM * grow} L ${CX + 0.2 * 330} ${FLOOR - 0.8 * 8.85 * KM * grow} L ${CX} ${FLOOR - 0.84 * 8.85 * KM * grow} Z`} fill="#FFFFFF" {...st(4)} />
      </g>}
      {/* the depth ruler on the left, the zone names when asked */}
      <path d={`M 70 ${SURF} L 70 ${FLOOR}`} stroke="#E6F2FF" strokeWidth={4} opacity={0.6} />
      {[...Array(12)].map((_, k) => <g key={k}><path d={`M 70 ${SURF + k * KM} l ${k % 2 ? 12 : 22} 0`} stroke="#E6F2FF" strokeWidth={4} opacity={0.75} />
        {k % 2 === 0 && <text x={100} y={SURF + k * KM + 14} fontFamily={OSWALD} fontWeight={700} fontSize={40} fill="#E6F2FF" stroke={INK} strokeWidth={5} paintOrder="stroke">{k} KM</text>}</g>)}
      {p.zones && ZONES.map(([nm, a, b], i) => { const t = at(line, (p.zones_on || [])[i] || '', 0.05 + i * 0.12);
        return f >= t ? <g key={nm} transform={`translate(1500 ${SURF + (a + b) / 2 * KM})`}><g transform={`scale(${sp(f, t, 'sticker')})`}><Box x={0} y={-24} w={nm.length * 24 + 50} h={48} text={nm} fill={p.zone === nm ? '#FDE047' : '#FFFFFF'} rot={-1} /></g></g> : null; })}
      {zone && f >= za && <g transform={`translate(1460 ${clamp(SURF + (zone[1] + zone[2]) / 2 * KM - 40, SURF + 10, FLOOR - 120)})`}><g transform={`scale(${sp(f, za, 'sticker')})`}>
        <Box x={0} y={0} w={380} h={80} text={`${zone[0]} ZONE`} fill="#FDE047" rot={-2} />
        <Box x={20} y={86} w={340} h={56} text={`${zone[1] < 1 ? zone[1] * 1000 : zone[1] * 1000 > 999 ? (zone[1]).toLocaleString('en-US') + ',000' : zone[1]} - ${zone[2] < 1 ? zone[2] * 1000 : (zone[2]).toLocaleString('en-US') + ',000'} M`} fill="#0B1F3A" color="#FFFFFF" rot={1} />
      </g></g>}
      {p.everest && <g>
        {f >= at(line, p.gap_on || 'two', 0.6) && <g><path d={`M 1370 ${SURF} L 1390 ${SURF} L 1390 ${FLOOR - 8.85 * KM} L 1370 ${FLOOR - 8.85 * KM}`} fill="none" stroke="#FDE047" strokeWidth={7} />
          <g transform={`translate(1410 ${SURF + 40})`}><g transform={`scale(${sp(f, at(line, p.gap_on || 'two', 0.6), 'sticker')})`}><Box x={0} y={0} w={330} h={64} text="2 KM OF WATER" fill="#FDE047" rot={2} /></g></g></g>}
        {f >= at(line, p.height_on || 'nine', 0.85) && <g><path d={`M 560 ${FLOOR} L 540 ${FLOOR} L 540 ${FLOOR - 8.85 * KM} L 560 ${FLOOR - 8.85 * KM}`} fill="none" stroke="#FFFFFF" strokeWidth={7} />
          <g transform={`translate(250 ${FLOOR - 4.6 * KM})`}><g transform={`scale(${sp(f, at(line, p.height_on || 'nine', 0.85), 'sticker')})`}><Box x={0} y={0} w={270} h={64} text="8.8 KM TALL" fill="#FFFFFF" rot={-2} /></g></g></g>}
        {grow > 0.3 && <g transform={`translate(${CX} ${FLOOR - 3.2 * KM})`}><g transform={`scale(${sp(f, at(line, p.everest_on || 'everest', 0.2) + 8, 'sticker')})`}><Box x={-180} y={0} w={360} h={64} text="MOUNT EVEREST" fill="#FFFFFF" rot={-2} /></g></g>}
      </g>}
      {youM != null && <g transform={`translate(${CX} ${SURF + youM / 1000 * KM})`}>
        <circle r={22 + 5 * Math.sin(T * 0.25)} fill="#FDE047" opacity={0.3} /><circle r={10} fill="#FFF7B0" {...st(4)} />
        <g transform={`scale(${sp(f, 4, 'sticker')})`}><Box x={30} y={-60} w={110} h={52} text={p.you_label || 'YOU'} fill="#FDE047" rot={-4} /></g></g>}
      {pin > 0 && <g transform={`translate(${CX} ${FLOOR}) scale(${pin})`}>
        {[0, 1].map((r) => <circle key={r} r={24 + ((T * 1.6 + r * 40) % 70)} fill="none" stroke="#EF4444" strokeWidth={5} opacity={1 - ((T * 1.6 + r * 40) % 70) / 70} />)}
        <path d="M 0 0 C -30 -42 -38 -64 -38 -84 A 38 38 0 1 1 38 -84 C 38 -64 30 -42 0 0 Z" fill="#EF4444" {...st(6)} /><circle cx={0} cy={-84} r={14} fill="#fff" {...st(4)} />
        <Box x={60} y={-150} w={380} h={64} text={p.pin_label || 'CHALLENGER DEEP'} fill="#EF4444" color="#FFFFFF" rot={2} />
      </g>}
    </g>
  );
}

// ───────────── 3. the surface: floating, the tug, the rescue, coming home ─────────────
const waveTop = (T, y, amp, k, x0 = -200, x1 = W + 200) => { let d = ''; for (let x = x0; x <= x1; x += 40) d += `${d ? ' L' : 'M'} ${x} ${(y + Math.sin(x / 140 + T * 0.06 + k) * amp + Math.sin(x / 53 + T * 0.1 + k * 2) * amp * 0.35).toFixed(1)}`; return d; };
function Surface({f, len, line}) {
  const p = P(line), T = line.start + f, mode = p.mode || 'float';
  const sea = 560;
  const [hx, hy] = hand(T, 0.7);
  const sky = (<g>
    <linearGradient id="tw-sky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4FA3E6" /><stop offset="1" stopColor="#D9F0FF" /></linearGradient>
    <rect x={-200} y={-200} width={W + 400} height={sea + 200} fill="url(#tw-sky2)" />
    <g transform="translate(1560 170)"><circle r={190} fill="#FFF3B0" opacity={0.45} /><circle r={84} fill="#FFD23F" {...st(7)} /></g>
  </g>);
  const under = (<g>
    <linearGradient id="tw-und" gradientUnits="userSpaceOnUse" x1="0" y1={sea} x2="0" y2={H + 600}><stop offset="0" stopColor="#3FB0E8" /><stop offset="1" stopColor="#14588F" /></linearGradient>
    <path d={`${waveTop(T, sea, 12, 0)} L ${W + 200} ${H + 600} L -200 ${H + 600} Z`} fill="url(#tw-und)" stroke={INK} strokeWidth={6} />
    {[...Array(6)].map((_, i) => <path key={i} d={`M ${60 + i * 330 + Math.sin(T * 0.03 + i) * 25} ${sea + 10} l 80 0 l 200 700 l -110 0 Z`} fill="#D6F1FF" opacity={0.13} />)}
  </g>);
  if (mode === 'rescue') {   // under the surface: the sub slides in, its line on your ankle, reels you to the hatch; you vanish inside
    const subIn = lin(f, 0, len * 0.35, 1, 0, Easing.out(Easing.cubic));
    const reel = lin(f, len * 0.4, len * 0.75, 0, 1);
    const inside = lin(f, len * 0.72, len * 0.8, 0, 1);
    const sx = 1180 + subIn * 1100, sy = 760;
    const yx = 620 + reel * (sx - 20 - 620), yy = 520 + reel * (sy - 230 - 520);
    return (
      <g transform={`translate(${hx} ${hy})`}>
        <g transform={`translate(0 ${-sea + 120})`}>{sky}{under}</g>
        {inside < 1 && <g transform={`translate(${yx} ${yy}) rotate(${-20 + reel * 20}) scale(${0.34 * (1 - inside * 0.6)})`} opacity={1 - inside}><Figure who="you" pose="kick" expr="shock" f={T * 2} seed={3} shadow={false} /></g>}
        {inside < 1 && <path d={`M ${sx - 150} ${sy + 40} C ${sx - 300} ${sy + 60} ${yx + 60} ${yy + 420} ${yx} ${yy + 440 * 0.34 * (1 - inside * 0.6) * 1.3}`} fill="none" stroke="#10151C" strokeWidth={8} />}
        <YSub T={T} x={sx} y={sy} s={1.2} hatchOpen={lin(f, len * 0.5, len * 0.62, 0, 1) * (1 - lin(f, len * 0.82, len * 0.9, 0, 1))} youExpr="shock" youOut={inside < 1} pipExpr="smile" />
        <Labels line={line} f={f} x0={80} y0={60} />
      </g>
    );
  }
  if (mode === 'home') {   // the sub pops up into the sun, the hatch opens, you and Pip climb out
    const up = lin(f, 0, 40, 1, 0, Easing.out(Easing.back(1.6)));
    const open = lin(f, 40, 60, 0, 1);
    return (
      <g transform={`translate(${hx} ${hy})`}>
        {sky}{under}
        {open > 0.5 && <g transform={`translate(954 ${sea + 40 - 150 * 1.3 + (1 - open) * 160})`}><Bust who="you" x={0} y={0} s={0.42} expr="smile" f={T} arms="rest" /></g>}
        <YSub T={T} x={980} y={sea + 40 + up * 500} s={1.3} hatchOpen={open} pipExpr="smile" youExpr="smile" youOut={open > 0.5} cup={0.42} />
        {f < 40 && <g>{[...Array(9)].map((_, i) => { const a = -Math.PI * (0.12 + 0.76 * i / 8); return <path key={i} d={`M ${980 + Math.cos(a) * 120} ${sea} q ${Math.cos(a) * 90 * f / 40} ${-130 * f / 40} ${Math.cos(a) * 170 * f / 40} ${-40 * f / 40}`} stroke="#E6F7FF" strokeWidth={12} fill="none" strokeLinecap="round" opacity={1 - f / 40} />; })}</g>}
        <Labels line={line} f={f} x0={80} y0={60} />
      </g>
    );
  }
  // float: you on your back in the sun; something tugs; under
  const tug = at(line, p.tug_on || 'tugs', 0.7), down = at(line, p.under_on || 'under', 0.95);
  const ant = lin(f, tug - 2, tug + 4, 0, 1) * (1 - lin(f, tug + 4, tug + 10, 0, 1));
  const yank = lin(f, down - 2, down + 14, 0, 1, Easing.bezier(0.55, 0, 0.9, 0.6));
  const s = 0.36, rot = -90 + 90 * yank - 10 * ant;
  const bx = 760, by = sea - 40 + Math.sin(T * 0.08) * 6 - 30 * ant + yank * 600;
  const ar = (rot * Math.PI) / 180, ankle = [bx - Math.sin(ar) * 1080 * s, by + Math.cos(ar) * 1080 * s];
  const lineK = lin(f, at(line, 'something', 0.6) - 6, tug, 0, 1);
  const z = 1.25 - 0.1 * lin(f, 0, tug, 0, 1) + 0.12 * ant;
  const shake = f >= tug && f < tug + 14 ? Math.sin((f - tug) * 2.1) * (14 - (f - tug)) * 1.5 : 0;
  return (
    <g transform={`translate(${W / 2 + hx + shake} ${H / 2 + hy}) scale(${z}) translate(${-W / 2} ${-H / 2 - lin(f, down, len, 0, 500, Easing.in(Easing.quad))})`}>
      {sky}{under}
      {lineK > 0 && <path d={`M ${ankle[0]} ${ankle[1]} C ${ankle[0] + 60} ${ankle[1] + 260} ${ankle[0] - 40} ${sea + 700} ${ankle[0]} ${sea + 1400}`} fill="none" stroke="#10151C" strokeWidth={8} strokeDasharray={`${2200 * lineK} 3000`} />}
      <g transform={`translate(${bx} ${by}) rotate(${rot}) scale(${s})`}><Figure who="you" pose={yank > 0.3 ? 'kick' : 'lie'} expr={f >= tug ? (yank > 0.2 ? 'scared' : 'shock') : 'calm'} f={T * (yank > 0.3 ? 2 : 1)} seed={3} shadow={false} /></g>
      <path d={`${waveTop(T + 20, sea + 16, 9, 1.5)} L ${W + 200} ${sea + 120} L -200 ${sea + 120} Z`} fill="#3FB0E8" opacity={0.5} />
      {f >= tug && f < down + 4 && <text x={bx - 140} y={by - 110} fontFamily={OSWALD} fontWeight={700} fontSize={110} fill="#FDE047" stroke={INK} strokeWidth={10} paintOrder="stroke" transform={`rotate(-8 ${bx - 140} ${by - 110})`}>!?</text>}
      <Labels line={line} f={f} x0={80} y0={60} />
    </g>
  );
}

// ───────────── 4. inside the sub ─────────────
function Cabin({f, len, line}) {
  const p = P(line), T = line.start + f;
  const m = p.m != null ? p.m : 300;
  const [hx, hy] = hand(T, 0.5);
  const items = p.items || (p.item ? [[p.item, p.item_on || '']] : []);
  const has = (nm) => { const it = items.find((x) => x[0] === nm); return it ? at(line, it[1] || '', 0.2) : null; };
  const item = items.length ? items[items.length - 1][0] : null;
  const ia = 0;
  const z = lin(f, 0, len, p.z0 || 1.0, p.z1 || 1.05);
  const g = p.gauge != null ? p.gauge : Math.max(1, Math.round(1 + m / 10));
  return (
    <g>
    <g transform={`translate(${W / 2 + hx} ${H / 2 + hy}) scale(${z}) translate(${-W / 2} ${-H / 2})`}>
      <rect width={W} height={H} fill="#5B6472" />
      <path d={`M -20 -20 L ${W + 20} -20 L ${W + 20} 140 C 1400 90 520 90 -20 140 Z`} fill="#4A5260" {...st(6)} />
      {[...Array(14)].map((_, i) => <circle key={i} cx={60 + i * 140} cy={110 - Math.abs(i - 6.5) * 4} r={7} fill="#2E3440" />)}
      {/* the big window, the sea outside at this depth */}
      <g transform="translate(1340 420)">
        <circle r={300} fill="#3B4250" {...st(9)} />
        <clipPath id="tw-win"><circle r={262} /></clipPath>
        <g clipPath="url(#tw-win)"><g transform="translate(-960 -540)"><Water m={m} T={T} glow={m > 250 ? 0.8 : 0} />
          {p.see && <Passers line={line} f={f} T={T} />}
          {p.floodlight && <path d="M 960 540 L 1700 260 L 1700 820 Z" fill="#FFF6C8" opacity={0.25} />}
          {p.cupout != null && <g transform="translate(1080 720)"><circle r={40} fill="#FFF6C8" opacity={0.3} />
            <path d="M -28 -36 L 28 -36 L 20 34 L -20 34 Z" fill="#FFFFFF" {...st(4)} transform={`scale(${p.cupout})`} /></g>}
        </g></g>
        <circle r={262} fill="none" stroke="#9CA3AF" strokeWidth={22} />
        {[...Array(12)].map((_, i) => { const a = i / 12 * Math.PI * 2; return <circle key={i} cx={Math.cos(a) * 282} cy={Math.sin(a) * 282} r={9} fill="#2E3440" />; })}
        <path d="M -180 -150 q 60 -60 150 -70" stroke="#fff" strokeWidth={10} fill="none" opacity={0.35} strokeLinecap="round" />
      </g>
      {/* the gauge */}
      <g transform="translate(930 290) scale(1.35)">
        <circle r={92} fill="#F8FAFC" {...st(7)} />
        {[...Array(9)].map((_, i) => { const a = (-210 + i * 30) * Math.PI / 180; return <path key={i} d={`M ${Math.cos(a) * 70} ${Math.sin(a) * 70} L ${Math.cos(a) * 84} ${Math.sin(a) * 84}`} {...st(4)} />; })}
        <path d={`M 0 0 L ${Math.cos((-210 + 240 * clamp(Math.log10(g) / 3.1, 0, 1)) * Math.PI / 180) * 70} ${Math.sin((-210 + 240 * clamp(Math.log10(g) / 3.1, 0, 1)) * Math.PI / 180) * 70}`} stroke="#E3232C" strokeWidth={7} strokeLinecap="round" />
        <circle r={10} fill={INK} />
        <text x={0} y={56} textAnchor="middle" fontFamily={OSWALD} fontWeight={700} fontSize={40} fill={INK}>{g.toLocaleString('en-US')}</text>
        <text x={0} y={-36} textAnchor="middle" fontFamily={OSWALD} fontWeight={600} fontSize={20} fill="#475569">ATMOSPHERES</text>
      </g>
      {/* you and Pip */}
      <Bust who="you" x={330} y={440} s={0.8} expr={p.you || 'worried'} f={T} arms={has('blanket') != null && f >= has('blanket') ? 'grip' : 'rest'} />
      <Bust who="pip" x={680} y={500} s={0.68} expr={p.pip || 'smile'} f={T} talk={false} arms="rest" />
      {p.cold && [...Array(3)].map((_, i) => <circle key={i} cx={420 + i * 20} cy={430 - ((T * 1.2 + i * 20) % 60)} r={14 + i * 4} fill="#E5E7EB" opacity={0.4 * (1 - ((T * 1.2 + i * 20) % 60) / 60)} />)}
      {has('cup') != null && f >= has('cup') && <g transform={`translate(470 650) scale(${sp(f, has('cup'), 'sticker')}) rotate(-8)`}><path d="M -50 -64 L 50 -64 L 36 60 L -36 60 Z" fill="#fff" {...st(6)} />
        <path d="M -26 -8 q 12 -16 24 0 q 12 16 24 0" stroke="#2563EB" strokeWidth={6} fill="none" /><rect x={60} y={-80} width={18} height={110} rx={6} fill="#2563EB" {...st(4)} transform="rotate(20)" /></g>}
      {has('sandwich') != null && f >= has('sandwich') && <g transform={`translate(470 660) scale(${sp(f, has('sandwich'), 'sticker')})`}><path d="M -80 0 L 80 0 L 60 -40 L -60 -40 Z" fill="#E9C46A" {...st(5)} /><path d="M -84 4 L 84 4 L 84 18 L -84 18 Z" fill="#4D7C3A" {...st(4)} /><path d="M -80 20 L 80 20 L 70 46 L -70 46 Z" fill="#E9C46A" {...st(5)} /></g>}
      {has('blanket') != null && f >= has('blanket') && <path d="M 150 820 C 180 600 480 600 520 820 Z" fill="#B91C1C" {...st(6)} opacity={clamp(sp(f, has('blanket'), 'card'), 0, 1)} />}
      {has('point') != null && f >= has('point') && <g transform={`translate(760 520) rotate(-20) scale(${sp(f, has('point'), 'snap')})`}><path d="M 0 0 L 320 -40" stroke="#F2C29B" strokeWidth={34} strokeLinecap="round" /><path d="M 0 0 L 320 -40" stroke={INK} strokeWidth={42} strokeLinecap="round" opacity={0} /></g>}
    </g>
      <Card line={line} f={f} />
      <Chips line={line} f={f} />
      <Labels line={line} f={f} x0={80} y0={36} />
      <Meter m={m} f={f} op={p.meter === false ? 0 : 1} />
    </g>
  );
}

// ───────────── 5. a card scene: questions, answers, numbers over the dark water ─────────────
function Cards({f, len, line}) {
  const p = P(line), T = line.start + f;
  const m = p.m != null ? p.m : 1500;
  return (
    <g>
      <g transform={`translate(${hand(T)[0]} ${hand(T)[1]})`}><Water m={m} T={T} glow={m > 250 ? 0.5 : 0} /></g>
      <rect width={W} height={H} fill="#000" opacity={0.25} />
      {p.see && <Passers line={line} f={f} T={T} />}
      {p.alone && <g transform={`translate(1560 ${300 + Math.sin(T * 0.05) * 12}) rotate(${Math.sin(T * 0.07) * 7}) scale(0.42)`}><Figure who="you" pose="kick" expr="scared" f={T * 2} seed={3} shadow={false} /></g>}
      {p.cupbig && <g transform={`translate(1560 560) rotate(-6) scale(${sp(f, 2, 'card')})`}><path d="M -110 -150 L 110 -150 L 82 130 L -82 130 Z" fill="#fff" {...st(8)} />
        <text x={0} y={-10} textAnchor="middle" fontFamily={OSWALD} fontWeight={700} fontSize={56} fill="#2563EB">YOU</text><path d="M -40 40 q 20 -24 40 0 q 20 24 40 0" stroke="#2563EB" strokeWidth={8} fill="none" /></g>}
      <People line={line} f={f} T={T} />
      {p.sub !== false && !p.alone && !p.cupbig && !p.people && <g transform={`translate(1600 ${790 + Math.sin(T * 0.05) * 10}) scale(0.55)`}><YSub T={T} beam={0} cup={cupAt(m)} pipExpr={p.pip || 'smile'} youExpr={p.you || 'worried'} /></g>}
      {p.title && <g transform={`translate(960 ${p.chips ? 120 : 380}) scale(${sp(f, at(line, p.title_on || '', 0.05), 'heavy')})`}>
        {p.title.map((t, i) => { const w = String(t).length * (p.title_size || 70) * 0.55 + 70; return <Box key={i} x={-w / 2} y={i * ((p.title_size || 70) * 1.75) - 50} w={w} h={(p.title_size || 70) * 1.35} text={t} fill={i % 2 ? '#FDE047' : '#FFFFFF'} rot={i % 2 ? 2 : -2} />; })}</g>}
      <Card line={line} f={f} />
      <Chips line={line} f={f} y0={p.title ? 330 : 230} />
      <Labels line={line} f={f} x0={80} y0={60} />
      {p.meter !== false && p.sub !== false && <Meter m={m} f={f} />}
    </g>
  );
}

// ───────────── 6. 1960: the Trieste (a flashback in sepia) ─────────────
const Trieste = ({T, crack = 0}) => (
  <g>
    <path d="M -420 0 C -420 -110 -260 -150 0 -150 C 260 -150 430 -110 450 -10 C 430 90 260 110 0 110 C -260 110 -420 90 -420 0 Z" fill="#D9D2C3" {...st(7)} />
    <path d="M -420 0 L 450 -10" stroke="#B8AE9B" strokeWidth={6} />
    <rect x={-60} y={-200} width={120} height={60} fill="#C9C1B0" {...st(6)} />
    <path d="M 0 110 L 0 170" stroke={INK} strokeWidth={14} />
    <circle cx={0} cy={250} r={90} fill="#8B8578" {...st(7)} />
    <circle cx={0} cy={250} r={26} fill="#3A3A3A" {...st(5)} />
    {crack > 0 && <path d={`M 40 140 l ${18 * crack} ${-10 * crack} l ${10 * crack} ${16 * crack} l ${20 * crack} ${-6 * crack}`} stroke="#FFF" strokeWidth={5} fill="none" />}
    <text x={-260} y={10} fontFamily={OSWALD} fontWeight={700} fontSize={56} fill="#6B6253">TRIESTE</text>
  </g>
);
const Challenger = () => (   // Cameron's Deepsea Challenger, standing upright (painted green)
  <g><path d="M -60 -380 C -60 -430 60 -430 60 -380 L 70 300 C 70 340 -70 340 -70 300 Z" fill="#7CC243" {...st(7)} />
    <circle cx={0} cy={250} r={44} fill="#3A3A3A" {...st(5)} /><text x={18} y={-60} fontFamily={OSWALD} fontWeight={700} fontSize={40} fill="#1F3D10" transform="rotate(90 18 -60)">DEEPSEA</text></g>
);
function Flashback({f, len, line}) {
  const p = P(line), T = line.start + f, mode = p.mode || 'fall';
  const [hx, hy] = hand(T, 0.8);
  const bang = at(line, p.bang_on || 'bang', 0.6);
  const shake = mode === 'bang' && f >= bang && f < bang + 18 ? Math.sin((f - bang) * 2.3) * (18 - (f - bang)) * 1.8 : 0;
  const m = 2500;   // every 1960 flashback the same sepia sea
  return (
    <g>
      <g transform={`translate(${hx + shake} ${hy})`}>
        <Water m={m} T={T} glow={mode === 'glow' ? 1 : 0.3} />
        {mode === 'glow' && [...Array(40)].map((_, i) => { const Q = rng(300 + i); const x = Q() * W, y0 = Q() * H; const y = ((y0 - T * 7) % H + H) % H;
          return <circle key={i} cx={x} cy={((y0 - T * 13) % H + H) % H} r={7 + Q() * 9} fill="#7DF9E5" opacity={0.9} />; })}
        {mode !== 'compare' && <g transform={`translate(960 ${360 + Math.sin(T * 0.05) * 10}) scale(1.05)`}><Trieste T={T} crack={mode === 'bang' ? lin(f, bang, bang + 6, 0, 1) : 0} /></g>}
        {p.inset === 'tunnel' && (() => { const a = at(line, p.inset_on || 'plexiglas', 0.15); const k = lin(f, a, a + 14, 0, 1);
          return f >= a ? <g transform={`translate(1650 600) scale(${0.85 * sp(f, a, 'card')})`}>
            <circle r={180} fill="#2F4F5F" {...st(9)} /><circle r={140} fill="#9BD3E8" opacity={0.7} {...st(6)} />
            <path d={`M -10 -20 l ${-70 * k} ${-60 * k} M -10 -20 l ${80 * k} ${-40 * k} M -10 -20 l ${30 * k} ${90 * k} M -10 -20 l ${-90 * k} ${40 * k}`} stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" />
            <g transform="translate(-170 200)"><Box x={0} y={0} w={340} h={56} text="TUNNEL WINDOW" fill="#F5E6C8" rot={-2} /></g></g> : null; })()}
        {mode === 'compare' && <g>
          <g transform="translate(560 330) scale(0.75)"><Trieste T={T} /></g>
          {(p.tags || []).map(([t, x, y, on], i) => f >= at(line, on || '', 0.1 + 0.4 * i) ? <g key={i} transform={`translate(${x} ${y}) scale(${sp(f, at(line, on || '', 0.1 + 0.4 * i), 'sticker')})`}>
            <Box x={-(String(t).length * 26 + 50) / 2} y={0} w={String(t).length * 26 + 50} h={70} text={t} fill="#FDE047" rot={-2} /></g> : null)}
          <g transform={`translate(1360 470) scale(${sp(f, at(line, p.right_on || 'cameron', 0.3), 'card') * 0.9})`}><Challenger /></g>
        </g>}
        {mode === 'bang' && f >= bang && f < bang + 26 && <g transform={`translate(1250 300) scale(${sp(f, bang, 'sticker')})`}><path d="M 0 -110 L 30 -30 L 110 -40 L 50 20 L 90 100 L 10 50 L -40 120 L -40 40 L -120 30 L -50 -20 L -90 -90 L -10 -50 Z" fill="#FDE047" {...st(7)} />
          <text x={0} y={18} textAnchor="middle" fontFamily={OSWALD} fontWeight={700} fontSize={54} fill={INK}>BANG</text></g>}
      </g>
      <rect width={W} height={H} fill="#704214" opacity={0.28} />
      <rect width={W} height={H} fill="none" stroke="#2A1A0E" strokeWidth={40} opacity={0.6} />
      <g transform="translate(0 0)" />
      <g transform="translate(70 50)"><Box x={0} y={0} w={String(p.year || '1960').length * 30 + 70} h={78} text={p.year || '1960'} fill="#F5E6C8" rot={-3} /></g>
      <Card line={line} f={f} y={760} />
      <Chips line={line} f={f} y0={820} />
      <People line={line} f={f} T={T} x0={1720} y0={270} down />
      <Labels line={line} f={f} x0={80} y0={p.labels_y || 740} />
    </g>
  );
}

// ───────────── 7. pressure: the stamp under the cars ─────────────
const Car = ({fill = '#3B82F6'}) => (<g><path d="M -110 0 L -96 -40 L -50 -70 L 50 -70 L 92 -40 L 110 -36 L 116 0 Z" fill={fill} {...st(6)} />
  <path d="M -40 -62 L -10 -62 L -10 -38 L -70 -38 Z M 4 -62 L 44 -62 L 74 -38 L 4 -38 Z" fill="#BFE6FF" {...st(4)} />
  <circle cx={-62} cy={4} r={22} fill="#1F2937" {...st(5)} /><circle cx={66} cy={4} r={22} fill="#1F2937" {...st(5)} /></g>);
function Pressure({f, len, line}) {
  const p = P(line), T = line.start + f;
  const n = p.cars || 2;
  const ca = at(line, p.cars_on || 'cars', 0.4);
  const sa = p.stamp_on === '' ? -99 : at(line, p.stamp_on || 'stamp', 0.2);
  const squash = lin(f, ca + n * 8, ca + n * 8 + 6, 0, 1);
  return (
    <g>
      <Water m={p.floor ? 10900 : Math.min(1500, p.m || 4000)} T={T} uid={line.start} />
      <rect width={W} height={H} fill="#000" opacity={0.15} />
      {p.floor && <g><path d={`M -200 860 C 300 840 700 870 1100 850 C 1500 835 1800 860 ${W + 200} 850 L ${W + 200} ${H + 200} L -200 ${H + 200} Z`} fill="#6B6E73" {...st(6)} />
        <g transform={`translate(380 ${700 + Math.sin(T * 0.05) * 8}) scale(0.6)`}><YSub T={T} beam={1} cup={0.42} /></g></g>}
      <g transform={`translate(960 640) scale(${1.6 * (sa < 0 ? 1 : sp(f, sa, 'card'))})`}>
        <rect x={-110} y={-6} width={220} height={150} fill="#F5F5F0" stroke={INK} strokeWidth={7} strokeDasharray="14 8" />
        <rect x={-90} y={14} width={180} height={110} fill="#E63946" opacity={0.85} />
        <text x={0} y={92} textAnchor="middle" fontFamily={OSWALD} fontWeight={700} fontSize={46} fill="#fff">1 IN²</text>
        {[...Array(n)].map((_, i) => { const a = p.cars_static ? -99 : ca + i * 8; if (f < a) return null; const drop = p.cars_static ? 0 : lin(f, a, a + 10, -700, 0, Easing.in(Easing.quad));
          return <g key={i} transform={`translate(${(i % 2 ? 14 : -10)} ${-36 - i * 90 + drop + squash * i * 6}) scale(${1 - squash * 0.04} ${1 - squash * 0.08})`}><Car fill={['#3B82F6', '#E36414', '#16A34A', '#9333EA', '#FACC15'][i % 5]} /></g>; })}
      </g>
      {p.big && f >= ca + n * 8 && <g transform={`translate(1520 520) scale(${sp(f, ca + n * 8, 'heavy')})`}><Box x={-230} y={-70} w={460} h={140} text={p.big} fill="#FDE047" rot={-2} /></g>}
      <Card line={line} f={f} />
      <Labels line={line} f={f} x0={80} y0={60} />
      {p.meter !== false && <Meter m={p.m || 4000} f={f} />}
    </g>
  );
}

// ───────────── 8. the fish line: a depth bar with the limit, the record fish ─────────────
function FishLine({f, len, line}) {
  const p = P(line), T = line.start + f;
  const y = (mm) => 140 + (mm - 7000) / 2000 * 760;   // 7,000 m at the top, 9,000 m at the bottom
  const la = p.line_on === '' ? -1 : at(line, p.line_on || 'limit', 0.2);
  const marks = p.marks || [];
  return (
    <g>
      <Water m={8000} T={T} glow={0.3} />
      <rect width={W} height={H} fill="#000" opacity={0.25} />
      {p.axis !== false && <path d={`M 300 ${y(7000)} L 300 ${y(9000)}`} stroke="#E6F2FF" strokeWidth={6} />}
      {p.axis !== false && [7000, 7500, 8000, 8500, 9000].map((mm) => <g key={mm}><path d={`M 300 ${y(mm)} l 26 0`} stroke="#E6F2FF" strokeWidth={5} />
        <text x={340} y={y(mm) + 15} fontFamily={OSWALD} fontWeight={700} fontSize={44} fill="#E6F2FF">{mm.toLocaleString('en-US')} M</text></g>)}
      {p.band && (() => { const ba = p.band_on === '' ? -99 : at(line, p.band_on || '', 0.2); return f >= ba ? <rect x={480} y={y(8000)} width={1300} height={y(8500) - y(8000)} fill="#EF4444" opacity={0.16 * clamp((f - ba) / 10, 0, 1)} /> : null; })()}
      {f >= la && p.limit !== false && <g><path d={`M 480 ${y(8200)} L ${480 + 1300 * (la < 0 ? 1 : lin(f, la, la + 20, 0, 1))} ${y(8200)}`} stroke="#EF4444" strokeWidth={8} strokeDasharray="22 12" />
        <g transform={`translate(1500 ${y(8200) - 90}) scale(${la < 0 ? 1 : sp(f, la, 'sticker')})`}><Box x={0} y={0} w={330} h={66} text="FISH LIMIT ~8,200 M" fill="#EF4444" color="#fff" rot={-2} /></g></g>}
      {marks.map((mk, i) => { const a = mk.on === '' ? -99 : at(line, mk.on || '', 0.3 + 0.2 * i); if (f < a) return null;
        return <g key={i} transform={`translate(${mk.x || 900} ${y(mk.m)}) scale(${a < 0 ? 1 : sp(f, a, 'sticker')})`}>
          {(mk.n || 1) > 1 ? [...Array(mk.n)].map((_, k) => <g key={k} transform={`translate(${(k % 3) * 90 - 90} ${Math.floor(k / 3) * 50 - 20})`}><Snailfish s={0.55} T={T + k * 7} /></g>) : <Snailfish s={mk.s || 0.7} T={T} />}
          <g transform="translate(140 -40)"><Box x={0} y={0} w={String(mk.label).length * 26 + 50} h={60} text={mk.label} fill="#FDE047" rot={-2} /></g></g>; })}
      {p.protein && (() => { const a = at(line, p.protein_on || '', 0.3); const stiff = lin(f, at(line, p.stiff_on || 'stiff', 0.6), at(line, p.stiff_on || 'stiff', 0.6) + 12, 0, 1);
        return f >= a ? <g transform={`translate(${p.axis === false ? 960 : 1200} 520) scale(${(p.axis === false ? 1.5 : 1) * sp(f, a, 'card')})`}>
          <path d={stiff > 0.5 ? 'M -220 0 L 220 0' : `M -220 0 C -150 ${-80 + Math.sin(T * 0.2) * 30} -80 ${80 - Math.sin(T * 0.2) * 30} 0 0 C 80 ${-80 + Math.sin(T * 0.2) * 30} 150 ${80 - Math.sin(T * 0.2) * 30} 220 0`} stroke="#F9A8D4" strokeWidth={26} fill="none" strokeLinecap="round" />
          <text x={0} y={-90} textAnchor="middle" fontFamily={OSWALD} fontWeight={700} fontSize={48} fill="#fff">{stiff > 0.5 ? 'TOO STIFF TO FLEX' : 'A PROTEIN THAT FLEXES'}</text></g> : null; })()}
      <Card line={line} f={f} />
      <People line={line} f={f} T={T} x0={1640} y0={760} />
      <Labels line={line} f={f} x0={600} y0={36} />
    </g>
  );
}

// ───────────── 9. the floor of the Challenger Deep ─────────────
function Floor({f, len, line}) {
  const p = P(line), T = line.start + f;
  const [hx, hy] = hand(T, 0.6);
  const land = lin(f, 0, 40, -380, 0, Easing.out(Easing.cubic));
  const silt = p.silt ? lin(f, 20, 40, 0, 1) * (1 - lin(f, len * 0.6, len, 0, 1)) : 0;
  return (
    <g transform={`translate(${hx} ${hy})`}>
      <Water m={10900} T={T} />
      <path d={`M -200 760 C 300 740 700 770 1100 750 C 1500 735 1800 760 ${W + 200} 750 L ${W + 200} ${H + 200} L -200 ${H + 200} Z`} fill="#6B6E73" {...st(6)} />
      <path d="M -200 760 L 2200 760 L 2200 1300 L -200 1300 Z" fill="#000" opacity={0.25} />
      <path d={`M 400 760 L 1700 400 L 1700 1100 Z`} fill="#FFF6C8" opacity={0.12} />
      {p.xeno && f >= at(line, p.xeno_on || 'lump', 0.3) && <g transform={`translate(1240 780) scale(${sp(f, at(line, p.xeno_on || 'lump', 0.3), 'card')})`}>
        <path d="M -70 0 C -80 -50 -40 -70 -10 -60 C 10 -86 60 -70 64 -40 C 96 -30 92 10 64 10 Z" fill="#C8B79A" {...st(5)} />
        {[...Array(7)].map((_, i) => <circle key={i} cx={-50 + i * 18} cy={-30 - (i % 3) * 12} r={7} fill="#A8956F" />)}
        <g transform="translate(120 -10)"><path d="M 0 0 C 10 -40 60 -40 80 -10 L 90 30 L 10 40 Z" fill="#F2C29B" {...st(4)} opacity={0.85} /></g>
        <g transform="translate(-60 -170)"><Box x={0} y={0} w={330} h={60} text="ONE CELL, 10+ CM" fill="#FDE047" rot={-2} /></g></g>}
      {p.amphipods && [...Array(6)].map((_, i) => { const t = ((T * 1.4 + i * 160) % 1600); return <g key={i} transform={`translate(${t + 100} ${520 + (i % 3) * 70 + Math.sin(T * 0.08 + i) * 20})`}><Amphipod s={0.9} T={T + i * 5} flip /></g>; })}
      <YSub T={T} x={760} y={560 + land} s={1.15} beam={1} cup={p.cup != null ? p.cup : 0.42} pipExpr={p.pip || 'calm'} youExpr={p.you || 'worried'} />
      {silt > 0 && [...Array(26)].map((_, i) => { const Q = rng(50 + i); const a = Q() * Math.PI, r = 120 + Q() * 420 * lin(f, 20, 70, 0.3, 1);
        return <circle key={i} cx={760 + Math.cos(a) * r * 1.4} cy={720 - Math.sin(a) * r * 0.5} r={60 + Q() * 70} fill="#D9D6CF" opacity={0.5 * silt} />; })}
      {silt > 0.6 && <rect width={W} height={H} fill="#F2EFE8" opacity={(silt - 0.6) * 1.2} />}
      <Card line={line} f={f} />
      <Chips line={line} f={f} />
      <People line={line} f={f} T={T} x0={1640} y0={420} />
      <Labels line={line} f={f} x0={80} y0={60} />
      <Meter m={10935} f={f} op={p.meter === false ? 0 : 1} />
    </g>
  );
}

// ───────────── 10. 2019: Vescovo's dive and the bag (a flashback panel, cool tint) ─────────────
const LimitingFactor = () => (<g><rect x={-200} y={-120} width={400} height={220} rx={50} fill="#F1F5F9" {...st(7)} />
  <rect x={-200} y={-30} width={400} height={40} fill="#1E3A8A" /><circle cx={-110} cy={60} r={36} fill="#3A3A3A" {...st(5)} />
  <text x={0} y={-60} textAnchor="middle" fontFamily={OSWALD} fontWeight={700} fontSize={34} fill="#1E3A8A">LIMITING FACTOR</text></g>);
export const Bag = ({T = 0, s = 1}) => (
  <g transform={`scale(${s})`}>
    <path d={`M -90 40 C -110 -10 -80 -60 -40 -70 C -30 -110 -10 -120 0 -96 C 10 -120 40 -110 36 -72 C 90 -66 110 -10 96 40 C 60 70 -60 70 -90 40 Z`} fill="#F8FAFC" stroke="#94A3B8" strokeWidth={5} opacity={0.92} />
    <path d="M -50 -10 C -20 0 10 -20 40 0 M -60 20 C -20 34 30 14 70 26" stroke="#CBD5E1" strokeWidth={4} fill="none" />
    <g transform={`translate(160 40) rotate(${12 + Math.sin(T * 0.04) * 6})`}><rect x={-36} y={-16} width={72} height={32} rx={8} fill="#F472B6" {...st(4)} /><path d="M -36 0 L -56 -14 L -56 14 Z M 36 0 L 56 -14 L 56 14 Z" fill="#F472B6" {...st(4)} /></g>
  </g>
);
function Bag2019({f, len, line}) {
  const p = P(line), T = line.start + f;
  const ba = at(line, p.bag_on || 'bag', 0.5);
  const count = p.count;
  const zb = p.bag_always ? lin(f, 0, len, 1.0, 1.12) : 1;
  return (
    <g>
      <g transform={`translate(1240 760) scale(${zb}) translate(-1240 -760)`}>
      <Water m={10900} T={T} />
      <path d={`M -200 780 C 400 760 900 790 1400 770 C 1700 760 1900 780 ${W + 200} 775 L ${W + 200} ${H + 200} L -200 ${H + 200} Z`} fill="#6B6E73" {...st(6)} />
      {!p.nosub && <path d="M 300 380 L 1300 700 L 1300 980 Z" fill="#FFF6C8" opacity={0.14} transform={`rotate(${Math.sin(T * 0.03) * 5} 420 400)`} />}
      {p.nosub && <ellipse cx={1240} cy={780} rx={420} ry={150} fill="#FFF6C8" opacity={0.1} />}
      {!p.nosub && <g transform={`translate(${lin(f, 0, len, 460, 520)} ${380 + Math.sin(T * 0.05) * 8}) scale(1.35)`}><LimitingFactor /></g>}
      {!p.nobag && f >= (p.bag_always ? 0 : ba) && <g transform={`translate(1240 760) scale(${p.bag_always ? 1 : sp(f, ba, 'card')})`}><Bag T={T} s={1.2} /></g>}
      </g>
      {count && f >= at(line, count.on || '', 0.4) && <g transform={`translate(1580 520) scale(${sp(f, at(line, count.on || '', 0.4), 'heavy')})`}>
        <Box x={-220} y={-80} w={440} h={150} text={`${Math.round(lin(f, at(line, count.on || '', 0.4), at(line, count.on || '', 0.4) + 30, 0, count.to))} ${count.unit || ''}`.trim()} fill="#FDE047" rot={-2} />
        {count.sub && <Box x={-200} y={80} w={400} h={60} text={count.sub} fill="#0B1F3A" color="#fff" rot={1} />}</g>}
      <rect width={W} height={H} fill="#1E3A8A" opacity={p.year === '' ? 0 : 0.16} />
      {p.year !== '' && <g transform="translate(70 50)"><Box x={0} y={0} w={190} h={78} text={p.year || '2019'} fill="#DBEAFE" rot={-3} /></g>}
      <Card line={line} f={f} />
      <People line={line} f={f} T={T} x0={1660} y0={330} />
      <Labels line={line} f={f} x0={760} y0={56} />
    </g>
  );
}

// ───────────── 11. the cup: before and after ─────────────
function Cup({f, len, line}) {
  const p = P(line), T = line.start + f;
  const sa = at(line, p.shrink_on || 'shrank', 0.3);
  const k = p.shrink === false ? 1 : lin(f, sa, sa + 18, 1, 0.42, Easing.out(Easing.back(1.4)));
  const beads = p.beads && f >= at(line, p.beads_on || 'beads', 0.2);
  return (
    <g>
      <linearGradient id="tw-cupsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7CC4F0" /><stop offset="1" stopColor="#E6F6FF" /></linearGradient>
      <rect width={W} height={H} fill="url(#tw-cupsky)" />
      <g transform={`translate(${p.side ? 560 : 960} 560)`}>
        {p.side && <g transform="translate(0 0)"><path d="M -140 -200 L 140 -200 L 104 170 L -104 170 Z" fill="#fff" {...st(8)} /><text x={0} y={-30} textAnchor="middle" fontFamily={OSWALD} fontWeight={700} fontSize={60} fill="#2563EB">YOU</text><path d="M -50 40 q 25 -30 50 0 q 25 30 50 0" stroke="#2563EB" strokeWidth={10} fill="none" />
          <g transform="translate(-110 230)"><Box x={0} y={0} w={220} h={60} text="BEFORE" fill="#FFFFFF" rot={-2} /></g></g>}
      </g>
      <g transform={`translate(${p.side ? 1360 : 960} ${560 + (1 - k) * 110})`}>
        <g transform={`scale(${p.side ? 0.42 : k})`}><path d="M -140 -200 L 140 -200 L 104 170 L -104 170 Z" fill="#fff" {...st(8 / Math.max(0.42, p.side ? 0.42 : k))} />
          <text x={0} y={-30} textAnchor="middle" fontFamily={OSWALD} fontWeight={700} fontSize={60} fill="#2563EB">YOU</text><path d="M -50 40 q 25 -30 50 0 q 25 30 50 0" stroke="#2563EB" strokeWidth={10} fill="none" /></g>
        {p.arrows && (() => { const a = at(line, p.arrows_on || 'pushes', 0.3); const k = lin(f, a, a + 16, 0, 1); return f >= a ? <g opacity={k}>
          {[[-300, 0, 0], [300, 0, 180], [0, -330, 90], [0, 260, -90]].map(([dx, dy, r], i) => <g key={i} transform={`translate(${dx * (1.1 - 0.1 * k)} ${dy * (1.1 - 0.1 * k)}) rotate(${r})`}><path d="M -70 0 L 20 0 M 0 -26 L 30 0 L 0 26" stroke="#E3232C" strokeWidth={22} fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>)}</g> : null; })()}
        {p.side && <g transform="translate(-110 120)"><Box x={0} y={0} w={220} h={60} text="AFTER" fill="#FDE047" rot={2} /></g>}
      </g>
      {beads && <g transform={`translate(1650 300) scale(${0.85 * sp(f, at(line, p.beads_on || 'beads', 0.2), 'card')})`}>
        <circle r={170} fill="#fff" {...st(7)} />
        {[...Array(19)].map((_, i) => { const a = i * 2.4, r = 30 + (i % 4) * 34; const sq = lin(f, at(line, p.air_on || 'forcing', 0.6), at(line, p.air_on || 'forcing', 0.6) + 20, 1, 0.45);
          return <circle key={i} cx={Math.cos(a) * r * sq} cy={Math.sin(a) * r * sq} r={22 * sq} fill="#E0F2FE" {...st(3)} />; })}
        <g transform="translate(-150 190)"><Box x={0} y={0} w={300} h={56} text="AIR SQUEEZED OUT" fill="#FDE047" rot={-1} /></g></g>}
      <Card line={line} f={f} />
      <Labels line={line} f={f} x0={80} y0={60} />
    </g>
  );
}

// ───────────── 12. ballast: water in to sink, weights off to rise ─────────────
function Ballast({f, len, line}) {
  const p = P(line), T = line.start + f;
  const wa = at(line, p.water_on || 'water', 0.3), da = at(line, p.drop_on || 'go', 0.5);
  const fill = p.drop ? 0 : lin(f, wa, wa + 40, 0, 1);
  const drop = p.drop ? lin(f, da, da + 30, 0, 1, Easing.in(Easing.quad)) : 0;
  return (
    <g>
      <Water m={p.m != null ? p.m : 60} T={T} />
      <g transform={`translate(960 ${360 + (p.drop ? -drop * 120 : fill * 60)})`}>
        <g transform="scale(1.5)"><YSub T={T} x={0} y={0} s={1} cup={p.drop ? 0.42 : 1} /></g>
        <path d="M -360 0 L -300 0" stroke={INK} strokeWidth={10} />
        <g transform="translate(-460 0)"><rect x={-90} y={-60} width={180} height={120} rx={20} fill="#E5E7EB" opacity={0.95} {...st(6)} />
          <rect x={-84} y={54 - 108 * fill} width={168} height={108 * fill} rx={14} fill="#2563EB" opacity={0.8} />
          <text x={0} y={-76} textAnchor="middle" fontFamily={OSWALD} fontWeight={700} fontSize={34} fill="#fff" stroke={INK} strokeWidth={6} paintOrder="stroke">TANK</text></g>
        {p.drop && [0, 1].map((i) => <g key={i} transform={`translate(${-80 + i * 160} ${230 + drop * 380})`}><rect x={-60} y={-30} width={120} height={60} fill="#475569" {...st(6)} />
          <text x={0} y={14} textAnchor="middle" fontFamily={OSWALD} fontWeight={700} fontSize={32} fill="#fff">STEEL</text></g>)}
      </g>
      <g transform="translate(1580 520)"><path d={p.drop ? 'M 0 120 L 0 -120 M -40 -70 L 0 -120 L 40 -70' : 'M 0 -120 L 0 120 M -40 70 L 0 120 L 40 70'} stroke="#FDE047" strokeWidth={16} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={p.drop ? lin(f, da, da + 10, 0, 1) : lin(f, wa, wa + 10, 0, 1)} />
        <text x={0} y={190} textAnchor="middle" fontFamily={OSWALD} fontWeight={700} fontSize={52} fill="#fff" stroke={INK} strokeWidth={8} paintOrder="stroke">{p.drop ? 'RISE' : 'SINK'}</text></g>
      <Card line={line} f={f} />
      <Labels line={line} f={f} x0={80} y0={60} />
    </g>
  );
}

// the title: YOU vs 11 KM over the deep, with the sub dropping away below
function TwTitle({f, len, line}) {
  const T = line.start + f;
  return (
    <g>
      <Water m={lin(f, 0, len, 200, 900)} T={T} glow={0.4} />
      <g transform={`translate(960 ${560 + f * 1.2}) rotate(${Math.sin(T * 0.07) * 8}) scale(0.32)`}><Figure who="you" pose="kick" expr="scared" f={T * 2} seed={3} shadow={false} /></g>
      <g transform={`translate(960 300) scale(${sp(f, 4, 'heavy')})`}>
        <Box x={-560} y={-110} w={360} h={200} text="YOU" fill="#FDE047" rot={-4} />
        <text x={-80} y={50} textAnchor="middle" fontFamily={OSWALD} fontWeight={700} fontSize={130} fill="#fff" stroke={INK} strokeWidth={12} paintOrder="stroke">vs</text>
        <Box x={40} y={-110} w={520} h={200} text="11 KM" fill="#FFFFFF" rot={3} />
      </g>
    </g>
  );
}

// the thumbnail (Thumb id 'trench'): a scared you being pulled down on the left, the depth ruler to 10,935 M on the right with the
// little yellow sub's light finding something on the floor, YOU vs 11 KM in the channel's boxes
export function TrenchArt() {
  const T = 40;
  return (
    <g>
      <linearGradient id="tt-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3FA9E0" /><stop offset="0.35" stopColor="#11407A" /><stop offset="0.75" stopColor="#04122A" /><stop offset="1" stopColor="#010409" /></linearGradient>
      <rect width={W} height={H} fill="url(#tt-bg)" />
      {[...Array(5)].map((_, i) => <path key={i} d={`M ${80 + i * 260} -20 l 90 0 l 200 700 l -110 0 Z`} fill="#D6F1FF" opacity={0.12} />)}
      {[...Array(60)].map((_, i) => { const R = rng(400 + i); return <circle key={i} cx={R() * W} cy={R() * H} r={2 + R() * 5} fill="#E6F4FF" opacity={0.35} />; })}
      {/* you, pulled down: the line from the ankles into the dark */}
      <path d="M 520 1080 C 540 980 470 900 500 820" stroke="#0A0E14" strokeWidth={14} fill="none" />
      <g transform="translate(520 470) rotate(-6) scale(1.25)"><Bust who="you" x={0} y={0} expr="shock" f={T} arms="flail" /></g>
      {[...Array(9)].map((_, i) => <circle key={'b' + i} cx={640 + (i % 3) * 40} cy={300 - i * 34} r={10 + (i % 4) * 5} fill="none" stroke="#E6F7FF" strokeWidth={5} opacity={0.85} />)}
      {/* the depth ruler down the right */}
      <path d="M 1500 120 L 1500 1000" stroke="#E6F2FF" strokeWidth={8} opacity={0.8} />
      {[0, 2, 4, 6, 8, 10].map((k) => <path key={k} d={`M 1500 ${120 + k * 80} l 40 0`} stroke="#E6F2FF" strokeWidth={8} opacity={0.8} />)}
      <g transform="translate(1560 990)"><circle r={60} fill="#EF4444" opacity={0.25} /><Box x={0} y={-60} w={330} h={100} text="10,935 M" fill="#EF4444" color="#fff" rot={-2} /></g>
      <path d="M 1240 900 L 1060 1080 L 1300 1080 Z" fill="#FFF6C8" opacity={0.22} />
      <g transform="translate(1330 880) scale(0.45)"><YSub T={T} beam={0} /></g>
      <g transform="translate(1180 1010) scale(0.6)"><Bag T={T} /></g>
      <Box x={960} y={70} w={330} h={190} text="YOU" fill="#FDE047" rot={-4} />
      <text x={1360} y={225} fontFamily={OSWALD} fontWeight={700} fontSize={110} fill="#fff" stroke={INK} strokeWidth={12} paintOrder="stroke">vs</text>
      <Box x={960} y={290} w={520} h={210} text="11 KM" fill="#FFFFFF" rot={3} />
    </g>
  );
}

export const TRENCH_SHOTS = {tw_dive: Dive, tw_section: Section, tw_surface: Surface, tw_cabin: Cabin, tw_cards: Cards, tw_flash: Flashback,
  tw_pressure: Pressure, tw_fishline: FishLine, tw_floor: Floor, tw_bag: Bag2019, tw_cup: Cup, tw_ballast: Ballast, tw_title: TwTitle};
