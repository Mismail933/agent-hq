// The Infographics Show look (2.49.0): dark outlines, two-tone shading, exaggerated faces, Oswald title boxes.
// Every part is a pure function of the frame `f`.
import React from 'react';
import {spring, interpolate, Easing} from 'remotion';

export const W = 1920, H = 1080, FPS = 30;
export const INK = '#141414';
export const OSWALD = "'Oswald', 'Impact', sans-serif";
export const ST = {stroke: INK, strokeWidth: 7, strokeLinejoin: 'round', strokeLinecap: 'round'};
export const st = (w) => ({stroke: INK, strokeWidth: w, strokeLinejoin: 'round', strokeLinecap: 'round'});
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ease = Easing.bezier(0.45, 0, 0.55, 1);
export const lin = (f, a, b, x, y, e = ease) => interpolate(f, [a, b], [x, y], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e});
export const pop = (f, at = 0, stiffness = 150, damping = 13) => spring({frame: f - at, fps: FPS, config: {stiffness, damping}});
export const rng = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// ───────────────── title boxes and labels ─────────────────
export const Box = ({x, y, w, h, text, fill = '#FFE11A', color = INK, outline = false, rot = 0, s = 1}) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
    <rect x={8} y={10} width={w} height={h} fill="#000" opacity={0.35} />
    <rect width={w} height={h} fill={fill} stroke={INK} strokeWidth={7} />
    <text x={w / 2} y={h * 0.83} textAnchor="middle" fontFamily={OSWALD} fontWeight={700} fontSize={h * 0.93} fill={color}
      textLength={w - 40} lengthAdjust="spacingAndGlyphs" stroke={outline ? INK : 'none'} strokeWidth={outline ? 10 : 0} paintOrder="stroke" strokeLinejoin="round">{text}</text>
  </g>
);
// a label that pops on its frame: yellow box, Oswald, width from the text length
export const Label = ({x, y, text, f, at = 0, fill = '#FFE11A', color = INK, h = 76, rot = -2}) => {
  const s = clamp(pop(f, at, 170, 12), 0, 1.15);
  const w = Math.max(160, String(text).length * h * 0.43 + 40);
  return s > 0.01 ? <Box x={x} y={y} w={w} h={h} text={text} fill={fill} color={color} rot={rot} s={s} /> : null;
};

// ───────────────── faces ─────────────────
const SKIN = {light: '#F2C29B', shade: '#D99C72', cheek: '#E8846A'};
export const SKINS = {light: SKIN, tan: {light: '#C98E5F', shade: '#A9724A', cheek: '#B86B4E'}};
const blinkAt = (f, seed) => ((f + seed * 41) % 100) < 4;

function Eyes({expr, f, seed, look = 0, lookY = 0}) {
  if (expr === 'closed') return (
    <g fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round"><path d="M -82 -26 Q -50 -10 -18 -26" /><path d="M 18 -26 Q 50 -10 82 -26" /></g>
  );
  const big = expr === 'scared' || expr === 'shock';
  const half = expr === 'grim' || expr === 'waking' || expr === 'sad';
  const rx = big ? 40 : 32, ry = big ? 38 : 27, pr = big ? 7 : 10;
  const blink = !big && blinkAt(f, seed);
  return [-50, 50].map((ex) => (
    <g key={ex}>
      <ellipse cx={ex} cy={-26} rx={rx} ry={blink ? 3 : ry} fill="#fff" {...ST} />
      {!blink && <circle cx={ex + look + (big ? (ex < 0 ? 6 : -6) : 2)} cy={(expr === 'sad' ? -18 : -24) + lookY} r={pr} fill={INK} />}
      {!blink && !big && <circle cx={ex + look + 6} cy={-29 + lookY} r={3.5} fill="#fff" />}
      {half && !blink && <path d={`M ${ex - rx - 2} -28 Q ${ex} ${-26 - ry - 6} ${ex + rx + 2} -28 L ${ex + rx + 2} -60 L ${ex - rx - 2} -60 Z`} fill={SKIN.light} stroke="none" />}
      {half && !blink && <path d={`M ${ex - rx} -28 Q ${ex} -40 ${ex + rx} -28`} fill="none" {...ST} />}
    </g>
  ));
}

function Brows({expr, color}) {
  const p = {
    calm: ['M -86 -70 C -66 -80 -38 -82 -16 -74', 'M 86 -70 C 66 -80 38 -82 16 -74'],
    smile: ['M -86 -72 C -66 -86 -38 -88 -16 -78', 'M 86 -72 C 66 -86 38 -88 16 -78'],
    worried: ['M -90 -72 C -66 -80 -40 -92 -18 -108', 'M 90 -72 C 66 -80 40 -92 18 -108'],
    scared: ['M -98 -80 C -72 -92 -42 -106 -18 -128', 'M 98 -80 C 72 -92 42 -106 18 -128'],
    shock: ['M -96 -96 C -72 -114 -40 -116 -18 -104', 'M 96 -96 C 72 -114 40 -116 18 -104'],
    grim: ['M -88 -66 L -18 -66', 'M 88 -66 L 18 -66'],
    sad: ['M -88 -62 C -68 -66 -42 -76 -18 -94', 'M 88 -62 C 68 -66 42 -76 18 -94'],
    determined: ['M -88 -84 C -66 -82 -40 -74 -18 -62', 'M 88 -84 C 66 -82 40 -74 18 -62'],
    waking: ['M -90 -70 C -66 -78 -40 -88 -18 -100', 'M 90 -70 C 66 -78 40 -88 18 -100'],
    closed: ['M -86 -62 C -66 -70 -38 -72 -16 -64', 'M 86 -62 C 66 -70 38 -72 16 -64'],
  }[expr] || ['M -86 -70 C -66 -80 -38 -82 -16 -74', 'M 86 -70 C 66 -80 38 -82 16 -74'];
  return <g stroke={color} strokeWidth={13} fill="none" strokeLinecap="round">{p.map((d, i) => <path key={i} d={d} />)}</g>;
}

function Mouth({expr, talk, f}) {
  if (talk) {
    const o = [6, 22, 14, 26, 10][Math.floor(f / 4) % 5];
    return <path d={`M -30 96 C -20 ${90 - o * 0.2} 20 ${90 - o * 0.2} 30 96 C 26 ${104 + o} -26 ${104 + o} -30 96 Z`} fill="#4A0F0F" {...st(6)} />;
  }
  switch (expr) {
    case 'smile': return <path d="M -40 92 C -20 116 20 116 40 92" fill="none" {...st(7)} />;
    case 'worried': return <path d="M -26 110 C -12 100 12 100 26 110" fill="none" {...st(7)} />;
    case 'grim': return <path d="M -30 104 L 30 104" fill="none" {...st(7)} />;
    case 'sad': return <path d="M -30 114 C -14 98 14 98 30 114" fill="none" {...st(7)} />;
    case 'determined': return <path d="M -28 104 C -10 100 10 100 28 104" fill="none" {...st(7)} />;
    case 'shock': return <ellipse cx={0} cy={110} rx={22} ry={30} fill="#4A0F0F" {...st(6)} />;
    case 'scared': return (<g>
      <path d="M -34 84 C -30 66 30 66 34 84 C 44 124 30 172 0 174 C -30 172 -44 124 -34 84 Z" fill="#4A0F0F" {...ST} />
      <path d="M -28 80 C -18 72 18 72 28 80 L 27 92 C 12 86 -12 86 -27 92 Z" fill="#fff" />
      <path d="M -20 142 C -10 132 10 132 20 142 C 12 150 -12 150 -20 142 Z" fill="#E36B6B" /></g>);
    case 'closed': case 'waking': return <path d="M -18 108 C -6 104 6 104 18 108" fill="none" {...st(6)} />;
    default: return <path d="M -26 103 C -10 105 10 105 26 103" fill="none" {...st(7)} />;   // calm: neutral, not a smile
  }
}

// people: hair, skin, clothes
export const CAST = {
  juliane: {hair: '#5B3317', hairLight: '#7E4A26', brow: '#3B1E0C', dress: '#D62828', dressShade: '#A11D1D', style: 'long', lips: true},
  mother: {hair: '#2B1A10', hairLight: '#4A2E1C', brow: '#22140A', dress: '#2B6CB0', dressShade: '#1F4F85', style: 'bob', glasses: true, lips: true},
  father: {hair: '#6B5B4B', hairLight: '#8A7764', brow: '#4A3B2E', dress: '#B8A06A', dressShade: '#8F7A4D', style: 'short', beard: true, glasses: true},
  passenger: {hair: '#1F2937', hairLight: '#374151', brow: '#111827', dress: '#4B5563', dressShade: '#374151', style: 'short'},
  passenger2: {hair: '#A16207', hairLight: '#CA8A04', brow: '#713F12', dress: '#15803D', dressShade: '#166534', style: 'bob', lips: true},
  worker1: {hair: '#1C1410', hairLight: '#3A2A1E', brow: '#120C08', dress: '#E5E7EB', dressShade: '#C9CDD3', style: 'short', hat: 'straw', mustache: true, skin: 'tan'},
  worker2: {hair: '#1C1410', hairLight: '#3A2A1E', brow: '#120C08', dress: '#3B6E4F', dressShade: '#2C5440', style: 'short', hat: 'cap', skin: 'tan'},
  worker3: {hair: '#2A1A10', hairLight: '#4A3020', brow: '#1A0F08', dress: '#B45309', dressShade: '#8A3F07', style: 'short', mustache: true, skin: 'tan'},
  doctor: {hair: '#3B2A1E', hairLight: '#5A4030', brow: '#2A1A10', dress: '#F8FAFC', dressShade: '#DDE3EA', style: 'short', glasses: true},
  juliane_now: {hair: '#8A7A6A', hairLight: '#A89888', brow: '#5A4A3A', dress: '#3F6E5A', dressShade: '#2E5444', style: 'bob', glasses: true, lips: true},
  chapman: {hair: '#2B1A10', hairLight: '#4A2E1C', brow: '#22140A', dress: '#1F3A5F', dressShade: '#16293F', style: 'short'},   // Storygraphics #2 (Pisces III)
  mallinson: {hair: '#6B4423', hairLight: '#8A5A30', brow: '#4A2E17', dress: '#7C2D12', dressShade: '#5C210D', style: 'short', mustache: true},
  chapman_old: {hair: '#9CA3AF', hairLight: '#D1D5DB', brow: '#6B7280', dress: '#1F3A5F', dressShade: '#16293F', style: 'short'},
  mallinson_old: {hair: '#D1D5DB', hairLight: '#F3F4F6', brow: '#9CA3AF', dress: '#7C2D12', dressShade: '#5C210D', style: 'short', mustache: true, glasses: true},
  pilot: {hair: '#2B1A10', hairLight: '#4A2E1C', brow: '#22140A', dress: '#E5E7EB', dressShade: '#C9CDD3', style: 'short', hat: 'cap', mustache: true},
  fisher1: {hair: '#3A2A1E', hairLight: '#5A4030', brow: '#2A1A10', dress: '#3E5468', dressShade: '#2E4052', style: 'short', hat: 'cap', beard: true, skin: 'tan'},   // Storygraphics #3: the 1918 crayfish crew
  fisher2: {hair: '#6B4423', hairLight: '#8A5A30', brow: '#4A2E17', dress: '#8A6A44', dressShade: '#6E5234', style: 'short', hat: 'cap', mustache: true},
  stead: {hair: '#4A3628', hairLight: '#6A5040', brow: '#33241A', dress: '#2F3140', dressShade: '#22232F', style: 'short', mustache: true, glasses: true},   // David G. Stead, ichthyologist
  shimada: {hair: '#16110E', hairLight: '#2E2620', brow: '#0E0A08', dress: '#334155', dressShade: '#1E293B', style: 'short', glasses: true},   // the 2025 size study, the 2022 zinc study
  tsch: {hair: '#9CA3AF', hairLight: '#C4C9D0', brow: '#6B7280', dress: '#6B5B45', dressShade: '#4F4232', style: 'short', glasses: true, mustache: true},   // W. Tschernezky, 1959
  actor: {hair: '#4A3628', hairLight: '#6A5040', brow: '#33241A', dress: '#7A8B5A', dressShade: '#5E6D44', style: 'short', hat: 'cap', beard: true},   // the 2013 film's 'marine biologist'
  wilcox: {hair: '#2B1A10', hairLight: '#4A2E1C', brow: '#22140A', dress: '#0F766E', dressShade: '#0B5A54', style: 'long', lips: true},   // science writer
  bernard: {hair: '#7A4A26', hairLight: '#9A6236', brow: '#5A3418', dress: '#7C3AED', dressShade: '#5B21B6', style: 'bob', glasses: true, lips: true},   // museum curator
  // Storygraphics #4: Tsutomu Yamaguchi (1945, in the civilian work uniform; and in old age), his Nagasaki boss, his family, the people around him
  yamaguchi: {hair: '#16110E', hairLight: '#2E2620', brow: '#0E0A08', dress: '#8C7E58', dressShade: '#6F6344', style: 'short', pants: '#6F6344'},   // pants: Figure's legs in trousers
  yamaguchi_old: {hair: '#D6D9DE', hairLight: '#F3F4F6', brow: '#A0A6AE', dress: '#3F4A5A', dressShade: '#2E3744', style: 'thin', glasses: true, pants: '#2E3744'},
  boss: {hair: '#3A3634', hairLight: '#55504C', brow: '#2A2624', dress: '#4A4F5A', dressShade: '#363A44', style: 'short', pants: '#363A44'},   // no round glasses + toothbrush moustache: too close to the wartime caricature (Israa)
  hisako: {hair: '#16110E', hairLight: '#2E2620', brow: '#0E0A08', dress: '#4A5D7A', dressShade: '#384862', style: 'bob', lips: true},
  ymother: {hair: '#8A8F98', hairLight: '#B0B5BD', brow: '#5A5F68', dress: '#6B5A48', dressShade: '#534537', style: 'bob'},
  classmate: {hair: '#16110E', hairLight: '#2E2620', brow: '#0E0A08', dress: '#F8FAFC', dressShade: '#DDE3EA', style: 'short', glasses: true, pants: '#4B5563'},
  colleague1: {hair: '#16110E', hairLight: '#2E2620', brow: '#0E0A08', dress: '#7D7454', dressShade: '#625B41', style: 'short', pants: '#625B41'},
  colleague2: {hair: '#231A14', hairLight: '#3A2E24', brow: '#150F0B', dress: '#857A58', dressShade: '#6A6045', style: 'short', glasses: true, pants: '#6A6045'},
  hisako_old: {hair: '#A8ADB5', hairLight: '#C9CDD3', brow: '#7A7F88', dress: '#4A5D7A', dressShade: '#384862', style: 'bob', lips: true, glasses: true},
  toshiko_girl: {hair: '#16110E', hairLight: '#2E2620', brow: '#0E0A08', dress: '#C2410C', dressShade: '#9A3412', style: 'bob', lips: true},
  toshiko: {hair: '#4A4038', hairLight: '#6A5E54', brow: '#2E2620', dress: '#7A3E5A', dressShade: '#5E2E45', style: 'long', lips: true},   // long dark hair, no glasses: not Hisako's grey bob (Israa)
  katsutoshi: {hair: '#43464D', hairLight: '#686C75', brow: '#2E3036', dress: '#B9CCE0', dressShade: '#94A9C2', style: 'short'},   // the son at 59: dark grey hair, no glasses, a light shirt (not his father, young or old)
  officer: {hair: '#7A5230', hairLight: '#9A6A40', brow: '#5A3A20', dress: '#5B6B3A', dressShade: '#46532C', style: 'short', hat: 'cap', pants: '#46532C'},   // a US occupation officer (no name)
  visitor: {hair: '#B8BEC6', hairLight: '#D1D5DB', brow: '#8A9099', dress: '#1F2937', dressShade: '#111827', style: 'short', beard: true, pants: '#111827'},
};

function HairBack({c, mode}) {
  if (mode === 'flying') return (<g>
    <path d="M -124 -50 C -176 -150 -196 -290 -164 -420 C -142 -350 -122 -300 -98 -262 C -112 -350 -80 -440 -24 -520 C -16 -430 -4 -350 12 -296 C 34 -380 90 -452 160 -500 C 136 -410 116 -340 104 -276 C 150 -340 214 -380 282 -404 C 240 -310 196 -224 124 -110 C 110 -150 60 -176 0 -178 C -70 -176 -112 -130 -124 -50 Z" fill={c.hair} {...ST} />
    <g stroke={c.hairLight} strokeWidth={6} fill="none" strokeLinecap="round"><path d="M -130 -170 C -148 -250 -152 -330 -146 -380" /><path d="M -60 -220 C -66 -300 -50 -390 -28 -460" /><path d="M 30 -240 C 50 -320 90 -400 136 -450" /><path d="M 120 -190 C 160 -250 210 -300 256 -340" /></g></g>);
  if (c.style === 'long') return <path d="M -136 -60 C -150 40 -150 160 -170 270 L 170 270 C 150 160 150 40 136 -60 C 120 -150 60 -196 0 -196 C -60 -196 -120 -150 -136 -60 Z" fill={c.hair} {...ST} />;
  if (c.style === 'bob') return <path d="M -140 -50 C -150 40 -140 110 -120 140 L 120 140 C 140 110 150 40 140 -50 C 124 -150 64 -196 0 -196 C -64 -196 -124 -150 -140 -50 Z" fill={c.hair} {...ST} />;
  return null;
}
function HairFront({c}) {
  if (c.style === 'thin') return (<g fill={c.hair} {...ST}>   {/* receding: hair only over the ears and at the back */}
    <path d="M -128 -10 C -134 -70 -118 -110 -92 -128 C -104 -96 -110 -60 -108 -16 Z" /><path d="M 128 -10 C 134 -70 118 -110 92 -128 C 104 -96 110 -60 108 -16 Z" /></g>);
  if (c.style === 'short') return <path d="M -126 -40 C -136 -150 -64 -196 0 -194 C 72 -196 140 -150 126 -40 C 116 -90 90 -124 40 -132 C 0 -138 -60 -136 -96 -110 C -112 -96 -122 -70 -126 -40 Z" fill={c.hair} {...ST} />;
  // a side part, hair swept over the forehead
  return <path d="M -128 -30 C -138 -150 -64 -198 0 -196 C 72 -198 142 -150 128 -30 C 118 -96 96 -132 56 -144 C 30 -110 -30 -96 -80 -100 C -108 -90 -122 -64 -128 -30 Z" fill={c.hair} {...ST} />;
}

// a head, chin at y≈176, centred on (0,0). expr: calm smile worried scared shock grim closed waking
export function Head({who = 'juliane', expr = 'calm', f = 0, talk = false, hair = 'normal', look = 0, lookY = 0, seed = 1, turn = 0}) {
  const c = CAST[who] || CAST.passenger;
  const SKIN = SKINS[c.skin] || SKINS.light;
  return (
    <g>
      <HairBack c={c} mode={hair === 'flying' ? 'flying' : 'normal'} />
      <path d="M -48 120 L -52 240 L 52 240 L 48 120 Z" fill={SKIN.shade} {...ST} />
      <path d="M -124 -40 C -128 -126 -70 -176 0 -176 C 70 -176 128 -126 124 -40 C 122 40 98 120 54 160 C 30 182 -30 182 -54 160 C -98 120 -122 40 -124 -40 Z" fill={SKIN.light} {...ST} />
      <path d="M 60 -150 C 110 -120 128 -60 120 0 C 114 70 90 130 50 164 C 80 110 96 50 92 -20 C 88 -80 76 -120 60 -150 Z" fill={SKIN.shade} />
      {turn > -0.5 && <ellipse cx={-128} cy={-6} rx={18} ry={32} fill={SKIN.light} {...ST} />}
      {turn < 0.5 && <ellipse cx={128} cy={-6} rx={18} ry={32} fill={SKIN.shade} {...ST} />}
      {c.beard && <path d="M -118 30 C -110 130 -60 196 0 198 C 60 196 110 130 118 30 C 90 70 60 84 30 76 C 10 70 -10 70 -30 76 C -60 84 -90 70 -118 30 Z" fill={c.hair} {...ST} />}
      <HairFront c={c} />
      <g transform={`translate(${turn * 34} 0)`}>
      <Eyes expr={expr} f={f} seed={seed} look={look + turn * 8} lookY={lookY} />
      {c.glasses && <g fill="none" {...st(6)}><rect x={-92} y={-62} width={84} height={68} rx={22} /><rect x={8} y={-62} width={84} height={68} rx={22} /><path d="M -8 -34 L 8 -34" /></g>}
      <Brows expr={expr} color={c.brow} />
      <path d="M -4 0 C -14 30 -22 46 -8 54 C 2 58 14 56 18 50" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      {!c.beard && <Mouth expr={expr} talk={talk} f={f} />}
      {c.beard && <g transform="translate(0 -8)"><Mouth expr={expr} talk={talk} f={f} /></g>}
      {c.lips && (expr === 'smile' || expr === 'calm') && <ellipse cx={-80} cy={40} rx={22} ry={12} fill={SKIN.cheek} opacity={0.5} />}
      {c.lips && (expr === 'smile' || expr === 'calm') && <ellipse cx={80} cy={40} rx={22} ry={12} fill={SKIN.cheek} opacity={0.4} />}
      {expr === 'sad' && <path d="M 66 4 C 58 22 58 36 66 40 C 74 36 74 22 66 4 Z" fill="#BFE6FF" {...st(4)} />}
      {(expr === 'scared' || expr === 'worried') && <path d="M 108 -100 C 100 -84 100 -70 110 -66 C 120 -70 120 -84 108 -100 Z" fill="#BFE6FF" {...st(4)} />}
      {c.mustache && <path d="M -46 82 C -30 64 -8 70 0 78 C 8 70 30 64 46 82 C 30 86 12 84 0 82 C -12 84 -30 86 -46 82 Z" fill={c.hair} {...st(5)} />}
      </g>
      {c.hat === 'straw' && <g><ellipse cx={0} cy={-150} rx={230} ry={46} fill="#E9C46A" {...ST} /><path d="M -110 -150 C -110 -250 110 -250 110 -150 Z" fill="#E9C46A" {...ST} /><path d="M -108 -170 L 108 -170" stroke="#9C6B30" strokeWidth={16} /></g>}
      {c.hat === 'brim' && <g>{/* a 1500s-1600s wide-brimmed hat with a plume (Cartier, Champlain) */}<path d="M -60 -190 C -10 -300 120 -300 190 -230 C 140 -250 70 -240 40 -196 Z" fill={c.plume || '#F2EEE4'} {...st(5)} /><ellipse cx={0} cy={-150} rx={210} ry={40} fill={c.hatColor || '#2A2420'} {...ST} /><path d="M -112 -152 C -118 -260 118 -260 112 -152 Z" fill={c.hatColor || '#2A2420'} {...ST} /><path d="M -110 -172 L 110 -172" stroke={c.band || '#8A1C1C'} strokeWidth={14} /></g>}
      {c.hat === 'tricorn' && <g>{/* the 1700s three-cornered hat */}<path d="M -200 -120 C -150 -260 150 -260 200 -120 C 120 -170 -120 -170 -200 -120 Z" fill={c.hatColor || '#1F1B18'} {...ST} /><path d="M -200 -120 C -120 -150 120 -150 200 -120" fill="none" stroke={c.band || '#D9B44A'} strokeWidth={8} /></g>}
      {c.hat === 'bicorne' && <g>{/* the 1800s two-cornered hat, worn side to side, with a cockade */}<path d="M -250 -130 C -160 -330 160 -330 250 -130 C 140 -180 -140 -180 -250 -130 Z" fill={c.hatColor || '#1F1B18'} {...ST} /><circle cx={0} cy={-210} r={30} fill={c.cockade || '#2B4A9B'} {...st(4)} /><circle cx={0} cy={-210} r={18} fill="#F2F2F2" /><circle cx={0} cy={-210} r={8} fill="#C8102E" /></g>}
      {c.hat === 'wig' && <g>{/* a powdered 1700s wig: rolls over the ears */}<path d="M -130 -40 C -150 -170 -70 -210 0 -208 C 70 -210 150 -170 130 -40 C 120 -110 80 -150 0 -152 C -80 -150 -120 -110 -130 -40 Z" fill="#E8E4DA" {...ST} /><ellipse cx={-136} cy={-20} rx={34} ry={26} fill="#E8E4DA" {...st(5)} /><ellipse cx={136} cy={-20} rx={34} ry={26} fill="#E8E4DA" {...st(5)} /></g>}
      {c.hat === 'cap' && <g><path d="M -124 -110 C -124 -220 124 -220 124 -110 Z" fill={c.dressShade} {...ST} /><path d="M 40 -116 C 120 -120 200 -110 220 -96 C 160 -88 90 -96 40 -100 Z" fill={c.dressShade} {...ST} /></g>}
    </g>
  );
}

// shoulders and arms below a head. arms: rest | grip | flail | hold
export function Torso({who = 'juliane', arms = 'rest', f = 0}) {
  const c = CAST[who] || CAST.passenger;
  const skin = (SKINS[c.skin] || SKINS.light).light;
  const wob = Math.sin(f * 0.9) * 6;
  return (
    <g>
      {arms === 'flail' && <g>
        <path d={`M -196 292 C -236 200 -250 90 ${-246 + wob} -20 L ${-186 + wob} -24 C -190 80 -176 180 -144 262 Z`} fill={skin} {...ST} />
        <path d={`M 196 290 C 270 220 320 110 ${336 - wob} -20 L ${276 - wob} -36 C 262 80 220 180 150 250 Z`} fill={skin} {...ST} />
        {[[-222, -66, -10, -1], [312, -66, 18, 1]].map(([hx, hy, r, sx], k) => (
          <g key={k} transform={`translate(${hx + (k ? -wob : wob)} ${hy}) rotate(${r}) scale(${sx} 1)`}>
            <path d="M -44 30 C -54 -10 -40 -44 -10 -50 C 24 -56 52 -30 48 8 C 46 34 20 50 -6 50 C -28 50 -40 44 -44 30 Z" fill={skin} {...ST} />
            {[[-40, -30], [-16, -10], [10, 8], [34, 26]].map(([fx, a], i) => <rect key={i} x={fx - 10} y={-112} width={20} height={72} rx={10} fill={skin} {...ST} transform={`rotate(${a} ${fx} -44)`} />)}
          </g>))}
      </g>}
      <path d="M -70 214 C -160 230 -214 262 -226 350 L -246 780 L 246 780 L 226 350 C 214 262 160 230 70 214 C 40 262 -40 262 -70 214 Z" fill={c.dress} {...ST} />
      <path d="M 120 236 C 190 262 214 300 220 360 L 238 780 L 150 780 Z" fill={c.dressShade} />
      <path d="M -70 214 C -40 262 40 262 70 214" fill="none" {...ST} />
      {arms === 'rest' && <g>
        <path d="M -206 300 C -236 400 -240 500 -222 600 L -162 596 C -176 500 -170 420 -150 340 Z" fill={c.dress} {...ST} />
        <path d="M 206 300 C 236 400 240 500 222 600 L 162 596 C 176 500 170 420 150 340 Z" fill={c.dressShade} {...ST} />
        <ellipse cx={-180} cy={622} rx={44} ry={34} fill={skin} {...ST} /><ellipse cx={180} cy={622} rx={44} ry={34} fill={skin} {...ST} />
      </g>}
      {arms === 'grip' && <g>
        <path d="M -206 300 C -260 400 -290 500 -300 600 L -240 612 C -232 520 -206 430 -150 350 Z" fill={c.dress} {...ST} />
        <path d="M 206 300 C 260 400 290 500 300 600 L 240 612 C 232 520 206 430 150 350 Z" fill={c.dressShade} {...ST} />
        <rect x={-360} y={600} width={150} height={52} rx={20} fill="#334155" {...ST} /><rect x={210} y={600} width={150} height={52} rx={20} fill="#334155" {...ST} />
        <ellipse cx={-272} cy={610} rx={48} ry={34} fill={skin} {...ST} /><ellipse cx={272} cy={610} rx={48} ry={34} fill={skin} {...ST} />
      </g>}
    </g>
  );
}

// a person from the waist up: head on torso. s = scale, (x, y) = where the chin is
export const Bust = ({who, x, y, s = 1, expr, f, talk, arms, hair, rot = 0, look, seed}) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
    <Torso who={who} arms={arms} f={f} />
    <Head who={who} expr={expr} f={f} talk={talk} hair={hair} look={look} seed={seed} />
  </g>
);

// ───────────────── things ─────────────────
export const SeatBack = ({x = 0, y = 0, s = 1}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M -250 -170 Q -250 -260 -160 -260 L 160 -260 Q 250 -260 250 -170 L 262 760 L -262 760 Z" fill="#1E40AF" {...ST} />
    <path d="M 120 -250 Q 240 -250 240 -170 L 252 760 L 170 760 Z" fill="#1A3592" />
    <path d="M -170 -240 L 170 -240 L 170 -150 L -170 -150 Z" fill="#E5E7EB" {...ST} />
  </g>
);

// the Lockheed L-188 Electra (LANSA flight 508), side view, nose right. broken 0..1 splits it behind the wing
export function Plane({f = 0, broken = 0, fire = 0}) {
  const gap = broken * 120, tilt = broken * 26;
  const prop = (x, y) => (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={0} cy={0} rx={52} ry={20} fill="#CBD5E1" {...st(6)} />
      <g transform={`scale(1 ${Math.abs(Math.cos(f * 1.3)) * 0.9 + 0.1})`}><rect x={46} y={-70} width={10} height={140} rx={5} fill="#475569" opacity={0.7} /></g>
    </g>
  );
  return (
    <g>
      <g transform={`translate(${-gap} 0) rotate(${-tilt} -80 0)`}>
        <path d="M -620 -26 L -120 -50 L -120 50 L -600 26 Q -650 20 -660 0 Q -650 -20 -620 -26 Z" fill="#F1F5F9" {...ST} />
        <path d="M -600 -26 L -660 -150 L -600 -150 L -520 -30 Z" fill="#E2E8F0" {...ST} />
        <path d="M -560 6 L -470 6 L -460 50 L -540 44 Z" fill="#CBD5E1" {...st(5)} />
        <rect x={-610} y={-6} width={480} height={14} fill="#B91C1C" />
        {[...Array(8)].map((_, i) => <rect key={i} x={-560 + i * 54} y={-30} width={24} height={18} rx={6} fill="#93C5FD" {...st(4)} />)}
        <path d="M -120 -50 L -96 -36 L -126 -14 L -100 6 L -128 26 L -104 40 L -120 50" fill="none" {...st(6)} opacity={broken > 0 ? 1 : 0} />
      </g>
      <g transform={`rotate(${tilt * 0.5} 100 0)`}>
        <path d="M -120 -50 L 360 -50 Q 470 -46 520 0 Q 470 46 360 50 L -120 50 Z" fill="#F8FAFC" {...ST} />
        <path d="M 400 -40 Q 470 -36 506 -6 L 430 -6 Z" fill="#334155" {...st(4)} />
        <rect x={-120} y={-6} width={500} height={14} fill="#B91C1C" />
        {[...Array(8)].map((_, i) => <rect key={i} x={-80 + i * 54} y={-30} width={24} height={18} rx={6} fill="#93C5FD" {...st(4)} />)}
        <path d="M -40 10 L 160 10 L 120 150 L 20 150 Z" fill="#E2E8F0" {...ST} />
        {prop(60, 40)}{prop(190, 30)}
        <path d="M -40 -6 L 180 -6 L 130 -110 L 40 -110 Z" fill="#CBD5E1" {...ST} opacity={0.9} />
        {prop(90, -70)}
        {fire > 0 && <g opacity={fire}><circle cx={110} cy={110} r={60 + Math.sin(f) * 8} fill="#F97316" /><circle cx={110} cy={110} r={32} fill="#FDE047" /></g>}
      </g>
    </g>
  );
}

export const Bolt = ({x, y, s = 1, op = 1}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={op}>
    <path d="M 0 0 L -40 90 L 10 100 L -50 210 L 6 222 L -40 320" fill="none" stroke="#FEF9C3" strokeWidth={30} strokeLinejoin="round" opacity={0.35} />
    <path d="M 0 0 L -40 90 L 10 100 L -50 210 L 6 222 L -40 320" fill="none" stroke="#FFFFFF" strokeWidth={12} strokeLinejoin="round" />
  </g>
);

export const Cloud = ({x, y, s = 1, dark = false, op = 1}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={op}>
    <g fill={dark ? '#3B3F63' : '#E8EEF8'} {...st(6)}><path d="M -220 40 C -250 -10 -200 -60 -150 -40 C -140 -110 -40 -130 0 -70 C 40 -130 150 -110 150 -40 C 210 -60 250 0 220 40 Z" /></g>
    <path d="M -150 20 C -100 30 100 30 160 18" fill="none" stroke={dark ? '#2A2D4A' : '#C7D2E6'} strokeWidth={10} strokeLinecap="round" />
  </g>
);

// the rainforest from the air: rows of outlined crowns, near rows bigger
export function Canopy({y0 = 700, f = 0, drift = 0, seed = 5, rows = 5, river = true}) {
  const R = rng(seed), out = [];
  const greens = [['#14532D', '#166534'], ['#166534', '#15803D'], ['#15803D', '#16A34A'], ['#16A34A', '#22C55E'], ['#15803D', '#22A06B']];
  for (let r = 0; r < rows; r++) {
    const y = y0 + r * 70 + r * r * 8, size = 34 + r * 18, n = Math.ceil((W + 400) / (size * 1.5));
    for (let i = 0; i < n; i++) {
      const x = ((i * size * 1.5 + R() * size + drift * (0.4 + r * 0.25)) % (W + 400)) - 200, yy = y + (R() - 0.5) * 24, rr = size * (0.8 + R() * 0.5);
      const [d, l] = greens[r % greens.length];
      out.push(<g key={r + '-' + i}><circle cx={x} cy={yy} r={rr} fill={d} {...st(4)} /><circle cx={x - rr * 0.3} cy={yy - rr * 0.3} r={rr * 0.5} fill={l} /></g>);
    }
    if (river && r === 1) out.push(<path key="river" d={`M ${-100 + drift * 0.6} ${y + 30} C 300 ${y - 10} 500 ${y + 60} 900 ${y + 20} S 1500 ${y + 50} ${2100 + drift * 0.6} ${y + 10}`} stroke="#7DD3FC" strokeWidth={22} fill="none" strokeLinecap="round" />);
  }
  return <g>{out}</g>;
}


// ───────────────── a whole person, front view (2.50.0) ─────────────────
// head centre at (0,0) like Head; feet at y≈1100 (sitting/hugging: ≈800). pose: stand walk limp run wade signal shade hold push hug lie
export function Figure({who = 'juliane', pose = 'stand', expr = 'calm', f = 0, talk = false, seed = 1, dirty = 0, look = 0, lookY = 0, oneShoe = false, dir = 0}) {
  const c = CAST[who] || CAST.passenger;
  const sk = SKINS[c.skin] || SKINS.light;
  const walk = pose === 'walk' || pose === 'limp' || pose === 'run' || pose === 'push';
  const sw = Math.sin((f + seed * 7) * (pose === 'run' ? 0.5 : 0.26));
  const side = walk && dir !== 0;   // a walk shown side-on: legs and arms swing forward and back, the body turned
  const legL = walk ? (side ? -dir : 1) * sw * (pose === 'run' ? 30 : side ? 22 : 14) : 0;
  const legR = pose === 'limp' ? (side ? dir : -1) * sw * 6 : -legL;
  const bob = walk ? -Math.abs(sw) * (pose === 'limp' ? 16 : 9) : Math.sin(f * 0.07 + seed) * 3;
  const arms = {
    stand: [6, -6], walk: [-sw * 18 + 6, sw * 18 - 6], limp: [-sw * 10 + 10, sw * 6 - 30], run: [-sw * 40, sw * 40], wade: [40, -40],
    signal: [10, -165 + Math.sin(f * 0.5) * 18], shade: [8, -150], hold: [-40, 40], push: [-60 + sw * 10, 60 - sw * 10], hug: [0, 0], lie: [10, -10],
  }[pose] || [6, -6];
  const leg = (x, a, shoe) => (
    <g transform={`translate(${x} 600) rotate(${a})`}>
      <path d="M -36 0 C -38 160 -32 300 -28 450 L 26 450 C 30 300 36 160 34 0 Z" fill={c.pants || sk.light} {...ST} />
      {dirty > 0 && <path d="M -24 300 L -6 330 M 4 380 L 20 400" stroke="#6B4423" strokeWidth={6} opacity={0.6} />}
      {shoe ? <path d="M -40 430 L 40 430 L 52 486 L -40 486 Z" fill="#3F2A1E" {...ST} />
        : <path d="M -34 440 C -40 470 -30 490 0 492 C 34 494 46 470 34 440 Z" fill={sk.light} {...ST} />}
    </g>
  );
  const arm = (x, a, k) => (
    <g key={k} transform={`translate(${x} 270) rotate(${a})`}>
      <path d="M -26 0 C -32 110 -28 210 -20 300 L 20 300 C 28 210 32 110 26 0 Z" fill={sk.light} {...ST} />
      <circle cx={0} cy={318} r={32} fill={sk.light} {...ST} />
    </g>
  );
  const dress = (
    <g>
      <path d="M -60 216 C -128 230 -166 250 -170 300 L -186 650 L 186 650 L 170 300 C 166 250 128 230 60 216 C 36 258 -36 258 -60 216 Z" fill={c.dress} {...ST} />
      <path d="M 96 236 C 150 254 166 280 168 320 L 182 650 L 120 650 Z" fill={c.dressShade} />
      {dirty > 0 && <g fill="#6B4423" opacity={0.45 * dirty}><ellipse cx={-80} cy={420} rx={34} ry={22} /><ellipse cx={60} cy={540} rx={44} ry={26} /><ellipse cx={-40} cy={600} rx={30} ry={18} /></g>}
      {dirty > 0.5 && <path d="M -186 650 L -160 618 L -140 650 L -110 610 L -86 650 M 90 650 L 112 620 L 136 650" fill="none" {...st(6)} />}
    </g>
  );
  if (pose === 'hug') {   // sitting, knees up, arms around them
    return (
      <g transform={`translate(0 ${120 + bob})`}>
        <ellipse cx={0} cy={700} rx={260} ry={34} fill="#000" opacity={0.18} />
        {dress}
        <path d="M -150 560 C -170 640 -150 690 -110 700 L -60 700 C -40 640 -50 580 -70 540 Z" fill={sk.light} {...ST} />
        <path d="M 150 560 C 170 640 150 690 110 700 L 60 700 C 40 640 50 580 70 540 Z" fill={sk.light} {...ST} />
        <ellipse cx={-80} cy={470} rx={88} ry={110} fill={sk.light} {...ST} />
        <ellipse cx={80} cy={470} rx={88} ry={110} fill={sk.light} {...ST} />
        <path d="M -170 300 C -200 420 -150 500 0 500 C 150 500 200 420 170 300" fill="none" stroke={sk.light} strokeWidth={56} strokeLinecap="round" />
        <path d="M -170 300 C -200 420 -150 500 0 500 C 150 500 200 420 170 300" fill="none" stroke={INK} strokeWidth={70} strokeLinecap="round" opacity={0} />
        <g transform="translate(0 60) rotate(-4)"><Head who={who} expr={expr} f={f} talk={talk} look={look} seed={seed} /></g>
      </g>
    );
  }
  if (side) {
    const aw = sw * (pose === 'run' ? 34 : 20);
    return (
      <g transform={`translate(0 ${bob}) rotate(${dir * (pose === 'run' ? 6 : 3)})`}>
        <ellipse cx={0} cy={1090 - bob} rx={150} ry={26} fill="#000" opacity={0.18} />
        {arm(-dir * 40, dir * aw * -1 + dir * 4, 'far')}
        {leg(-dir * 22, legR, !oneShoe)}{leg(dir * 22, legL, true)}
        <g transform="scale(0.74 1)">{dress}</g>
        {arm(dir * 40, dir * aw + dir * 4, 'near')}
        <Head who={who} expr={expr} f={f} talk={talk} look={look} seed={seed} turn={dir} />
      </g>
    );
  }
  return (
    <g transform={`translate(0 ${bob})`}>
      <ellipse cx={0} cy={1090 - bob} rx={200} ry={30} fill="#000" opacity={0.18} />
      {leg(-62, legL, true)}{leg(62, legR, !oneShoe)}
      {arm(-150, arms[0], 'l')}
      {dress}
      {arm(150, arms[1], 'r')}
      <g transform={pose === 'shade' ? 'rotate(-6)' : ''}><Head who={who} expr={expr} f={f} talk={talk} look={look} lookY={lookY} seed={seed} /></g>
    </g>
  );
}

// ───────────────── shared scene helpers (moved from Opening.jsx) ─────────────────
export const at = (line, word, frac = 0.3) => {
  const want = String(word || '').toLowerCase().replace(/[^a-z0-9']/g, '');
  if (!want) return 0;
  const hit = (line.words || []).find((w) => w[0].toLowerCase().replace(/[^a-z0-9']/g, '').startsWith(want));
  return hit ? hit[1] - line.start : Math.round((line.end - line.start) * frac);
};
export const Cam = ({f, len, from = 1, to = 1.06, x = W / 2, y = H / 2, shake = 0, children}) => {
  const z = interpolate(f, [0, len], [from, to], {extrapolateRight: 'clamp'});
  const sx = shake ? Math.sin(f * 1.9) * shake : 0, sy = shake ? Math.cos(f * 2.3) * shake * 0.7 : 0;
  return <g transform={`translate(${x + sx} ${y + sy}) scale(${z}) translate(${-x} ${-y})`}>{children}</g>;
};
export const Rain = ({f, n = 70, seed = 3, op = 0.35, slant = -16}) => {
  const R = rng(seed);
  return <g>{[...Array(n)].map((_, i) => { const x = R() * (W + 200), y0 = R() * H, sp = 30 + R() * 20; const y = ((y0 + f * sp) % (H + 100)) - 60;
    return <path key={i} d={`M ${x} ${y} l ${slant} 46`} stroke="#C7D2FE" strokeWidth={4} opacity={op} strokeLinecap="round" />; })}</g>;
};
// labels from the script: p.labels = [{text, on, color}] stacked top-left (or at x, y)
export const Labels = ({line, f, x0 = 100, y0 = 100, align = 'left'}) => ((line.p || {}).labels || []).map((l, i) => {
  const h = l.big ? 96 : 76, text = String(l.text).toUpperCase();
  const w = Math.max(160, text.length * h * 0.43 + 40);
  const x = l.x != null ? l.x : align === 'right' ? x0 - w : x0;
  return <Label key={i} x={x} y={l.y != null ? l.y : y0 + i * 104} text={text} f={f} at={at(line, l.on || '', 0.15 + i * 0.2)}
    fill={l.color === 'red' ? '#E3232C' : l.color === 'white' ? '#fff' : '#FFE11A'} color={l.color === 'red' ? '#fff' : INK} h={h} />;
});
