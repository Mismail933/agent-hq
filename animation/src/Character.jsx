import React from 'react';
import {spring, useVideoConfig} from 'remotion';
import {C, rnd} from './theme';

/*
 * The cast (kit v3, 2.21.x): ancient Greek people drawn like the owner's reference image (five men queuing by a voting urn).
 * Not a funny cartoon: natural adults about 6.5-7 heads tall, normal hands and limbs, thin warm dark-brown outlines of varied
 * weight, calm natural faces (small eyes, gentle mouths, real noses, beards and hair in flowing curls), flowing drapery with fold
 * lines (a himation wrapped over the tunic, cloaks that hang and are pinned with a brooch), a muted sepia/terracotta palette with
 * flat soft shading. Drawn in parts (legs, tunic, drape, arms with hands, head with hair, beard, headwear, held prop) so poses,
 * mouths and expressions are just numbers. Local coordinates: origin between the feet, y grows downward, a figure is ~600 tall.
 * The head is drawn in its own larger units (face ~150 tall) and scaled by HEAD_K onto the body.
 * There is no on-screen narrator: the narrator is a voice only. Nobody holds a POV sign.
 */
export const POSES = {
  // [shoulder, elbow] in degrees, "outward and up" is positive. L is the arm that holds the prop.
  stand: {L: [10, 14], R: [8, 10], head: 0},
  point: {L: [10, 14], R: [84, 4], head: -4},
  explain: {L: [10, 14], R: [40, 74], head: 3},
  amazed: {L: [110, 36], R: [140, 16], head: -6},
  wave: {L: [10, 14], R: [146, 22], head: 3},
  think: {L: [10, 14], R: [12, 166], head: 6},   // hand up at the beard
  present: {L: [10, 14], R: [52, 62], head: -2},
  shrug: {L: [46, 90], R: [46, 90], head: 7},
  cheer: {L: [158, 10], R: [158, 10], head: -5},
  facepalm: {L: [10, 14], R: [130, 136], head: 9},   // the hand over the eyes (drawn in front of the face)
  flinch: {L: [60, 120], R: [60, 120], head: -8},    // both hands up by the head
};
// Actions (2.22.1): short movements on top of the pose, timed by the scene's beats. walk_in / walk_out / turn are handled by the
// scene (position and facing); facepalm / shrug / flinch also set a pose for a moment.
export const ACTIONS = ['walk_in', 'walk_out', 'turn', 'jump', 'flinch', 'facepalm', 'shrug', 'double_take', 'nod', 'pace'];  // pace: Short.jsx walks him on the spot
const actionMotion = (action, age) => {
  const m = {up: 0, squash: 1, lean: 0, nod: 0, away: false};
  if (age === null || age < 0) return m;
  if (action === 'jump') {
    if (age < 16) m.up = Math.sin((Math.PI * age) / 16) * 110;
    else if (age < 22) m.squash = 1 - 0.08 * Math.sin((Math.PI * (age - 16)) / 6);
  } else if (action === 'flinch') {
    m.lean = age < 4 ? (-10 * age) / 4 : -10 * Math.max(0, 1 - (age - 4) / 20);
    m.up = age < 8 ? Math.sin((Math.PI * age) / 8) * 22 : 0;
  } else if (action === 'double_take') {
    m.away = age >= 3 && age < 11;   // a glance away... then the snap back
    if (age >= 11 && age < 19) m.up = Math.sin((Math.PI * (age - 11)) / 8) * 40;
  } else if (action === 'nod') {
    m.nod = age < 20 ? Math.sin(age / 3) * 7 : 0;
  } else if (action === 'shrug') {
    m.up = age < 10 ? Math.sin((Math.PI * age) / 10) * 12 : 0;
  }
  return m;
};
// The nine mouth shapes of Rhubarb Lip Sync (MIT licence): A closed (P B M), B teeth together (K S T), C open (EH), D wide
// (AA), E rounded (AO), F pucker (OO W), G teeth on lip (F V), H tongue up (L), X rest. Old scene files use 0/1/2.
export const MOUTHS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'X'];
export const EXPRESSIONS = ['neutral', 'happy', 'surprised', 'worried', 'determined', 'thinking', 'laughing', 'angry', 'smug', 'scared'];
const LEGACY_MOUTH = {0: 'X', 1: 'C', 2: 'D'};

// Subtle, natural faces. lift: brows up; tilt: inner brow ends up (+, worried) or down (-, cross); asym: left brow extra lift;
// lid: how far the upper lid comes down (0 open .. 1 shut; a calm face is ~0.15); eyeH: eye opening; rest: the mouth when
// nobody is talking; cheek: a faint warm flush; squint: lower lids up (a real smile)
const EXPR = {
  neutral: {lift: 0, tilt: 0, asym: 0, lid: 0.14, eyeH: 1, rest: 'smile', cheek: 0.08},
  happy: {lift: 2, tilt: -1, asym: 0, lid: 0.22, eyeH: 0.9, rest: 'big', cheek: 0.2, squint: true},
  surprised: {lift: 9, tilt: 0, asym: 0, lid: 0, eyeH: 1.3, rest: 'o', cheek: 0.05},
  worried: {lift: 4, tilt: 8, asym: 0, lid: 0.1, eyeH: 1.05, rest: 'frown', cheek: 0.05},
  determined: {lift: -2, tilt: -5, asym: 0, lid: 0.26, eyeH: 0.94, rest: 'flat', cheek: 0.08},
  thinking: {lift: 2, tilt: 2, asym: 6, lid: 0.2, eyeH: 0.96, rest: 'side', cheek: 0.06, up: true},
  laughing: {lift: 4, tilt: -1, asym: 0, lid: 1, eyeH: 1, rest: 'laugh', cheek: 0.26, shut: true},
  angry: {lift: -4, tilt: -10, asym: 0, lid: 0.3, eyeH: 0.92, rest: 'grit', cheek: 0.22},
  smug: {lift: 1, tilt: -2, asym: 5, lid: 0.4, eyeH: 1, rest: 'smirk', cheek: 0.1},
  scared: {lift: 8, tilt: 9, asym: 0, lid: 0, eyeH: 1.28, rest: 'wobble', cheek: 0, sweat: true},
};

// Body geometry (a ~6.8-head adult: chin at -506, crotch near half height, fingertips at mid-thigh)
const UPPER = 120;
const FORE = 104;
const HAND = 16;          // from the wrist to the middle of the hand
const SHOULDER_Y = -484;
const SHOULDER_X = 56;
const HEAD_K = 0.56;      // head units -> body units
export const HEAD_Y = -548;   // centre of the face
const HIP_Y = -324;
const LEG = 300;

// Line: thin warm dark brown, heavier on silhouettes, lighter inside.
const INK = '#4A2C20';
const LW = 3.4;           // body outline
const LF = 2;             // folds and details
const MOUTH_IN = '#5A2A22';
const TONGUE = '#C9776A';
const TEETH = '#FBF6EE';

// Muted reference palette: peach skin, dark-brown and grey hair, cream and linen tunics, soft brown/grey/terracotta cloaks.
const HAIR = {black: '#3B2620', brown: '#5E3626', auburn: '#7A4430', grey: '#B3ACA2', white: '#F1ECE4'};
const SKINS = ['#F4D9C2', '#EECBAE', '#E3B694', '#C99474', '#A87454'];
const CLOTH = ['#F3EADB', '#E6D8C0', '#A8664C', '#9A6B55', '#9E978F', '#C49A88', '#8C8A64', '#7F8790', '#C49A5C'];

/** Flat soft shading: the same colour, a little darker (k < 1) or lighter (k > 1). */
const shade = (hex, k = 0.86) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('');
};

/*
 * Each person: skin, hair (colour, style: curly | short | receding | bald | bun | none), beard (none | stubble | short | full |
 * long), brows, tunic (colour, long or short), drape (a himation wrapped over the left shoulder), cloak (a chlamys hanging behind,
 * pinned at the shoulder), build (0.9 slim .. 1.3 heavy), tall (0.95 .. 1.04), headwear (diadem | laurel | helmet | band),
 * held prop (scroll | sceptre | spear | bag | staff | none), wrinkles, earrings.
 */
const CAST = {
  scholar: {name: 'The Scholar', skin: SKINS[1], hair: HAIR.white, hairStyle: 'receding', beard: 'long', beardColor: HAIR.white, brows: HAIR.grey,
    tunic: CLOTH[0], long: true, drape: CLOTH[4], build: 1.0, tall: 0.97, prop: 'scroll', wrinkles: true},
  ruler: {name: 'The Ruler', skin: SKINS[2], hair: HAIR.brown, hairStyle: 'curly', beard: 'full', beardColor: HAIR.brown, brows: HAIR.brown,
    tunic: CLOTH[0], long: true, drape: '#7A4B5C', trim: '#C9A060', build: 1.2, tall: 1.03, prop: 'sceptre', headwear: 'diadem'},
  citizen: {name: 'The Citizen', skin: SKINS[0], hair: HAIR.brown, hairStyle: 'curly', beard: 'none', brows: HAIR.brown,
    tunic: CLOTH[0], long: false, build: 0.92, tall: 0.99, prop: 'none'},
  woman: {name: 'The Woman', skin: SKINS[1], hair: HAIR.auburn, hairStyle: 'bun', beard: 'none', brows: HAIR.auburn, tunic: '#B9C2B4', long: true,
    drape: CLOTH[1], build: 0.9, tall: 0.95, prop: 'none', headwear: 'band', earrings: true, lashes: true},
  elder: {name: 'The Elder', skin: SKINS[2], hair: HAIR.grey, hairStyle: 'receding', beard: 'full', beardColor: HAIR.white, brows: HAIR.grey,
    tunic: CLOTH[1], long: true, drape: CLOTH[3], build: 1.04, tall: 0.96, prop: 'staff', wrinkles: true},
  merchant: {name: 'The Merchant', skin: SKINS[2], hair: HAIR.black, hairStyle: 'bald', beard: 'short', beardColor: HAIR.black, brows: HAIR.black,
    tunic: CLOTH[1], long: true, drape: CLOTH[8], build: 1.3, tall: 0.98, prop: 'bag'},
  guard: {name: 'The Guard', skin: SKINS[3], hair: HAIR.black, hairStyle: 'short', beard: 'short', beardColor: HAIR.black, brows: HAIR.black,
    tunic: '#B98A6A', long: false, cloak: '#A4513C', build: 1.12, tall: 1.04, prop: 'spear', headwear: 'helmet', armour: true},
  worker: {name: 'The Worker', skin: SKINS[3], hair: HAIR.brown, hairStyle: 'short', beard: 'short', beardColor: HAIR.brown, brows: HAIR.brown,
    tunic: CLOTH[1], long: false, cloak: CLOTH[4], build: 1.08, tall: 1.0, prop: 'none'},
};
export const CAST_IDS = Object.keys(CAST);
export const CAST_INFO = {
  scholar: {name: 'The Scholar', role: 'Old thinker: bald crown, white hair at the sides, long flowing white beard, cream tunic, grey himation. The scientist or philosopher of the story.', prop: 'a scroll'},
  ruler: {name: 'The Ruler', role: 'Tall, heavy-set man: brown curls and full beard, thin gold diadem, plum himation with a gold edge over a long tunic.', prop: 'a sceptre'},
  citizen: {name: 'The Citizen', role: 'Young man: thick brown curls, clean-shaven, short cream tunic. The everyman of the story.', prop: 'nothing'},
  woman: {name: 'The Woman', role: 'Woman: auburn hair in a bun with a band, long sage dress, linen shawl, small earrings.', prop: 'nothing'},
  elder: {name: 'The Elder', role: 'Old man: receding grey hair, full white beard, linen tunic, soft brown himation, walking staff.', prop: 'a staff'},
  merchant: {name: 'The Merchant', role: 'Heavy, bald trader: short black beard, linen tunic, ochre himation, coin purse.', prop: 'a coin purse'},
  guard: {name: 'The Guard', role: 'Soldier: bronze helmet with a red crest, bronze cuirass, red cloak, spear.', prop: 'a spear'},
  worker: {name: 'The Worker', role: 'Labourer: short brown hair and beard, plain short tunic, grey cloak pinned at the shoulder.', prop: 'nothing'},
};
// Old scene files may still name the on-screen narrator: he is gone, so a citizen stands in.
const ALIAS = {narrator: 'citizen'};
export const castOf = (who) => CAST[ALIAS[who] || who] || CAST.citizen;

/** A seeded crowd person: one of the cast's looks with its own colours, hair and build, so a crowd never looks cloned. */
export const crowdLook = (seed) => {
  const base = ['citizen', 'woman', 'elder', 'merchant', 'worker', 'citizen', 'woman'][Math.floor(rnd(seed * 3.1) * 7)];
  const c = {...CAST[base]};
  c.skin = SKINS[Math.floor(rnd(seed * 5.7) * 4)];
  c.tunic = CLOTH[Math.floor(rnd(seed * 7.3) * 2)];
  c.drape = rnd(seed * 2.2) < 0.55 ? CLOTH[2 + Math.floor(rnd(seed * 9.1) * (CLOTH.length - 2))] : null;
  c.cloak = !c.drape && rnd(seed * 4.9) < 0.5 ? CLOTH[2 + Math.floor(rnd(seed * 6.1) * (CLOTH.length - 2))] : null;
  if (base !== 'woman' && base !== 'elder') {
    const h = [HAIR.black, HAIR.brown, HAIR.auburn, HAIR.brown][Math.floor(rnd(seed * 4.4) * 4)];
    c.hair = h;
    c.brows = h;
    c.beardColor = h;
    c.beard = ['none', 'stubble', 'short', 'full'][Math.floor(rnd(seed * 6.6) * 4)];
    c.hairStyle = ['curly', 'short', 'curly', 'receding'][Math.floor(rnd(seed * 8.8) * 4)];
  }
  c.headwear = base === 'woman' ? c.headwear : null;
  c.prop = 'none';
  c.build = 0.9 + rnd(seed * 1.9) * 0.35;
  c.tall = 0.95 + rnd(seed * 2.3) * 0.08;
  return c;
};

const rot = (deg, len) => {
  const a = (deg * Math.PI) / 180;
  return [-len * Math.sin(a), len * Math.cos(a)];
};

// Where the hand ends up, for attaching the held prop. side = -1 (left on screen) or 1.
const handAt = (side, shoulder, elbow, build = 1) => {
  const th1 = side < 0 ? shoulder : -shoulder;
  const th2 = side < 0 ? shoulder + elbow : -(shoulder + elbow);
  const [ux, uy] = rot(th1, UPPER);
  const [fx, fy] = rot(th2, FORE + HAND);
  return [side * SHOULDER_X * build + ux + fx, SHOULDER_Y + uy + fy, th2];
};

// Extents of each held prop in the hand's frame (x across, y down from the hand).
const PROP_BOX = {
  scroll: [[-18, -56], [18, 66]],
  sceptre: [[-22, -330], [22, -330], [0, 60]],
  spear: [[-16, -470], [16, -470], [0, 170]],
  staff: [[-14, -250], [24, -250], [0, 250]],
  bag: [[-28, 8], [28, 8], [0, 76]],
  none: [],
};
const HEAD_TOP = {helmet: -668, diadem: -616, laurel: -612, band: -606};

/**
 * How far a character reaches from the point between its feet, in drawing units at scale 1 (hands, the held prop, the head and
 * its hat, the robe and cloak). The scene uses it to keep everything inside the safe area, whatever the pose.
 */
export const reach = (who, pose, noProp = false) => {
  const c = castOf(who);
  const b = c.build || 1;
  const tall = c.tall || 1;
  const P = POSES[pose] || POSES.stand;
  const pts = [[-64 * b, 0], [64 * b, 0], [-(76 * b + 24), -300], [76 * b + 24, -300], [-50, HEAD_Y], [50, HEAD_Y], [0, HEAD_TOP[c.headwear] || -612]];
  if (c.cloak) pts.push([-(60 * b + 50), -120], [60 * b + 50, -120]);
  const [lx, ly, lth] = handAt(-1, P.L[0], P.L[1], b);
  const [rx, ry] = handAt(1, P.R[0], P.R[1], b);
  pts.push([lx - 22, ly], [lx + 22, ly], [rx - 22, ry], [rx + 22, ry]);
  const tilt = (-lth * 0.22 * Math.PI) / 180;
  const place = (px, py) => [lx + px * Math.cos(tilt) - py * Math.sin(tilt), ly + px * Math.sin(tilt) + py * Math.cos(tilt)];
  if (!noProp) (PROP_BOX[c.prop] || []).forEach(([a, q]) => pts.push(place(a, q)));
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1] * tall);
  return {left: -Math.min(...xs), right: Math.max(...xs), top: -Math.min(...ys)};
};

const ol = (w = LW) => ({stroke: INK, strokeWidth: w, strokeLinejoin: 'round', strokeLinecap: 'round'});
const fold = (w = LF, o = 0.55) => ({fill: 'none', stroke: INK, strokeWidth: w, strokeLinecap: 'round', opacity: o});

// Points along an ellipse (SVG angles: 180 = left, 270 = top, 360 = right) and a soft scalloped edge through them: curls.
const arcPts = (cx, cy, rx, ry, a0, a1, n) => Array.from({length: n + 1}, (_, i) => {
  const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
  return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
});
const bumps = (pts, cx, cy, k) => pts.slice(1).map((p, i) => {
  const q = pts[i];
  const mx = (p[0] + q[0]) / 2;
  const my = (p[1] + q[1]) / 2;
  const d = Math.hypot(mx - cx, my - cy) || 1;
  return `Q ${(mx + ((mx - cx) / d) * k).toFixed(1)} ${(my + ((my - cy) / d) * k).toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
}).join(' ');
// Little curl strokes inside hair and beards (seeded, so every frame is the same)
const curlMarks = (pts, color, seed, w = 1.8) => pts.map(([x, y], i) => {
  const s = rnd(seed + i * 1.7) > 0.5 ? 1 : -1;
  return <path key={i} d={`M ${x.toFixed(1)} ${y.toFixed(1)} q ${4 * s} -6 ${9 * s} -1 q ${3 * s} 5 ${-1 * s} 9`} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" />;
});

// A natural hand: palm, fingers together with two finger lines, a thumb on the inside; `finger` = a fist with the index out.
const Hand = ({skin, finger = false, side}) => (
  <g transform={`translate(0 ${FORE}) scale(${side} 1)`}>
    {finger ? (
      <g>
        <path d="M -3 16 L -3 44 Q 0 48 3 44 L 3 16 Z" fill={skin} {...ol(LF)} />
        <path d="M -9 -2 Q -11 12 -8 21 Q 0 25 9 21 Q 11 10 9 -2 Z" fill={skin} {...ol(LW * 0.8)} />
        <path d="M -6 18 Q 0 21 6 18" {...fold(1.4)} />
      </g>
    ) : (
      <g>
        <path d="M -9 -2 Q -11 14 -9 26 Q -6 36 0 36 Q 6 36 8 28 Q 10 14 9 -2 Z" fill={skin} {...ol(LW * 0.8)} />
        <path d="M -3 21 L -3 33 M 2 21 L 2.5 34" {...fold(1.3, 0.5)} />
      </g>
    )}
    <path d="M 7 2 Q 15 9 13 19 Q 11 23 8 19" fill={skin} {...ol(LF)} />
  </g>
);

const Arm = ({side, shoulder, elbow, skin, sleeve, build, finger, armour}) => {
  const th1 = side < 0 ? shoulder : -shoulder;
  const th2 = side < 0 ? elbow : -elbow;
  return (
    <g transform={`translate(${side * SHOULDER_X * build} ${SHOULDER_Y}) rotate(${th1})`}>
      <line x1="0" y1="0" x2="0" y2={UPPER} stroke={INK} strokeWidth={22 + LW * 2} strokeLinecap="round" />
      <g transform={`translate(0 ${UPPER}) rotate(${th2})`}>
        <line x1="0" y1="0" x2="0" y2={FORE - 4} stroke={INK} strokeWidth={18 + LW * 2} strokeLinecap="round" />
        <line x1="0" y1="0" x2="0" y2={FORE - 4} stroke={skin} strokeWidth={18} strokeLinecap="round" />
        {armour && <rect x="-12" y={FORE - 44} width="24" height="34" rx="5" fill="#9C7446" {...ol(LF)} />}
        <Hand skin={skin} finger={finger} side={-side} />
      </g>
      <line x1="0" y1="0" x2="0" y2={UPPER} stroke={skin} strokeWidth={22} strokeLinecap="round" />
      {/* the tunic's soft sleeve over the shoulder, with a fold */}
      <path d="M -17 -12 Q 0 -20 17 -12 L 16 40 Q 6 46 0 42 Q -8 46 -16 40 Z" fill={sleeve} {...ol(LW * 0.9)} />
      <path d="M -6 2 Q -4 20 -7 36 M 6 6 Q 8 22 6 34" {...fold(1.4, 0.4)} />
    </g>
  );
};

// Mouths sit at y ~48 in head units: small and natural, a soft lower lip, a dark warm inside.
const Mouth = ({shape, rest = 'smile', skin}) => {
  const m = typeof shape === 'number' ? LEGACY_MOUTH[shape] || 'X' : shape || 'X';
  const lip = shade(skin, 0.82);
  const line = {fill: 'none', stroke: INK, strokeWidth: 3, strokeLinecap: 'round'};
  const tongue = (cx, cy, rx, ry) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={TONGUE} />;
  const under = (y) => <path d={`M -7 ${y} Q 0 ${y + 3} 7 ${y}`} fill="none" stroke={lip} strokeWidth="3" strokeLinecap="round" />;
  switch (m) {
    case 'A':
      return <g><path d="M -13 47 Q 0 49 13 47" {...line} />{under(53)}</g>;
    case 'B':
      return (
        <g>
          <path d="M -14 44 Q 0 42 14 44 Q 12 53 0 54 Q -12 53 -14 44 Z" fill={TEETH} {...ol(2.4)} />
          <path d="M -12 48.5 L 12 48.5" stroke={INK} strokeWidth="1.2" opacity="0.6" />
        </g>
      );
    case 'C':
      return <g><path d="M -14 45 Q 0 41 14 45 Q 11 58 0 58 Q -11 58 -14 45 Z" fill={MOUTH_IN} {...ol(2.4)} />{tongue(0, 54, 7, 3)}</g>;
    case 'D':
      return (
        <g>
          <path d="M -15 43 Q 0 39 15 43 Q 13 66 0 66 Q -13 66 -15 43 Z" fill={MOUTH_IN} {...ol(2.4)} />
          <path d="M -11 43 Q 0 41 11 43 L 10 47 Q 0 45 -10 47 Z" fill={TEETH} />
          {tongue(0, 60, 8, 4.5)}
        </g>
      );
    case 'E':
      return <ellipse cx="0" cy="50" rx="9" ry="11" fill={MOUTH_IN} {...ol(2.4)} />;
    case 'F':
      return <g><ellipse cx="0" cy="49" rx="7" ry="6.5" fill={lip} {...ol(2.2)} /><ellipse cx="0" cy="49" rx="3" ry="3" fill={MOUTH_IN} /></g>;
    case 'G':
      return (
        <g>
          <path d="M -13 45 Q 0 43 13 45 L 12 50 Q 0 48 -12 50 Z" fill={TEETH} {...ol(2)} />
          <path d="M -12 52 Q 0 57 12 52" {...line} />
        </g>
      );
    case 'H':
      return <g><path d="M -13 45 Q 0 42 13 45 Q 10 56 0 56 Q -10 56 -13 45 Z" fill={MOUTH_IN} {...ol(2.4)} />{tongue(0, 46, 6, 3)}</g>;
    default:
      if (rest === 'big') return <g><path d="M -16 44 Q 0 58 16 44 Q 0 48 -16 44 Z" fill={TEETH} {...ol(2.4)} />{under(57)}</g>;
      if (rest === 'laugh') return <g><path d="M -17 43 Q 0 66 17 43 Q 0 46 -17 43 Z" fill={MOUTH_IN} {...ol(2.4)} /><path d="M -13 44 Q 0 47 13 44 L 12 48 Q 0 50 -12 48 Z" fill={TEETH} />{tongue(0, 57, 7, 3.5)}</g>;
      if (rest === 'o') return <ellipse cx="0" cy="50" rx="6" ry="8" fill={MOUTH_IN} {...ol(2.2)} />;
      if (rest === 'frown') return <g><path d="M -12 51 Q 0 45 12 51" {...line} />{under(56)}</g>;
      if (rest === 'flat') return <g><path d="M -12 48 L 12 48" {...line} />{under(54)}</g>;
      if (rest === 'side') return <g><path d="M -11 49 Q 2 49 12 45" {...line} />{under(54)}</g>;
      if (rest === 'smirk') return <g><path d="M -11 48 Q 4 50 14 43" {...line} />{under(54)}</g>;
      if (rest === 'grit') return <g><path d="M -14 45 L 14 45 L 13 52 L -13 52 Z" fill={TEETH} {...ol(2.2)} /><path d="M -13 48.5 L 13 48.5" stroke={INK} strokeWidth="1.2" opacity="0.6" /></g>;
      if (rest === 'wobble') return <path d="M -12 49 Q -8 45 -4 49 Q 0 53 4 49 Q 8 45 12 49" {...line} />;
      return <g><path d="M -14 46 Q 0 52 14 45" {...line} />{under(54)}</g>;
  }
};

// A small almond eye: white, a dark-brown iris, a firm upper lid line, a faint crease above and a faint lower lid.
const Eye = ({cx, look, e, blink, skin}) => {
  const cy = -8;
  const rx = 11;
  const ry = 5.6 * e.eyeH;
  if (e.shut || blink) {   // closed: a happy arc when laughing, a soft line when blinking
    return e.shut
      ? <path d={`M ${cx - rx} ${cy + 1} Q ${cx} ${cy - 8} ${cx + rx} ${cy + 1}`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      : <path d={`M ${cx - rx} ${cy} Q ${cx} ${cy + 4} ${cx + rx} ${cy}`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />;
  }
  const top = cy - 1.6 * ry;   // control point of the upper curve (its peak is halfway)
  const lidPeak = cy - 0.8 * ry + e.lid * 1.5 * ry;
  const [lx, ly] = look;
  const ix = cx + Math.max(-5, Math.min(5, lx * 0.6));
  const iy = cy + Math.max(-2, Math.min(2, ly * 0.4 + (e.up ? -2 : 0))) + 0.6;
  const id = `eye${cx < 0 ? 'L' : 'R'}${Math.round(ry * 10)}`;   // same shape -> same id, so many faces in one picture can share it
  return (
    <g>
      <defs><clipPath id={id}><path d={`M ${cx - rx} ${cy} Q ${cx} ${top} ${cx + rx} ${cy} Q ${cx} ${cy + 1.1 * ry} ${cx - rx} ${cy} Z`} /></clipPath></defs>
      <path d={`M ${cx - rx} ${cy} Q ${cx} ${top} ${cx + rx} ${cy} Q ${cx} ${cy + 1.1 * ry} ${cx - rx} ${cy} Z`} fill={TEETH} />
      <g clipPath={`url(#${id})`}>
        <circle cx={ix} cy={iy} r="5" fill="#3E2A1E" />
        <circle cx={ix + 1.6} cy={iy - 1.6} r="1.2" fill="#FFFFFF" opacity="0.85" />
      </g>
      {e.lid > 0.02 && <path d={`M ${cx - rx - 2} ${cy} L ${cx - rx - 2} ${cy - 2.4 * ry} L ${cx + rx + 2} ${cy - 2.4 * ry} L ${cx + rx + 2} ${cy} Q ${cx} ${2 * lidPeak - cy} ${cx - rx - 2} ${cy} Z`} fill={skin} />}
      <path d={`M ${cx - rx - 1} ${cy + 0.5} Q ${cx} ${e.lid > 0.02 ? 2 * lidPeak - cy : top} ${cx + rx + 1} ${cy - 0.5}`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d={`M ${cx - rx + 3} ${cy + 0.8 * ry + 1} Q ${cx} ${cy + 1.2 * ry + 1} ${cx + rx - 3} ${cy + 0.8 * ry + 1}`} {...fold(1.3, e.squint ? 0.7 : 0.35)} />
      <path d={`M ${cx - rx + 2} ${cy - 1.9 * ry} Q ${cx} ${cy - 2.6 * ry} ${cx + rx - 1} ${cy - 1.8 * ry}`} {...fold(1.2, 0.35)} />
    </g>
  );
};

// Hair, in head units (face from y -82 to the chin at 76, half width ~52).
const HairBack = ({c}) => {
  const h = c.hair;
  if (c.hairStyle === 'curly') {
    const pts = arcPts(0, -22, 72, 74, 150, 390, 15);
    return (
      <g>
        <path d={`M ${pts[0][0]} ${pts[0][1]} ${bumps(pts, 0, -22, 11)} L 40 14 L -40 14 Z`} fill={h} {...ol()} />
        {curlMarks(arcPts(0, -26, 56, 58, 160, 380, 9), shade(h, 0.7), 3)}
      </g>
    );
  }
  if (c.hairStyle === 'short') {
    const pts = arcPts(0, -18, 58, 68, 165, 375, 16);
    return <path d={`M ${pts[0][0]} ${pts[0][1]} ${bumps(pts, 0, -18, 4)} L 40 10 L -40 10 Z`} fill={h} {...ol()} />;
  }
  if (c.hairStyle === 'bun') {
    const bun = arcPts(0, -94, 26, 22, 0, 360, 10);
    const pts = arcPts(0, -16, 60, 72, 160, 380, 14);
    return (
      <g>
        <path d={`M ${bun[0][0]} ${bun[0][1]} ${bumps(bun, 0, -94, 4)} Z`} fill={h} {...ol()} />
        {curlMarks(arcPts(0, -94, 13, 10, 0, 300, 3), shade(h, 0.7), 11)}
        <path d={`M ${pts[0][0]} ${pts[0][1]} ${bumps(pts, 0, -16, 4)} L 44 30 L -44 30 Z`} fill={h} {...ol()} />
      </g>
    );
  }
  if (c.hairStyle === 'receding' || c.hairStyle === 'fringe') {   // the back of the head, seen around the neck
    const pts = arcPts(0, -6, 58, 50, 150, 390, 12);
    return <path d={`M ${pts[0][0]} ${pts[0][1]} ${bumps(pts, 0, -6, 6)} L 40 30 L -40 30 Z`} fill={h} {...ol()} />;
  }
  if (c.hairStyle === 'bald') {
    const pts = arcPts(0, 4, 56, 30, 160, 380, 10);
    return <path d={`M ${pts[0][0]} ${pts[0][1]} ${bumps(pts, 0, 4, 4)} L 40 30 L -40 30 Z`} fill={h} {...ol()} />;
  }
  return null;
};

// A tuft of hair over one temple and ear, scalloped on the outside (mirrored for the right side).
const SideTuft = ({h, flip, big}) => {
  const pts = arcPts(-50, -12, big ? 18 : 13, big ? 34 : 26, 95, 265, 6);
  return (
    <g transform={flip ? 'scale(-1 1)' : undefined}>
      <path d={`M ${pts[0][0]} ${pts[0][1]} ${bumps(pts, -50, -12, 5)} Q -40 -14 ${pts[0][0]} ${pts[0][1]} Z`} fill={h} {...ol(LW * 0.9)} />
      {curlMarks([[-58, -24], [-58, -2]], shade(h, 0.72), 7, 1.5)}
    </g>
  );
};

const HairFront = ({c}) => {
  const h = c.hair;
  if (c.hairStyle === 'curly') {
    const pts = arcPts(0, -40, 50, 34, 192, 348, 9);
    return (
      <g>
        <path d={`M ${pts[0][0]} ${pts[0][1]} ${bumps(pts, 0, -120, 7)} L 54 -40 Q 56 -100 0 -102 Q -56 -100 -54 -40 Z`} fill={h} />
        <path d={`M ${pts[0][0]} ${pts[0][1]} ${bumps(pts, 0, -120, 7)}`} fill="none" {...ol()} />
        {curlMarks(arcPts(0, -50, 34, 24, 200, 340, 5), shade(h, 0.7), 5)}
      </g>
    );
  }
  if (c.hairStyle === 'short') {
    const pts = arcPts(0, -36, 52, 40, 190, 350, 10);
    return (
      <g>
        <path d={`M ${pts[0][0]} ${pts[0][1]} ${bumps(pts, 0, -120, 3)} L 56 -36 Q 58 -94 0 -96 Q -58 -94 -56 -36 Z`} fill={h} />
        <path d={`M ${pts[0][0]} ${pts[0][1]} ${bumps(pts, 0, -120, 3)}`} fill="none" {...ol()} />
        <path d="M -30 -74 q 10 -6 20 -2 M 6 -80 q 10 -4 20 2" {...fold(1.4, 0.4)} />
      </g>
    );
  }
  if (c.hairStyle === 'bun') {
    return (
      <g>
        <path d="M 0 -84 Q -42 -84 -54 -30 Q -50 -10 -46 4 Q -40 -36 -22 -58 Q -8 -66 0 -62 Q 8 -66 22 -58 Q 40 -36 46 4 Q 50 -10 54 -30 Q 42 -84 0 -84 Z" fill={h} {...ol()} />
        <path d="M -6 -78 Q -30 -70 -44 -32 M -14 -80 Q -38 -66 -50 -20 M 6 -78 Q 30 -70 44 -32 M 14 -80 Q 38 -66 50 -20" {...fold(1.4, 0.45)} />
      </g>
    );
  }
  if (c.hairStyle === 'receding' || c.hairStyle === 'fringe' || c.hairStyle === 'bald') {
    const big = c.hairStyle !== 'bald';
    return (
      <g>
        <SideTuft h={h} big={big} />
        <SideTuft h={h} big={big} flip />
        {big && <path d="M -16 -82 q 6 -9 15 -5 M 4 -84 q 7 -7 14 -1" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />}
      </g>
    );
  }
  return null;
};

// Beards fall in flowing curls: a scalloped lower edge, curl strokes inside, a hole for the mouth.
const Beard = ({c}) => {
  const b = c.beardColor || c.hair;
  if (c.beard === 'none' || !c.beard) return null;
  if (c.beard === 'stubble') return <path d="M -50 10 Q -46 70 0 80 Q 46 70 50 10 Q 36 46 0 50 Q -36 46 -50 10 Z" fill={b} opacity="0.22" />;
  const ry = {short: 74, full: 96, long: 150}[c.beard] || 96;
  const rx = c.beard === 'long' ? 50 : 54;
  const pts = arcPts(0, 4, rx, ry, 4, 176, c.beard === 'long' ? 9 : 10);
  const inner = 'Q -44 30 -22 34 Q 0 30 22 34 Q 44 30 53 -6 Z';
  const hole = 'M -18 48 A 18 12 0 1 0 18 48 A 18 12 0 1 0 -18 48 Z';
  const shape = `M 53 -6 L ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} ${bumps(pts, 0, 4, c.beard === 'short' ? 4 : 7)} L -53 -6 ${inner} ${hole}`;
  const marks = c.beard === 'long'
    ? [[-30, 70], [-12, 92], [8, 80], [26, 70], [-20, 120], [4, 124], [-6, 148]]
    : [[-36, 50], [-24, 74], [0, 82], [24, 74], [36, 50], [-10, 100], [12, 98]].slice(0, c.beard === 'short' ? 5 : 7);
  return (
    <g>
      <path d={shape} fill={b} fillRule="evenodd" {...ol(LW * 0.9)} />
      {curlMarks(marks, shade(b, 0.72), 13, 1.8)}
      {c.beard === 'long' && <path d="M -20 90 Q -16 130 -6 160 M 14 96 Q 16 130 8 150" {...fold(1.4, 0.4)} />}
    </g>
  );
};

const Moustache = ({c}) => {
  if (!c.beard || c.beard === 'none' || c.beard === 'stubble') return null;
  const b = c.beardColor || c.hair;
  return <path d="M 0 37 Q -12 31 -22 37 Q -28 43 -24 51 Q -18 42 0 43 Q 18 42 24 51 Q 28 43 22 37 Q 12 31 0 37 Z" fill={b} {...ol(LF)} />;
};

const Headwear = ({c}) => {
  if (c.headwear === 'diadem') {   // a thin gold band with small leaves
    return (
      <g>
        <path d="M -56 -54 Q 0 -76 56 -54 L 55 -47 Q 0 -68 -55 -47 Z" fill="#C9A060" {...ol(LF)} />
        {[-36, -18, 0, 18, 36].map((x) => <ellipse key={x} cx={x} cy={-68 + Math.abs(x) * 0.18} rx="3.5" ry="7" fill="#C9A060" {...ol(1.4)} />)}
      </g>
    );
  }
  if (c.headwear === 'laurel') {
    return <g>{Array.from({length: 9}).map((_, i) => <ellipse key={i} cx={-54 + i * 13.5} cy={-60 - Math.sin((i / 8) * Math.PI) * 14} rx="5" ry="10" fill="#7E8A5A" {...ol(1.4)} transform={`rotate(${-50 + i * 12} ${-54 + i * 13.5} ${-60 - Math.sin((i / 8) * Math.PI) * 14})`} />)}</g>;
  }
  if (c.headwear === 'band') return <path d="M -54 -50 Q 0 -72 54 -50 L 53 -42 Q 0 -63 -53 -42 Z" fill="#A8664C" {...ol(LF)} />;
  if (c.headwear === 'helmet') {
    return (
      <g>
        <path d="M -10 -104 Q 0 -200 96 -134 Q 50 -150 26 -104 Z" fill="#A4513C" {...ol()} />
        <path d="M 2 -108 Q 18 -170 80 -138" {...fold(1.6, 0.45)} />
        <path d="M -62 -6 Q -70 -102 0 -106 Q 70 -102 62 -6 L 50 -10 L 48 -42 Q 0 -58 -48 -42 L -50 -10 Z" fill="#B8894A" {...ol()} />
        <path d="M -56 -44 Q 0 -62 56 -44" {...fold(LF, 0.6)} />
        <path d="M -40 -90 Q -10 -100 10 -98" fill="none" stroke="#E2C48C" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
      </g>
    );
  }
  return null;
};

// A natural straight nose: one side line, the base with nostrils, a soft shade on one side.
const Nose = ({skin}) => (
  <g>
    <path d="M 5 -14 Q 11 10 15 24 Q 10 31 3 30 Z" fill={shade(skin, 0.9)} />
    <path d="M 5 -14 Q 10 8 15 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M 15 24 Q 12 31 4 30 Q -4 32 -10 27" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M -6 27 q 3 2 6 0 M 6 28 q 3 2 5 -1" {...fold(1.4, 0.55)} />
  </g>
);

const Face = ({c, mouth, blink, brow = 0, expression = 'neutral', look = [0, 0], beardSway = 0}) => {
  const e = EXPR[expression] || EXPR.neutral;
  const by = -26 - brow - e.lift;
  const t = e.tilt;
  const browColor = c.brows === HAIR.white ? HAIR.grey : c.brows || INK;
  const bw = c.brows === HAIR.white || c.brows === HAIR.grey ? 5.5 : 4.5;
  return (
    <g>
      <ellipse cx="-51" cy="2" rx="8" ry="15" fill={c.skin} {...ol(LW * 0.8)} />
      <ellipse cx="51" cy="2" rx="8" ry="15" fill={c.skin} {...ol(LW * 0.8)} />
      <path d="M -52 -4 q 3 -6 5 2 M 52 -4 q -3 -6 -5 2" {...fold(1.3, 0.5)} />
      {c.earrings && <g><circle cx="-52" cy="22" r="4" fill="#C9A060" {...ol(1.4)} /><circle cx="52" cy="22" r="4" fill="#C9A060" {...ol(1.4)} /></g>}
      <path d="M -50 -22 Q -52 -82 0 -84 Q 52 -82 50 -22 Q 50 30 36 56 Q 20 76 0 76 Q -20 76 -36 56 Q -50 30 -50 -22 Z" fill={c.skin} {...ol()} />
      <path d="M 50 -22 Q 50 30 36 56 Q 26 68 14 73 Q 38 40 42 -20 Z" fill={shade(c.skin, 0.93)} />
      <ellipse cx="-30" cy="22" rx="10" ry="6" fill="#C8573A" opacity={e.cheek} />
      <ellipse cx="30" cy="22" rx="10" ry="6" fill="#C8573A" opacity={e.cheek} />
      {c.wrinkles && <path d="M -24 -52 Q 0 -57 24 -52 M -18 -44 Q 0 -48 18 -44 M -42 -4 q -4 4 -2 8 M 42 -4 q 4 4 2 8" {...fold(1.4, 0.4)} />}
      <Eye cx={-21} look={look} e={e} blink={blink} skin={c.skin} />
      <Eye cx={21} look={look} e={e} blink={blink} skin={c.skin} />
      {c.lashes && !blink && !e.shut && <path d="M -32 -10 L -36 -13 M 32 -10 L 36 -13" stroke={INK} strokeWidth="2" strokeLinecap="round" />}
      <path d={`M -36 ${by + t * 0.5 - e.asym} Q -22 ${by - 5 - e.asym} -9 ${by - t * 0.5 - e.asym}`} fill="none" stroke={browColor} strokeWidth={bw} strokeLinecap="round" />
      <path d={`M 9 ${by - t * 0.5} Q 22 ${by - 5} 36 ${by + t * 0.5}`} fill="none" stroke={browColor} strokeWidth={bw} strokeLinecap="round" />
      <g transform={beardSway ? `rotate(${beardSway} 0 30)` : undefined}><Beard c={c} /></g>
      <Mouth shape={mouth} rest={e.rest} skin={c.skin} />
      <Moustache c={c} />
      <Nose skin={c.skin} />
      {e.sweat && <path d="M 44 -46 Q 40 -36 44 -32 Q 48 -36 44 -46 Z" fill="#B7CFCF" {...ol(1.4)} />}
    </g>
  );
};

/** The head alone (hair, face with mouth and expression, beard, hat), in head units: used by the reference sheets and close-ups. */
export const Head = ({who = 'scholar', look: lookOverride = null, mouth = 'X', expression = 'neutral', look = [0, 0], blink = false}) => {
  const c = lookOverride || castOf(who);
  return (
    <g>
      <HairBack c={c} />
      <Face c={c} mouth={mouth} blink={blink} expression={expression} look={look} />
      <HairFront c={c} />
      <Headwear c={c} />
    </g>
  );
};

// A slim bare leg with knee and calf, a small foot and a strapped sandal.
const Leg = ({x, swing, lift, skin, sandal = '#7A4E36'}) => (
  <g transform={`translate(${x} ${HIP_Y}) rotate(${swing}) scale(1 ${1 - lift / (LEG + 24)})`}>
    <path d={`M -15 0 L 15 0 Q 16 90 10 168 Q 15 205 10 250 L 7 ${LEG} L -7 ${LEG} Q -10 250 -12 210 Q -15 182 -11 168 Q -17 90 -15 0 Z`} fill={skin} {...ol()} />
    <path d="M -6 166 q 6 4 12 0" {...fold(1.4, 0.45)} />
    <g transform={`translate(0 ${LEG})`}>
      <path d="M -9 -4 Q -14 14 -10 20 L 12 20 Q 16 12 9 -4 Z" fill={skin} {...ol(LW * 0.8)} />
      <path d="M -12 19 L 14 19 L 14 24 L -12 24 Z" fill={sandal} {...ol(LF)} />
      <path d="M -8 -2 L 9 10 M 8 -2 L -7 10" stroke={sandal} strokeWidth="2.6" strokeLinecap="round" />
    </g>
  </g>
);

const Body = ({c, step = null, flow = 0}) => {   // flow: degrees the hanging cloth swings this frame
  const b = c.build || 1;
  const sw = 60 * b;
  const belly = b > 1.15 ? 60 * (b - 1.15) : 0;
  const waist = 50 * b + belly;
  const hemY = c.long ? -36 : -176;
  const hemW = (c.long ? 66 : 62) * b + belly * 0.5;
  const swing = step === null ? 0 : Math.sin(step) * 18;
  const lift = (v) => (step === null ? 0 : Math.max(0, v) * 16);
  const tunic = `M ${-sw} -482 Q ${-sw * 0.55} -500 -16 -500 Q 0 -486 16 -500 Q ${sw * 0.55} -500 ${sw} -482
    Q ${sw + 6 + belly} -420 ${waist} -372 Q ${hemW + 2} ${(-372 + hemY) / 2} ${hemW} ${hemY}
    Q ${hemW * 0.5} ${hemY + 8} 0 ${hemY + 2} Q ${-hemW * 0.5} ${hemY + 8} ${-hemW} ${hemY}
    Q ${-hemW - 2} ${(-372 + hemY) / 2} ${-waist} -372 Q ${-sw - 6 - belly} -420 ${-sw} -482 Z`;
  const cloakHem = c.long ? -90 : -150;
  const hemD = c.long ? -70 : -160;
  const drape = `M ${-sw - 6} -480 Q ${-sw + 6} -504 ${-sw + 40} -496 Q ${sw * 0.1} -440 ${sw * 0.72} -392
    Q ${sw + 10} -374 ${sw + 12} -350 Q ${hemW + 18} ${(-350 + hemD) / 2} ${hemW + 10} ${hemD}
    Q ${hemW * 0.4} ${hemD + 18} ${-hemW * 0.1} ${hemD + 6} Q ${-hemW * 0.6} ${hemD - 4} ${-hemW - 12} ${hemD + 14}
    Q ${-sw - 22} -300 ${-sw - 6} -480 Z`;
  return (
    <g>
      {c.cloak && (   // the chlamys hanging behind: its inside is in shade
        <g transform={`rotate(${flow} 0 -486)`}>
          <path d={`M ${-sw} -486 Q ${-sw - 30} -300 ${-sw - 46} ${cloakHem} Q 0 ${cloakHem + 14} ${sw + 46} ${cloakHem} Q ${sw + 30} -300 ${sw} -486 Z`} fill={shade(c.cloak, 0.8)} {...ol()} />
          <path d={`M ${-sw - 20} -300 Q ${-sw - 30} -220 ${-sw - 34} ${cloakHem + 4} M ${sw + 20} -300 Q ${sw + 30} -220 ${sw + 34} ${cloakHem + 4}`} {...fold()} />
        </g>
      )}
      <Leg x={-22 * b} swing={swing} lift={lift(Math.sin(step ?? 0))} skin={c.skin} />
      <Leg x={22 * b} swing={-swing} lift={lift(-Math.sin(step ?? 0))} skin={c.skin} />
      {/* the neck, with a soft shadow under the chin */}
      <path d="M -13 -520 L -14 -488 Q 0 -480 14 -488 L 13 -520 Z" fill={c.skin} {...ol(LW * 0.8)} />
      <path d="M -13 -518 Q 0 -506 13 -518 L 13 -508 Q 0 -500 -13 -508 Z" fill={shade(c.skin, 0.88)} />
      {/* the tunic (chiton): a belt with a soft overhang, falling folds, flat soft shade down one side */}
      <path d={tunic} fill={c.tunic} />
      <path d={`M ${sw} -482 Q ${sw + 6 + belly} -420 ${waist} -372 Q ${hemW + 2} ${(-372 + hemY) / 2} ${hemW} ${hemY} L ${hemW * 0.62} ${hemY + 6} Q ${hemW * 0.5} -300 ${waist * 0.62} -372 Q ${sw * 0.7} -440 ${sw * 0.6} -488 Z`} fill={shade(c.tunic, 0.92)} />
      <path d={tunic} fill="none" {...ol()} />
      {c.armour ? (
        <g>
          <path d={`M ${-sw + 4} -486 Q 0 -496 ${sw - 4} -486 L ${waist - 2} -352 Q 0 -340 ${-waist + 2} -352 Z`} fill="#B8894A" {...ol()} />
          <path d="M -28 -450 Q -14 -434 0 -446 Q 14 -434 28 -450 M -22 -400 Q 0 -390 22 -400 M 0 -446 L 0 -370" {...fold(LF, 0.5)} />
          {[-0.75, -0.38, 0, 0.38, 0.75].map((k) => <rect key={k} x={k * waist - 9} y="-350" width="18" height="52" rx="3" fill="#9C7446" {...ol(LF)} />)}
        </g>
      ) : (
        <g>
          <path d={`M ${-waist} -378 Q 0 -360 ${waist} -378`} fill="none" stroke={INK} strokeWidth={LF + 0.6} strokeLinecap="round" />
          <path d={`M ${-waist + 6} -372 Q 0 -356 ${waist - 6} -372`} {...fold(1.4, 0.35)} />
          <path d={`M ${-hemW * 0.55} ${hemY - 4} Q ${-hemW * 0.5} -280 ${-waist * 0.5} -364 M ${-hemW * 0.15} ${hemY} Q ${-hemW * 0.18} -280 ${-waist * 0.12} -362
            M ${hemW * 0.25} ${hemY} Q ${hemW * 0.2} -280 ${waist * 0.2} -362 M ${-hemW * 0.35} ${hemY + 2} Q ${-hemW * 0.32} ${hemY - 50} ${-hemW * 0.3} ${hemY - 90}`} {...fold(1.6, 0.42)} />
          <path d={`M -10 -494 Q -18 -440 -26 -392 M 12 -494 Q 18 -450 24 -400 M -${sw * 0.6} -470 Q -${sw * 0.5} -430 -${sw * 0.55} -392`} {...fold(1.4, 0.35)} />
        </g>
      )}
      {c.drape && (   // the himation: over the left shoulder, wrapped across the body to the right hip, falling to the calves
        <g>
          <path d={drape} fill={c.drape} />
          <path d={`M ${-sw - 6} -470 Q ${-sw - 20} -300 ${-hemW - 12} ${hemD + 14} L ${-hemW + 10} ${hemD + 4} Q ${-sw + 4} -300 ${-sw + 10} -470 Z`} fill={shade(c.drape, 0.86)} />
          <path d={`M ${-sw + 34} -490 Q ${sw * 0.12} -430 ${sw + 8} -362 L ${sw + 12} -350 Q ${sw * 0.7} -392 ${sw * 0.1} -440 Q ${-sw + 20} -480 ${-sw + 34} -490 Z`} fill={shade(c.drape, 0.84)} />
          <path d={drape} fill="none" {...ol()} />
          <path d={`M ${-sw + 30} -478 Q ${sw * 0.15} -422 ${sw + 6} -360`} {...fold(LF, 0.6)} />
          {[0.15, 0.4, 0.68].map((k) => (
            <path key={k} d={`M ${-sw + 10 + k * 30} ${-452 + k * 40} Q ${-sw * 0.3 + k * sw} -300 ${-hemW * 0.75 + k * hemW * 1.5} ${hemD - 2}`} {...fold(1.6, 0.45)} />
          ))}
          <path d={`M ${-hemW * 0.5} -330 Q ${hemW * 0.1} -290 ${hemW * 0.85} -340 M ${-hemW * 0.3} -270 Q ${hemW * 0.2} -236 ${hemW * 0.8} -280`} {...fold(1.5, 0.4)} />
          {c.trim && <path d={`M ${hemW + 10} ${hemD} Q ${hemW * 0.4} ${hemD + 18} ${-hemW * 0.1} ${hemD + 6} Q ${-hemW * 0.6} ${hemD - 4} ${-hemW - 12} ${hemD + 14}`} fill="none" stroke={c.trim} strokeWidth="4" />}
          {/* its end hanging down the front from the left shoulder, with a zigzag hem (it swings a little) */}
          <g transform={`rotate(${flow * 1.5} ${-sw + 4} -492)`}>
            <path d={`M ${-sw + 4} -492 Q ${-sw + 26} -440 ${-sw + 20} -378 L ${-sw + 28} -340 L ${-sw + 8} -352 L ${-sw - 6} -330 Q ${-sw - 12} -420 ${-sw + 4} -492 Z`} fill={c.drape} {...ol(LW * 0.9)} />
            <path d={`M ${-sw + 6} -470 Q ${-sw + 12} -410 ${-sw + 8} -356`} {...fold(1.5, 0.45)} />
          </g>
        </g>
      )}
      {c.cloak && (   // the cloak's front over both shoulders, pinned with a round brooch
        <g>
          <path d={`M ${-sw - 4} -484 Q ${-sw + 16} -502 ${-sw + 34} -494 Q ${-sw + 12} -440 ${-sw - 8} -396 Z`} fill={c.cloak} {...ol(LW * 0.9)} />
          <path d={`M ${sw + 4} -484 Q ${sw - 16} -502 ${sw - 34} -494 Q ${sw - 12} -440 ${sw + 8} -396 Z`} fill={c.cloak} {...ol(LW * 0.9)} />
          <circle cx={sw - 26} cy={-486} r="6" fill="#C9A060" {...ol(LF)} />
        </g>
      )}
    </g>
  );
};

const HeldProp = ({c, x, y, tilt}) => {
  const p = c.prop;
  const at = `translate(${x} ${y}) rotate(${tilt})`;
  if (p === 'scroll') {
    return (
      <g transform={at}>
        <rect x="-16" y="-50" width="32" height="110" rx="6" fill="#EFE3C8" {...ol(LW * 0.9)} />
        <ellipse cx="0" cy="-50" rx="16" ry="6" fill="#DCC8A0" {...ol(LF)} />
        <ellipse cx="0" cy="60" rx="16" ry="6" fill="#DCC8A0" {...ol(LF)} />
        <path d="M -8 -24 L 8 -24 M -8 -10 L 8 -10 M -8 4 L 4 4" {...fold(1.6, 0.5)} />
      </g>
    );
  }
  if (p === 'sceptre') {
    return (
      <g transform={at}>
        <line x1="0" y1="60" x2="0" y2="-300" stroke={INK} strokeWidth={7 + LW * 2} strokeLinecap="round" />
        <line x1="0" y1="60" x2="0" y2="-300" stroke="#C9A060" strokeWidth="7" strokeLinecap="round" />
        <circle cx="0" cy="-314" r="16" fill="#C9A060" {...ol()} />
        <path d="M -8 -318 q 8 -8 16 0" {...fold(1.4, 0.5)} />
      </g>
    );
  }
  if (p === 'spear') {
    return (
      <g transform={at}>
        <line x1="0" y1="170" x2="0" y2="-420" stroke={INK} strokeWidth={7 + LW * 2} strokeLinecap="round" />
        <line x1="0" y1="170" x2="0" y2="-420" stroke="#8A6248" strokeWidth="7" strokeLinecap="round" />
        <path d="M 0 -470 Q 14 -436 9 -412 L -9 -412 Q -14 -436 0 -470 Z" fill="#BDB5A6" {...ol()} />
      </g>
    );
  }
  if (p === 'staff') {
    return (
      <g transform={at}>
        <path d="M 0 250 L 0 -216 Q 0 -250 22 -244" fill="none" stroke={INK} strokeWidth={9 + LW * 2} strokeLinecap="round" />
        <path d="M 0 250 L 0 -216 Q 0 -250 22 -244" fill="none" stroke="#8A6248" strokeWidth="9" strokeLinecap="round" />
      </g>
    );
  }
  if (p === 'bag') {
    return (
      <g transform={at}>
        <path d="M -6 8 Q -30 44 -20 70 Q 0 80 20 70 Q 30 44 6 8 Z" fill="#8E6448" {...ol()} />
        <path d="M -9 12 L 9 12" stroke="#C9A060" strokeWidth="4" strokeLinecap="round" />
        <path d="M -12 40 Q -6 56 -10 66 M 8 38 Q 12 54 10 66" {...fold(1.4, 0.45)} />
      </g>
    );
  }
  return null;
};

/**
 * who, pose (blends into poseTo by `blend`), mouth (Rhubarb letter, or the old 0|1|2), x and y (where the feet are), scale,
 * frame (frames since the scene began), enterAt (frames before popping in), seed (desynchronises idle motion), expression,
 * look [x, y] (eyes), walking, noProp, look_ (a crowd person's own look instead of a cast member), facing (-1 = mirrored),
 * action + actionAge (frames since that action began: jump, flinch, double_take, nod, shrug add their movement on top)
 */
export const Character = ({who = 'scholar', pose = 'stand', poseTo = null, blend = 0, mouth = 0, x = 540, y = 1180, scale = 1.3, frame,
  enterAt = 0, seed = 0, expression = 'neutral', look = [0, 0], walking = false, noProp = false, look_ = null, facing = 1, hop = 0,
  action = null, actionAge = null}) => {
  const {fps} = useVideoConfig();
  const c = look_ || castOf(who);
  const A = POSES[pose] || POSES.stand;
  const B = POSES[poseTo] || A;
  const mix = (u, v) => u + (v - u) * Math.max(0, Math.min(1, blend));
  const P = {L: [mix(A.L[0], B.L[0]), mix(A.L[1], B.L[1])], R: [mix(A.R[0], B.R[0]), mix(A.R[1], B.R[1])], head: mix(A.head, B.head)};
  const enter = spring({frame: frame - enterAt, fps, config: {damping: 14, stiffness: 110, mass: 0.8}});
  const t = frame + seed * 17;
  const stride = walking ? frame / 3.6 : null;   // one full step cycle about every 22 frames
  const talking = typeof mouth === 'string' ? !(mouth === 'X' || mouth === 'A') : mouth > 0;
  const breathe = Math.sin(t / 9) * 0.006;
  const sway = walking ? Math.sin(stride) * 2 : Math.sin(t / 23) * 1.4;
  const bob = (walking ? -Math.abs(Math.sin(stride)) * 10 : 0) - Math.abs(Math.sin(t / 5)) * hop;
  const nod = talking ? Math.sin(t / 3.4) * 2.2 : 0;   // a speaker's head moves gently with the words
  const blinkNow = frame > 20 && (t + seed * 29) % 104 < 4;
  const gestureArm = talking ? Math.sin(t / 8) * 5 : 0;
  const swayArm = walking ? Math.sin(stride) * 10 : pose === 'wave' && !poseTo ? Math.sin(t / 3) * 14 : Math.sin(t / 13) * 2;
  const laughShake = expression === 'laughing' ? Math.sin(t * 1.3) * 1.6 : 0;
  const [lsh, lel] = P.L;
  const [rsh, rel] = P.R;
  const b = c.build || 1;
  const tall = c.tall || 1;
  const [hx, hy, hth] = handAt(-1, lsh + swayArm, lel, b);
  const eff = Math.max(0, enter);
  const k = scale * (0.9 + 0.1 * eff);
  const pointing = (pose === 'point' && (!poseTo || blend < 0.5)) || (poseTo === 'point' && blend >= 0.5);
  const palm = (pose === 'facepalm' && (!poseTo || blend < 0.5)) || (poseTo === 'facepalm' && blend >= 0.5);   // that hand goes over the face
  const act = actionMotion(action, actionAge);
  // secondary motion: the hanging cloth and a long beard swing a little after the body (more when walking or jumping)
  const flow = walking ? Math.sin(stride - 0.6) * 4 : Math.sin(t / 17) * 1.5 + act.up * 0.03;
  const beardSway = Math.sin(t / 19 + 1) * 1.6 + (walking ? Math.sin(stride - 0.8) * 2.5 : 0);
  const armR = <Arm side={1} shoulder={rsh + (walking ? -swayArm : swayArm) + (palm ? 0 : gestureArm)} elbow={rel} skin={c.skin} sleeve={c.tunic} build={b} finger={pointing} armour={c.armour} />;
  return (
    <g transform={`translate(${x} ${y + bob + (1 - eff) * 80 - act.up * k}) scale(${k * facing * (act.away ? -1 : 1)} ${k * tall * (1 + breathe) * act.squash}) rotate(${sway * 0.4 + laughShake * 0.3 + act.lean})`} opacity={Math.min(1, eff * 2)}>
      <ellipse cx="0" cy="22" rx={80 * b} ry="12" fill={INK} opacity={0.14 * Math.max(0.4, 1 - act.up / 200)} transform={`translate(0 ${act.up})`} />
      <Body c={c} step={stride} flow={flow} />
      {!palm && armR}
      <Arm side={-1} shoulder={lsh + swayArm} elbow={lel} skin={c.skin} sleeve={c.drape || c.tunic} build={b} armour={c.armour} />
      {!noProp && <HeldProp c={c} x={hx} y={hy} tilt={-hth * 0.22} />}
      <g transform={`translate(0 ${HEAD_Y}) rotate(${P.head + sway + nod + laughShake + act.nod}) scale(${HEAD_K})`}>
        <HairBack c={c} />
        <Face c={c} mouth={mouth} blink={blinkNow} brow={pose === 'amazed' ? 6 : talking ? Math.max(0, Math.sin(t / 11)) * 3 : 0}
          expression={pose === 'amazed' && expression === 'neutral' ? 'surprised' : expression} look={look} beardSway={c.beard === 'long' || c.beard === 'full' ? beardSway : 0} />
        <HairFront c={c} />
        <Headwear c={c} />
      </g>
      {palm && armR}
    </g>
  );
};

// Crowd reactions: pose, expression, hop height, whether mouths move.
const REACT = {
  idle: ['stand', 'neutral', 0, false],
  cheer: ['cheer', 'happy', 8, true],
  gasp: ['amazed', 'surprised', 0, false],
  laugh: ['stand', 'laughing', 2, true],
  murmur: ['stand', 'thinking', 0, true],
  angry: ['point', 'angry', 3, true],
  scared: ['shrug', 'scared', 0, false],
};
export const REACTIONS = Object.keys(REACT);

/** A row of townspeople behind the main characters, each with their own look, reacting together (slightly out of step). */
export const Crowd = ({size = 5, reaction = 'idle', frame, y = 1060, scale = 0.5, seed = 0, from = 120, to = 960}) => {
  const n = Math.max(2, Math.min(9, size));
  const [pose, expression, hop, chatter] = REACT[reaction] || REACT.idle;
  const shapes = ['C', 'D', 'E', 'B', 'X', 'C'];
  return (
    <g>
      {Array.from({length: n}).map((_, i) => {
        const s = seed * 13 + i + 1;
        const x = from + ((to - from) * (i + 0.5)) / n + (rnd(s * 3.3) - 0.5) * 40;
        const lag = Math.floor(rnd(s) * 8);
        const f = Math.max(0, frame - lag);
        const mouth = chatter ? shapes[Math.floor((f / 4 + i) % shapes.length)] : 'X';
        return (
          <Character key={i} look_={crowdLook(s)} who="citizen" pose={i % 3 === 1 && reaction === 'idle' ? 'explain' : pose} mouth={mouth}
            expression={expression} x={x} y={y + (i % 2) * 26} scale={scale * (0.92 + rnd(s * 2.7) * 0.16)} frame={f} enterAt={2 + i * 2} seed={s}
            noProp hop={hop} facing={x > 540 ? -1 : 1} look={[x > 540 ? -5 : 5, 0]} />
        );
      })}
    </g>
  );
};
