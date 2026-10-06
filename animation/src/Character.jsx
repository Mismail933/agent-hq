import React from 'react';
import {spring, useVideoConfig} from 'remotion';
import {C, SKIN, LINE, HEAD} from './theme';

/*
 * The cast, drawn in parts (head, face, torso, two arms, held prop) so poses and mouths are just numbers.
 * Local coordinates: origin at the bottom centre of the robe, y grows downward, the figure is ~560 tall.
 * Poses: stand | point | explain | amazed.   Mouth shapes: 0 closed, 1 mid, 2 open.
 */
export const POSES = {
  // [shoulder, elbow] in degrees, "outward and up" is positive. L is the arm that holds the prop.
  stand: {L: [34, 34], R: [12, 14], head: 0},
  point: {L: [34, 34], R: [90, 4], head: -4},
  explain: {L: [34, 34], R: [50, 78], head: 3},
  amazed: {L: [118, 40], R: [150, 16], head: -7},
  wave: {L: [34, 34], R: [152, 24], head: 3},
  think: {L: [34, 34], R: [58, 128], head: 5},
  present: {L: [34, 34], R: [58, 70], head: -2},
};
// The nine mouth shapes of Rhubarb Lip Sync (MIT licence): A closed (P B M), B teeth together (K S T), C open (EH), D wide
// (AA), E rounded (AO), F pucker (OO W), G teeth on lip (F V), H tongue up (L), X rest. Old scene files use 0/1/2.
export const MOUTHS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'X'];
export const EXPRESSIONS = ['neutral', 'happy', 'surprised', 'worried', 'determined', 'thinking'];
const LEGACY_MOUTH = {0: 'X', 1: 'C', 2: 'D'};

// brow: lift (px up), tilt (inner end higher = worried, lower = determined), asym (left brow extra lift); eye: height scale,
// width scale; rest: how the mouth looks when nobody is talking; cheek: blush strength
const EXPR = {
  neutral: {lift: 0, tilt: 0, asym: 0, eyeH: 1, eyeW: 1, rest: 'smile', cheek: 0.3},
  happy: {lift: 6, tilt: 0, asym: 0, eyeH: 0.78, eyeW: 1.05, rest: 'big', cheek: 0.55},
  surprised: {lift: 20, tilt: 0, asym: 0, eyeH: 1.3, eyeW: 1.15, rest: 'o', cheek: 0.2},
  worried: {lift: 8, tilt: 16, asym: 0, eyeH: 1.05, eyeW: 1, rest: 'frown', cheek: 0.15},
  determined: {lift: -2, tilt: -14, asym: 0, eyeH: 0.82, eyeW: 1, rest: 'flat', cheek: 0.25},
  thinking: {lift: 4, tilt: 4, asym: 14, eyeH: 0.95, eyeW: 1, rest: 'flat', cheek: 0.25},
};

const UPPER = 120;
const FORE = 112;
const SHOULDER_Y = -318;
const SHOULDER_X = 80;

const CAST = {
  narrator: {name: 'The Traveller', skin: SKIN.mid, robe: C.teal, trim: C.gold},
  scholar: {name: 'The Scholar', skin: SKIN.light, robe: C.parchment, trim: C.terracotta},
  ruler: {name: 'The Ruler', skin: SKIN.dark, robe: C.terracotta, trim: C.gold},
};
export const CAST_IDS = Object.keys(CAST);
export const CAST_INFO = {
  narrator: {name: 'The Traveller', role: 'Time-traveller narrator, speaks to the viewer. Brass goggles, teal coat, parchment scarf.', prop: 'the POV sign'},
  scholar: {name: 'The Scholar', role: 'Bald, white beard and brows, cream robe with a terracotta sash.', prop: 'a scroll'},
  ruler: {name: 'The Ruler', role: 'Gold crown, short dark beard, terracotta robe with a gold collar.', prop: 'a sceptre'},
};

const rot = (deg, len) => {
  const a = (deg * Math.PI) / 180;
  return [-len * Math.sin(a), len * Math.cos(a)];
};

// Where the hand ends up, for attaching the held prop. side = -1 (left on screen) or 1.
const handAt = (side, shoulder, elbow) => {
  const th1 = side < 0 ? shoulder : -shoulder;
  const th2 = side < 0 ? shoulder + elbow : -(shoulder + elbow);
  const [ux, uy] = rot(th1, UPPER);
  const [fx, fy] = rot(th2, FORE);
  return [side * SHOULDER_X + ux + fx, SHOULDER_Y + uy + fy, th2];
};

/**
 * How far a character reaches from the point between its feet, in drawing units at scale 1 (hands, the held sign, the
 * head, the robe). The scene uses it to keep everything inside the safe area, whatever the pose.
 */
export const reach = (who, pose, noProp = false) => {
  const P = POSES[pose] || POSES.stand;
  const pts = [[-150, 0], [150, 0], [-112, -300], [112, -300], [0, -580]];
  const [lx, ly, lth] = handAt(-1, P.L[0], P.L[1]);
  const [rx, ry] = handAt(1, P.R[0], P.R[1]);
  pts.push([lx - 32, ly], [lx + 32, ly], [rx - 32, ry], [rx + 32, ry]);
  const tilt = (-lth * 0.22 * Math.PI) / 180;
  const place = (px, py) => [lx + px * Math.cos(tilt) - py * Math.sin(tilt), ly + 4 + px * Math.sin(tilt) + py * Math.cos(tilt)];
  const held = who === 'narrator' ? [[-135, -440], [135, -440], [-135, -300], [135, -300], [0, 40]]
    : who === 'scholar' ? [[-32, -70], [32, 80]] : [[-34, -360], [34, -360], [0, 60]];
  if (!noProp) held.forEach(([a, b]) => pts.push(place(a, b)));
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  return {left: -Math.min(...xs), right: Math.max(...xs), top: -Math.min(...ys)};
};

const Arm = ({side, shoulder, elbow, sleeve, skin}) => {
  const th1 = side < 0 ? shoulder : -shoulder;
  const th2 = side < 0 ? elbow : -elbow;
  return (
    <g transform={`translate(${side * SHOULDER_X} ${SHOULDER_Y}) rotate(${th1})`}>
      <line x1="0" y1="0" x2="0" y2={UPPER} stroke={C.ink} strokeWidth={42 + LINE * 2} strokeLinecap="round" />
      <g transform={`translate(0 ${UPPER}) rotate(${th2})`}>
        <line x1="0" y1="0" x2="0" y2={FORE} stroke={C.ink} strokeWidth={38 + LINE * 2} strokeLinecap="round" />
        <line x1="0" y1="0" x2="0" y2={FORE} stroke={sleeve} strokeWidth={38} strokeLinecap="round" />
        <circle cx="0" cy={FORE + 6} r={27} fill={skin} stroke={C.ink} strokeWidth={LINE} />
      </g>
      <line x1="0" y1="0" x2="0" y2={UPPER} stroke={sleeve} strokeWidth={42} strokeLinecap="round" />
    </g>
  );
};

const Mouth = ({shape, rest = 'smile'}) => {
  const m = typeof shape === 'number' ? LEGACY_MOUTH[shape] || 'X' : shape || 'X';
  const ink = {fill: C.ink};
  const tongue = (cx, cy, rx, ry) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={C.terracotta} />;
  switch (m) {
    case 'A': // lips pressed together
      return <path d="M -20 44 Q 0 41 20 44" fill="none" stroke={C.ink} strokeWidth="8" strokeLinecap="round" />;
    case 'B': // teeth together, lips apart
      return (
        <g>
          <rect x="-25" y="35" width="50" height="17" rx="8" fill={C.white} stroke={C.ink} strokeWidth="5" />
          <path d="M -25 43.5 L 25 43.5" stroke={C.ink} strokeWidth="3" />
        </g>
      );
    case 'C': // open, relaxed (eh)
      return <ellipse cx="0" cy="45" rx="21" ry="15" {...ink} />;
    case 'D': // wide open (aa)
      return <g><ellipse cx="0" cy="47" rx="23" ry="29" {...ink} />{tongue(0, 62, 14, 9)}</g>;
    case 'E': // rounded, slightly open (ao)
      return <ellipse cx="0" cy="46" rx="14" ry="18" {...ink} />;
    case 'F': // puckered (oo, w)
      return <g><ellipse cx="0" cy="46" rx="10" ry="11" {...ink} /><ellipse cx="0" cy="46" rx="16" ry="16" fill="none" stroke={C.ink} strokeWidth="4" opacity="0.5" /></g>;
    case 'G': // upper teeth on the lower lip (f, v)
      return (
        <g>
          <path d="M -23 38 Q 0 34 23 38 L 21 47 Q 0 44 -21 47 Z" fill={C.white} stroke={C.ink} strokeWidth="4" strokeLinejoin="round" />
          <path d="M -22 50 Q 0 58 22 50" fill="none" stroke={C.ink} strokeWidth="6" strokeLinecap="round" />
        </g>
      );
    case 'H': // tongue up (l)
      return <g><ellipse cx="0" cy="45" rx="19" ry="13" {...ink} />{tongue(0, 40, 10, 5)}</g>;
    default: // X: nobody is talking, so the face shows its expression
      if (rest === 'big') return <path d="M -26 38 Q 0 62 26 38 Q 0 46 -26 38 Z" fill={C.white} stroke={C.ink} strokeWidth="5" strokeLinejoin="round" />;
      if (rest === 'o') return <ellipse cx="0" cy="48" rx="11" ry="14" {...ink} />;
      if (rest === 'frown') return <path d="M -20 52 Q 0 38 20 52" fill="none" stroke={C.ink} strokeWidth="6" strokeLinecap="round" />;
      if (rest === 'flat') return <path d="M -18 46 L 18 46" fill="none" stroke={C.ink} strokeWidth="6" strokeLinecap="round" />;
      return <path d="M -22 40 Q 0 54 22 40" fill="none" stroke={C.ink} strokeWidth="6" strokeLinecap="round" />;
  }
};

const Face = ({skin, mouth, blink, brow = 0, expression = 'neutral', look = [0, 0]}) => {
  const e = EXPR[expression] || EXPR.neutral;
  const by = -30 - brow - e.lift; // brow baseline
  const t = e.tilt;
  const ry = (blink ? 2 : 14 * e.eyeH);
  const [lx, ly] = look;
  return (
    <g>
      <circle cx="0" cy="0" r="88" fill={skin} stroke={C.ink} strokeWidth={LINE} />
      <circle cx="-88" cy="6" r="15" fill={skin} stroke={C.ink} strokeWidth={LINE} />
      <circle cx="88" cy="6" r="15" fill={skin} stroke={C.ink} strokeWidth={LINE} />
      <circle cx="-52" cy="30" r="15" fill={C.terracotta} opacity={e.cheek} />
      <circle cx="52" cy="30" r="15" fill={C.terracotta} opacity={e.cheek} />
      <ellipse cx={-32 + lx} cy={-6 + ly} rx={10 * e.eyeW} ry={ry} fill={C.ink} />
      <ellipse cx={32 + lx} cy={-6 + ly} rx={10 * e.eyeW} ry={ry} fill={C.ink} />
      {!blink && <circle cx={-29 + lx} cy={-11 + ly} r="3.2" fill={C.white} />}
      {!blink && <circle cx={35 + lx} cy={-11 + ly} r="3.2" fill={C.white} />}
      <path d={`M -50 ${by + t * 0.5 - e.asym} Q -32 ${by - 10 - e.asym} -15 ${by - t * 0.5 - e.asym}`} fill="none" stroke={C.ink} strokeWidth="7" strokeLinecap="round" />
      <path d={`M 15 ${by - t * 0.5} Q 32 ${by - 10} 50 ${by + t * 0.5}`} fill="none" stroke={C.ink} strokeWidth="7" strokeLinecap="round" />
      <path d="M -6 12 Q 0 24 8 20" fill="none" stroke={C.ink} strokeWidth="5" strokeLinecap="round" />
      <Mouth shape={mouth} rest={e.rest} />
    </g>
  );
};

// Hair, hats and eyebrows, per character (drawn over the face).
const HeadFront = ({who}) => {
  if (who === 'narrator') {
    return (
      <g>
        <path d="M -90 -18 Q -86 -92 0 -96 Q 86 -92 90 -18 Q 70 -58 20 -62 Q -40 -62 -90 -18 Z" fill="#5A3522" stroke={C.ink} strokeWidth={LINE} strokeLinejoin="round" />
        <path d="M -10 -92 Q 6 -128 30 -112 Q 14 -104 12 -88 Z" fill="#5A3522" stroke={C.ink} strokeWidth={LINE - 2} strokeLinejoin="round" />
        <path d="M -90 -52 Q 0 -80 90 -52" fill="none" stroke={C.ink} strokeWidth="14" strokeLinecap="round" />
        <circle cx="-34" cy="-66" r="25" fill={C.gold} stroke={C.ink} strokeWidth={LINE - 1} />
        <circle cx="34" cy="-66" r="25" fill={C.gold} stroke={C.ink} strokeWidth={LINE - 1} />
        <circle cx="-34" cy="-66" r="13" fill={C.sky} stroke={C.ink} strokeWidth="4" />
        <circle cx="34" cy="-66" r="13" fill={C.sky} stroke={C.ink} strokeWidth="4" />
      </g>
    );
  }
  if (who === 'scholar') {
    return (
      <g>
        <path d="M -86 -8 Q -112 -60 -70 -70 Q -80 -40 -78 -10 Z" fill={C.parchment} stroke={C.ink} strokeWidth={LINE - 3} strokeLinejoin="round" />
        <path d="M 86 -8 Q 112 -60 70 -70 Q 80 -40 78 -10 Z" fill={C.parchment} stroke={C.ink} strokeWidth={LINE - 3} strokeLinejoin="round" />
        <path d="M -54 -36 Q -32 -52 -12 -34" fill="none" stroke="#fff" strokeWidth="13" strokeLinecap="round" />
        <path d="M 12 -34 Q 32 -52 54 -36" fill="none" stroke="#fff" strokeWidth="13" strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g>
      <path d="M -86 -10 Q -88 -66 0 -72 Q 88 -66 86 -10 Q 60 -46 0 -48 Q -60 -46 -86 -10 Z" fill="#2A1B14" />
      <path d="M -66 -70 L -70 -142 L -34 -104 L 0 -158 L 34 -104 L 70 -142 L 66 -70 Z" fill={C.gold} stroke={C.ink} strokeWidth={LINE} strokeLinejoin="round" />
      <circle cx="0" cy="-122" r="9" fill={C.terracotta} stroke={C.ink} strokeWidth="4" />
    </g>
  );
};

// Beards sit over the lower face but under the mouth.
const Beard = ({who}) => {
  if (who === 'scholar') {
    return <path d="M -80 20 Q -70 120 0 150 Q 70 120 80 20 Q 40 62 0 58 Q -40 62 -80 20 Z" fill={C.parchment} stroke={C.ink} strokeWidth={LINE} strokeLinejoin="round" />;
  }
  if (who === 'ruler') return <path d="M -76 24 Q -66 96 0 104 Q 66 96 76 24 Q 40 60 0 56 Q -40 60 -76 24 Z" fill="#2A1B14" />;
  return null;
};

const Body = ({who, robe, trim, step = null}) => (
  <g>
    {/* step: null = standing; a number = the walk cycle (radians): feet alternate, one lifting while the other plants */}
    <ellipse cx={-44 + (step === null ? 0 : Math.sin(step) * 42)} cy={6 - (step === null ? 0 : Math.max(0, Math.sin(step)) * 34)} rx="38" ry="16" fill={C.ink} />
    <ellipse cx={44 + (step === null ? 0 : -Math.sin(step) * 42)} cy={6 - (step === null ? 0 : Math.max(0, -Math.sin(step)) * 34)} rx="38" ry="16" fill={C.ink} />
    <path d="M -112 0 L -84 -330 Q 0 -358 84 -330 L 112 0 Z" fill={robe} stroke={C.ink} strokeWidth={LINE} strokeLinejoin="round" />
    {who === 'narrator' && (
      <g>
        <path d="M 0 -340 L 0 -10" stroke={C.ink} strokeWidth="5" />
        {[-250, -180, -110, -40].map((y) => (
          <circle key={y} cx="26" cy={y} r="9" fill={C.gold} stroke={C.ink} strokeWidth="4" />
        ))}
        <path d="M -84 -320 L 70 -40" stroke={C.terracotta} strokeWidth="26" strokeLinecap="round" />
      </g>
    )}
    {who === 'scholar' && (
      <g>
        <path d="M -60 -334 L 88 -20" stroke={trim} strokeWidth="30" />
        <circle cx="-62" cy="-322" r="14" fill={C.gold} stroke={C.ink} strokeWidth="5" />
        <path d="M -112 -4 L 112 -4" stroke={trim} strokeWidth="14" />
      </g>
    )}
    {who === 'ruler' && (
      <g>
        <path d="M -60 -344 L 0 -230 L 60 -344 Z" fill={trim} stroke={C.ink} strokeWidth="6" strokeLinejoin="round" />
        <path d="M -112 -6 L 112 -6" stroke={C.gold} strokeWidth="20" />
        <path d="M -108 -30 L 108 -30" stroke={C.teal} strokeWidth="14" />
      </g>
    )}
    {who === 'narrator' && (
      <path d="M -62 -338 Q 0 -300 62 -338 L 56 -362 Q 0 -340 -56 -362 Z" fill={C.parchment} stroke={C.ink} strokeWidth="6" strokeLinejoin="round" />
    )}
  </g>
);

const HeldProp = ({who, x, y, tilt}) => {
  if (who === 'narrator') {
    return (
      <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
        <line x1="0" y1="40" x2="0" y2="-330" stroke={C.ink} strokeWidth="22" strokeLinecap="round" />
        <line x1="0" y1="40" x2="0" y2="-330" stroke="#8A5A3A" strokeWidth="10" strokeLinecap="round" />
        <rect x="-135" y="-440" width="270" height="140" rx="22" fill={C.terracotta} stroke={C.ink} strokeWidth={LINE} />
        <rect x="-118" y="-424" width="236" height="108" rx="14" fill="none" stroke={C.parchment} strokeWidth="5" />
        <text x="0" y="-340" textAnchor="middle" fontFamily={HEAD} fontSize="88" fill={C.parchment} stroke={C.ink} strokeWidth="2">POV</text>
      </g>
    );
  }
  if (who === 'scholar') {
    return (
      <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
        <rect x="-32" y="-70" width="64" height="150" rx="14" fill={C.parchment} stroke={C.ink} strokeWidth={LINE - 1} />
        <ellipse cx="0" cy="-70" rx="32" ry="12" fill="#E3CC98" stroke={C.ink} strokeWidth="5" />
        <ellipse cx="0" cy="80" rx="32" ry="12" fill="#E3CC98" stroke={C.ink} strokeWidth="5" />
        <path d="M -16 -30 L 16 -30 M -16 -6 L 16 -6 M -16 18 L 10 18" stroke={C.ink} strokeWidth="4" strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
      <line x1="0" y1="60" x2="0" y2="-300" stroke={C.ink} strokeWidth="24" strokeLinecap="round" />
      <line x1="0" y1="60" x2="0" y2="-300" stroke={C.gold} strokeWidth="11" strokeLinecap="round" />
      <circle cx="0" cy="-322" r="34" fill={C.teal} stroke={C.ink} strokeWidth={LINE} />
      <circle cx="0" cy="-322" r="12" fill={C.gold} stroke={C.ink} strokeWidth="4" />
    </g>
  );
};

/**
 * who, pose, mouth (0|1|2), x and y (where the feet are), scale, frame (frames since the scene began),
 * enterAt (frames to wait before popping in), seed (desynchronises idle motion between characters)
 */
/** The head alone (beard, face with mouth and expression, hair or hat): used by the reference sheets and close-ups. */
export const Head = ({who = 'narrator', mouth = 'X', expression = 'neutral', look = [0, 0], blink = false}) => {
  const look_ = CAST[who] || CAST.narrator;
  return (
    <g>
      <Beard who={who} />
      <Face skin={look_.skin} mouth={mouth} blink={blink} expression={expression} look={look} />
      <HeadFront who={who} />
    </g>
  );
};

export const Character = ({who = 'narrator', pose = 'stand', poseTo = null, blend = 0, mouth = 0, x = 540, y = 1180, scale = 1.3, frame,
  enterAt = 0, seed = 0, expression = 'neutral', look = [0, 0], walking = false, noProp = false}) => {
  const {fps} = useVideoConfig();
  const look_ = CAST[who] || CAST.narrator;
  const A = POSES[pose] || POSES.stand;
  const B = POSES[poseTo] || A;
  const mix = (u, v) => u + (v - u) * Math.max(0, Math.min(1, blend));
  const P = {L: [mix(A.L[0], B.L[0]), mix(A.L[1], B.L[1])], R: [mix(A.R[0], B.R[0]), mix(A.R[1], B.R[1])], head: mix(A.head, B.head)};
  const enter = spring({frame: frame - enterAt, fps, config: {damping: 11, stiffness: 120, mass: 0.7}});
  const t = frame + seed * 17;
  const stride = walking ? frame / 3.2 : null;   // one full step cycle about every 20 frames
  const breathe = Math.sin(t / 9) * 0.012;
  const sway = walking ? Math.sin(stride) * 3 : Math.sin(t / 21) * 2.2;
  const bob = walking ? -Math.abs(Math.sin(stride)) * 20 : 0;
  const talk = typeof mouth === 'string' ? (mouth === 'X' || mouth === 'A' ? 0 : 2) : mouth > 0 ? Math.sin(t / 2.4) * 2 : 0;
  const blinkNow = frame > 20 && (t + seed * 29) % 104 < 4;
  const swayArm = walking ? Math.sin(stride) * 12 : pose === 'wave' && !poseTo ? Math.sin(t / 3) * 16 : Math.sin(t / 13) * 3;
  const [lsh, lel] = P.L;
  const [rsh, rel] = P.R;
  const [hx, hy, hth] = handAt(-1, lsh + swayArm, lel);
  const eff = Math.max(0, enter);
  const sleeve = look_.robe === C.parchment ? '#E3CC98' : look_.robe;
  const k = scale * (0.82 + 0.18 * eff);
  return (
    <g transform={`translate(${x} ${y + bob + (1 - eff) * 160}) scale(${k} ${k * (1 + breathe)}) rotate(${sway * 0.4})`} opacity={Math.min(1, eff * 2)}>
      <ellipse cx="0" cy="14" rx="150" ry="22" fill={C.ink} opacity="0.18" />
      <Body who={who} robe={look_.robe} trim={look_.trim} step={stride} />
      <Arm side={1} shoulder={rsh + (walking ? -swayArm : swayArm)} elbow={rel} sleeve={sleeve} skin={look_.skin} />
      <Arm side={-1} shoulder={lsh + swayArm} elbow={lel} sleeve={sleeve} skin={look_.skin} />
      {!noProp && <HeldProp who={who} x={hx} y={hy + 4} tilt={-hth * 0.22} />}
      <g transform={`translate(0 -440) rotate(${P.head + sway + talk * 0.6})`}>
        <Beard who={who} />
        <Face skin={look_.skin} mouth={mouth} blink={blinkNow} brow={pose === 'amazed' ? 14 : 0} expression={pose === 'amazed' && expression === 'neutral' ? 'surprised' : expression} look={look} />
        <HeadFront who={who} />
      </g>
    </g>
  );
};
