// Storygraphics #3 (2.59.0), the animal and the clock: generic cards, size comparisons, the jaws, the bite, the whale bones, the
// nursery, the timeline, the warm blood, and the shark hiding in the dark. Every scene takes {f, len, line}; line.p holds the
// script's choices (modes, words to land on, labels).
import React from 'react';
import {noise2D} from '@remotion/noise';
import {W, H, INK, ST, st, clamp, lin, pop, rng, Box, at, Labels} from './tis';
import {Sea, Deep, Seabed, camShake} from './ocean';
import {Shark, Jaws, Boat} from './meg';
import {Emoji} from './emoji';

export const P = (line) => line.p || {};
export const OSW = "'Oswald', sans-serif";
export const Txt = ({x, y, text, size = 60, fill = '#fff', anchor = 'middle', stroke = INK, op = 1}) => (
  <text x={x} y={y} textAnchor={anchor} fontFamily={OSW} fontWeight={700} fontSize={size} fill={fill} stroke={stroke} strokeWidth={size * 0.12} paintOrder="stroke" opacity={op}>{text}</text>
);
export const Cam = ({f, len, a = 1, b = 1.06, x = W / 2, y = H / 2, shake = 0, hand = 0, children}) => {
  const z = lin(f, 0, len, a, b);
  const [sx, sy] = camShake(f, shake, hand);
  return <g transform={`translate(${W / 2 + sx} ${H / 2 + sy}) scale(${z}) translate(${-x} ${-y})`}>{children}</g>;
};
export const BG = ({c = '#0F2A44'}) => <rect width={W} height={H} fill={c} />;
// a shape popping in on a spoken word (frame a = the word's frame)
export const popAt = (f, line, word, frac = 0.3) => clamp(pop(f, at(line, word || '', frac), 140, 12), 0, 1.1);
// the same, but never later than frame `by` (a scene's first thing is on screen at once: Israa found blank starts)
export const popBy = (f, line, word, frac = 0.3, by = 8) => clamp(pop(f, Math.min(at(line, word || '', frac), by), 140, 12), 0, 1.1);

// a whale, flat, in the kit's look (2.61.1: the emoji whales clashed with the drawings), facing right, `len` px long
export const Whale = ({len = 400, f = 0, spout = false, flip = false, bite = false}) => {
  const k = len / 1000;
  return (
    <g transform={`scale(${flip ? -k : k} ${k})`}>
      <path d={`M -430 -15 C -500 -40 -560 ${-70 + Math.sin(f * 0.08) * 12} -610 -60 C -575 -20 -575 10 -610 ${45 + Math.sin(f * 0.08) * 12} C -555 40 -495 25 -430 15 Z`} fill="#3E5F7C" {...ST} />
      <path d="M 480 20 C 470 -90 300 -150 60 -150 C -160 -150 -330 -90 -430 -20 C -440 0 -440 10 -430 20 C -330 80 -200 105 0 115 C 300 125 430 95 480 20 Z" fill="#4A6E8C" {...ST} />
      <path d="M 470 42 C 380 98 150 112 -50 104 C -200 95 -330 70 -425 22 C -320 58 -150 74 50 72 C 250 70 400 60 470 42 Z" fill="#C9D6E2" />
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M ${300 - i * 90} ${70 + i * 3} L ${200 - i * 90} ${80 + i * 3}`} stroke="#8FA3B5" strokeWidth={6} strokeLinecap="round" />)}
      <path d="M 210 85 C 170 160 110 205 40 215 C 90 170 130 120 150 92 Z" fill="#3E5F7C" {...ST} />
      <circle cx={330} cy={5} r={12} fill={INK} />
      <path d="M 478 32 C 420 48 360 54 300 48" fill="none" {...st(6)} />
      {bite && <path d="M -60 -150 C -40 -60 80 -60 110 -146 Z" fill="#7F1D1D" {...st(6)} />}
      {spout && <g stroke="#BFE6FF" strokeWidth={16} fill="none" strokeLinecap="round"><path d="M 370 -140 C 350 -230 300 -270 250 -262" /><path d="M 370 -140 C 390 -230 440 -270 490 -262" /></g>}
    </g>
  );
};
// a bus drawn to its real proportions (12 x 3.2 m; the emoji bus was far too tall): `m` = px per metre, centred
export const DrawnBus = ({m}) => (
  <g>
    <rect x={-6 * m} y={-1.6 * m} width={12 * m} height={2.9 * m} rx={0.4 * m} fill="#FACC15" {...st(5)} />
    {[...Array(7)].map((_, i) => <rect key={i} x={-5.4 * m + i * 1.55 * m} y={-1.25 * m} width={1.15 * m} height={0.9 * m} rx={4} fill="#BFE6FF" {...st(3)} />)}
    <rect x={-6 * m} y={0.55 * m} width={12 * m} height={0.25 * m} fill="#1F2937" />
    {[-3.8, 3.6].map((x) => <circle key={x} cx={x * m} cy={1.3 * m} r={0.5 * m} fill="#1F2937" {...st(4)} />)}
  </g>
);
// the shark drawn small for size comparisons: the slim megalodon (dark) or a great white (stocky: drawn 1.45x deeper), `len` px long
export const Silhouette = ({len = 1000, kind = 'meg', color, op = 1, f = 0}) => {
  const k = len / 1630;
  return <g transform={`scale(${k} ${kind === 'gw' ? k * 1.45 : k})`} opacity={op}><Shark f={f} color={color || (kind === 'gw' ? 'grey' : 'dark')} /></g>;
};

// ───────────── generic: a card of big words that pop on their words, over a colour or a drawing ─────────────
function MCard({f, len, line}) {
  const p = P(line);
  const lines = p.lines || [];
  const side = p.thing || p.shark;
  const h = p.h || 150;
  return (
    <g><Cam f={f} len={len} a={1} b={1.04}>
      <BG c={p.color || '#0F2A44'} />
      {p.thing && <g transform={`translate(${p.tx || 1480} ${p.ty || 520}) scale(${popBy(f, line, p.thing_on, 0.1, 6)})`}><Emoji name={p.thing} size={p.ts || 460} /></g>}
      {p.shark && <g transform={`translate(1540 540) scale(${popBy(f, line, p.thing_on, 0.1, 6)})`}><Silhouette len={700} color="grey" f={f} /></g>}
      {lines.map((t, i) => { const s = i === 0 ? popBy(f, line, (p.on || [])[0], 0.1, 10) : popAt(f, line, (p.on || [])[i], 0.1 + i * 0.25);
        const w = Math.min(side ? 1000 : 1700, String(t).length * h * 0.5 + 90);
        const red = i === (p.red ?? -1);
        return <g key={i} transform={`translate(${side ? 120 : W / 2 - w / 2} ${(p.y0 || (side ? 220 : 470 - lines.length * (h + 50) / 2 + 40)) + i * (h + 50)})`}>
          <Box x={0} y={0} w={w} h={h} text={t} fill={red ? '#E3232C' : '#FFE11A'} color={red ? '#fff' : INK} outline={red} rot={i % 2 ? 2 : -2} s={s} /></g>; })}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// "first the legend, then the test": two panels
function MPlan({f, len, line}) {
  const p = P(line);
  const a = at(line, p.a_on || 'legend', 0.2), b = at(line, p.b_on || 'test', 0.6);
  const sa = clamp(pop(f, a, 130, 12), 0, 1.05), sb = clamp(pop(f, b, 130, 12), 0, 1.05);
  return (
    <g>
      <BG c="#0B1F3A" />
      <g transform={`translate(520 520) scale(${sa})`}>
        <rect x={-380} y={-300} width={760} height={600} rx={30} fill="#F5EBD7" {...ST} />
        <Txt x={0} y={-200} text="THE LEGEND" size={90} fill="#E3232C" />
        {['A', 'B', 'C', 'D', 'E'].map((t, i) => <g key={t} transform={`translate(${-280 + i * 140} 30)`}><rect x={-55} y={-70} width={110} height={140} rx={12} fill="#fff" {...st(6)} /><Txt x={0} y={30} text={t} size={80} fill={INK} stroke="none" /></g>)}
        <Txt x={0} y={220} text="EXHIBITS" size={60} fill={INK} stroke="none" />
      </g>
      <g transform={`translate(1400 520) scale(${sb})`}>
        <rect x={-380} y={-300} width={760} height={600} rx={30} fill="#1E293B" {...ST} />
        <Txt x={0} y={-200} text="THE TEST" size={90} fill="#FFE11A" />
        {[0, 1, 2].map((i) => <g key={i} transform={`translate(${-230 + i * 230} 40)`}><Gauge v={lin(f, b + 6 + i * 6, b + 30 + i * 6, 0.5, 0.5 + 0.3 * Math.sin(i * 2 + 1))} s={0.55} /></g>)}
        <Txt x={0} y={220} text="EVERY PIECE" size={60} />
      </g>
    </g>
  );
}

// a round gauge: v 0 (FAIL, left) .. 1 (PASS, right)
export const Gauge = ({v = 0.5, s = 1, label = '', fail = false}) => {
  const ang = -150 + 120 * clamp(v, 0, 1) - 30 * 0;
  return (
    <g transform={`scale(${s})`}>
      <circle r={200} fill="#F8FAFC" {...ST} />
      <path d="M -170 0 A 170 170 0 0 1 -60 -159" stroke="#E3232C" strokeWidth={40} fill="none" />
      <path d="M -60 -159 A 170 170 0 0 1 60 -159" stroke="#F59E0B" strokeWidth={40} fill="none" />
      <path d="M 60 -159 A 170 170 0 0 1 170 0" stroke="#22C55E" strokeWidth={40} fill="none" />
      <g transform={`rotate(${-90 + 180 * clamp(v, 0, 1) - 0 * ang})`}><path d="M -10 0 L 0 -150 L 10 0 Z" fill={INK} /></g>
      <circle r={22} fill={INK} />
      <Txt x={-120} y={70} text="FAIL" size={40} fill="#E3232C" stroke="none" /><Txt x={120} y={70} text="PASS" size={40} fill="#16A34A" stroke="none" />
      {label && <Txt x={0} y={150} text={label} size={56} fill={INK} stroke="none" />}
      {fail && <g transform="rotate(-12)"><rect x={-200} y={-60} width={400} height={120} rx={14} fill="none" stroke="#E3232C" strokeWidth={14} /><Txt x={0} y={30} text="FAIL" size={100} fill="#E3232C" stroke="none" /></g>}
    </g>
  );
};

// ───────────── sizes: the megalodon against a bowling lane and a car / two trucks / a great white / the megamouth / buses ─────────────
const Lane = ({w}) => (<g><rect x={0} y={-30} width={w} height={60} fill="#D9A066" {...st(5)} />{[...Array(8)].map((_, i) => <path key={i} d={`M ${i * w / 8} -30 L ${i * w / 8} 30`} stroke="#B07A45" strokeWidth={3} />)}
  {[0, 1, 2].map((r) => [...Array(r + 1)].map((_, c) => <ellipse key={r + '-' + c} cx={w - 60 + r * 20} cy={-10 + (c - r / 2) * 22} rx={8} ry={14} fill="#fff" {...st(3)} />))}</g>);
function MScale({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'lane';
  const g = at(line, p.grow_on || '', 0.15), s = clamp(pop(f, g, 120, 14), 0, 1.04);
  const px = p.px || 58;   // px per metre
  const base = 760;
  return (
    <g><Cam f={f} len={len} a={1} b={1.04}>
      <BG c="#0F2A44" />
      <path d={`M 0 ${base + 60} L ${W} ${base + 60}`} stroke="#1E4466" strokeWidth={6} />
      {mode === 'lane' && <g>
        <g transform={`translate(${140 + 24.3 * px / 2} ${base - 330}) scale(${s})`}><Silhouette len={24.3 * px} f={f} /></g>
        <g transform={`translate(140 ${base + 10})`} opacity={clamp((f - g - 10) / 10, 0, 1)}><Lane w={18.3 * px} />
          <g transform={`translate(${18.3 * px + 4.5 * px / 2} -60)`}><Emoji name="automobile" size={4.5 * px} flip /></g></g>
        <Txt x={140 + 9 * px} y={base + 100} text="BOWLING LANE" size={40} op={clamp((f - g - 10) / 10, 0, 1)} />
      </g>}
      {mode === 'weight' && <g>
        <path d={`M 960 ${base + 40} L 920 ${base - 220} L 1000 ${base - 220} Z`} fill="#94A3B8" {...ST} />
        <g transform={`rotate(${lin(f, g, g + 30, 0, -4)} 960 ${base - 230})`}>
          <rect x={250} y={base - 250} width={1420} height={30} rx={10} fill="#64748B" {...ST} />
          <g transform={`translate(560 ${base - 380}) scale(0.4)`}><Shark f={f} color="dark" /></g>
          <g transform={`translate(1240 ${base - 330})`}><Emoji name="articulated lorry" size={250} /></g>
          <g transform={`translate(1480 ${base - 330})`}><Emoji name="articulated lorry" size={250} /></g>
        </g>
      </g>}
      {mode === 'shape' && <g>
        <g transform={`translate(${lin(f, g - 12, g + 14, 960, 420)} ${lin(f, g - 12, g + 14, 480, 330)})`}><Silhouette len={lin(f, g - 12, g + 14, 900, 1400 * 7 / 24.3)} kind="gw" f={f} /></g>
        <Txt x={lin(f, g - 12, g + 14, 960, 420)} y={lin(f, g - 12, g + 14, 790, 230)} text="GREAT WHITE: STOCKY, ~7 M" size={lin(f, g - 12, g + 14, 64, 44)} />
        <g transform={`translate(1150 640) scale(${s})`}><Silhouette len={1400} f={f} /></g>
        <Txt x={1150} y={880} text="MEGALODON: SLIMMER, UP TO 24.3 M" size={44} op={clamp((f - g) / 10, 0, 1)} />
        {p.scale_extras !== false && (() => {   // 2.61.0: the same true scale (1400 px = 24.3 m): a diver (1.8 m) and a bus (12 m)
          const m = 1400 / 24.3, k = clamp(pop(f, g + 14, 140, 13), 0, 1.04);
          return (<g opacity={clamp((f - g - 10) / 10, 0, 1)}>
            <g transform={`translate(1540 250) scale(${k})`}>   {/* drawn to its real proportions (12 x 3.2 m); the emoji bus is far too tall */}
              <rect x={-6 * m} y={-1.6 * m} width={12 * m} height={2.9 * m} rx={0.4 * m} fill="#FACC15" {...st(5)} />
              {[...Array(7)].map((_, i) => <rect key={i} x={-5.4 * m + i * 1.55 * m} y={-1.25 * m} width={1.15 * m} height={0.9 * m} rx={6} fill="#BFE6FF" {...st(3)} />)}
              <rect x={-6 * m} y={0.55 * m} width={12 * m} height={0.25 * m} fill="#1F2937" />
              {[-3.8, 3.6].map((x) => <circle key={x} cx={x * m} cy={1.3 * m} r={0.5 * m} fill="#1F2937" {...st(4)} />)}
            </g>
            <Txt x={1540} y={250 + 2.4 * m} text="BUS: 12 M" size={40} />
            <g transform={`translate(870 330) scale(${k})`}>
              <ellipse cx={0} cy={0} rx={0.62 * m} ry={0.16 * m} fill="#111827" {...st(4)} />
              <circle cx={0.78 * m} cy={-0.04 * m} r={0.15 * m} fill="#F2C29B" {...st(3)} />
              <rect x={0.74 * m} y={-0.14 * m} width={0.2 * m} height={0.11 * m} rx={3} fill="#38BDF8" {...st(2)} />
              <path d={`M ${-0.62 * m} 0 L ${-0.95 * m} ${-0.1 * m} M ${-0.62 * m} ${0.05 * m} L ${-0.95 * m} ${0.12 * m}`} stroke="#111827" strokeWidth={0.1 * m} strokeLinecap="round" />
            </g>
            <Txt x={870} y={420} text="DIVER: 1.8 M" size={40} />
          </g>); })()}
      </g>}
      {mode === 'hide' && <g>
        <g transform={`translate(${400} ${base - 160})`}><Silhouette len={4.5 * px} color="grey" f={f} /></g>
        <Txt x={400} y={base - 30} text="MEGAMOUTH 4.5 M" size={40} />
        <g transform={`translate(${1150} ${base - 260}) scale(${s})`}><Silhouette len={24.3 * px * 0.5} op={0.35} f={f} /></g>
        <Txt x={1150} y={base - 30} text="24 M?" size={60} fill="#FDE047" op={clamp((f - g) / 10, 0, 1)} />
      </g>}
      {mode === 'bus' && (() => {   // 2.61.1: one true scale (32 px a metre): two 12 m buses nose to tail ARE the megalodon's 24 m
        const m = 32;
        return (<g>
          <g transform="translate(330 380)"><Silhouette len={4.5 * m} color="grey" f={f} /></g>
          <g transform="translate(330 470)"><Emoji name="automobile" size={4.5 * m} /></g>
          <Txt x={330} y={560} text="CAR-SIZED: 4.5 M" size={40} />
          <g transform={`translate(1240 380) scale(${s})`}><Silhouette len={24.3 * m} f={f} /></g>
          <g opacity={clamp((f - g - 6) / 10, 0, 1)}>
            <g transform={`translate(${1240 - 6 * m} 690)`}><DrawnBus m={m} /></g>
            <g transform={`translate(${1240 + 6 * m} 690)`}><DrawnBus m={m} /></g>
            <Txt x={1240} y={810} text="TWO BUSES = 24 M" size={44} fill="#FDE047" />
          </g>
        </g>); })()}
      {mode === 'rival' && <g>
        <g transform={`translate(1100 ${base - 300})`}><Silhouette len={24.3 * px * 0.6} op={0.9} f={f} /></g>
        <g transform={`translate(420 ${base - 120}) scale(${s})`}><Silhouette len={7 * px} kind="gw" f={f} /></g>
        <Txt x={420} y={base + 10} text="LESS THAN 1/3" size={54} fill="#FDE047" op={clamp((f - g) / 10, 0, 1)} />
      </g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// "you could drive a small car through them"
function MJawsCar({f, len, line}) {
  const p = P(line);
  const c = at(line, p.car_on || 'car', 0.5);
  const x = lin(f, c - 4, c + 40, -300, 2200, (t) => t);
  return (
    <g><Cam f={f} len={len} a={1.05} b={1}>
      <Deep f={f} depth={0.5} id="mjc" />
      <g transform="translate(960 560) scale(0.95)"><Jaws f={f} open={1} /></g>
      <g transform={`translate(${x} 640) scale(-1 1)`}><Emoji name="automobile" size={300} /></g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// the bite: two gauges, the megalodon's needle to 18 tonnes, the great white's to 1.8
function MBite({f, len, line}) {
  const p = P(line);
  const a = at(line, p.meg_on || '18', 0.2), b = at(line, p.gw_on || '1.8', 0.6), m = at(line, p.model_on || 'model', 0.85);
  const needle = (v) => -90 + 180 * clamp(v, 0, 1);
  const Dial = ({x, v, max, label, big}) => (
    <g transform={`translate(${x} 470)`}>
      <circle r={300} fill="#F8FAFC" {...ST} />
      {[...Array(11)].map((_, i) => { const ang = (-90 + i * 18) * Math.PI / 180; return <path key={i} d={`M ${Math.sin(ang) * 250} ${-Math.cos(ang) * 250} L ${Math.sin(ang) * 280} ${-Math.cos(ang) * 280}`} stroke={INK} strokeWidth={6} />; })}
      <g transform={`rotate(${needle(v)})`}><path d="M -14 0 L 0 -250 L 14 0 Z" fill="#E3232C" {...st(4)} /></g>
      <circle r={30} fill={INK} />
      <Txt x={0} y={150} text={big} size={100} fill={INK} stroke="none" />
      <Txt x={0} y={370} text={label} size={56} />
      <Txt x={0} y={-320} text={`0 - ${max}`} size={30} op={0} />
    </g>
  );
  return (
    <g>
      <BG c="#0B1F3A" />
      <Dial x={560} v={lin(f, a, a + 30, 0, 1)} max="20 T" label="MEGALODON (MODEL)" big={`${(18 * clamp((f - a) / 30, 0, 1)).toFixed(0)} T`} />
      <Dial x={1360} v={lin(f, b, b + 24, 0, 0.09)} max="20 T" label="BIGGEST GREAT WHITE" big={`${(1.8 * clamp((f - b) / 24, 0, 1)).toFixed(1)} T`} />
      {f > m && <g transform={`translate(960 120) rotate(-3) scale(${clamp(pop(f, m, 140, 12), 0, 1)})`}><Box x={-430} y={-50} w={860} h={110} text="A MODEL, NOT A MEASUREMENT" fill="#FDE047" /></g>}
    </g>
  );
}

// fossil whale bones from Peru with the cuts of megalodon teeth
function MWhaleBone({f, len, line}) {
  const p = P(line);
  const w = at(line, p.whale_on || 'whales', 0.15), b = at(line, p.bone_on || 'bones', 0.5);
  const R = rng(5);
  return (
    <g><Cam f={f} len={len} a={1} b={1.07}>
      <BG c="#C9A66B" />
      <rect y={700} width={W} height={380} fill="#B08850" />
      <g transform={`translate(1450 290) scale(${clamp(pop(f, Math.min(w, 8), 130, 12), 0, 1)})`}><Whale len={460} f={f} spout /></g>
      <g transform={`translate(760 640) scale(${clamp(pop(f, b, 120, 13), 0, 1.04)})`}>
        <path d="M -520 -40 C -420 -110 -200 -120 0 -100 C 200 -80 420 -90 520 -30 C 540 20 500 60 420 50 C 220 30 -160 40 -420 60 C -520 70 -560 20 -520 -40 Z" fill="#F1E5C8" {...ST} />
        {[...Array(9)].map((_, i) => <path key={i} d={`M ${-380 + i * 90} ${-90 + R() * 20} l ${10 + R() * 14} ${50 + R() * 30}`} stroke="#7F1D1D" strokeWidth={8} strokeLinecap="round" />)}
        <Txt x={0} y={150} text="BITE MARKS" size={50} fill="#7F1D1D" stroke="#F1E5C8" />
      </g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// a warm shallow lagoon with young megalodons; mode 'resort' = the same kind of water today, full of people
function MNursery({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'lagoon';
  const nb = at(line, p.baby_on || 'newborn', 0.5);
  const R = rng(9);
  return (
    <g><Cam f={f} len={len} a={1} b={1.05} y={520}>
      <rect width={W} height={H} fill="#7DD3FC" />
      <path d="M -40 300 C 300 260 700 320 1000 290 C 1400 250 1700 300 1960 280 L 1960 -40 L -40 -40 Z" fill="#F6E7B8" {...st(5)} />
      {mode === 'resort' && <g>   {/* 2.61.1: drawn flat, like the rest (the emoji hotels and boats clashed) */}
        {[[160, 170], [330, 230], [560, 150], [1180, 210], [1380, 160], [1640, 240]].map(([x, hgt], i) => <g key={'h' + i}>
          <rect x={x - 70} y={290 - hgt} width={140} height={hgt} fill={['#F5EBD7', '#E2E8F0', '#FDE6C8'][i % 3]} {...st(5)} />
          {[...Array(Math.floor(hgt / 40))].map((_, r) => [0, 1, 2].map((c) => <rect key={r + '-' + c} x={x - 52 + c * 38} y={300 - hgt + 14 + r * 40} width={24} height={20} fill="#7DD3FC" {...st(2)} />))}</g>)}
        {[760, 900, 1040].map((x, i) => <g key={'u' + i} transform={`translate(${x} 250)`}><path d="M 0 0 L 0 -70" {...st(5)} /><path d="M -60 -60 C -40 -110 40 -110 60 -60 Z" fill={['#E3232C', '#FACC15', '#22C55E'][i]} {...st(5)} /></g>)}
        {[[300, 520], [700, 700], [1150, 560], [1560, 690]].map(([x, y], i) => <g key={'b' + i} transform={`translate(${x + Math.sin(f * 0.05 + i) * 24} ${y}) scale(${i % 2 ? -1 : 1} 1)`}>
          <path d="M -110 0 L 110 0 C 100 30 80 45 50 50 L -90 50 C -105 35 -110 20 -110 0 Z" fill={['#F8FAFC', '#E3232C', '#F8FAFC', '#2563EB'][i]} {...st(5)} />
          <rect x={-40} y={-40} width={80} height={40} rx={8} fill="#CBD5E1" {...st(4)} /></g>)}
        {[[520, 600], [880, 520], [1320, 760]].map(([x, y], i) => <g key={'s' + i} transform={`translate(${x} ${y + Math.sin(f * 0.1 + i) * 4})`}>
          <circle r={18} fill="#F2C29B" {...st(4)} /><path d="M -40 10 C -30 -6 -20 -6 -14 6 M 40 10 C 30 -6 20 -6 14 6" fill="none" {...st(5)} />
          <path d="M -60 22 C -20 12 20 12 60 22" stroke="#E0F2FE" strokeWidth={6} fill="none" /></g>)}
      </g>}
      {mode !== 'resort' && [...Array(4)].map((_, i) => { const x = 300 + i * 380 + Math.sin(f * 0.03 + i) * 80, y = 600 + R() * 260;
        return <g key={i} transform={`translate(${x} ${y}) scale(${0.16 + (i % 2) * 0.05}) ${Math.cos(f * 0.03 + i) < 0 ? 'scale(-1 1)' : ''}`}><Shark f={f + i * 7} color="grey" /></g>; })}
      {mode === 'lagoon' && p.baby !== false && f > nb && <g opacity={clamp((f - nb) / 10, 0, 1)}>
        <rect x={1060} y={560} width={780} height={300} rx={24} fill="#0F2A44" opacity={0.9} {...st(5)} />
        <g transform="translate(1270 690) scale(0.2)"><Shark f={f} color="grey" /></g>
        <g transform="translate(1660 690)"><Emoji name="automobile" size={230} flip /></g>
        <Txt x={1450} y={830} text="NEWBORN: 3.6-3.9 M" size={50} fill="#FDE047" />
      </g>}
      {mode === 'note' && <g transform={`translate(1500 820) rotate(4) scale(${clamp(pop(f, 4, 140, 12), 0, 1)})`}><rect x={-260} y={-100} width={520} height={200} fill="#FDE047" {...ST} /><Txt x={0} y={20} text="REMEMBER THIS" size={64} fill={INK} stroke="none" /></g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={360} /></g>
  );
}

// the timeline: a band of teeth 23 -> 3.6 million years ago, then nothing to today. modes band | stop | empty | cool
function MTimeline({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'band';
  const x0 = 140, x1 = 1780;   // 25 Ma .. 0
  const X = (ma) => x0 + (25 - ma) / 25 * (x1 - x0);
  const grow = mode === 'band' ? lin(f, 10, len * 0.8, 23, 3.6) : 3.6;
  const old = at(line, p.old_on || 'older', 0.3);
  const R = rng(3);
  return (
    <g><Cam f={f} len={len} a={1} b={1.03}>
      <BG c="#0B1F3A" />
      <path d={`M ${x0} 600 L ${x1} 600`} stroke="#94A3B8" strokeWidth={8} />
      {[25, 20, 15, 10, 5, 0].map((ma) => <g key={ma}><path d={`M ${X(ma)} 580 L ${X(ma)} 620`} stroke="#94A3B8" strokeWidth={6} /><Txt x={X(ma)} y={680} text={ma ? `${ma}M` : 'TODAY'} size={38} /></g>)}
      <rect x={X(23)} y={520} width={Math.max(0, X(grow) - X(23))} height={60} rx={14} fill="#FDE047" {...st(5)} />
      {[...Array(28)].map((_, i) => { const ma = 23 - i * (19.4 / 27); if (ma < grow) return null;
        return <path key={i} d={`M ${X(ma) - 14} 470 L ${X(ma) + 14} 470 L ${X(ma)} ${505 + R() * 6} Z`} fill="#F1E5C8" {...st(3)} />; })}
      {mode !== 'band' && <g><Txt x={X(3.6)} y={430} text="3.6 MILLION YEARS AGO" size={44} fill="#FDE047" /><path d={`M ${X(3.6)} 445 L ${X(3.6)} 520`} stroke="#FDE047" strokeWidth={6} /></g>}
      {mode === 'stop' && f > old && <g opacity={clamp((f - old) / 10, 0, 1)}><Txt x={X(2.6)} y={800} text="OLD DATE: 2.6M" size={54} fill="#E2E8F0" />
        <path d={`M ${X(2.6) - 150} 790 L ${X(2.6) + 150} 770`} stroke="#E3232C" strokeWidth={10} opacity={clamp((f - old - 30) / 8, 0, 1)} /></g>}
      {mode === 'empty' && <g><Txt x={(X(3.6) + x1) / 2} y={560} text="0 TEETH" size={70} fill="#E3232C" op={clamp((f - 10) / 10, 0, 1)} /></g>}
      {mode === 'cool' && <rect x={X(5)} y={500} width={x1 - X(5)} height={110} fill="#BAE6FD" opacity={clamp(f / 40, 0, 0.45)} />}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// warm blood: a thermometer against the sea; mode 'fuel' = a fuel gauge running down
function MThermo({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'warm';
  const a = at(line, p.on || '7', 0.4);
  const t = clamp((f - a) / 30, 0, 1);
  return (
    <g><Cam f={f} len={len} a={1} b={1.05}>
      <Deep f={f} depth={0.35} id="mth" />
      <g transform="translate(700 600) scale(0.6)"><Shark f={f} color="grey" glow={mode === 'warm' ? t : 0} /></g>
      {mode === 'warm' && <g transform="translate(1560 560)">
        <rect x={-50} y={-330} width={100} height={560} rx={50} fill="#F8FAFC" {...ST} />
        <circle cx={0} cy={250} r={90} fill="#E3232C" {...ST} />
        <rect x={-26} y={230 - 420 * (0.4 + 0.4 * t)} width={52} height={420 * (0.4 + 0.4 * t)} fill="#E3232C" />
        <Txt x={0} y={-380} text={`+${(7 * t).toFixed(0)}°C`} size={90} fill="#FDE047" />
      </g>}
      {mode === 'fuel' && <g transform="translate(1520 560)">
        <path d="M -260 80 A 280 280 0 0 1 260 80" stroke="#F8FAFC" strokeWidth={60} fill="none" />
        <path d="M -260 80 A 280 280 0 0 1 260 80" stroke={INK} strokeWidth={6} fill="none" />
        <g transform={`rotate(${lin(f, 10, len - 10, 70, -70)})`}><path d="M -12 0 L 0 -250 L 12 0 Z" fill="#E3232C" {...st(4)} /></g>
        <Txt x={-230} y={170} text="E" size={70} /><Txt x={230} y={170} text="F" size={70} />
        <g transform="translate(0 -360)"><Emoji name="fuel pump" size={150} /></g>
      </g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// two stories side by side: the museum's and the believers'
function MTwo({f, len, line}) {
  const p = P(line);
  const a = at(line, p.a_on || 'official', 0.2), b = at(line, p.b_on || 'second', 0.5);
  return (
    <g>
      <BG c="#0B1F3A" />
      <g transform={`translate(520 520) scale(${clamp(pop(f, a, 130, 12), 0, 1.05)})`}><rect x={-380} y={-320} width={760} height={640} rx={30} fill="#F5EBD7" {...ST} />
        <g transform="translate(0 -40)"><Emoji name="classical building" size={300} /></g><Txt x={0} y={230} text="EXTINCT" size={90} fill={INK} stroke="none" /></g>
      <g transform={`translate(1400 520) scale(${clamp(pop(f, b, 130, 12), 0, 1.05)})`}><rect x={-380} y={-320} width={760} height={640} rx={30} fill="#0F2A44" {...ST} />
        <path d={`M -200 ${-20 + Math.sin(f * 0.1) * 6} L -60 -200 L 40 ${-20 + Math.sin(f * 0.1) * 6} Z`} fill="#94A3B8" {...ST} />
        <path d="M -340 0 C -200 -30 -60 30 80 0 C 200 -25 300 20 340 0" stroke="#7DD3FC" strokeWidth={10} fill="none" />
        <Txt x={0} y={230} text="STILL OUT THERE?" size={80} fill="#FDE047" /></g>
    </g>
  );
}

// "moved somewhere we cannot see": a faint shape in the dark
function MHide({f, len, line}) {
  return (
    <g><Cam f={f} len={len} a={1} b={1.1}>
      <Deep f={f} depth={0.95} id="mhd" />
      <g transform={`translate(${900 + noise2D('mh', f * 0.01, 0) * 60} ${620 + Math.sin(f * 0.02) * 20}) scale(0.9)`} opacity={0.5 + 0.12 * Math.sin(f * 0.05)}><Shark f={f} color="pale" glow={0.7} /></g>
      <rect width={W} height={H} fill="#000" opacity={0.18} />
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

export const MEG2_SHOTS = {m_card: MCard, m_plan: MPlan, m_scale: MScale, m_jaws_car: MJawsCar, m_bite: MBite, m_whalebone: MWhaleBone, m_nursery: MNursery,
  m_timeline: MTimeline, m_thermo: MThermo, m_two: MTwo, m_hide: MHide};
