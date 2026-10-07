import React from 'react';
import {spring, useVideoConfig} from 'remotion';
import {C, LINE, rnd} from './theme';

/*
 * The cast (kit v2, 2.20.0): funny cartoon ancient-world people in the owner's reference style (flat vector, warm earth colours,
 * ink outlines, long faces with big noses, heavy lids, curly hair and beards, tunics with a draped cloak, bare legs, sandals).
 * Drawn in parts (legs, tunic, drape, arms with hands, head with hair, beard, headwear, held prop) so poses, mouths and
 * expressions are just numbers. Local coordinates: origin between the feet, y grows downward, a figure is ~600 tall.
 * There is no on-screen narrator any more: the narrator is a voice only. Nobody holds a POV sign.
 */
export const POSES = {
  // [shoulder, elbow] in degrees, "outward and up" is positive. L is the arm that holds the prop.
  stand: {L: [14, 20], R: [12, 14], head: 0},
  point: {L: [14, 20], R: [88, 4], head: -4},
  explain: {L: [14, 20], R: [48, 80], head: 3},
  amazed: {L: [118, 40], R: [150, 16], head: -7},
  wave: {L: [14, 20], R: [152, 24], head: 3},
  think: {L: [14, 20], R: [40, 140], head: 6},
  present: {L: [14, 20], R: [58, 70], head: -2},
  shrug: {L: [52, 96], R: [52, 96], head: 8},
  cheer: {L: [160, 10], R: [160, 10], head: -6},
};
// The nine mouth shapes of Rhubarb Lip Sync (MIT licence): A closed (P B M), B teeth together (K S T), C open (EH), D wide
// (AA), E rounded (AO), F pucker (OO W), G teeth on lip (F V), H tongue up (L), X rest. Old scene files use 0/1/2.
export const MOUTHS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'X'];
export const EXPRESSIONS = ['neutral', 'happy', 'surprised', 'worried', 'determined', 'thinking', 'laughing', 'angry', 'smug', 'scared'];
const LEGACY_MOUTH = {0: 'X', 1: 'C', 2: 'D'};

// lift: brows up (px); tilt: inner brow ends up (+, worried) or down (-, cross); asym: left brow extra lift; lid: how far the upper
// lid covers the eye (0 open .. 1 shut, the sleepy-funny look of the reference is ~0.3); eyeH: eye height; pupil: radius;
// rest: the mouth when nobody is talking; cheek: blush
const EXPR = {
  neutral: {lift: 0, tilt: 0, asym: 0, lid: 0.32, eyeH: 1, pupil: 6.5, rest: 'smile', cheek: 0.16},
  happy: {lift: 7, tilt: -3, asym: 0, lid: 0.2, eyeH: 0.92, pupil: 6.5, rest: 'big', cheek: 0.42},
  surprised: {lift: 20, tilt: 0, asym: 0, lid: 0, eyeH: 1.3, pupil: 5, rest: 'o', cheek: 0.1},
  worried: {lift: 9, tilt: 16, asym: 0, lid: 0.12, eyeH: 1.05, pupil: 6, rest: 'frown', cheek: 0.1},
  determined: {lift: -2, tilt: -14, asym: 0, lid: 0.38, eyeH: 0.92, pupil: 6.5, rest: 'flat', cheek: 0.16},
  thinking: {lift: 4, tilt: 4, asym: 14, lid: 0.3, eyeH: 0.95, pupil: 6, rest: 'side', cheek: 0.14, up: true},
  laughing: {lift: 9, tilt: -2, asym: 0, lid: 1, eyeH: 1, pupil: 0, rest: 'laugh', cheek: 0.55, shut: true},
  angry: {lift: -5, tilt: -24, asym: 0, lid: 0.42, eyeH: 0.9, pupil: 6, rest: 'grit', cheek: 0.45},
  smug: {lift: 2, tilt: -6, asym: 12, lid: 0.56, eyeH: 1, pupil: 6.5, rest: 'smirk', cheek: 0.2},
  scared: {lift: 17, tilt: 19, asym: 0, lid: 0, eyeH: 1.3, pupil: 3.6, rest: 'wobble', cheek: 0, sweat: true},
};

const UPPER = 118;
const FORE = 110;
const SHOULDER_Y = -352;
const SHOULDER_X = 76;
const HEAD_Y = -478;   // centre of the face
const HIP_Y = -196;

// Hair and beard colours, skin tones and cloth colours of the reference (muted, warm).
const HAIR = {black: '#2A1B14', brown: '#5A3522', auburn: '#7A3B1E', grey: '#A7A39C', white: '#F2EEE6'};
const SKINS = ['#F0C9A0', '#E3B184', '#D9A06F', '#B97A4E', '#9C6240'];
const CLOTH = ['#F1E6CF', '#D9A45A', '#C8573A', '#7D8A4A', '#3E7C7A', '#8C5A3C', '#5F6B8A', '#B9876A'];

/*
 * Each person: skin, hair (colour, style: curly | fringe | bald | bun | short | none), beard (none | stubble | short | full | long),
 * brows, tunic (colour, long or short), drape (the himation over one shoulder), cloak (behind), build (1 slim .. 1.3 plump),
 * headwear (diadem | laurel | helmet | band | veil), held prop (scroll | sceptre | spear | bag | staff | none), wrinkles, earrings.
 */
const CAST = {
  scholar: {name: 'The Scholar', skin: SKINS[1], hair: HAIR.white, hairStyle: 'fringe', beard: 'long', beardColor: HAIR.white, brows: HAIR.white,
    tunic: CLOTH[0], long: true, drape: CLOTH[5], build: 1.0, prop: 'scroll', wrinkles: true},
  ruler: {name: 'The Ruler', skin: SKINS[2], hair: HAIR.black, hairStyle: 'curly', beard: 'full', beardColor: HAIR.black, brows: HAIR.black,
    tunic: CLOTH[0], long: true, drape: '#6E2A4F', trim: C.gold, build: 1.28, prop: 'sceptre', headwear: 'diadem'},
  citizen: {name: 'The Citizen', skin: SKINS[2], hair: HAIR.brown, hairStyle: 'curly', beard: 'stubble', beardColor: HAIR.brown, brows: HAIR.brown,
    tunic: CLOTH[1], long: false, drape: CLOTH[2], build: 1.0, prop: 'none'},
  woman: {name: 'The Woman', skin: SKINS[1], hair: HAIR.auburn, hairStyle: 'bun', beard: 'none', brows: HAIR.auburn, tunic: CLOTH[4], long: true,
    drape: CLOTH[0], build: 0.96, prop: 'none', headwear: 'band', earrings: true, lashes: true},
  elder: {name: 'The Elder', skin: SKINS[3], hair: HAIR.grey, hairStyle: 'fringe', beard: 'full', beardColor: HAIR.grey, brows: HAIR.grey,
    tunic: CLOTH[0], long: true, drape: CLOTH[7], build: 1.05, prop: 'staff', wrinkles: true},
  merchant: {name: 'The Merchant', skin: SKINS[2], hair: HAIR.black, hairStyle: 'bald', beard: 'full', beardColor: HAIR.black, brows: HAIR.black,
    tunic: CLOTH[3], long: true, drape: CLOTH[1], build: 1.32, prop: 'bag'},
  guard: {name: 'The Guard', skin: SKINS[3], hair: HAIR.black, hairStyle: 'short', beard: 'short', beardColor: HAIR.black, brows: HAIR.black,
    tunic: '#B07A3A', long: false, cloak: C.terracotta, build: 1.12, prop: 'spear', headwear: 'helmet', armour: true},
  worker: {name: 'The Worker', skin: SKINS[4], hair: HAIR.black, hairStyle: 'short', beard: 'stubble', beardColor: HAIR.black, brows: HAIR.black,
    tunic: '#CDB892', long: false, build: 1.12, prop: 'none', headwear: 'band'},
};
export const CAST_IDS = Object.keys(CAST);
export const CAST_INFO = {
  scholar: {name: 'The Scholar', role: 'Old thinker: bald crown, white fringe and long white beard, cream tunic, brown cloak. The scientist or philosopher of the story.', prop: 'a scroll'},
  ruler: {name: 'The Ruler', role: 'Round, pompous king: black curls and beard, gold diadem, purple cloak with gold trim.', prop: 'a sceptre'},
  citizen: {name: 'The Citizen', role: 'Young everyman: brown curls, stubble, short ochre tunic, terracotta cloak. Reacts to everything.', prop: 'nothing'},
  woman: {name: 'The Woman', role: 'Sharp-witted woman: auburn hair in a bun with a band, long teal dress, cream shawl, earrings.', prop: 'nothing'},
  elder: {name: 'The Elder', role: 'Grumpy old man: grey fringe and beard, cream tunic, brown cloak, walking staff.', prop: 'a staff'},
  merchant: {name: 'The Merchant', role: 'Plump, bald trader: black beard, olive tunic, ochre cloak, coin purse.', prop: 'a coin purse'},
  guard: {name: 'The Guard', role: 'Soldier: bronze helmet with a red crest, bronze armour, red cloak, spear.', prop: 'a spear'},
  worker: {name: 'The Worker', role: 'Strong labourer: short black hair, headband, plain short tunic.', prop: 'nothing'},
};
// Old scene files may still name the on-screen narrator: he is gone, so a citizen stands in.
const ALIAS = {narrator: 'citizen'};
export const castOf = (who) => CAST[ALIAS[who] || who] || CAST.citizen;

/** A seeded crowd person: one of the cast's looks with its own colours, so a crowd never looks cloned. */
export const crowdLook = (seed) => {
  const base = ['citizen', 'woman', 'elder', 'merchant', 'worker', 'citizen', 'woman'][Math.floor(rnd(seed * 3.1) * 7)];
  const c = {...CAST[base]};
  c.skin = SKINS[Math.floor(rnd(seed * 5.7) * SKINS.length)];
  c.tunic = CLOTH[Math.floor(rnd(seed * 7.3) * CLOTH.length)];
  c.drape = rnd(seed * 2.2) < 0.6 ? CLOTH[Math.floor(rnd(seed * 9.1) * CLOTH.length)] : null;
  if (base !== 'woman' && base !== 'elder') {
    const h = [HAIR.black, HAIR.brown, HAIR.auburn, HAIR.black][Math.floor(rnd(seed * 4.4) * 4)];
    c.hair = h;
    c.brows = h;
    c.beardColor = h;
    c.beard = ['none', 'stubble', 'short', 'full'][Math.floor(rnd(seed * 6.6) * 4)];
    c.hairStyle = ['curly', 'short', 'curly', 'bald'][Math.floor(rnd(seed * 8.8) * 4)];
  }
  c.prop = 'none';
  c.build = 0.95 + rnd(seed * 1.9) * 0.35;
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
  const [fx, fy] = rot(th2, FORE);
  return [side * SHOULDER_X * build + ux + fx, SHOULDER_Y + uy + fy, th2];
};

// Extents of each held prop in the hand's frame (x across, y down from the hand).
const PROP_BOX = {
  scroll: [[-30, -70], [30, 80]],
  sceptre: [[-34, -350], [34, -350], [0, 60]],
  spear: [[-24, -470], [24, -470], [0, 170]],
  staff: [[-20, -260], [20, -260], [0, 250]],
  bag: [[-40, 10], [40, 10], [0, 100]],
  none: [],
};
const HEAD_TOP = {helmet: -690, diadem: -620, laurel: -610, band: -600, veil: -600};

/**
 * How far a character reaches from the point between its feet, in drawing units at scale 1 (hands, the held prop, the head and
 * its hat, the robe). The scene uses it to keep everything inside the safe area, whatever the pose.
 */
export const reach = (who, pose, noProp = false) => {
  const c = castOf(who);
  const b = c.build || 1;
  const P = POSES[pose] || POSES.stand;
  const pts = [[-120 * b, 0], [120 * b, 0], [-110 * b, -300], [110 * b, -300], [-90, HEAD_Y], [90, HEAD_Y], [0, HEAD_TOP[c.headwear] || -592]];
  if (c.cloak) pts.push([-130 * b, -40], [130 * b, -40]);
  const [lx, ly, lth] = handAt(-1, P.L[0], P.L[1], b);
  const [rx, ry] = handAt(1, P.R[0], P.R[1], b);
  pts.push([lx - 32, ly], [lx + 32, ly], [rx - 32, ry], [rx + 32, ry]);
  const tilt = (-lth * 0.22 * Math.PI) / 180;
  const place = (px, py) => [lx + px * Math.cos(tilt) - py * Math.sin(tilt), ly + 4 + px * Math.sin(tilt) + py * Math.cos(tilt)];
  if (!noProp) (PROP_BOX[c.prop] || []).forEach(([a, q]) => pts.push(place(a, q)));
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  return {left: -Math.min(...xs), right: Math.max(...xs), top: -Math.min(...ys)};
};

const ol = (w = LINE) => ({stroke: C.ink, strokeWidth: w, strokeLinejoin: 'round', strokeLinecap: 'round'});

// A mitten hand with a thumb; `finger` adds a pointing index finger.
const Hand = ({skin, finger = false, side}) => (
  <g transform={`translate(0 ${FORE + 4}) scale(${side} 1)`}>
    {finger && <rect x="-9" y="10" width="18" height="44" rx="9" fill={skin} {...ol(5)} />}
    <ellipse cx="0" cy="8" rx="22" ry="26" fill={skin} {...ol(6)} />
    <ellipse cx="17" cy="-2" rx="9" ry="14" fill={skin} {...ol(5)} transform="rotate(-28 17 -2)" />
    <path d="M -10 22 Q -4 30 6 26" fill="none" stroke={C.ink} strokeWidth="3" opacity="0.5" />
  </g>
);

const Arm = ({side, shoulder, elbow, skin, sleeve, build, finger, armour}) => {
  const th1 = side < 0 ? shoulder : -shoulder;
  const th2 = side < 0 ? elbow : -elbow;
  return (
    <g transform={`translate(${side * SHOULDER_X * build} ${SHOULDER_Y}) rotate(${th1})`}>
      <line x1="0" y1="0" x2="0" y2={UPPER} stroke={C.ink} strokeWidth={36 + LINE * 2} strokeLinecap="round" />
      <g transform={`translate(0 ${UPPER}) rotate(${th2})`}>
        <line x1="0" y1="0" x2="0" y2={FORE - 6} stroke={C.ink} strokeWidth={32 + LINE * 2} strokeLinecap="round" />
        <line x1="0" y1="0" x2="0" y2={FORE - 6} stroke={skin} strokeWidth={32} strokeLinecap="round" />
        {armour && <rect x="-20" y={FORE - 46} width="40" height="34" rx="8" fill="#8A5A3A" {...ol(5)} />}
        <Hand skin={skin} finger={finger} side={-side} />
      </g>
      <line x1="0" y1="0" x2="0" y2={UPPER} stroke={skin} strokeWidth={36} strokeLinecap="round" />
      {/* the short sleeve of the tunic over the shoulder */}
      <path d="M -30 -14 Q 0 -30 30 -14 L 26 46 Q 0 56 -26 46 Z" fill={sleeve} {...ol(6)} />
    </g>
  );
};

const Mouth = ({shape, rest = 'smile'}) => {
  const m = typeof shape === 'number' ? LEGACY_MOUTH[shape] || 'X' : shape || 'X';
  const ink = {fill: C.ink};
  const tongue = (cx, cy, rx, ry) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={C.terracotta} />;
  switch (m) {
    case 'A':
      return <path d="M -22 44 Q 0 40 22 44" fill="none" stroke={C.ink} strokeWidth="8" strokeLinecap="round" />;
    case 'B':
      return (
        <g>
          <rect x="-26" y="34" width="52" height="18" rx="8" fill={C.white} stroke={C.ink} strokeWidth="5" />
          <path d="M -26 43 L 26 43" stroke={C.ink} strokeWidth="3" />
        </g>
      );
    case 'C':
      return <g><ellipse cx="0" cy="45" rx="23" ry="16" {...ink} />{tongue(0, 54, 12, 5)}</g>;
    case 'D':
      return <g><ellipse cx="0" cy="48" rx="25" ry="31" {...ink} /><path d="M -18 26 Q 0 21 18 26 L 16 33 Q 0 30 -16 33 Z" fill={C.white} />{tongue(0, 66, 15, 9)}</g>;
    case 'E':
      return <ellipse cx="0" cy="46" rx="15" ry="20" {...ink} />;
    case 'F':
      return <g><ellipse cx="0" cy="46" rx="10" ry="11" {...ink} /><ellipse cx="0" cy="46" rx="17" ry="17" fill="none" stroke={C.ink} strokeWidth="5" opacity="0.55" /></g>;
    case 'G':
      return (
        <g>
          <path d="M -24 37 Q 0 33 24 37 L 22 47 Q 0 44 -22 47 Z" fill={C.white} stroke={C.ink} strokeWidth="4" strokeLinejoin="round" />
          <path d="M -23 50 Q 0 59 23 50" fill="none" stroke={C.ink} strokeWidth="6" strokeLinecap="round" />
        </g>
      );
    case 'H':
      return <g><ellipse cx="0" cy="45" rx="20" ry="14" {...ink} />{tongue(0, 39, 10, 5)}</g>;
    default:
      if (rest === 'big') return <path d="M -30 36 Q 0 66 30 36 Q 0 46 -30 36 Z" fill={C.white} stroke={C.ink} strokeWidth="5" strokeLinejoin="round" />;
      if (rest === 'laugh') return <g><path d="M -32 32 Q 0 84 32 32 Q 0 40 -32 32 Z" fill={C.ink} stroke={C.ink} strokeWidth="5" strokeLinejoin="round" />{tongue(0, 58, 14, 8)}<path d="M -26 34 Q 0 40 26 34 L 24 40 Q 0 45 -24 40 Z" fill={C.white} /></g>;
      if (rest === 'o') return <ellipse cx="0" cy="48" rx="12" ry="16" {...ink} />;
      if (rest === 'frown') return <path d="M -22 54 Q 0 38 22 54" fill="none" stroke={C.ink} strokeWidth="6" strokeLinecap="round" />;
      if (rest === 'flat') return <path d="M -20 46 L 20 46" fill="none" stroke={C.ink} strokeWidth="6" strokeLinecap="round" />;
      if (rest === 'side') return <path d="M -18 48 Q 4 46 22 40" fill="none" stroke={C.ink} strokeWidth="6" strokeLinecap="round" />;
      if (rest === 'smirk') return <path d="M -20 46 Q 6 50 26 34" fill="none" stroke={C.ink} strokeWidth="6" strokeLinecap="round" />;
      if (rest === 'grit') return <g><rect x="-26" y="38" width="52" height="16" rx="6" fill={C.white} stroke={C.ink} strokeWidth="5" /><path d="M -13 38 L -13 54 M 0 38 L 0 54 M 13 38 L 13 54" stroke={C.ink} strokeWidth="3" /></g>;
      if (rest === 'wobble') return <path d="M -22 48 Q -14 40 -6 48 Q 2 56 10 48 Q 18 40 24 48" fill="none" stroke={C.ink} strokeWidth="6" strokeLinecap="round" />;
      return <path d="M -24 40 Q 0 56 24 40" fill="none" stroke={C.ink} strokeWidth="6" strokeLinecap="round" />;
  }
};

const Eye = ({cx, look, e, blink, skin}) => {
  const ry = 15 * e.eyeH;
  const rx = 16;
  if (e.shut || blink) {   // closed: a happy arc when laughing, a line when blinking
    return e.shut
      ? <path d={`M ${cx - rx} ${-10} Q ${cx} ${-28} ${cx + rx} ${-10}`} fill="none" stroke={C.ink} strokeWidth="6" strokeLinecap="round" />
      : <path d={`M ${cx - rx} ${-12} Q ${cx} ${-6} ${cx + rx} ${-12}`} fill="none" stroke={C.ink} strokeWidth="6" strokeLinecap="round" />;
  }
  const cy = -14;
  const lidY = cy - ry + 2 * ry * e.lid;
  const [lx, ly] = look;
  const py = Math.max(cy + ly + (e.up ? -5 : 0), lidY + e.pupil * 0.6);
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={C.white} {...ol(5)} />
      <circle cx={cx + lx * 0.8} cy={py} r={e.pupil} fill={C.ink} />
      {e.lid > 0.02 && (
        <g>
          <path d={`M ${cx - rx - 3} ${cy - ry - 6} L ${cx + rx + 3} ${cy - ry - 6} L ${cx + rx + 3} ${lidY} Q ${cx} ${lidY + 3} ${cx - rx - 3} ${lidY} Z`} fill={skin} />
          <path d={`M ${cx - rx + 1} ${lidY + 1} Q ${cx} ${lidY + 4} ${cx + rx - 1} ${lidY + 1}`} fill="none" stroke={C.ink} strokeWidth="5" strokeLinecap="round" />
        </g>
      )}
    </g>
  );
};

// Curly hair as outlined clumps along an arc: the reference's look.
const Curls = ({n, rx, ry, cy, r, from, to, color, w = 5}) => (
  <g>
    {Array.from({length: n}).map((_, i) => {
      const a = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180;
      return <circle key={i} cx={rx * Math.cos(a)} cy={cy + ry * Math.sin(a)} r={r} fill={color} {...ol(w)} />;
    })}
  </g>
);

const HairBack = ({c}) => {
  const h = c.hair;
  if (c.hairStyle === 'curly') return <g><path d="M -74 10 Q -84 -96 0 -104 Q 84 -96 74 10 Z" fill={h} {...ol()} /><Curls n={11} rx={76} ry={92} cy={-10} r={26} from={170} to={370} color={h} /></g>;
  if (c.hairStyle === 'bun') return <g><circle cx="0" cy="-104" r="40" fill={h} {...ol()} /><path d="M -74 30 Q -86 -98 0 -100 Q 86 -98 74 30 Q 60 60 52 20 L -52 20 Q -60 60 -74 30 Z" fill={h} {...ol()} /></g>;
  if (c.hairStyle === 'fringe') return <g><Curls n={4} rx={72} ry={40} cy={-6} r={22} from={150} to={210} color={h} /><Curls n={4} rx={72} ry={40} cy={-6} r={22} from={-30} to={30} color={h} /></g>;
  if (c.hairStyle === 'short') return <path d="M -70 0 Q -76 -94 0 -98 Q 76 -94 70 0 Q 60 -50 0 -54 Q -60 -50 -70 0 Z" fill={h} {...ol()} />;
  return null;
};

const HairFront = ({c}) => {
  const h = c.hair;
  if (c.hairStyle === 'curly') return <Curls n={6} rx={52} ry={18} cy={-76} r={17} from={190} to={350} color={h} />;
  if (c.hairStyle === 'bun') return <path d="M -66 -40 Q -40 -92 0 -90 Q 40 -92 66 -40 Q 30 -70 0 -66 Q -30 -70 -66 -40 Z" fill={h} {...ol(6)} />;
  if (c.hairStyle === 'short') return <path d="M -64 -50 Q -30 -96 0 -94 Q 30 -96 64 -50 Q 30 -72 0 -70 Q -30 -72 -64 -50 Z" fill={h} {...ol(6)} />;
  return null;
};

const Beard = ({c}) => {
  const b = c.beardColor || c.hair;
  if (c.beard === 'none' || !c.beard) return null;
  if (c.beard === 'stubble') return <path d="M -60 22 Q -50 86 0 96 Q 50 86 60 22 Q 40 66 0 70 Q -40 66 -60 22 Z" fill={b} opacity="0.32" />;
  const hole = 'M -26 50 A 26 18 0 1 0 26 50 A 26 18 0 1 0 -26 50 Z';
  if (c.beard === 'short') {
    return <path d={`M -64 0 Q -66 84 0 108 Q 66 84 64 0 Q 50 40 30 34 Q 0 30 -30 34 Q -50 40 -64 0 Z ${hole}`} fill={b} fillRule="evenodd" {...ol(6)} />;
  }
  if (c.beard === 'long') {
    return (
      <g>
        <path d={`M -66 -4 Q -78 110 -40 190 Q -20 230 0 250 Q 20 230 40 190 Q 78 110 66 -4 Q 50 36 30 32 Q 0 28 -30 32 Q -50 36 -66 -4 Z ${hole}`} fill={b} fillRule="evenodd" {...ol(6)} />
        <path d="M -30 120 Q -20 170 -10 210 M 10 130 Q 18 180 26 196 M -2 100 Q 0 150 2 230" fill="none" stroke={C.ink} strokeWidth="3" opacity="0.35" />
      </g>
    );
  }
  return (   // full and curly
    <g>
      <path d={`M -68 -6 Q -76 96 -30 132 Q 0 146 30 132 Q 76 96 68 -6 Q 52 36 30 32 Q 0 28 -30 32 Q -52 36 -68 -6 Z ${hole}`} fill={b} fillRule="evenodd" {...ol(6)} />
      <Curls n={7} rx={60} ry={62} cy={62} r={16} from={20} to={160} color={b} w={4} />
    </g>
  );
};

const Moustache = ({c}) => {
  if (!c.beard || c.beard === 'none' || c.beard === 'stubble') return null;
  return <path d="M 0 33 Q -24 26 -42 44 Q -20 42 0 38 Q 20 42 42 44 Q 24 26 0 33 Z" fill={c.beardColor || c.hair} {...ol(5)} />;
};

const Headwear = ({c}) => {
  if (c.headwear === 'diadem') {
    return (
      <g>
        <path d="M -70 -62 Q 0 -86 70 -62 L 66 -46 Q 0 -70 -66 -46 Z" fill={C.gold} {...ol(6)} />
        {[-44, -22, 0, 22, 44].map((x, i) => <path key={i} d={`M ${x - 10} ${-72 - (x === 0 ? 4 : 0) + Math.abs(x) * 0.2} L ${x} ${-104 - (x === 0 ? 14 : 0) + Math.abs(x) * 0.3} L ${x + 10} ${-72 + Math.abs(x) * 0.2} Z`} fill={C.gold} {...ol(5)} />)}
        <circle cx="0" cy="-68" r="8" fill={C.terracotta} {...ol(4)} />
      </g>
    );
  }
  if (c.headwear === 'laurel') {
    return <g>{Array.from({length: 9}).map((_, i) => <ellipse key={i} cx={-64 + i * 16} cy={-64 - Math.sin((i / 8) * Math.PI) * 18} rx="9" ry="16" fill="#6F8A3A" {...ol(4)} transform={`rotate(${-50 + i * 12} ${-64 + i * 16} ${-64 - Math.sin((i / 8) * Math.PI) * 18})`} />)}</g>;
  }
  if (c.headwear === 'band') return <path d="M -70 -50 Q 0 -74 70 -50 L 68 -36 Q 0 -60 -68 -36 Z" fill={C.terracotta} {...ol(5)} />;
  if (c.headwear === 'helmet') {
    return (
      <g>
        <path d="M -14 -120 Q 0 -230 110 -150 Q 60 -170 30 -120 Z" fill={C.terracotta} {...ol(6)} />
        <path d="M 2 -118 Q 20 -190 92 -152" fill="none" stroke={C.ink} strokeWidth="3" opacity="0.4" />
        <path d="M -78 -10 Q -86 -116 0 -120 Q 86 -116 78 -10 L 60 -14 L 58 -48 Q 0 -66 -58 -48 L -60 -14 Z" fill="#C9963E" {...ol()} />
        <path d="M -70 -50 Q 0 -72 70 -50" fill="none" stroke={C.ink} strokeWidth="5" />
        <rect x="-8" y="-118" width="16" height="22" rx="4" fill="#8A6A2A" {...ol(4)} />
      </g>
    );
  }
  return null;
};

const Nose = ({skin}) => (
  <g>
    <path d="M -6 -16 Q -12 12 -22 22 Q -24 40 -2 40 Q 20 42 22 24 Q 12 12 8 -14" fill={skin} {...ol(5)} />
    <path d="M -10 32 Q -6 36 -2 32" fill="none" stroke={C.ink} strokeWidth="3" opacity="0.6" />
  </g>
);

const Face = ({c, mouth, blink, brow = 0, expression = 'neutral', look = [0, 0]}) => {
  const e = EXPR[expression] || EXPR.neutral;
  const by = -42 - brow - e.lift;
  const t = e.tilt;
  const browColor = c.brows || C.ink;
  const bw = c.brows === HAIR.white || c.brows === HAIR.grey ? 12 : 9;
  return (
    <g>
      <ellipse cx="-66" cy="4" rx="13" ry="19" fill={c.skin} {...ol(6)} />
      <ellipse cx="66" cy="4" rx="13" ry="19" fill={c.skin} {...ol(6)} />
      {c.earrings && <g><circle cx="-68" cy="30" r="7" fill={C.gold} {...ol(3)} /><circle cx="68" cy="30" r="7" fill={C.gold} {...ol(3)} /></g>}
      <path d="M -64 -20 Q -66 -88 0 -90 Q 66 -88 64 -20 Q 66 52 40 80 Q 0 100 -40 80 Q -66 52 -64 -20 Z" fill={c.skin} {...ol()} />
      <circle cx="-44" cy="28" r="14" fill={C.terracotta} opacity={e.cheek} />
      <circle cx="44" cy="28" r="14" fill={C.terracotta} opacity={e.cheek} />
      {c.wrinkles && <path d="M -30 -66 Q 0 -72 30 -66 M -24 -56 Q 0 -61 24 -56" fill="none" stroke={C.ink} strokeWidth="3" opacity="0.4" />}
      <Eye cx={-26} look={look} e={e} blink={blink} skin={c.skin} />
      <Eye cx={26} look={look} e={e} blink={blink} skin={c.skin} />
      {c.lashes && !blink && !e.shut && <path d="M -44 -26 L -50 -32 M 44 -26 L 50 -32" stroke={C.ink} strokeWidth="4" strokeLinecap="round" />}
      <path d={`M -46 ${by + t * 0.5 - e.asym} Q -28 ${by - 9 - e.asym} -10 ${by - t * 0.5 - e.asym}`} fill="none" stroke={browColor === HAIR.white ? '#D8D2C6' : browColor} strokeWidth={bw + 4} strokeLinecap="round" />
      <path d={`M -46 ${by + t * 0.5 - e.asym} Q -28 ${by - 9 - e.asym} -10 ${by - t * 0.5 - e.asym}`} fill="none" stroke={browColor} strokeWidth={bw} strokeLinecap="round" />
      <path d={`M 10 ${by - t * 0.5} Q 28 ${by - 9} 46 ${by + t * 0.5}`} fill="none" stroke={browColor === HAIR.white ? '#D8D2C6' : browColor} strokeWidth={bw + 4} strokeLinecap="round" />
      <path d={`M 10 ${by - t * 0.5} Q 28 ${by - 9} 46 ${by + t * 0.5}`} fill="none" stroke={browColor} strokeWidth={bw} strokeLinecap="round" />
      <Beard c={c} />
      <g transform="translate(0 12)"><Mouth shape={mouth} rest={e.rest} /></g>
      <Moustache c={c} />
      <Nose skin={c.skin} />
      {e.sweat && <path d="M 58 -60 Q 52 -46 58 -40 Q 64 -46 58 -60 Z" fill="#9ACFD6" {...ol(3)} />}
    </g>
  );
};

/** The head alone (hair, face with mouth and expression, beard, hat): used by the reference sheets and close-ups. */
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

const Leg = ({x, swing, lift, skin, sandal = '#6B4226'}) => (
  <g transform={`translate(${x} ${HIP_Y}) rotate(${swing})`}>
    <line x1="0" y1="0" x2="0" y2={-HIP_Y - 18 - lift} stroke={C.ink} strokeWidth={30 + LINE * 2} strokeLinecap="round" />
    <line x1="0" y1="0" x2="0" y2={-HIP_Y - 18 - lift} stroke={skin} strokeWidth={30} strokeLinecap="round" />
    <g transform={`translate(0 ${-HIP_Y - 10 - lift})`}>
      <path d="M -18 -14 Q -22 4 -14 8 L 34 8 Q 42 0 30 -10 Q 10 -16 -18 -14 Z" fill={skin} {...ol(5)} />
      <path d="M -20 6 L 40 6 L 40 14 L -20 14 Z" fill={sandal} {...ol(4)} />
      <path d="M -10 -12 L 18 4 M 4 -14 L 30 2" stroke={sandal} strokeWidth="5" strokeLinecap="round" />
    </g>
  </g>
);

const Body = ({c, step = null}) => {
  const b = c.build || 1;
  const sw = 78 * b;
  const hemY = c.long ? -24 : -128;
  const hemW = (c.long ? 100 : 92) * b;
  const belly = b > 1.2 ? 26 * (b - 1) * 4 : 0;
  const swing = step === null ? 0 : Math.sin(step) * 22;
  const lift = (v) => (step === null ? 0 : Math.max(0, v) * 18);
  return (
    <g>
      {c.cloak && <path d={`M ${-sw} -350 Q ${-sw - 60} -150 ${-sw - 50} -30 L ${sw + 50} -30 Q ${sw + 60} -150 ${sw} -350 Z`} fill={c.cloak} {...ol()} />}
      <Leg x={-30 * b} swing={swing} lift={lift(Math.sin(step ?? 0))} skin={c.skin} />
      <Leg x={30 * b} swing={-swing} lift={lift(-Math.sin(step ?? 0))} skin={c.skin} />
      {/* the tunic: an A-line from the shoulders, a plump belly bulges */}
      <path d={`M ${-sw} -350 Q 0 -372 ${sw} -350 Q ${sw + belly} -240 ${hemW} ${hemY} Q 0 ${hemY + 14} ${-hemW} ${hemY} Q ${-sw - belly} -240 ${-sw} -350 Z`} fill={c.tunic} {...ol()} />
      {c.armour && (
        <g>
          <path d={`M ${-sw + 6} -344 Q 0 -360 ${sw - 6} -344 L ${sw - 4} -200 Q 0 -186 ${-sw + 4} -200 Z`} fill="#C9963E" {...ol(6)} />
          <path d="M -30 -300 Q 0 -280 30 -300 M -36 -250 Q 0 -232 36 -250" fill="none" stroke={C.ink} strokeWidth="4" opacity="0.5" />
          {[-60, -30, 0, 30, 60].map((x) => <rect key={x} x={x * b - 13} y="-198" width="26" height="62" rx="5" fill="#8A6A2A" {...ol(4)} />)}
        </g>
      )}
      {!c.armour && <path d={`M ${-sw + 10} -206 Q 0 ${-194 + belly * 0.4} ${sw - 10} -206`} fill="none" stroke={C.ink} strokeWidth="7" />}
      {!c.armour && <path d={`M -30 ${hemY - 8} L -24 -200 M 30 ${hemY - 8} L 24 -200 M 0 ${hemY - 2} L 0 -200`} fill="none" stroke={C.ink} strokeWidth="3" opacity="0.25" />}
      {c.drape && (   // the himation: over the left shoulder, across the body to the right hip, its end hanging down the left side
        <g>
          <path d={`M ${-sw - 6} -356 L ${-sw + 38} -372 Q ${sw * 0.4} -260 ${sw + 14} -150 L ${sw + 4} -90 Q ${sw * 0.1} -150 ${-sw + 6} -250 L ${-sw - 14} -60 L ${-sw - 40} -70 Q ${-sw - 30} -220 ${-sw - 6} -356 Z`} fill={c.drape} {...ol()} />
          <path d={`M ${-sw + 20} -330 Q ${sw * 0.2} -240 ${sw - 2} -136 M ${-sw - 20} -300 L ${-sw - 30} -90`} fill="none" stroke={C.ink} strokeWidth="4" opacity="0.35" />
          {c.trim && <path d={`M ${-sw + 38} -372 Q ${sw * 0.4} -260 ${sw + 14} -150`} fill="none" stroke={c.trim} strokeWidth="8" />}
        </g>
      )}
      <path d="M -28 -366 Q 0 -350 28 -366 L 24 -384 Q 0 -374 -24 -384 Z" fill={c.skin} {...ol(6)} />
    </g>
  );
};

const HeldProp = ({c, x, y, tilt}) => {
  const p = c.prop;
  const at = `translate(${x} ${y}) rotate(${tilt})`;
  if (p === 'scroll') {
    return (
      <g transform={at}>
        <rect x="-30" y="-70" width="60" height="150" rx="12" fill={C.parchment} {...ol(7)} />
        <ellipse cx="0" cy="-70" rx="30" ry="11" fill="#E3CC98" {...ol(5)} />
        <ellipse cx="0" cy="80" rx="30" ry="11" fill="#E3CC98" {...ol(5)} />
        <path d="M -14 -30 L 14 -30 M -14 -6 L 14 -6 M -14 18 L 8 18" stroke={C.ink} strokeWidth="4" strokeLinecap="round" />
      </g>
    );
  }
  if (p === 'sceptre') {
    return (
      <g transform={at}>
        <line x1="0" y1="60" x2="0" y2="-300" stroke={C.ink} strokeWidth="22" strokeLinecap="round" />
        <line x1="0" y1="60" x2="0" y2="-300" stroke={C.gold} strokeWidth="10" strokeLinecap="round" />
        <circle cx="0" cy="-320" r="30" fill="#6E2A4F" {...ol()} />
        <circle cx="0" cy="-320" r="10" fill={C.gold} {...ol(4)} />
      </g>
    );
  }
  if (p === 'spear') {
    return (
      <g transform={at}>
        <line x1="0" y1="170" x2="0" y2="-420" stroke={C.ink} strokeWidth="20" strokeLinecap="round" />
        <line x1="0" y1="170" x2="0" y2="-420" stroke="#8A5A3A" strokeWidth="9" strokeLinecap="round" />
        <path d="M 0 -470 Q 24 -430 14 -404 L -14 -404 Q -24 -430 0 -470 Z" fill="#C9C2B4" {...ol(6)} />
      </g>
    );
  }
  if (p === 'staff') {
    return (
      <g transform={at}>
        <path d="M 0 250 L 0 -220 Q 0 -262 30 -256" fill="none" stroke={C.ink} strokeWidth="22" strokeLinecap="round" />
        <path d="M 0 250 L 0 -220 Q 0 -262 30 -256" fill="none" stroke="#8A5A3A" strokeWidth="10" strokeLinecap="round" />
      </g>
    );
  }
  if (p === 'bag') {
    return (
      <g transform={at}>
        <path d="M -10 10 Q -44 60 -30 96 Q 0 110 30 96 Q 44 60 10 10 Z" fill="#8C5A3C" {...ol(6)} />
        <path d="M -14 14 L 14 14" stroke={C.gold} strokeWidth="7" strokeLinecap="round" />
        <circle cx="0" cy="66" r="10" fill={C.gold} {...ol(3)} />
      </g>
    );
  }
  return null;
};

/**
 * who, pose (blends into poseTo by `blend`), mouth (Rhubarb letter, or the old 0|1|2), x and y (where the feet are), scale,
 * frame (frames since the scene began), enterAt (frames before popping in), seed (desynchronises idle motion), expression,
 * look [x, y] (eyes), walking, noProp, look_ (a crowd person's own look instead of a cast member), facing (-1 = mirrored)
 */
export const Character = ({who = 'scholar', pose = 'stand', poseTo = null, blend = 0, mouth = 0, x = 540, y = 1180, scale = 1.3, frame,
  enterAt = 0, seed = 0, expression = 'neutral', look = [0, 0], walking = false, noProp = false, look_ = null, facing = 1, hop = 0}) => {
  const {fps} = useVideoConfig();
  const c = look_ || castOf(who);
  const A = POSES[pose] || POSES.stand;
  const B = POSES[poseTo] || A;
  const mix = (u, v) => u + (v - u) * Math.max(0, Math.min(1, blend));
  const P = {L: [mix(A.L[0], B.L[0]), mix(A.L[1], B.L[1])], R: [mix(A.R[0], B.R[0]), mix(A.R[1], B.R[1])], head: mix(A.head, B.head)};
  const enter = spring({frame: frame - enterAt, fps, config: {damping: 11, stiffness: 120, mass: 0.7}});
  const t = frame + seed * 17;
  const stride = walking ? frame / 3.2 : null;   // one full step cycle about every 20 frames
  const talking = typeof mouth === 'string' ? !(mouth === 'X' || mouth === 'A') : mouth > 0;
  const breathe = Math.sin(t / 9) * 0.012;
  const sway = walking ? Math.sin(stride) * 3 : Math.sin(t / 21) * 2.2;
  const bob = (walking ? -Math.abs(Math.sin(stride)) * 18 : 0) - Math.abs(Math.sin(t / 5)) * hop;
  const nod = talking ? Math.sin(t / 3.1) * 3.5 : 0;   // a speaker's head moves with the words
  const blinkNow = frame > 20 && (t + seed * 29) % 104 < 4;
  const gestureArm = talking ? Math.sin(t / 7) * 6 : 0;
  const swayArm = walking ? Math.sin(stride) * 12 : pose === 'wave' && !poseTo ? Math.sin(t / 3) * 16 : Math.sin(t / 13) * 3;
  const laughShake = expression === 'laughing' ? Math.sin(t * 1.3) * 3 : 0;
  const [lsh, lel] = P.L;
  const [rsh, rel] = P.R;
  const b = c.build || 1;
  const [hx, hy, hth] = handAt(-1, lsh + swayArm, lel, b);
  const eff = Math.max(0, enter);
  const k = scale * (0.82 + 0.18 * eff);
  const pointing = (pose === 'point' && (!poseTo || blend < 0.5)) || (poseTo === 'point' && blend >= 0.5);
  return (
    <g transform={`translate(${x} ${y + bob + (1 - eff) * 160}) scale(${k * facing} ${k * (1 + breathe)}) rotate(${sway * 0.4 + laughShake * 0.3})`} opacity={Math.min(1, eff * 2)}>
      <ellipse cx="0" cy="14" rx={130 * b} ry="20" fill={C.ink} opacity="0.18" />
      <Body c={c} step={stride} />
      <Arm side={1} shoulder={rsh + (walking ? -swayArm : swayArm) + gestureArm} elbow={rel} skin={c.skin} sleeve={c.tunic} build={b} finger={pointing} armour={c.armour} />
      <Arm side={-1} shoulder={lsh + swayArm} elbow={lel} skin={c.skin} sleeve={c.tunic} build={b} armour={c.armour} />
      {!noProp && <HeldProp c={c} x={hx} y={hy + 4} tilt={-hth * 0.22} />}
      <g transform={`translate(0 ${HEAD_Y}) rotate(${P.head + sway + nod + laughShake})`}>
        <HairBack c={c} />
        <Face c={c} mouth={mouth} blink={blinkNow} brow={pose === 'amazed' ? 12 : talking ? Math.max(0, Math.sin(t / 11)) * 6 : 0}
          expression={pose === 'amazed' && expression === 'neutral' ? 'surprised' : expression} look={look} />
        <HairFront c={c} />
        <Headwear c={c} />
      </g>
    </g>
  );
};

// Crowd reactions: pose, expression, hop height, whether mouths move.
const REACT = {
  idle: ['stand', 'neutral', 0, false],
  cheer: ['cheer', 'happy', 14, true],
  gasp: ['amazed', 'surprised', 0, false],
  laugh: ['stand', 'laughing', 4, true],
  murmur: ['stand', 'thinking', 0, true],
  angry: ['point', 'angry', 6, true],
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
