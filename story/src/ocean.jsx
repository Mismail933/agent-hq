// Storygraphics #2 (2.53.0): "Trapped 480 m down" (Pisces III, 1973), in the same TIS look (tis.jsx). The sea, the ship, the little
// yellow submarine, the torn hatch, the fall to the seabed and the inside of the cabin. Every scene takes {f, len, line}; line.p holds
// the script's choices (labels on spoken words, faces, depth...).
import React from 'react';
import {W, H, INK, ST, st, clamp, lin, pop, rng, Bust, Head, Box, Plane, Cloud, at, Labels} from './tis';

const P = (line) => line.p || {};
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
export const mix = (a, b, t) => { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * clamp(t, 0, 1)).toString(16).padStart(2, '0')).join(''); };
const wave = (f, y, amp, k) => {
  let d = `M -40 ${H + 40} L -40 ${y}`;
  for (let x = -40; x <= W + 80; x += 40) d += ` L ${x} ${(y + Math.sin(x / 150 + f * 0.05 + k) * amp + Math.sin(x / 61 + f * 0.09 + k * 2) * amp * 0.35).toFixed(1)}`;
  return d + ` L ${W + 80} ${H + 40} Z`;
};
// a camera that zooms on a point: z from a to b between frames f0 and f1
const Zoom = ({f, f0, f1, a, b, x = W / 2, y = H / 2, shake = 0, children}) => {
  const z = lin(f, f0, f1, a, b);
  const sx = shake ? Math.sin(f * 1.9) * shake : 0, sy = shake ? Math.cos(f * 2.3) * shake * 0.7 : 0;
  return <g transform={`translate(${W / 2 + sx} ${H / 2 + sy}) scale(${z}) translate(${-x} ${-y})`}>{children}</g>;
};

// ───────────── the sea from above ─────────────
export const Sea = ({f = 0, y0 = 620, id = 'sea', swell = 1, front = false}) => (
  <g>
    {!front && <><linearGradient id={id + 'sky'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5FA8E8" /><stop offset="1" stopColor="#D6ECFF" /></linearGradient>
      <rect width={W} height={y0 + 60} fill={`url(#${id}sky)`} /></>}
    <path d={wave(f, y0, 16 * swell, 0)} fill="#2B7BB9" {...ST} />
    {!front && <path d={wave(f + 40, y0 + 90, 12 * swell, 1)} fill="#1F6497" />}
    {!front && <path d={wave(f + 80, y0 + 220, 10 * swell, 2)} fill="#174F7A" />}
    {[...Array(9)].map((_, i) => { const x = ((i * 233 + f * 2.2) % (W + 200)) - 100, y = y0 + 40 + (i % 3) * 80;
      return <path key={i} d={`M ${x} ${y} q 30 -12 60 0`} stroke="#E0F2FE" strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.8} />; })}
  </g>
);

// ───────────── under the water: the deeper, the darker ─────────────
export const Deep = ({f = 0, depth = 0, id = 'deep', seed = 4, surface = false}) => {
  const R = rng(seed);
  const top = mix('#2E8FC4', '#08202F', depth), bot = mix('#0F4C75', '#020A10', depth);
  return (
    <g>
      <linearGradient id={id + 'g'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top} /><stop offset="1" stopColor={bot} /></linearGradient>
      <rect width={W} height={H} fill={`url(#${id}g)`} />
      {depth < 0.6 && [...Array(5)].map((_, i) => <path key={'r' + i} d={`M ${180 + i * 390 + Math.sin(f * 0.02 + i) * 30} -20 L ${300 + i * 390} -20 L ${520 + i * 390} ${H} L ${360 + i * 390} ${H} Z`}
        fill="#BFE6FF" opacity={0.14 * (1 - depth / 0.6)} />)}
      {[...Array(40)].map((_, i) => { const x = R() * W, y0 = R() * H, sp = 0.4 + R() * 0.8, r = 2 + R() * 4;
        return <circle key={'s' + i} cx={x + Math.sin(f * 0.03 + i) * 10} cy={((y0 - f * sp) % H + H) % H} r={r} fill="#DCEFFF" opacity={0.25 + 0.2 * depth} />; })}
      {surface && <rect y={-10} width={W} height={60} fill="#7FC4EC" opacity={0.6} />}
    </g>
  );
};

export const Seabed = ({y = 880, f = 0, seed = 8}) => {
  const R = rng(seed);
  return (
    <g>
      <path d={`M -40 ${y + 30} C 300 ${y - 30} 600 ${y + 40} 960 ${y + 10} S 1500 ${y - 20} 1960 ${y + 20} L 1960 ${H + 40} L -40 ${H + 40} Z`} fill="#3D3527" {...ST} />
      <path d={`M -40 ${y + 90} C 400 ${y + 60} 900 ${y + 120} 1960 ${y + 80} L 1960 ${H + 40} L -40 ${H + 40} Z`} fill="#2E281D" />
      {[...Array(9)].map((_, i) => { const x = R() * W, r = 20 + R() * 40; return <ellipse key={i} cx={x} cy={y + 40 + R() * 50} rx={r * 1.6} ry={r * 0.7} fill="#4A4232" {...st(5)} />; })}
    </g>
  );
};

// ───────────── the support ship (bow on the right, the A-frame crane at the stern on the left) ─────────────
export const Ship = ({f = 0, hull = '#1F2A44', funnel = '#E36414'}) => (
  <g transform={`rotate(${Math.sin(f * 0.04) * 1.2})`}>
    <path d="M -620 -10 L 600 -10 L 540 150 L -560 150 Z" fill={hull} {...ST} />
    <rect x={-600} y={-10} width={1190} height={34} fill="#F8FAFC" {...st(5)} />
    <rect x={160} y={-200} width={330} height={190} fill="#F8FAFC" {...ST} />
    <rect x={220} y={-300} width={210} height={100} fill="#F8FAFC" {...ST} />
    {[200, 270, 340, 410].map((x) => <rect key={x} x={x} y={-160} width={44} height={36} rx={6} fill="#1E3A5F" {...st(4)} />)}
    {[250, 320, 390].map((x) => <rect key={x} x={x} y={-276} width={34} height={30} rx={5} fill="#1E3A5F" {...st(4)} />)}
    <rect x={20} y={-250} width={80} height={240} fill={funnel} {...ST} /><rect x={20} y={-250} width={80} height={36} fill={INK} />
    <path d="M 330 -300 L 330 -420 M 300 -380 L 360 -380" fill="none" {...st(8)} />
    <path d="M -560 -10 L -660 -330 M -470 -10 L -660 -330" fill="none" stroke="#E36414" strokeWidth={22} strokeLinecap="round" />
    <path d="M -560 -10 L -660 -330 M -470 -10 L -660 -330" fill="none" {...st(5)} />
    <circle cx={-660} cy={-330} r={20} fill="#E36414" {...ST} />
  </g>
);
export const CRANE_TIP = [-660, -330];

// ───────────── Pisces III, side view (front sphere on the right), about 760 px long at s 1 ─────────────
// cut: the crew sphere shown open with the two men inside; flood 0..1: water in the aft sphere (cutaway); hatch 0..1: the aft hatch torn open
export function Pisces({f = 0, cut = false, flood = 0, hatch = 0, lights = true, faces = ['calm', 'calm'], talk = -1, color = ['#FFD21F', '#E0A800'], name = 'PISCES III'}) {
  const Y = color[0], YS = color[1];
  return (
    <g>
      {lights && <path d="M 400 -70 L 900 -260 L 900 120 Z" fill="#FFF3B0" opacity={0.18} />}
      <path d="M -330 160 L 330 160 M -250 120 L -280 160 M 230 120 L 260 160" fill="none" {...st(12)} />
      <rect x={-420} y={-40} width={70} height={80} rx={16} fill={YS} {...ST} />
      <ellipse cx={-436} cy={0} rx={14} ry={56} fill="#94A3B8" {...st(5)} />
      <rect x={-360} y={-110} width={620} height={230} rx={60} fill={Y} {...ST} />
      <path d="M -350 60 L 250 60 L 250 110 Q 250 120 240 120 L -340 120 Q -350 120 -350 110 Z" fill={YS} />
      <rect x={-50} y={-180} width={110} height={74} rx={14} fill={Y} {...ST} />
      <circle cx={5} cy={-196} r={14} fill="#F87171" {...st(5)} />
      {/* the aft sphere (machinery) and its hatch */}
      <g>
        <clipPath id="aftclip"><circle cx={-220} cy={-10} r={104} /></clipPath>
        <circle cx={-220} cy={-10} r={108} fill={YS} {...ST} />
        {flood > 0 && <g clipPath="url(#aftclip)"><rect x={-330} y={-10 + 108 - 216 * flood} width={220} height={240} fill="#2F80C1" opacity={0.9} />
          <path d={`M -330 ${-10 + 108 - 216 * flood} q 27 -10 55 0 t 55 0 t 55 0 t 55 0`} fill="none" stroke="#E0F2FE" strokeWidth={5} /></g>}
        <rect x={-268} y={-136} width={96} height={20} fill="#9CA3AF" {...st(5)} />
        <g transform={`rotate(${-118 * hatch} -268 -136)`}><rect x={-268} y={-152} width={96} height={18} rx={6} fill="#6B7280" {...st(5)} /></g>
      </g>
      {/* the crew sphere */}
      <circle cx={260} cy={10} r={152} fill="#F3F4F6" {...ST} />
      {cut ? (
        <g>
          <clipPath id="crewclip"><circle cx={260} cy={10} r={132} /></clipPath>
          <g clipPath="url(#crewclip)">
            <rect x={120} y={-130} width={290} height={290} fill="#2A3442" />
            <rect x={150} y={70} width={230} height={60} fill="#475569" {...st(4)} />
            {[175, 215, 255, 295, 335].map((x, i) => <circle key={x} cx={x} cy={96} r={9} fill={['#22C55E', '#F59E0B', '#22C55E', '#EF4444', '#22C55E'][i]} />)}
            <g transform="translate(205 36) scale(0.3)"><Bust who="chapman" x={0} y={0} s={1} expr={faces[0]} f={f} talk={talk === 0} arms="rest" seed={2} /></g>
            <g transform="translate(318 46) scale(0.3)"><Bust who="mallinson" x={0} y={0} s={1} expr={faces[1]} f={f} talk={talk === 1} arms="rest" seed={5} /></g>
          </g>
          <circle cx={260} cy={10} r={132} fill="none" stroke="#9CA3AF" strokeWidth={10} />
        </g>
      ) : (
        <g><circle cx={340} cy={-24} r={30} fill="#1E3A5F" {...st(6)} /><circle cx={312} cy={64} r={20} fill="#1E3A5F" {...st(5)} /><circle cx={332} cy={-32} r={8} fill="#BFE6FF" /></g>
      )}
      <path d="M 380 80 L 470 120 L 520 100" fill="none" stroke="#6B7280" strokeWidth={18} strokeLinecap="round" />
      <path d="M 380 80 L 470 120 L 520 100" fill="none" {...st(5)} />
      <path d="M 520 100 l 30 -22 M 520 100 l 34 10" fill="none" {...st(8)} />
      {lights && <><circle cx={392} cy={-80} r={16} fill="#FFF3B0" {...st(5)} /><circle cx={392} cy={-80} r={34} fill="#FFF3B0" opacity={0.35} /></>}
      <text x={-120} y={44} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={46} fill="#fff" stroke={INK} strokeWidth={7} paintOrder="stroke">{name}</text>
    </g>
  );
}

// a dimension arrow with its number (the sphere's width)
const Span = ({x1, x2, y, text, k = 1}) => (
  <g opacity={k}>
    <path d={`M ${x1} ${y} L ${x2} ${y} M ${x1 + 22} ${y - 16} L ${x1} ${y} L ${x1 + 22} ${y + 16} M ${x2 - 22} ${y - 16} L ${x2} ${y} L ${x2 - 22} ${y + 16}`} fill="none" stroke="#fff" strokeWidth={9} strokeLinecap="round" />
    <path d={`M ${x1} ${y} L ${x2} ${y}`} fill="none" {...st(3)} opacity={0.6} />
  </g>
);

const Bubbles = ({f, x, y, n = 12, seed = 3, spread = 60, op = 0.7}) => {
  const R = rng(seed);
  return <g>{[...Array(n)].map((_, i) => { const dx = (R() - 0.5) * spread, sp = 3 + R() * 4, r = 5 + R() * 9, ph = R() * 120;
    const yy = y - ((f * sp + ph * sp) % 520);
    return <circle key={i} cx={x + dx + Math.sin(f * 0.15 + i) * 8} cy={yy} r={r} fill="none" stroke="#E0F2FE" strokeWidth={3} opacity={op * clamp(1 - (y - yy) / 520, 0, 1)} />; })}</g>;
};

// ───────────── the scenes ─────────────
// 1. the ship on a calm sea, the date and the place
function SeaOpen({f, len, line}) {
  return (
    <g><Zoom f={f} f0={0} f1={len} a={1.0} b={1.06}>
      <Sea f={f} y0={640} id="so" />
      <circle cx={1600} cy={220} r={80} fill="#FFF1B8" /><circle cx={1600} cy={220} r={140} fill="#FFF1B8" opacity={0.3} />
      <Cloud x={380 - f * 0.4} y={200} s={0.9} /><Cloud x={1180 - f * 0.5} y={320} s={0.7} op={0.9} />
      <g transform={`translate(${1060 + f * 0.3} ${640 + Math.sin(f * 0.05) * 6}) scale(0.55)`}><Ship f={f} /></g>
      <Sea f={f} y0={700} id="so2" front />
    </Zoom>
      <Labels line={line} f={f} x0={100} y0={100} /></g>
  );
}

// 2. the steel ball and the two men; then the camera pulls back: it's the cabin of a little submarine
function CabinBall({f, len, line}) {
  const p = P(line);
  const back = at(line, p.back_on || 'cabin', 0.55);
  const sx = 960 + 260 * 0.95, sy = 560 + 10 * 0.95;
  const m = at(line, p.span_on || 'metres', 0.35);
  return (
    <g>
      <Deep f={f} depth={0.55} id="cb" />
      <Seabed y={940} />
      <Zoom f={f} f0={back - 6} f1={back + 34} a={2.3} b={1.0} x={lin(f, back - 6, back + 34, sx, 960)} y={lin(f, back - 6, back + 34, sy, 560)}>
        <g transform={`translate(960 ${560 + Math.sin(f * 0.05) * 5}) scale(0.95)`}><Pisces f={f} cut faces={[p.expr || 'calm', p.expr2 || 'calm']} /></g>
        <g transform={`translate(${sx} ${sy})`}><Span x1={-122} x2={122} y={-160} k={clamp((f - m) / 10, 0, 1) * clamp((back - f) / 8 + 1, 0, 1)} /></g>
      </Zoom>
      <Labels line={line} f={f} x0={100} y0={100} />
    </g>
  );
}

// 3. the ship's crane lifting Pisces III out of the sea
function Hoist({f, len, line}) {
  const y = lin(f, 0, len, 780, 640);
  const tip = [380 + 0.7 * CRANE_TIP[0] * -1, 520 + 0.7 * CRANE_TIP[1]];
  return (
    <g><Zoom f={f} f0={0} f1={len} a={1.0} b={1.05}>
      <Sea f={f} y0={600} id="ho" />
      <g transform={`translate(380 ${520 + Math.sin(f * 0.04) * 5}) scale(-0.7 0.7)`}><Ship f={f} /></g>
      <g transform={`translate(1300 ${y}) rotate(${Math.sin(f * 0.06) * 3}) scale(0.62)`}><Pisces f={f} lights={false} /></g>
      <path d={`M ${tip[0]} ${tip[1]} Q ${(tip[0] + 1303) / 2} ${tip[1] + 60} 1303 ${y - 112}`} fill="none" stroke="#F8FAFC" strokeWidth={7} />
      <path d={`M ${tip[0]} ${tip[1]} Q ${(tip[0] + 1303) / 2} ${tip[1] + 60} 1303 ${y - 112}`} fill="none" {...st(2)} />
      <Sea f={f} y0={690} id="ho2" front swell={1.2} />
    </Zoom>
      <Labels line={line} f={f} x0={1820} y0={100} align="right" /></g>
  );
}

// 4. close on the aft hatch: the towline catches it and rips it open
function Snag({f, len, line}) {
  const p = P(line);
  const r = at(line, p.rip_on || 'rips', 0.6);
  const h = clamp(pop(f, r, 220, 9), 0, 1.15);
  const tug = f >= r ? Math.max(0, 1 - (f - r) / 12) : 0;
  return (
    <g><Zoom f={f} f0={0} f1={len} a={1.0} b={1.04} shake={f >= r && f < r + 14 ? 12 : 0}>
      <Sea f={f} y0={430} id="sn" swell={1.4} />
      <g transform={`translate(1290 ${560 + Math.sin(f * 0.07) * 6}) scale(2.3)`}><Pisces f={f} lights={false} hatch={Math.min(1, h)} /></g>
      {/* the towline: down from the crane, looped round the hatch */}
      <path d={`M ${1800 - tug * 30} -20 C ${1500} ${120 + tug * 40} ${1000} ${170} ${790 + h * 40} ${240 - h * 60}`} fill="none" stroke="#F8FAFC" strokeWidth={14} />
      <path d={`M ${1800 - tug * 30} -20 C ${1500} ${120 + tug * 40} ${1000} ${170} ${790 + h * 40} ${240 - h * 60}`} fill="none" {...st(4)} />
      {f >= r && [...Array(14)].map((_, i) => { const a = (i / 14) * Math.PI - Math.PI, d = (f - r) * (6 + (i % 4) * 3);
        return <circle key={i} cx={780 + Math.cos(a) * d} cy={250 + Math.sin(a) * d * 0.8 + (f - r) * (f - r) * 0.25} r={9 - (i % 3) * 2} fill="#E0F2FE" opacity={clamp(1 - (f - r) / 30, 0, 1)} />; })}
      <Sea f={f} y0={760} id="sn2" front swell={1.4} />
    </Zoom>
      <Labels line={line} f={f} x0={100} y0={100} /></g>
  );
}

// 5. a ton of water pours in, the sub flips over, and drops
function Flood({f, len, line}) {
  const p = P(line);
  const w0 = at(line, p.flood_on || 'floods', 0.15), fl = at(line, p.flip_on || 'flips', 0.5), sk = at(line, p.sink_on || 'sinks', 0.8);
  const water = lin(f, w0, fl, 0.1, 0.95);
  const rot = lin(f, fl, fl + 26, 0, 172);
  const y = 520 + lin(f, sk, len + 10, 0, 900, (t) => t * t);
  return (
    <g>
      <Deep f={f} depth={0.12} id="fl" surface />
      <g transform={`translate(960 ${y}) rotate(${rot + Math.sin(f * 0.3) * (f < fl ? 2 : 0)}) scale(1.05)`}>
        <Pisces f={f} lights={false} hatch={1} flood={water} />
        {f < fl && <path d={`M -220 -136 C -230 -260 -200 -380 -230 -560`} fill="none" stroke="#7FC4EC" strokeWidth={34} strokeLinecap="round" opacity={0.8} />}
      </g>
      <Bubbles f={f} x={960} y={y + 60} n={18} spread={300} seed={7} />
      <Labels line={line} f={f} x0={100} y0={120} />
    </g>
  );
}

// 6. falling upside down into the dark, a depth gauge counting, then the seabed
function Sink({f, len, line}) {
  const p = P(line);
  const hit = at(line, p.hit_on || 'bottom', 0.45);
  const fall = clamp(f / Math.max(1, hit), 0, 1);
  const depth = 0.25 + 0.75 * fall;
  const y = f < hit ? lin(f, 0, hit, -260, 700, (t) => t) : 700;
  const bed = lin(f, Math.max(0, hit - 40), hit, H + 240, 860);
  const metres = Math.round(480 * fall);
  const shake = f >= hit && f < hit + 16 ? 16 : 0;
  return (
    <g><Zoom f={f} f0={0} f1={len} a={1.0} b={1.04} shake={shake}>
      <Deep f={f} depth={depth} id="sk" />
      <Seabed y={bed} />
      <g transform={`translate(${940 + Math.sin(f * 0.05) * 20} ${y}) rotate(${168 + Math.sin(f * 0.11) * 6}) scale(0.8)`}><Pisces f={f} lights={false} hatch={1} flood={1} /></g>
      {f < hit && <Bubbles f={f} x={950} y={y + 40} n={14} spread={200} seed={9} op={0.5} />}
      {f >= hit && [...Array(10)].map((_, i) => { const d = (f - hit) * (5 + i % 4); return <ellipse key={i} cx={940 + (i - 4.5) * d * 0.9} cy={830 - (i % 3) * 30 - d * 0.2} rx={40 + d * 0.8} ry={22 + d * 0.3} fill="#5B5140" opacity={clamp(0.7 - (f - hit) / 60, 0, 0.7)} />; })}
      {/* the depth gauge */}
      <g transform="translate(1740 170)">
        <rect x={0} y={0} width={40} height={620} rx={20} fill="#0B1220" {...ST} />
        <rect x={6} y={6} width={28} height={608 * fall} rx={14} fill="#38BDF8" />
        <g transform={`translate(-260 ${Math.max(0, 608 * fall - 40)})`}>
          <rect x={0} y={0} width={230} height={80} rx={12} fill="#FFE11A" {...ST} />
          <text x={115} y={58} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={54} fill={INK}>{metres} M</text>
        </g>
      </g>
    </Zoom>
      <Labels line={line} f={f} x0={100} y0={100} /></g>
  );
}

// 7. inside the steel ball on the seabed: dark, cold, a torch, the air running out
function Trapped({f, len, line}) {
  const p = P(line);
  const tilt = p.tilt != null ? p.tilt : -14;
  return (
    <g><Zoom f={f} f0={0} f1={len} a={1.0} b={1.08}>
      <rect width={W} height={H} fill="#05090E" />
      <g transform={`translate(960 560) rotate(${tilt})`}>
        <circle r={500} fill="#1C2530" {...st(12)} />
        <clipPath id="trclip"><circle r={480} /></clipPath>
        <g clipPath="url(#trclip)">
          <rect x={-520} y={-520} width={1040} height={1040} fill="#1C2530" />
          {[...Array(10)].map((_, i) => <circle key={i} cx={Math.cos(i * 0.63) * 430} cy={Math.sin(i * 0.63) * 430} r={12} fill="#334155" {...st(3)} />)}
          <g transform="translate(-150 70) scale(0.95)"><Bust who="chapman" x={0} y={0} s={1} expr={p.expr || 'worried'} f={f} arms="rest" seed={2} /></g>
          <g transform="translate(190 90) scale(0.95)"><Bust who="mallinson" x={0} y={0} s={1} expr={p.expr2 || 'scared'} f={f} arms="rest" seed={5} /></g>
          <rect x={-420} y={330} width={840} height={180} rx={18} fill="#334155" {...st(6)} />
          {[-300, -200, -100, 0, 100, 200, 300].map((x, i) => <circle key={x} cx={x} cy={385} r={18} fill={i === 3 ? (Math.floor(f / 15) % 2 ? '#EF4444' : '#7F1D1D') : '#1F2937'} {...st(4)} />)}
          <path d={`M -40 -40 L ${520 + Math.sin(f * 0.04) * 80} -420 L ${600 + Math.sin(f * 0.04) * 80} 40 Z`} fill="#FFF3B0" opacity={0.13} />
        </g>
        <circle r={480} fill="none" stroke="#475569" strokeWidth={22} />
      </g>
      <rect width={W} height={H} fill="#000" opacity={0.18 + 0.06 * Math.sin(f * 0.08)} />
    </Zoom>
      <Labels line={line} f={f} x0={100} y0={100} /></g>
  );
}

// ───────────── the rest of the Pisces III story (2.53.0) ─────────────
const OSW = "'Oswald', sans-serif";
const Txt = ({x, y, text, size = 60, fill = '#fff', anchor = 'middle', stroke = INK}) => (
  <text x={x} y={y} textAnchor={anchor} fontFamily={OSW} fontWeight={700} fontSize={size} fill={fill} stroke={stroke} strokeWidth={size * 0.12} paintOrder="stroke">{text}</text>
);

// objects for close-ups
export const OThing = ({name, f = 0, title = ''}) => {
  switch (name) {
    case 'tank': return (<g>
      <rect x={-90} y={-230} width={180} height={440} rx={80} fill="#16A34A" {...ST} /><rect x={-90} y={-60} width={180} height={70} fill="#F8FAFC" {...st(5)} />
      <rect x={-34} y={-300} width={68} height={80} rx={10} fill="#9CA3AF" {...ST} /><rect x={-70} y={-320} width={140} height={34} rx={12} fill="#6B7280" {...ST} />
      <path d="M 50 -160 C 60 -60 60 60 50 150" fill="none" stroke="#86EFAC" strokeWidth={14} strokeLinecap="round" />
      <Txt x={0} y={-6} text="O2" size={60} fill={INK} stroke="none" /></g>);
    case 'sandwich': return (<g>
      <path d="M -220 120 L 220 120 L 0 -160 Z" fill="#E9C46A" {...ST} /><path d="M -190 90 L 190 90 L 0 -120 Z" fill="#F5DEB3" />
      <path d="M -200 104 L 200 104" stroke="#F59E0B" strokeWidth={22} /><path d="M -180 76 L 180 76" stroke="#7C2D12" strokeWidth={14} />
      <path d="M -220 120 L 220 120 L 0 -160 Z" fill="none" {...ST} /></g>);
    case 'lemonade': return (<g>
      <rect x={-90} y={-170} width={180} height={340} rx={24} fill="#FDE047" {...ST} /><ellipse cx={0} cy={-170} rx={90} ry={22} fill="#D1D5DB" {...st(6)} />
      <rect x={-90} y={-60} width={180} height={110} fill="#65A30D" {...st(5)} /><Txt x={0} y={14} text="LEMONADE" size={34} /></g>);
    case 'phone': return (<g>
      <path d="M -170 -70 C -170 -150 170 -150 170 -70 L 120 -40 C 90 -60 -90 -60 -120 -40 Z" fill="#1F2937" {...ST} />
      <rect x={-200} y={-80} width={90} height={110} rx={30} fill="#1F2937" {...ST} /><rect x={110} y={-80} width={90} height={110} rx={30} fill="#1F2937" {...ST} />
      <path d={`M -150 40 ${[...Array(9)].map((_, i) => `q 16 ${i % 2 ? -26 : 26} 32 0`).join(' ')}`} fill="none" stroke="#1F2937" strokeWidth={10} /></g>);
    case 'weight': return (<g><path d="M -150 120 L 150 120 L 110 -80 L -110 -80 Z" fill="#4B5563" {...ST} /><rect x={-40} y={-130} width={80} height={60} rx={20} fill="none" {...st(14)} />
      <Txt x={0} y={60} text="180 KG" size={64} /></g>);
    case 'book': {
      const rows = String(title).split('|');
      return (<g><rect x={-170} y={-230} width={340} height={460} rx={8} fill="#7F1D1D" {...ST} /><rect x={-170} y={-230} width={40} height={460} fill="#5B1414" />
        {rows.map((r, i) => <Txt key={i} x={20} y={-110 + i * 56} text={r} size={46} fill="#FDE68A" stroke="none" />)}
        <circle cx={20} cy={90} r={60} fill="#FFD21F" {...st(5)} /><Txt x={20} y={196} text="ROGER CHAPMAN" size={30} fill="#fff" stroke="none" /></g>);
    }
    default: return null;
  }
};

// a scuba diver (small, side view)
const Diver = ({f = 0, flip = false}) => (
  <g transform={flip ? 'scale(-1 1)' : ''}>
    <ellipse cx={0} cy={0} rx={120} ry={36} fill="#111827" {...ST} />
    <rect x={-70} y={-62} width={110} height={34} rx={14} fill="#F59E0B" {...st(5)} />
    <circle cx={130} cy={-10} r={34} fill="#111827" {...ST} /><rect x={128} y={-26} width={34} height={24} rx={8} fill="#7DD3FC" {...st(4)} />
    <path d={`M -110 10 L -200 ${30 + Math.sin(f * 0.4) * 24} M -110 -10 L -200 ${-10 - Math.sin(f * 0.4) * 24}`} fill="none" stroke="#111827" strokeWidth={22} strokeLinecap="round" />
    <path d={`M -205 ${30 + Math.sin(f * 0.4) * 24} l -40 10 M -205 ${-10 - Math.sin(f * 0.4) * 24} l -40 -10`} fill="none" stroke="#F59E0B" strokeWidth={16} strokeLinecap="round" />
  </g>
);

// CURV-III, the US Navy's cable-controlled recovery robot: an open frame with floats on top, lights and a claw
const Curv = ({f = 0, lights = true}) => (
  <g>
    {lights && <path d="M 150 40 L 620 -120 L 620 220 Z" fill="#FFF3B0" opacity={0.16} />}
    <rect x={-170} y={-150} width={340} height={70} rx={20} fill="#F97316" {...ST} />
    <path d="M -150 -80 L -150 120 L 150 120 L 150 -80 M -150 20 L 150 20 M -150 -80 L 150 120 M 150 -80 L -150 120" fill="none" stroke="#9CA3AF" strokeWidth={14} />
    <path d="M -150 -80 L -150 120 L 150 120 L 150 -80" fill="none" {...st(4)} />
    <rect x={-210} y={0} width={60} height={60} rx={10} fill="#4B5563" {...ST} /><rect x={150} y={0} width={60} height={60} rx={10} fill="#4B5563" {...ST} />
    <circle cx={160} cy={-40} r={18} fill="#FFF3B0" {...st(5)} />
    <path d="M 60 120 L 90 190 L 130 175 M 90 190 L 70 220" fill="none" {...st(10)} />
    <Txt x={0} y={-104} text="CURV-III" size={40} />
  </g>
);

// THE TITLE CARD AND THE THUMBNAIL: the cabin on the seabed, two terrified men, the air running out
export function PiscesArt({boxes = true, f = 0, top = 'TRAPPED', bottom = '480 M DOWN'}) {
  return (
    <g>
      <Deep f={f} depth={0.82} id="pa" />
      <Seabed y={900} />
      <Bubbles f={f + 40} x={1300} y={700} n={16} spread={500} seed={12} />
      <g transform="translate(1390 600) rotate(-18)">
        <rect x={-900} y={-150} width={660} height={300} rx={80} fill="#FFD21F" {...ST} />
        <path d="M -890 60 L -250 60 L -250 140 L -880 140 Z" fill="#E0A800" />
        <circle cx={-700} cy={-20} r={150} fill="#E0A800" {...ST} />
        <rect x={-760} y={-196} width={120} height={26} fill="#6B7280" {...st(5)} />
        <text x={-560} y={110} textAnchor="middle" fontFamily="'Oswald', sans-serif" fontWeight={700} fontSize={64} fill="#fff" stroke={INK} strokeWidth={8} paintOrder="stroke">PISCES III</text>
        <circle r={392} fill="#F3F4F6" {...ST} />
        <clipPath id="paclip"><circle r={350} /></clipPath>
        <g clipPath="url(#paclip)">
          <rect x={-380} y={-380} width={760} height={760} fill="#1C2530" />
          <path d="M -60 -60 L 420 -360 L 460 80 Z" fill="#FFF3B0" opacity={0.16} />
          <g transform="translate(-130 30) scale(0.78)"><Bust who="chapman" x={0} y={0} s={1} expr="scared" f={0} arms="rest" seed={2} /></g>
          <g transform="translate(150 50) scale(0.78)"><Bust who="mallinson" x={0} y={0} s={1} expr="shock" f={0} arms="rest" seed={5} /></g>
        </g>
        <circle r={350} fill="none" stroke="#9CA3AF" strokeWidth={22} />
      </g>
      <g transform="translate(1680 210) rotate(8)">
        <circle r={150} fill="#E3232C" {...ST} />
        <Txt x={0} y={-10} text="12 MIN" size={92} />
        <Txt x={0} y={66} text="OF AIR" size={54} />
      </g>
      {boxes && <><Box x={60} y={110} w={760} h={190} text={top} rot={-3} />
        <Box x={60} y={320} w={900} h={220} text={bottom} fill="#E3232C" color="#fff" outline rot={-3} /></>}
    </g>
  );
}
function PTitle({f, len, line}) {
  const p = P(line);
  const a = at(line, p.top_on || 'survived', 0.3), b = at(line, p.bottom_on || 'bottom', 0.6);
  const z = lin(f, 0, len, 1.1, 1.0);
  return (
    <g>
      <g transform={`translate(960 540) scale(${z}) translate(-960 -540)`}><PiscesArt boxes={false} f={f} /></g>
      <Box x={60} y={110} w={p.top_w || 760} h={190} text={p.top || 'TRAPPED'} rot={-3} s={clamp(pop(f, a, 160, 12), 0, 1.1)} />
      <Box x={60} y={320} w={p.bottom_w || 900} h={220} text={p.bottom || '480 M DOWN'} fill="#E3232C" color="#fff" outline rot={-3} s={clamp(pop(f, b, 160, 12), 0, 1.1)} />
      <rect width={W} height={H} fill="#000" opacity={lin(f, len - 18, len, 0, 1)} />
    </g>
  );
}

// on the seabed at work: burying the new cable
function CableWork({f, len, line}) {
  const p = P(line);
  const x = lin(f, 0, len, 700, 1100, (t) => t);
  return (
    <g>
      <Deep f={f} depth={p.depth != null ? p.depth : 0.7} id="cw" />
      <Seabed y={860} />
      <path d={`M -40 920 L ${x - 250} 920`} stroke="#3F2F1E" strokeWidth={40} />
      <path d={`M -40 912 L ${x - 260} 912`} stroke={INK} strokeWidth={16} />
      <path d={`M ${x - 260} 912 C ${x - 120} 900 ${x + 300} 880 1960 870`} stroke={INK} strokeWidth={16} fill="none" opacity={0.85} />
      <path d={`M -40 906 L ${x - 260} 906`} stroke="#9CA3AF" strokeWidth={4} />
      <path d={`M ${x - 260} 906 C ${x - 120} 894 ${x + 300} 874 1960 864`} stroke="#9CA3AF" strokeWidth={4} fill="none" />
      {[...Array(10)].map((_, i) => { const d = ((f * 3 + i * 25) % 160); return <circle key={i} cx={x - 260 - d * 0.5 + (i % 3) * 14} cy={880 - d * 0.6} r={10 + d * 0.06} fill="#6B5A3E" opacity={clamp(1 - d / 160, 0, 0.8)} />; })}
      <g transform={`translate(${x} ${740 + Math.sin(f * 0.06) * 4}) scale(0.62)`}><Pisces f={f} lights /></g>
      <Labels line={line} f={f} x0={100} y0={100} />
    </g>
  );
}

// one person, big, in the cabin's light
function Portrait({f, len, line}) {
  const p = P(line);
  const left = p.side === 'left';
  return (
    <g>
      <Zoom f={f} f0={0} f1={len} a={1.0} b={1.06}>
        {p.bg === 'navy' ? <rect width={W} height={H} fill="#0F2A44" /> : <Deep f={f} depth={0.45} id={'po' + (line.idx || 0)} />}
        <circle cx={left ? 560 : 1360} cy={520} r={420} fill="#FFF3B0" opacity={0.08} />
        <g transform={`translate(${left ? 560 : 1360} 470) scale(1.0)`}><Bust who={p.who || 'chapman'} x={0} y={0} s={1} expr={p.expr || 'calm'} f={f} talk={!!p.talk} arms="rest" seed={3} /></g>
      </Zoom>
      <Labels line={line} f={f} x0={left ? 1820 : 100} y0={left ? 150 : 140} align={left ? 'right' : 'left'} />
    </g>
  );
}

// an object close-up (the tank, the sandwich and the lemonade, the telephone, the weight, the book)
function OItem({f, len, line}) {
  const p = P(line);
  const a = at(line, p.on || '', 0.15), b = at(line, p.on2 || '', 0.5);
  const s1 = p.cont ? 1 : clamp(pop(f, a, 130, 11), 0, 1.1), s2 = p.cont ? 1 : clamp(pop(f, b, 130, 11), 0, 1.1);
  const eaten = p.eaten ? clamp((f - len * 0.55) / 30, 0, 1) : 0;   // gone near the end of the line
  return (
    <g>
      <Zoom f={f} f0={0} f1={len} a={1.0} b={1.08}>
        {p.bg === 'cabin' ? <><rect width={W} height={H} fill="#1C2530" /><circle cx={960} cy={540} r={620} fill="#FFF3B0" opacity={0.06} /></> : <rect width={W} height={H} fill={p.color || '#0F2A44'} />}
        <g transform={`translate(${p.thing2 ? 700 : 960} 560) scale(${s1 * (p.s || 1.3) * (1 - eaten * 0.9)}) rotate(-6)`} opacity={1 - eaten}><OThing name={p.thing} f={f} title={p.title} /></g>
        {p.thing2 && <g transform={`translate(1260 560) scale(${s2 * (p.s || 1.3) * (1 - eaten * 0.9)}) rotate(6)`} opacity={1 - eaten}><OThing name={p.thing2} f={f} /></g>}
      </Zoom>
      <Labels line={line} f={f} x0={100} y0={100} />
    </g>
  );
}

// Pisces III where it came to rest: wedged in a gully, half buried, almost upside down
function WreckBed({f, len, line}) {
  const p = P(line);
  const close = !!p.close;
  return (
    <g>
      <Zoom f={f} f0={0} f1={len} a={close ? 1.5 : 1.0} b={close ? 1.62 : 1.08} x={close ? 1040 : W / 2} y={close ? 640 : H / 2}>
        <Deep f={f} depth={0.95} id={'wb' + (line.idx || 0)} />
        <path d="M -40 760 C 400 720 700 860 900 900 C 1100 860 1400 720 1960 760 L 1960 1120 L -40 1120 Z" fill="#3D3527" {...ST} />
        <g transform="translate(960 770) rotate(162) scale(0.9)"><Pisces f={f} lights={Math.floor(f / 9) % 7 !== 0} hatch={1} flood={close ? 1 : 0} /></g>
        <path d="M 600 900 C 800 820 1100 820 1320 900 L 1320 1120 L 600 1120 Z" fill="#2E281D" {...st(6)} />
        <Bubbles f={f} x={760} y={760} n={6} spread={60} seed={4} op={0.4} />
      </Zoom>
      <Labels line={line} f={f} x0={100} y0={100} />
    </g>
  );
}

// the underwater telephone: the cabin on the left, the ship's control room on the right
function Phone({f, len, line}) {
  const p = P(line);
  const a = at(line, p.on || 'telephone', 0.2);
  const k = clamp((f - a) / 12, 0, 1);
  return (
    <g>
      <rect width={W / 2} height={H} fill="#1C2530" />
      <circle cx={430} cy={560} r={520} fill="none" stroke="#475569" strokeWidth={24} />
      <g transform="translate(470 520) scale(0.9)"><Bust who="chapman" x={0} y={0} s={1} expr={p.expr || 'worried'} f={f} talk={f >= a} arms="rest" seed={2} /></g>
      <g transform="translate(330 470) rotate(-30) scale(0.42)"><OThing name="phone" /></g>
      <rect x={W / 2} width={W / 2} height={H} fill="#CBD5E1" />
      <rect x={W / 2} y={720} width={W / 2} height={360} fill="#64748B" {...ST} />
      {[0, 1, 2, 3].map((i) => <circle key={i} cx={W / 2 + 160 + i * 150} cy={800} r={22} fill={['#22C55E', '#F59E0B', '#22C55E', '#EF4444'][i]} {...st(4)} />)}
      <g transform="translate(1440 520) scale(0.9)"><Bust who="pilot" x={0} y={0} s={1} expr={f >= a + 30 ? 'smile' : 'worried'} f={f} arms="rest" seed={6} /></g>
      <path d="M 1370 400 C 1330 360 1330 300 1400 270 M 1510 400 C 1550 360 1550 300 1480 270 M 1400 270 L 1480 270" fill="none" {...st(10)} />
      <rect x={W / 2 - 8} width={16} height={H} fill={INK} />
      {[...Array(6)].map((_, i) => <path key={i} d={`M ${W / 2 - 60} ${300 + i * 60} l 30 -20 l 30 20 l 30 -20`} fill="none" stroke="#FFE11A" strokeWidth={8} opacity={k * (0.5 + 0.5 * Math.sin(f * 0.3 + i))} />)}
      <Labels line={line} f={f} x0={100} y0={100} />
    </g>
  );
}

// the oxygen gauge: how much air is left
function Air({f, len, line}) {
  const p = P(line);
  const a = at(line, p.on || '', 0.2);
  const fr = lin(f, a, a + 40, p.from != null ? p.from : 1, p.to != null ? p.to : 0.9);
  const col = fr > 0.5 ? '#22C55E' : fr > 0.2 ? '#F59E0B' : '#EF4444';
  const R = 300, C = 2 * Math.PI * R;
  return (
    <Zoom f={f} f0={0} f1={len} a={1.0} b={1.05}>
      <rect width={W} height={H} fill="#07111C" />
      <circle cx={960} cy={500} r={R} fill="none" stroke="#1F2937" strokeWidth={70} />
      <circle cx={960} cy={500} r={R} fill="none" stroke={col} strokeWidth={56} strokeDasharray={`${C * fr} ${C}`} transform="rotate(-90 960 500)" strokeLinecap="round" />
      <circle cx={960} cy={500} r={R - 70} fill="#0B1220" {...st(6)} />
      <Txt x={960} y={500} text="O2" size={110} fill="#E5E7EB" />
      {p.value && <Txt x={960} y={590} text={String(p.value).toUpperCase()} size={50} fill={col} />}
      <Txt x={960} y={930} text={String(p.label || 'OXYGEN LEFT').toUpperCase()} size={70} fill="#fff" />
    </Zoom>
  );
}

// the rescue gathers on the surface: ships, and a plane overhead
const FLEET = {voyager: {x: 440, s: 0.55, hull: '#1F2A44', funnel: '#E36414', label: 'THE MOTHER SHIP'},
  hecate: {x: 1400, s: 0.5, hull: '#6B7280', funnel: '#4B5563', label: 'HMS HECATE'},
  cabot: {x: 1580, s: 0.5, hull: '#B91C1C', funnel: '#E5E7EB', label: 'JOHN CABOT'}};
function Fleet({f, len, line}) {
  const p = P(line);
  const items = p.items || [];
  return (
    <g>
      <Zoom f={f} f0={0} f1={len} a={1.0} b={1.05}>
        <Sea f={f} y0={640} id={'fe' + (line.idx || 0)} />
        <Cloud x={300 - f * 0.4} y={180} s={0.8} /><Cloud x={1300 - f * 0.5} y={260} s={0.6} />
        {items.map((it, i) => {
          const k = FLEET[it.name];
          const s = it.cont ? 1 : clamp(pop(f, at(line, it.on || '', 0.2 + i * 0.2), 120, 12), 0, 1);
          if (it.name === 'nimrod') return <g key={i} transform={`translate(${lin(f, 0, len, 200, 1500, (t) => t)} ${170 + Math.sin(f * 0.05) * 10}) scale(${0.32 * s})`}><Plane f={f} /></g>;
          if (!k) return null;
          return <g key={i} transform={`translate(${k.x} ${640 + Math.sin(f * 0.05 + i) * 6}) scale(${k.s * s})`}><Ship f={f + i * 20} hull={k.hull} funnel={k.funnel} /></g>;
        })}
        <Sea f={f} y0={720} id={'fe2' + (line.idx || 0)} front />
      </Zoom>
      <Labels line={line} f={f} x0={100} y0={100} />
    </g>
  );
}

// the liner Queen Elizabeth 2 sends a message
function Liner({f, len, line}) {
  const p = P(line);
  const a = at(line, p.on || 'message', 0.3);
  const s = clamp(pop(f, a, 140, 12), 0, 1.05);
  return (
    <g>
      <Zoom f={f} f0={0} f1={len} a={1.0} b={1.05}>
        <Sea f={f} y0={660} id="li" />
        <g transform={`translate(${lin(f, 0, len, 1100, 900, (t) => t)} 650) scale(0.9)`}>
          <path d="M -760 -20 L 700 -20 L 620 140 L -700 140 Z" fill="#111827" {...ST} />
          <rect x={-640} y={-110} width={1180} height={90} fill="#F8FAFC" {...ST} />
          <rect x={-520} y={-190} width={900} height={80} fill="#F8FAFC" {...ST} />
          {[...Array(16)].map((_, i) => <rect key={i} x={-610 + i * 72} y={-82} width={40} height={30} rx={5} fill="#1E3A5F" />)}
          <path d="M -40 -190 L -10 -330 L 110 -330 L 130 -190 Z" fill="#E3232C" {...ST} /><rect x={-14} y={-330} width={126} height={40} fill={INK} />
        </g>
        <Sea f={f} y0={740} id="li2" front />
      </Zoom>
      <g transform={`translate(1140 300) scale(${s})`}>
        <rect x={-260} y={-130} width={520} height={260} rx={18} fill="#fff" {...ST} />
        <path d="M -260 -130 L 0 40 L 260 -130" fill="none" {...st(8)} />
      </g>
      <Labels line={line} f={f} x0={100} y0={100} />
    </g>
  );
}

// a rescue submarine in the dark: rope breaks / can't find them / finds them / the hook slips / a leak / ordered up / hooked
function RescueSub({f, len, line}) {
  const p = P(line);
  const mode = p.mode || 'found';
  const col = p.color === 'white' ? ['#E5E7EB', '#9CA3AF'] : ['#F97316', '#C2410C'];
  const a = at(line, p.on || '', 0.5);
  const far = mode === 'lost';
  const up = mode === 'leave' || mode === 'rope' || mode === 'leak' ? lin(f, a, len + 20, 0, -700) : 0;
  const x = far ? 520 + Math.sin(f * 0.02) * 120 : lin(f, 0, Math.min(len, 90), 300, mode === 'hook' ? 980 : mode === 'found' || mode === 'slip' ? 880 : 760);
  const y = 520 + up + Math.sin(f * 0.05) * 6;
  const beam = mode === 'lost' ? Math.sin(f * 0.06) * 30 : 0;
  const hooked = mode === 'hook' && f >= a;
  return (
    <g>
      <Zoom f={f} f0={0} f1={len} a={1.0} b={1.05}>
        <Deep f={f} depth={0.95} id={'rs' + (line.idx || 0)} />
        <path d="M -40 760 C 400 720 700 860 900 900 C 1100 860 1400 720 1960 760 L 1960 1120 L -40 1120 Z" fill="#3D3527" {...ST} />
        <g transform={`translate(${far ? 1700 : 1350} 790) rotate(162) scale(0.62)`}><Pisces f={f} lights={false} hatch={1} flood={1} /></g>
        <path d="M 1050 900 C 1200 840 1450 840 1640 900 L 1640 1120 L 1050 1120 Z" fill="#2E281D" {...st(6)} />
        <g transform={`translate(${x} ${y}) rotate(${beam * 0.2}) scale(0.5)`}><Pisces f={f} color={col} name={p.name || 'PISCES V'} lights /></g>
        {mode === 'rope' && (f < a ? <path d={`M ${x + 260} ${y + 50} Q ${x + 360} ${y + 160} ${x + 300} ${y + 260}`} fill="none" stroke="#F8FAFC" strokeWidth={8} />
          : <path d={`M ${x + 260} ${y + 50} Q ${x + 300} ${y + 160} ${x + 230} ${y + 220 + (f - a) * 3}`} fill="none" stroke="#F8FAFC" strokeWidth={8} opacity={clamp(1 - (f - a) / 40, 0, 1)} />)}
        {mode === 'slip' && <path d={`M ${x + 260} ${y + 50} C ${x + 400} ${y + 100} 1150 ${f < a ? 700 : 640 - (f - a) * 4} ${f < a ? 1200 : 1180} ${f < a ? 700 : 600 - (f - a) * 5}`} fill="none" stroke="#FDE047" strokeWidth={8} />}
        {hooked && <path d={`M 1240 690 C 1240 500 1260 300 1250 -20`} fill="none" stroke="#FDE047" strokeWidth={10} />}
        {mode === 'leak' && f >= a && <Bubbles f={f} x={x + 40} y={y + 20} n={20} spread={120} seed={13} />}
        {mode === 'found' && f >= a && <circle cx={1350} cy={780} r={lin(f, a, a + 20, 0, 260)} fill="#FFF3B0" opacity={clamp(0.35 - (f - a) / 80, 0, 0.35)} />}
      </Zoom>
      <Labels line={line} f={f} x0={100} y0={100} />
    </g>
  );
}

// CURV-III: a fault on deck, or down at the wreck attaching the second line
function CurvShot({f, len, line}) {
  const p = P(line);
  const a = at(line, p.on || '', 0.5);
  if (p.mode === 'fault') {
    const s = clamp(pop(f, a, 160, 10), 0, 1.1);
    return (
      <g>
        <Zoom f={f} f0={0} f1={len} a={1.0} b={1.05}>
          <rect width={W} height={H} fill="#94A3B8" /><rect y={760} width={W} height={320} fill="#475569" {...ST} />
          <g transform="translate(960 600) scale(1.1)"><Curv f={f} lights={false} /></g>
          {f >= a && [...Array(10)].map((_, i) => { const ang = i * 0.63 + f * 0.2; return <path key={i} d={`M ${1060} ${520} l ${Math.cos(ang) * 70} ${Math.sin(ang) * 70}`} stroke="#FDE047" strokeWidth={8} strokeLinecap="round" opacity={(f + i) % 4 < 2 ? 1 : 0.2} />; })}
          <g transform={`translate(1400 300) scale(${s})`}><path d="M -110 -110 L 110 110 M 110 -110 L -110 110" stroke="#E3232C" strokeWidth={46} strokeLinecap="round" /></g>
        </Zoom>
        <Labels line={line} f={f} x0={100} y0={100} />
      </g>
    );
  }
  const y = lin(f, 0, Math.min(len, 80), 200, 560);
  const hooked = f >= a;
  return (
    <g>
      <Zoom f={f} f0={0} f1={len} a={1.0} b={1.05}>
        <Deep f={f} depth={0.95} id={'cv' + (line.idx || 0)} />
        <path d="M -40 760 C 400 720 700 860 900 900 C 1100 860 1400 720 1960 760 L 1960 1120 L -40 1120 Z" fill="#3D3527" {...ST} />
        <g transform="translate(1350 790) rotate(162) scale(0.62)"><Pisces f={f} lights={false} hatch={1} flood={1} /></g>
        <path d="M 1240 690 C 1240 500 1260 300 1250 -20" fill="none" stroke="#FDE047" strokeWidth={10} />
        <path d={`M 820 ${y - 150} L 820 -20`} fill="none" stroke="#111827" strokeWidth={12} />
        <g transform={`translate(820 ${y}) scale(0.7)`}><Curv f={f} /></g>
        {hooked && <path d={`M 1300 700 C 1300 500 1330 300 1320 -20`} fill="none" stroke="#FDE047" strokeWidth={10} />}
      </Zoom>
      <Labels line={line} f={f} x0={100} y0={100} />
    </g>
  );
}

// the lift: up through the water on the lines, jolts, a stop, divers near the top
function Lift({f, len, line}) {
  const p = P(line);
  const m0 = p.from != null ? p.from : 480, m1 = p.to != null ? p.to : 300;
  const metres = Math.round(lin(f, 0, len, m0, m1, (t) => t));
  const depth = clamp(metres / 480, 0, 1);
  const j = at(line, p.jolt_on || '', 0.4);
  const shake = p.jolt && f >= j && f < j + 30 ? 14 : 0;
  const swing = p.jolt ? Math.sin(f * 0.25) * 10 * clamp(1 - (f - j) / 60, 0, 1) * (f >= j ? 1 : 0) : 0;
  return (
    <g>
      <Zoom f={f} f0={0} f1={len} a={1.0} b={1.04} shake={shake}>
        <Deep f={f} depth={depth} id={'lf' + (line.idx || 0)} surface={metres < 40} />
        <path d="M 930 -20 L 950 330 M 1010 -20 L 990 330" fill="none" stroke="#FDE047" strokeWidth={10} />
        <g transform={`translate(960 ${560 + Math.sin(f * 0.05) * 8}) rotate(${110 + swing}) scale(0.72)`}><Pisces f={f} lights={false} hatch={1} flood={1} /></g>
        {p.divers && [0, 1].map((k) => <g key={k} transform={`translate(${k ? 1360 - Math.sin(f * 0.03) * 30 : 560 + Math.sin(f * 0.03) * 30} ${360 + k * 160}) scale(0.7)`}><Diver f={f + k * 9} flip={!!k} /></g>)}
        <Bubbles f={f} x={960} y={700} n={10} spread={300} seed={21} op={0.4} />
        <g transform="translate(1740 170)">
          <rect x={0} y={0} width={40} height={620} rx={20} fill="#0B1220" {...ST} />
          <rect x={6} y={6} width={28} height={608 * depth} rx={14} fill="#38BDF8" />
          <g transform={`translate(-260 ${Math.max(0, 608 * depth - 40)})`}>
            <rect x={0} y={0} width={230} height={80} rx={12} fill="#FFE11A" {...ST} />
            <Txt x={115} y={58} text={`${metres} M`} size={54} fill={INK} stroke="none" />
          </g>
        </g>
      </Zoom>
      <Labels line={line} f={f} x0={100} y0={100} />
    </g>
  );
}

// at the surface: the jammed hatch, then fresh air and daylight
function SurfaceHatch({f, len, line}) {
  const p = P(line);
  const a = at(line, p.on || 'open', 0.5);
  const open = p.mode === 'open' ? clamp(pop(f, a, 120, 14), 0, 1) : p.mode === 'jam' ? Math.abs(Math.sin(f * 0.5)) * 0.04 : 0;
  const out = p.mode === 'open' ? clamp((f - a - 10) / 30, 0, 1) : 0;
  return (
    <g>
      <Zoom f={f} f0={0} f1={len} a={1.0} b={1.06}>
        <Sea f={f} y0={620} id={'sh' + (line.idx || 0)} />
        <g transform={`translate(300 600) scale(-0.5 0.5)`}><Ship f={f} hull="#B91C1C" funnel="#E5E7EB" /></g>
        <g transform={`translate(1080 ${640 + Math.sin(f * 0.06) * 8}) scale(1.0)`}>
          <Pisces f={f} lights={false} hatch={1} flood={1} />
          <g transform={`translate(5 -180)`}>
            <g transform={`rotate(${-120 * open} -55 0)`}><rect x={-55} y={-18} width={110} height={18} rx={6} fill="#6B7280" {...st(5)} /></g>
            {out > 0 && <g transform={`translate(-20 ${-40 * out}) scale(0.28)`}><Head who="chapman" expr={p.expr || 'waking'} f={f} /></g>}
            {out > 0 && <g transform={`translate(50 ${-34 * out}) scale(0.26)`}><Head who="mallinson" expr={p.expr2 || 'smile'} f={f} /></g>}
          </g>
          {p.mode === 'jam' && [0, 1].map((k) => <g key={k} transform={`translate(${-160 + k * 330} -140) scale(0.5)`}><Diver f={f + k * 7} flip={!!k} /></g>)}
        </g>
        <Sea f={f} y0={720} id={'sh2' + (line.idx || 0)} front />
        {p.mode === 'open' && <rect width={W} height={H} fill="#FFF7CC" opacity={clamp(0.5 - (f - a) / 40, 0, 0.5) * (f >= a ? 1 : 0)} />}
      </Zoom>
      <Labels line={line} f={f} x0={100} y0={100} />
    </g>
  );
}

// three reasons, one by one
const Flag = ({kind}) => {
  if (kind === 'uk') return (<g><rect x={-90} y={-60} width={180} height={120} fill="#1E3A8A" {...st(5)} /><path d="M -90 -60 L 90 60 M 90 -60 L -90 60" stroke="#fff" strokeWidth={22} /><path d="M -90 -60 L 90 60 M 90 -60 L -90 60" stroke="#DC2626" strokeWidth={8} /><path d="M 0 -60 L 0 60 M -90 0 L 90 0" stroke="#fff" strokeWidth={34} /><path d="M 0 -60 L 0 60 M -90 0 L 90 0" stroke="#DC2626" strokeWidth={18} /><rect x={-90} y={-60} width={180} height={120} fill="none" {...st(5)} /></g>);
  if (kind === 'ca') return (<g><rect x={-90} y={-60} width={180} height={120} fill="#fff" {...st(5)} /><rect x={-90} y={-60} width={45} height={120} fill="#DC2626" /><rect x={45} y={-60} width={45} height={120} fill="#DC2626" /><path d="M 0 -36 L 14 -10 L 34 -16 L 22 10 L 30 22 L 6 18 L 4 40 L -4 40 L -6 18 L -30 22 L -22 10 L -34 -16 L -14 -10 Z" fill="#DC2626" /><rect x={-90} y={-60} width={180} height={120} fill="none" {...st(5)} /></g>);
  return (<g><rect x={-90} y={-60} width={180} height={120} fill="#fff" {...st(5)} />{[0, 2, 4, 6].map((i) => <rect key={i} x={-90} y={-60 + i * 17.1} width={180} height={17.1} fill="#DC2626" />)}<rect x={-90} y={-60} width={80} height={60} fill="#1E3A8A" /><rect x={-90} y={-60} width={180} height={120} fill="none" {...st(5)} /></g>);
};
function Why3({f, len, line}) {
  const p = P(line);
  const ons = p.on || ['', '', ''];
  const s = (i) => clamp(pop(f, at(line, ons[i], 0.2 + i * 0.25), 140, 12), 0, 1.1);
  const names = p.names || ['A FRESH OXYGEN TANK', 'DOING ALMOST NOTHING', 'RESCUERS FROM 3 COUNTRIES'];
  return (
    <g>
      <rect width={W} height={H} fill="#F5EBD7" />
      <Txt x={W / 2} y={140} text={p.title || 'HOW DID THEY SURVIVE?'} size={80} fill={INK} stroke="none" />
      {[0, 1, 2].filter((i) => i < (p.show != null ? p.show : 3)).map((i) => (
        <g key={i} transform={`translate(${330 + i * 630} 560) scale(${s(i)})`}>
          <circle r={230} fill="#fff" {...ST} />
          {i === 0 && <g transform="scale(0.62)"><OThing name="tank" /></g>}
          {i === 1 && <g transform="translate(0 -20) scale(0.62)"><Head who="mallinson" expr="closed" f={f} /></g>}
          {i === 2 && <g><g transform="translate(-95 -60) scale(0.9)"><Flag kind="uk" /></g><g transform="translate(95 -60) scale(0.9)"><Flag kind="ca" /></g><g transform="translate(0 80) scale(0.9)"><Flag kind="us" /></g></g>}
          <Txt x={0} y={310} text={names[i]} size={48} fill={INK} stroke="none" />
        </g>
      ))}
    </g>
  );
}

export const OCEAN_SHOTS = {sea_open: SeaOpen, cabin_ball: CabinBall, hoist: Hoist, snag: Snag, flood: Flood, sink: Sink, trapped: Trapped,
  p_title: PTitle, cable_work: CableWork, portrait: Portrait, o_item: OItem, wreck_bed: WreckBed, phone: Phone, air: Air, fleet: Fleet, liner: Liner,
  rescue_sub: RescueSub, curv: CurvShot, lift: Lift, surface_hatch: SurfaceHatch, why3: Why3};
