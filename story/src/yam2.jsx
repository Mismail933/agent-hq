// Storygraphics #4 (2.72.0), part 2: Hiroshima. The drafting table, the city on its river delta (with the bomb's two rings), the
// Eiffel Tower comparisons, the gauges, the film leader he compared it to, the ear, the shelter, what he knew, the instruments, the
// walk at dawn, the broken bridge, the river (abstract), the people counter, the train. Every scene takes {f, len, line}.
import React from 'react';
import {W, H, INK, ST, st, clamp, lin, pop, rng, Figure, Box, Cloud, at, Labels} from './tis';
import {P, Txt, Cam, popAt, popBy} from './meg2';
import {YBust, B29, Chute, Hanko, House, Morning, Street, Field, Ruins, Burst} from './yam';

const OSW = "'Oswald', sans-serif";
const pz = (f, a, k = 140) => clamp(pop(f, a, k, 12), 0, 1.1);

// ───────────── the drafting table: a tanker on the drawing board (young or old Yamaguchi) ─────────────
export const Tanker = ({w = 760, ink = '#1E3A5F', fill = 'none'}) => (
  <g stroke={ink} strokeWidth={5} fill={fill} strokeLinejoin="round">
    <path d={`M ${-w / 2} -20 L ${w / 2 - 60} -20 L ${w / 2} -70 L ${w / 2} -40 L ${w / 2 - 40} 40 L ${-w / 2 + 30} 40 Z`} />
    <path d={`M ${-w / 2 + 30} -20 L ${-w / 2 + 30} -110 L ${-w / 2 + 150} -110 L ${-w / 2 + 150} -20 M ${-w / 2 + 60} -110 L ${-w / 2 + 60} -150 L ${-w / 2 + 110} -150 L ${-w / 2 + 110} -110`} />
    {[...Array(7)].map((_, i) => <path key={i} d={`M ${-w / 2 + 200 + i * 70} -20 L ${-w / 2 + 200 + i * 70} 40`} strokeWidth={3} />)}
    <path d={`M ${-w / 2 + 180} -36 L ${w / 2 - 90} -36`} strokeWidth={3} strokeDasharray="10 8" />
  </g>
);
function YDraft({f, len, line}) {
  const p = P(line);
  const old = p.old;
  const k = popBy(f, line, p.ship_on, 0.1, 6);
  const hk = p.hanko_on ? popAt(f, line, p.hanko_on, 0.7) : 0;
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05}>
      <rect width={W} height={H} fill={old ? '#E4E1D8' : '#E8DCC2'} />
      <rect x={1260} y={110} width={460} height={320} fill={old ? '#B9D3E6' : '#A8C9E4'} {...st(8)} /><path d="M 1490 110 L 1490 430 M 1260 270 L 1720 270" stroke={INK} strokeWidth={7} />
      <g transform="translate(860 560) rotate(-6)">
        <rect x={-560} y={-300} width={1120} height={600} fill="#7B5A3A" {...st(8)} />
        <rect x={-520} y={-270} width={1040} height={540} fill="#DCE8F2" {...st(5)} />
        {[...Array(13)].map((_, i) => <path key={'v' + i} d={`M ${-520 + i * 80} -270 L ${-520 + i * 80} 270`} stroke="#B8CDE0" strokeWidth={2} />)}
        {[...Array(7)].map((_, i) => <path key={'h' + i} d={`M -520 ${-270 + i * 80} L 520 ${-270 + i * 80}`} stroke="#B8CDE0" strokeWidth={2} />)}
        <g transform={`translate(0 10) scale(${k})`}><Tanker /></g>
        <Txt x={-470} y={-200} text={p.plan || 'OIL TANKER'} size={44} fill="#1E3A5F" stroke="none" anchor="start" />
        <rect x={180} y={180} width={300} height={22} fill="#C8A060" {...st(4)} transform="rotate(-20 330 191)" />
      </g>
      <YBust who={old ? 'yamaguchi_old' : 'yamaguchi'} x={1500} y={640} s={0.62} expr={p.expr || 'calm'} f={f} seed={3} turn={-0.5} look={-10} />
      {hk > 0.01 && <g transform={`translate(1100 260) scale(${hk * 0.8})`}><Hanko /></g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── Hiroshima on its river delta: a flat diagram map, 110 px a kilometre ─────────────
const KM = 110;
const HYPO = [930, 400];
const HIM = [HYPO[0] - 3 * KM * 0.71, HYPO[1] + 3 * KM * 0.71];   // about 3 km south-west (Mitsubishi's shipyard side)
const RIVERS_D = [[300, 860], [520, 880], [760, 900], [1010, 900], [1260, 880], [1500, 860]];
export const Delta = ({f = 0, seed = 3, flat = 0, fire = 0}) => {
  const R = rng(seed);
  const blocks = [...Array(140)].map(() => [180 + R() * 1560, 80 + R() * 700, 26 + R() * 30, 18 + R() * 20]);
  return (
    <g>
      <rect width={W} height={H} fill="#5BA4D4" />
      <path d="M -20 -20 L 1940 -20 L 1940 760 C 1760 820 1600 780 1480 840 C 1300 900 1120 860 960 900 C 760 940 560 880 400 870 C 240 860 100 820 -20 840 Z" fill="#D9CDA6" {...st(6)} />
      <path d="M -20 -20 L 1940 -20 L 1940 200 C 1800 160 1720 260 1640 180 C 1540 80 1400 120 1300 40 L 640 40 C 520 130 400 60 300 160 C 200 240 100 150 -20 220 Z" fill="#8FAE7E" {...st(5)} />
      {blocks.map(([x, y, w, h], i) => {
        const d = Math.hypot(x - HYPO[0], y - HYPO[1]);
        const gone = flat > 0 && d < 2 * KM;
        return <rect key={i} x={x} y={y} width={w} height={gone ? h * 0.3 : h} fill={gone ? '#7A6A55' : '#C2B48C'} opacity={gone ? flat : 0.9} stroke="#9C8E68" strokeWidth={2} />;
      })}
      {[INK, '#5BA4D4'].map((c, k) => <g key={k}>
        <path d={`M ${HYPO[0] + 60} -40 C ${HYPO[0] + 50} 60 ${HYPO[0] + 30} 140 ${HYPO[0] + 10} 210`} stroke={c} strokeWidth={k ? 50 : 62} fill="none" />
        {RIVERS_D.map(([x, y], i) => <path key={i} d={`M ${HYPO[0] + 10} 200 C ${HYPO[0] + (x - HYPO[0]) * 0.15} 330 ${x + (HYPO[0] - x) * 0.35} 560 ${x} ${y}`} stroke={c} strokeWidth={k ? 28 : 38} fill="none" />)}
      </g>)}
      {fire > 0 && [...Array(30)].map((_, i) => { const a = R() * Math.PI * 2, r = R() * 2.4 * KM; const x = HYPO[0] + Math.cos(a) * r, y = HYPO[1] + Math.sin(a) * r * 0.9;
        return <path key={i} d={`M ${x - 14} ${y} Q ${x - 10} ${y - 30 - Math.sin(f * 0.3 + i) * 8} ${x} ${y - 44} Q ${x + 10} ${y - 30} ${x + 14} ${y} Z`} fill="#F97316" opacity={fire} {...st(3)} />; })}
    </g>
  );
};
const Tag = ({x, y, text, f, a, color = '#FFE11A', ink = INK, size = 46, anchor = 'start'}) => {
  const s = pz(f, a, 160);
  if (s < 0.01) return null;
  const w = String(text).length * size * 0.5 + 36;
  const x0 = anchor === 'end' ? -w : anchor === 'middle' ? -w / 2 : 0;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={x0 + 5} y={-size + 2} width={w} height={size * 1.25} fill="#000" opacity={0.3} />
      <rect x={x0} y={-size - 4} width={w} height={size * 1.25} fill={color} {...st(5)} />
      <text x={x0 + w / 2} y={size * 0.08} textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={size} fill={ink}>{String(text).toUpperCase()}</text>
    </g>
  );
};
// modes: city (the delta, 350,000 people) | dist (the 3 km line, a 40-minute walk) | rings (2 km flattened, 3.5 km burns) |
// blast (the flash over the centre, 8:15) | flee (150,000 leaving; Ujina's boats) | him (his dot between the two rings)
function YDelta({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'city';
  const a = at(line, p.on || '', 0.25), b = at(line, p.b_on || '', 0.55);
  const zoom = mode === 'him' ? [1.0, 1.5] : [1.0, 1.05];
  const blastK = mode === 'blast' ? clamp((f - a) / 8, 0, 1) : 0;
  const r2 = (mode === 'rings' || mode === 'him') ? lin(f, mode === 'him' ? 0 : a, mode === 'him' ? 1 : a + 24, 0, 2 * KM) : 0;
  const r35 = (mode === 'rings' || mode === 'him') ? lin(f, mode === 'him' ? 0 : b, mode === 'him' ? 1 : b + 24, 0, 3.5 * KM) : 0;
  const cx = mode === 'him' ? lin(f, 0, len * 0.6, HYPO[0], HIM[0]) : W / 2, cy = mode === 'him' ? lin(f, 0, len * 0.6, HYPO[1] + 140, HIM[1]) : H / 2;
  const z = lin(f, 0, len, zoom[0], zoom[1]);
  const showHim = ['dist', 'rings', 'him', 'blast'].includes(mode) || p.him;
  return (
    <g>
      <g transform={`translate(${W / 2} ${H / 2}) scale(${z}) translate(${-cx} ${-cy})`}>
        <Delta f={f} flat={mode === 'rings' || mode === 'him' ? clamp((f - a) / 20, 0, 1) : 0} fire={mode === 'flee' ? 0.9 : 0} />
        {(r35 > 1) && <circle cx={HYPO[0]} cy={HYPO[1]} r={r35} fill="#E3232C" opacity={0.16} stroke="#E3232C" strokeWidth={8} strokeDasharray="26 16" />}
        {(r2 > 1) && <circle cx={HYPO[0]} cy={HYPO[1]} r={r2} fill="#F97316" opacity={0.42} stroke={INK} strokeWidth={6} />}
        {(mode === 'blast' || mode === 'rings' || mode === 'him' || mode === 'dist') && <g transform={`translate(${HYPO[0]} ${HYPO[1]})`}>
          {mode === 'blast' ? <Burst r={90} k={pz(f, a, 120) * (1 + blastK * 0.3)} /> : <path d="M -22 -22 L 22 22 M 22 -22 L -22 22" stroke={INK} strokeWidth={12} strokeLinecap="round" />}
        </g>}
        {mode === 'dist' && (() => { const L = 3 * KM, d = lin(f, a, a + 30, 0, L); const ux = (HIM[0] - HYPO[0]) / L, uy = (HIM[1] - HYPO[1]) / L;
          return <g><path d={`M ${HYPO[0]} ${HYPO[1]} L ${HYPO[0] + ux * d} ${HYPO[1] + uy * d}`} stroke={INK} strokeWidth={8} strokeDasharray="20 14" />
            <Tag x={(HYPO[0] + HIM[0]) / 2 + 30} y={(HYPO[1] + HIM[1]) / 2} text="3 KM" f={f} a={a + 20} size={56} /></g>; })()}
        {mode === 'flee' && [...Array(10)].map((_, i) => { const ang = -Math.PI * 0.95 + i * 0.21 + (i > 4 ? 0.9 : 0), t = clamp((f - a) / 40, 0, 1);
          const r0 = 2.6 * KM, r1 = r0 + 240 * t; const x0 = HYPO[0] + Math.cos(ang) * r0, y0 = HYPO[1] + Math.sin(ang) * r0 * 0.8, x1 = HYPO[0] + Math.cos(ang) * r1, y1 = HYPO[1] + Math.sin(ang) * r1 * 0.8;
          return t > 0 ? <g key={i}><path d={`M ${x0} ${y0} L ${x1} ${y1}`} stroke="#fff" strokeWidth={14} strokeLinecap="round" /><path d={`M ${x0} ${y0} L ${x1} ${y1}`} stroke="#E3232C" strokeWidth={7} strokeLinecap="round" /></g> : null; })}
        {mode === 'flee' && <g>
          <g transform="translate(1200 860)"><path d="M 0 0 Q -30 -40 -30 -60 A 30 30 0 0 1 30 -60 Q 30 -40 0 0 Z" fill="#FFE11A" {...st(5)} /></g>
          {[0, 1, 2].map((i) => { const t = clamp((f - b - i * 10) / 60, 0, 1); return t > 0 ? <g key={i} transform={`translate(${1200 + i * 120 + t * 200} ${900 + t * 120})`}><path d="M -40 0 L 40 0 L 28 22 L -28 22 Z" fill="#8B5A2B" {...st(4)} /><path d="M 0 0 L 0 -40 L 26 -6 Z" fill="#F1E7D0" {...st(3)} /></g> : null; })}
          <Tag x={1260} y={770} text="UJINA PORT" f={f} a={b} size={44} />
        </g>}
        {showHim && <g transform={`translate(${HIM[0]} ${HIM[1]})`}>
          <circle r={20} fill="#FFE11A" {...st(6)} />
          <Tag x={-30} y={70} text="YAMAGUCHI" f={f} a={Math.min(a, 8)} size={40} anchor="end" color="#fff" />
        </g>}
        {(mode === 'rings' || mode === 'him') && <g>
          <Tag x={HYPO[0] + 2 * KM * 0.75} y={HYPO[1] - 2 * KM * 0.45} text={p.r2 || '2 KM: HOUSES FLATTENED'} f={f} a={mode === 'him' ? 2 : a + 18} size={40} color="#F97316" />
          <Tag x={HYPO[0] + 3.5 * KM * 0.62} y={HYPO[1] + 3.5 * KM * 0.72} text={p.r35 || '3.5 KM: BURNS'} f={f} a={mode === 'him' ? 4 : b + 18} size={40} color="#E3232C" ink="#fff" />
        </g>}
      </g>
      {mode === 'city' && <g transform={`translate(1500 300) scale(${pz(f, b)})`}><rect x={-230} y={-90} width={460} height={170} fill="#0B1F3A" {...st(6)} />
        <Txt x={0} y={-10} text={p.big || '350,000'} size={86} fill="#FFE11A" /><Txt x={0} y={58} text={p.small || 'PEOPLE'} size={40} /></g>}
      {mode === 'flee' && <g transform={`translate(1500 300) scale(${pz(f, a)})`}><rect x={-250} y={-90} width={500} height={170} fill="#0B1F3A" {...st(6)} />
        <Txt x={0} y={-10} text={Math.round(lin(f, a, a + 40, 0, 150000)).toLocaleString('en-US')} size={86} fill="#FFE11A" /><Txt x={0} y={58} text="FLED THE CITY" size={40} /></g>}
      {mode === 'dist' && <g transform={`translate(1560 820) scale(${pz(f, b)})`}><rect x={-250} y={-80} width={500} height={150} fill="#fff" {...st(6)} />
        <Txt x={0} y={-6} text="≈ 40 MINUTES" size={66} fill={INK} stroke="none" /><Txt x={0} y={52} text="ON FOOT" size={40} fill="#475569" stroke="none" /></g>}
      {mode === 'blast' && <g transform={`translate(1640 140) scale(${pz(f, Math.min(a, 6))})`}><rect x={-170} y={-60} width={340} height={110} fill="#0B1F3A" {...st(6)} /><Txt x={0} y={30} text={p.clock || '8:15 AM'} size={84} fill="#FFE11A" /></g>}
      <rect width={W} height={H} fill="#FFFDF2" opacity={mode === 'blast' ? clamp(1 - Math.abs(f - a - 3) / 10, 0, 1) * 0.85 : 0} />
      <Labels line={line} f={f} x0={100} y0={90} />
    </g>
  );
}

// ───────────── the Eiffel Tower comparisons ─────────────
export const Eiffel = ({h = 420, color = '#8B5A3C', op = 1}) => {
  const k = h / 420;
  return (
    <g transform={`scale(${k})`} opacity={op}>
      <path d="M -150 0 C -110 -90 -70 -170 -44 -250 L -22 -360 L -8 -410 L 8 -410 L 22 -360 L 44 -250 C 70 -170 110 -90 150 0 L 96 0 C 70 -50 40 -80 0 -84 C -40 -80 -70 -50 -96 0 Z" fill={color} {...st(6 / k)} />
      <path d="M -100 -120 L 100 -120 M -60 -250 L 60 -250 M -26 -360 L 26 -360" stroke={INK} strokeWidth={10 / k} />
      <path d="M -88 -126 L -60 -244 M 88 -126 L 60 -244 M -70 -130 L 40 -244 M 70 -130 L -40 -244" stroke="#6B4228" strokeWidth={4 / k} />
      <path d="M 0 -410 L 0 -440" stroke={INK} strokeWidth={6 / k} />
    </g>
  );
};
export const Crate = ({s = 1}) => (
  <g transform={`scale(${s})`}>
    <rect x={-60} y={-46} width={120} height={92} fill="#C2410C" {...st(5)} />
    <path d="M -60 -46 L 60 46 M 60 -46 L -60 46" stroke="#9A3412" strokeWidth={6} />
    <rect x={-40} y={-18} width={80} height={36} fill="#FFE11A" {...st(3)} />
    <text x={0} y={12} textAnchor="middle" fontFamily={OSW} fontWeight={700} fontSize={30} fill={INK}>TNT</text>
  </g>
);
// modes: weight (one Eiffel Tower = 10,100 t, then 1.5 of them as a pile of TNT) | height (600 m = about two towers stacked)
function YEiffel({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'weight';
  const a = at(line, p.on || 'eiffel', 0.2), b = at(line, p.b_on || 'half', 0.5);
  if (mode === 'height') {
    const t1 = pz(f, Math.min(a, 6)), t2 = pz(f, b);
    return (
      <g><Cam f={f} len={len} a={1.0} b={1.04}>
        <Morning f={f} hills={false} cranes={false} />
        <g transform="translate(0 1000) scale(1 0.5) translate(0 -1000)" opacity={0.9}><Street y={1000} seed={5} /></g>
        <g transform={`translate(760 1000)`}><g transform={`scale(1 ${t1})`}><Eiffel h={410} /></g></g>
        <g transform={`translate(760 590)`}><g transform={`scale(1 ${t2})`}><Eiffel h={410} /></g></g>
        <path d="M 900 160 L 1800 160" stroke="#E3232C" strokeWidth={8} strokeDasharray="24 14" opacity={t2 > 0.5 ? 1 : 0} />
        {t2 > 0.5 && <g transform="translate(1350 160)"><Burst r={44} /></g>}
        <path d="M 1700 980 L 1700 170 M 1680 190 L 1700 160 L 1720 190 M 1680 960 L 1700 990 L 1720 960" stroke={INK} strokeWidth={8} fill="none" opacity={t2 > 0.5 ? 1 : 0} />
        <Txt x={1580} y={600} text="600 M" size={90} fill="#FFE11A" op={t2 > 0.5 ? 1 : 0} />
      </Cam>
        <Labels line={line} f={f} x0={100} y0={90} /></g>
    );
  }
  const t1 = pz(f, Math.min(a, 6)), t2 = pz(f, b);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.04}>
      <rect width={W} height={H} fill="#E9DFC9" />
      <rect y={880} width={W} height={200} fill="#B89A72" /><path d="M 0 880 L 1920 880" {...st(6)} />
      <g transform={`translate(380 880) scale(${t1})`}><Eiffel h={620} /></g>
      <g transform="translate(380 880)" opacity={t1}><Tag x={0} y={-680} text="10,100 TONNES" f={f} a={Math.min(a, 6) + 8} size={54} anchor="middle" /></g>
      <g transform={`translate(1300 880) scale(${t2})`}>
        {[...Array(30)].map((_, i) => { const row = Math.floor(Math.sqrt(i * 2 + 0.25) - 0.5); const inRow = i - (row * (row + 1)) / 2; const n = row + 1;
          const rr = 6 - row; return rr > 0 ? null : null; })}
        {[[6, 0], [5, 1], [4, 2], [3, 3], [2, 4], [1, 5]].map(([n, r]) => [...Array(n)].map((_, i) => <g key={r + '-' + i} transform={`translate(${(i - (n - 1) / 2) * 124} ${-50 - r * 96})`}><Crate /></g>))}
      </g>
      <g opacity={t2}><Tag x={1300} y={300} text="× 1.5 IN TNT" f={f} a={b + 6} size={64} anchor="middle" color="#E3232C" ink="#fff" /></g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── gauges: temp (a thermometer that runs off the top) | wind (a dial) | fever ─────────────
function YGauge({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'temp';
  const a = at(line, p.on || '', 0.2), b = at(line, p.b_on || '', 0.6);
  if (mode === 'wind') {
    const v = lin(f, a, a + 40, 0, 1);
    const ang = -120 + 240 * v * 0.82;
    return (
      <g><Cam f={f} len={len} a={1.0} b={1.04}>
        <rect width={W} height={H} fill="#0B1F3A" />
        <g transform="translate(700 560)">
          <circle r={330} fill="#F5F1E6" {...st(10)} />
          {[...Array(13)].map((_, i) => { const t = (-120 + i * 20) * Math.PI / 180; return <path key={i} d={`M ${Math.sin(t) * 270} ${-Math.cos(t) * 270} L ${Math.sin(t) * 310} ${-Math.cos(t) * 310}`} stroke={INK} strokeWidth={8} />; })}
          <path d={`M ${Math.sin(80 * Math.PI / 180) * 300} ${-Math.cos(80 * Math.PI / 180) * 300} A 300 300 0 0 1 ${Math.sin(120 * Math.PI / 180) * 300} ${-Math.cos(120 * Math.PI / 180) * 300}`} stroke="#E3232C" strokeWidth={22} fill="none" />
          <g transform={`rotate(${ang})`}><path d="M -16 0 L 0 -260 L 16 0 Z" fill="#E3232C" {...st(5)} /></g>
          <circle r={34} fill={INK} />
          <Txt x={0} y={170} text={`${Math.round(280 * v)} M/S`} size={84} fill={INK} stroke="none" />
          <Txt x={235} y={-200} text="SOUND" size={30} fill="#E3232C" stroke="none" />
        </g>
        <g transform={`translate(1420 400) scale(${pz(f, b)})`}><rect x={-300} y={-80} width={600} height={150} fill="#fff" {...st(6)} /><Txt x={0} y={20} text={p.big || '≈ 1,000 KM/H'} size={76} fill={INK} stroke="none" /></g>
        <g transform={`translate(1420 640) scale(${pz(f, at(line, p.c_on || 'eighty', 0.8))})`}><rect x={-300} y={-70} width={600} height={130} fill="#FFE11A" {...st(6)} /><Txt x={0} y={14} text={p.small || '82% OF THE SPEED OF SOUND'} size={44} fill={INK} stroke="none" /></g>
      </Cam>
        <Labels line={line} f={f} x0={100} y0={90} /></g>
    );
  }
  const top = mode === 'fever' ? 0.78 : 1.25;   // (fever: the labels go under the plate, clear of the thermometer)
  const v = lin(f, a, a + 50, 0.05, top);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.04}>
      <rect width={W} height={H} fill={mode === 'fever' ? '#2A1D2E' : '#0B1F3A'} />
      <g transform="translate(560 540)">
        <rect x={-60} y={-400} width={120} height={720} rx={60} fill="#F5F1E6" {...st(10)} />
        <circle cx={0} cy={360} r={110} fill="#E3232C" {...st(10)} />
        <rect x={-30} y={340 - 700 * Math.min(v, 1)} width={60} height={700 * Math.min(v, 1)} fill="#E3232C" />
        {[...Array(9)].map((_, i) => <path key={i} d={`M 60 ${-360 + i * 80} L 100 ${-360 + i * 80}`} stroke="#fff" strokeWidth={6} />)}
        {v > 1 && <g transform="translate(0 -420)"><Burst r={70} k={clamp((v - 1) * 5, 0, 1)} color="#FFE8A3" /></g>}
      </g>
      {mode === 'fever' ? <g transform={`translate(1240 420) scale(${pz(f, a)})`}><rect x={-380} y={-90} width={760} height={170} fill="#fff" {...st(6)} /><Txt x={0} y={20} text={p.big || 'HIGH FEVER'} size={90} fill="#E3232C" stroke="none" /></g>
        : <g>
          <g transform={`translate(1240 360) scale(${pz(f, a + 10)})`}><rect x={-420} y={-90} width={840} height={170} fill="#fff" {...st(6)} /><Txt x={0} y={20} text={p.big || '1,000,000°C+'} size={96} fill="#E3232C" stroke="none" /><Txt x={0} y={-104} text="THE FIREBALL'S CORE" size={40} /></g>
          <g transform={`translate(1240 720) scale(${pz(f, b)})`}><rect x={-420} y={-80} width={840} height={150} fill="#FFE11A" {...st(6)} /><Txt x={0} y={20} text={p.small || '3,000-4,000°C'} size={80} fill={INK} stroke="none" /><Txt x={0} y={-96} text="THE GROUND BELOW IT" size={40} /></g>
        </g>}
    </Cam>
      <Labels line={line} f={f} x0={mode === 'fever' ? 900 : 100} y0={mode === 'fever' ? 560 : 90} /></g>
  );
}

// ───────────── "the start of a film at the cinema ... blank frames flickering ... without any sound" ─────────────
function YFilm({f, len, line}) {
  const p = P(line);
  const R = rng(Math.floor(f / 2) + 3);
  const fl = 0.75 + R() * 0.25;
  return (
    <g>
      <rect width={W} height={H} fill="#111" />
      <g transform={`translate(0 ${-(f * 18) % 360})`}>
        {[...Array(5)].map((_, i) => (
          <g key={i} transform={`translate(560 ${i * 360 - 40})`}>
            <rect x={-40} y={0} width={880} height={340} fill="#1C1C1C" />
            {[...Array(6)].map((_, k) => <g key={k}><rect x={-26} y={12 + k * 56} width={18} height={30} rx={4} fill="#000" /><rect x={808} y={12 + k * 56} width={18} height={30} rx={4} fill="#000" /></g>)}
            <rect x={20} y={20} width={760} height={300} fill="#CFCAB8" opacity={fl} />
          </g>))}
      </g>
      {[...Array(5)].map((_, i) => <path key={i} d={`M ${600 + R() * 720} 0 L ${600 + R() * 720 + (R() - 0.5) * 30} ${H}`} stroke="#fff" strokeWidth={2 + R() * 2} opacity={0.4} />)}
      {[...Array(14)].map((_, i) => <circle key={'d' + i} cx={600 + R() * 720} cy={R() * H} r={2 + R() * 5} fill="#222" opacity={0.6} />)}
      <g transform={`translate(1640 200) scale(${pz(f, at(line, p.on || 'sound', 0.85))})`}>
        <circle r={90} fill="#fff" {...st(6)} />
        <path d="M -40 -22 L -16 -22 L 12 -48 L 12 48 L -16 22 L -40 22 Z" fill={INK} />
        <path d="M 30 -30 L 66 30 M 66 -30 L 30 30" stroke="#E3232C" strokeWidth={10} strokeLinecap="round" />
      </g>
      <Labels line={line} f={f} x0={100} y0={90} />
    </g>
  );
}

// ───────────── the ear: sound waves stop at a red cross (both eardrums burst / left ear for good) ─────────────
function YEar({f, len, line}) {
  const p = P(line);
  const a = at(line, p.on || 'eardrums', 0.5);
  const old = p.old;
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.06} x={900}>
      <rect width={W} height={H} fill={old ? '#E4E1D8' : '#3A2E2A'} />
      <g transform="translate(1180 560)">
        <path d="M -400 -600 C -100 -620 260 -560 360 -260 C 420 -80 400 160 300 360 C 220 520 80 640 -60 700 L -400 700 Z" fill="#F2C29B" {...ST} />
        <path d="M -400 -600 C -100 -620 200 -580 300 -380 C 120 -440 -120 -440 -400 -420 Z" fill={old ? '#E2E4E8' : '#16110E'} {...ST} />
        <path d="M 40 -170 C 140 -230 250 -150 240 -20 C 232 80 170 130 130 200 C 110 240 70 250 40 220" fill="#E7A98A" {...st(9)} />
        <path d="M 90 -100 C 160 -120 190 -50 170 10 C 150 60 120 80 110 120" fill="none" {...st(7)} />
      </g>
      {[0, 1, 2, 3].map((i) => { const q = ((f / 26) + i / 4) % 1; const x = 200 + q * 760; return <path key={i} d={`M ${x} 340 C ${x + 60} 440 ${x + 60} 640 ${x} 740`} fill="none" stroke="#9BE1FF" strokeWidth={14} strokeLinecap="round" opacity={clamp((1 - q) * 1.4, 0, 1) * (x < 900 ? 1 : 0)} />; })}
      <g transform={`translate(1010 540) scale(${pz(f, a)})`}><circle r={86} fill="#E3232C" {...st(8)} /><path d="M -40 -40 L 40 40 M 40 -40 L -40 40" stroke="#fff" strokeWidth={22} strokeLinecap="round" /></g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── burned, blind for a while, and he gets up and walks (p.walk_on) ─────────────
function YRise({f, len, line}) {
  const p = P(line);
  const w = at(line, p.walk_on || 'walks', 0.8);
  if (f < w) {
    const burn = 0.5 + 0.1 * Math.sin(f * 0.2);
    return (
      <g><Cam f={f} len={len} a={1.1} b={1.0} x={900} y={420}>
        <rect width={W} height={H} fill="#3A2C26" />
        <g opacity={0.6}><Ruins y={760} color="#241A16" /></g>
        <YBust who="yamaguchi" x={900} y={500} s={1.05} expr="closed" f={f} seed={3} />
        <ellipse cx={1030} cy={480} rx={90} ry={150} fill="#FF6A3D" opacity={0.3 * burn} />
        <ellipse cx={1140} cy={1020} rx={70} ry={190} fill="#FF6A3D" opacity={0.3 * burn} /><ellipse cx={660} cy={1020} rx={70} ry={190} fill="#FF6A3D" opacity={0.3 * burn} />
      </Cam>
        <Labels line={line} f={f} x0={100} y0={90} /></g>
    );
  }
  const x = lin(f, w, len, 520, 1000, (t) => t);
  return (
    <g>
      <rect width={W} height={H} fill="#5B4436" />
      <g opacity={0.7}><Ruins y={760} color="#2E221C" /></g>
      <rect y={760} width={W} height={320} fill="#6E5644" />
      <g transform={`translate(${x} 1000) scale(0.48) translate(0 -1090)`}><Figure who="yamaguchi" pose="limp" dir={1} f={f} expr="worried" seed={3} /></g>
      <Labels line={line} f={f} x0={100} y0={90} />
    </g>
  );
}

// ───────────── the shelter at night: three men inside, the city's glow at the entrance ─────────────
function YShelter({f, len, line}) {
  const p = P(line);
  const names = p.names !== false;
  const g = 0.6 + 0.25 * Math.sin(f * 0.21) + 0.15 * Math.sin(f * 0.53);
  const q = p.think ? pz(f, at(line, p.think, 0.3)) : 0;
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05}>
      <rect width={W} height={H} fill="#2A2019" />
      <path d="M 0 0 L 1920 0 L 1920 90 C 1500 140 420 140 0 90 Z" fill="#3B2D22" {...st(6)} />
      {[200, 760, 1320].map((x) => <rect key={x} x={x} y={60} width={40} height={900} fill="#4A3828" {...st(5)} />)}
      <g transform="translate(1600 180)">
        <path d="M -200 600 L -200 60 C -200 -20 200 -20 200 60 L 200 600 Z" fill="#F97316" opacity={g} />
        <path d="M -200 600 L -200 60 C -200 -20 200 -20 200 60 L 200 600 Z" fill="none" {...st(8)} />
        <path d="M -200 600 L -150 520 L -100 560 L -40 480 L 20 540 L 80 470 L 140 540 L 200 500 L 200 600 Z" fill="#1A120C" />
      </g>
      <rect width={W} height={H} fill="#F97316" opacity={0.08 * g} />
      <YBust who="colleague1" x={420} y={560} s={0.62} expr="worried" f={f} seed={7} turn={0.3} />
      <YBust who="colleague2" x={1210} y={560} s={0.62} expr="scared" f={f} seed={8} turn={-0.3} />
      <YBust who="yamaguchi" x={810} y={600} s={0.72} expr={p.expr || 'worried'} f={f} seed={3} />
      <ellipse cx={890} cy={590} rx={60} ry={110} fill="#FF6A3D" opacity={0.25} />
      {names && <>
        <Tag x={420} y={300} text="AKIRA IWANAGA" f={f} a={at(line, 'akira', 0.3)} size={40} anchor="middle" color="#fff" />
        <Tag x={1210} y={300} text="KUNIYOSHI SATO" f={f} a={at(line, 'kuniyoshi', 0.4)} size={40} anchor="middle" color="#fff" />
      </>}
      {q > 0.01 && [0, 1, 2].map((i) => <g key={i} transform={`translate(${520 + i * 380} ${240 - (i % 2) * 40}) scale(${q})`}><Txt x={0} y={0} text="?" size={150} fill="#FFE11A" /></g>)}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the city burning at night, far off (flat shapes only, never people) ─────────────
function YFire({f, len, line}) {
  const R = rng(7);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.06} y={700}>
      <rect width={W} height={H} fill="#141A33" />
      <ellipse cx={960} cy={760} rx={1100} ry={360} fill="#7C2D12" opacity={0.6} />
      <ellipse cx={960} cy={780} rx={800} ry={200} fill="#F97316" opacity={0.35 + 0.05 * Math.sin(f * 0.2)} />
      {[...Array(18)].map((_, i) => { const x = R() * W, h = 120 + R() * 220; return <path key={i} d={`M ${x - 40} 800 Q ${x - 30} ${800 - h * 0.6 - Math.sin(f * 0.25 + i) * 14} ${x} ${800 - h} Q ${x + 30} ${800 - h * 0.6} ${x + 40} 800 Z`} fill={i % 2 ? '#F97316' : '#FDBA74'} opacity={0.8} />; })}
      {[...Array(10)].map((_, i) => { const x = R() * W; return <ellipse key={'s' + i} cx={x + Math.sin(f * 0.01 + i) * 40} cy={360 - R() * 200 - (f * 0.4) % 80} rx={180 + R() * 120} ry={70} fill="#2B2B33" opacity={0.6} />; })}
      <Ruins y={812} color="#0B0F1E" />
      <rect y={810} width={W} height={270} fill="#0B0F1E" />
      <path d="M 0 900 C 400 880 800 920 1200 890 C 1500 870 1700 900 1920 885" stroke="#F97316" strokeWidth={6} opacity={0.4} fill="none" />
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── what he knew: a list that fills on the words (plane, parachutes, city) ─────────────
const CityIcon = ({gone = 0}) => (
  <g>
    {[[-90, 70, 80], [-10, 110, 70], [70, 60, 60]].map(([x, h, w], i) => <rect key={i} x={x - w / 2} y={60 - h} width={w} height={h} fill="#C2B48C" {...st(5)} />)}
    <path d="M -150 60 L 150 60" {...st(6)} />
    {gone > 0 && <path d="M -130 -80 L 130 80 M 130 -80 L -130 80" stroke="#E3232C" strokeWidth={16} strokeLinecap="round" opacity={gone} />}
  </g>
);
function YKnew({f, len, line}) {
  const p = P(line);
  const on = p.on || ['aircraft', 'parachutes', 'disappeared'];
  const items = [['1 PLANE', <g transform="rotate(-10) scale(0.2)"><B29 /></g>], ['2 PARACHUTES', <g><g transform="translate(-50 0) scale(0.9)"><Chute /></g><g transform="translate(60 -20) scale(0.9)"><Chute /></g></g>], ['1 CITY, GONE', <CityIcon gone={1} />]];
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.03}>
      <rect width={W} height={H} fill="#0B1F3A" />
      <Txt x={W / 2} y={170} text={p.title || 'WHAT HE KNEW'} size={88} fill="#FFE11A" />
      {items.map(([t, ic], i) => { const s = i === 0 ? popBy(f, line, on[0], 0.2, 10) : popAt(f, line, on[i], 0.3 + i * 0.2);
        return <g key={i} transform={`translate(${380 + i * 580} 560) scale(${s})`}><circle r={210} fill="#F5F1E6" {...st(8)} />{ic}<Txt x={0} y={300} text={t} size={58} /></g>; })}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the parachutes explained: a second plane drops instruments to measure the blast ─────────────
function YInstruments({f, len, line}) {
  const p = P(line);
  const d = at(line, p.on || 'instruments', 0.3);
  const bx = lin(f, 0, len, 300, 1300, (t) => t);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.04}>
      <linearGradient id="yinsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2F6FB8" /><stop offset="1" stopColor="#BFD9EE" /></linearGradient>
      <rect width={W} height={H} fill="url(#yinsky)" />
      <g transform={`translate(${bx + 260} 200) rotate(-4) scale(0.24)`}><B29 f={f} /></g>
      <g transform={`translate(${bx} 330) rotate(-4) scale(0.24)`}><B29 f={f} /></g>
      {f > d && [0, 1].map((i) => { const t = f - d - i * 10; if (t < 0) return null; const x0 = lin(d + i * 10, 0, len, 300, 1300, (q) => q);
        return <g key={i} transform={`translate(${x0 - 40 + Math.sin(t * 0.05 + i) * 20} ${360 + t * 1.6})`}><Chute s={clamp(pop(t, 0, 120, 14), 0, 1) * 1.1} sway={Math.sin(t * 0.06 + i) * 10} /></g>; })}
      <Tag x={bx + 120} y={470} text={p.tag || 'A SECOND B-29'} f={f} a={Math.min(at(line, p.plane_on || 'second', 0.4), 12)} size={44} color="#fff" />
      <g transform={`translate(1420 820) scale(${pz(f, at(line, p.measure_on || 'measure', 0.75))})`}><rect x={-360} y={-70} width={720} height={130} fill="#FFE11A" {...st(6)} /><Txt x={0} y={18} text={p.big || 'INSTRUMENTS TO MEASURE THE BLAST'} size={42} fill={INK} stroke="none" /></g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── dawn over the ruins: a small figure on his way to the station ─────────────
function YDawn({f, len, line}) {
  const p = P(line);
  const x = lin(f, 0, len, p.from || 300, p.to || 760, (t) => t);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05} y={640}>
      <linearGradient id="ydawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4B4E6D" /><stop offset="0.7" stopColor="#C98B7A" /><stop offset="1" stopColor="#E8C3A0" /></linearGradient>
      <rect width={W} height={H} fill="url(#ydawn)" />
      {[300, 900, 1500].map((sx, i) => <path key={i} d={`M ${sx} 760 C ${sx - 40} 600 ${sx + 60} 460 ${sx + 10 + Math.sin(f * 0.02 + i) * 20} 200`} stroke="#5A5560" strokeWidth={60 + i * 10} fill="none" opacity={0.35} strokeLinecap="round" />)}
      <Ruins y={770} color="#3A3036" seed={21} />
      <rect y={770} width={W} height={310} fill="#7A6A64" />
      <path d="M -20 950 C 400 880 900 900 1300 850 C 1600 820 1800 830 1940 800" stroke="#9C8B80" strokeWidth={60} fill="none" />
      <g transform={`translate(${x} 900) scale(0.3) translate(0 -1090)`}><Figure who="yamaguchi" pose="limp" dir={1} f={f} expr="worried" seed={3} /></g>
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the river with no bridge: the span broken, small fires on the banks ─────────────
const Flame = ({x, y, s = 1, f = 0, i = 0}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d={`M -30 0 Q -26 -50 ${-6 + Math.sin(f * 0.3 + i) * 6} -90 Q 6 -60 14 -76 Q 30 -40 30 0 Z`} fill="#F97316" {...st(4)} />
    <path d={`M -14 0 Q -10 -30 ${2 + Math.sin(f * 0.4 + i) * 4} -50 Q 14 -24 14 0 Z`} fill="#FDE047" />
  </g>
);
function YBridge({f, len, line}) {
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.05}>
      <rect width={W} height={H} fill="#8E8A8C" />
      <Ruins y={560} color="#4A4448" seed={31} />
      <rect y={560} width={W} height={120} fill="#7A6A5E" />
      <path d="M 0 680 L 1920 680 L 1920 1080 L 0 1080 Z" fill="#5E7486" />
      {[...Array(6)].map((_, i) => <path key={i} d={`M ${-100 + ((i * 360 + f * 1.2) % 2200)} ${740 + (i % 3) * 90} q 60 -14 120 0`} stroke="#8FA6B8" strokeWidth={6} fill="none" />)}
      <path d="M 120 640 L 760 640 L 760 676 L 120 676 Z" fill="#6B6A6E" {...st(6)} />
      <path d="M 760 640 L 900 800 L 880 830 L 740 676 Z" fill="#6B6A6E" {...st(6)} />
      <path d="M 1180 840 L 1320 660 L 1800 660 L 1800 696 L 1340 696 L 1210 860 Z" fill="#6B6A6E" {...st(6)} />
      {[300, 560, 1500].map((x) => <rect key={x} x={x - 18} y={676} width={36} height={300} fill="#57565A" {...st(5)} />)}
      {[[200, 560], [520, 556], [1420, 558], [1700, 560], [980, 560]].map(([x, y], i) => <Flame key={i} x={x} y={y} s={0.9} f={f} i={i} />)}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the crossing, kept abstract: grey water and one small swimmer, nothing else ─────────────
function YRiver({f, len, line}) {
  const x = lin(f, 0, len, 360, 1500, (t) => t);
  return (
    <g>
      <rect width={W} height={H} fill="#55616C" />
      <rect y={0} width={W} height={150} fill="#6E6460" /><g opacity={0.8}><Ruins y={150} color="#3E3836" seed={52} /></g>
      <path d="M 0 150 C 600 170 1300 140 1920 160" stroke={INK} strokeWidth={6} fill="none" />
      <path d="M 0 1000 C 500 980 1400 1010 1920 990 L 1920 1080 L 0 1080 Z" fill="#6E6460" {...st(6)} />
      {[...Array(12)].map((_, i) => <path key={i} d={`M ${-200 + ((i * 260 + f * 0.8) % 2300)} ${150 + i * 72} q 80 -18 160 0 t 160 0`} stroke="#6E7B86" strokeWidth={6} fill="none" opacity={0.7} />)}
      <g transform={`translate(${x} 560)`}>
        <ellipse cx={0} cy={20} rx={110} ry={20} fill="#46525C" />
        <circle cx={0} cy={0} r={34} fill="#1E1A18" />
        <path d={`M 20 10 Q ${60 + Math.sin(f * 0.15) * 20} ${-40 - Math.cos(f * 0.15) * 20} ${100} ${10}`} stroke="#1E1A18" strokeWidth={22} fill="none" strokeLinecap="round" />
      </g>
      <rect width={W} height={H} fill="#1B2229" opacity={0.25} />
    </g>
  );
}

// ───────────── people as icons: k of n greyed (two in five), with a number counting up ─────────────
const Person = ({c = '#F5F1E6'}) => (
  <g><circle cx={0} cy={-150} r={46} fill={c} {...st(6)} /><path d="M -70 30 C -70 -60 -40 -90 0 -90 C 40 -90 70 -60 70 30 L 50 160 L -50 160 Z" fill={c} {...st(6)} /></g>
);
function YPeople({f, len, line}) {
  const p = P(line);
  const n = p.n || 5, k = p.k ?? 2;
  const a = at(line, p.on || '', 0.3), b = at(line, p.b_on || '', 0.7);
  const v = Number(String(p.value || '').replace(/[^0-9]/g, '')) || 0;
  const gw = Math.min(260, 1500 / n);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.03}>
      <rect width={W} height={H} fill="#0B1F3A" />
      {[...Array(n)].map((_, i) => { const grey = p.mark !== 'cross' && i < k && f > b + i * 4; return (
        <g key={i} transform={`translate(${W / 2 + (i - (n - 1) / 2) * gw} ${600}) scale(${pz(f, Math.min(a, 6) + i * 3) * (gw / 260)})`}>
          <Person c={grey ? '#5B6472' : '#F5F1E6'} />
          {p.mark === 'cross' && f > b + i * 4 && <g transform="translate(60 -40)"><circle r={44} fill="#fff" {...st(5)} /><path d="M -10 -28 L 10 -28 L 10 -10 L 28 -10 L 28 10 L 10 10 L 10 28 L -10 28 L -10 10 L -28 10 L -28 -10 L -10 -10 Z" fill="#E3232C" /></g>}</g>); })}
      {p.value && <g transform={`translate(${W / 2} 230) scale(${pz(f, a)})`}><Txt x={0} y={30} text={(String(p.value).match(/^[^0-9]*/) || [''])[0] + Math.round(lin(f, a, a + 36, 0, v)).toLocaleString('en-US')} size={120} fill="#FFE11A" /></g>}
      {p.label && <g transform={`translate(${W / 2} 920) scale(${pz(f, b)})`}><Txt x={0} y={0} text={p.label} size={70} /></g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

// ───────────── the train: a half-ruined station (board) or rolling south-west (ride) ─────────────
export const Train = ({f = 0, faces = false}) => (
  <g>
    {[0, 1, 2].map((i) => (
      <g key={i} transform={`translate(${-420 - i * 470} 0)`}>
        <rect x={-210} y={-230} width={440} height={220} rx={10} fill="#6B3B2A" {...st(7)} />
        <path d="M -220 -230 C -150 -270 160 -270 240 -230 Z" fill="#3D2A22" {...st(6)} />
        {[...Array(4)].map((_, k) => <rect key={k} x={-170 + k * 100} y={-190} width={70} height={70} fill="#E8D9B5" {...st(4)} />)}
        {[-130, 150].map((x) => <circle key={x} cx={x} cy={0} r={34} fill="#222" {...st(5)} />)}
      </g>))}
    <g>
      <rect x={-160} y={-200} width={330} height={190} fill="#222831" {...st(7)} />
      <rect x={60} y={-300} width={110} height={110} fill="#2C333E" {...st(6)} />
      <rect x={-120} y={-260} width={50} height={70} fill="#2C333E" {...st(5)} />
      <path d="M 170 -10 L 230 -10 L 200 -70 Z" fill="#3A4250" {...st(5)} />
      {[-110, -10, 100].map((x) => <circle key={x} cx={x} cy={0} r={40} fill="#3A4250" {...st(6)} />)}
      {[0, 1, 2].map((i) => { const t = (f * 0.03 + i / 3) % 1; return <circle key={i} cx={-95 - t * 260} cy={-290 - t * 160} r={40 + t * 70} fill="#E5E7EB" opacity={0.7 * (1 - t)} />; })}
    </g>
  </g>
);
function YTrain({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'board';
  if (mode === 'ride') {
    const x = lin(f, 0, len, 600, 1700, (t) => t);
    return (
      <g><Cam f={f} len={len} a={1.0} b={1.04}>
        <Morning f={f} cranes={false} id="ytr" />
        <path d="M 0 700 C 300 640 700 660 1000 680 C 1300 700 1600 650 1920 670 L 1920 1080 L 0 1080 Z" fill="#9DB57E" {...st(5)} />
        <rect y={820} width={W} height={18} fill="#6B5A48" /><path d={`M 0 838 L 1920 838`} stroke="#3A3A3A" strokeWidth={6} />
        <g transform={`translate(${x} 830) scale(0.6)`}><Train f={f} /></g>
      </Cam>
        <Labels line={line} f={f} x0={100} y0={90} /></g>
    );
  }
  const face = popAt(f, line, p.face_on || 'gets', 0.6);
  return (
    <g><Cam f={f} len={len} a={1.0} b={1.06} x={1100} y={560}>
      <rect width={W} height={H} fill="#A9A6A2" />
      <path d="M 0 120 L 600 120 L 680 200 L 760 140 L 900 210 L 1100 130 L 1920 130 L 1920 230 L 0 230 Z" fill="#5A5357" {...st(6)} />
      {[200, 700, 1200, 1700].map((x) => <rect key={x} x={x - 14} y={230} width={28} height={560} fill="#6B6A6E" {...st(5)} />)}
      <rect y={790} width={W} height={290} fill="#7E776F" /><path d="M 0 790 L 1920 790" {...st(6)} />
      <g transform="translate(1700 790) scale(1.05)"><Train f={f} /></g>
      {face > 0.01 && <g transform="translate(1200 560)">
        <clipPath id="ywin"><rect x={-90} y={-110} width={190} height={170} /></clipPath>
        <g clipPath="url(#ywin)"><g transform={`translate(0 ${lin(face, 0, 1, 160, 0)})`}><YBust who="yamaguchi" x={0} y={-10} s={0.36} expr="worried" f={f} seed={3} band turn={0.3} /></g></g>
      </g>}
    </Cam>
      <Labels line={line} f={f} x0={100} y0={90} /></g>
  );
}

export const YAM2_SHOTS = {y_draft: YDraft, y_delta: YDelta, y_eiffel: YEiffel, y_gauge: YGauge, y_film: YFilm, y_ear: YEar, y_rise: YRise,
  y_shelter: YShelter, y_fire: YFire, y_knew: YKnew, y_instruments: YInstruments, y_dawn: YDawn, y_bridge: YBridge, y_river: YRiver,
  y_people: YPeople, y_train: YTrain};
