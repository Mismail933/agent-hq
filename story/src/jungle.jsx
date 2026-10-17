// The rest of "She Survived a 3 km Fall" (2.50.0): the jungle, the river, the rescue and after, in the TIS look (tis.jsx).
// Every scene takes {f, len, line}; line.p holds the script's choices (pose, expression, time, labels on spoken words...).
import React from 'react';
import {interpolate} from 'remotion';
import {W, H, INK, ST, st, clamp, lin, pop, rng, ease, Box, Label, Head, Bust, Figure, SeatBack, Plane, Cloud, Canopy, at, Cam, Rain, Labels} from './tis';
import {LAND, RIVERS, K} from './mapdata';

const P = (line) => line.p || {};
// the framing a line gets when the script doesn't say: position, size and camera move change from line to line
const FRAMES = [{x: 960, s: 0.6, zoom: [1.0, 1.07]}, {x: 640, s: 0.66, zoom: [1.06, 1.0]}, {x: 1280, s: 0.5, zoom: [1.0, 1.05]}, {x: 820, s: 0.64, zoom: [1.0, 1.06]},
  {x: 1180, s: 0.56, zoom: [1.06, 1.0]}, {x: 960, s: 0.42, zoom: [1.0, 1.04]}];
const frameOf = (line) => FRAMES[(line.idx || 0) % FRAMES.length];

// ───────────── the rainforest ─────────────
const TINT = {day: null, dusk: ['#7C2D12', 0.28], night: ['#0B1530', 0.62], dawn: ['#F59E0B', 0.12]};
export function Rainforest({f = 0, time = 'day', rain = false, water = false, drift = 0, seed = 3, ground = 900}) {
  const R = rng(seed);
  const back = [...Array(16)].map((_, i) => ({x: i * 130 + R() * 80, y: 120 + R() * 200, r: 120 + R() * 90}));
  const trunks = [...Array(7)].map((_, i) => ({x: i * 300 + R() * 120 - 60, w: 50 + R() * 50, c: ['#6B4423', '#5B3A1E', '#7A4F2A'][i % 3]}));
  const vines = [...Array(9)].map((_, i) => ({x: R() * W, len: 300 + R() * 400, sw: R() * 6.28}));
  const d1 = drift * 0.35, d2 = drift * 0.7, d3 = drift;
  const wrap = (x, d) => ((x + d) % (W + 400) + W + 400) % (W + 400) - 200;
  return (
    <g>
      <rect width={W} height={H} fill={time === 'night' ? '#1E3A2A' : '#9CCB8E'} />
      {time !== 'night' && [...Array(5)].map((_, i) => <path key={'ray' + i} d={`M ${200 + i * 380} -40 L ${290 + i * 380} -40 L ${520 + i * 380} ${H} L ${360 + i * 380} ${H} Z`} fill="#FFF7CC" opacity={0.18} />)}
      {back.map((b, i) => <circle key={'b' + i} cx={wrap(b.x, d1)} cy={b.y} r={b.r} fill={i % 2 ? '#2F6B3A' : '#3A7D46'} {...st(5)} />)}
      {trunks.map((t, i) => {
        const x = wrap(t.x, d2);
        return (<g key={'t' + i}>
          <path d={`M ${x - t.w / 2} -20 L ${x - t.w / 2} ${ground - 40} C ${x - t.w} ${ground} ${x - t.w * 1.6} ${ground + 10} ${x - t.w * 2} ${ground + 20} L ${x + t.w * 2} ${ground + 20} C ${x + t.w * 1.6} ${ground + 10} ${x + t.w} ${ground} ${x + t.w / 2} ${ground - 40} L ${x + t.w / 2} -20 Z`} fill={t.c} {...ST} />
          <path d={`M ${x + t.w * 0.15} 0 L ${x + t.w * 0.15} ${ground - 60}`} stroke="#000" strokeWidth={t.w * 0.25} opacity={0.12} />
        </g>);
      })}
      {vines.map((v, i) => { const x = wrap(v.x, d2), s = Math.sin(f * 0.03 + v.sw) * 12;
        return <path key={'v' + i} d={`M ${x} -10 C ${x + 30 + s} ${v.len * 0.3} ${x - 30 + s} ${v.len * 0.7} ${x + s} ${v.len}`} stroke="#3F7D32" strokeWidth={9} fill="none" strokeLinecap="round" />; })}
      <rect y={ground} width={W} height={H - ground} fill="#4A3420" {...ST} />
      {[...Array(28)].map((_, i) => <ellipse key={'l' + i} cx={wrap(R() * W, d3)} cy={ground + 20 + R() * (H - ground - 20)} rx={26 + R() * 20} ry={10} fill={['#6B8E3A', '#8A6A2E', '#5B7A2E'][i % 3]} {...st(3)} />)}
      {water && <g>
        <path d={`M -20 ${ground + 14} C 400 ${ground + 4} 900 ${ground + 30} 1300 ${ground + 14} S 1800 ${ground + 8} 1940 ${ground + 20} L 1940 ${ground + 104} C 1500 ${ground + 116} 900 ${ground + 92} 400 ${ground + 110} L -20 ${ground + 100} Z`} fill="#6FA8B8" {...ST} />
        {[...Array(10)].map((_, i) => { const x = ((i * 210 + f * 3) % (W + 200)) - 100; return <path key={'w' + i} d={`M ${x} ${ground + 40 + (i % 3) * 22} q 30 -10 60 0`} stroke="#E0F2FE" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.8} />; })}
      </g>}
      {TINT[time] && <rect width={W} height={H} fill={TINT[time][0]} opacity={TINT[time][1]} />}
      {time === 'night' && [...Array(24)].map((_, i) => { const x = R() * W, y = 200 + R() * 600; const on = Math.sin(f * 0.15 + i * 2.1) > 0.3;
        return on ? <circle key={'ff' + i} cx={x + Math.sin(f * 0.05 + i) * 20} cy={y} r={5} fill="#FDE68A" opacity={0.9} /> : null; })}
      {rain && <Rain f={f} n={90} op={0.45} slant={-10} />}
    </g>
  );
}
// big leaves in front, at the corners
const Leaves = ({f = 0, night = false}) => {
  const leaf = (x, y, r, s) => (
    <g transform={`translate(${x} ${y}) rotate(${r + Math.sin(f * 0.04 + x) * 3}) scale(${s})`}>
      <path d="M 0 0 C 80 -60 200 -60 300 0 C 200 60 80 60 0 0 Z" fill={night ? '#173B22' : '#2E7D32'} {...ST} />
      <path d="M 0 0 L 290 0" stroke={night ? '#0E2615' : '#1B5E20'} strokeWidth={6} />
    </g>
  );
  return <g>{leaf(-60, 980, -30, 1.4)}{leaf(-40, 860, -60, 1.1)}{leaf(1980, 1000, 210, 1.4)}{leaf(1960, 880, 240, 1.1)}</g>;
};
// the day in the corner and a big card when it changes (drawn by the player)
export const DayCard = ({day, f}) => {
  const t = lin(f, 0, 26, 1, 0.34, ease);
  const x = lin(f, 0, 26, W / 2 - 260, 1520, ease), y = lin(f, 0, 26, H / 2 - 110, 40, ease);
  return (
    <g>
      <rect width={W} height={H} fill="#000" opacity={lin(f, 0, 24, 0.85, 0)} />
      <g transform={`translate(${x} ${y}) scale(${t})`}><Box x={0} y={0} w={520} h={220} text={`DAY ${day}`} fill="#E3232C" color="#fff" outline /></g>
    </g>
  );
};
export const DayCorner = ({day}) => <g transform="translate(1520 40) scale(0.34)"><Box x={0} y={0} w={520} h={220} text={`DAY ${day}`} fill="#E3232C" color="#fff" outline /></g>;

// ───────────── icons for the story ─────────────
export const Thing = ({name, f = 0}) => {
  switch (name) {
    case 'sweets': return (<g>
      <path d="M -120 -90 L 120 -90 L 140 120 L -140 120 Z" fill="#F472B6" {...ST} />
      <path d="M -120 -90 C -60 -130 60 -130 120 -90" fill="none" {...ST} />
      <circle cx={-50} cy={10} r={30} fill="#FDE047" {...st(5)} /><circle cx={30} cy={40} r={30} fill="#60A5FA" {...st(5)} /><circle cx={60} cy={-20} r={26} fill="#34D399" {...st(5)} />
      <text x={0} y={100} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={40} fill="#fff" stroke={INK} strokeWidth={6} paintOrder="stroke">SWEETS</text></g>);
    case 'fuel': return (<g>
      <path d="M -110 -130 L 90 -130 L 120 -100 L 120 150 L -110 150 Z" fill="#DC2626" {...ST} />
      <rect x={60} y={-180} width={50} height={60} fill="#7F1D1D" {...ST} /><rect x={-80} y={-170} width={110} height={40} rx={18} fill="none" {...st(12)} />
      <path d="M -80 -60 L 80 -60 L 80 60 L -80 60 Z" fill="none" stroke="#7F1D1D" strokeWidth={10} />
      <text x={5} y={130} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={40} fill="#fff" stroke={INK} strokeWidth={6} paintOrder="stroke">FUEL</text></g>);
    case 'glasses': return <g fill="none" {...st(12)}><rect x={-160} y={-60} width={140} height={110} rx={40} fill="#BFE6FF" /><rect x={20} y={-60} width={140} height={110} rx={40} fill="#BFE6FF" /><path d="M -20 -10 L 20 -10" /><path d="M -60 20 L -100 -30 M 90 -40 L 130 30" stroke="#fff" strokeWidth={6} /></g>;
    case 'shoe': return <path d="M -150 40 L -140 -40 C -60 -50 0 -90 40 -80 C 100 -20 150 0 160 40 Z" fill="#3F2A1E" {...ST} />;
    case 'plane': return <g transform="scale(0.5)"><Plane f={f} /></g>;
    case 'heli': return (<g transform="scale(-1 1)"><ellipse cx={0} cy={0} rx={120} ry={60} fill="#65A30D" {...ST} /><path d="M 110 -10 L 300 -20 L 300 10 L 110 20 Z" fill="#65A30D" {...ST} />
      <ellipse cx={-50} cy={-10} rx={50} ry={34} fill="#BFE6FF" {...st(5)} /><path d={`M ${-220 + Math.sin(f) * 40} -80 L ${220 - Math.sin(f) * 40} -80`} stroke={INK} strokeWidth={10} strokeLinecap="round" /><rect x={-8} y={-80} width={16} height={24} fill={INK} /></g>);
    case 'vulture': return (<g transform={`scale(1 ${0.8 + Math.sin(f * 0.3) * 0.2})`}><path d="M -160 0 C -100 -60 -40 -40 0 0 C 40 -40 100 -60 160 0 C 100 -20 40 -6 0 20 C -40 -6 -100 -20 -160 0 Z" fill="#1F1B18" {...st(5)} /><circle cx={0} cy={6} r={16} fill="#E11D48" /></g>);
    case 'stingray': return (<g><path d="M -150 0 C -80 -80 80 -80 150 0 C 80 50 -80 50 -150 0 Z" fill="#78716C" {...ST} /><path d="M 140 0 L 320 30" stroke={INK} strokeWidth={8} /><circle cx={-30} cy={-20} r={8} fill={INK} /><circle cx={30} cy={-20} r={8} fill={INK} /></g>);
    case 'caiman': return (<g><path d="M -260 0 C -200 -40 100 -50 260 -10 L 300 10 C 100 30 -200 40 -260 0 Z" fill="#4D5B2C" {...ST} />{[-180, -120, -60, 0, 60, 120].map((x) => <path key={x} d={`M ${x} -30 l 16 -20 l 16 20`} fill="#3D4A22" {...st(4)} />)}<circle cx={220} cy={-24} r={12} fill="#FDE047" {...st(4)} /></g>);
    case 'mosquito': return (<g><ellipse rx={30} ry={10} fill={INK} /><path d="M -10 -6 C -30 -40 -60 -40 -50 -10 M 10 -6 C 30 -40 60 -40 50 -10" fill="#E0F2FE" {...st(3)} /><path d="M 30 0 L 70 6" stroke={INK} strokeWidth={4} /></g>);
    case 'boat': return (<g><path d="M -330 0 L 330 0 L 280 70 L -280 70 Z" fill="#8B5A2B" {...ST} /><path d="M -320 0 L 320 0" stroke="#5B3A1E" strokeWidth={14} /><rect x={240} y={-60} width={70} height={70} fill="#475569" {...ST} /><path d="M 310 0 L 360 60" stroke={INK} strokeWidth={8} /></g>);
    case 'hut': return (<g>
      {[-200, -70, 70, 200].map((x) => <rect key={x} x={x - 10} y={60} width={20} height={150} fill="#6B4423" {...st(5)} />)}
      <rect x={-250} y={-60} width={500} height={130} fill="#B08350" {...ST} /><rect x={-60} y={-30} width={120} height={100} fill="#3F2A1E" {...st(5)} />
      <path d="M -310 -50 L 0 -230 L 310 -50 Z" fill="#C8A44D" {...ST} />{[-150, -60, 30, 120, 210].map((x) => <path key={x} d={`M ${x} -100 L ${x + 30} -60`} stroke="#A8832F" strokeWidth={8} />)}</g>);
    case 'book': return (<g><rect x={-170} y={-230} width={340} height={460} rx={8} fill="#0F3B2E" {...ST} /><rect x={-170} y={-230} width={40} height={460} fill="#0A2A20" />
      <text x={20} y={-120} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={44} fill="#FDE68A">WHEN I FELL</text><text x={20} y={-70} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={44} fill="#FDE68A">FROM THE SKY</text>
      <circle cx={20} cy={60} r={70} fill="#16A34A" {...st(5)} /><text x={20} y={190} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={400} fontSize={30} fill="#fff">JULIANE KOEPCKE</text></g>);
    case 'watch': return (<g><rect x={-40} y={-150} width={80} height={300} rx={20} fill="#7C4A1E" {...ST} /><circle r={100} fill="#E5E7EB" {...ST} /><circle r={80} fill="#fff" {...st(5)} />
      <path d={`M 0 0 L 0 -58`} stroke={INK} strokeWidth={9} strokeLinecap="round" /><path d={`M 0 0 L ${Math.sin(f * 0.21) * 66} ${-Math.cos(f * 0.21) * 66}`} stroke="#E3232C" strokeWidth={5} strokeLinecap="round" /><circle r={9} fill={INK} /></g>);
    case 'fruit': return (<g><circle r={70} fill="#7C3AED" {...ST} /><circle cx={-24} cy={-22} r={16} fill="#A78BFA" /><path d="M 0 -70 C 10 -110 40 -120 60 -110" fill="none" stroke="#3F6212" strokeWidth={10} />
      <text x={0} y={30} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={80} fill="#fff" stroke={INK} strokeWidth={6} paintOrder="stroke">?</text></g>);
    case 'bat': return (<g transform={`scale(1 ${0.85 + Math.sin(f * 0.6) * 0.15})`}><path d="M -160 0 C -130 -40 -90 -40 -70 -10 C -60 -30 -40 -30 -30 -10 C -20 -30 20 -30 30 -10 C 40 -30 60 -30 70 -10 C 90 -40 130 -40 160 0 C 110 -10 60 20 0 30 C -60 20 -110 -10 -160 0 Z" fill="#3B2F2F" {...st(5)} /><circle cx={0} cy={-6} r={22} fill="#3B2F2F" {...st(4)} /></g>);
    default: return null;
  }
};

// ───────────── scenes ─────────────
// Juliane (or another person) in the rainforest
function Jungle({f, len, line}) {
  const p = P(line);
  const walk = ['walk', 'limp', 'run', 'push'].includes(p.pose);
  const dir = p.dir || 1;
  const fr = frameOf(line);
  const s = p.s || fr.s, ground = p.ground || 900;
  const x = (p.x || (walk ? 960 : fr.x)) + (walk ? dir * lin(f, 0, len, -300, 300, (t) => t) * (p.pose === 'limp' ? 0.6 : 1) : 0);
  const items = p.items || [];
  return (
    <Cam f={f} len={len} from={fr.zoom[0]} to={fr.zoom[1]} x={walk ? 960 : x}>
      <Rainforest f={f} time={p.time || 'day'} rain={p.rain} water={p.water} drift={walk ? -dir * f * 1.2 : 0} seed={p.seed || 3 + (line.idx || 0) * 7} ground={ground} />
      {items.map((it, i) => { const a = at(line, it.on || '', 0.3); const s2 = clamp(pop(f, a, 140, 13), 0, 1.1);
        if (s2 <= 0.01) return null;
        if (it.name === 'plane' || it.name === 'heli') return <g key={i} transform={`translate(${lin(f, a, a + 120, -300, W + 300, (t) => t)} ${it.y || 140})`}><Thing name={it.name} f={f} /></g>;
        if (it.name === 'vulture') return <g key={i}>{[0, 1, 2].map((k) => <g key={k} transform={`translate(${960 + Math.cos(f * 0.02 + k * 2.1) * 520} ${200 + Math.sin(f * 0.02 + k * 2.1) * 90}) scale(0.6)`}><Thing name="vulture" f={f + k * 9} /></g>)}</g>;
        return <g key={i} transform={`translate(${it.x || 1500} ${it.y || 760}) scale(${s2 * (it.s || 1)})`}><Thing name={it.name} f={f} /></g>; })}
      <g transform={`translate(${x} ${ground + 160 - 1100 * s}) scale(${s})`}>
        <Figure who={p.who || 'juliane'} pose={p.pose || 'stand'} expr={p.expr || 'worried'} f={f} dirty={p.dirty != null ? p.dirty : 0.8} oneShoe={p.oneShoe !== false} talk={p.talk} dir={walk ? dir : 0} />
      </g>
      {p.leaves !== false && <Leaves f={f} night={p.time === 'night'} />}
      <Labels line={line} f={f} />
    </Cam>
  );
}

// wading in the river: Juliane from the waist up, water at her middle
function Wade({f, len, line}) {
  const p = P(line);
  const danger = p.danger, da = at(line, p.danger_on || p.danger || '', 0.5);
  return (
    <Cam f={f} len={len} from={1.04} to={1.1}>
      <rect width={W} height={H} fill={p.time === 'night' ? '#1E3A2A' : '#9CCB8E'} />
      <Canopy y0={140} f={f} seed={4} rows={3} river={false} />
      <rect y={430} width={W} height={H - 430} fill="#7A9A6A" />
      <g transform={`translate(${(p.x || frameOf(line).x) + (p.current ? lin(f, 0, len, -160, 160, (q) => q) : 0)} ${520 + Math.sin(f * 0.1) * 6}) scale(${p.s || [0.62, 0.8, 0.5][(line.idx || 0) % 3]})`}><Bust who="juliane" x={0} y={0} s={1} expr={p.expr || 'worried'} f={f} arms="rest" seed={1} /></g>
      <path d={`M -20 640 ${[...Array(21)].map((_, i) => `L ${i * 100} ${640 + Math.sin(f * 0.12 + i) * 10}`).join(' ')} L 1940 1100 L -20 1100 Z`} fill="#4F8FA6" opacity={0.92} {...ST} />
      {[...Array(9)].map((_, i) => { const x = ((i * 230 + f * (p.current ? 6 : 2)) % (W + 200)) - 100; return <path key={i} d={`M ${x} ${720 + (i % 3) * 90} q 40 -14 80 0`} stroke="#E0F2FE" strokeWidth={6} fill="none" strokeLinecap="round" />; })}
      {danger && f >= da && <g transform={`translate(${lin(f, da, da + 90, danger === 'caiman' ? 2100 : 1500, danger === 'caiman' ? 1400 : 1300)} ${danger === 'caiman' ? 690 : 900}) scale(${clamp(pop(f, da, 140, 12), 0, 1.1)})`}><Thing name={danger} f={f} /></g>}
      {p.time === 'night' && <rect width={W} height={H} fill="#0B1530" opacity={0.38} />}
      {p.time === 'night' && danger === 'caiman' && f >= da && <g transform={`translate(${lin(f, da, da + 90, 2100, 1400) + 220 * 1.0} ${690 - 24})`}><circle r={14} fill="#FDE047" opacity={0.95} /><circle r={30} fill="#FDE047" opacity={0.25} /></g>}
      {p.rain && <Rain f={f} n={90} op={0.45} />}
      <Labels line={line} f={f} />
    </Cam>
  );
}

// a close-up of one person, with a background
function Close({f, len, line}) {
  const p = P(line);
  const bg = p.bg || 'jungle';
  const left = p.side ? p.side === 'left' : (line.idx || 0) % 2 === 1;
  const px = p.x || (left ? 640 : 1260), sc = p.s || [1.05, 1.25, 0.9][(line.idx || 0) % 3];
  const thingX = p.thing_x || (left ? 1360 : 520);
  return (
    <Cam f={f} len={len} from={(line.idx || 0) % 2 ? 1.08 : 1} to={(line.idx || 0) % 2 ? 1 : 1.08} x={px}>
      {bg === 'jungle' || bg === 'night' ? <Rainforest f={f} time={bg === 'night' ? 'night' : (p.time || 'day')} rain={p.rain} seed={p.seed || 6 + (line.idx || 0) * 5} /> :
        bg === 'hospital' ? <g><rect width={W} height={H} fill="#D1FAE5" /><rect y={820} width={W} height={260} fill="#A7F3D0" {...ST} /></g> :
        bg === 'sky' ? <rect width={W} height={H} fill="#7DB4F0" /> : <rect width={W} height={H} fill={p.color || '#1E293B'} />}
      <g transform={`translate(${px} ${p.y || (sc > 1.1 ? 600 : 560)}) scale(${sc})`}>
        <Bust who={p.who || 'juliane'} x={0} y={0} s={1} expr={p.expr || 'worried'} f={f} arms={p.arms || 'rest'} talk={p.talk && f < len - 8} seed={2} />
      </g>
      {p.thing && <g transform={`translate(${thingX} ${p.thing_y || 600}) scale(${clamp(pop(f, at(line, p.thing_on || '', 0.3), 140, 12), 0, 1.15) * (p.thing_s || 1.4)})`}><Thing name={p.thing} f={f} /></g>}
      <Labels line={line} f={f} x0={left ? 1860 : 100} y0={left ? 150 : 100} align={left ? 'right' : 'left'} />
    </Cam>
  );
}

// a fact on screen: a big number, its label and what it compares to
function Count({f, len, line}) {
  const p = P(line);
  const a = at(line, p.on || '', 0.2);
  const s = clamp(pop(f, a, 110, 12), 0, 1);
  const n = Number(String(p.value).replace(/[^0-9.]/g, '')) || 0;
  const pre = (String(p.value).match(/^[^0-9]*/) || [''])[0], suf = (String(p.value).match(/[^0-9.,]*$/) || [''])[0];
  const shown = pre + Math.round(lin(f, a, a + 36, 0, n)).toLocaleString('en-US') + suf;
  return (
    <g>
      <rect width={W} height={H} fill="#0B1F3A" />
      {p.thing && <g transform={`translate(420 540) scale(${2.2 * s})`}><Thing name={p.thing} f={f} /></g>}
      <g transform={`translate(${p.thing ? 1220 : 960} 520) scale(${s})`}>
        <text x={0} y={60} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={230} fill="#FFE11A" stroke={INK} strokeWidth={18} paintOrder="stroke">{shown}</text>
        <text x={0} y={180} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={84} fill="#fff">{String(p.label || '').toUpperCase()}</text>
        {p.compare && <text x={0} y={280} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={62} fill="#9BE1FF" opacity={clamp((f - a - 40) / 15, 0, 1)}>{String(p.compare).toUpperCase()}</text>}
      </g>
    </g>
  );
}

// a real quote, on a white card beside the person who said it
function Quote({f, len, line}) {
  const p = P(line);
  const a = at(line, p.on || '', 0.1);
  const s = clamp(pop(f, a, 140, 13), 0, 1.05);
  const words = String(p.text || '').split(' ');
  const rows = [];
  let row = '';
  for (const w of words) { if ((row + ' ' + w).trim().length > 26 && row) { rows.push(row); row = w; } else row = (row + ' ' + w).trim(); }
  if (row) rows.push(row);
  const h = 120 + rows.length * 84;
  return (
    <Cam f={f} len={len} from={1} to={1.05}>
      {p.bg === 'jungle' ? <Rainforest f={f} time={p.time || 'day'} seed={8} /> : <rect width={W} height={H} fill={p.color || '#0F2A44'} />}
      <g transform={`translate(1450 ${p.y || 560}) scale(${p.s || 0.9})`}><Bust who={p.who || 'juliane'} x={0} y={0} s={1} expr={p.expr || 'calm'} f={f} talk={p.talk !== false && f >= a && f < len - 8} arms="rest" seed={3} /></g>
      <g transform={`translate(110 ${540 - h / 2}) scale(${s})`}>
        <rect x={10} y={12} width={980} height={h} fill="#000" opacity={0.35} /><rect width={980} height={h} fill="#fff" {...ST} />
        <rect x={30} y={30} width={14} height={h - 60} fill="#E3232C" />
        {rows.map((r, i) => <text key={i} x={80} y={110 + i * 84} fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={70} fill={INK}>{(i === 0 ? '"' : '') + r + (i === rows.length - 1 ? '"' : '')}</text>)}
      </g>
      <Label x={110} y={540 + h / 2 + 30} text={String(p.who_label || '').toUpperCase()} f={f} at={a + 8} fill="#fff" h={60} />
    </Cam>
  );
}

// the map of Peru: Lima, Pucallpa, Panguana, the crash site; a route draws on its word
const PLACES = {lima: [-77.04, -12.05, 'LIMA', -1], pucallpa: [-74.55, -8.38, 'PUCALLPA', 1], panguana: [-74.94, -9.61, 'PANGUANA', -1], crash: [-74.8, -9.3, 'CRASH SITE', 1],
  puerto_inca: [-74.96, -9.38, 'PUERTO INCA', -1], tournavista: [-74.70, -8.93, 'TOURNAVISTA', 1], kiel: [10.13, 54.32, 'KIEL, GERMANY', 1]};
function Map({f, len, line}) {
  const p = P(line);
  const [clon, clat] = p.center || [-75.6, -10.2];
  const ppd = lin(f, 0, len, p.zoom0 || 120, p.zoom1 || 150, ease);
  const sc = ppd / K;
  const gx = (lon) => (lon + 180) * K, gy = (lat) => (90 - lat) * K;
  const sx = (lon) => W / 2 + (lon - clon) * ppd, sy = (lat) => H / 2 - (lat - clat) * ppd;
  const pins = (p.pins || []).map((k) => PLACES[k]).filter(Boolean);
  const route = p.route && PLACES[p.route[0]] && PLACES[p.route[1]] ? [PLACES[p.route[0]], PLACES[p.route[1]]] : null;
  const ra = at(line, p.route_on || '', 0.4);
  return (
    <g>
      <rect width={W} height={H} fill="#5BA4D4" />
      <g transform={`translate(${W / 2} ${H / 2}) scale(${sc}) translate(${-gx(clon)} ${-gy(clat)})`}>
        <path d={LAND} fill="#9BC88B" stroke={INK} strokeWidth={5} vectorEffect="non-scaling-stroke" />
        <path d={RIVERS} fill="none" stroke="#3B82F6" strokeWidth={4} vectorEffect="non-scaling-stroke" />
      </g>
      <text x={sx(-75.2)} y={sy(-11.4)} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={90} fill="#fff" opacity={0.55} stroke={INK} strokeWidth={4} paintOrder="stroke">PERU</text>
      {route && (() => { const [a, b] = route; const x1 = sx(a[0]), y1 = sy(a[1]), x2 = sx(b[0]), y2 = sy(b[1]); const len2 = Math.hypot(x2 - x1, y2 - y1); const d = lin(f, ra, ra + 50, 0, len2);
        return <path d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke="#E3232C" strokeWidth={10} strokeDasharray={`${d} ${len2}`} strokeLinecap="round" />; })()}
      {pins.map((pl, i) => { const a = at(line, (p.pin_on || [])[i] || '', 0.15 + i * 0.15); const s = clamp(pop(f, a, 150, 12), 0, 1.15);
        return (<g key={i} transform={`translate(${sx(pl[0])} ${sy(pl[1])})`}>
          <g transform={`scale(${s})`}><path d="M 0 0 Q -30 -40 -30 -60 A 30 30 0 0 1 30 -60 Q 30 -40 0 0 Z" fill={pl[2] === 'CRASH SITE' ? '#E3232C' : '#FFE11A'} {...st(5)} /><circle cx={0} cy={-60} r={10} fill={INK} /></g>
          <Label x={pl[3] < 0 ? -40 - pl[2].length * 25 - 40 : 40} y={-120} text={pl[2]} f={f} at={a + 4} h={58} fill={pl[2] === 'CRASH SITE' ? '#E3232C' : '#FFE11A'} color={pl[2] === 'CRASH SITE' ? '#fff' : INK} />
        </g>); })}
      <Labels line={line} f={f} y0={60} />
    </g>
  );
}

// her father's rule: a stream leads to a river, a river leads to people
function Rule({f, len, line}) {
  const p = P(line);
  const steps = [['stream', 'A STREAM'], ['river', 'A RIVER'], ['people', 'PEOPLE']];
  const xs = [330, 960, 1590];
  return (
    <g>
      <rect width={W} height={H} fill="#F5EBD7" />
      <text x={W / 2} y={170} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={84} fill={INK}>{p.title || "HER FATHER'S RULE"}</text>
      {steps.map(([w, t], i) => {
        const a = at(line, (p.on || [])[i] || w, 0.25 + i * 0.25);
        const s = clamp(pop(f, a, 140, 12), 0, 1.1);
        return (<g key={i} transform={`translate(${xs[i]} 560) scale(${s})`}>
          <circle r={210} fill="#fff" {...ST} />
          {i === 0 && <path d="M -150 40 C -80 0 -40 80 20 40 S 100 0 150 40" stroke="#38BDF8" strokeWidth={20} fill="none" strokeLinecap="round" />}
          {i === 1 && <path d="M -170 10 C -80 -40 0 70 80 10 S 150 -20 170 20 L 170 90 C 100 60 0 130 -80 70 S -150 60 -170 80 Z" fill="#38BDF8" {...st(5)} />}
          {i === 2 && <g transform="scale(0.45) translate(0 40)"><Thing name="hut" /></g>}
          <text x={0} y={290} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={64} fill={INK}>{t}</text>
        </g>);
      })}
      {[0, 1].map((i) => { const a = at(line, (p.on || [])[i + 1] || steps[i + 1][0], 0.5 + i * 0.25); const o = clamp((f - a + 6) / 10, 0, 1);
        return <path key={i} d={`M ${xs[i] + 230} 560 L ${xs[i + 1] - 250} 560 M ${xs[i + 1] - 280} 530 L ${xs[i + 1] - 245} 560 L ${xs[i + 1] - 280} 590`} stroke="#E3232C" strokeWidth={16} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={o} />; })}
    </g>
  );
}

// a big object close-up (the bag of sweets, the fuel, the shoe, the glasses, the book)
function Item({f, len, line}) {
  const p = P(line);
  const a = at(line, p.on || '', 0.15);
  const k = line.cont ? 1 : clamp(pop(f, a, 130, 11), 0, 1.1);   // the same object as the line before stays where it was
  return (
    <Cam f={f} len={len} from={line.cont ? 1.1 : 1} to={line.cont ? 1.16 : 1.1}>
      {p.bg === 'jungle' ? <Rainforest f={f} seed={9} time={p.time || 'day'} /> : <rect width={W} height={H} fill={p.color || '#F5EBD7'} />}
      <g transform={`translate(${p.x || 960} ${p.y || 520}) scale(${k * (p.s || 2.2)}) rotate(${p.rot || -6})`}><Thing name={p.thing} f={f} /></g>
      <Labels line={line} f={f} />
    </Cam>
  );
}

// the rescue planes above the trees: from below she sees nothing but leaves; from above, nobody sees her
function Planes({f, len, line}) {
  const p = P(line);
  return (
    <g>
      <g>
        <rect width={W} height={H / 2} fill="#7DB4F0" />
        <Canopy y0={360} f={f} seed={12} rows={3} river={false} />
        <g transform={`translate(${lin(f, 0, len, -200, W + 200, (t) => t)} 140) scale(0.45)`}><Thing name={p.heli ? 'heli' : 'plane'} f={f} /></g>
      </g>
      <g transform={`translate(0 ${H / 2})`}>
        <rect width={W} height={H / 2} fill="#2F6B3A" />
        <svg x={0} y={0} width={W} height={H / 2} viewBox={`0 ${H / 2} ${W} ${H / 2}`} preserveAspectRatio="xMidYMid slice"><Rainforest f={f} seed={5} ground={860} /></svg>
        <g transform="translate(760 82) scale(0.36)"><Figure who="juliane" pose={p.pose || (p.heli ? 'signal' : 'shade')} expr={p.expr || 'worried'} f={f} dirty={0.8} oneShoe /></g>
      </g>
      <rect x={0} y={H / 2 - 5} width={W} height={10} fill={INK} />
      <Labels line={line} f={f} y0={60} />
    </g>
  );
}

// the row of seats she found, seen from a distance and from behind: still, quiet, respectful
function Seats3({f, len, line}) {
  const p = P(line);
  return (
    <Cam f={f} len={len} from={1.08} to={1.0}>
      <Rainforest f={f} seed={14} time={p.time || 'dusk'} />
      <g transform="translate(1100 700) rotate(-18) scale(0.42)">
        <SeatBack x={-540} /><SeatBack x={0} /><SeatBack x={540} />
      </g>
      <g transform="translate(560 620) scale(0.42)"><Figure who="juliane" pose="stand" expr="shock" f={f} dirty={0.8} oneShoe /></g>
      {p.vultures && [0, 1].map((k) => <g key={k} transform={`translate(${1100 + Math.cos(f * 0.02 + k * 3) * 300} ${170 + Math.sin(f * 0.02 + k * 3) * 50}) scale(0.5)`}><Thing name="vulture" f={f + k * 7} /></g>)}
      <Leaves f={f} />
      <Labels line={line} f={f} />
    </Cam>
  );
}

// the hut and the boat on the riverbank
// inside the hut: plank walls, the doorway, the fuel in the corner, Juliane on the floor
function HutInside({f, len, line, p}) {
  const night = p.time === 'night';
  const v = at(line, p.wake_on || 'voices', 0.6);
  const heard = !night && f >= v;
  return (
    <Cam f={f} len={len} from={1.04} to={1.0}>
      <rect width={W} height={H} fill="#6B4423" />
      {[...Array(17)].map((_, i) => <path key={i} d={`M ${i * 120} 0 L ${i * 120} 820`} stroke="#4A2E17" strokeWidth={8} />)}
      <rect x={1240} y={250} width={380} height={570} fill={night ? '#0B1530' : '#A7D99A'} {...st(10)} />
      {night ? [...Array(8)].map((_, i) => Math.sin(f * 0.15 + i * 2.1) > 0.2 && <circle key={i} cx={1290 + (i * 47) % 300} cy={330 + (i * 83) % 420} r={5} fill="#FDE68A" />)
        : <g><path d="M 1240 250 L 1620 250 L 1620 820 L 1240 820 Z" fill="#FFF7CC" opacity={0.25} /><path d={`M 1240 820 L 1620 820 L 1300 1080 L 700 1080 Z`} fill="#FFF7CC" opacity={0.22} /></g>}
      {!night && heard && [0, 1, 2].map((k) => <path key={k} d={`M ${1400 + k * 40} ${520 - k * 50} q 30 -20 0 -40`} stroke="#fff" strokeWidth={8} fill="none" strokeLinecap="round" opacity={clamp((f - v - k * 6) / 10, 0, 1)} />)}
      <rect y={820} width={W} height={H - 820} fill="#8B5A2B" {...ST} />
      {[...Array(6)].map((_, i) => <path key={i} d={`M 0 ${860 + i * 40} L ${W} ${860 + i * 40}`} stroke="#6B4423" strokeWidth={4} />)}
      <path d="M -40 0 L 1960 0 L 1960 150 C 1500 210 400 210 -40 150 Z" fill="#C8A44D" {...ST} />
      {[...Array(14)].map((_, i) => <path key={i} d={`M ${i * 150 - 20} 120 L ${i * 150 + 30} 190`} stroke="#A8832F" strokeWidth={8} />)}
      <g transform="translate(1820 790) scale(0.42)"><Thing name="fuel" /></g>
      <g transform="translate(700 410) scale(0.58)"><Figure who="juliane" pose="hug" expr={heard ? 'shock' : (p.expr || (night ? 'sad' : 'worried'))} f={f} dirty={1} /></g>
      {night && <rect width={W} height={H} fill="#0B1530" opacity={0.45} />}
      <Labels line={line} f={f} />
    </Cam>
  );
}

function Hut({f, len, line}) {
  const p = P(line);
  const phase = p.phase || 'arrive';
  if (phase === 'wait') return <HutInside f={f} len={len} line={line} p={p} />;
  const G = 840;   // the riverbank; the river runs along the bottom
  const walkX = phase === 'arrive' ? lin(f, 0, len, 160, 560, (t) => t) : lin(f, 0, len, 560, 900, (t) => t);
  const walkY = phase === 'arrive' ? 0 : lin(f, 0, len, 0, -70, (t) => t);   // the path leads up
  return (
    <Cam f={f} len={len} from={1} to={1.06}>
      <Rainforest f={f} seed={21} time={p.time || 'day'} rain={p.rain} ground={G - 120} />
      <path d={`M 120 ${G + 110} C 500 ${G + 90} 800 ${G + 40} 1060 ${G - 70} L 1130 ${G - 70} C 900 ${G + 60} 600 ${G + 120} 260 ${G + 140} Z`} fill="#A07A4E" {...st(4)} />
      <rect y={G + 120} width={W} height={H - G - 120} fill="#4F8FA6" {...ST} />
      {[...Array(9)].map((_, i) => { const x = ((i * 230 + f * 2) % (W + 200)) - 100; return <path key={i} d={`M ${x} ${G + 160 + (i % 2) * 40} q 40 -14 80 0`} stroke="#E0F2FE" strokeWidth={6} fill="none" strokeLinecap="round" />; })}
      <g transform={`translate(560 ${G + 150 + Math.sin(f * 0.1) * 5}) scale(0.8)`}><Thing name="boat" /></g>
      <g transform={`translate(1360 ${G - 330}) scale(0.95)`}><Thing name="hut" /></g>
      {[0, 1, 2, 3].map((k) => <path key={k} d={`M ${1100 + k * 22} ${G - 120 + k * 30} L ${1160 + k * 22} ${G - 120 + k * 30}`} stroke="#6B4423" strokeWidth={12} strokeLinecap="round" />)}
      <path d={`M 1092 ${G - 130} L 1150 ${G - 10} M 1152 ${G - 130} L 1210 ${G - 10}`} stroke="#5B3A1E" strokeWidth={10} />
      {(phase === 'arrive' || phase === 'path') && <g transform={`translate(${walkX} ${G + 70 + walkY - 1100 * 0.4}) scale(0.4)`}>
        <Figure who="juliane" pose="limp" expr={p.expr || 'determined'} f={f} dirty={1} oneShoe dir={1} />
      </g>}
      {phase === 'men' && <g>
        <g transform={`translate(980 ${G - 10 - 800 * 0.4}) scale(0.4)`}><Figure who="juliane" pose="hug" expr={p.expr || 'worried'} f={f} dirty={1} /></g>
        {['worker1', 'worker2', 'worker3'].map((w, i) => { const near = p.close; const x1 = near ? 1250 + i * 190 : 1460 + i * 170;
          const xx = lin(f, 0, 70, 2050 + i * 150, x1); const moving = f < 70 && !near;
          return <g key={w} transform={`translate(${near ? x1 : xx} ${G + 60 - 1100 * 0.4}) scale(0.4)`}><Figure who={w} pose={moving ? 'walk' : 'stand'} expr={p.expr_men || 'worried'} f={f + i * 5} seed={i + 3} dir={moving ? -1 : 0} /></g>; })}
      </g>}
      <Labels line={line} f={f} />
    </Cam>
  );
}

// the canoe trip downriver
function Canoe({f, len, line}) {
  const p = P(line);
  return (
    <Cam f={f} len={len} from={1.04} to={1.0}>
      <rect width={W} height={H} fill={p.time === 'dusk' ? '#F4A261' : '#9CCB8E'} />
      <Canopy y0={200} f={f} drift={-f * 3} seed={22} rows={3} river={false} />
      <rect y={480} width={W} height={H - 480} fill="#6FA8B8" {...ST} />
      {[...Array(10)].map((_, i) => { const x = ((i * 200 - f * 5) % (W + 200) + W + 200) % (W + 200) - 100; return <path key={i} d={`M ${x} ${560 + (i % 4) * 110} q 40 -14 80 0`} stroke="#E0F2FE" strokeWidth={6} fill="none" strokeLinecap="round" />; })}
      <g transform={`translate(960 ${780 + Math.sin(f * 0.1) * 8})`}>
        <g transform="translate(-330 -120) scale(0.42)"><Bust who="worker1" x={0} y={0} s={1} expr="calm" f={f} arms="rest" seed={3} /></g>
        <g transform="translate(330 -120) scale(0.42)"><Bust who="worker2" x={0} y={0} s={1} expr="calm" f={f} arms="rest" seed={4} /></g>
        <path d={`M -250 -40 L ${-170 + Math.sin(f * 0.2) * 30} 150`} stroke="#5B3A1E" strokeWidth={14} strokeLinecap="round" />
        <path d={`M 410 -40 L ${490 + Math.sin(f * 0.2 + 1) * 30} 150`} stroke="#5B3A1E" strokeWidth={14} strokeLinecap="round" />
        <g transform="translate(0 40) rotate(-88) scale(0.3)"><Head who="juliane" expr={p.expr || 'closed'} f={f} /></g>
        <path d="M -560 60 C -420 170 420 170 560 60 L 540 30 L -540 30 Z" fill="#8B5A2B" {...ST} />
        <path d="M -540 40 L 540 40" stroke="#5B3A1E" strokeWidth={12} />
      </g>
      {p.time === 'dusk' && <rect width={W} height={H} fill="#7C2D12" opacity={0.2} />}
      <Labels line={line} f={f} />
    </Cam>
  );
}

// the hospital: Juliane in bed; her father comes in
function Hospital({f, len, line}) {
  const p = P(line);
  const fa = at(line, p.father_on || 'father', 0.3);
  return (
    <Cam f={f} len={len} from={1} to={1.06}>
      <rect width={W} height={H} fill="#E0F2F1" />
      <rect x={140} y={140} width={420} height={300} fill="#BFE6FF" {...ST} /><path d="M 350 140 L 350 440 M 140 290 L 560 290" stroke={INK} strokeWidth={7} />
      <rect y={860} width={W} height={220} fill="#B2DFDB" {...ST} />
      <rect x={560} y={620} width={900} height={120} rx={20} fill="#fff" {...ST} />
      <rect x={560} y={740} width={20} height={160} fill="#94A3B8" {...st(5)} /><rect x={1440} y={740} width={20} height={160} fill="#94A3B8" {...st(5)} />
      <g transform={`translate(${p.hug ? 900 : 860} 520) rotate(${p.hug ? 8 : 0}) scale(0.5)`}><Bust who="juliane" x={0} y={0} s={1} expr={p.hug ? 'closed' : p.father && f > fa ? 'sad' : (p.expr || 'calm')} f={f} arms="rest" seed={1} /></g>
      {p.hug && <g>   {/* they hold each other: he leans in from the bedside, his arm around her shoulders */}
        <g transform="translate(1080 520) rotate(-14) scale(0.5)"><Bust who="father" x={0} y={0} s={1} expr="closed" f={f} arms="rest" seed={4} /></g>
        <path d="M 1010 650 C 960 600 860 590 790 640 L 810 676 C 870 640 950 642 990 690 Z" fill="#B8A06A" {...st(5)} />
        <ellipse cx={792} cy={656} rx={26} ry={20} fill="#F2C9A0" {...st(5)} />
      </g>}
      <rect x={640} y={640} width={760} height={120} rx={30} fill="#E0E7FF" {...ST} />
      {p.father && !p.hug && <g transform={`translate(${lin(f, fa, fa + 40, 2100, 1500)} 400) scale(0.48)`}><Figure who="father" pose="stand" expr={f > fa + 40 ? 'sad' : 'worried'} f={f} seed={4} /></g>}
      {p.doctor && <g transform="translate(1600 400) scale(0.48)"><Figure who="doctor" pose="hold" expr="calm" f={f} seed={6} /></g>}
      <Labels line={line} f={f} />
    </Cam>
  );
}

// the search: soldiers, planes, a newspaper
function Search({f, len, line}) {
  const p = P(line);
  const a = at(line, p.on || '', 0.2);
  return (
    <Cam f={f} len={len} from={1.06} to={1.0}>
      <rect width={W} height={H} fill="#7DB4F0" />
      <Canopy y0={620} f={f} drift={-f * 1.5} seed={30} rows={5} />
      {[0, 1, 2].map((k) => <g key={k} transform={`translate(${((k * 700 + f * (5 + k)) % (W + 600)) - 300} ${160 + k * 90}) scale(${0.32 + k * 0.05})`}><Thing name={k === 1 ? 'heli' : 'plane'} f={f} /></g>)}
      {p.wreck && <g transform={`translate(1100 690) rotate(-24) scale(${0.5 * clamp(pop(f, a, 130, 12), 0, 1.1)})`}><g transform="translate(-200 0)"><Plane f={0} broken={1} /></g></g>}
      {p.wreck && <Canopy y0={760} f={f} seed={31} rows={3} river={false} />}
      {p.paper && <g transform={`translate(1240 ${lin(f, a, a + 20, 1300, 560)}) rotate(-6) scale(${clamp(pop(f, a, 130, 12), 0, 1.05)})`}>
        <rect x={-440} y={-300} width={880} height={600} fill="#F5F5F0" {...ST} />
        <text x={0} y={-200} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={46} fill={INK}>{p.masthead || 'LIMA · DECEMBER 1971'}</text>
        <path d="M -400 -170 L 400 -170" stroke={INK} strokeWidth={6} />
        <text x={0} y={-60} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={92} fill={INK}>{p.paper}</text>
        {[...Array(6)].map((_, i) => <rect key={i} x={-400} y={20 + i * 40} width={i % 2 ? 600 : 800} height={14} fill="#94A3B8" />)}
      </g>}
      <Labels line={line} f={f} />
    </Cam>
  );
}

// why she survived: the seat row spinning like a rotor, the storm's updraft, the canopy that caught her
function Why({f, len, line}) {
  const p = P(line);
  const ons = p.on || ['seats', 'storm', 'trees'];
  const s = (i) => clamp(pop(f, at(line, ons[i], 0.2 + i * 0.25), 140, 12), 0, 1.1);
  return (
    <g>
      <rect width={W} height={H} fill="#F5EBD7" />
      <text x={W / 2} y={140} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={80} fill={INK}>{p.title || 'WHY DID SHE SURVIVE?'}</text>
      {[0, 1, 2].filter((i) => i < (p.show != null ? p.show : 3)).map((i) => (
        <g key={i} transform={`translate(${330 + i * 630} 560) scale(${s(i)})`}>
          <circle r={230} fill="#fff" {...ST} />
          {i === 0 && <g transform={`rotate(${f * 6}) scale(0.16)`}><SeatBack x={-540} /><SeatBack x={0} /><SeatBack x={540} /></g>}
          {i === 1 && <g>{[-80, 0, 80].map((x) => <path key={x} d={`M ${x} 120 L ${x} -100 M ${x - 30} -70 L ${x} -110 L ${x + 30} -70`} stroke="#38BDF8" strokeWidth={16} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}</g>}
          {i === 2 && <g transform="scale(0.36) translate(0 120)">{[-260, -90, 90, 260].map((x) => <g key={x}><circle cx={x} cy={0} r={120} fill="#22A06B" {...ST} /><circle cx={x - 30} cy={-30} r={60} fill="#34D399" /></g>)}</g>}
          <text x={0} y={310} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={50} fill={INK}>{(p.names || ['A SPINNING ROW OF SEATS', 'THE STORM\'S UPDRAFT', 'THE TREES'])[i]}</text>
        </g>
      ))}
    </g>
  );
}

// Juliane today
function Today({f, len, line}) {
  const p = P(line);
  return (
    <Cam f={f} len={len} from={1} to={1.06}>
      <Rainforest f={f} seed={40} time="day" />
      <g transform="translate(1250 230) scale(0.85)"><Thing name="hut" /></g>
      <g transform="translate(700 380) scale(0.5)"><Figure who="juliane_now" pose={p.pose || 'stand'} expr={p.expr || 'smile'} f={f} talk={p.talk} seed={8} /></g>
      {p.bats && [0, 1, 2].map((k) => <g key={k} transform={`translate(${1100 + k * 220 + Math.sin(f * 0.05 + k) * 60} ${220 + Math.cos(f * 0.07 + k) * 40}) scale(0.4)`}><Thing name="bat" f={f + k * 4} /></g>)}
      {p.book && <g transform={`translate(1500 620) rotate(6) scale(${clamp(pop(f, at(line, p.book_on || 'book', 0.4), 130, 12), 0, 1.05)})`}><Thing name="book" /></g>}
      <Leaves f={f} />
      <Labels line={line} f={f} />
    </Cam>
  );
}

// the end card
function End({f, len, line}) {
  const p = P(line);
  return (
    <g>
      <rect width={W} height={H} fill="#0B1F3A" />
      <Box x={W / 2 - 500} y={180} w={1000} h={150} text={(p.channel || 'PIP DIVES').toUpperCase()} fill="#FFE11A" s={clamp(pop(f, 6, 140, 12), 0, 1)} />
      <text x={W / 2} y={460} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={64} fill="#fff" opacity={clamp((f - 16) / 12, 0, 1)}>{(p.next || 'NEXT: TRAPPED 480 M DOWN WITH 12 MINUTES OF AIR').toUpperCase()}</text>
      <g transform={`translate(${W / 2} 700) scale(${clamp(pop(f, 24, 160, 10), 0, 1.1)})`}><rect x={-280} y={-70} width={560} height={140} rx={70} fill="#E3232C" {...ST} /><text x={0} y={30} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={80} fill="#fff">SUBSCRIBE</text></g>
      <rect width={W} height={H} fill="#000" opacity={lin(f, len - 20, len, 0, 1)} />
    </g>
  );
}

function Injuries({f, len, line}) {
  const p = P(line);
  const marks = p.marks || [['collarbone', 'BROKEN COLLARBONE', -96, 236, -1], ['arm', 'DEEP CUT: RIGHT ARM', -170, 470, -1], ['leg', 'CUT ON HER LEG', 62, 860, 1]];
  const S = 0.72, X = 960, Y = 1000 - 1100 * S;
  return (
    <Cam f={f} len={len} from={1.0} to={1.06}>
      <rect width={W} height={H} fill="#0F2A44" />
      <circle cx={960} cy={560} r={460} fill="#16385A" />
      <g transform={`translate(${X} ${Y}) scale(${S})`}><Figure who="juliane" pose="stand" expr="worried" f={f} dirty={0.8} oneShoe /></g>
      {marks.map(([w, text, mx, my, side], i) => {
        const a = at(line, w, 0.25 + i * 0.25), s = clamp(pop(f, a, 160, 11), 0, 1.15);
        if (s <= 0.01) return null;
        const x = X + mx * S, y = Y + my * S, lx = side < 0 ? 140 : 1260, ly = 200 + i * 230;
        return (<g key={i}>
          <path d={`M ${x} ${y} L ${side < 0 ? lx + 560 : lx} ${ly + 38}`} stroke="#E3232C" strokeWidth={6} strokeDasharray="14 10" opacity={clamp(s, 0, 1)} />
          <g transform={`translate(${x} ${y}) scale(${s})`}><circle r={34} fill="none" stroke="#E3232C" strokeWidth={10} /><path d="M -18 -18 L 18 18 M 18 -18 L -18 18" stroke="#E3232C" strokeWidth={8} strokeLinecap="round" /></g>
          <Label x={lx} y={ly} text={text} f={f} at={a + 3} fill="#E3232C" color="#fff" />
        </g>);
      })}
    </Cam>
  );
}

export const STORY_SHOTS = {injuries: Injuries, jungle: Jungle, wade: Wade, close: Close, count: Count, quote: Quote, map: Map, rule: Rule, item: Item, planes: Planes,
  seats3: Seats3, hut: Hut, canoe: Canoe, hospital: Hospital, search: Search, why: Why, today: Today, end: End};
