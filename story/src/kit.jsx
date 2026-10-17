// The story kit (2.48.0): the look of the owner's Fable proof of concept (How_Deep_Is_The_Ocean_30s_POC), made reusable.
// Flat shapes, chunky friendly people with round heads, white info cards with a coloured bar, springy entrances.
// Everything is a pure function of the frame, so any frame renders on its own.
import React from 'react';
import {spring, interpolate, Easing} from 'remotion';

export const FPS = 30;
export const W = 1920, H = 1080, GROUND = 880;
export const C = {
  navy: '#0B1F3A', ink: '#0B1F3A', grey: '#3C4A63', yellow: '#F2C14E', gold: '#B8891B', red: '#E5533D', blue: '#2FA7E0',
  sky: '#5FC3F0', purple: '#6B4FD8', green: '#22A06B', orange: '#F97316', pink: '#EC4899', teal: '#14B8A6', white: '#FFFFFF',
  skin: '#F7C8A0', hair: '#3A2A1A', pants: '#1F2A44', steel: '#8E9AAB', dark: '#5C6675',
};
export const COLORS = {blue: C.blue, red: C.red, yellow: C.yellow, purple: C.purple, green: C.green, orange: C.orange, navy: C.navy,
  pink: C.pink, teal: C.teal, grey: C.grey};
export const col = (c, d = C.blue) => COLORS[c] || (typeof c === 'string' && c.startsWith('#') ? c : d);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ease = Easing.bezier(0.45, 0, 0.55, 1);
export const lin = (f, a, b, x, y, e = ease) => interpolate(f, [a, b], [x, y], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e});
export const pop = (f, delay = 0, stiffness = 140, damping = 12) => spring({frame: f - delay, fps: FPS, config: {stiffness, damping, mass: 1}});
export const FONT = "'Nunito', 'Segoe UI', sans-serif";
const fmtNum = (n, dec = 0) => Number(n).toLocaleString('en-US', {minimumFractionDigits: dec, maximumFractionDigits: dec});

// seeded random, so a frame is always the same
export const rng = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

export const T = ({x, y, size = 40, weight = 900, fill = C.ink, anchor = 'start', children, stroke, sw = 0, op = 1, ls = 0}) => (
  <text x={x} y={y} fontSize={size} fontWeight={weight} fill={fill} textAnchor={anchor} fontFamily={FONT} opacity={op}
    letterSpacing={ls} stroke={stroke} strokeWidth={sw} paintOrder="stroke" strokeLinejoin="round">{children}</text>
);

// wrap text into lines of about n characters
export const wrap = (text, n) => {
  const words = String(text || '').split(/\s+/).filter(Boolean), out = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > n && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim();
  }
  if (line) out.push(line);
  return out;
};

// ───────────────────────── people ─────────────────────────
// One rig for everyone (the Fable kid's build): hips at (0,0), head centre at y=-84, feet at y≈146.
export const PRESETS = {
  pip: {suit: '#3B82F6', stripe: C.yellow, hair: 'pip'},
  pip_sub: {suit: '#E5533D', stripe: C.yellow, hair: 'pip'},
  diver: {suit: '#3B82F6', stripe: C.yellow, hair: 'pip', mask: true, tank: true, fins: true},
  man: {suit: '#64748B', tie: '#E5533D', hair: 'short'},
  businessman: {suit: '#1F2937', tie: '#E5533D', hair: 'side'},
  woman: {suit: '#E5533D', hair: 'long', hairColor: '#7C3A1D', lips: true},
  girl: {suit: '#EC4899', hair: 'pony', hairColor: '#3A2A1A', lips: true},
  soldier: {suit: '#5B6B3A', hat: 'helmet', hair: 'short'},
  police: {suit: '#1E3A8A', hat: 'cap', badge: true, hair: 'short'},
  guard: {suit: '#334155', hat: 'cap', hair: 'short'},
  doctor: {suit: '#F8FAFC', coat: true, stetho: true, hair: 'short', hairColor: '#6B4E2E'},
  scientist: {suit: '#F8FAFC', coat: true, glasses: true, hair: 'messy', hairColor: '#9CA3AF'},
  prisoner: {suit: '#F97316', stripes: true, hair: 'buzz'},
  villain: {suit: '#111827', hair: 'slick', beard: 'stubble', brows: 'angry'},
  old: {suit: '#7C6A55', hair: 'bald', hairColor: '#D1D5DB', beard: 'full', glasses: true},
  king: {suit: '#7C3AED', hair: 'short', beard: 'full', hat: 'crown', cape: '#B91C1C'},
  worker: {suit: '#2563EB', hat: 'hardhat', hair: 'short'},
  pilot: {suit: '#4B5563', hat: 'aviator', hair: 'short'},
  astronaut: {suit: '#E5E7EB', hat: 'space', hair: 'short'},
  kid: {suit: '#22A06B', hair: 'messy'},
  chef: {suit: '#F8FAFC', hat: 'chef', hair: 'short'},
  judge: {suit: '#111827', hair: 'bald', hairColor: '#E5E7EB', glasses: true, coat: true},
};
export const PEOPLE = Object.keys(PRESETS);

const POSES = {   // [left arm, right arm] rotation in degrees (0 = hanging down; positive = towards the back)
  stand: [12, -12], wave: [12, -150], point: [12, -95], point_left: [95, -12], arms_up: [160, -160], cheer: [150, -150],
  think: [12, -150], shrug: [70, -70], hips: [40, -40], scared: [140, -140], sad: [6, -6], present: [12, -60],
  hold: [-30, 30], walk: [12, -12], run: [12, -12], swim: [12, -12], fight: [-60, -100], sit: [20, -20],
};
export const POSE_NAMES = Object.keys(POSES);
export const FACES = ['happy', 'neutral', 'scared', 'angry', 'sad', 'surprised', 'smug', 'worried', 'laugh'];

function Hair({kind, color}) {
  const c = color || C.hair;
  switch (kind) {
    case 'pip': return <path d="M -38 -92 A 38 38 0 0 1 38 -92 L 38 -84 Q 20 -96 0 -94 Q -10 -104 -22 -96 Q -30 -92 -38 -84 Z" fill={c} />;
    case 'long': return (<g><path d="M -42 -88 A 42 42 0 0 1 42 -88 L 46 -30 Q 30 -20 26 -40 L 26 -84 Q 0 -96 -26 -84 L -26 -40 Q -30 -20 -46 -30 Z" fill={c} /></g>);
    case 'pony': return (<g><path d="M -38 -92 A 38 38 0 0 1 38 -92 L 38 -84 Q 0 -100 -38 -84 Z" fill={c} /><path d="M 30 -110 Q 70 -100 58 -50 Q 50 -80 34 -96 Z" fill={c} /></g>);
    case 'side': return <path d="M -38 -88 A 38 38 0 0 1 38 -92 L 38 -86 Q 10 -102 -20 -90 Q -30 -86 -38 -78 Z" fill={c} />;
    case 'messy': return <path d="M -40 -86 L -34 -112 L -22 -104 L -14 -124 L -2 -108 L 10 -124 L 18 -106 L 32 -116 L 34 -98 L 42 -86 Q 0 -100 -40 -86 Z" fill={c} />;
    case 'slick': return <path d="M -38 -90 A 38 38 0 0 1 38 -90 L 38 -84 Q 0 -110 -38 -84 Z" fill={c} />;
    case 'buzz': return <path d="M -37 -90 A 37 37 0 0 1 37 -90 L 37 -88 Q 0 -100 -37 -88 Z" fill={c} opacity={0.75} />;
    case 'bald': return <path d="M -38 -78 Q -40 -92 -32 -94 L -32 -80 Z M 38 -78 Q 40 -92 32 -94 L 32 -80 Z" fill={c} />;
    default: return <path d="M -38 -92 A 38 38 0 0 1 38 -92 L 38 -84 Q 0 -100 -38 -84 Z" fill={c} />;
  }
}

function Hat({kind}) {
  switch (kind) {
    case 'helmet': return <g><path d="M -46 -88 A 46 40 0 0 1 46 -88 L 52 -84 L -52 -84 Z" fill="#4B5A2E" /><rect x={-52} y={-88} width={104} height={8} rx={4} fill="#3B4724" /></g>;
    case 'cap': return <g><path d="M -40 -96 A 40 30 0 0 1 40 -96 L 40 -88 L -40 -88 Z" fill="#1E293B" /><rect x={-10} y={-90} width={64} height={10} rx={5} fill="#0F172A" /><circle cx={0} cy={-106} r={7} fill={C.yellow} /></g>;
    case 'crown': return <path d="M -34 -112 L -34 -136 L -18 -122 L 0 -142 L 18 -122 L 34 -136 L 34 -112 Z" fill={C.yellow} stroke={C.gold} strokeWidth={4} />;
    case 'hardhat': return <g><path d="M -42 -92 A 42 36 0 0 1 42 -92 Z" fill={C.yellow} /><rect x={-50} y={-94} width={100} height={10} rx={5} fill={C.gold} /></g>;
    case 'aviator': return <g><path d="M -40 -84 A 40 40 0 0 1 40 -84 L 40 -76 L -40 -76 Z" fill="#7C4A1E" /><rect x={-30} y={-108} width={60} height={14} rx={7} fill="#94A3B8" /></g>;
    case 'chef': return <g><rect x={-30} y={-138} width={60} height={30} rx={6} fill="#fff" /><circle cx={-18} cy={-140} r={16} fill="#fff" /><circle cx={4} cy={-148} r={18} fill="#fff" /><circle cx={22} cy={-138} r={14} fill="#fff" /></g>;
    case 'space': return <circle cx={0} cy={-84} r={56} fill="rgba(170,230,255,0.25)" stroke="#CBD5E1" strokeWidth={8} />;
    default: return null;
  }
}

function Face({face, f, talk, brows, blinkSeed = 0, lips}) {
  const blink = ((f + blinkSeed * 37) % 96) < 4;
  const ry = blink ? 1.5 : 11;
  const scared = face === 'scared' || face === 'surprised';
  const pr = scared ? 6.5 : 4.5;
  const look = Math.sin((f + blinkSeed * 13) * 0.04) * 2;
  const open = talk ? (Math.floor((f + blinkSeed) / 4) % 3) : 0;
  let mouth;
  if (talk) mouth = <ellipse cx={0} cy={-60} rx={9} ry={[2, 7, 4][open]} fill="#6a2a2a" />;
  else if (face === 'happy' || face === 'smug') mouth = <path d={face === 'smug' ? 'M -10 -60 Q 4 -54 12 -64' : 'M -11 -63 Q 0 -53 11 -63'} stroke="#8a4a3a" strokeWidth={4} fill="none" strokeLinecap="round" />;
  else if (face === 'laugh') mouth = <path d="M -12 -64 Q 0 -46 12 -64 Z" fill="#6a2a2a" />;
  else if (face === 'sad' || face === 'worried') mouth = <path d="M -10 -56 Q 0 -64 10 -56" stroke="#8a4a3a" strokeWidth={4} fill="none" strokeLinecap="round" />;
  else if (face === 'scared') mouth = <path d="M -9 -64 Q 0 -44 9 -64 Z" fill="#6a2a2a" />;
  else if (face === 'surprised') mouth = <ellipse cx={0} cy={-58} rx={7} ry={9} fill="#6a2a2a" />;
  else if (face === 'angry') mouth = <path d="M -10 -57 Q 0 -63 10 -57" stroke="#8a4a3a" strokeWidth={5} fill="none" strokeLinecap="round" />;
  else mouth = <path d="M -8 -60 L 8 -60" stroke="#8a4a3a" strokeWidth={4} strokeLinecap="round" />;
  const b = brows || (face === 'angry' ? 'angry' : face === 'sad' || face === 'worried' ? 'sad' : face === 'surprised' || face === 'scared' ? 'up' : null);
  const browPath = {angry: 'M -22 -100 L -6 -94 M 22 -100 L 6 -94', sad: 'M -22 -94 L -6 -100 M 22 -94 L 6 -100', up: 'M -22 -102 Q -13 -108 -4 -102 M 22 -102 Q 13 -108 4 -102'}[b];
  return (
    <g>
      <ellipse cx={-13} cy={-82} rx={9} ry={ry} fill="#fff" />
      <ellipse cx={13} cy={-82} rx={9} ry={ry} fill="#fff" />
      {!blink && <circle cx={-11 + look} cy={-81} r={pr} fill="#1a1a1a" />}
      {!blink && <circle cx={15 + look} cy={-81} r={pr} fill="#1a1a1a" />}
      {browPath && <path d={browPath} stroke="#3A2A1A" strokeWidth={5} strokeLinecap="round" fill="none" />}
      {mouth}
      {lips && !talk && <circle cx={-26} cy={-68} r={6} fill="#F59E8B" opacity={0.6} />}
      {lips && !talk && <circle cx={26} cy={-68} r={6} fill="#F59E8B" opacity={0.6} />}
    </g>
  );
}

// A person. who: a preset name (or a spec object). pose/face: names above. f: frame inside the shot.
export function Person({who = 'man', pose = 'stand', face = 'neutral', f = 0, talk = false, seed = 0, flip = false, x = 0, y = GROUND - 146, s = 1, op = 1}) {
  const spec = typeof who === 'object' ? {...PRESETS.man, ...who} : (PRESETS[who] || PRESETS.man);
  const suit = spec.suit, skin = spec.skin || C.skin;
  let [aL, aR] = POSES[pose] || POSES.stand;
  const walking = pose === 'walk' || pose === 'run' || pose === 'swim';
  const sp = pose === 'run' ? 0.55 : 0.32;
  const kick = walking ? (pose === 'run' ? 34 : 20) : 0;
  const swing = Math.sin((f + seed * 7) * sp);
  if (walking) { aL += swing * kick * 0.8; aR -= swing * kick * 0.8; }
  if (pose === 'wave') aR += Math.sin(f * 0.5) * 22;
  if (pose === 'scared') { aL += Math.sin(f * 1.6) * 4; aR -= Math.sin(f * 1.6) * 4; }
  if (pose === 'cheer') { aL += Math.sin(f * 0.4) * 10; aR -= Math.sin(f * 0.4) * 10; }
  const bob = walking ? Math.abs(swing) * -6 : Math.sin((f + seed * 11) * 0.08) * 2.5;
  const legL = walking ? swing * kick : 0, legR = -legL;
  const shake = pose === 'scared' ? Math.sin(f * 2.1) * 2 : 0;
  const sitting = pose === 'sit';
  return (
    <g transform={`translate(${x + shake} ${y + bob}) scale(${flip ? -s : s} ${s})`} opacity={op}>
      <ellipse cx={0} cy={150 - bob} rx={56} ry={10} fill="#000" opacity={0.18} />
      {spec.cape && <path d="M -40 -40 L 40 -40 L 58 120 L -58 120 Z" fill={spec.cape} />}
      {spec.tank && <g><rect x={-16} y={-36} width={32} height={96} rx={12} fill={C.steel} stroke={C.dark} strokeWidth={4} /><rect x={-6} y={-48} width={12} height={16} rx={4} fill={C.dark} /></g>}
      {spec.hair === 'long' && <path d="M -46 -60 Q -50 0 -30 10 L 30 10 Q 50 0 46 -60 Z" fill={spec.hairColor || C.hair} />}
      <g transform={sitting ? 'translate(0 40)' : ''}>
        <g transform={`translate(0 56) rotate(${sitting ? -70 : legL})`}>
          <rect x={-24} y={0} width={24} height={78} rx={11} fill={spec.stripes ? '#EA580C' : C.pants} />
          {spec.fins ? <path d="M -26 74 L -2 74 L 2 110 L -40 110 Z" fill={C.yellow} /> : <rect x={-30} y={74} width={32} height={16} rx={7} fill="#222" />}
        </g>
        <g transform={`translate(0 56) rotate(${sitting ? -70 : legR})`}>
          <rect x={0} y={0} width={24} height={78} rx={11} fill={spec.stripes ? '#EA580C' : C.pants} />
          {spec.fins ? <path d="M -2 74 L 22 74 L 40 110 L -2 110 Z" fill={C.yellow} /> : <rect x={-2} y={74} width={32} height={16} rx={7} fill="#222" />}
        </g>
      </g>
      <rect x={-42} y={-40} width={84} height={108} rx={26} fill={suit} />
      {spec.coat && <path d="M -42 -20 L -42 60 Q -42 68 -34 68 L -6 68 L -6 -30 Z M 42 -20 L 42 60 Q 42 68 34 68 L 6 68 L 6 -30 Z" fill="#fff" stroke="#CBD5E1" strokeWidth={3} />}
      {spec.coat && spec.suit === '#F8FAFC' && <rect x={-6} y={-36} width={12} height={100} fill="#93C5FD" />}
      {spec.stripe && <rect x={-42} y={-6} width={84} height={14} fill={spec.stripe} opacity={0.9} />}
      {spec.stripes && [0, 1, 2, 3].map((i) => <rect key={i} x={-42} y={-30 + i * 24} width={84} height={8} fill="#FDBA74" />)}
      {spec.tie && <path d="M -7 -38 L 7 -38 L 10 10 L 0 22 L -10 10 Z" fill={spec.tie} />}
      {spec.badge && <path d="M 18 -18 l 8 -6 l 8 6 l -2 10 l -12 0 Z" fill={C.yellow} />}
      {spec.stetho && <path d="M -20 -36 Q -26 10 0 14 Q 26 10 20 -36" stroke="#334155" strokeWidth={4} fill="none" />}
      <g transform={`translate(-36 -28) rotate(${aL})`}><rect x={-14} y={-8} width={24} height={78} rx={12} fill={suit} /><circle cx={-2} cy={72} r={13} fill={skin} /></g>
      <g transform={`translate(36 -28) rotate(${aR})`}><rect x={-10} y={-8} width={24} height={78} rx={12} fill={suit} /><circle cx={2} cy={72} r={13} fill={skin} /></g>
      <rect x={-12} y={-50} width={24} height={14} fill={skin} />
      <g transform={pose === 'think' ? 'rotate(-6 0 -84)' : pose === 'sad' ? 'rotate(8 0 -60)' : ''}>
        <circle cx={0} cy={-84} r={38} fill={skin} />
        <circle cx={-38} cy={-80} r={7} fill={skin} />
        <circle cx={38} cy={-80} r={7} fill={skin} />
        {spec.hair !== 'none' && <Hair kind={spec.hair} color={spec.hairColor} />}
        {spec.beard === 'full' && <path d="M -36 -78 Q -34 -34 0 -30 Q 34 -34 36 -78 Q 20 -56 0 -54 Q -20 -56 -36 -78 Z" fill={spec.hairColor || C.hair} />}
        {spec.beard === 'stubble' && <path d="M -32 -70 Q -28 -40 0 -38 Q 28 -40 32 -70 Q 16 -50 0 -50 Q -16 -50 -32 -70 Z" fill="#475569" opacity={0.45} />}
        <Face face={face} f={f} talk={talk} brows={spec.brows} blinkSeed={seed} lips={spec.lips} />
        {spec.glasses && <g fill="none" stroke="#1F2937" strokeWidth={4}><circle cx={-13} cy={-82} r={13} /><circle cx={13} cy={-82} r={13} /><path d="M 0 -82 L 0 -82" /></g>}
        {spec.mask && <g><rect x={-34} y={-100} width={68} height={34} rx={12} fill="rgba(170,230,255,0.35)" stroke={C.pants} strokeWidth={5} /><path d="M -34 -84 Q -46 -84 -46 -70" stroke={C.pants} strokeWidth={5} fill="none" /></g>}
        <Hat kind={spec.hat} />
      </g>
    </g>
  );
}

// ───────────────────────── the yellow sub (the Fable kid's) ─────────────────────────
export function Sub({f = 0, x = 0, y = 0, s = 1, beam = 0, flip = false, face = 'happy'}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path d="M -150 -30 L -900 -260 L -900 220 L -150 30 Z" fill="#FFF6C8" opacity={beam * 0.45} />
      <rect x={150} y={-14} width={44} height={28} rx={6} fill="#C99A2E" />
      <g transform="translate(188 0)">
        <rect x={-10} y={-40} width={14} height={80} rx={7} fill={C.steel} />
        <g transform={`rotate(${f * 24})`}><rect x={-8} y={-44} width={16} height={88} rx={8} fill={C.dark} /><rect x={-44} y={-8} width={88} height={16} rx={8} fill={C.dark} /></g>
      </g>
      <path d="M 60 -70 L 120 -70 L 150 -120 L 90 -120 Z" fill="#C99A2E" />
      <path d="M 60 70 L 120 70 L 150 120 L 90 120 Z" fill="#C99A2E" />
      <ellipse cx={0} cy={0} rx={180} ry={96} fill={C.yellow} stroke={C.gold} strokeWidth={7} />
      <rect x={-40} y={-140} width={80} height={60} rx={14} fill={C.yellow} stroke={C.gold} strokeWidth={7} />
      <rect x={-6} y={-175} width={12} height={40} rx={4} fill={C.gold} />
      <ellipse cx={-60} cy={40} rx={100} ry={30} fill="#E2AD3A" opacity={0.6} />
      {[...Array(9)].map((_, i) => <circle key={i} cx={-150 + i * 38} cy={-60 + Math.abs(i - 4) * 9} r={4} fill={C.gold} />)}
      <circle cx={-170} cy={0} r={26} fill="#FFF6C8" stroke={C.gold} strokeWidth={6} />
      <g transform="translate(-40 -2)">
        <circle r={56} fill={C.gold} />
        <circle r={46} fill="#8ED8FF" />
        <clipPath id="port"><circle r={46} /></clipPath>
        <g clipPath="url(#port)"><Person who="pip_sub" face={face} f={f} x={0} y={60} s={0.78} /></g>
        <path d="M -30 -40 Q -10 -46 10 -36" stroke="#fff" strokeWidth={7} fill="none" opacity={0.55} strokeLinecap="round" />
        <circle r={50} fill="none" stroke={C.gold} strokeWidth={8} />
      </g>
    </g>
  );
}

// ───────────────────────── icons (100 x 100, centred) ─────────────────────────
const I = {
  money: <g><rect x={-46} y={-26} width={92} height={52} rx={8} fill="#22A06B" /><rect x={-38} y={-18} width={76} height={36} rx={6} fill="none" stroke="#BBF7D0" strokeWidth={4} /><text x={0} y={14} fontSize={36} fontWeight={900} fill="#fff" textAnchor="middle" fontFamily={FONT}>$</text></g>,
  coins: <g>{[0, 1, 2].map((i) => <ellipse key={i} cx={0} cy={24 - i * 16} rx={34} ry={12} fill={C.yellow} stroke={C.gold} strokeWidth={4} />)}</g>,
  clock: <g><circle r={44} fill="#fff" stroke={C.navy} strokeWidth={8} /><path d="M 0 0 L 0 -28 M 0 0 L 20 10" stroke={C.navy} strokeWidth={7} strokeLinecap="round" /></g>,
  skull: <g><path d="M -36 4 A 36 38 0 1 1 36 4 L 26 18 L 26 34 L -26 34 L -26 18 Z" fill="#F1F5F9" stroke="#334155" strokeWidth={4} /><circle cx={-14} cy={-2} r={10} fill="#334155" /><circle cx={14} cy={-2} r={10} fill="#334155" /><path d="M -10 26 L -10 34 M 0 26 L 0 34 M 10 26 L 10 34" stroke="#334155" strokeWidth={3} /></g>,
  heart: <path d="M 0 36 L -38 -2 A 20 20 0 0 1 0 -26 A 20 20 0 0 1 38 -2 Z" fill={C.red} />,
  brain: <g><path d="M -40 10 Q -46 -30 -14 -34 Q 0 -46 14 -34 Q 46 -30 40 10 Q 36 34 0 32 Q -36 34 -40 10 Z" fill="#F9A8D4" stroke="#BE185D" strokeWidth={4} /><path d="M 0 -34 L 0 30 M -24 -14 Q -14 -4 -24 8 M 24 -14 Q 14 -4 24 8" stroke="#BE185D" strokeWidth={4} fill="none" /></g>,
  pill: <g transform="rotate(-35)"><rect x={-42} y={-16} width={84} height={32} rx={16} fill="#fff" stroke="#334155" strokeWidth={4} /><path d="M 0 -16 L 0 16 L 26 16 A 16 16 0 0 0 26 -16 Z" fill={C.red} /></g>,
  syringe: <g transform="rotate(-40)"><rect x={-30} y={-10} width={60} height={20} rx={4} fill="#E0F2FE" stroke="#334155" strokeWidth={4} /><path d="M 30 0 L 54 0" stroke="#334155" strokeWidth={3} /><rect x={-44} y={-14} width={14} height={28} fill="#334155" /></g>,
  phone: <g><rect x={-24} y={-42} width={48} height={84} rx={10} fill={C.navy} /><rect x={-18} y={-32} width={36} height={58} rx={4} fill="#93C5FD" /></g>,
  plane: <path d="M -46 4 L 46 -4 Q 52 0 46 4 L -46 4 Z M -6 0 L -26 -34 L -14 -34 L 14 0 Z M -6 2 L -26 34 L -14 34 L 14 2 Z M -42 0 L -50 -16 L -40 -16 L -30 0 Z" fill="#64748B" />,
  ship: <g><path d="M -48 6 L 48 6 L 34 30 L -34 30 Z" fill="#334155" /><rect x={-24} y={-18} width={44} height={24} fill="#F8FAFC" /><rect x={-6} y={-38} width={12} height={20} fill={C.red} /></g>,
  helicopter: <g><ellipse cx={-4} cy={6} rx={34} ry={20} fill="#475569" /><path d="M 26 4 L 54 0 L 54 8 L 26 12 Z" fill="#475569" /><path d="M -46 -20 L 40 -20" stroke="#1F2937" strokeWidth={5} /><rect x={-6} y={-20} width={6} height={10} fill="#1F2937" /><ellipse cx={-18} cy={2} rx={10} ry={8} fill="#93C5FD" /></g>,
  rocket: <g transform="rotate(35)"><path d="M 0 -48 Q 18 -24 16 24 L -16 24 Q -18 -24 0 -48 Z" fill="#E5E7EB" stroke="#334155" strokeWidth={4} /><circle cy={-10} r={8} fill="#60A5FA" /><path d="M -16 14 L -28 32 L -16 28 Z M 16 14 L 28 32 L 16 28 Z" fill={C.red} /><path d="M -8 26 L 0 46 L 8 26 Z" fill={C.orange} /></g>,
  bomb: <g><circle cy={6} r={34} fill="#1F2937" /><rect x={-8} y={-36} width={16} height={12} fill="#475569" /><path d="M 4 -36 Q 14 -50 26 -44" stroke="#92400E" strokeWidth={4} fill="none" /><circle cx={28} cy={-46} r={6} fill={C.orange} /></g>,
  tank: <g><rect x={-46} y={6} width={92} height={22} rx={11} fill="#3F4A26" /><rect x={-34} y={-14} width={64} height={22} rx={6} fill="#5B6B3A" /><rect x={20} y={-10} width={36} height={8} fill="#3F4A26" /></g>,
  flag: <g><rect x={-30} y={-44} width={6} height={88} fill="#475569" /><path d="M -24 -42 L 34 -30 L -24 -16 Z" fill={C.red} /></g>,
  book: <g><path d="M -44 -30 L 0 -20 L 44 -30 L 44 30 L 0 40 L -44 30 Z" fill="#fff" stroke={C.navy} strokeWidth={5} /><path d="M 0 -20 L 0 40" stroke={C.navy} strokeWidth={4} /></g>,
  document: <g><path d="M -30 -42 L 18 -42 L 32 -28 L 32 42 L -30 42 Z" fill="#fff" stroke={C.navy} strokeWidth={5} /><path d="M -18 -18 L 20 -18 M -18 0 L 20 0 M -18 18 L 8 18" stroke="#94A3B8" strokeWidth={5} /></g>,
  secret: <g><path d="M -30 -42 L 18 -42 L 32 -28 L 32 42 L -30 42 Z" fill="#FEF3C7" stroke={C.navy} strokeWidth={5} /><rect x={-34} y={-10} width={70} height={22} fill={C.red} transform="rotate(-18)" /><text x={0} y={8} fontSize={16} fontWeight={900} fill="#fff" textAnchor="middle" fontFamily={FONT} transform="rotate(-18)">SECRET</text></g>,
  key: <g><circle cx={-22} cy={0} r={18} fill="none" stroke={C.yellow} strokeWidth={9} /><path d="M -4 0 L 44 0 M 30 0 L 30 16 M 42 0 L 42 12" stroke={C.yellow} strokeWidth={9} strokeLinecap="round" /></g>,
  lock: <g><path d="M -20 -6 L -20 -22 A 20 20 0 0 1 20 -22 L 20 -6" stroke="#94A3B8" strokeWidth={9} fill="none" /><rect x={-32} y={-8} width={64} height={48} rx={8} fill={C.yellow} stroke={C.gold} strokeWidth={4} /></g>,
  bars: <g>{[-30, -10, 10, 30].map((x) => <rect key={x} x={x - 4} y={-44} width={8} height={88} fill="#64748B" />)}<rect x={-42} y={-44} width={84} height={8} fill="#475569" /><rect x={-42} y={36} width={84} height={8} fill="#475569" /></g>,
  handcuffs: <g fill="none" stroke="#94A3B8" strokeWidth={9}><circle cx={-22} cy={6} r={18} /><circle cx={22} cy={6} r={18} /><path d="M -6 -8 L 6 -8" /></g>,
  badge: <path d="M 0 -42 L 12 -22 L 36 -18 L 20 2 L 24 28 L 0 16 L -24 28 L -20 2 L -36 -18 L -12 -22 Z" fill={C.yellow} stroke={C.gold} strokeWidth={4} />,
  bulb: <g><circle cy={-8} r={30} fill="#FDE68A" stroke={C.gold} strokeWidth={4} /><rect x={-14} y={20} width={28} height={18} rx={4} fill="#94A3B8" /></g>,
  question: <text x={0} y={34} fontSize={110} fontWeight={900} fill={C.yellow} stroke={C.navy} strokeWidth={8} paintOrder="stroke" textAnchor="middle" fontFamily={FONT}>?</text>,
  exclaim: <text x={0} y={36} fontSize={110} fontWeight={900} fill={C.red} stroke="#fff" strokeWidth={8} paintOrder="stroke" textAnchor="middle" fontFamily={FONT}>!</text>,
  check: <g><circle r={42} fill={C.green} /><path d="M -20 0 L -6 16 L 22 -14" stroke="#fff" strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>,
  cross: <g><circle r={42} fill={C.red} /><path d="M -18 -18 L 18 18 M 18 -18 L -18 18" stroke="#fff" strokeWidth={10} strokeLinecap="round" /></g>,
  fire: <g><path d="M 0 -46 Q 34 -10 26 18 Q 18 42 0 42 Q -18 42 -26 18 Q -30 -6 -10 -20 Q -6 -4 4 -6 Q 10 -24 0 -46 Z" fill={C.orange} /><path d="M 0 0 Q 14 14 8 28 Q 0 36 -8 28 Q -12 16 0 0 Z" fill={C.yellow} /></g>,
  drop: <path d="M 0 -44 Q 34 0 30 16 A 30 30 0 0 1 -30 16 Q -34 0 0 -44 Z" fill="#38BDF8" />,
  tree: <g><rect x={-8} y={10} width={16} height={34} fill="#7C4A1E" /><circle cy={-12} r={32} fill={C.green} /><circle cx={-20} cy={4} r={20} fill="#16A34A" /><circle cx={22} cy={2} r={20} fill="#16A34A" /></g>,
  mountain: <g><path d="M -48 36 L -8 -30 L 14 4 L 26 -12 L 48 36 Z" fill="#6B7280" /><path d="M -8 -30 L 4 -10 L -2 -6 L -10 -14 L -18 -14 Z" fill="#F8FAFC" /></g>,
  sun: <g>{[...Array(10)].map((_, i) => <rect key={i} x={-4} y={-46} width={8} height={16} rx={4} fill={C.yellow} transform={`rotate(${i * 36})`} />)}<circle r={26} fill="#FFD75E" /></g>,
  moon: <path d="M 10 -40 A 40 40 0 1 0 30 30 A 32 32 0 1 1 10 -40 Z" fill="#FEF3C7" />,
  star: <path d="M 0 -42 L 12 -14 L 42 -12 L 18 8 L 26 38 L 0 22 L -26 38 L -18 8 L -42 -12 L -12 -14 Z" fill={C.yellow} />,
  globe: <g><circle r={42} fill="#38BDF8" /><path d="M -30 -20 Q -10 -30 0 -14 Q 10 -4 -6 6 Q -20 14 -14 30 Q -34 18 -30 -20 Z M 10 -36 Q 30 -26 34 -6 Q 20 0 14 -12 Q 6 -22 10 -36 Z" fill={C.green} /></g>,
  magnifier: <g><circle cx={-8} cy={-8} r={26} fill="#E0F2FE" stroke={C.navy} strokeWidth={8} /><path d="M 12 12 L 38 38" stroke={C.navy} strokeWidth={12} strokeLinecap="round" /></g>,
  camera: <g><rect x={-44} y={-24} width={88} height={56} rx={10} fill="#334155" /><rect x={-16} y={-36} width={32} height={14} rx={4} fill="#334155" /><circle cy={4} r={18} fill="#93C5FD" stroke="#1F2937" strokeWidth={6} /></g>,
  letter: <g><rect x={-44} y={-28} width={88} height={56} rx={6} fill="#fff" stroke={C.navy} strokeWidth={5} /><path d="M -44 -28 L 0 6 L 44 -28" stroke={C.navy} strokeWidth={5} fill="none" /></g>,
  crown: <path d="M -40 24 L -40 -16 L -20 2 L 0 -30 L 20 2 L 40 -16 L 40 24 Z" fill={C.yellow} stroke={C.gold} strokeWidth={5} />,
  dna: <g fill="none" strokeWidth={6}><path d="M -14 -44 Q 30 -22 -14 0 Q -58 22 -14 44" stroke={C.purple} /><path d="M 14 -44 Q -30 -22 14 0 Q 58 22 14 44" stroke={C.pink} /></g>,
  virus: <g><circle r={26} fill={C.green} />{[...Array(8)].map((_, i) => <g key={i} transform={`rotate(${i * 45})`}><rect x={-3} y={-42} width={6} height={16} fill={C.green} /><circle cy={-44} r={6} fill="#15803D" /></g>)}</g>,
  bone: <g transform="rotate(-30)"><rect x={-30} y={-8} width={60} height={16} fill="#F8FAFC" /><circle cx={-32} cy={-10} r={11} fill="#F8FAFC" /><circle cx={-32} cy={10} r={11} fill="#F8FAFC" /><circle cx={32} cy={-10} r={11} fill="#F8FAFC" /><circle cx={32} cy={10} r={11} fill="#F8FAFC" /></g>,
  eye: <g><path d="M -46 0 Q 0 -40 46 0 Q 0 40 -46 0 Z" fill="#fff" stroke={C.navy} strokeWidth={5} /><circle r={16} fill="#2563EB" /><circle r={7} fill="#111" /></g>,
  house: <g><path d="M -40 -2 L 0 -38 L 40 -2 Z" fill={C.red} /><rect x={-32} y={-4} width={64} height={44} fill="#FDE68A" /><rect x={-8} y={14} width={16} height={26} fill="#7C4A1E" /></g>,
  car: <g><path d="M -46 10 L -46 -6 L -24 -8 L -12 -26 L 16 -26 L 30 -8 L 46 -4 L 46 10 Z" fill="#3B82F6" /><circle cx={-24} cy={14} r={11} fill="#1F2937" /><circle cx={24} cy={14} r={11} fill="#1F2937" /><path d="M -8 -22 L 12 -22 L 22 -8 L -16 -8 Z" fill="#BFDBFE" /></g>,
  gun: <g><path d="M -40 -14 L 30 -14 L 30 2 L -6 2 L -14 26 L -30 26 L -24 2 L -40 2 Z" fill="#334155" /></g>,
  shield: <path d="M 0 -44 L 36 -30 Q 36 22 0 44 Q -36 22 -36 -30 Z" fill="#3B82F6" stroke="#1E3A8A" strokeWidth={5} />,
  chart: <g><rect x={-40} y={10} width={18} height={30} fill={C.blue} /><rect x={-10} y={-10} width={18} height={50} fill={C.yellow} /><rect x={20} y={-34} width={18} height={74} fill={C.red} /></g>,
  hourglass: <g><path d="M -26 -40 L 26 -40 L 2 0 L 26 40 L -26 40 L -2 0 Z" fill="#FEF3C7" stroke={C.gold} strokeWidth={5} /><path d="M -14 34 L 14 34 L 0 18 Z" fill={C.yellow} /></g>,
  thermometer: <g><rect x={-10} y={-44} width={20} height={64} rx={10} fill="#fff" stroke="#334155" strokeWidth={4} /><circle cy={30} r={16} fill={C.red} /><rect x={-4} y={-10} width={8} height={40} fill={C.red} /></g>,
  submarine: <g transform="scale(0.24)"><ellipse rx={180} ry={96} fill={C.yellow} stroke={C.gold} strokeWidth={14} /><rect x={-40} y={-140} width={80} height={60} rx={14} fill={C.yellow} /><circle cx={-40} r={46} fill="#8ED8FF" stroke={C.gold} strokeWidth={10} /></g>,
  fish: <g><path d="M 24 0 L 46 -16 L 46 16 Z" fill={C.orange} /><ellipse rx={28} ry={15} fill={C.orange} /><circle cx={-16} cy={-3} r={4.5} fill="#fff" /><circle cx={-17} cy={-3} r={2.2} fill="#111" /></g>,
  shark: <g><path d="M -50 6 Q -10 -26 40 -4 L 56 -18 L 52 8 L 58 22 L 40 10 Q -10 26 -50 6 Z" fill="#64748B" /><path d="M -4 -14 L 6 -38 L 18 -12 Z" fill="#64748B" /><circle cx={-30} cy={0} r={3} fill="#111" /></g>,
  ice: <g><path d="M -40 30 L -30 -24 L 0 -36 L 34 -20 L 42 30 Z" fill="#E0F2FE" stroke="#7DD3FC" strokeWidth={5} /></g>,
  food: <g><path d="M -42 0 A 42 30 0 0 0 42 0 Z" fill="#fff" stroke="#94A3B8" strokeWidth={4} /><circle cx={-12} cy={-6} r={12} fill={C.red} /><circle cx={12} cy={-8} r={10} fill={C.green} /></g>,
  coffin: <path d="M -18 -46 L 18 -46 L 30 -18 L 18 46 L -18 46 L -30 -18 Z" fill="#7C4A1E" stroke="#451A03" strokeWidth={5} />,
  cross_grave: <g><path d="M -30 40 Q -30 -40 0 -40 Q 30 -40 30 40 Z" fill="#94A3B8" /><text x={0} y={14} fontSize={26} fontWeight={900} fill="#475569" textAnchor="middle" fontFamily={FONT}>RIP</text></g>,
  arrow: <path d="M -40 -12 L 10 -12 L 10 -30 L 44 0 L 10 30 L 10 12 L -40 12 Z" fill={C.red} />,
  pin: <g><path d="M 0 40 Q -30 0 -30 -12 A 30 30 0 0 1 30 -12 Q 30 0 0 40 Z" fill={C.red} /><circle cy={-12} r={11} fill="#fff" /></g>,
  calendar: <g><rect x={-38} y={-34} width={76} height={72} rx={8} fill="#fff" stroke={C.navy} strokeWidth={5} /><rect x={-38} y={-34} width={76} height={20} rx={8} fill={C.red} /><text x={0} y={26} fontSize={34} fontWeight={900} fill={C.navy} textAnchor="middle" fontFamily={FONT}>31</text></g>,
  radio: <g><rect x={-40} y={-20} width={80} height={52} rx={8} fill="#7C4A1E" /><circle cx={-14} cy={6} r={14} fill="#1F2937" /><rect x={8} y={-6} width={24} height={6} fill={C.yellow} /><path d="M 20 -20 L 34 -44" stroke="#334155" strokeWidth={4} /></g>,
  tv: <g><rect x={-46} y={-32} width={92} height={60} rx={8} fill="#1F2937" /><rect x={-38} y={-24} width={76} height={44} rx={4} fill="#60A5FA" /><path d="M -14 -42 L 0 -32 L 14 -42" stroke="#1F2937" strokeWidth={4} fill="none" /></g>,
};
export const ICONS = Object.keys(I);
export const Icon = ({name, x = 0, y = 0, s = 1, op = 1, rot = 0}) => I[name] ? <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} opacity={op}>{I[name]}</g> : null;

// ───────────────────────── backdrops ─────────────────────────
const Cloud = ({x, y, s = 1}) => <g transform={`translate(${x} ${y}) scale(${s})`} fill="#fff" opacity={0.95}><ellipse rx={90} ry={40} /><ellipse cx={-50} cy={10} rx={60} ry={32} /><ellipse cx={55} cy={12} rx={70} ry={34} /><ellipse cx={10} cy={-24} rx={55} ry={36} /></g>;
const Skyline = ({f, color, lit, seed = 3}) => {
  const R = rng(seed), b = [];
  let x = -40;
  while (x < W + 40) { const w = 90 + R() * 120, h = 160 + R() * 360; b.push({x, w, h, win: R()}); x += w + 6; }
  return (<g>{b.map((k, i) => (<g key={i}><rect x={k.x} y={GROUND - k.h} width={k.w} height={k.h} fill={color} />
    {lit && [...Array(Math.floor(k.h / 46))].map((_, r) => [...Array(Math.floor(k.w / 34))].map((_, c) => {
      const on = ((i * 7 + r * 3 + c) % 5) < 2;
      return on ? <rect key={r + '-' + c} x={k.x + 10 + c * 34} y={GROUND - k.h + 16 + r * 46} width={16} height={22} fill="#FDE68A" opacity={0.8} /> : null; }))}</g>))}</g>);
};
const Ground = ({fill, y = GROUND}) => <rect x={-100} y={y} width={W + 200} height={H - y + 200} fill={fill} />;

export const BACKDROPS = ['sky', 'ocean', 'underwater', 'deep', 'city_day', 'city_night', 'room', 'office', 'prison', 'prison_yard', 'desert',
  'jungle', 'snow', 'space', 'lab', 'hospital', 'tunnel', 'battlefield', 'courtroom', 'street', 'night', 'dark', 'red', 'plain'];

export function Backdrop({bg = 'plain', f = 0, depth = 0.5, color}) {
  switch (bg) {
    case 'sky': return (<g><rect width={W} height={H} fill="#7DD3FC" /><g transform={`translate(260 180) rotate(${f * 0.4})`}><Icon name="sun" s={2.6} /></g>
      <Cloud x={480 + f * 0.6} y={260} /><Cloud x={1500 + f * 0.9} y={150} s={1.2} /><Cloud x={1020 + f * 0.4} y={420} s={0.8} /><Ground fill="#86EFAC" /><rect x={-100} y={GROUND} width={W + 200} height={14} fill="#4ADE80" /></g>);
    case 'ocean': {
      const wave = (ph, y) => { let p = `M -20 ${y}`; for (let x = -20; x <= W + 20; x += 40) p += ` L ${x} ${y + Math.sin(x / 110 + f * 0.12 + ph) * 14}`; return p + ` L ${W + 20} ${H + 20} L -20 ${H + 20} Z`; };
      return (<g><rect width={W} height={H} fill="#7DD3FC" /><Cloud x={500 + f * 0.6} y={200} /><Cloud x={1450 + f * 0.8} y={130} s={1.2} /><path d={wave(1.2, 616)} fill="#1E88CF" /><path d={wave(0, 650)} fill="#2FA7E0" /></g>);
    }
    case 'underwater': case 'deep': {
      const d = bg === 'deep' ? 0.9 : depth;
      const c = interpolate(d, [0, 0.3, 0.6, 1], [0, 1, 2, 3]);
      const stops = ['#2FA7E0', '#1B6FB5', '#0C3F7A', '#020A18'];
      const top = stops[Math.floor(clamp(c, 0, 3))];
      const R = rng(7);
      return (<g><rect width={W} height={H} fill={top} />
        {d < 0.4 && [...Array(6)].map((_, i) => { const x = 200 + i * 300; return <path key={i} d={`M ${x - 60} -50 L ${x + 60} -50 L ${x + 260} 1130 L ${x - 160} 1130 Z`} fill="#fff" opacity={0.08 + 0.05 * Math.sin(f * 0.08 + i)} />; })}
        {[...Array(40)].map((_, i) => { const x = R() * W, y0 = R() * 1200, sp = 1.5 + R() * 2.5, r = 3 + R() * 8; const y = (((y0 - f * sp) % 1200) + 1200) % 1200 - 60;
          return <circle key={i} cx={x + Math.sin(f * 0.08 + i) * 6} cy={y} r={r} fill="none" stroke="#fff" strokeWidth={3} opacity={0.35} />; })}
        {d > 0.6 && <path d={`M -20 ${H - 120} Q 300 ${H - 170} 600 ${H - 130} T 1200 ${H - 140} T 1940 ${H - 120} L 1940 ${H + 20} L -20 ${H + 20} Z`} fill="#1F2937" />}</g>);
    }
    case 'city_day': return (<g><rect width={W} height={H} fill="#BAE6FD" /><Cloud x={400 + f * 0.5} y={180} /><Cloud x={1400 + f * 0.7} y={120} s={0.9} /><Skyline f={f} color="#94A3B8" seed={4} /><g transform="translate(0 40)"><Skyline f={f} color="#64748B" seed={9} /></g><Ground fill="#6B7280" /><rect x={-100} y={GROUND + 60} width={W + 200} height={12} fill="#FDE68A" /></g>);
    case 'city_night': case 'street': return (<g><rect width={W} height={H} fill={bg === 'street' ? '#1E293B' : '#0F172A'} /><g transform="translate(1600 170)"><Icon name="moon" s={1.6} /></g>
      {[...Array(30)].map((_, i) => { const R = rng(i + 1); return <circle key={i} cx={R() * W} cy={R() * 420} r={2 + R() * 2} fill="#fff" opacity={0.5 + 0.4 * Math.sin(f * 0.1 + i)} />; })}
      <Skyline f={f} color="#1E293B" lit seed={5} /><g transform="translate(0 50)"><Skyline f={f} color="#334155" lit seed={8} /></g><Ground fill="#111827" />
      {bg === 'street' && [200, 900, 1600].map((x) => <g key={x}><rect x={x} y={GROUND - 320} width={10} height={320} fill="#475569" /><circle cx={x + 5} cy={GROUND - 330} r={18} fill="#FDE68A" /><path d={`M ${x + 5} ${GROUND - 320} L ${x - 140} ${GROUND} L ${x + 150} ${GROUND} Z`} fill="#FDE68A" opacity={0.12} /></g>)}</g>);
    case 'room': return (<g><rect width={W} height={H} fill="#FDE7C8" /><rect y={GROUND - 30} width={W} height={30} fill="#E8C79A" /><Ground fill="#B07A4A" />
      <rect x={1300} y={200} width={360} height={300} rx={12} fill="#7DD3FC" stroke="#fff" strokeWidth={18} /><path d="M 1480 200 L 1480 500 M 1300 350 L 1660 350" stroke="#fff" strokeWidth={10} />
      <rect x={300} y={240} width={220} height={160} fill="#fff" stroke="#B07A4A" strokeWidth={10} /><path d="M 320 380 L 380 300 L 430 350 L 470 310 L 500 380 Z" fill="#86EFAC" /></g>);
    case 'office': return (<g><rect width={W} height={H} fill="#E2E8F0" /><Ground fill="#94A3B8" />{[0, 1, 2].map((i) => <rect key={i} x={200 + i * 560} y={180} width={360} height={240} fill="#BFDBFE" stroke="#fff" strokeWidth={14} />)}
      <rect x={1180} y={GROUND - 150} width={520} height={24} fill="#7C4A1E" /><rect x={1200} y={GROUND - 126} width={20} height={126} fill="#7C4A1E" /><rect x={1660} y={GROUND - 126} width={20} height={126} fill="#7C4A1E" /><g transform={`translate(1440 ${GROUND - 196})`}><Icon name="tv" s={0.9} /></g></g>);
    case 'prison': return (<g><rect width={W} height={H} fill="#9CA3AF" />{[...Array(12)].map((_, r) => [...Array(14)].map((_, c) => <rect key={r + '-' + c} x={c * 140 + (r % 2) * 70} y={r * 70} width={134} height={64} fill="#A8B0BB" />))}
      <Ground fill="#6B7280" /><rect x={1350} y={300} width={380} height={GROUND - 300} fill="#4B5563" />{[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={1360 + i * 64} y={300} width={12} height={GROUND - 300} fill="#1F2937" />)}
      <rect x={300} y={180} width={160} height={110} fill="#1F2937" />{[0, 1, 2].map((i) => <rect key={i} x={318 + i * 50} y={180} width={10} height={110} fill="#6B7280" />)}</g>);
    case 'prison_yard': return (<g><rect width={W} height={H} fill="#CBD5E1" /><rect y={260} width={W} height={GROUND - 260} fill="#9CA3AF" /><rect y={240} width={W} height={24} fill="#6B7280" />
      {[...Array(25)].map((_, i) => <path key={i} d={`M ${i * 80} 240 l 20 -30 l 20 30`} stroke="#475569" strokeWidth={4} fill="none" />)}<rect x={1500} y={60} width={160} height={200} fill="#6B7280" /><rect x={1480} y={40} width={200} height={30} fill="#475569" />
      <path d={`M 1580 70 L ${1300 + Math.sin(f * 0.02) * 300} ${GROUND} L ${1500 + Math.sin(f * 0.02) * 300} ${GROUND} Z`} fill="#FEF3C7" opacity={0.25} /><Ground fill="#A8A29E" /></g>);
    case 'desert': return (<g><rect width={W} height={H} fill="#FDBA74" /><g transform="translate(1500 220)"><Icon name="sun" s={3} /></g><path d={`M -20 700 Q 400 560 900 700 T 1940 660 L 1940 1100 L -20 1100 Z`} fill="#F59E0B" /><path d={`M -20 ${GROUND} Q 500 760 1100 ${GROUND} T 1940 840 L 1940 1100 L -20 1100 Z`} fill="#FCD34D" /></g>);
    case 'jungle': return (<g><rect width={W} height={H} fill="#14532D" />{[...Array(14)].map((_, i) => <ellipse key={i} cx={i * 150} cy={300 + (i % 3) * 60} rx={140} ry={240} fill={i % 2 ? '#166534' : '#15803D'} />)}
      {[...Array(10)].map((_, i) => <path key={i} d={`M ${i * 210} ${GROUND} Q ${i * 210 + 40 + Math.sin(f * 0.05 + i) * 10} ${GROUND - 200} ${i * 210 + 120} ${GROUND - 260}`} stroke="#22C55E" strokeWidth={22} fill="none" strokeLinecap="round" />)}<Ground fill="#3F2A14" /></g>);
    case 'snow': return (<g><rect width={W} height={H} fill="#BFDBFE" /><path d="M -20 700 L 400 300 L 700 600 L 1100 200 L 1500 620 L 1940 380 L 1940 1100 L -20 1100 Z" fill="#94A3B8" /><path d="M 400 300 L 480 380 L 330 370 Z M 1100 200 L 1200 300 L 1010 290 Z" fill="#F8FAFC" /><Ground fill="#F8FAFC" />
      {[...Array(60)].map((_, i) => { const R = rng(i + 50); const x = R() * W, y0 = R() * H, sp = 1 + R() * 2; const y = ((y0 + f * sp) % H); return <circle key={i} cx={x + Math.sin(f * 0.03 + i) * 20} cy={y} r={3 + R() * 3} fill="#fff" />; })}</g>);
    case 'space': return (<g><rect width={W} height={H} fill="#020617" />{[...Array(120)].map((_, i) => { const R = rng(i + 200); return <circle key={i} cx={R() * W} cy={R() * H} r={1 + R() * 2.5} fill="#fff" opacity={0.4 + 0.5 * Math.abs(Math.sin(f * 0.05 + i))} />; })}
      <circle cx={1550} cy={820} r={420} fill="#2563EB" /><path d="M 1250 700 Q 1400 620 1520 720 Q 1620 800 1480 900 Q 1350 960 1250 860 Z" fill="#22A06B" /><circle cx={300} cy={220} r={70} fill="#E5E7EB" /><circle cx={280} cy={200} r={14} fill="#CBD5E1" /></g>);
    case 'lab': return (<g><rect width={W} height={H} fill="#E0F2FE" />{[...Array(8)].map((_, r) => [...Array(16)].map((_, c) => <rect key={r + '-' + c} x={c * 122} y={r * 110} width={118} height={106} fill="#F0F9FF" />))}
      <Ground fill="#CBD5E1" /><rect x={1150} y={GROUND - 170} width={600} height={30} fill="#64748B" />{[0, 1, 2].map((i) => <g key={i} transform={`translate(${1260 + i * 170} ${GROUND - 220})`}><path d="M -16 -50 L 16 -50 L 16 -10 L 40 40 L -40 40 L -16 -10 Z" fill={[C.green, C.purple, C.pink][i]} opacity={0.75} stroke="#334155" strokeWidth={4} /></g>)}</g>);
    case 'hospital': return (<g><rect width={W} height={H} fill="#D1FAE5" /><Ground fill="#A7F3D0" /><rect x={1150} y={GROUND - 200} width={560} height={90} rx={20} fill="#fff" stroke="#94A3B8" strokeWidth={6} /><rect x={1150} y={GROUND - 110} width={16} height={110} fill="#94A3B8" /><rect x={1694} y={GROUND - 110} width={16} height={110} fill="#94A3B8" />
      <g transform="translate(400 220)"><rect x={-60} y={-20} width={120} height={40} fill={C.red} /><rect x={-20} y={-60} width={40} height={120} fill={C.red} /></g>
      <rect x={1000} y={200} width={160} height={120} rx={10} fill="#0F172A" /><path d={`M 1010 260 L 1040 260 L 1055 ${230 + 30 * Math.sin(f * 0.3)} L 1070 290 L 1085 260 L 1150 260`} stroke="#4ADE80" strokeWidth={5} fill="none" /></g>);
    case 'tunnel': return (<g><rect width={W} height={H} fill="#1C1209" /><ellipse cx={W / 2} cy={H / 2} rx={760} ry={520} fill="#3F2A14" /><ellipse cx={W / 2} cy={H / 2} rx={520} ry={360} fill="#2A1C0D" /><ellipse cx={W / 2} cy={H / 2} rx={240} ry={170} fill="#120B04" />
      {[...Array(9)].map((_, i) => <rect key={i} x={W / 2 - 600 + i * 150} y={H / 2 - 400} width={18} height={800} fill="#5B3A1A" opacity={0.6} />)}<Ground fill="#2A1C0D" y={GROUND + 40} /></g>);
    case 'battlefield': return (<g><rect width={W} height={H} fill="#D6D3C4" />{[...Array(5)].map((_, i) => <circle key={i} cx={300 + i * 360} cy={500 - (f * 0.5 + i * 40) % 200} r={120 + i * 10} fill="#A8A29E" opacity={0.35} />)}
      <path d={`M -20 760 Q 500 700 1000 760 T 1940 740 L 1940 1100 L -20 1100 Z`} fill="#8B8A5A" /><Ground fill="#6B6A3A" />{[0, 1, 2].map((i) => <g key={i} transform={`translate(${300 + i * 600} ${GROUND + 10})`}><path d="M -60 0 L -40 -30 L 40 -30 L 60 0 Z" fill="#57534E" /></g>)}</g>);
    case 'courtroom': return (<g><rect width={W} height={H} fill="#7C4A1E" />{[...Array(10)].map((_, i) => <rect key={i} x={i * 200} y={0} width={14} height={H} fill="#6B3E17" />)}<rect x={560} y={220} width={800} height={300} fill="#5B3410" /><rect x={600} y={180} width={720} height={60} fill="#92400E" />
      <g transform="translate(960 160)"><Icon name="shield" s={1.2} /></g><Ground fill="#451A03" /></g>);
    case 'night': return (<g><rect width={W} height={H} fill="#0B1226" />{[...Array(80)].map((_, i) => { const R = rng(i + 400); return <circle key={i} cx={R() * W} cy={R() * 600} r={1.5 + R() * 2} fill="#fff" opacity={0.6} />; })}<g transform="translate(1600 200)"><Icon name="moon" s={1.8} /></g><Ground fill="#1E293B" /></g>);
    case 'dark': return (<g><radialGradient id="dk" cx="0.5" cy="0.5" r="0.7"><stop offset="0" stopColor="#0B2A52" /><stop offset="1" stopColor="#020A18" /></radialGradient><rect width={W} height={H} fill="url(#dk)" /></g>);
    case 'red': return (<g><radialGradient id="rd" cx="0.5" cy="0.5" r="0.7"><stop offset="0" stopColor="#7F1D1D" /><stop offset="1" stopColor="#1C0505" /></radialGradient><rect width={W} height={H} fill="url(#rd)" /></g>);
    default: return <rect width={W} height={H} fill={col(color, '#1E3A5F')} />;
  }
}

// ───────────────────────── cards, banners, tags (the Fable POC's) ─────────────────────────
export function Card({title, big, sub, color = 'blue', f = 0, at = 0, x = 110, y = 110}) {
  const s = pop(f, at, 130, 13);
  const xx = interpolate(clamp(s, 0, 1.1), [0, 1], [-900, x]);
  const subs = wrap(sub, 38);
  const h = 190 + subs.length * 42;
  const bigSize = String(big || '').length > 14 ? 52 : 66;
  return (
    <g transform={`translate(${xx} ${y})`}>
      <rect x={8} y={14} width={760} height={h} rx={30} fill="#000" opacity={0.22} />
      <rect width={760} height={h} rx={30} fill="#fff" />
      <rect width={760} height={78} rx={30} fill={col(color)} /><rect y={40} width={760} height={38} fill={col(color)} />
      <T x={36} y={54} size={38} fill="#fff">{String(title || '').toUpperCase()}</T>
      <T x={36} y={156} size={bigSize}>{big}</T>
      <rect x={36} y={176} width={110} height={8} rx={4} fill={col(color)} />
      {subs.map((l, i) => <T key={i} x={36} y={228 + i * 42} size={32} weight={700} fill={C.grey}>{l}</T>)}
    </g>
  );
}

export function Banner({title, sub, color = 'red', f = 0, at = 0, x = 110, y = 110}) {
  const s = pop(f, at, 140, 12);
  const titleSize = String(title || '').length > 22 ? 50 : 62;
  const width = Math.max(700, Math.min(1500, String(title || '').length * titleSize * 0.62 + 160, String(sub || '').length * 19 + 160));
  const xx = interpolate(clamp(s, 0, 1.1), [0, 1], [-width - 200, x]);
  return (
    <g transform={`translate(${xx} ${y})`}>
      <rect x={8} y={14} width={width} height={sub ? 190 : 130} rx={30} fill="#000" opacity={0.22} />
      <rect width={width} height={sub ? 190 : 130} rx={30} fill="#fff" />
      <rect width={60} height={sub ? 190 : 130} rx={30} fill={col(color)} /><rect x={30} width={30} height={sub ? 190 : 130} fill="#fff" />
      <T x={90} y={sub ? 84 : 86} size={titleSize}>{String(title || '').toUpperCase()}</T>
      {sub && <T x={90} y={150} size={36} weight={700} fill={C.grey}>{sub}</T>}
    </g>
  );
}

export function Tag({text, x, y, f = 0, at = 0, color = '#fff', ink = C.ink, leader}) {
  const s = clamp(pop(f, at, 150, 13), 0, 1.2);
  const w = String(text).length * 23 + 52;
  return (
    <g opacity={clamp(s, 0, 1)}>
      {leader && <path d={`M ${leader[0]} ${leader[1]} L ${x} ${y + 42}`} stroke="#fff" strokeWidth={4} strokeDasharray="10 10" />}
      {leader && <circle cx={leader[0]} cy={leader[1]} r={9} fill="#fff" />}
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <rect x={4} y={8} width={w} height={84} rx={20} fill="#000" opacity={0.2} />
        <rect width={w} height={84} rx={20} fill={col(color, '#fff')} />
        <T x={26} y={56} size={40} fill={ink}>{String(text).toUpperCase()}</T>
      </g>
    </g>
  );
}

// speech bubble above a person
export function Bubble({text, x, y, f = 0, at = 0, w = 520}) {
  const s = clamp(pop(f, at, 160, 12), 0, 1.15);
  const lines = wrap(text, Math.floor(w / 24));
  const h = 40 + lines.length * 46;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={clamp(s, 0, 1)}>
      <rect x={-w / 2} y={-h} width={w} height={h} rx={28} fill="#fff" stroke={C.navy} strokeWidth={5} />
      <path d={`M -20 -2 L 0 34 L 20 -2 Z`} fill="#fff" stroke={C.navy} strokeWidth={5} /><rect x={-24} y={-8} width={48} height={8} fill="#fff" />
      {lines.map((l, i) => <T key={i} x={0} y={-h + 58 + i * 46} size={38} weight={800} anchor="middle">{l}</T>)}
    </g>
  );
}

export const fmt = fmtNum;
