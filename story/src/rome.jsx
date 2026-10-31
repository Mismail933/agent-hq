// A test scene at the level the owner pointed at (2026-10-31: Squire Explains, flat vector history: "give me a test scene at this level").
// Studied, not copied: our own cast and script. What makes that level: huge round heads with big simple faces, long tube limbs with
// visible joints, thick dark outlines, chunky detailed kit, ranks in true depth (sharp foreground, blurred ranks behind), grass, pebbles
// and contact shadows on the ground, a warm dusty palette, second-person narration, and a joke on the turn.
// Composition "RomeTest" (story_sample spec "composition"): one shot per line, hard cuts, every move eased, nothing still.
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {at, clamp} from './tis';
import {FONT_CSS} from './fonts';

const W = 1920, H = 1080;
export const INK = '#2B221C', SKIN = '#FBF7EE', SHADE = '#E7DFCE';
const BRONZE = '#C2983F', BRONZE_D = '#8F6C2C', BRONZE_L = '#E2C271';
const NUN = "'Nunito', 'Arial Rounded MT Bold', sans-serif", OSW = "'Oswald', sans-serif";
export const lin = (f, a, b, x, y) => x + (y - x) * clamp((f - a) / Math.max(1, b - a), 0, 1);
const io = (t) => { const k = clamp(t, 0, 1); return k * k * (3 - 2 * k); };
export const eas = (f, a, b, x, y) => x + (y - x) * io((f - a) / Math.max(1, b - a));
export const spr = (x, w = 15, z = 0.72) => { if (x <= 0) return 0; const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x)); };
export const pop = (f, a, w = 15, z = 0.62) => clamp(spr((f - a) / 30, w, z), 0, 1.2);
const rngOf = (seed) => { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
export const st = (w = 7) => ({stroke: INK, strokeWidth: w, strokeLinejoin: 'round', strokeLinecap: 'round'});
const rad = (d) => d * Math.PI / 180;

const LEGION = {tunic: '#B5452F', tunicD: '#8F3322', skin: SKIN};
const SAMNITE = {tunic: '#3E6E8E', tunicD: '#2C5169', skin: '#F4EBDA'};
const BLINKS = (f, seed) => { const p = 90 + (seed * 37) % 70, k = (f + seed * 23) % p; return k < 4; };

// a tube limb with its outline: shoulder/hip, joint, end
export const Limb = ({pts, w = 30, fill = SKIN}) => {
  const d = pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return (<g fill="none" strokeLinecap="round" strokeLinejoin="round"><path d={d} stroke={INK} strokeWidth={w + 13} /><path d={d} stroke={fill} strokeWidth={w} /></g>);
};
export const arm = (sx, sy, a1, a2, l1 = 92, l2 = 92) => {
  const ex = sx + Math.sin(rad(a1)) * l1, ey = sy + Math.cos(rad(a1)) * l1;
  return [[sx, sy], [ex, ey], [ex + Math.sin(rad(a2)) * l2, ey + Math.cos(rad(a2)) * l2]];
};
// the pilum: ash shaft, a long thin iron neck, a small barbed head (points at -y)
export const Pilum = ({len = 470}) => (
  <g>
    <path d={`M 0 0 L 0 ${-len * 0.62}`} stroke={INK} strokeWidth={15} strokeLinecap="round" /><path d={`M 0 0 L 0 ${-len * 0.62}`} stroke="#A97C4B" strokeWidth={8} strokeLinecap="round" />
    <path d={`M 0 ${-len * 0.6} L 0 ${-len}`} stroke={INK} strokeWidth={9} /><path d={`M 0 ${-len * 0.6} L 0 ${-len}`} stroke="#AEB6BC" strokeWidth={4} />
    <rect x={-8} y={-len * 0.64} width={16} height={26} rx={3} fill={BRONZE_D} {...st(4)} />
    <path d={`M -9 ${-len + 2} L 0 ${-len - 28} L 9 ${-len + 2} Z`} fill="#D5DBDF" {...st(4)} />
  </g>
);
const Scutum = ({kind = 'roman', k = 1}) => kind === 'roman' ? (
  <g>
    <ellipse rx={86 * k} ry={142} fill="#A62E22" {...st(8)} />
    <ellipse rx={72 * k} ry={127} fill="none" stroke={BRONZE_L} strokeWidth={5} />
    <path d={`M ${-8 * k} -125 L ${8 * k} -125 L ${8 * k} 125 L ${-8 * k} 125 Z`} fill={BRONZE} stroke={INK} strokeWidth={4} />
    {[-1, 1].map((d) => <g key={d} transform={`scale(${d * k} 1)`}><path d="M 18 -18 C 44 -46 58 -66 60 -92 C 44 -82 34 -76 18 -62 Z M 18 18 C 44 46 58 66 60 92 C 44 82 34 76 18 62 Z" fill="#E8C45F" stroke={INK} strokeWidth={3.5} /></g>)}
    <ellipse rx={30 * k} ry={32} fill={BRONZE} {...st(6)} /><ellipse cx={-8 * k} cy={-9} rx={9 * k} ry={8} fill={BRONZE_L} />
  </g>
) : (
  <g>
    <path d={`M 0 -142 L ${76 * k} -88 L ${76 * k} 88 L 0 142 L ${-76 * k} 88 L ${-76 * k} -88 Z`} fill="#D9C48F" {...st(8)} />
    <path d={`M 0 -112 L ${54 * k} -72 L ${54 * k} 72 L 0 112 L ${-54 * k} 72 L ${-54 * k} -72 Z`} fill="#4E7A53" stroke={INK} strokeWidth={4} />
    <circle r={24} fill={BRONZE} {...st(5)} />
  </g>
);
// faces: dx slides the features across the head for a 3/4 look; each expression is only brows, eyes and a mouth
export const Face = ({expr = 'calm', blink = false, look = 0, lookY = 0, dx = 14}) => {
  const big = expr === 'scared' || expr === 'nervous' || expr === 'stunned' || expr === 'hopeful';
  const rr = expr === 'scared' ? 27 : expr === 'stunned' ? 25 : 21;
  const brow = {calm: [-4, -4], nervous: [-16, 16], scared: [-20, 20], stare: [17, -17], shout: [17, -17], deadpan: [0, 0], side: [0, 3], stunned: [-14, 14], smug: [2, -10], wink: [8, -12], hopeful: [-10, 10]}[expr] || [0, 0];
  const by = big ? -44 : -30;
  return (
    <g transform={`translate(${dx} 0)`}>
      {[-1, 1].map((d, i) => (
        <g key={d} transform={`translate(${d * 44} 0)`}>
          {blink || (expr === 'wink' && i === 0) ? <path d="M -16 2 Q 0 8 16 2" fill="none" {...st(6)} />
            : big ? <g><circle r={rr} fill="#fff" {...st(5)} /><circle cx={look * 8} cy={lookY * 8} r={9.5} fill={INK} /></g>
            : <g><circle cx={look * 9} cy={lookY * 7} r={10.5} fill={INK} />{(expr === 'deadpan' || expr === 'stare' || expr === 'smug') && <path d="M -19 -6 L 19 -6" {...st(6)} />}</g>}
          <path d={`M -24 ${by - brow[i]} L 24 ${by + brow[i]}`} fill="none" {...st(7)} />
        </g>
      ))}
      {expr === 'calm' && <path d="M -18 56 Q 2 66 22 52" fill="none" {...st(6)} />}
      {(expr === 'smug' || expr === 'wink') && <path d="M -18 58 Q 10 72 34 46" fill="none" {...st(6)} />}
      {expr === 'hopeful' && <path d="M -24 50 Q 2 78 28 50" fill="#4A1F20" {...st(6)} />}
      {expr === 'nervous' && <path d="M -26 60 q 9 -10 18 0 t 18 0 t 18 0" fill="none" {...st(6)} />}
      {expr === 'stunned' && <ellipse cx={0} cy={60} rx={11} ry={13} fill={INK} />}
      {expr === 'scared' && <g><ellipse cx={0} cy={62} rx={25} ry={30} fill="#4A1F20" {...st(6)} /><ellipse cx={0} cy={80} rx={13} ry={9} fill="#E98C94" /></g>}
      {expr === 'shout' && <g><path d="M -36 44 L 36 44 L 22 88 L -22 88 Z" fill="#4A1F20" {...st(6)} /><path d="M -30 48 L 30 48 L 27 58 L -27 58 Z" fill="#fff" /></g>}
      {(expr === 'deadpan' || expr === 'side' || expr === 'stare') && <path d="M -18 58 L 22 58" {...st(6)} />}
    </g>
  );
};
const Feather = ({a, c, T, seed}) => (
  <g transform={`rotate(${a + Math.sin(T * 0.09 + seed) * 2.5})`}><path d="M 0 0 C -22 -46 -20 -108 0 -158 C 20 -108 22 -46 0 0 Z" fill={c} {...st(6)} /><path d="M 0 -8 L 0 -146" stroke="#ffffff55" strokeWidth={3} /></g>
);
const Helmet = ({kind = 'roman', T = 0, seed = 0}) => (
  <g>
    {kind === 'centurion' && <g transform={`translate(0 -116) rotate(${Math.sin(T * 0.07) * 1})`}>
      <path d="M -170 22 C -150 -116 150 -116 170 22 C 104 -6 -104 -6 -170 22 Z" fill="#C8301F" {...st(7)} />
      {[...Array(13)].map((_, i) => { const t = (i - 6) / 6; return <path key={i} d={`M ${t * 118} ${-8 + t * t * 14} L ${t * 148} ${-62 + t * t * 56}`} stroke="#8E1F13" strokeWidth={4} />; })}</g>}
    {kind === 'roman' && <g transform="translate(0 -128)">{[-17, 2, 21].map((a, i) => <Feather key={i} a={a} c={i === 1 ? '#2E2438' : '#54345F'} T={T} seed={seed + i} />)}</g>}
    {/* neck guard, dome, rim, knob */}
    <path d="M -116 -24 C -148 -14 -172 6 -180 26 C -146 26 -120 22 -100 6 Z" fill={BRONZE_D} {...st(6)} />
    {kind === 'cone'
      ? <path d="M -128 -18 C -120 -92 -48 -160 0 -178 C 48 -160 120 -92 128 -18 Z" fill="#7F8B8E" {...st(8)} />
      : <path d="M -130 -14 C -132 -148 132 -148 130 -14 Z" fill={BRONZE} {...st(8)} />}
    {kind !== 'cone' && <path d="M -92 -42 C -86 -92 -44 -112 -6 -116 C -40 -96 -62 -76 -68 -44 Z" fill={BRONZE_L} opacity={0.75} />}
    <rect x={-138} y={-26} width={276} height={28} rx={12} fill={kind === 'cone' ? '#5F6B6E' : BRONZE_D} {...st(7)} />
    {kind !== 'cone' && <g><rect x={-13} y={-142} width={26} height={22} rx={5} fill={BRONZE_D} {...st(5)} /><circle cy={-146} r={13} fill={BRONZE} {...st(5)} /></g>}
    {/* the near cheek piece */}
    <g transform="translate(-122 2)"><path d="M -24 -8 L 26 -8 L 30 84 C 18 110 -6 116 -22 98 Z" fill={kind === 'cone' ? '#7F8B8E' : BRONZE} {...st(6)} />
      {kind !== 'cone' && [[0, 16], [2, 44], [-2, 72]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4.5} fill={BRONZE_D} />)}</g>
  </g>
);
/**
 * One soldier, feet at y 0, about 700 units tall. armR = [upper, fore] degrees from straight down (+ towards the facing side), shield
 * and spear optional; `hold` = the spear's angle in the hand (0 upright), null = no spear (thrown).
 */
export const Soldier = ({x = 0, y = 0, s = 1, flip = false, pal = LEGION, helmet = 'roman', expr = 'calm', look = 0, lookY = 0, armR = [24, -8], hold = 0, shield = 'roman', T = 0, seed = 1,
  tilt = 0, lean = 0, sweat = 0, beard = false, cloak = false, stick = false, plate = true, shadow = true, bob = 0.5, armL = null, open = 0}) => {
  const b = Math.sin(T * 0.08 + seed * 1.7) * 3.5 * bob;
  const sh = [84, -332 + b], hand = arm(sh[0], sh[1], armR[0], armR[1]);
  const end = hand[2];
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      {shadow && <ellipse cx={0} cy={4} rx={176} ry={23} fill="#3B2E18" opacity={0.28} />}
      <g transform={`rotate(${lean})`}>
        {cloak && <path d={`M -82 ${-352 + b} C -160 -260 -176 -120 -164 -36 L 84 -36 L 66 ${-352 + b} Z`} fill="#9E2A1D" {...st(7)} />}
        {/* the legs: straight tubes, sandals with a strap */}
        {[-1, 1].map((d) => <g key={d}><Limb pts={[[d * 38, -152], [d * 42, -26]]} w={30} fill={pal.skin} />
          <path d={`M ${d * 42 - 24} -4 C ${d * 42 - 26} -24 ${d * 42 + 22} -26 ${d * 42 + 40} -4 Z`} fill="#6A4A2E" {...st(6)} /><path d={`M ${d * 42 - 16} -36 L ${d * 42 + 16} -36`} stroke="#6A4A2E" strokeWidth={6} /></g>)}
        {/* the arm behind, the tunic, belt, chest plate */}
        <g transform={`translate(0 ${b})`}>
          <path d="M -80 -350 C -96 -300 -104 -210 -112 -132 L -82 -146 L -54 -128 L -26 -146 L 0 -128 L 26 -146 L 54 -128 L 82 -146 L 112 -132 C 104 -210 96 -300 80 -350 C 40 -370 -40 -370 -80 -350 Z" fill={pal.tunic} {...st(7)} />
          <path d="M 44 -358 C 74 -300 88 -220 92 -140 L 112 -132 C 104 -210 96 -300 80 -350 Z" fill={pal.tunicD} />
          <rect x={-97} y={-224} width={194} height={26} rx={7} fill="#6A4A2E" {...st(6)} />
          {[-66, -22, 22, 66].map((px) => <circle key={px} cx={px} cy={-211} r={5} fill={BRONZE_L} />)}
          {plate && <g><path d="M -40 -356 L -46 -318 M 40 -356 L 46 -318" stroke="#6A4A2E" strokeWidth={14} /><path d="M -40 -356 L -46 -318 M 40 -356 L 46 -318" stroke={INK} strokeWidth={3} opacity={0} />
            <rect x={-54} y={-326} width={108} height={84} rx={9} fill={BRONZE} {...st(6)} /><rect x={-40} y={-313} width={80} height={58} rx={5} fill="none" stroke={BRONZE_L} strokeWidth={4} />
            {[[-44, -316], [44, -316], [-44, -252], [44, -252]].map(([px, py], i) => <circle key={i} cx={px} cy={py} r={4} fill={BRONZE_D} />)}</g>}
        </g>
        {/* the spear hand: spear behind the fist */}
        {hold != null && <g transform={`translate(${end[0]} ${end[1]}) rotate(${hold}) translate(0 170)`}><Pilum len={640} /></g>}
        <Limb pts={hand} w={29} fill={pal.skin} />
        <path d={`M ${sh[0] - 14} ${sh[1] - 16} L ${sh[0] + 16} ${sh[1] - 12} L ${sh[0] + 22} ${sh[1] + 22} L ${sh[0] - 12} ${sh[1] + 28} Z`} fill={pal.tunic} {...st(6)} />
        {open > 0 && [-21, -7, 7, 21].map((d) => <Limb key={d} pts={[[end[0] + d, end[1] - 8], [end[0] + d * 1.25, end[1] - 8 - 34 * open]]} w={9} fill={pal.skin} />)}
        {open > 0 && <Limb pts={[[end[0] - 16, end[1] + 4], [end[0] - 40 * open - 16, end[1] - 10 * open]]} w={10} fill={pal.skin} />}
        <circle cx={end[0]} cy={end[1]} r={21} fill={pal.skin} {...st(6)} />
        {stick && <g transform={`translate(${end[0]} ${end[1]}) rotate(30)`}><path d="M 0 -60 L 0 110" stroke={INK} strokeWidth={15} strokeLinecap="round" /><path d="M 0 -60 L 0 110" stroke="#8A5C2E" strokeWidth={8} strokeLinecap="round" /></g>}
        {armL && <g><Limb pts={arm(-84, -332 + b, armL[0], armL[1])} w={29} fill={pal.skin} /><circle cx={arm(-84, -332 + b, armL[0], armL[1])[2][0]} cy={arm(-84, -332 + b, armL[0], armL[1])[2][1]} r={21} fill={pal.skin} {...st(6)} /></g>}
        {/* the head */}
        <g transform={`translate(0 ${-484 + b * 1.3}) rotate(${tilt})`}>
          <ellipse rx={127} ry={120} fill={pal.skin} {...st(8)} />
          <path d="M 62 104 C 104 82 124 44 124 2 C 118 54 92 88 44 110 Z" fill={SHADE} />
          {beard && <path d="M -96 54 C -84 118 -34 138 14 134 C 66 130 106 100 112 50 C 86 84 54 88 18 84 C -30 88 -74 84 -96 54 Z" fill="#4A3524" {...st(6)} />}
          {!beard && [[-54, 86], [-36, 96], [-16, 102], [6, 104], [28, 100]].map(([px, py], i) => <path key={i} d={`M ${px} ${py} l 2 8`} stroke="#8A8378" strokeWidth={3} strokeLinecap="round" />)}
          <Face expr={expr} blink={BLINKS(T, seed)} look={look} lookY={lookY} />
          {sweat > 0 && <g transform={`translate(104 ${-34 + sweat * 42}) scale(${clamp(sweat * 2, 0, 1)})`}><path d="M 0 -22 C 15 -2 15 14 0 18 C -15 14 -15 -2 0 -22 Z" fill="#9BD6EE" {...st(4)} /></g>}
          <g transform="translate(0 -48)"><Helmet kind={helmet} T={T} seed={seed} /></g>
        </g>
        {shield && <g transform={`translate(-46 ${-210 + b})`}><Scutum kind={shield} k={0.92} /></g>}
      </g>
    </g>
  );
};

// ───────────── the world ─────────────
const Defs = () => (
  <defs>
    {[1.5, 3, 5, 8, 12].map((b) => <filter key={b} id={`rb${b}`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={b} /></filter>)}
    <linearGradient id="rsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8FAFBC" /><stop offset="0.72" stopColor="#D7D6BC" /><stop offset="1" stopColor="#EBD9AE" /></linearGradient>
    <linearGradient id="rground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#B7A763" /><stop offset="0.5" stopColor="#BFA968" /><stop offset="1" stopColor="#A6914F" /></linearGradient>
    <radialGradient id="rdust" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#F2E2B6" stopOpacity={0.55} /><stop offset="1" stopColor="#F2E2B6" stopOpacity={0} /></radialGradient>
    <radialGradient id="rvig" cx="0.5" cy="0.46" r="0.72"><stop offset="0.62" stopColor="#20150A" stopOpacity={0} /><stop offset="1" stopColor="#20150A" stopOpacity={0.38} /></radialGradient>
  </defs>
);
const Tuft = ({s = 1}) => (<g transform={`scale(${s})`} fill="none" strokeLinecap="round"><path d="M -16 0 C -18 -18 -24 -30 -32 -38 M -6 0 C -7 -22 -8 -38 -12 -52 M 5 0 C 6 -20 9 -34 15 -46 M 15 0 C 18 -12 24 -22 32 -28" stroke="#6F7A3C" strokeWidth={5} /></g>);
const Pebble = ({s = 1, c = '#A49B84'}) => <ellipse rx={18 * s} ry={9 * s} fill={c} {...st(3.5)} />;
const Flower = () => (<g><path d="M 0 0 L 0 -22" stroke="#6F7A3C" strokeWidth={4} />{[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={Math.sin(rad(a)) * 6} cy={-24 + Math.cos(rad(a)) * 6} r={4.2} fill="#F0DE9B" />)}<circle cy={-24} r={3.4} fill="#C98E2E" /></g>);
// ground scatter between two heights: bigger towards the viewer
const Scatter = ({y0, y1, n = 44, seed = 3, x0 = -400, x1 = W + 400}) => {
  const R = rngOf(seed);
  return [...Array(n)].map((_, i) => { const x = x0 + R() * (x1 - x0), t = R(), y = y0 + (y1 - y0) * t * t, s = 0.45 + t * 1.1, k = R();
    return <g key={i} transform={`translate(${x} ${y})`}>{k < 0.55 ? <Tuft s={s} /> : k < 0.87 ? <Pebble s={s} c={k < 0.7 ? '#A49B84' : '#8F8672'} /> : <g transform={`scale(${s})`}><Flower /></g>}</g>; });
};
const Land = ({hy = 470, drift = 0, top = -1200}) => (
  <g>
    <rect x={-800} y={top} width={W + 1600} height={hy - top + 200} fill="url(#rsky)" />
    <g filter="url(#rb8)"><path d={`M -800 ${hy + 10} C -300 ${hy - 150} 200 ${hy - 110} 640 ${hy - 40} C 1000 ${hy - 180} 1500 ${hy - 190} 2800 ${hy + 10} Z`} fill="#8F9A72" transform={`translate(${drift * 0.3} 0)`} /></g>
    <g filter="url(#rb5)"><path d={`M -800 ${hy + 16} C -200 ${hy - 40} 800 ${hy - 54} 2800 ${hy + 16} Z`} fill="#A5A56C" transform={`translate(${drift * 0.5} 0)`} /></g>
    <rect x={-800} y={hy} width={W + 1600} height={H - hy + 1000} fill="url(#rground)" />
  </g>
);
const Dust = ({T = 0, y = 500, n = 5, op = 1}) => [...Array(n)].map((_, i) => <ellipse key={i} cx={(i * 480 + T * (0.5 + i * 0.12)) % (W + 700) - 350} cy={y + (i % 3) * 36} rx={420} ry={120} fill="url(#rdust)" opacity={op} />);
// a rank of soldiers across the picture, soft with distance
const Rank = ({y, s, dx, x0 = -160, n = 16, blur, pal, helmet, shield, T, seed = 2, expr = 'calm', beard = false, plate = true, hold = 0, look = 0, march = 0}) => {
  const items = [...Array(n)].map((_, i) => <Soldier key={i} x={x0 + i * dx + ((i * 37) % 11) - 5} y={y + ((i * 53) % 7) - 3 + Math.abs(Math.sin(T * 0.21 + i)) * -14 * march} s={s} T={T} seed={seed + i} pal={pal} helmet={helmet} shield={shield} expr={expr} beard={beard && i % 3 !== 1} plate={plate} hold={hold} look={look} shadow={!blur || blur < 5} bob={0.6} />);
  return blur ? <g filter={`url(#rb${blur})`}>{items}</g> : <g>{items}</g>;
};
const Cam = ({x = W / 2, y = H / 2, z = 1, children}) => <g transform={`translate(${W / 2} ${H / 2}) scale(${z}) translate(${-x} ${-y})`}>{children}</g>;
const Big = ({x, y, text, size = 90, color = '#FFFFFF', k = 1, rot = -3, anchor = 'middle'}) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${k})`}>
    <text x={6} y={8} textAnchor={anchor} fontFamily={NUN} fontWeight={900} fontSize={size} fill={INK} stroke={INK} strokeWidth={size * 0.24} strokeLinejoin="round">{text}</text>
    <text textAnchor={anchor} fontFamily={NUN} fontWeight={900} fontSize={size} fill={color} stroke={INK} strokeWidth={size * 0.2} strokeLinejoin="round" paintOrder="stroke">{text}</text>
  </g>
);

// ───────────── the five shots ─────────────
function ShotYou({f, len, line, T}) {   // close on you: the ranks soft behind; your throat on 'dry'
  const dry = at(line, 'dry', 0.8), z = eas(f, 0, len, 1.0, 1.09);
  const gulp = Math.sin(clamp((f - dry) / 14, 0, 1) * Math.PI) * 10;
  return (
    <Cam x={960} y={560} z={z}>
      <Land hy={500} />
      <Rank y={560} s={0.42} dx={150} x0={-120} n={15} blur={8} pal={LEGION} helmet="roman" shield="roman" T={T} seed={9} />
      <Rank y={760} s={0.72} dx={250} x0={-150} n={10} blur={5} pal={LEGION} helmet="roman" shield="roman" T={T} seed={4} />
      <Dust T={T} y={480} op={0.8} />
      <Soldier x={1620} y={1320} s={1.5} pal={LEGION} T={T} seed={6} expr="stare" look={1} />
      <g filter="url(#rb1.5)"><Scatter y0={900} y1={1080} n={14} seed={7} /></g>
      <Soldier x={800} y={1480 + gulp} s={2.02} pal={LEGION} T={T} seed={3} expr="nervous" look={f > 40 ? 1 : 0.2} sweat={lin(f, dry - 8, dry + 22, 0, 1)} armR={[20, -6]} />
    </Cam>
  );
}
function ShotEnemy({f, len, line, T}) {   // across the field, over your own shield and spear; they stop and stare; a push on 'stares'
  const stop = at(line, 'stops', 0.45), stare = at(line, 'stares', 0.8), twenty = at(line, 'twenty', 0.05);
  const march = 1 - clamp((f - stop) / 8, 0, 1), adv = eas(f, -30, stop, -46, 0);
  const z = eas(f, stare - 2, stare + 15, 1.0, 1.95);
  const fy = eas(f, stare - 2, stare + 15, 560, 442);
  const fx = eas(f, stare - 2, stare + 15, 960, 1030);
  return (
    <g>
      <Cam x={fx} y={fy} z={z}>
        <Land hy={400} drift={f * 0.4} />
        <Rank y={470 + adv * 0.4} s={0.3} dx={112} x0={-130} n={22} blur={5} pal={SAMNITE} helmet="cone" shield="samnite" T={T} seed={12} beard plate={false} hold={0} march={march} />
        <Rank y={560 + adv} s={0.42} dx={148} x0={-90} n={15} blur={1.5} pal={SAMNITE} helmet="cone" shield="samnite" T={T} seed={5} beard plate={false} expr={f >= stare ? 'stare' : 'calm'} look={f >= stare ? 0 : 0.3} march={march} />
        <Dust T={T} y={500} n={4} op={0.55 + march * 0.3} />
        <Scatter y0={590} y1={1100} n={46} seed={11} />
      </Cam>
      {/* your own kit in the foreground, sharp and leaving with the push */}
      <g transform={`translate(${-(z - 1) * 340} ${(z - 1) * 340})`}>
        <g transform="translate(330 1030) rotate(-5) scale(2.1)"><Scutum kind="roman" k={1} /></g>
        <g transform="translate(628 1190) rotate(9)"><Pilum len={1000} /></g>
        <g transform="translate(95 1180) rotate(-4)"><Pilum len={960} /></g>
      </g>
      {f < stare + 4 && <g opacity={1 - clamp((f - stare) / 4, 0, 1)}>
        <path d="M 870 860 C 930 780 960 720 985 640" fill="none" stroke="#E3301F" strokeWidth={13} strokeDasharray="34 24" strokeDashoffset={-T * 2} opacity={clamp((f - twenty) / 6, 0, 1)} />
        {f >= twenty && <Big x={1270} y={790} text="~20 METRES" size={82} k={pop(f, twenty)} />}
      </g>}
    </g>
  );
}
function ShotCenturion({f, len, line, T}) {   // from below: the centurion's hand goes up on 'raises' (a dip first), the eagle behind
  const up = at(line, 'raises', 0.3), k = spr((f - up) / 30, 12, 0.6), dip = Math.sin(clamp((f - up + 7) / 7, 0, 1) * Math.PI) * 14;
  const z = eas(f, 0, len, 1.0, 1.07);
  return (
    <Cam x={960} y={500} z={z}>
      <Land hy={650} />
      <Rank y={760} s={0.5} dx={190} x0={-120} n={12} blur={8} pal={LEGION} helmet="roman" shield="roman" T={T} seed={8} />
      <g filter="url(#rb3)" transform="translate(1490 0)">
        <path d="M 0 1000 L 0 130" stroke={INK} strokeWidth={20} /><path d="M 0 1000 L 0 130" stroke="#8A5C2E" strokeWidth={10} />
        <rect x={-88} y={250} width={176} height={210} fill="#A62E22" {...st(7)} /><path d="M -88 300 L 88 300 M -88 410 L 88 410" stroke="#E8C45F" strokeWidth={8} />
        <g transform="translate(0 150)"><path d="M -86 -34 C -48 -68 -22 -40 0 -14 C 22 -40 48 -68 86 -34 C 66 -6 40 8 18 10 L 12 44 L -12 44 L -18 10 C -40 8 -66 -6 -86 -34 Z" fill={BRONZE} {...st(6)} /><circle cy={-30} r={17} fill={BRONZE} {...st(5)} /></g>
      </g>
      <Dust T={T} y={620} op={0.6} />
      <Soldier x={700} y={1500} s={1.95} pal={LEGION} helmet="centurion" T={T} seed={2} expr="stare" look={1} hold={null} shield={null} cloak tilt={-2} open={clamp(k, 0, 1)}
        armR={[lin(k, 0, 1, 18, 118) - dip * 0.3 * (f < up ? 1 : 0), lin(k, 0, 1, -6, 176)]} armL={[-18, 8]} />
    </Cam>
  );
}
// the throw: a soldier winds back, whips over, the spear leaves his hand
const throwPose = (f, t) => {
  const back = eas(f, t - 14, t - 1, 0, 1), go = spr((f - t) / 30, 26, 0.7);
  const a1 = 24 + back * 96 - go * 22, a2 = -8 + back * -18 + go * 126;
  return {armR: [a1 - go * back * 66, a2], hold: f < t + 1 ? -back * 74 : null};
};
function ShotThrow({f, len, line, T}) {   // the wave along the line, the sky filling, the camera going up with them
  const w0 = at(line, 'throw', 0.04) + 3, up = at(line, 'up', 0.5);
  const cy = eas(f, up - 10, up + 26, 0, -520);
  const fx = eas(f, 0, len, 0, 80);
  const row = [...Array(9)].map((_, i) => ({x: 90 + i * 212, y: 980 - i * 40, s: 1.06 - i * 0.075, t: w0 + i * 2.2, seed: 3 + i}));
  const R = rngOf(21);
  const spears = [...Array(70)].map((_, i) => { const front = i < row.length; const depth = front ? 1 : 0.35 + R() * 0.55;
    const t0 = front ? row[i].t + 2 : w0 + R() * 26;
    const x0 = front ? row[i].x + 150 * row[i].s : -300 + R() * 2400, y0 = front ? row[i].y - 640 * row[i].s : 560 + R() * 180;
    return {t0, x0, y0, d: depth, vx: (10 + R() * 5) * (0.55 + depth * 0.6), vy: (30 + R() * 9) * (0.6 + depth * 0.55)}; });
  return (
    <Cam x={960 + fx} y={540 + cy} z={1}>
      <Land hy={560} top={-1800} />
      <g transform="translate(0 0)">{[...Array(7)].map((_, i) => <g key={i} transform={`translate(${(i * 380 + T * 0.2) % 2400 - 300} ${-760 + i * 110})`}><ellipse rx={240} ry={38} fill="#EEF0E0" opacity={0.42} filter="url(#rb8)" /></g>)}</g>
      <Rank y={640} s={0.34} dx={126} x0={-200} n={22} blur={5} pal={LEGION} helmet="roman" shield="roman" T={T} seed={13} hold={f > w0 + 14 ? null : 0} />
      <Rank y={760} s={0.56} dx={208} x0={-180} n={13} blur={3} pal={LEGION} helmet="roman" shield="roman" T={T} seed={7} hold={f > w0 + 8 ? null : 0} />
      <Scatter y0={800} y1={1180} n={34} seed={19} />
      {row.slice().reverse().map((r) => { const pose = throwPose(f, r.t);
        return <Soldier key={r.seed} x={r.x} y={r.y} s={r.s} T={T} seed={r.seed} expr={f >= r.t - 2 ? 'shout' : 'stare'} look={1} armR={pose.armR} hold={pose.hold} lean={clamp((f - r.t) / 4, 0, 1) * 7 - clamp((r.t - f) / 8, 0, 1) * 5} />; })}
      {spears.map((p, i) => { const t = f - p.t0; if (t < 0 || t > 90) return null;
        const g = 0.5 * (0.6 + p.d * 0.4), x = p.x0 + p.vx * t, y = p.y0 - p.vy * t + g * t * t, a = Math.atan2(p.vx, p.vy - 2 * g * t) * 180 / Math.PI;
        const pil = <g transform={`translate(${x} ${y}) rotate(${a}) scale(${0.45 + p.d * 0.62})`}><Pilum len={520} /></g>;
        return <g key={i} filter={p.d < 0.55 ? 'url(#rb1.5)' : undefined}>{pil}</g>; })}
    </Cam>
  );
}
function ShotMiss({f, len, line, T}) {   // the two of you looking up; he leans in on 'whispers'; you turn on 'miss'; a far thud, nobody moves
  const wh = at(line, 'whispers', 0.5), ms = at(line, 'miss', 0.9);
  const lean = eas(f, wh - 8, wh + 6, 0, 5), z = eas(f, 0, len, 1.0, 1.1);
  return (
    <Cam x={950} y={520} z={z}>
      <Land hy={480} />
      <Rank y={590} s={0.42} dx={150} x0={-120} n={15} blur={8} pal={LEGION} helmet="roman" shield="roman" T={T} seed={16} hold={null} />
      <Rank y={760} s={0.7} dx={250} x0={-140} n={10} blur={5} pal={LEGION} helmet="roman" shield="roman" T={T} seed={10} hold={null} />
      <Dust T={T} y={500} op={0.7} />
      <Soldier x={590} y={1460} s={1.92} T={T} seed={3} expr={f >= ms ? 'stunned' : 'nervous'} look={f >= ms ? 1 : 0.3} lookY={f >= ms ? 0 : -1} hold={null} shield="roman" armR={[10, -2]} sweat={lin(f, ms, ms + 24, 0, 1)} tilt={f >= ms ? 3 : -5} />
      <Soldier x={1360} y={1490} s={1.92} flip T={T} seed={11} expr="deadpan" look={f >= wh - 4 ? 1 : 0.2} lookY={f >= wh - 4 ? 0 : -1} hold={null} shield="roman" armR={[10, -2]} tilt={-lean - (f >= wh - 8 ? 0 : 5)} lean={lean} />
    </Cam>
  );
}
const SHOTS = {r_you: ShotYou, r_enemy: ShotEnemy, r_centurion: ShotCenturion, r_throw: ShotThrow, r_miss: ShotMiss};

// captions: a phrase at a time on a dark plate, the spoken word yellow
const Captions = ({lines}) => {
  const f = useCurrentFrame();
  const l = lines.find((x, i) => f >= x.cut && (i + 1 >= lines.length || f < lines[i + 1].cut));
  if (!l || !(l.words || []).length) return null;
  const groups = [[]];
  l.words.forEach((w) => { const g = groups[groups.length - 1]; g.push(w); if (g.length >= 6 || /[.,!?:;]$/.test(w[0])) groups.push([]); });
  const g = groups.filter((x) => x.length).reduce((cur, x) => (x[0][1] <= f + 2 ? x : cur));
  const last = g[g.length - 1][1];
  if (f > last + 50) return null;
  const now = g.reduce((a, w, i) => (w[1] <= f ? i : a), 0);
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 46}}>
      <div style={{background: 'rgba(24,17,10,0.76)', borderRadius: 18, padding: '10px 26px', maxWidth: 1500, textAlign: 'center', fontFamily: OSW, fontWeight: 600, fontSize: 54, lineHeight: 1.18, letterSpacing: 1, textTransform: 'uppercase'}}>
        {g.map((w, i) => <span key={i} style={{color: i === now ? '#FDE047' : '#FFFFFF', marginRight: i + 1 < g.length ? 16 : 0}}>{w[0]}</span>)}
      </div>
    </AbsoluteFill>
  );
};
const Shot = ({line, len}) => {
  const f = useCurrentFrame(), S = SHOTS[line.shot] || ShotYou;
  return (
    <AbsoluteFill>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
        <Defs />
        <S f={f} len={len} line={line} T={line.cut + f} />
        <rect width={W} height={H} fill="url(#rvig)" />
      </svg>
    </AbsoluteFill>
  );
};
export const RomeTest = ({lines = [], frames = 420, captions = true}) => (
  <AbsoluteFill style={{backgroundColor: '#20150A'}}>
    <style>{FONT_CSS}</style>
    {lines.map((l, i) => {
      const to = i + 1 < lines.length ? lines[i + 1].cut : frames;
      return <Sequence key={i} from={l.cut} durationInFrames={Math.max(1, to - l.cut)} layout="none"><Shot line={{...l, start: l.cut}} len={to - l.cut} /></Sequence>;
    })}
    {captions && <Captions lines={lines} />}
  </AbsoluteFill>
);
