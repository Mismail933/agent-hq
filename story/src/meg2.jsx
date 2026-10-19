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
      {p.thing && <g transform={`translate(${p.tx || 1480} ${p.ty || 520}) scale(${popAt(f, line, p.thing_on, 0.1)})`}><Emoji name={p.thing} size={p.ts || 460} /></g>}
      {p.shark && <g transform={`translate(1420 520) scale(${popAt(f, line, p.thing_on, 0.1)})`}><Silhouette len={760} color="grey" f={f} /></g>}
      {lines.map((t, i) => { const s = popAt(f, line, (p.on || [])[i], 0.1 + i * 0.25);
        const w = Math.min(side ? 1080 : 1700, String(t).length * h * 0.5 + 90);
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
      </g>}
      {mode === 'hide' && <g>
        <g transform={`translate(${400} ${base - 160})`}><Silhouette len={4.5 * px} color="grey" f={f} /></g>
        <Txt x={400} y={base - 30} text="MEGAMOUTH 4.5 M" size={40} />
        <g transform={`translate(${1150} ${base - 260}) scale(${s})`}><Silhouette len={24.3 * px * 0.5} op={0.35} f={f} /></g>
        <Txt x={1150} y={base - 30} text="24 M?" size={60} fill="#FDE047" op={clamp((f - g) / 10, 0, 1)} />
      </g>}
      {mode === 'bus' && <g>
        <g transform={`translate(330 ${base - 150})`}><Silhouette len={4.5 * px} color="grey" f={f} /></g>
        <g transform={`translate(330 ${base + 20})`}><Emoji name="automobile" size={180} /></g>
        <g transform={`translate(1200 ${base - 280}) scale(${s})`}><Silhouette len={24.3 * px * 0.55} f={f} /></g>
        <g transform={`translate(1020 ${base + 10})`} opacity={clamp((f - g - 6) / 10, 0, 1)}><Emoji name="bus" size={260} /></g>
        <g transform={`translate(1290 ${base + 10})`} opacity={clamp((f - g - 6) / 10, 0, 1)}><Emoji name="bus" size={260} /></g>
      </g>}
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
      <g transform={`translate(1450 260) scale(${clamp(pop(f, w, 130, 12), 0, 1)})`}><Emoji name="spouting whale" size={360} /></g>
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
      {mode === 'resort' && <g>{[220, 520, 820, 1120, 1420, 1720].map((x, i) => <g key={x} transform={`translate(${x} 170)`}><Emoji name={['hotel', 'beach with umbrella', 'hotel', 'beach with umbrella', 'hotel', 'beach with umbrella'][i]} size={210} /></g>)}
        {[...Array(5)].map((_, i) => <g key={i} transform={`translate(${260 + i * 360 + Math.sin(f * 0.05 + i) * 30} ${470 + (i % 2) * 190})`}><Emoji name={['motor boat', 'speedboat', 'sailboat', 'motor boat', 'canoe'][i]} size={200} flip={i % 2 === 1} /></g>)}
        <g transform="translate(1500 760)"><Emoji name="diving mask" size={170} /></g><g transform="translate(560 800)"><Emoji name="camera" size={150} /></g></g>}
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
      {mode === 'stop' && f > old && <g opacity={clamp((f - old) / 10, 0, 1)}><Txt x={X(2.6)} y={800} text="OLD DATE: 2.6M" size={40} fill="#94A3B8" />
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
      <g transform={`translate(${900 + noise2D('mh', f * 0.01, 0) * 60} ${620 + Math.sin(f * 0.02) * 20}) scale(0.9)`} opacity={0.25 + 0.15 * Math.sin(f * 0.05)}><Shark f={f} color="pale" glow={0.4} /></g>
      <rect width={W} height={H} fill="#000" opacity={0.35} />
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

export const MEG2_SHOTS = {m_card: MCard, m_plan: MPlan, m_scale: MScale, m_jaws_car: MJawsCar, m_bite: MBite, m_whalebone: MWhaleBone, m_nursery: MNursery,
  m_timeline: MTimeline, m_thermo: MThermo, m_two: MTwo, m_hide: MHide};
