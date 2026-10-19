// People who move like real people (2.55.0, the owner: "set up the animation first"). The cast's look (tis.jsx: outlined, two-tone
// skin, the same heads and clothes) on a jointed body: thigh + shin + shoe, upper arm + forearm + hand, the torso and the head
// leaning, driven frame by frame by motion capture (motions.js, made by mocap.py from the CMU database). The old Figure swung a
// stiff leg on a sine; this one bends its knees, plants its feet and walks like the recording.
//
// <Mover who motion t dir expr .../>: motion = a name in MOTIONS (walk, walk_sad, limp, run, swim, ladder, wave, cry...), t = the
// frame inside it (a loop wraps, a one-shot holds its last frame), dir = 1 facing right, -1 facing left (side view), 0 = facing us
// (the front view of the same recording). Drawn in Figure's units: hips at y 600, feet on the ground at y 1090, so a scene can swap
// <Figure pose="walk"> for <Mover motion="walk"> at the same place and scale.
import React from 'react';
import {INK, ST, st, CAST, SKINS, Head} from './tis';
import {MOTIONS, MOTION_KEYS} from './motions';

const K = Object.fromEntries(MOTION_KEYS.map((k, i) => [k, i]));
const THIGH = 225, SHIN = 225, UPPER = 150, FORE = 150, HIP_Y = 600, SHOULDER = 270, FLOOR = 1090, SHOE = 44;
const rad = (d) => (d * Math.PI) / 180;

// the pose at frame t (fractional frames blend)
export const poseAt = (name, t, view = 'side') => {
  const m = MOTIONS[name];
  if (!m) return null;
  const rows = m[view], n = rows.length;
  const x = m.loop ? ((t % n) + n) % n : Math.max(0, Math.min(n - 1, t));
  const i = Math.floor(x), j = m.loop ? (i + 1) % n : Math.min(n - 1, i + 1), w = x - i;
  const a = rows[i], b = rows[j];
  return {
    ang: (k) => a[K[k]] + (b[K[k]] - a[K[k]]) * w,
    ground: m.ground[i] + (m.ground[j] - m.ground[i]) * w,
  };
};
export const motionSpeed = (name) => (MOTIONS[name] || {}).speed || 0;   // kit units per frame, forward
export const motionFrames = (name) => ((MOTIONS[name] || {}).side || []).length;
export const MOTION_NAMES = Object.keys(MOTIONS);

// a limb segment from p, `len` long, at angle a from straight down (positive = forward / toward screen right)
const end = (p, a, len) => [p[0] + Math.sin(rad(a)) * len, p[1] + Math.cos(rad(a)) * len];
// a bent limb through its joints: one outline under one fill, so the knee or elbow has no seam (two outlined pieces showed a ring)
const Chain = ({pts, w, fill, cap = null}) => {
  const d = pts.map((p, i) => (i ? 'L' : 'M') + ' ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return (
    <g>
      <path d={d} fill="none" stroke={INK} strokeWidth={w + 14} strokeLinecap="round" strokeLinejoin="round" />
      {cap}
      <path d={d} fill="none" stroke={fill} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
};
// the shoe: a rounded sole along the foot (a ~ 90 = flat, toes forward); from the front, an oval under the ankle
const Shoe = ({at, a, side, fill, shoe = true}) => {
  const col = shoe ? '#3F2A1E' : fill;
  if (!side) return <ellipse cx={at[0]} cy={at[1] + 22} rx={46} ry={26} fill={col} {...ST} />;
  const toe = end(at, a, 86), heel = end(at, a + 180, 14);
  return <Chain pts={[heel, toe]} w={46} fill={col} />;
};

export function Mover({who = 'juliane', motion = 'walk', t = 0, dir = 1, expr = 'calm', f = 0, talk = false, seed = 1, look = 0, shoes = true, shadow = true}) {
  const side = dir !== 0;
  const P = poseAt(motion, t, side ? 'side' : 'front');
  if (!P) return null;
  const c = CAST[who] || CAST.passenger;
  const sk = SKINS[c.skin] || SKINS.light;
  const A = P.ang;
  // the hips sit where the lowest point of the body touches the floor
  const hipY = Math.min(FLOOR - SHOE + P.ground, FLOOR - 60);   // ground: the lowest point's height below the hips (about -450 standing)
  const hip = [0, hipY];
  const torso = A('torso'), neck = A('neck');
  // the upper body turns about the hips by the torso's lean
  const rot = (p) => { const r = rad(torso), dx = p[0], dy = p[1] - HIP_Y; return [hip[0] + dx * Math.cos(r) - dy * Math.sin(r), hip[1] + dx * Math.sin(r) + dy * Math.cos(r)]; };
  const legs = side ? [['L', 0], ['R', 0]] : [['L', 62], ['R', -62]];   // front view: the character's left is screen right
  const arms = side ? [['L', 0], ['R', 0]] : [['L', 150], ['R', -150]];
  // side view facing right shows the character's RIGHT side: right limbs are near (drawn last), left far (shaded)
  const near = side ? 'R' : null;
  const leg = ([s, x]) => {
    const h = [hip[0] + x * (side ? 0.4 : 1), hip[1]];
    const k = end(h, A('thigh' + s), THIGH), an = end(k, A('shin' + s), SHIN);
    const fill = side && s !== near ? sk.shade : sk.light;
    return (
      <g key={'leg' + s}>
        <Chain pts={[h, k, an]} w={64} fill={fill} />
        <Shoe at={an} a={A('foot' + s)} side={side} fill={fill} shoe={shoes} />
      </g>
    );
  };
  const arm = ([s, x]) => {
    const sh = rot([x * (side ? 0.3 : 1), SHOULDER]);
    const el = end(sh, A('arm' + s), UPPER), wr = end(el, A('fore' + s), FORE);
    const fill = side && s !== near ? sk.shade : sk.light;
    return (
      <g key={'arm' + s}>
        <Chain pts={[sh, el, wr]} w={48} fill={fill} />
        <circle cx={wr[0]} cy={wr[1]} r={30} fill={fill} {...ST} />
      </g>
    );
  };
  const dress = (
    <g transform={`rotate(${torso} ${hip[0]} ${hip[1]}) translate(0 ${hip[1] - HIP_Y}) ${side ? 'scale(0.74 1)' : ''}`}>
      <path d="M -60 216 C -128 230 -166 250 -170 300 L -186 650 L 186 650 L 170 300 C 166 250 128 230 60 216 C 36 258 -36 258 -60 216 Z" fill={c.dress} {...ST} />
      <path d="M 96 236 C 150 254 166 280 168 320 L 182 650 L 120 650 Z" fill={c.dressShade} />
    </g>
  );
  const head = rot([0, 0]);
  const neckAt = rot([0, 200]);
  const far = side ? ['L'] : [], nearL = side ? ['R'] : ['L', 'R'];
  return (
    <g transform={side && dir < 0 ? 'scale(-1 1)' : ''}>
      {shadow && <ellipse cx={0} cy={FLOOR} rx={side ? 160 : 200} ry={28} fill="#000" opacity={0.18} />}
      {far.map((s) => arm(arms.find((a) => a[0] === s)))}
      {side ? [legs[0], legs[1]].map(leg) : legs.map(leg)}
      {dress}
      {nearL.map((s) => arm(arms.find((a) => a[0] === s)))}
      <g transform={`translate(${head[0]} ${head[1]}) rotate(${torso + (neck - torso) * 0.6} ${neckAt[0] - head[0]} ${neckAt[1] - head[1]})`}>
        <Head who={who} expr={expr} f={f} talk={talk} look={look} seed={seed} turn={side ? 1 : 0} />
      </g>
    </g>
  );
}
